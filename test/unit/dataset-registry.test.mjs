import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DATASET_REGISTRY,
  DatasetRegistryError,
  assertDatasetUsage,
  createDatasetProvenance,
} from '../../src/dataset-adapters/registry.js';

describe('external dataset registry', () => {
  it('keeps every corpus in exactly one evaluation track', () => {
    assert.deepEqual(
      Object.fromEntries(Object.entries(DATASET_REGISTRY).map(([key, value]) => [key, value.track])),
      {
        diffspot: 'regression',
        uicrit: 'critique',
        'vibe-design-arena': 'preference',
        'vibe-landing-page-arena': 'preference',
        'apple-rldf': 'preference',
        'uiclip-betterapp': 'preference',
      },
    );
  });

  it('requires immutable source revisions in normalized provenance', () => {
    assert.throws(() => createDatasetProvenance('diffspot', '  '), DatasetRegistryError);
    assert.deepEqual(createDatasetProvenance('diffspot', 'c6dd79d5e1c0cbb4e7ca234c9f53c418a75e30ce'), {
      dataset: 'tencent/DiffSpot',
      sourceUrl: 'https://huggingface.co/datasets/tencent/DiffSpot',
      revision: 'c6dd79d5e1c0cbb4e7ca234c9f53c418a75e30ce',
      license: 'MIT',
      redistribution: 'allowed',
    });
  });

  it('rejects mutable refs and non-commit revision shapes for each source family', () => {
    for (const revision of ['main', 'latest', 'v1.0.0', 'c6dd79d5', 'a'.repeat(64)]) {
      assert.throws(() => createDatasetProvenance('diffspot', revision), DatasetRegistryError);
      assert.throws(() => createDatasetProvenance('uicrit', revision), DatasetRegistryError);
    }

    assert.equal(
      createDatasetProvenance('uicrit', 'adc92136cdaecf6a5c8bb85af08594dd9271eb00').revision,
      'adc92136cdaecf6a5c8bb85af08594dd9271eb00',
    );
    assert.equal(
      createDatasetProvenance('vibe-design-arena', 'f3a759c5f5b38f3ddfa12c5d8765432101234567').revision,
      'f3a759c5f5b38f3ddfa12c5d8765432101234567',
    );
  });

  it('fails closed when pixel redistribution is unresolved or restricted', () => {
    assert.equal(assertDatasetUsage('diffspot', 'bundle-pixels').pixelPolicy, 'allowed');
    assert.throws(() => assertDatasetUsage('uicrit', 'bundle-pixels'), /unknown/);
    assert.throws(() => assertDatasetUsage('apple-rldf', 'bundle-pixels'), /external-only/);
    assert.doesNotThrow(() => assertDatasetUsage('apple-rldf', 'evaluate-externally'));
  });
});
