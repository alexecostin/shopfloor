/**
 * Security sanitization utilities for SQL injection prevention.
 */

/**
 * Escape special LIKE/ILIKE characters to prevent wildcard injection.
 * @param {string} input - User input to escape
 * @returns {string} Escaped string safe for LIKE patterns
 */
export function escapeLike(input) {
  if (!input) return '';
  return String(input).replace(/[%_\\]/g, '\\$&');
}

/**
 * Sanitize and truncate a string input.
 * @param {string} input
 * @param {number} maxLength
 * @returns {string}
 */
export function sanitizeString(input, maxLength = 255) {
  if (!input) return '';
  return String(input).trim().substring(0, maxLength);
}

/**
 * Validate that a value is a valid UUID v4.
 * @param {string} val
 * @returns {boolean}
 */
export function isValidUuid(val) {
  return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

/**
 * Filter an array to only valid UUIDs.
 * @param {Array} arr
 * @returns {string[]}
 */
export function filterValidUuids(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(isValidUuid);
}
