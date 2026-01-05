/**
 * Shared embedding utilities
 * 
 * Provides common functions used by both instruction-tuned and general embeddings
 */

/**
 * Calculate cosine similarity between two vectors
 * 
 * Research: Cosine similarity is the standard metric for comparing embeddings
 * - Range: -1 to 1 (typically 0 to 1 for normalized embeddings)
 * - 1.0 = identical, 0.0 = orthogonal, -1.0 = opposite
 * - For normalized embeddings, values are typically 0-1
 * 
 * @param {number[]} vec1 - First vector
 * @param {number[]} vec2 - Second vector
 * @returns {number} Similarity score (0-1 for normalized embeddings)
 */
export function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || !Array.isArray(vec1) || !Array.isArray(vec2)) {
    return 0;
  }
  
  if (vec1.length !== vec2.length) {
    return 0;
  }
  
  if (vec1.length === 0) {
    return 0;
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    const v1 = vec1[i];
    const v2 = vec2[i];
    
    // Handle NaN and Infinity
    if (!isFinite(v1) || !isFinite(v2)) {
      continue;
    }
    
    dotProduct += v1 * v2;
    norm1 += v1 * v1;
    norm2 += v2 * v2;
  }
  
  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (denominator === 0 || !isFinite(denominator)) {
    return 0;
  }
  
  const similarity = dotProduct / denominator;
  
  // Clamp to [0, 1] for normalized embeddings (shouldn't be negative, but safety check)
  return Math.max(0, Math.min(1, similarity));
}

/**
 * Normalize a vector to unit length
 * 
 * @param {number[]} vec - Vector to normalize
 * @returns {number[]} Normalized vector
 */
export function normalizeVector(vec) {
  if (!vec || !Array.isArray(vec) || vec.length === 0) {
    return vec;
  }
  
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0 || !isFinite(norm)) {
    return vec;
  }
  
  return vec.map(v => v / norm);
}

/**
 * Calculate Euclidean distance between two vectors
 * 
 * @param {number[]} vec1 - First vector
 * @param {number[]} vec2 - Second vector
 * @returns {number} Distance (0 = identical, larger = more different)
 */
export function euclideanDistance(vec1, vec2) {
  if (!vec1 || !vec2 || !Array.isArray(vec1) || !Array.isArray(vec2)) {
    return Infinity;
  }
  
  if (vec1.length !== vec2.length) {
    return Infinity;
  }
  
  let sumSquaredDiff = 0;
  for (let i = 0; i < vec1.length; i++) {
    const diff = vec1[i] - vec2[i];
    sumSquaredDiff += diff * diff;
  }
  
  return Math.sqrt(sumSquaredDiff);
}

/**
 * Convert cosine similarity to distance
 * 
 * @param {number} similarity - Cosine similarity (0-1)
 * @returns {number} Distance (0 = identical, 1 = orthogonal)
 */
export function similarityToDistance(similarity) {
  return 1 - similarity;
}

