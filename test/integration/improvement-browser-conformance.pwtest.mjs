/**
 * Internal reference-adapter conformance only. This is deliberately not a
 * downstream-project pilot: its page, mutation, deterministic gates, and
 * evaluator are all local test fixtures.
 */

import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { runImprovementReview } from '../../build/src/improvement-transaction.js';
import { captureWebImprovementObservation } from '../../build/src/web-improvement-observation.js';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const MAX_LOCAL_PNG_BYTES = 256 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const FIXTURE = `<!doctype html>
<html><head><style>
  body { font-family: system-ui; margin: 2rem; color: #172033; background: #f7f9fc; }
  .primary-action { border: 1px solid #64748b; border-radius: .4rem; padding: .65rem 1rem; background: #fff; color: #172033; }
  .primary-action.is-emphasized { border-color: #164e63; background: #164e63; color: #fff; font-weight: 700; box-shadow: 0 2px 6px rgb(22 78 99 / .25); }
  .primary-action.is-hidden { display: none; }
</style></head><body>
  <main><h1>Billing</h1><p>Choose how you want to continue.</p>
  <button id="primary-action" class="primary-action" type="button">Continue to payment</button></main>
  <script>window.__primaryActionInvocations = 0; document.querySelector('#primary-action').addEventListener('click', () => { window.__primaryActionInvocations += 1; });</script>
</body></html>`;

const evaluation = {
  id: 'browser-reference-conformance-v1',
  configSha256: sha256('local deterministic counterbalanced test evaluator'),
  variant: {
    kind: 'direct',
    promptVersion: 'browser-reference-v1',
    promptSha256: sha256('compare the two local browser captures'),
  },
};

function candidate(kind) {
  return {
    id: `primary-action-${kind}`,
    payload: { kind },
  };
}

function adapterFor(page) {
  return {
    async prepare(received) {
      const button = page.locator('#primary-action');
      return {
        candidateSha256: sha256(`browser-reference-candidate:${received.payload.kind}:v1`),
        handle: {
          kind: received.payload.kind,
          className: await button.getAttribute('class'),
          style: await button.getAttribute('style'),
          invocations: await page.evaluate(() => window.__primaryActionInvocations),
        },
      };
    },
    async apply(handle) {
      if (handle.kind === 'emphasize') {
        await page.locator('#primary-action').evaluate(button => button.classList.add('is-emphasized'));
      }
      if (handle.kind === 'harm') {
        await page.locator('#primary-action').evaluate(button => button.classList.add('is-hidden'));
      }
    },
    async verify(handle) {
      const button = page.locator('#primary-action');
      const visible = await button.isVisible();
      const semantic = await button.evaluate(element => (
        element.tagName === 'BUTTON' && element.textContent?.trim() === 'Continue to payment'
      ));
      let interaction = false;
      if (visible) {
        await button.click();
        interaction = await page.evaluate(
          baselineInvocations => window.__primaryActionInvocations === baselineInvocations + 1,
          handle.invocations,
        );
      }
      const emphasized = await button.evaluate(element => element.classList.contains('is-emphasized'));
      const hidden = await button.evaluate(element => element.classList.contains('is-hidden'));
      return [
        { id: 'semantic-primary-action', passed: semantic && visible },
        { id: 'interaction-primary-action', passed: interaction },
        { id: 'style-candidate-is-safe', passed: !hidden && (handle.kind !== 'emphasize' || emphasized) },
      ];
    },
    async rollback(handle) {
      await page.locator('#primary-action').evaluate((button, state) => {
        if (state.className === null) button.removeAttribute('class');
        else button.setAttribute('class', state.className);
        if (state.style === null) button.removeAttribute('style');
        else button.setAttribute('style', state.style);
        window.__primaryActionInvocations = state.invocations;
      }, handle);
    },
  };
}

