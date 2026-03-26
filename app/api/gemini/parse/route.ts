import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { success: false, error: "AI parse disabled (Mini App only mode)" },
    { status: 410 }
  );
}
