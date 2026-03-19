import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Note: In production, you'd store the custom prompt in Supabase or a KV store.
// For Cloudflare Pages, use KV or D1 for persistence.
// This is a simple in-memory store that resets on cold start.
let customPrompt: string | null = null;

function isAdmin(request: NextRequest): boolean {
  const session = request.cookies.get("admin_session")?.value;
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  return !!session && session === adminId;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { DEFAULT_SYSTEM_PROMPT } = await import("@/lib/gemini");
  return NextResponse.json({ prompt: customPrompt ?? DEFAULT_SYSTEM_PROMPT });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { prompt: string };
  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "Prompt cannot be empty" }, { status: 400 });
  }

  customPrompt = body.prompt;

  return NextResponse.json({ success: true, message: "Prompt updated" });
}
