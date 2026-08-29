import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ledgerToDispositions, readLedger } from '../../src/perception/critiques.js';

test('ledger skips malformed JSONL lines while retaining valid values in order', () => {
  const directory = mkdtempSync(join(tmpdir(), 'perception-ledger-'));
  const ledgerPath = join(directory, 'ledger.jsonl');
  try {
    appendFileSync(ledgerPath, [
      '{"version":"v1","critique":"first overlap","status":"open"}',
      '{"version":"interrupted","critique":',
      'null',
      '{"version":"v2","critique":"second overlap","status":"open"}',
      '{"version":"v3","critique":"addressed footer","status":"addressed"}',
      '{"version":"missing-status","critique":"not a disposition"}',
      '{"version":"blank-critique","critique":"   ","status":"open"}',
    ].join('\n'));

    assert.deepEqual(readLedger(ledgerPath), [
      { version: 'v1', critique: 'first overlap', status: 'open' },
      null,
      { version: 'v2', critique: 'second overlap', status: 'open' },
      { version: 'v3', critique: 'addressed footer', status: 'addressed' },
      { version: 'missing-status', critique: 'not a disposition' },
      { version: 'blank-critique', critique: '   ', status: 'open' },
    ]);
    assert.deepEqual(ledgerToDispositions(ledgerPath), [
      {
        target: 'first overlap',
        disposition: 'operator-critique',
        reason: 'operator critique (build v1): first overlap',
      },
      {
        target: 'second overlap',
        disposition: 'operator-critique',
        reason: 'operator critique (build v2): second overlap',
      },
    ]);
    assert.deepEqual(ledgerToDispositions(ledgerPath, { onlyOpen: false }), [
      {
        target: 'first overlap',
        disposition: 'operator-critique',
        reason: 'operator critique (build v1): first overlap',
      },
      {
        target: 'second overlap',
        disposition: 'operator-critique',
        reason: 'operator critique (build v2): second overlap',
      },
      {
        target: 'addressed footer',
        disposition: 'rejected',
        reason: 'operator critique (build v3): addressed footer',
      },
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
