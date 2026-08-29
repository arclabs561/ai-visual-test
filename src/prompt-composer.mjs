/**
 * Unified Prompt Composition System
 * 
 * Research-backed prompt composition that systematically combines:
 * - Rubrics (10-20% reliability improvement, arXiv:2412.05579)
 * - Temporal context (coherence checking)
 * - Persona perspectives (consistent formatting)
 * - Comparison instructions (structured format for pair comparison)
 * - Context information (testType, viewport, gameState)
 * 
 * This replaces ad-hoc prompt building across modules.
 */

import { buildRubricPrompt, DEFAULT_RUBRIC } from './rubrics.mjs';
import { formatNotesForPrompt, aggregateTemporalNotes } from '#temporal-core';
import { formatTemporalContext } from './temporal-prompt-formatting.mjs';
import { selectTopWeightedNotes } from './temporal-prompt-formatting.mjs';
import { warn } from './logger.mjs';

// Lazy import for variable goals
let generateGamePrompt = null;
async function getGenerateGamePrompt() {
  if (!generateGamePrompt) {
    try {
      const module = await import('./game-goal-prompts.mjs');
      generateGamePrompt = module.generateGamePrompt;
    } catch (error) {
      return null;
    }
  }
  return generateGamePrompt;
}

/**
 * Compose a complete evaluation prompt with all relevant components
 * 
 * @param {string} basePrompt - Base evaluation prompt
 * @param {{
 *   rubric?: import('./index.mjs').Rubric;
 *   includeRubric?: boolean;
 *   anchors?: import('./index.mjs').VisualAnchors | null;
 *   temporalNotes?: import('./index.mjs').AggregatedTemporalNotes | null;
 *   persona?: import('./index.mjs').Persona | null;
 *   renderedCode?: import('./index.mjs').RenderedCode | null;
 *   gameState?: Record<string, unknown>;
 *   isMultiImage?: boolean;
 *   isComparison?: boolean;
 *   context?: import('./index.mjs').ValidationContext;
 * }} [options={}] - Composition options
 * @returns {string} Composed prompt
 */
export async function composePrompt(basePrompt, options = {}) {
  const {
    rubric = DEFAULT_RUBRIC,
    includeRubric = true, // Default true (research: 10-20% improvement)
    anchors = null,
    temporalNotes = null,
    persona = null,
    renderedCode = null,
    gameState = null,
    isMultiImage = false,
    isComparison = false,
    context = {},
    goal = null // Support variable goals for cohesive integration
  } = options;
  
  const parts = [];

  // 1. Rubric (research: explicit rubrics improve reliability by 10-20%)
  if (includeRubric) {
    parts.push(buildRubricPrompt(rubric, true));
  }

  // 1.5. Visual anchors (domain-level grounding cues for the VLM)
  const mergedAnchors = mergeAnchors(context.anchors, anchors);
  if (mergedAnchors) {
    parts.push('\n\n' + buildAnchorsSection(mergedAnchors, context._anchorImageCount || null));
  }

  // 2. Base prompt (or generate from goal if provided)
  let finalBasePrompt = basePrompt;
  if (goal) {
    try {
      const generateGamePromptFn = await getGenerateGamePrompt();
      if (generateGamePromptFn) {
        finalBasePrompt = generateGamePromptFn(goal, {
          gameState: gameState || context.gameState || {},
          previousState: context.previousState || null,
          renderedCode: renderedCode || context.renderedCode || null,
          persona: persona || (context.persona ? {
            name: context.persona,
            perspective: context.perspective,
            focus: context.focus || []
          } : null),
          stage: context.stage || context.testType || 'gameplay'
        });
      }
    } catch (error) {
      // Fallback to base prompt if goal generation fails
      if (context.debug?.verbose) {
        warn(`[Prompt Composer] Goal prompt generation failed: ${error.message}`);
      }
    }
  }
  // Separate base prompt from preceding sections (rubric, anchors)
  if (parts.length > 0) {
    parts.push('\n\n' + finalBasePrompt);
  } else {
    parts.push(finalBasePrompt);
  }

  // 3. Temporal context (if available)
  if (temporalNotes) {
    // Check if temporalNotes is raw array or aggregated object
    // formatTemporalContext handles both single-scale and multi-scale aggregation
    let processedTemporalNotes = temporalNotes;
    if (Array.isArray(temporalNotes)) {
      // Raw notes array - prune and select top-weighted notes before aggregating
      // This implements note propagation: only keep relevant notes
      try {
        // Prune to top-weighted notes (implements note propagation)
        const prunedNotes = selectTopWeightedNotes(temporalNotes, {
          topN: context.maxTemporalNotes || 10 // Default: top 10 notes
        });
        
        // Aggregate pruned notes
        processedTemporalNotes = await aggregateTemporalNotes(prunedNotes);
      } catch (error) {
        // If pruning/aggregation fails, skip temporal context
        if (context.debug?.verbose) {
          warn(`[Prompt Composer] Failed to prune/aggregate temporal notes: ${error.message}`);
        }
        processedTemporalNotes = null;
      }
    }
    
    // Format temporal context (handles both single-scale and multi-scale)
    if (processedTemporalNotes) {
      const temporalContext = formatTemporalContext(processedTemporalNotes, {
        includeMultiScale: true,
        naturalLanguage: true // Use natural language for better VLM understanding
      });
      if (temporalContext) {
        parts.push('\n\n' + temporalContext);
      }
    }
  }
  
  // 4. Persona perspective (if provided)
  if (persona) {
    parts.push('\n\n' + buildPersonaContext(persona, renderedCode, gameState));
  }
  
  // 5. Multi-modal context (rendered code, game state)
  if (renderedCode || gameState) {
    parts.push('\n\n' + buildMultiModalContext(renderedCode, gameState));
  }
  
  // 6. Comparison instructions (if multi-image or comparison)
  if (isMultiImage || isComparison) {
    parts.push('\n\n' + buildComparisonInstructions(isComparison));
  }
  
  // 7. Context information (testType, viewport, etc.)
  const contextPart = buildContextSection(context);
  if (contextPart) {
    parts.push('\n\n' + contextPart);
  }
  
  return parts.join('');
}

