import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const scanner = ['scripts/detect-secrets.mjs', '../scripts/detect-secrets.mjs']
  .map(candidate => resolve(candidate))
  .find(candidate => existsSync(candidate));

assert.ok(scanner, 'secret scanner must be available to source and staged tests');

test('tracked release scan ignores ordinary templates and rejects credential JSON', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'ai-visual-secrets-'));

  try {
    execFileSync('git', ['init', '--quiet'], { cwd: fixture });
    writeFileSync(join(fixture, 'source.mjs'), 'const label = `frame-${1}`;\n');
    execFileSync('git', ['add', 'source.mjs'], { cwd: fixture });

    const clean = spawnSync(process.execPath, [scanner, '--tracked'], {
      cwd: fixture,
      encoding: 'utf8',
    });
    assert.equal(clean.status, 0, clean.stderr);

    const token = `ghp_${'a'.repeat(36)}`;
    writeFileSync(join(fixture, 'service-account.json'), `${JSON.stringify({ token })}\n`);
    execFileSync('git', ['add', 'service-account.json'], { cwd: fixture });

    const exposed = spawnSync(process.execPath, [scanner, '--tracked'], {
      cwd: fixture,
      encoding: 'utf8',
    });
    assert.notEqual(exposed.status, 0);
    assert.match(exposed.stderr, /SECRET DETECTION FAILED/);

    rmSync(join(fixture, 'service-account.json'));
    writeFileSync(join(fixture, 'README.md'), `${token}\n`);
    execFileSync('git', ['add', '--all'], { cwd: fixture });
    const documented = spawnSync(process.execPath, [scanner, '--tracked'], {
      cwd: fixture,
      encoding: 'utf8',
    });
    assert.notEqual(documented.status, 0, 'tracked documentation must be scanned');

    rmSync(join(fixture, 'README.md'));
    mkdirSync(join(fixture, 'test'));
    writeFileSync(join(fixture, 'test', 'helper.mjs'), `process.env.TOKEN = ${JSON.stringify(token)};\n`);
    execFileSync('git', ['add', '--all'], { cwd: fixture });
    const environmentAssignment = spawnSync(process.execPath, [scanner, '--tracked'], {
      cwd: fixture,
      encoding: 'utf8',
    });
    assert.notEqual(environmentAssignment.status, 0, 'process.env lines and test helpers must be scanned');

    rmSync(join(fixture, 'test'), { recursive: true, force: true });
    writeFileSync(join(fixture, 'source.mjs'), `config.apiKey = ${JSON.stringify(token)};\n`);
    execFileSync('git', ['add', '--all'], { cwd: fixture });
    const configAssignment = spawnSync(process.execPath, [scanner, '--tracked'], {
      cwd: fixture,
      encoding: 'utf8',
    });
    assert.notEqual(configAssignment.status, 0, 'config.apiKey assignments must be scanned');

    writeFileSync(join(fixture, 'source.mjs'), 'export const safe = true;\n');
    writeFileSync(join(fixture, '.env.example'), `OPENAI_API_KEY=${token}\n`);
    execFileSync('git', ['add', '--all', '--force'], { cwd: fixture });
    const environmentExample = spawnSync(process.execPath, [scanner, '--tracked'], {
      cwd: fixture,
      encoding: 'utf8',
    });
    assert.notEqual(environmentExample.status, 0, '.env.example must be scanned');

    rmSync(join(fixture, '.env.example'));
    writeFileSync(join(fixture, 'source.mjs'), `console.log(${JSON.stringify(token)});\n`);
    execFileSync('git', ['add', '--all'], { cwd: fixture });
    const loggedCredential = spawnSync(process.execPath, [scanner, '--tracked'], {
      cwd: fixture,
      encoding: 'utf8',
    });
    assert.notEqual(loggedCredential.status, 0, 'broad context allowlists must not hide known token formats');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('tracked release scan honors configured line exclusions without broad allowlists', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'ai-visual-secrets-ignore-'));

  try {
    execFileSync('git', ['init', '--quiet'], { cwd: fixture });
    writeFileSync(join(fixture, '.secretsignore'), 'pattern: process\\.env\\.HF_TOKEN\n');
    writeFileSync(join(fixture, 'allowed.mjs'), 'const token = process.env.HF_TOKEN;\n');
    execFileSync('git', ['add', '--all'], { cwd: fixture });

    const allowed = spawnSync(process.execPath, [scanner, '--tracked'], {
      cwd: fixture,
      encoding: 'utf8',
    });
    assert.equal(allowed.status, 0, allowed.stderr);

    const credential = `ghp_${'a'.repeat(36)}`;
    writeFileSync(join(fixture, 'exposed.mjs'), `const value = ${JSON.stringify(credential)};\n`);
    execFileSync('git', ['add', 'exposed.mjs'], { cwd: fixture });

    const exposed = spawnSync(process.execPath, [scanner, '--tracked'], {
      cwd: fixture,
      encoding: 'utf8',
    });
    assert.notEqual(exposed.status, 0);
    assert.match(exposed.stderr, /GitHub Personal Access Token/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
