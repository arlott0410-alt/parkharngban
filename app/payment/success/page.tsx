"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentSuccessPage() {
  const params = useSearchParams();
  const reference = params.get("ref");

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
