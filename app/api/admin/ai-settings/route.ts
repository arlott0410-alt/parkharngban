import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSettings,
  setAdminSettings,
  normalizeSelectedModel,
} from "@/lib/admin-settings";
import { GEMINI_MODEL_OPTIONS } from "@/lib/gemini-models";

export const runtime = "edge";

function isAdmin(request: NextRequest): boolean {
  const session = request.cookies.get("admin_session")?.value;
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  return !!session && session === adminId;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getAdminSettings();
  return NextResponse.json({
    prompt: settings.prompt,
    welcomeMessage: settings.welcomeMessage,
    selected_model: settings.selectedModel,
  });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    prompt: string;
    welcomeMessage?: string;
    selected_model?: string;
  };
  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "Prompt cannot be empty" }, { status: 400 });
  }

  if (body.welcomeMessage !== undefined && !body.welcomeMessage.trim()) {
    return NextResponse.json({ error: "Welcome message cannot be empty" }, { status: 400 });
  }

  if (
    body.selected_model !== undefined &&
    !GEMINI_MODEL_OPTIONS.includes(body.selected_model as (typeof GEMINI_MODEL_OPTIONS)[number])
  ) {
    return NextResponse.json({ error: "Invalid Gemini model" }, { status: 400 });
  }

  await setAdminSettings({
    prompt: body.prompt,
    welcomeMessage: body.welcomeMessage,
    selectedModel: normalizeSelectedModel(body.selected_model),
  });

  return NextResponse.json({ success: true, message: "Settings updated" });
}
