/**
 * @file Validate config at startup
 * Gọi 1 lần trong main.js để bắt lỗi cấu hình sớm.
 */

import { CATEGORIES, METRICS, MENU, REPORT_GROUPS, PAYMENT_CHANNELS, REPORT_FORMAT } from '../config.js';

/**
 * @typedef {Object} ValidateResult
 * @property {boolean} ok
 * @property {string[]} errors
 */

/**
 * Validate toàn bộ config
 * @returns {ValidateResult}
 */
export function validateConfig() {
  const errors = [];

  // 1. MENU: id duy nhất
  const menuIds = new Set();
  for (const item of MENU) {
    if (menuIds.has(item.id)) {
      errors.push(`MENU: id trùng lặp "${item.id}"`);
    }
    menuIds.add(item.id);
  }

  // 2. MENU: category tồn tại
  const categoryIds = new Set(CATEGORIES.map((c) => c.id));
  for (const item of MENU) {
    if (!categoryIds.has(item.category)) {
      errors.push(`MENU[${item.id}]: category "${item.category}" không tồn tại trong CATEGORIES`);
    }
  }

  // 3. MENU: reportGroup tồn tại
  const reportGroupIds = new Set(REPORT_GROUPS.map((g) => g.id));
  for (const item of MENU) {
    if (!reportGroupIds.has(item.reportGroup)) {
      errors.push(`MENU[${item.id}]: reportGroup "${item.reportGroup}" không tồn tại trong REPORT_GROUPS`);
    }
  }

  // 4. MENU: alias duy nhất (không phân biệt hoa/thường) giữa các món
  const aliasMap = new Map();
  for (const item of MENU) {
    for (const alias of item.aliases) {
      const lower = alias.toLowerCase();
      if (aliasMap.has(lower)) {
        errors.push(`MENU: alias "${alias}" (lowercase: "${lower}") trùng giữa "${aliasMap.get(lower)}" và "${item.id}"`);
      }
      aliasMap.set(lower, item.id);
    }
  }

  // 5. MENU: nhóm hasYields => mọi món trong nhóm phải có yields đủ METRICS
  for (const cat of CATEGORIES) {
    if (cat.hasYields) {
      for (const item of MENU) {
        if (item.category === cat.id) {
          for (const metric of METRICS) {
            if (!(metric.id in item.yields)) {
              errors.push(`MENU[${item.id}]: thiếu metric "${metric.id}" trong yields (category ${cat.id} có hasYields=true)`);
            }
          }
        }
      }
    }
  }

  // 6. REPORT_GROUPS: không có nhóm rỗng (không món nào)
  for (const group of REPORT_GROUPS) {
    const hasItems = MENU.some((item) => item.reportGroup === group.id);
    if (!hasItems) {
      errors.push(`REPORT_GROUPS: nhóm "${group.id}" không có món nào`);
    }
  }

  // 7. Không món nào có trường price
  for (const item of MENU) {
    if ('price' in item) {
      errors.push(`MENU[${item.id}]: không được có trường price`);
    }
  }

  // 8. PAYMENT_CHANNELS: id duy nhất
  const channelIds = new Set();
  for (const ch of PAYMENT_CHANNELS) {
    if (channelIds.has(ch.id)) {
      errors.push(`PAYMENT_CHANNELS: id trùng lặp "${ch.id}"`);
    }
    channelIds.add(ch.id);
  }

  // 9. METRICS: id duy nhất, cancelLabel có mặt
  const metricIds = new Set();
  for (const m of METRICS) {
    if (metricIds.has(m.id)) {
      errors.push(`METRICS: id trùng lặp "${m.id}"`);
    }
    metricIds.add(m.id);
    if (!m.cancelLabel) {
      errors.push(`METRICS[${m.id}]: thiếu cancelLabel`);
    }
  }

  // 10. REPORT_FORMAT: hideZeroItems là boolean
  if (typeof REPORT_FORMAT.hideZeroItems !== 'boolean') {
    errors.push('REPORT_FORMAT.hideZeroItems phải là boolean');
  }

  return { ok: errors.length === 0, errors };
}