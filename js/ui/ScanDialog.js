/**
 * @file ScanDialog - preview, review rows và xác nhận kết quả quét ảnh.
 */

import { el, svgIcon, selectAll } from './dom.js';
import { MAX_SERVINGS, MAX_DIGITS, itemLabel, CATEGORIES, createCategoryMap } from '../config.js';

export class ScanDialog {
  /**
   * @param {Object} deps
   * @param {HTMLDialogElement} deps.dialogEl
   * @param {HTMLElement} deps.previewEl
   * @param {HTMLImageElement} deps.imgEl
   * @param {HTMLElement} deps.statusEl
   * @param {HTMLElement} deps.formEl
   * @param {HTMLElement} deps.rowsEl
   * @param {HTMLElement} deps.unmatchedEl
   * @param {HTMLElement} deps.mergeWrapEl
   * @param {HTMLInputElement} deps.mergeEl
   * @param {HTMLButtonElement} deps.cancelBtn
   * @param {HTMLButtonElement} deps.retryBtn
   * @param {HTMLButtonElement} deps.confirmBtn
   * @param {HTMLButtonElement} deps.changeKeyBtn
   * @param {import('../config.js').MenuItem[]} deps.menu
   * @param {(msg: string) => void} deps.showToast
   * @param {() => void} deps.onRetry
   * @param {() => void} deps.onCancel
   * @param {() => void} deps.onChangeKey
   * @param {(data: {items: {id: string, servings: number}[], merge: boolean}) => void} deps.onConfirm
   */
  constructor(deps) {
    Object.assign(this, {
      dialogEl: deps.dialogEl,
      previewEl: deps.previewEl,
      imgEl: deps.imgEl,
      statusEl: deps.statusEl,
      formEl: deps.formEl,
      rowsEl: deps.rowsEl,
      unmatchedEl: deps.unmatchedEl,
      mergeWrapEl: deps.mergeWrapEl,
      mergeEl: deps.mergeEl,
      cancelBtn: deps.cancelBtn,
      retryBtn: deps.retryBtn,
      confirmBtn: deps.confirmBtn,
      changeKeyBtn: deps.changeKeyBtn,
      menu: deps.menu,
      showToast: deps.showToast,
      onRetry: deps.onRetry,
      onCancel: deps.onCancel,
      onChangeKey: deps.onChangeKey,
      onConfirm: deps.onConfirm,
    });

    this.cancelBtn.addEventListener('click', () => this.requestClose());
    this.dialogEl.addEventListener('cancel', (e) => { e.preventDefault(); this.requestClose(); });
    this.retryBtn.addEventListener('click', () => this.onRetry());
    this.confirmBtn.addEventListener('click', () => this.confirm());
    this.changeKeyBtn.addEventListener('click', () => this.onChangeKey());
  }

  isOpen() {
    return this.dialogEl.open;
  }

  open() {
    if (!this.dialogEl.open) this.dialogEl.showModal();
  }

  /** @param {'idle'|'loading'|'review'|'error'} state @param {string} [message] */
  setState(state, message = '') {
    this.statusEl.textContent = message;
    this.statusEl.classList.toggle('is-error', state === 'error');
    this.statusEl.classList.toggle('is-loading', state === 'loading');
    this.statusEl.hidden = !message;
    this.formEl.hidden = state !== 'review';
    this.confirmBtn.hidden = state !== 'review';
    this.retryBtn.hidden = state !== 'error';
  }

  /** @param {string} dataUrl */
  showPreview(dataUrl) {
    this.imgEl.src = dataUrl;
    this.previewEl.hidden = false;
  }

  hidePreview() {
    this.previewEl.hidden = true;
  }

