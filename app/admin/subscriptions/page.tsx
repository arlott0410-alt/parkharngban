import { createAdminClient } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, isSubscriptionActive, daysUntilExpiry, formatLAK } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getSubscriptions() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(`
      *,
      users (
        id,
        first_name,
        last_name,
        username
      )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("getSubscriptions error:", error);
    return [];
  }
  return data ?? [];
}

type SubWithUser = Awaited<ReturnType<typeof getSubscriptions>>[number];

export default async function AdminSubscriptionsPage() {
  const subscriptions = await getSubscriptions();
  const active = subscriptions.filter((s) => isSubscriptionActive(s.expiry_date)).length;
  const expired = subscriptions.filter(
    (s) => s.expiry_date && !isSubscriptionActive(s.expiry_date)
  ).length;
  const totalRevenueLAK = subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (s.amount_lak ?? 0), 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ສະມາຊິກ</h1>
        <p className="text-sm text-muted-foreground mt-1">ຈັດການການສະໝັກສະມາຊິກ</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-emerald-500 mt-1">{active}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">Expired</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{expired}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">ລາຍຮັບ Active</p>
          <p className="text-2xl font-bold mt-1">{formatLAK(totalRevenueLAK, true)}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ຜູ້ໃຊ້</TableHead>
              <TableHead>ສະຖານະ</TableHead>
              <TableHead>ເລີ່ມ</TableHead>
              <TableHead>ໝົດອາຍຸ</TableHead>
              <TableHead>ຄ່າສະມາຊິກ</TableHead>
              <TableHead>ອ້າງອີງການຊຳລະ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  ຍັງບໍ່ມີຂໍ້ມູນ
                </TableCell>
              </TableRow>
            ) : (
              subscriptions.map((sub: SubWithUser) => {
                const user = Array.isArray(sub.users) ? sub.users[0] : sub.users;
                const isActive = isSubscriptionActive(sub.expiry_date);
                const days = daysUntilExpiry(sub.expiry_date);

                return (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">
                          {user?.first_name ?? "—"} {user?.last_name ?? ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user?.username ? `@${user.username}` : `ID: ${sub.user_id}`}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isActive ? "active" : sub.status === "inactive" ? "inactive" : "expired"}>
                        {isActive ? `Active ${days > 0 ? `(${days}d)` : ""}` : sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sub.started_at ? formatDateTime(sub.started_at) : "—"}
                    </TableCell>
                    <TableCell className={`text-sm ${isActive && days <= 3 ? "text-red-500 font-medium" : ""}`}>
                      {sub.expiry_date ? formatDateTime(sub.expiry_date) : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatLAK(sub.amount_lak ?? 0)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {sub.payment_ref ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
