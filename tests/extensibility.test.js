/**
 * @file Tests for extensibility: thêm món, thêm provider, thêm task
 * Run with: node --test tests/extensibility.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MENU, CATEGORIES } from '../js/config.js';
import { Order } from '../js/domain/Order.js';
import { buildPrompt } from '../js/ai/tasks/OrderScanTask.js';
import { parseScanResponse } from '../js/ai/parser.js';
import { VisionProvider } from '../js/ai/providers.js';
import { ScanService } from '../js/ai/ScanService.js';
import { NetworkError } from '../js/ai/errors.js';

// --- Test 1: Thêm món giả vào config -> Order/calculate/buildPrompt/parser nhận ngay ---
describe('Extensibility: thêm món mới', () => {
  const fakeItem = {
    id: 'fake-mon-test',
    name: 'Món Test',
    variant: null,
    yields: { water: 2, fried: 3 },
    aliases: ['Mon Test', 'Mon Test Alias'],
    hints: ['hint test'],
    category: 'ht',
    reportGroup: 'ht-nuoc',
  };

  const extendedMenu = [...MENU, fakeItem];

  test('Order hoạt động với món mới (không sửa code Order)', () => {
    const order = new Order(extendedMenu);
    order.setServings(fakeItem.id, 5);
    assert.strictEqual(order.getServings(fakeItem.id), 5);
    const totals = order.getTotals();
    assert.strictEqual(totals.water, 10); // 5 * 2
    assert.strictEqual(totals.fried, 15); // 5 * 3
    assert.strictEqual(totals.servings, 5);
  });

  test('calculate generic hoạt động với metric mới (nếu thêm metric)', () => {
    // Test tính toán generic không hardcode water/fried
    const testMetrics = [
      { id: 'water', label: 'Nước' },
      { id: 'fried', label: 'Chiên' },
      { id: 'steam', label: 'Hấp' },
    ];
    const testMenu = [
      { id: 'a', yields: { water: 1, fried: 0, steam: 2 } },
      { id: 'b', yields: { water: 0, fried: 1, steam: 3 } },
    ];
    const servings = { a: 2, b: 3 };
    const totals = { water: 0, fried: 0, steam: 0, servings: 0 };
    for (const item of testMenu) {
      const s = servings[item.id] || 0;
      totals.servings += s;
      for (const m of testMetrics) {
        totals[m.id] += s * (item.yields[m.id] ?? 0);
      }
    }
    assert.strictEqual(totals.water, 2);
    assert.strictEqual(totals.fried, 3);
    assert.strictEqual(totals.steam, 13);
  });

  test('buildPrompt tự động bao gồm món mới', () => {
    const prompt = buildPrompt(extendedMenu, CATEGORIES);
    assert.ok(prompt.includes(fakeItem.id));
    assert.ok(prompt.includes('Mon Test'));
    assert.ok(prompt.includes('Mon Test Alias'));
    assert.ok(prompt.includes('hint test'));
    // Số món tăng
    const menuLines = prompt.match(/- id "/g) || [];
    assert.strictEqual(menuLines.length, MENU.length + 1);
  });

  test('parser chấp nhận id món mới', () => {
    const text = `{"items":[{"id":"${fakeItem.id}","servings":3}],"unmatched":[]}`;
    const result = parseScanResponse(text, extendedMenu);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].id, fakeItem.id);
    assert.strictEqual(result.items[0].servings, 3);
  });
});

// --- Test 2: FakeProvider + FakeTask chạy được qua ScanService ---
describe('Extensibility: thêm AI provider + task', () => {
  class FakeProvider extends VisionProvider {
    constructor(response) {
      super({ endpoint: 'fake', apiKey: 'fake' });
      this.response = response;
      this.callCount = 0;
    }
    buildRequest() { return {}; }
    parseResponse() { return this.response; }
    async scan() {
      this.callCount++;
      return this.response;
    }
  }

  // FakeTask đơn giản cho test
  const FakeTask = {
    buildPrompt: () => 'test prompt',
    parse: async (text) => parseScanResponse(text, MENU),
  };

  test('FakeProvider + FakeTask hoạt động với ScanService', async () => {
    const fakeResponse = JSON.stringify({
      items: [{ id: 'hoanh-thanh-ly-nuoc-cay', servings: 2 }],
      unmatched: [],
    });
    const provider = new FakeProvider(fakeResponse);
    const service = new ScanService({
      provider,
      task: FakeTask,
      menu: MENU,
      categories: CATEGORIES,
      retryOptions: { maxRetry: 0, baseDelay: 10 },
    });

    const prepared = { base64: 'fake-base64', mimeType: 'image/jpeg', dataUrl: 'fake' };
    const result = await service.scan(prepared, { signal: { aborted: false, addEventListener: () => {}, removeEventListener: () => {} } });

    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].id, 'hoanh-thanh-ly-nuoc-cay');
    assert.strictEqual(provider.callCount, 1);
  });

  test('FakeProvider có thể mock error để test retry', async () => {
    class ErrorProvider extends VisionProvider {
      constructor(err) {
        super({ endpoint: 'fake', apiKey: 'fake' });
        this.err = err;
        this.callCount = 0;
      }
      buildRequest() { return {}; }
      parseResponse() { return '{}'; }
      async scan() {
        this.callCount++;
        throw this.err;
      }
    }

    const netErr = new NetworkError('network down');
    const provider = new ErrorProvider(netErr);
    const service = new ScanService({
      provider,
      task: FakeTask,
      menu: MENU,
      categories: CATEGORIES,
      retryOptions: { maxRetry: 2, baseDelay: 5 },
    });

    const prepared = { base64: 'fake', mimeType: 'image/jpeg', dataUrl: 'fake' };
    const signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => {} };

    await assert.rejects(service.scan(prepared, { signal }), /network down/);
    // maxRetry=2 => 3 lần gọi
    assert.strictEqual(provider.callCount, 3);
  });

  test('FakeProvider AuthError không retry', async () => {
    class AuthErrorProvider extends VisionProvider {
      constructor() {
        super({ endpoint: 'fake', apiKey: 'fake' });
        this.callCount = 0;
      }
      buildRequest() { return {}; }
      parseResponse() { return '{}'; }
      async scan() {
        this.callCount++;
        throw new Error('bad key'); // sẽ được normalize thành AuthError
      }
    }

    const provider = new AuthErrorProvider();
    const service = new ScanService({
      provider,
      task: FakeTask,
      menu: MENU,
      categories: CATEGORIES,
      retryOptions: { maxRetry: 2, baseDelay: 5 },
    });

    const prepared = { base64: 'fake', mimeType: 'image/jpeg', dataUrl: 'fake' };
    const signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => {} };

    await assert.rejects(service.scan(prepared, { signal }), /bad key/);
    // Chỉ gọi 1 lần vì không retryable
    assert.strictEqual(provider.callCount, 1);
  });
});

// --- Test 3: Thêm task mới (ví dụ ReportScanTask) ---
describe('Extensibility: thêm ScanTask mới', () => {
  class DummyProvider extends VisionProvider {
    constructor() {
      super({ endpoint: 'fake', apiKey: 'fake' });
    }
    buildRequest() { return {}; }
    parseResponse() { return '{}'; }
    async scan() {
      return '{"items":[],"unmatched":[]}';
    }
  }

  // Giả lập ReportScanTask
  const ReportScanTask = {
    buildPrompt: () => 'report scan prompt',
    parse: async () => ({ items: [], unmatched: [] }),
  };

  test('ScanService chấp nhận task tùy chỉnh', async () => {
    const provider = new DummyProvider();
    const service = new ScanService({
      provider,
      task: ReportScanTask,
      menu: [],
      categories: [],
      retryOptions: { maxRetry: 0, baseDelay: 10 },
    });

    const prepared = { base64: 'fake', mimeType: 'image/jpeg', dataUrl: 'fake' };
    const result = await service.scan(prepared, { signal: { aborted: false, addEventListener: () => {}, removeEventListener: () => {} } });

    assert.deepStrictEqual(result, { items: [], unmatched: [] });
  });
});