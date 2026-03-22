"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatLAK, getMonthYear } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CategorySpending, MonthlyData, BalanceSummary } from "@/types";

export default function ReportsPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState<BalanceSummary | null>(null);
  const [categoryData, setCategoryData] = useState<CategorySpending[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  const initDataRaw =
    typeof window !== "undefined" ? window.Telegram?.WebApp?.initData ?? "" : "";

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, catRes, monthlyRes] = await Promise.all([
        fetch(`/api/mini-app/summary?month=${month}&year=${year}`, {
          headers: { "x-telegram-init-data": initDataRaw },
        }),
        fetch(`/api/mini-app/categories-spending?month=${month}&year=${year}`, {
          headers: { "x-telegram-init-data": initDataRaw },
        }),
        fetch(`/api/mini-app/monthly-data?year=${year}`, {
          headers: { "x-telegram-init-data": initDataRaw },
        }),
      ]);

      if (summaryRes.ok) {
        const d = await summaryRes.json() as { summary: BalanceSummary };
        setSummary(d.summary);
      }
      if (catRes.ok) {
        const d = await catRes.json() as { data: CategorySpending[] };
        setCategoryData(d.data ?? []);
      }
      if (monthlyRes.ok) {
        const d = await monthlyRes.json() as { data: MonthlyData[] };
        setMonthlyData(d.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [month, year, initDataRaw]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return;
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const RADIAN = Math.PI / 180;
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
    cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number;
  }) => {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const expenseCats = categoryData.filter((c) => c.type === "expense" && c.amount > 0);
  const incomeCats = categoryData.filter((c) => c.type === "income" && c.amount > 0);
  const hasCategoryCharts = expenseCats.length > 0 || incomeCats.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold">ລາຍງານ</h1>
        <p className="text-xs text-muted-foreground mt-1 mb-3 leading-relaxed">
          ເບິ່ງສະຫຼຸບລາຍເດືອນ: ລາຍຮັບ/ລາຍຈ່າຍ/ຄົງເຫຼືອ, ແຜນວຽນແຍກຕາມໝວດ (ຮັບ ແລະ ຈ່າຍ), ແລະກຣາບລາຍເດືອນທັງປີເພື່ອເຫັນແນວໂນ້ມ
        </p>

        {/* Month Selector */}
        <div className="flex items-center justify-between bg-muted rounded-xl px-4 py-2.5">
          <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-background/50 transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="font-semibold text-sm">{getMonthYear(month, year)}</span>
          <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-background/50 transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="px-4 py-3 grid grid-cols-3 gap-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-3 text-center"
            >
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">ລາຍຮັບ</p>
              <p className="text-sm font-bold text-emerald-500 mt-0.5 number-font">
                {formatLAK(summary?.total_income ?? 0)}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-xl bg-red-50 dark:bg-red-950/20 p-3 text-center"
            >
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">ລາຍຈ່າຍ</p>
              <p className="text-sm font-bold text-red-500 mt-0.5 number-font">
                {formatLAK(summary?.total_expense ?? 0)}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`rounded-xl p-3 text-center ${(summary?.balance ?? 0) >= 0 ? "bg-primary/10" : "bg-red-50 dark:bg-red-950/20"}`}
            >
              <p className="text-xs text-muted-foreground font-medium">ຄົງເຫຼືອ</p>
              <p className={`text-sm font-bold mt-0.5 number-font ${(summary?.balance ?? 0) >= 0 ? "text-primary" : "text-red-500"}`}>
                {formatLAK(Math.abs(summary?.balance ?? 0))}
              </p>
            </motion.div>
          </>
        )}
      </div>

      {/* Charts Tabs */}
      <div className="px-4">
        <Tabs defaultValue="category">
          <TabsList className="w-full">
            <TabsTrigger value="category" className="flex-1">ໝວດໝູ່</TabsTrigger>
            <TabsTrigger value="monthly" className="flex-1">ລາຍເດືອນ</TabsTrigger>
          </TabsList>

          <TabsContent value="category" className="mt-4">
            {loading ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : !hasCategoryCharts ? (
              <div className="flex flex-col items-center justify-center min-h-[12rem] rounded-xl border border-dashed p-6 text-center text-muted-foreground">
                <p className="text-3xl mb-2">📊</p>
                <p className="text-sm font-medium">ຍັງບໍ່ມີຂໍ້ມູນຕາມໝວດ</p>
                <p className="text-xs mt-2 max-w-[280px]">
                  ເມື່ອມີລາຍຮັບຫຼືລາຍຈ່າຍທີ່ມີໝວດໝູ່ ແຜນວຽນຈະສະແດງທີ່ນີ້. ຖ້າມີແຕ່ລາຍຮັບລ້ວນ — ເບິ່ງສ່ວນ &quot;ລາຍຮັບຕາມໝວດ&quot; ຂ້າງລຸ່ມ.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {incomeCats.length > 0 ? (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">ລາຍຮັບຕາມໝວດ</h3>
                    <div className="rounded-xl bg-card border p-4">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={incomeCats}
                            cx="50%"
                            cy="50%"
                            outerRadius={85}
                            dataKey="amount"
                            nameKey="category_name_lao"
                            labelLine={false}
                            label={renderLabel}
                          >
                            {incomeCats.map((entry, index) => (
                              <Cell key={`inc-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "11px",
                            }}
                            formatter={(value: number) => [formatLAK(value), ""]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {incomeCats
                        .sort((a, b) => b.amount - a.amount)
                        .map((cat, i) => (
                          <motion.div
                            key={`inc-${cat.category_id}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center justify-between rounded-xl bg-card border p-3"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className="flex h-9 w-9 items-center justify-center rounded-xl text-base"
                                style={{ backgroundColor: `${cat.color}20` }}
                              >
                                {cat.icon}
                              </span>
                              <div>
                                <p className="text-sm font-medium">{cat.category_name_lao ?? cat.category_name}</p>
                                <p className="text-xs text-muted-foreground">{cat.percentage}%</p>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 number-font">
                              {formatLAK(cat.amount)}
                            </p>
                          </motion.div>
                        ))}
                    </div>
                  </section>
                ) : null}

                {expenseCats.length > 0 ? (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">ລາຍຈ່າຍຕາມໝວດ</h3>
                    <div className="rounded-xl bg-card border p-4">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={expenseCats}
                            cx="50%"
                            cy="50%"
                            outerRadius={85}
                            dataKey="amount"
                            nameKey="category_name_lao"
                            labelLine={false}
                            label={renderLabel}
                          >
                            {expenseCats.map((entry, index) => (
                              <Cell key={`exp-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "11px",
                            }}
                            formatter={(value: number) => [formatLAK(value), ""]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {expenseCats
                        .sort((a, b) => b.amount - a.amount)
                        .map((cat, i) => (
                          <motion.div
                            key={`exp-${cat.category_id}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center justify-between rounded-xl bg-card border p-3"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className="flex h-9 w-9 items-center justify-center rounded-xl text-base"
                                style={{ backgroundColor: `${cat.color}20` }}
                              >
                                {cat.icon}
                              </span>
                              <div>
                                <p className="text-sm font-medium">{cat.category_name_lao ?? cat.category_name}</p>
                                <p className="text-xs text-muted-foreground">{cat.percentage}%</p>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-red-500 number-font">
                              {formatLAK(cat.amount)}
                            </p>
                          </motion.div>
                        ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </TabsContent>

          <TabsContent value="monthly" className="mt-4">
            {loading ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : (
              <div className="rounded-xl bg-card border p-4">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                      formatter={(value: number, name: string) => [
                        formatLAK(value),
                        name === "income" ? "ລາຍຮັບ" : "ລາຍຈ່າຍ",
                      ]}
                    />
                    <Legend formatter={(v: string) => <span className="text-xs">{v === "income" ? "ລາຍຮັບ" : "ລາຍຈ່າຍ"}</span>} />
                    <Bar dataKey="income" fill="#10B981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="expense" fill="#EF4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
