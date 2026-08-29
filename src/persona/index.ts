/**
 * Persona Sub-Module
 *
 * Persona-based experience testing and evaluation.
 *
 * Import from 'ai-visual-test/persona'
 */

// Core persona experience
export {
  experiencePageAsPersona,
  experiencePageWithPersonas
} from '../persona-experience.js';
export type {
  PersonaExperienceOptions,
  PersonaExperienceResult,
  PersonaInput,
  PersonaNote,
  PersonaPage,
  PersonaScreenshot,
  PersonaExperienceTrace,
  Viewport,
} from '../persona-experience.js';

// Enhanced persona
export {
  createEnhancedPersona,
  experiencePageWithEnhancedPersona,
  calculatePersonaConsistency,
  calculatePersonaDiversity
} from '../persona-enhanced.js';
export type {
  EnhancedPersona,
  EnhancedPersonaContext,
  EnhancedPersonaExperience,
  PersonaConsistency,
  PersonaDiversity,
  PersonaObservation,
} from '../persona-enhanced.js';

// Experience propagation (used by game-convenience.ts and persona-experience.ts)
export {
  ExperiencePropagationTracker,
  getPropagationTracker,
  trackPropagation
} from '../experience-propagation.js';
export type {
  PropagationContext,
  PropagationEntry,
  PropagationLogLevel,
  PropagationSummary,
  PropagationTrackerOptions,
} from '../experience-propagation.js';
