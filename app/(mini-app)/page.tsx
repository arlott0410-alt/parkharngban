"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDate, formatLAK, getGreeting } from "@/lib/utils";
import { BalanceCard } from "@/components/mini-app/BalanceCard";
import { FloatingActionButton } from "@/components/mini-app/FloatingActionButton";
import { TransactionForm } from "@/components/mini-app/TransactionForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { BalanceSummary, Transaction, Category } from "@/types";

export default function HomePage() {
  const [summary, setSummary] = useState<BalanceSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"income" | "expense">("expense");
  /** ກົດຈາກລາຍການເພື່ອແກ້ໄຂ/ລຶບ */
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [userName, setUserName] = useState<string>("");

  const initDataRaw =
    typeof window !== "undefined" ? window.Telegram?.WebApp?.initData ?? "" : "";

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, txRes, catRes] = await Promise.all([
        fetch("/api/mini-app/summary", {
          headers: { "x-telegram-init-data": initDataRaw },
        }),
        fetch("/api/mini-app/transactions?limit=10", {
          headers: { "x-telegram-init-data": initDataRaw },
        }),
        fetch("/api/mini-app/categories"),
      ]);

      if (summaryRes.ok) {
        const data = await summaryRes.json() as { summary: BalanceSummary };
        setSummary(data.summary);
      }
      if (txRes.ok) {
        const data = await txRes.json() as { transactions: Transaction[] };
        setTransactions(data.transactions ?? []);
      }
      if (catRes.ok) {
        const data = await catRes.json() as { categories: Category[] };
        setCategories(data.categories ?? []);
      }
    } catch (error) {
      console.error("fetchData error:", error);
    } finally {
      setLoading(false);
    }
  }, [initDataRaw]);

  useEffect(() => {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser) {
      setUserName(tgUser.first_name);
    }
    void fetchData();
  }, [fetchData]);

  const handleSaveTransaction = async (data: {
    type: "income" | "expense";
    amount: number;
    category_id: string;
    description: string;
    transaction_date: string;
  }) => {
    if (editingTransaction) {
      const res = await fetch(`/api/mini-app/transactions/${editingTransaction.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": initDataRaw,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("ອັບເດດສຳເລັດ! ✅");
        setDialogOpen(false);
        setEditingTransaction(null);
        void fetchData();
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "ອັບເດດບໍ່ສຳເລັດ");
      }
      return;
    }

    const res = await fetch("/api/mini-app/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-init-data": initDataRaw,
      },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      toast.success("ບັນທຶກສຳເລັດ! ✅");
      setDialogOpen(false);
      void fetchData();
    } else {
      const err = await res.json() as { error?: string };
      if (res.status === 402) {
        toast.error("ການສະມາຊິກໝົດອາຍຸ — ກະລຸນາຕໍ່ອາຍຸ");
      } else {
        toast.error(err.error ?? "ບັນທຶກບໍ່ສຳເລັດ");
      }
    }
  };

  const handleDeleteTransaction = async () => {
    if (!editingTransaction) return;
    const res = await fetch(`/api/mini-app/transactions/${editingTransaction.id}`, {
      method: "DELETE",
      headers: { "x-telegram-init-data": initDataRaw },
    });
    if (res.ok) {
      toast.success("ລຶບສຳເລັດ");
      setDialogOpen(false);
      setEditingTransaction(null);
      void fetchData();
    } else {
      toast.error("ລຶບບໍ່ສຳເລັດ");
    }
  };

  const now = new Date();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">{getGreeting()}</p>
          <span className="text-xl">🌺</span>
        </div>
        <h1 className="text-lg font-bold">
          {userName ? `${userName}!` : "ສະບາຍດີ!"}
        </h1>
      </div>

      {/* Balance Card */}
      <div className="px-4 pb-4">
        {loading || !summary ? (
          <Skeleton className="h-44 rounded-2xl" />
        ) : (
          <BalanceCard
            summary={summary}
            userName={userName || undefined}
          />
        )}
      </div>

      {/* Recent Transactions */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold">ລາຍການລ່າສຸດ</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">ແຕະລາຍການເພື່ອແກ້ໄຂ ຫຼື ລຶບ</p>
          </div>
          <span className="text-xs text-muted-foreground">
            {now.toLocaleDateString("lo-LA", { month: "short", year: "numeric" })}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-border p-8 text-center"
          >
            <p className="text-2xl mb-2">📝</p>
            <p className="text-sm font-medium mb-1">ຍັງບໍ່ມີລາຍການ</p>
            <p className="text-xs text-muted-foreground">
              ກົດ + ເພື່ອເພີ່ມລາຍການໃໝ່
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {transactions.map((tx, index) => (
                <motion.button
                  type="button"
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="flex w-full items-center justify-between rounded-xl bg-card border border-border p-3.5 text-left active:scale-[0.99] transition-transform"
                  onClick={() => {
                    setEditingTransaction(tx);
                    setDialogType(tx.type);
                    setDialogOpen(true);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-lg shrink-0"
                      style={{
                        backgroundColor: tx.category?.color
                          ? `${tx.category.color}20`
                          : tx.type === "income"
                            ? "#10B98120"
                            : "#EF444420",
                      }}
                    >
                      {tx.category?.icon ?? (tx.type === "income" ? "💰" : "💸")}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {tx.description ?? tx.category?.name_lao ?? tx.category?.name ?? "ທຸລະກຳ"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.transaction_date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p
                      className={`text-sm font-bold number-font ${
                        tx.type === "income" ? "text-emerald-500" : "text-red-500"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "−"}
                      {formatLAK(tx.amount)}
                    </p>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton
        onAddIncome={() => {
          setEditingTransaction(null);
          setDialogType("income");
          setDialogOpen(true);
        }}
        onAddExpense={() => {
          setEditingTransaction(null);
          setDialogType("expense");
          setDialogOpen(true);
        }}
      />

      {/* Add Transaction Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingTransaction(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingTransaction
                ? "ແກ້ໄຂທຸລະກຳ"
                : dialogType === "income"
                  ? "➕ ເພີ່ມລາຍຮັບ"
                  : "➖ ເພີ່ມລາຍຈ່າຍ"}
            </DialogTitle>
          </DialogHeader>
          <TransactionForm
            key={editingTransaction?.id ?? `new-${dialogType}`}
            initialType={dialogType}
            initialTransaction={editingTransaction}
            categories={categories}
            onSubmit={handleSaveTransaction}
            onDelete={editingTransaction ? handleDeleteTransaction : undefined}
            onCancel={() => {
              setDialogOpen(false);
              setEditingTransaction(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
