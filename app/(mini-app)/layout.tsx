"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { BottomNav } from "@/components/mini-app/BottomNav";

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        enableClosingConfirmation: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        colorScheme: "light" | "dark";
        openLink?: (url: string) => void;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
        };
        initData: string;
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
      };
    };
  }
}

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  const [isTelegram, setIsTelegram] = useState<boolean | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    if (tg) {
      // Initialize Telegram WebApp
      tg.ready();
      tg.expand();
      tg.enableClosingConfirmation();

      // Sync color scheme
      if (tg.colorScheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }

      setIsTelegram(true);
    } else {
      // Not in Telegram — show block page
      setIsTelegram(false);
    }
  }, []);

  // Loading state
  if (isTelegram === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Block non-Telegram access
  if (!isTelegram) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 text-6xl">🌺</div>
        <h1 className="text-2xl font-bold mb-2">ປ້າຂ້າງບ້ານ</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          ກະລຸນາເປີດໃຊ້ງານຜ່ານ Telegram Mini App ເທົ່ານັ້ນ
        </p>
        <p className="text-xs text-muted-foreground/60 mt-6">
          Available only via Telegram
        </p>
        <a
          href="https://t.me/parkharngbanbot"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#2AABEE] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Open Telegram
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Main content — padded for bottom nav */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Toast notifications */}
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          style: {
            borderRadius: "12px",
          },
        }}
      />
    </div>
  );
}
