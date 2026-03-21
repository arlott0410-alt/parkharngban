import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase";
import { isSubscriptionActive, isTrialActive } from "@/lib/utils";

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

  /** ແປງ `categories` (join Supabase) ເປັນ `category` ໃຫ້ກົງກັບ UI */
  const transactions = (data ?? []).map((row: Record<string, unknown>) => {
    const cats = row.categories;
    const cat = Array.isArray(cats) ? cats[0] : cats;
    const rest = { ...row };
    delete rest.categories;
    return { ...rest, category: cat };
  });

  return NextResponse.json({ transactions });
}

export async function POST(request: NextRequest) {
  const initDataRaw = request.headers.get("x-telegram-init-data") ?? "";
  const { valid, data: initData } = await validateTelegramInitData(initDataRaw);

  if (!valid || !initData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = initData.user.id;
  const firstName = initData.user.first_name;
  const lastName = initData.user.last_name ?? null;
  const username = initData.user.username ?? null;
  const languageCode = initData.user.language_code ?? "lo";
  const supabase = createAdminClient();

  // Upsert user record so we can use `created_at` for trial calculation.
  await supabase.from("users").upsert(
    {
      id: userId,
      first_name: firstName,
      last_name: lastName,
      username,
      language_code: languageCode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  const [subRes, userRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("expiry_date")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("users").select("created_at").eq("id", userId).maybeSingle(),
  ]);

  const subData = subRes.data;
  const userData = userRes.data;

  const subActive = subData ? isSubscriptionActive(subData.expiry_date) : false;
  const trialActive = isTrialActive(userData?.created_at ?? null);

  if (!subActive && !trialActive) {
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
    raw_text?: string | null;
    ai_parsed?: boolean;
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
      ai_parsed: Boolean(body.ai_parsed),
      raw_text: body.raw_text ?? null,
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
