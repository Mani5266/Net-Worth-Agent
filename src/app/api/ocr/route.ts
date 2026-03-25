import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import {
  ocrRateLimit,
  getClientIdentifier,
  rateLimitResponse,
} from "@/lib/ratelimit";
import { requireAuth } from "@/lib/auth-guard";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const MODELS_TO_TRY = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite-preview-02-05",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash",
];

const DOCUMENT_PROMPTS: Record<string, string> = {
  passport: `You are an expert at reading Indian Passports.
Extract the following fields from this passport image:

1. **fullName** — The full name of the passport holder. Use TITLE CASE.
2. **passportNumber** — The passport number (format: 1 uppercase letter + 7 digits, e.g. J1234567).

Return ONLY a JSON object with this exact shape:
{"fullName": "...", "passportNumber": "..."}

Rules:
- If a field is not clearly visible, return an empty string for that field.
- The passport number must be exactly 8 characters matching the pattern [A-Z][0-9]{7}.
- Do NOT include any markdown formatting, code fences, or extra text.
- Do NOT include date of birth, address, or any other field.`,

  aadhaar: `You are an expert at reading Indian Aadhaar cards.
Extract the following fields from this Aadhaar card image:

1. **name** — The name on the card. Use TITLE CASE.
2. **aadhaarLast4** — Only the last 4 digits of the Aadhaar number (for privacy).
3. **address** — The address printed on the card, if visible.
4. **dob** — Date of birth in DD/MM/YYYY format, if visible.

Return ONLY a JSON object with this exact shape:
{"name": "...", "aadhaarLast4": "...", "address": "...", "dob": "..."}

Rules:
- If a field is not clearly visible, return an empty string for that field.
- NEVER return the full 12-digit Aadhaar number — only the last 4 digits.
- Do NOT include any markdown formatting, code fences, or extra text.`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidDocumentType(type: unknown): type is "passport" | "aadhaar" {
  return type === "passport" || type === "aadhaar";
}

function extractMimeType(base64: string): { mimeType: string; data: string } {
  // base64 may come as "data:image/jpeg;base64,..." or raw base64
  const match = base64.match(/^data:([^;]+);base64,(.+)$/);
  if (match && match[1] && match[2]) {
    return { mimeType: match[1], data: match[2] };
  }
  // Assume JPEG if no prefix
  return { mimeType: "image/jpeg", data: base64 };
}

function validatePassport(passportNumber: string): boolean {
  return /^[A-Z][0-9]{7}$/.test(passportNumber);
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 0. Authentication check
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;

    // 1. Rate limiting
    const identifier = getClientIdentifier(req, authResult.userId);
    const rateResult = await ocrRateLimit.check(identifier);
    if (!rateResult.success) {
      return rateLimitResponse(rateResult.reset);
    }

    // 2. Body size guard
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Request body too large. Maximum 5MB." },
        { status: 413 }
      );
    }

    // 3. Parse body
    const body = await req.json();
    const { image, documentType } = body as {
      image?: unknown;
      documentType?: unknown;
    };

    // 4. Validate inputs
    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid 'image' field. Expected base64 string." },
        { status: 400 }
      );
    }

    if (!isValidDocumentType(documentType)) {
      return NextResponse.json(
        { success: false, error: "Invalid 'documentType'. Must be 'passport' or 'aadhaar'." },
        { status: 400 }
      );
    }

    // 5. Check image size (base64 is ~33% larger than binary)
    const { mimeType, data: base64Data } = extractMimeType(image);
    const estimatedBytes = (base64Data.length * 3) / 4;
    if (estimatedBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Image too large. Maximum 5MB." },
        { status: 413 }
      );
    }

    // 6. Validate MIME type
    const allowedMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!allowedMimes.includes(mimeType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${mimeType}. Accepted: JPEG, PNG, WebP, PDF.`,
        },
        { status: 400 }
      );
    }

    // 7. Get API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("OCR route: GEMINI_API_KEY not configured");
      return NextResponse.json(
        { success: false, error: "Server configuration error." },
        { status: 500 }
      );
    }

    // 8. Call Gemini Vision with model fallback
    const prompt = DOCUMENT_PROMPTS[documentType];
    let lastError = "";

    for (const model of MODELS_TO_TRY) {
      try {
        const aiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    {
                      inlineData: {
                        mimeType,
                        data: base64Data,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 256,
              },
            }),
          }
        );

        if (!aiRes.ok) {
          lastError = await aiRes.text();
          console.warn(`[OCR] Model ${model} returned ${aiRes.status}: ${lastError}`);
          continue;
        }

        const aiJson = await aiRes.json();
        const rawText: string =
          aiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

        // Extract JSON from response (handle potential markdown wrapping)
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          lastError = `Model ${model} returned non-JSON: ${rawText.slice(0, 200)}`;
          console.warn(`[OCR] ${lastError}`);
          continue;
        }

        const extracted = JSON.parse(jsonMatch[0]);

        // 8. Post-process and return based on document type
        if (documentType === "passport") {
          const passportNumber = typeof extracted.passportNumber === "string" ? extracted.passportNumber.toUpperCase().trim() : "";
          return NextResponse.json({
            success: true,
            fullName: typeof extracted.fullName === "string" ? extracted.fullName.trim() : "",
            passportNumber: validatePassport(passportNumber) ? passportNumber : "",
            modelUsed: model,
          });
        }

        if (documentType === "aadhaar") {
          return NextResponse.json({
            success: true,
            name: typeof extracted.name === "string" ? extracted.name.trim() : "",
            aadhaarLast4:
              typeof extracted.aadhaarLast4 === "string"
                ? extracted.aadhaarLast4.replace(/\D/g, "").slice(-4)
                : "",
            address: typeof extracted.address === "string" ? extracted.address.trim() : "",
            dob: typeof extracted.dob === "string" ? extracted.dob.trim() : "",
            modelUsed: model,
          });
        }
      } catch (e) {
        lastError = String(e);
        console.error(`[OCR] Error with model ${model}:`, e);
      }
    }

    // All models failed
    return NextResponse.json(
      { success: false, error: "All AI models failed to process the document. " + lastError },
      { status: 500 }
    );
  } catch (error) {
    console.error("[OCR] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