  /**
   * @param {{items: {id: string, servings: number}[], unmatched: string[]}} result
   * @param {{servings: number}} currentTotals
   * @param {boolean} [isEmpty] - đơn hiện tại trống hoàn toàn
   */
  showResult(result, currentTotals, isEmpty = currentTotals.servings === 0) {
    const validIds = new Set(this.menu.map((item) => item.id));
    const add = new Map();
    for (const r of result.items || []) {
      if (!r || !validIds.has(r.id)) continue;
      const q = Math.max(0, Math.min(r.servings, MAX_SERVINGS));
      if (q > 0) add.set(r.id, Math.min(MAX_SERVINGS, (add.get(r.id) ?? 0) + q));
    }

    this.rowsEl.innerHTML = '';
    for (const item of this.menu) {
      const qty = add.get(item.id);
      if (qty) this.rowsEl.appendChild(this.makeRow(item.id, qty));
    }

    const unmatched = (result.unmatched || []).filter((t) => typeof t === 'string' && t.trim());
    this.unmatchedEl.hidden = unmatched.length === 0;
    this.unmatchedEl.textContent = unmatched.length
      ? 'Chưa nhận diện được: ' + unmatched.join('; ')
      : '';

    this.mergeWrapEl.hidden = isEmpty;

    if (!this.rowsEl.children.length) {
      this.setState('error', 'Không tìm thấy món nào trong ảnh. Hãy chụp rõ hơn hoặc nhập tay.');
      return;
    }
    this.setState('review', '');
    this.confirmBtn.disabled = false;
  }

  makeRow(id, qty) {
    const row = el('div', 'scan-row');

    const select = el('select', 'scan-select');
    select.setAttribute('aria-label', 'Món');
    const categoryMap = createCategoryMap(CATEGORIES);
    let lastCategoryId = null;
    for (const item of this.menu) {
      if (item.category !== lastCategoryId) {
        const cat = categoryMap.get(item.category);
        if (cat) {
          const optgroup = document.createElement('optgroup');
          optgroup.label = cat.label;
          select.appendChild(optgroup);
          lastCategoryId = item.category;
        }
      }
      const option = el('option', null, itemLabel(item));
      option.value = item.id;
      select.appendChild(option);
    }
    select.value = id;

    const input = el('input', 'scan-qty');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.maxLength = MAX_DIGITS;
    input.value = String(qty);
    input.setAttribute('aria-label', 'Số phần');
    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '').slice(0, MAX_DIGITS);
      if (digits !== input.value) input.value = digits;
    });
    input.addEventListener('focus', () => selectAll(input));

    const unit = el('span', 'scan-unit', 'phần');

    const del = el('button', 'scan-del');
    del.type = 'button';
    del.setAttribute('aria-label', 'Xóa dòng này');
    del.appendChild(svgIcon('M6 6l12 12M18 6L6 18'));
    del.addEventListener('click', () => {
      row.remove();
      this.updateConfirmState();
    });

    row.append(select, input, unit, del);
    return row;
  }

  updateConfirmState() {
    const hasRows = this.rowsEl.children.length > 0;
    this.confirmBtn.disabled = !hasRows;
    if (!hasRows) this.setState('error', 'Không còn món nào để tính.');
    else this.statusEl.hidden = true;
  }

  /** @returns {{items: {id: string, servings: number}[], merge: boolean}} */
  collect() {
    const add = new Map();
    this.rowsEl.querySelectorAll('.scan-row').forEach((row) => {
      const id = row.querySelector('select').value;
      const raw = parseInt(row.querySelector('input').value.replace(/\D/g, ''), 10) || 0;
      const q = Math.min(Math.max(raw, 0), MAX_SERVINGS);
      if (q > 0) add.set(id, (add.get(id) ?? 0) + q);
    });
    const merge = this.mergeWrapEl.hidden ? true : this.mergeEl.checked;
    return {
      items: Array.from(add, ([id, servings]) => ({ id, servings })),
      merge,
    };
  }

  confirm() {
    const data = this.collect();
    if (!data.items.length) {
      this.showToast('Chưa có số phần nào để tính');
      return;
    }
    this.onConfirm(data);
  }

  /** Dọn dẹp và đóng dialog (không gọi onCancel). */
  reset() {
    if (this.dialogEl.open) this.dialogEl.close();
    this.rowsEl.innerHTML = '';
    this.imgEl.removeAttribute('src');
    this.previewEl.hidden = true;
    this.mergeWrapEl.hidden = true;
    this.setState('idle', '');
  }

  /** Người dùng chủ động huỷ. */
  requestClose() {
    this.reset();
    this.onCancel();
  }
}