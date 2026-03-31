import { NextRequest, NextResponse } from "next/server";
import {
  goldPriceRateLimit,
  getClientIdentifier,
  rateLimitResponse,
} from "@/lib/ratelimit";
import { GoldValuationRequestSchema } from "@/lib/schemas";
import { GOLD_REFERENCE_PRICES } from "@/constants";

/**
 * Gold price reference API.
 *
 * Scrapes live gold prices from ibjarates.com (official IBJA rates page).
 * Falls back to hardcoded approximate prices if scraping fails.
 * Prices are per gram in INR, without GST/making charges.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface GoldPriceResponse {
  price24kPerGram: number;
  price22kPerGram: number;
  price18kPerGram: number;
  lastUpdated: string;
  source: string;
}

interface GoldValuation {
  grams: number;
  estimatedValue22k: number;
  estimatedValue24k: number;
  declaredValue: number | null;
  variance22kPercent: number | null;
}

// ─── In-memory cache (5-minute TTL) ──────────────────────────────────────────

let cachedPrices: GoldPriceResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Scraper ─────────────────────────────────────────────────────────────────

/**
 * Scrape live gold prices from ibjarates.com.
 * The page has span elements with IDs like GoldRatesCompare999, GoldRatesCompare916, etc.
 * containing price per gram in INR.
 */
async function scrapeLiveGoldPrices(): Promise<GoldPriceResponse | null> {
  try {
    const res = await fetch("https://ibjarates.com", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return null;

    const html = await res.text();

    // Extract prices from span elements:
    //   <span id="GoldRatesCompare999">14673</span>  → 24K (999 purity)
    //   <span id="GoldRatesCompare916">13441</span>  → 22K (916 purity)
    //   <span id="GoldRatesCompare750">11005</span>  → 18K (750 purity)
    const extract = (id: string): number | null => {
      const regex = new RegExp(
        `<span[^>]+id=["']${id}["'][^>]*>\\s*(\\d+)\\s*</span>`,
        "i"
      );
      const match = html.match(regex);
      if (!match || !match[1]) return null;
      return parseInt(match[1], 10);
    };

    const price24k = extract("GoldRatesCompare999");
    const price22k = extract("GoldRatesCompare916");
    const price18k = extract("GoldRatesCompare750");

    // Sanity check: prices should be in a reasonable range (Rs.5,000–50,000 per gram)
    if (
      !price24k ||
      !price22k ||
      !price18k ||
      price24k < 5000 ||
      price24k > 50000
    ) {
      return null;
    }

    return {
      price24kPerGram: price24k,
      price22kPerGram: price22k,
      price18kPerGram: price18k,
      lastUpdated: new Date().toISOString(),
      source: "IBJA (India Bullion and Jewellers Association) — Live",
    };
  } catch {
    return null;
  }
}

/** Get gold prices — cached live scrape, falling back to constants. */
async function getGoldPrices(): Promise<GoldPriceResponse> {
  const now = Date.now();

  // Return cache if fresh
  if (cachedPrices && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPrices;
  }

  // Try live scrape
  const live = await scrapeLiveGoldPrices();
  if (live) {
    cachedPrices = live;
    cacheTimestamp = now;
    return live;
  }

  // If we have a stale cache, use it (better than hardcoded fallback)
  if (cachedPrices) {
    return cachedPrices;
  }

  // Last resort: hardcoded fallback
  return {
    price24kPerGram: GOLD_REFERENCE_PRICES.price24kPerGram,
    price22kPerGram: GOLD_REFERENCE_PRICES.price22kPerGram,
    price18kPerGram: GOLD_REFERENCE_PRICES.price18kPerGram,
    lastUpdated: GOLD_REFERENCE_PRICES.lastUpdated,
    source: GOLD_REFERENCE_PRICES.source,
  };
}

// ─── GET /api/gold-price ──────────────────────────────────────────────────────

export async function GET(
  request: NextRequest
): Promise<NextResponse<GoldPriceResponse | { success: false; error: string }>> {
  // Rate limiting
  const identifier = getClientIdentifier(request);
  const rateResult = await goldPriceRateLimit.check(identifier);
  if (!rateResult.success) {
    return rateLimitResponse(rateResult.reset) as NextResponse<{
      success: false;
      error: string;
    }>;
  }

  const prices = await getGoldPrices();
  return NextResponse.json(prices);
}

// ─── POST /api/gold-price (validate a gold valuation) ─────────────────────────

export async function POST(
  request: NextRequest
): Promise<NextResponse<GoldValuation | { error: string }>> {
  // Rate limiting
  const identifier = getClientIdentifier(request);
  const rateResult = await goldPriceRateLimit.check(identifier);
  if (!rateResult.success) {
    return rateLimitResponse(rateResult.reset) as NextResponse<{
      error: string;
    }>;
  }

  try {
    const body = await request.json();

    // Zod validation
    const parsed = GoldValuationRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { grams, declaredValue } = parsed.data;
    const resolvedDeclaredValue = declaredValue ?? null;

    const prices = await getGoldPrices();
    const estimatedValue22k = Math.round(grams * prices.price22kPerGram);
    const estimatedValue24k = Math.round(grams * prices.price24kPerGram);

    let variance22kPercent: number | null = null;
    if (resolvedDeclaredValue !== null && estimatedValue22k > 0) {
      variance22kPercent = Math.round(
        ((resolvedDeclaredValue - estimatedValue22k) / estimatedValue22k) * 100
      );
    }

    return NextResponse.json({
      grams,
      estimatedValue22k,
      estimatedValue24k,
      declaredValue: resolvedDeclaredValue,
      variance22kPercent,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
