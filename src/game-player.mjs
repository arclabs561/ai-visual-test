/**
 * Game Playing Module
 * 
 * Optional module for actually playing games (not just testing them).
 * Uses validation to understand game state, then makes decisions and executes actions.
 * 
 * Originally motivated by interactive web applications that require
 * real-time validation, variable goals, and temporal understanding.
 * 
 * Design: Game playing = validation + decision-making + action execution
 * - Validation: Understand game state from screenshots (we have this)
 * - Decision-making: Choose what action to take (we add this)
 * - Action execution: Execute actions via Playwright (we add this)
 * 
 * Provides two interfaces:
 * 1. `playGame()` - Internal loop (simple API for most users)
 * 2. `GameGym` - External iterator (advanced API for power users, RL integration, parallel games)
 */

import { validateScreenshot, judgeGameAction } from './judge.mjs';
import { TemporalDecisionManager } from '#temporal-orchestration';
import { parseGameActionOutcome } from '#game-action-contract';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { log, warn } from './logger.mjs';

/**
 * Decides what action to take based on game state
 * 
 * Uses VLLM to understand current state and decide next action.
 * 
 * @param {Object} gameState - Current game state from screenshot
 * @param {string} goal - Goal for gameplay (e.g., "maximize score", "survive")
 * @param {Array} history - Previous actions and results
 * @returns {Promise<Object>} Action to take { type: 'keyboard', key: 'ArrowRight', ... }
 */
export async function decideGameAction(gameState, goal, history = [], services = {}) {
  const recentHistory = history.slice(-5); // Last 5 steps for context
  const reviewState = services.reviewState || validateScreenshot;
  const selectAction = services.selectAction || judgeGameAction;
  // A game-loop caller owns review scheduling and passes its evaluation here.
  // The standalone compatibility call retains the previous one-review behavior.
  const stateEvaluation = gameState.evaluation || await reviewState(
    gameState.screenshot,
    `Evaluate current game state. Goal: ${goal}. Recent history: ${recentHistory.length} steps.`,
    { testType: 'gameplay-state', temporalNotes: recentHistory.map(h => ({ step: h.step, action: h.action, result: h.result?.score })) }
  );
  
  // Enhanced Prompt with Reflexion and Chain of Thought
  let reflexionContext = '';
  const lastStep = recentHistory[recentHistory.length - 1];
  if (lastStep && lastStep.result?.score !== undefined) {
    const scoreDelta = (stateEvaluation.score ?? 0) - (lastStep.result.score ?? 0);
    if (scoreDelta < 0) {
      reflexionContext = `CRITICAL REFLEXION: The previous action (${JSON.stringify(lastStep.action)}) caused the score to drop by ${Math.abs(scoreDelta)}. 
      Analyze WHY this failed before choosing the next action. Avoid repeating the same mistake.`;
    } else if (scoreDelta > 0) {
      reflexionContext = `SUCCESS ANALYSIS: The previous action (${JSON.stringify(lastStep.action)}) increased the score by ${scoreDelta}. Continue this successful strategy.`;
    }
  }

  const actionPrompt = `You are an expert game-playing agent. Your goal is: "${goal}".
    
    ${reflexionContext}

    CURRENT STATE:
    - Visual Analysis: ${stateEvaluation.reasoning?.substring(0, 300) || 'No analysis available'}
    - Score: ${stateEvaluation.score}
    - History: ${recentHistory.length} steps taken

    INSTRUCTIONS:
    1. THINK: Analyze the game state and physics step-by-step. Anticipate the consequences of moving Left, Right, Up, or Down.
    2. PLAN: Formulate a short-term plan (next 3 steps).
    3. ACT: Choose the single best immediate action.

    Return JSON only:
    {
      "thought_process": "Step-by-step reasoning...",
      "plan": "Short term plan...",
      "type": "keyboard", 
      "key": "ArrowRight" 
    }
    
    Available actions:
    - keyboard: ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Space, Enter
    - click: { "type": "click", "selector": "#button" }
    - wait: { "type": "wait", "duration": 100 }`;
  
  try {
    const actionResult = await selectAction(gameState.screenshot, actionPrompt, {
      testType: 'gameplay-decision', goal, temperature: 0.2, temporalNotes: [],
      useTemporalDecision: false,
    });
    services.onActionAttempts?.(actionResult.attempts ?? 1);
    return actionResult.action || actionResult;
  } catch (error) {
    services.onActionAttempts?.(error?.details?.failureKind === 'disabled' ? 0 : error?.details?.attempts ?? 1);
    if (!isHeuristicFallbackError(error)) throw error;
    log(`[GamePlayer] Falling back after action contract/provider disable: ${error.message}`);
  }
  
  // Fallback: simple heuristic based on score
  // If score is low or decreasing, try different action
  const lastScore = recentHistory.length > 0 ? recentHistory[recentHistory.length - 1].result?.score : null;
  const currentScore = stateEvaluation.score;
  
  if (lastScore !== null && currentScore < lastScore) {
    // Score decreased, try different direction
    return { type: 'keyboard', key: 'ArrowLeft' };
  }
  
  // Default: move right
  return { type: 'keyboard', key: 'ArrowRight' };
}

