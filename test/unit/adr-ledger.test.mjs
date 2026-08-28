import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ADR_DIR = join(ROOT, 'docs/adr');

function listValues(frontmatter, field) {
  const lines = frontmatter.split('\n');
  const start = lines.findIndex(line => line === `${field}:`);
  if (start < 0) return [];
  const values = [];
  for (const line of lines.slice(start + 1)) {
    if (!/^  - /.test(line)) break;
    values.push(line.slice(4));
  }
  return values;
}

describe('ADR ledger', () => {
  const entries = readdirSync(ADR_DIR)
    .filter(name => /^\d{4}-.+\.md$/.test(name))
    .sort();

  it('indexes every numbered decision exactly once', () => {
    const index = readFileSync(join(ADR_DIR, 'README.md'), 'utf8');
    for (const entry of entries) {
      const number = entry.slice(0, 4);
      const escapedEntry = entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assert.strictEqual(
        index.match(new RegExp(`\\[${number}\\]\\(${escapedEntry}\\)`, 'g'))?.length,
        1,
        `${entry} must have one index row`,
      );
    }
  });

  it('keeps injectable decision metadata complete and path-shaped', () => {
    for (const entry of entries) {
      const text = readFileSync(join(ADR_DIR, entry), 'utf8');
      const frontmatter = text.match(/^---\n([\s\S]+?)\n---/)?.[1];
      assert.ok(frontmatter, `${entry} must have frontmatter`);
      for (const field of ['status:', 'date:', 'confidence:', 'governs:', 'why:', 'rejected:', 'review_trigger:']) {
        assert.match(frontmatter, new RegExp(`^${field}`, 'm'), `${entry} is missing ${field}`);
      }
      const governs = listValues(frontmatter, 'governs');
      assert.ok(governs.length > 0, `${entry} must govern at least one path`);
      assert.ok(
        governs.every(value => value.includes('/') || value.includes('*') || value.includes('.')),
        `${entry} has a non-path governs token`,
      );
    }
  });
});
