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

/** QR ໃຊ້ໄດ້ປະມານ 10 ນາທີ — ສະແດງ countdown ໃຫ້ຜູ້ໃຊ້ສະແກນທັນ */
const QR_VALID_SECONDS = 600;

type SubscriptionButtonProps = {
  userId?: number;
  isActive: boolean;
  days: number;
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
  plans?: SubscriptionPlanOption[];
  /** initData ສຳລັບຫົວຂໍ້ຫຼັກກວດສະຖານະ — ຖ້າບໍ່ສົ່ງຈະໃຊ້ Telegram.WebApp.initData */
  telegramInitData?: string;
  /** ຫຼັງກວດສະຖານະສຳເລັດ — ໂຫຼດ profile ໃໝ່ */
  onSubscriptionUpdated?: () => void | Promise<void>;
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

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SubscriptionButton({
  userId,
  isActive,
  days,
  loading,
  onLoadingChange,
  plans = [],
  telegramInitData = "",
  onSubscriptionUpdated,
}: SubscriptionButtonProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanOption["id"]>("1m");
  const [qrOpen, setQrOpen] = useState(false);
  const [payResult, setPayResult] = useState<CreateSubscriptionResponse | null>(null);
  /** ຂະນະຮ້ອງສ້າງ QR — ຄວບຄູ່ກັບ loading ຈາກ parent */
  const [generating, setGenerating] = useState(false);
  /** ກັ້ນກົດຊ້ຳກ່ອນ React state ອັບເດດ (spam double-click) */
  const subscribeInFlightRef = useRef(false);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(QR_VALID_SECONDS);
  const [checkingStatus, setCheckingStatus] = useState(false);

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

  /** Countdown 10 ນາທີ ຫຼັງເປີດ QR */
  useEffect(() => {
    if (!qrOpen || !payResult) return;
    setQrSecondsLeft(QR_VALID_SECONDS);
    const id = window.setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [qrOpen, payResult]);

  const getInitData = () => {
    if (telegramInitData.trim()) return telegramInitData;
    if (typeof window !== "undefined" && window.Telegram?.WebApp?.initData) {
      return window.Telegram.WebApp.initData;
    }
    return "";
  };

  const handleCheckStatus = async () => {
    const initData = getInitData();
    if (!initData) {
      toast.error("ບໍ່ພົບ Telegram init data");
      return;
    }
    setCheckingStatus(true);
    try {
      const res = await fetch("/api/mini-app/subscription-status", {
        headers: { "x-telegram-init-data": initData },
      });
      const data = (await res.json()) as {
        ok?: boolean;
        subscription?: { status?: string; expiry_date?: string | null } | null;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "ກວດສອບບໍ່ສຳເລັດ");
        return;
      }
      const st = data.subscription?.status ?? "";
      if (st === "active") {
        toast.success("ສະມາຊິກກຳລັງໃຊ້ງານ — ສຳເລັດ!");
        await onSubscriptionUpdated?.();
        setQrOpen(false);
      } else {
        toast.message(`ສະຖານະປັດຈຸບັນ: ${st || "ລໍຖ້າ"} — ຖ້າຊຳລະແລ້ວລໍຖ້າສັນຍານວິນາທີ`);
        await onSubscriptionUpdated?.();
      }
    } catch (e) {
      console.error("[SubscriptionButton] check status", e);
      toast.error("ເຊື່ອມຕໍ່ບໍ່ສຳເລັດ");
    } finally {
      setCheckingStatus(false);
    }
  };

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

          {payResult && (
            <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-center">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                QR ใช้ได้ 10 นาที กรุณาสแกนด่วน
              </p>
              <p className="text-lg font-bold number-font text-amber-800 dark:text-amber-200 mt-1">
                {formatCountdown(qrSecondsLeft)}
              </p>
            </div>
          )}

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
            <Button
              type="button"
              variant="secondary"
              className="w-full gap-2"
              loading={checkingStatus}
              disabled={checkingStatus}
              onClick={() => void handleCheckStatus()}
            >
              <RefreshCw className="h-4 w-4" />
              ກວດສອບສະຖານະ
            </Button>
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
