/**
 * @file DOM helpers: tạo element, svg icon, format number
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const numberFormat = new Intl.NumberFormat('vi-VN');
const SVG_ATTRS = {
  viewBox: '0 0 24 24',
  width: '22',
  height: '22',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2.6',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
};

/**
 * Tạo element với className và textContent
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Tạo SVG icon từ path data
 * @param {string} pathData
 * @returns {SVGSVGElement}
 */
export function svgIcon(pathData) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries(SVG_ATTRS)) {
    svg.setAttribute(k, v);
  }
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', pathData);
  svg.appendChild(path);
  return svg;
}

/**
 * Format number với Intl.NumberFormat vi-VN
 * @param {number} n
 * @returns {string}
 */
export function formatNumber(n) {
  return numberFormat.format(n);
}

/**
 * Đóng dialog khi bấm ra ngoài vùng dialog.
 * @param {HTMLDialogElement} dialog
 */
export function closeOnBackdropClick(dialog) {
  dialog.addEventListener('click', (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right &&
      e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) dialog.close('cancel');
  });
}

/**
 * Chọn toàn bộ text trong input (dùng cho focus)
 * @param {HTMLInputElement} input
 */
export function selectAll(input) {
  setTimeout(() => input.select(), 0);
}

/**
 * Toggle class bump cho hiệu ứng
 * @param {HTMLElement} node
 */
export function bump(node) {
  node.classList.remove('bump');
  void node.offsetWidth;
  node.classList.add('bump');
}

/**
 * Cập nhật stat value + toggle is-long + bump
 * @param {HTMLElement} node
 * @param {number} value
 */
export function setStat(node, value) {
  const text = formatNumber(value);
  if (node.textContent === text) return;
  node.textContent = text;
  node.classList.toggle('is-long', text.length >= 7);
  bump(node);
}

/**
 * Format tiền tệ VND
 * @param {number} n
 * @returns {string}
 */
export function formatMoney(n) {
  return numberFormat.format(n);
}