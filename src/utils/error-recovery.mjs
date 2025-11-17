/**
 * Error Recovery for Browser Automation
 * 
 * Simple retry logic: wait and retry, or try alternative action.
 * 
 * Research Context:
 * - Error recovery success rate >70% is often cited as critical for browser automation agents
 * - Agents should gracefully handle failures and try alternatives
 * - Need to avoid infinite retry loops
 * 
 * Implementation:
 * - Most errors are timeouts or element not found - simple wait + retry handles these
 * - Complex error classification adds complexity without clear benefit
 * - The VLLM can handle complex error recovery during action execution
 * 
 * See docs/research/IMPLEMENTATION_VS_RESEARCH.md for detailed research context.
 * 
 * @module error-recovery
 */

/**
 * Error recovery strategy
 */
export class ErrorRecoveryStrategy {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.recoveryHistory = [];
  }
  
  /**
   * Attempt to recover from error
   * 
   * @param {Error} error - The error that occurred
   * @param {Object} action - The action that failed
   * @param {Object} context - Current context (page, state, etc.)
   * @returns {Promise<Object|null>} Recovery action or null if no recovery possible
   */
  async attemptRecovery(error, action, context = {}) {
    if (this.recoveryHistory.length >= this.maxRetries) {
      return null; // Max retries reached
    }
    
    const recovery = this.generateRecoveryAction(error, action, context);
    
    if (!recovery) {
      return null; // No recovery strategy available
    }
    
    this.recoveryHistory.push({
      error: error.message,
      action,
      recovery,
      timestamp: Date.now()
    });
    
    return recovery;
  }
  
  /**
   * Generate recovery action based on error type
   * 
   * Simple strategy: wait longer for timeouts/network, wait and retry for others.
   */
  generateRecoveryAction(error, action, context) {
    const errorMessage = error.message.toLowerCase();
    
    // Timeout or network errors: wait longer
    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return {
        type: 'wait',
        duration: this.retryDelay * 2,
        reason: 'Timeout/network error, waiting longer',
        originalAction: action
      };
    }
    
    // Everything else: wait and retry
    return {
      type: 'wait',
      duration: this.retryDelay,
      reason: 'Error occurred, waiting and retrying',
      originalAction: action
    };
  }
  
  /**
   * Reset recovery state
   */
  reset() {
    this.recoveryHistory = [];
  }
  
  /**
   * Get recovery statistics
   */
  getStats() {
    const successful = this.recoveryHistory.filter(r => r.success).length;
    const total = this.recoveryHistory.length;
    const successRate = total > 0 ? successful / total : 0;
    
    return {
      totalRecoveries: total,
      successfulRecoveries: successful,
      successRate,
      recoveries: this.recoveryHistory
    };
  }
}

/**
 * Create error recovery strategy
 */
export function createErrorRecoveryStrategy(options = {}) {
  return new ErrorRecoveryStrategy(options);
}

