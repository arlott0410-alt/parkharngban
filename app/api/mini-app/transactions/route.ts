import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase";
import { isSubscriptionActive } from "@/lib/utils";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const initDataRaw = request.headers.get("x-telegram-init-data") ?? "";
  const { valid, data: initData } = await validateTelegramInitData(initDataRaw);

  if (!valid || !initData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = initData.user.id;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(`
      *,
      categories (id, name, name_lao, icon, color, type)
    `)
    .eq("user_id", userId)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ transactions: data ?? [] });
}

export async function POST(request: NextRequest) {
  const initDataRaw = request.headers.get("x-telegram-init-data") ?? "";
  const { valid, data: initData } = await validateTelegramInitData(initDataRaw);

  if (!valid || !initData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = initData.user.id;
  const supabase = createAdminClient();

  // Check subscription
  const { data: subData } = await supabase
    .from("subscriptions")
    .select("status, expiry_date")
    .eq("user_id", userId)
    .single();

  if (!subData || !isSubscriptionActive(subData.expiry_date)) {
    return NextResponse.json(
      { error: "ການສະມາຊິກໝົດອາຍຸ — ກະລຸນາຕໍ່ອາຍຸ" },
      { status: 402 }
    );
  }

  const body = await request.json() as {
    type: "income" | "expense";
    amount: number;
    category_id: string;
    description?: string;
    transaction_date: string;
  };

  if (!body.type || !body.amount || body.amount <= 0) {
    return NextResponse.json({ error: "Invalid transaction data" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: body.type,
      amount: body.amount,
      category_id: body.category_id || null,
      description: body.description || null,
      ai_parsed: false,
      transaction_date: body.transaction_date,
    })
    .select()
    .single();

  if (error) {
    console.error("POST transaction error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ transaction: data }, { status: 201 });
}
