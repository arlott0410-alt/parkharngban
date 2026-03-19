"use client";

import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentCancelPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <section className="w-full max-w-md rounded-2xl border bg-card p-6 text-center space-y-4">
        <XCircle className="h-12 w-12 text-red-500 mx-auto" />
        <h1 className="text-xl font-bold">ຍົກເລີກການຊຳລະ</h1>
        <p className="text-sm text-muted-foreground">
          ທ່ານສາມາດລອງອີກຄັ້ງໄດ້ເມື່ອພ້ອມ
        </p>
        <Button asChild className="w-full" variant="outline">
          <Link href="/profile">ກັບໄປທີ່ໂປຣໄຟລ໌</Link>
        </Button>
      </section>
    </main>
  );
}
