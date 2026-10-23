/**
 * @file ScanController - nối ScanDialog + ApiKeyDialog + ScanService + Order.
 * Chống race bằng scanToken + AbortController của đúng lần quét.
 */

import { normalizeError } from '../ai/errors.js';

export class ScanController {
  /**
   * @param {Object} deps
   * @param {() => string} deps.getApiKey
   * @param {(key: string) => void} deps.setApiKey
   * @param {() => void} deps.askApiKey
   * @param {import('../ui/ScanDialog.js').ScanDialog} deps.scanDialog
   * @param {{ show: (msg: string) => void }} deps.toast
   * @param {import('../domain/Order.js').Order} deps.order
   * @param {() => import('../ai/ScanService.js').ScanService} deps.createScanService
   */
  constructor({ getApiKey, setApiKey, askApiKey, scanDialog, toast, order, createScanService }) {
    this.getApiKey = getApiKey;
    this.setApiKey = setApiKey;
    this.askApiKey = askApiKey;
    this.scanDialog = scanDialog;
    this.toast = toast;
    this.order = order;
    this.createScanService = createScanService;

    this.scanToken = 0;
    this.scanAbort = null;
    this.pendingFile = null;
  }

  /** @param {File} file */
  start(file) {
    this.pendingFile = file;
    if (!this.getApiKey()) {
      this.askApiKey();
      return;
    }
    this.runScan(file);
  }

  /** @param {File} file */
  async runScan(file) {
    const token = ++this.scanToken;
    if (this.scanAbort) this.scanAbort.abort();
    const ctrl = new AbortController();
    this.scanAbort = ctrl;
    this.pendingFile = file;

    this.scanDialog.open();
    this.scanDialog.hidePreview();
    this.scanDialog.setState('loading', 'Đang quét ảnh…');

    try {
      const service = this.createScanService();
      const prepared = await service.prepare(file);
      if (token !== this.scanToken) return;
      this.scanDialog.showPreview(prepared.dataUrl);

      const result = await service.scan(prepared, { signal: ctrl.signal });
      if (token !== this.scanToken) return;
      this.scanDialog.showResult(result, this.order.getTotals(), this.order.isEmpty());
    } catch (err) {
      if (token !== this.scanToken) return;
      if (err && err.name === 'AbortError') return;

      const aiErr = normalizeError(err);
      if (aiErr.badKey) this.setApiKey('');
      this.scanDialog.setState('error', aiErr.message || 'Có lỗi khi quét ảnh.');
    } finally {
      if (this.scanAbort === ctrl) this.scanAbort = null;
    }
  }

  /**
   * @param {{items: {id: string, servings: number}[], merge: boolean}} data
   */
  handleConfirm({ items, merge }) {
    const add = new Map(items.map(({ id, servings }) => [id, servings]));

    for (const item of this.order.menu) {
      const current = this.order.getServings(item.id);
      const next = (merge ? current : 0) + (add.get(item.id) ?? 0);
      if (next !== current) this.order.setServings(item.id, next);
    }

    const total = items.reduce((sum, { servings }) => sum + servings, 0);
    this.close();
    this.toast.show(`Đã tính ${total.toLocaleString('vi-VN')} phần từ ảnh`);
  }

  retry() {
    if (!this.pendingFile) {
      this.close();
      return;
    }
    if (!this.getApiKey()) {
      this.askApiKey();
      return;
    }
    this.runScan(this.pendingFile);
  }

  changeKey() {
    this.setApiKey('');
    this.askApiKey();
  }

  /** Gọi sau khi người dùng nhập key thành công. */
  resumeAfterKey() {
    if (!this.pendingFile) return;
    this.runScan(this.pendingFile);
  }

  /** Huỷ dialog key: bỏ file nếu chưa mở dialog quét. */
  cancelPending() {
    if (!this.scanDialog.isOpen()) this.pendingFile = null;
  }

  /** Dọn dẹp hoàn toàn. */
  close() {
    this.scanToken++;
    if (this.scanAbort) {
      this.scanAbort.abort();
      this.scanAbort = null;
    }
    this.scanDialog.reset();
    this.pendingFile = null;
  }
}