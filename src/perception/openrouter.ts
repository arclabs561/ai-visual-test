/**
 * OpenRouter provider glue: build the vision / text `complete` fns and a jury
 * panel from model ids. Provider-specific; the rest of the module is
 * provider-agnostic and takes these as injected fns.
 */
import type { PanelJudge } from './sample.js';
import { PERCEPTION_DIAGNOSTIC_CODES, PerceptionContractError } from './contracts.js';


export interface OpenRouterVisionOptions {
  apiKey: string;
  imageBase64: string;
  model?: string;
  referer?: string;
  title?: string;
  maxTokens?: number;
}

export interface OpenRouterTextOptions {
  apiKey: string;
  model?: string;
  referer?: string;
  title?: string;
}

/**
 * An optional, provider-neutral structured-output request. The caller owns the
 * schema and task vocabulary; this transport only renders the OpenRouter wire
 * format. Keeping this small also lets existing three-argument completions
 * continue to work unchanged.
 */
export interface OpenRouterStructuredTask {
  name: string;
  schema: object;
  strict?: boolean;
}

export type OpenRouterVisionCompletion = (
  sys: string,
  user: string,
  temperature: number,
  task?: OpenRouterStructuredTask,
) => Promise<unknown>;
export type OpenRouterTextCompletion = (
  sys: string,
  user: string,
  temperature?: number,
  task?: OpenRouterStructuredTask,
) => Promise<unknown>;

export type OpenRouterPanelModel = string | { id: string; weight?: number };

export interface OpenRouterPanelOptions {
  apiKey: string;
  imageBase64: string;
  models: readonly OpenRouterPanelModel[];
  referer?: string;
  title?: string;
}

/** A concrete panel entry that is directly usable as a sampler PanelJudge. */
export interface OpenRouterPanelMember extends PanelJudge {
  weight: number;
  vision: OpenRouterVisionCompletion;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requireModelId(id: unknown): string {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new TypeError('makePanel: every model requires a nonempty string id');
  }
  return id;
}

function requireWeight(weight: unknown): number {
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
    throw new RangeError('makePanel: model weight must be finite and nonnegative');
  }
  return weight;
}

function responseFormat(task: OpenRouterStructuredTask | undefined): Record<string, unknown> {
  if (task === undefined) return { type: 'json_object' };
  if (typeof task.name !== 'string' || task.name.trim() === '') {
    throw new TypeError('OpenRouter structured task requires a nonempty name');
  }
  if (task.schema === null || typeof task.schema !== 'object' || Array.isArray(task.schema)) {
    throw new TypeError('OpenRouter structured task requires an object schema');
  }
  return {
    type: 'json_schema',
    json_schema: {
      name: task.name,
      schema: task.schema,
      ...(task.strict === undefined ? {} : { strict: task.strict }),
    },
  };
}

/** Strip code fences and parse a single JSON value from an LLM response. */
export function parseJsonObject(text: unknown): unknown {
  const clean = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(clean) as unknown;
}

/**
 * Extract only the model-content path this legacy adapter consumes. Network
 * response JSON is untrusted until this boundary has inspected each level.
 */
function contentFromResponse(value: unknown): string {
  const body = record(value);
  const choices = body !== null && Array.isArray(body.choices) ? body.choices : [];
  const firstChoice = record(choices[0]);
  const message = firstChoice === null ? null : record(firstChoice.message);
  return typeof message?.content === 'string' ? message.content : '';
}

function parseProviderContent(content: string, task: OpenRouterStructuredTask | undefined): unknown {
  try {
    return parseJsonObject(content);
  } catch (error) {
    if (task !== undefined && error instanceof SyntaxError) {
      throw new PerceptionContractError('Provider output', [PERCEPTION_DIAGNOSTIC_CODES.invalidJson]);
    }
    throw error;
  }
}

/** Build a vision(sys, user, temperature) -> unknown fn backed by OpenRouter. */
export function makeOpenRouterVision({
  apiKey,
  model = 'google/gemini-3.5-flash',
  imageBase64,
  referer = 'https://ai-visual-test',
  title = 'perception-eval',
  maxTokens = 8000,
}: OpenRouterVisionOptions): OpenRouterVisionCompletion {
  if (!apiKey) throw new Error('makeOpenRouterVision: apiKey required');
  if (!imageBase64) throw new Error('makeOpenRouterVision: imageBase64 required');
  return async (sys, user, temperature, task) => {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': referer, 'X-Title': title },
      body: JSON.stringify({
        // Generous output cap so a judge never truncates: reasoning-model judges
        // (qwen-thinking, opus, gpt-5.x) spend reasoning tokens against this, and a
        // run where "a lot is wrong" needs room to articulate the finding + fix.
        model, temperature, max_tokens: maxTokens, response_format: responseFormat(task),
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: [
            { type: 'text', text: user },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
          ] },
        ],
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const body: unknown = await res.json();
    return parseProviderContent(contentFromResponse(body), task);
  };
}

/** Build a text-only complete(sys, user, temperature) -> unknown fn backed by
 * OpenRouter (no image -- used by mergeFindings, which reasons over finding text,
 * not the screenshot, so it can run on a cheap text model). */
export function makeOpenRouterText({
  apiKey,
  model = 'google/gemini-3.5-flash',
  referer = 'https://ai-visual-test',
  title = 'perception-merge',
}: OpenRouterTextOptions): OpenRouterTextCompletion {
  if (!apiKey) throw new Error('makeOpenRouterText: apiKey required');
  return async (sys, user, temperature = 0.1, task) => {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': referer, 'X-Title': title },
      body: JSON.stringify({
        model, temperature, response_format: responseFormat(task),
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const body: unknown = await res.json();
    return parseProviderContent(contentFromResponse(body), task);
  };
}

/**
 * Build a jury panel from a list of OpenRouter model ids: returns
 * [{ id, vision, weight }] ready for samplePerceptions({ panel }). Picking
 * models from DIFFERENT labs (e.g. a Google, an Anthropic, an OpenAI, a Qwen)
 * is the load-bearing choice -- a panel only decorrelates bias if the judges
 * disagree on the right things, which same-lab models do not (Verga et al 2024).
 * `weight` per model (optional, default 1) is the reliability weight a gold-set
 * calibration would set ("LLM-as-a-jury", Qian et al 2026: judges are not equally
 * reliable, so do not equal-vote).
 */
export function makePanel({ apiKey, imageBase64, models, referer, title }: OpenRouterPanelOptions): OpenRouterPanelMember[] {
  if (!models?.length) throw new Error('makePanel: models required');
  return models.map((modelSpec) => {
    const id = requireModelId(typeof modelSpec === 'string' ? modelSpec : modelSpec.id);
    const weight = requireWeight(typeof modelSpec === 'string' ? 1 : (modelSpec.weight ?? 1));
    return {
      id,
      weight,
      vision: makeOpenRouterVision({
        apiKey,
        imageBase64,
        model: id,
        ...(referer === undefined ? {} : { referer }),
        ...(title === undefined ? {} : { title }),
      }),
    };
  });
}
