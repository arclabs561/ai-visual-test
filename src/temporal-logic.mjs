/**
 * Temporal Decision Logic
 * 
 * Extracted from VLLM Judge to improve testability and reduce complexity.
 * Handles the decision of whether to prompt the LLM based on temporal notes and state.
 */

import { log } from './logger.mjs';
import { safeLogTemporalDecision } from './safe-logger.mjs';

/**
 * Evaluate temporal decision and handle logging/metrics
 * 
 * @param {Object} context - Validation context
 * @param {Object} config - Judge configuration
 * @returns {Promise<Object|null>} Result if decision is to skip, null if we should proceed
 */
export async function evaluateTemporalDecision(context, config) {
  // Only prompt when decision is needed, not on every state change
  if (!context.useTemporalDecision || !context.temporalNotes || context.temporalNotes.length === 0) {
    return null; // Proceed with validation
  }

  try {
    // Dynamic import to avoid circular dependencies if any
    const { TemporalDecisionManager } = await import('./temporal-decision-manager.mjs');
    const { aggregateTemporalNotes } = await import('./temporal.mjs');
    
    const decisionManager = new TemporalDecisionManager(context.temporalDecisionOptions || {});
    const currentState = { score: null, issues: [], ...context.currentState };
    const previousState = context.previousState || null;
    
    // Make decision
    const decision = await decisionManager.shouldPrompt(
      currentState, 
      previousState, 
      context.temporalNotes, 
      context
    );
    
    // Log decision reasoning
    try {
      const aggregated = await aggregateTemporalNotes(context.temporalNotes).catch(() => ({ coherence: null }));
      safeLogTemporalDecision({
        shouldPrompt: decision.shouldPrompt,
        reason: decision.reason,
        urgency: decision.urgency,
        coherence: aggregated.coherence,
        stateChange: decisionManager.calculateStateChange(currentState, previousState),
        noteCount: context.temporalNotes.length,
        isDecisionPoint: decisionManager.isDecisionPoint(currentState, context),
        hasUserAction: decisionManager.hasRecentUserAction(context.temporalNotes, context)
      });
    } catch {
      // Ignore logging errors
    }
    
    // Handle decision
    if (!decision.shouldPrompt && decision.urgency !== 'high') {
      // Don't prompt yet - return cached or previous result
      if (context.previousResult) {
        trackMetrics(false);
        
        return {
          ...context.previousResult,
          skipped: true,
          skipReason: decision.reason,
          urgency: decision.urgency
        };
      }
      // If no previous result, we proceed but marked as low urgency
    }
    
    // Proceeding with validation
    trackMetrics(true);
    return null; // Null means "proceed with validation"

  } catch (error) {
    // If TemporalDecisionManager fails, proceed with validation (graceful degradation)
    if (config.debug?.verbose) {
      log(`[VLLM] TemporalDecisionManager error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Track metrics for temporal decisions
 */
async function trackMetrics(prompted) {
  try {
    const { researchMetrics } = await import('../evaluation/metrics/research-metrics-collector.mjs');
    researchMetrics.recordTemporalDecision('with', {
      llmCalls: prompted ? 1 : 0,
      skipped: !prompted,
      accuracy: null,
      latency: prompted ? null : 0,
      cost: prompted ? null : 0
    });
  } catch (error) {
    // Silently fail metrics tracking
  }
}

