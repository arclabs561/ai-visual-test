import { test } from 'node:test';
import assert from 'node:assert';
import {
  checkCrossModalConsistency,
  validateExperienceConsistency
} from '../../src/cross-modal-consistency.mjs';

// --- Result shape ---

test('checkCrossModalConsistency returns expected result shape', () => {
  const result = checkCrossModalConsistency();
  assert.ok('isConsistent' in result, 'missing isConsistent');
  assert.ok('issues' in result, 'missing issues');
  assert.ok('warnings' in result, 'missing warnings');
  assert.ok('checks' in result, 'missing checks');
  assert.ok('score' in result, 'missing score');
  assert.ok(Array.isArray(result.issues), 'issues should be an array');
  assert.ok(Array.isArray(result.warnings), 'warnings should be an array');
  assert.strictEqual(typeof result.score, 'number');
  assert.strictEqual(typeof result.isConsistent, 'boolean');
  assert.strictEqual(typeof result.checks, 'object');
});

// --- Empty / missing inputs ---

test('empty options returns score 0 and an issue about missing modalities', () => {
  const result = checkCrossModalConsistency({});
  assert.strictEqual(result.isConsistent, false);
  assert.strictEqual(result.score, 0);
  assert.ok(result.issues.length > 0, 'should have at least one issue');
  assert.ok(result.issues[0].includes('Missing both'), `unexpected issue: ${result.issues[0]}`);
});

test('no arguments at all is equivalent to empty options', () => {
  const result = checkCrossModalConsistency();
  assert.strictEqual(result.isConsistent, false);
  assert.strictEqual(result.score, 0);
  assert.ok(result.issues.some(i => i.includes('Missing both')));
});

// --- Consistent inputs (all modalities align) ---

test('consistent inputs produce high score, no issues, no warnings', () => {
  const result = checkCrossModalConsistency({
    screenshot: '/tmp/shot.png',
    renderedCode: {
      html: '<html><title>My Game</title><body><div id="game"></div></body></html>',
      criticalCSS: {
        '#game': { display: 'block', position: 'relative' }
      },
      domStructure: {
        game: { exists: true }
      }
    },
    gameState: { gameActive: true, score: 10 },
    pageState: { title: 'My Game' }
  });
  assert.strictEqual(result.isConsistent, true);
  assert.strictEqual(result.issues.length, 0);
  assert.strictEqual(result.warnings.length, 0);
  assert.strictEqual(result.score, 1);
  assert.strictEqual(result.summary, 'All consistency checks passed');
});

// --- Screenshot only ---

test('screenshot only returns consistent with no issues', () => {
  const result = checkCrossModalConsistency({ screenshot: '/tmp/shot.png' });
  assert.strictEqual(result.isConsistent, true);
  assert.strictEqual(result.issues.length, 0);
  assert.ok(result.checks.hasScreenshot);
  assert.ok(!result.checks.hasRenderedCode);
});

// --- renderedCode only (no screenshot) ---

test('renderedCode only is still consistent when no issues found', () => {
  const result = checkCrossModalConsistency({
    renderedCode: {
      html: '<div>hello</div>',
      domStructure: { main: { exists: true } }
    }
  });
  assert.strictEqual(result.isConsistent, true);
  assert.strictEqual(result.issues.length, 0);
  assert.ok(!result.checks.hasScreenshot);
  assert.ok(result.checks.hasRenderedCode);
});

// --- Hidden elements detection ---

test('display:none on game element produces a warning', () => {
  const result = checkCrossModalConsistency({
    screenshot: '/tmp/shot.png',
    renderedCode: {
      criticalCSS: {
        '.game-canvas': { display: 'none' }
      }
    }
  });
  assert.ok(result.warnings.some(w => w.includes('display:none')),
    `expected display:none warning, got: ${result.warnings}`);
});

test('visibility:hidden on game element produces a warning', () => {
  const result = checkCrossModalConsistency({
    screenshot: '/tmp/shot.png',
    renderedCode: {
      criticalCSS: {
        '#game-overlay': { visibility: 'hidden' }
      }
    }
  });
  assert.ok(result.warnings.some(w => w.includes('visibility:hidden')),
    `expected visibility:hidden warning, got: ${result.warnings}`);
});

test('display:none on non-game element does NOT produce a warning', () => {
  const result = checkCrossModalConsistency({
    screenshot: '/tmp/shot.png',
    renderedCode: {
      criticalCSS: {
        '.modal': { display: 'none' }
      }
    }
  });
  assert.strictEqual(result.warnings.length, 0,
    `no warnings expected for non-game hidden element, got: ${result.warnings}`);
});

// --- Positioning issues ---

