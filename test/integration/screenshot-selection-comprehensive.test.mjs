import { test } from 'node:test';
import assert from 'node:assert';
import { selectRepresentativeScreenshots } from '#temporal-prompt-formatting';

test('selectRepresentativeScreenshots handles empty array', () => {
  const selected = selectRepresentativeScreenshots([], [], { maxScreenshots: 10 });
  assert.strictEqual(selected.length, 0, 'Should return empty array for empty input');
});

test('selectRepresentativeScreenshots handles single screenshot', () => {
  const screenshots = [{ path: '1.png', timestamp: 1000 }];
  const selected = selectRepresentativeScreenshots(screenshots, [], { maxScreenshots: 10 });
  assert.strictEqual(selected.length, 1, 'Should return single screenshot');
  assert.strictEqual(selected[0], screenshots[0], 'Should return the same screenshot');
});

test('selectRepresentativeScreenshots keyframes strategy captures state changes', () => {
  const screenshots = Array.from({ length: 20 }, (_, i) => ({
    path: `${i}.png`,
    timestamp: i * 1000
  }));
  
  const evaluations = Array.from({ length: 20 }, (_, i) => {
    // Create significant score changes at indices 5, 10, 15
    let score = 5;
    if (i === 5) score = 8; // Significant change
    if (i === 10) score = 3; // Significant change
    if (i === 15) score = 9; // Significant change
    return { score };
  });
  
  const selected = selectRepresentativeScreenshots(screenshots, evaluations, {
    maxScreenshots: 10,
    strategy: 'keyframes'
  });
  
  assert.ok(selected.length <= 10, 'Should select at most maxScreenshots');
  assert.ok(selected[0] === screenshots[0], 'Should always include first');
  assert.ok(selected[selected.length - 1] === screenshots[screenshots.length - 1], 'Should always include last');
  
  // Should include keyframes with significant changes
  const selectedIndices = selected.map(s => screenshots.indexOf(s));
  assert.ok(selectedIndices.includes(5) || selectedIndices.includes(10) || selectedIndices.includes(15), 
    'Should include at least one keyframe with significant change');
});

test('selectRepresentativeScreenshots uniform strategy spaces evenly', () => {
  const screenshots = Array.from({ length: 100 }, (_, i) => ({
    path: `${i}.png`,
    timestamp: i * 1000
  }));
  
  const selected = selectRepresentativeScreenshots(screenshots, [], {
    maxScreenshots: 10,
    strategy: 'uniform'
  });
  
  assert.ok(selected.length <= 10, 'Should select at most maxScreenshots');
  assert.ok(selected[0] === screenshots[0], 'Should always include first');
  assert.ok(selected[selected.length - 1] === screenshots[screenshots.length - 1], 'Should always include last');
  
  // Check spacing (should be roughly even)
  const selectedIndices = selected.map(s => screenshots.indexOf(s));
  const intervals = [];
  for (let i = 1; i < selectedIndices.length; i++) {
    intervals.push(selectedIndices[i] - selectedIndices[i - 1]);
  }
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const expectedInterval = screenshots.length / selected.length;
  assert.ok(Math.abs(avgInterval - expectedInterval) < expectedInterval * 0.5, 
    'Should space screenshots roughly evenly');
});

test('selectRepresentativeScreenshots diversity strategy maximizes variance', () => {
  const screenshots = Array.from({ length: 20 }, (_, i) => ({
    path: `${i}.png`,
    timestamp: i * 1000
  }));
  
  // Create evaluations with high variance
  const evaluations = Array.from({ length: 20 }, (_, i) => ({
    score: i % 2 === 0 ? 9 : 1 // Alternating high/low for maximum diversity
  }));
  
  const selected = selectRepresentativeScreenshots(screenshots, evaluations, {
    maxScreenshots: 5,
    strategy: 'diversity'
  });
  
  assert.ok(selected.length <= 5, 'Should select at most maxScreenshots');
  assert.ok(selected[0] === screenshots[0], 'Should always include first');
  assert.ok(selected[selected.length - 1] === screenshots[screenshots.length - 1], 'Should always include last');
  
  // Check that selected screenshots have diverse scores
  const selectedScores = selected.map(s => {
    const index = screenshots.indexOf(s);
    return evaluations[index]?.score || 0;
  });
  const scoreVariance = calculateVariance(selectedScores);
  assert.ok(scoreVariance > 0, 'Should select screenshots with diverse scores');
});

