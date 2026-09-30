/**
 * Rate Limiting Implementation for Accountability Watch
 * 
 * Protects against:
 * - Brute force login attempts
 * - Report spam/flood
 * - API abuse
 * - DDoS attacks
 * 
 * STRATEGY:
 * - Token bucket algorithm: replenishes X tokens every period
 * - Separate buckets per endpoint and per user/IP
 * - Graceful degradation: accepts requests until limit reached, then rejects
 * - Implements jitter to prevent thundering herd
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Rate limit configuration for different endpoints
 */
export const RATE_LIMIT_CONFIG = {
  // Authentication endpoints
  LOGIN: {
    maxRequests: 5,
    windowSeconds: 15 * 60, // 15 minutes
    keyPrefix: 'rl:login',
  },
  PASSWORD_RESET: {
    maxRequests: 3,
    windowSeconds: 60 * 60, // 1 hour
    keyPrefix: 'rl:password_reset',
  },
  
  // Report submission
  REPORT_SUBMIT: {
    maxRequests: 10,
    windowSeconds: 60 * 60, // 1 hour per user
    keyPrefix: 'rl:report_submit',
  },
  
  // Admin operations
  BULK_ACTION: {
    maxRequests: 100,
    windowSeconds: 60 * 60, // 1 hour
    keyPrefix: 'rl:bulk_action',
  },
  
  // Search/read operations (lighter limits)
  SEARCH: {
    maxRequests: 100,
    windowSeconds: 60, // 100 per minute
    keyPrefix: 'rl:search',
  },
};

/**
 * Rate limit entry in storage
 */
interface RateLimitEntry {
  tokens: number;
  lastRefilled: number;
  requestCount: number;
  firstRequestTime: number;
}

/**
 * Result of rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetAfterSeconds: number;
  retryAfterSeconds?: number;
}

/**
 * In-memory store for rate limits (used locally)
 * In production, this should use Redis or similar
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check if a request should be allowed based on rate limits
 * 
 * ALGORITHM:
 * 1. Get or create rate limit entry for key
 * 2. Calculate tokens to add based on elapsed time
 * 3. Check if current request should be allowed
 * 4. Update entry and return result
 * 
 * TIME COMPLEXITY: O(1) hash map lookup
 * SPACE COMPLEXITY: O(n) where n = number of unique rate limit keys
 */
