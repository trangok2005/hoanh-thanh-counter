/**
 * @file main.js - Composition root: tạo object, nối dependency, KHÔNG chứa logic.
 * Chỉ file này dùng `new` để wire các thành phần.
 */

import { MENU, CATEGORIES, AI_CONFIG, STORAGE_KEY, REPORT_STORAGE_KEY, PAYMENT_CHANNELS, METRICS, REPORT_GROUPS, REPORT_FORMAT } from './config.js';
import { validateConfig } from './domain/validateConfig.js';
import { Order } from './domain/Order.js';
import { Report } from './domain/Report.js';
import { formatReport } from './domain/reportFormatter.js';
import { LocalStorageRepository, ReportStorageRepository } from './storage/LocalStorageRepository.js';
import { StatePersistence, onStorageChange } from './storage/StatePersistence.js';
import { createProvider } from './ai/providers.js';
import { ScanService } from './ai/ScanService.js';
import { OrderScanTask } from './ai/tasks/OrderScanTask.js';
import { getCachedPrompt } from './ai/promptCache.js';
import { Tabs } from './ui/Tabs.js';
import { OrderTableView } from './ui/OrderTableView.js';
import { SummaryView } from './ui/SummaryView.js';
import { AddItemForm } from './ui/AddItemForm.js';
import { ConfirmDialog } from './ui/ConfirmDialog.js';
import { ApiKeyDialog } from './ui/ApiKeyDialog.js';
import { ScanDialog } from './ui/ScanDialog.js';
import { Toast } from './ui/Toast.js';
import { SaveStatusView } from './ui/SaveStatusView.js';
import { ReportView } from './ui/ReportView.js';
import { ScanController } from './app/ScanController.js';

const byId = (id) => document.getElementById(id);

// ---------- Validate config at startup ----------
const validation = validateConfig();
if (!validation.ok) {
  console.error('Config validation failed:', validation.errors);
  alert('Lỗi cấu hình: ' + validation.errors.join('\n'));
  throw new Error('Invalid config');
}

// ---------- Cache prompt once at startup ----------
getCachedPrompt(OrderScanTask, MENU, CATEGORIES);

// ---------- Shared instances ----------
const toast = new Toast(byId('toast'));
const saveStatusView = new SaveStatusView(byId('save-status'));

// Order state
const order = new Order(MENU);

// Order persistence
const orderRepo = new LocalStorageRepository(STORAGE_KEY, 1);
const orderPersistence = new StatePersistence({
  repository: orderRepo,
  onStatusChange: (state) => saveStatusView.setState(state),
  debounceMs: 10, // giữ 10ms như cũ cho Order
});

// Report state
const report = new Report();

// Report persistence
const reportRepo = new ReportStorageRepository(REPORT_STORAGE_KEY, 1);
const reportPersistence = new StatePersistence({
  repository: reportRepo,
  onStatusChange: () => {},
  debounceMs: 250,
});

// ---------- Views ----------
const summaryView = new SummaryView({
  totalWater: byId('total-water'),
  totalFried: byId('total-fried'),
  totalServings: byId('total-servings'),
  emptyHint: byId('empty-hint'),
});

const orderTableView = new OrderTableView({
  tbodyEl: byId('items-body'),
  menu: MENU,
  callbacks: {
    onQuantityChange: (id, value) => order.setServings(id, value),
    onIncrement: (id) => order.adjustServings(id, 1),
    onDecrement: (id) => order.adjustServings(id, -1),
    getServings: (id) => order.getServings(id),
  },
});

const addItemForm = new AddItemForm({
  selectEl: byId('item-select'),
  qtyEl: byId('add-qty'),
  btnEl: byId('add-item-btn'),
  menu: MENU,
  onAdd: (id, qty) => order.setServings(id, qty),
  showToast: (msg) => toast.show(msg),
});

// Confirm dialog (dùng chung cho reset Order và reset Report)
const confirmDialog = new ConfirmDialog({
  dialogEl: byId('confirm-dialog'),
  messageEl: byId('dialog-desc'),
  onConfirm: () => {
    order.reset();
    toast.show('Đã reset tất cả');
  },
});

// ---------- Scan: API key sống duy nhất ở đây (RAM) ----------
let apiKey = '';

function createScanService() {
  const provider = createProvider('openrouter', {
    endpoint: AI_CONFIG.endpoint,
    apiKey,
    models: AI_CONFIG.models,
    timeoutMs: AI_CONFIG.timeoutMs,
  });
  return new ScanService({
    provider,
    task: OrderScanTask,
    menu: MENU,
    categories: CATEGORIES,
    retryOptions: { maxRetry: AI_CONFIG.maxRetry, baseDelay: AI_CONFIG.retryDelayMs },
  });
}

const scanDialog = new ScanDialog({
  dialogEl: byId('scan-dialog'),
  previewEl: byId('scan-preview'),
  imgEl: byId('scan-img'),
  statusEl: byId('scan-status'),
  formEl: byId('scan-form'),
  rowsEl: byId('scan-rows'),
  unmatchedEl: byId('scan-unmatched'),
  mergeWrapEl: byId('scan-merge-wrap'),
  mergeEl: byId('scan-merge'),
  cancelBtn: byId('scan-cancel'),
  retryBtn: byId('scan-retry'),
  confirmBtn: byId('scan-confirm'),
  changeKeyBtn: byId('scan-change-key'),
  menu: MENU,
  showToast: (msg) => toast.show(msg),
  onRetry: () => scanController.retry(),
  onCancel: () => scanController.close(),
  onChangeKey: () => scanController.changeKey(),
  onConfirm: (data) => scanController.handleConfirm(data),
});

