/** Provider-neutral perception sampling, aggregation, and verification. */
import { aggregate, matchesDisposition, mergeFindings } from './aggregate.js';
import type { AggregateFinding, Disposition, TextCompletion } from './aggregate.js';
import {
  VERIFIER_VERDICT_SCHEMA,
  PERCEPTION_DIAGNOSTIC_CODES,
  PerceptionContractError,
  buildPerceptionRepairInstruction,
  parsePerceptionFinding,
  parseVerifierVerdict,
  schemaForPerceptionMode,
} from './contracts.js';
import type {
  PerceptionDiagnosticCode,
  PerceptionFinding,
  PerceptionMode,
  PerceptionStructuredOutput,
} from './contracts.js';
import { MODE_SPEC, UX_HEURISTICS, VERIFY_SYS, verifyUser } from './prompts.js';

export type VisionCompletion = (
  system: string,
  user: string,
  temperature: number,
  structuredOutput?: PerceptionStructuredOutput,
) => Promise<unknown>;

export interface PanelJudge {
  id: string;
  vision: VisionCompletion;
  weight?: number;
}

export interface PerceptionPersona {
  id: string;
  who: string;
  weight?: number;
}

export interface PerceptionContext {
  id: string;
  ctx: string;
}

export interface PerceptionFailure {
  phase: 'sampling' | 'merge' | 'verification';
  message: string;
  diagnostic?: PerceptionDiagnosticCode;
  diagnostics?: readonly PerceptionDiagnosticCode[];
  judge?: string;
  mode?: PerceptionMode;
  role?: string;
  context?: string;
  target?: string;
  attempts?: number;
}

export interface PerceptionPhaseDiagnostics {
  attempted: number;
  completed: number;
  failed: number;
}

export interface PerceptionSamplingDiagnostics extends PerceptionPhaseDiagnostics {
  accepted: number;
}

export interface PerceptionDiagnostics {
  status: 'ok' | 'partial' | 'unavailable';
  sampling: PerceptionSamplingDiagnostics;
  merge: PerceptionPhaseDiagnostics;
  verification: PerceptionPhaseDiagnostics;
  failures: PerceptionFailure[];
}

export type PerceptionSample = PerceptionFinding & {
  mode: PerceptionMode;
  role: string;
  weight: number;
  context: string;
  judge: string;
};

export interface RankedPerceptionFinding extends AggregateFinding {
  verified?: boolean | null;
  verifiedBy?: string;
  vreason?: string;
  disposition?: string;
  dispositionReason?: string;
}

export interface PerceptionSection {
  mode: PerceptionMode;
  ranked: RankedPerceptionFinding[];
  top: RankedPerceptionFinding[];
  suppressed: RankedPerceptionFinding[];
}

export interface SamplePerceptionsResult {
  samples: PerceptionSample[];
  sections: PerceptionSection[];
  judges: string[];
  diagnostics: PerceptionDiagnostics;
}

export interface SamplePerceptionsOptions {
  panel?: readonly PanelJudge[];
  vision?: VisionCompletion;
  complete?: TextCompletion;
  modes?: readonly PerceptionMode[];
  personas: readonly PerceptionPersona[];
  contexts: readonly PerceptionContext[];
  n?: number;
  concurrency?: number;
  topK?: number;
  verify?: boolean;
  principles?: readonly string[];
  dispositions?: readonly Disposition[];
  heuristics?: readonly string[];
  guidance?: Partial<Record<PerceptionMode, string>>;
  /** Contract-only retries after malformed model output. Transport errors never use this path. */
  contractRetries?: number;
}

interface SamplingCell {
  mode: PerceptionMode;
  persona: PerceptionPersona;
  context: PerceptionContext;
  judge: PanelJudge;
}

type SamplingOutcome = { sample: PerceptionSample } | { failure: PerceptionFailure };
type VerificationOutcome = { verdict: ReturnType<typeof parseVerifierVerdict> } | { failure: PerceptionFailure };

async function pmap<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>, concurrency: number): Promise<R[]> {
  const output = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      output[index] = await fn(items[index]!, index);
    }
  }));
  return output;
}

function errorMessage(error: unknown): string {
  return String(error instanceof Error ? error.message : error ?? 'Unknown provider error').slice(0, 500);
}

function requireInteger(name: string, value: number, minimum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`samplePerceptions: ${name} must be an integer >= ${minimum}`);
  }
}

function requireWeight(name: string, value: number | undefined): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new RangeError(`samplePerceptions: ${name} must be finite and nonnegative`);
  }
}

function requireUniqueIds(name: string, values: readonly { id: string }[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value.id !== 'string' || value.id.trim() === '') throw new TypeError(`samplePerceptions: ${name} id required`);
    if (seen.has(value.id)) throw new TypeError(`samplePerceptions: duplicate ${name} id '${value.id}'`);
    seen.add(value.id);
  }
}