function isHeuristicFallbackError(error) {
  const kind = error?.failureKind || error?.details?.failureKind;
  return kind === 'output_contract' || kind === 'disabled';
}

function validateGameOptions({ maxSteps, fps }) {
  if (!Number.isInteger(maxSteps) || maxSteps <= 0) {
    throw new RangeError(`maxSteps must be a positive integer, got: ${maxSteps}`);
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new RangeError(`fps must be a positive finite number, got: ${fps}`);
  }
}

function hasTerminalEvidence(evaluation, gameState, isTerminal) {
  if (typeof isTerminal === 'function') return Boolean(isTerminal({ evaluation, gameState }));
  if (gameState?.gameActive === false) return true;
  return evaluation?.issues?.some(issue => /game over|game ended|you lost/i.test(String(issue))) === true;
}

function isScopedCssSelector(selector) {
  return typeof selector === 'string'
    && !/^\s*(?:xpath=|text=|role=|id=|data-testid=|\/|\.\.\/)/i.test(selector);
}

/**
 * Executes a game action via Playwright
 * 
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} action - Action to execute
 */
export async function executeGameAction(page, action, { gameSelector = null } = {}) {
  let executionResult = { success: false, error: null };
  
  try {
    const parsedAction = parseGameActionOutcome(action, { allowLegacy: false }).outcome;
    switch (parsedAction.type) {
      case 'keyboard':
        await page.keyboard.press(parsedAction.key);
        executionResult.success = true;
        break;
      case 'click':
        if (parsedAction.selector) {
          if (gameSelector && !isScopedCssSelector(parsedAction.selector)) {
            executionResult.error = `Game selector only permits CSS click selectors: ${parsedAction.selector}`;
            return executionResult;
          }
          // Verify element exists before clicking
          const target = gameSelector ? page.locator(gameSelector).locator(parsedAction.selector) : page.locator(parsedAction.selector);
          const exists = await target.count() > 0;
          if (!exists) {
            executionResult.success = false;
            executionResult.error = `Element not found: ${parsedAction.selector}`;
            return executionResult;
          }
          
          await target.click();
          executionResult.success = true;
        } else {
          warn('[GamePlayer] Click action missing selector');
          executionResult.error = 'Click action missing selector';
        }
        break;
      case 'wait':
        await page.waitForTimeout(parsedAction.duration);
        executionResult.success = true;
        break;
    }
  } catch (error) {
    executionResult.success = false;
    executionResult.error = error.message;
  }
  
  return executionResult;
}

