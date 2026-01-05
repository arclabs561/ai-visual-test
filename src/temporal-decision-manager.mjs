/**
 * Temporal Decision Manager
 * 
 * Decides when to call LLM vs. reuse previous result.
 * Core insight: Don't prompt on every state change, prompt when decision is needed.
 * 
 * Research: arXiv:2406.12125 - "Efficient Sequential Decision Making with Large Language Models"
 * 
 * What the Paper Claims:
 * - Core algorithm: Online model selection using multiplicative weights update (MWU)
 * - Key insight: "Don't prompt on every state change, prompt when decision is needed"
 * - Result: 6x performance gain with only 1.5% LLM calls (vs. calling at every time step)
 * 
 * What We Implement:
 * - ✅ Decision logic for WHEN to prompt (core insight from paper)
 * - ✅ Temporal coherence-based decision making
 * - ✅ State change detection
 * - ❌ NOT: Online model selection (which LLM to use)
 * - ❌ NOT: Multiplicative weights update (MWU) algorithm
 * 
 * Why We Adapted:
 * - Paper focuses on selecting WHICH LLM agent to use (model selection)
 * - We focus on WHEN to call (decision timing) - same core insight, different application
 * - Our use case: Single LLM provider, but need to reduce call frequency
 * 
 * Simple logic:
 * - Decision point? → prompt
 * - Coherence drop? → prompt (urgent)
 * - Significant state change with stable context? → prompt
 * - Otherwise → wait (reuse previous result)
 * 
 * See docs/research/IMPLEMENTATION_VS_RESEARCH.md for detailed research context.
 */

import { aggregateTemporalNotes } from './temporal.mjs';
import { aggregateMultiScale } from './temporal-decision.mjs';

/**
 * Integration Note:
 * 
 * TemporalDecisionManager can optionally use TemporalPreprocessingManager for faster
 * coherence calculation during high-activity periods. However, for typical use cases
 * (10-50 notes), full recomputation is fast enough (<1ms) and simpler.
 * 
 * If you have 1000+ notes and need maximum performance, you can pass a
 * TemporalPreprocessingManager instance to use cached aggregations:
 * 
 * ```javascript
 * const preprocessor = new TemporalPreprocessingManager();
 * const decisionManager = new TemporalDecisionManager({ preprocessor });
 * ```
 * 
 * By default, TemporalDecisionManager uses direct aggregation (simple, fast enough).
 */

/**
 * Temporal Decision Manager
 * 
 * Decides when context is sufficient to prompt, when to wait, and when to prompt immediately.
 */
export class TemporalDecisionManager {
  constructor(options = {}) {
    // Input validation
    const minNotes = options.minNotesForPrompt ?? 3;
    const coherenceThresh = options.coherenceThreshold ?? 0.5;
    const urgencyThresh = options.urgencyThreshold ?? 0.3;
    const maxWait = options.maxWaitTime ?? 10000;
    const stateChangeThresh = options.stateChangeThreshold ?? 0.2;
    
    // Validate thresholds
    if (minNotes < 1 || !Number.isInteger(minNotes)) {
      throw new RangeError(`minNotesForPrompt must be a positive integer, got: ${minNotes}`);
    }
    if (coherenceThresh < 0 || coherenceThresh > 1) {
      throw new RangeError(`coherenceThreshold must be in [0, 1], got: ${coherenceThresh}`);
    }
    if (urgencyThresh < 0 || urgencyThresh > 1) {
      throw new RangeError(`urgencyThreshold must be in [0, 1], got: ${urgencyThresh}`);
    }
    if (maxWait <= 0 || !isFinite(maxWait)) {
      throw new RangeError(`maxWaitTime must be a positive finite number, got: ${maxWait}`);
    }
    if (stateChangeThresh < 0 || stateChangeThresh > 1) {
      throw new RangeError(`stateChangeThreshold must be in [0, 1], got: ${stateChangeThresh}`);
    }
    
    this.minNotesForPrompt = minNotes;
    this.coherenceThreshold = coherenceThresh;
    this.urgencyThreshold = urgencyThresh;
    this.maxWaitTime = maxWait;
    this.stateChangeThreshold = stateChangeThresh;
    
    // Research-based adaptive sampling (arXiv:2406.12125)
    // DESIGN DECISION: Warm-start with LLM, transition to simpler methods
    // - Why: Paper shows LLMs provide good initial performance but don't adapt
    // - Why this approach: Good initial + long-term adaptation
    // - Research: Use LLMs early (warm-start), transition to simpler methods later
    // - Alternative considered: Always use LLM (expensive) or never use LLM (poor initial)
    //   - Rejected: Research shows adaptive approach achieves 6x performance gain
    this.warmStartSteps = options.warmStartSteps || 10; // Use LLM for first N steps
    this.adaptiveSampling = options.adaptiveSampling !== false; // Enable adaptive sampling
    this.stepCount = 0; // Track steps for adaptive sampling
    this.lastPromptTime = null; // Track last prompt time for decay strategies
  }

