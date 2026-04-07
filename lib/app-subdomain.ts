import { normalizePlanTier, type PlanTier } from "@/lib/plan-catalog"

type AppSubdomainArgs = {
  projectSlug?: string | null
  projectId?: string | null
  region: "cn" | "intl"
  planTier?: PlanTier | string | null
}

function normalizeLabel(input?: string | null) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function getAppSubdomainRoot(region: "cn" | "intl") {
  if (region === "cn") {
    return process.env.NEXT_PUBLIC_APP_SUBDOMAIN_ROOT_CN || "apps.mornstack.mornscience.top"
  }
  return process.env.NEXT_PUBLIC_APP_SUBDOMAIN_ROOT_INTL || "apps.mornscience.app"
}

export function resolveAppSubdomainHost(hostname?: string | null) {
  const normalizedHost = String(hostname ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
  if (!normalizedHost) return null

  const roots = [
    { region: "cn" as const, root: getAppSubdomainRoot("cn").toLowerCase() },
    { region: "intl" as const, root: getAppSubdomainRoot("intl").toLowerCase() },
  ]

  for (const item of roots) {
    if (normalizedHost === item.root) {
      return { region: item.region, slug: "", root: item.root }
    }
    if (normalizedHost.endsWith(`.${item.root}`)) {
      const slug = normalizedHost.slice(0, normalizedHost.length - item.root.length - 1)
      return {
        region: item.region,
        slug: normalizeLabel(slug),
        root: item.root,
      }
    }
  }

  return null
}

export function buildAssignedAppSubdomain(args: AppSubdomainArgs) {
  const baseSlug = normalizeLabel(args.projectSlug) || normalizeLabel(args.projectId) || "app"
  normalizePlanTier(args.planTier)
  return `${baseSlug}.${getAppSubdomainRoot(args.region)}`
}

export function buildAssignedAppUrl(args: AppSubdomainArgs) {
  return `https://${buildAssignedAppSubdomain(args)}`
}
