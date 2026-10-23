/**
 * @file Cấu hình tĩnh: menu món ăn, chỉ số tính toán, cấu hình AI, báo cáo
 * Thêm món/nhóm/chỉ số/kênh thanh toán/provider = sửa file này, không đụng logic.
 */

/**
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} label
 * @property {boolean} hasYields
 */

/** @type {Category[]} */
export const CATEGORIES = [
  { id: 'ht', label: 'Món có HT', hasYields: true },
  { id: 'other', label: 'Món khác', hasYields: false },
  { id: 'milk', label: 'Sữa', hasYields: false },
];

/**
 * @typedef {Object} Metric
 * @property {string} id
 * @property {string} label
 * @property {string} cancelLabel
 */

/** @type {Metric[]} */
export const METRICS = [
  { id: 'water', label: 'Nước', cancelLabel: 'nước' },
  { id: 'fried', label: 'Chiên', cancelLabel: 'chiên' },
];

/**
 * @typedef {Object} PaymentChannel
 * @property {string} id
 * @property {string} label
 */

/** @type {PaymentChannel[]} */
export const PAYMENT_CHANNELS = [
  { id: 'ck', label: 'CK' },
  { id: 'tm', label: 'TM' },
  { id: 'the', label: 'Thẻ' },
  { id: 'grab', label: 'Grab' },
  { id: 'shopee', label: 'Shopee' },
];

/**
 * @typedef {Object} ReportGroup
 * @property {string} id
 * @property {string} label
 */

/** @type {ReportGroup[]} */
export const REPORT_GROUPS = [
  { id: 'ht-nuoc', label: 'HT nước' },
  { id: 'mi-ly', label: 'Mì tươi ht ly' },
  { id: 'ht-chien', label: 'HT chiên' },
  { id: 'ht-ky-phung', label: 'HT kỳ phùng' },
  { id: 'bun-bo', label: 'Bún Bò' },
  { id: 'snack', label: 'Snack' },
  { id: 'xi-quach', label: 'Xí quách' },
  { id: 'sua-nang-tho', label: 'Sữa nàng thơ' },
  { id: 'sua-chien-binh', label: 'Sữa chiến binh' },
];

/**
 * @typedef {Object} ReportFormat
 * @property {boolean} hideZeroItems
 */

/** @type {ReportFormat} */
export const REPORT_FORMAT = {
  hideZeroItems: false,
};

/** @type {{ value: string, label: string }[]} */
export const REPORT_TITLES = [
  { value: 'sáng', label: 'Sáng' },
  { value: 'full', label: 'Full' },
];

/**
 * @typedef {Object} MenuItem
 * @property {string} id - Khóa duy nhất, dùng làm key trong localStorage
 * @property {string} name - Tên món hiển thị (ví dụ: "Hoành thánh ly nước")
 * @property {string|null} variant - Phân loại (ví dụ: "Cay", "Không cay") hoặc null
 * @property {string} category - id trong CATEGORIES
 * @property {Object.<string, number>} yields - Map metricId -> số viên/phần (ví dụ: { water: 5, fried: 0 })
 * @property {string[]} aliases - Các tên gọi thay thế trên POS để AI nhận diện
 * @property {string[]} hints - Quy tắc riêng cho AI của món này (tuỳ chọn)
 * @property {string} reportGroup - id nhóm trong REPORT_GROUPS
 */

