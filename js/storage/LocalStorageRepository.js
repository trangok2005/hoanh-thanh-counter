/**
 * @file LocalStorageRepository - repository cho localStorage
 * Chỉ phụ thuộc key và version, không biết nghiệp vụ.
 */

import { STORAGE_KEY, REPORT_STORAGE_KEY } from '../config.js';

/**
 * @typedef {Object} StorageData
 * @property {number} version
 * @property {Object.<string, number>} servings
 */

/**
 * Repository localStorage cho Order
 */
export class LocalStorageRepository {
  /**
   * @param {string} [key=STORAGE_KEY]
   * @param {number} [version=1]
   */
  constructor(key = STORAGE_KEY, version = 1) {
    this.key = key;
    this.version = version;
  }

  /**
   * @returns {Promise<StorageData | null>}
   */
  async load() {
    try {
      const raw = globalThis.localStorage.getItem(this.key);
      if (!raw) return null;

      const data = JSON.parse(raw);
      if (data && typeof data === 'object' && data.version === this.version &&
          data.servings && typeof data.servings === 'object') {
        return data;
      }
    } catch {
      // dữ liệu hỏng: bỏ qua
    }
    return null;
  }

  /**
   * @param {StorageData} data
   */
  async save(data) {
    globalThis.localStorage.setItem(this.key, JSON.stringify(data));
  }
}

/**
 * Repository localStorage cho Report
 */
export class ReportStorageRepository {
  /**
   * @param {string} [key=REPORT_STORAGE_KEY]
   * @param {number} [version=1]
   */
  constructor(key = REPORT_STORAGE_KEY, version = 1) {
    this.key = key;
    this.version = version;
  }

  /**
   * @returns {Promise<Object | null>}
   */
  async load() {
    try {
      const raw = globalThis.localStorage.getItem(this.key);
      if (!raw) return null;

      const data = JSON.parse(raw);
      if (data && typeof data === 'object' && data.version === this.version) {
        return data;
      }
    } catch {
      // dữ liệu hỏng: bỏ qua
    }
    return null;
  }

  /**
   * @param {Object} data
   */
  async save(data) {
    const payload = { version: this.version, ...data };
    globalThis.localStorage.setItem(this.key, JSON.stringify(payload));
  }
}