const scanController = new ScanController({
  getApiKey: () => apiKey,
  setApiKey: (key) => { apiKey = key; },
  askApiKey: () => apiKeyDialog.show(),
  scanDialog,
  toast,
  order,
  createScanService,
});

const apiKeyDialog = new ApiKeyDialog({
  dialogEl: byId('key-dialog'),
  inputEl: byId('key-input'),
  onSubmit: (key) => {
    if (!key) {
      toast.show('Chưa nhập key');
      return;
    }
    apiKey = key;
    scanController.resumeAfterKey();
  },
  onCancel: () => scanController.cancelPending(),
});

// Report view
function getReportText() {
  return formatReport({
    report: report.snapshot(),
    orderServings: order.toJSON(),
    menu: MENU,
    reportGroups: REPORT_GROUPS,
    channels: PAYMENT_CHANNELS,
    metrics: METRICS,
    format: REPORT_FORMAT,
  });
}

const reportView = new ReportView({
  root: byId('report-panel'),
  reportStore: report,
  showToast: (msg) => toast.show(msg),
  onResetReport: () => {
    confirmDialog.show('Đặt lại báo cáo về mặc định? Số liệu Order không bị ảnh hưởng.', () => {
      report.reset();
      reportPersistence.save(report.snapshot());
      toast.show('Đã đặt lại báo cáo');
    });
  },
  getReportText,
  onBeforeCopy: (proceed) => {
    confirmDialog.show(
      'Miễn trừ trách nhiệm: Tự check lại nhé sai tự chịu:))',
      proceed
    );
  },
});

// ---------- Tabs ----------
const tabs = new Tabs({
  container: byId('tabs-container'),
  tabs: [
    { id: 'dem-mon', label: 'Đếm món', panelId: 'tab-dem-mon' },
    { id: 'bao-cao', label: 'Báo cáo', panelId: 'tab-bao-cao' },
  ],
  onChange: (tabId) => {
    if (tabId === 'bao-cao') reportView.updatePreview();
  },
});

// ---------- Header actions ----------
byId('reset-btn').addEventListener('click', () => {
  if (order.isEmpty()) {
    toast.show('Đơn hàng đang trống');
    return;
  }
  const totalQty = Object.values(order.toJSON()).reduce((sum, v) => sum + v, 0);
  confirmDialog.show(`Đang có ${totalQty.toLocaleString('vi-VN')} phần. Toàn bộ số phần sẽ được đặt về 0 và không thể hoàn tác.`);
});

byId('scan-btn').addEventListener('click', () => byId('scan-input').click());

byId('scan-input').addEventListener('change', (e) => {
  const input = e.target;
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  if (!/^image\//.test(file.type)) {
    toast.show('Vui lòng chọn một tệp ảnh');
    return;
  }
  scanController.start(file);
});

// ResizeObserver cho summary height (chỉ trên tab Đếm món)
if ('ResizeObserver' in window) {
  const summary = byId('summary');
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--summary-h', summary.offsetHeight + 'px');
  }).observe(summary);
}

// ---------- State -> UI + auto save ----------
let applyingRemoteOrder = false;
let applyingRemoteReport = false;

function renderAll() {
  orderTableView.renderAll(order.servings);
  summaryView.render(order.getTotals(), order.isEmpty());
}

function onOrderChange(changedId) {
  if (changedId) orderTableView.renderById(changedId, order.getServings(changedId));
  else orderTableView.renderAll(order.servings);

  summaryView.render(order.getTotals(), order.isEmpty());
  reportView.updatePreview();
  if (!applyingRemoteOrder) {
    orderPersistence.save({ version: 1, servings: order.toJSON() });
  }
}

// ---------- Bootstrap ----------
async function bootstrap() {
  // Build UI
  orderTableView.build();
  addItemForm.populate();

  // Load Order
  const orderData = await orderPersistence.load();
  order.replaceAll(orderData?.servings ?? {});
  renderAll();
  order.subscribe(onOrderChange);

  // Load Report
  const reportData = await reportPersistence.load();
  report.restore(reportData);
  // Report persistence save on change
  report.subscribe((snapshot) => {
    if (!applyingRemoteReport) reportPersistence.save(snapshot);
  });

  // Cross-tab sync for Order
  onStorageChange(STORAGE_KEY, async () => {
    const remote = await orderPersistence.load();
    applyingRemoteOrder = true;
    try {
      order.replaceAll(remote?.servings ?? {});
    } finally {
      applyingRemoteOrder = false;
    }
  });

  // Cross-tab sync for Report
  onStorageChange(REPORT_STORAGE_KEY, async () => {
    const remote = await reportPersistence.load();
    applyingRemoteReport = true;
    try {
      report.restore(remote);
    } finally {
      applyingRemoteReport = false;
    }
  });
}

bootstrap();