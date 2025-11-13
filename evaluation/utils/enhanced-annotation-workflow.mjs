#!/usr/bin/env node
/**
 * Enhanced Annotation Workflow
 * 
 * Improved annotation workflow with:
 * - Batch annotation support
 * - Quality checks during annotation
 * - Integration with VLLM judgments
 * - Calibration tracking
 * - Progress tracking
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import {
  collectHumanJudgment,
  loadHumanJudgment,
  compareJudgments
} from '../human-validation/human-validation.mjs';

const ANNOTATIONS_DIR = join(process.cwd(), 'evaluation', 'datasets', 'human-annotations');
const TASKS_DIR = join(ANNOTATIONS_DIR, 'tasks');
const COMPLETED_DIR = join(ANNOTATIONS_DIR, 'completed');
const CALIBRATION_DIR = join(ANNOTATIONS_DIR, 'calibration');

if (!existsSync(ANNOTATIONS_DIR)) {
  mkdirSync(ANNOTATIONS_DIR, { recursive: true });
}
if (!existsSync(TASKS_DIR)) {
  mkdirSync(TASKS_DIR, { recursive: true });
}
if (!existsSync(COMPLETED_DIR)) {
  mkdirSync(COMPLETED_DIR, { recursive: true });
}
if (!existsSync(CALIBRATION_DIR)) {
  mkdirSync(CALIBRATION_DIR, { recursive: true });
}

/**
 * Enhanced annotation with quality checks
 */
async function collectAnnotationWithQualityCheck(task, vllmJudgment = null) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (prompt) => new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
  
  try {
    console.log(`\n📋 Annotating: ${task.sampleName}`);
    console.log(`   Category: ${task.category}`);
    if (task.url) console.log(`   URL: ${task.url}`);
    
    // Show VLLM judgment if available
    if (vllmJudgment) {
      console.log(`\n🤖 VLLM Judgment:`);
      console.log(`   Score: ${vllmJudgment.vllmScore || vllmJudgment.score}/10`);
      if (vllmJudgment.vllmIssues?.length > 0) {
        console.log(`   Issues: ${vllmJudgment.vllmIssues.join(', ')}`);
      }
      console.log(`   Provider: ${vllmJudgment.provider || 'unknown'}`);
    }
    
    if (task.expectedScore) {
      console.log(`   Expected: ${task.expectedScore.min}-${task.expectedScore.max}`);
    }
    
    // Score with validation
    let score;
    let attempts = 0;
    while (attempts < 3) {
      const input = await question('\n📊 Score (0-10): ');
      score = parseFloat(input);
      
      if (!isNaN(score) && score >= 0 && score <= 10) {
        // Quality check: if VLLM judgment exists, check for large discrepancy
        if (vllmJudgment && Math.abs(score - (vllmJudgment.vllmScore || vllmJudgment.score)) > 5) {
          const confirm = await question(`   ⚠️  Large discrepancy with VLLM (${Math.abs(score - (vllmJudgment.vllmScore || vllmJudgment.score))} points). Confirm? (y/n): `);
          if (confirm.toLowerCase() !== 'y') {
            attempts++;
            continue;
          }
        }
        break;
      }
      console.log('   ⚠️  Enter 0-10');
      attempts++;
    }
    
    if (attempts >= 3) {
      throw new Error('Too many invalid score attempts');
    }
    
    // Issues
    console.log('\n🐛 Issues (Enter after each, empty to finish):');
    const issues = [];
    while (true) {
      const issue = await question('   Issue: ');
      if (!issue.trim()) break;
      issues.push(issue.trim());
    }
    
    // Reasoning
    console.log('\n💭 Reasoning (Enter twice to finish):');
    const lines = [];
    let emptyCount = 0;
    while (emptyCount < 2) {
      const line = await question('   ');
      if (!line.trim()) {
        emptyCount++;
      } else {
        emptyCount = 0;
        lines.push(line);
      }
    }
    const reasoning = lines.join('\n');
    
    // Quality check: reasoning length
    if (reasoning.length < 20) {
      const confirm = await question('   ⚠️  Reasoning seems short. Continue? (y/n): ');
      if (confirm.toLowerCase() !== 'y') {
        return null; // User wants to redo
      }
    }
    
    const annotation = {
      id: task.id,
      sampleId: task.sampleId,
      screenshot: task.screenshot,
      url: task.url,
      category: task.category,
      humanScore: score,
      humanIssues: issues,
      humanReasoning: reasoning,
      annotatorId: task.annotatorId,
      timestamp: new Date().toISOString(),
      expectedScore: task.expectedScore,
      difference: task.expectedScore 
        ? score - ((task.expectedScore.min + task.expectedScore.max) / 2)
        : null,
      // VLLM comparison if available
      vllmComparison: vllmJudgment ? {
        vllmScore: vllmJudgment.vllmScore || vllmJudgment.score,
        scoreDifference: score - (vllmJudgment.vllmScore || vllmJudgment.score),
        vllmIssues: vllmJudgment.vllmIssues || [],
        issueOverlap: calculateIssueOverlap(issues, vllmJudgment.vllmIssues || [])
      } : null
    };
    
    return annotation;
  } finally {
    rl.close();
  }
}

