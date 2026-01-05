import { test } from 'node:test';
import assert from 'node:assert';
import { createErrorRecoveryStrategy, ErrorRecoveryStrategy } from '../../src/utils/error-recovery.mjs';

test('ErrorRecoveryStrategy recovers from element not found', async () => {
  const strategy = new ErrorRecoveryStrategy({ maxRetries: 3 });
  
  const error = new Error('Element not found: #button');
  const action = { type: 'click', selector: '#button' };
  
  const recovery = await strategy.attemptRecovery(error, action, {});
  
  assert.ok(recovery !== null, 'Should generate recovery action');
  assert.ok(recovery.type === 'explore' || recovery.type === 'wait', 
    'Should suggest explore or wait for element not found');
  assert.ok(recovery.reason, 'Should provide recovery reason');
});

test('ErrorRecoveryStrategy recovers from timeout', async () => {
  const strategy = new ErrorRecoveryStrategy({ maxRetries: 3, retryDelay: 1000 });
  
  const error = new Error('Timeout: waiting for element');
  const action = { type: 'click', selector: '#button' };
  
  const recovery = await strategy.attemptRecovery(error, action, {});
  
  assert.ok(recovery !== null, 'Should generate recovery action');
  assert.ok(recovery.type === 'wait', 'Should suggest wait for timeout');
  assert.ok(recovery.duration >= 1000, 'Should use longer wait for timeout');
});

test('ErrorRecoveryStrategy recovers from network error', async () => {
  const strategy = new ErrorRecoveryStrategy({ maxRetries: 3, retryDelay: 1000 });
  
  const error = new Error('Network error: failed to load');
  const action = { type: 'navigate', url: 'https://example.com' };
  
  const recovery = await strategy.attemptRecovery(error, action, {});
  
  assert.ok(recovery !== null, 'Should generate recovery action');
  assert.ok(recovery.type === 'wait', 'Should suggest wait for network error');
  assert.ok(recovery.duration >= 1000, 'Should use longer wait for network error');
});

test('ErrorRecoveryStrategy recovers from navigation error', async () => {
  const strategy = new ErrorRecoveryStrategy({ maxRetries: 3 });
  
  const error = new Error('Navigation error: invalid URL');
  const action = { type: 'navigate', url: 'https://example.com/page' };
  
  const recovery = await strategy.attemptRecovery(error, action, {});
  
  assert.ok(recovery !== null, 'Should generate recovery action');
  assert.ok(recovery.type === 'navigate' || recovery.type === 'wait', 
    'Should suggest navigate or wait for navigation error');
  
  // If navigate recovery, should try base URL
  if (recovery.type === 'navigate') {
    assert.ok(recovery.url === 'https://example.com', 'Should try base URL for navigation error');
  }
});

test('ErrorRecoveryStrategy respects max retries', async () => {
  const strategy = new ErrorRecoveryStrategy({ maxRetries: 2 });
  
  const error = new Error('Test error');
  const action = { type: 'click', selector: '#button' };
  
  // First recovery
  const recovery1 = await strategy.attemptRecovery(error, action, {});
  assert.ok(recovery1 !== null, 'Should generate first recovery');
  
  // Second recovery
  const recovery2 = await strategy.attemptRecovery(error, action, {});
  assert.ok(recovery2 !== null, 'Should generate second recovery');
  
  // Third attempt should return null
  const recovery3 = await strategy.attemptRecovery(error, action, {});
  assert.ok(recovery3 === null, 'Should return null after max retries');
});

test('ErrorRecoveryStrategy tracks recovery history', async () => {
  const strategy = new ErrorRecoveryStrategy({ maxRetries: 3 });
  
  const error = new Error('Test error');
  const action = { type: 'click', selector: '#button' };
  
  await strategy.attemptRecovery(error, action, {});
  await strategy.attemptRecovery(error, action, {});
  
  const stats = strategy.getStats();
  assert.ok(stats.totalRecoveries === 2, 'Should track 2 recoveries');
  assert.ok(stats.recoveries.length === 2, 'Should have 2 recovery entries');
});

test('ErrorRecoveryStrategy resets correctly', async () => {
  const strategy = new ErrorRecoveryStrategy({ maxRetries: 3 });
  
  const error = new Error('Test error');
  const action = { type: 'click', selector: '#button' };
  
  await strategy.attemptRecovery(error, action, {});
  assert.ok(strategy.getStats().totalRecoveries === 1, 'Should have 1 recovery');
  
  strategy.reset();
  assert.ok(strategy.getStats().totalRecoveries === 0, 'Should reset to 0 recoveries');
  
  // Should be able to recover again after reset
  const recovery = await strategy.attemptRecovery(error, action, {});
  assert.ok(recovery !== null, 'Should generate recovery after reset');
});

test('createErrorRecoveryStrategy creates instance', () => {
  const strategy = createErrorRecoveryStrategy({ maxRetries: 5, retryDelay: 2000 });
  
  assert.ok(strategy instanceof ErrorRecoveryStrategy, 'Should create ErrorRecoveryStrategy instance');
  assert.ok(strategy.maxRetries === 5, 'Should set maxRetries');
  assert.ok(strategy.retryDelay === 2000, 'Should set retryDelay');
});




