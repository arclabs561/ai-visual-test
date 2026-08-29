/**
 * High-Level Convenience Functions
 *
 * Provides simplified APIs for common workflows, reducing boilerplate
 * and making the library easier to use for common patterns.
 *
 * Based on common visual testing workflows and usage patterns.
 */

import { validateScreenshot } from '#judge';
import { normalizeValidationResult } from '#validation-result-normalizer';
import { experiencePageAsPersona, experiencePageWithPersonas } from './persona-experience.mjs';
import { extractRenderedCode, captureTemporalScreenshots } from './multi-modal.js';
import { aggregateTemporalNotes } from '#temporal-core';
import { aggregateMultiScale } from '#temporal-multi-scale';
import { generateGamePrompt } from './game-goal-prompts.js';
import { checkCrossModalConsistency } from './cross-modal-consistency.mjs';
import { trackPropagation } from './experience-propagation.mjs';
import { ValidationError } from './errors.js';
import { log, warn } from './logger.mjs';
import { TEMPORAL_CONSTANTS } from './constants.mjs';
import type { playGame as playGameImplementation } from './game-player.js';
import type { AggregatedTemporalNotes, TemporalGraphResult, TemporalNote } from '#temporal-core';
import type { TemporalScreenshot } from '#temporal-capture';
import type { TemporalScreenshot as PromptScreenshot } from '#temporal-prompt-formatting';
import type { Persona } from '#public-contract';

export interface GameConveniencePage {
  content(): Promise<string>;
  locator(selector: string): GameConvenienceLocator;
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  waitForLoadState(state?: string): Promise<unknown>;
  waitForSelector(selector: string, options?: Record<string, unknown>): Promise<unknown>;
  waitForTimeout(timeout: number): Promise<void>;
  screenshot(options?: Record<string, unknown>): Promise<Uint8Array>;
  evaluate<T>(callback: (...args: never[]) => T | Promise<T>, arg?: unknown): Promise<T>;
  url(): string;
  viewportSize(): { width: number; height: number } | null;
  keyboard: { press(key: string): Promise<void> };
}

export interface GameConvenienceLocator {
  count(): Promise<number>;
  click(): Promise<void>;
  locator(selector: string): GameConvenienceLocator;
}

export type GameplayState = Record<string, unknown> & {
  gameActive?: boolean;
  score?: number;
  level?: number | string;
  lives?: number;
  bricks?: number | unknown[];
  ball?: boolean;
  paddle?: boolean;
};
export type GameplayPersona = { name?: string; perspective?: string; goals?: string[]; };
export type GoalObject = { description?: string; criteria?: string[]; focus?: string[]; questions?: string[]; [key: string]: unknown };
export type Goal = string | GoalObject | Array<string | GoalObject> | ((context: unknown) => string) | null;

export interface GameplayOptions {
  url?: string;
  goals?: Goal | Goal[];
  personas?: unknown[] | null;
  captureTemporal?: boolean;
  fps?: number;
  duration?: number;
  captureCode?: boolean;
  checkConsistency?: boolean;
  gameActivationKey?: string | null;
  gameSelector?: string | null;
  play?: boolean;
  maxSteps?: number;
}

export interface BrowserExperienceOptions {
  url?: string;
  personas?: unknown[] | null;
  stages?: string[];
  navigateBetweenStages?: ((page: GameConveniencePage, stage: string, nextStage: string) => Promise<void>) | null;
  captureCode?: boolean;
  captureTemporal?: boolean;
}

export interface GoalValidationOptions {
  goal?: Goal;
  gameState?: GameplayState | null;
  renderedCode?: unknown;
  persona?: GameplayPersona | null;
  context?: Record<string, unknown>;
}

interface ScreenshotReference { path: string; }
interface Experience {
  screenshots?: ScreenshotReference[];
  notes?: Array<Record<string, unknown>>;
  aggregated?: AggregatedTemporalNotes;
}
interface GoalEvaluation { goal: string; evaluation: unknown; prompt: string; }
interface AggregationFallback {
  windows: unknown[];
  coherence: number;
  summary: string;
  timeSpan: number;
}

