import crypto from 'crypto';

/**
 * Generate a cryptographically secure URL-safe random token for share links
 */
export function generateShareToken(): string {
  // 32 bytes of randomness = 64 characters hex or 43 base64url characters
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Generate a dynamic access key / password for password-protected links
 * Format: Clean, secure alphanumeric key with high entropy (e.g. 12 characters)
 */
export function generateDynamicPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  const randomBytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  // Group into readable 3-3-3-3 pattern: e.g. "Ab4k-Tm9x-R2wQ"
  return `${password.slice(0, 4)}-${password.slice(4, 8)}-${password.slice(8, 12)}`;
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}
