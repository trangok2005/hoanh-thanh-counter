/**
 * @file ApiKeyDialog - nhập API key (chỉ giữ trong RAM, không lưu).
 */

export class ApiKeyDialog {
  /**
   * @param {Object} deps
   * @param {HTMLDialogElement} deps.dialogEl
   * @param {HTMLInputElement} deps.inputEl
   * @param {(key: string) => void} deps.onSubmit - nhận cả chuỗi rỗng
   * @param {() => void} deps.onCancel
   */
  constructor({ dialogEl, inputEl, onSubmit, onCancel }) {
    this.dialogEl = dialogEl;
    this.inputEl = inputEl;
    this.onSubmit = onSubmit;
    this.onCancel = onCancel;

    this.dialogEl.addEventListener('close', () => {
      const key = this.inputEl.value.trim();
      const confirmed = this.dialogEl.returnValue === 'confirm';
      this.inputEl.value = '';
      if (confirmed) this.onSubmit(key);
      else this.onCancel();
    });
  }

  show() {
    this.inputEl.value = '';
    this.dialogEl.returnValue = '';
    this.dialogEl.showModal();
    setTimeout(() => this.inputEl.focus(), 0);
  }
}