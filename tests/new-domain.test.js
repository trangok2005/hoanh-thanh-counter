/**
 * @file Tests for new domain functionality
 * Run with: node --test tests/new-domain.test.js
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeQuantity, sanitizeMoney, formatDateDDMM, generateExpenseId } from '../js/domain/quantity.js';
import { Report, calculateRevenue, calculateTotalExpense } from '../js/domain/Report.js';
import { calculateOrder, calculateByReportGroup } from '../js/domain/calculate.js';
import { formatReport } from '../js/domain/reportFormatter.js';
import { MENU, CATEGORIES, METRICS, PAYMENT_CHANNELS, REPORT_GROUPS, REPORT_FORMAT } from '../js/config.js';

describe('sanitizeMoney', () => {
  test('số nguyên dương', () => assert.strictEqual(sanitizeMoney(5000), 5000));
  test('string số', () => assert.strictEqual(sanitizeMoney('12345'), 12345));
  test('string có chữ', () => assert.strictEqual(sanitizeMoney('12abc'), 12));
  test('string chỉ chữ', () => assert.strictEqual(sanitizeMoney('abc'), 0));
  test('null/undefined', () => assert.strictEqual(sanitizeMoney(null), 0));
  test('số âm -> 0', () => assert.strictEqual(sanitizeMoney(-5), 0));
  test('float -> floor', () => assert.strictEqual(sanitizeMoney(3.9), 3));
  test('clamp max', () => assert.strictEqual(sanitizeMoney(999999999 + 100), 999999999));
  test('NaN -> 0', () => assert.strictEqual(sanitizeMoney(NaN), 0));
});

describe('formatDateDDMM', () => {
  test('định dạng chuẩn YYYY-MM-DD', () => assert.strictEqual(formatDateDDMM('2026-10-22'), '22/10'));
  test('định dạng sai trả về gốc', () => assert.strictEqual(formatDateDDMM('invalid'), 'invalid'));
});

describe('generateExpenseId', () => {
  test('tạo id khác nhau', () => {
    const id1 = generateExpenseId();
    const id2 = generateExpenseId();
    assert.ok(id1.startsWith('exp_'));
    assert.ok(id2.startsWith('exp_'));
    assert.notStrictEqual(id1, id2);
  });
});

describe('Report', () => {
  let report;

  beforeEach(() => {
    report = new Report();
  });

  test('khởi tạo với mặc định hôm nay', () => {
    const snapshot = report.snapshot();
    assert.ok(snapshot.date.match(/^\d{4}-\d{2}-\d{2}$/));
    assert.strictEqual(snapshot.title, 'full');
    assert.deepStrictEqual(snapshot.payments, { ck: 0, tm: 0, the: 0, grab: 0, shopee: 0 });
    assert.deepStrictEqual(snapshot.cancel, { water: 0, fried: 0 });
    assert.deepStrictEqual(snapshot.expenses, []);
  });

  test('setDate/setTitle', () => {
    report.setDate('2026-10-22');
    report.setTitle('sáng');
    const s = report.snapshot();
    assert.strictEqual(s.date, '2026-10-22');
    assert.strictEqual(s.title, 'sáng');
  });

  test('setPayment sanitize tiền', () => {
    report.setPayment('ck', '1,234,567');
    report.setPayment('tm', -500);
    const s = report.snapshot();
    assert.strictEqual(s.payments.ck, 1234567);
    assert.strictEqual(s.payments.tm, 0);
  });

  test('addExpense/removeExpense', () => {
    const id1 = report.addExpense(19000, '1 bao đá');
    const id2 = report.addExpense(50000, 'điện');
    let s = report.snapshot();
    assert.strictEqual(s.expenses.length, 2);
    assert.strictEqual(s.expenses[0].amount, 19000);
    assert.strictEqual(s.expenses[0].reason, '1 bao đá');

    report.removeExpense(id1);
    s = report.snapshot();
    assert.strictEqual(s.expenses.length, 1);
    assert.strictEqual(s.expenses[0].id, id2);
  });

  test('updateExpense giữ id khi sửa', () => {
    const id = report.addExpense(19000, 'đá');
    report.updateExpense(id, { amount: '25,000', reason: 'đá + điện' });
    const s = report.snapshot();
    assert.strictEqual(s.expenses.length, 1);
    assert.strictEqual(s.expenses[0].id, id);
    assert.strictEqual(s.expenses[0].amount, 25000);
    assert.strictEqual(s.expenses[0].reason, 'đá + điện');
    assert.strictEqual(report.updateExpense('missing', { amount: 1 }), false);
  });

  test('setCancel sanitize số lượng', () => {
    report.setCancel('water', '5');
    report.setCancel('fried', -3);
    const s = report.snapshot();
    assert.strictEqual(s.cancel.water, 5);
    assert.strictEqual(s.cancel.fried, 0);
  });

  test('reset giữ ngày', () => {
    report.setDate('2026-10-22');
    report.setPayment('ck', 1000);
    report.addExpense(5000, 'test');
    report.setCancel('water', 2);
    report.reset();
    const s = report.snapshot();
    assert.strictEqual(s.date, '2026-10-22');
    assert.strictEqual(s.payments.ck, 0);
    assert.strictEqual(s.expenses.length, 0);
    assert.strictEqual(s.cancel.water, 0);
  });

  test('restore validate dữ liệu hỏng', () => {
    report.restore({
      date: '2026-10-22',
      title: 'sáng',
      payments: { ck: 'abc', tm: 2000 },
      expenses: [
        { id: 'e1', amount: 1000, reason: 'a' },
        { id: 'e2', amount: 0, reason: '' },
        { invalid: true },
      ],
      cancel: { water: 'xyz', fried: 3 },
    });
    const s = report.snapshot();
    assert.strictEqual(s.date, '2026-10-22');
    assert.strictEqual(s.title, 'sáng');
    assert.strictEqual(s.payments.ck, 0); // abc -> 0
    assert.strictEqual(s.payments.tm, 2000);
    assert.strictEqual(s.expenses.length, 1); // chỉ e1 hợp lệ
    assert.strictEqual(s.cancel.water, 0); // xyz -> 0
    assert.strictEqual(s.cancel.fried, 3);
  });

  test('subscribe/unsubscribe', () => {
    let count = 0;
    const unsub = report.subscribe(() => count++);
    report.setPayment('ck', 100);
    assert.strictEqual(count, 1);
    unsub();
    report.setPayment('tm', 200);
    assert.strictEqual(count, 1);
  });
});

describe('calculateRevenue', () => {
  test('tính tổng và theo kênh', () => {
    const report = {
      payments: { ck: 1213000, tm: 2505000, the: 0, grab: 624832, shopee: 0 },
      expenses: [],
      cancel: { water: 0, fried: 0 },
    };
    const { total, byChannel } = calculateRevenue(report, PAYMENT_CHANNELS);
    assert.strictEqual(total, 4342832);
    assert.strictEqual(byChannel.ck, 1213000);
    assert.strictEqual(byChannel.tm, 2505000);
    assert.strictEqual(byChannel.the, 0);
    assert.strictEqual(byChannel.grab, 624832);
    assert.strictEqual(byChannel.shopee, 0);
  });
});

describe('calculateTotalExpense', () => {
  test('tổng chi', () => {
    const report = {
      expenses: [
        { amount: 19000, reason: 'a' },
        { amount: 50000, reason: 'b' },
      ],
    };
    assert.strictEqual(calculateTotalExpense(report), 69000);
  });

  test('mảng rỗng', () => {
    assert.strictEqual(calculateTotalExpense({ expenses: [] }), 0);
  });
});

describe('calculateOrder', () => {
  test('chỉ tính nhóm hasYields', () => {
    const servings = {
      'hoanh-thanh-ly-nuoc-cay': 2, // water: 10
      'hoanh-thanh-chien': 3,       // fried: 15
      'snack': 5,                   // không hasYields
      'sua-chien-binh': 10,         // không hasYields
    };
    const totals = calculateOrder(servings, MENU, CATEGORIES, METRICS);
    assert.strictEqual(totals.water, 10);
    assert.strictEqual(totals.fried, 15);
    assert.strictEqual(totals.servings, 5); // chỉ 2+3
  });
});

describe('calculateByReportGroup', () => {
  test('gom theo reportGroup', () => {
    const servings = {
      'hoanh-thanh-ly-nuoc-cay': 30,
      'hoanh-thanh-ly-nuoc-khong-cay': 16,
      'my-ly-hoanh-thanh': 13,
      'hoanh-thanh-chien': 29,
      'hoanh-thanh-ky-phung-cay': 6,
      'hoanh-thanh-ky-phung-khong-cay': 4,
      'bun-bo-cay': 14,
      'bun-bo-khong-cay': 10,
      'snack': 3,
      'xi-quach': 6,
      'sua-nang-tho': 19,
      'sua-chien-binh': 13,
    };
    const byGroup = calculateByReportGroup(servings, MENU, REPORT_GROUPS);
    assert.strictEqual(byGroup['ht-nuoc'], 46);
    assert.strictEqual(byGroup['mi-ly'], 13);
    assert.strictEqual(byGroup['ht-chien'], 29);
    assert.strictEqual(byGroup['ht-ky-phung'], 10);
    assert.strictEqual(byGroup['bun-bo'], 24);
    assert.strictEqual(byGroup['snack'], 3);
    assert.strictEqual(byGroup['xi-quach'], 6);
    assert.strictEqual(byGroup['sua-nang-tho'], 19);
    assert.strictEqual(byGroup['sua-chien-binh'], 13);
  });
});

describe('formatReport - golden test', () => {
  test('khớp chính xác ví dụ chuẩn', () => {
    const report = {
      date: '2026-10-22',
      title: 'full',
      payments: { ck: 1213000, tm: 2505000, the: 0, grab: 624832, shopee: 0 },
      expenses: [{ id: 'e1', amount: 19000, reason: '1 bao đá' }],
      cancel: { water: 0, fried: 0 },
    };
    const orderServings = {
      'hoanh-thanh-ly-nuoc-cay': 30,
      'hoanh-thanh-ly-nuoc-khong-cay': 16,
      'my-ly-hoanh-thanh': 13,
      'hoanh-thanh-chien': 29,
      'hoanh-thanh-ky-phung-cay': 6,
      'hoanh-thanh-ky-phung-khong-cay': 4,
      'bun-bo-cay': 14,
      'bun-bo-khong-cay': 10,
      'snack': 3,
      'xi-quach': 6,
      'sua-nang-tho': 19,
      'sua-chien-binh': 13,
    };

    const result = formatReport({
      report,
      orderServings,
      menu: MENU,
      reportGroups: REPORT_GROUPS,
      channels: PAYMENT_CHANNELS,
      metrics: METRICS,
      format: REPORT_FORMAT,
    });

    const expected = `Báo cáo doanh thu full ngày 22/10
Tổng DT: 4.342.832
CK: 1.213.000
TM: 2.505.000
Grab: 624.832

Chi:
- 1 bao đá: 19.000đ

HT nước: 46
Mì tươi ht ly: 13
HT chiên: 29
HT kỳ phùng: 10
Bún Bò: 24
Snack: 3
Xí quách: 6
Sữa nàng thơ: 19
Sữa chiến binh: 13`;

    assert.strictEqual(result, expected);
  });

  test('nhiều phiếu chi', () => {
    const report = {
      date: '2026-10-22',
      title: 'full',
      payments: { ck: 0, tm: 0, the: 0, grab: 0, shopee: 0 },
      expenses: [
        { id: 'e1', amount: 10000, reason: 'điện' },
        { id: 'e2', amount: 20000, reason: 'nước' },
      ],
      cancel: { water: 0, fried: 0 },
    };
    const result = formatReport({
      report,
      orderServings: {},
      menu: MENU,
      reportGroups: REPORT_GROUPS,
      channels: PAYMENT_CHANNELS,
      metrics: METRICS,
      format: REPORT_FORMAT,
    });
    assert.ok(result.includes('Chi:\n- điện: 10.000đ'));
    assert.ok(result.includes('- nước: 20.000đ'));
  });

  test('không có phiếu chi', () => {
    const report = {
      date: '2026-10-22',
      title: 'full',
      payments: { ck: 0, tm: 0, the: 0, grab: 0, shopee: 0 },
      expenses: [],
      cancel: { water: 0, fried: 0 },
    };
    const result = formatReport({
      report,
      orderServings: {},
      menu: MENU,
      reportGroups: REPORT_GROUPS,
      channels: PAYMENT_CHANNELS,
      metrics: METRICS,
      format: REPORT_FORMAT,
    });
    assert.ok(result.includes('Chi: 0') === false);
    assert.ok(result.trim().length > 0);
  });

  test('nhóm bằng 0', () => {
    const report = {
      date: '2026-10-22',
      title: 'full',
      payments: { ck: 0, tm: 0, the: 0, grab: 0, shopee: 0 },
      expenses: [],
      cancel: { water: 0, fried: 0 },
    };
    const result = formatReport({
      report,
      orderServings: { 'snack': 0 },
      menu: MENU,
      reportGroups: REPORT_GROUPS,
      channels: PAYMENT_CHANNELS,
      metrics: METRICS,
      format: REPORT_FORMAT,
    });
    assert.ok(result.includes('Snack: 0') === false);
  });

  test('hideZeroItems=true', () => {
    const report = {
      date: '2026-10-22',
      title: 'full',
      payments: { ck: 0, tm: 0, the: 0, grab: 0, shopee: 0 },
      expenses: [],
      cancel: { water: 0, fried: 0 },
    };
    const result = formatReport({
      report,
      orderServings: { 'snack': 0 },
      menu: MENU,
      reportGroups: REPORT_GROUPS,
      channels: PAYMENT_CHANNELS,
      metrics: METRICS,
      format: { hideZeroItems: true },
    });
    assert.ok(!result.includes('Snack: 0'));
  });
});