function contractFailure(
  phase: 'sampling' | 'verification',
  error: unknown,
  context: Omit<PerceptionFailure, 'phase' | 'message' | 'diagnostic' | 'diagnostics'>,
): PerceptionFailure {
  if (error instanceof PerceptionContractError) {
    const diagnostic = phase === 'sampling'
      ? PERCEPTION_DIAGNOSTIC_CODES.invalidFinding
      : PERCEPTION_DIAGNOSTIC_CODES.invalidVerifierVerdict;
    const diagnostics = error.diagnostics.includes(diagnostic)
      ? error.diagnostics
      : [diagnostic, ...error.diagnostics];
    return { phase, ...context, message: errorMessage(error), diagnostic, diagnostics };
  }
  return { phase, ...context, message: errorMessage(error) };
}

async function parseWithRepair<T>({
  call,
  parse,
  system,
  user,
  temperature,
  task,
  contractRetries,
}: {
  call: VisionCompletion;
  parse: (input: unknown) => T;
  system: string;
  user: string;
  temperature: number;
  task: PerceptionStructuredOutput;
  contractRetries: number;
}): Promise<{ value: T; attempts: number } | { error: unknown; attempts: number }> {
  let prompt = user;
  for (let attempt = 0; attempt <= contractRetries; attempt++) {
    try {
      return { value: parse(await call(system, prompt, temperature, task)), attempts: attempt + 1 };
    } catch (error) {
      if (!(error instanceof PerceptionContractError) || attempt >= contractRetries) {
        return { error, attempts: attempt + 1 };
      }
      prompt = user + buildPerceptionRepairInstruction(task.name, error.diagnostics);
    }
  }
  return { error: new Error('Unreachable perception repair state'), attempts: contractRetries + 1 };
}

function dispositionText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Sample one screenshot across modes, personas, contexts, and judges; aggregate
 * valid findings and optionally run a cross-model refutation pass.
 */
