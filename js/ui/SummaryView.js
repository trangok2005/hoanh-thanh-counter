/**
 * @file SummaryView - hiển thị tổng nước/chiên/phần + hiệu ứng bump
 */

import { setStat, formatNumber } from './dom.js';

/**
 * @typedef {Object} SummaryElements
 * @property {HTMLElement} totalWater - #total-water
 * @property {HTMLElement} totalFried - #total-fried
 * @property {HTMLElement} totalServings - #total-servings
 * @property {HTMLElement} emptyHint - #empty-hint
 */

export class SummaryView {
  /**
   * @param {SummaryElements} elements
   */
  constructor(elements) {
    this.totalWater = elements.totalWater;
    this.totalFried = elements.totalFried;
    this.totalServings = elements.totalServings;
    this.emptyHint = elements.emptyHint;
  }

  /**
   * @param {Object} totals - { water, fried, servings }
   * @param {boolean} [isEmpty] - true nếu chưa có món nào > 0 (mọi nhóm)
   */
  render(totals, isEmpty = totals.servings === 0) {
    setStat(this.totalWater, totals.water);
    setStat(this.totalFried, totals.fried);
    this.totalServings.textContent = formatNumber(totals.servings) + ' phần';
    this.emptyHint.hidden = !isEmpty;
  }
}