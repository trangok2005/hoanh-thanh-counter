/**
 * @file Tests for AI parser
 * Run with: node --test tests/parser.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseScanResponse } from '../js/ai/parser.js';
import { MENU } from '../js/config.js';

describe('parseScanResponse', () => {
  test('parse JSON thuần', () => {
    const text = '{"items":[{"id":"hoanh-thanh-ly-nuoc-cay","servings":3},{"id":"hoanh-thanh-chien","servings":2}],"unmatched":[]}';
    const result = parseScanResponse(text, MENU);
    assert.strictEqual(result.items.length, 2);
    assert.strictEqual(result.items[0].id, 'hoanh-thanh-ly-nuoc-cay');
    assert.strictEqual(result.items[0].servings, 3);
    assert.strictEqual(result.items[1].id, 'hoanh-thanh-chien');
    assert.strictEqual(result.items[1].servings, 2);
    assert.strictEqual(result.unmatched.length, 0);
  });

  test('bóc code fence ```json', () => {
    const text = '```json\n{"items":[{"id":"hoanh-thanh-ly-nuoc-cay","servings":1}],"unmatched":[]}\n```';
    const result = parseScanResponse(text, MENU);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].servings, 1);
  });

  test('bóc code fence không có json', () => {
    const text = '```\n{"items":[{"id":"hoanh-thanh-ly-nuoc-cay","servings":1}],"unmatched":[]}\n```';
    const result = parseScanResponse(text, MENU);
    assert.strictEqual(result.items.length, 1);
  });

  test('lọc id không có trong menu', () => {
    const text = '{"items":[{"id":"hoanh-thanh-ly-nuoc-cay","servings":2},{"id":"mon-khong-ton-tai","servings":5}],"unmatched":[]}';
    const result = parseScanResponse(text, MENU);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].id, 'hoanh-thanh-ly-nuoc-cay');
  });

  test('sanitize số lượng: âm -> bỏ, quá lớn -> clamp', () => {
    const text = '{"items":[{"id":"hoanh-thanh-ly-nuoc-cay","servings":-3},{"id":"hoanh-thanh-chien","servings":99999}],"unmatched":[]}';
    const result = parseScanResponse(text, MENU);
    // -3 -> 0 -> bỏ
    // 99999 -> clamp 9999
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].id, 'hoanh-thanh-chien');
    assert.strictEqual(result.items[0].servings, 9999);
  });

  test('cộng dòng trùng id', () => {
    const text = '{"items":[{"id":"hoanh-thanh-ly-nuoc-cay","servings":2},{"id":"hoanh-thanh-ly-nuoc-cay","servings":3}],"unmatched":[]}';
    const result = parseScanResponse(text, MENU);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].servings, 5);
  });

  test('unmatched: lọc string rỗng', () => {
    const text = '{"items":[],"unmatched":["dòng 1", "", "  ", "dòng 2"]}';
    const result = parseScanResponse(text, MENU);
    assert.strictEqual(result.unmatched.length, 2);
    assert.strictEqual(result.unmatched[0], 'dòng 1');
    assert.strictEqual(result.unmatched[1], 'dòng 2');
  });

  test('JSON hỏng -> throw', () => {
    assert.throws(() => parseScanResponse('{not json}', MENU), /không đọc được/);
  });

  test('items không phải mảng -> items rỗng', () => {
    const text = '{"items":"not array","unmatched":[]}';
    const result = parseScanResponse(text, MENU);
    assert.strictEqual(result.items.length, 0);
  });

  test('servings không phải số -> bỏ qua', () => {
    const text = '{"items":[{"id":"hoanh-thanh-ly-nuoc-cay","servings":"abc"}],"unmatched":[]}';
    const result = parseScanResponse(text, MENU);
    assert.strictEqual(result.items.length, 0);
  });
});