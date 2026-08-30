import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { captureWebImprovementObservation } from '../../src/web-improvement-observation.js';
import { canonicalJsonSha256 } from '../../src/improvement-replay.js';

test('captures a stable screenshot at the caller path and hashes its returned bytes', async () => {
  const screenshotCalls = [];
  const page = {
    async screenshot(options) {
      screenshotCalls.push(options);
      return Buffer.from('stable screenshot');
    },
    viewportSize() { return { width: 800, height: 600 }; },
    url() { return 'https://example.test/reset/secret-abc?token=not-for-storage#private'; },
  };

  const observation = await captureWebImprovementObservation(page, {
    screenshotPath: '/evidence/baseline.png',
    captureCode: false,
    fullPage: true,
    screenshot: { style: '.clock { display: none }' },
    stability: { delayMs: 0 },
  });

  assert.equal(screenshotCalls.length, 2);
  assert.equal(screenshotCalls[0].path, '/evidence/baseline.png');
  assert.equal(screenshotCalls[0].fullPage, true);
  assert.equal(screenshotCalls[0].style, '.clock { display: none }');
  assert.equal(
    observation.metadata.screenshotSha256,
    createHash('sha256').update('stable screenshot').digest('hex'),
  );
  assert.equal(observation.metadata.renderedCodeSha256, null);
  assert.equal(observation.digest, canonicalJsonSha256(observation.payload));
  assert.deepEqual(observation.payload.screenshot, {
    kind: 'sha256-artifact',
    sha256: observation.metadata.screenshotSha256,
    byteLength: Buffer.byteLength('stable screenshot'),
    mediaType: 'image/png',
  });
  assert.equal(observation.payload.renderedCode, null);
  assert.equal(observation.metadata.captureStable, true);
  assert.equal(observation.metadata.captureUrl, 'https://example.test');
  const receiptMetadata = JSON.stringify(observation.metadata);
  assert.equal(receiptMetadata.includes('secret-abc'), false);
  assert.equal(receiptMetadata.includes('not-for-storage'), false);
  assert.equal('capture' in observation.payload, false);
});

test('supports screenshot-only pages when rendered-code capture is disabled', async () => {
  const observation = await captureWebImprovementObservation({
    async screenshot() { return Buffer.from('screenshot only'); },
  }, {
    screenshotPath: '/evidence/screenshot-only.png',
    captureCode: false,
    stability: { enabled: false },
  });

  assert.equal(observation.payload.renderedCode, null);
  assert.equal(observation.metadata.captureAttempts, 1);
  assert.equal(observation.metadata.screenshotSha256, createHash('sha256').update('screenshot only').digest('hex'));
  assert.equal(observation.digest, canonicalJsonSha256(observation.payload));
});

test('rejects missing rendered-code capabilities before attempting a screenshot', async () => {
  let screenshotCalls = 0;
  await assert.rejects(
    () => captureWebImprovementObservation({
      async screenshot() {
        screenshotCalls += 1;
        return Buffer.from('unreachable');
      },
    }, { screenshotPath: '/evidence/unreachable.png' }),
    /captureCode requires page capabilities: content, evaluate, url, viewportSize/,
  );
  assert.equal(screenshotCalls, 0);
});

test('returns fresh payload and metadata snapshots for each capture', async () => {
  const viewport = { width: 1024, height: 768 };
  const sourceBytes = Buffer.from('fresh snapshot');
  const page = {
    async screenshot() { return sourceBytes; },
    viewportSize() { return viewport; },
    url() { return 'https://example.test/fresh'; },
  };

  const first = await captureWebImprovementObservation(page, {
    screenshotPath: '/evidence/first.png',
    captureCode: false,
    stability: { enabled: false },
  });
  first.metadata.captureViewportWidth = 1;
  first.metadata.captureFullPage = true;
  sourceBytes[0] = 1;
  viewport.width = 1440;

  const second = await captureWebImprovementObservation(page, {
    screenshotPath: '/evidence/second.png',
    captureCode: false,
    stability: { enabled: false },
  });

  assert.equal(second.payload.screenshot.sha256, createHash('sha256').update(sourceBytes).digest('hex'));
  assert.equal(second.payload.screenshot.byteLength, sourceBytes.byteLength);
  assert.equal(second.metadata.captureViewportWidth, 1440);
  assert.equal(second.metadata.captureFullPage, false);
});

