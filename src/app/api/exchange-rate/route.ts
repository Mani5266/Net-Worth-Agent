import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import {
  exchangeRateLimit,
  getClientIdentifier,
  rateLimitResponse,
} from "@/lib/ratelimit";
import { EXCHANGE_RATE_FALLBACK_USD_INR, COUNTRY_CURRENCY_MAP, DEFAULT_CURRENCY } from "@/constants";

// Module-level cache — reused across requests within the same server process
// Stores the full rates object (all currencies relative to USD) + timestamp
let cached: { rates: Record<string, number>; fetchedAt: number } | null = null;
const CACHE_MS = 10 * 60 * 1000; // 10 minutes

/** Compute how many INR per 1 unit of the target currency */
function computeINRRate(rates: Record<string, number>, targetCurrency: string): number | null {
  const inrRate = rates["INR"];
  if (!inrRate) return null;

  // If target is USD, INR rate is direct
  if (targetCurrency === "USD") return inrRate;

  const targetRate = rates[targetCurrency];
  if (!targetRate) return null;

  // rates are all relative to 1 USD, so:
  // 1 USD = inrRate INR
  // 1 USD = targetRate TARGET
  // => 1 TARGET = (inrRate / targetRate) INR
  return inrRate / targetRate;
}

/**
 * Fetch exchange rates from multiple API sources with fallback.
 * Tries each source in order until one succeeds.
 */
async function fetchRatesFromAPIs(): Promise<Record<string, number>> {
  // Source 1: open.er-api.com — fully free, no key, no monthly limit
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.rates?.INR) return json.rates;
    }
  } catch {
    // Try next source
  }

  // Source 2: exchangerate-api.com v4 — free tier, 1500 req/month
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.rates?.INR) return json.rates;
    }
  } catch {
    // Try next source
  }

  // Source 3: fawazahmed0/currency-api — free, CDN-hosted, updated daily
  try {
    const res = await fetch(
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const json = await res.json();
      const usdRates = json?.usd;
      if (usdRates?.inr) {
        // This API uses lowercase keys — normalize to uppercase
        const normalized: Record<string, number> = {};
        for (const [key, value] of Object.entries(usdRates)) {
          if (typeof value === "number") {
            normalized[key.toUpperCase()] = value;
          }
        }
        if (normalized["INR"]) return normalized;
      }
    }
  } catch {
    // All sources failed
  }

  throw new Error("All exchange rate API sources failed");
}

export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(req);
    const rateResult = await exchangeRateLimit.check(identifier);
    if (!rateResult.success) {
      return rateLimitResponse(rateResult.reset);
    }

    // Read requested currency from query param (default: USD)
    const currency = req.nextUrl.searchParams.get("currency")?.toUpperCase() || "USD";

    // Return cached value if still fresh
    if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
      const rate = computeINRRate(cached.rates, currency);
      if (rate) {
        return NextResponse.json({ rate, currency, cached: true });
      }
    }

    // Fetch from multiple API sources with fallback
    const rates = await fetchRatesFromAPIs();

    cached = { rates, fetchedAt: Date.now() };

    const rate = computeINRRate(rates, currency);
    if (!rate) {
      // Unknown currency — fall back to USD rate
      return NextResponse.json({
        rate: rates["INR"],
        currency: "USD",
        cached: false,
        fallbackCurrency: true,
      });
    }

    return NextResponse.json({ rate, currency, cached: false });
  } catch {
    // Fallback to cached stale value if available
    if (cached) {
      const currency = req.nextUrl.searchParams.get("currency")?.toUpperCase() || "USD";
      const rate = computeINRRate(cached.rates, currency);
      if (rate) {
        return NextResponse.json({ rate, currency, cached: true, stale: true });
      }
    }

    // Hard fallback: look up the fallback rate for the requested currency
    const currency = req.nextUrl.searchParams.get("currency")?.toUpperCase() || "USD";
    const currencyEntry = Object.values(COUNTRY_CURRENCY_MAP).find(c => c.code === currency);
    const fallbackRate = currencyEntry?.fallbackRate ?? EXCHANGE_RATE_FALLBACK_USD_INR;

    return NextResponse.json({
      rate: fallbackRate,
      currency: currencyEntry?.code ?? "USD",
      cached: false,
      fallback: true,
    });
  }
}
