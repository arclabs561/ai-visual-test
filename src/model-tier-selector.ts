/** Selection policy for model quality tiers and providers. */
import { log, warn } from './logger.js';

export type ModelTier = 'fast' | 'balanced' | 'best';
export type ProviderName = 'gemini' | 'openai' | 'claude' | 'groq';
export type DecisionFrequency = 'high' | 'medium' | 'low' | 'ultra-high' | number;
export interface TemporalNote { timestamp: number; [key: string]: unknown; }
export interface ModelTierContext {
  frequency?: DecisionFrequency;
  criticality?: string;
  costSensitive?: boolean;
  qualityRequired?: boolean;
  testType?: string;
  temporalNotes?: TemporalNote[];
}
export interface ProviderEnvironment {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GROQ_API_KEY?: string;
  [key: string]: string | undefined;
}
export interface ProviderRequirements {
  speed?: 'ultra-fast' | 'fast' | 'normal' | 'slow';
  quality?: 'best' | 'good' | 'acceptable';
  costSensitive?: boolean;
  contextSize?: number;
  vision?: boolean;
  env?: ProviderEnvironment;
}
export interface ModelTierAndProviderContext extends ModelTierContext { requirements?: ProviderRequirements; }
export interface ModelTierAndProvider { tier: ModelTier; provider: ProviderName; reason: string; }

/** Select a quality tier from execution requirements. */
export function selectModelTier(context: ModelTierContext = {}): ModelTier {
  const { frequency, criticality, costSensitive, qualityRequired, testType, temporalNotes } = context;
  let detectedFrequency: DecisionFrequency | undefined = frequency;
  if (!detectedFrequency && temporalNotes && temporalNotes.length > 1) {
    const recentNotes = temporalNotes.slice(-10);
    const first = recentNotes[0];
    const last = recentNotes.at(-1);
    if (first && last) {
      const timeSpan = last.timestamp - first.timestamp;
      if (timeSpan > 0) {
        const notesPerSecond = recentNotes.length / (timeSpan / 1000);
        detectedFrequency = notesPerSecond > 10 ? 'high' : notesPerSecond > 1 ? 'medium' : 'low';
      }
    }
  }
  if (typeof detectedFrequency === 'number') detectedFrequency = detectedFrequency >= 10 ? 'high' : detectedFrequency >= 1 ? 'medium' : 'low';
  if (detectedFrequency === 'high' || detectedFrequency === 'ultra-high') {
    log('[ModelTierSelector] High-frequency detected, selecting fast tier'); return 'fast';
  }
  if (criticality === 'critical' || qualityRequired === true) {
    log('[ModelTierSelector] Critical evaluation detected, selecting best tier'); return 'best';
  }
  if (testType === 'expert-evaluation' || testType === 'medical' || testType === 'accessibility-critical') {
    log('[ModelTierSelector] Critical test type detected, selecting best tier'); return 'best';
  }
  if (costSensitive === true) {
    log('[ModelTierSelector] Cost-sensitive detected, selecting fast tier'); return 'fast';
  }
  log('[ModelTierSelector] Standard validation, selecting balanced tier (default)');
  return 'balanced';
}

/** Select an available provider according to the existing priority policy. */
export function selectProvider(requirements: ProviderRequirements = {}): ProviderName {
  const { speed = 'normal', quality = 'good', costSensitive = false, contextSize = 0, vision = true, env = {} } = requirements;
  if (speed === 'ultra-fast' && !vision && env.GROQ_API_KEY) { log('[ModelTierSelector] Ultra-fast text-only, selecting Groq'); return 'groq'; }
  if (contextSize > 200000 && env.GEMINI_API_KEY) { log('[ModelTierSelector] Large context detected, selecting Gemini'); return 'gemini'; }
  if (quality === 'best') {
    if (env.GEMINI_API_KEY) { log('[ModelTierSelector] Best quality required, selecting Gemini'); return 'gemini'; }
    if (env.OPENAI_API_KEY) { log('[ModelTierSelector] Best quality required, selecting OpenAI'); return 'openai'; }
  }
  if (speed === 'fast' && quality === 'good' && env.GEMINI_API_KEY) { log('[ModelTierSelector] Fast + good quality, selecting Gemini'); return 'gemini'; }
  if (costSensitive) {
    if (env.GEMINI_API_KEY) { log('[ModelTierSelector] Cost-sensitive, selecting Gemini'); return 'gemini'; }
    if (env.GROQ_API_KEY && !vision) { log('[ModelTierSelector] Cost-sensitive text-only, selecting Groq'); return 'groq'; }
  }
  if (vision && env.GROQ_API_KEY) { log('[ModelTierSelector] Default, selecting Groq (vision supported)'); return 'groq'; }
  if (env.GEMINI_API_KEY) { log('[ModelTierSelector] Default, selecting Gemini'); return 'gemini'; }
  if (env.OPENAI_API_KEY) { log('[ModelTierSelector] Default, selecting OpenAI'); return 'openai'; }
  if (env.ANTHROPIC_API_KEY) { log('[ModelTierSelector] Default, selecting Claude'); return 'claude'; }
  warn('[ModelTierSelector] No API keys found, defaulting to gemini');
  return 'gemini';
}

/** Select a tier and provider together, using supplied provider credentials when present. */
export function selectModelTierAndProvider(context: ModelTierAndProviderContext = {}): ModelTierAndProvider {
  const { requirements = {}, ...tierContext } = context;
  const tier = selectModelTier(tierContext);
  const provider = selectProvider({ ...requirements, env: requirements.env ?? process.env });
  return { tier, provider, reason: `Selected ${provider} ${tier} tier based on context` };
}
