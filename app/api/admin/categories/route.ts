import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import type { CategoryFormData } from "@/types";

export const runtime = "edge";

// Verify admin via cookie
function isAdmin(request: NextRequest): boolean {
  const session = request.cookies.get("admin_session")?.value;
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  return !!session && session === adminId;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ categories: data });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as CategoryFormData;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: body.name,
      name_lao: body.name_lao ?? null,
      type: body.type,
      icon: body.icon ?? "💰",
      color: body.color ?? "#6366F1",
      is_default: false,
      sort_order: body.sort_order ?? 99,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ category: data }, { status: 201 });
}
