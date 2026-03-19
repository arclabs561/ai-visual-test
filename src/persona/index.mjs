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
} from '../persona-experience.mjs';

// Enhanced persona
export {
  createEnhancedPersona,
  experiencePageWithEnhancedPersona,
  calculatePersonaConsistency,
  calculatePersonaDiversity
} from '../persona-enhanced.mjs';

// Experience propagation (used by convenience.mjs and persona-experience.mjs)
export {
  ExperiencePropagationTracker,
  getPropagationTracker,
  trackPropagation
} from '../experience-propagation.mjs';

