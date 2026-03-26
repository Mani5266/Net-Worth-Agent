import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
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
 * Returns the latest approximate gold price per gram in INR for 22K and 24K gold.
 * This is used as a reference for validating gold valuations entered in the
 * Net Worth Certificate form. The CA can compare the applicant's declared
 * gold value against current market rates.
 *
 * In production, this would fetch from a live gold price API (e.g. metals-api.com).
 * For now, we use a reference table that is periodically updated.
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

// ─── GET /api/gold-price ──────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse<GoldPriceResponse | { success: false; error: string }>> {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error as NextResponse<{ success: false; error: string }>;

  // Rate limiting
  const identifier = getClientIdentifier(request, authResult.userId);
  const rateResult = await goldPriceRateLimit.check(identifier);
  if (!rateResult.success) {
    return rateLimitResponse(rateResult.reset) as NextResponse<{ success: false; error: string }>;
  }

  return NextResponse.json({
    price24kPerGram: GOLD_REFERENCE_PRICES.price24kPerGram,
    price22kPerGram: GOLD_REFERENCE_PRICES.price22kPerGram,
    price18kPerGram: GOLD_REFERENCE_PRICES.price18kPerGram,
    lastUpdated: GOLD_REFERENCE_PRICES.lastUpdated,
    source: GOLD_REFERENCE_PRICES.source,
  });
}

// ─── POST /api/gold-price (validate a gold valuation) ─────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse<GoldValuation | { error: string }>> {
  const authResult = await requireAuth(request);
  if ("error" in authResult) return authResult.error as NextResponse<{ error: string }>;

  // Rate limiting
  const identifier = getClientIdentifier(request, authResult.userId);
  const rateResult = await goldPriceRateLimit.check(identifier);
  if (!rateResult.success) {
    return rateLimitResponse(rateResult.reset) as NextResponse<{ error: string }>;
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

    const estimatedValue22k = Math.round(grams * GOLD_REFERENCE_PRICES.price22kPerGram);
    const estimatedValue24k = Math.round(grams * GOLD_REFERENCE_PRICES.price24kPerGram);

    let variance22kPercent: number | null = null;
    if (resolvedDeclaredValue !== null && estimatedValue22k > 0) {
      variance22kPercent = Math.round(((resolvedDeclaredValue - estimatedValue22k) / estimatedValue22k) * 100);
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
