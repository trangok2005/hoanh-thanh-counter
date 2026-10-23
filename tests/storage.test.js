/**
 * @file Tests for storage: repository + persistence
 * Run with: node --test tests/storage.test.js
 */

import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  LocalStorageRepository,
  ReportStorageRepository,
} from '../js/storage/LocalStorageRepository.js';
import { StatePersistence } from '../js/storage/StatePersistence.js';
import { SaveState } from '../js/storage/SaveState.js';
import { STORAGE_KEY, REPORT_STORAGE_KEY } from '../js/config.js';

function stubStorage() {
  const store = {};
  globalThis.localStorage = {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
  return store;
}

describe('LocalStorageRepository', () => {
  let repo;
  let store;

  beforeEach(() => {
    store = stubStorage();
    repo = new LocalStorageRepository();
  });

  test('load returns null khi chưa có data', async () => {
    const data = await repo.load();
    assert.strictEqual(data, null);
  });

  test('load parse data v1 hợp lệ', async () => {
    store[STORAGE_KEY] = JSON.stringify({
      version: 1,
      servings: { 'hoanh-thanh-ly-nuoc-cay': 5, 'hoanh-thanh-chien': 3 },
    });
    const data = await repo.load();
    assert.ok(data);
    assert.strictEqual(data.version, 1);
    assert.strictEqual(data.servings['hoanh-thanh-ly-nuoc-cay'], 5);
  });

  test('load bỏ qua version sai', async () => {
    store[STORAGE_KEY] = JSON.stringify({ version: 2, servings: {} });
    assert.strictEqual(await repo.load(), null);
  });

  test('load bỏ qua JSON hỏng', async () => {
    store[STORAGE_KEY] = '{not json';
    assert.strictEqual(await repo.load(), null);
  });

  test('save ghi dữ liệu', async () => {
    await repo.save({ version: 1, servings: { a: 1 } });
    const saved = JSON.parse(store[STORAGE_KEY]);
    assert.strictEqual(saved.version, 1);
    assert.strictEqual(saved.servings.a, 1);
  });
});

describe('ReportStorageRepository', () => {
  let repo;
  let store;

  beforeEach(() => {
    store = stubStorage();
    repo = new ReportStorageRepository();
  });

  test('save tự thêm version', async () => {
    await repo.save({ date: '2026-10-22', payments: {}, expenses: [], cancel: {} });
    const saved = JSON.parse(store[REPORT_STORAGE_KEY]);
    assert.strictEqual(saved.version, 1);
    assert.strictEqual(saved.date, '2026-10-22');
  });

  test('load bỏ qua version sai', async () => {
    store[REPORT_STORAGE_KEY] = JSON.stringify({ version: 9, date: 'x' });
    assert.strictEqual(await repo.load(), null);
  });

  test('load trả data hợp lệ', async () => {
    store[REPORT_STORAGE_KEY] = JSON.stringify({ version: 1, date: '2026-10-22' });
    const data = await repo.load();
    assert.strictEqual(data.date, '2026-10-22');
  });
});

describe('StatePersistence', () => {
  let persistence;
  let mockRepo;
  let statusChanges;

  beforeEach(() => {
    statusChanges = [];
    mockRepo = {
      load: mock.fn(async () => null),
      save: mock.fn(async () => {}),
    };
    persistence = new StatePersistence({
      repository: mockRepo,
      onStatusChange: (s) => statusChanges.push(s),
      debounceMs: 10,
    });
  });

  test('load gọi repo.load', async () => {
    mockRepo.load.mock.mockImplementation(async () => ({
      version: 1,
      servings: { a: 1 },
    }));
    const data = await persistence.load();
    assert.ok(data);
    assert.strictEqual(mockRepo.load.mock.callCount(), 1);
  });

  test('load lỗi -> status ERROR, trả null', async () => {
    mockRepo.load.mock.mockImplementation(async () => { throw new Error('boom'); });
    const data = await persistence.load();
    assert.strictEqual(data, null);
    assert.ok(statusChanges.includes(SaveState.ERROR));
  });

  test('save debounce: chỉ gọi save 1 lần sau nhiều lần save()', async () => {
    const payload = { version: 1, servings: { a: 1 } };
    persistence.save({ ...payload, servings: { a: 1 } });
    persistence.save({ ...payload, servings: { a: 2 } });
    persistence.save({ ...payload, servings: { a: 3 } });
    assert.strictEqual(mockRepo.save.mock.callCount(), 0);
    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(mockRepo.save.mock.callCount(), 1);
    const saved = mockRepo.save.mock.calls[0].arguments[0];
    assert.strictEqual(saved.servings.a, 3);
  });

  test('save báo status: saving -> saved', async () => {
    persistence.save({ version: 1, servings: {} });
    assert.strictEqual(statusChanges[0], SaveState.SAVING);
    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(statusChanges[1], SaveState.SAVED);
  });

  test('save báo error khi repo.save throw', async () => {
    mockRepo.save.mock.mockImplementation(async () => { throw new Error('quota'); });
    persistence.save({ version: 1, servings: {} });
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(statusChanges.includes(SaveState.ERROR));
  });

  test('sau lỗi -> save tiếp theo báo error ngay', async () => {
    mockRepo.save.mock.mockImplementation(async () => { throw new Error('quota'); });
    persistence.save({ version: 1, servings: {} });
    await new Promise((r) => setTimeout(r, 20));
    statusChanges.length = 0;
    persistence.save({ version: 1, servings: {} });
    assert.strictEqual(statusChanges[0], SaveState.ERROR);
  });
});
