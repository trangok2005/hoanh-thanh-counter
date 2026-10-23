/**
 * @file Retry utility với exponential backoff, abortable sleep
 * Chỉ retry khi err.retryable === true và signal chưa abort
 */

import { AIError } from './errors.js';

/**
 * Sleep có thể huỷ bằng AbortSignal
 * @param {number} ms
 * @param {AbortSignal} signal
 * @returns {Promise<void>}
 */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Thực hiện fn với retry
 * @template T
 * @param {() => Promise<T>} fn
 * @param {Object} opts
 * @param {number} opts.maxRetry - số lần thử LẠI (tổng lần gọi = maxRetry + 1)
 * @param {number} opts.baseDelay - delay cơ sở (ms)
 * @param {AbortSignal} opts.signal
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { maxRetry, baseDelay, signal }) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const retryable = err instanceof AIError && err.retryable === true;

      if (isAbort || !retryable || attempt >= maxRetry || signal.aborted) {
        throw err;
      }

      await sleep(baseDelay * 2 ** attempt, signal);
    }
  }
}