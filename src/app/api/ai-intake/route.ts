import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import {
  aiIntakeRateLimit,
  getClientIdentifier,
  rateLimitResponse,
} from "@/lib/ratelimit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { FormDataSchema } from "@/lib/schemas";

// ─── Key fields for missing-fields hint ───────────────────────────────────────

const KEY_FIELDS: { key: string; label: string }[] = [
  { key: "purpose", label: "purpose of certificate" },
  { key: "fullName", label: "full name" },
  { key: "passportNumber", label: "passport number" },
  { key: "country", label: "country" },
  { key: "salutation", label: "salutation (Mr./Ms./Mrs.)" },
];

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI assistant for an Indian Chartered Accountant firm's Net Worth Certificate portal.

Your job: have a natural conversation to collect financial details, then return structured data matching the exact FormData schema below.

Input may contain mixed scripts (Hindi, Telugu, English). You must correctly interpret meaning across languages without requiring translation.

## RESPONSE FORMAT (STRICT)

Return ONLY a JSON object with this exact shape:
{
  "message": "your short conversational reply to the user",
  "extractedData": { ...accumulated Partial<FormData> }
}

Do not include any text outside JSON.
Do not wrap in markdown or code fences.
Output must be directly parsable by JSON.parse.

## RULES

1. NEVER guess amounts, values, or numbers. If the user hasn't stated a value, omit that field entirely.
2. extractedData must carry forward ALL previously extracted fields (provided as "Current extracted data" below) plus any new fields from this conversation turn.
3. Only include fields the user has explicitly provided. Omit unknown fields.
4. Use exact enum values and formats listed below. Do not invent new values.
5. Ask focused follow-up questions to collect missing important fields (purpose, name, passport, country, income sources, assets).
6. Keep your "message" replies concise and helpful.
7. Return COMPLETE accumulated extractedData including all previously extracted fields. Do not drop fields from prior turns.
8. Do not remove or modify existing fields unless the user explicitly corrects them.
9. If a field is not EXPLICITLY mentioned by the user, DO NOT include it. Do not infer salutation, country, gender, or any value the user has not stated.
10. Convert spoken numbers from any language into numeric strings:
    - "50 lakh", "50 लाख", "50 లక్షలు", "pachaas lakh" → "5000000"
    - "1 crore", "1 करोड़", "1 కోటి", "ek crore" → "10000000"
    - "పది లక్షలు" (ten lakhs) → "1000000"
    - Keep currency in INR unless explicitly stated otherwise.
11. Names must be preserved exactly as spoken (no translation of names).
12. If the user corrects a previously provided value, update it. Otherwise, do not remove or overwrite existing fields.

## EXAMPLES

Example 1:
User: "I need a visa certificate for the US"
Response extractedData: { "purpose": "travel_visa", "country": "USA ($)" }
(Note: salutation and fullName are NOT included because the user did not mention them)

Example 2:
User: "My name is Rahul Sharma, passport J1234567"
Response extractedData: { "fullName": "Rahul Sharma", "passportNumber": "J1234567" }
(Note: salutation is NOT included because the user did not say Mr./Ms./Mrs.)

