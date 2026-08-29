import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectSpirals,
  extractFixedTimestamps,
  extractIssues,
  findConsensus,
  timestampToSeconds,
} from '../../src/extractors.js';

test('extractors parse severity lines and preserve their textual fields', () => {
  const issues = extractIssues([
    '[major] 00:42 light — Checkout button is low contrast',
    '[MINOR] 01:02:03: Footer copy is hard to read',
  ].join('\n'));

  assert.deepEqual(issues, [
    { severity: 'MAJOR', timestamp: '00:42', desc: 'Checkout button is low contrast' },
    { severity: 'MINOR', timestamp: '01:02:03', desc: 'Footer copy is hard to read' },
  ]);
  assert.equal(timestampToSeconds('00:42'), 42);
  assert.equal(timestampToSeconds('01:02:03'), 3723);
  assert.ok(Number.isNaN(timestampToSeconds('not-a-timestamp')));
});

test('extractors isolate FIXED lines without mutating the supplied options', () => {
  const options = { severities: ['MAJOR'] };
  const fixed = extractFixedTimestamps('[FIXED] 00:10 — Checkout label restored', options);

  assert.deepEqual(fixed, [
    { severity: 'FIXED', timestamp: '00:10', desc: 'Checkout label restored' },
  ]);
  assert.deepEqual(options, { severities: ['MAJOR'] });
});

test('extractors cluster consensus by timestamp and order critical clusters first', () => {
  const consensus = findConsensus({
    flash: [
      { severity: 'MINOR', timestamp: '00:10', desc: 'Small label' },
      { severity: 'CRITICAL', timestamp: '00:30', desc: 'Checkout blocked' },
    ],
    pro: [
      { severity: 'MINOR', timestamp: '00:13', desc: 'Label lacks contrast' },
      { severity: 'CRITICAL', timestamp: '00:32', desc: 'Cannot submit order' },
    ],
  });

  assert.deepEqual(consensus.map(({ cluster, judges }) => ({
    severities: cluster.map(({ severity }) => severity),
    judges,
  })), [
    { severities: ['CRITICAL', 'CRITICAL'], judges: ['flash', 'pro'] },
    { severities: ['MINOR', 'MINOR'], judges: ['flash', 'pro'] },
  ]);
  assert.equal(consensus[0].cluster[0].sec, 30);
});

test('extractors report a re-raised issue near a prior fixed timestamp', () => {
  const warnings = detectSpirals({
    flash: [
      { severity: 'MAJOR', timestamp: '00:44', desc: 'Checkout button regressed' },
      { severity: 'FIXED', timestamp: '00:45', desc: 'Ignored as current fixed state' },
    ],
  }, new Set([42]));

  assert.deepEqual(warnings, [{
    judge: 'flash',
    severity: 'MAJOR',
    timestamp: '00:44',
    desc: 'Checkout button regressed',
    prevFixedSec: 42,
  }]);
});