/**
 * Calculate issue overlap between human and VLLM
 */
function calculateIssueOverlap(humanIssues, vllmIssues) {
  if (humanIssues.length === 0 && vllmIssues.length === 0) return 1.0;
  if (humanIssues.length === 0 || vllmIssues.length === 0) return 0.0;
  
  const humanLower = humanIssues.map(i => i.toLowerCase());
  const vllmLower = vllmIssues.map(i => i.toLowerCase());
  
  const intersection = humanLower.filter(i => vllmLower.some(v => v.includes(i) || i.includes(v)));
  const union = new Set([...humanLower, ...vllmLower]);
  
  return intersection.length / union.size;
}

/**
 * Batch annotation with progress tracking
 */
async function batchAnnotate(taskIds, options = {}) {
  const {
    vllmJudgments = {},
    maxPerSession = 10,
    showProgress = true
  } = options;
  
  const tasks = taskIds.map(id => {
    const taskPath = join(TASKS_DIR, `${id}.json`);
    if (!existsSync(taskPath)) {
      return null;
    }
    return JSON.parse(readFileSync(taskPath, 'utf-8'));
  }).filter(Boolean);
  
  const results = {
    completed: [],
    skipped: [],
    failed: []
  };
  
  let count = 0;
  for (const task of tasks) {
    if (count >= maxPerSession) {
      console.log(`\n⏸️  Reached max per session (${maxPerSession}). Continue later.`);
      break;
    }
    
    if (showProgress) {
      console.log(`\n📊 Progress: ${count + 1}/${tasks.length}`);
    }
    
    try {
      const vllmJudgment = vllmJudgments[task.sampleId] || null;
      const annotation = await collectAnnotationWithQualityCheck(task, vllmJudgment);
      
      if (!annotation) {
        results.skipped.push(task.id);
        continue;
      }
      
      // Save annotation
      writeFileSync(
        join(COMPLETED_DIR, `${annotation.id}.json`),
        JSON.stringify(annotation, null, 2)
      );
      
      // Mark task complete
      task.status = 'completed';
      writeFileSync(join(TASKS_DIR, `${task.id}.json`), JSON.stringify(task, null, 2));
      
      results.completed.push(annotation);
      count++;
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      results.failed.push({ taskId: task.id, error: error.message });
    }
  }
  
  return results;
}

/**
 * Load VLLM judgments for comparison
 */
function loadVLLMJudgments(judgmentDir) {
  const judgments = {};
  
  if (!existsSync(judgmentDir)) {
    return judgments;
  }
  
  const files = readdirSync(judgmentDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const judgment = JSON.parse(readFileSync(join(judgmentDir, file), 'utf-8'));
      // Match by screenshot path or sample ID
      if (judgment.screenshot) {
        judgments[judgment.screenshot] = judgment;
      }
      if (judgment.sampleId) {
        judgments[judgment.sampleId] = judgment;
      }
    } catch (error) {
      // Skip invalid files
    }
  }
  
  return judgments;
}

/**
 * Generate calibration report from annotations
 */
function generateCalibrationReport(annotations) {
  const withVLLM = annotations.filter(a => a.vllmComparison);
  
  if (withVLLM.length === 0) {
    return {
      message: 'No VLLM comparisons available',
      sampleCount: annotations.length
    };
  }
  
  const scoreDifferences = withVLLM.map(a => a.vllmComparison.scoreDifference);
  const avgDifference = scoreDifferences.reduce((a, b) => a + b, 0) / scoreDifferences.length;
  const mae = scoreDifferences.reduce((sum, diff) => sum + Math.abs(diff), 0) / scoreDifferences.length;
  const rmse = Math.sqrt(
    scoreDifferences.reduce((sum, diff) => sum + diff * diff, 0) / scoreDifferences.length
  );
  
  const issueOverlaps = withVLLM
    .map(a => a.vllmComparison.issueOverlap)
    .filter(o => !isNaN(o));
  const avgIssueOverlap = issueOverlaps.length > 0
    ? issueOverlaps.reduce((a, b) => a + b, 0) / issueOverlaps.length
    : 0;
  
  return {
    sampleCount: annotations.length,
    withVLLMComparison: withVLLM.length,
    scoreBias: avgDifference,
    mae,
    rmse,
    avgIssueOverlap,
    recommendations: generateRecommendations(avgDifference, mae, avgIssueOverlap)
  };
}

