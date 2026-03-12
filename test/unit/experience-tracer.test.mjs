/**
 * Tests for experience-tracer.mjs (pure logic only)
 */

import '../test-setup.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  ExperienceTrace,
  ExperienceTracerManager,
  getTracerManager
} from '../../src/experience-tracer.mjs';

describe('ExperienceTrace', () => {
  let trace;

  beforeEach(() => {
    trace = new ExperienceTrace('session-1');
  });

  it('constructor sets sessionId and defaults', () => {
    assert.strictEqual(trace.sessionId, 'session-1');
    assert.strictEqual(trace.persona, null);
    assert.ok(typeof trace.startTime === 'number');
    assert.deepStrictEqual(trace.events, []);
    assert.deepStrictEqual(trace.validations, []);
    assert.deepStrictEqual(trace.screenshots, []);
    assert.deepStrictEqual(trace.stateHistory, []);
  });

  it('constructor accepts persona', () => {
    const persona = { name: 'tester', role: 'qa' };
    const t = new ExperienceTrace('session-2', persona);
    assert.deepStrictEqual(t.persona, persona);
  });

  it('addEvent stores event and returns entry with expected fields', () => {
    const data = { action: 'click', target: 'button' };
    const entry = trace.addEvent('interaction', data);

    assert.strictEqual(entry.id, 'session-1-0');
    assert.strictEqual(entry.type, 'interaction');
    assert.ok(typeof entry.timestamp === 'number');
    assert.ok(typeof entry.elapsed === 'number');
    assert.deepStrictEqual(entry.data, data);
    assert.strictEqual(trace.events.length, 1);
    assert.strictEqual(trace.events[0], entry);
  });

  it('addEvent uses provided timestamp', () => {
    const ts = 1700000000000;
    const entry = trace.addEvent('interaction', {}, ts);
    assert.strictEqual(entry.timestamp, ts);
  });

  it('addEvent increments ids sequentially', () => {
    trace.addEvent('a', {});
    trace.addEvent('b', {});
    const third = trace.addEvent('c', {});
    assert.strictEqual(third.id, 'session-1-2');
    assert.strictEqual(trace.events.length, 3);
  });

  it('addValidation stores validation entry and creates event', () => {
    const validation = { score: 8, reasoning: 'looks good', screenshotPath: '/tmp/s.png' };
    const ctx = { stage: 'initial' };
    const entry = trace.addValidation(validation, ctx);

    assert.strictEqual(entry.id, 'session-1-validation-0');
    assert.strictEqual(entry.validation, validation);
    assert.deepStrictEqual(entry.context, ctx);
    assert.strictEqual(entry.screenshot, '/tmp/s.png');
    assert.strictEqual(trace.validations.length, 1);
    // addValidation also creates an event
    assert.strictEqual(trace.events.length, 1);
    assert.strictEqual(trace.events[0].type, 'validation');
  });

  it('addScreenshot stores screenshot entry and creates event', () => {
    const entry = trace.addScreenshot('/tmp/shot.png', 'login', { resolution: '1920x1080' });

    assert.strictEqual(entry.id, 'session-1-screenshot-0');
    assert.strictEqual(entry.path, '/tmp/shot.png');
    assert.strictEqual(entry.step, 'login');
    assert.strictEqual(entry.resolution, '1920x1080');
    assert.strictEqual(trace.screenshots.length, 1);
    assert.strictEqual(trace.events.length, 1);
    assert.strictEqual(trace.events[0].type, 'screenshot');
  });

  it('addStateSnapshot stores state entry and creates event', () => {
    const state = { page: 'home', loaded: true };
    const entry = trace.addStateSnapshot(state, 'after-login');

    assert.strictEqual(entry.id, 'session-1-state-0');
    assert.deepStrictEqual(entry.state, state);
    assert.strictEqual(entry.label, 'after-login');
    assert.strictEqual(trace.stateHistory.length, 1);
    assert.strictEqual(trace.events.length, 1);
    assert.strictEqual(trace.events[0].type, 'state-change');
  });

  it('getSummary returns correct counts', () => {
    trace.addEvent('interaction', {});
    trace.addValidation({ score: 7 });
    trace.addScreenshot('/tmp/a.png', 'step-1');
    trace.addStateSnapshot({ page: 'x' }, 'label');

    const summary = trace.getSummary();
    assert.strictEqual(summary.sessionId, 'session-1');
    assert.strictEqual(summary.persona, null);
    assert.ok(summary.duration >= 0);
    // 1 manual + 1 from addValidation + 1 from addScreenshot + 1 from addStateSnapshot = 4
    assert.strictEqual(summary.eventCount, 4);
    assert.strictEqual(summary.validationCount, 1);
    assert.strictEqual(summary.screenshotCount, 1);
    assert.strictEqual(summary.stateSnapshotCount, 1);
    assert.strictEqual(summary.hasAggregatedNotes, false);
    assert.strictEqual(summary.hasMetaEvaluation, false);
  });

  it('getFullTrace returns all recorded data', () => {
    trace.addEvent('interaction', { action: 'tap' });
    trace.addValidation({ score: 9 });

    const full = trace.getFullTrace();
    assert.strictEqual(full.sessionId, 'session-1');
    assert.strictEqual(full.startTime, trace.startTime);
    assert.ok(full.duration >= 0);
    assert.strictEqual(full.events.length, 2); // manual + validation
    assert.strictEqual(full.validations.length, 1);
    assert.strictEqual(full.aggregatedNotes, null);
    assert.strictEqual(full.metaEvaluation, null);
    assert.ok(full.summary);
    assert.strictEqual(full.summary.eventCount, 2);
  });
});

