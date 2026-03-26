import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import {
  exchangeRateLimit,
  getClientIdentifier,
  rateLimitResponse,
} from "@/lib/ratelimit";
import { requireAuth } from "@/lib/auth-guard";
import { EXCHANGE_RATE_FALLBACK_USD_INR } from "@/constants";

// Module-level cache — reused across requests within the same server process
let cached: { rate: number; fetchedAt: number } | null = null;
const CACHE_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(req: NextRequest) {
  try {
    // 0. Authentication check
    const authResult = await requireAuth(req);
    if ("error" in authResult) return authResult.error;

    // Rate limiting
    const identifier = getClientIdentifier(req, authResult.userId);
    const rateResult = await exchangeRateLimit.check(identifier);
    if (!rateResult.success) {
      return rateLimitResponse(rateResult.reset);
    }

    // Return cached value if still fresh
    if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
      return NextResponse.json({ rate: cached.rate, cached: true });
    }

    // Free API — no key needed, 1500 req/month on free tier
    const res = await fetch(
      "https://api.exchangerate-api.com/v4/latest/USD",
      { next: { revalidate: 600 } } // Next.js cache hint
    );

    if (!res.ok) throw new Error(`Exchange API responded ${res.status}`);

    const json = await res.json();
    const rate: number = json?.rates?.INR;

    if (!rate || typeof rate !== "number") {
      throw new Error("INR rate missing from response");
    }

    cached = { rate, fetchedAt: Date.now() };
    return NextResponse.json({ rate, cached: false });
  } catch {
    // Fallback to cached stale value if available
    if (cached) {
      return NextResponse.json({ rate: cached.rate, cached: true, stale: true });
    }
    // Hard fallback: approximate rate
    return NextResponse.json({ rate: EXCHANGE_RATE_FALLBACK_USD_INR, cached: false, fallback: true });
  }
}
