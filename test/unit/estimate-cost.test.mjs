/**
 * Tests for estimateCost() in cost-tracker.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { estimateCost } from '../../src/cost-tracker.mjs';
import { PROVIDER_CONFIGS } from '../../src/provider-data.mjs';

describe('estimateCost', () => {
  test('returns expected shape for each known provider', () => {
    for (const provider of Object.keys(PROVIDER_CONFIGS)) {
      const result = estimateCost(provider);
      assert.strictEqual(result.provider, provider);
      assert.strictEqual(typeof result.model, 'string');
      assert.strictEqual(typeof result.estimatedInputTokens, 'number');
      assert.strictEqual(typeof result.estimatedOutputTokens, 'number');
      assert.strictEqual(typeof result.estimatedCost, 'string');
      assert.strictEqual(result.currency, 'USD');
    }
  });

  test('defaults to 1 image, ~100 char prompt', () => {
    const result = estimateCost('gemini');
    // 1 image = 1500 tokens, prompt ~100 chars / 4 = 25 -> clamped to 50 minimum
    assert.strictEqual(result.estimatedInputTokens, 1500 + 50);
    assert.strictEqual(result.estimatedOutputTokens, 500);
  });

  test('scales with imageCount', () => {
    const one = estimateCost('openai', { imageCount: 1 });
    const three = estimateCost('openai', { imageCount: 3 });
    // 3 images should add 2 * 1500 = 3000 more input tokens
    assert.strictEqual(
      three.estimatedInputTokens - one.estimatedInputTokens,
      3000
    );
    // Cost should scale accordingly
    assert.ok(
      parseFloat(three.estimatedCost) > parseFloat(one.estimatedCost),
      'cost should increase with more images'
    );
  });

  test('uses promptLength for token estimation', () => {
    const short = estimateCost('claude', { promptLength: 10 });
    const long = estimateCost('claude', { promptLength: 2000 });
    // short prompt: ceil(10/4)=3, clamped to 50
    // long prompt: ceil(2000/4)=500
    assert.strictEqual(short.estimatedInputTokens, 1500 + 50);
    assert.strictEqual(long.estimatedInputTokens, 1500 + 500);
  });

  test('accepts model override', () => {
    const result = estimateCost('openai', { model: 'gpt-4o-mini' });
    assert.strictEqual(result.model, 'gpt-4o-mini');
    // Pricing still uses provider config (not model-specific)
    assert.strictEqual(result.provider, 'openai');
  });

  test('uses provider default model when model is null', () => {
    const result = estimateCost('gemini');
    assert.strictEqual(result.model, PROVIDER_CONFIGS.gemini.model);
  });

  test('throws for unknown provider', () => {
    assert.throws(
      () => estimateCost('nonexistent'),
      /Unknown provider "nonexistent"/
    );
  });

  test('cost matches manual calculation for gemini', () => {
    // Gemini pricing: input $0.10/1M, output $0.40/1M
    const result = estimateCost('gemini', { imageCount: 2, promptLength: 400 });
    // input tokens: 2*1500 + ceil(400/4) = 3000 + 100 = 3100
    // output tokens: 500
    const expectedInput = (3100 / 1_000_000) * 0.10;
    const expectedOutput = (500 / 1_000_000) * 0.40;
    const expected = (expectedInput + expectedOutput).toFixed(6);
    assert.strictEqual(result.estimatedCost, expected);
    assert.strictEqual(result.estimatedInputTokens, 3100);
  });

  test('cost matches manual calculation for openai', () => {
    // OpenAI pricing: input $5.00/1M, output $15.00/1M
    const result = estimateCost('openai');
    const expectedInput = (1550 / 1_000_000) * 5.00;
    const expectedOutput = (500 / 1_000_000) * 15.00;
    const expected = (expectedInput + expectedOutput).toFixed(6);
    assert.strictEqual(result.estimatedCost, expected);
  });

  test('zero images still includes prompt tokens', () => {
    const result = estimateCost('claude', { imageCount: 0 });
    assert.strictEqual(result.estimatedInputTokens, 50); // prompt minimum only
    assert.ok(parseFloat(result.estimatedCost) > 0);
  });

  test('groq estimate uses groq pricing', () => {
    // Groq: input $0.59/1M, output $0.79/1M
    const result = estimateCost('groq');
    const expectedInput = (1550 / 1_000_000) * 0.59;
    const expectedOutput = (500 / 1_000_000) * 0.79;
    const expected = (expectedInput + expectedOutput).toFixed(6);
    assert.strictEqual(result.estimatedCost, expected);
  });

  test('openrouter estimate works', () => {
    const result = estimateCost('openrouter');
    assert.strictEqual(result.provider, 'openrouter');
    assert.ok(parseFloat(result.estimatedCost) > 0);
  });
});
