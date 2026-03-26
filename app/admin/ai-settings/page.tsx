"use client";

import Link from "next/link";
import { BotOff } from "lucide-react";

export default function AdminAISettingsPage() {
  return (
    <div className="p-8">
      <div className="max-w-xl rounded-2xl border bg-card p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <BotOff className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">AI Is Disabled</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          ระบบนี้เปลี่ยนเป็น Mini App only แล้ว ฟีเจอร์ AI และ Telegram bot parsing ถูกปิดถาวร
          เพื่อให้ระบบเรียบง่ายและพร้อมใช้งานเชิงพาณิชย์
        </p>
        <div className="mt-6">
          <Link
            href="/admin"
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            กลับหน้าแอดมิน
          </Link>
        </div>
      </div>
    </div>
  );
}
