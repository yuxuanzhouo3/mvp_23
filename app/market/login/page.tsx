import { headers } from "next/headers"
import { resolveRequestRegion } from "@/lib/config/request-region"
import MarketLoginClient from "./market-login-client"

export default function MarketLoginPage() {
  const locale = resolveRequestRegion(headers().get("host")) === "CN" ? "zh" : "en"

  return <MarketLoginClient locale={locale} />
}
