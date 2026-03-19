"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatLAK, getMonthYear } from "@/lib/utils";
import type { Budget, Category } from "@/types";

interface BudgetWithProgress extends Budget {
  spent: number;
  percentage: number;
  category: Category;
}

export default function BudgetPage() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const [budgets, setBudgets] = useState<BudgetWithProgress[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithProgress | null>(null);
  const [form, setForm] = useState({ category_id: "", amount: "" });
  const [saving, setSaving] = useState(false);

  const initDataRaw =
    typeof window !== "undefined" ? window.Telegram?.WebApp?.initData ?? "" : "";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [budgetRes, catRes] = await Promise.all([
        fetch(`/api/mini-app/budgets?month=${currentMonth}&year=${currentYear}`, {
          headers: { "x-telegram-init-data": initDataRaw },
        }),
        fetch("/api/mini-app/categories"),
      ]);

      if (budgetRes.ok) {
        const d = await budgetRes.json() as { budgets: BudgetWithProgress[] };
        setBudgets(d.budgets ?? []);
      }
      if (catRes.ok) {
        const d = await catRes.json() as { categories: Category[] };
        setCategories(d.categories.filter((c) => c.type === "expense" || c.type === "both") ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [initDataRaw, currentMonth, currentYear]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingBudget(null);
    setForm({ category_id: "", amount: "" });
    setDialogOpen(true);
  };

  const openEdit = (budget: BudgetWithProgress) => {
    setEditingBudget(budget);
    setForm({
      category_id: budget.category_id,
      amount: budget.amount.toString(),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.category_id || !form.amount) return;
    setSaving(true);
    try {
      const body = {
        category_id: form.category_id,
        amount: parseInt(form.amount.replace(/,/g, ""), 10),
        month: currentMonth,
        year: currentYear,
      };

      const res = await fetch("/api/mini-app/budgets", {
        method: editingBudget ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": initDataRaw,
        },
        body: JSON.stringify(editingBudget ? { ...body, id: editingBudget.id } : body),
      });

      if (res.ok) {
        toast.success(editingBudget ? "ອັບເດດງົບປະມານ" : "ຕັ້ງງົບປະມານໃໝ່");
        setDialogOpen(false);
        void fetchData();
      } else {
        toast.error("ບໍ່ສຳເລັດ");
      }
    } finally {
      setSaving(false);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + (b.spent ?? 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold">ງົບປະມານ</h1>
          <Button size="sm" onClick={openCreate} className="gap-1.5 h-8 px-3 text-xs">
            <Plus className="h-3.5 w-3.5" />
            ຕັ້ງງົບ
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{getMonthYear(now.getMonth() + 1, now.getFullYear())}</p>
      </div>

      {/* Total Budget Card */}
      {!loading && totalBudget > 0 && (
        <div className="mx-4 mb-4 rounded-2xl bg-card border p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground">ງົບທັງໝົດ</p>
              <p className="text-xl font-bold">{formatLAK(totalBudget, true)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">ໃຊ້ໄປ</p>
              <p className={`text-xl font-bold ${totalSpent / totalBudget >= 0.9 ? "text-red-500" : "text-foreground"}`}>
                {formatLAK(totalSpent, true)}
              </p>
            </div>
          </div>
          <Progress
            value={Math.min(100, (totalSpent / totalBudget) * 100)}
            indicatorClassName={getProgressColor((totalSpent / totalBudget) * 100)}
            className="h-3"
          />
          <p className="text-xs text-muted-foreground mt-1.5 text-right">
            ຄ່ງ {formatLAK(Math.max(0, totalBudget - totalSpent), true)}
          </p>
        </div>
      )}

      {/* Budget List */}
      <div className="px-4 space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))
        ) : budgets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed p-8 text-center"
          >
            <p className="text-3xl mb-2">🎯</p>
            <p className="text-sm font-medium mb-1">ຍັງບໍ່ມີງົບປະມານ</p>
            <p className="text-xs text-muted-foreground mb-4">
              ຕັ້ງງົບລາຍຈ່າຍແຕ່ລະໝວດໝູ່
            </p>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              ຕັ້ງງົບໄດ້ເລີຍ
            </Button>
          </motion.div>
        ) : (
          budgets.map((budget, index) => {
            const percentage = Math.min(100, Math.round((budget.spent / budget.amount) * 100));
            const isWarning = percentage >= 70 && percentage < 90;
            const isDanger = percentage >= 90;

            return (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => openEdit(budget)}
                className="cursor-pointer rounded-xl bg-card border p-4 active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-lg"
                      style={{ backgroundColor: `${budget.category?.color}20` }}
                    >
                      {budget.category?.icon}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">
                        {budget.category?.name_lao ?? budget.category?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatLAK(budget.spent ?? 0, true)} / {formatLAK(budget.amount, true)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {isDanger ? (
                      <div className="flex items-center gap-1 text-red-500">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span className="text-xs font-semibold">{percentage}%</span>
                      </div>
                    ) : (
                      <span className={`text-xs font-semibold ${isWarning ? "text-amber-500" : "text-muted-foreground"}`}>
                        {percentage}%
                      </span>
                    )}
                    <p className={`text-xs mt-0.5 ${isDanger ? "text-red-400" : "text-muted-foreground"}`}>
                      ຄ່ງ {formatLAK(Math.max(0, budget.amount - (budget.spent ?? 0)), true)}
                    </p>
                  </div>
                </div>
                <Progress
                  value={percentage}
                  indicatorClassName={getProgressColor(percentage)}
                  className="h-2"
                />
              </motion.div>
            );
          })
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingBudget ? "ແກ້ໄຂງົບປະມານ" : "ຕັ້ງງົບປະມານໃໝ່"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>ໝວດໝູ່ລາຍຈ່າຍ</Label>
              <Select
                value={form.category_id}
                onValueChange={(v) => setForm({ ...form, category_id: v })}
                disabled={!!editingBudget}
              >
                <SelectTrigger>
                  <SelectValue placeholder="ເລືອກໝວດໝູ່" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name_lao ?? cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ງົບ/ເດືອນ (ກີບ)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="100,000"
                value={form.amount}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  setForm({ ...form, amount: raw ? new Intl.NumberFormat("lo-LA").format(parseInt(raw, 10)) : "" });
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ຍົກເລີກ</Button>
            <Button onClick={handleSave} loading={saving}>ບັນທຶກ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
