#!/usr/bin/env node
/**
 * Dataset Quality Validation
 * 
 * Validates that datasets have proper human annotations and quality checks.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Validate dataset has human annotations
 */
function validateHumanAnnotations(dataset) {
  const issues = [];
  const stats = {
    total: dataset.samples?.length || 0,
    withHumanScore: 0,
    withHumanIssues: 0,
    withHumanReasoning: 0,
    withAnnotatorId: 0,
    complete: 0
  };
  
  for (const sample of dataset.samples || []) {
    const annotations = sample.groundTruth?.humanAnnotations;
    
    if (!annotations) {
      issues.push(`Sample ${sample.id}: Missing humanAnnotations object`);
      continue;
    }
    
    if (annotations.humanScore !== null && annotations.humanScore !== undefined) {
      stats.withHumanScore++;
      if (annotations.humanScore < 0 || annotations.humanScore > 10) {
        issues.push(`Sample ${sample.id}: Invalid humanScore ${annotations.humanScore} (must be 0-10)`);
      }
    } else {
      issues.push(`Sample ${sample.id}: Missing humanScore`);
    }
    
    if (annotations.humanIssues && Array.isArray(annotations.humanIssues)) {
      stats.withHumanIssues++;
    } else {
      issues.push(`Sample ${sample.id}: Missing or invalid humanIssues`);
    }
    
    if (annotations.humanReasoning && annotations.humanReasoning.trim()) {
      stats.withHumanReasoning++;
    } else {
      issues.push(`Sample ${sample.id}: Missing humanReasoning`);
    }
    
    if (annotations.annotatorId) {
      stats.withAnnotatorId++;
    } else {
      issues.push(`Sample ${sample.id}: Missing annotatorId`);
    }
    
    // Complete = has all required fields
    if (stats.withHumanScore && stats.withHumanIssues && stats.withHumanReasoning && stats.withAnnotatorId) {
      stats.complete++;
    }
  }
  
  return {
    valid: issues.length === 0,
    issues,
    stats,
    completeness: stats.total > 0 ? (stats.complete / stats.total) * 100 : 0
  };
}

/**
 * Validate dataset structure
 */
function validateDatasetStructure(dataset) {
  const issues = [];
  
  if (!dataset.name) issues.push('Missing dataset name');
  if (!dataset.samples || !Array.isArray(dataset.samples)) {
    issues.push('Missing or invalid samples array');
  }
  
  for (const sample of dataset.samples || []) {
    if (!sample.id) issues.push(`Sample missing id`);
    if (!sample.screenshot) issues.push(`Sample ${sample.id}: Missing screenshot`);
    if (!sample.groundTruth) issues.push(`Sample ${sample.id}: Missing groundTruth`);
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validate dataset quality
 */
function validateDatasetQuality(datasetPath) {
  const dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  
  console.log(`\n🔍 Validating Dataset: ${dataset.name || 'Unknown'}\n`);
  
  // Structure validation
  const structure = validateDatasetStructure(dataset);
  console.log('📋 Structure Validation:');
  if (structure.valid) {
    console.log('   ✅ Structure is valid');
  } else {
    console.log('   ❌ Structure issues:');
    for (const issue of structure.issues) {
      console.log(`      - ${issue}`);
    }
  }
  
  // Human annotations validation
  const annotations = validateHumanAnnotations(dataset);
  console.log('\n👤 Human Annotations Validation:');
  console.log(`   Total Samples: ${annotations.stats.total}`);
  console.log(`   With Human Score: ${annotations.stats.withHumanScore} (${(annotations.stats.withHumanScore / annotations.stats.total * 100).toFixed(1)}%)`);
  console.log(`   With Human Issues: ${annotations.stats.withHumanIssues} (${(annotations.stats.withHumanIssues / annotations.stats.total * 100).toFixed(1)}%)`);
  console.log(`   With Human Reasoning: ${annotations.stats.withHumanReasoning} (${(annotations.stats.withHumanReasoning / annotations.stats.total * 100).toFixed(1)}%)`);
  console.log(`   With Annotator ID: ${annotations.stats.withAnnotatorId} (${(annotations.stats.withAnnotatorId / annotations.stats.total * 100).toFixed(1)}%)`);
  console.log(`   Complete: ${annotations.stats.complete} (${annotations.completeness.toFixed(1)}%)`);
  
  if (annotations.valid) {
    console.log('   ✅ All annotations are valid');
  } else {
    console.log('   ⚠️  Annotation issues:');
    for (const issue of annotations.issues.slice(0, 10)) {
      console.log(`      - ${issue}`);
    }
    if (annotations.issues.length > 10) {
      console.log(`      ... and ${annotations.issues.length - 10} more`);
    }
  }
  
  return {
    structure,
    annotations,
    overallValid: structure.valid && annotations.valid,
    completeness: annotations.completeness
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const datasetPath = process.argv[2] || join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');
  
  if (!existsSync(datasetPath)) {
    console.error(`❌ Dataset not found: ${datasetPath}`);
    process.exit(1);
  }
  
  validateDatasetQuality(datasetPath);
}

export { validateDatasetQuality, validateHumanAnnotations, validateDatasetStructure };

