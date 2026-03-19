import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const initDataRaw = request.headers.get("x-telegram-init-data") ?? "";
  const { valid, data: initData } = validateTelegramInitData(initDataRaw);

  if (!valid || !initData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = initData.user.id;
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1), 10);
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);

  const firstDay = new Date(year, month - 1, 1).toISOString().split("T")[0];
  const lastDay = new Date(year, month, 0).toISOString().split("T")[0];

  const supabase = createAdminClient();

  // Get budgets
  const { data: budgets, error: budgetError } = await supabase
    .from("budgets")
    .select(`*, categories (id, name, name_lao, icon, color, type)`)
    .eq("user_id", userId)
    .eq("month", month)
    .eq("year", year);

  if (budgetError) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  // Get spending per category this month
  const categoryIds = (budgets ?? []).map((b) => b.category_id);

  let spendingMap: Record<string, number> = {};

  if (categoryIds.length > 0) {
    const { data: txData } = await supabase
      .from("transactions")
      .select("category_id, amount")
      .eq("user_id", userId)
      .eq("type", "expense")
      .in("category_id", categoryIds)
      .gte("transaction_date", firstDay)
      .lte("transaction_date", lastDay);

    for (const tx of txData ?? []) {
      if (tx.category_id) {
        spendingMap[tx.category_id] = (spendingMap[tx.category_id] ?? 0) + tx.amount;
      }
    }
  }

  // Attach spending to budgets
  const budgetsWithProgress = (budgets ?? []).map((b) => {
    const spent = spendingMap[b.category_id] ?? 0;
    return {
      ...b,
      spent,
      percentage: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
    };
  });

  return NextResponse.json({ budgets: budgetsWithProgress });
}

export async function POST(request: NextRequest) {
  const initDataRaw = request.headers.get("x-telegram-init-data") ?? "";
  const { valid, data: initData } = validateTelegramInitData(initDataRaw);

  if (!valid || !initData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = initData.user.id;
  const body = await request.json() as {
    category_id: string;
    amount: number;
    month: number;
    year: number;
  };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("budgets")
    .upsert(
      {
        user_id: userId,
        category_id: body.category_id,
        amount: body.amount,
        month: body.month,
        year: body.year,
      },
      { onConflict: "user_id,category_id,month,year" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ budget: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const initDataRaw = request.headers.get("x-telegram-init-data") ?? "";
  const { valid, data: initData } = validateTelegramInitData(initDataRaw);

  if (!valid || !initData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { id: string; amount: number };
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("budgets")
    .update({ amount: body.amount })
    .eq("id", body.id)
    .eq("user_id", initData.user.id);

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
