export type AppRegion = "cn" | "intl"

export function getRegionFromHostname(hostname?: string | null): AppRegion {
  const normalized = String(hostname ?? "").trim().toLowerCase()
  if (!normalized) return "intl"
  if (normalized === "mornstack.mornscience.top" || normalized.endsWith(".mornscience.top")) {
    return "cn"
  }
  return "intl"
}
