/**
 * @file OrderTableView - bảng món + toàn bộ sự kiện nhập số.
 * Chỉ render + bắt event, gọi callback. Không tính toán nghiệp vụ.
 */

import { el, selectAll, formatNumber } from './dom.js';
import { buildItemRow } from './ItemRowView.js';
import { MAX_SERVINGS, MAX_DIGITS, CATEGORIES, createCategoryMap } from '../config.js';

/**
 * @typedef {Object} OrderTableViewCallbacks
 * @property {(id: string, value: number) => void} onQuantityChange
 * @property {(id: string) => void} onIncrement
 * @property {(id: string) => void} onDecrement
 * @property {(id: string) => number} getServings
 */

export class OrderTableView {
  /**
   * @param {Object} deps
   * @param {HTMLTableSectionElement} deps.tbodyEl
   * @param {import('../config.js').MenuItem[]} deps.menu
   * @param {OrderTableViewCallbacks} deps.callbacks
   */
  constructor({ tbodyEl, menu, callbacks }) {
    this.tbodyEl = tbodyEl;
    this.menu = menu;
    this.callbacks = callbacks;
    /** @type {Map<string, import('../config.js').MenuItem>} */
    this.itemMap = new Map(menu.map((item) => [item.id, item]));
    /** @type {Map<string, import('../config.js').Category>} */
    this.categoryMap = createCategoryMap(CATEGORIES);
    /** @type {Map<string, import('./ItemRowView.js').RowRefs>} */
    this.rowMap = new Map();
    /** Row đang được gõ, không ghi đè input.value */
    this._editingId = null;
  }

  /** Build toàn bộ rows và gắn listener (gọi 1 lần). */
  build() {
    this.tbodyEl.innerHTML = '';
    this.rowMap.clear();

    const frag = document.createDocumentFragment();
    const table = this.tbodyEl.closest('table');
    const colCount = table?.querySelectorAll('thead th').length || 8;
    let lastCategoryId = null;

    this.menu.forEach((item, index) => {
      // Thêm dòng tiêu đề category nếu chuyển category (trừ category 'ht' - giữ giao diện cũ)
      if (item.category !== lastCategoryId && item.category !== 'ht') {
        const cat = this.categoryMap.get(item.category);
        if (cat) {
          frag.appendChild(this.buildCategoryHeader(cat.label, colCount));
        }
        lastCategoryId = item.category;
      }

      const refs = buildItemRow(item, index);
      this.rowMap.set(item.id, refs);
      frag.appendChild(refs.tr);
    });

    this.tbodyEl.appendChild(frag);
    this.bindEvents();
  }

  /**
   * @param {string} label
   * @param {number} colSpan
   * @returns {HTMLTableRowElement}
   */
  buildCategoryHeader(label, colSpan) {
    const tr = el('tr', 'category-header');
    const th = el('th', 'category-label', label);
    th.colSpan = colSpan;
    th.setAttribute('scope', 'rowgroup');
    tr.appendChild(th);
    return tr;
  }

  /** @param {import('../config.js').MenuItem} item @param {number} servings */
  renderRow(item, servings) {
    const ref = this.rowMap.get(item.id);
    if (!ref) return;

    if (this._editingId !== item.id) ref.input.value = String(servings);

    const category = this.categoryMap.get(item.category);
    const hasYields = category ? category.hasYields : false;
    const water = hasYields ? servings * (item.yields?.water ?? 0) : 0;
    const fried = hasYields ? servings * (item.yields?.fried ?? 0) : 0;

    if (hasYields) {
      ref.waterTotal.textContent = formatNumber(water);
      ref.waterTotal.classList.toggle('is-zero', water === 0);
      ref.friedTotal.textContent = formatNumber(fried);
      ref.friedTotal.classList.toggle('is-zero', fried === 0);
    } else {
      ref.waterTotal.textContent = '—';
      ref.waterTotal.classList.add('is-zero');
      ref.friedTotal.textContent = '—';
      ref.friedTotal.classList.add('is-zero');
    }

    ref.tr.classList.toggle('is-active', servings > 0);
    ref.minus.setAttribute('aria-disabled', servings <= 0 ? 'true' : 'false');
    ref.plus.setAttribute('aria-disabled', servings >= MAX_SERVINGS ? 'true' : 'false');
  }

  /** @param {string} id @param {number} servings */
  renderById(id, servings) {
    const item = this.itemMap.get(id);
    if (item) this.renderRow(item, servings);
  }

  /** @param {Map<string, number>} servingsMap */
  renderAll(servingsMap) {
    for (const item of this.menu) this.renderRow(item, servingsMap.get(item.id) ?? 0);
  }

  bindEvents() {
    const body = this.tbodyEl;

    body.addEventListener('click', (e) => {
      const btn = e.target.closest('.counter-btn');
      if (btn) {
        const id = btn.closest('tr[data-id]')?.dataset.id;
        if (!id) return;
        if (btn.dataset.action === 'inc') this.callbacks.onIncrement(id);
        else this.callbacks.onDecrement(id);
        return;
      }
      if (e.target.matches('.counter-input')) selectAll(e.target);
    });

    body.addEventListener('focusin', (e) => {
      if (e.target.matches('.counter-input')) selectAll(e.target);
    });

    body.addEventListener('beforeinput', (e) => {
      if (e.target.matches('.counter-input') && e.data && /\D/.test(e.data)) e.preventDefault();
    });

    body.addEventListener('input', (e) => {
      const input = e.target;
      if (!input.matches('.counter-input')) return;
      const id = input.closest('tr[data-id]')?.dataset.id;
      if (!id) return;

      const digits = input.value.replace(/\D/g, '').slice(0, MAX_DIGITS);
      if (digits !== input.value) input.value = digits;

      this._withEditing(id, () => {
        this.callbacks.onQuantityChange(id, digits === '' ? 0 : parseInt(digits, 10));
      });
    });

    body.addEventListener('paste', (e) => {
      const input = e.target;
      if (!input.matches('.counter-input')) return;
      e.preventDefault();
      const text = (e.clipboardData || globalThis.clipboardData).getData('text') || '';
      const match = text.match(/\d+/);
      const value = match ? parseInt(match[0], 10) : 0;
      const id = input.closest('tr[data-id]')?.dataset.id;
      if (!id) return;
      this._withEditing(id, () => this.callbacks.onQuantityChange(id, value));
      input.value = String(this.callbacks.getServings(id));
    });

    body.addEventListener('focusout', (e) => {
      const input = e.target;
      if (!input.matches('.counter-input')) return;
      const id = input.closest('tr[data-id]')?.dataset.id;
      if (id) input.value = String(this.callbacks.getServings(id));
    });

    body.addEventListener('keydown', (e) => {
      const input = e.target;
      if (!input.matches('.counter-input')) return;
      const id = input.closest('tr[data-id]')?.dataset.id;
      if (!id) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.callbacks.onIncrement(id);
        selectAll(input);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.callbacks.onDecrement(id);
        selectAll(input);
      } else if (e.key === 'Enter') {
        input.blur();
      }
    });
  }

  _withEditing(id, fn) {
    this._editingId = id;
    try {
      fn();
    } finally {
      this._editingId = null;
    }
  }
}