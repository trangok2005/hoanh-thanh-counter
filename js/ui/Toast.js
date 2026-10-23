/**
 * @file Toast - hiển thị thông báo tạm thời
 */

export class Toast {
  /**
   * @param {HTMLElement} el - #toast
   */
  constructor(el) {
    this.el = el;
    this.timer = null;
  }

  /** @param {string} message */
  show(message) {
    clearTimeout(this.timer);
    this.el.textContent = message;
    this.el.hidden = false;
    this.el.style.animation = 'none';
    void this.el.offsetWidth;
    this.el.style.animation = '';
    this.timer = setTimeout(() => { this.el.hidden = true; }, 2200);
  }
}