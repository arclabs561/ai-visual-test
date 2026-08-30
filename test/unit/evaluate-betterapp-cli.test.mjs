import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evaluator = join(repositoryRoot, 'scripts/evaluate-betterapp.mjs');
const revision = '5e087dedcd48c74fffb0802e8035006995b57e36';
const png = Buffer.from('89504e470d0a1a0a', 'hex');
const sha256 = value => createHash('sha256').update(value).digest('hex');

function row(port, id) {
  return {
    img_good: { src: `http://127.0.0.1:${port}/assets/${revision}/${id}-good.png` },
    img_bad: { src: `http://127.0.0.1:${port}/assets/${revision}/${id}-bad.png` },
    caption: `Good ${id}`, caption_bad: `Bad ${id}`,
    filename: `${id}-good.png`, filename_bad: `${id}-bad.png`,
  };
}

function run(argumentsList, environment = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [evaluator, ...argumentsList], {
      cwd: repositoryRoot, env: { ...process.env, NODE_ENV: 'test', ...environment }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', value => { stdout += value; }); child.stderr.on('data', value => { stderr += value; });
    child.on('error', reject); child.on('close', status => resolveRun({ status, stdout, stderr }));
  });
}

function acquisitionDirectory(parent) {
  const entries = readdirSync(parent).filter(name => name.startsWith('betterapp-acquisition-'));
  assert.equal(entries.length, 1);
  return join(parent, entries[0]);
}

