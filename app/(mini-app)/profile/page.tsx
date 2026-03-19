"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Crown,
  Download,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  formatDateTime,
  formatLAK,
  isSubscriptionActive,
  daysUntilExpiry,
} from "@/lib/utils";
import type { Subscription } from "@/types";

interface ProfileData {
  user: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  subscription: Subscription | null;
  stats: {
    total_transactions: number;
    total_income: number;
    total_expense: number;
    member_since: string;
  };
}

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [renewLoading, setRenewLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const initDataRaw =
    typeof window !== "undefined" ? window.Telegram?.WebApp?.initData ?? "" : "";

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/mini-app/profile", {
          headers: { "x-telegram-init-data": initDataRaw },
        });
        if (res.ok) {
          const d = await res.json() as ProfileData;
          setData(d);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchProfile();
  }, [initDataRaw]);

  const handleRenew = async () => {
    setRenewLoading(true);
    try {
      const res = await fetch("/api/mini-app/renew-subscription", {
        method: "POST",
        headers: { "x-telegram-init-data": initDataRaw },
      });
      const result = await res.json() as { payment_url?: string; error?: string };

      if (result.payment_url) {
        // Open Phajay payment URL in Telegram
        if (window.Telegram?.WebApp?.openLink) {
          window.Telegram.WebApp.openLink(result.payment_url);
        } else {
          window.open(result.payment_url, "_blank");
        }
      } else {
        toast.error(result.error ?? "ສ້າງ link ຊຳລະເງິນບໍ່ໄດ້");
      }
    } catch {
      toast.error("ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່");
    } finally {
      setRenewLoading(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch("/api/mini-app/export-csv", {
        headers: { "x-telegram-init-data": initDataRaw },
      });
      if (!res.ok) {
        toast.error("Export ບໍ່ສຳເລັດ");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pah-khaang-baan-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV ສຳເລັດ");
    } catch {
      toast.error("Export ບໍ່ສຳເລັດ");
    } finally {
      setExportLoading(false);
    }
  };

  const tgUser = typeof window !== "undefined"
    ? window.Telegram?.WebApp?.initDataUnsafe?.user
    : null;

  const isActive = data?.subscription ? isSubscriptionActive(data.subscription.expiry_date) : false;
  const days = data?.subscription ? daysUntilExpiry(data.subscription.expiry_date) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-lg font-bold">ໂປຣໄຟລ໌</h1>
      </div>

      {loading ? (
        <div className="px-4 space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : (
        <div className="px-4 space-y-4">
          {/* User Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-card border p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary text-2xl text-white">
                {(tgUser?.first_name?.[0] ?? "U").toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-base">
                  {tgUser?.first_name ?? data?.user?.first_name ?? "ຜູ້ໃຊ້"}
                  {(tgUser?.last_name ?? data?.user?.last_name) && (
                    <span> {tgUser?.last_name ?? data?.user?.last_name}</span>
                  )}
                </p>
                {(tgUser?.username ?? data?.user?.username) && (
                  <p className="text-sm text-muted-foreground">
                    @{tgUser?.username ?? data?.user?.username}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Telegram ID: {tgUser?.id ?? data?.user?.id}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Subscription Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={`rounded-2xl border p-4 ${
              isActive
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <Crown className={`h-5 w-5 ${isActive ? "text-emerald-500" : "text-red-500"}`} />
              <p className="font-semibold text-sm">ການສະມາຊິກ</p>
              <Badge variant={isActive ? "active" : "expired"} className="ml-auto">
                {isActive ? "Active" : "Expired"}
              </Badge>
            </div>

            {isActive ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>ໃຊ້ງານໄດ້ຈົນ: <strong>{formatDateTime(data?.subscription?.expiry_date ?? "")}</strong></span>
                </div>
                {days <= 7 && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>ໝົດອາຍຸໃນ <strong>{days} ວັນ</strong> — ຕໍ່ໄດ້ເລີຍ!</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>ຄ່າສະມາຊິກ: {formatLAK(30000)}/ເດືອນ</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    {data?.subscription?.expiry_date
                      ? `ໝົດອາຍຸ: ${formatDateTime(data.subscription.expiry_date)}`
                      : "ຍັງບໍ່ໄດ້ສະໝັກ"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  ສະໝັກ {formatLAK(30000)}/ເດືອນ ເພື່ອໃຊ້ງານຕໍ່
                </p>
              </div>
            )}

            <Button
              onClick={handleRenew}
              loading={renewLoading}
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
                  {isActive ? "ຕໍ່ອາຍຸ" : "ສະໝັກ 30,000 ກີບ"}
                </>
              )}
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-card border p-4"
          >
            <p className="font-semibold text-sm mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              ສະຖິຕິການໃຊ້ງານ
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-xl font-bold number-font">{data?.stats?.total_transactions ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">ທຸລະກຳທັງໝົດ</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-base font-bold text-emerald-500 number-font">
                  {formatLAK(data?.stats?.total_income ?? 0, true)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">ລາຍຮັບລວມ</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-base font-bold text-red-500 number-font">
                  {formatLAK(data?.stats?.total_expense ?? 0, true)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">ລາຍຈ່າຍລວມ</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-xs font-medium">
                  {data?.stats?.member_since
                    ? new Date(data.stats.member_since).toLocaleDateString("lo-LA", {
                        year: "numeric",
                        month: "short",
                      })
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">ສະໝັກຕັ້ງແຕ່</p>
              </div>
            </div>
          </motion.div>

          {/* Export */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Separator className="mb-4" />
            <Button
              variant="outline"
              onClick={handleExport}
              loading={exportLoading}
              className="w-full gap-2 h-11"
              disabled={!isActive}
            >
              <Download className="h-4 w-4" />
              Export CSV ທຸລະກຳທັງໝົດ
            </Button>
            {!isActive && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                ຕ້ອງ Active ສະມາຊິກກ່ອນ Export
              </p>
            )}
          </motion.div>

          <div className="text-center pb-4">
            <p className="text-xs text-muted-foreground">ປ້າຂ້າງບ້ານ v1.0 · ສ້າງດ້ວຍ ❤️</p>
          </div>
        </div>
      )}
    </div>
  );
}
