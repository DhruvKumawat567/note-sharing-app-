/**
 * In-memory sliding window rate limiter for brute-force protection
 * on password-protected share links.
 */

interface RateLimitRecord {
  attempts: number[];
  lockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (record.lockedUntil && record.lockedUntil > now) continue;
      const recentAttempts = record.attempts.filter((ts) => now - ts < 60000);
      if (recentAttempts.length === 0) {
        rateLimitStore.delete(key);
      } else {
        record.attempts = recentAttempts;
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitResult {
  isBlocked: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowSeconds: number = 60
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(key) || { attempts: [] };

  // Check if temporarily locked out
  if (record.lockedUntil && record.lockedUntil > now) {
    const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      isBlocked: true,
      remainingAttempts: 0,
      retryAfterSeconds: retryAfter,
    };
  }

  // Filter attempts within the sliding window
  const windowMs = windowSeconds * 1000;
  record.attempts = record.attempts.filter((ts) => now - ts < windowMs);

  if (record.attempts.length >= maxAttempts) {
    // Lock for the remainder of the window or extra lockout penalty
    record.lockedUntil = now + windowMs;
    rateLimitStore.set(key, record);
    return {
      isBlocked: true,
      remainingAttempts: 0,
      retryAfterSeconds: windowSeconds,
    };
  }

  return {
    isBlocked: false,
    remainingAttempts: maxAttempts - record.attempts.length,
    retryAfterSeconds: 0,
  };
}

export function recordFailedAttempt(key: string, windowSeconds: number = 60): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(key) || { attempts: [] };
  const windowMs = windowSeconds * 1000;
  record.attempts = record.attempts.filter((ts) => now - ts < windowMs);
  record.attempts.push(now);

  const maxAttempts = 5;
  if (record.attempts.length >= maxAttempts) {
    record.lockedUntil = now + windowMs;
  }

  rateLimitStore.set(key, record);

  return checkRateLimit(key, maxAttempts, windowSeconds);
}

export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}
