import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GameGym, decideGameAction, executeGameAction, playGame } from '../../src/game-player.mjs';

function gamePage(gameStates = [{ gameActive: true }]) {
  let stateIndex = 0;
  const calls = { screenshots: 0, waits: 0, presses: [], rootSelectors: [] };
  return {
    calls,
    keyboard: { press: async key => { calls.presses.push(key); } },
    screenshot: async () => { calls.screenshots++; return Buffer.from('image'); },
    evaluate: async () => gameStates[Math.min(stateIndex++, gameStates.length - 1)],
    waitForTimeout: async () => { calls.waits++; },
    locator: selector => ({
      locator: child => {
        calls.rootSelectors.push([selector, child]);
        return { count: async () => 1, click: async () => {} };
      },
      count: async () => 1,
      click: async () => {},
    }),
  };
}

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'ai-visual-game-loop-'));
}

test('playGame performs one review and one action selection on the first frame', async () => {
  const page = gamePage();
  const evaluations = [{ score: 0, reasoning: 'first' }];
  let temporalCalls = 0;
  const result = await playGame(page, {
    maxSteps: 1, fps: 1, tempDir: tempDir(),
    services: {
      reviewState: async () => ({ ...evaluations[0], attempts: 2 }),
      selectAction: async () => ({ action: { type: 'wait', duration: 1 }, attempts: 2 }),
      decisionManager: { shouldPrompt: async () => { temporalCalls++; return { shouldPrompt: false }; } },
    },
  });
  assert.deepEqual(result.providerCalls, { visualReviews: 2, actionSelections: 2 });
  assert.equal(result.history[0].result.reasoning, evaluations[0].reasoning);
  assert.equal(temporalCalls, 0);
});

test('playGame reuses the prior evaluation on a skipped frame and still selects one action', async () => {
  const page = gamePage();
  const reviewed = { score: 0, reasoning: 'canonical' };
  const seenEvaluations = [];
  let actionCalls = 0;
  const decisions = [{ shouldPrompt: false, urgency: 'low', reason: 'stable frame' }];
  const result = await playGame(page, {
    maxSteps: 2, fps: 1, tempDir: tempDir(),
    services: {
      reviewState: async () => reviewed,
      decisionManager: { shouldPrompt: async () => decisions.shift() },
      decideAction: async state => {
        actionCalls++;
        seenEvaluations.push(state.evaluation);
        return { type: 'wait', duration: 1 };
      },
      executeAction: async () => ({ success: true }),
    },
  });
  assert.equal(result.providerCalls.visualReviews, 1);
  assert.equal(result.providerCalls.actionSelections, 0);
  assert.equal(result.history[1].result.skipped, true);
  assert.equal(actionCalls, 2);
  assert.equal(decisions.length, 0);
  assert.equal(seenEvaluations.length, 2);
  assert.equal(seenEvaluations[1].reasoning, 'canonical');
  assert.notEqual(seenEvaluations[1], reviewed);
});

test('later scheduled reviews disable nested temporal decisions', async () => {
  const page = gamePage();
  const reviewContexts = [];
  let temporalCalls = 0;
  await playGame(page, {
    maxSteps: 2, fps: 1, tempDir: tempDir(),
    services: {
      reviewState: async (_image, _prompt, context) => {
        reviewContexts.push(context);
        return { score: 1 };
      },
      decisionManager: { shouldPrompt: async () => {
        temporalCalls++;
        return { shouldPrompt: true, urgency: 'medium', reason: 'change' };
      } },
      decideAction: async () => ({ type: 'wait', duration: 1 }),
      executeAction: async () => ({ success: true }),
    },
  });
  assert.equal(reviewContexts.length, 2);
  assert.equal(temporalCalls, 1);
  assert.equal(reviewContexts[1].useTemporalDecision, false);
});

