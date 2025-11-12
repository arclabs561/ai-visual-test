/**
 * Tests for judge.mjs (VLLMJudge, validateScreenshot)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { VLLMJudge, validateScreenshot } from '../src/judge.mjs';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Create test-results directory
const testResultsDir = join(process.cwd(), 'test-results');
if (!existsSync(testResultsDir)) {
  mkdirSync(testResultsDir, { recursive: true });
}

// Create a mock screenshot file - use base64 encoded minimal PNG (more reliable)
function createMockScreenshot() {
  const path = join(testResultsDir, `test-${Date.now()}.png`);
  // Use base64-encoded minimal PNG (1x1 pixel, more reliable than raw bytes)
  const minimalPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  writeFileSync(path, minimalPng);
  return path;
}

describe('VLLMJudge', () => {
  let judge;
  let screenshotPath;

  beforeEach(() => {
    // Create judge without API keys (disabled mode) - use null to explicitly disable
    judge = new VLLMJudge({
      provider: 'gemini',
      apiKey: null, // Explicitly null to disable (won't check env vars)
      cacheEnabled: false
    });
    screenshotPath = createMockScreenshot();
  });

  afterEach(() => {
    if (screenshotPath && existsSync(screenshotPath)) {
      unlinkSync(screenshotPath);
    }
  });

  it('should create VLLMJudge instance', () => {
    assert.ok(judge instanceof VLLMJudge);
    assert.strictEqual(judge.provider, 'gemini');
    assert.strictEqual(judge.enabled, false);
  });

  it('should convert image to base64', () => {
    const base64 = judge.imageToBase64(screenshotPath);
    assert.ok(typeof base64 === 'string');
    assert.ok(base64.length > 0);
  });

  it('should throw error for non-existent image', () => {
    assert.throws(() => {
      judge.imageToBase64('/nonexistent/image.png');
    }, /Screenshot not found/);
  });

  it('should return disabled result when API key not set', async () => {
    const result = await judge.judgeScreenshot(
      screenshotPath,
      'Test prompt',
      { testType: 'unit-test' }
    );
    
    assert.strictEqual(result.enabled, false);
    assert.strictEqual(result.provider, 'gemini');
    assert.ok(result.message.includes('disabled'));
  });

  it('should build prompt with context', async () => {
    const prompt = await judge.buildPrompt('Base prompt', {
      testType: 'payment-screen',
      viewport: { width: 1280, height: 720 }
    });
    
    assert.ok(typeof prompt === 'string');
    assert.ok(prompt.includes('Base prompt'));
    assert.ok(prompt.includes('payment-screen'));
  });

  it('should extract semantic info from judgment', () => {
    const judgment = 'Score: 8/10. Issues: None. Assessment: Good.';
    const info = judge.extractSemanticInfo(judgment);
    
    assert.ok(typeof info === 'object');
    assert.ok('score' in info);
    assert.ok('issues' in info);
    assert.ok('assessment' in info);
    assert.ok('reasoning' in info);
  });
});

describe('validateScreenshot', () => {
  let screenshotPath;

  beforeEach(() => {
    screenshotPath = createMockScreenshot();
  });

  afterEach(() => {
    if (screenshotPath && existsSync(screenshotPath)) {
      unlinkSync(screenshotPath);
    }
  });

  it('should validate screenshot without API key', async () => {
    const result = await validateScreenshot(
      screenshotPath,
      'Test prompt',
      { 
        testType: 'unit-test',
        apiKey: null // Explicitly disable to test disabled behavior
      }
    );
    
    assert.ok(typeof result === 'object');
    assert.strictEqual(result.enabled, false);
  });

  it('should accept context options', async () => {
    const result = await validateScreenshot(
      screenshotPath,
      'Test prompt',
      {
        testType: 'payment-screen',
        viewport: { width: 1280, height: 720 },
        useCache: false,
        apiKey: null // Explicitly disable to test disabled behavior
      }
    );
    
    assert.ok(typeof result === 'object');
  });
});

