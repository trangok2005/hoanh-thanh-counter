/**
 * @file ItemRowView - dựng DOM cho một dòng món trong bảng.
 */

import { el, svgIcon } from './dom.js';
import { MAX_DIGITS, itemLabel } from '../config.js';

/**
 * @typedef {Object} RowRefs
 * @property {HTMLTableRowElement} tr
 * @property {HTMLInputElement} input
 * @property {HTMLButtonElement} minus
 * @property {HTMLButtonElement} plus
 * @property {HTMLElement} waterTotal
 * @property {HTMLElement} friedTotal
 * @property {HTMLElement} waterRate
 * @property {HTMLElement} friedRate
 */

/**
 * @param {import('../config.js').MenuItem} item
 * @param {number} index
 * @returns {RowRefs}
 */
export function buildItemRow(item, index) {
  const label = itemLabel(item);
  const tr = el('tr', 'item-row');
  tr.dataset.id = item.id;

  // STT
  tr.appendChild(el('td', 'c-index', String(index + 1)));

  // Tên món
  const tdName = el('th', 'c-name');
  tdName.scope = 'row';
  tdName.appendChild(el('span', 'item-name', item.name));
  tr.appendChild(tdName);

  // Phân loại (variant)
  const tdVariant = el('td', 'c-variant');
  if (item.variant) {
    const spicy = item.variant === 'Cay';
    tdVariant.appendChild(el('span', `tag ${spicy ? 'tag--spicy' : 'tag--mild'}`, item.variant));
  } else {
    const dash = el('span', 'dash', '—');
    dash.setAttribute('aria-label', 'Không áp dụng');
    tdVariant.appendChild(dash);
  }
  tr.appendChild(tdVariant);

  // Viên nước/phần
  const tdWaterRate = el('td', 'c-water-rate');
  if (item.yields && item.yields.water !== undefined) {
    tdWaterRate.appendChild(el('span', 'm-only', 'Nước: '));
    tdWaterRate.appendChild(document.createTextNode(String(item.yields.water)));
    tdWaterRate.appendChild(el('span', 'm-only', ' viên/phần'));
  } else {
    tdWaterRate.appendChild(el('span', 'dash', '—'));
  }
  tr.appendChild(tdWaterRate);

  // Viên chiên/phần
  const tdFriedRate = el('td', 'c-fried-rate');
  if (item.yields && item.yields.fried !== undefined) {
    tdFriedRate.appendChild(el('span', 'm-only', 'Chiên: '));
    tdFriedRate.appendChild(document.createTextNode(String(item.yields.fried)));
    tdFriedRate.appendChild(el('span', 'm-only', ' viên/phần'));
  } else {
    tdFriedRate.appendChild(el('span', 'dash', '—'));
  }
  tr.appendChild(tdFriedRate);

  // Số phần (counter)
  const tdQty = el('td', 'c-qty');
  const counter = el('div', 'counter');

  const minus = el('button', 'counter-btn');
  minus.type = 'button';
  minus.dataset.action = 'dec';
  minus.setAttribute('aria-label', `Giảm một phần ${label}`);
  minus.appendChild(svgIcon('M5 12h14'));

  const input = el('input', 'counter-input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.pattern = '[0-9]*';
  input.autocomplete = 'off';
  input.maxLength = MAX_DIGITS;
  input.value = '0';
  input.setAttribute('aria-label', `Số phần ${label}`);

  const plus = el('button', 'counter-btn');
  plus.type = 'button';
  plus.dataset.action = 'inc';
  plus.setAttribute('aria-label', `Tăng một phần ${label}`);
  plus.appendChild(svgIcon('M12 5v14M5 12h14'));

  counter.append(minus, input, plus);
  tdQty.appendChild(counter);
  tr.appendChild(tdQty);

  // Tổng viên nước
  const tdWaterTotal = el('td', 'c-water-total');
  tdWaterTotal.appendChild(el('span', 'm-label', 'Nước'));
  const waterTotal = el('span', 'result-val is-zero', '0');
  tdWaterTotal.appendChild(waterTotal);
  tr.appendChild(tdWaterTotal);

  // Tổng viên chiên
  const tdFriedTotal = el('td', 'c-fried-total');
  tdFriedTotal.appendChild(el('span', 'm-label', 'Chiên'));
  const friedTotal = el('span', 'result-val is-zero', '0');
  tdFriedTotal.appendChild(friedTotal);
  tr.appendChild(tdFriedTotal);

  return { tr, input, minus, plus, waterTotal, friedTotal, waterRate: tdWaterRate, friedRate: tdFriedRate };
}