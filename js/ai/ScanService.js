/**
 * @file ScanService - orchestration: prepare (resize) -> scan (provider + retry + parse)
 */

import { resizeImage } from './image.js';
import { withRetry } from './retry.js';
import { normalizeError } from './errors.js';
import { getCachedPrompt } from './promptCache.js';

/**
 * @typedef {Object} PreparedImage
 * @property {string} dataUrl
 * @property {string} base64
 * @property {string} mimeType
 */

/**
 * @typedef {Object} ScanResult
 * @property {{id: string, servings: number}[]} items
 * @property {string[]} unmatched
 */

/**
 * @typedef {Object} ScanTask
 * @property {(menu: any[], categories: any[]) => string} buildPrompt
 * @property {(text: string, menu: any[]) => Promise<ScanResult>} parse
 */

export class ScanService {
  /**
   * @param {Object} deps
   * @param {import('./providers.js').VisionProvider} deps.provider
   * @param {ScanTask} deps.task
   * @param {import('../config.js').MenuItem[]} [deps.menu]
   * @param {import('../config.js').Category[]} [deps.categories]
   * @param {{ maxRetry?: number, baseDelay?: number }} [deps.retryOptions]
   */
  constructor({ provider, task, menu = [], categories = [], retryOptions = {} }) {
    this.provider = provider;
    this.task = task;
    this.menu = menu;
    this.categories = categories;
    this.retryOptions = {
      maxRetry: retryOptions.maxRetry ?? 2,
      baseDelay: retryOptions.baseDelay ?? 800,
    };
    this._prompt = getCachedPrompt(task, menu, categories);
  }

  /**
   * Resize ảnh một lần, trả preview + base64 cho scan.
   * @param {File} file
   * @returns {Promise<PreparedImage>}
   */
  async prepare(file) {
    return resizeImage(file);
  }

  /**
   * Quét ảnh đã resize.
   * @param {PreparedImage} prepared
   * @param {{ signal: AbortSignal }} opts
   * @returns {Promise<ScanResult>}
   */
  async scan(prepared, { signal }) {
    const rawText = await withRetry(async () => {
      try {
        return await this.provider.scan({
          base64: prepared.base64,
          mimeType: prepared.mimeType,
          prompt: this._prompt,
          signal,
        });
      } catch (err) {
        throw normalizeError(err);
      }
    }, { ...this.retryOptions, signal });

    return this.task.parse(rawText, this.menu);
  }
}