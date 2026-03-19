"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Tag,
  Bot,
  Receipt,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Flower2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/admin", label: "ภาพรวม", labelLao: "ພາບລວມ", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "ผู้ใช้", labelLao: "ຜູ້ໃຊ້", icon: Users },
  { href: "/admin/subscriptions", label: "ซับสคริปชัน", labelLao: "ສະມາຊິກ", icon: CreditCard },
  { href: "/admin/categories", label: "หมวดหมู่", labelLao: "ໝວດໝູ່", icon: Tag },
  { href: "/admin/ai-settings", label: "AI Settings", labelLao: "ຕັ້ງຄ່າ AI", icon: Bot },
  { href: "/admin/transactions", label: "ธุรกรรม", labelLao: "ທຸລະກຳ", icon: Receipt },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative flex flex-col border-r border-border bg-card min-h-screen"
    >
      {/* Header */}
      <div className="flex h-16 items-center border-b border-border px-4">
        <AnimatePresence mode="wait">
          {!collapsed ? (
            <motion.div
              key="full"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2.5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
                <Flower2 className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground leading-none">ປ້າຂ້າງບ້ານ</p>
                <p className="text-xs text-muted-foreground mt-0.5">Admin Panel</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="icon"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary mx-auto"
            >
              <Flower2 className="h-4 w-4 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2 mt-2">
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: collapsed ? 0 : 2 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  "cursor-pointer select-none",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="overflow-hidden"
                    >
                      <div>
                        <p className="leading-none">{item.label}</p>
                        <p className="text-xs font-normal mt-0.5 opacity-60">{item.labelLao}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2 space-y-1">
        <form action="/api/admin/logout" method="POST">
          <Button
            variant="ghost"
            size="sm"
            type="submit"
            className={cn(
              "w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10",
              collapsed ? "justify-center px-0" : "justify-start gap-3"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>ອອກຈາກລະບົບ</span>}
          </Button>
        </form>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-muted transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </motion.aside>
  );
}