/**
 * Build persona context section
 * 
 * @param {import('./index.mjs').Persona} persona - Persona configuration
 * @param {import('./index.mjs').RenderedCode | null} renderedCode - Rendered code (optional)
 * @param {Record<string, unknown> | null} gameState - Game state (optional)
 * @returns {string} Persona context section
 */
function buildPersonaContext(persona, renderedCode = null, gameState = null) {
  const parts = [];
  
  parts.push(`PERSONA PERSPECTIVE: ${persona.name}`);
  
  if (persona.perspective) {
    parts.push(persona.perspective);
  }
  
  if (persona.focus && Array.isArray(persona.focus)) {
    parts.push(`FOCUS AREAS: ${persona.focus.join(', ')}`);
  } else if (persona.goals && Array.isArray(persona.goals)) {
    parts.push(`GOALS: ${persona.goals.join(', ')}`);
  }
  
  if (persona.concerns && Array.isArray(persona.concerns)) {
    parts.push(`CONCERNS: ${persona.concerns.join(', ')}`);
  }
  
  parts.push('\nEvaluate from this persona\'s perspective.');
  
  return parts.join('\n');
}

/**
 * Build multi-modal context section
 * 
 * @param {import('./index.mjs').RenderedCode | null} renderedCode - Rendered code
 * @param {Record<string, unknown> | null} gameState - Game state
 * @returns {string} Multi-modal context section
 */
function buildMultiModalContext(renderedCode = null, gameState = null) {
  const parts = [];
  
  if (renderedCode) {
    parts.push('RENDERED CODE ANALYSIS:');
    if (renderedCode.domStructure) {
      parts.push(`DOM Structure: ${JSON.stringify(renderedCode.domStructure, null, 2)}`);
    }
    if (renderedCode.criticalCSS) {
      parts.push(`Critical CSS: ${JSON.stringify(renderedCode.criticalCSS, null, 2)}`);
    }
    if (renderedCode.html) {
      parts.push(`HTML (first 5000 chars): ${renderedCode.html.substring(0, 5000)}`);
    }
  }
  
  if (gameState && Object.keys(gameState).length > 0) {
    parts.push(`GAME STATE: ${JSON.stringify(gameState, null, 2)}`);
  }
  
  if (parts.length > 0) {
    parts.unshift('MULTI-MODAL CONTEXT:');
    parts.push('\nConsider:');
    parts.push('1. Visual appearance (from screenshot)');
    parts.push('2. Code correctness (from rendered code)');
    parts.push('3. State consistency (does visual match code and state?)');
    parts.push('4. Principles alignment (does it match design principles?)');
  }
  
  return parts.join('\n');
}

/**
 * Build comparison instructions
 * 
 * @param {boolean} isComparison - Whether this is a pair comparison
 * @returns {string} Comparison instructions
 */