function requirePersonas(personas: unknown[]): Persona[] {
  return personas.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') {
      throw new ValidationError(`personas[${index}] must be an object`);
    }
    const persona = candidate as Partial<Persona>;
    if (typeof persona.name !== 'string' || typeof persona.perspective !== 'string' || !Array.isArray(persona.focus)) {
      throw new ValidationError(`personas[${index}] must include name, perspective, and focus`);
    }
    return persona as Persona;
  });
}
export interface GameplayResult {
  url: string;
  goals: Goal[];
  experiences: Experience[];
  evaluations: GoalEvaluation[];
  aggregated: AggregatedTemporalNotes | AggregationFallback | null;
  aggregatedMultiScale?: { scales: Record<string, unknown>; summary?: string; coherence: Record<string, unknown> };
  consistency: { isConsistent?: boolean } | null;
  propagation: unknown[];
  temporalScreenshots: TemporalScreenshot[];
  processedTemporalNotes: unknown;
  temporalGraph: TemporalGraphResult | null;
  selectedScreenshots?: PromptScreenshot[] | undefined;
  error?: string;
}
export interface BrowserExperienceResult {
  url: string;
  stages: string[];
  experiences: Experience[];
  evaluations: Array<{ stage: string; evaluation: unknown }>;
  aggregated?: AggregatedTemporalNotes;
  aggregatedMultiScale?: unknown;
  error?: string;
}
export type PlayGameResult = Awaited<ReturnType<typeof playGameImplementation>>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isTemporalNotes(value: unknown): value is TemporalNote[] {
  return Array.isArray(value);
}

function goalDescription(goal: Exclude<Goal, null | string>): string {
  return !Array.isArray(goal) && typeof goal !== 'function' ? goal.description ?? 'unknown' : 'unknown';
}

/**
 * Test gameplay with variable goals
 *
 * Workflow for testing games with variable goals/prompts.
 * Originally motivated by interactive web applications that require
 * real-time validation, variable goals, and temporal understanding.
 *
 * Handles persona experience, temporal capture, goal evaluation, and consistency checks.
 *
 * Supports interactive games:
 * - Games that activate from payment screens (not just standalone games)
 * - Game activation via keyboard shortcuts (e.g., 'g' key)
 * - Game state extraction (window.gameState)
 * - Temporal aggregation for screenshot sequences
 *
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} options - Test options
 * @param {string} options.url - Game URL (or page URL if game activates from page)
 * @param {string | Object | Array | Function} [options.goals] - Variable goals (string, object, array, or function)
 * @param {Array<Object>} [options.personas] - Personas to test with
 * @param {boolean} [options.captureTemporal] - Capture temporal screenshots
 * @param {number} [options.fps] - FPS for temporal capture
 * @param {number} [options.duration] - Duration for temporal capture (ms)
 * @param {boolean} [options.captureCode] - Extract rendered code
 * @param {boolean} [options.checkConsistency] - Check cross-modal consistency
 * @param {string} [options.gameActivationKey] - Keyboard key to activate game (e.g., 'g')
 * @param {string} [options.gameSelector] - Selector to wait for game activation (e.g., '#game-paddle')
 * @param {boolean} [options.play] - If true, actually play the game (uses playGame() internally)
 * @returns {Promise<Object>} Test results
 */