function observerFor(page, evidenceDirectory, artifacts) {
  let captureNumber = 0;
  return {
    async capture(phase) {
      captureNumber += 1;
      const observation = await captureWebImprovementObservation(page, {
        screenshotPath: join(evidenceDirectory, `${phase}-${captureNumber}.png`),
        captureCode: false,
        fullPage: true,
        stability: { delayMs: 0, waitForNetworkIdle: false },
      });
      artifacts.set(observation.payload.screenshot.sha256, {
        path: join(evidenceDirectory, `${phase}-${captureNumber}.png`),
        byteLength: observation.payload.screenshot.byteLength,
      });
      return observation;
    },
  };
}

function localPngProjector(calls, artifacts) {
  return {
    id: 'browser-local-png-projection-v1',
    configSha256: sha256('resolve only caller-owned local PNG artifacts below 256 KiB'),
    async project(observation) {
      calls.push(observation);
      expect('digest' in observation).toBe(false);
      expect(Object.keys(observation.payload).sort()).toEqual(['renderedCode', 'screenshot']);
      const { screenshot } = observation.payload;
      expect(Object.keys(screenshot).sort()).toEqual(['byteLength', 'kind', 'mediaType', 'sha256']);
      expect(screenshot.kind).toBe('sha256-artifact');
      expect(screenshot.mediaType).toBe('image/png');
      expect(screenshot.byteLength).toBeLessThanOrEqual(MAX_LOCAL_PNG_BYTES);
      const artifact = artifacts.get(screenshot.sha256);
      expect(artifact).toBeDefined();
      expect(artifact.byteLength).toBe(screenshot.byteLength);
      const png = await readFile(artifact.path);
      expect(png.byteLength).toBe(screenshot.byteLength);
      expect(sha256(png)).toBe(screenshot.sha256);
      // This projection is intentionally local-only: it resolves a caller-owned
      // path and returns bounded bytes; it performs no remote upload or fetch.
      return { byteLength: png.byteLength, pngBase64: png.toString('base64') };
    },
  };
}

function inspectLocalPng(payload) {
  expect(Object.keys(payload).sort()).toEqual(['byteLength', 'pngBase64']);
  const png = Buffer.from(payload.pngBase64, 'base64');
  expect(png.byteLength).toBe(payload.byteLength);
  expect(png.byteLength).toBeLessThanOrEqual(MAX_LOCAL_PNG_BYTES);
  expect(png.subarray(0, PNG_SIGNATURE.byteLength).equals(PNG_SIGNATURE)).toBe(true);
  expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  expect(width).toBeGreaterThan(0);
  expect(height).toBeGreaterThan(0);
  return sha256(png);
}

function counterbalancedFixtureEvaluator(calls) {
  return {
    async compare(input) {
      calls.push(input);
      expect('digest' in input.a).toBe(false);
      expect('digest' in input.b).toBe(false);
      const aPixels = inspectLocalPng(input.a.payload);
      const bPixels = inspectLocalPng(input.b.payload);
      if (aPixels === bPixels) {
        return { winner: 'tie', execution: { id: `fixture-call-${calls.length}` } };
      }
      // For distinct captures, choose the changed page in each independently
      // blinded order: b for baseline/candidate, then a for candidate/baseline.
      return {
        winner: calls.length % 2 === 1 ? 'second' : 'first',
        execution: { id: `fixture-call-${calls.length}`, metadata: { localFixture: true } },
      };
    },
  };
}

