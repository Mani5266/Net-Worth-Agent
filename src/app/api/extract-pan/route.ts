import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import {
  extractPanRateLimit,
  getClientIdentifier,
  rateLimitResponse,
} from "@/lib/ratelimit";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_JSON_BYTES = 50_000; // 50KB max for text-only payloads

const MODELS_TO_TRY = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite-preview-02-05",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash",
];

// ─── Route Handler ────────────────────────────────────────────────────────────
// NOTE: This route is superseded by /api/ocr which uses Gemini Vision directly.
// Kept for backward compatibility with any existing integrations.

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(req);
    const rateResult = await extractPanRateLimit.check(identifier);
    if (!rateResult.success) {
      return rateLimitResponse(rateResult.reset);
    }

    // 1. Body size guard
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_JSON_BYTES) {
      return NextResponse.json(
        { success: false, error: "Request body too large." },
        { status: 413 }
      );
    }

    const body = await req.json();
    const text = body?.text;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid 'text' field." },
        { status: 400 }
      );
    }

    // Guard against excessively long OCR text
    if (text.length > 10_000) {
      return NextResponse.json(
        { success: false, error: "OCR text too long." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "API Key missing." },
        { status: 500 }
      );
    }

    const prompt = `Extract the Full Name and 10-digit PAN Number from this OCR text of an Indian PAN Card.
OCR Text:
"""
${text}
"""

Return ONLY a JSON object: {"fullName": "...", "pan": "..."}
- pan must be 10 characters (e.g. ABCDE1234F).
- fullName should be the person's name (exclude father's name or titles).
If not found, use empty string. No markdown.`;

    let lastError = "";
    for (const model of MODELS_TO_TRY) {
      try {
        console.log(`[extract-pan] Attempting with model: ${model}...`);
        const aiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1 },
            }),
          }
        );

        if (aiRes.ok) {
          const aiJson = await aiRes.json();
          const rawText: string =
            aiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

          console.log(`[extract-pan] Success with model: ${model}`);
          return NextResponse.json({
            success: true,
            fullName: typeof data.fullName === "string" ? data.fullName : "",
            pan: typeof data.pan === "string" ? data.pan : "",
            modelUsed: model,
          });
        } else {
          lastError = await aiRes.text();
          console.warn(`[extract-pan] Model ${model} failed: ${lastError}`);
        }
      } catch (e) {
        lastError = String(e);
        console.error(`[extract-pan] Error with model ${model}:`, e);
      }
    }

    return NextResponse.json(
      { success: false, error: "All models failed. " + lastError },
      { status: 500 }
    );
  } catch (error) {
    console.error("[extract-pan] Extraction error:", error);
    return NextResponse.json(
      { success: false, error: "Internal error." },
      { status: 500 }
    );
  }
}
