import { getReviewSchema, type ReviewMode } from '#review-contract';
import {
  resolveProviderStructuredOutput,
  type StructuredOutputSpec,
} from '#provider-adapters';

export interface StructuredOutputInput {
  provider?: string;
  model?: string;
  reviewMode?: ReviewMode;
  enabled?: boolean;
}

/**
 * Negotiate the strongest structured-output mode that is safe for a provider
 * and model. Arbitrary model overrides deliberately fall back to JSON object
 * or prompt-only mode instead of repeatedly sending unsupported schema flags.
 */
export function resolveStructuredOutput({
  provider,
  model = '',
  reviewMode = 'scalar',
  enabled = true,
}: StructuredOutputInput = {}): StructuredOutputSpec {
  const schema = getReviewSchema(reviewMode);
  return resolveProviderStructuredOutput({ provider: provider ?? '', model, reviewMode, enabled, schema });
}
