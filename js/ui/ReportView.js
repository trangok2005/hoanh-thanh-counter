/**
 * @file ReportView - panel tab Báo cáo
 */

import { el, svgIcon, selectAll, formatMoney } from './dom.js';
import { PAYMENT_CHANNELS, METRICS, CATEGORIES, createCategoryMap, REPORT_TITLES } from '../config.js';
import { sanitizeMoney, sanitizeQuantity, formatDateDDMM } from '../domain/quantity.js';

export class ReportView {
  /**
   * @param {Object} deps
   * @param {HTMLElement} deps.root - container gốc
   * @param {import('../domain/Report.js').Report} deps.reportStore
   * @param {(msg: string) => void} deps.showToast
   * @param {() => void} deps.onResetReport
   * @param {() => string} deps.getReportText - lấy text báo cáo để copy
   * @param {(proceed: () => void) => void} deps.onBeforeCopy - xác nhận trước khi copy
   */
  constructor({ root, reportStore, showToast, onResetReport, getReportText, onBeforeCopy }) {
    this.reportStore = reportStore;
    this.showToast = showToast;
    this.onResetReport = onResetReport;
    this.getReportText = getReportText;
    this.onBeforeCopy = onBeforeCopy;
    this.unsub = null;
    /** @type {Map<string, { row: HTMLElement, amountInput: HTMLInputElement, reasonInput: HTMLInputElement }>} */
    this._expenseRows = new Map();

    this.root = root;
    this.build();
    this.bindEvents();
    this.syncFromStore();
    this.unsub = reportStore.subscribe(() => this.syncFromStore());
  }

  build() {
    this.root.innerHTML = '';
    this.root.className = 'report-panel';

    // Header: ngày + loại báo cáo
    const header = el('div', 'report-header');
    const dateWrap = el('div', 'report-field');
    const dateLabel = el('label', 'report-label', 'Ngày');
    this.dateInput = el('input', 'report-date');
    this.dateInput.type = 'date';
    this.dateInput.value = this.reportStore.state.date;
    dateWrap.append(dateLabel, this.dateInput);

    const titleWrap = el('div', 'report-field');
    const titleLabel = el('label', 'report-label', 'Loại báo cáo');
    this.titleSelect = el('select', 'report-title');
    for (const t of REPORT_TITLES) {
      const opt = document.createElement('option');
      opt.value = t.value;
      opt.textContent = t.label;
      if (t.value === this.reportStore.state.title) opt.selected = true;
      this.titleSelect.appendChild(opt);
    }
    titleWrap.append(titleLabel, this.titleSelect);

    header.append(dateWrap, titleWrap);
    this.root.appendChild(header);

    // Doanh thu
    const revenueSection = el('section', 'report-section');
    revenueSection.appendChild(el('h3', 'report-section-title', 'Doanh thu'));

    const revenueGrid = el('div', 'report-grid');
    this.paymentInputs = new Map();
    for (const ch of PAYMENT_CHANNELS) {
      const wrap = el('div', 'report-field');
      const label = el('label', 'report-label', ch.label);
      const input = el('input', 'report-money');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.dataset.channel = ch.id;
      input.value = '0';
      wrap.append(label, input);
      revenueGrid.appendChild(wrap);
      this.paymentInputs.set(ch.id, input);
    }
    // Tổng DT
    const totalWrap = el('div', 'report-field report-total');
    const totalLabel = el('label', 'report-label', 'Tổng DT');
    this.totalRevenueEl = el('output', 'report-total-value', '0');
    totalWrap.append(totalLabel, this.totalRevenueEl);
    revenueGrid.appendChild(totalWrap);

    revenueSection.appendChild(revenueGrid);
    this.root.appendChild(revenueSection);

    // Phiếu chi
    const expenseSection = el('section', 'report-section');
    const expenseHeader = el('div', 'report-section-header');
    expenseHeader.appendChild(el('h3', 'report-section-title', 'Phiếu chi'));
    const addExpenseBtn = el('button', 'btn btn--primary btn--small', 'Thêm phiếu chi');
    addExpenseBtn.addEventListener('click', () => this.addExpense());
    expenseHeader.appendChild(addExpenseBtn);
    expenseSection.appendChild(expenseHeader);

    this.expenseList = el('div', 'report-expense-list');
    expenseSection.appendChild(this.expenseList);

    const expenseTotalWrap = el('div', 'report-field report-total');
    expenseTotalWrap.append(
      el('label', 'report-label', 'Tổng chi'),
      this.expenseTotalEl = el('output', 'report-total-value', '0')
    );
    expenseSection.appendChild(expenseTotalWrap);
    this.root.appendChild(expenseSection);

    // Huỷ
    const cancelSection = el('section', 'report-section');
    cancelSection.appendChild(el('h3', 'report-section-title', 'Huỷ'));

    const cancelGrid = el('div', 'report-grid');
    this.cancelInputs = new Map();
    for (const m of METRICS) {
      const wrap = el('div', 'report-field');
      const label = el('label', 'report-label', `${m.label} (viên)`);
      const input = el('input', 'report-qty');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.dataset.metric = m.id;
      input.value = '0';
      wrap.append(label, input);
      cancelGrid.appendChild(wrap);
      this.cancelInputs.set(m.id, input);
    }
    cancelSection.appendChild(cancelGrid);
    this.root.appendChild(cancelSection);

    // Xem trước & actions
    const previewSection = el('section', 'report-section');
    previewSection.appendChild(el('h3', 'report-section-title', 'Xem trước báo cáo'));

    this.previewEl = el('pre', 'report-preview');
    this.previewEl.textContent = '(chưa có dữ liệu)';
    previewSection.appendChild(this.previewEl);

    const actions = el('div', 'report-actions');
    this.copyBtn = el('button', 'btn btn--primary', 'Sao chép báo cáo');
    this.copyBtn.addEventListener('click', () => this.copyReport());
    const resetBtn = el('button', 'btn btn--ghost', 'Đặt lại báo cáo');
    resetBtn.addEventListener('click', () => this.confirmReset());
    actions.append(this.copyBtn, resetBtn);
    previewSection.appendChild(actions);
    this.root.appendChild(previewSection);
  }

