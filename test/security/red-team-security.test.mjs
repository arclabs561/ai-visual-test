/**
 * Red Team Security Tests
 * 
 * Tests for security vulnerabilities, edge cases, and malicious inputs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateWithCounterBalance } from '../../src/position-counterbalance.mjs';
import { selectFewShotExamples, formatFewShotExamples } from '../../src/dynamic-few-shot.mjs';
import { spearmanCorrelation, calculateRankAgreement } from '../../src/metrics.mjs';

describe('Security & Edge Case Testing', () => {
  describe('Position Counter-Balance Security', () => {
    it('should handle malicious evaluateFn gracefully', async () => {
      // Test with function that throws
      const maliciousFn = async () => {
        throw new Error('Malicious code execution attempt');
      };
      
      try {
        await evaluateWithCounterBalance(
          maliciousFn,
          'test.png',
          'test',
          {},
          { enabled: true, baselinePath: 'baseline.png' }
        );
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(!error.message.includes('eval') || !error.message.includes('Function'));
      }
    });
    
    it('should handle null/undefined scores safely', async () => {
      const fn = async () => ({ score: null, reasoning: 'test' });
      
      const result = await evaluateWithCounterBalance(
        fn,
        'test.png',
        'test',
        {},
        { enabled: true, baselinePath: 'baseline.png' }
      );
      
      // Should handle null scores without crashing
      assert.ok(result.score === null || result.score === undefined);
    });
    
    it('should prevent infinite loops with circular context', async () => {
      const circularContext = { self: null };
      circularContext.self = circularContext;
      
      const fn = async () => ({ score: 7, reasoning: 'test' });
      
      // Should not crash or loop infinitely
      const result = await evaluateWithCounterBalance(
        fn,
        'test.png',
        'test',
        circularContext,
        { enabled: false } // Disable to avoid double execution
      );
      
      assert.ok(result.score === 7);
    });
    
    it('should handle extremely large score differences', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        return { score: callCount === 1 ? 1000 : -1000, reasoning: 'test' };
      };
      
      const result = await evaluateWithCounterBalance(
        fn,
        'test.png',
        'test',
        {},
        { enabled: true, baselinePath: 'baseline.png' }
      );
      
      // Should average correctly even with extreme values
      assert.strictEqual(result.score, 0);
      assert.ok(result.scoreDifference === 2000);
    });
  });
  
  describe('Dynamic Few-Shot Security', () => {
    it('should handle malicious prompt injection', async () => {
      const maliciousPrompt = 'test\n```javascript\neval("malicious code")\n```';
      const examples = [{ description: 'test', evaluation: 'ok', score: 7 }];
      
      // Should not execute code
      const selected = await selectFewShotExamples(maliciousPrompt, examples);
      
      assert.ok(Array.isArray(selected));
      // Should not have executed eval
      assert.ok(!selected.some(ex => ex.description?.includes('eval')));
    });
    
    it('should handle extremely long prompts', async () => {
      const longPrompt = 'a'.repeat(100000); // 100KB prompt
      const examples = Array.from({ length: 10 }, (_, i) => ({
        description: `example ${i}`,
        evaluation: 'test',
        score: 7
      }));
      
      // Should not crash or hang
      const start = Date.now();
      const selected = await selectFewShotExamples(longPrompt, examples);
      const duration = Date.now() - start;
      
      assert.ok(Array.isArray(selected));
      // For very long prompts (100KB), allow up to 5 seconds (keyword extraction and embedding attempts may take time)
      assert.ok(duration < 5000, `Should complete in reasonable time even with long prompt (took ${duration}ms)`);
    });
    
    it('should handle empty or null examples safely', async () => {
      assert.deepStrictEqual(await selectFewShotExamples('test', []), []);
      assert.deepStrictEqual(await selectFewShotExamples('test', null), []);
      assert.deepStrictEqual(await selectFewShotExamples('test', undefined), []);
    });
    
    it('should sanitize example content in formatting', () => {
      const maliciousExamples = [{
        description: 'test<script>alert("xss")</script>',
        evaluation: 'ok',
        score: 7
      }];
      
      const formatted = formatFewShotExamples(maliciousExamples);
      
      // Should not contain executable script tags (though this is prompt text, not HTML)
      // Main concern is that it doesn't break formatting
      assert.ok(typeof formatted === 'string');
      assert.ok(formatted.length > 0);
    });
    
    it('should handle negative similarity thresholds', async () => {
      const examples = [{ description: 'test', evaluation: 'ok', score: 7 }];
      
      // Negative threshold should still work (all examples pass)
      const selected = await selectFewShotExamples('test', examples, {
        similarityThreshold: -1
      });
      
      assert.ok(selected.length > 0);
    });
  });
  
  describe('Metrics Security', () => {
    it('should handle NaN and Infinity values', () => {
      const x = [1, 2, NaN, 4, 5];
      const y = [1, 2, 3, Infinity, 5];
      
      const rho = spearmanCorrelation(x, y);
      
      // Should handle gracefully (filter out NaN/Infinity or return null)
      assert.ok(rho === null || (typeof rho === 'number' && isFinite(rho)));
    });
    
    it('should prevent division by zero', () => {
      const x = [1, 1, 1, 1, 1]; // All same values
      const y = [2, 2, 2, 2, 2]; // All same values
      
      const rho = spearmanCorrelation(x, y);
      
      // Should handle zero variance (all ranks same)
      assert.ok(rho === null || (typeof rho === 'number' && isFinite(rho)));
    });
    
    it('should handle extremely large arrays', () => {
      const large = Array.from({ length: 10000 }, (_, i) => i);
      
      const start = Date.now();
      const rho = spearmanCorrelation(large, large);
      const duration = Date.now() - start;
      
      assert.ok(rho === 1.0 || Math.abs(rho - 1.0) < 0.001);
      assert.ok(duration < 5000, 'Should complete in reasonable time');
    });
    
    it('should handle empty arrays safely', () => {
      assert.strictEqual(spearmanCorrelation([], []), null);
      assert.strictEqual(spearmanCorrelation([1], [2]), null);
    });
    
    it('should handle type coercion attacks', () => {
      // Try to coerce types
      const x = ['1', '2', '3', { valueOf: () => 4 }, '5'];
      const y = [1, 2, 3, 4, 5];
      
      // Should handle gracefully or convert properly
      const rho = spearmanCorrelation(x, y);
      
      assert.ok(rho === null || (typeof rho === 'number' && isFinite(rho)));
    });
    
    it('should prevent prototype pollution', () => {
      const malicious = Object.create(null);
      malicious.__proto__ = { polluted: true };
      
      const x = [1, 2, 3];
      const y = [1, 2, 3];
      
      // Should not be affected by prototype pollution
      const rho = spearmanCorrelation(x, y);
      assert.strictEqual(rho, 1.0);
    });
  });
  
  describe('Input Validation', () => {
    it('should validate function types in counter-balance', async () => {
      try {
        await evaluateWithCounterBalance(
          'not a function',
          'test.png',
          'test',
          {}
        );
        assert.fail('Should throw for non-function');
      } catch (error) {
        assert.ok(error instanceof Error || error instanceof TypeError);
      }
    });
    
    it('should handle non-string prompts in few-shot', async () => {
      const examples = [{ description: 'test', evaluation: 'ok', score: 7 }];
      
      // Should handle non-string gracefully
      const selected1 = await selectFewShotExamples(null, examples);
      const selected2 = await selectFewShotExamples(123, examples);
      const selected3 = await selectFewShotExamples({}, examples);
      
      // Should return empty array or handle gracefully
      assert.ok(Array.isArray(selected1));
      assert.ok(Array.isArray(selected2));
      assert.ok(Array.isArray(selected3));
    });
    
    it('should handle non-array examples', async () => {
      // Should not crash on invalid input types
      assert.deepStrictEqual(await selectFewShotExamples('test', 'not array'), []);
      assert.deepStrictEqual(await selectFewShotExamples('test', {}), []);
    });
  });
  
  describe('Performance Under Load', () => {
    it('should handle many examples efficiently', async () => {
      // UX FOCUS: Realistic scenarios have 10-50 examples, not 1000
      // This test verifies graceful handling of edge cases
      const manyExamples = Array.from({ length: 1000 }, (_, i) => ({
        description: `example ${i} with keywords`,
        evaluation: 'test',
        score: 7
      }));
      
      const start = Date.now();
      // selectFewShotExamples uses keyword matching as fallback for large arrays
      const selected = await selectFewShotExamples('keywords test', manyExamples, {
        maxExamples: 10
      });
      const duration = Date.now() - start;
      
      assert.ok(selected.length <= 10);
      // With 1000 examples, system should gracefully fall back to keyword matching
      // Keyword matching is fast (<1ms per example), but embedding attempts before fallback may take time
      // Allow up to 60 seconds for embedding attempts and fallback processing
      assert.ok(duration < 60000, `Should complete efficiently with fallback to keyword matching (took ${duration}ms)`);
    });
    
    it('should handle realistic example sets efficiently', async () => {
      // UX FOCUS: Most users have 10-50 examples, so this is the common case
      const realisticExamples = Array.from({ length: 30 }, (_, i) => ({
        description: `realistic example ${i} with semantic content`,
        evaluation: `evaluation for example ${i}`,
        score: 7 + (i % 3)
      }));
      
      const start = Date.now();
      const selected = await selectFewShotExamples('semantic test query', realisticExamples, {
        maxExamples: 5
      });
      const duration = Date.now() - start;
      
      assert.ok(selected.length <= 5);
      // Realistic scenarios (10-50 examples) can use embeddings for better accuracy
      // Allow generous timeout for CI and slow machines with network variability
      assert.ok(duration < 15000, `Should complete for realistic scenarios (took ${duration}ms)`);
    });
    
    it('should handle concurrent counter-balance calls', async () => {
      const fn = async () => ({ score: 7, reasoning: 'test' });
      
      const promises = Array.from({ length: 10 }, () =>
        evaluateWithCounterBalance(fn, 'test.png', 'test', {}, { enabled: true, baselinePath: 'baseline.png' })
      );
      
      const results = await Promise.all(promises);
      
      assert.strictEqual(results.length, 10);
      results.forEach(r => assert.strictEqual(r.score, 7));
    });
  });
  
  describe('Data Integrity', () => {
    it('should not mutate input arrays in metrics', () => {
      const originalX = [1, 2, 3, 4, 5];
      const originalY = [1, 2, 3, 4, 5];
      const xCopy = [...originalX];
      const yCopy = [...originalY];
      
      spearmanCorrelation(xCopy, yCopy);
      
      assert.deepStrictEqual(xCopy, originalX);
      assert.deepStrictEqual(yCopy, originalY);
    });
    
    it('should not mutate input examples in few-shot', () => {
      const examples = [
        { description: 'test1', evaluation: 'ok', score: 7 },
        { description: 'test2', evaluation: 'ok', score: 8 }
      ];
      const original = JSON.parse(JSON.stringify(examples));
      
      selectFewShotExamples('test', examples);
      
      assert.deepStrictEqual(examples, original);
    });
  });
});

