/**
 * @file Tests for prompt cache
 * Run with: node --test tests/prompt-cache.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getCachedPrompt } from '../js/ai/promptCache.js';
import { ScanService } from '../js/ai/ScanService.js';

const CATEGORIES = [{ id: 'ht', label: 'Món có HT' }];

function createTask() {
  let calls = 0;
  return {
    get callCount() { return calls; },
    buildPrompt: () => {
      calls++;
      return 'cached prompt';
    },
    parse: async () => ({ items: [], unmatched: [] }),
  };
}

const provider = { scan: async () => '{}' };

describe('getCachedPrompt', () => {
  test('buildPrompt chỉ chạy một lần cho cùng task/menu/categories', () => {
    const task = createTask();
    const menu = [{ id: 'a' }];

    const first = getCachedPrompt(task, menu, CATEGORIES);
    const second = getCachedPrompt(task, menu, CATEGORIES);

    assert.strictEqual(task.callCount, 1);
    assert.strictEqual(first, second);
  });

  test('task khác có cache riêng', () => {
    const taskA = createTask();
    const taskB = createTask();
    const menu = [{ id: 'a' }];

    assert.strictEqual(getCachedPrompt(taskA, menu, CATEGORIES), 'cached prompt');
    assert.strictEqual(getCachedPrompt(taskB, menu, CATEGORIES), 'cached prompt');
    assert.strictEqual(taskA.callCount, 1);
    assert.strictEqual(taskB.callCount, 1);
  });

  test('ScanService dùng lại cache khi tạo 100 instance', () => {
    const task = createTask();
    const menu = [{ id: 'a' }];
    const options = { provider, task, menu, categories: CATEGORIES, retryOptions: { maxRetry: 0, baseDelay: 1 } };

    for (let i = 0; i < 100; i++) {
      new ScanService(options);
    }

    assert.strictEqual(task.callCount, 1);
  });
});
