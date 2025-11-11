/**
 * Batch Optimizer
 * 
 * Optimizes VLLM API calls by:
 * - Queueing requests for better throughput
 * - Caching responses for identical screenshots
 * - Implementing request pooling with concurrency limits
 * 
 * General-purpose utility - no domain-specific logic.
 */

/**
 * Batch Optimizer Class
 * 
 * Optimizes VLLM API calls by queueing requests and caching responses.
 * 
 * @class BatchOptimizer
 */
export class BatchOptimizer {
  /**
   * @param {{
   *   maxConcurrency?: number;
   *   batchSize?: number;
   *   cacheEnabled?: boolean;
   * }} [options={}] - Optimizer options
   */
  constructor(options = {}) {
    const {
      maxConcurrency = 5,
      batchSize = 3,
      cacheEnabled = true
    } = options;
    
    this.queue = [];
    this.processing = false;
    this.cache = cacheEnabled ? new Map() : null;
    this.batchSize = batchSize;
    this.maxConcurrency = maxConcurrency;
    this.activeRequests = 0;
  }
  
  /**
   * Generate cache key from screenshot path and prompt
   */
  _getCacheKey(imagePath, prompt, context) {
    // Use image path hash + prompt hash for cache key
    const promptHash = prompt ? prompt.substring(0, 100).replace(/\s+/g, '') : '';
    const contextHash = context ? JSON.stringify(context).substring(0, 50) : '';
    return `${imagePath}-${promptHash}-${contextHash}`;
  }
  
  /**
   * Batch validate multiple screenshots
   * 
   * @param {string | string[]} imagePaths - Single image path or array of image paths
   * @param {string} prompt - Validation prompt
   * @param {import('./index.mjs').ValidationContext} [context={}] - Validation context
   * @returns {Promise<import('./index.mjs').ValidationResult[]>} Array of validation results
   */
  async batchValidate(imagePaths, prompt, context = {}) {
    if (!Array.isArray(imagePaths)) {
      imagePaths = [imagePaths];
    }
    
    // Handle empty array
    if (imagePaths.length === 0) {
      return [];
    }
    
    // Process all screenshots in parallel (respecting concurrency limit)
    const results = await Promise.all(
      imagePaths.map(path => this._queueRequest(path, prompt, context))
    );
    
    return results;
  }
  
  /**
   * Queue VLLM request for batch processing
   */
  async _queueRequest(imagePath, prompt, context, validateFn = null) {
    // Check cache first
    if (this.cache) {
      const cacheKey = this._getCacheKey(imagePath, prompt, context);
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }
    }
    
    // If under concurrency limit, process immediately
    if (this.activeRequests < this.maxConcurrency) {
      return this._processRequest(imagePath, prompt, context, validateFn);
    }
    
    // Otherwise, queue for later
    return new Promise((resolve, reject) => {
      this.queue.push({ imagePath, prompt, context, validateFn, resolve, reject });
      this._processQueue();
    });
  }
  
  /**
   * Process a single request
   */
  async _processRequest(imagePath, prompt, context, validateFn) {
    if (!validateFn) {
      // Import validateScreenshot if not provided
      const { validateScreenshot } = await import('./judge.mjs');
      validateFn = validateScreenshot;
    }
    
    this.activeRequests++;
    
    try {
      const result = await validateFn(imagePath, prompt, context);
      
      // Cache result if enabled
      if (this.cache) {
        const cacheKey = this._getCacheKey(imagePath, prompt, context);
        this.cache.set(cacheKey, result);
      }
      
      return result;
    } finally {
      this.activeRequests--;
      this._processQueue();
    }
  }
  
  /**
   * Process queued requests
   */
  async _processQueue() {
    if (this.processing || this.queue.length === 0 || this.activeRequests >= this.maxConcurrency) {
      return;
    }
    
    this.processing = true;
    
    try {
      while (this.queue.length > 0 && this.activeRequests < this.maxConcurrency) {
        const batch = this.queue.splice(0, this.batchSize);
        
        // Process batch in parallel
        const promises = batch.map(async ({ imagePath, prompt, context, validateFn, resolve, reject }) => {
          try {
            // Check cache again (might have been added by another request)
            if (this.cache) {
              const cacheKey = this._getCacheKey(imagePath, prompt, context);
              if (this.cache.has(cacheKey)) {
                resolve(this.cache.get(cacheKey));
                return;
              }
            }
            
            const result = await this._processRequest(imagePath, prompt, context, validateFn);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
        
        // Wait for batch to complete before processing next batch
        await Promise.allSettled(promises);
      }
    } finally {
      this.processing = false;
    }
  }
  
  /**
   * Clear cache (useful for testing)
   * 
   * @returns {void}
   */
  clearCache() {
    if (this.cache) {
      this.cache.clear();
    }
  }
  
  /**
   * Get cache stats
   * 
   * @returns {{ cacheSize: number; queueLength: number; activeRequests: number }} Cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: this.cache ? this.cache.size : 0,
      queueLength: this.queue.length,
      activeRequests: this.activeRequests
    };
  }
}

