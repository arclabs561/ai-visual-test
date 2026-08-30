import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DATASET_REGISTRY,
  DatasetRegistryError,
  assertDatasetProviderUpload,
  assertDatasetUsage,
  createDatasetProvenance,
  preflightDatasetProviderUpload,
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
        'dataset-interfaces-gui': 'critique',
        'ui-vision': 'grounding',
        'screenspot-pro': 'grounding',
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
    assert.equal(createDatasetProvenance('dataset-interfaces-gui', '1').revision, '1');
    for (const revision of ['0', '01', '2', 'main', 'v1', '1.0']) {
      assert.throws(() => createDatasetProvenance('dataset-interfaces-gui', revision), DatasetRegistryError);
    }
    for (const key of ['ui-vision', 'screenspot-pro']) {
      assert.equal(
        createDatasetProvenance(key, 'f3a759c5f5b38f3ddfa12c5d8765432101234567').revision,
        'f3a759c5f5b38f3ddfa12c5d8765432101234567',
      );
      assert.throws(() => createDatasetProvenance(key, 'main'), DatasetRegistryError);
    }
  });

  it('fails closed when pixel redistribution is unresolved or restricted', () => {
    assert.equal(assertDatasetUsage('diffspot', 'bundle-pixels').pixelPolicy, 'allowed');
    assert.throws(() => assertDatasetUsage('uicrit', 'bundle-pixels'), /unknown/);
    assert.throws(() => assertDatasetUsage('apple-rldf', 'bundle-pixels'), /external-only/);
    assert.doesNotThrow(() => assertDatasetUsage('apple-rldf', 'evaluate-externally'));
  });

  it('permits provider upload without an acknowledgement only where source policy allows it', () => {
    assert.deepEqual(assertDatasetProviderUpload('diffspot', { provider: 'example-provider', model: 'example-model' }), {
      key: 'diffspot',
      dataset: 'tencent/DiffSpot',
      provider: 'example-provider',
      model: 'example-model',
      policy: 'allowed',
      rightsGrant: false,
    });
    assert.throws(
      () => assertDatasetProviderUpload('apple-rldf', { provider: 'example-provider', model: 'example-model' }),
      /operator confirmation of dataset terms/,
    );
    assert.throws(
      () => assertDatasetProviderUpload('uiclip-betterapp', { provider: 'example-provider', model: 'example-model' }),
      /operator confirmation of dataset terms/,
    );
  });

  it('permits pixel bundling and provider preflight for the public permissive corpora', () => {
    for (const key of ['dataset-interfaces-gui', 'ui-vision', 'screenspot-pro']) {
      assert.equal(assertDatasetUsage(key, 'bundle-pixels').pixelPolicy, 'allowed');
      assert.deepEqual(
        preflightDatasetProviderUpload(key, { provider: ' Anthropic ', model: 'claude-sonnet-4-5' }),
        {
          key,
          dataset: DATASET_REGISTRY[key].dataset,
          provider: 'claude',
          model: 'claude-sonnet-4-5',
          policy: 'allowed',
          rightsGrant: false,
        },
      );
    }
  });

  it('requires and retains operator confirmations without treating them as rights grants', () => {
    const uicritConfirmation = {
      dataset: 'uicrit',
      provider: 'example-provider',
      model: 'example-model',
      purpose: 'research-evaluation',
      confirmedBy: 'evaluation operator',
      confirmedAt: '2026-08-30T12:00:00.000Z',
      acknowledgements: ['local-pixel-rights-manifest-reviewed', 'provider-upload-permitted'],
      localPixelManifest: 'evaluation/rights/uicrit-pixels.json',
    };
    const uicrit = assertDatasetProviderUpload('uicrit', {
      provider: 'example-provider',
      model: 'example-model',
      confirmation: uicritConfirmation,
    });
    assert.deepEqual(uicrit.confirmation, uicritConfirmation);
    assert.equal(uicrit.rightsGrant, false);
    assert.throws(
      () => assertDatasetProviderUpload('uicrit', { provider: 'example-provider', model: 'example-model' }),
      /separately authorized local pixel manifest/,
    );
    assert.throws(
      () => assertDatasetProviderUpload('uicrit', {
        provider: 'example-provider',
        model: 'example-model',
        confirmation: { ...uicritConfirmation, localPixelManifest: ' ' },
      }),
      /localPixelManifest/,
    );
    assert.throws(
      () => assertDatasetProviderUpload('uicrit', {
        provider: 'example-provider',
        model: 'example-model',
        confirmation: {
          ...uicritConfirmation,
          acknowledgements: ['local-pixel-rights-manifest-reviewed'],
        },
      }),
      /provider-upload-permitted/,
    );

    const vibeConfirmation = {
      dataset: 'vibe-design-arena',
      provider: 'example-provider',
      model: 'example-model',
      purpose: 'research-evaluation',
      confirmedBy: 'evaluation operator',
      confirmedAt: '2026-08-30T12:00:00.000Z',
      acknowledgements: ['gated-dataset-terms-accepted', 'provider-upload-permitted'],
    };
    assert.equal(
      assertDatasetProviderUpload('vibe-design-arena', {
        provider: 'example-provider',
        model: 'example-model',
        confirmation: vibeConfirmation,
      }).policy,
      'requires-gated-terms-confirmation',
    );
    assert.throws(
      () => assertDatasetProviderUpload('vibe-landing-page-arena', {
        provider: 'example-provider',
        model: 'example-model',
        confirmation: { ...vibeConfirmation, dataset: 'vibe-landing-page-arena', acknowledgements: ['gated-dataset-terms-accepted'] },
      }),
      /provider-upload-permitted/,
    );
    assert.throws(
      () => assertDatasetProviderUpload('vibe-design-arena', {
        provider: 'different-provider',
        model: 'example-model',
        confirmation: vibeConfirmation,
      }),
      /dataset, provider, and model must match the request/,
    );
    assert.throws(
      () => assertDatasetProviderUpload('vibe-design-arena', {
        provider: 'example-provider',
        model: 'different-model',
        confirmation: vibeConfirmation,
      }),
      /dataset, provider, and model must match the request/,
    );
  });

  it('requires exact, dataset-bound terms confirmations before Apple and BetterApp uploads', () => {
    const appleConfirmation = {
      dataset: 'apple-rldf',
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4-5',
      purpose: 'noncommercial-research-evaluation',
      confirmedBy: 'evaluation operator',
      confirmedAt: '2026-08-30T12:00:00.000Z',
      acknowledgements: [
        'dataset-terms-reviewed',
        'noncommercial-research-purpose-confirmed',
        'provider-upload-permitted',
      ],
    };
    const apple = preflightDatasetProviderUpload('apple-rldf', {
      provider: 'openrouter', model: 'anthropic/claude-sonnet-4-5', confirmation: appleConfirmation,
    });
    assert.equal(apple.policy, 'requires-dataset-terms-confirmation');
    assert.equal(apple.rightsGrant, false);
    assert.deepEqual(apple.confirmation, appleConfirmation);

    const betterAppConfirmation = {
      dataset: 'uiclip-betterapp',
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4-5',
      purpose: 'research-evaluation',
      confirmedBy: 'evaluation operator',
      confirmedAt: '2026-08-30T12:00:00.000Z',
      acknowledgements: ['dataset-terms-reviewed', 'provider-upload-permitted'],
    };
    assert.equal(
      preflightDatasetProviderUpload('uiclip-betterapp', {
        provider: 'openrouter', model: 'anthropic/claude-sonnet-4-5', confirmation: betterAppConfirmation,
      }).policy,
      'requires-dataset-terms-confirmation',
    );

    for (const confirmation of [
      { ...appleConfirmation, dataset: 'uiclip-betterapp' },
      { ...appleConfirmation, model: 'anthropic/claude-opus-4-6' },
      { ...appleConfirmation, purpose: 'research-evaluation' },
      { ...appleConfirmation, acknowledgements: ['dataset-terms-reviewed', 'provider-upload-permitted'] },
      { ...betterAppConfirmation, acknowledgements: ['dataset-terms-reviewed', 'provider-upload-permitted', 'gated-dataset-terms-accepted'] },
    ]) {
      assert.throws(
        () => preflightDatasetProviderUpload('apple-rldf', {
          provider: 'openrouter', model: 'anthropic/claude-sonnet-4-5', confirmation,
        }),
        DatasetRegistryError,
      );
    }
  });

  it('rejects malformed runtime JSON confirmation shapes with DatasetRegistryError', () => {
    const validVibeConfirmation = {
      dataset: 'vibe-design-arena',
      provider: 'example-provider',
      model: 'example-model',
      purpose: 'research-evaluation',
      confirmedBy: 'evaluation operator',
      confirmedAt: '2026-08-30T12:00:00.000Z',
      acknowledgements: ['gated-dataset-terms-accepted', 'provider-upload-permitted'],
    };
    const malformed = [
      null,
      [],
      {},
      { provider: 7, model: 'example-model' },
      { provider: 'example-provider' },
      { provider: 'example-provider', model: 'example-model', confirmation: null },
      { provider: 'example-provider', model: 'example-model', confirmation: [] },
      { provider: 'example-provider', model: 'example-model', confirmation: { ...validVibeConfirmation, confirmedAt: '2026-08-30T12:00:00+01:00' } },
      { provider: 'example-provider', model: 'example-model', confirmation: { ...validVibeConfirmation, acknowledgements: 'gated-dataset-terms-accepted' } },
      { provider: 'example-provider', model: 'example-model', confirmation: { ...validVibeConfirmation, acknowledgements: ['provider-upload-permitted', 'provider-upload-permitted'] } },
      { provider: 'example-provider', model: 'example-model', confirmation: { ...validVibeConfirmation, acknowledgements: ['gated-dataset-terms-accepted', 'not-a-policy-value'] } },
      { provider: 'example-provider', model: 'example-model', confirmation: { ...validVibeConfirmation, unexpected: true } },
    ];
    for (const request of malformed) {
      assert.throws(
        () => assertDatasetProviderUpload('vibe-design-arena', request),
        DatasetRegistryError,
      );
    }
    assert.throws(
      () => assertDatasetProviderUpload('uicrit', {
        provider: 'example-provider',
        model: 'example-model',
        confirmation: {
          provider: 'example-provider',
          model: 'example-model',
          dataset: 'uicrit',
          purpose: 'research-evaluation',
          confirmedBy: 'evaluation operator',
          confirmedAt: '2026-08-30T12:00:00Z',
          acknowledgements: ['local-pixel-rights-manifest-reviewed', 'provider-upload-permitted'],
          localPixelManifest: 'https://example.test/rights.json',
        },
      }),
      /must be a local reference/,
    );
  });

  it('preflights the exact canonical provider/model tuple without credentials or network access', () => {
    assert.deepEqual(
      preflightDatasetProviderUpload('diffspot', { provider: ' Anthropic ', model: 'claude-sonnet-4-5' }),
      {
        key: 'diffspot',
        dataset: 'tencent/DiffSpot',
        provider: 'claude',
        model: 'claude-sonnet-4-5',
        policy: 'allowed',
        rightsGrant: false,
      },
    );
    assert.throws(
      () => preflightDatasetProviderUpload('diffspot', { provider: 'unknown-provider', model: 'model' }),
      /not supported/,
    );
    const confirmation = {
      dataset: 'vibe-design-arena',
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      purpose: 'research-evaluation',
      confirmedBy: 'evaluation operator',
      confirmedAt: '2026-08-30T12:00:00.000Z',
      acknowledgements: ['gated-dataset-terms-accepted', 'provider-upload-permitted'],
    };
    assert.throws(
      () => preflightDatasetProviderUpload('vibe-design-arena', {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        confirmation,
      }),
      /canonical selected provider name/,
    );
  });
});
