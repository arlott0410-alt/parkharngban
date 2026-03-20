import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase";
import { isSubscriptionActive, isTrialActive, transactionsToCSV } from "@/lib/utils";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const initDataRaw = request.headers.get("x-telegram-init-data") ?? "";
  const { valid, data: initData } = await validateTelegramInitData(initDataRaw);

  if (!valid || !initData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = initData.user.id;
  const supabase = createAdminClient();

  // Upsert user record so we can use `created_at` for trial calculation.
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

  const [subRes, userRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("expiry_date")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("users").select("created_at").eq("id", userId).maybeSingle(),
  ]);

  const subData = subRes.data;
  const trialActive = isTrialActive(userRes.data?.created_at ?? null);
  const subActive = subData ? isSubscriptionActive(subData.expiry_date) : false;

  if (!subActive && !trialActive) {
    return NextResponse.json({ error: "Subscription required" }, { status: 402 });
  }

  // Fetch all transactions
  const { data, error } = await supabase
    .from("transactions")
    .select(`*, categories (name, name_lao)`)
    .eq("user_id", userId)
    .order("transaction_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const csv = transactionsToCSV(data ?? []);
  const filename = `pah-khaang-baan-${userId}-${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