test('a scheduled review failure is recorded once without a fallback review', async () => {
  const page = gamePage();
  let reviews = 0;
  const result = await playGame(page, {
    maxSteps: 2, fps: 1, tempDir: tempDir(),
    services: {
      reviewState: async () => {
        reviews++;
        if (reviews === 2) throw new Error('review transport failed');
        return { score: 1 };
      },
      decisionManager: { shouldPrompt: async () => ({ shouldPrompt: true, urgency: 'medium', reason: 'change' }) },
      decideAction: async () => ({ type: 'wait', duration: 1 }),
      executeAction: async () => ({ success: true }),
    },
  });
  assert.equal(reviews, 2);
  assert.equal(result.history.length, 2);
  assert.match(result.history[1].error, /review transport failed/);
  assert.equal(result.providerCalls.visualReviews, 2);
});

test('playGame counts all retry attempts in a failed visual review', async () => {
  const page = gamePage();
  let reviews = 0;
  const result = await playGame(page, {
    maxSteps: 2, fps: 1, tempDir: tempDir(),
    services: {
      reviewState: async () => {
        reviews++;
        if (reviews === 2) throw Object.assign(new Error('review retries exhausted'), { details: { attempts: 2 } });
        return { score: 1 };
      },
      decisionManager: { shouldPrompt: async () => ({ shouldPrompt: true, urgency: 'medium', reason: 'change' }) },
      decideAction: async () => ({ type: 'wait', duration: 1 }),
      executeAction: async () => ({ success: true }),
    },
  });
  assert.equal(result.providerCalls.visualReviews, 3);
});

test('only disabled and output-contract action errors use the deterministic heuristic', async () => {
  const state = { screenshot: 'frame.png', evaluation: { score: 1 } };
  const disabled = Object.assign(new Error('disabled'), { details: { failureKind: 'disabled' } });
  const fallback = await decideGameAction(state, 'survive', [], {
    selectAction: async () => { throw disabled; },
  });
  assert.deepEqual(fallback, { type: 'keyboard', key: 'ArrowRight' });
  await assert.rejects(
    () => decideGameAction(state, 'survive', [], { selectAction: async () => { throw new Error('network unavailable'); } }),
    /network unavailable/,
  );
});

test('playGame passes the reviewed evaluation unchanged into the action policy', async () => {
  const page = gamePage();
  const reviewed = { score: 7, reasoning: 'same object' };
  let actionState;
  await playGame(page, {
    maxSteps: 1, fps: 1, tempDir: tempDir(),
    services: {
      reviewState: async () => reviewed,
      decideAction: async state => { actionState = state; return { type: 'wait', duration: 1 }; },
      executeAction: async () => ({ success: true }),
    },
  });
  assert.equal(actionState.evaluation, reviewed);
});

test('playGame does not treat a zero score as terminal without terminal evidence', async () => {
  const page = gamePage([{ gameActive: true }, { gameActive: true }]);
  const result = await playGame(page, {
    maxSteps: 2, fps: 1, tempDir: tempDir(),
    services: {
      reviewState: async () => ({ score: 0 }),
      decideAction: async () => ({ type: 'wait', duration: 1 }),
      executeAction: async () => ({ success: true }),
    },
  });
  assert.equal(result.totalSteps, 2);
});

test('playGame halts when extracted state explicitly declares game inactive', async () => {
  const page = gamePage([{ gameActive: false }]);
  const result = await playGame(page, {
    maxSteps: 2, fps: 1, tempDir: tempDir(),
    services: {
      reviewState: async () => ({ score: 12 }),
      decideAction: async () => ({ type: 'wait', duration: 1 }),
      executeAction: async () => ({ success: true }),
    },
  });
  assert.equal(result.totalSteps, 1);
});

test('executeGameAction confines click selectors beneath a configured game root', async () => {
  const page = gamePage();
  const result = await executeGameAction(page, { type: 'click', selector: '.start' }, { gameSelector: '#game' });
  assert.equal(result.success, true);
  assert.deepEqual(page.calls.rootSelectors, [['#game', '.start']]);
});