/** @type {MenuItem[]} */
export const MENU = [
  // --- NHÓM HT (hasYields: true) ---
  {
    id: 'hoanh-thanh-ly-nuoc-cay',
    name: 'Hoành thánh ly nước',
    variant: 'Cay',
    category: 'ht',
    yields: { water: 5, fried: 0 },
    aliases: ['Hoành Thánh Ly Nước Cay'],
    hints: ['Khác "Hoành Thánh Chiên" và "Hoành Thánh Kỳ Phùng Ly"'],
    reportGroup: 'ht-nuoc',
  },
  {
    id: 'hoanh-thanh-ly-nuoc-khong-cay',
    name: 'Hoành thánh ly nước',
    variant: 'Không cay',
    category: 'ht',
    yields: { water: 5, fried: 0 },
    aliases: ['Hoành Thánh Ly Nước Không Cay'],
    hints: ['Khác "Hoành Thánh Chiên" và "Hoành Thánh Kỳ Phùng Ly"'],
    reportGroup: 'ht-nuoc',
  },
  {
    id: 'hoanh-thanh-ky-phung-cay',
    name: 'Hoành thánh Kỳ Phùng',
    variant: 'Cay',
    category: 'ht',
    yields: { water: 2, fried: 3 },
    aliases: ['Hoành Thánh Kỳ Phùng Ly Cay'],
    hints: ['Là dòng có chữ "Kỳ Phùng" (có thể bị cắt chữ "Phùng"), khác Ly Nước và Chiên'],
    reportGroup: 'ht-ky-phung',
  },
  {
    id: 'hoanh-thanh-ky-phung-khong-cay',
    name: 'Hoành thánh Kỳ Phùng',
    variant: 'Không cay',
    category: 'ht',
    yields: { water: 2, fried: 3 },
    aliases: ['Hoành Thánh Kỳ Phùng Ly Không Cay'],
    hints: ['Là dòng có chữ "Kỳ Phùng" (có thể bị cắt chữ "Phùng"), khác Ly Nước và Chiên'],
    reportGroup: 'ht-ky-phung',
  },
  {
    id: 'hoanh-thanh-chien',
    name: 'Hoành thánh chiên',
    variant: null,
    category: 'ht',
    yields: { water: 0, fried: 5 },
    aliases: ['Hoành Thánh Chiên'],
    hints: ['Tên trên máy là "Hoành Thánh Chiên", có thể ghi "Ly Chiên"; khác Ly Nước'],
    reportGroup: 'ht-chien',
  },
  {
    id: 'my-ly-hoanh-thanh',
    name: 'Mì tươi hoành thánh ly',
    variant: null,
    category: 'ht',
    yields: { water: 3, fried: 0 },
    aliases: ['Mì tươi hoành thánh ly'],
    hints: ['"Mì tươi hoành thánh ly" = my-ly-hoanh-thanh'],
    reportGroup: 'mi-ly',
  },
  {
    id: 'bun-bo-cay',
    name: 'Bún bò',
    variant: 'Cay',
    category: 'ht',
    yields: { water: 1, fried: 0 },
    aliases: ['Bún Bò Ly Sate Cay'],
    hints: ['"Bún Bò Ly Sate" = bún bò'],
    reportGroup: 'bun-bo',
  },
  {
    id: 'bun-bo-khong-cay',
    name: 'Bún bò',
    variant: 'Không cay',
    category: 'ht',
    yields: { water: 1, fried: 0 },
    aliases: ['Bún Bò Ly Sate Không Cay'],
    hints: ['"Bún Bò Ly Sate" = bún bò'],
    reportGroup: 'bun-bo',
  },
  // --- NHÓM OTHER (hasYields: false) ---
  {
    id: 'snack',
    name: 'Snack',
    variant: null,
    category: 'other',
    yields: {},
    aliases: ['Snack Hoành Thánh bơ đậu phộng', 'Snack'],
    hints: ['Dù tên có chữ "Hoành Thánh" vẫn là snack, KHÔNG phải món hoành thánh'],
    reportGroup: 'snack',
  },
  {
    id: 'xi-quach',
    name: 'Xí quách',
    variant: null,
    category: 'other',
    yields: {},
    aliases: ['Xí Quách'],
    hints: [],
    reportGroup: 'xi-quach',
  },
  // --- NHÓM MILK (hasYields: false) ---
  {
    id: 'sua-chien-binh',
    name: 'Sữa chiến binh',
    variant: null,
    category: 'milk',
    yields: {},
    aliases: ['Sữa Chiến binh'],
    hints: [],
    reportGroup: 'sua-chien-binh',
  },
  {
    id: 'sua-nang-tho',
    name: 'Sữa nàng thơ',
    variant: null,
    category: 'milk',
    yields: {},
    aliases: ['Sữa Nàng Thơ'],
    hints: [],
    reportGroup: 'sua-nang-tho',
  },
];

/**
 * @typedef {Object} AIConfig
 * @property {string} endpoint
 * @property {string[]} models
 * @property {number} timeoutMs
 * @property {number} maxRetry
 * @property {number} retryDelayMs
 * @property {number} maxImageSide
 * @property {number} jpegQuality
 * @property {string} userText
 */

/** @type {AIConfig} */
export const AI_CONFIG = {
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  models: [
    "openrouter/free"
  ],
  timeoutMs: 60000,
  maxRetry: 2,
  retryDelayMs: 800,
  maxImageSide: 1280,
  jpegQuality: 0.8,
  userText: 'Đọc ảnh và trả về JSON theo đúng schema.',
};

export const STORAGE_KEY = 'hoanh-thanh-counter:v1';
export const REPORT_STORAGE_KEY = 'hoanh-thanh-counter:report:v1';
export const MAX_SERVINGS = 9999;
export const MAX_MONEY = 999999999;
export const MAX_DIGITS = String(MAX_SERVINGS).length;

/**
 * Tạo nhãn hiển thị cho món: "Tên món variante" hoặc chỉ "Tên món"
 * @param {MenuItem} item
 * @returns {string}
 */
export function itemLabel(item) {
  return item.variant ? `${item.name} ${item.variant.toLowerCase()}` : item.name;
}

/**
 * Tạo Map tra cứu món theo id
 * @param {MenuItem[]} menu
 * @returns {Map<string, MenuItem>}
 */
export function createItemMap(menu) {
  return new Map(menu.map((item) => [item.id, item]));
}

/**
 * Tạo Map tra cứu category theo id
 * @param {Category[]} categories
 * @returns {Map<string, Category>}
 */
export function createCategoryMap(categories) {
  return new Map(categories.map((c) => [c.id, c]));
}

/**
 * Tạo Map tra cứu reportGroup theo id
 * @param {ReportGroup[]} groups
 * @returns {Map<string, ReportGroup>}
 */
export function createReportGroupMap(groups) {
  return new Map(groups.map((g) => [g.id, g]));
}

/**
 * Tạo Map tra cứu payment channel theo id
 * @param {PaymentChannel[]} channels
 * @returns {Map<string, PaymentChannel>}
 */
export function createPaymentChannelMap(channels) {
  return new Map(channels.map((c) => [c.id, c]));
}