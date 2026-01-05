/**
 * Tests for judge.mjs (VLLMJudge, validateScreenshot)
 */

import '../test-setup.mjs'; // Auto-load .env (must be first)
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { VLLMJudge, validateScreenshot } from '../../src/judge.mjs';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Create test-results directory
const testResultsDir = join(process.cwd(), 'test-results');
if (!existsSync(testResultsDir)) {
  mkdirSync(testResultsDir, { recursive: true });
}

import { createTestImage } from '../test-image-utils.mjs';

// Create a mock screenshot file - use realistic test image
async function createMockScreenshot() {
  const path = join(testResultsDir, `test-${Date.now()}.png`);
  await createTestImage(path);
  return path;
}

describe('VLLMJudge', () => {
  let judge;
  let screenshotPath;

  beforeEach(async () => {
    // Create judge without API keys (disabled mode) - use null to explicitly disable
    judge = new VLLMJudge({
      provider: 'gemini',
      apiKey: null, // Explicitly null to disable (won't check env vars)
      cacheEnabled: false
    });
    screenshotPath = await createMockScreenshot();
  });

  afterEach(() => {
    if (screenshotPath && existsSync(screenshotPath)) {
      unlinkSync(screenshotPath);
    }
  });

  it('should create VLLMJudge instance', () => {
    assert.ok(judge instanceof VLLMJudge, 'judge should be an instance of VLLMJudge');
    assert.strictEqual(judge.provider, 'gemini', 'provider should be gemini');
    assert.strictEqual(judge.enabled, false, 'enabled should be false when API key is null');
  });

  it('should convert image to base64', () => {
    const base64 = judge.imageToBase64(screenshotPath);
    assert.ok(typeof base64 === 'string', 'base64 should be a string');
    assert.ok(base64.length > 0, `base64 should not be empty, got length ${base64.length}`);
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
    
    assert.strictEqual(result.enabled, false, 'enabled should be false when API key is null');
    assert.strictEqual(result.provider, 'gemini', 'provider should be gemini');
    assert.ok(result.message.includes('disabled'), 
      `message should include 'disabled', got: ${result.message}`);
  });

  it('should build prompt with context', async () => {
    const prompt = await judge.buildPrompt('Base prompt', {
      testType: 'payment-screen',
      viewport: { width: 1280, height: 720 }
    });
    
    assert.ok(typeof prompt === 'string', 'prompt should be a string');
    assert.ok(prompt.includes('Base prompt'), 
      `prompt should include 'Base prompt', got: ${prompt.substring(0, 50)}...`);
    assert.ok(prompt.includes('payment-screen'), 
      `prompt should include 'payment-screen', got: ${prompt.substring(0, 50)}...`);
  });

  it('should extract semantic info from judgment', () => {
    const judgment = 'Score: 8/10. Issues: None. Assessment: Good.';
    const info = judge.extractSemanticInfo(judgment);
    
    assert.ok(typeof info === 'object', 'info should be an object');
    assert.ok('score' in info, 'info should have score field');
    assert.ok('issues' in info, 'info should have issues field');
    assert.ok('assessment' in info, 'info should have assessment field');
    assert.ok('reasoning' in info, 'info should have reasoning field');
  });
});

describe('validateScreenshot', () => {
  let screenshotPath;

  beforeEach(async () => {
    screenshotPath = await createMockScreenshot();
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
    
    assert.ok(typeof result === 'object', 'result should be an object');
    assert.strictEqual(result.enabled, false, 'enabled should be false when API key is null');
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
    
    assert.ok(typeof result === 'object', 'result should be an object');
    assert.ok('enabled' in result, 'result should have enabled field');
    assert.ok('provider' in result, 'result should have provider field');
  });
});

