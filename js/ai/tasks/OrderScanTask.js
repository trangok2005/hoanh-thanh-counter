/**
 * @file OrderScanTask - ScanTask cho quét món: buildPrompt + parse
 * Điểm mở rộng cho "scan báo cáo sau này"
 */

import { CATEGORIES, MENU } from '../../config.js';
import { sanitizeQuantity } from '../../domain/quantity.js';
import { parseScanResponse } from '../parser.js';

/**
 * Xây dựng system prompt từ menu và categories
 * @param {import('../../config.js').MenuItem[]} menu
 * @param {import('../../config.js').Category[]} categories
 * @returns {string}
 */
export function buildPrompt(menu, categories) {
  const lines = [];

  for (const cat of categories) {
    const itemsInCat = menu.filter((item) => item.category === cat.id);
    if (itemsInCat.length === 0) continue;

    lines.push(`\n=== ${cat.label.toUpperCase()} ===`);

    for (const item of itemsInCat) {
      const aliases = (item.aliases || [item.name]).map((n) => `"${n}"`).join(' / ');
      const hints = item.hints?.length ? ` — ${item.hints.join('; ')}` : '';
      lines.push(`- id "${item.id}" ← ${aliases}${hints}`);
    }
  }

  return [
    'Bạn là AI đọc ảnh báo cáo bán hàng hoặc phiếu đơn hàng của quán hoành thánh.',
    'Ảnh có thể là ảnh chụp màn hình POS hoặc ảnh chụp bằng điện thoại.',
    '',
    'NHIỆM VỤ',
    `Chỉ trích số lượng của ${menu.length} món trong danh sách dưới đây.`,
    'Bỏ qua mọi món không thuộc danh sách.',
    '',
    'DANH SÁCH MÓN:',
    lines.join('\n'),
    '',
    'QUY TẮC:',
    '- Chỉ đọc cột "Số lượng".',
    '- Không lấy giá tiền, doanh thu, giờ, số bàn hoặc bất kỳ con số nào khác làm số lượng.',
    '- Nếu ảnh bị lệch hàng, ghép tên món với số lượng theo đúng thứ tự từ trên xuống.',
    '- Chỉ ghép khi tên khớp rõ với một alias trong danh sách, không được đoán.',
    '- Tên trên màn hình có thể kèm dung tích/quy cách hoặc viết hoa; khớp nếu phần tên chính trùng alias.',
    '- Phân biệt chính xác các món dễ nhầm (ví dụ: Cay / Không Cay, Ly Nước / Ly Chiên...).',
    '- Các món trong danh sách đều phải trích, kể cả đồ uống, nước và sữa.',
    '- Nếu cùng một món xuất hiện nhiều dòng thì cộng số lượng.',
    '- Mỗi id chỉ xuất hiện một lần trong items.',
    '- Nếu món trong danh sách không xuất hiện thì không trả về.',
    '- Món ngoài danh sách thì bỏ qua hoàn toàn.',
    '- Khi số lượng khó đọc có thể đối chiếu doanh thu để kiểm tra tính hợp lý, nhưng TUYỆT ĐỐI không dùng doanh thu làm số lượng.',
    '- unmatched chỉ dùng cho dòng thuộc nhóm món của quán nhưng không chắc tên hoặc số lượng; món ngoài danh sách KHÔNG đưa vào unmatched.',
    '',
    'KẾT QUẢ:',
    'Chỉ trả về JSON hợp lệ, không giải thích.',
    '',
    '{',
    '  "items": [',
    '    {',
    '      "id": "menu-id",',
    '      "servings": 1',
    '    }',
    '  ],',
    '  "unmatched": [',
    '    "Tên dòng - lý do"',
    '  ]',
    '}',
  ].join('\n');
}

/**
 * Parse text trả về từ AI cho OrderScanTask
 * @param {string} text - text thô từ model (có thể bọc trong ```json ... ```)
 * @param {import('../../config.js').MenuItem[]} menu
 * @returns {Promise<{ items: {id: string, servings: number}[], unmatched: string[] }>}
 */
export async function parse(text, menu) {
  return parseScanResponse(text, menu);
}

/** @type {import('../../config.js').ScanTask} */
export const OrderScanTask = {
  buildPrompt,
  parse,
};