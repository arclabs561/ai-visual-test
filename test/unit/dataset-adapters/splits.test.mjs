import assert from 'node:assert/strict';
import test from 'node:test';

import { DatasetSplitError, assertGroupDisjointSplits } from '../../../src/dataset-adapters/splits.js';

test('accepts group-disjoint development and held-out evidence', () => {
  assert.doesNotThrow(() => assertGroupDisjointSplits([
    { name: 'development', examples: [{ id: 'p1-a-b', groupId: 'p1', sourceGroups: ['prompt:p1'] }] },
    { name: 'held-out', examples: [{ id: 'p2-a-b', groupId: 'p2', sourceGroups: ['prompt:p2'] }] },
  ]));
});

test('rejects overlap through either member of a pair', () => {
  assert.throws(() => assertGroupDisjointSplits([
    { name: 'development', examples: [{ id: 'a-b', groupId: 'pair:a:b', sourceGroups: ['app:a', 'app:b'] }] },
    { name: 'held-out', examples: [{ id: 'a-c', groupId: 'pair:a:c', sourceGroups: ['app:a', 'app:c'] }] },
  ]), /source group app:a crosses development and held-out/);
});

test('rejects duplicate row identities even inside one split', () => {
  assert.throws(() => assertGroupDisjointSplits([
    { name: 'test', examples: [
      { id: 'same', groupId: 'one' },
      { id: 'same', groupId: 'two' },
    ] },
  ]), DatasetSplitError);
});
