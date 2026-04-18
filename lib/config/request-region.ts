import { getDeploymentRegion } from "@/config"

export type RequestRegion = "CN" | "INTL"

export function resolveRequestRegion(host?: string | null): RequestRegion {
  const normalizedHost = String(host || "").toLowerCase()
  if (normalizedHost.includes("mornscience.top")) return "CN"
  if (normalizedHost.includes("mornscience.work")) return "INTL"
  return getDeploymentRegion()
}