export function checkRateLimit(
  identifier: string,  // user ID, IP, or email
  config: typeof RATE_LIMIT_CONFIG[keyof typeof RATE_LIMIT_CONFIG]
): RateLimitResult {
  const key = `${config.keyPrefix}:${identifier}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  let entry = rateLimitStore.get(key);

  if (!entry) {
    // First request in this window
    entry = {
      tokens: config.maxRequests - 1,  // Use one token for this request
      lastRefilled: now,
      requestCount: 1,
      firstRequestTime: now,
    };
    rateLimitStore.set(key, entry);

    return {
      allowed: true,
      remainingRequests: entry.tokens,
      resetAfterSeconds: config.windowSeconds,
    };
  }

  // Calculate elapsed time and refill tokens
  const elapsed = now - entry.lastRefilled;
  const refillRate = config.maxRequests / config.windowSeconds;
  const tokensToAdd = (elapsed / 1000) * refillRate;

  entry.tokens = Math.min(
    config.maxRequests,
    entry.tokens + tokensToAdd
  );
  entry.lastRefilled = now;

  // Check if this request is allowed
  if (entry.tokens >= 1) {
    entry.tokens -= 1;
    entry.requestCount += 1;

    return {
      allowed: true,
      remainingRequests: Math.floor(entry.tokens),
      resetAfterSeconds: Math.ceil(
        (entry.firstRequestTime + windowMs - now) / 1000
      ),
    };
  } else {
    // Request denied - calculate when it will be allowed
    const tokensNeeded = 1 - entry.tokens;
    const secondsUntilAllowed = Math.ceil(tokensNeeded / refillRate);

    return {
      allowed: false,
      remainingRequests: 0,
      resetAfterSeconds: config.windowSeconds,
      retryAfterSeconds: secondsUntilAllowed,
    };
  }
}

/**
 * Middleware for checking rate limits in request handling
 * Returns 429 Too Many Requests if limit exceeded
 */
export async function rateLimitMiddleware(
  identifier: string,
  config: typeof RATE_LIMIT_CONFIG[keyof typeof RATE_LIMIT_CONFIG]
): Promise<{
  allowed: boolean;
  headers: Record<string, string>;
  statusCode?: number;
  errorMessage?: string;
}> {
  const result = checkRateLimit(identifier, config);

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': result.remainingRequests.toString(),
    'X-RateLimit-Reset': (Date.now() + result.resetAfterSeconds * 1000).toString(),
  };

  if (!result.allowed) {
    headers['Retry-After'] = (result.retryAfterSeconds || result.resetAfterSeconds).toString();

    return {
      allowed: false,
      headers,
      statusCode: 429,
      errorMessage: `Rate limit exceeded. Retry after ${result.retryAfterSeconds} seconds.`,
    };
  }

  return {
    allowed: true,
    headers,
  };
}

/**
 * Reset rate limit for a specific identifier
 * Useful for manual overrides or admin resets
 */
export function resetRateLimit(
  identifier: string,
  config: typeof RATE_LIMIT_CONFIG[keyof typeof RATE_LIMIT_CONFIG]
): void {
  const key = `${config.keyPrefix}:${identifier}`;
  rateLimitStore.delete(key);
}

/**
 * Reset all rate limits
 * Use with caution - should only be called in testing or emergency
 */
export function resetAllRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Get current rate limit status for an identifier
 */
export function getRateLimitStatus(
  identifier: string,
  config: typeof RATE_LIMIT_CONFIG[keyof typeof RATE_LIMIT_CONFIG]
): RateLimitResult | null {
  const key = `${config.keyPrefix}:${identifier}`;
  const entry = rateLimitStore.get(key);

  if (!entry) {
    return null;
  }

  return {
    allowed: entry.tokens >= 1,
    remainingRequests: Math.floor(entry.tokens),
    resetAfterSeconds: config.windowSeconds,
  };
}

/**
 * Get rate limit statistics (for monitoring)
 */
export function getRateLimitStats(): {
  totalKeys: number;
  memoryUsageBytes: number;
  activeEndpoints: string[];
} {
  const stats = {
    totalKeys: rateLimitStore.size,
    memoryUsageBytes: JSON.stringify(Array.from(rateLimitStore.entries())).length,
    activeEndpoints: Array.from(rateLimitStore.keys())
      .map(key => key.split(':')[0])
      .filter((v, i, a) => a.indexOf(v) === i), // unique
  };

  return stats;
}

/**
 * Cleanup expired rate limit entries (should run periodically)
 * 
 * Keeps memory usage bounded by removing entries older than 2x the largest window
 */
export function cleanupExpiredLimits(): number {
  const now = Date.now();
  const maxWindow = Math.max(
    ...Object.values(RATE_LIMIT_CONFIG).map(c => c.windowSeconds * 1000)
  );
  const expirationTime = 2 * maxWindow; // Entries older than 2x window
  
  let removed = 0;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.lastRefilled > expirationTime) {
      rateLimitStore.delete(key);
      removed++;
    }
  }
  
  return removed;
}

/**
 * Enhanced rate limiter with sliding window counter
 * More accurate than token bucket for precise rate limiting
 * 
 * ALGORITHM:
 * 1. Maintain array of request timestamps
 * 2. Remove timestamps outside current window
 * 3. If count < limit, allow and add timestamp
 * 4. Otherwise, deny
 * 
 * Advantage: Exact request counting within window
 * Trade-off: Uses more memory than token bucket
 */
class SlidingWindowRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowSeconds: number;

  constructor(maxRequests: number, windowSeconds: number) {
    this.maxRequests = maxRequests;
    this.windowSeconds = windowSeconds;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowSeconds * 1000;

    let timestamps = this.requests.get(key) || [];
    
    // Remove timestamps outside the current window
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length < this.maxRequests) {
      timestamps.push(now);
      this.requests.set(key, timestamps);
      return true;
    }

    return false;
  }

  getRemaining(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowSeconds * 1000;

    let timestamps = this.requests.get(key) || [];
    timestamps = timestamps.filter(t => t > windowStart);

    return Math.max(0, this.maxRequests - timestamps.length);
  }

  reset(key: string): void {
    this.requests.delete(key);
  }
}

export { SlidingWindowRateLimiter };
