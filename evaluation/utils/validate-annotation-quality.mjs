#!/usr/bin/env node
/**
 * Annotation Quality Validation
 * 
 * Validates annotation quality:
 * - Completeness checks
 * - Consistency checks
 * - Inter-annotator agreement (if multiple annotators)
 * - Calibration quality
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Validate annotation completeness
 */
function validateCompleteness(annotation) {
  const issues = [];
  
  if (!annotation.humanScore && annotation.humanScore !== 0) {
    issues.push('Missing humanScore');
  } else if (annotation.humanScore < 0 || annotation.humanScore > 10) {
    issues.push(`Invalid humanScore: ${annotation.humanScore} (must be 0-10)`);
  }
  
  if (!Array.isArray(annotation.humanIssues)) {
    issues.push('Missing or invalid humanIssues (must be array)');
  }
  
  if (!annotation.humanReasoning || annotation.humanReasoning.trim().length < 10) {
    issues.push('Missing or too short humanReasoning (minimum 10 characters)');
  }
  
  if (!annotation.annotatorId) {
    issues.push('Missing annotatorId');
  }
  
  if (!annotation.timestamp) {
    issues.push('Missing timestamp');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validate annotation consistency
 */
function validateConsistency(annotations) {
  const issues = [];
  
  // Check for duplicate annotations
  const bySample = {};
  for (const ann of annotations) {
    if (!bySample[ann.sampleId]) {
      bySample[ann.sampleId] = [];
    }
    bySample[ann.sampleId].push(ann);
  }
  
  for (const [sampleId, anns] of Object.entries(bySample)) {
    if (anns.length > 1) {
      // Check if scores are consistent
      const scores = anns.map(a => a.humanScore);
      const scoreRange = Math.max(...scores) - Math.min(...scores);
      if (scoreRange > 3) {
        issues.push(`Sample ${sampleId}: Large score variance (${scoreRange} points) across ${anns.length} annotations`);
      }
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Calculate inter-annotator agreement
 */
function calculateInterAnnotatorAgreement(annotations) {
  const bySample = {};
  for (const ann of annotations) {
    if (!bySample[ann.sampleId]) {
      bySample[ann.sampleId] = [];
    }
    bySample[ann.sampleId].push(ann);
  }
  
  const multiAnnotator = Object.entries(bySample).filter(([_, anns]) => anns.length > 1);
  
  if (multiAnnotator.length === 0) {
    return {
      hasMultipleAnnotators: false,
      message: 'No samples with multiple annotators'
    };
  }
  
  const agreements = [];
  
  for (const [sampleId, anns] of multiAnnotator) {
    const scores = anns.map(a => a.humanScore);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    
    agreements.push({
      sampleId,
      annotatorCount: anns.length,
      scores,
      avgScore,
      stdDev,
      agreement: stdDev < 2 ? 'good' : stdDev < 3 ? 'moderate' : 'poor'
    });
  }
  
  const avgStdDev = agreements.reduce((sum, a) => sum + a.stdDev, 0) / agreements.length;
  const goodAgreement = agreements.filter(a => a.agreement === 'good').length;
  const moderateAgreement = agreements.filter(a => a.agreement === 'moderate').length;
  const poorAgreement = agreements.filter(a => a.agreement === 'poor').length;
  
  return {
    hasMultipleAnnotators: true,
    sampleCount: multiAnnotator.length,
    avgStdDev,
    goodAgreement,
    moderateAgreement,
    poorAgreement,
    agreements
  };
}

/**
 * Validate calibration quality
 */
function validateCalibrationQuality(annotations) {
  const withVLLM = annotations.filter(a => a.vllmComparison);
  
  if (withVLLM.length === 0) {
    return {
      hasCalibration: false,
      message: 'No annotations with VLLM comparison'
    };
  }
  
  const scoreDifferences = withVLLM.map(a => a.vllmComparison.scoreDifference);
  const avgDifference = scoreDifferences.reduce((a, b) => a + b, 0) / scoreDifferences.length;
  const mae = scoreDifferences.reduce((sum, diff) => sum + Math.abs(diff), 0) / scoreDifferences.length;
  
  const issueOverlaps = withVLLM
    .map(a => a.vllmComparison.issueOverlap)
    .filter(o => !isNaN(o));
  const avgIssueOverlap = issueOverlaps.length > 0
    ? issueOverlaps.reduce((a, b) => a + b, 0) / issueOverlaps.length
    : 0;
  
  const quality = {
    hasCalibration: true,
    sampleCount: withVLLM.length,
    scoreBias: avgDifference,
    mae,
    avgIssueOverlap,
    quality: mae < 2 && Math.abs(avgDifference) < 2 && avgIssueOverlap > 0.3 ? 'good' :
             mae < 3 && Math.abs(avgDifference) < 3 && avgIssueOverlap > 0.2 ? 'moderate' : 'poor'
  };
  
  return quality;
}

/**
 * Comprehensive annotation quality validation
 */
function validateAnnotationQuality(annotationDir) {
  if (!existsSync(annotationDir)) {
    return {
      valid: false,
      error: 'Annotation directory does not exist'
    };
  }
  
  const files = readdirSync(annotationDir).filter(f => f.endsWith('.json'));
  const annotations = files.map(file => {
    try {
      return JSON.parse(readFileSync(join(annotationDir, file), 'utf-8'));
    } catch (error) {
      return null;
    }
  }).filter(Boolean);
  
  if (annotations.length === 0) {
    return {
      valid: false,
      error: 'No annotations found'
    };
  }
  
  // Completeness validation
  const completenessResults = annotations.map(ann => ({
    id: ann.id,
    ...validateCompleteness(ann)
  }));
  const incomplete = completenessResults.filter(r => !r.valid);
  
  // Consistency validation
  const consistency = validateConsistency(annotations);
  
  // Inter-annotator agreement
  const agreement = calculateInterAnnotatorAgreement(annotations);
  
  // Calibration quality
  const calibration = validateCalibrationQuality(annotations);
  
  return {
    valid: incomplete.length === 0 && consistency.valid,
    total: annotations.length,
    completeness: {
      total: annotations.length,
      complete: annotations.length - incomplete.length,
      incomplete: incomplete.length,
      issues: incomplete
    },
    consistency,
    agreement,
    calibration,
    recommendations: generateQualityRecommendations(incomplete, consistency, agreement, calibration)
  };
}

/**
 * Generate quality recommendations
 */
function generateQualityRecommendations(completeness, consistency, agreement, calibration) {
  const recommendations = [];
  
  if (completeness.length > 0) {
    recommendations.push(`Fix ${completeness.length} incomplete annotations`);
  }
  
  if (!consistency.valid) {
    recommendations.push(`Address ${consistency.issues.length} consistency issues`);
  }
  
  if (agreement.hasMultipleAnnotators && agreement.poorAgreement > 0) {
    recommendations.push(`Improve inter-annotator agreement: ${agreement.poorAgreement} samples have poor agreement`);
  }
  
  if (calibration.hasCalibration && calibration.quality === 'poor') {
    recommendations.push(`Improve calibration quality: MAE=${calibration.mae.toFixed(2)}, Bias=${calibration.scoreBias.toFixed(2)}, Issue Overlap=${(calibration.avgIssueOverlap * 100).toFixed(1)}%`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Annotation quality looks good!');
  }
  
  return recommendations;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const annotationDir = process.argv[2] || join(process.cwd(), 'evaluation', 'datasets', 'human-annotations', 'completed');
  
  const result = validateAnnotationQuality(annotationDir);
  
  console.log('\n🔍 Annotation Quality Validation\n');
  
  if (result.error) {
    console.error(`❌ ${result.error}`);
    process.exit(1);
  }
  
  console.log(`Total Annotations: ${result.total}`);
  console.log(`\n📋 Completeness:`);
  console.log(`   Complete: ${result.completeness.complete}/${result.completeness.total}`);
  console.log(`   Incomplete: ${result.completeness.incomplete}`);
  if (result.completeness.issues.length > 0) {
    console.log(`   Issues:`);
    for (const issue of result.completeness.issues.slice(0, 5)) {
      console.log(`     - ${issue.id}: ${issue.issues.join(', ')}`);
    }
    if (result.completeness.issues.length > 5) {
      console.log(`     ... and ${result.completeness.issues.length - 5} more`);
    }
  }
  
  console.log(`\n🔄 Consistency:`);
  if (result.consistency.valid) {
    console.log(`   ✅ No consistency issues`);
  } else {
    console.log(`   ⚠️  ${result.consistency.issues.length} issues:`);
    for (const issue of result.consistency.issues.slice(0, 3)) {
      console.log(`     - ${issue}`);
    }
  }
  
  console.log(`\n👥 Inter-Annotator Agreement:`);
  if (result.agreement.hasMultipleAnnotators) {
    console.log(`   Samples with multiple annotators: ${result.agreement.sampleCount}`);
    console.log(`   Average std dev: ${result.agreement.avgStdDev.toFixed(2)}`);
    console.log(`   Good agreement: ${result.agreement.goodAgreement}`);
    console.log(`   Moderate agreement: ${result.agreement.moderateAgreement}`);
    console.log(`   Poor agreement: ${result.agreement.poorAgreement}`);
  } else {
    console.log(`   ${result.agreement.message}`);
  }
  
  console.log(`\n📊 Calibration Quality:`);
  if (result.calibration.hasCalibration) {
    console.log(`   Samples with VLLM comparison: ${result.calibration.sampleCount}`);
    console.log(`   Score Bias: ${result.calibration.scoreBias.toFixed(2)}`);
    console.log(`   MAE: ${result.calibration.mae.toFixed(2)}`);
    console.log(`   Issue Overlap: ${(result.calibration.avgIssueOverlap * 100).toFixed(1)}%`);
    console.log(`   Quality: ${result.calibration.quality}`);
  } else {
    console.log(`   ${result.calibration.message}`);
  }
  
  console.log(`\n💡 Recommendations:`);
  for (const rec of result.recommendations) {
    console.log(`   - ${rec}`);
  }
  
  console.log(`\n${result.valid ? '✅' : '⚠️'} Overall: ${result.valid ? 'Valid' : 'Needs improvement'}`);
}

export {
  validateCompleteness,
  validateConsistency,
  calculateInterAnnotatorAgreement,
  validateCalibrationQuality,
  validateAnnotationQuality
};

