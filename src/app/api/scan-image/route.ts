import { NextRequest, NextResponse } from "next/server";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "no_image" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: imageBase64,
                  },
                },
                {
                  text: 'Identify this grocery item. Return ONLY a valid JSON object with no markdown, no explanation. Fields: name (string, common grocery item name), category (one of: Dairy, Vegetables, Fruits, Meat, Beverages, Snacks, Grains, Condiments, Frozen, General), expiry_date (string YYYY-MM-DD if visible on packaging else null), confidence (number between 0 and 1)',
                },
              ],
            },
          ],
        }),
      }
    );

    const geminiData: GeminiResponse = await res.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Strip markdown code fences if present
    const clean = text.replace(/```(?:json)?\n?/gi, "").replace(/```/g, "").trim();

    let parsed: {
      name: string;
      category: string;
      expiry_date: string | null;
      confidence: number;
    };
    try {
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json({ error: "low_confidence" });
    }

    if (!parsed.confidence || parsed.confidence < 0.3) {
      return NextResponse.json({ error: "low_confidence" });
    }

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "api_failed" }, { status: 500 });
  }
}
