/**
 * Groq API Integration Tests
 * 
 * Tests real Groq API integration for high-frequency decisions.
 * Requires GROQ_API_KEY environment variable.
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateScreenshot, createConfig } from '../../src/index.js';
import { selectProvider } from '../../src/model-tier-selector.mjs';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Groq API Integration', () => {
  
  const hasGroqKey = !!process.env.GROQ_API_KEY;
  
  if (!hasGroqKey) {
    console.log('   ⚠️  GROQ_API_KEY not set, skipping Groq integration tests');
    return;
  }
  
  // Use a real test image if available
  const testImagePath = join(process.cwd(), 'test', 'fixtures', 'test-image-800x600.png');
  const hasTestImage = existsSync(testImagePath);
  
  describe('Provider Selection', () => {
    it('should select Groq for ultra-fast text-only scenarios', () => {
      const provider = selectProvider({
        speed: 'ultra-fast',
        vision: false,
        env: process.env
      });
      
      if (process.env.GROQ_API_KEY) {
        assert.strictEqual(provider, 'groq', 'Should select Groq for ultra-fast text-only');
      }
    });
    
    it('should select Groq for high-frequency decisions', () => {
      const provider = selectProvider({
        speed: 'ultra-fast',
        quality: 'acceptable',
        costSensitive: true,
        vision: false,
        env: process.env
      });
      
      if (process.env.GROQ_API_KEY) {
        assert.strictEqual(provider, 'groq', 'Should select Groq for high-frequency');
      }
    });
  });
  
  describe('Real API Calls', () => {
    it('should validate screenshot with Groq provider', async function() {
      if (!hasTestImage) {
        console.log('   ⚠️  Test image not found, skipping');
        this.skip();
        return;
      }
      
      const config = createConfig({ provider: 'groq' });
      if (!config.enabled) {
        console.log('   ⚠️  Groq not enabled (no API key), skipping');
        this.skip();
        return;
      }
      
      const result = await validateScreenshot(
        testImagePath,
        'Evaluate this screenshot for basic quality',
        { provider: 'groq' }
      );
      
      assert.ok(result, 'Should return result');
      assert.strictEqual(result.provider, 'groq', 'Should use Groq provider');
      assert.ok(typeof result.score === 'number', 'Should have score');
      assert.ok(Array.isArray(result.issues), 'Should have issues array');
    });
    
    it('should have low latency with Groq', async function() {
      if (!hasTestImage) {
        this.skip();
        return;
      }
      
      const config = createConfig({ provider: 'groq' });
      if (!config.enabled) {
        this.skip();
        return;
      }
      
      const startTime = Date.now();
      const result = await validateScreenshot(
        testImagePath,
        'Quick evaluation',
        { provider: 'groq', modelTier: 'fast' }
      );
      const latency = Date.now() - startTime;
      
      assert.ok(result, 'Should return result');
      // Groq should be fast (<2s for vision, <0.5s for text-only)
      // Vision models may be slower, so allow up to 5s
      assert.ok(latency < 5000, `Latency should be <5s, got ${latency}ms`);
      
      console.log(`   ℹ️  Groq latency: ${latency}ms`);
    });
    
    it('should handle high-frequency scenario', async function() {
      if (!hasTestImage) {
        this.skip();
        return;
      }
      
      const config = createConfig({ provider: 'groq' });
      if (!config.enabled) {
        this.skip();
        return;
      }
      
      // Simulate high-frequency: multiple rapid calls
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          validateScreenshot(
            testImagePath,
            `Quick check ${i}`,
            { 
              provider: 'groq',
              modelTier: 'fast',
              frequency: 'high' // Signal high-frequency
            }
          )
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      assert.strictEqual(results.length, 3, 'Should complete all requests');
      assert.ok(totalTime < 15000, `Total time should be <15s for 3 requests, got ${totalTime}ms`);
      
      console.log(`   ℹ️  3 requests completed in ${totalTime}ms (avg: ${(totalTime/3).toFixed(0)}ms per request)`);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid image gracefully', async function() {
      const config = createConfig({ provider: 'groq' });
      if (!config.enabled) {
        this.skip();
        return;
      }
      
      // Groq has specific image size requirements
      await assert.rejects(
        async () => {
          await validateScreenshot(
            'nonexistent.png',
            'Test',
            { provider: 'groq' }
          );
        },
        (error) => {
          return error.message.includes('not found') ||
                 error.message.includes('Image must have') ||
                 error instanceof Error;
        }
      );
    });
  });
});

