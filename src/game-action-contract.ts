import Type, { type Static } from 'typebox';
import * as Value from 'typebox/value';
import {
  StructuredTaskContractError,
  type StructuredTaskDefinition,
  type StructuredTaskParseResult,
} from '#structured-task';

const KeyboardActionSchema = Type.Object({
  type: Type.Literal('keyboard'),
  key: Type.Union([
    Type.Literal('ArrowLeft'),
    Type.Literal('ArrowRight'),
    Type.Literal('ArrowUp'),
    Type.Literal('ArrowDown'),
    Type.Literal('Space'),
    Type.Literal('Enter'),
  ]),
}, { additionalProperties: false });

const ClickActionSchema = Type.Object({
  type: Type.Literal('click'),
  selector: Type.String({ minLength: 1, maxLength: 512, pattern: '^[^\\u0000-\\u001F\\u007F]*$' }),
}, { additionalProperties: false });

const WaitActionSchema = Type.Object({
  type: Type.Literal('wait'),
  duration: Type.Integer({ minimum: 1, maximum: 10_000 }),
}, { additionalProperties: false });

/** Canonical, provider-enforceable game action schema. */
export const GAME_ACTION_SCHEMA = Type.Union([
  KeyboardActionSchema,
  ClickActionSchema,
  WaitActionSchema,
]);

export type GameAction = Static<typeof GAME_ACTION_SCHEMA>;

export class GameActionContractError extends StructuredTaskContractError {
  constructor(diagnostics: string[]) {
    super(`Provider output did not satisfy the game action contract: ${diagnostics.join(', ')}`, diagnostics);
    this.name = 'GameActionContractError';
  }
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function diagnosticFor(value: unknown): string {
  const record = recordFrom(value);
  if (record === null) return 'invalid_json';
  switch (record.type) {
    case 'keyboard': return 'invalid_key';
    case 'click': return 'invalid_selector';
    case 'wait': return 'invalid_duration';
    default: return 'invalid_action_type';
  }
}

function validateGameAction(value: unknown): GameAction {
  if (!Value.Check(GAME_ACTION_SCHEMA, value)) {
    throw new GameActionContractError([diagnosticFor(value)]);
  }
  return value as GameAction;
}

function parseEmbeddedObject(text: string): unknown | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1]!.trim() : trimmed;
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    // Older models sometimes place precisely one action object inside prose.
    // The contract is flat, so a balanced-object scan is sufficient while
    // rejecting a second top-level object as ambiguous.
    let start = -1;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    let end = -1;
    for (let index = 0; index < candidate.length; index++) {
      const character = candidate[index]!;
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
        continue;
      }
      if (character === '"') {
        quoted = true;
      } else if (character === '{') {
        if (depth === 0) {
          if (start !== -1) return null;
          start = index;
        }
        depth++;
      } else if (character === '}' && depth > 0) {
        depth--;
        if (depth === 0) {
          end = index;
          if (candidate.slice(index + 1).includes('{')) return null;
          break;
        }
      }
    }
    if (start === -1 || end === -1 || depth !== 0) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as unknown;
    } catch {
      return null;
    }
  }
}

/**
 * Decode the narrowly supported legacy form: a fenced JSON object or exactly
 * one JSON object embedded in at most 2048 characters of model prose.
 */
export function parseLegacyGameAction(input: string): GameAction {
  if (input.length > 2048) throw new GameActionContractError(['invalid_json']);
  const parsed = parseEmbeddedObject(input);
  if (parsed === null) throw new GameActionContractError(['invalid_json']);
  return validateGameAction(parsed);
}

export function parseGameActionOutcome(
  input: unknown,
  { allowLegacy = true }: { allowLegacy?: boolean } = {},
): StructuredTaskParseResult<GameAction> {
  if (typeof input === 'string') {
    try {
      const outcome = validateGameAction(JSON.parse(input) as unknown);
      return { outcome, format: 'structured', diagnostics: [] };
    } catch (error) {
      if (error instanceof GameActionContractError) throw error;
      if (!allowLegacy) throw new GameActionContractError(['invalid_json']);
      const outcome = parseLegacyGameAction(input);
      return { outcome, format: 'legacy-json', diagnostics: ['structured_output_invalid'] };
    }
  }
  return { outcome: validateGameAction(input), format: 'structured', diagnostics: [] };
}

export function buildGameActionRepairInstruction(diagnostics: string[]): string {
  const unique = [...new Set(diagnostics)].slice(0, 8);
  return [
    'Your previous response could not be validated.',
    `Diagnostic codes: ${unique.join(', ') || 'invalid_json'}.`,
    'Return only one JSON object matching the game action schema. Do not include markdown or prose.',
  ].join('\n');
}

export function createGameActionTask(allowLegacy = true): StructuredTaskDefinition<GameAction> {
  return {
    name: 'game_action',
    schema: GAME_ACTION_SCHEMA,
    invalidOutputDescription: 'game action',
    parse(input): StructuredTaskParseResult<GameAction> {
      return parseGameActionOutcome(input, { allowLegacy });
    },
    buildRepairInstruction: buildGameActionRepairInstruction,
  };
}