test('selectRepresentativeScreenshots maps diversity evaluations to their original screenshots', () => {
  const screenshots = Array.from({ length: 6 }, (_, i) => ({
    path: `${i}.png`,
    timestamp: i * 1000
  }));
  const evaluations = [
    { score: 5 },
    { score: 10 },
    { score: 5 },
    { score: 0 },
    { score: 5 },
    { score: 5 }
  ];

  const selected = selectRepresentativeScreenshots(screenshots, evaluations, {
    maxScreenshots: 4,
    strategy: 'diversity'
  });

  assert.deepStrictEqual(
    selected.map(screenshot => screenshot.path),
    ['0.png', '1.png', '3.png', '5.png'],
    'interior evaluation indexes should select the screenshot at the same original index'
  );
  assert.strictEqual(new Set(selected).size, selected.length, 'selection should not duplicate screenshots');
});

test('selectRepresentativeScreenshots handles missing evaluations gracefully', () => {
  const screenshots = Array.from({ length: 20 }, (_, i) => ({
    path: `${i}.png`,
    timestamp: i * 1000
  }));
  
  // Missing evaluations - should fallback to uniform
  const selected = selectRepresentativeScreenshots(screenshots, [], {
    maxScreenshots: 5,
    strategy: 'diversity' // Will fallback to uniform
  });
  
  assert.ok(selected.length <= 5, 'Should select screenshots even without evaluations');
  assert.ok(selected[0] === screenshots[0], 'Should always include first');
  assert.ok(selected[selected.length - 1] === screenshots[screenshots.length - 1], 'Should always include last');
});

test('selectRepresentativeScreenshots handles partial evaluations', () => {
  const screenshots = Array.from({ length: 20 }, (_, i) => ({
    path: `${i}.png`,
    timestamp: i * 1000
  }));
  
  // Only first 10 have evaluations
  const evaluations = Array.from({ length: 10 }, (_, i) => ({
    score: 5 + i * 0.1
  }));
  
  const selected = selectRepresentativeScreenshots(screenshots, evaluations, {
    maxScreenshots: 5,
    strategy: 'diversity'
  });
  
  assert.ok(selected.length <= 5, 'Should handle partial evaluations');
});

test('selectRepresentativeScreenshots respects maxScreenshots limit strictly', () => {
  const screenshots = Array.from({ length: 100 }, (_, i) => ({
    path: `${i}.png`,
    timestamp: i * 1000
  }));
  
  const evaluations = Array.from({ length: 100 }, () => ({ score: 5 }));
  
  for (const max of [1, 5, 10, 20]) {
    const selected = selectRepresentativeScreenshots(screenshots, evaluations, {
      maxScreenshots: max,
      strategy: 'uniform'
    });
    assert.ok(selected.length <= max, `Should respect maxScreenshots=${max} limit`);
  }
});

test('selectRepresentativeScreenshots rejects invalid numeric inputs at the boundary', () => {
  const screenshots = Array.from({ length: 3 }, (_, i) => ({ path: `${i}.png`, timestamp: i }));

  for (const maxScreenshots of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => selectRepresentativeScreenshots(screenshots, [], { maxScreenshots }),
      RangeError,
      `maxScreenshots=${maxScreenshots} should be rejected`
    );
  }

  for (const score of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(
      () => selectRepresentativeScreenshots(screenshots, [{ score }, { score: 5 }, { score: 5 }]),
      RangeError,
      `score=${score} should be rejected`
    );
  }
});

function calculateVariance(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}
