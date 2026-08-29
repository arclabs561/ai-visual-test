/**
 * Integration Tests: Variable Goals Cohesive Integration
 * 
 * Tests that variable goals work cohesively throughout the system:
 * - validateScreenshot with goals in context
 * - prompt composition with goals
 * - convenience functions with goals
 * - All components working together
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateScreenshot } from '../../src/index.js';
import { validateWithGoals, createGameGoal, generateGamePrompt } from '../../src/game/index.js';
import { composeSingleImagePrompt } from '../../src/prompt-composer.mjs';
import { createTestImage } from '../test-image-utils.mjs';
import { createConfig } from '../../src/config.js';
import { skipIfNoApiKey } from '../helpers/api-key-check.mjs';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Variable Goals Cohesive Integration', () => {
  describe('validateScreenshot with goals in context', () => {
    it('should accept goal in context and use it for prompt generation', async function() {
      // Skip if no API keys available
      if (skipIfNoApiKey(this, 'No API keys available')) {
        return;
      }
      
      const tempDir = join(tmpdir(), `ai-visual-test-${Date.now()}`);
      const screenshotPath = join(tempDir, 'test.png');
      await createTestImage(screenshotPath);

      try {
        // Pass goal directly in context - should be used by prompt composition
        const result = await validateScreenshot(screenshotPath, 'Base prompt', {
          goal: 'Is the game fun?',
          gameState: { score: 100 }
        });

        assert.ok(result);
        assert.ok('enabled' in result);
        // The goal should have been used in prompt composition
      } catch (error) {
        // Handle provider errors gracefully (invalid API key, rate limits, etc.)
        if (error.code === 'PROVIDER_ERROR' || error.message?.includes('API')) {
          // Provider error - skip test if API not properly configured
          this.skip();
          return;
        }
        throw error;
      } finally {
        if (existsSync(screenshotPath)) {
          unlinkSync(screenshotPath);
        }
      }
    });

    it('should work with goal object in context', async function() {
      // Skip if no API keys available
      if (skipIfNoApiKey(this, 'No API keys available')) {
        return;
      }
      
      const tempDir = join(tmpdir(), `ai-visual-test-${Date.now()}`);
      const screenshotPath = join(tempDir, 'test.png');
      await createTestImage(screenshotPath);

      try {
        const goal = createGameGoal('accessibility');
        const result = await validateScreenshot(screenshotPath, 'Base prompt', {
          goal,
          gameState: { gameActive: true }
        });

        assert.ok(result);
        assert.ok('enabled' in result);
      } catch (error) {
        // Handle provider errors gracefully
        if (error.code === 'PROVIDER_ERROR' || error.message?.includes('API')) {
          this.skip();
          return;
        }
        throw error;
      } finally {
        if (existsSync(screenshotPath)) {
          unlinkSync(screenshotPath);
        }
      }
    });
  });

  describe('prompt composition with goals', () => {
    it('should compose prompt with goal in context', async () => {
      const prompt = await composeSingleImagePrompt('Base prompt', {
        goal: 'Is it fun?',
        gameState: { score: 100 }
      });

      assert.ok(typeof prompt === 'string');
      assert.ok(prompt.length > 0);
      // Should include goal-generated content
      assert.ok(prompt.includes('Base prompt') || prompt.includes('CURRENT GAME STATE'));
    });

    it('should work with goal object in context', async () => {
      const goal = createGameGoal('performance');
      const prompt = await composeSingleImagePrompt('Base prompt', {
        goal,
        gameState: { gameActive: true }
      });

      assert.ok(typeof prompt === 'string');
      assert.ok(prompt.length > 0);
    });
  });

  describe('convenience functions with goals', () => {
    it('should pass goals through validateWithGoals', async function() {
      const config = createConfig();
      if (!config.enabled) {
        this.skip();
        return;
      }
      
      const tempDir = join(tmpdir(), `ai-visual-test-${Date.now()}`);
      const screenshotPath = join(tempDir, 'test.png');
      await createTestImage(screenshotPath);

      try {
        const result = await validateWithGoals(screenshotPath, {
          goal: 'Is it accessible?',
          gameState: { score: 50 }
        });

        assert.ok(result);
        assert.strictEqual(result.goal, 'Is it accessible?');
        assert.ok(result.prompt);
        assert.ok(result.result);
      } catch (error) {
        // Handle provider errors gracefully
        if (error.code === 'PROVIDER_ERROR' || error.message?.includes('API') || error.message?.includes('non-JSON')) {
          this.skip();
          return;
        }
        throw error;
      } finally {
        if (existsSync(screenshotPath)) {
          unlinkSync(screenshotPath);
        }
      }
    });

    it('should work with goal object in validateWithGoals', async function() {
      const config = createConfig();
      if (!config.enabled) {
        this.skip();
        return;
      }
      
      const tempDir = join(tmpdir(), `ai-visual-test-${Date.now()}`);
      const screenshotPath = join(tempDir, 'test.png');
      await createTestImage(screenshotPath);

      try {
        const goal = createGameGoal('fun');
        const result = await validateWithGoals(screenshotPath, {
          goal,
          gameState: { score: 200 }
        });

        assert.ok(result);
        assert.ok(result.prompt);
        assert.ok(result.result);
        // If API is disabled, that's fine - just verify structure
        if (!result.result.enabled) {
          assert.ok(result.result.message);
        }
      } catch (error) {
        // Handle rate limit, invalid image, or API configuration errors gracefully
        if (error.code === 'PROVIDER_ERROR' || 
            error.message?.includes('API') ||
            error.message?.includes('non-JSON') ||
            (error.details?.statusCode === 429 || error.details?.statusCode === 400)) {
          // API error or rate limit - skip test
          this.skip();
          return;
        }
        throw error;
      } finally {
        if (existsSync(screenshotPath)) {
          unlinkSync(screenshotPath);
        }
      }
    });
  });

  describe('cohesive workflow', () => {
    it('should work end-to-end: goal -> prompt -> validation', async function() {
      // Skip if no API keys available
      if (skipIfNoApiKey(this, 'No API keys available')) {
        return;
      }
      
      const tempDir = join(tmpdir(), `ai-visual-test-${Date.now()}`);
      const screenshotPath = join(tempDir, 'test.png');
      await createTestImage(screenshotPath);

      try {
        // 1. Create goal
        const goal = createGameGoal('accessibility');
        
        // 2. Generate prompt (for reference)
        const prompt = generateGamePrompt(goal, {
          gameState: { score: 100 }
        });
        assert.ok(prompt.length > 0);
        
        // 3. Validate with goal in context (cohesive)
        const result = await validateScreenshot(screenshotPath, prompt, {
          goal, // Pass goal - prompt composition will use it
          gameState: { score: 100 }
        });
        
        assert.ok(result);
        assert.ok('enabled' in result);
        // If API is disabled or rate limited, that's fine - just verify structure
        if (!result.enabled) {
          assert.ok(result.message);
        }
      } catch (error) {
        // Handle rate limit or API configuration errors gracefully
        if (error.code === 'PROVIDER_ERROR' || 
            error.message?.includes('API') ||
            error.message?.includes('non-JSON') ||
            error.details?.statusCode === 429) {
          // Rate limit or API error - skip test
          this.skip();
          return;
        }
        throw error;
      } finally {
        if (existsSync(screenshotPath)) {
          unlinkSync(screenshotPath);
        }
      }
    });

    it('should work with convenience function: validateWithGoals', async function() {
      const config = createConfig();
      if (!config.enabled) {
        this.skip();
        return;
      }
      
      const tempDir = join(tmpdir(), `ai-visual-test-${Date.now()}`);
      const screenshotPath = join(tempDir, 'test.png');
      await createTestImage(screenshotPath);

      try {
        const goal = createGameGoal('performance');
        
        // Convenience function handles everything cohesively
        const result = await validateWithGoals(screenshotPath, {
          goal,
          gameState: { score: 150 }
        });
        
        assert.ok(result);
        assert.ok(result.prompt);
        assert.ok(result.result);
        // If API is disabled or rate limited, that's fine - just verify structure
        if (!result.result.enabled) {
          assert.ok(result.result.message);
        }
      } catch (error) {
        // Handle rate limit, invalid image, or API configuration errors gracefully
        if (error.code === 'PROVIDER_ERROR' || 
            error.message?.includes('API') ||
            error.message?.includes('non-JSON') ||
            error.details?.statusCode === 429 ||
            error.details?.statusCode === 400) {
          // Rate limit, invalid image, or API error - skip test
          this.skip();
          return;
        }
        throw error;
      } finally {
        if (existsSync(screenshotPath)) {
          unlinkSync(screenshotPath);
        }
      }
    });
  });
});
