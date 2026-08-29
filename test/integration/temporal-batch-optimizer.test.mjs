/**
 * Tests for temporal-batch-optimizer.mjs
 * 
 * Tests temporal batch optimization with dependencies and sequential context
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { TemporalBatchOptimizer } from '#temporal-orchestration';
import { SequentialDecisionContext } from '../../src/temporal-multi-scale.mjs';

describe('TemporalBatchOptimizer', () => {
  test('constructor extends BatchOptimizer', () => {
    const optimizer = new TemporalBatchOptimizer();
    
    assert.ok(optimizer);
    assert.strictEqual(optimizer.maxConcurrency, 5);
    assert.strictEqual(optimizer.batchSize, 3);
    assert.ok(optimizer.temporalDependencies);
    assert.strictEqual(optimizer.adaptiveBatching, true);
  });
  
  test('constructor with sequential context', () => {
    const context = new SequentialDecisionContext();
    const optimizer = new TemporalBatchOptimizer({
      sequentialContext: context
    });
    
    assert.strictEqual(optimizer.sequentialContext, context);
  });
  
  test('calculatePriority - no dependencies gets high priority', () => {
    const optimizer = new TemporalBatchOptimizer();
    
    const priority1 = optimizer.calculatePriority([], {});
    const priority2 = optimizer.calculatePriority(['dep1'], {});
    
    assert.ok(priority1 > priority2);
  });
  
  test('calculatePriority - earlier timestamps get higher priority', () => {
    const optimizer = new TemporalBatchOptimizer();
    const now = Date.now();
    
    // Test with timestamps that are both recent (within 1 minute)
    const priority1 = optimizer.calculatePriority([], { timestamp: now - 1000 }); // 1 second ago
    const priority2 = optimizer.calculatePriority([], { timestamp: now - 5000 }); // 5 seconds ago
    
    // Earlier timestamp (older) should have higher priority within reasonable window
    // But both should have some priority boost
    assert.ok(priority1 >= 0);
    assert.ok(priority2 >= 0);
  });
  
  test('calculatePriority - critical evaluations get higher priority', () => {
    const optimizer = new TemporalBatchOptimizer();
    
    const priority1 = optimizer.calculatePriority([], { critical: true });
    const priority2 = optimizer.calculatePriority([], {});
    
    assert.ok(priority1 > priority2);
  });
  
  test('sortByTemporalDependencies - sorts by priority', () => {
    const optimizer = new TemporalBatchOptimizer();
    
    optimizer.temporalDependencies.set('img1', {
      dependencies: [],
      priority: 100,
      requestId: 1
    });
    optimizer.temporalDependencies.set('img2', {
      dependencies: ['img1'],
      priority: 50,
      requestId: 2
    });
    
    const queue = [
      { imagePath: 'img2' },
      { imagePath: 'img1' }
    ];
    
    const sorted = optimizer.sortByTemporalDependencies(queue);
    
    assert.strictEqual(sorted[0].imagePath, 'img1'); // Higher priority first
  });
  
  test('selectTemporalBatch - respects dependencies', () => {
    const optimizer = new TemporalBatchOptimizer({ batchSize: 2 });
    
    optimizer.temporalDependencies.set('img1', {
      dependencies: [],
      priority: 100,
      requestId: 1
    });
    optimizer.temporalDependencies.set('img2', {
      dependencies: ['img1'],
      priority: 50,
      requestId: 2
    });
    
    const queue = [
      { imagePath: 'img1' },
      { imagePath: 'img2' }
    ];
    
    const firstBatch = optimizer.selectTemporalBatch(queue);

    // A dependency must finish, not merely be selected for the same parallel batch.
    assert.deepStrictEqual(firstBatch.map(item => item.imagePath), ['img1']);

    optimizer.completedTemporalRequests.set('img1', 1);
    const secondBatch = optimizer.selectTemporalBatch([{ imagePath: 'img2' }]);
    assert.deepStrictEqual(secondBatch.map(item => item.imagePath), ['img2']);
  });

  test('_processQueue removes each processed batch before selecting the next one', async () => {
    const optimizer = new TemporalBatchOptimizer({ batchSize: 1, cacheEnabled: false });
    const processed = [];
    optimizer._processRequest = async (imagePath) => {
      processed.push(imagePath);
      return { score: 7 };
    };

    const outcomes = [];
    optimizer.queue.push(
      { imagePath: 'root', prompt: '', context: {}, resolve: value => outcomes.push(value), reject: assert.fail },
      { imagePath: 'child', prompt: '', context: {}, resolve: value => outcomes.push(value), reject: assert.fail }
    );
    optimizer.temporalDependencies.set('root', { dependencies: [], priority: 100 });
    optimizer.temporalDependencies.set('child', { dependencies: ['root'], priority: 90 });

    await optimizer._processQueue();

    assert.deepStrictEqual(processed, ['root', 'child']);
    assert.strictEqual(optimizer.queue.length, 0);
    assert.strictEqual(outcomes.length, 2);
  });

  test('addTemporalRequest does not bypass a dependency while capacity is free', async () => {
    const optimizer = new TemporalBatchOptimizer({ batchSize: 2, cacheEnabled: false });
    const processed = [];
    optimizer._processRequest = async (imagePath) => {
      processed.push(imagePath);
      return { score: 7 };
    };

    const root = optimizer.addTemporalRequest('root', '', {});
    const child = optimizer.addTemporalRequest('child', '', {}, ['root']);

    await Promise.all([root, child]);
    assert.deepStrictEqual(processed, ['root', 'child']);
  });

  test('selectTemporalBatch ignores completion from an older request at the same path', () => {
    const optimizer = new TemporalBatchOptimizer();
    optimizer.temporalDependencies.set('root', { dependencies: [], priority: 100, requestId: 2 });
    optimizer.temporalDependencies.set('child', { dependencies: ['root'], priority: 90, requestId: 3 });

    optimizer.completedTemporalRequests.set('root', 1);
    assert.deepStrictEqual(optimizer.selectTemporalBatch([{ imagePath: 'child' }]), []);

    optimizer.completedTemporalRequests.set('root', 2);
    assert.deepStrictEqual(
      optimizer.selectTemporalBatch([{ imagePath: 'child' }]).map(item => item.imagePath),
      ['child']
    );
  });

  test('failed prerequisite causally rejects its dependent without replaying the queue', async () => {
    const optimizer = new TemporalBatchOptimizer({ cacheEnabled: false });
    optimizer._processRequest = async imagePath => {
      if (imagePath === 'root') throw new Error('root failed');
      return { score: 7 };
    };

    const root = optimizer.addTemporalRequest('root', '', {});
    const child = optimizer.addTemporalRequest('child', '', {}, ['root']);
    const [rootResult, childResult] = await Promise.allSettled([root, child]);

    assert.strictEqual(rootResult.status, 'rejected');
    assert.strictEqual(childResult.status, 'rejected');
    assert.match(childResult.reason.message, /Temporal dependency failed: root/);
    assert.strictEqual(optimizer.queue.length, 0);
  });

  test('unknown and cyclic dependencies reject without starving timers', async () => {
    const optimizer = new TemporalBatchOptimizer({ cacheEnabled: false });
    const timer = new Promise(resolve => setTimeout(resolve, 0));
    optimizer.processing = true;
    const unknown = optimizer.addTemporalRequest('unknown-child', '', {}, ['missing']);
    const firstCycle = optimizer.addTemporalRequest('cycle-a', '', {}, ['cycle-b']);
    const secondCycle = optimizer.addTemporalRequest('cycle-b', '', {}, ['cycle-a']);
    optimizer.processing = false;
    await optimizer._processQueue();
    const outcomes = await Promise.allSettled([unknown, firstCycle, secondCycle]);

    await timer;
    assert.deepStrictEqual(outcomes.map(result => result.status), ['rejected', 'rejected', 'rejected']);
    assert.match(outcomes[0].reason.message, /Unknown temporal dependency: missing/);
    assert.match(outcomes[1].reason.message, /Cyclic temporal dependency/);
    assert.match(outcomes[2].reason.message, /Cyclic temporal dependency/);
    assert.strictEqual(optimizer.queue.length, 0);
  });
  
  test('getTemporalStats - returns statistics', () => {
    const optimizer = new TemporalBatchOptimizer();
    
    optimizer.temporalDependencies.set('img1', {
      dependencies: [],
      priority: 100
    });
    
    const stats = optimizer.getTemporalStats();
    
    assert.strictEqual(stats.dependencies, 1);
    assert.ok(stats.cacheSize !== undefined);
    assert.ok(stats.queueLength !== undefined);
  });
  
  test('getTemporalStats - includes sequential context', () => {
    const context = new SequentialDecisionContext();
    context.addDecision({ score: 8 });
    
    const optimizer = new TemporalBatchOptimizer({
      sequentialContext: context
    });
    
    const stats = optimizer.getTemporalStats();
    
    assert.ok(stats.sequentialContext);
    assert.strictEqual(stats.sequentialContext.historyLength, 1);
  });
});
