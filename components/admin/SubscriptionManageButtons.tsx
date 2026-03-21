"use client";

import { useState } from "react";
import { Gift, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { isSubscriptionActive } from "@/lib/utils";

type Props = {
  userId: number;
  /** ມີແຖວ subscriptions ຫຼືບໍ່ — ຖ້າບໍ່ມີ ບໍ່ສະແດງປຸ່ມຍົກເລີກ */
  hasSubscriptionRow: boolean;
  expiryDate?: string | null;
};

export function SubscriptionManageButtons({
  userId,
  hasSubscriptionRow,
  expiryDate,
}: Props) {
  const [grantOpen, setGrantOpen] = useState(false);
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(false);

  const active = isSubscriptionActive(expiryDate ?? null);

  const postManage = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/admin/subscriptions/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    const ok = res.ok;
    return { ok, data, status: res.status };
  };

  const handleGrant = async () => {
    const d = Math.min(3650, Math.max(1, parseInt(days, 10) || 30));
    setLoading(true);
    try {
      const { ok, data } = await postManage({
        action: "grant",
        user_id: userId,
        duration_days: d,
      });
      if (!ok) {
        toast.error(data.error ?? "ບໍ່ສຳເລັດ");
        return;
      }
      toast.success(
        active
          ? `ຕໍ່ອາຍຸ +${d} ວັນ (ນັບຈາກວັນໝົດເກົ່າ)`
          : `ເພີ່ມສະມາຊິກ ${d} ວັນ`
      );
      setGrantOpen(false);
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!hasSubscriptionRow) return;
    if (!window.confirm("ຍົກເລີກສະມາຊິກຜູ້ໃຊ້ນີ້? ບໍ່ສາມາດໃຊ້ຟີເຈີທີ່ຕ້ອງສະມາຊິກ (ນອກ trial).")) return;
    setLoading(true);
    try {
      const { ok, data } = await postManage({ action: "revoke", user_id: userId });
      if (!ok) {
        toast.error(data.error ?? "ບໍ່ສຳເລັດ");
        return;
      }
      toast.success("ຍົກເລີກສະມາຊິກແລ້ວ");
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        size="sm"
        variant="default"
        className="gap-1.5"
        disabled={loading}
        onClick={() => setGrantOpen(true)}
      >
        <Gift className="h-3.5 w-3.5" />
        {active ? "ຕໍ່ອາຍຸ" : "ເພີ່ມສະມາຊິກ"}
      </Button>

      {hasSubscriptionRow ? (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="gap-1.5"
          disabled={loading}
          onClick={() => void handleRevoke()}
        >
          <Ban className="h-3.5 w-3.5" />
          ຍົກເລີກ
        </Button>
      ) : null}

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {active ? "ຕໍ່ອາຍຸສະມາຊິກ" : "ເພີ່ມສະມາຊິກ (Admin)"}
            </DialogTitle>
            <DialogDescription>
              {active
                ? "ຈຳນວນວັນຈະຖືກຕໍ່ໄປຈາກວັນໝົດອາຍຸປັດຈຸບັນ (ຖ້າຍັງບໍ່ໝົດ ຈະຕໍ່ຈາກວັນໝົດເກົ່າ)."
                : "ສ້າງຫຼືເປີດສະມາຊິກໃຫ້ຜູ້ໃຊ້ — ນັບຈາກມື້ນີ້."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="admin-sub-days">ຈຳນວນວັນ</Label>
            <Input
              id="admin-sub-days"
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setGrantOpen(false)}>
              ຍົກເລີກ
            </Button>
            <Button type="button" loading={loading} onClick={() => void handleGrant()}>
              ຢືນຢັນ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
