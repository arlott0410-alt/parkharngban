"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatLAK, cn } from "@/lib/utils";
import type { SubscriptionPlanOption } from "@/types";

type SubscriptionButtonProps = {
  userId?: number;
  isActive: boolean;
  days: number;
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
  plans?: SubscriptionPlanOption[];
};

/** ຄຳຕອບຈາກ POST /api/phajay/create-subscription */
type CreateSubscriptionResponse = {
  success?: boolean;
  /** URL ຮູບ QR ຈາກ Phajay (qrCode ຈາກ API — ມັກເປັນ https) */
  qrCodeUrl?: string;
  /** onepay / enpay deep link */
  deepLink?: string;
  amount?: number;
  qr_image_url?: string | null;
  qr_data?: string | null;
  qrCode?: string;
  link?: string;
  transaction_id?: string;
  transactionId?: string;
  amount_lak?: number;
  /** true ຖ້າບັນທຶກລໍຖ້າໃນ DB ລົ້ມ — QR ຍັງໃຊ້ໄດ້ */
  pendingSaveFailed?: boolean;
  /** ຄືນ QR ຈາກ DB (cooldown) — ບໍ່ເອີ້ນ Phajay ຊ້ຳ */
  qrFromCache?: boolean;
  error?: string;
};

function qrImageSrc(r: CreateSubscriptionResponse): string | null {
  if (r.qrCodeUrl?.trim()) return r.qrCodeUrl.trim();
  if (r.qr_image_url?.trim()) return r.qr_image_url.trim();
  const raw = r.qrCode ?? r.qr_data;
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("data:")) return s;
  return `data:image/png;base64,${s}`;
}

function deepLinkHref(r: CreateSubscriptionResponse): string | null {
  const u = r.deepLink?.trim() || r.link?.trim();
  return u || null;
}

function hasPaymentSurface(r: CreateSubscriptionResponse): boolean {
  return Boolean(qrImageSrc(r) || deepLinkHref(r));
}

