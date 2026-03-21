import { NextRequest, NextResponse } from "next/server";
import { getPurposePhrase, isForeignPurpose } from "@/lib/utils";
import { CA_FIRM } from "@/constants";
import type { FormData } from "@/types";

const MODELS_TO_TRY = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite-preview-02-05",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash"
];

export async function POST(req: NextRequest) {
  try {
    const { formData }: { formData: FormData } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "API Key missing." }, { status: 500 });
    }

    const isF        = isForeignPurpose(formData.purpose);
    const purposeTxt = getPurposePhrase(formData.purpose, formData.country);
    const applicant  = `${formData.salutation} ${formData.fullName}`;

    // Supporting docs logic
    const incomeDocLines: string[] = [];
    for (const [type, docs] of Object.entries(formData.incomeDocs ?? {})) {
      if (docs && docs.length > 0) {
        const docNames = docs.map((d) => d.name).join(", ");
        incomeDocLines.push(`  - ${type}: ${docNames}`);
      }
    }
    const incomeDocsSection = incomeDocLines.length > 0 ? `\nUploaded docs:\n${incomeDocLines.join("\n")}` : "";

    const prompt = `You are a CA drafting a Net Worth Certificate for ${CA_FIRM.name}.
Applicant: ${applicant}.
Purpose: ${purposeTxt}.
Date: ${formData.certDate}.
Income: ${formData.incomeTypes.join(", ")}.
Assets: ${formData.immovableTypes.join(", ")}, ${formData.movableTypes.join(", ")}.
UDIN: ${formData.udin}.
${incomeDocsSection}

Draft a formal certificate. Output ONLY text. No markdown.`;

    let lastError = "";
    for (const model of MODELS_TO_TRY) {
      try {
        console.log(`Certificate generation: attempting model ${model}...`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3 }
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          const text = result?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
          console.log(`Certificate success with model: ${model}`);
          return NextResponse.json({ success: true, text });
        } else {
          lastError = await response.text();
          console.warn(`Model ${model} failed for certificate: ${lastError}`);
        }
      } catch (e) {
        lastError = String(e);
      }
    }

    return NextResponse.json({ success: false, error: "AI Generation failed. " + lastError }, { status: 500 });
  } catch (error) {
    console.error("Certificate error:", error);
    return NextResponse.json({ success: false, error: "Internal error." }, { status: 500 });
  }
}
