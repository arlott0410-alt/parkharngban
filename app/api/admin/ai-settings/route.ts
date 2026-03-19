import { NextRequest, NextResponse } from "next/server";
import { getAdminSettings, setAdminSettings } from "@/lib/admin-settings";

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

  return NextResponse.json(getAdminSettings());
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { prompt: string; welcomeMessage?: string };
  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "Prompt cannot be empty" }, { status: 400 });
  }

  if (body.welcomeMessage !== undefined && !body.welcomeMessage.trim()) {
    return NextResponse.json({ error: "Welcome message cannot be empty" }, { status: 400 });
  }

  setAdminSettings({
    prompt: body.prompt,
    welcomeMessage: body.welcomeMessage,
  });

  return NextResponse.json({ success: true, message: "Settings updated" });
}
