import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validatePage } from '../../src/page-validation.mjs';
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
