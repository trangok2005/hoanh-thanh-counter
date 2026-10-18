/* =========================================================
   Hoành Thánh Counter — script.js
   Vanilla JavaScript, không phụ thuộc thư viện.
   Để thêm món mới: thêm một object vào mảng ITEMS bên dưới.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Cấu hình ---------- */
  var STORAGE_KEY = 'hoanh-thanh-counter:v1';
  var MAX_SERVINGS = 9999;

  /* ---------- Dữ liệu món ăn cố định ---------- */
  var ITEMS = [
    { id: 'hoanh-thanh-ly-nuoc-cay',        name: 'Hoành thánh ly nước',  variant: 'Cay',       waterPerServing: 5, friedPerServing: 0, servings: 0 },
    { id: 'hoanh-thanh-ly-nuoc-khong-cay',  name: 'Hoành thánh ly nước',  variant: 'Không cay', waterPerServing: 5, friedPerServing: 0, servings: 0 },
    { id: 'hoanh-thanh-ky-phung-cay',       name: 'Hoành thánh Kỳ Phùng', variant: 'Cay',       waterPerServing: 2, friedPerServing: 3, servings: 0 },
    { id: 'hoanh-thanh-ky-phung-khong-cay', name: 'Hoành thánh Kỳ Phùng', variant: 'Không cay', waterPerServing: 2, friedPerServing: 3, servings: 0 },
    { id: 'hoanh-thanh-chien',              name: 'Hoành thánh chiên',    variant: null,        waterPerServing: 0, friedPerServing: 5, servings: 0 },
    { id: 'my-ly-hoanh-thanh',              name: 'Mỳ ly hoành thánh',    variant: null,        waterPerServing: 3, friedPerServing: 0, servings: 0 },
    { id: 'bun-bo-cay',                     name: 'Bún bò',               variant: 'Cay',       waterPerServing: 1, friedPerServing: 0, servings: 0 },
    { id: 'bun-bo-khong-cay',               name: 'Bún bò',               variant: 'Không cay', waterPerServing: 1, friedPerServing: 0, servings: 0 }
  ];

  var numberFormat = new Intl.NumberFormat('vi-VN');
  var itemMap = new Map();   // id -> item
  var rowMap = new Map();    // id -> { tr, input, minus, plus, waterTotal, friedTotal }
  var dom = {};
  var saveTimer = null;
  var toastTimer = null;
  var storageWorks = true;

  ITEMS.forEach(function (item) { itemMap.set(item.id, item); });

  /* ---------- Tiện ích ---------- */
  function formatNumber(n) {
    return numberFormat.format(n);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svgIcon(pathData) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', pathData);
    svg.appendChild(path);
    return svg;
  }

  function itemLabel(item) {
    return item.variant ? item.name + ' ' + item.variant.toLowerCase() : item.name;
  }

  /* Chuẩn hóa mọi giá trị đầu vào thành số nguyên không âm (0..MAX_SERVINGS). */
  function sanitizeQuantity(value) {
    var n;
    if (typeof value === 'number') {
      n = Math.floor(value);
    } else {
      var digits = String(value == null ? '' : value).replace(/\D/g, '');
      n = digits === '' ? 0 : parseInt(digits, 10);
    }
    if (!isFinite(n) || n < 0) return 0;
    return n > MAX_SERVINGS ? MAX_SERVINGS : n;
  }

  /* ---------- Phép tính (luôn tính lại từ dữ liệu gốc) ---------- */
  function calculateItem(item) {
    return {
      water: item.servings * item.waterPerServing,
      fried: item.servings * item.friedPerServing
    };
  }

  function calculateTotals() {
    var water = 0;
    var fried = 0;
    var servings = 0;
    ITEMS.forEach(function (item) {
      var r = calculateItem(item);
      water += r.water;
      fried += r.fried;
      servings += item.servings;
    });
    return { water: water, fried: fried, all: water + fried, servings: servings };
  }

  /* ---------- Hiển thị ---------- */
  function setStat(node, value) {
    var text = formatNumber(value);
    if (node.textContent === text) return;
    node.textContent = text;
    node.classList.toggle('is-long', text.length >= 7);
    node.classList.remove('bump');
    void node.offsetWidth; // khởi động lại animation
    node.classList.add('bump');
  }

  function renderSummary(totals) {
    setStat(dom.totalWater, totals.water);
    setStat(dom.totalFried, totals.fried);
    dom.totalServings.textContent = formatNumber(totals.servings) + ' phần';
    dom.emptyHint.hidden = totals.servings > 0;
  }

  function renderRow(item, options) {
    var ref = rowMap.get(item.id);
    if (!ref) return;
    var r = calculateItem(item);

    // Không ghi đè ô đang được người dùng gõ, để giữ con trỏ và thao tác tự nhiên
    if (!(options && options.keepInput)) {
      ref.input.value = String(item.servings);
    }

    ref.waterTotal.textContent = formatNumber(r.water);
    ref.waterTotal.classList.toggle('is-zero', r.water === 0);
    ref.friedTotal.textContent = formatNumber(r.fried);
    ref.friedTotal.classList.toggle('is-zero', r.fried === 0);

    ref.tr.classList.toggle('is-active', item.servings > 0);
    ref.minus.setAttribute('aria-disabled', item.servings <= 0 ? 'true' : 'false');
    ref.plus.setAttribute('aria-disabled', item.servings >= MAX_SERVINGS ? 'true' : 'false');
  }

  function renderItems() {
    ITEMS.forEach(function (item) { renderRow(item); });
  }

  function refresh() {
    renderSummary(calculateTotals());
  }

  /* Dựng danh sách một lần duy nhất; sau đó chỉ cập nhật tại chỗ. */
  function buildRows() {
    var frag = document.createDocumentFragment();

    ITEMS.forEach(function (item, index) {
      var label = itemLabel(item);
      var tr = el('tr', 'item-row');
      tr.dataset.id = item.id;

      // STT (ẩn trên mobile)
      tr.appendChild(el('td', 'c-index', String(index + 1)));

      // Tên món
      var tdName = el('th', 'c-name');
      tdName.scope = 'row';
      tdName.appendChild(el('span', 'item-name', item.name));
      tr.appendChild(tdName);

      // Phân loại: món không phân loại thì không hiển thị tag
      var tdVariant = el('td', 'c-variant');
      if (item.variant) {
        var isSpicy = item.variant === 'Cay';
        tdVariant.appendChild(el('span', 'tag ' + (isSpicy ? 'tag--spicy' : 'tag--mild'), item.variant));
      } else {
        var dash = el('span', 'dash', '—');
        dash.setAttribute('aria-label', 'Không áp dụng');
        tdVariant.appendChild(dash);
      }
      tr.appendChild(tdVariant);

      // Định lượng cố định
      var tdWR = el('td', 'c-water-rate');
      tdWR.appendChild(el('span', 'm-only', 'Nước: '));
      tdWR.appendChild(document.createTextNode(String(item.waterPerServing)));
      tdWR.appendChild(el('span', 'm-only', ' viên/phần'));
      tr.appendChild(tdWR);

      var tdFR = el('td', 'c-fried-rate');
      tdFR.appendChild(el('span', 'm-only', 'Chiên: '));
      tdFR.appendChild(document.createTextNode(String(item.friedPerServing)));
      tdFR.appendChild(el('span', 'm-only', ' viên/phần'));
      tr.appendChild(tdFR);

      // Bộ đếm
      var tdQty = el('td', 'c-qty');
      var counter = el('div', 'counter');

      var minus = el('button', 'counter-btn');
      minus.type = 'button';
      minus.dataset.action = 'dec';
      minus.setAttribute('aria-label', 'Giảm một phần ' + label);
      minus.appendChild(svgIcon('M5 12h14'));

      var input = el('input', 'counter-input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.pattern = '[0-9]*';
      input.autocomplete = 'off';
      input.maxLength = String(MAX_SERVINGS).length;
      input.value = '0';
      input.dataset.role = 'qty';
      input.setAttribute('aria-label', 'Số phần ' + label);

      var plus = el('button', 'counter-btn');
      plus.type = 'button';
      plus.dataset.action = 'inc';
      plus.setAttribute('aria-label', 'Tăng một phần ' + label);
      plus.appendChild(svgIcon('M12 5v14M5 12h14'));

      counter.appendChild(minus);
      counter.appendChild(input);
      counter.appendChild(plus);
      tdQty.appendChild(counter);
      tr.appendChild(tdQty);

      // Kết quả riêng của món
      var tdWT = el('td', 'c-water-total');
      tdWT.appendChild(el('span', 'm-label', 'Nước'));
      var waterTotal = el('span', 'result-val is-zero', '0');
      tdWT.appendChild(waterTotal);
      tr.appendChild(tdWT);

      var tdFT = el('td', 'c-fried-total');
      tdFT.appendChild(el('span', 'm-label', 'Chiên'));
      var friedTotal = el('span', 'result-val is-zero', '0');
      tdFT.appendChild(friedTotal);
      tr.appendChild(tdFT);

      rowMap.set(item.id, {
        tr: tr, input: input, minus: minus, plus: plus,
        waterTotal: waterTotal, friedTotal: friedTotal
      });
      frag.appendChild(tr);
    });

    dom.body.appendChild(frag);
  }

  /* ---------- Cập nhật số phần ---------- */
  function updateQuantity(id, value, options) {
    var item = itemMap.get(id);
    if (!item) return;
    var next = sanitizeQuantity(value);
    if (next === item.servings && !(options && options.force)) {
      renderRow(item, options);
      return;
    }
    item.servings = next;
    renderRow(item, options);
    refresh();
    scheduleSave();
  }

  /* ---------- Lưu trạng thái (localStorage) ---------- */
  function setSaveStatus(state) {
    var node = dom.saveStatus;
    node.classList.remove('is-saved', 'is-error');
    if (state === 'saving') {
      node.textContent = 'Đang lưu…';
    } else if (state === 'saved') {
      node.textContent = 'Đã lưu';
      node.classList.add('is-saved');
    } else if (state === 'error') {
      node.textContent = 'Không lưu được trên trình duyệt này';
      node.classList.add('is-error');
    } else {
      node.textContent = 'Tự động lưu';
    }
  }

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    var servings = {};
    ITEMS.forEach(function (item) { servings[item.id] = item.servings; });
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, servings: servings }));
      storageWorks = true;
      setSaveStatus('saved');
    } catch (err) {
      storageWorks = false;
      setSaveStatus('error');
    }
  }

  function scheduleSave() {
    if (!storageWorks) { setSaveStatus('error'); return; }
    setSaveStatus('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 250);
  }

  function loadState() {
    var raw = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      storageWorks = false;
      setSaveStatus('error');
      return;
    }
    if (!raw) return;

    try {
      var data = JSON.parse(raw);
      var saved = data && typeof data === 'object' ? data.servings : null;
      if (!saved || typeof saved !== 'object') return;

      ITEMS.forEach(function (item) {
        if (!Object.prototype.hasOwnProperty.call(saved, item.id)) return;
        var v = saved[item.id];
        // Chỉ nhận số nguyên không âm hợp lệ
        if (typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= 0 && v <= MAX_SERVINGS) {
          item.servings = v;
        }
      });
      setSaveStatus('saved');
    } catch (err) {
      // Dữ liệu hỏng: bỏ qua và dùng giá trị mặc định
    }
  }

  /* ---------- Toast ---------- */
  function showToast(message) {
    clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.hidden = false;
    // chạy lại animation
    dom.toast.style.animation = 'none';
    void dom.toast.offsetWidth;
    dom.toast.style.animation = '';
    toastTimer = setTimeout(function () { dom.toast.hidden = true; }, 2200);
  }

  /* ---------- Reset ---------- */
  function resetAll() {
    ITEMS.forEach(function (item) { item.servings = 0; });
    renderItems();
    refresh();
    saveNow();
    showToast('Đã bắt đầu đơn hàng mới');
  }

  function requestReset() {
    var totals = calculateTotals();
    if (totals.servings === 0) {
      showToast('Đơn hàng đang trống');
      return;
    }
    var dlg = dom.dialog;
    if (dlg && typeof dlg.showModal === 'function') {
      dom.dialogDesc.textContent =
        'Đang có ' + formatNumber(totals.servings) + ' phần. Toàn bộ số phần sẽ được đặt về 0 và không thể hoàn tác.';
      dlg.returnValue = '';
      dlg.showModal();
    } else if (window.confirm('Đặt toàn bộ số phần về 0?')) {
      resetAll();
    }
  }

  /* ---------- Sao chép kết quả ---------- */
  function buildSummaryText() {
    var totals = calculateTotals();
    var lines = ['HOÀNH THÁNH COUNTER'];
    ITEMS.forEach(function (item) {
      if (item.servings > 0) {
        lines.push('- ' + item.name + (item.variant ? ' (' + item.variant + ')' : '') + ': ' + formatNumber(item.servings) + ' phần');
      }
    });
    lines.push('-----');
    lines.push('Tổng viên nước: ' + formatNumber(totals.water));
    lines.push('Tổng viên chiên: ' + formatNumber(totals.fried));
    return lines.join('\n');
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copyResults() {
    if (calculateTotals().servings === 0) {
      showToast('Chưa có số phần nào để sao chép');
      return;
    }
    var text = buildSummaryText();
    var done = function (ok) {
      showToast(ok ? 'Đã sao chép kết quả' : 'Không sao chép được, hãy thử lại');
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        function () { done(true); },
        function () { done(fallbackCopy(text)); }
      );
    } else {
      done(fallbackCopy(text));
    }
  }

  /* ---------- Sự kiện (event delegation trên tbody) ---------- */
  function rowIdFrom(node) {
    var tr = node.closest ? node.closest('tr[data-id]') : null;
    return tr ? tr.dataset.id : null;
  }

  function bindEvents() {
    var body = dom.body;

    body.addEventListener('click', function (e) {
      var btn = e.target.closest('.counter-btn');
      if (!btn) return;
      var id = rowIdFrom(btn);
      var item = itemMap.get(id);
      if (!item) return;
      if (btn.dataset.action === 'inc') updateQuantity(id, item.servings + 1);
      else if (btn.dataset.action === 'dec') updateQuantity(id, item.servings - 1);
    });

    // Chặn ký tự không phải số ngay khi gõ
    body.addEventListener('beforeinput', function (e) {
      if (!e.target.matches('.counter-input')) return;
      if (e.data && /\D/.test(e.data)) e.preventDefault();
    });

    body.addEventListener('input', function (e) {
      var input = e.target;
      if (!input.matches || !input.matches('.counter-input')) return;
      var digits = input.value.replace(/\D/g, '').slice(0, String(MAX_SERVINGS).length);
      if (digits !== input.value) input.value = digits;
      // Ô trống khi đang sửa được tính là 0 nhưng không bị ghi đè lại
      updateQuantity(rowIdFrom(input), digits === '' ? 0 : parseInt(digits, 10), { keepInput: true });
    });

    // Dán: chỉ lấy phần số nguyên đầu tiên (bỏ phần thập phân, chữ)
    body.addEventListener('paste', function (e) {
      var input = e.target;
      if (!input.matches || !input.matches('.counter-input')) return;
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text') || '';
      var m = text.match(/\d+/);
      var value = m ? sanitizeQuantity(m[0]) : 0;
      input.value = String(value);
      updateQuantity(rowIdFrom(input), value, { keepInput: true });
    });

    body.addEventListener('focusin', function (e) {
      var input = e.target;
      if (input.matches && input.matches('.counter-input')) {
        setTimeout(function () {
          if (document.activeElement === input) input.select();
        }, 0);
      }
    });

    // Rời ô nhập: chuẩn hóa hiển thị (ô trống -> 0, bỏ số 0 đứng đầu)
    body.addEventListener('focusout', function (e) {
      var input = e.target;
      if (!input.matches || !input.matches('.counter-input')) return;
      var item = itemMap.get(rowIdFrom(input));
      if (item) input.value = String(item.servings);
    });

    body.addEventListener('keydown', function (e) {
      var input = e.target;
      if (!input.matches || !input.matches('.counter-input')) return;
      var id = rowIdFrom(input);
      var item = itemMap.get(id);
      if (!item) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        updateQuantity(id, item.servings + 1);
        input.select();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        updateQuantity(id, item.servings - 1);
        input.select();
      } else if (e.key === 'Enter') {
        input.blur();
      }
    });

    dom.resetBtn.addEventListener('click', requestReset);
    dom.newOrderBtn.addEventListener('click', requestReset);
    dom.copyBtn.addEventListener('click', copyResults);

    dom.dialog.addEventListener('close', function () {
      if (dom.dialog.returnValue === 'confirm') resetAll();
    });
    // Bấm ra ngoài hộp thoại để đóng
    dom.dialog.addEventListener('click', function (e) {
      if (e.target !== dom.dialog) return;
      var r = dom.dialog.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dom.dialog.close('cancel');
    });

    // Cập nhật chiều cao thanh tổng quan để scroll-padding không để input bị che
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        document.documentElement.style.setProperty('--summary-h', dom.summary.offsetHeight + 'px');
      }).observe(dom.summary);
    }

    // Đồng bộ nếu mở nhiều tab cùng lúc
    window.addEventListener('storage', function (e) {
      if (e.key !== STORAGE_KEY) return;
      ITEMS.forEach(function (item) { item.servings = 0; });
      loadState();
      renderItems();
      refresh();
    });
  }

  /* ---------- Khởi động ---------- */
  function init() {
    dom.body = document.getElementById('items-body');
    dom.summary = document.getElementById('summary');
    dom.totalWater = document.getElementById('total-water');
    dom.totalFried = document.getElementById('total-fried');
    dom.totalServings = document.getElementById('total-servings');
    dom.emptyHint = document.getElementById('empty-hint');
    dom.saveStatus = document.getElementById('save-status');
    dom.resetBtn = document.getElementById('reset-btn');
    dom.newOrderBtn = document.getElementById('new-order-btn');
    dom.copyBtn = document.getElementById('copy-btn');
    dom.dialog = document.getElementById('confirm-dialog');
    dom.dialogDesc = document.getElementById('dialog-desc');
    dom.toast = document.getElementById('toast');

    buildRows();
    loadState();
    renderItems();
    refresh();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
