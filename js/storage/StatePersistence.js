/**
 * @file StatePersistence - auto-save với debounce, báo trạng thái qua callback
 * Phụ thuộc interface { load, save } của repository.
 */

import { SaveState } from './SaveState.js';

/**
 * Auto-save với debounce, báo trạng thái qua callback.
 */
export class StatePersistence {
  /**
   * @param {Object} deps
   * @param {{ load: Function, save: Function }} deps.repository
   * @param {(state: string) => void} deps.onStatusChange
   * @param {number} [deps.debounceMs=250]
   */
  constructor({ repository, onStatusChange, debounceMs = 250 }) {
    this._repo = repository;
    this._onStatusChange = onStatusChange;
    this._debounceMs = debounceMs;
    this._timer = null;
    this._works = true;
  }

  /** @returns {Promise<any>} */
  async load() {
    try {
      const data = await this._repo.load();
      this._works = true;
      if (data) this._onStatusChange(SaveState.SAVED);
      return data;
    } catch {
      this._works = false;
      this._onStatusChange(SaveState.ERROR);
      return null;
    }
  }

  /** @param {any} data */
  save(data) {
    if (!this._works) {
      this._onStatusChange(SaveState.ERROR);
      return;
    }
    this._onStatusChange(SaveState.SAVING);
    clearTimeout(this._timer);
    this._timer = setTimeout(async () => {
      try {
        await this._repo.save(data);
        this._works = true;
        this._onStatusChange(SaveState.SAVED);
      } catch {
        this._works = false;
        this._onStatusChange(SaveState.ERROR);
      }
    }, this._debounceMs);
  }
}

/**
 * Lắng nghe thay đổi localStorage từ tab khác.
 * @param {string} key
 * @param {() => void} callback
 * @returns {() => void} unsubscribe
 */
export function onStorageChange(key, callback) {
  const handler = (e) => {
    if (e.key === key) callback();
  };
  globalThis.addEventListener('storage', handler);
  return () => globalThis.removeEventListener('storage', handler);
}