export async function testGameplay(page: GameConveniencePage, options: GameplayOptions = {}): Promise<GameplayResult | PlayGameResult> {
  const {
    url,
    goals = ['fun', 'accessibility', 'performance'],
    personas = null,
    captureTemporal = false,
    fps = 2,
    duration = 5000,
    captureCode = true,
    checkConsistency = true,
    gameActivationKey = null, // e.g., 'g' to activate game
    gameSelector = null, // e.g., '#game-paddle' selector
    play = false // NEW: Option to actually play the game
  } = options;

  // If play mode, use playGame() function
  if (play) {
    const { playGame } = await import('./game-player.js');
    const goal = Array.isArray(goals) ? goals[0] : goals;
    const goalString = typeof goal === 'string'
      ? goal
      : goal === null || goal === undefined
        ? 'Play the game well'
        : goalDescription(goal) || 'Play the game well';

    const gameOptions = {
      goal: goalString,
      maxSteps: options.maxSteps || 100,
      fps: options.fps || 2,
      ...(gameActivationKey === null ? {} : { gameActivationKey }),
      ...(gameSelector === null ? {} : { gameSelector }),
    };
    return await playGame(page, gameOptions);
  }

  if (!url) {
    throw new ValidationError('testGameplay: url is required', { function: 'testGameplay', parameter: 'url' });
  }

  log('[Convenience] Testing gameplay:', { url, goals, gameActivationKey, gameSelector });

  const result: GameplayResult = {
    url,
    goals: Array.isArray(goals) ? goals : [goals],
    experiences: [],
    evaluations: [],
    aggregated: null,
    consistency: null,
    propagation: [],
    temporalScreenshots: [], // Initialize to empty array for consistency
    processedTemporalNotes: null, // Initialize to null
    temporalGraph: null, // Initialize to null
    selectedScreenshots: undefined // Only set if >10 screenshots
  };

  try {
    // Navigate to game/page
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle');

    // Activate game if needed (for games that activate from other screens)
    if (gameActivationKey) {
      log(`[Convenience] Activating game with key: ${gameActivationKey}`);
      await page.keyboard.press(gameActivationKey);

      // Wait for game to activate
      if (gameSelector) {
        await page.waitForSelector(gameSelector, { timeout: 5000 }).catch(() => {
          warn(`[Convenience] Game selector ${gameSelector} not found after activation`);
        });
      }

      // Wait a bit for game to initialize
      await page.waitForTimeout(500);
    }

    // Extract rendered code
    let renderedCode = null;
    if (captureCode) {
      renderedCode = await extractRenderedCode(page);
      trackPropagation('capture', { renderedCode }, 'Captured HTML/CSS for gameplay test');
    }

    // Extract game state from window.gameState (game-agnostic)
    const gameState: GameplayState = await page.evaluate(() => {
      const state = (window as Window & { gameState?: GameplayState }).gameState ?? {};
      return {
        gameActive: typeof state.gameActive === 'boolean' ? state.gameActive : false,
        score: typeof state.score === 'number' ? state.score : 0,
        ...state
      };
    });

    // Experience with personas (if provided)
    if (personas && personas.length > 0) {
      const experiences = await experiencePageWithPersonas(page, requirePersonas(personas), {
        url,
        captureScreenshots: true,
        captureCode: captureCode,
        captureState: true
      });
      result.experiences = experiences;
    } else {
      // Single experience
      const experience = await experiencePageAsPersona(page, {
        name: 'Game Tester',
        perspective: 'Testing gameplay experience',
        focus: ['gameplay', 'fun', 'accessibility']
      }, {
        url,
        captureScreenshots: true,
        captureCode: captureCode,
        captureState: true
      });
      result.experiences = [experience];
    }

    // Capture and summarize temporal screenshots when requested.
    if (captureTemporal) {
      const temporalScreenshots = await captureTemporalScreenshots(page, fps, duration);
      result.temporalScreenshots = temporalScreenshots;
      trackPropagation('temporal', { count: temporalScreenshots.length }, 'Captured temporal screenshots');

      if (temporalScreenshots.length > 0) {
        const { AdaptiveTemporalProcessor } = await import('#temporal-orchestration');
        const adaptiveProcessor = new AdaptiveTemporalProcessor();

        const notes = temporalScreenshots.map((frame, index) => ({
          timestamp: frame.timestamp,
          elapsed: index * (1000 / fps),
          screenshotPath: frame.path,
          step: `gameplay_frame_${index}`,
          observation: `Frame ${index} of gameplay`
        }));

        const processed = await adaptiveProcessor.processNotes(notes, {
          testType: 'gameplay-temporal',
          viewport: await page.viewportSize()
        });

        result.processedTemporalNotes = processed;
        trackPropagation('temporal-processing', {
          original: notes.length,
          processed: processed.prunedNotes?.length ?? 0
        }, 'Processed temporal screenshots');
      }
    }

    // Evaluate with variable goals
    const goalArray = Array.isArray(goals) ? goals : [goals];
    const goalEvaluations = [];

    for (const goal of goalArray) {
      // Use last screenshot from experience
      const screenshotPath = result.experiences[0]?.screenshots?.[result.experiences[0].screenshots.length - 1]?.path;
      if (!screenshotPath) {
        warn('[Convenience] No screenshot available for goal evaluation');
        continue;
      }

      // Generate prompt from goal (for display/debugging, goal also used by prompt composition)
      const prompt = generateGamePrompt(goal, {
        gameState,
        renderedCode,
        stage: 'gameplay'
      });

      // Use aggregated notes from experience if available
      const experience = result.experiences[0];
      const temporalNotes = experience?.aggregated || null;

      // Validate with goal in context (prompt composition system will use goal)
      // Include temporal notes for richer context
      const evaluation = await validateScreenshot(screenshotPath, prompt, {
        testType: 'gameplay-goal',
        gameState,
        renderedCode,
        goal: goal, // Pass goal in context - prompt composition system will use it
        temporalNotes: temporalNotes, // Include aggregated temporal notes
        enableUncertaintyReduction: true // Enable uncertainty reduction for gameplay testing
      });

      goalEvaluations.push({
        goal: typeof goal === 'string' ? goal : goal === null ? 'unknown' : goalDescription(goal),
        evaluation,
        prompt
      });
    }

    result.evaluations = goalEvaluations;

    // Use aggregated notes from experiences (automatically included)
    // Also aggregate across all experiences for cross-experience analysis
    const allNotes = result.experiences.flatMap(exp => exp.notes || []);

      // Always return aggregated notes (even if empty) for consistency
    if (allNotes.length > 0) {
      // Use fixed temporal aggregation system
      const aggregated = await aggregateTemporalNotes(allNotes, {
        windowSize: 5000,
        decayFactor: 0.9
      });
      result.aggregated = aggregated;

      // Also use multi-scale aggregation for richer analysis
      // Always return multi-scale result (even if empty) for consistency
      try {
        const { aggregateMultiScale } = await import('#temporal-multi-scale');
        const aggregatedMultiScale = aggregateMultiScale(allNotes, {
          attentionWeights: true
        });
        // Ensure it has the expected structure
        if (!aggregatedMultiScale.scales) {
          aggregatedMultiScale.scales = {};
        }
        if (!aggregatedMultiScale.coherence) {
          aggregatedMultiScale.coherence = {};
        }
        result.aggregatedMultiScale = aggregatedMultiScale;
      } catch (error) {
        warn(`[Convenience] Multi-scale aggregation failed: ${errorMessage(error)}`);
        // Return empty multi-scale result instead of null
        result.aggregatedMultiScale = {
          scales: {},
          summary: 'Multi-scale aggregation failed',
          coherence: {}
        };
      }

      // IMPROVEMENT: Build temporal graph for better coherence understanding
      try {
        const { buildTemporalGraph } = await import('#temporal-core');
        const temporalGraph = await buildTemporalGraph(allNotes, {
          windowSize: 5000,
          decayFactor: 0.9,
          useLLM: false, // Use keyword matching for speed in gameplay
          frequency: fps // Auto-detect extraction method based on frequency
        });
        result.temporalGraph = temporalGraph;
        trackPropagation('temporal-graph', {
          nodes: temporalGraph.graph?.nodes?.length || 0,
          edges: temporalGraph.graph?.edges?.length || 0,
          averageCoherence: temporalGraph.graph?.averageCoherence || 0,
          entityCount: Object.keys(temporalGraph.graph?.entities || {}).length
        }, 'Built temporal graph representation');
      } catch (error) {
        warn(`[Convenience] Temporal graph building failed: ${errorMessage(error)}`);
        result.temporalGraph = null;
      }

      // IMPROVEMENT: Select representative screenshots for context window management
      if (result.temporalScreenshots && result.temporalScreenshots.length > 10) {
        try {
          const { selectRepresentativeScreenshots } = await import('#temporal-prompt-formatting');
          const evaluations = allNotes.map(note => ({ score: typeof note.score === 'number' ? note.score : 0 }));
          const promptScreenshots: PromptScreenshot[] = result.temporalScreenshots.map(({ path, timestamp }) => ({ path, timestamp }));
          const selectedScreenshots = selectRepresentativeScreenshots(
            promptScreenshots,
            evaluations,
            {
              maxScreenshots: 10,
              strategy: 'keyframes' // Use keyframes for gameplay (captures state changes)
            }
          );
          result.selectedScreenshots = selectedScreenshots;
          trackPropagation('screenshot-selection', {
            original: result.temporalScreenshots.length,
            selected: selectedScreenshots.length,
            reduction: ((result.temporalScreenshots.length - selectedScreenshots.length) / result.temporalScreenshots.length * 100).toFixed(1) + '%'
          }, 'Selected representative screenshots for context management');
        } catch (error) {
          warn(`[Convenience] Screenshot selection failed: ${errorMessage(error)}`);
          result.selectedScreenshots = result.temporalScreenshots.map(({ path, timestamp }) => ({ path, timestamp })); // Fallback to all
        }
      }

      trackPropagation('aggregation', {
        windows: aggregated.windows.length,
        coherence: aggregated.coherence,
        scales: Object.keys(result.aggregatedMultiScale.scales || {}),
        graphNodes: result.temporalGraph?.graph?.nodes?.length || 0
      }, 'Aggregated temporal notes with multi-scale and temporal graph');
    } else {
      // Return empty aggregated structure if no notes (for consistency)
      result.aggregated = {
        windows: [],
        coherence: 0,
        summary: 'No notes to aggregate',
        timeSpan: 0
      };
      result.aggregatedMultiScale = {
        scales: {},
        summary: 'No notes to aggregate',
        coherence: {}
      };
    }

    // Use aggregated notes from individual experiences too
    result.experiences.forEach((exp, i) => {
      if (exp.aggregated) {
        trackPropagation('experience-aggregation', {
          experienceIndex: i,
          windows: exp.aggregated.windows.length,
          coherence: exp.aggregated.coherence
        }, `Experience ${i} has aggregated notes`);
      }
    });

    // Check cross-modal consistency (if requested)
    const primaryExperience = result.experiences[0];
    const screenshots = primaryExperience?.screenshots;
    if (checkConsistency && renderedCode && screenshots && screenshots.length > 0) {
      const screenshotPath = screenshots.at(-1)?.path;
      if (screenshotPath) {
        const consistency = checkCrossModalConsistency({
        screenshot: screenshotPath,
        renderedCode,
        pageState: gameState
        }) as { isConsistent?: boolean };
        result.consistency = consistency;
        trackPropagation('consistency', { isConsistent: consistency.isConsistent }, 'Checked cross-modal consistency');
      }
    }

    // Get propagation history
    const { getPropagationTracker } = await import('./experience-propagation.mjs');
    result.propagation = getPropagationTracker().getSummary().path;

  } catch (error) {
    warn(`[Convenience] Gameplay test failed: ${errorMessage(error)}`);
    result.error = errorMessage(error);

    // Ensure aggregated structures are always present even on error
    if (!result.aggregated) {
      result.aggregated = {
        windows: [],
        coherence: 0,
        summary: 'Error during aggregation',
        timeSpan: 0
      };
    }
    if (!result.aggregatedMultiScale) {
      result.aggregatedMultiScale = {
        scales: {},
        summary: 'Error during aggregation',
        coherence: {}
      };
    }
  }

  // Final check - ensure aggregated structures are always present
  if (!result.aggregated) {
    result.aggregated = {
      windows: [],
      coherence: 0,
      summary: 'No aggregation performed',
      timeSpan: 0
    };
  }
  if (!result.aggregatedMultiScale) {
    result.aggregatedMultiScale = {
      scales: {},
      summary: 'No aggregation performed',
      coherence: {}
    };
  }

  return result;
}

