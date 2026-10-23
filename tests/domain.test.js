/**
 * @file Tests for domain logic
 * Run with: node --test tests/domain.test.js
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeQuantity } from '../js/domain/quantity.js';
import { Order } from '../js/domain/Order.js';
import { calculateOrder } from '../js/domain/calculate.js';
import { MENU, CATEGORIES, METRICS, MAX_SERVINGS } from '../js/config.js';

describe('sanitizeQuantity', () => {
  test('số nguyên dương', () => assert.strictEqual(sanitizeQuantity(5), 5));
  test('string số', () => assert.strictEqual(sanitizeQuantity('12'), 12));
  test('string có chữ', () => assert.strictEqual(sanitizeQuantity('12abc'), 12));
  test('string chỉ chữ', () => assert.strictEqual(sanitizeQuantity('abc'), 0));
  test('null/undefined', () => assert.strictEqual(sanitizeQuantity(null), 0));
  test('số âm -> 0', () => assert.strictEqual(sanitizeQuantity(-5), 0));
  test('float -> floor', () => assert.strictEqual(sanitizeQuantity(3.9), 3));
  test('clamp max', () => assert.strictEqual(sanitizeQuantity(MAX_SERVINGS + 100), MAX_SERVINGS));
  test('NaN -> 0', () => assert.strictEqual(sanitizeQuantity(NaN), 0));
  test('Infinity -> 0 (giữ hành vi cũ)', () => assert.strictEqual(sanitizeQuantity(Infinity), 0));
});

describe('Order', () => {
  let order;

  beforeEach(() => {
    order = new Order(MENU);
  });

  test('khởi tạo servings = 0', () => {
    for (const item of MENU) {
      assert.strictEqual(order.getServings(item.id), 0);
    }
  });

  test('setServings cập nhật và notify', () => {
    let notified = false;
    order.subscribe(() => { notified = true; });
    order.setServings(MENU[0].id, 3);
    assert.strictEqual(order.getServings(MENU[0].id), 3);
    assert.strictEqual(notified, true);
  });

  test('setServings cùng giá trị không notify (force=false)', () => {
    order.setServings(MENU[0].id, 3);
    let notified = false;
    order.subscribe(() => { notified = true; });
    order.setServings(MENU[0].id, 3);
    assert.strictEqual(notified, false);
  });

  test('setServings force=true luôn notify', () => {
    order.setServings(MENU[0].id, 3);
    let notified = false;
    order.subscribe(() => { notified = true; });
    order.setServings(MENU[0].id, 3, true);
    assert.strictEqual(notified, true);
  });

  test('adjustServings tăng/giảm', () => {
    order.setServings(MENU[0].id, 2);
    assert.strictEqual(order.adjustServings(MENU[0].id, 1), 3);
    assert.strictEqual(order.adjustServings(MENU[0].id, -2), 1);
  });

  test('getTotals chỉ tính nhóm hasYields', () => {
    order.setServings('hoanh-thanh-ly-nuoc-cay', 2); // 10 water
    order.setServings('hoanh-thanh-chien', 3); // 15 fried
    order.setServings('snack', 5); // không tính
    const totals = order.getTotals();
    assert.strictEqual(totals.water, 10);
    assert.strictEqual(totals.fried, 15);
    assert.strictEqual(totals.servings, 5);
  });

  test('reset về 0', () => {
    order.setServings(MENU[0].id, 5);
    order.reset();
    for (const item of MENU) {
      assert.strictEqual(order.getServings(item.id), 0);
    }
  });

  test('isEmpty', () => {
    assert.strictEqual(order.isEmpty(), true);
    order.setServings('snack', 1);
    assert.strictEqual(order.isEmpty(), false);
    order.reset();
    assert.strictEqual(order.isEmpty(), true);
  });

  test('toJSON trả về plain object', () => {
    order.setServings(MENU[0].id, 3);
    const json = order.toJSON();
    assert.strictEqual(json[MENU[0].id], 3);
    assert.ok(!(json instanceof Map));
  });
});

describe('calculateOrder (generic theo METRICS)', () => {
  test('tính đúng water/fried từ menu hiện tại', () => {
    const servings = {
      'hoanh-thanh-ly-nuoc-cay': 2, // water: 5*2=10
      'hoanh-thanh-chien': 3, // fried: 5*3=15
    };
    const totals = calculateOrder(servings, MENU, CATEGORIES, METRICS);
    assert.strictEqual(totals.water, 10);
    assert.strictEqual(totals.fried, 15);
    assert.strictEqual(totals.servings, 5);
  });

  test('metric mới: thêm metric (mock)', () => {
    const categories = [{ id: 'cat', hasYields: true }, { id: 'other', hasYields: false }];
    const menu = [
      { id: 'a', category: 'cat', yields: { water: 2, fried: 1, steam: 3 } },
      { id: 'b', category: 'cat', yields: { water: 0, fried: 4, steam: 1 } },
      { id: 'c', category: 'other', yields: {} },
    ];
    const metrics = [
      { id: 'water', label: 'Nước' },
      { id: 'fried', label: 'Chiên' },
      { id: 'steam', label: 'Hấp' },
    ];
    const totals = calculateOrder({ a: 1, b: 1, c: 9 }, menu, categories, metrics);
    assert.strictEqual(totals.water, 2);
    assert.strictEqual(totals.fried, 5);
    assert.strictEqual(totals.steam, 4);
    assert.strictEqual(totals.servings, 2); // chỉ 2 món hasYields
  });
});
