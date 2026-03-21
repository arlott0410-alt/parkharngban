import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase";
import { getSubscriptionPlansForDisplay } from "@/lib/phajay";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const initDataRaw = request.headers.get("x-telegram-init-data") ?? "";
  const { valid, data: initData } = await validateTelegramInitData(initDataRaw);

  if (!valid || !initData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = initData.user.id;
  const supabase = createAdminClient();

  // Upsert user (sync with Telegram)
  await supabase.from("users").upsert(
    {
      id: userId,
      first_name: initData.user.first_name,
      last_name: initData.user.last_name ?? null,
      username: initData.user.username ?? null,
      language_code: initData.user.language_code ?? "lo",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  const [userRes, subRes, statsRes] = await Promise.all([
    supabase.from("users").select("*").eq("id", userId).single(),
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("transactions").select("type, amount, created_at").eq("user_id", userId),
  ]);

  const stats = statsRes.data ?? [];
  const totalIncome = stats.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = stats.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const memberSince = stats.length > 0
    ? stats.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0].created_at
    : userRes.data?.created_at ?? new Date().toISOString();

  return NextResponse.json({
    user: userRes.data,
    subscription: subRes.data ?? null,
    subscription_plans: getSubscriptionPlansForDisplay(),
    stats: {
      total_transactions: stats.length,
      total_income: totalIncome,
      total_expense: totalExpense,
      member_since: memberSince,
    },
  });
}
