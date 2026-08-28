/**
 * Package export/type contract.
 *
 * The package map is the consumer-facing source of truth.  Keep its runtime
 * and declaration routes in lockstep so Node and TypeScript see the same API.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import * as root from '../../src/index.mjs';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

function exportRoute(entry) {
  assert.equal(typeof entry, 'object', 'every executable export must have import/types routes');
  assert.equal(typeof entry.import, 'string');
  assert.equal(typeof entry.types, 'string');
  return entry;
}

function declaredValueExports(source) {
  return [...source.matchAll(/^export\s+(?:declare\s+)?(?:class|function|const)\s+(\w+)/gm)]
    .map(match => match[1]);
}

describe('package export/type contract', () => {
  it('maps every executable export to existing runtime and declaration files', async () => {
    assert.equal(packageJson.types, './index.d.ts');

    for (const [subpath, entry] of Object.entries(packageJson.exports)) {
      if (subpath === './package.json') continue;
      const route = exportRoute(entry);
      await access(resolve(route.import), constants.R_OK);
      await access(resolve(route.types), constants.R_OK);
    }
  });

  it('keeps the root declaration value exports aligned with runtime', async () => {
    const declarations = await readFile('index.d.ts', 'utf8');
    const declaredValues = declaredValueExports(declarations);
    declaredValues.push('_validateScreenshot');

    assert.deepEqual(declaredValues.sort(), Object.keys(root).sort());
  });

  it('keeps each subpath declaration value surface aligned with runtime', async () => {
    for (const [subpath, entry] of Object.entries(packageJson.exports)) {
      if (subpath === '.' || subpath === './package.json') continue;
      const route = exportRoute(entry);
      const declarations = await readFile(resolve(route.types), 'utf8');
      const runtime = await import(`${packageJson.name}/${subpath.slice(2)}`);
      assert.deepEqual(
        declaredValueExports(declarations).sort(),
        Object.keys(runtime).sort(),
        `${subpath} declaration exports drifted from runtime`,
      );
    }
  });

  it('loads each public import route through Node package resolution', async () => {
    const packageName = packageJson.name;
    for (const subpath of Object.keys(packageJson.exports)) {
      if (subpath === './package.json') continue;
      const specifier = subpath === '.' ? packageName : `${packageName}/${subpath.slice(2)}`;
      const imported = await import(specifier);
      assert.ok(Object.keys(imported).length > 0, `${specifier} has no exports`);
    }
  });
});
