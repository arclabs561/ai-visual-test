import { test } from 'node:test';
import assert from 'node:assert';
import { selectRepresentativeScreenshots } from '#temporal-prompt-formatting';

test('selectRepresentativeScreenshots returns all if under limit', () => {
  const screenshots = [
    { path: '1.png', timestamp: 1000 },
    { path: '2.png', timestamp: 2000 },
    { path: '3.png', timestamp: 3000 }
  ];

  const selected = selectRepresentativeScreenshots(screenshots, [], { maxScreenshots: 10 });
  assert.strictEqual(selected.length, 3, 'Should return all screenshots if under limit');
});

test('selectRepresentativeScreenshots selects keyframes', () => {
  const screenshots = [
    { path: '1.png', timestamp: 1000 },
    { path: '2.png', timestamp: 2000 },
    { path: '3.png', timestamp: 3000 },
    { path: '4.png', timestamp: 4000 },
    { path: '5.png', timestamp: 5000 },
    { path: '6.png', timestamp: 6000 },
    { path: '7.png', timestamp: 7000 },
    { path: '8.png', timestamp: 8000 },
    { path: '9.png', timestamp: 9000 },
    { path: '10.png', timestamp: 10000 },
    { path: '11.png', timestamp: 11000 },
    { path: '12.png', timestamp: 12000 }
  ];

  const evaluations = [
    { score: 5 },
    { score: 5 },
    { score: 8 }, // Significant change
    { score: 8 },
    { score: 8 },
    { score: 3 }, // Significant change
    { score: 3 },
    { score: 3 },
    { score: 9 }, // Significant change
    { score: 9 },
    { score: 9 },
    { score: 9 }
  ];

  const selected = selectRepresentativeScreenshots(screenshots, evaluations, {
    maxScreenshots: 5,
    strategy: 'keyframes'
  });

  assert.ok(selected.length <= 5, 'Should select at most maxScreenshots');
  assert.ok(selected[0] === screenshots[0], 'Should include first screenshot');
  assert.ok(selected[selected.length - 1] === screenshots[screenshots.length - 1], 'Should include last screenshot');
});

test('selectRepresentativeScreenshots selects uniformly', () => {
  const screenshots = Array.from({ length: 20 }, (_, i) => ({
    path: `${i}.png`,
    timestamp: i * 1000
  }));

  const selected = selectRepresentativeScreenshots(screenshots, [], {
    maxScreenshots: 5,
    strategy: 'uniform'
  });

  assert.ok(selected.length <= 5, 'Should select at most maxScreenshots');
  assert.ok(selected[0] === screenshots[0], 'Should include first screenshot');
  assert.ok(selected[selected.length - 1] === screenshots[screenshots.length - 1], 'Should include last screenshot');
});

test('selectRepresentativeScreenshots selects by diversity', () => {
  const screenshots = Array.from({ length: 20 }, (_, i) => ({
    path: `${i}.png`,
    timestamp: i * 1000
  }));

  const evaluations = Array.from({ length: 20 }, (_, i) => ({
    score: i % 2 === 0 ? 5 : 9 // Alternating scores for diversity
  }));

  const selected = selectRepresentativeScreenshots(screenshots, evaluations, {
    maxScreenshots: 5,
    strategy: 'diversity'
  });

  assert.ok(selected.length <= 5, 'Should select at most maxScreenshots');
  assert.ok(selected[0] === screenshots[0], 'Should include first screenshot');
  assert.ok(selected[selected.length - 1] === screenshots[screenshots.length - 1], 'Should include last screenshot');
});
