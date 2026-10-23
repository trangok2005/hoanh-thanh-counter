/**
 * @file Report - state báo cáo doanh thu
 * Không import ai/ui/storage, không đụng DOM.
 */

import { sanitizeMoney, sanitizeQuantity, generateExpenseId } from './quantity.js';
import { PAYMENT_CHANNELS, METRICS, REPORT_TITLES } from '../config.js';

export { calculateRevenue, calculateTotalExpense } from './calculate.js';

const DEFAULT_TITLE = 'full';
const VALID_TITLES = new Set(REPORT_TITLES.map((t) => t.value));

function sanitizeTitle(title) {
  return VALID_TITLES.has(title) ? title : DEFAULT_TITLE;
}

const DEFAULT_REPORT = {
  date: '',
  title: DEFAULT_TITLE,
  payments: {},
  expenses: [],
  cancel: {},
};

function todayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function createDefaultPayments() {
  const obj = {};
  for (const ch of PAYMENT_CHANNELS) obj[ch.id] = 0;
  return obj;
}

function createDefaultCancel() {
  const obj = {};
  for (const m of METRICS) obj[m.id] = 0;
  return obj;
}

/**
 * Store báo cáo (observable nhẹ).
 * Listener nhận snapshot mới khi có thay đổi.
 */
export class Report {
  constructor(initial = {}) {
    this._listeners = new Set();

    const date = initial.date || todayString();
    this._state = {
      date,
      title: sanitizeTitle(initial.title),
      payments: { ...createDefaultPayments(), ...(initial.payments || {}) },
      expenses: Array.isArray(initial.expenses) ? initial.expenses.map((e) => ({
        id: e.id || generateExpenseId(),
        amount: sanitizeMoney(e.amount),
        reason: String(e.reason || '').replace(/\n/g, ' ').slice(0, 100),
      })).filter((e) => e.amount > 0 || e.reason) : [],
      cancel: { ...createDefaultCancel(), ...(initial.cancel || {}) },
    };
  }

  /** @returns {Object} snapshot hiện tại */
  snapshot() {
    return {
      date: this._state.date,
      title: this._state.title,
      payments: { ...this._state.payments },
      expenses: this._state.expenses.map((e) => ({ ...e })),
      cancel: { ...this._state.cancel },
    };
  }

  /** @returns {Object} state nội bộ (read-only) */
  get state() {
    return this._state;
  }

  /** @param {string} date - YYYY-MM-DD */
  setDate(date) {
    this._state.date = date;
    this._notify();
  }

  /** @param {string} title */
  setTitle(title) {
    this._state.title = sanitizeTitle(title);
    this._notify();
  }

  /** @param {string} channelId @param {number} amount */
  setPayment(channelId, amount) {
    if (channelId in this._state.payments) {
      this._state.payments[channelId] = sanitizeMoney(amount);
      this._notify();
    }
  }

  /** @param {number} amount @param {string} reason @returns {string} expenseId */
  addExpense(amount, reason = '') {
    const expense = {
      id: generateExpenseId(),
      amount: sanitizeMoney(amount),
      reason: String(reason).replace(/\n/g, ' ').slice(0, 100),
    };
    this._state.expenses.push(expense);
    this._notify();
    return expense.id;
  }

  /** @param {string} expenseId */
  removeExpense(expenseId) {
    const idx = this._state.expenses.findIndex((e) => e.id === expenseId);
    if (idx >= 0) {
      this._state.expenses.splice(idx, 1);
      this._notify();
    }
  }

  /**
   * Cập nhật một phần phiếu chi (giữ nguyên id).
   * @param {string} expenseId
   * @param {{ amount?: number|string, reason?: string }} patch
   * @returns {boolean} true nếu tìm thấy phiếu chi
   */
  updateExpense(expenseId, patch = {}) {
    const expense = this._state.expenses.find((e) => e.id === expenseId);
    if (!expense) return false;
    if (patch.amount !== undefined) expense.amount = sanitizeMoney(patch.amount);
    if (patch.reason !== undefined) {
      expense.reason = String(patch.reason).replace(/\n/g, ' ').slice(0, 100);
    }
    this._notify();
    return true;
  }

  /** @param {string} metricId @param {number} qty */
  setCancel(metricId, qty) {
    if (metricId in this._state.cancel) {
      this._state.cancel[metricId] = sanitizeQuantity(qty);
      this._notify();
    }
  }

  /** Reset về mặc định */
  reset() {
    const date = this._state.date; // giữ ngày
    this._state = {
      date,
      title: DEFAULT_TITLE,
      payments: createDefaultPayments(),
      expenses: [],
      cancel: createDefaultCancel(),
    };
    this._notify();
  }

  /**
   * Khôi phục từ dữ liệu lưu (validate kiểu mọi trường)
   * @param {Object|null} data
   */
  restore(data) {
    if (!data || typeof data !== 'object') {
      this.reset();
      return;
    }
    this._state.date = typeof data.date === 'string' && data.date ? data.date : todayString();
    this._state.title = sanitizeTitle(data.title);

    const payments = createDefaultPayments();
    if (data.payments && typeof data.payments === 'object') {
      for (const ch of PAYMENT_CHANNELS) payments[ch.id] = sanitizeMoney(data.payments[ch.id]);
    }
    this._state.payments = payments;

    const cancel = createDefaultCancel();
    if (data.cancel && typeof data.cancel === 'object') {
      for (const m of METRICS) cancel[m.id] = sanitizeQuantity(data.cancel[m.id]);
    }
    this._state.cancel = cancel;

    this._state.expenses = [];
    if (Array.isArray(data.expenses)) {
      for (const e of data.expenses) {
        if (e && typeof e === 'object') {
          const amount = sanitizeMoney(e.amount);
          const reason = String(e.reason || '').replace(/\n/g, ' ').slice(0, 100);
          if (amount > 0 || reason) {
            this._state.expenses.push({
              id: typeof e.id === 'string' ? e.id : generateExpenseId(),
              amount,
              reason,
            });
          }
        }
      }
    }
    this._notify();
  }

  /**
   * @param {() => void} fn
   * @returns {() => void} unsubscribe
   */
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _notify() {
    for (const fn of this._listeners) fn(this.snapshot());
  }
}