test('keeps caller-owned screenshot bytes and paths outside the evaluator payload', async () => {
  const sourceBytes = Buffer.from('source snapshot');
  const page = {
    async screenshot() { return sourceBytes; },
  };
  const observation = await captureWebImprovementObservation(page, {
    screenshotPath: '/caller-owned/evidence.png',
    captureCode: false,
    stability: { enabled: false },
  });
  const digest = observation.digest;
  const screenshotSha256 = observation.metadata.screenshotSha256;

  sourceBytes.fill(0);

  assert.deepEqual(observation.payload.screenshot, {
    kind: 'sha256-artifact',
    sha256: screenshotSha256,
    byteLength: Buffer.byteLength('source snapshot'),
    mediaType: 'image/png',
  });
  assert.equal(observation.metadata.screenshotSha256, screenshotSha256);
  assert.equal(observation.digest, digest);
  assert.equal('screenshotPath' in observation.payload, false);
  assert.equal('screenshotBytes' in observation.payload, false);
  assert.equal(JSON.stringify(observation.payload).includes('caller-owned'), false);
  assert.equal(JSON.stringify(observation.payload).includes('source snapshot'), false);
});

test('represents ordinary full-page images above the JSON evidence string limit without embedding pixels', async () => {
  const image = Buffer.alloc(800 * 1024, 0x5a);
  const observation = await captureWebImprovementObservation({
    async screenshot() { return image; },
  }, {
    screenshotPath: '/caller-owned/full-page.png',
    captureCode: false,
    fullPage: true,
    stability: { enabled: false },
  });

  assert.equal(image.byteLength > 750 * 1024, true);
  assert.equal(observation.payload.screenshot.byteLength, image.byteLength);
  assert.equal(observation.payload.screenshot.sha256, createHash('sha256').update(image).digest('hex'));
  assert.equal(observation.payload.screenshot.mediaType, 'image/png');
  assert.equal(JSON.stringify(observation.payload).length < 1_000_000, true);
  assert.equal(JSON.stringify(observation.payload).includes(image.toString('base64').slice(0, 64)), false);
});

test('returns a frozen, tamper-safe artifact descriptor and rendered evidence snapshot', async () => {
  const observation = await captureWebImprovementObservation(renderedCodePage('<main>Frozen</main>'), {
    screenshotPath: '/caller-owned/frozen.png',
    stability: { enabled: false, waitForFonts: false },
  });
  const digest = observation.digest;
  const descriptor = observation.payload.screenshot;

  assert.equal(Object.isFrozen(observation.payload), true);
  assert.equal(Object.isFrozen(descriptor), true);
  assert.equal(Object.isFrozen(observation.payload.renderedCode), true);
  assert.throws(() => { descriptor.sha256 = '0'.repeat(64); }, TypeError);
  assert.throws(() => { observation.payload.renderedCode.body.tagName = 'TAMPERED'; }, TypeError);
  assert.equal(observation.payload.screenshot.sha256, observation.metadata.screenshotSha256);
  assert.equal(observation.digest, digest);
});

function renderedCodePage(html) {
  const evaluateResults = [
    [],
    {},
    {
      body: { tagName: 'BODY', children: 1, textContent: html, attributes: {} },
      head: { title: 'Evidence', meta: [], links: [] },
      mainElements: [],
    },
  ];
  return {
    async screenshot() { return Buffer.from('constant screenshot bytes'); },
    async content() { return html; },
    async evaluate() { return evaluateResults.shift(); },
    url() { return 'https://example.test/evidence'; },
    viewportSize() { return { width: 1024, height: 768 }; },
  };
}

test('binds rendered-code evidence even when screenshot bytes are unchanged', async () => {
  const first = await captureWebImprovementObservation(renderedCodePage('<main>Before</main>'), {
    screenshotPath: '/evidence/before.png',
    stability: { enabled: false, waitForFonts: false },
  });
  const second = await captureWebImprovementObservation(renderedCodePage('<main>After</main>'), {
    screenshotPath: '/evidence/after.png',
    stability: { enabled: false, waitForFonts: false },
  });

  assert.equal(first.metadata.screenshotSha256, second.metadata.screenshotSha256);
  assert.notEqual(first.metadata.renderedCodeSha256, second.metadata.renderedCodeSha256);
  assert.notEqual(first.digest, second.digest);
});

test('normalizes volatile rendered-code timestamps from payload and digest', async t => {
  const originalNow = Date.now;
  t.after(() => { Date.now = originalNow; });

  Date.now = () => 1;
  const first = await captureWebImprovementObservation(renderedCodePage('<main>Same page</main>'), {
    screenshotPath: '/evidence/same-first.png',
    stability: { enabled: false, waitForFonts: false },
  });
  Date.now = () => 2;
  const second = await captureWebImprovementObservation(renderedCodePage('<main>Same page</main>'), {
    screenshotPath: '/evidence/same-second.png',
    stability: { enabled: false, waitForFonts: false },
  });

  assert.equal('timestamp' in first.payload.renderedCode, false);
  assert.equal('url' in first.payload.renderedCode, false);
  assert.equal(first.metadata.renderedCodeSha256, second.metadata.renderedCodeSha256);
  assert.equal(first.digest, second.digest);
});
