import { getReviewSchema } from './review-contract.mjs';

/**
 * Negotiate the strongest structured-output mode that is safe for a provider
 * and model. Arbitrary model overrides deliberately fall back to JSON object
 * or prompt-only mode instead of repeatedly sending unsupported schema flags.
 */
export function resolveStructuredOutput({ provider, model = '', reviewMode = 'scalar', enabled = true } = {}) {
  const schema = getReviewSchema(reviewMode);
  const name = reviewMode === 'comparison' ? 'visual_comparison' : 'visual_review';
  if (!enabled) return { mode: 'prompt-only', schema, name, diagnostic: 'structured_output_disabled' };

  if (provider === 'gemini') {
    return {
      mode: 'json-schema', schema, name, diagnostic: null,
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema }
    };
  }

  if (provider === 'openai' && /^(gpt-4o|gpt-4\.1|gpt-5|o[134])/.test(model)) {
    return { mode: 'json-schema', schema, name, strict: true, diagnostic: null };
  }

  if (provider === 'groq') {
    const strict = /^openai\/gpt-oss-/.test(model);
    return {
      mode: 'json-schema', schema, name, strict,
      diagnostic: strict ? null : 'best_effort_json_schema'
    };
  }

  if (provider === 'openrouter' || provider === 'openai') {
    return { mode: 'json-object', schema, name, diagnostic: 'model_schema_support_unknown' };
  }

  // Claude tool-use can enforce input schemas, but changing the request into a
  // tool protocol is a separate capability. Keep the compatibility loop clear.
  return { mode: 'prompt-only', schema, name, diagnostic: 'native_schema_unavailable' };
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
