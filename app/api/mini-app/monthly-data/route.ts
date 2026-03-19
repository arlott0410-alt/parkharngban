import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase";
import type { MonthlyData } from "@/types";

export const runtime = "edge";

const MONTH_LABELS = ["ມ.ກ", "ກ.ພ", "ມ.ນ", "ເ.ສ", "ພ.ສ", "ມ.ຖ", "ກ.ລ", "ສ.ຫ", "ກ.ຍ", "ຕ.ລ", "ພ.ຈ", "ທ.ວ"];

export async function GET(request: NextRequest) {
  const initDataRaw = request.headers.get("x-telegram-init-data") ?? "";
  const { valid, data: initData } = await validateTelegramInitData(initDataRaw);

  if (!valid || !initData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = initData.user.id;
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);

  const firstDay = `${year}-01-01`;
  const lastDay = `${year}-12-31`;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("type, amount, transaction_date")
    .eq("user_id", userId)
    .gte("transaction_date", firstDay)
    .lte("transaction_date", lastDay);

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  // Aggregate by month
  const monthlyMap = Array.from({ length: 12 }, (_, i) => ({
    month: MONTH_LABELS[i],
    income: 0,
    expense: 0,
  }));

  for (const tx of data ?? []) {
    const monthIndex = new Date(tx.transaction_date).getMonth();
    if (tx.type === "income") {
      monthlyMap[monthIndex].income += tx.amount;
    } else {
      monthlyMap[monthIndex].expense += tx.amount;
    }
  }

  // Only return months up to now
  const currentMonth = new Date().getFullYear() === year ? new Date().getMonth() + 1 : 12;
  const result: MonthlyData[] = monthlyMap.slice(0, currentMonth);

  return NextResponse.json({ data: result });
}
