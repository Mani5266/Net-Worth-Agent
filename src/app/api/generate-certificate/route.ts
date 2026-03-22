import { NextRequest, NextResponse } from "next/server";
import { getPurposePhrase, isForeignPurpose, computeTotals, formatINR, formatForeign, formatCertDate } from "@/lib/utils";
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

    const totals = computeTotals(formData);
    const dateStr = formatCertDate(formData.certDate);
    const countryLabel = formData.country || "Foreign Currency";
    const isF = isForeignPurpose(formData.purpose);
    const purposeTxt = getPurposePhrase(formData.purpose, formData.country);
    const applicant  = `${formData.salutation} ${formData.fullName}`;

    // Detailed Data for AI
    const incomeDetails = formData.incomeRows.map(r => `- ${r.label}: ${formatINR(parseFloat(r.inr) || 0)}`).join("\n") || "No specified income.";
    const immovDetails = formData.immovableRows.map(r => `- ${r.label}: ${formatINR(parseFloat(r.inr) || 0)}`).join("\n") || "No immovable assets.";
    const movDetails = formData.movableRows.map(r => `- ${r.label}: ${formatINR(parseFloat(r.inr) || 0)}`).join("\n") || "No movable properties.";
    
    // Supporting docs logic
    const docsLines = formData.supportingDocs.map(d => `- ${d}`).join("\n");

    const prompt = `You are an expert Chartered Accountant (CA) drafting a formal Net Worth Certificate.
The output MUST follow this exact structure and be extremely professional.

TEMPLATE:
TO WHOMSOEVER IT MAY CONCERN
NETWORTH CERTIFICATE

I, BODDU ABHISHEK, member of The Institute of Chartered Accountants of India, do hereby certify that I have reviewed the financial condition of the Applicant, ${applicant}, with the view to furnish his net worth ${purposeTxt}. The Below detail of the assets are obtained as on ${dateStr}

[SUMMARY TABLE]
Sources of Funds | Indian (Rs.) ${isF ? `| ${countryLabel}` : ""} | Reference
1. Current Income | ${formatINR(totals.incomeINR)} ${isF ? `| ${formatForeign(totals.incomeForeign)} ` : ""}| Annexure I
2. Immovable Assets | ${formatINR(totals.immovableINR)} ${isF ? `| ${formatForeign(totals.immovableForeign)} ` : ""}| Annexure II
3. Movable Properties | ${formatINR(totals.movableINR)} ${isF ? `| ${formatForeign(totals.movableForeign)} ` : ""}| Annexure III
4. Current Savings | ${formatINR(totals.savingsINR)} ${isF ? `| ${formatForeign(totals.savingsForeign)} ` : ""}| Annexure IV
Total | ${formatINR(totals.grandINR)} ${isF ? `| ${formatForeign(totals.grandForeign)} ` : ""}|

The above figures are compiled from the following documents:
${docsLines}

[Annexure Details - Provide brief professional descriptions based on these inputs]:
Annexure I:
${incomeDetails}

Annexure II:
${immovDetails}

Annexure III:
${movDetails}

[SIGNATURE BLOCK]
For ${CA_FIRM.name},
${CA_FIRM.type},
FRN ${CA_FIRM.frn}

${CA_FIRM.partnerName}
${CA_FIRM.partnerTitle}
Membership No. ${CA_FIRM.membershipNo}
Date: ${dateStr}
Place: ${CA_FIRM.place}
UDIN: ${formData.udin || "__________________________"}

STRICT RULES:
1. DO NOT mention USD conversion rates in the text (keep it in the table).
2. Use formal British English (Indian standard).
3. DO NOT use markdown like **bold** or # headers.
4. Output ONLY the refined certificate text.`;

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
              generationConfig: { 
                temperature: 0.2,
                topP: 0.95
              }
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
