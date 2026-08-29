import { API_CONSTANTS } from './constants.js';
import { ProviderError } from './errors.js';

export type ProviderName = 'gemini' | 'openai' | 'groq' | 'openrouter' | 'claude';
export type StructuredOutputMode = 'json-schema' | 'json-object' | 'prompt-only';

export interface StructuredOutputSpec {
  mode: StructuredOutputMode;
  schema: object;
  name: string;
  strict?: boolean;
  diagnostic: string | null;
  generationConfig?: Record<string, unknown>;
}

export interface ProviderConfig {
  apiUrl: string;
  model: string;
}

export interface ProviderCall {
  /** Legacy image input. Prefer provider-neutral content for new modalities. */
  images?: ProviderImage[];
  /** Provider-owned serialization of text, image, and video payloads. */
  content?: ProviderContent[];
  prompt: string;
  signal: AbortSignal;
  apiKey: string;
  config: ProviderConfig;
  maxOutputTokens?: number;
  structuredOutput?: StructuredOutputSpec | null;
}

export interface ProviderImage {
  data: string;
  mime: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
}

export type ProviderImageMime = ProviderImage['mime'];
export type ProviderVideoMime = 'video/mp4' | 'video/webm' | 'video/quicktime';

export type ProviderContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mime: ProviderImageMime }
  | { type: 'video'; data: string; mime: ProviderVideoMime };

export interface ParsedProviderResponse {
  judgment: string;
  data: Record<string, unknown>;
  logprobs: unknown;
}

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderAdapter {
  readonly provider: ProviderName;
  resolveStructuredOutput(input: {
    model: string;
    taskName: string;
    enabled: boolean;
    schema: object;
  }): StructuredOutputSpec;
  call(input: ProviderCall): Promise<Response>;
  parseResponse(response: Response): Promise<ParsedProviderResponse>;
  extractUsage(data: Record<string, unknown>): ProviderUsage;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function contentFromCall({ images, content }: ProviderCall): ProviderContent[] {
  if (content) return content;
  return (images ?? []).map(image => ({ type: 'image' as const, ...image }));
}

function schemaSpec(
  provider: ProviderName,
  { model, taskName, enabled, schema }: {
    model: string;
    taskName: string;
    enabled: boolean;
    schema: object;
  },
): StructuredOutputSpec {
  const name = taskName;
  if (!enabled) return { mode: 'prompt-only', schema, name, diagnostic: 'structured_output_disabled' };
  if (provider === 'gemini') {
    return {
      mode: 'json-schema', schema, name, diagnostic: null,
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema },
    };
  }
  if (provider === 'openai' && /^(gpt-4o|gpt-4\.1|gpt-5|o[134])/.test(model)) {
    return { mode: 'json-schema', schema, name, strict: true, diagnostic: null };
  }
  if (provider === 'groq') {
    const strict = /^openai\/gpt-oss-/.test(model);
    if (/^qwen\/qwen3\.6-/.test(model)) {
      return { mode: 'json-object', schema, name, diagnostic: 'model_schema_support_unknown' };
    }
    return {
      mode: 'json-schema', schema, name, strict,
      diagnostic: strict ? null : 'best_effort_json_schema',
    };
  }
  if (provider === 'openrouter' || provider === 'openai') {
    return { mode: 'json-object', schema, name, diagnostic: 'model_schema_support_unknown' };
  }
  return { mode: 'prompt-only', schema, name, diagnostic: 'native_schema_unavailable' };
}

function openAIResponseFormat(structured?: StructuredOutputSpec | null): Record<string, unknown> | null {
  if (!structured) return null;
  if (structured.mode === 'json-schema') {
    return {
      type: 'json_schema',
      json_schema: {
        name: structured.name,
        strict: structured.strict,
        schema: structured.schema,
      },
    };
  }
  return structured.mode === 'json-object' ? { type: 'json_object' } : null;
}

async function parseEnvelope(
  provider: ProviderName,
  response: Response,
  extract: (data: Record<string, unknown>) => { judgment: string; logprobs: unknown },
): Promise<ParsedProviderResponse> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const preview = (await response.text()).slice(0, 200);
    throw new ProviderError(
      `${provider} API returned non-JSON response (${contentType}). Status: ${response.status}. Check API key or endpoint.`,
      provider,
      { statusCode: response.status, contentType, responsePreview: preview, retryable: false },
    );
  }
  const data = record(await response.json());
  const apiError = record(data.error);
  if (!response.ok || data.error) {
    const message = typeof apiError.message === 'string'
      ? apiError.message
      : typeof data.detail === 'string' ? data.detail : `HTTP ${response.status}`;
    throw new ProviderError(`${provider} API error: ${message}`, provider, {
      apiError: data.error || null,
      statusCode: response.status,
      retryable: response.status === 429 || response.status >= 500,
    });
  }
  const parsed = extract(data);
  if (!parsed.judgment.trim()) {
    throw new ProviderError(`${provider} API returned an empty response envelope`, provider, {
      statusCode: response.status,
      retryable: true,
      failureKind: 'response_envelope',
    });
  }
  return { ...parsed, data };
}