export function SubscriptionButton({
  userId,
  isActive,
  days,
  loading,
  onLoadingChange,
  plans = [],
}: SubscriptionButtonProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanOption["id"]>("1m");
  const [qrOpen, setQrOpen] = useState(false);
  const [payResult, setPayResult] = useState<CreateSubscriptionResponse | null>(null);
  /** ຂະນະຮ້ອງສ້າງ QR — ຄວບຄູ່ກັບ loading ຈາກ parent */
  const [generating, setGenerating] = useState(false);
  /** ກັ້ນກົດຊ້ຳກ່ອນ React state ອັບເດດ (spam double-click) */
  const subscribeInFlightRef = useRef(false);

  const list = useMemo(
    () => (plans.length > 0 ? plans : null),
    [plans]
  );

  useEffect(() => {
    if (list?.length) {
      setSelectedPlanId((prev) =>
        list.some((p) => p.id === prev) ? prev : list[0].id
      );
    }
  }, [list]);

  const selected = list?.find((p) => p.id === selectedPlanId) ?? list?.[0];

  const handleSubscribe = async () => {
    if (subscribeInFlightRef.current) return;
    if (!userId) {
      toast.error("ບໍ່ພົບ user id");
      return;
    }

    subscribeInFlightRef.current = true;
    setGenerating(true);
    onLoadingChange(true);
    try {
      const res = await fetch("/api/phajay/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: String(userId),
          plan: selectedPlanId,
        }),
      });

      let result: CreateSubscriptionResponse;
      try {
        result = (await res.json()) as CreateSubscriptionResponse;
      } catch {
        toast.error("ຕອບກັບບໍ່ແມ່ນ JSON");
        return;
      }

      if (!res.ok) {
        toast.error(result.error ?? "ບໍ່ສາມາດສ້າງການຊຳລະໄດ້");
        return;
      }

      if (result.success === false) {
        toast.error(result.error ?? "ບໍ່ສຳເລັດ");
        return;
      }

      const tx = result.transaction_id ?? result.transactionId;
      if (!tx) {
        toast.error("ບໍ່ມີ transaction id ຈາກ Phajay");
        console.warn("[SubscriptionButton] missing transactionId", result);
        return;
      }

      if (!hasPaymentSurface(result)) {
        toast.error("ບໍ່ມີ QR ຫຼືລິ້ງຊຳລະຈາກ Phajay");
        console.warn("[SubscriptionButton] no QR/link", result);
        return;
      }

      if (result.pendingSaveFailed) {
        toast.warning(
          "ບັນທຶກລໍຖ້າຊຳລະຊົ່ວຄາວບໍ່ສຳເລັດ — ສາມາດສະແກນ QR ຕາມປົກກະຕິ; ຖ້າຊຳລະແລ້ວບໍ່ອັບເດດ ກະລຸນາຕິດຕໍ່ແອດມິນ"
        );
      } else if (result.qrFromCache) {
        toast.message("ໃຊ້ QR ທີ່ສ້າງກ່ອນໜ້າ (ຫຼຸດການກົດຊ້ຳ)", { duration: 3500 });
      }

      setPayResult(result);
      setQrOpen(true);
    } catch (error) {
      console.error("SubscriptionButton fetch error:", error);
      toast.error("ບໍ່ສາມາດເຊື່ອມຕໍ່ Phajay ໄດ້ ກະລຸນາລອງໃໝ່");
    } finally {
      subscribeInFlightRef.current = false;
      setGenerating(false);
      onLoadingChange(false);
    }
  };

  const imgSrc = payResult ? qrImageSrc(payResult) : null;
  const displayAmount =
    payResult?.amount ?? payResult?.amount_lak ?? selected?.amount_lak;
  const bcelLink = payResult ? deepLinkHref(payResult) : null;
  const busy = loading || generating;

  return (
    <div className="w-full mt-3 space-y-2">
      {list && list.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          <p className="text-xs text-muted-foreground font-medium">ເລືອກແຜນໂປຣໂມ</p>
          {list.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => setSelectedPlanId(p.id)}
              className={cn(
                "rounded-xl border p-3 text-left text-sm transition-colors w-full",
                selectedPlanId === p.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-muted hover:bg-muted/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{p.label}</div>
                  {p.promo && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {p.promo}
                    </div>
                  )}
                </div>
                <div className="text-sm font-bold number-font shrink-0">
                  {formatLAK(p.amount_lak)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Button
        onClick={handleSubscribe}
        loading={busy}
        disabled={busy}
        className={`w-full gap-2 ${isActive && days > 7 ? "h-9 text-sm" : "h-11"}`}
        variant={isActive && days > 7 ? "outline" : "default"}
      >
        {isActive && days > 7 ? (
          <>
            <RefreshCw className="h-4 w-4" />
            ຕໍ່ອາຍຸ (ຍັງ {days} ວັນ)
          </>
        ) : (
          <>
            <ExternalLink className="h-4 w-4" />
            {selected
              ? `ສະມັກ ${formatLAK(selected.amount_lak)}`
              : "ສະມັກສະມາຊິກ"}
          </>
        )}
      </Button>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ຊຳລະສະມາຊິກ</DialogTitle>
            <DialogDescription>
              {displayAmount != null
                ? `ຍອດ ${formatLAK(displayAmount)}`
                : "ສະແກນ QR ຫຼືເປີດໃນ BCEL"}
            </DialogDescription>
          </DialogHeader>

          {imgSrc && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-center text-muted-foreground">
                ສະແກນ QR ດ້ວຍ BCEL
              </p>
              <div className="flex justify-center rounded-xl border bg-white p-3 dark:bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc}
                  alt="BCEL QR"
                  className="h-64 w-64 max-w-full object-contain"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {bcelLink ? (
              <Button
                type="button"
                className="w-full gap-2"
                onClick={() => {
                  if (window.Telegram?.WebApp?.openLink) {
                    window.Telegram.WebApp.openLink(bcelLink);
                  } else {
                    window.open(bcelLink, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                <ExternalLink className="h-4 w-4" />
                ເປີດໃນ BCEL App
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setQrOpen(false)}
            >
              ປິດ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
