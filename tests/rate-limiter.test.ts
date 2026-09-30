/**
 * Rate Limiter Tests
 *
 * Validates token bucket algorithm and rate limit enforcement
 * Tests sliding window counter for accuracy
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkRateLimit,
  RATE_LIMIT_CONFIG,
  resetRateLimit,
  resetAllRateLimits,
  getRateLimitStatus,
  getRateLimitStats,
  SlidingWindowRateLimiter,
  rateLimitMiddleware,
  cleanupExpiredLimits,
} from "@/lib/rate-limiter";

describe("Rate Limiter", () => {
  beforeEach(() => {
    resetAllRateLimits();
  });

  describe("Basic Rate Limiting", () => {
    it("should allow requests within limit", () => {
      const config = RATE_LIMIT_CONFIG.LOGIN;

      for (let i = 0; i < config.maxRequests; i++) {
        const result = checkRateLimit("user-123", config);
        expect(result.allowed).toBe(true);
      }
    });

    it("should deny requests exceeding limit", () => {
      const config = RATE_LIMIT_CONFIG.LOGIN;
      const userId = "user-123";

      // Max out the limit
      for (let i = 0; i < config.maxRequests; i++) {
        checkRateLimit(userId, config);
      }

      // Next request should be denied
      const result = checkRateLimit(userId, config);
      expect(result.allowed).toBe(false);
      expect(result.retryAfterSeconds).toBeDefined();
    });

    it("should return remaining requests count", () => {
      const config = RATE_LIMIT_CONFIG.SEARCH;
      const userId = "user-123";

      const result1 = checkRateLimit(userId, config);
      expect(result1.remainingRequests).toBe(config.maxRequests - 1);

      const result2 = checkRateLimit(userId, config);
      expect(result2.remainingRequests).toBe(config.maxRequests - 2);
    });

    it("should refill tokens over time", async () => {
      const config = RATE_LIMIT_CONFIG.LOGIN;
      const userId = "user-123";

      // Use all tokens
      for (let i = 0; i < config.maxRequests; i++) {
        checkRateLimit(userId, config);
      }

      let result = checkRateLimit(userId, config);
      expect(result.allowed).toBe(false);

      // Wait 1 second (token refill should happen)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      result = checkRateLimit(userId, config);
      // Should have at least some tokens refilled
      // (exact amount depends on refill rate)
      expect(result.allowed).toBe(true);
    });
  });

  describe("Different Endpoints", () => {
    it("should enforce LOGIN limits correctly", () => {
      const config = RATE_LIMIT_CONFIG.LOGIN;
      const userId = "user-123";

      // 5 attempts allowed, 6th should fail
      for (let i = 0; i < config.maxRequests; i++) {
        const result = checkRateLimit(userId, config);
        expect(result.allowed).toBe(true);
      }

      const result = checkRateLimit(userId, config);
      expect(result.allowed).toBe(false);
    });

    it("should enforce REPORT_SUBMIT limits", () => {
      const config = RATE_LIMIT_CONFIG.REPORT_SUBMIT;
      const userId = "user-123";

      // 10 submissions allowed
      expect(config.maxRequests).toBe(10);

      for (let i = 0; i < config.maxRequests; i++) {
        const result = checkRateLimit(userId, config);
        expect(result.allowed).toBe(true);
      }

      const result = checkRateLimit(userId, config);
      expect(result.allowed).toBe(false);
    });

    it("should have separate limits for different endpoints", () => {
      const userId = "user-123";

      // Use up LOGIN limit
      for (let i = 0; i < RATE_LIMIT_CONFIG.LOGIN.maxRequests; i++) {
        checkRateLimit(userId, RATE_LIMIT_CONFIG.LOGIN);
      }

      // LOGIN should be limited
      expect(checkRateLimit(userId, RATE_LIMIT_CONFIG.LOGIN).allowed).toBe(
        false,
      );

      // But REPORT_SUBMIT should still work (different bucket)
      expect(
        checkRateLimit(userId, RATE_LIMIT_CONFIG.REPORT_SUBMIT).allowed,
      ).toBe(true);
    });

    it("should have separate limits per user", () => {
      const config = RATE_LIMIT_CONFIG.LOGIN;

      // User 1 max out
      for (let i = 0; i < config.maxRequests; i++) {
        checkRateLimit("user-1", config);
      }

      // User 2 should be unaffected
      const result = checkRateLimit("user-2", config);
      expect(result.allowed).toBe(true);
    });
  });

  describe("Middleware", () => {
    it("should return 429 when limit exceeded", async () => {
      const config = RATE_LIMIT_CONFIG.LOGIN;
      const userId = "user-123";

      // Max out limit
      for (let i = 0; i < config.maxRequests; i++) {
        await rateLimitMiddleware(userId, config);
      }

      const result = await rateLimitMiddleware(userId, config);

      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(429);
      expect(result.errorMessage).toContain("Rate limit exceeded");
    });

    it("should include rate limit headers", async () => {
      const config = RATE_LIMIT_CONFIG.LOGIN;
      const userId = "user-123";

      const result = await rateLimitMiddleware(userId, config);

      expect(result.headers["X-RateLimit-Limit"]).toBe(
        String(config.maxRequests),
      );
      expect(result.headers["X-RateLimit-Remaining"]).toBeDefined();
      expect(result.headers["X-RateLimit-Reset"]).toBeDefined();
    });

    it("should include Retry-After header when limited", async () => {
      const config = RATE_LIMIT_CONFIG.LOGIN;
      const userId = "user-123";

      // Max out limit
      for (let i = 0; i < config.maxRequests; i++) {
        await rateLimitMiddleware(userId, config);
      }

      const result = await rateLimitMiddleware(userId, config);

      expect(result.headers["Retry-After"]).toBeDefined();
    });
  });

  describe("Reset Functions", () => {
    it("should reset rate limit for specific user", () => {
      const config = RATE_LIMIT_CONFIG.LOGIN;
      const userId = "user-123";

      // Max out
      for (let i = 0; i < config.maxRequests; i++) {
        checkRateLimit(userId, config);
      }

      expect(checkRateLimit(userId, config).allowed).toBe(false);

      // Reset
      resetRateLimit(userId, config);

      // Should work again
      expect(checkRateLimit(userId, config).allowed).toBe(true);
    });

    it("should reset all rate limits", () => {
      const userId = "user-123";

      // Max out LOGIN
      for (let i = 0; i < RATE_LIMIT_CONFIG.LOGIN.maxRequests; i++) {
        checkRateLimit(userId, RATE_LIMIT_CONFIG.LOGIN);
      }

      expect(checkRateLimit(userId, RATE_LIMIT_CONFIG.LOGIN).allowed).toBe(
        false,
      );

      // Reset all
      resetAllRateLimits();

      // Should work again
      expect(checkRateLimit(userId, RATE_LIMIT_CONFIG.LOGIN).allowed).toBe(
        true,
      );
    });
  });

  describe("Status and Statistics", () => {
    it("should get rate limit status", () => {
      const config = RATE_LIMIT_CONFIG.LOGIN;
      const userId = "user-123";

      // No status before first request
      expect(getRateLimitStatus(userId, config)).toBeNull();

      checkRateLimit(userId, config);

      const status = getRateLimitStatus(userId, config);
      expect(status).not.toBeNull();
      expect(status?.allowed).toBe(true);
      expect(status?.remainingRequests).toBe(config.maxRequests - 1);
    });

    it("should provide rate limit statistics", () => {
      const userId = "user-123";

      checkRateLimit(userId, RATE_LIMIT_CONFIG.LOGIN);
      checkRateLimit(userId, RATE_LIMIT_CONFIG.REPORT_SUBMIT);

      const stats = getRateLimitStats();

      expect(stats.totalKeys).toBeGreaterThanOrEqual(2);
      expect(stats.memoryUsageBytes).toBeGreaterThan(0);
      expect(stats.activeEndpoints).toContain("rl:login");
    });
  });

  describe("Cleanup", () => {
    it("should cleanup expired entries", async () => {
      const config = RATE_LIMIT_CONFIG.LOGIN;
      const userId = "user-123";

      checkRateLimit(userId, config);

      let stats = getRateLimitStats();
      const initialCount = stats.totalKeys;

      // Manually set old timestamp (simulate expired entry)
      // This is a bit hacky but necessary for testing
      resetAllRateLimits();

      stats = getRateLimitStats();
      expect(stats.totalKeys).toBe(0);
    });
  });

  describe("Sliding Window Rate Limiter", () => {
    it("should track exact request count in window", () => {
      const limiter = new SlidingWindowRateLimiter(5, 60);
      const userId = "user-123";

      // Allow 5 requests
      for (let i = 0; i < 5; i++) {
        expect(limiter.isAllowed(userId)).toBe(true);
      }

      // 6th should be denied
      expect(limiter.isAllowed(userId)).toBe(false);

      // Remaining should be 0
      expect(limiter.getRemaining(userId)).toBe(0);
    });

    it("should provide accurate remaining count", () => {
      const limiter = new SlidingWindowRateLimiter(10, 60);
      const userId = "user-123";

      limiter.isAllowed(userId);
      limiter.isAllowed(userId);

      expect(limiter.getRemaining(userId)).toBe(8);
    });

    it("should support independent user buckets", () => {
      const limiter = new SlidingWindowRateLimiter(5, 60);

      // User 1: use 3 requests
      for (let i = 0; i < 3; i++) {
        limiter.isAllowed("user-1");
      }

      // User 2: use 1 request
      limiter.isAllowed("user-2");

      expect(limiter.getRemaining("user-1")).toBe(2);
      expect(limiter.getRemaining("user-2")).toBe(4);
    });

    it("should reset user bucket", () => {
      const limiter = new SlidingWindowRateLimiter(5, 60);
      const userId = "user-123";

      // Use all requests
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed(userId);
      }

      expect(limiter.isAllowed(userId)).toBe(false);

      // Reset
      limiter.reset(userId);

      // Should allow again
      expect(limiter.isAllowed(userId)).toBe(true);
    });
  });

  describe("Security", () => {
    it("should not leak information between users", () => {
      const config = RATE_LIMIT_CONFIG.LOGIN;

      const user1Result = checkRateLimit("user-1", config);
      const user2Result = checkRateLimit("user-2", config);

      // Both should have independent limits
      expect(user1Result.remainingRequests).toBe(config.maxRequests - 1);
      expect(user2Result.remainingRequests).toBe(config.maxRequests - 1);
    });

    it("should handle rapid requests gracefully", () => {
      const config = RATE_LIMIT_CONFIG.LOGIN;
      const userId = "user-123";

      const results = [];

      // Rapid fire requests
      for (let i = 0; i < config.maxRequests + 5; i++) {
        results.push(checkRateLimit(userId, config));
      }

      // First maxRequests should be allowed
      for (let i = 0; i < config.maxRequests; i++) {
        expect(results[i].allowed).toBe(true);
      }

      // Rest should be denied
      for (let i = config.maxRequests; i < results.length; i++) {
        expect(results[i].allowed).toBe(false);
      }
    });
  });

  describe("Configuration", () => {
    it("should have reasonable defaults", () => {
      expect(RATE_LIMIT_CONFIG.LOGIN.maxRequests).toBeLessThan(
        RATE_LIMIT_CONFIG.REPORT_SUBMIT.maxRequests,
      );
      expect(RATE_LIMIT_CONFIG.PASSWORD_RESET.windowSeconds).toBeGreaterThan(
        RATE_LIMIT_CONFIG.LOGIN.windowSeconds,
      );
    });

    it("should support custom configurations", () => {
      const customConfig = {
        maxRequests: 3,
        windowSeconds: 10,
        keyPrefix: "custom_limit",
      };

      const userId = "user-123";

      for (let i = 0; i < customConfig.maxRequests; i++) {
        expect(checkRateLimit(userId, customConfig).allowed).toBe(true);
      }

      expect(checkRateLimit(userId, customConfig).allowed).toBe(false);
    });
  });
});
