#!/usr/bin/env node
/**
 * Human Annotation Collection Framework
 * 
 * Framework for collecting human annotations on our own samples.
 * Creates a structured workflow for humans to annotate screenshots with:
 * - Scores (0-10)
 * - Issues (arrays)
 * - Reasoning (text)
 * - Temporal annotations (for gameplay sequences)
 * 
 * This creates REAL human ground truth, not just expected ranges.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

const ANNOTATIONS_DIR = join(process.cwd(), 'evaluation', 'datasets', 'human-annotations');
const PENDING_DIR = join(ANNOTATIONS_DIR, 'pending'); // Keep as 'pending' to match existing files
const COMPLETED_DIR = join(ANNOTATIONS_DIR, 'completed');

if (!existsSync(ANNOTATIONS_DIR)) {
  mkdirSync(ANNOTATIONS_DIR, { recursive: true });
}
if (!existsSync(PENDING_DIR)) {
  mkdirSync(PENDING_DIR, { recursive: true });
}
if (!existsSync(COMPLETED_DIR)) {
  mkdirSync(COMPLETED_DIR, { recursive: true });
}

/**
 * Create annotation task from dataset sample
 */
function createAnnotationTask(sample, annotatorId) {
  // Infer category from URL or name if not provided
  let category = sample.category;
  if (!category) {
    if (sample.url) {
      const url = sample.url.toLowerCase();
      if (url.includes('github')) category = 'developer-tools';
      else if (url.includes('mozilla') || url.includes('mdn')) category = 'documentation';
      else if (url.includes('w3.org') || url.includes('w3c')) category = 'standards';
      else if (url.includes('example')) category = 'minimal';
      else category = 'general';
    } else {
      category = 'general';
    }
  }
  
  return {
    id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sampleId: sample.id,
    sampleName: sample.name,
    screenshot: sample.screenshot,
    url: sample.url,
    category: category,
    prompt: `Evaluate this ${category} webpage. Consider:
- Visual design and aesthetics
- Accessibility and usability
- Layout and information hierarchy
- User experience
- Any issues or problems`,
    expectedScore: sample.groundTruth?.expectedScore || null,
    knownGood: sample.groundTruth?.knownGood || [],
    knownBad: sample.groundTruth?.knownBad || [],
    annotatorId,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
}

/**
 * Collect human annotation interactively
 */
async function collectHumanAnnotation(task) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (prompt) => new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
  
  try {
    console.log(`\n📋 Annotation Task: ${task.sampleName}`);
    if (task.category && task.category !== 'undefined') {
      console.log(`   Category: ${task.category}`);
    }
    if (task.url) {
      console.log(`   URL: ${task.url}`);
    }
    if (task.screenshot) {
      console.log(`   Screenshot: ${task.screenshot}`);
    }
    if (task.expectedScore) {
      console.log(`   Expected Score Range: ${task.expectedScore.min}-${task.expectedScore.max}`);
    }
    if (task.knownGood && task.knownGood.length > 0) {
      console.log(`   Known Good Features: ${task.knownGood.join(', ')}`);
    }
    if (task.knownBad && task.knownBad.length > 0) {
      console.log(`   Known Bad Features: ${task.knownBad.join(', ')}`);
    }
    
    // Score
    let humanScore;
    while (true) {
      const scoreInput = await question('\n📊 Score (0-10): ');
      humanScore = parseFloat(scoreInput);
      if (!isNaN(humanScore) && humanScore >= 0 && humanScore <= 10) {
        break;
      }
      console.log('   ⚠️  Please enter a number between 0 and 10');
    }
    
    // Issues
    console.log('\n🐛 Issues (press Enter after each, empty line to finish):');
    const humanIssues = [];
    while (true) {
      const issue = await question('   Issue: ');
      if (!issue.trim()) break;
      humanIssues.push(issue.trim());
    }
    
    // Reasoning
    console.log('\n💭 Reasoning (press Enter twice to finish):');
    const reasoningLines = [];
    let emptyCount = 0;
    while (emptyCount < 2) {
      const line = await question('   ');
      if (!line.trim()) {
        emptyCount++;
      } else {
        emptyCount = 0;
        reasoningLines.push(line);
      }
    }
    const humanReasoning = reasoningLines.join('\n');
    
    // Additional notes
    const additionalNotes = await question('\n📝 Additional notes (optional, press Enter to skip): ');
    
    const annotation = {
      id: task.id,
      sampleId: task.sampleId,
      screenshot: task.screenshot,
      url: task.url,
      category: task.category,
      prompt: task.prompt,
      humanScore,
      humanIssues,
      humanReasoning,
      additionalNotes: additionalNotes.trim() || null,
      annotatorId: task.annotatorId,
      timestamp: new Date().toISOString(),
      // Compare with expected if available
      expectedScore: task.expectedScore,
      difference: task.expectedScore 
        ? humanScore - ((task.expectedScore.min + task.expectedScore.max) / 2)
        : null
    };
    
    return annotation;
  } finally {
    rl.close();
  }
}

