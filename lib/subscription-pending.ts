import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ບັນທຶກ / ອັບເດດແຖວລໍຖ້າຊຳລະ Phajay (inactive + payment_ref).
 *
 * ຖ້າຕາຕະລາງມີ UNIQUE(user_id) ການ `insert` ຄັ້ງທີສອງຈະລົ້ມ — ໃຊ້ອັບເດດແຖວເດີມແທນ.
 */
export async function upsertPendingPhajayPayment(
  supabase: SupabaseClient,
  params: {
    userId: number;
    amountLak: number;
    paymentRef: string;
    paymentDetails: Record<string, unknown>;
    nowIso: string;
  }
): Promise<{ error: { message: string; code?: string; details?: string } | null }> {
  /** ຫຼາຍແຖວຕໍ່ user_id ເຮັດໃຫ້ maybeSingle() ລົ້ມ — ເອົາແຖວຫຼ້າສຸດເທົ່ານັ້ນ */
  const { data: existing, error: selectError } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    return { error: selectError };
  }

  const row = {
    amount_lak: params.amountLak,
    payment_ref: params.paymentRef,
    status: "inactive" as const,
    payment_details: params.paymentDetails,
    updated_at: params.nowIso,
  };

  if (existing?.id) {
    const { error } = await supabase.from("subscriptions").update(row).eq("id", existing.id);
    return { error: error ?? null };
  }

  const { error } = await supabase.from("subscriptions").insert({
    user_id: params.userId,
    created_at: params.nowIso,
    ...row,
  });
  return { error: error ?? null };
}