test('executeGameAction rejects selector engines that can escape a game root', async () => {
  const page = gamePage();
  const result = await executeGameAction(page, { type: 'click', selector: 'xpath=../outside' }, { gameSelector: '#game' });
  assert.equal(result.success, false);
  assert.match(result.error, /CSS click selectors/);
  assert.deepEqual(page.calls.rootSelectors, []);
});

test('GameGym exposes a failed action without waiting, reviewing, or advancing', async () => {
  const page = gamePage();
  let reviews = 0;
  const gym = new GameGym(page, {
    maxSteps: 2, fps: 1, tempDir: tempDir(),
    services: {
      reviewState: async () => { reviews++; return { score: 0 }; },
      executeAction: async () => ({ success: false, error: 'missing element' }),
    },
  });
  await gym.reset();
  const result = await gym.step({ type: 'click', selector: '.missing' });
  assert.equal(result.info.actionFailed, true);
  assert.equal(result.info.executionResult.error, 'missing element');
  assert.equal(gym.stepCount, 0);
  assert.equal(gym.history.length, 1);
  assert.equal(gym.history[0].executionResult.error, 'missing element');
  assert.equal(reviews, 1);
  assert.equal(page.calls.waits, 0);
});

test('playGame records an exhausted action failure without a normal frame transition', async () => {
  const page = gamePage();
  let executions = 0;
  const result = await playGame(page, {
    maxSteps: 1, fps: 1, tempDir: tempDir(),
    services: {
      reviewState: async () => ({ score: 3 }),
      decideAction: async () => ({ type: 'wait', duration: 1 }),
      executeAction: async () => { executions++; return { success: false, error: 'blocked' }; },
    },
  });
  assert.equal(executions, 2);
  assert.equal(result.history.length, 1);
  assert.equal(result.history[0].error, 'blocked');
  assert.equal(result.history[0].executionResult.success, false);
  assert.equal(page.calls.waits, 1);
});

test('game options fail before page effects', async () => {
  const page = gamePage();
  await assert.rejects(() => playGame(page, { maxSteps: 0 }), /maxSteps must be a positive integer/);
  assert.throws(() => new GameGym(page, { fps: Infinity }), /fps must be a positive finite number/);
  assert.equal(page.calls.screenshots, 0);
});

test('concurrent game runs and gyms use collision-safe screenshot paths', async () => {
  const directory = tempDir();
  const paths = [];
  const run = () => playGame(gamePage(), {
    maxSteps: 1, fps: 1, tempDir: directory,
    services: {
      reviewState: async image => { paths.push(image); return { score: 1 }; },
      decideAction: async () => ({ type: 'wait', duration: 1 }),
      executeAction: async () => ({ success: true }),
    },
  });
  await Promise.all([run(), run()]);
  const first = new GameGym(gamePage(), { maxSteps: 1, fps: 1, tempDir: directory, services: { reviewState: async () => ({ score: 1 }) } });
  const second = new GameGym(gamePage(), { maxSteps: 1, fps: 1, tempDir: directory, services: { reviewState: async () => ({ score: 1 }) } });
  const [one, two] = await Promise.all([first.reset(), second.reset()]);
  assert.equal(new Set([...paths, one.screenshot, two.screenshot]).size, 4);
});

test('GameGym reset honors explicit terminal state and prevents stepping', async () => {
  const page = gamePage();
  let executions = 0;
  const gym = new GameGym(page, {
    maxSteps: 2, fps: 1, tempDir: tempDir(),
    services: {
      reviewState: async () => ({ score: 0, gameState: { gameActive: false } }),
      executeAction: async () => { executions++; return { success: true }; },
    },
  });
  await gym.reset();
  await gym.step({ type: 'wait', duration: 1 });
  assert.equal(gym.done, true);
  assert.equal(executions, 0);
});
