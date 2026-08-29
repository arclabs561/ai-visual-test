/**
 * Tests for persona-enhanced.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createEnhancedPersona,
  calculatePersonaConsistency,
  calculatePersonaDiversity
} from '../../src/persona-enhanced.js';

describe('Persona Enhanced', () => {
  describe('createEnhancedPersona', () => {
    it('should create enhanced persona with base persona', () => {
      const basePersona = {
        name: 'Developer',
        device: 'desktop',
        goals: ['accessibility', 'performance'],
        concerns: ['security']
      };
      
      const enhanced = createEnhancedPersona(basePersona);
      
      assert.strictEqual(enhanced.name, 'Developer');
      assert.strictEqual(enhanced.device, 'desktop');
      assert.deepStrictEqual(enhanced.goals, ['accessibility', 'performance']);
      assert.ok(enhanced.workflows);
      assert.ok(enhanced.frustrations);
      assert.ok(enhanced.usagePatterns);
      assert.ok(enhanced.temporalEvolution);
    });

    it('should merge with custom context', () => {
      const basePersona = {
        name: 'Designer',
        device: 'tablet',
        goals: ['usability'],
        concerns: []
      };
      
      const enhanced = createEnhancedPersona(basePersona, {
        workflows: { primary: ['design-review'] },
        frustrations: ['slow loading'],
        usagePatterns: { frequency: 'daily' }
      });
      
      assert.deepStrictEqual(enhanced.workflows.primary, ['design-review']);
      assert.deepStrictEqual(enhanced.frustrations, ['slow loading']);
      assert.strictEqual(enhanced.usagePatterns.frequency, 'daily');
    });
  });

  describe('calculatePersonaConsistency', () => {
    it('should return perfect consistency for single observation', () => {
      const observations = ['The button is accessible'];
      const result = calculatePersonaConsistency(observations);
      
      assert.strictEqual(result.promptToLine, 1.0);
      assert.strictEqual(result.lineToLine, 1.0);
      assert.strictEqual(result.overall, 1.0);
      assert.strictEqual(result.observationCount, 1);
    });

    it('should return perfect consistency for empty array', () => {
      const result = calculatePersonaConsistency([]);
      
      assert.strictEqual(result.promptToLine, 1.0);
      assert.strictEqual(result.lineToLine, 1.0);
      assert.strictEqual(result.overall, 1.0);
    });

    it('should calculate consistency for similar observations', () => {
      const observations = [
        'The button is accessible and well-designed',
        'The button accessibility is good',
        'Button design is accessible'
      ];
      
      const result = calculatePersonaConsistency(observations);
      
      assert.ok(result.promptToLine > 0);
      assert.ok(result.lineToLine > 0);
      assert.ok(result.overall > 0);
      assert.ok(result.overall < 1.0); // Not perfect but similar
      assert.strictEqual(result.observationCount, 3);
    });

    it('should detect low consistency for different observations', () => {
      const observations = [
        'The button is accessible',
        'The page loads slowly',
        'The colors are bright'
      ];
      
      const result = calculatePersonaConsistency(observations);
      
      assert.ok(result.overall < 0.5); // Low consistency
      assert.strictEqual(result.observationCount, 3);
    });

    it('should handle observation objects', () => {
      const observations = [
        { observation: 'The button is accessible' },
        { observation: 'Button design is good' }
      ];
      
      const result = calculatePersonaConsistency(observations);
      
      assert.ok(result.overall >= 0);
      assert.ok(result.overall <= 1.0);
      assert.strictEqual(result.observationCount, 2);
    });
  });

  describe('calculatePersonaDiversity', () => {
    it('should return zero diversity for single persona', () => {
      const experiences = [{
        observations: ['test observation']
      }];
      
      const result = calculatePersonaDiversity(experiences);
      
      assert.strictEqual(result.diversityRatio, 0);
      assert.strictEqual(result.uniqueKeywords, 0);
      assert.strictEqual(result.totalKeywords, 0);
      assert.strictEqual(result.personaCount, 1);
    });

    it('should return zero diversity for empty array', () => {
      const result = calculatePersonaDiversity([]);
      
      assert.strictEqual(result.diversityRatio, 0);
      assert.strictEqual(result.uniqueKeywords, 0);
      assert.strictEqual(result.totalKeywords, 0);
    });

    it('should calculate diversity for different personas', () => {
      const experiences = [
        { observations: ['The button is accessible and well-designed'] },
        { observations: ['The page loads quickly and efficiently'] },
        { observations: ['The colors are bright and vibrant'] }
      ];
      
      const result = calculatePersonaDiversity(experiences);
      
      assert.ok(result.uniqueKeywords > 0);
      assert.ok(result.totalKeywords > 0);
      assert.ok(result.diversityRatio > 0);
      assert.ok(result.diversityRatio <= 1.0);
      assert.strictEqual(result.personaCount, 3);
    });

    it('should handle experiences with notes', () => {
      const experiences = [
        { notes: [{ observation: 'Button is good' }] },
        { notes: [{ observation: 'Page is fast' }] }
      ];
      
      const result = calculatePersonaDiversity(experiences);
      
      assert.ok(result.uniqueKeywords > 0);
      assert.strictEqual(result.personaCount, 2);
    });

    it('should calculate high diversity for very different observations', () => {
      const experiences = [
        { observations: ['accessibility button design'] },
        { observations: ['performance speed loading'] },
        { observations: ['security encryption protection'] }
      ];
      
      const result = calculatePersonaDiversity(experiences);
      
      // Should have high diversity (many unique keywords)
      assert.ok(result.diversityRatio > 0.5);
    });

    it('should calculate low diversity for similar observations', () => {
      const experiences = [
        { observations: ['accessibility button design'] },
        { observations: ['accessibility button design'] },
        { observations: ['accessibility button design'] }
      ];
      
      const result = calculatePersonaDiversity(experiences);
      
      // Should have low diversity (few unique keywords)
      assert.ok(result.diversityRatio < 0.5);
    });
  });
});
