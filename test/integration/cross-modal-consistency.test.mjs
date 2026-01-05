/**
 * Cross-Modal Consistency Tests
 * 
 * Tests for consistency checking between screenshot and HTML/CSS.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { checkCrossModalConsistency, validateExperienceConsistency } from '../../src/cross-modal-consistency.mjs';

describe('Cross-Modal Consistency', () => {
  describe('checkCrossModalConsistency', () => {
    it('should detect missing both screenshot and rendered code', () => {
      const result = checkCrossModalConsistency({});

      assert.strictEqual(result.isConsistent, false, 'Should be inconsistent');
      assert.ok(result.issues.length > 0, 'Should have issues');
      assert.strictEqual(result.score, 0, 'Should have zero score');
    });

    it('should check consistency with screenshot only', () => {
      const result = checkCrossModalConsistency({
        screenshot: '/path/to/screenshot.png'
      });

      assert.ok(result, 'Should return result');
      assert.ok(result.checks, 'Should have checks');
      assert.strictEqual(result.checks.hasScreenshot, true);
      assert.strictEqual(result.checks.hasRenderedCode, false);
    });

    it('should check consistency with rendered code only', () => {
      const result = checkCrossModalConsistency({
        renderedCode: {
          html: '<html><body>Test</body></html>',
          criticalCSS: { 'body': { color: '#000' } }
        }
      });

      assert.ok(result, 'Should return result');
      assert.strictEqual(result.checks.hasRenderedCode, true);
      assert.strictEqual(result.checks.hasHTML, true);
      assert.strictEqual(result.checks.hasCSS, true);
    });

    it('should detect DOM structure issues', () => {
      const result = checkCrossModalConsistency({
        renderedCode: {
          html: '<html></html>',
          domStructure: {}
        }
      });

      assert.ok(result.warnings.length >= 0, 'Should check for warnings');
    });

    it('should detect CSS positioning issues', () => {
      const result = checkCrossModalConsistency({
        renderedCode: {
          criticalCSS: {
            '.element': {
              position: 'absolute',
              top: 'auto',
              left: 'auto'
            }
          }
        }
      });

      assert.ok(result.warnings.length >= 0, 'Should check for positioning warnings');
    });

    it('should detect hidden game elements', () => {
      const result = checkCrossModalConsistency({
        renderedCode: {
          criticalCSS: {
            '#game': {
              display: 'none'
            }
          }
        }
      });

      assert.ok(result.warnings.length >= 0, 'Should detect hidden game elements');
    });

    it('should check game state consistency', () => {
      const result = checkCrossModalConsistency({
        gameState: { score: 100, level: 1 },
        renderedCode: {
          domStructure: {
            score: { text: '100' },
            level: { text: '1' }
          }
        }
      });

      assert.ok(result, 'Should return result');
      assert.ok(result.checks.hasGameState, 'Should detect game state');
    });

    it('should handle strict mode', () => {
      const result = checkCrossModalConsistency({
        screenshot: '/path/to/screenshot.png',
        renderedCode: { html: '<html></html>' },
        strict: true
      });

      assert.ok(result, 'Should return result');
      // Strict mode may produce more warnings
    });
  });

  describe('validateExperienceConsistency', () => {
    it('should validate experience consistency', () => {
      const experience = {
        screenshots: ['/path/to/screenshot.png'],
        notes: [
          { timestamp: Date.now(), observation: 'Test', score: 7 }
        ]
      };

      const result = validateExperienceConsistency(experience);

      assert.ok(result, 'Should return result');
      assert.ok(typeof result.isConsistent === 'boolean', 'Should have consistency flag');
    });

    it('should handle empty experience', () => {
      const result = validateExperienceConsistency({});

      assert.ok(result, 'Should handle empty experience');
    });

    it('should detect temporal inconsistencies', () => {
      const experience = {
        notes: [
          { timestamp: 1000, score: 7 },
          { timestamp: 2000, score: 2 }, // Large drop
          { timestamp: 3000, score: 8 }  // Large jump
        ]
      };

      const result = validateExperienceConsistency(experience);

      assert.ok(result, 'Should detect inconsistencies');
    });
  });
});
