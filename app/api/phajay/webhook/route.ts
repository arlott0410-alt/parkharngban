import { NextRequest, NextResponse } from "next/server";
import { verifyPhajayWebhook, calculateNewExpiry } from "@/lib/phajay";
import { createAdminClient } from "@/lib/supabase";
import type { PhajayWebhookPayload } from "@/types";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as PhajayWebhookPayload;

    // Verify webhook signature
    if (!(await verifyPhajayWebhook(payload))) {
      console.warn("Phajay webhook: invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Only process successful payments
    if (payload.status !== "success") {
      return NextResponse.json({ received: true, action: "ignored" });
    }

    // Parse user ID from order_id format: PKB-{userId}-{timestamp}-{random}
    const orderParts = payload.order_id.split("-");
    if (orderParts.length < 2 || orderParts[0] !== "PKB") {
      console.error("Phajay webhook: invalid order_id format", payload.order_id);
      return NextResponse.json({ error: "Invalid order_id" }, { status: 400 });
    }

    const userId = parseInt(orderParts[1], 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID in order" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get current subscription
    const { data: currentSub } = await supabase
      .from("subscriptions")
      .select("expiry_date")
      .eq("user_id", userId)
      .single();

    const newExpiry = calculateNewExpiry(currentSub?.expiry_date);

    // Upsert subscription (create or update)
    const { error: upsertError } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          status: "active",
          started_at: new Date().toISOString(),
          expiry_date: newExpiry.toISOString(),
          payment_ref: payload.transaction_id,
          amount_lak: payload.amount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Phajay webhook: subscription upsert error", upsertError);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    console.log(
      `✅ Subscription activated for user ${userId} until ${newExpiry.toISOString()}`
    );

    // Optional: Send confirmation message via Telegram
    try {
      const { sendTelegramMessage } = await import("@/lib/telegram");
      await sendTelegramMessage(
        userId,
        `✅ ຊຳລະເງິນສຳເລັດ!\n\n👑 ການສະມາຊິກ Active ແລ້ວ\n📅 ໃຊ້ງານໄດ້ຈົນ: ${newExpiry.toLocaleDateString("lo-LA", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}\n\nຂອບໃຈທີ່ໄວ້ວາງໃຈ ປ້າຂ້າງບ້ານ 🌺`
      );
    } catch (msgError) {
      console.warn("Phajay webhook: failed to send TG message", msgError);
    }

    return NextResponse.json({ success: true, user_id: userId });
  } catch (error) {
    console.error("Phajay webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
