import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: "Telegram bot flow disabled (Mini App only mode)" },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    { service: "telegram-webhook", status: "disabled", mode: "mini-app-only" },
    { status: 410 }
  );
}
