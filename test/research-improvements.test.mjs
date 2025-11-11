/**
 * Tests for Research-Backed Improvements
 * 
 * Tests adaptive window sizing, enhanced personas, and structured fusion
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  aggregateTemporalNotesAdaptive,
  calculateOptimalWindowSize,
  detectActivityPattern,
  createEnhancedPersona,
  experiencePageWithEnhancedPersona,
  calculatePersonaConsistency,
  calculatePersonaDiversity,
  buildStructuredFusionPrompt,
  calculateModalityWeights,
  compareFusionStrategies
} from '../src/index.mjs';
import { createMockPage } from './helpers/mock-page.mjs';

test('Adaptive Window Sizing - calculates optimal window based on frequency', () => {
  // High frequency notes
  const highFreqNotes = Array.from({ length: 20 }, (_, i) => ({
    timestamp: i * 500, // 0.5s apart
    gameState: { score: i * 5 }
  }));
  
  const highFreqWindow = calculateOptimalWindowSize(highFreqNotes);
  assert.ok(highFreqWindow <= 10000, 'High frequency should use smaller window');
  
  // Low frequency notes
  const lowFreqNotes = Array.from({ length: 10 }, (_, i) => ({
    timestamp: i * 3000, // 3s apart
    gameState: { score: i * 10 }
  }));
  
  const lowFreqWindow = calculateOptimalWindowSize(lowFreqNotes);
  assert.ok(lowFreqWindow >= 10000, 'Low frequency should use larger window');
});

test('Activity Pattern Detection - identifies different patterns', () => {
  // Fast change pattern
  const fastChange = Array.from({ length: 10 }, (_, i) => ({
    timestamp: i * 500,
    gameState: { score: i * 10 }
  }));
  
  const fastPattern = detectActivityPattern(fastChange);
  assert.ok(['fastChange', 'consistent'].includes(fastPattern));
  
  // Erratic pattern
  const erratic = Array.from({ length: 10 }, (_, i) => ({
    timestamp: i * 1000,
    gameState: { score: i % 2 === 0 ? i * 10 : (i - 1) * 5 }
  }));
  
  const erraticPattern = detectActivityPattern(erratic);
  assert.ok(['erratic', 'fastChange'].includes(erraticPattern));
});

test('Adaptive Aggregation - uses optimal window size', () => {
  const notes = Array.from({ length: 20 }, (_, i) => ({
    timestamp: i * 500, // High frequency
    gameState: { score: i * 5 },
    observation: `Frame ${i}`
  }));
  
  const aggregated = aggregateTemporalNotesAdaptive(notes, { adaptive: true });
  assert.ok(aggregated);
  assert.ok(typeof aggregated.coherence === 'number');
  assert.ok(Array.isArray(aggregated.windows));
});

test('Enhanced Persona - creates persona with rich context', () => {
  const persona = createEnhancedPersona(
    {
      name: 'Test User',
      device: 'desktop',
      goals: ['efficiency'],
      concerns: ['complexity']
    },
    {
      workflows: {
        primary: ['login', 'browse'],
        secondary: ['search'],
        edgeCases: ['error recovery']
      },
      frustrations: ['slow loading', 'confusing navigation'],
      usagePatterns: {
        frequency: 'daily',
        duration: '30 minutes',
        peakTimes: ['morning', 'evening']
      }
    }
  );
  
  assert.ok(persona.workflows);
  assert.ok(persona.frustrations);
  assert.ok(persona.usagePatterns);
  assert.strictEqual(persona.workflows.primary.length, 2);
  assert.strictEqual(persona.frustrations.length, 2);
});

test('Persona Consistency - calculates consistency metrics', () => {
  const observations = [
    'Page loaded successfully',
    'Page loaded and ready',
    'Page is now loaded',
    'Page loaded with content'
  ];
  
  const consistency = calculatePersonaConsistency(observations);
  
  assert.ok(typeof consistency.promptToLine === 'number');
  assert.ok(typeof consistency.lineToLine === 'number');
  assert.ok(typeof consistency.overall === 'number');
  assert.ok(consistency.overall >= 0 && consistency.overall <= 1);
  assert.strictEqual(consistency.observationCount, 4);
});

test('Persona Diversity - calculates diversity between personas', () => {
  const persona1 = {
    observations: ['fast', 'responsive', 'quick'],
    notes: []
  };
  
  const persona2 = {
    observations: ['accessible', 'keyboard', 'navigation'],
    notes: []
  };
  
  const diversity = calculatePersonaDiversity([persona1, persona2]);
  
  assert.ok(typeof diversity.diversityRatio === 'number');
  assert.ok(diversity.diversityRatio >= 0 && diversity.diversityRatio <= 1);
  assert.ok(diversity.uniqueKeywords > 0);
  assert.strictEqual(diversity.personaCount, 2);
});

test('Modality Weights - calculates attention weights', () => {
  const modalities = {
    screenshot: 'test.png',
    renderedCode: { html: '<div>test</div>', criticalCSS: 'body { color: red; }' },
    gameState: { score: 10 }
  };
  
  const weights = calculateModalityWeights(modalities, 'Evaluate visual design and appearance');
  
  assert.ok(weights.screenshot > 0);
  assert.ok(weights.html > 0);
  assert.ok(weights.css > 0);
  
  // Weights should sum to ~1.0
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1.0) < 0.01, `Weights should sum to 1.0, got ${total}`);
  
  // Visual prompt should give higher weight to screenshot
  assert.ok(weights.screenshot >= 0.4, 'Visual prompt should prioritize screenshot');
});

test('Structured Fusion - builds weighted fusion prompt', () => {
  const modalities = {
    screenshot: 'test.png',
    renderedCode: {
      html: '<div>test</div>',
      criticalCSS: 'body { color: red; }',
      domStructure: { test: 'structure' }
    },
    gameState: { score: 10 }
  };
  
  const prompt = buildStructuredFusionPrompt('Evaluate this UI', modalities);
  
  assert.ok(typeof prompt === 'string');
  assert.ok(prompt.includes('MULTI-MODAL CONTEXT'));
  assert.ok(prompt.includes('Weight:'));
  assert.ok(prompt.includes('VISUAL'));
  assert.ok(prompt.includes('STRUCTURE'));
  assert.ok(prompt.includes('STYLING'));
});

test('Fusion Comparison - compares strategies', () => {
  const modalities = {
    screenshot: 'test.png',
    renderedCode: { html: '<div>test</div>' },
    gameState: { score: 10 }
  };
  
  const comparison = compareFusionStrategies('Evaluate UI', modalities);
  
  assert.ok(comparison.simple);
  assert.ok(comparison.structured);
  assert.ok(comparison.structured.hasWeights);
  assert.ok(!comparison.simple.hasWeights);
  assert.ok(comparison.structured.weights);
});

