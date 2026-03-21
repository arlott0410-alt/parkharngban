"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function SubscriptionButton({
  userId,
  isActive,
  days,
  loading,
  onLoadingChange,
  plans = [],
}: SubscriptionButtonProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanOption["id"]>("1m");

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
    if (!userId) {
      toast.error("ບໍ່ພົບ user id");
      return;
    }

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

      const result = (await res.json()) as { link?: string; qrCode?: string; error?: string };
      if (!res.ok || !result.link) {
        toast.error(result.error ?? "ບໍ່ສາມາດສ້າງ QR/ລິ້ງຊຳລະໄດ້");
        return;
      }

      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(result.link);
      } else {
        window.open(result.link, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error("SubscriptionButton error:", error);
      toast.error("ບໍ່ສາມາດເຊື່ອມຕໍ່ Phajay ໄດ້ ກະລຸນາລອງໃໝ່");
    } finally {
      onLoadingChange(false);
    }
  };

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
        loading={loading}
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
    </div>
  );
}
