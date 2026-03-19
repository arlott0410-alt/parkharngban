import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase";
import type { CategorySpending } from "@/types";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const initDataRaw = request.headers.get("x-telegram-init-data") ?? "";
  const { valid, data: initData } = await validateTelegramInitData(initDataRaw);

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
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select(`
      type, amount,
      categories (id, name, name_lao, icon, color, type)
    `)
    .eq("user_id", userId)
    .not("category_id", "is", null)
    .gte("transaction_date", firstDay)
    .lte("transaction_date", lastDay);

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  // Aggregate by category
  const categoryMap = new Map<string, CategorySpending>();
  let totalExpense = 0;
  let totalIncome = 0;

  for (const tx of transactions ?? []) {
    const cat = Array.isArray(tx.categories) ? tx.categories[0] : tx.categories;
    if (!cat) continue;

    const key = `${cat.id}-${tx.type}`;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        category_id: cat.id,
        category_name: cat.name,
        category_name_lao: cat.name_lao ?? undefined,
        icon: cat.icon,
        color: cat.color,
        amount: 0,
        percentage: 0,
        type: tx.type,
      });
    }

    categoryMap.get(key)!.amount += tx.amount;

    if (tx.type === "expense") totalExpense += tx.amount;
    else totalIncome += tx.amount;
  }

  // Calculate percentages
  const result: CategorySpending[] = Array.from(categoryMap.values()).map((c) => ({
    ...c,
    percentage: Math.round((c.amount / (c.type === "expense" ? totalExpense : totalIncome)) * 100) || 0,
  }));

  return NextResponse.json({ data: result });
}
