/**
 * @file ConfirmDialog - xác nhận chung (message + callback)
 */

import { closeOnBackdropClick } from './dom.js';

export class ConfirmDialog {
  /**
   * @param {Object} deps
   * @param {HTMLDialogElement} deps.dialogEl
   * @param {HTMLElement} deps.messageEl - element chứa message
   * @param {() => void} deps.onConfirm
   */
  constructor({ dialogEl, messageEl, onConfirm }) {
    this.dialogEl = dialogEl;
    this.messageEl = messageEl;
    this.onConfirm = onConfirm;
    this._pendingConfirm = null;
    this.dialogEl.addEventListener('close', () => {
      if (this.dialogEl.returnValue === 'confirm') {
        const handler = this._pendingConfirm || this.onConfirm;
        this._pendingConfirm = null;
        handler();
      } else {
        this._pendingConfirm = null;
      }
    });
    closeOnBackdropClick(this.dialogEl);
  }

  /**
   * @param {string} message
   * @param {() => void} [onConfirm] - callback riêng cho lần hiển thị này
   */
  show(message, onConfirm) {
    this.messageEl.textContent = message;
    this._pendingConfirm = onConfirm || null;
    this.dialogEl.returnValue = '';
    this.dialogEl.showModal();
  }
}