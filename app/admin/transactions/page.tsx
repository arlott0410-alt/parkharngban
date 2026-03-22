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
import { formatDate, formatLAK } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "edge";

async function getTransactions() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(`
      *,
      users (id, first_name, last_name, username),
      categories (id, name, name_lao, icon, color, type)
    `)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("getTransactions error:", error);
    return [];
  }
  return data ?? [];
}

type TransactionWithJoins = Awaited<ReturnType<typeof getTransactions>>[number];

export default async function AdminTransactionsPage() {
  const transactions = await getTransactions();

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ທຸລະກຳທັງໝົດ</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ສະແດງ {transactions.length} ລາຍການລ່າສຸດ
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">ລາຍຮັບລວມ</p>
          <p className="text-xl font-bold text-emerald-500 mt-1">{formatLAK(totalIncome)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">ລາຍຈ່າຍລວມ</p>
          <p className="text-xl font-bold text-red-500 mt-1">{formatLAK(totalExpense)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">ຈຳນວນ (AI parse)</p>
          <p className="text-xl font-bold mt-1">
            {transactions.filter((t) => t.ai_parsed).length}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ວັນທີ</TableHead>
              <TableHead>ຜູ້ໃຊ້</TableHead>
              <TableHead>ປະເພດ</TableHead>
              <TableHead>ໝວດໝູ່</TableHead>
              <TableHead className="text-right">ຈຳນວນ</TableHead>
              <TableHead>ລາຍລະອຽດ</TableHead>
              <TableHead>AI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  ຍັງບໍ່ມີທຸລະກຳ
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((t: TransactionWithJoins) => {
                const user = Array.isArray(t.users) ? t.users[0] : t.users;
                const cat = Array.isArray(t.categories) ? t.categories[0] : t.categories;

                return (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(t.transaction_date)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>
                        <p className="font-medium">{user?.first_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {user?.username ? `@${user.username}` : `#${t.user_id}`}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.type === "income" ? "income" : "expense"}>
                        {t.type === "income" ? "ລາຍຮັບ" : "ລາຍຈ່າຍ"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {cat ? (
                        <span className="flex items-center gap-1.5">
                          <span>{cat.icon}</span>
                          <span>{cat.name_lao ?? cat.name}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-semibold number-font ${t.type === "income" ? "text-emerald-500" : "text-red-500"}`}>
                      {t.type === "income" ? "+" : "−"}
                      {formatLAK(t.amount)}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">
                      {t.description ?? t.raw_text ?? "—"}
                    </TableCell>
                    <TableCell>
                      {t.ai_parsed ? (
                        <Badge variant="secondary" className="text-xs">AI</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">manual</span>
                      )}
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
