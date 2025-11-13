import { test } from 'node:test';
import assert from 'node:assert';
import {
  validateCompleteness,
  validateConsistency,
  calculateInterAnnotatorAgreement,
  validateCalibrationQuality,
  validateAnnotationQuality
} from '../evaluation/utils/validate-annotation-quality.mjs';

test.describe('Annotation Quality Validation', () => {
  
  test('completeness validation passes for valid annotation', () => {
    const annotation = {
      id: 'test-1',
      humanScore: 8,
      humanIssues: ['issue1'],
      humanReasoning: 'This is a valid reasoning that is long enough',
      annotatorId: 'annotator-1',
      timestamp: new Date().toISOString()
    };
    
    const result = validateCompleteness(annotation);
    assert.ok(result.valid, 'Valid annotation should pass completeness check');
    assert.strictEqual(result.issues.length, 0, 'Should have no issues');
  });
  
  test('completeness validation fails for missing score', () => {
    const annotation = {
      id: 'test-2',
      humanIssues: ['issue1'],
      humanReasoning: 'Reasoning',
      annotatorId: 'annotator-1',
      timestamp: new Date().toISOString()
    };
    
    const result = validateCompleteness(annotation);
    assert.ok(!result.valid, 'Annotation without score should fail');
    assert.ok(result.issues.some(i => i.includes('humanScore')), 'Should report missing score');
  });
  
  test('completeness validation fails for invalid score', () => {
    const annotation = {
      id: 'test-3',
      humanScore: 15, // Invalid: > 10
      humanIssues: ['issue1'],
      humanReasoning: 'Reasoning',
      annotatorId: 'annotator-1',
      timestamp: new Date().toISOString()
    };
    
    const result = validateCompleteness(annotation);
    assert.ok(!result.valid, 'Annotation with invalid score should fail');
    assert.ok(result.issues.some(i => i.includes('Invalid humanScore')), 'Should report invalid score');
  });
  
  test('completeness validation fails for short reasoning', () => {
    const annotation = {
      id: 'test-4',
      humanScore: 8,
      humanIssues: ['issue1'],
      humanReasoning: 'Short', // Too short
      annotatorId: 'annotator-1',
      timestamp: new Date().toISOString()
    };
    
    const result = validateCompleteness(annotation);
    assert.ok(!result.valid, 'Annotation with short reasoning should fail');
    assert.ok(result.issues.some(i => i.includes('humanReasoning')), 'Should report short reasoning');
  });
  
  test('consistency validation detects large score variance', () => {
    const annotations = [
      { sampleId: 'sample-1', humanScore: 2, annotatorId: 'annotator-1' },
      { sampleId: 'sample-1', humanScore: 9, annotatorId: 'annotator-2' } // Large variance
    ];
    
    const result = validateConsistency(annotations);
    assert.ok(!result.valid, 'Large score variance should be detected');
    assert.ok(result.issues.some(i => i.includes('sample-1')), 'Should report variance for sample-1');
  });
  
  test('consistency validation passes for consistent annotations', () => {
    const annotations = [
      { sampleId: 'sample-1', humanScore: 7, annotatorId: 'annotator-1' },
      { sampleId: 'sample-1', humanScore: 8, annotatorId: 'annotator-2' } // Small variance
    ];
    
    const result = validateConsistency(annotations);
    assert.ok(result.valid, 'Small score variance should pass');
  });
  
  test('inter-annotator agreement calculation works', () => {
    const annotations = [
      { sampleId: 'sample-1', humanScore: 7, annotatorId: 'annotator-1' },
      { sampleId: 'sample-1', humanScore: 8, annotatorId: 'annotator-2' },
      { sampleId: 'sample-2', humanScore: 5, annotatorId: 'annotator-1' },
      { sampleId: 'sample-2', humanScore: 6, annotatorId: 'annotator-2' }
    ];
    
    const result = calculateInterAnnotatorAgreement(annotations);
    assert.ok(result.hasMultipleAnnotators, 'Should detect multiple annotators');
    assert.strictEqual(result.sampleCount, 2, 'Should have 2 samples with multiple annotators');
    assert.ok(result.avgStdDev >= 0, 'Should calculate average std dev');
  });
  
  test('inter-annotator agreement returns message for single annotator', () => {
    const annotations = [
      { sampleId: 'sample-1', humanScore: 7, annotatorId: 'annotator-1' }
    ];
    
    const result = calculateInterAnnotatorAgreement(annotations);
    assert.ok(!result.hasMultipleAnnotators, 'Should not detect multiple annotators');
    assert.ok(result.message, 'Should have message');
  });
  
  test('calibration quality validation works', () => {
    const annotations = [
      {
        humanScore: 8,
        vllmComparison: {
          vllmScore: 7,
          scoreDifference: 1,
          issueOverlap: 0.5
        }
      },
      {
        humanScore: 6,
        vllmComparison: {
          vllmScore: 7,
          scoreDifference: -1,
          issueOverlap: 0.4
        }
      }
    ];
    
    const result = validateCalibrationQuality(annotations);
    assert.ok(result.hasCalibration, 'Should detect calibration data');
    assert.strictEqual(result.sampleCount, 2, 'Should have 2 samples');
    assert.ok(typeof result.mae === 'number', 'Should calculate MAE');
    assert.ok(typeof result.avgIssueOverlap === 'number', 'Should calculate issue overlap');
  });
  
  test('calibration quality returns message when no VLLM comparison', () => {
    const annotations = [
      { humanScore: 8 }
    ];
    
    const result = validateCalibrationQuality(annotations);
    assert.ok(!result.hasCalibration, 'Should not detect calibration data');
    assert.ok(result.message, 'Should have message');
  });
  
  test('comprehensive validation works', () => {
    // This test would require a mock file system
    // For now, just test that the function exists and can be called
    assert.ok(typeof validateAnnotationQuality === 'function', 'Function should exist');
  });
});

