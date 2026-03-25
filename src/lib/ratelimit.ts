import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Whether rate limiting is active.
 * If Upstash env vars are missing, rate limiting is silently disabled
 * (allows local development without Redis).
 */
const isConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

// Lazy-initialize Redis client only if credentials exist
function getRedis(): Redis | null {
  if (!isConfigured) return null;
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

// ─── Rate Limiters ────────────────────────────────────────────────────────────

/**
 * /api/ocr — 5 requests per hour per identifier (user ID or IP).
 * Strict limit to prevent abuse of document processing.
 */
export const ocrRateLimit = createLimiter("ocr", {
  requests: 5,
  window: "1 h",
});

/**
 * /api/generate (certificate generation) — 10 requests per hour per identifier.
 */
export const generateRateLimit = createLimiter("generate", {
  requests: 10,
  window: "1 h",
});

/**
 * /api/exchange-rate — 30 requests per hour per IP.
 * More generous since this is a lightweight read-only endpoint.
 */
export const exchangeRateLimit = createLimiter("exchange-rate", {
  requests: 30,
  window: "1 h",
});

// ─── Factory ──────────────────────────────────────────────────────────────────

interface LimiterConfig {
  requests: number;
  window: "1 h" | "1 m" | "1 d";
}

function createLimiter(prefix: string, config: LimiterConfig) {
  const redis = getRedis();

  if (!redis) {
    // Return a no-op limiter for local dev
    return {
      check: async (_identifier: string) => ({
        success: true as const,
        limit: config.requests,
        remaining: config.requests,
        reset: Date.now() + 3600_000,
      }),
    };
  }

  const windowMs =
    config.window === "1 h"
      ? "1 h"
      : config.window === "1 m"
        ? "1 m"
        : "1 d";

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.requests, windowMs),
    prefix: `networth:ratelimit:${prefix}`,
    analytics: true,
  });

  return {
    check: async (identifier: string) => {
      const result = await limiter.limit(identifier);
      return result;
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the client identifier for rate limiting.
 * Prefers user-provided identifier (e.g., user ID from auth), falls back to IP.
 */
export function getClientIdentifier(
  request: Request,
  userId?: string | null
): string {
  if (userId) return `user:${userId}`;

  // Try standard forwarded headers, then fall back
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return `ip:${firstIp}`;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return `ip:${realIp}`;

  return "ip:unknown";
}

/**
 * Returns a 429 response with standard rate limit headers.
 */
export function rateLimitResponse(resetTimestamp: number): NextResponse {
  const retryAfterSeconds = Math.ceil(
    (resetTimestamp - Date.now()) / 1000
  );

  return NextResponse.json(
    {
      success: false,
      error: "Too many requests. Please try again later.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, retryAfterSeconds)),
        "X-RateLimit-Reset": String(resetTimestamp),
      },
    }
  );
}
