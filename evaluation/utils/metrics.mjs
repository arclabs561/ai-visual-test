#!/usr/bin/env node
/**
 * Evaluation Metrics
 * 
 * Standard metrics for evaluating VLLM judgments against ground truth:
 * - Precision, Recall, F1 Score
 * - Accuracy
 * - Cohen's Kappa (inter-judge agreement)
 * - Mean Absolute Error (MAE) for scores
 * - Root Mean Squared Error (RMSE) for scores
 */

/**
 * Calculate confusion matrix for binary classification
 */
export function calculateConfusionMatrix(predictions, groundTruth, threshold = 0.5) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  
  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i] >= threshold ? 1 : 0;
    const truth = groundTruth[i] >= threshold ? 1 : 0;
    
    if (pred === 1 && truth === 1) tp++;
    else if (pred === 1 && truth === 0) fp++;
    else if (pred === 0 && truth === 0) tn++;
    else if (pred === 0 && truth === 1) fn++;
  }
  
  return { tp, fp, tn, fn };
}

/**
 * Calculate precision
 */
export function calculatePrecision(confusionMatrix) {
  const { tp, fp } = confusionMatrix;
  if (tp + fp === 0) return 0;
  return tp / (tp + fp);
}

/**
 * Calculate recall (sensitivity)
 */
export function calculateRecall(confusionMatrix) {
  const { tp, fn } = confusionMatrix;
  if (tp + fn === 0) return 0;
  return tp / (tp + fn);
}

/**
 * Calculate F1 score
 */
export function calculateF1Score(precision, recall) {
  if (precision + recall === 0) return 0;
  return 2 * (precision * recall) / (precision + recall);
}

/**
 * Calculate accuracy
 */
export function calculateAccuracy(confusionMatrix) {
  const { tp, fp, tn, fn } = confusionMatrix;
  const total = tp + fp + tn + fn;
  if (total === 0) return 0;
  return (tp + tn) / total;
}

/**
 * Calculate Mean Absolute Error (MAE) for scores
 */
export function calculateMAE(predictions, groundTruth) {
  if (predictions.length !== groundTruth.length) {
    throw new Error('Predictions and ground truth must have same length');
  }
  
  let sum = 0;
  let count = 0;
  
  for (let i = 0; i < predictions.length; i++) {
    if (predictions[i] !== null && groundTruth[i] !== null) {
      sum += Math.abs(predictions[i] - groundTruth[i]);
      count++;
    }
  }
  
  return count > 0 ? sum / count : 0;
}

/**
 * Calculate Root Mean Squared Error (RMSE) for scores
 */
export function calculateRMSE(predictions, groundTruth) {
  if (predictions.length !== groundTruth.length) {
    throw new Error('Predictions and ground truth must have same length');
  }
  
  let sum = 0;
  let count = 0;
  
  for (let i = 0; i < predictions.length; i++) {
    if (predictions[i] !== null && groundTruth[i] !== null) {
      const diff = predictions[i] - groundTruth[i];
      sum += diff * diff;
      count++;
    }
  }
  
  return count > 0 ? Math.sqrt(sum / count) : 0;
}

/**
 * Calculate Cohen's Kappa for inter-judge agreement
 */
export function calculateCohensKappa(judge1, judge2) {
  if (judge1.length !== judge2.length) {
    throw new Error('Judges must have same number of evaluations');
  }
  
  // Create confusion matrix
  const categories = [...new Set([...judge1, ...judge2])].sort();
  const n = judge1.length;
  const matrix = {};
  
  // Initialize matrix
  categories.forEach(cat1 => {
    matrix[cat1] = {};
    categories.forEach(cat2 => {
      matrix[cat1][cat2] = 0;
    });
  });
  
  // Count agreements
  let agreements = 0;
  for (let i = 0; i < n; i++) {
    matrix[judge1[i]][judge2[i]]++;
    if (judge1[i] === judge2[i]) {
      agreements++;
    }
  }
  
  // Calculate observed agreement
  const po = agreements / n;
  
  // Calculate expected agreement
  let pe = 0;
  categories.forEach(category => {
    const judge1Count = judge1.filter(j => j === category).length;
    const judge2Count = judge2.filter(j => j === category).length;
    pe += (judge1Count / n) * (judge2Count / n);
  });
  
  // Calculate Kappa
  if (pe === 1) return 1; // Perfect agreement
  return (po - pe) / (1 - pe);
}

/**
 * Calculate issue detection metrics
 * Compares detected issues against ground truth issues
 */
