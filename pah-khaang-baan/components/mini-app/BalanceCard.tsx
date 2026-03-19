"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn, formatLAK, getMonthYear } from "@/lib/utils";
import type { BalanceSummary } from "@/types";

interface BalanceCardProps {
  summary: BalanceSummary;
  userName?: string;
}

export function BalanceCard({ summary, userName }: BalanceCardProps) {
  const [hidden, setHidden] = useState(false);
  const isPositive = summary.balance >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl gradient-primary p-6 text-white shadow-xl"
    >
      {/* Decorative blobs */}
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/10" />
      <div className="absolute right-16 bottom-4 h-20 w-20 rounded-full bg-white/5" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-medium text-white/70 mb-0.5">ຍອດຄົງເຫຼືອ</p>
            <p className="text-xs text-white/60">
              {getMonthYear(summary.month, summary.year)}
              {userName && ` · ${userName}`}
            </p>
          </div>
          <button
            onClick={() => setHidden(!hidden)}
            className="rounded-full p-2 hover:bg-white/10 transition-colors"
          >
            {hidden ? (
              <EyeOff className="h-4 w-4 text-white/70" />
            ) : (
              <Eye className="h-4 w-4 text-white/70" />
            )}
          </button>
        </div>

        {/* Balance */}
        <motion.div
          key={hidden ? "hidden" : "visible"}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6"
        >
          <p className={cn("text-3xl font-bold tracking-tight number-font", isPositive ? "" : "text-red-200")}>
            {hidden ? "••••••••" : formatLAK(Math.abs(summary.balance))}
          </p>
          {!isPositive && !hidden && (
            <p className="text-xs text-red-200 mt-0.5">⚠️ ລາຍຈ່າຍເກີນລາຍຮັບ</p>
          )}
        </motion.div>

        {/* Income vs Expense */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-white/15 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/30">
                <TrendingUp className="h-3 w-3 text-emerald-300" />
              </div>
              <p className="text-xs text-white/70 font-medium">ລາຍຮັບ</p>
            </div>
            <p className="text-base font-bold number-font">
              {hidden ? "•••••" : formatLAK(summary.total_income, true)}
            </p>
          </div>

          <div className="rounded-xl bg-white/15 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-400/30">
                <TrendingDown className="h-3 w-3 text-red-300" />
              </div>
              <p className="text-xs text-white/70 font-medium">ລາຍຈ່າຍ</p>
            </div>
            <p className="text-base font-bold number-font">
              {hidden ? "•••••" : formatLAK(summary.total_expense, true)}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