export async function samplePerceptions({
  panel,
  vision,
  complete,
  modes = ['question', 'problem', 'insight'],
  personas,
  contexts,
  n = 2,
  concurrency = 10,
  topK = 6,
  verify = true,
  principles = [],
  dispositions = [],
  heuristics = UX_HEURISTICS,
  guidance = {},
  contractRetries = 1,
}: SamplePerceptionsOptions): Promise<SamplePerceptionsResult> {
  requireInteger('n', n, 1);
  requireInteger('concurrency', concurrency, 1);
  requireInteger('topK', topK, 0);
  requireInteger('contractRetries', contractRetries, 0);
  if (contractRetries > 2) throw new RangeError('samplePerceptions: contractRetries must be <= 2');

  const jury: PanelJudge[] = panel?.length
    ? [...panel]
    : typeof vision === 'function' ? [{ id: 'default', vision, weight: 1 }] : [];
  if (jury.length === 0) throw new TypeError('samplePerceptions: panel or vision fn required');
  if (!personas?.length || !contexts?.length) throw new TypeError('samplePerceptions: personas and contexts required');
  requireUniqueIds('judge', jury);
  requireUniqueIds('persona', personas);
  requireUniqueIds('context', contexts);
  for (const judge of jury) {
    if (typeof judge.vision !== 'function') throw new TypeError(`samplePerceptions: judge '${judge.id}' missing vision fn`);
    requireWeight(`judge '${judge.id}' weight`, judge.weight);
  }
  for (const persona of personas) {
    if (typeof persona.who !== 'string' || persona.who.trim() === '') throw new TypeError(`samplePerceptions: persona '${persona.id}' who required`);
    requireWeight(`persona '${persona.id}' weight`, persona.weight);
  }
  for (const context of contexts) {
    if (typeof context.ctx !== 'string' || context.ctx.trim() === '') throw new TypeError(`samplePerceptions: context '${context.id}' ctx required`);
  }
  for (const mode of modes) if (!(mode in MODE_SPEC)) throw new TypeError(`samplePerceptions: unknown mode '${String(mode)}'`);

  const seed = principles.length
    ? '\n\nDESIGN PRINCIPLES IN FORCE -- these are intended and correct; do NOT report them as problems, gaps, conflicts, or noise:\n- ' + principles.join('\n- ')
    : '';
  const heuristicSeed = heuristics.length
    ? '\n\nGENERAL UI/UX HEURISTICS (apply unless a design principle above marks the choice intended):\n- ' + heuristics.join('\n- ')
    : '';

  const cells: SamplingCell[] = [];
  for (const mode of modes) for (const persona of personas) for (const context of contexts) for (const judge of jury) {
    for (let sample = 0; sample < n; sample++) cells.push({ mode, persona, context, judge });
  }

  const sampled = await pmap(cells, async ({ mode, persona, context, judge }): Promise<SamplingOutcome> => {
    const spec = MODE_SPEC[mode];
    const modeGuidance = guidance[mode];
    const user = spec.user(persona, context) + (modeGuidance
      ? '\n\nSURFACE-SPECIFIC GUIDANCE (what this display wants its judges to weigh):\n' + modeGuidance
      : '');
    const parsed = await parseWithRepair({
      call: judge.vision,
      parse: (input) => parsePerceptionFinding(mode, input),
      system: spec.sys + heuristicSeed + seed,
      user,
      temperature: 1.05,
      task: { name: `perception_${mode}`, schema: schemaForPerceptionMode(mode), strict: true },
      contractRetries,
    });
    if ('value' in parsed) {
      const finding = parsed.value;
      return {
        sample: {
          ...finding,
          mode,
          role: persona.id,
          weight: (persona.weight ?? 1) * (judge.weight ?? 1),
          context: context.id,
          judge: judge.id,
        },
      };
    }
    return {
      failure: contractFailure('sampling', parsed.error, {
        judge: judge.id,
        mode,
        role: persona.id,
        context: context.id,
        ...(parsed.attempts > 1 ? { attempts: parsed.attempts } : {}),
      }),
    };
  }, concurrency);

  const samples = sampled.flatMap((outcome) => 'sample' in outcome ? [outcome.sample] : []);
  const failures = sampled.flatMap((outcome) => 'failure' in outcome ? [outcome.failure] : []);
  const sampling: PerceptionSamplingDiagnostics = {
    attempted: cells.length,
    completed: samples.length,
    accepted: samples.length,
    failed: failures.length,
  };
  const merge: PerceptionPhaseDiagnostics = { attempted: 0, completed: 0, failed: 0 };
  const verification: PerceptionPhaseDiagnostics = { attempted: 0, completed: 0, failed: 0 };
  const sections: PerceptionSection[] = [];

  for (const mode of modes) {
    let ranked: RankedPerceptionFinding[] = aggregate(samples, mode);
    if (complete && ranked.length >= 2) {
      merge.attempted++;
      let mergeFailed = false;
      ranked = await mergeFindings(ranked, {
        contractRetries,
        complete: async (...args) => {
          try {
            return await complete(...args);
          } catch (error) {
            mergeFailed = true;
            merge.failed++;
            failures.push({ phase: 'merge', mode, message: errorMessage(error) });
            throw error;
          }
        },
        onContractError: (error) => {
          mergeFailed = true;
          merge.failed++;
          failures.push({
            phase: 'merge',
            mode,
            message: errorMessage(error),
            diagnostic: PERCEPTION_DIAGNOSTIC_CODES.invalidMergeClusters,
            diagnostics: error.diagnostics.includes(PERCEPTION_DIAGNOSTIC_CODES.invalidMergeClusters)
              ? error.diagnostics
              : [PERCEPTION_DIAGNOSTIC_CODES.invalidMergeClusters, ...error.diagnostics],
            attempts: contractRetries + 1,
          });
        },
      });
      if (!mergeFailed) merge.completed++;
    }

    const candidates = ranked.slice(0, Math.min(topK, ranked.length));
    if (verify && candidates.length > 0) {
      verification.attempted += candidates.length;
      const verdicts = await pmap(candidates, async (finding): Promise<VerificationOutcome> => {
        const verifier = jury.find((judge) => !finding.judges.has(judge.id)) ?? jury[0]!;
        finding.verifiedBy = verifier.id;
        const user = verifyUser(mode, {
              category: finding.category as PerceptionFinding['category'],
              target: finding.target,
              why: finding.heads[0] ?? '',
              suggestion: finding.sugg[0] ?? '',
            });
        const parsed = await parseWithRepair({
          call: verifier.vision,
          parse: parseVerifierVerdict,
          system: VERIFY_SYS + seed,
          user,
          temperature: 0.1,
          task: { name: 'perception_verifier', schema: VERIFIER_VERDICT_SCHEMA, strict: true },
          contractRetries,
        });
        if ('value' in parsed) return { verdict: parsed.value };
        return {
          failure: contractFailure('verification', parsed.error, {
            judge: verifier.id,
            mode,
            target: finding.target,
            ...(parsed.attempts > 1 ? { attempts: parsed.attempts } : {}),
          }),
        };
      }, Math.min(4, concurrency));

      candidates.forEach((finding, index) => {
        const outcome = verdicts[index]!;
        if ('failure' in outcome) {
          verification.failed++;
          failures.push(outcome.failure);
          finding.verified = null;
          finding.vreason = outcome.failure.message;
        } else {
          verification.completed++;
          finding.verified = !outcome.verdict.refuted;
          finding.vreason = outcome.verdict.reason;
        }
      });
    }

    const top: RankedPerceptionFinding[] = [];
    const suppressed: RankedPerceptionFinding[] = [];
    for (const finding of candidates) {
      const disposition = matchesDisposition(finding, dispositions);
      if (disposition) {
        finding.disposition = dispositionText(disposition.disposition);
        finding.dispositionReason = dispositionText(disposition.reason ?? disposition.adr);
        suppressed.push(finding);
      } else {
        top.push(finding);
      }
    }
    sections.push({ mode, ranked, top, suppressed });
  }

  const status: PerceptionDiagnostics['status'] = sampling.failed === sampling.attempted
    ? 'unavailable'
    : failures.length > 0 ? 'partial' : 'ok';
  return { samples, sections, judges: jury.map((judge) => judge.id), diagnostics: { status, sampling, merge, verification, failures } };
}
