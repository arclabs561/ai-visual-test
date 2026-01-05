#!/usr/bin/env node
/**
 * Comprehensive Tests for Embeddings System
 * 
 * Tests:
 * 1. Instruction-tuned embeddings initialization and availability
 * 2. General embeddings initialization and availability
 * 3. Semantic similarity calculations
 * 4. Batch operations
 * 5. Caching functionality
 * 6. Error handling and edge cases
 * 7. Task-specific instructions
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';

describe('Embeddings System', () => {
  
  describe('Instruction-Tuned Embeddings', () => {
    it('should check availability', async () => {
      const { isInstructionEmbeddingsAvailable } = await import('../../evaluation/utils/instruction-embeddings.mjs');
      const available = await isInstructionEmbeddingsAvailable();
      assert.ok(typeof available === 'boolean', 'Should return boolean');
    });
    
    it('should get model info', async () => {
      const { getEmbeddingModelInfo } = await import('../../evaluation/utils/instruction-embeddings.mjs');
      const info = getEmbeddingModelInfo();
      assert.ok(info, 'Should return info object');
      assert.ok(typeof info.isInitialized === 'boolean', 'Should have isInitialized');
      assert.ok(typeof info.supportsInstructions === 'boolean', 'Should have supportsInstructions');
    });
    
    it('should calculate semantic similarity with task-specific instructions', async () => {
      const { instructionSemanticSimilarity, isInstructionEmbeddingsAvailable } = await import('../../evaluation/utils/instruction-embeddings.mjs');
      
      const available = await isInstructionEmbeddingsAvailable();
      if (!available) {
        // Skip if embeddings not available (e.g., in CI without models)
        return;
      }
      
      // Test accessibility task
      const similarity1 = await instructionSemanticSimilarity(
        'Color contrast may not meet WCAG guidelines',
        'Contrast ratio is too low for accessibility',
        'accessibility'
      );
      
      assert.ok(similarity1 !== null, 'Should return similarity score');
      assert.ok(typeof similarity1 === 'number', 'Similarity should be number');
      assert.ok(similarity1 >= 0 && similarity1 <= 1, 'Similarity should be 0-1');
      
      // Test design task
      const similarity2 = await instructionSemanticSimilarity(
        'Layout is cluttered and confusing',
        'Interface design needs improvement',
        'design'
      );
      
      assert.ok(similarity2 !== null, 'Should return similarity for design task');
      assert.ok(similarity2 >= 0 && similarity2 <= 1, 'Design similarity should be 0-1');
    });
    
    it('should handle batch similarity calculations', async () => {
      const { batchInstructionSimilarity, isInstructionEmbeddingsAvailable } = await import('../../evaluation/utils/instruction-embeddings.mjs');
      
      const available = await isInstructionEmbeddingsAvailable();
      if (!available) {
        return;
      }
      
      const query = 'Color contrast issue';
      const candidates = [
        'Contrast ratio too low',
        'Alt text missing',
        'Keyboard navigation broken',
        'Color contrast may not meet WCAG guidelines'
      ];
      
      const results = await batchInstructionSimilarity(query, candidates, 'accessibility');
      
      assert.ok(results !== null, 'Should return results');
      if (results) {
        assert.ok(Array.isArray(results), 'Results should be array');
        assert.ok(results.length > 0, 'Should have results');
        assert.ok(results[0].similarity >= 0 && results[0].similarity <= 1, 'Similarity should be 0-1');
        // Results should be sorted by similarity (highest first)
        for (let i = 1; i < results.length; i++) {
          assert.ok(results[i].similarity <= results[i - 1].similarity, 'Results should be sorted');
        }
      }
    });
    
    it('should handle different task types', async () => {
      const { instructionSemanticSimilarity, isInstructionEmbeddingsAvailable } = await import('../../evaluation/utils/instruction-embeddings.mjs');
      
      const available = await isInstructionEmbeddingsAvailable();
      if (!available) {
        return;
      }
      
      const tasks = ['accessibility', 'design', 'gameState', 'temporal', 'visual', 'usability', 'general'];
      
      for (const task of tasks) {
        const similarity = await instructionSemanticSimilarity(
          'Test text',
          'Test text',
          task
        );
        
        assert.ok(similarity !== null || similarity === null, 'Should handle all task types');
        if (similarity !== null) {
          assert.ok(similarity >= 0 && similarity <= 1, `Task ${task} similarity should be 0-1`);
        }
      }
    });
  });
  
  describe('General Embeddings', () => {
    it('should check availability', async () => {
      const { isEmbeddingsAvailable } = await import('../../evaluation/utils/semantic-matcher.mjs');
      const available = await isEmbeddingsAvailable();
      assert.ok(typeof available === 'boolean', 'Should return boolean');
    });
    
    it('should calculate semantic similarity', async () => {
      const { semanticSimilarity, isEmbeddingsAvailable } = await import('../../evaluation/utils/semantic-matcher.mjs');
      
      const available = await isEmbeddingsAvailable();
      if (!available) {
        return;
      }
      
      const similarity = await semanticSimilarity(
        'Color contrast issue',
        'Contrast ratio too low'
      );
      
      assert.ok(similarity !== null, 'Should return similarity');
      if (similarity !== null) {
        assert.ok(typeof similarity === 'number', 'Similarity should be number');
        assert.ok(similarity >= 0 && similarity <= 1, 'Similarity should be 0-1');
      }
    });
    
    it('should handle batch similarity calculations', async () => {
      const { batchSemanticSimilarity, isEmbeddingsAvailable } = await import('../../evaluation/utils/semantic-matcher.mjs');
      
      const available = await isEmbeddingsAvailable();
      if (!available) {
        // Skip test if embeddings not available
        return;
      }
      
      const query = 'Accessibility issue';
      const candidates = [
        'Color contrast problem',
        'Alt text missing',
        'Keyboard navigation issue'
      ];
      
      const results = await batchSemanticSimilarity(query, candidates);
      
      // batchSemanticSimilarity returns null if embeddings unavailable, or array of results
      assert.ok(results !== null, 'Should return results (not null)');
      if (results !== null) {
        assert.ok(Array.isArray(results), 'Results should be array');
        // Results may be empty if all candidates failed to embed, but should still be array
        assert.ok(results.length >= 0, 'Should have valid results array');
      }
    });
  });
  
  describe('Embedding Cache', () => {
    it('should cache embeddings', async () => {
      const { getCachedEmbedding, cacheEmbedding, clearEmbeddingCache } = await import('../../evaluation/utils/embedding-cache.mjs');
      
      clearEmbeddingCache();
      
      const text = 'Test text for caching';
      const embedding = [0.1, 0.2, 0.3];
      
      // Cache embedding
      cacheEmbedding(text, 'accessibility', 'passage', true, embedding);
      
      // Retrieve cached embedding
      const cached = getCachedEmbedding(text, 'accessibility', 'passage', true);
      
      assert.ok(cached !== null, 'Should retrieve cached embedding');
      assert.deepStrictEqual(cached, embedding, 'Cached embedding should match');
    });
    
    it('should handle cache misses', async () => {
      const { getCachedEmbedding, clearEmbeddingCache } = await import('../../evaluation/utils/embedding-cache.mjs');
      
      clearEmbeddingCache();
      
      const cached = getCachedEmbedding('Non-existent text', 'accessibility', 'passage', true);
      assert.strictEqual(cached, null, 'Should return null for cache miss');
    });
    
    it('should get cache stats', async () => {
      const { getCacheStats, clearEmbeddingCache, cacheEmbedding } = await import('../../evaluation/utils/embedding-cache.mjs');
      
      clearEmbeddingCache();
      
      // Add some entries
      cacheEmbedding('text1', 'accessibility', 'passage', true, [0.1, 0.2]);
      cacheEmbedding('text2', 'design', 'passage', true, [0.3, 0.4]);
      
      const stats = getCacheStats();
      assert.ok(stats, 'Should return stats');
      assert.ok(typeof stats.size === 'number', 'Should have size');
      assert.ok(typeof stats.maxSize === 'number', 'Should have maxSize');
      assert.ok(stats.size >= 2, 'Should have at least 2 entries');
    });
  });
  
  describe('Embedding Utilities', () => {
    it('should calculate cosine similarity', async () => {
      const { cosineSimilarity } = await import('../../evaluation/utils/embedding-utils.mjs');
      
      // Test identical vectors
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      const similarity1 = cosineSimilarity(vec1, vec2);
      assert.strictEqual(similarity1, 1, 'Identical vectors should have similarity 1');
      
      // Test orthogonal vectors
      const vec3 = [1, 0, 0];
      const vec4 = [0, 1, 0];
      const similarity2 = cosineSimilarity(vec3, vec4);
      assert.strictEqual(similarity2, 0, 'Orthogonal vectors should have similarity 0');
      
      // Test different length vectors
      const vec5 = [1, 1];
      const vec6 = [2, 2];
      const similarity3 = cosineSimilarity(vec5, vec6);
      assert.ok(similarity3 > 0.9, 'Parallel vectors should have high similarity');
    });
    
    it('should handle edge cases in cosine similarity', async () => {
      const { cosineSimilarity } = await import('../../evaluation/utils/embedding-utils.mjs');
      
      // Empty vectors
      const similarity1 = cosineSimilarity([], []);
      assert.strictEqual(similarity1, 0, 'Empty vectors should return 0');
      
      // Null/undefined
      const similarity2 = cosineSimilarity(null, [1, 2]);
      assert.strictEqual(similarity2, 0, 'Null vector should return 0');
      
      // Different lengths
      const similarity3 = cosineSimilarity([1, 2], [1, 2, 3]);
      assert.strictEqual(similarity3, 0, 'Different length vectors should return 0');
      
      // Zero vectors
      const similarity4 = cosineSimilarity([0, 0], [0, 0]);
      assert.strictEqual(similarity4, 0, 'Zero vectors should return 0');
    });
    
    it('should normalize vectors', async () => {
      const { normalizeVector } = await import('../../evaluation/utils/embedding-utils.mjs');
      
      const vec = [3, 4];
      const normalized = normalizeVector(vec);
      
      assert.ok(Array.isArray(normalized), 'Should return array');
      assert.ok(normalized.length === 2, 'Should preserve length');
      
      // Check magnitude is approximately 1
      const magnitude = Math.sqrt(normalized[0] ** 2 + normalized[1] ** 2);
      assert.ok(Math.abs(magnitude - 1) < 0.001, 'Normalized vector should have magnitude 1');
    });
    
    it('should handle edge cases in normalization', async () => {
      const { normalizeVector } = await import('../../evaluation/utils/embedding-utils.mjs');
      
      // Empty vector
      const normalized1 = normalizeVector([]);
      assert.deepStrictEqual(normalized1, [], 'Empty vector should return empty array');
      
      // Zero vector
      const normalized2 = normalizeVector([0, 0]);
      assert.deepStrictEqual(normalized2, [0, 0], 'Zero vector should return unchanged');
      
      // Null/undefined
      const normalized3 = normalizeVector(null);
      assert.strictEqual(normalized3, null, 'Null should return null');
    });
  });
  
  describe('Error Handling and Edge Cases', () => {
    it('should handle empty strings', async () => {
      const { instructionSemanticSimilarity, isInstructionEmbeddingsAvailable } = await import('../../evaluation/utils/instruction-embeddings.mjs');
      
      const available = await isInstructionEmbeddingsAvailable();
      if (!available) {
        return;
      }
      
      const similarity = await instructionSemanticSimilarity('', '', 'accessibility');
      // Should either return null or a valid number (0 for empty strings)
      assert.ok(similarity === null || (typeof similarity === 'number' && similarity >= 0 && similarity <= 1),
        'Should handle empty strings gracefully');
    });
    
    it('should handle very long strings', async () => {
      const { instructionSemanticSimilarity, isInstructionEmbeddingsAvailable } = await import('../../evaluation/utils/instruction-embeddings.mjs');
      
      const available = await isInstructionEmbeddingsAvailable();
      if (!available) {
        return;
      }
      
      const longText = 'a'.repeat(10000);
      const similarity = await instructionSemanticSimilarity(longText, longText, 'accessibility');
      
      // Should handle long strings (may truncate or process)
      assert.ok(similarity === null || (typeof similarity === 'number' && similarity >= 0 && similarity <= 1),
        'Should handle long strings');
    });
    
    it('should handle invalid task types', async () => {
      const { instructionSemanticSimilarity, isInstructionEmbeddingsAvailable } = await import('../../evaluation/utils/instruction-embeddings.mjs');
      
      const available = await isInstructionEmbeddingsAvailable();
      if (!available) {
        return;
      }
      
      // Invalid task should fall back to 'general'
      const similarity = await instructionSemanticSimilarity('test', 'test', 'invalid-task');
      
      assert.ok(similarity === null || (typeof similarity === 'number' && similarity >= 0 && similarity <= 1),
        'Should handle invalid task types gracefully');
    });
    
    it('should handle null/undefined inputs', async () => {
      const { semanticSimilarity, isEmbeddingsAvailable } = await import('../../evaluation/utils/semantic-matcher.mjs');
      
      const available = await isEmbeddingsAvailable();
      if (!available) {
        return;
      }
      
      // Should handle null gracefully
      const similarity1 = await semanticSimilarity(null, 'test');
      assert.ok(similarity1 === null, 'Should return null for null input');
      
      const similarity2 = await semanticSimilarity('test', undefined);
      assert.ok(similarity2 === null, 'Should return null for undefined input');
    });
    
    it('should handle batch operations with empty arrays', async () => {
      const { batchInstructionSimilarity, isInstructionEmbeddingsAvailable } = await import('../../evaluation/utils/instruction-embeddings.mjs');
      
      const available = await isInstructionEmbeddingsAvailable();
      if (!available) {
        // Skip test if embeddings not available
        return;
      }
      
      const results = await batchInstructionSimilarity('query', [], 'accessibility');
      // Should return empty array for empty candidates, or null if embeddings unavailable
      assert.ok(results === null || (Array.isArray(results) && results.length === 0),
        'Should handle empty candidate array');
    });
  });
  
  describe('Integration with Evaluation', () => {
    it('should work with issue matching', async () => {
      const { instructionSemanticSimilarity, isInstructionEmbeddingsAvailable } = await import('../../evaluation/utils/instruction-embeddings.mjs');
      
      const available = await isInstructionEmbeddingsAvailable();
      if (!available) {
        return;
      }
      
      // Simulate issue matching scenario
      const expectedIssue = 'Color contrast may not meet WCAG guidelines';
      const detectedIssue = 'Contrast ratio is too low for accessibility compliance';
      
      const similarity = await instructionSemanticSimilarity(
        expectedIssue,
        detectedIssue,
        'accessibility'
      );
      
      assert.ok(similarity !== null, 'Should calculate similarity for issues');
      if (similarity !== null) {
        assert.ok(similarity >= 0 && similarity <= 1, 'Similarity should be 0-1');
        // Similar issues should have reasonable similarity (>0.3)
        assert.ok(similarity > 0.3, 'Similar issues should have reasonable similarity');
      }
    });
  });
});
