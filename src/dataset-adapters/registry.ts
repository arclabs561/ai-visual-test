import { PROVIDER_NAMES, canonicalizeProviderName } from '../provider-data.mjs';

export type DatasetKey =
  | 'diffspot'
  | 'uicrit'
  | 'vibe-design-arena'
  | 'vibe-landing-page-arena'
  | 'apple-rldf'
  | 'uiclip-betterapp'
  | 'dataset-interfaces-gui'
  | 'ui-vision'
  | 'screenspot-pro';

export type RedistributionPolicy = 'allowed' | 'external-only' | 'unknown';

/** Whether source pixels may be sent to a third-party model provider. */
export type ProviderUploadPolicy =
  | 'allowed'
  | 'requires-local-pixel-manifest'
  | 'requires-gated-terms-confirmation'
  | 'requires-dataset-terms-confirmation';

export type ProviderUploadAcknowledgement =
  | 'local-pixel-rights-manifest-reviewed'
  | 'gated-dataset-terms-accepted'
  | 'dataset-terms-reviewed'
  | 'noncommercial-research-purpose-confirmed'
  | 'provider-upload-permitted';

/** The limited purpose an operator has confirmed for an external pixel upload. */
export type ProviderUploadPurpose =
  | 'research-evaluation'
  | 'noncommercial-research-evaluation';

/**
 * An operator-supplied record for an upload decision. It is evidence of an
 * operator's confirmation, not a licence grant or legal determination.
 */
export interface ProviderUploadConfirmation {
  /** Dataset registry key. This binds the receipt to one corpus. */
  dataset: DatasetKey;
  provider: string;
  model: string;
  purpose: ProviderUploadPurpose;
  confirmedBy: string;
  confirmedAt: string;
  acknowledgements: readonly ProviderUploadAcknowledgement[];
  /** A local, non-Git reference to the separately obtained pixel-rights record. */
  localPixelManifest?: string;
}

export interface ProviderUploadRequest {
  provider: string;
  model: string;
  confirmation?: ProviderUploadConfirmation;
}

/** A validated record a runner can store with its ignored evaluation receipt. */
export interface ProviderUploadDecision {
  key: DatasetKey;
  dataset: string;
  provider: string;
  model: string;
  policy: ProviderUploadPolicy;
  confirmation?: ProviderUploadConfirmation;
  /** Confirmation records an operator statement; it does not itself grant rights. */
  rightsGrant: false;
}

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
  providerUploadPolicy: ProviderUploadPolicy;
  track: 'preference' | 'regression' | 'critique' | 'grounding';
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
    providerUploadPolicy: 'allowed',
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
    providerUploadPolicy: 'requires-local-pixel-manifest',
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
    providerUploadPolicy: 'requires-gated-terms-confirmation',
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
    providerUploadPolicy: 'requires-gated-terms-confirmation',
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
    providerUploadPolicy: 'requires-dataset-terms-confirmation',
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
    providerUploadPolicy: 'requires-dataset-terms-confirmation',
    track: 'preference',
    note: 'Do not redistribute or use as a release gate until the publisher states dataset terms.',
  }),
  'dataset-interfaces-gui': Object.freeze({
    key: 'dataset-interfaces-gui',
    dataset: 'Mendeley Data/Dataset-interfaces-GUI',
    sourceUrl: 'https://data.mendeley.com/datasets/t9m2z2by4c/1',
    license: 'CC-BY-4.0',
    redistribution: 'allowed',
    access: 'public',
    pixelPolicy: 'allowed',
    providerUploadPolicy: 'allowed',
    track: 'critique',
    note: 'Expert UI/UX ratings for full-page interface screenshots.',
  }),
  'ui-vision': Object.freeze({
    key: 'ui-vision',
    dataset: 'ServiceNow/ui-vision',
    sourceUrl: 'https://huggingface.co/datasets/ServiceNow/ui-vision',
    license: 'MIT',
    redistribution: 'allowed',
    access: 'public',
    pixelPolicy: 'allowed',
    providerUploadPolicy: 'allowed',
    track: 'grounding',
    note: 'Annotated interface screenshots for visual grounding and layout evaluation.',
  }),
  'screenspot-pro': Object.freeze({
    key: 'screenspot-pro',
    dataset: 'likaixin/ScreenSpot-Pro',
    sourceUrl: 'https://huggingface.co/datasets/likaixin/ScreenSpot-Pro',
    license: 'MIT',
    redistribution: 'allowed',
    access: 'public',
    pixelPolicy: 'allowed',
    providerUploadPolicy: 'allowed',
    track: 'grounding',
    note: 'Professional-application screenshots with grounding annotations.',
  }),
});