  bindEvents() {
    // Date change
    this.dateInput.addEventListener('change', () => {
      this.reportStore.setDate(this.dateInput.value);
      this.updatePreview();
    });

    // Title change
    this.titleSelect.addEventListener('change', () => {
      this.reportStore.setTitle(this.titleSelect.value);
    });

    // Payment inputs
    for (const [chId, input] of this.paymentInputs) {
      input.addEventListener('input', () => {
        this.filterMoneyInput(input);
        this.reportStore.setPayment(chId, sanitizeMoney(input.value));
      });
      input.addEventListener('blur', () => {
        const val = sanitizeMoney(input.value);
        this.reportStore.setPayment(chId, val);
        this.formatMoneyInput(input);
        this.updatePreview();
      });
      input.addEventListener('focus', () => selectAll(input));
    }

    // Cancel inputs
    for (const [metricId, input] of this.cancelInputs) {
      input.addEventListener('input', () => this.filterQtyInput(input));
      input.addEventListener('blur', () => {
        const val = sanitizeQuantity(input.value);
        this.reportStore.setCancel(metricId, val);
        this.updatePreview();
      });
      input.addEventListener('focus', () => selectAll(input));
    }
  }

  filterMoneyInput(input) {
    const digits = input.value.replace(/\D/g, '');
    if (digits !== input.value) input.value = digits;
  }

  formatMoneyInput(input) {
    const val = sanitizeMoney(input.value);
    input.value = formatMoney(val);
  }

  filterQtyInput(input) {
    const digits = input.value.replace(/\D/g, '');
    if (digits !== input.value) input.value = digits;
  }

  addExpense() {
    const id = this.reportStore.addExpense(0, '');
    const refs = this._expenseRows.get(id);
    if (refs) {
      refs.amountInput.focus();
      refs.amountInput.select();
    }
  }

