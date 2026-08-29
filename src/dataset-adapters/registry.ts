export type DatasetKey =
  | 'diffspot'
  | 'uicrit'
  | 'vibe-design-arena'
  | 'vibe-landing-page-arena'
  | 'apple-rldf'
  | 'uiclip-betterapp';

export type RedistributionPolicy = 'allowed' | 'external-only' | 'unknown';

export interface ExternalDatasetProvenance {
  dataset: string;
  sourceUrl: string;
  revision: string;
  license: string;
  redistribution: RedistributionPolicy;
}

export interface DatasetDescriptor {
  key: DatasetKey;
  dataset: string;
  sourceUrl: string;
  license: string;
  redistribution: RedistributionPolicy;
  access: 'public' | 'gated';
  pixelPolicy: RedistributionPolicy;
  track: 'preference' | 'regression' | 'critique';
  note: string;
}

export class DatasetRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatasetRegistryError';
  }
}

export const DATASET_REGISTRY: Readonly<Record<DatasetKey, DatasetDescriptor>> = Object.freeze({
  diffspot: Object.freeze({
    key: 'diffspot',
    dataset: 'tencent/DiffSpot',
    sourceUrl: 'https://huggingface.co/datasets/tencent/DiffSpot',
    license: 'MIT',
    redistribution: 'allowed',
    access: 'public',
    pixelPolicy: 'allowed',
    track: 'regression',
    note: 'Synthetic CSS mutations and no-difference controls; not a human preference label.',
  }),
  uicrit: Object.freeze({
    key: 'uicrit',
    dataset: 'google-research-datasets/uicrit',
    sourceUrl: 'https://github.com/google-research-datasets/uicrit',
    license: 'CC-BY-4.0 annotations; RICO pixels separately licensed',
    redistribution: 'allowed',
    access: 'public',
    pixelPolicy: 'unknown',
    track: 'critique',
    note: 'The public CSV references RICO IDs; its annotation license does not establish pixel redistribution rights.',
  }),
  'vibe-design-arena': Object.freeze({
    key: 'vibe-design-arena',
    dataset: 'datapointai/vibe-design-arena',
    sourceUrl: 'https://huggingface.co/datasets/datapointai/vibe-design-arena',
    license: 'CC-BY-4.0',
    redistribution: 'allowed',
    access: 'gated',
    pixelPolicy: 'allowed',
    track: 'preference',
    note: 'Access requires accepting the dataset host conditions; the library never accepts them for the operator.',
  }),
  'vibe-landing-page-arena': Object.freeze({
    key: 'vibe-landing-page-arena',
    dataset: 'datapointai/vibe-landing-page-arena',
    sourceUrl: 'https://huggingface.co/datasets/datapointai/vibe-landing-page-arena',
    license: 'CC-BY-4.0',
    redistribution: 'allowed',
    access: 'gated',
    pixelPolicy: 'allowed',
    track: 'preference',
    note: 'Access requires accepting the dataset host conditions; the library never accepts them for the operator.',
  }),
  'apple-rldf': Object.freeze({
    key: 'apple-rldf',
    dataset: 'apple/ml-rldf',
    sourceUrl: 'https://github.com/apple/ml-rldf',
    license: 'CC-BY-NC-ND-4.0',
    redistribution: 'external-only',
    access: 'public',
    pixelPolicy: 'external-only',
    track: 'preference',
    note: 'Keep outside distributable and commercial fixture bundles; no adapted material may be shared.',
  }),
  'uiclip-betterapp': Object.freeze({
    key: 'uiclip-betterapp',
    dataset: 'biglab/uiclip_human_data-paired_hf',
    sourceUrl: 'https://huggingface.co/datasets/biglab/uiclip_human_data-paired_hf',
    license: 'unknown',
    redistribution: 'unknown',
    access: 'public',
    pixelPolicy: 'unknown',
    track: 'preference',
    note: 'Do not redistribute or use as a release gate until the publisher states dataset terms.',
  }),
});

/**
 * The registry deliberately accepts only commit object IDs, never a ref name.
 * GitHub and the Hugging Face dataset repositories used here are Git-backed;
 * a full 40-hex SHA pins both source families to an immutable tree commit.
 */
const IMMUTABLE_REVISION_RULES: Readonly<Record<DatasetKey, { source: 'GitHub' | 'Hugging Face'; pattern: RegExp }>> = {
  diffspot: { source: 'Hugging Face', pattern: /^[0-9a-f]{40}$/i },
  uicrit: { source: 'GitHub', pattern: /^[0-9a-f]{40}$/i },
  'vibe-design-arena': { source: 'Hugging Face', pattern: /^[0-9a-f]{40}$/i },
  'vibe-landing-page-arena': { source: 'Hugging Face', pattern: /^[0-9a-f]{40}$/i },
  'apple-rldf': { source: 'GitHub', pattern: /^[0-9a-f]{40}$/i },
  'uiclip-betterapp': { source: 'Hugging Face', pattern: /^[0-9a-f]{40}$/i },
};

export function getDatasetDescriptor(key: DatasetKey): DatasetDescriptor {
  return DATASET_REGISTRY[key];
}

export function createDatasetProvenance(
  key: DatasetKey,
  revisionValue: string,
): ExternalDatasetProvenance {
  const revision = revisionValue.trim();
  const rule = IMMUTABLE_REVISION_RULES[key];
  if (!rule.pattern.test(revision)) {
    throw new DatasetRegistryError(
      `dataset revision for ${key} must be a 40-character hexadecimal ${rule.source} commit SHA; mutable refs and labels are not accepted`,
    );
  }
  const descriptor = getDatasetDescriptor(key);
  return {
    dataset: descriptor.dataset,
    sourceUrl: descriptor.sourceUrl,
    revision,
    license: descriptor.license,
    redistribution: descriptor.redistribution,
  };
}

export function assertDatasetUsage(
  key: DatasetKey,
  operation: 'evaluate-externally' | 'bundle-pixels',
): DatasetDescriptor {
  const descriptor = getDatasetDescriptor(key);
  if (operation === 'bundle-pixels' && descriptor.pixelPolicy !== 'allowed') {
    throw new DatasetRegistryError(
      `${descriptor.dataset} pixels cannot be bundled under the recorded policy (${descriptor.pixelPolicy})`,
    );
  }
  return descriptor;
}
