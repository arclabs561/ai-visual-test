import { experiencePageAsPersona, type PersonaExperienceResult, type PersonaInput, type PersonaPage, type PersonaExperienceOptions } from './persona-experience.js';

export interface EnhancedPersona extends PersonaInput {
  workflows: Record<string, unknown>;
  frustrations: string[];
  usagePatterns: Record<string, unknown>;
  temporalEvolution: Record<string, unknown>;
}
export interface EnhancedPersonaContext { workflows?: Record<string, unknown>; frustrations?: string[]; usagePatterns?: Record<string, unknown>; temporalEvolution?: Record<string, unknown>; }
export interface PersonaObservation { observation?: string; [key: string]: unknown; }
export interface PersonaConsistency { promptToLine: number; lineToLine: number; overall: number; observationCount: number; }
export interface EnhancedPersonaExperience extends Omit<PersonaExperienceResult, 'persona' | 'consistency'> { persona: EnhancedPersona; consistency: PersonaConsistency; observations: string[]; }
export interface PersonaDiversity { diversityRatio: number; uniqueKeywords: number; totalKeywords: number; personaCount: number; }
const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can']);
function words(observation: string): string[] { return observation.toLowerCase().split(/\s+/).filter(word => word.length > 3 && !stopWords.has(word)); }
function observationText(observation: string | PersonaObservation): string { return typeof observation === 'string' ? observation : observation.observation ?? ''; }
export function createEnhancedPersona(basePersona: PersonaInput, context: EnhancedPersonaContext = {}): EnhancedPersona {
  return { ...basePersona, workflows: context.workflows ?? { primary: [], secondary: [], edgeCases: [] }, frustrations: context.frustrations ?? [], usagePatterns: context.usagePatterns ?? { frequency: 'unknown', duration: 'unknown', peakTimes: [] }, temporalEvolution: context.temporalEvolution ?? { firstUse: null, lastUse: null, usageTrend: 'stable' } };
}
export function calculatePersonaConsistency(observations: Array<string | PersonaObservation>): PersonaConsistency {
  if (observations.length < 2) return { promptToLine: 1, lineToLine: 1, overall: 1, observationCount: observations.length };
  const sets = observations.map(observation => new Set(words(observationText(observation))));
  const similarity = (left: Set<string>, right: Set<string>): number => { const union = new Set([...left, ...right]); return union.size === 0 ? 0 : [...left].filter(word => right.has(word)).length / union.size; };
  const first = sets[0]!;
  const promptToLine = sets.slice(1).reduce((sum, set) => sum + similarity(first, set), 0) / (sets.length - 1);
  const lineToLine = sets.slice(1).reduce((sum, set, index) => sum + similarity(sets[index]!, set), 0) / (sets.length - 1);
  return { promptToLine, lineToLine, overall: promptToLine * 0.4 + lineToLine * 0.6, observationCount: observations.length };
}
export async function experiencePageWithEnhancedPersona(page: PersonaPage, persona: EnhancedPersona, options: PersonaExperienceOptions = {}): Promise<EnhancedPersonaExperience> {
  const experience = await experiencePageAsPersona(page, persona, options);
  const observations = experience.notes.map(note => typeof note.observation === 'string' ? note.observation : '');
  return { ...experience, persona: { ...persona, workflows: persona.workflows, frustrations: persona.frustrations, usagePatterns: persona.usagePatterns }, consistency: calculatePersonaConsistency(observations), observations };
}
export function calculatePersonaDiversity(personaExperiences: Array<{ observations?: string[]; notes?: PersonaObservation[] }>): PersonaDiversity {
  if (personaExperiences.length < 2) return { diversityRatio: 0, uniqueKeywords: 0, totalKeywords: 0, personaCount: personaExperiences.length };
  const all = personaExperiences.flatMap(experience => (experience.observations ?? experience.notes?.map(note => note.observation ?? '') ?? []).flatMap(words));
  const uniqueKeywords = new Set(all);
  return { diversityRatio: uniqueKeywords.size / Math.max(1, all.length), uniqueKeywords: uniqueKeywords.size, totalKeywords: all.length, personaCount: personaExperiences.length };
}