  /**
   * @param {{ id: string, amount: number, reason: string }} expense
   * @returns {{ row: HTMLElement, amountInput: HTMLInputElement, reasonInput: HTMLInputElement }}
   */
  addExpenseRow(expense) {
    const id = expense.id;
    const row = el('div', 'expense-row');
    const amountInput = el('input', 'expense-amount');
    amountInput.type = 'text';
    amountInput.inputMode = 'numeric';
    amountInput.placeholder = 'Số tiền (VND)';
    amountInput.value = formatMoney(expense.amount);

    const reasonInput = el('input', 'expense-reason');
    reasonInput.type = 'text';
    reasonInput.placeholder = 'Lý do (tối đa 100 ký tự)';
    reasonInput.maxLength = 100;
    reasonInput.value = expense.reason;

    const delBtn = el('button', 'expense-del');
    delBtn.setAttribute('aria-label', 'Xóa phiếu chi');
    delBtn.appendChild(svgIcon('M6 6l12 12M18 6L6 18'));
    delBtn.addEventListener('click', () => this.reportStore.removeExpense(id));

    amountInput.addEventListener('input', () => {
      this.filterMoneyInput(amountInput);
      this.reportStore.updateExpense(id, {
        amount: amountInput.value,
        reason: reasonInput.value,
      });
    });
    amountInput.addEventListener('blur', () => {
      this.formatMoneyInput(amountInput);
      this.updatePreview();
    });
    amountInput.addEventListener('focus', () => selectAll(amountInput));

    reasonInput.addEventListener('input', () => {
      this.reportStore.updateExpense(id, {
        amount: amountInput.value,
        reason: reasonInput.value,
      });
    });

    row.append(amountInput, reasonInput, delBtn);
    this.expenseList.appendChild(row);

    const refs = { row, amountInput, reasonInput };
    this._expenseRows.set(id, refs);
    return refs;
  }

  /**
   * @param {{ amountInput: HTMLInputElement, reasonInput: HTMLInputElement }} refs
   * @param {{ amount: number, reason: string }} expense
   */
  updateExpenseRow(refs, expense) {
    if (document.activeElement !== refs.amountInput) {
      refs.amountInput.value = formatMoney(expense.amount);
    }
    if (document.activeElement !== refs.reasonInput) {
      refs.reasonInput.value = expense.reason;
    }
  }

  updateExpenseTotal() {
    const total = this.reportStore.state.expenses.reduce((sum, e) => sum + sanitizeMoney(e.amount), 0);
    this.expenseTotalEl.textContent = formatMoney(total);
  }

  syncFromStore() {
    const state = this.reportStore.state;

    if (document.activeElement !== this.dateInput) this.dateInput.value = state.date;
    if (document.activeElement !== this.titleSelect) {
      for (const opt of this.titleSelect.options) {
        opt.selected = opt.value === state.title;
      }
    }

    let revenueTotal = 0;
    for (const [chId, input] of this.paymentInputs) {
      revenueTotal += state.payments[chId] ?? 0;
      if (document.activeElement !== input) input.value = formatMoney(state.payments[chId] ?? 0);
    }
    this.totalRevenueEl.textContent = formatMoney(revenueTotal);

    const ids = new Set(state.expenses.map((e) => e.id));
    for (const [id, refs] of this._expenseRows) {
      if (!ids.has(id)) {
        refs.row.remove();
        this._expenseRows.delete(id);
      }
    }
    for (const exp of state.expenses) {
      const refs = this._expenseRows.get(exp.id) || this.addExpenseRow(exp);
      this.updateExpenseRow(refs, exp);
    }
    this.updateExpenseTotal();

    for (const [metricId, input] of this.cancelInputs) {
      if (document.activeElement !== input) input.value = String(state.cancel[metricId] ?? 0);
    }

    this.updatePreview();
  }

  updatePreview() {
    this.previewEl.textContent = this.getReportText();
  }

  copyReport() {
    const text = this.getReportText();
    if (!text || text === '(chưa có dữ liệu)') {
      this.showToast('Chưa có dữ liệu báo cáo');
      return;
    }
    this.onBeforeCopy(() => this.writeReportText(text));
  }

  async writeReportText(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Đã sao chép báo cáo');
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        this.showToast('Đã sao chép báo cáo');
      } catch {
        this.showToast('Không thể sao chép, hãy chọn thủ công');
      }
      ta.remove();
    }
  }

  confirmReset() {
    this.onResetReport();
  }

  destroy() {
    if (this.unsub) this.unsub();
  }
}