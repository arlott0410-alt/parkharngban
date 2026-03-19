import { createAdminClient } from "@/lib/supabase";
import { KpiCard } from "@/components/admin/KpiCard";
import { RevenueChart, SubscriptionsChart } from "@/components/admin/Charts";
import type { DashboardStats, MonthlyRevenueData } from "@/types";

async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const supabase = createAdminClient();
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [usersRes, activeSubsRes, transactionsRes, newUsersRes, revenueRes] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("transactions").select("id", { count: "exact", head: true }),
      supabase.from("users").select("id", { count: "exact", head: true }).gte("created_at", firstOfMonth),
      supabase.from("subscriptions").select("amount_lak").eq("status", "active"),
    ]);

    const totalRevenue = (revenueRes.data ?? []).reduce((sum, s) => sum + s.amount_lak, 0);

    return {
      total_users: usersRes.count ?? 0,
      active_subscriptions: activeSubsRes.count ?? 0,
      total_transactions: transactionsRes.count ?? 0,
      total_revenue_lak: totalRevenue,
      new_users_this_month: newUsersRes.count ?? 0,
      revenue_this_month: totalRevenue,
    };
  } catch {
    return {
      total_users: 0,
      active_subscriptions: 0,
      total_transactions: 0,
      total_revenue_lak: 0,
      new_users_this_month: 0,
      revenue_this_month: 0,
    };
  }
}

async function getMonthlyRevenue(): Promise<MonthlyRevenueData[]> {
  const months = ["ມ.ກ", "ກ.ພ", "ມ.ນ", "ເ.ສ", "ພ.ສ", "ມ.ຖ", "ກ.ລ", "ສ.ຫ", "ກ.ຍ", "ຕ.ລ", "ພ.ຈ", "ທ.ວ"];
  // Placeholder — replace with actual Supabase aggregation query
  return months.slice(0, new Date().getMonth() + 1).map((month, i) => ({
    month,
    revenue: Math.floor(Math.random() * 500000) + 100000,
    subscriptions: Math.floor(Math.random() * 20) + 5,
  }));
}

export default async function AdminDashboardPage() {
  const [stats, monthlyData] = await Promise.all([getDashboardStats(), getMonthlyRevenue()]);

  const kpis = [
    {
      label: "ຜູ້ໃຊ້ທັງໝົດ",
      value: stats.total_users,
      icon: "👥",
      trend: "up" as const,
      change: 12,
    },
    {
      label: "ສະມາຊິກ Active",
      value: stats.active_subscriptions,
      icon: "✅",
      trend: "up" as const,
      change: 8,
    },
    {
      label: "ລາຍຮັບລວມ (ກີບ)",
      value: new Intl.NumberFormat("lo-LA").format(stats.total_revenue_lak),
      icon: "💰",
      trend: "up" as const,
      change: 15,
    },
    {
      label: "ທຸລະກຳທັງໝົດ",
      value: stats.total_transactions,
      icon: "📊",
      trend: "up" as const,
      change: 22,
    },
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">ພາບລວມ Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          ສະຫຼຸບຂໍ້ມູນລ່າສຸດ — ອັບເດດທຸກຄັ້ງທີ່ໂຫຼດໜ້າ
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <KpiCard key={kpi.label} {...kpi} index={index} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={monthlyData} />
        <SubscriptionsChart data={monthlyData} />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">ຜູ້ໃຊ້ໃໝ່ເດືອນນີ້</p>
          <p className="text-3xl font-bold mt-2">{stats.new_users_this_month}</p>
          <p className="text-xs text-emerald-500 mt-1">+{stats.new_users_this_month} ຄົນ</p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">ລາຍຮັບເດືອນນີ້</p>
          <p className="text-3xl font-bold mt-2">
            {new Intl.NumberFormat("lo-LA", { notation: "compact" }).format(stats.revenue_this_month)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">ກີບ</p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">ອັດຕາການຕໍ່ອາຍຸ</p>
          <p className="text-3xl font-bold mt-2">
            {stats.total_users > 0
              ? Math.round((stats.active_subscriptions / stats.total_users) * 100)
              : 0}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">ຂອງຜູ້ໃຊ້ທັງໝົດ</p>
        </div>
      </div>
    </div>
  );
}