describe('ExperienceTracerManager', () => {
  let manager;

  beforeEach(() => {
    manager = new ExperienceTracerManager();
  });

  it('createTrace creates and stores a trace', () => {
    const trace = manager.createTrace('s1', { name: 'bot' });
    assert.ok(trace instanceof ExperienceTrace);
    assert.strictEqual(trace.sessionId, 's1');
    assert.deepStrictEqual(trace.persona, { name: 'bot' });
    assert.strictEqual(manager.getTrace('s1'), trace);
  });

  it('getTrace returns null for unknown session', () => {
    assert.strictEqual(manager.getTrace('nonexistent'), null);
  });

  it('getAllTraces returns all stored traces', () => {
    manager.createTrace('a');
    manager.createTrace('b');
    const all = manager.getAllTraces();
    assert.strictEqual(all.length, 2);
  });

  it('evaluateCompleteness scores based on event type variety', () => {
    const trace = manager.createTrace('c1');
    // No events -> all 3 required types missing -> score 0
    const empty = manager.evaluateCompleteness(trace);
    assert.strictEqual(empty.score, 0);
    assert.deepStrictEqual(empty.missing, ['screenshot', 'validation', 'state-change']);
    assert.strictEqual(empty.totalEvents, 0);

    // Add all three required types via helper methods
    trace.addScreenshot('/tmp/x.png', 'step');
    trace.addValidation({ score: 5 });
    trace.addStateSnapshot({ p: 1 }, 'init');

    const full = manager.evaluateCompleteness(trace);
    assert.strictEqual(full.score, 10);
    assert.deepStrictEqual(full.missing, []);
    assert.ok(full.eventTypes.includes('screenshot'));
    assert.ok(full.eventTypes.includes('validation'));
    assert.ok(full.eventTypes.includes('state-change'));
  });

  it('evaluateConsistency returns alignment and state consistency', () => {
    const trace = manager.createTrace('c2');
    // Empty trace -> 0
    const empty = manager.evaluateConsistency(trace);
    assert.strictEqual(empty.score, 0);

    // Add validation (creates matching validation event)
    trace.addValidation({ score: 8 });
    // Add state snapshot (creates matching state-change event)
    trace.addStateSnapshot({ x: 1 }, 'l');

    const result = manager.evaluateConsistency(trace);
    // Both alignment and stateConsistency should be 1 -> score = 10
    assert.strictEqual(result.validationAlignment, 1);
    assert.strictEqual(result.stateConsistency, 1);
    assert.strictEqual(result.score, 10);
  });

  it('evaluateCoverage returns coverage metrics', () => {
    const trace = manager.createTrace('c3');
    // No matching stage labels -> 0 coverage
    const empty = manager.evaluateCoverage(trace);
    assert.strictEqual(empty.score, 0);
    assert.deepStrictEqual(empty.expectedStages, ['initial', 'form', 'payment', 'gameplay']);
    assert.deepStrictEqual(empty.coveredStages, []);

    // Add events with stage/step data matching expected stages
    trace.addEvent('interaction', { stage: 'initial' });
    trace.addEvent('interaction', { step: 'form-fill' });
    trace.addEvent('interaction', { stage: 'payment' });
    trace.addEvent('interaction', { step: 'gameplay-start' });

    const result = manager.evaluateCoverage(trace);
    assert.strictEqual(result.coveredStages.length, 4);
    assert.strictEqual(result.score, 10);
    assert.strictEqual(result.coverage, 1);
  });

  it('evaluateTemporalCoherence returns score 0 when no aggregated notes', () => {
    const trace = manager.createTrace('c4');
    const result = manager.evaluateTemporalCoherence(trace);
    assert.strictEqual(result.score, 0);
    assert.ok(result.reason);
  });

  it('evaluateTemporalCoherence uses aggregatedNotes when present', () => {
    const trace = manager.createTrace('c5');
    trace.aggregatedNotes = {
      coherence: 0.8,
      conflicts: ['minor conflict'],
      windows: [{ start: 0, end: 100 }]
    };

    const result = manager.evaluateTemporalCoherence(trace);
    assert.strictEqual(result.score, 8);
    assert.strictEqual(result.coherence, 0.8);
    assert.strictEqual(result.conflicts, 1);
    assert.strictEqual(result.windows, 1);
  });
});

describe('getTracerManager', () => {
  it('returns singleton instance', () => {
    const a = getTracerManager();
    const b = getTracerManager();
    assert.strictEqual(a, b);
    assert.ok(a instanceof ExperienceTracerManager);
  });
});