function geminiAdapter(): ProviderAdapter {
  const provider = 'gemini' as const;
  return {
    provider,
    resolveStructuredOutput: input => schemaSpec(provider, input),
    call(input) {
      const { prompt, signal, apiKey, config, structuredOutput, maxOutputTokens } = input;
      const parts: Record<string, unknown>[] = [{ text: prompt }];
      for (const item of contentFromCall(input)) {
        if (item.type === 'text') parts.push({ text: item.text });
        else parts.push({ inline_data: { mime_type: item.mime, data: item.data } });
      }
      return fetch(`${config.apiUrl}/models/${config.model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: API_CONSTANTS.DEFAULT_TEMPERATURE,
            maxOutputTokens: maxOutputTokens ?? API_CONSTANTS.DEFAULT_MAX_OUTPUT_TOKENS,
            topP: API_CONSTANTS.DEFAULT_TOP_P,
            topK: 40,
            ...(structuredOutput?.generationConfig || {}),
          },
        }),
      });
    },
    parseResponse: response => parseEnvelope(provider, response, data => {
      const candidate = record(array(data.candidates)[0]);
      const content = record(candidate.content);
      const parts = array(content.parts).map(record);
      return {
        judgment: parts.filter(part => typeof part.text === 'string').map(part => part.text).join('\n'),
        logprobs: parts.find(part => part.logprobs !== undefined)?.logprobs || null,
      };
    }),
    extractUsage(data) {
      const usage = record(data.usageMetadata);
      return {
        inputTokens: number(usage.promptTokenCount),
        outputTokens: number(usage.candidatesTokenCount),
      };
    },
  };
}

function openAICompatibleAdapter(provider: 'openai' | 'groq' | 'openrouter'): ProviderAdapter {
  return {
    provider,
    resolveStructuredOutput: input => schemaSpec(provider, input),
    call(input) {
      const { prompt, signal, apiKey, config, structuredOutput, maxOutputTokens: requestedMaxOutputTokens } = input;
      const content: Record<string, unknown>[] = [{ type: 'text', text: prompt }];
      for (const item of contentFromCall(input)) {
        if (item.type === 'text') content.push({ type: 'text', text: item.text });
        else if (item.type === 'image') {
          content.push({ type: 'image_url', image_url: { url: `data:${item.mime};base64,${item.data}` } });
        } else {
          content.push({ type: 'video_url', video_url: { url: `data:${item.mime};base64,${item.data}` } });
        }
      }
      const responseFormat = openAIResponseFormat(structuredOutput);
      const maxOutputTokens = provider === 'groq' && /^qwen\/qwen3\.6-/.test(config.model)
        ? 1024
        : requestedMaxOutputTokens ?? API_CONSTANTS.DEFAULT_MAX_OUTPUT_TOKENS;
      return fetch(`${config.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        signal,
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content }],
          ...(provider === 'groq' && /^qwen\/qwen3\.6-/.test(config.model)
            ? { reasoning_effort: 'none' }
            : {}),
          ...(responseFormat ? { response_format: responseFormat } : {}),
          ...(config.model.includes('mini') || config.model.includes('gpt-5')
            ? {}
            : { temperature: API_CONSTANTS.DEFAULT_TEMPERATURE, top_p: API_CONSTANTS.DEFAULT_TOP_P }),
          ...(config.model.startsWith('gpt-4o') || config.model.startsWith('gpt-5')
            ? { max_completion_tokens: maxOutputTokens }
            : { max_tokens: maxOutputTokens }),
        }),
      });
    },
    parseResponse: response => parseEnvelope(provider, response, data => {
      const choice = record(array(data.choices)[0]);
      const message = record(choice.message);
      return {
        judgment: typeof message.content === 'string' ? message.content : '',
        logprobs: choice.logprobs || null,
      };
    }),
    extractUsage(data) {
      const usage = record(data.usage);
      return {
        inputTokens: number(usage.prompt_tokens),
        outputTokens: number(usage.completion_tokens),
      };
    },
  };
}

function anthropicAdapter(): ProviderAdapter {
  const provider = 'claude' as const;
  return {
    provider,
    resolveStructuredOutput: input => schemaSpec(provider, input),
    call(input) {
      const { prompt, signal, apiKey, config, maxOutputTokens } = input;
      const content: Record<string, unknown>[] = [{ type: 'text', text: prompt }];
      for (const item of contentFromCall(input)) {
        if (item.type === 'text') content.push({ type: 'text', text: item.text });
        else if (item.type === 'image') {
          content.push({ type: 'image', source: { type: 'base64', media_type: item.mime, data: item.data } });
        } else {
          throw new ProviderError('Video content is not supported by the Claude adapter', provider, { retryable: false });
        }
      }
      return fetch(`${config.apiUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        signal,
        body: JSON.stringify({
          model: config.model,
          max_tokens: maxOutputTokens ?? API_CONSTANTS.DEFAULT_MAX_OUTPUT_TOKENS,
          messages: [{ role: 'user', content }],
        }),
      });
    },
    parseResponse: response => parseEnvelope(provider, response, data => ({
      judgment: array(data.content)
        .map(record)
        .filter(block => block.type === 'text' && typeof block.text === 'string')
        .map(block => block.text)
        .join('\n'),
      logprobs: null,
    })),
    extractUsage(data) {
      const usage = record(data.usage);
      return {
        inputTokens: number(usage.input_tokens),
        outputTokens: number(usage.output_tokens),
      };
    },
  };
}

const ADAPTERS: Record<ProviderName, ProviderAdapter> = {
  gemini: geminiAdapter(),
  openai: openAICompatibleAdapter('openai'),
  groq: openAICompatibleAdapter('groq'),
  openrouter: openAICompatibleAdapter('openrouter'),
  claude: anthropicAdapter(),
};

export function getProviderAdapter(provider: string): ProviderAdapter {
  const adapter = ADAPTERS[provider as ProviderName];
  if (!adapter) throw new ProviderError(`Unknown provider: ${provider}`, provider);
  return adapter;
}

export function resolveProviderStructuredOutput(input: {
  provider: string;
  model: string;
  taskName: string;
  enabled: boolean;
  schema: object;
}): StructuredOutputSpec {
  return getProviderAdapter(input.provider).resolveStructuredOutput(input);
}
