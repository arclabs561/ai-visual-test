import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VLM_LIMITATIONS,
  getLimitationsForTestType,
  shouldUseHybridValidation
} from '../../src/limitations.mjs';

describe('VLM Limitations', () => {
  describe('VLM_LIMITATIONS', () => {
    it('should have entries for all known limitation categories', () => {
      const expected = [
        'subtleSpatialShifts', 'elementOverlap', 'keyboardNavigation',
        'screenReaderOrder', 'colorContrastPrecision', 'dynamicContent',
        'textContent', 'interactiveState'
      ];
      for (const key of expected) {
        assert.ok(VLM_LIMITATIONS[key], `Missing limitation: ${key}`);
        assert.ok(VLM_LIMITATIONS[key].description);
        assert.ok(VLM_LIMITATIONS[key].recommendation);
        assert.ok(['high', 'medium', 'low'].includes(VLM_LIMITATIONS[key].severity));
        assert.ok(['none', 'low', 'medium', 'high'].includes(VLM_LIMITATIONS[key].vlmAccuracy));
      }
    });
  });

  describe('getLimitationsForTestType', () => {
    it('should return accessibility-relevant limitations', () => {
      const limits = getLimitationsForTestType('accessibility');
      const keys = limits.map(l => l.key);
      assert.ok(keys.includes('keyboardNavigation'));
      assert.ok(keys.includes('screenReaderOrder'));
      assert.ok(keys.includes('colorContrastPrecision'));
    });

    it('should return layout-relevant limitations', () => {
      const limits = getLimitationsForTestType('layout');
      const keys = limits.map(l => l.key);
      assert.ok(keys.includes('subtleSpatialShifts'));
      assert.ok(keys.includes('elementOverlap'));
    });

    it('should return all limitations for general type', () => {
      const limits = getLimitationsForTestType('general');
      assert.equal(limits.length, Object.keys(VLM_LIMITATIONS).length);
    });

    it('should return all limitations for unknown type', () => {
      const limits = getLimitationsForTestType('unknown');
      assert.equal(limits.length, Object.keys(VLM_LIMITATIONS).length);
    });
  });

  describe('shouldUseHybridValidation', () => {
    it('should recommend hybrid for accessibility', () => {
      assert.equal(shouldUseHybridValidation('accessibility'), true);
    });

    it('should recommend hybrid for layout', () => {
      assert.equal(shouldUseHybridValidation('layout'), true);
    });

    it('should recommend hybrid for interaction', () => {
      assert.equal(shouldUseHybridValidation('interaction'), true);
    });

    it('should not require hybrid for visual', () => {
      assert.equal(shouldUseHybridValidation('visual'), false);
    });

    it('should not require hybrid for general', () => {
      assert.equal(shouldUseHybridValidation('general'), false);
    });
  });
});