/**
 * Test browser experience with multiple stages
 *
 * Workflow for testing browser experiences across multiple stages
 * (initial, form, payment, gameplay, etc.).
 *
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} options - Test options
 * @param {string} options.url - Page URL
 * @param {Array<Object>} [options.personas] - Personas to test with
 * @param {Array<string>} [options.stages] - Stages to test ('initial', 'form', 'payment', 'gameplay')
 * @param {boolean} [options.captureCode] - Extract rendered code
 * @param {boolean} [options.captureTemporal] - Capture temporal screenshots
 * @returns {Promise<Object>} Test results
 */
export async function testBrowserExperience(page: GameConveniencePage, options: BrowserExperienceOptions = {}): Promise<BrowserExperienceResult> {
  const {
    url,
    personas = null,
    stages = ['initial'],
    navigateBetweenStages = null,
    captureCode = true,
    captureTemporal = false
  } = options;

  if (!url) {
    throw new ValidationError('testBrowserExperience: url is required', { function: 'testBrowserExperience', parameter: 'url' });
  }

  log('[Convenience] Testing browser experience:', { url, stages });

  const result: BrowserExperienceResult = {
    url,
    stages: [],
    experiences: [],
    evaluations: []
  };

  try {
    // Navigate to page
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle');

    // Test each stage
    for (const stage of stages) {
      log(`[Convenience] Testing stage: ${stage}`);

      // Extract rendered code for this stage
      let renderedCode = null;
      if (captureCode) {
        renderedCode = await extractRenderedCode(page);
      }

      // Get page state
      const pageState = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        };
      });

      // Experience with personas (if provided)
      if (personas && personas.length > 0) {
        const experiences = await experiencePageWithPersonas(page, requirePersonas(personas), {
          url,
          captureScreenshots: true,
          captureCode: captureCode,
          captureState: true
        });
        result.experiences.push(...experiences);
      } else {
        // Single experience
        const experience = await experiencePageAsPersona(page, {
          name: 'Browser Tester',
          perspective: `Testing ${stage} stage`,
          focus: ['usability', 'accessibility']
        }, {
          url,
          captureScreenshots: true,
          captureCode: captureCode,
          captureState: true
        });
        result.experiences.push(experience);
      }

      // Evaluate this stage
      // Use aggregated notes from experience if available
      const lastExperience = result.experiences[result.experiences.length - 1];
      const screenshotPath = lastExperience?.screenshots?.[0]?.path;
      if (screenshotPath) {
        const prompt = `Evaluate the ${stage} stage. Check for usability, accessibility, and user experience.`;

        // Include temporal notes from experience
        const temporalNotes = lastExperience?.aggregated || null;

        const evaluation = await validateScreenshot(screenshotPath, prompt, {
          testType: `browser-experience-${stage}`,
          renderedCode,
          pageState,
          temporalNotes: temporalNotes, // Include aggregated temporal notes
          enableUncertaintyReduction: true // Enable uncertainty reduction for comprehensive testing
        });
        result.evaluations.push({
          stage,
          evaluation
        });
      }

      result.stages.push(stage);

      // Aggregate temporal notes across all stages
      const allStageNotes = result.experiences.flatMap(exp => exp.notes || []);
      if (allStageNotes.length > 0) {
        const stageAggregated = await aggregateTemporalNotes(allStageNotes, {
          windowSize: 10000,
          decayFactor: 0.9
        });
        result.aggregated = stageAggregated;

        // Multi-scale aggregation across stages
        const stageMultiScale = aggregateMultiScale(allStageNotes, {
          attentionWeights: true
        });
        result.aggregatedMultiScale = stageMultiScale;
      }

      // Navigate to next stage (if callback provided)
      const stageIndex = stages.indexOf(stage);
      if (navigateBetweenStages && stageIndex < stages.length - 1) {
        try {
          const nextStage = stages[stageIndex + 1];
          if (nextStage) await navigateBetweenStages(page, stage, nextStage);
        } catch (e) {
          warn(`[Convenience] Could not navigate from ${stage} to ${stages[stageIndex + 1]}: ${errorMessage(e)}`);
        }
      }
    }

  } catch (error) {
    warn(`[Convenience] Browser experience test failed: ${errorMessage(error)}`);
    result.error = errorMessage(error);
  }

  return result;
}

