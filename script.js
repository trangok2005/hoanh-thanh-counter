/**
 * Hoành Thánh Counter - bản gọn, ưu tiên tốc độ
 * - AI layer: các hàm thuần (resize → fetch → parse), không class thừa
 * - Resize ảnh 1 lần, không chặn main thread
 * - Retry chỉ với lỗi tạm thời, timeout theo từng lần gọi
 */
(function () {
  'use strict';

  // ============================================================
  // CONFIG
  // ============================================================
  const AI = {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    // Có thể thêm model dự phòng: OpenRouter sẽ tự chuyển sang model kế tiếp nếu model đầu lỗi
    models: ['nvidia/nemotron-3.5-super-vl:free', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'],
    timeoutMs: 30000,   // mỗi lần gọi
    maxRetry: 2,        // số lần thử lại (tổng tối đa 3 lần gọi)
    retryDelayMs: 800,
    maxImageSide: 1280,
    jpegQuality: 0.8,
    userText: 'Đọc ảnh và trả về JSON theo đúng schema.'
  };

  const STORAGE_KEY = 'hoanh-thanh-counter:v1';
  const MAX_SERVINGS = 9999;
  const MAX_DIGITS = String(MAX_SERVINGS).length;

  const ITEMS = [
    { id: 'hoanh-thanh-ly-nuoc-cay',        name: 'Hoành thánh ly nước',  variant: 'Cay',       waterPerServing: 5, friedPerServing: 0, servings: 0 },
    { id: 'hoanh-thanh-ly-nuoc-khong-cay',  name: 'Hoành thánh ly nước',  variant: 'Không cay', waterPerServing: 5, friedPerServing: 0, servings: 0 },
    { id: 'hoanh-thanh-ky-phung-cay',       name: 'Hoành thánh Kỳ Phùng', variant: 'Cay',       waterPerServing: 2, friedPerServing: 3, servings: 0 },
    { id: 'hoanh-thanh-ky-phung-khong-cay', name: 'Hoành thánh Kỳ Phùng', variant: 'Không cay', waterPerServing: 2, friedPerServing: 3, servings: 0 },
    { id: 'hoanh-thanh-chien',              name: 'Hoành thánh chiên',    variant: null,        waterPerServing: 0, friedPerServing: 5, servings: 0 },
    { id: 'my-ly-hoanh-thanh',              name: 'Mỳ ly hoành thánh',    variant: null,        waterPerServing: 3, friedPerServing: 0, servings: 0 },
    { id: 'bun-bo-cay',                     name: 'Bún bò',               variant: 'Cay',       waterPerServing: 1, friedPerServing: 0, servings: 0 },
    { id: 'bun-bo-khong-cay',               name: 'Bún bò',               variant: 'Không cay', waterPerServing: 1, friedPerServing: 0, servings: 0 }
  ];

  const ALIASES = {
    'hoanh-thanh-ly-nuoc-cay':        ['Hoành Thánh Ly Nước Cay'],
    'hoanh-thanh-ly-nuoc-khong-cay':  ['Hoành Thánh Ly Nước Không Cay'],
    'hoanh-thanh-ky-phung-cay':       ['Hoành Thánh Kỳ Phùng Ly Cay'],
    'hoanh-thanh-ky-phung-khong-cay': ['Hoành Thánh Kỳ Phùng Ly Không Cay'],
    'hoanh-thanh-chien':              ['Hoành Thánh Ly Chiên', 'Hoành Thánh Chiên'],
    'my-ly-hoanh-thanh':              ['Mì tươi hoành thánh ly', 'Mỳ ly hoành thánh'],
    'bun-bo-cay':                     ['Bún Bò Ly Sate Cay'],
    'bun-bo-khong-cay':               ['Bún Bò Ly Sate Không Cay']
  };

  const itemLabel = item => (item.variant ? `${item.name} ${item.variant.toLowerCase()}` : item.name);

  // ============================================================
  // AI LAYER (hàm thuần)
  // ============================================================
  const SYSTEM_PROMPT = (() => {
    const menu = ITEMS.map(item => {
      const names = (ALIASES[item.id] || [itemLabel(item)]).map(n => `"${n}"`).join(' / ');
      return `- id "${item.id}" ← ${names}`;
    }).join('\n');

    return [
      'Bạn là bộ đọc số liệu cho quán hoành thánh. Ảnh thường là ảnh chụp màn hình máy POS (báo cáo chốt ca / báo cáo bán hàng) hoặc phiếu đơn hàng; ảnh có thể bị nghiêng, lóa, mờ ở các dòng cuối.',
      '',
      `NHIỆM VỤ: chỉ trích số lượng của ${ITEMS.length} món thuộc danh sách dưới đây. Bỏ qua mọi món khác.`,
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
      'KẾT QUẢ (chỉ trả JSON, không kèm giải thích):',
      '- "items": mảng {id, servings} với servings là số lượng đọc được.',
      '- "unmatched": CHỈ dùng khi có dòng thuộc nhóm hoành thánh / mì / bún bò mà bạn không chắc là món nào, hoặc không đọc rõ số lượng (ghi tên dòng đó kèm lý do ngắn). Nếu mọi thứ rõ ràng thì để mảng rỗng.',
      '- Nếu ảnh không phải đơn hàng/báo cáo bán hàng hoặc không có món nào trong danh sách, trả "items" rỗng.'
    ].join('\n');
  })();

  /** Resize 1 lần, không chặn main thread (createImageBitmap + toBlob). */
  async function resizeImage(file) {
    let bmp;
    try {
      bmp = await createImageBitmap(file);
    } catch (e) {
      throw new Error('Không đọc được ảnh này. Hãy thử ảnh khác (JPG/PNG).');
    }
    const scale = Math.min(1, AI.maxImageSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    if (bmp.close) bmp.close();

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', AI.jpegQuality));
    if (!blob) throw new Error('Không xử lý được ảnh này. Hãy thử ảnh khác.');

    const dataUrl = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error('Không đọc được ảnh này.'));
      fr.readAsDataURL(blob);
    });
    return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
  }

  function parseAIResponse(data) {
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error('AI không trả về kết quả. Hãy thử lại hoặc chụp rõ hơn.');

    // Nhiều model bỏ qua response_format và bọc JSON trong ```json ... ```
    const text = String(content).replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { throw new Error('Kết quả trả về không đọc được. Hãy thử lại.'); }

    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      unmatched: Array.isArray(parsed.unmatched) ? parsed.unmatched : []
    };
  }

  /** Một lần gọi API, timeout riêng cho lần này. */
  async function fetchOnce(base64, apiKey, signal) {
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, AI.timeoutMs);
    const onAbort = () => ctrl.abort();
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', onAbort, { once: true });

    try {
      const res = await fetch(AI.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Title': 'Hoanh Thanh Counter'
        },
        body: JSON.stringify({
          models: AI.models,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: AI.userText },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
              ]
            }
          ],
          temperature: 0,
          response_format: { type: 'json_object' }
        }),
        signal: ctrl.signal
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error((data && data.error && data.error.message) || `Lỗi ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return parseAIResponse(data);
    } catch (err) {
      if (timedOut) { const e = new Error('timeout'); e.isTimeout = true; throw e; }
      if (err instanceof TypeError) err.isNetwork = true;
      throw err;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    }
  }

  const isTransient = err => {
    if (!err || err.name === 'AbortError' || err.isTimeout) return false;
    if (err.isNetwork) return true;
    const s = err.status;
    return s === 408 || s === 429 || s >= 500;
  };

  /** Gọi API, chỉ retry lỗi tạm thời (mạng, 408, 429, 5xx). */
  async function scanImage(base64, apiKey, signal) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fetchOnce(base64, apiKey, signal);
      } catch (err) {
        if (attempt >= AI.maxRetry || signal.aborted || !isTransient(err)) throw err;
        await new Promise(r => setTimeout(r, AI.retryDelayMs * 2 ** attempt));
      }
    }
  }

  function mapError(err) {
    if (err && err.isTimeout) return { text: 'Quét quá lâu nên đã dừng. Hãy thử lại.' };
    if (err && err.name === 'AbortError') return null;

    const s = err && err.status;
    if (s === 401) return { text: 'API Key không hợp lệ.', badKey: true };
    if (s === 403) return { text: 'API Key không có quyền truy cập.', badKey: true };
    if (s === 402) return { text: 'Tài khoản hết credit.' };
    if (s === 404) return { text: 'Model không còn khả dụng. Hãy đổi model trong cấu hình.' };
    if (s === 429) return { text: 'Đã vượt giới hạn miễn phí. Chờ một chút rồi thử lại.' };
    if (s >= 500) return { text: 'Máy chủ AI đang bận. Hãy thử lại sau ít giây.' };
    if (err && err.isNetwork) return { text: 'Không kết nối được Internet. Kiểm tra mạng rồi thử lại.' };
    return { text: (err && err.message) || 'Có lỗi khi quét ảnh.' };
  }

  // ============================================================
  // APP
  // ============================================================
  class HoanhThanhCounter {
    constructor() {
      this.numberFormat = new Intl.NumberFormat('vi-VN');
      this.itemMap = new Map(ITEMS.map(item => [item.id, item]));
      this.rowMap = new Map();
      this.dom = {};
      this.saveTimer = null;
      this.toastTimer = null;
      this.storageWorks = true;

      this.apiKey = '';
      this.pendingFile = null;
      this.scanAbort = null;
      this.scanToken = 0;
    }

    // ---------- Init ----------
    init() {
      this.cacheDOM();
      this.bindEvents();
      this.buildRows();
      this.populateItemSelect();
      this.loadState();
      this.renderItems();
      this.refresh();
    }

    cacheDOM() {
      [
        'items-body', 'summary', 'total-water', 'total-fried', 'total-servings',
        'empty-hint', 'save-status', 'reset-btn', 'scan-btn', 'scan-input',
        'key-dialog', 'key-input', 'scan-dialog', 'scan-preview', 'scan-img',
        'scan-status', 'scan-form', 'scan-rows', 'scan-unmatched', 'scan-merge',
        'scan-merge-wrap', 'scan-cancel', 'scan-retry', 'scan-confirm', 'scan-change-key',
        'item-select', 'add-qty', 'add-item-btn', 'confirm-dialog', 'dialog-desc', 'toast'
      ].forEach(id => {
        this.dom[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
      });
    }

    // ---------- Utils ----------
    formatNumber(n) { return this.numberFormat.format(n); }

    el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    svgIcon(pathData) {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      const attrs = {
        viewBox: '0 0 24 24', width: '22', height: '22', fill: 'none',
        stroke: 'currentColor', 'stroke-width': '2.6', 'stroke-linecap': 'round',
        'stroke-linejoin': 'round', 'aria-hidden': 'true'
      };
      Object.keys(attrs).forEach(k => svg.setAttribute(k, attrs[k]));
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', pathData);
      svg.appendChild(path);
      return svg;
    }

    sanitizeQuantity(value) {
      let n;
      if (typeof value === 'number') n = Math.floor(value);
      else {
        const digits = String(value == null ? '' : value).replace(/\D/g, '');
        n = digits === '' ? 0 : parseInt(digits, 10);
      }
      if (!isFinite(n) || n < 0) return 0;
      return n > MAX_SERVINGS ? MAX_SERVINGS : n;
    }

    calculateItem(item) {
      return { water: item.servings * item.waterPerServing, fried: item.servings * item.friedPerServing };
    }

    calculateTotals() {
      let water = 0, fried = 0, servings = 0;
      ITEMS.forEach(item => {
        const r = this.calculateItem(item);
        water += r.water;
        fried += r.fried;
        servings += item.servings;
      });
      return { water, fried, all: water + fried, servings };
    }

    // ---------- Render ----------
    setStat(node, value) {
      const text = this.formatNumber(value);
      if (node.textContent === text) return;
      node.textContent = text;
      node.classList.toggle('is-long', text.length >= 7);
      node.classList.remove('bump');
      void node.offsetWidth;
      node.classList.add('bump');
    }

    renderSummary(totals) {
      this.setStat(this.dom.totalWater, totals.water);
      this.setStat(this.dom.totalFried, totals.fried);
      this.dom.totalServings.textContent = this.formatNumber(totals.servings) + ' phần';
      this.dom.emptyHint.hidden = totals.servings > 0;
    }

    renderRow(item, options) {
      const ref = this.rowMap.get(item.id);
      if (!ref) return;
      const r = this.calculateItem(item);

      if (!(options && options.keepInput)) ref.input.value = String(item.servings);

      ref.waterTotal.textContent = this.formatNumber(r.water);
      ref.waterTotal.classList.toggle('is-zero', r.water === 0);
      ref.friedTotal.textContent = this.formatNumber(r.fried);
      ref.friedTotal.classList.toggle('is-zero', r.fried === 0);

      ref.tr.classList.toggle('is-active', item.servings > 0);
      ref.minus.setAttribute('aria-disabled', item.servings <= 0 ? 'true' : 'false');
      ref.plus.setAttribute('aria-disabled', item.servings >= MAX_SERVINGS ? 'true' : 'false');
    }

    renderItems() { ITEMS.forEach(item => this.renderRow(item)); }

    refresh() { this.renderSummary(this.calculateTotals()); }

    populateItemSelect() {
      const select = this.dom.itemSelect;
      if (!select) return;
      select.innerHTML = '<option value="">-- Chọn món --</option>';
      ITEMS.forEach(item => {
        const option = this.el('option', null, itemLabel(item));
        option.value = item.id;
        select.appendChild(option);
      });
    }

    buildRows() {
      const frag = document.createDocumentFragment();

      ITEMS.forEach((item, index) => {
        const label = itemLabel(item);
        const tr = this.el('tr', 'item-row');
        tr.dataset.id = item.id;

        tr.appendChild(this.el('td', 'c-index', String(index + 1)));

        const tdName = this.el('th', 'c-name');
        tdName.scope = 'row';
        tdName.appendChild(this.el('span', 'item-name', item.name));
        tr.appendChild(tdName);

        const tdVariant = this.el('td', 'c-variant');
        if (item.variant) {
          const isSpicy = item.variant === 'Cay';
          tdVariant.appendChild(this.el('span', `tag ${isSpicy ? 'tag--spicy' : 'tag--mild'}`, item.variant));
        } else {
          const dash = this.el('span', 'dash', '—');
          dash.setAttribute('aria-label', 'Không áp dụng');
          tdVariant.appendChild(dash);
        }
        tr.appendChild(tdVariant);

        const tdWR = this.el('td', 'c-water-rate');
        tdWR.appendChild(this.el('span', 'm-only', 'Nước: '));
        tdWR.appendChild(document.createTextNode(String(item.waterPerServing)));
        tdWR.appendChild(this.el('span', 'm-only', ' viên/phần'));
        tr.appendChild(tdWR);

        const tdFR = this.el('td', 'c-fried-rate');
        tdFR.appendChild(this.el('span', 'm-only', 'Chiên: '));
        tdFR.appendChild(document.createTextNode(String(item.friedPerServing)));
        tdFR.appendChild(this.el('span', 'm-only', ' viên/phần'));
        tr.appendChild(tdFR);

        const tdQty = this.el('td', 'c-qty');
        const counter = this.el('div', 'counter');

        const minus = this.el('button', 'counter-btn');
        minus.type = 'button';
        minus.dataset.action = 'dec';
        minus.setAttribute('aria-label', 'Giảm một phần ' + label);
        minus.appendChild(this.svgIcon('M5 12h14'));

        const input = this.el('input', 'counter-input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.pattern = '[0-9]*';
        input.autocomplete = 'off';
        input.maxLength = MAX_DIGITS;
        input.value = '0';
        input.setAttribute('aria-label', 'Số phần ' + label);

        const plus = this.el('button', 'counter-btn');
        plus.type = 'button';
        plus.dataset.action = 'inc';
        plus.setAttribute('aria-label', 'Tăng một phần ' + label);
        plus.appendChild(this.svgIcon('M12 5v14M5 12h14'));

        counter.append(minus, input, plus);
        tdQty.appendChild(counter);
        tr.appendChild(tdQty);

        const tdWT = this.el('td', 'c-water-total');
        tdWT.appendChild(this.el('span', 'm-label', 'Nước'));
        const waterTotal = this.el('span', 'result-val is-zero', '0');
        tdWT.appendChild(waterTotal);
        tr.appendChild(tdWT);

        const tdFT = this.el('td', 'c-fried-total');
        tdFT.appendChild(this.el('span', 'm-label', 'Chiên'));
        const friedTotal = this.el('span', 'result-val is-zero', '0');
        tdFT.appendChild(friedTotal);
        tr.appendChild(tdFT);

        this.rowMap.set(item.id, { tr, input, minus, plus, waterTotal, friedTotal });
        frag.appendChild(tr);
      });

      this.dom.itemsBody.appendChild(frag);
    }

    // ---------- Quantity ----------
    updateQuantity(id, value, options) {
      const item = this.itemMap.get(id);
      if (!item) return;
      const next = this.sanitizeQuantity(value);
      if (next === item.servings && !(options && options.force)) {
        this.renderRow(item, options);
        return;
      }
      item.servings = next;
      this.renderRow(item, options);
      this.refresh();
      this.scheduleSave();
    }

    // ---------- Storage ----------
    setSaveStatus(state) {
      const node = this.dom.saveStatus;
      node.classList.remove('is-saved', 'is-error');
      if (state === 'saving') node.textContent = 'Đang lưu…';
      else if (state === 'saved') { node.textContent = 'Đã lưu'; node.classList.add('is-saved'); }
      else if (state === 'error') { node.textContent = 'Không lưu được trên trình duyệt này'; node.classList.add('is-error'); }
      else node.textContent = 'Tự động lưu';
    }

    saveNow() {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      const servings = {};
      ITEMS.forEach(item => { servings[item.id] = item.servings; });
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, servings }));
        this.storageWorks = true;
        this.setSaveStatus('saved');
      } catch (err) {
        this.storageWorks = false;
        this.setSaveStatus('error');
      }
    }

    scheduleSave() {
      if (!this.storageWorks) { this.setSaveStatus('error'); return; }
      this.setSaveStatus('saving');
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.saveNow(), 250);
    }

    loadState() {
      let raw = null;
      try { raw = window.localStorage.getItem(STORAGE_KEY); }
      catch (err) { this.storageWorks = false; this.setSaveStatus('error'); return; }
      if (!raw) return;

      try {
        const data = JSON.parse(raw);
        const saved = data && typeof data === 'object' ? data.servings : null;
        if (!saved || typeof saved !== 'object') return;

        ITEMS.forEach(item => {
          if (!Object.prototype.hasOwnProperty.call(saved, item.id)) return;
          const v = saved[item.id];
          if (typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= 0 && v <= MAX_SERVINGS) {
            item.servings = v;
          }
        });
        this.setSaveStatus('saved');
      } catch (err) { /* dữ liệu hỏng: bỏ qua */ }
    }

    // ---------- Toast ----------
    showToast(message) {
      const t = this.dom.toast;
      clearTimeout(this.toastTimer);
      t.textContent = message;
      t.hidden = false;
      t.style.animation = 'none';
      void t.offsetWidth;
      t.style.animation = '';
      this.toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
    }

    // ---------- Reset ----------
    resetAll() {
      ITEMS.forEach(item => { item.servings = 0; });
      this.renderItems();
      this.refresh();
      this.saveNow();
      this.showToast('Đã reset tất cả');
    }

    requestReset() {
      const totals = this.calculateTotals();
      if (totals.servings === 0) { this.showToast('Đơn hàng đang trống'); return; }
      const dlg = this.dom.confirmDialog;
      if (dlg && typeof dlg.showModal === 'function') {
        this.dom.dialogDesc.textContent = `Đang có ${this.formatNumber(totals.servings)} phần. Toàn bộ số phần sẽ được đặt về 0 và không thể hoàn tác.`;
        dlg.returnValue = '';
        dlg.showModal();
      } else if (window.confirm('Đặt toàn bộ số phần về 0?')) {
        this.resetAll();
      }
    }

    // ---------- Scan UI ----------
    scanSetState(state, message) {
      const d = this.dom;
      d.scanStatus.textContent = message || '';
      d.scanStatus.classList.toggle('is-error', state === 'error');
      d.scanStatus.classList.toggle('is-loading', state === 'loading');
      d.scanStatus.hidden = !message;
      d.scanForm.hidden = state !== 'review';
      d.scanConfirm.hidden = state !== 'review';
      d.scanRetry.hidden = state !== 'error';
    }

    makeScanRow(id, qty) {
      const row = this.el('div', 'scan-row');

      const select = this.el('select', 'scan-select');
      select.setAttribute('aria-label', 'Món');
      ITEMS.forEach(it => {
        const o = this.el('option', null, itemLabel(it));
        o.value = it.id;
        select.appendChild(o);
      });
      select.value = id;

      const input = this.el('input', 'scan-qty');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.autocomplete = 'off';
      input.maxLength = MAX_DIGITS;
      input.value = String(qty);
      input.setAttribute('aria-label', 'Số phần');
      input.addEventListener('input', () => {
        const d = input.value.replace(/\D/g, '').slice(0, MAX_DIGITS);
        if (d !== input.value) input.value = d;
      });
      input.addEventListener('focus', () => { setTimeout(() => input.select(), 0); });

      const unit = this.el('span', 'scan-unit', 'phần');

      const del = this.el('button', 'scan-del');
      del.type = 'button';
      del.setAttribute('aria-label', 'Xóa dòng này');
      del.appendChild(this.svgIcon('M6 6l12 12M18 6L6 18'));
      del.addEventListener('click', () => { row.remove(); this.updateScanConfirmState(); });

      row.append(select, input, unit, del);
      return row;
    }

    updateScanConfirmState() {
      const hasRows = this.dom.scanRows.children.length > 0;
      this.dom.scanConfirm.disabled = !hasRows;
      if (!hasRows) {
        this.dom.scanStatus.hidden = false;
        this.dom.scanStatus.classList.remove('is-error', 'is-loading');
        this.dom.scanStatus.textContent = 'Không còn món nào để tính.';
      } else {
        this.dom.scanStatus.hidden = true;
      }
    }

    showScanResult(result) {
      const totals = {};
      (result.items || []).forEach(r => {
        if (!r || !this.itemMap.has(r.id)) return;
        const q = this.sanitizeQuantity(r.servings);
        if (q > 0) totals[r.id] = Math.min(MAX_SERVINGS, (totals[r.id] || 0) + q);
      });

      const rows = this.dom.scanRows;
      rows.innerHTML = '';
      ITEMS.forEach(it => { if (totals[it.id]) rows.appendChild(this.makeScanRow(it.id, totals[it.id])); });

      const unmatched = (result.unmatched || []).filter(t => typeof t === 'string' && t.trim());
      this.dom.scanUnmatched.hidden = unmatched.length === 0;
      this.dom.scanUnmatched.textContent = unmatched.length ? 'Chưa nhận diện được: ' + unmatched.join('; ') : '';

      this.dom.scanMergeWrap.hidden = this.calculateTotals().servings === 0;

      if (!rows.children.length) {
        this.scanSetState('error', 'Không tìm thấy món nào trong ảnh. Hãy chụp rõ hơn hoặc nhập tay.');
        return;
      }
      this.scanSetState('review', '');
      this.dom.scanConfirm.disabled = false;
    }

    // ---------- Scan flow ----------
    async runScan(file) {
      const token = ++this.scanToken;
      if (this.scanAbort) this.scanAbort.abort();
      const ctrl = (this.scanAbort = new AbortController());

      this.dom.scanPreview.hidden = true;
      this.scanSetState('loading', 'Đang quét ảnh…');
      if (!this.dom.scanDialog.open) this.dom.scanDialog.showModal();

      try {
        const img = await resizeImage(file);
        if (token !== this.scanToken) return;
        this.dom.scanImg.src = img.dataUrl;
        this.dom.scanPreview.hidden = false;

        const result = await scanImage(img.base64, this.apiKey, ctrl.signal);
        if (token !== this.scanToken) return;
        this.showScanResult(result);
      } catch (err) {
        if (token !== this.scanToken) return;
        const info = mapError(err);
        if (!info) return;
        if (info.badKey) this.apiKey = '';
        this.scanSetState('error', info.text);
      }
    }

    askApiKey() {
      this.dom.keyInput.value = '';
      this.dom.keyDialog.returnValue = '';
      this.dom.keyDialog.showModal();
      setTimeout(() => this.dom.keyInput.focus(), 0);
    }

    startScanWith(file) {
      this.pendingFile = file;
      if (!this.apiKey) { this.askApiKey(); return; }
      this.runScan(file);
    }

    closeScan() {
      this.scanToken++;
      if (this.scanAbort) { this.scanAbort.abort(); this.scanAbort = null; }
      if (this.dom.scanDialog.open) this.dom.scanDialog.close();
      this.dom.scanRows.innerHTML = '';
      this.dom.scanImg.removeAttribute('src');
      this.pendingFile = null;
    }

    confirmScan() {
      const add = {};
      this.dom.scanRows.querySelectorAll('.scan-row').forEach(row => {
        const id = row.querySelector('select').value;
        const q = this.sanitizeQuantity(row.querySelector('input').value);
        if (this.itemMap.has(id) && q > 0) add[id] = (add[id] || 0) + q;
      });
      const ids = Object.keys(add);
      if (!ids.length) { this.showToast('Chưa có số phần nào để tính'); return; }

      const merge = this.dom.scanMergeWrap.hidden ? true : this.dom.scanMerge.checked;
      ITEMS.forEach(item => {
        const next = (merge ? item.servings : 0) + (add[item.id] || 0);
        if (next !== item.servings) this.updateQuantity(item.id, next);
      });

      const total = ids.reduce((n, id) => n + add[id], 0);
      this.closeScan();
      this.showToast('Đã tính ' + this.formatNumber(total) + ' phần từ ảnh');
    }

    // ---------- Events ----------
    rowIdFrom(node) {
      const tr = node.closest ? node.closest('tr[data-id]') : null;
      return tr ? tr.dataset.id : null;
    }

    bindEvents() {
      const body = this.dom.itemsBody;
      const selectSoon = input => setTimeout(() => input.select(), 0);

      // Một listener click: nút +/- và chọn toàn bộ số khi bấm vào ô
      body.addEventListener('click', e => {
        const btn = e.target.closest('.counter-btn');
        if (btn) {
          const id = this.rowIdFrom(btn);
          const item = this.itemMap.get(id);
          if (!item) return;
          this.updateQuantity(id, item.servings + (btn.dataset.action === 'inc' ? 1 : -1));
          return;
        }
        if (e.target.matches('.counter-input')) selectSoon(e.target);
      });

      body.addEventListener('focusin', e => {
        if (e.target.matches('.counter-input')) selectSoon(e.target);
      });

      body.addEventListener('beforeinput', e => {
        if (e.target.matches('.counter-input') && e.data && /\D/.test(e.data)) e.preventDefault();
      });

      body.addEventListener('input', e => {
        const input = e.target;
        if (!input.matches('.counter-input')) return;
        const digits = input.value.replace(/\D/g, '').slice(0, MAX_DIGITS);
        if (digits !== input.value) input.value = digits;
        this.updateQuantity(this.rowIdFrom(input), digits === '' ? 0 : parseInt(digits, 10), { keepInput: true });
      });

      body.addEventListener('paste', e => {
        const input = e.target;
        if (!input.matches('.counter-input')) return;
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text') || '';
        const m = text.match(/\d+/);
        const value = m ? this.sanitizeQuantity(m[0]) : 0;
        input.value = String(value);
        this.updateQuantity(this.rowIdFrom(input), value, { keepInput: true });
      });

      body.addEventListener('focusout', e => {
        const input = e.target;
        if (!input.matches('.counter-input')) return;
        const item = this.itemMap.get(this.rowIdFrom(input));
        if (item) input.value = String(item.servings);
      });

      body.addEventListener('keydown', e => {
        const input = e.target;
        if (!input.matches('.counter-input')) return;
        const id = this.rowIdFrom(input);
        const item = this.itemMap.get(id);
        if (!item) return;
        if (e.key === 'ArrowUp') { e.preventDefault(); this.updateQuantity(id, item.servings + 1); input.select(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); this.updateQuantity(id, item.servings - 1); input.select(); }
        else if (e.key === 'Enter') input.blur();
      });

      this.dom.resetBtn.addEventListener('click', () => this.requestReset());

      this.dom.addItemBtn.addEventListener('click', () => {
        const id = this.dom.itemSelect.value;
        if (!id) { this.showToast('Vui lòng chọn món'); this.dom.itemSelect.focus(); return; }
        const qty = this.sanitizeQuantity(this.dom.addQty.value);
        if (qty <= 0) {
          this.showToast('Vui lòng nhập số phần lớn hơn 0');
          this.dom.addQty.focus();
          this.dom.addQty.select();
          return;
        }
        const item = this.itemMap.get(id);
        this.updateQuantity(id, qty);
        this.dom.addQty.value = '1';
        this.dom.itemSelect.value = '';
        this.showToast('Đã thêm ' + itemLabel(item));
      });

      this.dom.addQty.addEventListener('focus', () => this.dom.addQty.select());
      this.dom.addQty.addEventListener('click', () => this.dom.addQty.select());

      const dlg = this.dom.confirmDialog;
      dlg.addEventListener('close', () => { if (dlg.returnValue === 'confirm') this.resetAll(); });
      dlg.addEventListener('click', e => {
        if (e.target !== dlg) return;
        const r = dlg.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) dlg.close('cancel');
      });

      if ('ResizeObserver' in window) {
        new ResizeObserver(() => {
          document.documentElement.style.setProperty('--summary-h', this.dom.summary.offsetHeight + 'px');
        }).observe(this.dom.summary);
      }

      window.addEventListener('storage', e => {
        if (e.key !== STORAGE_KEY) return;
        ITEMS.forEach(item => { item.servings = 0; });
        this.loadState();
        this.renderItems();
        this.refresh();
      });

      this.bindScanEvents();
    }

    bindScanEvents() {
      const d = this.dom;

      d.scanBtn.addEventListener('click', () => d.scanInput.click());

      d.scanInput.addEventListener('change', () => {
        const file = d.scanInput.files && d.scanInput.files[0];
        d.scanInput.value = '';
        if (!file) return;
        if (!/^image\//.test(file.type)) { this.showToast('Vui lòng chọn một tệp ảnh'); return; }
        this.startScanWith(file);
      });

      d.keyDialog.addEventListener('close', () => {
        const key = d.keyInput.value.trim();
        const ok = d.keyDialog.returnValue === 'confirm';
        d.keyInput.value = '';
        if (!ok) { if (!d.scanDialog.open) this.pendingFile = null; return; }
        if (!key) { this.showToast('Chưa nhập API key'); return; }
        this.apiKey = key;
        if (this.pendingFile) this.runScan(this.pendingFile);
      });

      d.scanCancel.addEventListener('click', () => this.closeScan());
      d.scanDialog.addEventListener('cancel', e => { e.preventDefault(); this.closeScan(); });
      d.scanConfirm.addEventListener('click', () => this.confirmScan());
      d.scanRetry.addEventListener('click', () => {
        if (!this.pendingFile) { this.closeScan(); return; }
        if (!this.apiKey) { this.askApiKey(); return; }
        this.runScan(this.pendingFile);
      });
      d.scanChangeKey.addEventListener('click', () => { this.apiKey = ''; this.askApiKey(); });
    }
  }

  // ---------- Bootstrap ----------
  const start = () => new HoanhThanhCounter().init();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();