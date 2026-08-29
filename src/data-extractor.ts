/** Structured extraction from text, with JSON, LLM, and regex strategies. */
import { createConfig, type Config } from './config.js';
import { loadEnv } from './load-env.js';
import { warn } from './logger.js';
import { ValidationError } from '#errors';

loadEnv();

/** JSON-schema-like field names are accepted; only primitive names have runtime type checks. */
export type ExtractionFieldType = string;
export interface ExtractionField {
  type: ExtractionFieldType;
  required?: boolean;
  [key: string]: unknown;
}
export type ExtractionSchema = Record<string, ExtractionField>;
export type ExtractedData = Record<string, unknown>;
export interface ExtractionOptions {
  method?: 'json' | 'llm' | 'regex';
  provider?: string | null;
  apiKey?: string;
  fallback?: 'llm' | 'regex' | 'json' | 'auto';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isExtractedData(value: unknown): value is ExtractedData {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Extract schema-conforming values, or null when no strategy produces them. */
export async function extractStructuredData(
  text: string | null | undefined,
  schema: ExtractionSchema,
  options: ExtractionOptions = {},
): Promise<ExtractedData | null> {
  if (!text) return null;
  const { fallback = 'llm', provider = null } = options;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed: unknown = JSON.parse(jsonMatch[0]);
      if (validateSchema(parsed, schema)) return parsed;
    }
  } catch { /* Try the next strategy. */ }
  if (fallback === 'llm' || fallback === 'auto') {
    try {
      const config = createConfig({ provider });
      if (config.enabled) {
        const extracted = await extractWithLLM(text, schema, config);
        if (extracted) return extracted;
      }
    } catch (caught) { warn(`[DataExtractor] LLM extraction failed: ${errorMessage(caught)}`); }
  }
  if (fallback === 'regex' || fallback === 'auto') {
    try {
      const extracted = extractWithRegex(text, schema);
      if (extracted) return extracted;
    } catch (caught) { warn(`[DataExtractor] Regex extraction failed: ${errorMessage(caught)}`); }
  }
  return null;
}

interface LlmUtils {
  extractJSON(response: string): unknown;
  callLLM(prompt: string, provider: string, apiKey: string | null, options: {
    tier: 'advanced'; temperature: number; maxTokens: number;
  }): Promise<string>;
}
async function llmUtils(): Promise<LlmUtils> {
  return (await import('@arclabs561/llm-utils')) as LlmUtils;
}
async function extractWithLLM(text: string, schema: ExtractionSchema, config: Config): Promise<ExtractedData | null> {
  const prompt = `Extract structured data from the following text. Return ONLY valid JSON matching this schema:\n\nSchema:\n${JSON.stringify(schema, null, 2)}\n\nText to extract from:\n${text}\n\nReturn ONLY the JSON object, no other text.`;
  try {
    const response = await callLLMForExtraction(prompt, config);
    let parsed: unknown;
    try { parsed = (await llmUtils()).extractJSON(response); }
    catch {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new ValidationError('Could not extract JSON from response. The LLM response did not contain valid JSON. This may indicate the model failed to follow the schema format. Try: 1) Simplifying the schema, 2) Using a more capable model tier, or 3) Adding examples to the prompt.', {
        responseLength: response.length, responsePreview: response.substring(0, 200) || 'No response', schema,
      });
      parsed = JSON.parse(jsonMatch[0]);
    }
    return validateSchema(parsed, schema) ? parsed : null;
  } catch (caught) {
    warn(`[DataExtractor] LLM extraction error: ${errorMessage(caught)}`);
    return null;
  }
}
async function callLLMForExtraction(prompt: string, config: Config): Promise<string> {
  try {
    return await (await llmUtils()).callLLM(prompt, config.provider || 'gemini', config.apiKey, {
      tier: 'advanced', temperature: 0.1, maxTokens: 1000,
    });
  } catch (caught) {
    const message = errorMessage(caught);
    throw new ValidationError(`LLM extraction requires @arclabs561/llm-utils package. Install it with: npm install @arclabs561/llm-utils. Error: ${message}`, {
      package: '@arclabs561/llm-utils', installationCommand: 'npm install @arclabs561/llm-utils', originalError: message,
    });
  }
}
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function extractWithRegex(text: string, schema: ExtractionSchema): ExtractedData | null {
  const result: ExtractedData = {};
  for (const [key, field] of Object.entries(schema)) {
    let value: string | number | boolean | null = null;
    const escapedKey = escapeRegex(key);
    if (field.type === 'number') {
      const match = text.match(new RegExp(`${escapedKey}[\\s:=]+([0-9.]+)`, 'i'));
      if (match?.[1]) value = Number.parseFloat(match[1]);
    } else if (field.type === 'string') {
      const match = text.match(new RegExp(`${escapedKey}[\\s:=]+([^\\n,]+)`, 'i'));
      if (match?.[1]) value = match[1].trim();
    } else if (field.type === 'boolean') {
      const match = text.match(new RegExp(`${escapedKey}[\\s:=]+(true|false|yes|no)`, 'i'));
      if (match?.[1]) value = match[1].toLowerCase() === 'true' || match[1].toLowerCase() === 'yes';
    }
    if (value !== null) result[key] = value;
    else if (field.required) return null;
  }
  return Object.keys(result).length > 0 ? result : null;
}
function validateSchema(data: unknown, schema: ExtractionSchema): data is ExtractedData {
  if (!isExtractedData(data)) return false;
  for (const [key, field] of Object.entries(schema)) {
    if (field.required && !(key in data)) return false;
    if (key in data && (field.type === 'number' || field.type === 'string' || field.type === 'boolean') && typeof data[key] !== field.type) return false;
  }
  return true;
}