function buildComparisonInstructions(isComparison) {
  if (!isComparison) {
    return '';
  }
  
  return `COMPARISON INSTRUCTIONS:
You are comparing two screenshots side-by-side. Return JSON with:
{
  "winner": "A" | "B" | "tie" | "indeterminate",
  "confidence": 0.0-1.0,
  "reasoning": "explanation",
  "differences": ["difference1", "difference2"],
  "scores": {"A": 0-10, "B": 0-10}
}

Image A is the first supplied image; Image B is the second supplied image.
Use "indeterminate" when the evidence is insufficient to choose or declare a tie.

Focus on:
- Which screenshot better meets the criteria?
- What are the key differences?
- Which has fewer issues?
- Which provides better user experience?

Be specific about what makes one better than the other.`;
}

/**
 * Build context section
 * 
 * @param {import('./index.mjs').ValidationContext} context - Validation context
 * @returns {string} Context section
 */
function buildContextSection(context) {
  const parts = [];
  
  if (context.testType) {
    parts.push(`Test Type: ${context.testType}`);
  }
  
  if (context.viewport) {
    parts.push(`Viewport: ${context.viewport.width}x${context.viewport.height}`);
  }
  
  if (context.gameState && !context.gameStateAlreadyIncluded) {
    parts.push(`Game State: ${JSON.stringify(context.gameState)}`);
  }
  
  if (parts.length === 0) {
    return '';
  }
  
  return 'CONTEXT:\n' + parts.join('\n');
}

/**
 * Compose prompt for single image evaluation
 * 
 * @param {string} basePrompt - Base prompt
 * @param {import('./index.mjs').ValidationContext} context - Validation context
 * @param {{
 *   includeRubric?: boolean;
 *   temporalNotes?: import('./index.mjs').AggregatedTemporalNotes | null;
 * }} [options={}] - Additional options
 * @returns {string} Composed prompt
 */
export async function composeSingleImagePrompt(basePrompt, context = {}, options = {}) {
  return await composePrompt(basePrompt, {
    includeRubric: options.includeRubric !== false,
    anchors: options.anchors || null,
    temporalNotes: options.temporalNotes || null,
    persona: context.persona ? {
      name: context.persona,
      perspective: context.perspective,
      focus: context.focus || []
    } : null,
    renderedCode: context.renderedCode || null,
    gameState: context.gameState || null,
    isMultiImage: false,
    isComparison: false,
    goal: context.goal || null, // Support variable goals
    context
  });
}

/**
 * Compose prompt for pair comparison
 * 
 * @param {string} basePrompt - Base comparison prompt
 * @param {import('./index.mjs').ValidationContext} context - Validation context
 * @param {{
 *   includeRubric?: boolean;
 * }} [options={}] - Additional options
 * @returns {string} Composed comparison prompt
 */
export async function composeComparisonPrompt(basePrompt, context = {}, options = {}) {
  return await composePrompt(basePrompt, {
    includeRubric: options.includeRubric !== false,
    anchors: options.anchors || null,
    temporalNotes: null, // Pair comparison doesn't use temporal notes
    persona: null, // Pair comparison is objective
    renderedCode: null, // Pair comparison is visual-only
    gameState: null,
    isMultiImage: true,
    isComparison: true,
    goal: context.goal || null, // Support variable goals (though less common for comparisons)
    context
  });
}

/**
 * Compose prompt for multi-modal validation
 * 
 * @param {string} basePrompt - Base prompt
 * @param {import('./index.mjs').ValidationContext} context - Validation context
 * @param {{
 *   includeRubric?: boolean;
 *   temporalNotes?: import('./index.mjs').AggregatedTemporalNotes | null;
 *   persona?: import('./index.mjs').Persona | null;
 * }} [options={}] - Additional options
 * @returns {string} Composed multi-modal prompt
 */
export async function composeMultiModalPrompt(basePrompt, context = {}, options = {}) {
  return await composePrompt(basePrompt, {
    includeRubric: options.includeRubric !== false,
    temporalNotes: options.temporalNotes || null,
    persona: options.persona || (context.persona ? {
      name: context.persona,
      perspective: context.perspective,
      focus: context.focus || []
    } : null),
    renderedCode: context.renderedCode || null,
    gameState: context.gameState || null,
    isMultiImage: false,
    isComparison: false,
    goal: context.goal || options.goal || null, // Support variable goals
    context: {
      ...context,
      gameStateAlreadyIncluded: true // Prevent duplicate gameState
    }
  });
}

/**
 * Merge anchors from context (config-level) and per-call options.
 * Per-call anchors append to config-level anchors (not replace).
 *
 * @param {import('./index.mjs').VisualAnchors | null | undefined} contextAnchors - From config/context
 * @param {import('./index.mjs').VisualAnchors | null | undefined} optionAnchors - Per-call overrides
 * @returns {import('./index.mjs').VisualAnchors | null} Merged anchors, or null if empty
 */
