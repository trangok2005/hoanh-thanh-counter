/**
 * @file Resize image using createImageBitmap + canvas.toBlob
 * Chỉ resize 1 lần cho mỗi lần quét
 */

import { AI_CONFIG } from '../config.js';

/**
 * @typedef {Object} ResizedImage
 * @property {string} dataUrl - data:image/... cho preview
 * @property {string} base64 - base64 thuần cho API
 * @property {string} mimeType - 'image/jpeg'
 */

/**
 * Resize ảnh về max side, trả dataUrl + base64
 * @param {File} file
 * @returns {Promise<ResizedImage>}
 */
export async function resizeImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Không đọc được ảnh này. Hãy thử ảnh khác (JPG/PNG).');
  }

  const scale = Math.min(1, AI_CONFIG.maxImageSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (bitmap.close) bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', AI_CONFIG.jpegQuality));
  if (!blob) throw new Error('Không xử lý được ảnh này. Hãy thử ảnh khác.');

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không đọc được ảnh này.'));
    reader.readAsDataURL(blob);
  });

  return {
    dataUrl,
    base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
    mimeType: 'image/jpeg',
  };
}