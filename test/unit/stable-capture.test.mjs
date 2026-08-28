import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureStableScreenshot } from '../../src/stable-capture.mjs';

function pageWithFrames(frames, overrides = {}) {
  const calls = { screenshots: [], loadStates: [], evaluations: 0, waits: [] };
  let index = 0;
  return {
    calls,
    async screenshot(options) {
      calls.screenshots.push(options);
      const frame = frames[Math.min(index++, frames.length - 1)];
      return Buffer.from(frame);
    },
    async waitForLoadState(state, options) {
      calls.loadStates.push({ state, options });
    },
    async evaluate() { calls.evaluations++; },
    async waitForTimeout(ms) { calls.waits.push(ms); },
    viewportSize() { return { width: 1280, height: 720 }; },
    url() { return 'https://example.test/page'; },
    ...overrides,
  };
}

test('captureStableScreenshot waits for page readiness and requires consecutive matching frames', async () => {
  const page = pageWithFrames(['first', 'second', 'second']);

  const capture = await captureStableScreenshot(page, {
    path: '/tmp/stable.png',
    stability: { delayMs: 0 },
  });

  assert.equal(capture.metadata.stable, true);
  assert.equal(capture.metadata.attempts, 3);
  assert.deepEqual(capture.metadata.viewport, { width: 1280, height: 720 });
  assert.equal(capture.metadata.url, 'https://example.test/page');
  assert.deepEqual(page.calls.loadStates, [
    { state: 'networkidle', options: { timeout: 1000 } },
  ]);
  assert.equal(page.calls.evaluations, 1);
  assert.equal(page.calls.screenshots[0].animations, 'disabled');
  assert.equal(page.calls.screenshots[0].caret, 'hide');
  assert.equal(page.calls.screenshots[0].path, '/tmp/stable.png');
});

test('captureStableScreenshot forwards caller screenshot overrides without allowing path replacement', async () => {
  const page = pageWithFrames(['only']);

  const capture = await captureStableScreenshot(page, {
    path: '/tmp/owned.png',
    fullPage: true,
    screenshot: {
      path: '/tmp/ignored.png',
      animations: 'allow',
      caret: 'initial',
      mask: ['locator'],
      style: '.clock { visibility: hidden }',
    },
    stability: { enabled: false },
  });

  assert.equal(capture.metadata.stable, null);
  assert.equal(capture.metadata.attempts, 1);
  assert.deepEqual(page.calls.screenshots, [{
    animations: 'allow',
    caret: 'initial',
    fullPage: true,
    mask: ['locator'],
    style: '.clock { visibility: hidden }',
    path: '/tmp/owned.png',
  }]);
});

test('captureStableScreenshot reports bounded instability and can require convergence', async () => {
  const unstable = pageWithFrames(['one', 'two', 'three']);
  const capture = await captureStableScreenshot(unstable, {
    path: '/tmp/unstable.png',
    stability: { maxAttempts: 3, delayMs: 0 },
  });

  assert.equal(capture.metadata.stable, false);
  assert.equal(capture.metadata.attempts, 3);

  const required = pageWithFrames(['one', 'two']);
  await assert.rejects(
    captureStableScreenshot(required, {
      path: '/tmp/required.png',
      stability: { maxAttempts: 2, delayMs: 0, requireStable: true },
    }),
    /did not stabilize after 2 attempts/,
  );
});

test('captureStableScreenshot preserves readiness diagnostics instead of hiding capture success', async () => {
  const page = pageWithFrames(['same', 'same'], {
    async waitForLoadState() { throw new Error('open websocket'); },
    async evaluate() { throw new Error('fonts unavailable'); },
  });

  const capture = await captureStableScreenshot(page, {
    path: '/tmp/diagnostic.png',
    stability: { delayMs: 0 },
  });

  assert.equal(capture.metadata.stable, true);
  assert.deepEqual(capture.metadata.settle.diagnostics, [
    'networkidle: open websocket',
    'fonts: fonts unavailable',
  ]);
});
