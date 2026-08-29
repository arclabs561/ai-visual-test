/**
 * Package export/type contract.
 *
 * The package map is the consumer-facing source of truth.  Keep its runtime
 * and declaration routes in lockstep so Node and TypeScript see the same API.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import * as root from '../../src/index.js';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

function exportRoute(entry) {
  assert.equal(typeof entry, 'object', 'every executable export must have import/types routes');
  assert.equal(typeof entry.import, 'string');
  assert.equal(typeof entry.types, 'string');
  return entry;
}

function declaredValueExports(source) {
  const declarations = [...source.matchAll(/^export\s+(?:declare\s+)?(?:class|function|const)\s+(\w+)/gm)]
    .map(match => match[1]);
  const reexports = [...source.matchAll(/^export\s*\{([^}]*)\}(?:\s*from\s+['"][^'"]+['"])?;?/gm)]
    .flatMap(match => match[1].split(','))
    .map(name => name.trim())
    .filter(name => !name.startsWith('type '))
    .map(name => name.replace(/^(\w+)\s+as\s+(\w+)$/, '$2'))
    .filter(Boolean);
  return [...new Set([...declarations, ...reexports])];
}

function namedValueReexports(source) {
  return [...source.matchAll(/^export\s*\{([^}]*)\}\s*from\s+['"]([^'"]+)['"];?/gm)]
    .map(match => ({
      source: match[2],
      values: match[1].split(',')
        .map(name => name.trim())
        .filter(name => !name.startsWith('type '))
        .map(name => name.replace(/^(\w+)\s+as\s+(\w+)$/, '$2'))
        .filter(Boolean),
    }));
}

describe('package export/type contract', () => {
  it('maps every executable export to existing runtime and declaration files', async () => {
    assert.equal(packageJson.types, packageJson.exports['.'].types);

    for (const [subpath, entry] of Object.entries(packageJson.exports)) {
      if (subpath === './package.json') continue;
      const route = exportRoute(entry);
      await access(resolve(route.import), constants.R_OK);
      await access(resolve(route.types), constants.R_OK);
    }
  });

  it('keeps the root declaration value exports aligned with runtime', async () => {
    const declarations = await readFile(resolve(packageJson.types), 'utf8');
    const declaredValues = declaredValueExports(declarations);

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

  it('keeps one composition overlay and does not redeclare private-alias values', async () => {
    const overlays = (await readdir('types'))
      .filter(name => name.endsWith('-barrel.d.ts'))
      .sort();
    const ensembleRoute = exportRoute(packageJson.exports['./ensemble']);
    const runtimeBarrel = await readFile(resolve(ensembleRoute.import), 'utf8');
    const legacyRuntimeValues = namedValueReexports(runtimeBarrel)
      .filter(reexport => reexport.source.endsWith('.mjs'))
      .flatMap(reexport => reexport.values)
      .sort();
    assert.deepEqual(
      overlays,
      legacyRuntimeValues.length > 0 ? ['ensemble-barrel.d.ts'] : [],
      'the composition overlay must exist only while the ensemble barrel exports JavaScript helpers',
    );
    if (legacyRuntimeValues.length === 0) return;

    const overlay = await readFile('types/ensemble-barrel.d.ts', 'utf8');
    const privateAliasValues = new Set(
      namedValueReexports(overlay)
        .filter(reexport => reexport.source.startsWith('#'))
        .flatMap(reexport => reexport.values),
    );
    const directValues = [...overlay.matchAll(/^export\s+(?:declare\s+)?(?:class|function|const)\s+(\w+)/gm)]
      .map(match => match[1]);
    assert.deepEqual(
      directValues.filter(name => privateAliasValues.has(name)),
      [],
      'the overlay must not redeclare a generated/private-alias value',
    );
    assert.deepEqual(
      directValues.sort(),
      legacyRuntimeValues,
      'the overlay declarations must exactly match the JavaScript helper exports that keep it necessary',
    );
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
