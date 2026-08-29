import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { VLLMJudge } from '#judge';
import { createMatchers } from '../../src/integrations/playwright.js';

function registeredMatchers() {
  const matchers = {};
  createMatchers({ extend(registered) { Object.assign(matchers, registered); } });
  return matchers;
}

test('createMatchers validates expect and registers both Playwright matchers', () => {
  assert.throws(() => createMatchers(null), /Playwright/);
  assert.throws(() => createMatchers({}), /Playwright/);

  const matchers = registeredMatchers();
  assert.equal(typeof matchers.toHaveVisualScore, 'function');
  assert.equal(typeof matchers.toBeAccessibleHybrid, 'function');
});

test('toHaveVisualScore supports both screenshot paths and pages', async t => {
  const imagePath = join(tmpdir(), `playwright-matcher-${Date.now()}.png`);
  writeFileSync(imagePath, 'fixture');
  t.after(() => { if (existsSync(imagePath)) unlinkSync(imagePath); });

  const originalJudge = VLLMJudge.prototype.judgeScreenshot;
  VLLMJudge.prototype.judgeScreenshot = async () => ({
    enabled: true, score: 8, issues: ['minor spacing'], recommendations: [], reasoning: 'clear',
  });
  t.after(() => { VLLMJudge.prototype.judgeScreenshot = originalJudge; });

  const matchers = registeredMatchers();
  const pathResult = await matchers.toHaveVisualScore(imagePath, 7, 'Review fixture');
  assert.equal(pathResult.pass, true);

  const screenshotPaths = [];
  const page = {
    async content() { return '<main>fixture</main>'; },
    async evaluate() { return undefined; },
    url() { return 'https://example.test/fixture'; },
    viewportSize() { return { width: 800, height: 600 }; },
    async screenshot(options) {
      screenshotPaths.push(options.path);
      writeFileSync(options.path, 'fixture');
      return Buffer.from('fixture');
    },
  };
  const pageResult = await matchers.toHaveVisualScore(page, 7, 'Review page', {
    captureCode: false,
    stability: { enabled: false },
  });
  assert.equal(pageResult.pass, true);
  assert.equal(screenshotPaths.length, 1);
  assert.ok(screenshotPaths.every(path => !existsSync(path)));
});

test('toBeAccessibleHybrid cleans up a partial screenshot when capture fails', async () => {
  const matchers = registeredMatchers();
  let screenshotPath = null;
  const page = {
    async content() { return '<main>fixture</main>'; },
    async evaluate() { return undefined; },
    url() { return 'https://example.test/fixture'; },
    viewportSize() { return { width: 800, height: 600 }; },
    async screenshot(options) {
      screenshotPath = options.path;
      writeFileSync(options.path, 'partial fixture');
      throw new Error('capture interrupted');
    },
  };

  await assert.rejects(
    () => matchers.toBeAccessibleHybrid(page),
    /capture interrupted/,
  );
  assert.equal(existsSync(screenshotPath), false);
});

test('toBeAccessibleHybrid gives parallel captures distinct paths in the same tick', async t => {
  const matchers = registeredMatchers();
  const paths = [];
  const originalNow = Date.now;
  Date.now = () => 1_700_000_000_000;
  t.after(() => { Date.now = originalNow; });

  const page = {
    async content() { return '<main>fixture</main>'; },
    async evaluate() { return undefined; },
    url() { return 'https://example.test/fixture'; },
    viewportSize() { return { width: 800, height: 600 }; },
    async screenshot(options) {
      paths.push(options.path);
      writeFileSync(options.path, 'fixture');
      return Buffer.from('fixture');
    },
  };

  await Promise.all([
    assert.rejects(() => matchers.toBeAccessibleHybrid(page), /reading 'passing'/),
    assert.rejects(() => matchers.toBeAccessibleHybrid(page), /reading 'passing'/),
  ]);

  assert.equal(new Set(paths).size, 2);
  assert.ok(paths.every(path => path.includes('a11y-check-1700000000000-')));
  assert.ok(paths.every(path => !existsSync(path)));
});