test('absolute positioning with auto top/left triggers a warning', () => {
  const result = checkCrossModalConsistency({
    screenshot: '/tmp/shot.png',
    renderedCode: {
      criticalCSS: {
        '.floating-panel': { position: 'absolute', top: 'auto', left: 'auto' }
      }
    }
  });
  assert.ok(result.warnings.some(w => w.includes('absolute positioning') && w.includes('auto')),
    `expected positioning warning, got: ${result.warnings}`);
});

// --- Game state inconsistency ---

test('active game state with missing game DOM element produces warning', () => {
  const result = checkCrossModalConsistency({
    screenshot: '/tmp/shot.png',
    renderedCode: {
      domStructure: {
        header: { exists: true }
        // no 'game' key
      }
    },
    gameState: { gameActive: true }
  });
  assert.ok(result.warnings.some(w => w.includes('active game') && w.includes('not found')),
    `expected game state mismatch warning, got: ${result.warnings}`);
});

// --- Page title mismatch ---

test('page title not found in HTML produces warning', () => {
  const result = checkCrossModalConsistency({
    screenshot: '/tmp/shot.png',
    renderedCode: {
      html: '<html><body>Hello</body></html>'
    },
    pageState: { title: 'Dashboard' }
  });
  assert.ok(result.warnings.some(w => w.includes('Dashboard') && w.includes('not found')),
    `expected title mismatch warning, got: ${result.warnings}`);
});

// --- Strict mode ---

test('strict mode marks result inconsistent when warnings exist', () => {
  const opts = {
    screenshot: '/tmp/shot.png',
    renderedCode: {
      html: '<html><body>Hello</body></html>'
    },
    pageState: { title: 'Missing Title' }
  };
  const normal = checkCrossModalConsistency(opts);
  const strict = checkCrossModalConsistency({ ...opts, strict: true });

  // Both should have the same warnings
  assert.strictEqual(normal.warnings.length, strict.warnings.length);
  // Normal is consistent (warnings only), strict is not
  assert.strictEqual(normal.isConsistent, true);
  assert.strictEqual(strict.isConsistent, false);
});

test('strict mode adds score verification warning when gameState has score', () => {
  const result = checkCrossModalConsistency({
    screenshot: '/tmp/shot.png',
    renderedCode: {
      domStructure: { game: { exists: true } }
    },
    gameState: { gameActive: true, score: 42 },
    strict: true
  });
  assert.ok(result.warnings.some(w => w.includes('score') && w.includes('verify')),
    `expected score verification warning in strict mode, got: ${result.warnings}`);
});

// --- Score calculation ---

test('score decreases as warnings accumulate', () => {
  const clean = checkCrossModalConsistency({ screenshot: '/tmp/shot.png' });
  const dirty = checkCrossModalConsistency({
    screenshot: '/tmp/shot.png',
    renderedCode: {
      criticalCSS: {
        '.game-a': { display: 'none' },
        '.game-b': { visibility: 'hidden' },
        '.game-c': { position: 'absolute', top: 'auto', left: 'auto' }
      }
    }
  });
  assert.ok(dirty.score < clean.score,
    `dirty score ${dirty.score} should be less than clean score ${clean.score}`);
});

// --- validateExperienceConsistency ---

test('validateExperienceConsistency extracts fields from experience object', () => {
  const experience = {
    screenshots: [{ path: '/tmp/exp.png' }],
    renderedCode: {
      html: '<html><title>Exp</title></html>',
      domStructure: { main: { exists: true } }
    },
    pageState: {
      title: 'Exp',
      gameState: { gameActive: false }
    }
  };
  const result = validateExperienceConsistency(experience);
  assert.strictEqual(result.isConsistent, true);
  assert.ok(result.checks.hasScreenshot);
  assert.ok(result.checks.hasRenderedCode);
  assert.ok(result.checks.hasPageState);
  assert.ok(result.checks.hasGameState);
});

test('validateExperienceConsistency uses top-level gameState as fallback', () => {
  const experience = {
    screenshots: [],
    renderedCode: {
      domStructure: { game: { exists: true } }
    },
    gameState: { gameActive: true }
  };
  const result = validateExperienceConsistency(experience);
  assert.ok(result.checks.hasGameState, 'should pick up top-level gameState');
});

test('validateExperienceConsistency forwards strict option', () => {
  const experience = {
    screenshots: [{ path: '/tmp/s.png' }],
    renderedCode: {
      html: '<html>no title match</html>'
    },
    pageState: { title: 'Mismatch' }
  };
  const normal = validateExperienceConsistency(experience);
  const strict = validateExperienceConsistency(experience, { strict: true });
  assert.strictEqual(normal.isConsistent, true);
  assert.strictEqual(strict.isConsistent, false);
});
