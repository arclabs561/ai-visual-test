import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildRubricPrompt } from '../../src/rubrics.mjs';

describe('Rubric Visual Anchoring', () => {
  it('should include visual reference section when referenceImages provided', () => {
    const prompt = buildRubricPrompt(null, true, {
      referenceImages: { 9: 'good.png', 3: 'broken.png' }
    });
    assert.ok(prompt.includes('Visual Reference Anchors'));
    assert.ok(prompt.includes('REF_SCORE_9'));
    assert.ok(prompt.includes('REF_SCORE_3'));
  });

  it('should list reference scores in descending order', () => {
    const prompt = buildRubricPrompt(null, true, {
      referenceImages: { 3: 'low.png', 9: 'high.png', 6: 'mid.png' }
    });
    const idx9 = prompt.indexOf('REF_SCORE_9');
    const idx6 = prompt.indexOf('REF_SCORE_6');
    const idx3 = prompt.indexOf('REF_SCORE_3');
    assert.ok(idx9 < idx6, 'Score 9 should come before score 6');
    assert.ok(idx6 < idx3, 'Score 6 should come before score 3');
  });

  it('should not include visual reference section without referenceImages', () => {
    const prompt = buildRubricPrompt(null, true);
    assert.ok(!prompt.includes('Visual Reference Anchors'));
  });

  it('should not include visual reference section with empty referenceImages', () => {
    const prompt = buildRubricPrompt(null, true, { referenceImages: {} });
    assert.ok(!prompt.includes('Visual Reference Anchors'));
  });

  it('should still include dimensions and other sections', () => {
    const prompt = buildRubricPrompt(null, true, {
      referenceImages: { 9: 'good.png' }
    });
    assert.ok(prompt.includes('Evaluation Dimensions'));
    assert.ok(prompt.includes('EVALUATION RUBRIC'));
    assert.ok(prompt.includes('Output Format'));
  });

  it('should be backward compatible with 2-arg call', () => {
    const prompt = buildRubricPrompt(null, false);
    assert.ok(prompt.includes('EVALUATION RUBRIC'));
    assert.ok(!prompt.includes('Evaluation Dimensions'));
  });
});
