"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { KpiData } from "@/types";

interface KpiCardProps extends KpiData {
  index?: number;
  colorClass?: string;
}

export function KpiCard({
  label,
  value,
  change,
  trend = "neutral",
  icon,
  index = 0,
  colorClass,
}: KpiCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-500"
      : trend === "down"
        ? "text-red-500"
        : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
    >
      <Card className="relative overflow-hidden hover:shadow-md transition-shadow">
        {/* Subtle background accent */}
        <div
          className={cn(
            "absolute inset-0 opacity-5",
            colorClass ?? "gradient-primary"
          )}
        />
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">{label}</p>
              <p className="text-2xl font-bold tracking-tight number-font">
                {typeof value === "number"
                  ? new Intl.NumberFormat("lo-LA").format(value)
                  : value}
              </p>
              {change !== undefined && (
                <div className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
                  <TrendIcon className="h-3 w-3" />
                  <span>
                    {change > 0 ? "+" : ""}
                    {change}%
                  </span>
                  <span className="text-muted-foreground font-normal">vs ເດືອນກ່ອນ</span>
                </div>
              )}
            </div>
            {icon && (
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl text-2xl",
                  "bg-primary/10"
                )}
              >
                {icon}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
