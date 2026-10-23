/**
 * @file Tests for buildPrompt (OrderScanTask)
 * Run with: node --test tests/prompt.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from '../js/ai/tasks/OrderScanTask.js';
import { MENU, CATEGORIES } from '../js/config.js';

describe('buildPrompt', () => {
  test('prompt chứa đúng số món từ MENU', () => {
    const prompt = buildPrompt(MENU, CATEGORIES);
    const menuLines = prompt.match(/- id "/g) || [];
    assert.strictEqual(menuLines.length, MENU.length);
  });

  test('prompt chứa alias của từng món', () => {
    const prompt = buildPrompt(MENU, CATEGORIES);
    for (const item of MENU) {
      for (const alias of item.aliases) {
        assert.ok(prompt.includes(alias), `Missing alias: ${alias}`);
      }
    }
  });

  test('prompt nhóm món theo category', () => {
    const prompt = buildPrompt(MENU, CATEGORIES);
    for (const cat of CATEGORIES) {
      assert.ok(prompt.includes(cat.label.toUpperCase()), `Missing category: ${cat.label}`);
    }
  });

  test('prompt chứa hints nếu có', () => {
    const menuWithHints = [
      {
        id: 'test',
        name: 'Test',
        variant: null,
        category: 'ht',
        yields: { water: 1, fried: 0 },
        aliases: ['Alias'],
        hints: ['hint 1', 'hint 2'],
      },
    ];
    const prompt = buildPrompt(menuWithHints, CATEGORIES);
    assert.ok(prompt.includes('hint 1'));
    assert.ok(prompt.includes('hint 2'));
  });

  test('không cắt alias/hint khi món có nhiều', () => {
    const menuWithMany = [
      {
        id: 'test',
        name: 'Test',
        variant: null,
        category: 'ht',
        yields: { water: 1, fried: 0 },
        aliases: ['Alias 1', 'Alias 2', 'Alias 3', 'Alias 4'],
        hints: ['hint 1', 'hint 2', 'hint 3'],
      },
    ];
    const prompt = buildPrompt(menuWithMany, CATEGORIES);
    for (const alias of menuWithMany[0].aliases) assert.ok(prompt.includes(alias));
    for (const hint of menuWithMany[0].hints) assert.ok(prompt.includes(hint));
  });

  test('prompt chứa quy tắc chung (không hardcode số món)', () => {
    const prompt = buildPrompt(MENU, CATEGORIES);
    assert.ok(prompt.includes('Bỏ qua mọi món không thuộc danh sách'));
    assert.ok(prompt.toLowerCase().includes('doanh thu'));
    assert.ok(prompt.includes('cộng số lượng'));
    assert.ok(prompt.includes('Không Cay'));
    assert.ok(prompt.includes('KHÔNG đưa vào unmatched'));
    assert.ok(prompt.includes('Mỗi id chỉ xuất hiện một lần'));
  });

  test('thêm món mới vào config -> prompt tự cập nhật', () => {
    const extendedMenu = [...MENU, {
      id: 'mon-moi',
      name: 'Món mới',
      variant: null,
      category: 'ht',
      yields: { water: 1, fried: 1 },
      aliases: ['Mon Moi'],
      hints: [],
    }];
    const prompt = buildPrompt(extendedMenu, CATEGORIES);
    const menuLines = prompt.match(/- id "/g) || [];
    assert.strictEqual(menuLines.length, MENU.length + 1);
    assert.ok(prompt.includes('Mon Moi'));
  });
});
