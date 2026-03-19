import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Flower2, Shield } from "lucide-react";

export const runtime = "edge";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  const adminId = process.env.ADMIN_TELEGRAM_ID;

  if (session && session === adminId) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary mb-3 shadow-lg">
            <Flower2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">ປ້າຂ້າງບ້ານ</h1>
          <p className="text-sm text-muted-foreground mt-1">Admin Dashboard</p>
        </div>

        {/* Login Form */}
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">ເຂົ້າສູ່ລະບົບ Admin</h2>
          </div>

          {params.error && (
            <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {params.error === "invalid" ? "Telegram ID ບໍ່ຖືກຕ້ອງ" : "ເກີດຂໍ້ຜິດພາດ"}
            </div>
          )}

          <form action="/api/admin/login" method="POST" className="space-y-4">
            <input type="hidden" name="redirect" value={params.redirect ?? "/admin"} />
            <div className="space-y-1.5">
              <label htmlFor="telegram_id" className="text-sm font-medium">
                Telegram ID ຂອງທ່ານ
              </label>
              <input
                id="telegram_id"
                name="telegram_id"
                type="text"
                inputMode="numeric"
                placeholder="ເຊັ່ນ: 123456789"
                required
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                ສາມາດຫາໄດ້ຈາກ @userinfobot ໃນ Telegram
              </p>
            </div>

            <button
              type="submit"
              className="w-full h-11 rounded-lg gradient-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              ເຂົ້າສູ່ລະບົບ
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          ສຳລັບ Admin ເທົ່ານັ້ນ — ຜູ້ໃຊ້ທົ່ວໄປໃຊ້ Telegram Mini App
        </p>
      </div>
    </div>
  );
}