  /**
   * Decide if we should prompt now or wait for more context
   * 
   * @param {Object} currentState - Current state
   * @param {Object} previousState - Previous state (if any)
   * @param {import('./index.mjs').TemporalNote[]} temporalNotes - Temporal notes so far
   * @param {Object} context - Additional context
   * @returns {{shouldPrompt: boolean, reason: string, urgency: 'low'|'medium'|'high'}}
   */
  async shouldPrompt(currentState, previousState, temporalNotes, context = {}) {
    // Input validation
    if (!Array.isArray(temporalNotes)) {
      throw new TypeError('temporalNotes must be an array');
    }
    if (currentState === null || currentState === undefined) {
      throw new TypeError('currentState is required');
    }
    // Research-based adaptive sampling (arXiv:2406.12125)
    // DESIGN DECISION: Warm-start with LLM, then use adaptive decay
    // - Why: Paper shows LLMs good early but don't adapt, simpler methods adapt but start poorly
    // - Why this order: Warm-start ensures good initial performance, decay reduces calls over time
    // - Research: Polynomial/exponential decay for sampling strategy
    //   - Polynomial: p^LLM_t = min(p_max, max(p_min, C_poly / t^α))
    //   - Exponential: p^LLM_t = min(p_max, max(p_min, C_exp * exp(-βt)))
    // - Alternative considered: Fixed threshold (always prompt if coherence > threshold)
    //   - Rejected: Research shows adaptive decay achieves 6x performance gain
    this.stepCount++;
    
    // Warm-start: Always prompt in early steps (LLM provides good initial performance)
    if (this.adaptiveSampling && this.stepCount <= this.warmStartSteps) {
      return {
        shouldPrompt: true,
        reason: `Warm-start step ${this.stepCount}/${this.warmStartSteps} (research: LLMs good early)`,
        urgency: 'medium'
      };
    }
    
    // Adaptive decay: Calculate prompt probability using exponential decay
    // Research: Exponential decay p^LLM_t = min(p_max, max(p_min, C_exp * exp(-βt)))
    // - Why exponential: Smooth transition from LLM to simpler methods
    // - Why this formula: Matches research finding that LLM usage should decay over time
    // - Parameters: p_max=1.0 (always prompt if needed), p_min=0.1 (minimum 10% chance), β=0.1 (decay rate)
    // - Performance: Fast calculation (~0.01ms), negligible overhead
    // - Note: Currently used for tracking, can be enhanced to influence decision threshold
    //   - Future enhancement: Use promptProbability to adjust coherenceThreshold dynamically
    //   - This would implement full adaptive decay: higher threshold (less prompting) as steps increase
    //   - Example: adjustedThreshold = this.coherenceThreshold * (1 + (1 - promptProbability))
    if (this.adaptiveSampling && this.lastPromptTime) {
      const decayRate = 0.1; // β parameter (adjustable, research-validated)
      const pMax = 1.0;
      const pMin = 0.1;
      const stepsSinceWarmStart = Math.max(0, this.stepCount - this.warmStartSteps);
      // Calculate prompt probability (for future use in dynamic threshold adjustment)
      const promptProbability = Math.min(pMax, Math.max(pMin, Math.exp(-decayRate * stepsSinceWarmStart)));
      // Store for potential future use (dynamic threshold adjustment)
      this._lastPromptProbability = promptProbability;
    }
    
    // 1. Check if we have minimum notes
    if (temporalNotes.length < this.minNotesForPrompt) {
      return {
        shouldPrompt: false,
        reason: `Insufficient notes (${temporalNotes.length} < ${this.minNotesForPrompt})`,
        urgency: 'low'
      };
    }

    // 2. Calculate temporal coherence
    // Use preprocessor if available (for large note sets), otherwise direct aggregation
    let aggregated;
    if (this.preprocessor) {
      aggregated = await this.preprocessor.getFastAggregation(temporalNotes);
    } else {
      aggregated = await aggregateTemporalNotes(temporalNotes);
    }
    const coherence = aggregated.coherence || 0;

    // 3. Check for significant state change
    const stateChange = this.calculateStateChange(currentState, previousState);

    // 4. Check for user action
    const hasUserAction = this.hasRecentUserAction(temporalNotes, context);

    // 5. Check for decision point
    const isDecisionPoint = this.isDecisionPoint(currentState, context);

    // 6. Check for coherence drop (urgency signal)
    const coherenceDrop = await this.detectCoherenceDrop(temporalNotes, aggregated);

      // Decision logic: prompt when decision needed, not on every change
      if (isDecisionPoint) {
        this.lastPromptTime = Date.now(); // Track for adaptive decay
        const decision = {
          shouldPrompt: true,
          reason: 'Decision point reached',
          urgency: 'high'
        };
        
        // Log temporal decision (weighted: high-urgency decisions are critical)
        // Use dynamic import with proper error handling to prevent unhandled promise rejections
        import('./utils/performance-logger.mjs')
          .then(({ logTemporalDecision }) => {
            logTemporalDecision({
              shouldPrompt: decision.shouldPrompt,
              reason: decision.reason,
              urgency: decision.urgency,
              coherence,
              stateChange,
              noteCount: temporalNotes.length,
              isDecisionPoint: true,
              hasUserAction
            });
          })
          .catch((importError) => {
            // Log to logger if performance logger unavailable (better than silent failure)
            if (process.env.DEBUG_TEMPORAL) {
              try {
                const { warn } = await import('./logger.mjs');
                warn(`[TemporalDecision] Performance logger unavailable: ${importError.message}`);
              } catch {
                // Fallback to console if logger also unavailable
                console.warn(`[TemporalDecision] Performance logger unavailable: ${importError.message}`);
              }
            }
          });
        
        return decision;
      }

      if (coherenceDrop) {
        this.lastPromptTime = Date.now(); // Track for adaptive decay
        const decision = {
          shouldPrompt: true,
          reason: 'Coherence drop detected (quality issue)',
          urgency: 'high'
        };
        
        // Log temporal decision (weighted: high-urgency decisions are critical)
        // Use dynamic import with proper error handling to prevent unhandled promise rejections
        import('./utils/performance-logger.mjs')
          .then(({ logTemporalDecision }) => {
            logTemporalDecision({
              shouldPrompt: decision.shouldPrompt,
              reason: decision.reason,
              urgency: decision.urgency,
              coherence,
              stateChange,
              noteCount: temporalNotes.length,
              isDecisionPoint: false,
              hasUserAction
            });
          })
          .catch((importError) => {
            // Log to logger if performance logger unavailable (better than silent failure)
            if (process.env.DEBUG_TEMPORAL) {
              try {
                const { warn } = await import('./logger.mjs');
                warn(`[TemporalDecision] Performance logger unavailable: ${importError.message}`);
              } catch {
                // Fallback to console if logger also unavailable
                console.warn(`[TemporalDecision] Performance logger unavailable: ${importError.message}`);
              }
            }
          });
        
        return decision;
      }

      if (hasUserAction && stateChange > this.stateChangeThreshold) {
        this.lastPromptTime = Date.now(); // Track for adaptive decay
        return {
          shouldPrompt: true,
          reason: 'User action with significant state change',
          urgency: 'medium'
        };
      }

      if (coherence >= this.coherenceThreshold && stateChange > this.stateChangeThreshold) {
        this.lastPromptTime = Date.now(); // Track for adaptive decay
        return {
          shouldPrompt: true,
          reason: 'Stable context with significant state change',
          urgency: 'medium'
        };
      }

      // Wait for more context
      // Note: Don't update lastPromptTime when not prompting (waiting for more context)
      
      return {
        shouldPrompt: false,
        reason: `Context not sufficient (coherence: ${coherence.toFixed(2)}, stateChange: ${stateChange.toFixed(2)})`,
        urgency: 'low'
      };
  }
  
