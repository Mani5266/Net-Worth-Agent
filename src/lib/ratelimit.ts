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
 * /api/ocr — 20 requests per hour per identifier (user ID or IP).
 * Allows passport + Aadhaar uploads for self + family, plus retries.
 */
export const ocrRateLimit = createLimiter("ocr", {
  requests: 20,
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

/**
 * /api/gold-price — 30 requests per hour per identifier.
 * Lightweight reference data endpoint.
 */
export const goldPriceRateLimit = createLimiter("gold-price", {
  requests: 30,
  window: "1 h",
});

/**
 * /api/ai-intake — 30 requests per hour per identifier.
 * Multi-turn chat for AI-assisted form filling (typical session ~10-15 messages).
 */
export const aiIntakeRateLimit = createLimiter("ai-intake", {
  requests: 30,
  window: "1 h",
});

/**
 * /api/stt — 30 requests per hour per identifier.
 * Voice-to-text transcription (pairs 1:1 with AI intake calls).
 */
export const sttRateLimit = createLimiter("stt", {
  requests: 30,
  window: "1 h",
});

/**
 * /api/send-verification & /api/resend-verification — 5 requests per hour per email.
 * Prevents spamming verification emails to a single address.
 */
export const emailVerifyRateLimit = createLimiter("email-verify", {
  requests: 5,
  window: "1 h",
});

/**
 * /api/send-verification & /api/resend-verification — 10 requests per hour per IP.
 * Prevents a single IP from flooding verification emails across accounts.
 * Checked independently of emailVerifyRateLimit — BOTH must pass.
 */
export const emailVerifyIpRateLimit = createLimiter("email-verify-ip", {
  requests: 10,
  window: "1 h",
});

// ─── Factory ──────────────────────────────────────────────────────────────────

interface LimiterConfig {
  requests: number;
  window: "1 h" | "1 m" | "1 d";
}

export function createLimiter(prefix: string, config: LimiterConfig) {
  const redis = getRedis();

  if (!redis) {
    // Phase 3 FIX 9: Loud warning / hard fail when rate limiting is disabled
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `\n⚠️  [ratelimit] Limiter "${prefix}" is a NO-OP — Upstash env vars missing. This is OK in local dev but MUST be configured for production.\n`
      );
    }

    // Return a limiter that warns in dev but throws at check-time in production.
    // (Cannot throw at module-init because Next.js build evaluates this during
    //  "Collecting page data" where env vars may not be injected yet.)
    return {
      check: async (_identifier: string) => {
        if (process.env.NODE_ENV === "production") {
          throw new Error(
            `[SECURITY] Rate limiter "${prefix}" disabled — UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production.`
          );
        }
        return {
          success: true as const,
          limit: config.requests,
          remaining: config.requests,
          reset: Date.now() + 3600_000,
        };
      },
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
 * Phase 3 FIX 4: Prefers user ID (auth-validated) over IP for logged-in apps.
 * Falls back to IP only if userId is not provided.
 */
export function getClientIdentifier(
  request: Request,
  userId?: string | null
): string {
  // Prefer authenticated user ID — immune to IP spoofing / shared IP
  if (userId) return `user:${userId}`;

  // Fallback: IP-based (for unauthenticated endpoints)
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

// ─── CSRF Origin Check ────────────────────────────────────────────────────────

/**
 * Validates that the request Origin header matches the app URL.
 * Returns null if valid, or a 403 NextResponse if invalid.
 * Skips check in development (localhost).
 */
export function checkCsrfOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Skip in development
  if (appUrl?.includes("localhost")) return null;

  // If no origin header (e.g., server-to-server), block it for POST routes
  if (!origin) {
    return NextResponse.json(
      { success: false, error: "Forbidden." },
      { status: 403 }
    );
  }

  // Compare origin against app URL
  if (appUrl) {
    try {
      const allowedHost = new URL(appUrl).host;
      const requestHost = new URL(origin).host;
      if (requestHost === allowedHost) return null;
    } catch {
      // Invalid URL — fall through to reject
    }
  }

  return NextResponse.json(
    { success: false, error: "Forbidden." },
    { status: 403 }
  );
}
