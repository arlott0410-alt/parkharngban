import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const { initData } = await request.json() as { initData: string };

    if (!initData) {
      return NextResponse.json({ valid: false, error: "Missing initData" }, { status: 400 });
    }

    const result = await validateTelegramInitData(initData);

    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error }, { status: 401 });
    }

    return NextResponse.json({ valid: true, user: result.data?.user });
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