test('prints BetterApp help and rejects hosted-evaluation-shaped input', async () => {
  const help = await run(['--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /dataset-terms confirmation/);
  const badLimit = await run(['--fetch-only', '--limit', '21']);
  assert.equal(badLimit.status, 1); assert.match(badLimit.stderr, /1 to 20/);
  const missingResults = await run(['--evaluate-existing', '/private/input']);
  assert.equal(missingResults.status, 1); assert.match(missingResults.stderr, /requires exactly one of --results, --local-model, or --openrouter-model/);
  const upload = await run(['--fetch-only', '--upload-confirmation', 'nope']);
  assert.equal(upload.status, 1); assert.match(upload.stderr, /valid only with --evaluate-existing/);
  const remoteMissingReceipt = await run(['--evaluate-existing', '/private/input', '--openrouter-model', 'model/a']);
  assert.equal(remoteMissingReceipt.status, 1); assert.match(remoteMissingReceipt.stderr, /requires --openrouter-provider/);
  const remoteProviderOutsideHosted = await run(['--fetch-only', '--openrouter-provider', 'endpoint-slug']);
  assert.equal(remoteProviderOutsideHosted.status, 1); assert.match(remoteProviderOutsideHosted.stderr, /evaluation options are valid only/);
});

test('anonymously fetches pinned BetterApp rows, verifies image bytes, and scores local AB/BA results', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'betterapp-cli-'));
  const cache = join(directory, 'cache'); const output = join(directory, 'output');
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/rows') {
      assert.equal(url.searchParams.get('dataset'), 'biglab/uiclip_human_data-paired_hf');
      assert.equal(url.searchParams.get('split'), 'test');
      assert.equal(url.searchParams.get('revision'), revision);
      response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ rows: [{ row: row(server.address().port, 'first') }, { row: row(server.address().port, 'second') }] })); return;
    }
    response.setHeader('content-type', 'image/png'); response.end(png);
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  try {
    const fetched = await run(['--fetch-only', '--limit', '2', '--cache-dir', cache, '--output-dir', output], { AI_VISUAL_TEST_BETTERAPP_ROWS_URL: `http://127.0.0.1:${server.address().port}/rows` });
    assert.equal(fetched.status, 0, fetched.stderr);
    const receipt = JSON.parse(fetched.stdout);
    assert.deepEqual({ version: receipt.version, mode: receipt.mode, dataset: receipt.dataset, selected: receipt.selected, artifacts: receipt.artifacts, revision: receipt.revision, providerUploadPolicy: receipt.providerUploadPolicy }, {
      version: 2, mode: 'fetch-only', dataset: 'uiclip-betterapp', selected: 2, artifacts: 5, revision, providerUploadPolicy: 'requires-dataset-terms-confirmation',
    });
    const acquisitionOutput = acquisitionDirectory(output);
    const acquisition = JSON.parse(readFileSync(join(acquisitionOutput, 'betterapp-acquisition-v1.json'), 'utf8'));
    assert.equal(acquisition.status, 'available'); assert.equal(acquisition.artifacts.length, 5);
    assert.ok(acquisition.artifacts.filter(item => item.path.startsWith('images/')).every(item => /^[a-f0-9]{64}$/.test(item.sha256) && item.recognizedContentType === 'image/png'));
    const examples = JSON.parse(readFileSync(join(acquisitionOutput, 'betterapp-examples-v2.json'), 'utf8'));
    assert.equal(examples.selection.counterbalance, 'AB-and-BA-required');
    assert.equal(examples.splits[0].examples.length, 2);
    assert.ok(examples.splits[0].examples.every(example => example.evidence.releaseGateEligible === false));
    const localResults = join(directory, 'local-results.json');
    writeFileSync(localResults, JSON.stringify({ version: 1, results: examples.splits[0].examples.map(example => ({ id: example.id, orders: [{ order: 'AB', prediction: example.votes.A === 1 ? 'A' : 'B' }, { order: 'BA', prediction: example.votes.A === 1 ? 'B' : 'A' }] })) }));
    const evaluated = await run(['--evaluate-existing', acquisitionOutput, '--results', localResults, '--cache-dir', cache, '--output-dir', join(directory, 'evaluated')]);
    assert.equal(evaluated.status, 0, evaluated.stderr);
    const report = JSON.parse(evaluated.stdout);
    assert.equal(report.metrics.majorityExactAgreement.rate, 1);
    assert.deepEqual(report.metrics.orderReconciliation, { single: 0, agree: 2, conflict: 0, incomplete: 0 });
    assert.equal(report.providerUploadPolicy, 'requires-dataset-terms-confirmation');
    const { evaluateExistingBetterAppRun, evaluateExistingBetterAppOpenRouterRun } = await import('../../scripts/evaluate-betterapp.mjs');
    const validConfirmation = {
      dataset: 'uiclip-betterapp', provider: 'openrouter', model: 'fixture-vision', purpose: 'research-evaluation',
      confirmedBy: 'test operator', confirmedAt: '2026-08-30T00:00:00Z', acknowledgements: ['dataset-terms-reviewed', 'provider-upload-permitted'],
    };
    let policyCalls = 0;
    await assert.rejects(evaluateExistingBetterAppOpenRouterRun({
      inputDirectory: acquisitionOutput, cacheDirectory: cache, outputDirectory: join(directory, 'policy-output'), model: 'fixture-vision', providerSlug: 'fixture-endpoint',
      confirmation: { ...validConfirmation, acknowledgements: ['provider-upload-permitted'] },
      evaluator: async () => { policyCalls += 1; return {}; },
    }), /must acknowledge dataset-terms-reviewed/);
    assert.equal(policyCalls, 0, 'policy rejection must happen before remote evaluator calls');
    let remoteCalls = 0;
    mkdirSync(join(directory, 'hosted-output'), { mode: 0o700 });
    const hosted = await evaluateExistingBetterAppOpenRouterRun({
      inputDirectory: acquisitionOutput, cacheDirectory: cache, outputDirectory: join(directory, 'hosted-output'), model: 'fixture-vision', providerSlug: 'fixture-endpoint', confirmation: validConfirmation,
      evaluator: async (_paths, _prompt, context) => {
        remoteCalls += 1;
        return { outcome: { kind: 'pairwise', winner: context.order === 'AB' ? 'A' : 'B' }, model: 'fixture-vision', provider: 'fixture-provider', nativeModel: 'fixture-native', requestConfig: { maximumOutputTokens: 64, reasoning: { effort: 'minimal', exclude: true }, providerRouting: { only: ['fixture-endpoint'], allow_fallbacks: false, require_parameters: true, data_collection: 'deny' } }, usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12, cost: 0.001 } };
      },
    });
    assert.equal(remoteCalls, 4);
    assert.deepEqual(hosted.run.remote, { provider: 'openrouter', model: 'fixture-vision', nativeModel: 'fixture-native', routedProvider: 'fixture-provider', requestConfig: { maximumOutputTokens: 64, reasoning: { effort: 'minimal', exclude: true }, providerRouting: { only: ['fixture-endpoint'], allow_fallbacks: false, require_parameters: true, data_collection: 'deny' } }, usage: { calls: 4, promptTokens: 40, completionTokens: 8, totalTokens: 48, cost: { status: 'complete', reportedCalls: 4, missingCalls: 0, reportedCost: 0.004 } } });
    assert.equal(hosted.metrics.orderReconciliation.agree, 2);
    mkdirSync(join(directory, 'inconsistent-output'), { mode: 0o700 });
    await assert.rejects(evaluateExistingBetterAppOpenRouterRun({
      inputDirectory: acquisitionOutput, cacheDirectory: cache, outputDirectory: join(directory, 'inconsistent-output'), model: 'fixture-vision', providerSlug: 'fixture-endpoint', confirmation: validConfirmation,
      evaluator: async (_paths, _prompt, context) => ({ outcome: { kind: 'pairwise', winner: context.order === 'AB' ? 'A' : 'B' }, model: 'fixture-vision', requestConfig: { maximumOutputTokens: context.order === 'AB' ? 64 : 65, reasoning: { effort: 'minimal', exclude: true }, providerRouting: { only: ['fixture-endpoint'], allow_fallbacks: false, require_parameters: true, data_collection: 'deny' } }, usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }),
    }), /mixed OpenRouter request configurations/);
    const mapPath = join(acquisitionOutput, 'betterapp-artifact-map-v1.json');
    const originalMap = JSON.parse(readFileSync(mapPath, 'utf8'));
    const originalDocument = JSON.parse(readFileSync(join(acquisitionOutput, 'betterapp-examples-v2.json'), 'utf8'));
    const swappedMap = structuredClone(originalMap);
    [swappedMap.entries[0].imageAArtifact, swappedMap.entries[0].imageBArtifact] = [swappedMap.entries[0].imageBArtifact, swappedMap.entries[0].imageAArtifact];
    const swappedDocument = structuredClone(originalDocument);
    swappedDocument.selection.artifactMapSha256 = sha256(`${JSON.stringify(swappedMap, null, 2)}\n`);
    writeFileSync(mapPath, `${JSON.stringify(swappedMap, null, 2)}\n`, { mode: 0o600 });
    writeFileSync(join(acquisitionOutput, 'betterapp-examples-v2.json'), `${JSON.stringify(swappedDocument, null, 2)}\n`, { mode: 0o600 });
    let semanticCalls = 0;
    await assert.rejects(evaluateExistingBetterAppOpenRouterRun({
      inputDirectory: acquisitionOutput, cacheDirectory: cache, outputDirectory: join(directory, 'swapped-output'), model: 'fixture-vision', providerSlug: 'fixture-endpoint', confirmation: validConfirmation,
      evaluator: async () => { semanticCalls += 1; return {}; },
    }), /image A\/B semantic identity/);
    assert.equal(semanticCalls, 0, 'swapped valid artifacts must be rejected before a remote evaluator sees pixels');
    writeFileSync(mapPath, `${JSON.stringify(originalMap, null, 2)}\n`, { mode: 0o600 });
    writeFileSync(join(acquisitionOutput, 'betterapp-examples-v2.json'), `${JSON.stringify(originalDocument, null, 2)}\n`, { mode: 0o600 });
    const tamperedPath = join(acquisitionOutput, 'betterapp-examples-v2.json');
    const tampered = JSON.parse(readFileSync(tamperedPath, 'utf8'));
    tampered.splits[0].examples[0].votes = { A: 1, B: 0 };
    writeFileSync(tamperedPath, `${JSON.stringify(tampered)}\n`, { mode: 0o600 });
    let calls = 0;
    await assert.rejects(evaluateExistingBetterAppRun({
      inputDirectory: acquisitionOutput, cacheDirectory: cache, outputDirectory: join(directory, 'tampered-output'),
      evaluator: async () => { calls += 1; return { id: 'unreachable', prediction: 'A' }; },
    }), /normalized selection or external-eval split was altered/);
    assert.equal(calls, 0, 'tampered labels must be rejected before a local evaluator sees pixels');
  } finally {
    await new Promise(resolveClose => server.close(resolveClose));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('writes a metadata-only receipt when pixel bytes are not images', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'betterapp-malformed-'));
  const server = createServer((request, response) => {
    if (new URL(request.url, 'http://127.0.0.1').pathname === '/rows') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ rows: [{ row: row(server.address().port, 'bad') }] })); return; }
    response.setHeader('content-type', 'text/html'); response.end('not an image');
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  try {
    const output = join(directory, 'out');
    const result = await run(['--fetch-only', '--limit', '1', '--cache-dir', join(directory, 'cache'), '--output-dir', output], { AI_VISUAL_TEST_BETTERAPP_ROWS_URL: `http://127.0.0.1:${server.address().port}/rows` });
    assert.equal(result.status, 1); assert.match(result.stderr, /unavailable or malformed/);
    const receipt = JSON.parse(readFileSync(join(acquisitionDirectory(output), 'betterapp-acquisition-v1.json'), 'utf8'));
    assert.equal(receipt.status, 'metadata-only');
  } finally { await new Promise(resolveClose => server.close(resolveClose)); rmSync(directory, { recursive: true, force: true }); }
});
