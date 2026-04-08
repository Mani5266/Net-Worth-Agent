import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import {
  ocrRateLimit,
  getClientIdentifier,
  rateLimitResponse,
} from "@/lib/ratelimit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isValidPassportNumber } from "@/lib/mrz";
import { extractPassportMRZ } from "@/lib/ocr-fallback";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const MODELS_TO_TRY = [
  "gemini-2.0-flash",
];

const DOCUMENT_PROMPTS: Record<string, string> = {
  passport: `You are an expert at reading Indian passports.
Extract the following fields from this passport image:

1. **fullName** — The full name of the passport holder. Use TITLE CASE.
2. **passportNumber** — The Indian passport number (exactly 1 uppercase letter followed by 7 digits, e.g. A1234567).

Return ONLY a JSON object with this exact shape:
{"fullName": "...", "passportNumber": "..."}

Rules:
- If a field is not clearly visible, return an empty string for that field.
- The passport number must match the format: 1 letter + 7 digits.
- Do not guess or infer missing characters.
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

/** Privacy-safe passport hint: first char + last char + length */
function maskPassport(pp: string): string {
  if (pp.length === 0) return "empty";
  return `${pp[0]}..${pp[pp.length - 1]}(${pp.length})`;
}


// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 0. Auth check — hard failure, no fallbacks
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in and try again." },
        { status: 401 }
      );
    }

    // 1. Rate limiting
    const identifier = getClientIdentifier(req);
    const rateResult = await ocrRateLimit.check(identifier);
    if (!rateResult.success) {
      return rateLimitResponse(rateResult.reset);
    }

    // 2. Parse FormData
    let formData: globalThis.FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request. Expected multipart form data." },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    const documentType = formData.get("documentType");

    // 3. Validate fields
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No file uploaded." },
        { status: 400 }
      );
    }

    if (typeof documentType !== "string" || !["passport", "aadhaar"].includes(documentType)) {
      return NextResponse.json(
        { success: false, error: "Invalid document type. Must be 'passport' or 'aadhaar'." },
        { status: 400 }
      );
    }

    // 4. File size guard (prevent abuse even with compression)
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum 5MB." },
        { status: 413 }
      );
    }

    // 5. Validate MIME type
    const mimeType = file.type || "image/jpeg";
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

    // 6. Convert file to base64 for Gemini API
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");

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

        // 9. Post-process and return based on document type
        if (documentType === "passport") {
          const rawPp = typeof extracted.passportNumber === "string"
            ? extracted.passportNumber.replace(/\s/g, "").toUpperCase()
            : "";
          const geminiName = typeof extracted.fullName === "string" ? extracted.fullName.trim() : "";
          const geminiValid = isValidPassportNumber(rawPp);
          const isImage = mimeType !== "application/pdf";

          // MRZ-first: for images, attempt MRZ before deciding on Gemini
          let mrzResult: Awaited<ReturnType<typeof extractPassportMRZ>> = null;
          if (isImage) {
            mrzResult = await extractPassportMRZ(base64Data, mimeType);
          }

          const mrzValid = mrzResult !== null && isValidPassportNumber(mrzResult.passportNumber);
          const mrzPp = mrzValid ? mrzResult!.passportNumber : "";
          const conflict = geminiValid && mrzValid && rawPp !== mrzPp;

          // Conflict: both valid but disagree — trust Gemini (visual) over MRZ (OCR noise)
          if (conflict) {
            console.warn(`[OCR] passport_conflict | gemini=${maskPassport(rawPp)} | mrz=${maskPassport(mrzPp)}`);
          }

          // Source decision: MRZ wins only when it agrees with Gemini or Gemini is invalid
          const source = mrzValid && !conflict ? "mrz" : "gemini";

          // Unified confidence log
          console.log(
            `[OCR] passport | source=${source}` +
            ` | gemini_valid=${geminiValid} | mrz_valid=${mrzValid}` +
            ` | mrz_attempted=${isImage} | conflict=${conflict}`
          );

          if (mrzValid && !conflict && mrzResult) {
            return NextResponse.json({
              success: true,
              fullName: mrzResult.fullName,
              passportNumber: mrzResult.passportNumber,
              modelUsed: model,
              source: "mrz",
            });
          }

          // Fallback: return Gemini result (validated against Indian format)
          return NextResponse.json({
            success: true,
            fullName: geminiName,
            passportNumber: geminiValid ? rawPp : "",
            modelUsed: model,
            source: "gemini",
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
