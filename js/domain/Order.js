/**
 * @file Order - state số phần món ăn
 * Không import ai/ui/storage, không đụng DOM.
 */

import { sanitizeQuantity } from './quantity.js';
import { MENU, CATEGORIES, METRICS, MAX_SERVINGS } from '../config.js';

/**
 * Tính metric cho một món
 * @param {number} servings
 * @param {Object.<string, number>} yields
 * @returns {Object.<string, number>}
 */
function calculateItemMetrics(servings, yields) {
  const result = {};
  for (const metric of METRICS) {
    result[metric.id] = servings * (yields[metric.id] ?? 0);
  }
  return result;
}

/**
 * State đơn hàng (observable nhẹ).
 * Listener nhận id vừa đổi, hoặc null khi đổi hàng loạt.
 */
export class Order {
  /**
   * @param {import('../config.js').MenuItem[]} menu
   * @param {Object.<string, number>} [initialServings]
   */
  constructor(menu, initialServings = {}) {
    this._menu = menu;
    this._itemMap = new Map(menu.map((item) => [item.id, item]));
    this._servings = new Map();
    this._listeners = new Set();

    for (const item of menu) {
      this._servings.set(item.id, sanitizeQuantity(initialServings[item.id] ?? 0));
    }
  }

  /** @returns {import('../config.js').MenuItem[]} */
  get menu() {
    return this._menu;
  }

  /** @returns {Map<string, number>} bản sao */
  get servings() {
    return new Map(this._servings);
  }

  /** @returns {Object.<string, number>} */
  toJSON() {
    const obj = {};
    for (const [id, v] of this._servings) obj[id] = v;
    return obj;
  }

  /** @param {string} id @returns {number} */
  getServings(id) {
    return this._servings.get(id) ?? 0;
  }

  /**
   * @param {string} id
   * @param {number} value
   * @param {boolean} [force=false]
   * @returns {boolean} true nếu giá trị thay đổi
   */
  setServings(id, value, force = false) {
    if (!this._itemMap.has(id)) return false;
    const next = sanitizeQuantity(value);
    const current = this._servings.get(id) ?? 0;
    if (!force && next === current) return false;
    this._servings.set(id, next);
    this._notify(id);
    return true;
  }

  /**
   * @param {string} id
   * @param {number} delta
   * @returns {number}
   */
  adjustServings(id, delta) {
    this.setServings(id, this.getServings(id) + delta);
    return this.getServings(id);
  }

  /**
   * Thay toàn bộ servings trong một lần, chỉ notify một lần.
   * Id không có trong map -> 0.
   * @param {Object.<string, number>} servingsMap
   */
  replaceAll(servingsMap) {
    for (const item of this._menu) {
      this._servings.set(item.id, sanitizeQuantity(servingsMap[item.id] ?? 0));
    }
    this._notify(null);
  }

  /**
   * Tính tổng cho toàn bộ đơn hàng.
   * Chỉ tính các món thuộc nhóm có hasYields: true (theo ý nghĩa cũ: "phần" chỉ tính cho món HT).
   * @returns {Object.<string, number> & { servings: number }}
   */
  getTotals() {
    const totals = {};
    let totalServings = 0;

    for (const metric of METRICS) totals[metric.id] = 0;

    for (const item of this._menu) {
      const servings = this._servings.get(item.id) ?? 0;
      if (servings <= 0) continue;

      const category = CATEGORIES.find((c) => c.id === item.category);
      if (category?.hasYields) {
        totalServings += servings;
        const metrics = calculateItemMetrics(servings, item.yields);
        for (const metric of METRICS) totals[metric.id] += metrics[metric.id];
      }
    }

    return { ...totals, servings: totalServings };
  }

  /** @returns {boolean} true nếu không có món nào > 0 ở bất kỳ nhóm nào */
  isEmpty() {
    for (const v of this._servings.values()) if (v > 0) return false;
    return true;
  }

  /** Reset toàn bộ về 0 */
  reset() {
    let changed = false;
    for (const item of this._menu) {
      if (this._servings.get(item.id) !== 0) {
        this._servings.set(item.id, 0);
        changed = true;
      }
    }
    if (changed) this._notify(null);
  }

  /**
   * @param {(changedId: string|null) => void} fn
   * @returns {() => void} unsubscribe
   */
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /** @param {string|null} changedId */
  _notify(changedId) {
    for (const fn of this._listeners) fn(changedId);
  }
}