export function calculateIssueMetrics(detectedIssues, groundTruthIssues) {
  // Convert to sets for easier comparison
  const detectedSet = new Set(detectedIssues.map(i => i.toLowerCase().trim()));
  const groundTruthSet = new Set(groundTruthIssues.map(i => i.toLowerCase().trim()));
  
  // True positives: issues found in both
  const tp = [...detectedSet].filter(i => groundTruthSet.has(i)).length;
  
  // False positives: issues detected but not in ground truth
  const fp = [...detectedSet].filter(i => !groundTruthSet.has(i)).length;
  
  // False negatives: issues in ground truth but not detected
  const fn = [...groundTruthSet].filter(i => !detectedSet.has(i)).length;
  
  // True negatives: not applicable for issue detection (no clear negative class)
  
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  
  return {
    tp,
    fp,
    fn,
    precision,
    recall,
    f1,
    detectedCount: detectedIssues.length,
    groundTruthCount: groundTruthIssues.length
  };
}

/**
 * Calculate comprehensive evaluation metrics
 */
export function calculateAllMetrics(evaluations) {
  const metrics = {
    scores: {
      predictions: [],
      groundTruth: []
    },
    issues: {
      allDetected: [],
      allGroundTruth: []
    },
    confusionMatrix: null,
    scoreMetrics: {},
    issueMetrics: {},
    agreement: {}
  };
  
  // Extract scores and issues
  evaluations.forEach(evaluation => {
    if (evaluation.result && evaluation.groundTruth) {
      // Scores - support both new (preciseScore) and legacy (expectedScore) formats
      if (evaluation.result.score !== null) {
        let expectedScore = null;
        
        // New format: preciseScore
        if (evaluation.groundTruth.preciseScore !== undefined) {
          expectedScore = evaluation.groundTruth.preciseScore;
        }
        // Legacy format: expectedScore range
        else if (evaluation.groundTruth.expectedScore) {
          expectedScore = (evaluation.groundTruth.expectedScore.min + evaluation.groundTruth.expectedScore.max) / 2;
        }
        
        if (expectedScore !== null) {
          metrics.scores.predictions.push(evaluation.result.score);
          metrics.scores.groundTruth.push(expectedScore);
        }
      }
      
      // Issues - support both new (structuredIssues) and legacy (expectedIssues) formats
      if (evaluation.result.issues) {
        metrics.issues.allDetected.push(...evaluation.result.issues);
      }
      
      const groundTruthIssues = evaluation.groundTruth.structuredIssues || evaluation.groundTruth.expectedIssues || [];
      if (groundTruthIssues.length > 0) {
        metrics.issues.allGroundTruth.push(...groundTruthIssues);
      }
    }
  });
  
  // Calculate score metrics
  if (metrics.scores.predictions.length > 0) {
    metrics.scoreMetrics = {
      mae: calculateMAE(metrics.scores.predictions, metrics.scores.groundTruth),
      rmse: calculateRMSE(metrics.scores.predictions, metrics.scores.groundTruth),
      pearsonCorrelation: calculateCorrelation(metrics.scores.predictions, metrics.scores.groundTruth),
      spearmanCorrelation: calculateSpearmanCorrelation(metrics.scores.predictions, metrics.scores.groundTruth)
    };
  }
  
  // Calculate issue metrics
  if (metrics.issues.allDetected.length > 0 || metrics.issues.allGroundTruth.length > 0) {
    metrics.issueMetrics = calculateIssueMetrics(
      metrics.issues.allDetected,
      metrics.issues.allGroundTruth
    );
  }
  
  // Calculate binary classification metrics (score threshold at 7.0)
  if (metrics.scores.predictions.length > 0) {
    const binaryPredictions = metrics.scores.predictions.map(s => s >= 7.0 ? 1 : 0);
    const binaryGroundTruth = metrics.scores.groundTruth.map(s => s >= 7.0 ? 1 : 0);
    
    metrics.confusionMatrix = calculateConfusionMatrix(binaryPredictions, binaryGroundTruth);
    const precision = calculatePrecision(metrics.confusionMatrix);
    const recall = calculateRecall(metrics.confusionMatrix);
    
    metrics.binaryMetrics = {
      precision,
      recall,
      f1: calculateF1Score(precision, recall),
      accuracy: calculateAccuracy(metrics.confusionMatrix)
    };
  }
  
  return metrics;
}

/**
 * Calculate Pearson correlation coefficient
 */