/**
 * Generate recommendations from calibration metrics
 */
function generateRecommendations(bias, mae, issueOverlap) {
  const recommendations = [];
  
  if (Math.abs(bias) > 2) {
    recommendations.push(
      `VLLM scores are ${bias > 0 ? 'higher' : 'lower'} than human scores by ${Math.abs(bias).toFixed(1)} points on average. Consider adjusting scoring calibration.`
    );
  }
  
  if (mae > 3) {
    recommendations.push(
      `High mean absolute error (${mae.toFixed(1)}). VLLM and human scores differ significantly. Consider improving prompts or rubrics.`
    );
  }
  
  if (issueOverlap < 0.3) {
    recommendations.push(
      `Low issue overlap (${(issueOverlap * 100).toFixed(1)}%). VLLM and humans identify different issues. Consider improving issue detection prompts.`
    );
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Calibration looks good! VLLM and human judgments are well-aligned.');
  }
  
  return recommendations;
}

/**
 * Integrate annotations with calibration
 */
function integrateWithCalibration(datasetPath, annotationDir = COMPLETED_DIR) {
  const dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  const files = readdirSync(annotationDir).filter(f => f.endsWith('.json'));
  
  const annotations = files.map(file => 
    JSON.parse(readFileSync(join(annotationDir, file), 'utf-8'))
  );
  
  // Generate calibration report
  const calibration = generateCalibrationReport(annotations);
  
  // Save calibration report
  const calibrationPath = join(CALIBRATION_DIR, `calibration-${Date.now()}.json`);
  writeFileSync(calibrationPath, JSON.stringify(calibration, null, 2));
  
  // Integrate annotations
  let count = 0;
  for (const annotation of annotations) {
    const sample = dataset.samples.find(s => s.id === annotation.sampleId);
    if (sample) {
      if (!sample.groundTruth.humanAnnotations) {
        sample.groundTruth.humanAnnotations = {};
      }
      sample.groundTruth.humanAnnotations = {
        humanScore: annotation.humanScore,
        humanIssues: annotation.humanIssues,
        humanReasoning: annotation.humanReasoning,
        annotatorId: annotation.annotatorId,
        timestamp: annotation.timestamp,
        vllmComparison: annotation.vllmComparison
      };
      count++;
    }
  }
  
  writeFileSync(datasetPath, JSON.stringify(dataset, null, 2));
  
  return { count, calibration, calibrationPath };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2];
  
  if (cmd === 'batch-annotate') {
    const taskIds = process.argv.slice(3);
    const vllmDir = process.argv[4] || join(process.cwd(), 'evaluation', 'human-validation');
    const vllmJudgments = loadVLLMJudgments(vllmDir);
    
    batchAnnotate(taskIds, { vllmJudgments }).then(results => {
      console.log(`\n✅ Batch annotation complete!`);
      console.log(`   Completed: ${results.completed.length}`);
      console.log(`   Skipped: ${results.skipped.length}`);
      console.log(`   Failed: ${results.failed.length}`);
    });
  } else if (cmd === 'calibrate') {
    const dataset = process.argv[3] || join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');
    const result = integrateWithCalibration(dataset);
    console.log(`\n✅ Integrated ${result.count} annotations`);
    console.log(`\n📊 Calibration Report:`);
    console.log(`   Sample Count: ${result.calibration.sampleCount}`);
    console.log(`   With VLLM Comparison: ${result.calibration.withVLLMComparison}`);
    console.log(`   Score Bias: ${result.calibration.scoreBias?.toFixed(2) || 'N/A'}`);
    console.log(`   MAE: ${result.calibration.mae?.toFixed(2) || 'N/A'}`);
    console.log(`   RMSE: ${result.calibration.rmse?.toFixed(2) || 'N/A'}`);
    console.log(`   Issue Overlap: ${(result.calibration.avgIssueOverlap * 100)?.toFixed(1) || 'N/A'}%`);
    console.log(`\n💡 Recommendations:`);
    for (const rec of result.calibration.recommendations) {
      console.log(`   - ${rec}`);
    }
    console.log(`\n   Saved: ${result.calibrationPath}`);
  } else {
    console.log(`
Enhanced Annotation Workflow

Usage:
  batch-annotate <task-id>... [vllm-dir]  - Batch annotate with VLLM comparison
  calibrate [dataset]                    - Integrate annotations with calibration

Examples:
  node evaluation/utils/enhanced-annotation-workflow.mjs batch-annotate task-1 task-2 task-3
  node evaluation/utils/enhanced-annotation-workflow.mjs calibrate evaluation/datasets/real-dataset.json
`);
  }
}

export {
  collectAnnotationWithQualityCheck,
  batchAnnotate,
  loadVLLMJudgments,
  generateCalibrationReport,
  integrateWithCalibration
};

