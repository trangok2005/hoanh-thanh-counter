/**
 * @file Tests for retry.js
 * Run with: node --test tests/retry.test.js
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../js/ai/retry.js';
import { AIError, NetworkError, AuthError, ProviderError, TimeoutError } from '../js/ai/errors.js';

describe('withRetry', () => {
  test('thành công lần đầu -> không retry', async () => {
    const fn = mock.fn(async () => 'ok');
    const signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => {} };
    const result = await withRetry(fn, { maxRetry: 2, baseDelay: 10, signal });
    assert.strictEqual(result, 'ok');
    assert.strictEqual(fn.mock.callCount(), 1);
  });

  test('retry khi NetworkError (retryable=true)', async () => {
    let attempts = 0;
    const fn = mock.fn(async () => {
      attempts++;
      if (attempts < 3) throw new NetworkError('network down');
      return 'ok';
    });
    const signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => {} };
    const result = await withRetry(fn, { maxRetry: 3, baseDelay: 5, signal });
    assert.strictEqual(result, 'ok');
    assert.strictEqual(fn.mock.callCount(), 3);
  });

  test('không retry AuthError (retryable=false)', async () => {
    const fn = mock.fn(async () => { throw new AuthError('bad key', 401); });
    const signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => {} };
    await assert.rejects(withRetry(fn, { maxRetry: 2, baseDelay: 5, signal }), /bad key/);
    assert.strictEqual(fn.mock.callCount(), 1);
  });

  test('không retry ProviderError 400/402/404', async () => {
    const fn = mock.fn(async () => { throw new ProviderError('credit hết', 402); });
    const signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => {} };
    await assert.rejects(withRetry(fn, { maxRetry: 2, baseDelay: 5, signal }), /credit/);
    assert.strictEqual(fn.mock.callCount(), 1);
  });

  test('không retry AbortError', async () => {
    const fn = mock.fn(async () => { throw new DOMException('Aborted', 'AbortError'); });
    const signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => {} };
    await assert.rejects(withRetry(fn, { maxRetry: 2, baseDelay: 5, signal }), /Aborted/);
    assert.strictEqual(fn.mock.callCount(), 1);
  });

  test('hủy khi signal.aborted = true giữa chừng', async () => {
    let resolveAbort;
    const abortPromise = new Promise((_, reject) => { resolveAbort = reject; });
    const fn = mock.fn(async () => {
      await abortPromise; // chờ abort
      return 'ok';
    });
    const signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => {} };
    const promise = withRetry(fn, { maxRetry: 5, baseDelay: 5, signal });
    // Giả lập abort sau 10ms
    setTimeout(() => { signal.aborted = true; resolveAbort(new DOMException('Aborted', 'AbortError')); }, 10);
    await assert.rejects(promise, /Aborted/);
  });

  test('TimeoutError không retry', async () => {
    const fn = mock.fn(async () => { throw new TimeoutError('timeout'); });
    const signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => {} };
    await assert.rejects(withRetry(fn, { maxRetry: 2, baseDelay: 5, signal }), /timeout/);
    assert.strictEqual(fn.mock.callCount(), 1);
  });

  test('retry đúng số lần maxRetry', async () => {
    const fn = mock.fn(async () => { throw new NetworkError('fail'); });
    const signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => {} };
    await assert.rejects(withRetry(fn, { maxRetry: 2, baseDelay: 5, signal }), /fail/);
    // maxRetry=2 => tổng 3 lần gọi (1 lần đầu + 2 lần retry)
    assert.strictEqual(fn.mock.callCount(), 3);
  });

  test('backoff exponential: delay tăng gấp đôi', async () => {
    const delays = [];
    let start = Date.now();
    const fn = mock.fn(async () => {
      delays.push(Date.now() - start);
      start = Date.now();
      throw new NetworkError('fail');
    });
    const signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => {} };
    await assert.rejects(withRetry(fn, { maxRetry: 2, baseDelay: 50, signal }), /fail/);
    // delay 1: ~50ms, delay 2: ~100ms (50 * 2^1)
    assert.ok(delays[1] >= 40 && delays[1] <= 80); // ~50ms
    assert.ok(delays[2] >= 90 && delays[2] <= 150); // ~100ms
  });
});