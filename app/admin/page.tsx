import { headers } from "next/headers";
import { resolveRequestRegion } from "@/lib/config/request-region";
import AdminDemoPageClient from "./components/admin-demo-page-client";

export default async function AdminPage() {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const locale = resolveRequestRegion(host) === "CN" ? "zh" : "en";

  return <AdminDemoPageClient locale={locale} />;
}