/**
 * GitHub and Hugging Face dataset repositories are Git-backed, so a full
 * 40-hex SHA pins them to an immutable tree commit. Mendeley Data publishes
 * immutable numbered dataset versions; a bare positive version is accepted
 * only for that source family, never as a mutable label or ref.
 */
const IMMUTABLE_REVISION_RULES: Readonly<Record<DatasetKey, { source: 'GitHub' | 'Hugging Face' | 'Mendeley Data'; pattern: RegExp }>> = {
  diffspot: { source: 'Hugging Face', pattern: /^[0-9a-f]{40}$/i },
  uicrit: { source: 'GitHub', pattern: /^[0-9a-f]{40}$/i },
  'vibe-design-arena': { source: 'Hugging Face', pattern: /^[0-9a-f]{40}$/i },
  'vibe-landing-page-arena': { source: 'Hugging Face', pattern: /^[0-9a-f]{40}$/i },
  'apple-rldf': { source: 'GitHub', pattern: /^[0-9a-f]{40}$/i },
  'uiclip-betterapp': { source: 'Hugging Face', pattern: /^[0-9a-f]{40}$/i },
  'dataset-interfaces-gui': { source: 'Mendeley Data', pattern: /^1$/ },
  'ui-vision': { source: 'Hugging Face', pattern: /^[0-9a-f]{40}$/i },
  'screenspot-pro': { source: 'Hugging Face', pattern: /^[0-9a-f]{40}$/i },
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
    const requirement = rule.source === 'Mendeley Data'
      ? 'the immutable published Mendeley Data version 1'
      : `a 40-character hexadecimal ${rule.source} commit SHA`;
    throw new DatasetRegistryError(
      `dataset revision for ${key} must be ${requirement}; mutable refs and labels are not accepted`,
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

function nonEmptyConfirmationText(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new DatasetRegistryError(`provider upload confirmation.${field} must be non-empty`);
  }
}

type UnknownRecord = Record<string, unknown>;

const PROVIDER_UPLOAD_ACKNOWLEDGEMENTS = new Set<ProviderUploadAcknowledgement>([
  'local-pixel-rights-manifest-reviewed',
  'gated-dataset-terms-accepted',
  'dataset-terms-reviewed',
  'noncommercial-research-purpose-confirmed',
  'provider-upload-permitted',
]);

const PROVIDER_UPLOAD_PURPOSES = new Set<ProviderUploadPurpose>([
  'research-evaluation',
  'noncommercial-research-evaluation',
]);

interface DatasetTermsUploadRequirements {
  acknowledgements: readonly ProviderUploadAcknowledgement[];
  purpose: ProviderUploadPurpose;
}

const DATASET_TERMS_UPLOAD_REQUIREMENTS: Readonly<Partial<Record<DatasetKey, DatasetTermsUploadRequirements>>> = Object.freeze({
  'apple-rldf': Object.freeze({
    acknowledgements: Object.freeze([
      'dataset-terms-reviewed',
      'noncommercial-research-purpose-confirmed',
      'provider-upload-permitted',
    ] as const),
    purpose: 'noncommercial-research-evaluation',
  }),
  'uiclip-betterapp': Object.freeze({
    acknowledgements: Object.freeze(['dataset-terms-reviewed', 'provider-upload-permitted'] as const),
    purpose: 'research-evaluation',
  }),
});

const KNOWN_PROVIDER_NAMES = new Set<string>(PROVIDER_NAMES);

const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function record(value: unknown, field: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DatasetRegistryError(`provider upload ${field} must be an object`);
  }
  return value as UnknownRecord;
}

function exactFields(value: UnknownRecord, field: string, fields: readonly string[]): void {
  const allowed = new Set(fields);
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length > 0) {
    throw new DatasetRegistryError(`provider upload ${field} has unknown fields: ${unknown.join(', ')}`);
  }
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new DatasetRegistryError(`provider upload confirmation.${field} must be a string`);
  }
  nonEmptyConfirmationText(value, field);
  return value.trim();
}

function utcTimestamp(value: unknown): string {
  const timestamp = requiredText(value, 'confirmedAt');
  if (!RFC3339_UTC.test(timestamp) || Number.isNaN(Date.parse(timestamp))) {
    throw new DatasetRegistryError('provider upload confirmation.confirmedAt must be an RFC3339 UTC timestamp');
  }
  const parsed = new Date(timestamp).toISOString();
  if (parsed.slice(0, 19) !== timestamp.slice(0, 19)) {
    throw new DatasetRegistryError('provider upload confirmation.confirmedAt must be an RFC3339 UTC timestamp');
  }
  return timestamp;
}

