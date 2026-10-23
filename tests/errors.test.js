/**
 * @file Tests for AI error normalization
 * Run with: node --test tests/errors.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeError,
  AIError,
  AuthError,
  ProviderError,
  NetworkError,
  TimeoutError,
} from '../js/ai/errors.js';

describe('normalizeError', () => {
  test('giữ nguyên AIError', () => {
    const err = new NetworkError('x');
    assert.strictEqual(normalizeError(err), err);
  });

  test('timeout -> TimeoutError, không retry', () => {
    const err = new Error('timeout');
    err.isTimeout = true;
    const out = normalizeError(err);
    assert.ok(out instanceof TimeoutError);
    assert.strictEqual(out.retryable, false);
  });

  test('lỗi mạng -> NetworkError retryable', () => {
    const out = normalizeError(new TypeError('fetch failed'));
    assert.ok(out instanceof NetworkError);
    assert.strictEqual(out.retryable, true);
  });

  test('401/403 -> AuthError badKey, không retry', () => {
    for (const status of [401, 403]) {
      const err = new Error('auth');
      err.status = status;
      const out = normalizeError(err);
      assert.ok(out instanceof AuthError);
      assert.strictEqual(out.badKey, true);
      assert.strictEqual(out.retryable, false);
    }
  });

  test('400/402/404 -> ProviderError, không retry', () => {
    for (const status of [400, 402, 404]) {
      const err = new Error('provider');
      err.status = status;
      const out = normalizeError(err);
      assert.ok(out instanceof ProviderError, `status ${status}`);
      assert.strictEqual(out.retryable, false);
    }
  });

  test('408/429/5xx -> lỗi retryable', () => {
    for (const status of [408, 429, 500, 503]) {
      const err = new Error('server');
      err.status = status;
      const out = normalizeError(err);
      assert.ok(out instanceof AIError);
      assert.strictEqual(out.retryable, true, `status ${status}`);
    }
  });
});
