/**
 * Cache Statistics and Monitoring Utilities
 * 
 * Provides utilities for monitoring cache performance and health.
 * Useful for debugging cache issues and optimizing cache hit rates.
 */

import { getCacheStats } from '../cache.mjs';
import { getCacheStats as getEmbeddingCacheStats } from '../../evaluation/utils/embedding-cache.mjs';

/**
 * Get comprehensive cache statistics across all cache systems
 * 
 * @returns {Object} Combined cache statistics
 */
export function getAllCacheStats() {
  const vllmStats = getCacheStats();
  let embeddingStats = null;
  
  try {
    embeddingStats = getEmbeddingCacheStats();
  } catch {
    // Embedding cache might not be available
  }

  return {
    vllm: {
      size: vllmStats.size,
      maxSize: 1000, // MAX_CACHE_SIZE
      maxAge: vllmStats.maxAge,
      utilization: `${((vllmStats.size / 1000) * 100).toFixed(1)}%`,
      cacheFile: vllmStats.cacheFile,
      atomicWrites: vllmStats.atomicWrites || 0,
      atomicWriteFailures: vllmStats.atomicWriteFailures || 0,
      atomicWriteSuccessRate: vllmStats.atomicWriteSuccessRate || 100
    },
    embedding: embeddingStats ? {
      size: embeddingStats.size,
      maxSize: embeddingStats.maxSize,
      utilization: embeddingStats.utilization
    } : null
  };
}

/**
 * Format cache statistics for human-readable display
 * 
 * @param {Object} [stats=null] - Optional stats object (if null, fetches current stats)
 * @returns {string} Formatted statistics string
 */
export function formatCacheStats(stats = null) {
  const allStats = stats || getAllCacheStats();
  
  const lines = [
    '=== Cache Statistics ===',
    '',
    'VLLM Cache (Vision + Text LLM):',
    `  Size: ${allStats.vllm.size} / ${allStats.vllm.maxSize} entries (${allStats.vllm.utilization})`,
    `  Max Age: ${Math.floor(allStats.vllm.maxAge / (1000 * 60 * 60 * 24))} days`,
    `  Cache File: ${allStats.vllm.cacheFile}`,
    `  Atomic Writes: ${allStats.vllm.atomicWrites} (${allStats.vllm.atomicWriteSuccessRate.toFixed(1)}% success rate)`,
    ''
  ];

  if (allStats.embedding) {
    lines.push(
      'Embedding Cache:',
      `  Size: ${allStats.embedding.size} / ${allStats.embedding.maxSize} entries (${allStats.embedding.utilization})`,
      ''
    );
  }

  lines.push('=== End Cache Statistics ===');
  
  return lines.join('\n');
}

/**
 * Check cache health and return warnings if any issues detected
 * 
 * @returns {Array<string>} Array of warning messages (empty if healthy)
 */
export function checkCacheHealth() {
  const warnings = [];
  const stats = getAllCacheStats();

  // Check VLLM cache utilization
  if (stats.vllm.size > 900) {
    warnings.push(`VLLM cache is nearly full (${stats.vllm.size}/1000 entries). Consider clearing old entries.`);
  }

  // Check atomic write success rate
  if (stats.vllm.atomicWriteSuccessRate < 95 && stats.vllm.atomicWrites > 10) {
    warnings.push(`Low atomic write success rate: ${stats.vllm.atomicWriteSuccessRate.toFixed(1)}%. Check disk permissions.`);
  }

  // Check embedding cache utilization
  if (stats.embedding && parseInt(stats.embedding.utilization) > 90) {
    warnings.push(`Embedding cache is nearly full (${stats.embedding.utilization}). Consider increasing limit.`);
  }

  return warnings;
}

