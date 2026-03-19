import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase";
import type { BalanceSummary } from "@/types";

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
  const { data, error } = await supabase
    .from("transactions")
    .select("type, amount")
    .eq("user_id", userId)
    .gte("transaction_date", firstDay)
    .lte("transaction_date", lastDay);

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const totalIncome = (data ?? [])
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = (data ?? [])
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  const summary: BalanceSummary = {
    total_income: totalIncome,
    total_expense: totalExpense,
    balance: totalIncome - totalExpense,
    month,
    year,
  };

  return NextResponse.json({ summary });
}