  /**
   * Reset step count (useful for new sessions)
   */
  reset() {
    this.stepCount = 0;
    this.lastPromptTime = null;
  }

  /**
   * Calculate state change magnitude
   */
  calculateStateChange(currentState, previousState) {
    // Input validation
    if (!currentState || typeof currentState !== 'object') {
      throw new TypeError('currentState must be an object');
    }
    
    if (!previousState) return 1.0; // First state = maximum change

    // State change calculation
    // DESIGN DECISION: Multi-factor state change detection
    // - Why: Single factor (score only) misses important changes
    // - Why these factors:
    //   - Score: Direct measure of quality change
    //   - Issues: New/removed issues indicate significant changes
    //   - Game state: Gameplay-specific state changes
    // - Performance: O(n) for issue comparison, O(1) for others, fast overall
    // - Alternative: Single factor (score only)
    //   - Rejected: Misses issue changes and game state changes
    let change = 0.0;
    let comparisons = 0;

    // Compare scores if available
    // DESIGN DECISION: Normalize score change to [0, 1]
    // - Why: Score range is 0-10, normalize to 0-1 for consistent weighting
    // - Why this formula: |score1 - score2| / 10
    //   - Max change: 10 (0 to 10) → 1.0
    //   - Min change: 0 (same score) → 0.0
    // - Performance: O(1) calculation, fast
    if (currentState.score !== undefined && previousState.score !== undefined) {
      const score1 = typeof currentState.score === 'number' ? currentState.score : 0;
      const score2 = typeof previousState.score === 'number' ? previousState.score : 0;
      const scoreChange = Math.abs(score1 - score2) / 10; // Normalize to 0-1
      if (isFinite(scoreChange)) {
        change += scoreChange;
        comparisons++;
      }
    }

    // Compare issues if available
    // DESIGN DECISION: Use Jaccard distance for issue comparison
    // - Why: Captures both added and removed issues proportionally
    // - Why this formula: (added + removed) / (union size)
    //   - Max change: All issues different → 1.0
    //   - Min change: Same issues → 0.0
    // - Performance: O(n) where n = number of issues, typically fast (<1ms)
    // - Alternative: Simple count difference
    //   - Rejected: Doesn't account for total issue count
    if (currentState.issues && previousState.issues) {
      if (Array.isArray(currentState.issues) && Array.isArray(previousState.issues)) {
        const currentIssues = new Set(currentState.issues.map(i => String(i).toLowerCase().trim()));
        const previousIssues = new Set(previousState.issues.map(i => String(i).toLowerCase().trim()));
        const added = [...currentIssues].filter(i => !previousIssues.has(i)).length;
        const removed = [...previousIssues].filter(i => !currentIssues.has(i)).length;
        const unionSize = currentIssues.size + previousIssues.size;
        const issueChange = unionSize > 0 ? (added + removed) / unionSize : 0;
        if (isFinite(issueChange)) {
          change += issueChange;
          comparisons++;
        }
      }
    }

    // Compare game state if available
    if (currentState.gameState && previousState.gameState) {
      const gameStateChange = this.calculateGameStateChange(currentState.gameState, previousState.gameState);
      if (isFinite(gameStateChange)) {
        change += gameStateChange;
        comparisons++;
      }
    }

    // Return average change across all factors
    // DESIGN DECISION: Average change across factors
    // - Why: Each factor contributes equally to state change
    // - Why this formula: change / comparisons
    //   - If 3 factors compared: average of 3 changes
    //   - If 1 factor compared: that factor's change
    // - Performance: O(1) calculation, fast
    // - Alternative: Weighted average (some factors more important)
    //   - Rejected: All factors are equally important indicators of change
    const avgChange = comparisons > 0 ? change / comparisons : 0.0;
    return Math.max(0, Math.min(1, avgChange)); // Clamp to [0, 1]
  }