/**
 * Create annotation tasks from dataset
 */
function createAnnotationTasks(datasetPath, annotatorId) {
  const dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  const tasks = [];
  
  for (const sample of dataset.samples || []) {
    // Skip if already has human annotation
    // Check both old format (humanAnnotations.humanScore) and new format (humanAnnotations exists with score)
    const hasAnnotation = sample.groundTruth?.humanAnnotations?.humanScore !== null && 
                         sample.groundTruth?.humanAnnotations?.humanScore !== undefined;
    if (hasAnnotation) {
      continue;
    }
    
    const task = createAnnotationTask(sample, annotatorId);
    tasks.push(task);
    
    // Save task
    const taskPath = join(PENDING_DIR, `${task.id}.json`);
    writeFileSync(taskPath, JSON.stringify(task, null, 2));
  }
  
  return tasks;
}

/**
 * Process annotation task
 */
async function processAnnotationTask(taskId) {
  const taskPath = join(PENDING_DIR, `${taskId}.json`);
  if (!existsSync(taskPath)) {
    throw new Error(`Task not found: ${taskId}`);
  }
  
  const task = JSON.parse(readFileSync(taskPath, 'utf-8'));
  const annotation = await collectHumanAnnotation(task);
  
  // Save annotation
  const annotationPath = join(COMPLETED_DIR, `${annotation.id}.json`);
  writeFileSync(annotationPath, JSON.stringify(annotation, null, 2));
  
  // Move task to completed
  const completedTaskPath = join(COMPLETED_DIR, `task-${taskId}.json`);
  writeFileSync(completedTaskPath, JSON.stringify({ ...task, status: 'completed' }, null, 2));
  
  // Remove from pending
  const fs = await import('fs/promises');
  await fs.unlink(taskPath);
  
  return annotation;
}

/**
 * List pending annotation tasks
 */
function listPendingTasks() {
  const files = readdirSync(PENDING_DIR).filter(f => f.endsWith('.json'));
  const tasks = files.map(f => {
    const task = JSON.parse(readFileSync(join(PENDING_DIR, f), 'utf-8'));
    return {
      id: task.id,
      sampleName: task.sampleName,
      category: task.category,
      createdAt: task.createdAt
    };
  });
  
  return tasks;
}

/**
 * Integrate annotations back into dataset
 */
function integrateAnnotations(datasetPath) {
  const dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  const annotationFiles = readdirSync(COMPLETED_DIR).filter(f => f.startsWith('annotation-') && f.endsWith('.json'));
  
  let integratedCount = 0;
  
  for (const file of annotationFiles) {
    const annotation = JSON.parse(readFileSync(join(COMPLETED_DIR, file), 'utf-8'));
    
    // Find matching sample
    const sample = dataset.samples.find(s => s.id === annotation.sampleId);
    if (sample) {
      sample.groundTruth.humanAnnotations = {
        humanScore: annotation.humanScore,
        humanIssues: annotation.humanIssues,
        humanReasoning: annotation.humanReasoning,
        additionalNotes: annotation.additionalNotes,
        annotatorId: annotation.annotatorId,
        timestamp: annotation.timestamp
      };
      integratedCount++;
    }
  }
  
  // Save updated dataset
  writeFileSync(datasetPath, JSON.stringify(dataset, null, 2));
  
  return integratedCount;
}

/**
 * Generate annotation report
 */
