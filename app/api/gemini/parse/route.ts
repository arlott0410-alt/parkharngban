import { NextRequest, NextResponse } from "next/server";
import { parseTransaction } from "@/lib/gemini";
import type { GeminiParseRequest } from "@/types";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GeminiParseRequest & { customPrompt?: string };

    if (!body.text?.trim()) {
      return NextResponse.json({ success: false, error: "Missing text" }, { status: 400 });
    }

    const result = await parseTransaction(body.text, body.customPrompt);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Gemini parse API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
