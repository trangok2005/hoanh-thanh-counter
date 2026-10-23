/**
 * @file Tabs - thanh tab với ARIA, điều hướng phím, lưu hash
 */

import { el, svgIcon } from './dom.js';

/**
 * @typedef {Object} TabConfig
 * @property {string} id
 * @property {string} label
 * @property {string} panelId
 */

/**
 * @param {Object} deps
 * @param {HTMLElement} deps.container - element chứa tablist
 * @param {TabConfig[]} deps.tabs
 * @param {(tabId: string) => void} deps.onChange
 */
export class Tabs {
  constructor({ container, tabs, onChange }) {
    this.tabs = tabs;
    this.onChange = onChange;
    this.currentTab = null;

    // Build tablist
    this.tablist = el('div', 'tablist');
    this.tablist.setAttribute('role', 'tablist');
    this.tablist.setAttribute('aria-label', 'Chức năng chính');
    container.appendChild(this.tablist);

    this.tabButtons = new Map();
    this.panels = new Map();

    for (const tab of tabs) {
      const btn = el('button', 'tab-btn', tab.label);
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('aria-controls', tab.panelId);
      btn.id = `tab-btn-${tab.id}`;
      btn.dataset.tabId = tab.id;
      this.tablist.appendChild(btn);
      this.tabButtons.set(tab.id, btn);

      const panel = document.getElementById(tab.panelId);
      if (panel) {
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', btn.id);
        panel.hidden = true;
        this.panels.set(tab.id, panel);
      }

      btn.addEventListener('click', () => this.select(tab.id));
      btn.addEventListener('keydown', (e) => this.handleKeydown(e, tab.id));
    }

    // Khôi phục từ hash hoặc chọn tab đầu tiên
    const hash = location.hash.slice(1);
    const initialTab = this.tabButtons.has(hash) ? hash : tabs[0].id;
    this.select(initialTab);

    // Lắng nghe hash change
    window.addEventListener('hashchange', () => {
      const hash = location.hash.slice(1);
      if (this.tabButtons.has(hash)) this.select(hash);
    });
  }

  /** @param {string} tabId */
  select(tabId) {
    if (!this.tabButtons.has(tabId)) return;
    if (this.currentTab === tabId) return;

    // Deactivate current
    if (this.currentTab) {
      const prevBtn = this.tabButtons.get(this.currentTab);
      const prevPanel = this.panels.get(this.currentTab);
      if (prevBtn) {
        prevBtn.setAttribute('aria-selected', 'false');
        prevBtn.classList.remove('is-active');
      }
      if (prevPanel) prevPanel.hidden = true;
    }

    // Activate new
    const btn = this.tabButtons.get(tabId);
    const panel = this.panels.get(tabId);
    if (btn) {
      btn.setAttribute('aria-selected', 'true');
      btn.classList.add('is-active');
    }
    if (panel) panel.hidden = false;

    this.currentTab = tabId;
    location.hash = tabId;
    this.onChange(tabId);
  }

  /** @param {KeyboardEvent} e @param {string} currentId */
  handleKeydown(e, currentId) {
    const ids = this.tabs.map((t) => t.id);
    const idx = ids.indexOf(currentId);
    if (idx === -1) return;

    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % ids.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = ids.length - 1;
    else return;

    e.preventDefault();
    this.select(ids[nextIdx]);
    this.tabButtons.get(ids[nextIdx])?.focus();
  }

  /** @returns {string} */
  getCurrentTab() {
    return this.currentTab;
  }
}