function acknowledgements(value: unknown): readonly ProviderUploadAcknowledgement[] {
  if (!Array.isArray(value)) {
    throw new DatasetRegistryError('provider upload confirmation.acknowledgements must be an array');
  }
  const seen = new Set<ProviderUploadAcknowledgement>();
  for (const acknowledgement of value) {
    if (!PROVIDER_UPLOAD_ACKNOWLEDGEMENTS.has(acknowledgement as ProviderUploadAcknowledgement)) {
      throw new DatasetRegistryError('provider upload confirmation.acknowledgements contains an unknown value');
    }
    const typedAcknowledgement = acknowledgement as ProviderUploadAcknowledgement;
    if (seen.has(typedAcknowledgement)) {
      throw new DatasetRegistryError('provider upload confirmation.acknowledgements must not contain duplicates');
    }
    seen.add(typedAcknowledgement);
  }
  return [...seen];
}

function localPixelManifest(value: unknown): string {
  const manifest = requiredText(value, 'localPixelManifest');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(manifest)) {
    throw new DatasetRegistryError('provider upload confirmation.localPixelManifest must be a local reference');
  }
  return manifest;
}

function datasetKey(value: unknown): DatasetKey {
  const key = requiredText(value, 'dataset');
  if (!Object.hasOwn(DATASET_REGISTRY, key)) {
    throw new DatasetRegistryError('provider upload confirmation.dataset must name a registered dataset key');
  }
  return key as DatasetKey;
}

function uploadPurpose(value: unknown): ProviderUploadPurpose {
  const purpose = requiredText(value, 'purpose');
  if (!PROVIDER_UPLOAD_PURPOSES.has(purpose as ProviderUploadPurpose)) {
    throw new DatasetRegistryError('provider upload confirmation.purpose is not supported');
  }
  return purpose as ProviderUploadPurpose;
}

function parseProviderUploadRequest(value: unknown): ProviderUploadRequest {
  const candidate = record(value, 'request');
  exactFields(candidate, 'request', ['provider', 'model', 'confirmation']);
  const provider = requiredText(candidate.provider, 'request.provider');
  const model = requiredText(candidate.model, 'request.model');
  if (candidate.confirmation === undefined) return { provider, model };

  const confirmation = record(candidate.confirmation, 'confirmation');
  exactFields(confirmation, 'confirmation', [
    'dataset', 'provider', 'model', 'purpose', 'confirmedBy', 'confirmedAt', 'acknowledgements', 'localPixelManifest',
  ]);
  const parsed: ProviderUploadConfirmation = {
    dataset: datasetKey(confirmation.dataset),
    provider: requiredText(confirmation.provider, 'provider'),
    model: requiredText(confirmation.model, 'model'),
    purpose: uploadPurpose(confirmation.purpose),
    confirmedBy: requiredText(confirmation.confirmedBy, 'confirmedBy'),
    confirmedAt: utcTimestamp(confirmation.confirmedAt),
    acknowledgements: acknowledgements(confirmation.acknowledgements),
  };
  if (confirmation.localPixelManifest !== undefined) {
    parsed.localPixelManifest = localPixelManifest(confirmation.localPixelManifest);
  }
  return { provider, model, confirmation: parsed };
}

function validateProviderUploadConfirmation(
  confirmation: ProviderUploadConfirmation,
  requiredAcknowledgements: readonly ProviderUploadAcknowledgement[],
  requiresLocalManifest: boolean,
  requiredPurpose: ProviderUploadPurpose | undefined,
): void {
  const acknowledgements = new Set(confirmation.acknowledgements);
  for (const acknowledgement of requiredAcknowledgements) {
    if (!acknowledgements.has(acknowledgement)) {
      throw new DatasetRegistryError(
        `provider upload confirmation must acknowledge ${acknowledgement}`,
      );
    }
  }
  if (acknowledgements.size !== requiredAcknowledgements.length) {
    throw new DatasetRegistryError('provider upload confirmation.acknowledgements must exactly match the dataset policy');
  }
  if (requiredPurpose !== undefined && confirmation.purpose !== requiredPurpose) {
    throw new DatasetRegistryError(
      `provider upload confirmation.purpose must be ${requiredPurpose}`,
    );
  }
  if (requiresLocalManifest) {
    if (confirmation.localPixelManifest === undefined || confirmation.localPixelManifest.trim().length === 0) {
      throw new DatasetRegistryError(
        'provider upload confirmation must record a non-empty localPixelManifest',
      );
    }
  }
}

