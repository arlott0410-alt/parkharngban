import type { Metadata, Viewport } from "next";
import { Noto_Sans_Lao } from "next/font/google";
import "./globals.css";

const notoSansLao = Noto_Sans_Lao({
  subsets: ["lao", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto-sans-lao",
});

export const metadata: Metadata = {
  title: "ປ້າຂ້າງບ້ານ | Pah-Khaang-Baan",
  description: "AI-powered income/expense tracker for Lao people via Telegram Mini App",
  keywords: ["Lao", "ລາວ", "income tracker", "expense", "ປ້າຂ້າງບ້ານ"],
  robots: "noindex, nofollow", // Users access via Telegram only
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="lo" suppressHydrationWarning>
      <head>
        {/* Telegram WebApp SDK */}
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body className={`${notoSansLao.variable} min-h-screen bg-background antialiased`}>
        {children}
      </body>
    </html>
  );
}
