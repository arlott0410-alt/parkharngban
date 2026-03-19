"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type SubscriptionButtonProps = {
  userId?: number;
  isActive: boolean;
  days: number;
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
};

export function SubscriptionButton({
  userId,
  isActive,
  days,
  loading,
  onLoadingChange,
}: SubscriptionButtonProps) {
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
        body: JSON.stringify({ user_id: String(userId) }),
      });

      const result = (await res.json()) as { payment_url?: string; error?: string };
      if (!res.ok || !result.payment_url) {
        toast.error(result.error ?? "ບໍ່ສາມາດສ້າງລິ້ງຊຳລະເງິນໄດ້");
        return;
      }

      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(result.payment_url);
      } else {
        window.open(result.payment_url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error("SubscriptionButton error:", error);
      toast.error("ບໍ່ສາມາດເຊື່ອມຕໍ່ Phajay ໄດ້ ກະລຸນາລອງໃໝ່");
    } finally {
      onLoadingChange(false);
    }
  };

  return (
    <Button
      onClick={handleSubscribe}
      loading={loading}
      className={`w-full mt-3 gap-2 ${isActive && days > 7 ? "h-9 text-sm" : "h-11"}`}
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
          {isActive ? "ຕໍ່ອາຍຸ" : "ສະມັກ 30,000 ກີບ / ເດືອນ"}
        </>
      )}
    </Button>
  );
}
