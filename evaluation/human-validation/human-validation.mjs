#!/usr/bin/env node
/**
 * Human Validation Framework
 * 
 * Collects human judgments and calibrates VLLM against human preferences.
 * Based on research showing human validation improves LLM-as-a-Judge reliability.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { calculateCohensKappa, calculateMAE, calculateRMSE, calculateSpearmanCorrelation } from '../utils/metrics.mjs';
import { pearsonCorrelation, spearmanCorrelation } from '../../src/metrics.mjs';

const VALIDATION_DIR = join(process.cwd(), 'evaluation', 'human-validation');
if (!existsSync(VALIDATION_DIR)) {
  mkdirSync(VALIDATION_DIR, { recursive: true });
}

/**
 * Human judgment structure
 * @typedef {Object} HumanJudgment
 * @property {string} id - Unique identifier
 * @property {string} screenshot - Path to screenshot
 * @property {string} prompt - Evaluation prompt
 * @property {number} humanScore - Human score (0-10)
 * @property {string[]} humanIssues - Issues identified by human
 * @property {string} humanReasoning - Human reasoning
 * @property {string} timestamp - ISO timestamp
 * @property {string} [evaluatorId] - Optional evaluator ID
 */

/**
 * VLLM judgment structure (for comparison)
 * @typedef {Object} VLLMJudgment
 * @property {string} id - Unique identifier
 * @property {string} screenshot - Path to screenshot
 * @property {string} prompt - Evaluation prompt
 * @property {number} vllmScore - VLLM score (0-10)
 * @property {string[]} vllmIssues - Issues identified by VLLM
 * @property {string} vllmReasoning - VLLM reasoning
 * @property {string} provider - VLLM provider name
 * @property {string} timestamp - ISO timestamp
 */

/**
 * Calibration result
 * @typedef {Object} CalibrationResult
 * @property {Object} agreement - Agreement metrics
 * @property {number} agreement.kappa - Cohen's Kappa
 * @property {number} agreement.mae - Mean Absolute Error
 * @property {number} agreement.rmse - Root Mean Squared Error
 * @property {number} agreement.pearson - Pearson's correlation
 * @property {number} agreement.spearman - Spearman's correlation
 * @property {Object} bias - Bias analysis
 * @property {number} bias.scoreBias - Average difference (VLLM - Human)
 * @property {number} bias.issueBias - Issue detection bias
 * @property {string[]} recommendations - Calibration recommendations
 */

/**
 * Collect human judgment
 * 
 * SECURITY: Sanitizes judgment.id to prevent path traversal attacks
 */
