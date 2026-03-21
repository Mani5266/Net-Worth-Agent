import { NextRequest, NextResponse } from "next/server";

const MODELS_TO_TRY = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite-preview-02-05",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash"
];

export async function POST(req: NextRequest) {
  try {
    const { text }: { text: string } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "API Key missing." }, { status: 500 });
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
        console.log(`Attempting with model: ${model}...`);
        const aiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1 }
            }),
          }
        );

        if (aiRes.ok) {
          const aiJson = await aiRes.json();
          const rawText: string = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
          
          console.log(`Success with model: ${model}`);
          return NextResponse.json({
            success: true,
            fullName: data.fullName || "",
            pan: data.pan || "",
            modelUsed: model
          });
        } else {
          lastError = await aiRes.text();
          console.warn(`Model ${model} failed: ${lastError}`);
        }
      } catch (e) {
        lastError = String(e);
        console.error(`Error with model ${model}:`, e);
      }
    }

    return NextResponse.json(
      { success: false, error: "All models failed. " + lastError },
      { status: 500 }
    );
  } catch (error) {
    console.error("Extraction error:", error);
    return NextResponse.json(
      { success: false, error: "Internal error." },
      { status: 500 }
    );
  }
}