/**
 * Plays a game by taking screenshots, making decisions, and executing actions
 * 
 * Uses validation to understand game state, then makes decisions and executes actions.
 * This is slower than human gameplay (1-5 FPS for decision-making, not 60 FPS)
 * because VLLM calls take 1-3 seconds.
 * 
 * Originally motivated by interactive web applications, but works for any web game.
 * 
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} options - Game playing options
 * @param {string} options.goal - Goal for gameplay (e.g., "maximize score")
 * @param {number} options.maxSteps - Maximum number of steps
 * @param {number} options.fps - Frames per second for decision-making (default: 2, not 60)
 * @param {string} [options.gameActivationKey] - Keyboard key to activate game
 * @param {string} [options.gameSelector] - Selector to wait for game activation
 * @param {string} [options.tempDir] - Directory for temporary screenshots
 * @returns {Promise<Object>} Gameplay result with history, final state, etc.
 */
export async function playGame(page, options = {}) {
  const {
    goal = 'Play the game well',
    maxSteps = 100,
    fps = 2, // 2 FPS for decision-making (not 60 FPS - AI needs time to think)
    gameSelector = null,
    gameActivationKey = null,
    tempDir = null,
    services = {},
    isTerminal = null,
  } = options;
  validateGameOptions({ maxSteps, fps });
  const reviewState = services.reviewState || validateScreenshot;
  const decideAction = services.decideAction || decideGameAction;
  const executeAction = services.executeAction || executeGameAction;
  const decisionManager = services.decisionManager || new TemporalDecisionManager({
    minNotesForPrompt: 2,
    coherenceThreshold: 0.5,
  });
  const providerCalls = { visualReviews: 0, actionSelections: 0 };
  const runId = randomUUID();
  const invokeReview = async (...args) => {
    try {
      const result = await reviewState(...args);
      providerCalls.visualReviews += result.attempts ?? 1;
      return result;
    } catch (error) {
      providerCalls.visualReviews += error?.details?.attempts ?? 1;
      throw error;
    }
  };
  
  log('[GamePlayer] Starting game play:', { goal, maxSteps, fps, gameActivationKey });
  
  // Activate game if needed
  if (gameActivationKey) {
    log(`[GamePlayer] Activating game with key: ${gameActivationKey}`);
    await page.keyboard.press(gameActivationKey);
    await page.waitForTimeout(500);
    
    if (gameSelector) {
      try {
        await page.waitForSelector(gameSelector, { timeout: 5000 });
      } catch (error) {
        warn(`[GamePlayer] Game selector ${gameSelector} not found after activation`);
      }
    }
  }
  
  // Create temp directory for screenshots
  const screenshotDir = tempDir || join(process.cwd(), 'temp-gameplay');
  if (!existsSync(screenshotDir)) {
    mkdirSync(screenshotDir, { recursive: true });
  }
  
  const history = [];
  let currentState = null;
  
  for (let step = 0; step < maxSteps; step++) {
    try {
      // 1. Capture current state (screenshot)
      const screenshot = await page.screenshot();
      const screenshotPath = join(screenshotDir, `gameplay-${runId}-step-${step}.png`);
      writeFileSync(screenshotPath, screenshot);
      
      // 2. Extract game state from page (if available)
      let gameState = null;
      try {
        gameState = await page.evaluate(() => {
          // Try multiple ways to get game state
          if (window.gameState) {
            return window.gameState;
          }
          // Try common game state patterns
          if (window.game) {
            return {
              score: window.game.score ?? 0,
              level: window.game.level || 0,
              lives: window.game.lives || 0,
              gameActive: window.game.active !== false
            };
          }
          // Try to extract from DOM
          const scoreEl = document.querySelector('#score, .score, [data-score]');
          const score = scoreEl ? parseInt(scoreEl.textContent?.match(/\d+/)?.[0] || '0') : null;
          return {
            score,
            gameActive: true // Assume active if we can't detect
          };
        });
      } catch (error) {
        // Game state extraction is optional
        log(`[GamePlayer] Could not extract game state: ${error.message}`);
      }
      
      // 2. Understand current state (validation)
      currentState = {
        screenshot: screenshotPath,
        step,
        timestamp: Date.now(),
        gameState // Include extracted game state
      };
      
      // Use TemporalDecisionManager to reduce LLM calls
      // Only prompt when decision is needed, not on every state change
      const temporalNotes = history.map(h => ({
        step: h.step,
        action: h.action,
        result: h.result?.score,
        timestamp: h.state?.timestamp || Date.now()
      }));
      
      let stateEvaluation;
      if (step > 0 && history.length > 0) {
        // Keep one manager for the whole run so warm-start and prompt timing
        // describe this game, rather than a fresh manager on every frame.
        const temporalCurrentState = {
          score: null,
          step,
          timestamp: Date.now(),
        };
        const previousState = history[history.length - 1]?.result || null;
        let decision;
        try {
          decision = await decisionManager.shouldPrompt(temporalCurrentState, previousState, temporalNotes, {
            stage: 'gameplay',
            testType: 'gameplay'
          });
          
        } catch (error) {
          // Scheduler failure means review normally; it does not retry a
          // provider review that itself has failed.
          decision = { shouldPrompt: true, urgency: 'high', reason: 'scheduler unavailable' };
        }
        if (!decision.shouldPrompt && decision.urgency !== 'high' && previousState) {
            // Don't prompt yet - reuse previous result
            stateEvaluation = {
              ...previousState,
              skipped: true,
              skipReason: decision.reason,
              urgency: decision.urgency
            };
        } else {
          // Prompt now (decision point or high urgency)
          stateEvaluation = await invokeReview(
              screenshotPath,
              `Evaluate current game state. Goal: ${goal}`,
              {
                testType: 'gameplay',
                temporalNotes,
                sequenceIndex: step,
                useTemporalDecision: false,
                currentState: temporalCurrentState,
                previousState,
                previousResult: previousState
              }
          );
        }
      } else {
        // First step always establishes the canonical evaluation.
        stateEvaluation = await invokeReview(
          screenshotPath,
          `Evaluate current game state. Goal: ${goal}`,
          {
            testType: 'gameplay',
            temporalNotes,
            sequenceIndex: step
          }
        );
      }
      
      currentState.evaluation = stateEvaluation;
      
      // 3. Decide what action to take (decision-making)
      let action = await decideAction(
        currentState,
        goal,
        history,
        {
          reviewState,
          selectAction: services.selectAction || judgeGameAction,
          onActionAttempts: attempts => { providerCalls.actionSelections += attempts; },
        }
      );
      
      // Try action, with simple retry on failure
      let actionExecuted = false;
      let executionResult = null;
      let retries = 0;
      const maxRetries = 2;
      
      while (!actionExecuted && retries < maxRetries) {
        log(`[GamePlayer] Step ${step}: score=${stateEvaluation.score}, action=${action.type}:${action.key || action.selector || ''}`);
        
        // 4. Execute action (Playwright)
        executionResult = await executeAction(page, action, { gameSelector });
        
        if (executionResult.success) {
          actionExecuted = true;
          action.executionResult = executionResult;
        } else {
          // Action failed - wait and retry, or try simple alternative
          retries++;
          if (retries < maxRetries) await page.waitForTimeout(500);
        }
      }

      if (!actionExecuted) {
        history.push({
          step,
          state: currentState,
          action,
          executionResult,
          error: executionResult?.error || 'Game action failed after retries',
        });
        continue;
      }
      
      // 5. Wait for next frame
      await page.waitForTimeout(1000 / fps);
      
      // 6. Record history
      history.push({
        step,
        state: currentState,
        action,
        result: stateEvaluation
      });
      
      // 7. Check if game is over (optional)
      if (hasTerminalEvidence(stateEvaluation, gameState, isTerminal)) {
        log(`[GamePlayer] Game over detected at step ${step}`);
        break;
      }
    } catch (error) {
      warn(`[GamePlayer] Error at step ${step}:`, error.message);
      // Continue with next step (graceful degradation)
      history.push({
        step,
        error: error.message,
        state: currentState
      });
    }
  }
  
  return {
    history,
    finalState: currentState,
    totalSteps: history.length,
    goal,
    success: currentState?.evaluation?.score !== null,
    providerCalls,
  };
}

