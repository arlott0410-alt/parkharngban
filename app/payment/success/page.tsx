import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const runtime = "edge";

type PaymentSuccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaymentSuccessPage({ searchParams }: PaymentSuccessPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const referenceValue = resolvedParams.ref;
  const reference = Array.isArray(referenceValue) ? referenceValue[0] : referenceValue;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <section className="w-full max-w-md rounded-2xl border bg-card p-6 text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
        <h1 className="text-xl font-bold">ຊຳລະສຳເລັດ!</h1>
        <p className="text-sm text-muted-foreground">
          subscription ແອກທິບແລ້ວ ແລະລະບົບກຳລັງອັບເດດອັດຕະໂນມັດ
        </p>
        {reference && (
          <p className="text-xs text-muted-foreground break-all">ref: {reference}</p>
        )}
        <Button asChild className="w-full">
          <Link href="/profile">ກັບໄປທີ່ໂປຣໄຟລ໌</Link>
        </Button>
      </section>
    </main>
  );
}
