/**
 * @file Report formatter - hàm thuần, 1 nơi duy nhất định nghĩa định dạng xuất báo cáo
 * Không import ai/ui/storage, không đụng DOM.
 */

import { METRICS, REPORT_GROUPS, PAYMENT_CHANNELS } from '../config.js';
import { formatDateDDMM } from './quantity.js';
import { calculateRevenue, calculateByReportGroup } from './calculate.js';

const numberFormat = new Intl.NumberFormat('vi-VN');

/**
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  return numberFormat.format(n);
}

/**
 * Format báo cáo thành string
 * @param {Object} param
 * @param {Object} param.report - snapshot từ Report: { date, title, payments, expenses, cancel, cancelReason }
 * @param {Object.<string, number>} param.orderServings - servingsMap từ Order
 * @param {import('../config.js').MenuItem[]} param.menu
 * @param {import('../config.js').ReportGroup[]} [param.reportGroups=REPORT_GROUPS]
 * @param {import('../config.js').PaymentChannel[]} [param.channels=PAYMENT_CHANNELS]
 * @param {import('../config.js').Metric[]} [param.metrics=METRICS]
 * @returns {string}
 */
export function formatReport({
  report,
  orderServings,
  menu,
  reportGroups = REPORT_GROUPS,
  channels = PAYMENT_CHANNELS,
  metrics = METRICS,
}) {
  const lines = [];

  // Header
  const dateStr = formatDateDDMM(report.date);
  lines.push(`Báo cáo doanh thu ${report.title} ngày ${dateStr}`);

  // Doanh thu
  const { total, byChannel } = calculateRevenue(report, channels);
  lines.push(`Tổng DT: ${formatNumber(total)}`);
  for (const ch of channels) {
    const v = byChannel[ch.id] ?? 0;
    if (v !== 0) lines.push(`${ch.label}: ${formatNumber(v)}`);
  }

  // Dòng trống
  lines.push('');

  // Phiếu chi
  const expenses = report.expenses || [];
  const validExpenses = expenses.filter((e) => (e.amount || 0) > 0);
  if (validExpenses.length > 0) {
    lines.push('Chi:');
    for (const exp of validExpenses) {
      const reason = (exp.reason || '').trim();
      if (reason) {
        lines.push(`- ${reason}: ${formatNumber(exp.amount)}đ`);
      } else {
        lines.push(`- ${formatNumber(exp.amount)}đ`);
      }
    }
    lines.push('');
  }

  // Các nhóm món - chỉ hiện nhóm có số lượng > 0
  const byGroup = calculateByReportGroup(orderServings, menu, reportGroups);
  let hasGroup = false;
  for (const group of reportGroups) {
    const count = byGroup[group.id] ?? 0;
    if (count === 0) continue;
    lines.push(`${group.label}: ${count}`);
    hasGroup = true;
  }
  if (hasGroup) lines.push('');

  // Huỷ - chỉ hiện nếu có huỷ > 0
  const cancelParts = [];
  for (const m of metrics) {
    const qty = report.cancel?.[m.id] ?? 0;
    if (qty > 0) cancelParts.push(`${qty} ${m.cancelLabel}`);
  }
  if (cancelParts.length > 0) {
    let cancelLine = `Huỷ ${cancelParts.join(' + ')}`;
    if (report.cancelReason && report.cancelReason.trim()) {
      cancelLine += ` (${report.cancelReason.trim()})`;
    }
    lines.push(cancelLine);
  }

  // Bỏ dòng trống thừa ở cuối
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n');
}