export function calculateCorrelation(x, y) {
  if (x.length !== y.length) return 0;
  if (x.length === 0) return 0;
  
  const n = x.length;
  
  // Filter out null/NaN/Infinity values to avoid invalid calculations
  const validPairs = [];
  for (let i = 0; i < n; i++) {
    if (x[i] !== null && y[i] !== null && 
        Number.isFinite(x[i]) && Number.isFinite(y[i])) {
      validPairs.push({ x: x[i], y: y[i] });
    }
  }
  
  if (validPairs.length === 0) return 0;
  if (validPairs.length < 2) return 0; // Need at least 2 points for correlation
  
  const validN = validPairs.length;
  const sumX = validPairs.reduce((a, p) => a + p.x, 0);
  const sumY = validPairs.reduce((a, p) => a + p.y, 0);
  const sumXY = validPairs.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = validPairs.reduce((sum, p) => sum + p.x * p.x, 0);
  const sumY2 = validPairs.reduce((sum, p) => sum + p.y * p.y, 0);
  
  const numerator = validN * sumXY - sumX * sumY;
  const denominator = Math.sqrt((validN * sumX2 - sumX * sumX) * (validN * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Calculate Spearman's rank correlation coefficient
 * Research shows this is important for LLM-as-a-Judge evaluation
 * 
 * @param {number[]} x - First variable
 * @param {number[]} y - Second variable
 * @returns {number} Spearman's rank correlation (-1 to 1)
 */
export function calculateSpearmanCorrelation(x, y) {
  if (x.length !== y.length) return 0;
  if (x.length === 0) return 0;
  if (x.length === 1) return 1;
  
  // Filter out invalid values before ranking (same as calculateCorrelation)
  const validPairs = [];
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== null && y[i] !== null && 
        Number.isFinite(x[i]) && Number.isFinite(y[i])) {
      validPairs.push({ x: x[i], y: y[i] });
    }
  }
  
  if (validPairs.length < 2) return 0; // Need at least 2 valid pairs
  
  // Extract valid values for ranking
  const validX = validPairs.map(p => p.x);
  const validY = validPairs.map(p => p.y);
  
  // Rank the values
  const rankX = rankValues(validX);
  const rankY = rankValues(validY);
  
  // Calculate Pearson correlation on ranks
  return calculateCorrelation(rankX, rankY);
}

/**
 * Rank values (handle ties by averaging)
 */
function rankValues(values) {
  const indexed = values.map((val, idx) => ({ val, idx }));
  indexed.sort((a, b) => a.val - b.val);
  
  const ranks = new Array(values.length);
  let currentRank = 1;
  
  for (let i = 0; i < indexed.length; i++) {
    // Check for ties
    let tieCount = 1;
    let tieSum = currentRank;
    
    while (i + tieCount < indexed.length && indexed[i].val === indexed[i + tieCount].val) {
      tieSum += currentRank + tieCount;
      tieCount++;
    }
    
    const avgRank = tieSum / tieCount;
    
    for (let j = 0; j < tieCount; j++) {
      ranks[indexed[i + j].idx] = avgRank;
    }
    
    i += tieCount - 1;
    currentRank += tieCount;
  }
  
  return ranks;
}

/**
 * Format metrics for display
 */
export function formatMetrics(metrics) {
  const lines = [];
  
  lines.push('📊 Evaluation Metrics');
  lines.push('');
  
  if (metrics.scoreMetrics) {
    lines.push('Score Metrics:');
    lines.push(`  MAE:  ${metrics.scoreMetrics.mae.toFixed(3)}`);
    lines.push(`  RMSE: ${metrics.scoreMetrics.rmse.toFixed(3)}`);
    if (metrics.scoreMetrics.correlation !== undefined) {
      lines.push(`  Correlation: ${metrics.scoreMetrics.correlation.toFixed(3)}`);
    }
    lines.push('');
  }
  
  if (metrics.binaryMetrics) {
    lines.push('Binary Classification (threshold ≥7.0):');
    lines.push(`  Precision: ${metrics.binaryMetrics.precision.toFixed(3)}`);
    lines.push(`  Recall:    ${metrics.binaryMetrics.recall.toFixed(3)}`);
    lines.push(`  F1 Score:  ${metrics.binaryMetrics.f1.toFixed(3)}`);
    lines.push(`  Accuracy:  ${metrics.binaryMetrics.accuracy.toFixed(3)}`);
    lines.push('');
  }
  
  if (metrics.issueMetrics) {
    lines.push('Issue Detection:');
    lines.push(`  Precision: ${metrics.issueMetrics.precision.toFixed(3)}`);
    lines.push(`  Recall:    ${metrics.issueMetrics.recall.toFixed(3)}`);
    lines.push(`  F1 Score:  ${metrics.issueMetrics.f1.toFixed(3)}`);
    lines.push(`  TP: ${metrics.issueMetrics.tp}, FP: ${metrics.issueMetrics.fp}, FN: ${metrics.issueMetrics.fn}`);
    lines.push('');
  }
  
  return lines.join('\n');
}

