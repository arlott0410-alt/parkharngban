import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { isAdminRequest } from "@/lib/admin-auth";

export const runtime = "edge";

/** ຄິດວັນໝົດອາຍຸ: ຖ້າຍັງ active ຢູ່ — ຕໍ່ຈາກວັນໝົດເກົ່າ; ຖ້າບໍ່ — ນັບຈາກມື້ນີ້ */
function computeGrantExpiry(currentExpiryIso: string | null | undefined, durationDays: number): Date {
  const now = new Date();
  const current = currentExpiryIso ? new Date(currentExpiryIso) : null;
  const base =
    current && !Number.isNaN(current.getTime()) && current > now ? current : now;
  const out = new Date(base);
  out.setDate(out.getDate() + durationDays);
  return out;
}

/**
 * POST — ຈັດການສະມາຊິກຈາກ Admin
 * - action=grant: ເພີ່ມ/ຕໍ່ອາຍຸ (duration_days, default 30)
 * - action=revoke: ຍົກເລີກ (ຕັ້ງໝົດອາຍຸໃນອະດີດ)
 */
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action?: string; user_id?: number; duration_days?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  const userId = typeof body.user_id === "number" ? body.user_id : Number(body.user_id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "user_id ບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  const durationDays = Math.min(
    3650,
    Math.max(1, parseInt(String(body.duration_days ?? "30"), 10) || 30)
  );

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  const amountLak = parseInt(process.env.SUBSCRIPTION_PRICE_LAK ?? "50000", 10);

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (userErr || !userRow) {
    return NextResponse.json({ error: "ບໍ່ພົບຜູ້ໃຊ້" }, { status: 404 });
  }

  if (action === "revoke") {
    const { data: existing, error: selErr } = await supabase
      .from("subscriptions")
      .select("id, payment_details")
      .eq("user_id", userId)
      .maybeSingle();

    if (selErr) {
      console.error("admin revoke select:", selErr);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "ຜູ້ໃຊ້ນີ້ບໍ່ມີແຖວ subscription" }, { status: 404 });
    }

    const past = new Date(Date.now() - 86400000).toISOString();
    const prevDetails =
      typeof existing.payment_details === "object" && existing.payment_details !== null
        ? (existing.payment_details as Record<string, unknown>)
        : {};

    const { error: upErr } = await supabase
      .from("subscriptions")
      .update({
        status: "expired",
        expiry_date: past,
        updated_at: nowIso,
        payment_details: { ...prevDetails, admin_revoked: true, revoked_at: nowIso },
      })
      .eq("user_id", userId);

    if (upErr) {
      console.error("admin revoke update:", upErr);
      return NextResponse.json({ error: "ອັບເດດບໍ່ສຳເລັດ" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "revoked" });
  }

  if (action === "grant") {
    const { data: existing, error: selErr } = await supabase
      .from("subscriptions")
      .select("id, started_at, expiry_date")
      .eq("user_id", userId)
      .maybeSingle();

    if (selErr) {
      console.error("admin grant select:", selErr);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    const expiry = computeGrantExpiry(existing?.expiry_date ?? null, durationDays);
    const expiryIso = expiry.toISOString();
    const ref = `admin_grant_${Date.now()}`;
    const details = {
      admin_grant: true,
      duration_days: durationDays,
      granted_at: nowIso,
    };

    if (existing?.id) {
      const { error: upErr } = await supabase
        .from("subscriptions")
        .update({
          status: "active",
          started_at: existing.started_at ?? nowIso,
          expiry_date: expiryIso,
          amount_lak: amountLak,
          payment_ref: ref,
          payment_details: details,
          updated_at: nowIso,
        })
        .eq("user_id", userId);

      if (upErr) {
        console.error("admin grant update:", upErr);
        return NextResponse.json({ error: "ອັບເດດບໍ່ສຳເລັດ" }, { status: 500 });
      }
    } else {
      const { error: insErr } = await supabase.from("subscriptions").insert({
        user_id: userId,
        status: "active",
        started_at: nowIso,
        expiry_date: expiryIso,
        amount_lak: amountLak,
        payment_ref: ref,
        payment_details: details,
        created_at: nowIso,
        updated_at: nowIso,
      });

      if (insErr) {
        console.error("admin grant insert:", insErr);
        return NextResponse.json({ error: "ສ້າງບໍ່ສຳເລັດ" }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      message: "granted",
      expiry_date: expiryIso,
      duration_days: durationDays,
    });
  }

  return NextResponse.json({ error: "action ບໍ່ຮອງຮັບ (grant | revoke)" }, { status: 400 });
}
