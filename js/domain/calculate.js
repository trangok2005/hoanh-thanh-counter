/**
 * @file Domain calculations: calculateOrder, calculateRevenue
 * Không import ai/ui/storage, không đụng DOM.
 */

import { sanitizeQuantity, sanitizeMoney } from './quantity.js';

/**
 * Tính metric cho một món
 * @param {number} servings
 * @param {Object.<string, number>} yields
 * @param {import('../config.js').Metric[]} metrics
 * @returns {Object.<string, number>}
 */
function calculateItemMetrics(servings, yields, metrics) {
  const result = {};
  for (const metric of metrics) {
    result[metric.id] = servings * (yields[metric.id] ?? 0);
  }
  return result;
}

/**
 * Tính tổng cho toàn bộ đơn hàng, generic theo METRICS
 * Chỉ tính các món thuộc nhóm có hasYields: true
 * @param {Object.<string, number>} servingsMap - id -> servings
 * @param {import('../config.js').MenuItem[]} menu
 * @param {import('../config.js').Category[]} categories
 * @param {import('../config.js').Metric[]} metrics
 * @returns {Object.<string, number> & { servings: number }}
 */
export function calculateOrder(servingsMap, menu, categories, metrics) {
  const totals = {};
  let totalServings = 0;

  for (const metric of metrics) totals[metric.id] = 0;

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  for (const item of menu) {
    const servings = sanitizeQuantity(servingsMap[item.id] ?? 0);
    if (servings <= 0) continue;

    const category = categoryMap.get(item.category);
    if (category?.hasYields) {
      totalServings += servings;
      const metrics_ = calculateItemMetrics(servings, item.yields, metrics);
      for (const metric of metrics) totals[metric.id] += metrics_[metric.id];
    }
  }

  return { ...totals, servings: totalServings };
}

/**
 * Tính doanh thu từ báo cáo
 * @param {Object} report - { payments, expenses, cancel }
 * @param {import('../config.js').PaymentChannel[]} channels
 * @returns {{ total: number, byChannel: Object.<string, number>, totalExpense: number }}
 */
export function calculateRevenue(report, channels) {
  const byChannel = {};
  let total = 0;
  for (const ch of channels) {
    const val = sanitizeMoney(report.payments?.[ch.id] ?? 0);
    byChannel[ch.id] = val;
    total += val;
  }
  const totalExpense = calculateTotalExpense(report);
  return { total, byChannel, totalExpense };
}

/**
 * Tính tổng chi
 * @param {Object} report
 * @returns {number}
 */
export function calculateTotalExpense(report) {
  return (report.expenses || []).reduce((sum, e) => sum + sanitizeMoney(e.amount ?? 0), 0);
}

/**
 * Gom số lượng theo reportGroup
 * @param {Object.<string, number>} servingsMap
 * @param {import('../config.js').MenuItem[]} menu
 * @param {import('../config.js').ReportGroup[]} reportGroups
 * @returns {Object.<string, number>} groupId -> total servings
 */
export function calculateByReportGroup(servingsMap, menu, reportGroups) {
  const result = {};
  for (const group of reportGroups) {
    result[group.id] = 0;
  }
  for (const item of menu) {
    const servings = sanitizeQuantity(servingsMap[item.id] ?? 0);
    if (servings > 0) {
      result[item.reportGroup] = (result[item.reportGroup] ?? 0) + servings;
    }
  }
  return result;
}