/**
 * Game Gym - External Iterator Pattern (RL Gym-style)
 * 
 * Provides external iterator interface for game playing, enabling:
 * - Explicit control over iteration
 * - Batching across multiple games
 * - RL algorithm integration
 * - Parallel game instances
 * - Checkpointing and state management
 * 
 * Originally motivated by interactive web applications, but designed to work
 * with any RL algorithm or advanced use case.
 * 
 * @example
 * ```javascript
 * const gym = new GameGym(page, { goal: 'Maximize score' });
 * let obs = await gym.reset();
 * 
 * while (!gym.done) {
 *   const action = await decideAction(obs);
 *   const result = await gym.step(action);
 *   obs = result.observation;
 * }
 * ```
 */
export class GameGym {
  constructor(page, options = {}) {
    this.page = page;
    this.options = {
      goal: 'Play the game well',
      maxSteps: 100,
      fps: 2,
      gameSelector: null,
      gameActivationKey: null,
      tempDir: null,
      ...options
    };
    validateGameOptions(this.options);
    this.services = this.options.services || {};
    this.runId = randomUUID();
    
    this.currentState = null;
    this.done = false;
    this.stepCount = 0;
    this.history = [];
    
    // Create temp directory
    const screenshotDir = this.options.tempDir || join(process.cwd(), 'temp-gameplay');
    if (!existsSync(screenshotDir)) {
      mkdirSync(screenshotDir, { recursive: true });
    }
    this.screenshotDir = screenshotDir;
    
    log('[GameGym] Created gym:', { goal: this.options.goal, maxSteps: this.options.maxSteps });
  }
  
