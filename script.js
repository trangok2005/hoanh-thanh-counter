(function () {
  'use strict';

  /* ---------- Cấu hình ---------- */
  const AI_CONFIG = {
    MODEL: 'nvidia/nemotron-3.5-super-vl:free',
    ENDPOINT: 'https://openrouter.ai/api/v1/chat/completions',
    TIMEOUT: 60000,
    MAX_RETRY: 3
  };

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
  var itemMap = new Map();
  var rowMap = new Map();
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
    svg.setAttribute('stroke-linejoin', 'round');
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
    void node.offsetWidth;
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

  function populateItemSelect() {
    var select = dom.itemSelect;
    if (!select) return;
    select.innerHTML = '<option value="">-- Chọn món --</option>';
    ITEMS.forEach(function (item) {
      var option = el('option', null, itemLabel(item));
      option.value = item.id;
      select.appendChild(option);
    });
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

      tr.appendChild(el('td', 'c-index', String(index + 1)));

      var tdName = el('th', 'c-name');
      tdName.scope = 'row';
      tdName.appendChild(el('span', 'item-name', item.name));
      tr.appendChild(tdName);

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
        if (typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= 0 && v <= MAX_SERVINGS) {
          item.servings = v;
        }
      });
      setSaveStatus('saved');
    } catch (err) {
    }
  }

  /* ---------- Toast ---------- */
  function showToast(message) {
    clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.hidden = false;
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
    showToast('Đã reset tất cả');
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

  /* ---------- Quét ảnh bằng Vision AI ---------- */
  var MAX_IMAGE_SIDE = 1600;
  var apiKey = '';
  var pendingFile = null;
  var scanAbort = null;
  var scanToken = 0;

  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(w, h));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ dataUrl: dataUrl, base64: dataUrl.split(',')[1] });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Không đọc được ảnh này. Hãy thử ảnh khác (JPG/PNG).'));
      };
      img.src = url;
    });
  }

  /* Tên gọi thực tế trên máy POS / phiếu -> id món (giúp AI ghép đúng) */
  var ALIASES = {
    'hoanh-thanh-ly-nuoc-cay':        ['Hoành Thánh Ly Nước Cay'],
    'hoanh-thanh-ly-nuoc-khong-cay':  ['Hoành Thánh Ly Nước Không Cay'],
    'hoanh-thanh-ky-phung-cay':       ['Hoành Thánh Kỳ Phùng Ly Cay'],
    'hoanh-thanh-ky-phung-khong-cay': ['Hoành Thánh Kỳ Phùng Ly Không Cay'],
    'hoanh-thanh-chien':              ['Hoành Thánh Ly Chiên', 'Hoành Thánh Chiên'],
    'my-ly-hoanh-thanh':              ['Mì tươi hoành thánh ly', 'Mỳ ly hoành thánh'],
    'bun-bo-cay':                     ['Bún Bò Ly Sate Cay'],
    'bun-bo-khong-cay':               ['Bún Bò Ly Sate Không Cay']
  };

  var SCAN_USER_TEXT = 'Đọc ảnh và trả về JSON theo đúng schema.';

  function buildPrompt() {
    var menu = ITEMS.map(function (it) {
      var names = (ALIASES[it.id] || [itemLabel(it)]).map(function (n) { return '"' + n + '"'; }).join(' / ');
      return '- id "' + it.id + '" ← ' + names;
    }).join('\n');
    return [
      'Bạn là bộ đọc số liệu cho quán hoành thánh. Ảnh thường là ảnh chụp màn hình máy POS (báo cáo chốt ca / báo cáo bán hàng) hoặc phiếu đơn hàng; ảnh có thể bị nghiêng, lóa, mờ ở các dòng cuối.',
      '',
      'NHIỆM VỤ: chỉ trích số lượng của 8 món thuộc danh sách dưới đây. Bỏ qua mọi món khác.',
      '',
      'DANH SÁCH MÓN CẦN LẤY (id ← tên hiển thị trên máy):',
      menu,
      '',
      'CÁCH ĐỌC BẢNG:',
      '- Bảng thường có 3 cột: "Món ăn", "Số lượng", "Doanh thu". Chỉ lấy cột SỐ LƯỢNG (số nguyên nhỏ). Tuyệt đối không lấy cột Doanh thu (số có dấu phẩy và ký hiệu đ), giá tiền, giờ, số bàn.',
      '- Ảnh bị nghiêng nên số lượng có thể lệch hàng so với tên món; hãy ghép theo đúng thứ tự hàng từ trên xuống, mỗi tên món đi với đúng một số lượng.',
      '- Doanh thu chỉ để đối chiếu khi số lượng khó đọc: cùng một nhóm món có đơn giá gần nhau, nên doanh thu ÷ số lượng phải hợp lý.',
      '',
      'QUY TẮC GHÉP MÓN:',
      '- Chỉ ghép khi tên khớp rõ với một món trong danh sách. Phân biệt chính xác "Cay" và "Không Cay" theo đúng chữ trên màn hình; "Không Cay" luôn là món không cay.',
      '- "Hoành Thánh Ly Nước" (ly nước) khác "Hoành Thánh Ly Chiên" (chiên) và khác "Hoành Thánh Kỳ Phùng Ly".',
      '- "Mì tươi hoành thánh ly" = my-ly-hoanh-thanh. "Bún Bò Ly Sate" = bún bò.',
      '- Các món khác như Xí Quách, Snack hoành thánh bơ đậu phộng, sữa, nước ngọt, nước sâm, trà, Mirinda, 7up... KHÔNG thuộc danh sách: bỏ qua hoàn toàn, không đưa vào "items" và cũng không đưa vào "unmatched". Món có chữ "hoành thánh" nhưng không có trong danh sách (ví dụ Snack) cũng bỏ qua.',
      '- Nếu một món trong danh sách không xuất hiện trong ảnh thì không đưa vào "items" (đừng điền 0, đừng đoán).',
      '- Mỗi món chỉ xuất hiện một lần; nếu có nhiều dòng cùng món thì cộng số lượng lại.',
      '',
      'KẾT QUẢ:',
      '- "items": mảng {id, servings} với servings là số lượng đọc được.',
      '- "unmatched": CHỈ dùng khi có dòng thuộc nhóm hoành thánh / mì / bún bò mà bạn không chắc là món nào, hoặc không đọc rõ số lượng (ghi tên dòng đó kèm lý do ngắn). Nếu mọi thứ rõ ràng thì để mảng rỗng.',
      '- Nếu ảnh không phải đơn hàng/báo cáo bán hàng hoặc không có món nào trong danh sách, trả "items" rỗng.'
    ].join('\n');
  }

  function visionScan(base64, signal) {
    var ids = ITEMS.map(function (it) { return it.id; });
    var prompt = buildPrompt();
    var body = {
      model: AI_CONFIG.MODEL,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: [
          { type: 'text', text: SCAN_USER_TEXT },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + base64 } }
        ]}
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    };
    return fetch(AI_CONFIG.ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify(body),
      signal: signal
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var msg = (data && data.error && data.error.message) || '';
          var err = new Error(msg || ('Lỗi ' + res.status));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    }).then(function (data) {
      var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) throw new Error('AI không trả về kết quả. Hãy thử lại hoặc chụp rõ hơn.');
      var parsed;
      try { parsed = JSON.parse(content); } catch (e) { throw new Error('Kết quả trả về không đọc được. Hãy thử lại.'); }
      return parsed;
    });
  }

  function describeError(err) {
    if (err && err.name === 'AbortError') return null;
    var st = err && err.status;
    if (st === 401) return { text: 'API Key không hợp lệ.', badKey: true };
    if (st === 403) return { text: 'API Key không có quyền truy cập.', badKey: true };
    if (st === 429) return { text: 'Đã vượt giới hạn miễn phí. Chờ một chút rồi thử lại.' };
    if (st >= 500) return { text: 'Máy chủ OpenRouter đang bận. Hãy thử lại sau ít giây.' };
    if (err instanceof TypeError) return { text: 'Không kết nối được Internet. Kiểm tra mạng rồi thử lại.' };
    return { text: (err && err.message) || 'Có lỗi khi quét ảnh.' };
  }

  function scanSetState(state, message) {
    dom.scanStatus.textContent = message || '';
    dom.scanStatus.classList.toggle('is-error', state === 'error');
    dom.scanStatus.classList.toggle('is-loading', state === 'loading');
    dom.scanStatus.hidden = !message;
    dom.scanForm.hidden = state !== 'review';
    dom.scanConfirm.hidden = state !== 'review';
    dom.scanRetry.hidden = state !== 'error';
  }

  function makeScanRow(id, qty) {
    var row = el('div', 'scan-row');
    var select = el('select', 'scan-select');
    select.setAttribute('aria-label', 'Món');
    ITEMS.forEach(function (it) {
      var o = el('option', null, itemLabel(it));
      o.value = it.id;
      select.appendChild(o);
    });
    select.value = id;

    var input = el('input', 'scan-qty');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.maxLength = String(MAX_SERVINGS).length;
    input.value = String(qty);
    input.setAttribute('aria-label', 'Số phần');
    input.addEventListener('input', function () {
      var d = input.value.replace(/\D/g, '').slice(0, String(MAX_SERVINGS).length);
      if (d !== input.value) input.value = d;
    });
    input.addEventListener('focus', function () { setTimeout(function () { input.select(); }, 0); });

    var unit = el('span', 'scan-unit', 'phần');

    var del = el('button', 'scan-del');
    del.type = 'button';
    del.setAttribute('aria-label', 'Xóa dòng này');
    del.appendChild(svgIcon('M6 6l12 12M18 6L6 18'));
    del.addEventListener('click', function () {
      row.remove();
      updateScanConfirmState();
    });

    row.appendChild(select);
    row.appendChild(input);
    row.appendChild(unit);
    row.appendChild(del);
    return row;
  }

  function updateScanConfirmState() {
    var hasRows = dom.scanRows.children.length > 0;
    dom.scanConfirm.disabled = !hasRows;
    if (!hasRows) {
      dom.scanStatus.hidden = false;
      dom.scanStatus.classList.remove('is-error', 'is-loading');
      dom.scanStatus.textContent = 'Không còn món nào để tính.';
    } else {
      dom.scanStatus.hidden = true;
    }
  }

  function showScanResult(result) {
    var totals = {};
    (result.items || []).forEach(function (r) {
      if (!r || !itemMap.has(r.id)) return;
      var q = sanitizeQuantity(r.servings);
      if (q > 0) totals[r.id] = Math.min(MAX_SERVINGS, (totals[r.id] || 0) + q);
    });

    dom.scanRows.innerHTML = '';
    ITEMS.forEach(function (it) {
      if (totals[it.id]) dom.scanRows.appendChild(makeScanRow(it.id, totals[it.id]));
    });

    var unmatched = (result.unmatched || []).filter(function (t) { return typeof t === 'string' && t.trim(); });
    dom.scanUnmatched.hidden = unmatched.length === 0;
    dom.scanUnmatched.textContent = unmatched.length ? 'Chưa nhận diện được: ' + unmatched.join('; ') : '';

    dom.scanMergeWrap.hidden = calculateTotals().servings === 0;

    if (!dom.scanRows.children.length) {
      scanSetState('error', 'Không tìm thấy món nào trong ảnh. Hãy chụp rõ hơn hoặc nhập tay.');
      return;
    }
    scanSetState('review', '');
    dom.scanConfirm.disabled = false;
  }

  function runScan(file) {
    var token = ++scanToken;
    if (scanAbort) scanAbort.abort();
    scanAbort = new AbortController();
    var signal = scanAbort.signal;

    dom.scanPreview.hidden = true;
    scanSetState('loading', 'Đang quét ảnh…');
    if (!dom.scanDialog.open) dom.scanDialog.showModal();

    var timer = setTimeout(function () { scanAbort && scanAbort.abort(); }, AI_CONFIG.TIMEOUT);

    resizeImage(file).then(function (img) {
      if (token !== scanToken) return null;
      dom.scanImg.src = img.dataUrl;
      dom.scanPreview.hidden = false;
      return visionScanWithRetry(img.base64, signal);
    }).then(function (result) {
      clearTimeout(timer);
      if (token !== scanToken || !result) return;
      showScanResult(result);
    }).catch(function (err) {
      clearTimeout(timer);
      if (token !== scanToken) return;
      var info = describeError(err) || { text: 'Quét quá lâu nên đã dừng. Hãy thử lại.' };
      if (info.badKey) apiKey = '';
      scanSetState('error', info.text);
    });
  }

  function visionScanWithRetry(base64, signal, attempt) {
    attempt = attempt || 1;
    return visionScan(base64, signal).catch(function (err) {
      if (attempt >= AI_CONFIG.MAX_RETRY) throw err;
      var delay = attempt === 1 ? 1000 : 2000;
      return new Promise(function (resolve) { setTimeout(resolve, delay); })
        .then(function () { return visionScanWithRetry(base64, signal, attempt + 1); });
    });
  }

  function askApiKey() {
    dom.keyInput.value = '';
    dom.keyDialog.returnValue = '';
    dom.keyDialog.showModal();
    setTimeout(function () { dom.keyInput.focus(); }, 0);
  }

  function startScanWith(file) {
    pendingFile = file;
    if (!apiKey) { askApiKey(); return; }
    runScan(file);
  }

  function closeScan() {
    scanToken++;
    if (scanAbort) { scanAbort.abort(); scanAbort = null; }
    if (dom.scanDialog.open) dom.scanDialog.close();
    dom.scanRows.innerHTML = '';
    dom.scanImg.removeAttribute('src');
    pendingFile = null;
  }

  function confirmScan() {
    var rows = dom.scanRows.querySelectorAll('.scan-row');
    var add = {};
    rows.forEach(function (row) {
      var id = row.querySelector('select').value;
      var q = sanitizeQuantity(row.querySelector('input').value);
      if (itemMap.has(id) && q > 0) add[id] = (add[id] || 0) + q;
    });
    var ids = Object.keys(add);
    if (!ids.length) {
      showToast('Chưa có số phần nào để tính');
      return;
    }
    var merge = dom.scanMergeWrap.hidden ? true : dom.scanMerge.checked;
    ITEMS.forEach(function (item) {
      var base = merge ? item.servings : 0;
      var next = base + (add[item.id] || 0);
      if (next !== item.servings) updateQuantity(item.id, next);
    });
    var total = ids.reduce(function (n, id) { return n + add[id]; }, 0);
    closeScan();
    showToast('Đã tính ' + formatNumber(total) + ' phần từ ảnh');
  }

  function bindScanEvents() {
    dom.scanBtn.addEventListener('click', function () { dom.scanInput.click(); });

    dom.scanInput.addEventListener('change', function () {
      var file = dom.scanInput.files && dom.scanInput.files[0];
      dom.scanInput.value = '';
      if (!file) return;
      if (!/^image\//.test(file.type)) { showToast('Vui lòng chọn một tệp ảnh'); return; }
      startScanWith(file);
    });

    dom.keyDialog.addEventListener('close', function () {
      var key = dom.keyInput.value.trim();
      var ok = dom.keyDialog.returnValue === 'confirm';
      dom.keyInput.value = '';
      if (!ok) { if (!dom.scanDialog.open) pendingFile = null; return; }
      if (!key) { showToast('Chưa nhập API key'); return; }
      apiKey = key;
      if (pendingFile) runScan(pendingFile);
    });

    dom.scanCancel.addEventListener('click', closeScan);
    dom.scanDialog.addEventListener('cancel', function (e) { e.preventDefault(); closeScan(); });
    dom.scanConfirm.addEventListener('click', confirmScan);
    dom.scanRetry.addEventListener('click', function () {
      if (!pendingFile) { closeScan(); return; }
      if (!apiKey) { askApiKey(); return; }
      runScan(pendingFile);
    });
    dom.scanChangeKey.addEventListener('click', function () { apiKey = ''; askApiKey(); });
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

    body.addEventListener('beforeinput', function (e) {
      if (!e.target.matches('.counter-input')) return;
      if (e.data && /\D/.test(e.data)) e.preventDefault();
    });

    body.addEventListener('input', function (e) {
      var input = e.target;
      if (!input.matches || !input.matches('.counter-input')) return;
      var digits = input.value.replace(/\D/g, '').slice(0, String(MAX_SERVINGS).length);
      if (digits !== input.value) input.value = digits;
      updateQuantity(rowIdFrom(input), digits === '' ? 0 : parseInt(digits, 10), { keepInput: true });
    });

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

    function selectInputText(input) {
      if (!input) return;
      input.select();
    }

    body.addEventListener('focusin', function (e) {
      var input = e.target;
      if ((input.matches && input.matches('.counter-input')) || input.matches('#add-qty')) {
        setTimeout(function () { selectInputText(input); }, 0);
      }
    });

    body.addEventListener('click', function (e) {
      var input = e.target;
      if ((input.matches && input.matches('.counter-input')) || input.matches('#add-qty')) {
        setTimeout(function () { selectInputText(input); }, 0);
      }
    });

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
    bindScanEvents();

    dom.addItemBtn.addEventListener('click', function () {
      var id = dom.itemSelect.value;
      if (!id) {
        showToast('Vui lòng chọn món');
        dom.itemSelect.focus();
        return;
      }
      var qty = sanitizeQuantity(dom.addQty.value);
      if (qty <= 0) {
        showToast('Vui lòng nhập số phần lớn hơn 0');
        dom.addQty.focus();
        dom.addQty.select();
        return;
      }
      var item = itemMap.get(id);
      updateQuantity(id, qty);
      dom.addQty.value = '1';
      dom.itemSelect.value = '';
      showToast('Đã thêm ' + itemLabel(item));
    });

    dom.dialog.addEventListener('close', function () {
      if (dom.dialog.returnValue === 'confirm') resetAll();
    });
    dom.dialog.addEventListener('click', function (e) {
      if (e.target !== dom.dialog) return;
      var r = dom.dialog.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dom.dialog.close('cancel');
    });

    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        document.documentElement.style.setProperty('--summary-h', dom.summary.offsetHeight + 'px');
      }).observe(dom.summary);
    }

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
    dom.scanBtn = document.getElementById('scan-btn');
    dom.scanInput = document.getElementById('scan-input');
    dom.keyDialog = document.getElementById('key-dialog');
    dom.keyInput = document.getElementById('key-input');
    dom.scanDialog = document.getElementById('scan-dialog');
    dom.scanPreview = document.getElementById('scan-preview');
    dom.scanImg = document.getElementById('scan-img');
    dom.scanStatus = document.getElementById('scan-status');
    dom.scanForm = document.getElementById('scan-form');
    dom.scanRows = document.getElementById('scan-rows');
    dom.scanUnmatched = document.getElementById('scan-unmatched');
    dom.scanMerge = document.getElementById('scan-merge');
    dom.scanMergeWrap = document.getElementById('scan-merge-wrap');
    dom.scanCancel = document.getElementById('scan-cancel');
    dom.scanRetry = document.getElementById('scan-retry');
    dom.scanConfirm = document.getElementById('scan-confirm');
    dom.scanChangeKey = document.getElementById('scan-change-key');
    dom.itemSelect = document.getElementById('item-select');
    dom.addQty = document.getElementById('add-qty');
    dom.addItemBtn = document.getElementById('add-item-btn');

    dom.addQty.addEventListener('focus', function () { dom.addQty.select(); });
    dom.addQty.addEventListener('click', function () { dom.addQty.select(); });

    dom.dialog = document.getElementById('confirm-dialog');
    dom.dialogDesc = document.getElementById('dialog-desc');
    dom.toast = document.getElementById('toast');

    buildRows();
    populateItemSelect();
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