Example 3:
User: "I have a flat in Mumbai worth 50 lakhs"
Response extractedData: {
  "immovableTypes": ["Self"],
  "immovableProperties": {
    "Self": [{"propertyType": "Residential Property", "customType": "", "address": "Mumbai"}]
  },
  "immovableRows": [
    {"label": "Residential Property - Mumbai", "inr": "5000000"}
  ]
}
(Note: immovableLabels is NOT included because we don't have the display name yet)

Example 4 (Hindi):
User: "मुझे US visa के लिए certificate चाहिए"
Response extractedData: { "purpose": "travel_visa", "country": "USA ($)" }
(Note: salutation, fullName NOT included — user did not mention them)

Example 5 (Telugu):
User: "నా దగ్గర 50 లక్షల విలువైన ఇల్లు ఉంది, Hyderabad లో"
Response extractedData: {
  "immovableTypes": ["Self"],
  "immovableProperties": {
    "Self": [{"propertyType": "Residential Property", "customType": "", "address": "Hyderabad"}]
  },
  "immovableRows": [
    {"label": "Residential Property - Hyderabad", "inr": "5000000"}
  ]
}

Example 6 (Mixed Hinglish):
User: "mera naam Rahul Sharma hai, passport J1234567"
Response extractedData: { "fullName": "Rahul Sharma", "passportNumber": "J1234567" }
(Note: salutation NOT included — user did not say Mr./Ms./Mrs.)

## FormData SCHEMA

### Step 0 — Purpose
- purpose: one of "bank_finance" | "study_loan" | "travel_visa" | "disputes" | "tender" | "franchise" | "foreign_collab" | "nbfc" | "insolvency" | "personal_planning" | "business_valuation"
  Labels: Bank Finance, Study Loan / Scholarship, Travelling VISA, Disputes, Tender Participation, Franchise Applications, Foreign Collaboration / Joint Venture, Financial Institutions / NBFC Registration, Insolvency / Financial Restructuring, Personal Financial Planning, Business Valuation
- country: one of "USA ($)" | "UK (£)" | "Europe – Euro (€)" | "Canada (CAD $)" | "Australia (AUD $)" | "UAE (AED)" | "Singapore (SGD)" | "Japan (¥)" | "Other"
- certDate: YYYY-MM-DD format (the date of the certificate)
- exchangeRate: string number (manual override, usually leave empty)

### Step 1 — Applicant
- salutation: "Mr." | "Ms." | "Mrs."
- fullName: full name in Title Case
- passportNumber: exactly 1 uppercase letter + 7 digits (e.g. J1234567). Indian passport format only.

### Step 2 — Annexure I: Income
- assessmentYear: format "YYYY-YY" (e.g. "2025-26")
- incomeTypes: array of person identifiers whose income is declared. Allowed: "Self", "Mother", "Father", "Spouse"
- incomeLabels: Record<string, string> mapping person identifier to display name. e.g. {"Self": "Rahul Sharma", "Father": "Suresh Sharma"}
- incomeRows: array of {label: string, inr: string}. One row per person in incomeTypes. label = "Annual Income of [Display Name]", inr = amount as string (digits/commas only, no currency symbol).

### Step 3 — Annexure II: Immovable Assets
- immovableTypes: array of person identifiers. Allowed: "Self", "Mother", "Father", "Spouse"
- immovableLabels: Record<string, string> mapping person to display name
- immovableProperties: Record<string, Array<{propertyType, customType, address}>> keyed by person identifier
  propertyType: one of "Residential Property" | "Commercial Property" | "Land" | "Under-Construction Property" | "Jointly Owned Property" | "Other"
  customType: string (only when propertyType is "Other")
  address: full property address
- immovableRows: array of {label: string, inr: string}. One row per property. label = "[PropertyType] - [Address snippet]"

### Step 4 — Annexure III: Movable Assets
- movableTypes: array of person identifiers. Allowed: "Self", "Mother", "Father", "Spouse"
- movableLabels: Record<string, string> mapping person to display name
- movableAssets: Record<string, Array<{assetType, customType, description, goldGrams?, goldKarat?}>> keyed by person
  assetType: one of "Gold & Jewellery" | "Vehicles" | "Household Assets" | "Other Movable Assets"
  customType: string (only when assetType is "Other Movable Assets")
  description: description of the asset
  goldGrams: string, weight in grams (only for Gold & Jewellery)
  goldKarat: "22K" | "24K" (only for Gold & Jewellery, default "22K")
- movableRows: array of {label: string, inr: string}

### Step 5 — Annexure IV: Savings
- savingsTypes: array of person identifiers. Allowed: "Self", "Mother", "Father", "Spouse"
- savingsLabels: Record<string, string> mapping person to display name
- savingsEntries: Record<string, Array<{category, customCategory, description, bankName?, accountNature?, bankBranch?}>> keyed by person
  category: one of "Bank-Related Assets" | "Investment Instruments" | "Insurance" | "Physical Assets" | "Other Additions"
  customCategory: string (only when category is "Other Additions")
  description: description
  bankName: string (only for Bank-Related Assets)
  accountNature: "Savings" | "Current" (only for Bank-Related Assets)
  bankBranch: string (only for Bank-Related Assets)
- savingsRows: array of {label: string, inr: string} (nullable)

### Step 6 — Signatory (CA Firm)
- firmName: CA firm name
- firmFRN: Firm Registration Number
- signatoryName: signing partner name
- signatoryTitle: e.g. "Partner" or "Proprietor"
- membershipNo: ICAI membership number
- signPlace: place of signing

## CONVERSATION GUIDELINES

1. Start by asking the purpose of the certificate.
2. Then collect applicant details (name, salutation, passport).
3. Ask about country (for visa/study purposes).
4. Ask about income sources and amounts for each family member.
5. Ask about properties, movable assets, and savings.
6. When the user seems done, summarize what you've collected and suggest they proceed to the wizard to review and complete the form.
7. If the user provides information in a natural way (e.g. "I have a flat in Mumbai worth 50 lakhs"), extract the structured data correctly.`;

// ─── Route Handler ────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    // 0. Auth check — same pattern as OCR route
    let authenticated = false;
    try {
      const supabase = createSupabaseServerClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      authenticated = !authError && !!user;
    } catch {
      authenticated = false;
    }

    if (!authenticated) {
      const cookieHeader = req.headers.get("cookie") || "";
      const hasAuthCookie = cookieHeader.includes("sb-") && cookieHeader.includes("auth-token");
      if (!hasAuthCookie) {
        return NextResponse.json(
          { success: false, error: "Unauthorized. Please log in and try again." },
          { status: 401 }
        );
      }
    }

    // 1. Rate limiting
    const identifier = getClientIdentifier(req);
    const rateResult = await aiIntakeRateLimit.check(identifier);
    if (!rateResult.success) {
      return rateLimitResponse(rateResult.reset);
    }

    // 2. Parse and validate request body
    let body: { messages?: unknown; currentExtractedData?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const { messages, currentExtractedData } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: "messages must be a non-empty array." },
        { status: 400 }
      );
    }

    // Basic validation of message shape
    for (const msg of messages) {
      if (
        typeof msg !== "object" ||
        msg === null ||
        !["user", "assistant"].includes(msg.role) ||
        typeof msg.content !== "string"
      ) {
        return NextResponse.json(
          { success: false, error: "Each message must have role ('user'|'assistant') and content (string)." },
          { status: 400 }
        );
      }
    }

    const safeExtractedData =
      typeof currentExtractedData === "object" && currentExtractedData !== null
        ? currentExtractedData
        : {};

    // 3. Trim to last 20 messages
    const trimmedMessages = (messages as ChatMessage[]).slice(-20);

    // PII-safe request logging — no message content, only shapes
    const lastUserMsg = trimmedMessages.filter((m) => m.role === "user").pop();
    console.log("[AI_INTAKE_REQUEST]", {
      messageCount: trimmedMessages.length,
      lastUserMessageLength: lastUserMsg?.content.length ?? 0,
      extractedKeyCount: Object.keys(safeExtractedData).length,
      extractedKeys: Object.keys(safeExtractedData),
    });

    // 4. Get API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[AI Intake] GEMINI_API_KEY not configured");
      return NextResponse.json(
        { success: false, error: "Server configuration error." },
        { status: 500 }
      );
    }

    // 5. Build Gemini contents
    const systemWithContext =
      SYSTEM_PROMPT +
      "\n\nCurrent extracted data:\n" +
      JSON.stringify(safeExtractedData);

    const contents = [
      {
        role: "user",
        parts: [{ text: systemWithContext }],
      },
      ...trimmedMessages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
    ];

    // 6. Call Gemini
    const aiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error(`[AI Intake] Gemini returned ${aiRes.status}: ${errText}`);
      return NextResponse.json(
        { success: false, error: "AI service error. Please try again." },
        { status: 502 }
      );
    }

    const aiJson = await aiRes.json();
    const rawText: string =
      aiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!rawText) {
      console.error("[AI Intake] Gemini returned empty response");
      return NextResponse.json(
        { success: false, error: "AI returned an empty response. Please try again." },
        { status: 502 }
      );
    }

    // 7. Parse — direct JSON.parse, no regex
    let parsed: { message: string; extractedData: Record<string, unknown> };
    try {
      parsed = JSON.parse(rawText.trim());
    } catch (e) {
      console.error("[AI Intake] Failed to parse AI response:", rawText.slice(0, 500), e);
      return NextResponse.json(
        { success: false, error: "AI returned an unexpected response. Please try again." },
        { status: 502 }
      );
    }

    // 8. Validate shape
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.message !== "string" ||
      typeof parsed.extractedData !== "object" ||
      parsed.extractedData === null
    ) {
      console.error("[AI Intake] Invalid response shape:", JSON.stringify(parsed).slice(0, 500));
      return NextResponse.json(
        { success: false, error: "AI returned an unexpected response format. Please try again." },
        { status: 502 }
      );
    }

    // 9. Zod validation — strip unknown keys, apply defaults
    const validation = FormDataSchema.partial().safeParse(parsed.extractedData);

    let validatedData: Record<string, unknown>;
    if (validation.success) {
      validatedData = validation.data as Record<string, unknown>;
    } else {
      // Log Zod error paths (no PII)
      console.warn("[AI_INTAKE_VALIDATION_FAIL]", {
        errorPaths: validation.error.issues.map((i) => i.path.join(".")),
        errorMessages: validation.error.issues.map((i) => i.message),
        rawKeys: Object.keys(parsed.extractedData),
      });
      // Fallback: return AI message but empty extractedData
      validatedData = {};
    }

    // 10. Missing fields hint — only when 1-3 key fields remain
    let finalMessage = parsed.message;
    const missingFields = KEY_FIELDS.filter(
      (f) =>
        (validatedData as Record<string, unknown>)[f.key] === undefined ||
        (validatedData as Record<string, unknown>)[f.key] === null
    );
    if (missingFields.length >= 1 && missingFields.length <= 3) {
      const missing = missingFields.map((f) => f.label).join(", ");
      finalMessage += `\n\nI still need: ${missing}.`;
    }

    // PII-safe response logging
    console.log("[AI_INTAKE_RESPONSE]", {
      extractedKeys: Object.keys(validatedData),
      extractedKeyCount: Object.keys(validatedData).length,
      missingKeyFields: missingFields.map((f) => f.key),
      validationPassed: validation.success,
    });

    // 11. Return
    return NextResponse.json({
      message: finalMessage,
      extractedData: validatedData,
    });
  } catch (error) {
    console.error("[AI Intake] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
