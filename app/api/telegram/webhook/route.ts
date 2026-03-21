import { NextRequest, NextResponse } from "next/server";
import {
  validateWebhookSecret,
  sendTelegramMessage,
  buildSuccessReply,
  buildErrorReply,
  buildWelcomeMessage,
} from "@/lib/telegram";
import { parseTransaction, matchCategoryByHint } from "@/lib/gemini";
import { createAdminClient } from "@/lib/supabase";
import { getAdminSettings } from "@/lib/admin-settings";
import { isSubscriptionActive, isTrialActive } from "@/lib/utils";
import type { TelegramUpdate } from "@/types";

export const runtime = "edge";

function isLikelyTransactionText(t: string): boolean {
  const text = t.trim();
  if (text.length < 4) return false;

  const hasDigits = /[0-9໐-໙]/.test(text);
  if (!hasDigits) return false;

  // Require either kip/currency token or typical keywords.
  const hasKip = /ກີບ|LAK/i.test(text);
  const hasTxnKeywords = /ຈ່າຍ|ຊື້|ຮັບ|ໄດ້|ລາຍຈ່າຍ|ລາຍຮັບ|ເງິນເດືອນ|ຄ່າ/i.test(text);

  return hasKip || hasTxnKeywords;
}

export async function POST(request: NextRequest) {
  // Validate webhook secret
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (!validateWebhookSecret(secretHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const update = await request.json() as TelegramUpdate;

    // Handle only regular messages
    const message = update.message;
    if (!message?.from) {
      return NextResponse.json({ ok: true });
    }

    const userId = message.from.id;
    const chatId = message.chat.id;
    const text = message.text?.trim();
    const firstName = message.from.first_name;

    const supabase = createAdminClient();

    // ======================================
    // Handle /start command
    // ======================================
    if (text === "/start") {
      // Upsert user record
      await supabase.from("users").upsert(
        {
          id: userId,
          first_name: message.from.first_name,
          last_name: message.from.last_name ?? null,
          username: message.from.username ?? null,
          language_code: message.from.language_code ?? "lo",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      const { welcomeMessage } = await getAdminSettings();
      await sendTelegramMessage(chatId, buildWelcomeMessage(firstName, welcomeMessage), {
        parse_mode: "HTML",
      });
      return NextResponse.json({ ok: true });
    }

    // ======================================
    // Handle /renew command
    // ======================================
    if (text === "/renew" || text === "/subscribe") {
      const { createPhajaySubscriptionQr, getSubscriptionAmountLakForPlan } = await import(
        "@/lib/phajay"
      );
      const { SUBSCRIPTION_PLANS, getDurationDaysForPlan } = await import("@/lib/subscription-plans");
      const planId = "1m" as const;
      const amount = getSubscriptionAmountLakForPlan(planId);
      const { link, transactionId } = await createPhajaySubscriptionQr({
        userId: String(userId),
        planId,
      });

      const planMeta = SUBSCRIPTION_PLANS[planId];
      const nowIso = new Date().toISOString();
      const { upsertPendingPhajayPayment } = await import("@/lib/subscription-pending");
      await upsertPendingPhajayPayment(supabase, {
        userId,
        amountLak: amount,
        paymentRef: transactionId,
        nowIso,
        paymentDetails: {
          plan: planId,
          duration_days: getDurationDaysForPlan(planId),
          months_charged: planMeta.monthsCharged,
          months_covered: planMeta.monthsCovered,
        },
      });

      if (link) {
        await sendTelegramMessage(
          chatId,
          `💳 ກົດເພື່ອສະແກນ/ຊຳລະ subscription (1 ເດືອນ):\n\n${link}\n\n⏰ ລິ້ງນີ້ໃຊ້ໄດ້ຈົນກວ່າລະບົບຈະປິດ`,
          { disable_notification: false }
        );
      } else {
        await sendTelegramMessage(chatId, "❌ ສ້າງ QR ແລະລິ້ງຊຳລະບໍ່ໄດ້ ກະລຸນາລອງໃໝ່ 🙏");
      }
      return NextResponse.json({ ok: true });
    }

    // ======================================
    // Handle /balance command
    // ======================================
    if (text === "/balance" || text === "/summary") {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: txData } = await supabase
        .from("transactions")
        .select("type, amount")
        .eq("user_id", userId)
        .gte("transaction_date", firstOfMonth.split("T")[0]);

      const income = (txData ?? [])
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + t.amount, 0);
      const expense = (txData ?? [])
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + t.amount, 0);

      const balanceMsg = buildSuccessReply("income", 0, "ສະຫຼຸບເດືອນນີ້", { income, expense });
      await sendTelegramMessage(chatId, balanceMsg.replace(/✅.+\n\n📝.+\n💬.+\n\n/, ""));
      return NextResponse.json({ ok: true });
    }

    // ======================================
    // Check if user exists and subscription is active
    // ======================================
    const { data: userData } = await supabase
      .from("users")
      .select("id, created_at")
      .eq("id", userId)
      .maybeSingle();

    const userCreatedAt = userData?.created_at ?? new Date().toISOString();

    if (!userData) {
      // Auto-register user for trial period
      await supabase.from("users").upsert({
        id: userId,
        first_name: firstName,
        last_name: message.from.last_name ?? null,
        username: message.from.username ?? null,
        language_code: message.from.language_code ?? "lo",
        updated_at: new Date().toISOString(),
      });
    }

    // Check subscription
    const { data: subData } = await supabase
      .from("subscriptions")
      .select("status, expiry_date")
      .eq("user_id", userId)
      .maybeSingle();

    const subActive = subData ? isSubscriptionActive(subData.expiry_date) : false;
    const trialActive = isTrialActive(userCreatedAt);

    if (!subActive && !trialActive) {
      await sendTelegramMessage(chatId, buildErrorReply("expired"));
      return NextResponse.json({ ok: true });
    }

    // ======================================
    // Process text message via Gemini
    // ======================================
    if (!text) {
      // Voice message — future support
      if (message.voice) {
        await sendTelegramMessage(
          chatId,
          "🎤 ຂໍໂທດ ຍັງບໍ່ຮອງຮັບ voice ໃນຂະນະນີ້\nກະລຸນາສົ່ງເປັນຂໍ້ຄວາມ 🙏"
        );
      }
      return NextResponse.json({ ok: true });
    }

    // Parse with Gemini
    if (!isLikelyTransactionText(text)) {
      // ลดการเรียก Gemini ໂດຍບໍ່ໄດ້ເຂົ້າໃຈວ່າເປັນລາຍຮັບ/ລາຍຈ່າຍ
      await sendTelegramMessage(chatId, buildErrorReply("parse_failed"));
      return NextResponse.json({ ok: true });
    }

    const parseResult = await parseTransaction(text);

    if (!parseResult.success || !parseResult.transaction) {
      await sendTelegramMessage(chatId, buildErrorReply("parse_failed"));
      return NextResponse.json({ ok: true });
    }

    const { transaction } = parseResult;

    // Match category
    const { data: categoriesData } = await supabase
      .from("categories")
      .select("id, name, name_lao, type");

    const categoryId = matchCategoryByHint(
      transaction.category_hint,
      (categoriesData ?? []).filter(
        (c) => c.type === transaction.type || c.type === "both"
      )
    );

    // Save transaction
    const { error: insertError } = await supabase.from("transactions").insert({
      user_id: userId,
      type: transaction.type,
      amount: transaction.amount,
      category_id: categoryId ?? null,
      description: transaction.description,
      raw_text: text,
      ai_parsed: true,
      transaction_date: new Date().toISOString().split("T")[0],
    });

    if (insertError) {
      console.error("Transaction insert error:", insertError);
      await sendTelegramMessage(chatId, "❌ ບັນທຶກຂໍ້ມູນຜິດພາດ ກະລຸນາລອງໃໝ່");
      return NextResponse.json({ ok: true });
    }

    // Get current month summary for reply
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const { data: summaryData } = await supabase
      .from("transactions")
      .select("type, amount")
      .eq("user_id", userId)
      .gte("transaction_date", firstOfMonth.toISOString().split("T")[0]);

    const totalIncome = (summaryData ?? [])
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const totalExpense = (summaryData ?? [])
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);

    const replyText = buildSuccessReply(
      transaction.type,
      transaction.amount,
      transaction.description,
      { income: totalIncome, expense: totalExpense }
    );

    await sendTelegramMessage(chatId, replyText);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

// Telegram uses GET to verify webhook URL
export async function GET() {
  return NextResponse.json({ ok: true, webhook: "pah-khaang-baan" });
}
