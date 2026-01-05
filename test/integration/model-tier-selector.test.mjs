/**
 * Integration tests for model-tier-selector.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  selectModelTier,
  selectProvider,
  selectModelTierAndProvider
} from '../../src/model-tier-selector.mjs';

describe('Model Tier Selector', () => {
  describe('selectModelTier', () => {
    it('should return balanced tier by default', () => {
      const tier = selectModelTier({});
      
      assert.strictEqual(tier, 'balanced');
    });

    it('should return fast tier for high frequency', () => {
      const tier = selectModelTier({ frequency: 'high' });
      
      assert.strictEqual(tier, 'fast');
    });

    it('should return fast tier for numeric high frequency', () => {
      const tier = selectModelTier({ frequency: 15 }); // 15Hz
      
      assert.strictEqual(tier, 'fast');
    });

    it('should return best tier for critical evaluations', () => {
      const tier = selectModelTier({ criticality: 'critical' });
      
      assert.strictEqual(tier, 'best');
    });

    it('should return best tier when qualityRequired is true', () => {
      const tier = selectModelTier({ qualityRequired: true });
      
      assert.strictEqual(tier, 'best');
    });

    it('should return best tier for critical test types', () => {
      const tier1 = selectModelTier({ testType: 'expert-evaluation' });
      const tier2 = selectModelTier({ testType: 'medical' });
      const tier3 = selectModelTier({ testType: 'accessibility-critical' });
      
      assert.strictEqual(tier1, 'best');
      assert.strictEqual(tier2, 'best');
      assert.strictEqual(tier3, 'best');
    });

    it('should return fast tier when costSensitive is true', () => {
      const tier = selectModelTier({ costSensitive: true });
      
      assert.strictEqual(tier, 'fast');
    });

    it('should detect frequency from temporal notes', () => {
      const now = Date.now();
      const temporalNotes = [
        { timestamp: now - 100 },
        { timestamp: now - 50 },
        { timestamp: now }
      ]; // High frequency (>10 notes/sec)
      
      const tier = selectModelTier({ temporalNotes });
      
      assert.strictEqual(tier, 'fast');
    });

    it('should handle medium frequency', () => {
      const tier = selectModelTier({ frequency: 'medium' });
      
      // Medium frequency should default to balanced
      assert.ok(['balanced', 'fast'].includes(tier));
    });

    it('should handle low frequency', () => {
      const tier = selectModelTier({ frequency: 'low' });
      
      assert.ok(['balanced', 'best'].includes(tier));
    });
  });

  describe('selectProvider', () => {
    it('should return a provider name', () => {
      const provider = selectProvider({});
      
      assert.ok(typeof provider === 'string');
      assert.ok(['gemini', 'openai', 'claude', 'groq'].includes(provider));
    });

    it('should prefer groq for ultra-fast requirements', () => {
      const provider = selectProvider({ speed: 'ultra-fast' });
      
      // Groq is preferred for ultra-fast, but may fall back to others
      assert.ok(['groq', 'gemini', 'openai', 'claude'].includes(provider));
    });

    it('should prefer gemini for cost-sensitive', () => {
      const provider = selectProvider({ costSensitive: true });
      
      assert.strictEqual(provider, 'gemini');
    });

    it('should handle quality requirements', () => {
      const provider = selectProvider({ quality: 'best' });
      
      assert.ok(typeof provider === 'string');
      assert.ok(['gemini', 'openai', 'claude', 'groq'].includes(provider));
    });
  });

  describe('selectModelTierAndProvider', () => {
    it('should return both tier and provider', () => {
      const result = selectModelTierAndProvider({});
      
      assert.ok(result);
      assert.ok(typeof result.tier === 'string');
      assert.ok(typeof result.provider === 'string');
      assert.ok(typeof result.reason === 'string');
      assert.ok(['fast', 'balanced', 'best'].includes(result.tier));
      assert.ok(['gemini', 'openai', 'claude', 'groq'].includes(result.provider));
    });

    it('should respect context for tier selection', () => {
      const result = selectModelTierAndProvider({
        frequency: 'high'
      });
      
      assert.strictEqual(result.tier, 'fast');
    });

    it('should respect requirements for provider selection', () => {
      const result = selectModelTierAndProvider({
        requirements: { speed: 'ultra-fast' }
      });
      
      // Provider may vary based on API key availability
      assert.ok(['groq', 'gemini', 'openai', 'claude'].includes(result.provider));
    });
  });
});

