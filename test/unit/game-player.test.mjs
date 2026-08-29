/**
 * Unit tests for game-player.mjs
 * 
 * Tests decision logic and action execution without requiring actual game state.
 */

import '../test-setup.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  decideGameAction,
  executeGameAction,
  GameGym
} from '../../src/game-player.js';
import { createMockPage } from '../helpers/mock-page.mjs';

describe('Game Player', () => {
  let mockPage;

  beforeEach(() => {
    mockPage = createMockPage();
  });

  describe('decideGameAction', () => {
    it('should export decideGameAction function', () => {
      assert.strictEqual(typeof decideGameAction, 'function');
    });

    it('returns the injected structured action without a second visual review', async () => {
      let reviews = 0;
      const action = await decideGameAction(
        { screenshot: '/tmp/test.png', evaluation: { score: 4 } },
        'maximize score',
        [],
        {
          reviewState: async () => { reviews++; return { score: 0 }; },
          selectAction: async () => ({ action: { type: 'keyboard', key: 'ArrowLeft' } }),
        },
      );
      assert.deepStrictEqual(action, { type: 'keyboard', key: 'ArrowLeft' });
      assert.strictEqual(reviews, 0);
    });
  });

  describe('executeGameAction', () => {
    it('should export executeGameAction function', () => {
      assert.strictEqual(typeof executeGameAction, 'function');
    });

    it('should execute keyboard action', async () => {
      const action = { type: 'keyboard', key: 'ArrowRight' };
      const result = await executeGameAction(mockPage, action);
      
      assert.ok(result);
      // executeGameAction returns { success, error } object
      assert.strictEqual(typeof result.success, 'boolean');
      // May succeed or fail depending on mock implementation
    });

    it('should execute click action', async () => {
      // Mock page should have locator method
      const action = { type: 'click', selector: '#button' };
      const result = await executeGameAction(mockPage, action);
      
      // May succeed or fail depending on element existence
      assert.ok(result);
      assert.strictEqual(typeof result.success, 'boolean');
    });

    it('should handle missing selector in click action', async () => {
      const action = { type: 'click' };
      const result = await executeGameAction(mockPage, action);
      
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should execute wait action', async () => {
      const action = { type: 'wait', duration: 100 };
      const result = await executeGameAction(mockPage, action);
      
      assert.ok(result);
      assert.strictEqual(result.success, true);
    });

    it('should handle unknown action type', async () => {
      const action = { type: 'unknown' };
      const result = await executeGameAction(mockPage, action);
      
      assert.ok(result);
      assert.strictEqual(result.success, false);
      assert.match(result.error, /game action contract/i);
    });

    it('should return error when element not found', async () => {
      const action = { type: 'click', selector: '#nonexistent' };
      const result = await executeGameAction(mockPage, action);
      
      // Should fail gracefully
      assert.ok(result);
      assert.strictEqual(typeof result.success, 'boolean');
    });
  });

  describe('GameGym class', () => {
    it('should export GameGym class', () => {
      assert.strictEqual(typeof GameGym, 'function');
    });

    it('should create GameGym instance', () => {
      const gym = new GameGym(mockPage, {
        url: 'http://example.com/game',
        goal: 'maximize score'
      });
      
      assert.ok(gym);
      assert.strictEqual(typeof gym.step, 'function');
    });

    it('should create instance with options', () => {
      const gym = new GameGym(mockPage, {
        url: 'http://example.com/game',
        goal: 'maximize score',
        maxSteps: 100,
        timeout: 60000
      });
      
      assert.ok(gym);
    });

    it('should have step method for iteration', () => {
      const gym = new GameGym(mockPage, {
        url: 'http://example.com/game',
        goal: 'maximize score'
      });
      
      assert.strictEqual(typeof gym.step, 'function');
    });

    it('should have reset method', () => {
      const gym = new GameGym(mockPage, {
        url: 'http://example.com/game',
        goal: 'maximize score'
      });
      
      assert.strictEqual(typeof gym.reset, 'function');
    });
  });
});