/**
 * Fail closed before a runner transmits dataset pixels to a model provider.
 * A supplied confirmation is only retained as an operator-provided receipt;
 * callers remain responsible for obtaining any needed rights or terms.
 */
export function assertDatasetProviderUpload(
  key: DatasetKey,
  request: unknown,
): ProviderUploadDecision {
  const descriptor = getDatasetDescriptor(key);
  const parsedRequest = parseProviderUploadRequest(request);
  const canonicalProvider = canonicalizeProviderName(parsedRequest.provider);
  if (typeof canonicalProvider !== 'string') {
    throw new DatasetRegistryError('provider upload request.provider is not supported');
  }
  const normalizedRequest: ProviderUploadRequest = {
    ...parsedRequest,
    provider: canonicalProvider,
  };

  switch (descriptor.providerUploadPolicy) {
    case 'allowed':
      break;
    case 'requires-local-pixel-manifest':
      if (normalizedRequest.confirmation === undefined) {
        throw new DatasetRegistryError(
          `${descriptor.dataset} provider upload requires an operator confirmation and separately authorized local pixel manifest`,
        );
      }
      validateProviderUploadConfirmation(
        normalizedRequest.confirmation,
        ['local-pixel-rights-manifest-reviewed', 'provider-upload-permitted'],
        true,
        undefined,
      );
      break;
    case 'requires-gated-terms-confirmation':
      if (normalizedRequest.confirmation === undefined) {
        throw new DatasetRegistryError(
          `${descriptor.dataset} provider upload requires an operator confirmation of gated terms and provider upload permission`,
        );
      }
      validateProviderUploadConfirmation(
        normalizedRequest.confirmation,
        ['gated-dataset-terms-accepted', 'provider-upload-permitted'],
        false,
        undefined,
      );
      break;
    case 'requires-dataset-terms-confirmation': {
      if (normalizedRequest.confirmation === undefined) {
        throw new DatasetRegistryError(
          `${descriptor.dataset} provider upload requires an operator confirmation of dataset terms and provider upload permission`,
        );
      }
      const requirements = DATASET_TERMS_UPLOAD_REQUIREMENTS[key];
      if (requirements === undefined) {
        throw new DatasetRegistryError(
          `${descriptor.dataset} provider upload policy has no fail-closed confirmation requirements`,
        );
      }
      validateProviderUploadConfirmation(
        normalizedRequest.confirmation,
        requirements.acknowledgements,
        false,
        requirements.purpose,
      );
      break;
    }
  }

  if (
    normalizedRequest.confirmation !== undefined
    && (
      normalizedRequest.confirmation.provider !== normalizedRequest.provider
      || normalizedRequest.confirmation.model !== normalizedRequest.model
      || normalizedRequest.confirmation.dataset !== key
    )
  ) {
    throw new DatasetRegistryError(
      'provider upload confirmation dataset, provider, and model must match the request',
    );
  }

  return normalizedRequest.confirmation === undefined
    ? {
      key,
      dataset: descriptor.dataset,
      provider: normalizedRequest.provider,
      model: normalizedRequest.model,
      policy: descriptor.providerUploadPolicy,
      rightsGrant: false,
    }
    : {
      key,
      dataset: descriptor.dataset,
      provider: normalizedRequest.provider,
      model: normalizedRequest.model,
      policy: descriptor.providerUploadPolicy,
      confirmation: normalizedRequest.confirmation,
      rightsGrant: false,
    };
}

/**
 * No-network gate for runners to invoke immediately before an evaluator call.
 * It canonicalizes the selected provider, rejects unknown providers, and
 * requires any recorded confirmation to name that exact canonical provider.
 * Neither this function nor its return value reads or exposes credentials.
 */
export function preflightDatasetProviderUpload(
  key: DatasetKey,
  request: unknown,
): ProviderUploadDecision {
  const parsedRequest = parseProviderUploadRequest(request);
  const canonicalProvider = canonicalizeProviderName(parsedRequest.provider);
  if (typeof canonicalProvider !== 'string' || !KNOWN_PROVIDER_NAMES.has(canonicalProvider)) {
    throw new DatasetRegistryError(`provider upload request.provider is not supported: ${parsedRequest.provider}`);
  }
  if (
    parsedRequest.confirmation !== undefined
    && parsedRequest.confirmation.provider !== canonicalProvider
  ) {
    throw new DatasetRegistryError(
      'provider upload confirmation.provider must use the canonical selected provider name',
    );
  }
  return assertDatasetProviderUpload(key, {
    ...parsedRequest,
    provider: canonicalProvider,
  });
}