test('browser reference adapter is reversible and control-sensitive', async ({ page }) => {
  const evidenceDirectory = await mkdtemp(join(tmpdir(), 'ai-visual-test-improvement-'));
  try {
    await page.setContent(FIXTURE);
    const baselineHtml = await page.locator('html').evaluate(element => element.outerHTML);
    const baselineClass = await page.locator('#primary-action').getAttribute('class');
    const baselineStyle = await page.locator('#primary-action').getAttribute('style');
    const baselineInvocations = await page.evaluate(() => window.__primaryActionInvocations);
    const objective = {
      id: 'primary-action-hierarchy',
      description: 'Make the primary action visually dominant without changing meaning or behavior.',
    };

    const preferredCalls = [];
    const preferredProjectionCalls = [];
    const preferredArtifacts = new Map();
    const preferred = await runImprovementReview({
      objective,
      candidate: candidate('emphasize'),
      adapter: adapterFor(page),
      observer: observerFor(page, evidenceDirectory, preferredArtifacts),
      projector: localPngProjector(preferredProjectionCalls, preferredArtifacts),
      evaluator: counterbalancedFixtureEvaluator(preferredCalls),
      evaluation,
    });

    expect(preferred.status).toBe('review-required');
    expect(preferred.reason).toBe('candidate-preferred');
    expect(preferred.gates.every(gate => gate.passed)).toBe(true);
    expect(preferred.rollback.digest).toBe(preferred.baseline.digest);
    expect(preferredCalls).toHaveLength(2);
    expect(preferredProjectionCalls).toHaveLength(2);
    expect(inspectLocalPng(preferredCalls[0].a.payload)).toBe(preferred.baseline.metadata.screenshotSha256);
    expect(inspectLocalPng(preferredCalls[0].b.payload)).toBe(preferred.candidateObservation.metadata.screenshotSha256);
    expect(inspectLocalPng(preferredCalls[1].a.payload)).toBe(preferred.candidateObservation.metadata.screenshotSha256);
    expect(inspectLocalPng(preferredCalls[1].b.payload)).toBe(preferred.baseline.metadata.screenshotSha256);
    expect(preferred.comparison.originalExecution.id).toBe('fixture-call-1');
    expect(preferred.comparison.reversedExecution.id).toBe('fixture-call-2');
    expect(preferred.evaluation.projector.id).toBe('browser-local-png-projection-v1');
    expect(await page.locator('html').evaluate(element => element.outerHTML)).toBe(baselineHtml);
    expect(await page.locator('#primary-action').getAttribute('class')).toBe(baselineClass);
    expect(await page.locator('#primary-action').getAttribute('style')).toBe(baselineStyle);
    expect(await page.evaluate(() => window.__primaryActionInvocations)).toBe(baselineInvocations);

    await page.setContent(FIXTURE);
    const noopCalls = [];
    const noopProjectionCalls = [];
    const noopArtifacts = new Map();
    const noop = await runImprovementReview({
      objective,
      candidate: candidate('noop'),
      adapter: adapterFor(page),
      observer: observerFor(page, evidenceDirectory, noopArtifacts),
      projector: localPngProjector(noopProjectionCalls, noopArtifacts),
      evaluator: counterbalancedFixtureEvaluator(noopCalls),
      evaluation,
    });
    expect(noop.status).toBe('rejected');
    expect(noop.reason).toBe('no-observable-change');
    expect(noopCalls).toHaveLength(0);
    expect(noopProjectionCalls).toHaveLength(0);
    expect(noop.rollback.digest).toBe(noop.baseline.digest);
    expect(await page.evaluate(() => window.__primaryActionInvocations)).toBe(0);

    await page.setContent(FIXTURE);
    const harmfulCalls = [];
    const harmfulProjectionCalls = [];
    const harmfulArtifacts = new Map();
    const harmful = await runImprovementReview({
      objective,
      candidate: candidate('harm'),
      adapter: adapterFor(page),
      observer: observerFor(page, evidenceDirectory, harmfulArtifacts),
      projector: localPngProjector(harmfulProjectionCalls, harmfulArtifacts),
      evaluator: counterbalancedFixtureEvaluator(harmfulCalls),
      evaluation,
    });
    expect(harmful.status).toBe('rejected');
    expect(harmful.reason).toBe('constraint-failed');
    expect(harmful.gates.some(gate => !gate.passed)).toBe(true);
    expect(harmfulCalls).toHaveLength(0);
    expect(harmfulProjectionCalls).toHaveLength(0);
    expect(harmful.rollback.digest).toBe(harmful.baseline.digest);
    expect(await page.locator('html').evaluate(element => element.outerHTML)).toBe(baselineHtml);
    expect(await page.evaluate(() => window.__primaryActionInvocations)).toBe(0);
  } finally {
    await rm(evidenceDirectory, { recursive: true, force: true });
  }
});
