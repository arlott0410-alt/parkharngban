import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createPhajaySubscriptionQr, getSubscriptionAmountLak } from "@/lib/phajay";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { user_id?: string };
    const userId = (body.user_id ?? "").trim();

    if (!userId) {
      return NextResponse.json({ error: "ບໍ່ພົບ user id" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const numericUserId = Number.parseInt(userId, 10);

    if (Number.isNaN(numericUserId)) {
      return NextResponse.json({ error: "user id ບໍ່ຖືກຕ້ອງ" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    const { data: activeSubscription, error: activeCheckError } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", numericUserId)
      .eq("status", "active")
      .gt("expiry_date", nowIso)
      .maybeSingle();

    if (activeCheckError) {
      console.error("create-subscription active check error:", activeCheckError);
      return NextResponse.json({ error: "ລະບົບກວດສອບ subscription ຂັດຂ້ອງ" }, { status: 500 });
    }

    if (activeSubscription) {
      return NextResponse.json({ error: "ມີ subscription ແອກທິບຢູ່ແລ້ວ" }, { status: 409 });
    }

    const amount = getSubscriptionAmountLak();
    const { qrCode, link, transactionId } = await createPhajaySubscriptionQr({
      userId,
      amountLak: amount,
    });

    const { error: insertError } = await supabase.from("subscriptions").insert({
      user_id: numericUserId,
      amount_lak: amount,
      payment_ref: transactionId,
      status: "inactive",
      created_at: nowIso,
    });

    if (insertError) {
      console.error("create-subscription insert error:", insertError);
      return NextResponse.json({ error: "ບໍ່ສາມາດບັນທຶກການຊຳລະໄດ້" }, { status: 500 });
    }

    return NextResponse.json({
      qrCode,
      link,
      transactionId,
    });
  } catch (error) {
    console.error("create-subscription error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ບໍ່ສາມາດເຊື່ອມຕໍ່ Phajay ໄດ້ ກະລຸນາລອງໃໝ່",
      },
      { status: 500 }
    );
  }
}
