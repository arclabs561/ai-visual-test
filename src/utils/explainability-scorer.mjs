/**
 * Explainability Scoring
 * 
 * Simple heuristic: checks if reasoning exists, mentions the action, and isn't too technical.
 * 
 * Research Context:
 * - Explainability score >80% is often cited as critical for browser automation agents
 * - Users need to understand agent reasoning for trust and debugging
 * - Transparency scores measure communication quality
 * 
 * Implementation:
 * - Simple checks (has action, has target, not too technical, reasonable length) are sufficient
 * - Complex scoring adds computation without clear benefit
 * - The VLLM's reasoning is already human-readable
 * 
 * See docs/research/IMPLEMENTATION_VS_RESEARCH.md for detailed research context.
 * 
 * @module explainability-scorer
 */

/**
 * Score explainability of action reasoning
 * 
 * @param {string} reasoning - Agent's reasoning for an action
 * @param {Object} action - The action taken
 * @param {Object} [options] - Scoring options
 * @returns {Object} Explainability score and analysis
 */
export function scoreExplainability(reasoning, action, options = {}) {
  if (!reasoning || reasoning.trim().length === 0) {
    return {
      score: 0,
      clarity: 0,
      completeness: 0,
      relevance: 0,
      issues: ['No reasoning provided'],
      recommendation: 'Add reasoning to explain why this action was taken'
    };
  }
  
  // Simple scoring: has reasoning, mentions action, not too technical
  const hasAction = action.type && reasoning.toLowerCase().includes(action.type.toLowerCase());
  
  // Check for target: selector, key, or URL - also check for semantic mentions (e.g., "submit button" for selector "#submit")
  let hasTarget = false;
  if (action.selector) {
    // Check for exact selector match or semantic match (e.g., "submit button" for "#submit")
    const selectorLower = action.selector.toLowerCase().replace(/[#.]/g, '');
    const reasoningLower = reasoning.toLowerCase();
    hasTarget = reasoning.includes(action.selector) || 
                (selectorLower && reasoningLower.includes(selectorLower));
  } else if (action.key) {
    hasTarget = reasoning.includes(action.key);
  } else if (action.url) {
    hasTarget = reasoning.includes(action.url);
  }
  
  const notTooTechnical = !reasoning.match(/\b(algorithm|implementation|optimization|paradigm)\b/gi);
  const reasonableLength = reasoning.length > 20 && reasoning.length < 500;
  
  // Completeness: considers both action and target, plus reasoning depth
  const hasDepth = reasoning.split(/[.!?]/).length > 2; // Multiple sentences indicate depth
  const completeness = (hasAction && hasTarget && hasDepth) ? 0.9 :
                       (hasAction && hasTarget) ? 0.8 :
                       (hasAction || hasTarget) ? 0.6 : 0.4;
  
  const score = (hasAction ? 0.4 : 0) + 
                (hasTarget ? 0.3 : 0) + 
                (notTooTechnical ? 0.2 : 0) + 
                (reasonableLength ? 0.1 : 0);
  
  const issues = [];
  if (!hasAction) issues.push('Reasoning does not mention action type');
  if (!hasTarget) issues.push('Reasoning does not mention action target');
  if (!notTooTechnical) issues.push('Reasoning uses technical jargon');
  if (!reasonableLength) issues.push('Reasoning is too short or too long');
  
  return {
    score,
    clarity: notTooTechnical && reasonableLength ? 0.8 : 0.5,
    completeness,
    relevance: hasAction ? 0.8 : 0.5,
    issues,
    recommendation: score >= 0.7
      ? 'Reasoning is clear and relevant'
      : 'Add more context about the action and its target'
  };
}


/**
 * Batch score explainability
 */
export function batchScoreExplainability(reasonings, actions, options = {}) {
  const scores = reasonings.map((reasoning, i) => 
    scoreExplainability(reasoning, actions[i] || {}, options)
  );
  
  const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  const avgClarity = scores.reduce((sum, s) => sum + s.clarity, 0) / scores.length;
  const avgCompleteness = scores.reduce((sum, s) => sum + s.completeness, 0) / scores.length;
  const avgRelevance = scores.reduce((sum, s) => sum + s.relevance, 0) / scores.length;
  
  const meetsTarget = avgScore >= 0.8;
  
  return {
    total: scores.length,
    averageScore: avgScore,
    averageClarity: avgClarity,
    averageCompleteness: avgCompleteness,
    averageRelevance: avgRelevance,
    meetsTarget,
    scores,
    recommendation: meetsTarget
      ? 'Explainability meets target (>80%)'
      : `Explainability ${(avgScore * 100).toFixed(1)}% below target. Improve reasoning clarity, completeness, or relevance.`
  };
}

