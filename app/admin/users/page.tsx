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
import { formatDateTime, isSubscriptionActive, daysUntilExpiry } from "@/lib/utils";
import { SubscriptionManageButtons } from "@/components/admin/SubscriptionManageButtons";

export const dynamic = "force-dynamic";
export const runtime = "edge";

async function getUsers() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select(`
      *,
      subscriptions (
        status,
        expiry_date,
        amount_lak,
        created_at
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("getUsers error:", error);
    return [];
  }
  return data ?? [];
}

type UserWithSub = Awaited<ReturnType<typeof getUsers>>[number];

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ຜູ້ໃຊ້ທັງໝົດ</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ທັງໝົດ {users.length} ຄົນ
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Telegram ID</TableHead>
              <TableHead>ຊື່</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>ສະຖານະ</TableHead>
              <TableHead>ໝົດອາຍຸ</TableHead>
              <TableHead>ສົມທົບ</TableHead>
              <TableHead className="text-right w-[200px]">ຈັດການສະມາຊິກ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  ຍັງບໍ່ມີຜູ້ໃຊ້
                </TableCell>
              </TableRow>
            ) : (
              users.map((user: UserWithSub) => {
                const sub = Array.isArray(user.subscriptions)
                  ? user.subscriptions[0]
                  : user.subscriptions;
                const isActive = sub ? isSubscriptionActive(sub.expiry_date) : false;
                const days = sub ? daysUntilExpiry(sub.expiry_date) : 0;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {user.id}
                    </TableCell>
                    <TableCell className="font-medium">
                      {user.first_name} {user.last_name ?? ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.username ? `@${user.username}` : "—"}
                    </TableCell>
                    <TableCell>
                      {sub ? (
                        <Badge variant={isActive ? "active" : "expired"}>
                          {isActive ? "Active" : "Expired"}
                        </Badge>
                      ) : (
                        <Badge variant="inactive">ไม่มี</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {sub?.expiry_date ? (
                        <span className={days <= 3 ? "text-red-500 font-medium" : ""}>
                          {formatDateTime(sub.expiry_date)}
                          {isActive && days <= 7 && (
                            <span className="ml-1 text-amber-500">({days}d)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(user.created_at)}
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <SubscriptionManageButtons
                        userId={user.id}
                        hasSubscriptionRow={Boolean(sub)}
                        expiryDate={sub?.expiry_date}
                      />
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
