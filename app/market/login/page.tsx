import { headers } from "next/headers"
import { resolveRequestRegion } from "@/lib/config/request-region"
import MarketLoginClient from "./market-login-client"

export default async function MarketLoginPage() {
  const headerStore = await headers()
  const locale = resolveRequestRegion(headerStore.get("host")) === "CN" ? "zh" : "en"

  return <MarketLoginClient locale={locale} />
}
