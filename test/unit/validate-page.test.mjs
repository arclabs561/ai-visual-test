import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validatePage } from '../../src/page-validation.js';
import { VLLMJudge } from '../../src/judge.mjs';

test('validatePage captures a stable frame, forwards metadata, and removes its temporary file', async t => {
  const tempDir = mkdtempSync(join(tmpdir(), 'validate-page-'));
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));

  const screenshotCalls = [];
  const page = {
    async waitForLoadState() {},
    async evaluate() {},
    async screenshot(options) {
      screenshotCalls.push(options);
      writeFileSync(options.path, 'png fixture');
      return Buffer.from('same frame');
    },
    viewportSize() { return { width: 800, height: 600 }; },
    url() { return 'https://example.test/checkout'; },
  };

  const originalJudge = VLLMJudge.prototype.judgeScreenshot;
  let judged = null;
  VLLMJudge.prototype.judgeScreenshot = async function (imagePath, prompt, context) {
    judged = { imagePath, prompt, context };
    return { enabled: true, score: 8, issues: [], recommendations: [] };
  };
  t.after(() => { VLLMJudge.prototype.judgeScreenshot = originalJudge; });

  const result = await validatePage(page, 'Review checkout', {
    tempDir,
    captureCode: false,
    fullPage: true,
    screenshot: { animations: 'allow', style: '.clock { display: none }' },
    stability: { delayMs: 0 },
  });

  assert.equal(result.score, 8);
  assert.equal(screenshotCalls.length, 2);
  assert.equal(screenshotCalls[0].fullPage, true);
  assert.equal(screenshotCalls[0].animations, 'allow');
  assert.equal(screenshotCalls[0].style, '.clock { display: none }');
  assert.equal(judged.context.captureMetadata.stable, true);
  assert.deepEqual(judged.context.captureMetadata.viewport, { width: 800, height: 600 });
  assert.equal(existsSync(judged.imagePath), false);
});

test('validatePage rejects an invalid page before attempting capture work', async t => {
  const tempDir = mkdtempSync(join(tmpdir(), 'validate-page-invalid-'));
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));

  await assert.rejects(
    () => validatePage({}, 'Review checkout', { tempDir }),
    /page must be a Playwright Page object/,
  );

  assert.deepEqual(readdirSync(tempDir), []);
});

test('validatePage rejects screenshot-only pages before capture when code capture is enabled', async t => {
  const tempDir = mkdtempSync(join(tmpdir(), 'validate-page-capability-'));
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));
  let screenshotCalls = 0;

  await assert.rejects(
    () => validatePage({
      async screenshot() {
        screenshotCalls += 1;
        return Buffer.from('unreachable');
      },
    }, 'Review checkout', { tempDir }),
    /captureCode requires page capabilities: content, evaluate, url, viewportSize/,
  );

  assert.equal(screenshotCalls, 0);
  assert.deepEqual(readdirSync(tempDir), []);
});

test('validatePage removes its temporary screenshot when capture fails', async t => {
  const tempDir = mkdtempSync(join(tmpdir(), 'validate-page-capture-failure-'));
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));

  const page = {
    async screenshot(options) {
      writeFileSync(options.path, 'partial png');
      throw new Error('capture interrupted');
    },
  };

  await assert.rejects(
    () => validatePage(page, 'Review checkout', {
      tempDir, captureCode: false, stability: { delayMs: 0 },
    }),
    /capture interrupted/,
  );

  assert.deepEqual(readdirSync(tempDir), []);
});

test('validatePage captures rendered code by default for a declared-compatible page', async t => {
  const tempDir = mkdtempSync(join(tmpdir(), 'validate-page-rendered-code-'));
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));

  const evaluateResults = [undefined, [], {}, {
    body: { tagName: 'BODY', children: 1, textContent: 'Checkout', attributes: {} },
    head: { title: 'Checkout', meta: [], links: [] },
    mainElements: [],
  }];
  const page = {
    async waitForLoadState() {},
    async content() { return '<main>Checkout</main>'; },
    async evaluate() { return evaluateResults.shift(); },
    async screenshot(options) {
      writeFileSync(options.path, 'png fixture');
      return Buffer.from('same frame');
    },
    url() { return 'https://example.test/checkout'; },
    viewportSize() { return { width: 1024, height: 768 }; },
  };

  const originalJudge = VLLMJudge.prototype.judgeScreenshot;
  let judged = null;
  VLLMJudge.prototype.judgeScreenshot = async function (imagePath, prompt, context) {
    judged = { imagePath, prompt, context };
    return { enabled: true, score: 8, issues: [], recommendations: [] };
  };
  t.after(() => { VLLMJudge.prototype.judgeScreenshot = originalJudge; });

  await validatePage(page, 'Review checkout', { tempDir, stability: { delayMs: 0 } });

  assert.equal(judged.context.renderedCode.html, '<main>Checkout</main>');
  assert.equal(judged.context.renderedCode.url, 'https://example.test/checkout');
  assert.deepEqual(judged.context.renderedCode.viewport, { width: 1024, height: 768 });
  assert.deepEqual(judged.context.renderedCode.stylesheets, []);
  assert.deepEqual(readdirSync(tempDir), []);
});

test('validatePage uses distinct temporary paths for parallel captures in the same tick', async t => {
  const tempDir = mkdtempSync(join(tmpdir(), 'validate-page-parallel-'));
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));

  const paths = [];
  const createPage = () => ({
    async screenshot(options) {
      paths.push(options.path);
      writeFileSync(options.path, 'same frame');
      return Buffer.from('same frame');
    },
  });

  const originalNow = Date.now;
  const originalJudge = VLLMJudge.prototype.judgeScreenshot;
  Date.now = () => 1_700_000_000_000;
  VLLMJudge.prototype.judgeScreenshot = async () => ({
    enabled: true, score: 8, issues: [], recommendations: [],
  });
  t.after(() => { Date.now = originalNow; });
  t.after(() => { VLLMJudge.prototype.judgeScreenshot = originalJudge; });

  const [first, second] = await Promise.all([
    validatePage(createPage(), 'Review first page', {
      tempDir, captureCode: false, stability: { delayMs: 0 },
    }),
    validatePage(createPage(), 'Review second page', {
      tempDir, captureCode: false, stability: { delayMs: 0 },
    }),
  ]);

  assert.equal(first.score, 8);
  assert.equal(second.score, 8);
  assert.equal(paths.length, 4);
  assert.equal(new Set(paths).size, 2);
  assert.ok(paths.every(path => path.includes('validate-page-1700000000000-')));
  assert.deepEqual(readdirSync(tempDir), []);
});
