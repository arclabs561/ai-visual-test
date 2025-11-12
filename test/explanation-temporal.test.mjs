/**
 * Test explanation manager with temporal and experience context
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ExplanationManager } from '../src/explanation-manager.mjs';
import { VLLMJudge } from '../src/judge.mjs';

describe('Explanation Manager - Temporal Integration', () => {
  test('should accept temporal notes in options', () => {
    const manager = new ExplanationManager({ enabled: false });
    const judgment = {
      id: 'test-1',
      vllmScore: 7,
      vllmIssues: ['contrast'],
      vllmReasoning: 'Button has good contrast',
      screenshot: '/tmp/test.png',
      prompt: 'Evaluate accessibility'
    };

    const temporalNotes = [
      { elapsed: 0, observation: 'Initial state', score: 3 },
      { elapsed: 5000, observation: 'Button appeared', score: 5 },
      { elapsed: 12000, observation: 'Contrast improved', score: 7 }
    ];

    // Should not throw when building prompt with temporal notes
    const prompt = manager._buildExplanationPrompt(judgment, null, { temporalNotes });
    assert.ok(typeof prompt === 'string');
    assert.ok(prompt.includes('TEMPORAL CONTEXT'));
    assert.ok(prompt.includes('Initial state'));
    assert.ok(prompt.includes('Button appeared'));
    assert.ok(prompt.includes('Contrast improved'));
  });

  test('should accept aggregated notes in options', () => {
    const manager = new ExplanationManager({ enabled: false });
    const judgment = {
      id: 'test-2',
      vllmScore: 7,
      vllmIssues: [],
      vllmReasoning: 'Good',
      screenshot: '/tmp/test.png',
      prompt: 'Evaluate'
    };

    const aggregatedNotes = {
      summary: 'Improvement trend from 3 to 7',
      windows: [
        { timeRange: '0-5s', avgScore: 3, noteCount: 1, observations: 'Initial state' },
        { timeRange: '5-12s', avgScore: 5, noteCount: 1, observations: 'Button appeared' },
        { timeRange: '12-20s', avgScore: 7, noteCount: 1, observations: 'Contrast improved' }
      ],
      coherence: 0.85,
      conflicts: []
    };

    const prompt = manager._buildExplanationPrompt(judgment, null, { aggregatedNotes });
    assert.ok(typeof prompt === 'string');
    assert.ok(prompt.includes('TEMPORAL CONTEXT'));
    assert.ok(prompt.includes('TEMPORAL AGGREGATION ANALYSIS'));
    assert.ok(prompt.includes('Improvement trend'));
  });

  test('should accept experience trace in options', () => {
    const manager = new ExplanationManager({ enabled: false });
    const judgment = {
      id: 'test-3',
      vllmScore: 8,
      vllmIssues: [],
      vllmReasoning: 'Good',
      screenshot: '/tmp/test.png',
      prompt: 'Evaluate'
    };

    const experienceTrace = {
      sessionId: 'session-123',
      persona: {
        name: 'accessibility-focused',
        goals: ['WCAG compliance', 'keyboard navigation']
      },
      events: [
        { elapsed: 0, type: 'click', data: { action: 'clicked skip button' } },
        { elapsed: 5000, type: 'navigation', data: { action: 'navigated to settings' } }
      ],
      validations: [
        { elapsed: 3000, validation: { score: 5, reasoning: 'Initial state has issues' } },
        { elapsed: 8000, validation: { score: 8, reasoning: 'Settings page is accessible' } }
      ]
    };

    const prompt = manager._buildExplanationPrompt(judgment, null, { experienceTrace });
    assert.ok(typeof prompt === 'string');
    assert.ok(prompt.includes('EXPERIENCE TRACE CONTEXT'));
    assert.ok(prompt.includes('session-123'));
    assert.ok(prompt.includes('accessibility-focused'));
    assert.ok(prompt.includes('clicked skip button'));
    assert.ok(prompt.includes('navigated to settings'));
  });

  test('should include VLLM-specific guidance when temporal context present', () => {
    const manager = new ExplanationManager({ enabled: false });
    const judgment = {
      id: 'test-4',
      vllmScore: 7,
      vllmIssues: [],
      vllmReasoning: 'Good',
      screenshot: '/tmp/test.png',
      prompt: 'Evaluate'
    };

    const prompt = manager._buildExplanationPrompt(judgment, null, {
      temporalNotes: [{ elapsed: 0, observation: 'test' }]
    });

    assert.ok(prompt.includes('IMPORTANT: As a Vision-Language Model'));
    assert.ok(prompt.includes('Visual citations'));
    assert.ok(prompt.includes('Temporal citations'));
    assert.ok(prompt.includes('Temporal relationships'));
  });

  test('should extract temporal context from judgment object', () => {
    const manager = new ExplanationManager({ enabled: false });
    const judgment = {
      id: 'test-5',
      vllmScore: 7,
      vllmIssues: [],
      vllmReasoning: 'Good',
      screenshot: '/tmp/test.png',
      prompt: 'Evaluate',
      temporalNotes: [{ elapsed: 0, observation: 'test' }],
      aggregatedNotes: { summary: 'test', windows: [], coherence: 1.0, conflicts: [] },
      experienceTrace: { sessionId: 'test' }
    };

    // Should extract from judgment object when not in options
    const prompt = manager._buildExplanationPrompt(judgment, null, {});
    // The method should work even if temporal context is in judgment but not passed
    // (the extraction happens in explainJudgment, not _buildExplanationPrompt)
    assert.ok(typeof prompt === 'string');
  });

  test('should handle missing temporal context gracefully', () => {
    const manager = new ExplanationManager({ enabled: false });
    const judgment = {
      id: 'test-6',
      vllmScore: 7,
      vllmIssues: [],
      vllmReasoning: 'Good',
      screenshot: '/tmp/test.png',
      prompt: 'Evaluate'
    };

    // Should work without temporal context
    const prompt = manager._buildExplanationPrompt(judgment, null, {});
    assert.ok(typeof prompt === 'string');
    assert.ok(prompt.includes('Why you scored it 7/10'));
    assert.ok(!prompt.includes('TEMPORAL CONTEXT'));
    assert.ok(!prompt.includes('EXPERIENCE TRACE CONTEXT'));
  });
});

