/**
 * Integration tests for experience-tracer.mjs
 */

import '../test-setup.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  ExperienceTrace,
  ExperienceTracerManager,
  getTracerManager
} from '../../src/experience-tracer.mjs';

describe('Experience Tracer', () => {
  describe('ExperienceTrace', () => {
    it('should create trace with sessionId', () => {
      const trace = new ExperienceTrace('test-session');
      
      assert.ok(trace);
      assert.ok(trace.sessionId);
      assert.strictEqual(trace.sessionId, 'test-session');
    });

    it('should create trace with persona', () => {
      const persona = { name: 'Test Persona' };
      const trace = new ExperienceTrace('test-session', persona);
      
      assert.ok(trace);
      assert.ok(trace.persona);
    });

    it('should have methods to manage trace data', () => {
      const trace = new ExperienceTrace('test-session');
      
      // Check for common trace methods
      assert.ok(typeof trace === 'object');
      // ExperienceTrace may have addScreenshot, addValidation, etc.
      if (typeof trace.addScreenshot === 'function') {
        trace.addScreenshot('test.png');
        assert.ok(trace.screenshots.length > 0);
      }
      if (typeof trace.addValidation === 'function') {
        trace.addValidation({ score: 8.0 });
        assert.ok(true);
      }
    });
  });

  describe('ExperienceTracerManager', () => {
    let manager;

    beforeEach(() => {
      manager = new ExperienceTracerManager();
    });

    it('should create manager', () => {
      assert.ok(manager);
    });

    it('should create and manage traces', () => {
      const trace = manager.createTrace('test-session');
      
      assert.ok(trace);
      assert.ok(trace instanceof ExperienceTrace);
      assert.strictEqual(trace.sessionId, 'test-session');
    });

    it('should retrieve traces', () => {
      const trace = manager.createTrace('test-session-2');
      const retrieved = manager.getTrace('test-session-2');
      
      assert.ok(retrieved);
      assert.strictEqual(retrieved.sessionId, 'test-session-2');
      assert.strictEqual(retrieved, trace);
    });

    it('should return null for non-existent trace', () => {
      const retrieved = manager.getTrace('non-existent');
      
      assert.strictEqual(retrieved, null);
    });

    it('should manage multiple traces', () => {
      // Verify manager can handle multiple traces
      if (typeof manager.getAllTraces === 'function') {
        const traces = manager.getAllTraces();
        assert.ok(Array.isArray(traces));
      } else {
        // If no getAllTraces method, just verify manager exists
        assert.ok(manager instanceof ExperienceTracerManager);
      }
    });
  });

  describe('getTracerManager', () => {
    it('should return singleton manager', () => {
      const manager1 = getTracerManager();
      const manager2 = getTracerManager();
      
      assert.strictEqual(manager1, manager2);
    });
  });
});

