import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  DatasetAcquisitionError,
  parseDatasetAcquisitionRecord,
  verifyDatasetAcquisitionArtifacts,
} from '../../../src/dataset-adapters/acquisition.js';

const diffspot = {
  version: 1,
  key: 'diffspot',
  provenance: {
    dataset: 'tencent/DiffSpot',
    sourceUrl: 'https://huggingface.co/datasets/tencent/DiffSpot',
    revision: 'c6dd79d5e1c0cbb4e7ca234c9f53c418a75e30ce',
    license: 'MIT',
    redistribution: 'allowed',
  },
  retrievedAt: '2026-08-28T16:00:00Z',
  normalizerVersion: 'diffspot-v1',
  status: 'available',
  artifacts: [{ path: 'test.parquet', sha256: 'a'.repeat(64), bytes: 532_400_000 }],
};

test('parses an immutable artifact receipt', () => {
  assert.deepEqual(parseDatasetAcquisitionRecord(diffspot), diffspot);
});

test('rejects mutable and malformed provenance revisions in an otherwise valid receipt', () => {
  for (const revision of ['main', 'c6dd79d5', 'a'.repeat(64)]) {
    assert.throws(
      () => parseDatasetAcquisitionRecord({
        ...diffspot,
        provenance: { ...diffspot.provenance, revision },
      }),
      /revision is not immutable/,
    );
  }
});

test('represents gated access as a typed blocked state', () => {
  const blocked = parseDatasetAcquisitionRecord({
    version: 1,
    key: 'vibe-design-arena',
    provenance: {
      dataset: 'datapointai/vibe-design-arena',
      sourceUrl: 'https://huggingface.co/datasets/datapointai/vibe-design-arena',
      revision: 'ee85ae467e14b1f454036544eb37eec0e2ab6368',
      license: 'CC-BY-4.0',
      redistribution: 'allowed',
    },
    retrievedAt: '2026-08-28T16:00:00Z',
    normalizerVersion: 'vibe-v1',
    status: 'blocked',
    blockedReason: 'gated access has not been accepted by the operator',
    artifacts: [],
  });
  assert.equal(blocked.status, 'blocked');
  assert.match(blocked.blockedReason, /gated access/);
});

test('rejects path traversal and evidence-free available states', () => {
  assert.throws(
    () => parseDatasetAcquisitionRecord({ ...diffspot, artifacts: [] }),
    /at least one artifact/,
  );
  assert.throws(
    () => parseDatasetAcquisitionRecord({
      ...diffspot,
      artifacts: [{ path: '../outside.parquet', sha256: 'a'.repeat(64), bytes: 1 }],
    }),
    DatasetAcquisitionError,
  );
});

test('verifies artifact bytes and digest below the external cache root', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dataset-acquisition-'));
  try {
    const bytes = Buffer.from('pinned dataset artifact');
    writeFileSync(join(directory, 'test.parquet'), bytes);
    const receipt = {
      ...diffspot,
      artifacts: [{
        path: 'test.parquet',
        sha256: createHash('sha256').update(bytes).digest('hex'),
        bytes: bytes.byteLength,
      }],
    };
    assert.equal(verifyDatasetAcquisitionArtifacts(receipt, directory).status, 'available');
    writeFileSync(join(directory, 'test.parquet'), 'changed');
    assert.throws(
      () => verifyDatasetAcquisitionArtifacts(receipt, directory),
      /byte length does not match|SHA-256 does not match/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
