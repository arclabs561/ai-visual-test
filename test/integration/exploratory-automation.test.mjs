import { test } from 'node:test';
import assert from 'node:assert';
import { createExploratoryStrategy, ExploratoryStrategy } from '../../src/utils/exploratory-automation.mjs';

test('ExploratoryStrategy generates alternatives for failed actions', () => {
  const strategy = new ExploratoryStrategy({ maxAttempts: 5 });
  
  const failedActions = [
    { type: 'click', selector: '#button' }
  ];
  
  const nextAction = strategy.getNextAction(
    { score: 5 },
    failedActions,
    'Click the button'
  );
  
  assert.ok(nextAction !== null, 'Should generate alternative action');
  assert.ok(['wait', 'keyboard'].includes(nextAction.type), 
    'Should try wait or keyboard for failed click');
});

test('ExploratoryStrategy respects max attempts', () => {
  const strategy = new ExploratoryStrategy({ maxAttempts: 3 });
  
  // Exhaust attempts
  let actionCount = 0;
  for (let i = 0; i < 5; i++) {
    const action = strategy.getNextAction(
      { score: 5 },
      [{ type: 'click', selector: '#button' }],
      'Click button'
    );
    
    if (action !== null) {
      actionCount++;
    }
    
    // After maxAttempts, should return null
    if (i >= 2 && action === null) {
      break; // Correctly exhausted
    }
  }
  
  assert.ok(actionCount <= 3, `Should not exceed max attempts (got ${actionCount})`);
  assert.ok(strategy.getStats().totalAttempts <= 3, 'Should track <= max attempts');
});

test('ExploratoryStrategy tracks attempt history', () => {
  const strategy = new ExploratoryStrategy({ maxAttempts: 5 });
  
  // Need a failed action to generate alternatives
  const failedAction = { type: 'click', selector: '#button' };
  const action1 = strategy.getNextAction({ score: 5 }, [failedAction], 'Find something');
  assert.ok(action1 !== null, 'Should generate first alternative action');
  
  // For click failures, generateAlternatives returns [wait, keyboard]
  // After first call, wait is in history, so second call with same failed action
  // should generate alternatives again, but wait is filtered out, returning keyboard
  const action2 = strategy.getNextAction({ score: 5 }, [failedAction], 'Find something');
  assert.ok(action2 !== null, 'Should generate second alternative action');
  assert.ok(JSON.stringify(action1) !== JSON.stringify(action2), 
    'Should generate different actions');
  
  const stats = strategy.getStats();
  assert.ok(stats.totalAttempts === 2, 'Should track 2 attempts');
  assert.ok(stats.remainingAttempts === 3, 'Should have 3 remaining attempts');
});

test('ExploratoryStrategy generates alternatives for different action types', () => {
  // Test click failure with fresh strategy
  const clickStrategy = new ExploratoryStrategy({ maxAttempts: 5 });
  const clickAction = clickStrategy.getNextAction(
    { score: 5 },
    [{ type: 'click', selector: '#button' }],
    'Click button'
  );
  
  assert.ok(clickAction !== null, 'Should generate alternative for failed click');
  assert.ok(['wait', 'keyboard'].includes(clickAction.type), 
    'Should try wait or keyboard for failed click');
  
  // Test keyboard failure with fresh strategy (separate instance to avoid attempt history interference)
  const keyboardStrategy = new ExploratoryStrategy({ maxAttempts: 5 });
  const keyboardAction = keyboardStrategy.getNextAction(
    { score: 5 },
    [{ type: 'keyboard', key: 'Enter' }],
    'Press enter'
  );
  
  assert.ok(keyboardAction !== null, 'Should generate alternative for failed keyboard');
  assert.ok(keyboardAction.type === 'wait', 'Should try wait for failed keyboard');
});

test('ExploratoryStrategy resets correctly', () => {
  const strategy = new ExploratoryStrategy({ maxAttempts: 5 });
  
  // Need a failed action to generate alternatives
  const failedAction = { type: 'click', selector: '#button' };
  strategy.getNextAction({ score: 5 }, [failedAction], 'Test');
  assert.ok(strategy.getStats().totalAttempts === 1, 'Should have 1 attempt');
  
  strategy.reset();
  assert.ok(strategy.getStats().totalAttempts === 0, 'Should reset to 0 attempts');
  
  // Should be able to generate new actions after reset
  const action = strategy.getNextAction({ score: 5 }, [failedAction], 'Test');
  assert.ok(action !== null, 'Should generate action after reset');
});

test('createExploratoryStrategy creates instance', () => {
  const strategy = createExploratoryStrategy({ maxAttempts: 3 });
  
  assert.ok(strategy instanceof ExploratoryStrategy, 'Should create ExploratoryStrategy instance');
  assert.ok(strategy.maxAttempts === 3, 'Should set maxAttempts');
});

