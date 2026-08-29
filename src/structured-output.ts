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

export interface TaskStructuredOutputInput {
  provider?: string;
  model?: string;
  taskName: string;
  schema: object;
  enabled?: boolean;
}

export function resolveTaskStructuredOutput({
  provider,
  model = '',
  taskName,
  schema,
  enabled = true,
}: TaskStructuredOutputInput): StructuredOutputSpec {
  return resolveProviderStructuredOutput({
    provider: provider ?? '', model, taskName, enabled, schema,
  });
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
  return resolveTaskStructuredOutput({
    provider: provider ?? '',
    model,
    taskName: reviewMode === 'comparison' ? 'visual_comparison' : 'visual_review',
    schema: getReviewSchema(reviewMode),
    enabled,
  });
}
