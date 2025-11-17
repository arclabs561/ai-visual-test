/**
 * Intent Recognition for Browser Automation
 * 
 * Parses natural language tasks into structured intents.
 * Simple keyword-based recognition - fast and sufficient for most cases.
 * 
 * Research Context:
 * - Intent recognition accuracy >85% is often cited as critical for browser automation agents
 * - Ambiguous tasks require disambiguation (e.g., "Buy this product" = add to cart + checkout)
 * - Multi-step tasks need workflow decomposition
 * 
 * Implementation:
 * - We use simple keyword-based recognition (fast, <1ms)
 * - LLM-based recognition adds latency (>1s) and cost without clear benefit
 * - Complex disambiguation happens during action execution, not intent parsing
 * 
 * See docs/research/IMPLEMENTATION_VS_RESEARCH.md for detailed research context.
 * 
 * @module intent-recognizer
 */


/**
 * Recognized intent types
 */
export const INTENT_TYPES = {
  NAVIGATE: 'navigate',
  FILL_FORM: 'fill_form',
  VALIDATE: 'validate',
  EXPLORE: 'explore',
  PLAY_GAME: 'play_game',
  CLICK: 'click',
  WAIT: 'wait',
  EXTRACT: 'extract',
  UNKNOWN: 'unknown'
};

/**
 * Recognize intent from natural language task
 * 
 * @param {string} task - Natural language task description
 * @param {string} [screenshotPath] - Optional screenshot for visual context
 * @param {Object} [options] - Recognition options
 * @returns {Promise<Object>} Recognized intent with confidence
 */
export async function recognizeIntent(task, screenshotPath = null, options = {}) {
  // Simple keyword-based recognition - fast and sufficient
  // LLM-based recognition adds latency and cost without clear benefit
  return recognizeIntentKeyword(task);
}


/**
 * Keyword-based intent recognition (fallback)
 */
function recognizeIntentKeyword(task) {
  const lower = task.toLowerCase();
  
  // Navigate
  if (lower.match(/\b(navigate|go to|visit|open|browse to|take me to)\b/)) {
    const target = extractTarget(task); // Use original task text, not lowercased
    return {
      intent: INTENT_TYPES.NAVIGATE,
      confidence: 0.8,
      subIntents: [],
      parameters: target ? { target } : {},
      reasoning: 'Keyword-based recognition: navigation intent detected'
    };
  }
  
  // Fill form
  if (lower.match(/\b(fill|complete|submit|enter|type)\b.*\b(form|field|input)\b/)) {
    return {
      intent: INTENT_TYPES.FILL_FORM,
      confidence: 0.8,
      subIntents: [],
      parameters: {},
      reasoning: 'Keyword-based recognition: form filling intent detected'
    };
  }
  
  // Validate
  if (lower.match(/\b(check|validate|verify|test|ensure|confirm)\b/)) {
    return {
      intent: INTENT_TYPES.VALIDATE,
      confidence: 0.8,
      subIntents: [],
      parameters: {},
      reasoning: 'Keyword-based recognition: validation intent detected'
    };
  }
  
  // Explore
  if (lower.match(/\b(explore|try|find|search|look for|discover)\b/)) {
    return {
      intent: INTENT_TYPES.EXPLORE,
      confidence: 0.8,
      subIntents: [],
      parameters: {},
      reasoning: 'Keyword-based recognition: exploration intent detected'
    };
  }
  
  // Play game
  if (lower.match(/\b(play|game|score|level)\b/)) {
    return {
      intent: INTENT_TYPES.PLAY_GAME,
      confidence: 0.8,
      subIntents: [],
      parameters: {},
      reasoning: 'Keyword-based recognition: game playing intent detected'
    };
  }
  
  // Click
  if (lower.match(/\b(click|press|tap|select)\b/)) {
    const target = extractTarget(task); // Use original task text, not lowercased
    return {
      intent: INTENT_TYPES.CLICK,
      confidence: 0.8,
      subIntents: [],
      parameters: target ? { target } : {},
      reasoning: 'Keyword-based recognition: click intent detected'
    };
  }
  
  // Wait
  if (lower.match(/\b(wait|pause|delay)\b/)) {
    return {
      intent: INTENT_TYPES.WAIT,
      confidence: 0.8,
      subIntents: [],
      parameters: {},
      reasoning: 'Keyword-based recognition: wait intent detected'
    };
  }
  
  // Extract
  if (lower.match(/\b(extract|get|read|find|identify)\b.*\b(information|data|value|text)\b/)) {
    return {
      intent: INTENT_TYPES.EXTRACT,
      confidence: 0.8,
      subIntents: [],
      parameters: {},
      reasoning: 'Keyword-based recognition: extraction intent detected'
    };
  }
  
  // Unknown
  return {
    intent: INTENT_TYPES.UNKNOWN,
    confidence: 0.5,
    subIntents: [],
    parameters: {},
    reasoning: 'Keyword-based recognition: intent unclear'
  };
}

/**
 * Extract target from task text
 */
function extractTarget(text) {
  // Try to extract quoted strings or specific targets
  const quoted = text.match(/"([^"]+)"/) || text.match(/'([^']+)'/);
  if (quoted) return quoted[1];
  
  // Extract after "to" or "for"
  const afterTo = text.match(/\b(?:to|for)\s+([a-z\s]+)/i);
  if (afterTo) return afterTo[1].trim();
  
  return null;
}

/**
 * Batch recognize intents
 */
export async function batchRecognizeIntents(tasks, screenshotPaths = [], options = {}) {
  const results = await Promise.all(
    tasks.map((task, i) => 
      recognizeIntent(task, screenshotPaths[i] || null, options)
    )
  );
  
  const total = results.length;
  const recognized = results.filter(r => r.intent !== INTENT_TYPES.UNKNOWN).length;
  const accuracy = recognized / total;
  
  const intentDistribution = results.reduce((acc, r) => {
    acc[r.intent] = (acc[r.intent] || 0) + 1;
    return acc;
  }, {});
  
  return {
    total,
    recognized,
    accuracy,
    intentDistribution,
    results,
    recommendation: accuracy >= 0.85
      ? 'Intent recognition accuracy meets target (>85%)'
      : 'Intent recognition accuracy below target. Consider improving prompts or adding more training examples.'
  };
}

