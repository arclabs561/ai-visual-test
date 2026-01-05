/**
 * Performance Measurement Utilities
 * 
 * Provides utilities for measuring and tracking performance metrics
 * across the system. Useful for identifying bottlenecks and optimizing.
 */

import { log, warn } from '../logger.mjs';

// Use performance.now() if available (Node.js 16.5+), otherwise use Date.now()
const getHighResTime = typeof performance !== 'undefined' && performance.now
  ? () => performance.now()
  : () => Date.now();

/**
 * Performance measurement class
 */
export class PerformanceMeasurement {
  constructor(name, options = {}) {
    this.name = name;
    this.startTime = null;
    this.endTime = null;
    this.marks = [];
    this.metadata = options.metadata || {};
    this.autoLog = options.autoLog !== false; // Default true
  }

  /**
   * Start measurement
   */
  start() {
    this.startTime = getHighResTime();
    this.marks = [];
    return this;
  }

  /**
   * Mark a checkpoint
   * 
   * @param {string} label - Checkpoint label
   * @param {Object} [metadata={}] - Additional metadata
   */
  mark(label, metadata = {}) {
    const now = getHighResTime();
    const elapsed = this.startTime ? now - this.startTime : 0;
    
    this.marks.push({
      label,
      timestamp: now,
      elapsed,
      metadata
    });
    
    return this;
  }

  /**
   * End measurement
   * 
   * @param {Object} [metadata={}] - Final metadata
   * @returns {Object} Measurement result
   */
  end(metadata = {}) {
    this.endTime = getHighResTime();
    const duration = this.startTime ? this.endTime - this.startTime : 0;
    
    const result = {
      name: this.name,
      duration,
      durationMs: duration.toFixed(2),
      marks: this.marks,
      metadata: { ...this.metadata, ...metadata }
    };
    
    if (this.autoLog) {
      log(`[Performance] ${this.name}: ${duration.toFixed(2)}ms`);
      if (this.marks.length > 0) {
        this.marks.forEach(mark => {
          log(`  - ${mark.label}: ${mark.elapsed.toFixed(2)}ms`);
        });
      }
    }
    
    return result;
  }

  /**
   * Get current elapsed time without ending
   */
  getElapsed() {
    if (!this.startTime) return 0;
    return getHighResTime() - this.startTime;
  }
}

/**
 * Measure async function execution
 * 
 * @param {string} name - Measurement name
 * @param {Function} fn - Async function to measure
 * @param {Object} [options={}] - Measurement options
 * @returns {Promise<*>} Function result
 */
export async function measureAsync(name, fn, options = {}) {
  const measurement = new PerformanceMeasurement(name, options);
  measurement.start();
  
  try {
    const result = await fn();
    const measurementResult = measurement.end({ success: true });
    return { result, measurement: measurementResult };
  } catch (error) {
    measurement.end({ success: false, error: error.message });
    throw error;
  }
}

/**
 * Measure sync function execution
 * 
 * @param {string} name - Measurement name
 * @param {Function} fn - Sync function to measure
 * @param {Object} [options={}] - Measurement options
 * @returns {*} Function result
 */
export function measureSync(name, fn, options = {}) {
  const measurement = new PerformanceMeasurement(name, options);
  measurement.start();
  
  try {
    const result = fn();
    const measurementResult = measurement.end({ success: true });
    return { result, measurement: measurementResult };
  } catch (error) {
    measurement.end({ success: false, error: error.message });
    throw error;
  }
}

/**
 * Performance profiler for tracking multiple operations
 */
export class PerformanceProfiler {
  constructor() {
    this.measurements = [];
    this.active = new Map();
  }

  /**
   * Start profiling an operation
   * 
   * @param {string} name - Operation name
   * @param {Object} [metadata={}] - Metadata
   * @returns {string} Profile ID
   */
  start(name, metadata = {}) {
    const id = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const measurement = new PerformanceMeasurement(name, { metadata, autoLog: false });
    measurement.start();
    this.active.set(id, measurement);
    return id;
  }

  /**
   * End profiling an operation
   * 
   * @param {string} id - Profile ID
   * @param {Object} [metadata={}] - Final metadata
   * @returns {Object} Measurement result
   */
  end(id, metadata = {}) {
    const measurement = this.active.get(id);
    if (!measurement) {
      warn(`[PerformanceProfiler] No active measurement found for ID: ${id}`);
      return null;
    }
    
    this.active.delete(id);
    const result = measurement.end(metadata);
    this.measurements.push(result);
    return result;
  }

  /**
   * Get summary statistics
   * 
   * @returns {Object} Summary statistics
   */
  getSummary() {
    if (this.measurements.length === 0) {
      return { count: 0 };
    }
    
    const durations = this.measurements.map(m => m.duration);
    const total = durations.reduce((sum, d) => sum + d, 0);
    const average = total / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    
    // Calculate percentiles
    const sorted = [...durations].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    // Group by name
    const byName = {};
    this.measurements.forEach(m => {
      if (!byName[m.name]) {
        byName[m.name] = { count: 0, total: 0, durations: [] };
      }
      byName[m.name].count += 1;
      byName[m.name].total += m.duration;
      byName[m.name].durations.push(m.duration);
    });
    
    // Calculate averages by name
    Object.keys(byName).forEach(name => {
      const data = byName[name];
      data.average = data.total / data.count;
      data.min = Math.min(...data.durations);
      data.max = Math.max(...data.durations);
      delete data.durations; // Remove raw durations
    });
    
    return {
      count: this.measurements.length,
      total: total.toFixed(2),
      average: average.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      p50: p50.toFixed(2),
      p95: p95.toFixed(2),
      p99: p99.toFixed(2),
      byName
    };
  }

  /**
   * Reset profiler
   */
  reset() {
    this.measurements = [];
    this.active.clear();
  }

  /**
   * Clear measurements (alias for reset)
   */
  clear() {
    this.reset();
  }

  /**
   * Export measurements
   * 
   * @returns {Array} All measurements
   */
  export() {
    return [...this.measurements];
  }
}

/**
 * Global profiler instance
 */
let globalProfiler = null;

/**
 * Get global profiler instance
 * 
 * @returns {PerformanceProfiler} Profiler instance
 */
export function getProfiler() {
  if (!globalProfiler) {
    globalProfiler = new PerformanceProfiler();
  }
  return globalProfiler;
}