  /**
   * Reset game to initial state
   * 
   * @returns {Promise<Object>} Initial observation
   */
  async reset() {
    // Navigate to game if URL provided
    if (this.options.url) {
      await this.page.goto(this.options.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForLoadState('networkidle');
    }
    
    // Activate game if needed
    if (this.options.gameActivationKey) {
      log(`[GameGym] Activating game with key: ${this.options.gameActivationKey}`);
      await this.page.keyboard.press(this.options.gameActivationKey);
      await this.page.waitForTimeout(500);
      
      if (this.options.gameSelector) {
        try {
          await this.page.waitForSelector(this.options.gameSelector, { timeout: 5000 });
        } catch (error) {
          warn(`[GameGym] Game selector ${this.options.gameSelector} not found`);
        }
      }
    }
    
    // Capture initial state
    const screenshot = await this.page.screenshot();
    const screenshotPath = join(this.screenshotDir, `gameplay-${this.runId}-reset-${Date.now()}.png`);
    writeFileSync(screenshotPath, screenshot);
    
    const reviewState = this.services.reviewState || validateScreenshot;
    const evaluation = await reviewState(
      screenshotPath,
      `Evaluate initial game state. Goal: ${this.options.goal}`,
      {
        testType: 'gameplay-reset',
        goal: this.options.goal
      }
    );
    
    this.currentState = {
      observation: {
        screenshot: screenshotPath,
        evaluation: evaluation,
        step: 0,
        timestamp: Date.now()
      },
      reward: 0,
      done: hasTerminalEvidence(evaluation, evaluation.gameState, this.options.isTerminal),
      info: {
        score: evaluation.score,
        issues: evaluation.issues || [],
        goal: this.options.goal
      }
    };
    
    this.done = this.currentState.done;
    this.stepCount = 0;
    this.history = [];
    
    log('[GameGym] Reset complete:', { score: evaluation.score });
    
    return this.currentState.observation;
  }
  
  /**
   * Execute action and return new observation
   * 
   * @param {Object} action - Action to execute
   * @returns {Promise<Object>} { observation, reward, done, info }
   */
  async step(action) {
    if (this.done) {
      warn('[GameGym] Step called after game is done, reset first');
      return this.currentState;
    }
    
    // Validate and execute before advancing. A failed action leaves the prior
    // observation intact so callers can choose how to recover.
    const executeAction = this.services.executeAction || executeGameAction;
    const executionResult = await executeAction(this.page, action, {
      gameSelector: this.options.gameSelector,
    });
    if (!executionResult.success) {
      this.history.push({
        step: this.stepCount,
        action,
        executionResult,
        error: executionResult.error || 'Game action failed',
      });
      this.currentState = {
        ...this.currentState,
        info: {
          ...this.currentState?.info,
          actionFailed: true,
          executionResult,
        },
      };
      return this.currentState;
    }
    
    // Wait for next frame
    await this.page.waitForTimeout(1000 / this.options.fps);
    
    // Capture new state
    const screenshot = await this.page.screenshot();
    const screenshotPath = join(this.screenshotDir, `gameplay-${this.runId}-step-${this.stepCount + 1}.png`);
    writeFileSync(screenshotPath, screenshot);
    
    const reviewState = this.services.reviewState || validateScreenshot;
    const evaluation = await reviewState(
      screenshotPath,
      `Evaluate game state after action. Goal: ${this.options.goal}`,
      {
        testType: 'gameplay',
        temporalNotes: this.history.map(h => ({
          step: h.step,
          action: h.action,
          result: h.result?.score
        })),
        goal: this.options.goal
      }
    );
    
    // Calculate reward (based on goal)
    const previousScore = this.currentState?.observation?.evaluation?.score ?? 0;
    const currentScore = evaluation.score ?? 0;
    const reward = this.calculateReward(evaluation, this.currentState);
    
    // Update state
    this.stepCount++;
    this.currentState = {
      observation: {
        screenshot: screenshotPath,
        evaluation: evaluation,
        step: this.stepCount,
        timestamp: Date.now()
      },
      reward: reward,
      done: this.isDone(evaluation),
      info: {
        score: currentScore,
        scoreDelta: currentScore - previousScore,
        issues: evaluation.issues || [],
        goal: this.options.goal,
        step: this.stepCount,
        executionResult,
      }
    };
    
    // Record history
    this.history.push({
      step: this.stepCount,
      action: action,
      result: evaluation
    });
    
    this.done = this.currentState.done;
    
    log(`[GameGym] Step ${this.stepCount}: score=${currentScore}, reward=${reward}, done=${this.done}`);
    
    return this.currentState;
  }
  
  /**
   * Calculate reward based on goal
   * 
   * @param {Object} evaluation - Current evaluation
   * @param {Object} previousState - Previous state
   * @returns {number} Reward value
   */
  calculateReward(evaluation, previousState) {
    const currentScore = evaluation.score ?? 0;
    const previousScore = previousState?.observation?.evaluation?.score ?? 0;
    
    // Reward based on goal
    if (this.options.goal.includes('maximize') || this.options.goal.includes('score')) {
      // Reward for score increase
      return currentScore - previousScore;
    } else if (this.options.goal.includes('survive') || this.options.goal.includes('avoid')) {
      // Reward for staying alive (penalize score decrease)
      return currentScore > 0 ? 1 : -10;
    } else {
      // Default: reward for maintaining/improving score
      return currentScore - previousScore;
    }
  }
  
  /**
   * Check if game is done
   * 
   * @param {Object} evaluation - Current evaluation
   * @returns {boolean} True if game is done
   */
  isDone(evaluation) {
    // Game over conditions
    if (hasTerminalEvidence(evaluation, evaluation.gameState, this.options.isTerminal)) {
      return true;
    }
    
    // Max steps reached
    if (this.stepCount >= this.options.maxSteps) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Get current observation without stepping
   * 
   * @returns {Object} Current observation
   */
  getObservation() {
    return this.currentState?.observation || null;
  }
  
  /**
   * Get game state for checkpointing
   * 
   * @returns {Object} Game state
   */
  getState() {
    return {
      observation: this.currentState?.observation,
      stepCount: this.stepCount,
      history: this.history,
      done: this.done
    };
  }
  
  /**
   * Restore game state from checkpoint
   * 
   * @param {Object} state - Game state from checkpoint
   */
  restore(state) {
    this.currentState = { observation: state.observation };
    this.stepCount = state.stepCount;
    this.history = state.history || [];
    this.done = state.done || false;
    
    log(`[GameGym] Restored from checkpoint: step ${this.stepCount}`);
  }
}
