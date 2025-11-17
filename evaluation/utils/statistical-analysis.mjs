#!/usr/bin/env node
/**
 * Statistical Analysis for Evaluation Results
 * 
 * Provides statistical validation and analysis tools for evaluation metrics.
 * Based on research-backed approaches for evaluation significance testing.
 */

/**
 * Calculate statistical significance for metrics
 */
export function calculateSignificance(metrics, sampleSize) {
  const analysis = {
    sampleSize,
    isStatisticallyValid: sampleSize >= 30,
    recommendations: []
  };
  
  if (sampleSize < 30) {
    analysis.recommendations.push(`Sample size ${sampleSize} is below recommended minimum of 30 for statistical validity`);
  }
  
  if (metrics.scoreMetrics) {
    const { mae, correlation, withinTolerance } = metrics.scoreMetrics;
    
    // Score prediction analysis
    analysis.scorePrediction = {
      mae,
      correlation,
      withinTolerance,
      interpretation: {
        mae: mae < 0.5 ? 'excellent' : mae < 1.0 ? 'good' : mae < 2.0 ? 'acceptable' : 'needs improvement',
        correlation: correlation > 0.9 ? 'excellent' : correlation > 0.7 ? 'good' : correlation > 0.5 ? 'moderate' : 'weak',
        tolerance: withinTolerance > 0.9 ? 'excellent' : withinTolerance > 0.7 ? 'good' : 'needs improvement'
      }
    };
  }
  
  if (metrics.issueMetrics) {
    const { meanPrecision, meanRecall, meanF1 } = metrics.issueMetrics;
    
    // Issue detection analysis
    analysis.issueDetection = {
      precision: meanPrecision,
      recall: meanRecall,
      f1: meanF1,
      interpretation: {
        precision: meanPrecision > 0.8 ? 'excellent' : meanPrecision > 0.5 ? 'good' : meanPrecision > 0.3 ? 'moderate' : 'needs improvement',
        recall: meanRecall > 0.9 ? 'excellent' : meanRecall > 0.7 ? 'good' : meanRecall > 0.5 ? 'moderate' : 'needs improvement',
        f1: meanF1 > 0.7 ? 'excellent' : meanF1 > 0.5 ? 'good' : meanF1 > 0.3 ? 'moderate' : 'needs improvement'
      },
      tradeoff: {
        highPrecisionLowRecall: meanPrecision > 0.5 && meanRecall < 0.5,
        highRecallLowPrecision: meanRecall > 0.7 && meanPrecision < 0.3,
        balanced: meanPrecision > 0.4 && meanRecall > 0.6 && meanF1 > 0.4
      }
    };
    
    // Recommendations based on precision/recall tradeoff
    if (analysis.issueDetection.tradeoff.highRecallLowPrecision) {
      analysis.recommendations.push('High recall but low precision: Consider improving issue filtering to reduce false positives');
    } else if (analysis.issueDetection.tradeoff.highPrecisionLowRecall) {
      analysis.recommendations.push('High precision but low recall: Consider relaxing matching criteria to catch more issues');
    }
  }
  
  if (metrics.confidence?.scoreErrorCI) {
    const ci = metrics.confidence.scoreErrorCI;
    analysis.confidenceInterval = {
      mean: ci.mean,
      lower95: ci.lower95,
      upper95: ci.upper95,
      margin: ci.margin,
      interpretation: ci.margin < 0.1 ? 'very precise' : ci.margin < 0.3 ? 'precise' : ci.margin < 0.5 ? 'moderate' : 'wide'
    };
  }
  
  return analysis;
}

/**
 * Compare two evaluation results statistically
 */
export function compareEvaluations(eval1, eval2) {
  const comparison = {
    eval1: { n: eval1.results?.length || 0, metrics: eval1.metrics },
    eval2: { n: eval2.results?.length || 0, metrics: eval2.metrics },
    differences: {}
  };
  
  // Compare score metrics
  if (eval1.metrics?.scoreMetrics && eval2.metrics?.scoreMetrics) {
    const m1 = eval1.metrics.scoreMetrics;
    const m2 = eval2.metrics.scoreMetrics;
    
    comparison.differences.scoreMetrics = {
      mae: { eval1: m1.mae, eval2: m2.mae, difference: m2.mae - m1.mae, improved: m2.mae < m1.mae },
      correlation: { eval1: m1.correlation, eval2: m2.correlation, difference: (m2.correlation || 0) - (m1.correlation || 0), improved: (m2.correlation || 0) > (m1.correlation || 0) }
    };
  }
  
  // Compare issue metrics
  if (eval1.metrics?.issueMetrics && eval2.metrics?.issueMetrics) {
    const m1 = eval1.metrics.issueMetrics;
    const m2 = eval2.metrics.issueMetrics;
    
    comparison.differences.issueMetrics = {
      precision: { eval1: m1.meanPrecision, eval2: m2.meanPrecision, difference: m2.meanPrecision - m1.meanPrecision, improved: m2.meanPrecision > m1.meanPrecision },
      recall: { eval1: m1.meanRecall, eval2: m2.meanRecall, difference: m2.meanRecall - m1.meanRecall, improved: m2.meanRecall > m1.meanRecall },
      f1: { eval1: m1.meanF1, eval2: m2.meanF1, difference: m2.meanF1 - m1.meanF1, improved: m2.meanF1 > m1.meanF1 }
    };
  }
  
  return comparison;
}

/**
 * Generate statistical report
 */
export function generateStatisticalReport(evaluation) {
  if (!evaluation || !evaluation.metrics) {
    return {
      error: 'Invalid evaluation data: missing metrics',
      timestamp: new Date().toISOString()
    };
  }
  
  const analysis = calculateSignificance(evaluation.metrics, evaluation.results?.length || 0);
  
  const report = {
    timestamp: new Date().toISOString(),
    dataset: evaluation.dataset?.name || 'unknown',
    sampleSize: evaluation.results?.length || 0,
    statisticalValidity: analysis.isStatisticallyValid,
    analysis,
    summary: {
      scorePrediction: analysis.scorePrediction?.interpretation || null,
      issueDetection: analysis.issueDetection?.interpretation || null,
      recommendations: analysis.recommendations
    }
  };
  
  return report;
}

