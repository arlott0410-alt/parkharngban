import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "edge";

async function assertOwnTransaction(
  supabase: ReturnType<typeof createAdminClient>,
  transactionId: string,
  userId: number
): Promise<{ ok: true } | { ok: false; status: number }> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, user_id")
    .eq("id", transactionId)
    .maybeSingle();

  if (error) {
    console.error("transaction lookup error:", error);
    return { ok: false, status: 500 };
  }
  if (!data || data.user_id !== userId) {
    return { ok: false, status: 404 };
  }
  return { ok: true };
}

/** ແກ້ໄຂລາຍຮັບ/ລາຍຈ່າຍ — ກວດວ່າແຖວເປັນຂອງຜູ້ໃຊ້ Telegram ຄົນນີ້ */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const initDataRaw = request.headers.get("x-telegram-init-data") ?? "";
  const { valid, data: initData } = await validateTelegramInitData(initDataRaw);

  if (!valid || !initData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = initData.user.id;
  const { id: transactionId } = await params;
  const supabase = createAdminClient();

  const gate = await assertOwnTransaction(supabase, transactionId, userId);
  if (!gate.ok) {
    return NextResponse.json({ error: "ບໍ່ພົບທຸລະກຳ" }, { status: gate.status });
  }

  const body = (await request.json()) as {
    type?: "income" | "expense";
    amount?: number;
    category_id?: string | null;
    description?: string | null;
    transaction_date?: string;
  };

  if (
    !body.type ||
    !["income", "expense"].includes(body.type) ||
    typeof body.amount !== "number" ||
    body.amount <= 0 ||
    !body.transaction_date
  ) {
    return NextResponse.json({ error: "ຂໍ້ມູນບໍ່ຄົບຖ້ວນ" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("transactions")
    .update({
      type: body.type,
      amount: body.amount,
      category_id: body.category_id || null,
      description: body.description ?? null,
      transaction_date: body.transaction_date,
      updated_at: nowIso,
    })
    .eq("id", transactionId)
    .eq("user_id", userId)
    .select(
      `
      *,
      categories (id, name, name_lao, icon, color, type)
    `
    )
    .single();

  if (error) {
    console.error("PATCH transaction error:", error);
    return NextResponse.json({ error: "ບໍ່ສາມາດອັບເດດໄດ້" }, { status: 500 });
  }

  const row = { ...(data as Record<string, unknown>) };
  const cats = row.categories;
  const cat = Array.isArray(cats) ? cats[0] : cats;
  delete row.categories;
  return NextResponse.json({ transaction: { ...row, category: cat } });
}

/** ລຶບທຸລະກຳ — ສະເພາະເຈົ້າຂອງແຖວ */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const initDataRaw = request.headers.get("x-telegram-init-data") ?? "";
  const { valid, data: initData } = await validateTelegramInitData(initDataRaw);

  if (!valid || !initData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = initData.user.id;
  const { id: transactionId } = await params;
  const supabase = createAdminClient();

  const gate = await assertOwnTransaction(supabase, transactionId, userId);
  if (!gate.ok) {
    return NextResponse.json({ error: "ບໍ່ພົບທຸລະກຳ" }, { status: gate.status });
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", userId);

  if (error) {
    console.error("DELETE transaction error:", error);
    return NextResponse.json({ error: "ບໍ່ສາມາດລຶບໄດ້" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
