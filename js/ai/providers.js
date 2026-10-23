/**
 * @file Vision Provider classes
 * Base class + OpenAI-compatible + OpenRouter
 */

import { AI_CONFIG } from '../config.js';

/**
 * Base class cho vision provider
 * Subclass chỉ cần implement buildRequest() và parseResponse()
 */
export class VisionProvider {
  /**
   * @param {Object} config
   * @param {string} config.endpoint
   * @param {string} config.apiKey
   * @param {Object} [config.headers]
   * @param {number} [config.timeoutMs]
   */
  constructor(config) {
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.headers = config.headers || {};
    this.timeoutMs = config.timeoutMs ?? AI_CONFIG.timeoutMs;
  }

  /**
   * Gọi API vision
   * @param {Object} param0
   * @param {string} param0.base64 - base64 image (không có data: prefix)
   * @param {string} param0.mimeType - ví dụ 'image/jpeg'
   * @param {string} param0.prompt - system prompt
   * @param {AbortSignal} param0.signal
   * @returns {Promise<string>} text thô từ model
   */
  async scan({ base64, mimeType, prompt, signal }) {
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, this.timeoutMs);

    const onAbort = () => ctrl.abort();
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', onAbort, { once: true });

    try {
      const request = this.buildRequest({ base64, mimeType, prompt });
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          ...this.headers,
        },
        body: JSON.stringify(request),
        signal: ctrl.signal,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data?.error?.message || `Lỗi ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return this.parseResponse(data);
    } catch (err) {
      if (timedOut) {
        const e = new Error('timeout');
        e.isTimeout = true;
        throw e;
      }
      if (err instanceof TypeError) err.isNetwork = true;
      throw err;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    }
  }

  /**
   * Tạo request body - subclass override
   * @param {Object} param0
   * @param {string} param0.base64
   * @param {string} param0.mimeType
   * @param {string} param0.prompt
   * @returns {Object}
   */
  buildRequest({ base64, mimeType, prompt }) {
    throw new Error('buildRequest() must be implemented by subclass');
  }

  /**
   * Parse response thành text thô - subclass override
   * @param {Object} data
   * @returns {string}
   */
  parseResponse(data) {
    throw new Error('parseResponse() must be implemented by subclass');
  }
}

/**
 * Provider cho API tương thích OpenAI (OpenRouter, OpenAI, etc.)
 */
export class OpenAICompatibleProvider extends VisionProvider {
  /**
   * @param {Object} config
   * @param {string} config.endpoint
   * @param {string} config.apiKey
   * @param {string[]} config.models
   * @param {Object} [config.headers]
   * @param {number} [config.timeoutMs]
   */
  constructor(config) {
    super(config);
    this.models = config.models || AI_CONFIG.models;
  }

  buildRequest({ base64, mimeType, prompt }) {
    return {
      models: this.models,
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: AI_CONFIG.userText },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    };
  }

  parseResponse(data) {
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI không trả về kết quả. Hãy thử lại hoặc chụp rõ hơn.');
    return String(content);
  }
}

/**
 * OpenRouter provider - thêm header X-Title
 */
export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor(config) {
    super({
      ...config,
      endpoint: config.endpoint || AI_CONFIG.endpoint,
      headers: {
        'X-Title': 'Hoanh Thanh Counter',
        ...config.headers,
      },
    });
  }
}

/**
 * Registry factory functions
 * Thêm provider mới = thêm 1 dòng ở đây, không sửa ScanService
 */
export const REGISTRY = {
  openrouter: (cfg) => new OpenRouterProvider(cfg),
  // ví dụ thêm sau: openai: (cfg) => new OpenAICompatibleProvider(cfg),
};

/**
 * Tạo provider từ tên và config
 * @param {string} name
 * @param {Object} config
 * @returns {VisionProvider}
 */
export function createProvider(name, config) {
  const factory = REGISTRY[name];
  if (!factory) throw new Error(`Unknown provider: ${name}`);
  return factory(config);
}