import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AdminSidebar } from "@/components/admin/Sidebar";

export const metadata: Metadata = {
  title: "Admin — ປ້າຂ້າງບ້ານ",
  robots: "noindex, nofollow",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