function generateAnnotationReport() {
  const annotationFiles = readdirSync(COMPLETED_DIR).filter(f => f.startsWith('annotation-') && f.endsWith('.json'));
  const annotations = annotationFiles.map(f => 
    JSON.parse(readFileSync(join(COMPLETED_DIR, f), 'utf-8'))
  );
  
  const report = {
    total: annotations.length,
    byCategory: {},
    byAnnotator: {},
    scoreDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 },
    averageScore: 0,
    totalIssues: 0
  };
  
  let totalScore = 0;
  
  for (const ann of annotations) {
    // By category
    report.byCategory[ann.category] = (report.byCategory[ann.category] || 0) + 1;
    
    // By annotator
    report.byAnnotator[ann.annotatorId] = (report.byAnnotator[ann.annotatorId] || 0) + 1;
    
    // Score distribution
    const scoreBucket = Math.floor(ann.humanScore);
    report.scoreDistribution[scoreBucket] = (report.scoreDistribution[scoreBucket] || 0) + 1;
    
    // Total score
    totalScore += ann.humanScore;
    
    // Total issues
    report.totalIssues += ann.humanIssues.length;
  }
  
  report.averageScore = annotations.length > 0 ? totalScore / annotations.length : 0;
  
  return report;
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'create-tasks') {
    const datasetPath = process.argv[3] || join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');
    const annotatorId = process.argv[4] || 'annotator-1';
    
    const tasks = createAnnotationTasks(datasetPath, annotatorId);
    console.log(`✅ Created ${tasks.length} annotation tasks`);
    console.log(`   Pending: ${PENDING_DIR}`);
  } else if (command === 'list') {
    const tasks = listPendingTasks();
    console.log(`\n📋 Pending Annotation Tasks: ${tasks.length}\n`);
    for (const task of tasks) {
      console.log(`   ${task.id}: ${task.sampleName} (${task.category})`);
    }
  } else if (command === 'annotate') {
    const taskId = process.argv[3];
    if (!taskId) {
      console.error('❌ Please provide task ID');
      process.exit(1);
    }
    
    processAnnotationTask(taskId).then(annotation => {
      console.log(`\n✅ Annotation completed!`);
      console.log(`   Score: ${annotation.humanScore}/10`);
      console.log(`   Issues: ${annotation.humanIssues.length}`);
      console.log(`   Saved: evaluation/datasets/human-annotations/completed/${annotation.id}.json`);
    }).catch(error => {
      console.error('❌ Annotation failed:', error.message);
      process.exit(1);
    });
  } else if (command === 'integrate') {
    const datasetPath = process.argv[3] || join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');
    const count = integrateAnnotations(datasetPath);
    console.log(`✅ Integrated ${count} annotations into dataset`);
  } else if (command === 'report') {
    const report = generateAnnotationReport();
    console.log('\n📊 Annotation Report\n');
    console.log(`Total Annotations: ${report.total}`);
    console.log(`Average Score: ${report.averageScore.toFixed(2)}/10`);
    console.log(`Total Issues: ${report.totalIssues}`);
    console.log('\nBy Category:');
    for (const [category, count] of Object.entries(report.byCategory)) {
      console.log(`  ${category}: ${count}`);
    }
    console.log('\nBy Annotator:');
    for (const [annotator, count] of Object.entries(report.byAnnotator)) {
      console.log(`  ${annotator}: ${count}`);
    }
  } else {
    console.log(`
Human Annotation Collection Framework

Usage:
  node evaluation/utils/collect-human-annotations.mjs <command> [args]

Commands:
  create-tasks [dataset] [annotator-id]
    Create annotation tasks from dataset
    
  list
    List pending annotation tasks
    
  annotate <task-id>
    Collect human annotation for a task
    
  integrate [dataset]
    Integrate completed annotations back into dataset
    
  report
    Generate annotation report

Examples:
  node evaluation/utils/collect-human-annotations.mjs create-tasks evaluation/datasets/real-dataset.json annotator-1
  node evaluation/utils/collect-human-annotations.mjs list
  node evaluation/utils/collect-human-annotations.mjs annotate annotation-1234567890-abc
  node evaluation/utils/collect-human-annotations.mjs integrate evaluation/datasets/real-dataset.json
  node evaluation/utils/collect-human-annotations.mjs report
`);
  }
}

export {
  createAnnotationTask,
  collectHumanAnnotation,
  createAnnotationTasks,
  processAnnotationTask,
  listPendingTasks,
  integrateAnnotations,
  generateAnnotationReport
};

