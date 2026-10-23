/**
 * @file Domain utilities: sanitizeQuantity, sanitizeMoney
 * Không import ai/ui/storage, không đụng DOM.
 */

import { MAX_SERVINGS, MAX_MONEY } from '../config.js';

/**
 * Làm sạch số lượng đầu vào: chỉ nhận số nguyên >= 0, clamp max
 * @param {number|string|null|undefined} value
 * @returns {number}
 */
export function sanitizeQuantity(value) {
  let n;
  if (typeof value === 'number') {
    n = Math.floor(value);
  } else {
    const digits = String(value == null ? '' : value).replace(/\D/g, '');
    n = digits === '' ? 0 : parseInt(digits, 10);
  }
  if (!isFinite(n) || n < 0) return 0;
  return n > MAX_SERVINGS ? MAX_SERVINGS : n;
}

/**
 * Làm sạch số tiền đầu vào: chỉ nhận số nguyên >= 0, clamp max
 * @param {number|string|null|undefined} value
 * @returns {number}
 */
export function sanitizeMoney(value) {
  let n;
  if (typeof value === 'number') {
    n = Math.floor(value);
  } else {
    const digits = String(value == null ? '' : value).replace(/\D/g, '');
    n = digits === '' ? 0 : parseInt(digits, 10);
  }
  if (!isFinite(n) || n < 0) return 0;
  return n > MAX_MONEY ? MAX_MONEY : n;
}

/**
 * Format ngày thành dd/MM (không dùng new Date(str) để tránh lệch múi giờ)
 * @param {string} dateStr - định dạng YYYY-MM-DD
 * @returns {string}
 */
export function formatDateDDMM(dateStr) {
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  const [, mm, dd] = parts;
  return `${dd}/${mm}`;
}

/**
 * Tạo id đơn giản cho phiếu chi (bộ đếm + timestamp)
 * @returns {string}
 */
let expenseCounter = 0;
export function generateExpenseId() {
  expenseCounter += 1;
  return `exp_${Date.now()}_${expenseCounter}`;
}