export function collectHumanJudgment(judgment) {
  // Sanitize ID to prevent path traversal
  // Only allow alphanumeric, hyphens, and underscores
  const sanitizedId = String(judgment.id || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  // Limit length to prevent abuse
  const safeId = sanitizedId.substring(0, 100);
  
  const filePath = join(VALIDATION_DIR, `human-${safeId}.json`);
  
  // Additional security: Ensure path doesn't escape VALIDATION_DIR
  const resolvedPath = resolve(filePath);
  const resolvedDir = resolve(VALIDATION_DIR);
  if (!resolvedPath.startsWith(resolvedDir)) {
    throw new Error('Path traversal detected in judgment ID');
  }
  
  writeFileSync(filePath, JSON.stringify(judgment, null, 2));
  return filePath;
}

/**
 * Load human judgment
 * 
 * SECURITY: Sanitizes id to prevent path traversal attacks (same as collectHumanJudgment)
 */
export function loadHumanJudgment(id) {
  // SECURITY: Sanitize ID to prevent path traversal (same logic as collectHumanJudgment)
  const sanitizedId = String(id || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeId = sanitizedId.substring(0, 100);
  
  const filePath = join(VALIDATION_DIR, `human-${safeId}.json`);
  
  // Additional security: Ensure path doesn't escape VALIDATION_DIR
  const resolvedPath = resolve(filePath);
  const resolvedDir = resolve(VALIDATION_DIR);
  if (!resolvedPath.startsWith(resolvedDir)) {
    throw new Error('Path traversal detected in judgment ID');
  }
  
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (error) {
    // SECURITY: Handle malformed JSON gracefully to prevent DoS
    throw new Error(`Failed to parse human judgment file: ${error.message}`);
  }
}

/**
 * Compare human and VLLM judgments
 */
export function compareJudgments(humanJudgments, vllmJudgments) {
  // Match judgments by ID
  const matched = [];
  for (const human of humanJudgments) {
    const vllm = vllmJudgments.find(v => v.id === human.id);
    if (vllm) {
      matched.push({ human, vllm });
    }
  }

  if (matched.length === 0) {
    throw new Error('No matched judgments found');
  }

  // Calculate agreement metrics
  const humanScores = matched.map(m => m.human.humanScore);
  const vllmScores = matched.map(m => m.vllm.vllmScore);

  const mae = calculateMAE(vllmScores, humanScores);
  const rmse = calculateRMSE(vllmScores, humanScores);
  const pearson = pearsonCorrelation(vllmScores, humanScores) || 0;
  const spearman = spearmanCorrelation(vllmScores, humanScores) || calculateSpearmanCorrelation(vllmScores, humanScores);

  // Calculate Cohen's Kappa (for binary classification: pass/fail)
  const humanBinary = humanScores.map(s => s >= 7 ? 1 : 0);
  const vllmBinary = vllmScores.map(s => s >= 7 ? 1 : 0);
  const kappa = calculateCohensKappa(humanBinary, vllmBinary);

  // Calculate bias
  const scoreBias = vllmScores.reduce((sum, s, i) => sum + (s - humanScores[i]), 0) / matched.length;
  
  // Issue detection bias (precision/recall)
  let issueTP = 0, issueFP = 0, issueFN = 0;
  for (const { human, vllm } of matched) {
    const humanIssues = new Set(human.humanIssues);
    const vllmIssues = new Set(vllm.vllmIssues);
    
    for (const issue of vllmIssues) {
      if (humanIssues.has(issue)) issueTP++;
      else issueFP++;
    }
    for (const issue of humanIssues) {
      if (!vllmIssues.has(issue)) issueFN++;
    }
  }
  const issuePrecision = issueTP / (issueTP + issueFP) || 0;
  const issueRecall = issueTP / (issueTP + issueFN) || 0;
  const issueBias = issuePrecision - issueRecall; // Positive = over-detection, negative = under-detection

  // Generate recommendations
  const recommendations = [];
  if (Math.abs(scoreBias) > 1) {
    recommendations.push(`VLLM scores are ${scoreBias > 0 ? 'higher' : 'lower'} than human scores by ${Math.abs(scoreBias).toFixed(1)} points on average. Consider adjusting scoring calibration.`);
  }
  if (pearson < 0.7) {
    recommendations.push(`Low correlation (${pearson.toFixed(2)}) between VLLM and human scores. Consider improving prompts or rubrics.`);
  }
  if (kappa < 0.6) {
    recommendations.push(`Low agreement (κ=${kappa.toFixed(2)}) between VLLM and human binary judgments. Consider recalibration.`);
  }
  if (issueBias > 0.2) {
    recommendations.push(`VLLM over-detects issues (precision=${issuePrecision.toFixed(2)}, recall=${issueRecall.toFixed(2)}). Consider adjusting issue detection thresholds.`);
  } else if (issueBias < -0.2) {
    recommendations.push(`VLLM under-detects issues (precision=${issuePrecision.toFixed(2)}, recall=${issueRecall.toFixed(2)}). Consider improving issue detection prompts.`);
  }
  if (recommendations.length === 0) {
    recommendations.push('VLLM judgments align well with human judgments. No major calibration needed.');
  }

  return {
    agreement: {
      kappa,
      mae,
      rmse,
      pearson,
      spearman
    },
    bias: {
      scoreBias,
      issueBias
    },
    recommendations
  };
}

/**
 * Generate calibration report
 */
export function generateCalibrationReport(calibration) {
  let report = '# Human-VLLM Calibration Report\n\n';
  
  report += '## Agreement Metrics\n\n';
  report += `- **Cohen's Kappa:** ${calibration.agreement.kappa.toFixed(3)} (${calibration.agreement.kappa >= 0.8 ? 'Excellent' : calibration.agreement.kappa >= 0.6 ? 'Good' : calibration.agreement.kappa >= 0.4 ? 'Moderate' : 'Poor'} agreement)\n`;
  report += `- **MAE:** ${calibration.agreement.mae.toFixed(2)} points\n`;
  report += `- **RMSE:** ${calibration.agreement.rmse.toFixed(2)} points\n`;
  report += `- **Pearson's r:** ${calibration.agreement.pearson.toFixed(3)}\n`;
  report += `- **Spearman's ρ:** ${calibration.agreement.spearman.toFixed(3)}\n\n`;
  
  report += '## Bias Analysis\n\n';
  report += `- **Score Bias:** ${calibration.bias.scoreBias > 0 ? '+' : ''}${calibration.bias.scoreBias.toFixed(2)} points (${calibration.bias.scoreBias > 0 ? 'VLLM higher' : 'VLLM lower'})\n`;
  report += `- **Issue Bias:** ${calibration.bias.issueBias > 0 ? '+' : ''}${calibration.bias.issueBias.toFixed(2)} (${calibration.bias.issueBias > 0 ? 'Over-detection' : 'Under-detection'})\n\n`;
  
  report += '## Recommendations\n\n';
  calibration.recommendations.forEach((rec, i) => {
    report += `${i + 1}. ${rec}\n`;
  });
  
  return report;
}

/**
 * Save calibration results
 */
export function saveCalibrationResults(calibration, outputPath) {
  const path = outputPath || join(VALIDATION_DIR, `calibration-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(calibration, null, 2));
  
  const reportPath = path.replace('.json', '.md');
  writeFileSync(reportPath, generateCalibrationReport(calibration));
  
  return { json: path, report: reportPath };
}

// Export for use in other scripts
export { VALIDATION_DIR };

