/**
 * @file AddItemForm - form thêm món nhanh
 */

import { MAX_SERVINGS, CATEGORIES, createCategoryMap } from '../config.js';

export class AddItemForm {
  /**
   * @param {Object} deps
   * @param {HTMLSelectElement} deps.selectEl
   * @param {HTMLInputElement} deps.qtyEl
   * @param {HTMLButtonElement} deps.btnEl
   * @param {import('../config.js').MenuItem[]} deps.menu
   * @param {(id: string, qty: number) => void} deps.onAdd
   * @param {(msg: string) => void} deps.showToast
   */
  constructor({ selectEl, qtyEl, btnEl, menu, onAdd, showToast }) {
    this.selectEl = selectEl;
    this.qtyEl = qtyEl;
    this.btnEl = btnEl;
    this.menu = menu;
    this.onAdd = onAdd;
    this.showToast = showToast;
    this.bindEvents();
  }

  populate() {
    this.selectEl.innerHTML = '';
    const categoryMap = createCategoryMap(CATEGORIES);

    let lastCategoryId = null;
    let currentGroup = this.selectEl;

    for (const item of this.menu) {
      // Thêm optgroup khi chuyển category
      if (item.category !== lastCategoryId) {
        const cat = categoryMap.get(item.category);
        if (cat) {
          currentGroup = document.createElement('optgroup');
          currentGroup.label = cat.label;
          this.selectEl.appendChild(currentGroup);
          lastCategoryId = item.category;
        }
      }

      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.variant
        ? `${item.name} ${item.variant.toLowerCase()}`
        : item.name;
      currentGroup.appendChild(option);
    }
  }

  bindEvents() {
    this.btnEl.addEventListener('click', () => {
      const id = this.selectEl.value;
      if (!id) {
        this.showToast('Vui lòng chọn món');
        this.selectEl.focus();
        return;
      }
      const digits = this.qtyEl.value.replace(/\D/g, '');
      const qty = digits === '' ? 0 : Math.min(parseInt(digits, 10), MAX_SERVINGS);
      if (!isFinite(qty) || qty <= 0) {
        this.showToast('Vui lòng nhập số phần lớn hơn 0');
        this.qtyEl.focus();
        this.qtyEl.select();
        return;
      }
      const item = this.menu.find((m) => m.id === id);
      this.onAdd(id, qty);
      this.qtyEl.value = '1';
      if (this.selectEl.options.length > 0) this.selectEl.selectedIndex = 0;
      const label = item ? (item.variant ? `${item.name} ${item.variant.toLowerCase()}` : item.name) : id;
      this.showToast(`Đã thêm ${label}`);
    });

    this.qtyEl.addEventListener('focus', () => this.qtyEl.select());
    this.qtyEl.addEventListener('click', () => this.qtyEl.select());
  }
}