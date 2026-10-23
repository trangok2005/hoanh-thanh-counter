/**
 * @file AI Error hierarchy
 * Tất cả lỗi từ AI layer đều là instance của AIError
 */

export class AIError extends Error {
  /**
   * @param {string} message
   * @param {Object} options
   * @param {boolean} options.retryable - có nên retry không
   * @param {number} [options.status] - HTTP status
   * @param {boolean} [options.badKey] - key sai/hết hạn
   */
  constructor(message, { retryable = false, status, badKey = false } = {}) {
    super(message);
    this.name = 'AIError';
    this.retryable = retryable;
    this.status = status;
    this.badKey = badKey;
  }
}

export class AuthError extends AIError {
  constructor(message, status) {
    super(message, { retryable: false, status, badKey: true });
    this.name = 'AuthError';
  }
}

export class ProviderError extends AIError {
  constructor(message, status) {
    super(message, { retryable: false, status });
    this.name = 'ProviderError';
  }
}

export class NetworkError extends AIError {
  constructor(message) {
    super(message, { retryable: true });
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends AIError {
  constructor(message) {
    super(message, { retryable: false });
    this.name = 'TimeoutError';
  }
}

/**
 * Chuẩn hoá error từ fetch/API thành AIError
 * @param {Error & { status?: number, isNetwork?: boolean, isTimeout?: boolean }} err
 * @returns {AIError | DOMException}
 */
export function normalizeError(err) {
  if (err instanceof AIError) return err;

  if (err.isTimeout || err.name === 'TimeoutError') {
    return new TimeoutError('Quét quá lâu nên đã dừng. Hãy thử lại.');
  }

  if (err.name === 'AbortError' || err instanceof DOMException) {
    // Không wrap AbortError, ném nguyên vẹn để caller xử lý
    return err;
  }

  if (err.isNetwork || err instanceof TypeError) {
    return new NetworkError('Không kết nối được Internet. Kiểm tra mạng rồi thử lại.');
  }

  const status = err.status;
  if (status === 401) return new AuthError('API Key không hợp lệ.', status);
  if (status === 403) return new AuthError('API Key không có quyền truy cập.', status);
  if (status === 400) return new ProviderError('Yêu cầu không hợp lệ. Hãy thử lại với ảnh khác.', status);
  if (status === 402) return new ProviderError('Tài khoản hết credit.', status);
  if (status === 404) return new ProviderError('Model không còn khả dụng. Hãy đổi model trong cấu hình.', status);
  if (status === 408) return new AIError('Máy chủ AI phản hồi quá lâu. Hãy thử lại.', { retryable: true, status });
  if (status === 429) return new AIError('Đã vượt giới hạn miễn phí. Chờ một chút rồi thử lại.', { retryable: true, status });
  if (status >= 500) return new AIError('Máy chủ AI đang bận. Hãy thử lại sau ít giây.', { retryable: true, status });

  return new AIError(err.message || 'Có lỗi khi quét ảnh.', { retryable: false, status });
}