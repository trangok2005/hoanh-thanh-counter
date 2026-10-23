/**
 * @file Parse AI response text thành structured data
 * Luôn validate: bóc code fence, parse JSON, lọc id hợp lệ, sanitize số, cộng dòng trùng
 */

import { sanitizeQuantity } from '../domain/quantity.js';
import { MAX_SERVINGS } from '../config.js';

/**
 * @typedef {Object} ParsedScanResult
 * @property {{id: string, servings: number}[]} items
 * @property {string[]} unmatched
 */

/**
 * Parse text trả về từ AI
 * @param {string} text - text thô từ model (có thể bọc trong ```json ... ```)
 * @param {import('../../config.js').MenuItem[]} menu
 * @returns {ParsedScanResult}
 */
export function parseScanResponse(text, menu) {
  const validIds = new Set(menu.map((m) => m.id));
  const itemsMap = new Map();
  let unmatched = [];

  // Bóc code fence ```json ... ```
  let cleaned = String(text).trim();
  cleaned = cleaned.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Kết quả trả về không đọc được. Hãy thử lại.');
  }

  // items
  if (Array.isArray(parsed.items)) {
    for (const item of parsed.items) {
      if (!item || typeof item.id !== 'string') continue;
      if (!validIds.has(item.id)) continue; // bỏ id không có trong menu
      const q = sanitizeQuantity(item.servings);
      if (q <= 0) continue;
      const existing = itemsMap.get(item.id) || 0;
      itemsMap.set(item.id, Math.min(existing + q, MAX_SERVINGS));
    }
  }

  // unmatched
  if (Array.isArray(parsed.unmatched)) {
    unmatched = parsed.unmatched
      .filter((t) => typeof t === 'string' && t.trim())
      .map((t) => t.trim());
  }

  const items = Array.from(itemsMap.entries()).map(([id, servings]) => ({ id, servings }));

  return { items, unmatched };
}