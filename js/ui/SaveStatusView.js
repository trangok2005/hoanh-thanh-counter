/**
 * @file SaveStatusView - hiển thị trạng thái lưu (Đang lưu…, Đã lưu, Lỗi)
 */

import { SaveState } from '../storage/SaveState.js';

export class SaveStatusView {
  /**
   * @param {HTMLElement} el - #save-status
   */
  constructor(el) {
    this.el = el;
  }

  /** @param {SaveState} state */
  setState(state) {
    this.el.classList.remove('is-saved', 'is-error');
    if (state === SaveState.SAVING) this.el.textContent = 'Đang lưu…';
    else if (state === SaveState.SAVED) { this.el.textContent = 'Đã lưu'; this.el.classList.add('is-saved'); }
    else if (state === SaveState.ERROR) { this.el.textContent = 'Không lưu được trên trình duyệt này'; this.el.classList.add('is-error'); }
    else this.el.textContent = 'Tự động lưu';
  }
}