/**
 * Validate screenshot with variable goals
 *
 * Simplified API for validating screenshots with variable goals/prompts.
 * Supports string goals, goal objects, arrays, and functions.
 *
 * Originally motivated by interactive web applications
 * that requires real-time validation, variable goals, and temporal understanding.
 *
 * Supports:
 * - Brutalist rubric goals
 * - Accessibility goals with contrast requirements
 * - Game state validation goals
 * - Better error messages and context
 *
 * @param {string} screenshotPath - Path to screenshot
 * @param {Object} options - Validation options
 * @param {string | Object | Array | Function} options.goal - Variable goal (string, object, array, or function)
 * @param {Object} [options.gameState] - Game state (if applicable)
 * @param {Object} [options.renderedCode] - Rendered code (if available)
 * @param {Object} [options.persona] - Persona (if applicable)
 * @param {Object} [options.context] - Additional context
 * @returns {Promise<Object>} Validation result
 */
export async function validateWithGoals(screenshotPath: string, options: GoalValidationOptions = {}) {
  const {
    goal,
    gameState = null,
    renderedCode = null,
    persona = null,
    context = {}
  } = options;

  if (!screenshotPath) {
    throw new ValidationError('validateWithGoals: screenshotPath is required', { function: 'validateWithGoals', parameter: 'screenshotPath' });
  }

  if (!goal) {
    throw new ValidationError('validateWithGoals: goal is required', { function: 'validateWithGoals', parameter: 'goal' });
  }

  log('[Convenience] Validating with goal:', { screenshotPath, goal: typeof goal === 'string' ? goal : goalDescription(goal) || 'object' });

  // Generate prompt from goal (for display/debugging; goal also used by prompt composition)
  const prompt = generateGamePrompt(goal, {
    ...(gameState === null ? {} : { gameState }),
    renderedCode,
    persona,
    ...context
  });

  // Include temporal notes if available in context
  let temporalNotes = null;
  if (context.aggregated) {
    temporalNotes = context.aggregated;
  } else if (context.temporalNotes) {
    temporalNotes = context.temporalNotes;
  } else if (isTemporalNotes(context.notes) && context.notes.length > 0) {
    // Auto-aggregate if notes provided but not aggregated
    try {
      temporalNotes = await aggregateTemporalNotes(context.notes, {
        windowSize: TEMPORAL_CONSTANTS.DEFAULT_WINDOW_SIZE_MS,
        decayFactor: TEMPORAL_CONSTANTS.DEFAULT_DECAY_FACTOR
      });
    } catch (error) {
      warn('[Convenience] Auto-aggregation failed, continuing without temporal notes:', errorMessage(error));
      temporalNotes = null;
    }
  }

  // Validate with goal in context (prompt composition system will use goal)
  // Include temporal notes for richer context
  // Merge context options (allow override of testType, enableUncertaintyReduction, etc.)
  const validationContext = {
    testType: 'goal-validation',
    gameState,
    renderedCode,
    goal: goal, // Pass goal in context - prompt composition system will use it
    temporalNotes: temporalNotes, // Include aggregated temporal notes
    ...context // Allow context to override defaults (e.g., testType, enableUncertaintyReduction)
  };

  const result = await validateScreenshot(screenshotPath, prompt, validationContext);

  // Normalize result structure (ensures consistent return type)
  const normalizedResult = normalizeValidationResult(result, 'validateWithGoals');

  return {
    goal: typeof goal === 'string' ? goal : goalDescription(goal),
    prompt,
    result: normalizedResult
  };
}

// validatePage and validateComparison moved to page-validation.ts
// to avoid pulling game/persona deps into the main entry.