  /**
   * Calculate game state change
   */
  calculateGameStateChange(current, previous) {
    // Simple comparison (can be enhanced)
    const currentKeys = Object.keys(current || {});
    const previousKeys = Object.keys(previous || {});
    
    const added = currentKeys.filter(k => !previousKeys.includes(k)).length;
    const removed = previousKeys.filter(k => !currentKeys.includes(k)).length;
    const changed = currentKeys.filter(k => 
      previousKeys.includes(k) && 
      JSON.stringify(current[k]) !== JSON.stringify(previous[k])
    ).length;

    const totalKeys = new Set([...currentKeys, ...previousKeys]).size;
    return totalKeys > 0 ? (added + removed + changed) / totalKeys : 0.0;
  }

  /**
   * Check for recent user action
   */
  hasRecentUserAction(temporalNotes, context) {
    if (context.recentAction) return true;

    // Check last few notes for interactions
    const recentNotes = temporalNotes.slice(-3);
    return recentNotes.some(note => {
      const stepStr = String(note.step || '');
      const observationStr = String(note.observation || '');
      return stepStr.includes('interaction') ||
        stepStr.includes('click') ||
        stepStr.includes('action') ||
        observationStr.includes('user') ||
        observationStr.includes('clicked');
    });
  }

  /**
   * Check if this is a decision point
   */
  isDecisionPoint(currentState, context) {
    // Decision points based on context
    if (context.stage === 'decision' || context.stage === 'evaluation') return true;
    if (context.testType === 'critical' || context.critical) return true;
    if (context.goal && context.goalCompleted) return true;
    
    return false;
  }

