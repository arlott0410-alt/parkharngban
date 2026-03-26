import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { isAdminRequest } from "@/lib/admin-auth";
import type { CategoryFormData } from "@/types";

export const runtime = "edge";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json() as Partial<CategoryFormData>;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("categories")
    .update({
      name: body.name,
      name_lao: body.name_lao ?? null,
      type: body.type,
      icon: body.icon,
      color: body.color,
      sort_order: body.sort_order,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ category: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // Don't delete default categories
  const { data: cat } = await supabase
    .from("categories")
    .select("is_default")
    .eq("id", id)
    .single();

  if (cat?.is_default) {
    return NextResponse.json({ error: "Cannot delete default category" }, { status: 400 });
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
