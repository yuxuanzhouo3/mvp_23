export type AppRegion = "cn" | "intl"

export function getRegionFromHostname(hostname?: string | null): AppRegion {
  const normalized = String(hostname ?? "").trim().toLowerCase()
  const envRegion = String(process.env.NEXT_PUBLIC_APP_REGION ?? "").trim().toLowerCase()
  if (!normalized) return "intl"
  if (normalized === "mornstack.mornscience.top" || normalized.endsWith(".mornscience.top")) {
    return "cn"
  }
  if (envRegion === "cn" || envRegion === "intl") {
    return envRegion
  }
  return "intl"
}