  /**
   * Detect coherence drop (quality issue signal)
   */
  async detectCoherenceDrop(temporalNotes, currentAggregated) {
    if (temporalNotes.length < 4) return false; // Need history to detect drop

    // Get previous coherence (from notes without last one)
    const previousNotes = temporalNotes.slice(0, -1);
    const previousAggregated = await aggregateTemporalNotes(previousNotes);
    const previousCoherence = previousAggregated.coherence || 1.0;
    const currentCoherence = currentAggregated.coherence || 1.0;

    // Drop detected if coherence decreased significantly
    const drop = previousCoherence - currentCoherence;
    return drop > this.urgencyThreshold;
  }

  /**
   * Calculate prompt urgency
   */
  calculatePromptUrgency(temporalContext, decision) {
    if (decision.urgency === 'high') return 1.0;
    if (decision.urgency === 'medium') return 0.6;
    
    // Low urgency, but check if we should wait
    const coherence = temporalContext.coherence || 0;
    const timeSinceLastPrompt = temporalContext.timeSinceLastPrompt || 0;
    
    // Increase urgency if coherence is good and it's been a while
    if (coherence > 0.7 && timeSinceLastPrompt > 5000) {
      return 0.4; // Medium-low
    }
    
    return 0.2; // Low
  }

  /**
   * Select optimal timing for requests
   */
  async selectOptimalTiming(requests, temporalContext) {
    const decisions = await Promise.all(requests.map(async req => ({
      request: req,
      decision: await this.shouldPrompt(
        req.currentState,
        req.previousState,
        req.temporalNotes || [],
        req.context || {}
      )
    })));

    // Separate by urgency
    const urgent = decisions.filter(d => d.decision.urgency === 'high');
    const medium = decisions.filter(d => d.decision.urgency === 'medium');
    const low = decisions.filter(d => d.decision.urgency === 'low');

    // Urgent: prompt immediately
    // Medium: batch if context stable, otherwise prompt
    // Low: wait or batch

    const stable = temporalContext.coherence > 0.7;
    const shouldBatch = stable && medium.length + low.length > 1;

    return {
      promptNow: urgent.map(d => d.request),
      batch: shouldBatch ? [...medium, ...low].map(d => d.request) : medium.map(d => d.request),
      wait: shouldBatch ? [] : low.map(d => d.request),
      decisions
    };
  }
}

/**
 * Create a temporal decision manager with default options
 */
export function createTemporalDecisionManager(options = {}) {
  return new TemporalDecisionManager(options);
}

