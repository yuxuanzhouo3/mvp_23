import { ReactNode } from "react";
import { headers } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
import { getAdminSession } from "@/lib/admin/session";
import { resolveRequestRegion } from "@/lib/config/request-region";
import AdminSidebar from "./components/AdminSidebar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const headerStore = await headers();
  const locale = resolveRequestRegion(headerStore.get("host")) === "CN" ? "zh" : "en";
  const sessionResult = await getAdminSession();

  if (!sessionResult.valid || !sessionResult.session) {
    return <>{children}</>;
  }

  const session = sessionResult.session;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="flex">
        <AdminSidebar locale={locale} username={session.username} role={session.role} />

        <main className="ml-64 flex-1 p-8">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