function mergeAnchors(contextAnchors, optionAnchors) {
  if (!contextAnchors && !optionAnchors) return null;

  const merged = {};

  // Domain: per-call overrides config-level (more specific wins)
  const domain = optionAnchors?.domain || contextAnchors?.domain;
  if (domain) merged.domain = domain;

  // Arrays: concatenate (config-level first, then per-call additions)
  const concat = (key) => [
    ...(contextAnchors?.[key] || []),
    ...(optionAnchors?.[key] || [])
  ];

  for (const key of ['positive', 'negative']) {
    const arr = concat(key);
    if (arr.length > 0) merged[key] = arr;
  }

  return Object.keys(merged).length > 0 ? merged : null;
}

/**
 * Extract the text description from an AnchorEntry.
 * @param {string | { text?: string, image?: string, label?: string, dimension?: string }} entry
 * @returns {string | null}
 */
function anchorText(entry) {
  if (typeof entry === 'string') return entry;
  return entry.text || entry.label || null;
}

/**
 * Extract the dimension from an AnchorEntry, if present.
 * @param {string | { dimension?: string }} entry
 * @returns {string | null}
 */
function anchorDimension(entry) {
  if (typeof entry === 'string') return null;
  return entry.dimension || null;
}

/**
 * Check if an AnchorEntry has an image reference.
 * @param {string | { image?: string }} entry
 * @returns {boolean}
 */
function anchorHasImage(entry) {
  return typeof entry === 'object' && !!entry.image;
}

/**
 * Build prompt section from visual anchors.
 *
 * Placed between the rubric and the base prompt so the VLM sees
 * domain calibration cues before the specific evaluation question.
 *
 * Anchors can be:
 *   - Plain strings (flat, no dimension scope)
 *   - Objects with { text, dimension? } (scoped to a rubric dimension)
 *   - Objects with { image, label?, dimension? } (reference screenshot)
 *
 * When image anchors are present, the prompt labels which attached images
 * are reference examples vs. the evaluation target.
 *
 * @param {import('./index.mjs').VisualAnchors} anchors - Merged text + image anchors
 * @param {{ positive: number, negative: number }} [imageCounts] - Number of attached reference images
 * @returns {string} Formatted anchors section
 */
function buildAnchorsSection(anchors, imageCounts) {
  const lines = ['VISUAL ANCHORS:'];

  if (anchors.domain) {
    lines.push(`Domain: ${anchors.domain}`);
  }

  // Image reference labels (if anchor images were attached)
  const posImgs = imageCounts?.positive || 0;
  const negImgs = imageCounts?.negative || 0;
  if (posImgs > 0 || negImgs > 0) {
    lines.push('');
    lines.push('Reference images are attached in order:');
    let idx = 1;
    if (posImgs > 0) {
      const range = posImgs === 1 ? `Image ${idx}` : `Images ${idx}-${idx + posImgs - 1}`;
      lines.push(`  ${range}: GOOD example${posImgs > 1 ? 's' : ''} (what quality looks like)`);
      idx += posImgs;
    }
    if (negImgs > 0) {
      const range = negImgs === 1 ? `Image ${idx}` : `Images ${idx}-${idx + negImgs - 1}`;
      lines.push(`  ${range}: BAD example${negImgs > 1 ? 's' : ''} (what to flag as problems)`);
      idx += negImgs;
    }
    lines.push(`  Image ${idx}+: Screenshot(s) to evaluate`);
    lines.push('IMPORTANT: Evaluate ONLY the final screenshot(s). Reference images are for style/quality calibration only -- do NOT report issues visible in the reference images.');
  }

  // Format anchor entries, grouping by dimension when scoped
  for (const [polarity, label] of [['positive', 'Look for (positive signals):'], ['negative', 'Flag (negative signals):']]) {
    const entries = anchors[polarity];
    if (!entries?.length) continue;

    // Separate into unscoped (flat) and dimension-scoped
    const flat = [];
    const byDimension = new Map();
    for (const entry of entries) {
      const text = anchorText(entry);
      if (!text) continue; // image-only entries don't add prompt text
      const dim = anchorDimension(entry);
      if (dim) {
        if (!byDimension.has(dim)) byDimension.set(dim, []);
        byDimension.get(dim).push(text);
      } else {
        flat.push(text);
      }
    }

    if (flat.length > 0 || byDimension.size > 0) {
      lines.push('');
      lines.push(label);
      for (const text of flat) {
        lines.push(`  - ${text}`);
      }
      for (const [dim, texts] of byDimension) {
        const dimLabel = dim.replace(/_/g, ' ');
        for (const text of texts) {
          lines.push(`  - [${dimLabel}] ${text}`);
        }
      }
    }
  }

  return lines.join('\n');
}
