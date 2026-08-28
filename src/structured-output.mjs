import { getReviewSchema } from '#review-contract';
import { resolveProviderStructuredOutput } from '#provider-adapters';

/**
 * Negotiate the strongest structured-output mode that is safe for a provider
 * and model. Arbitrary model overrides deliberately fall back to JSON object
 * or prompt-only mode instead of repeatedly sending unsupported schema flags.
 */
export function resolveStructuredOutput({ provider, model = '', reviewMode = 'scalar', enabled = true } = {}) {
  const schema = getReviewSchema(reviewMode);
  return resolveProviderStructuredOutput({ provider, model, reviewMode, enabled, schema });
}

export function openAIResponseFormat(structured) {
  if (structured.mode === 'json-schema') {
    return {
      type: 'json_schema',
      json_schema: { name: structured.name, strict: structured.strict, schema: structured.schema }
    };
  }
  if (structured.mode === 'json-object') return { type: 'json_object' };
  return null;
}
