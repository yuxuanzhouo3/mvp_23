import nextDynamic from "next/dynamic";
import { headers } from "next/headers";
import { resolveRequestRegion } from "@/lib/config/request-region";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AdminDemoPageClient = nextDynamic(
  () => import("./components/admin-demo-page-client"),
  { ssr: false },
);

export default async function AdminPage() {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const locale = resolveRequestRegion(host) === "CN" ? "zh" : "en";

  return <AdminDemoPageClient locale={locale} />;
}
