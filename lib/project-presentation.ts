import type { AppSpec } from "@/lib/project-spec"
import type { ProjectHistoryItem, Region } from "@/lib/project-workspace"

export type ProjectIconSpec = {
  glyph: string
  from: string
  to: string
  ring: string
}

export type ProjectPresentation = {
  displayName: string
  subtitle: string
  summary: string
  icon: ProjectIconSpec
  routes: string[]
  archetype?: string
  category?: string
  coreModules?: string[]
  entities?: string[]
  visualTone?: string
  capabilityFlags?: Partial<NonNullable<AppSpec["capabilityFlags"]>>
}

function sanitizeText(input?: string | null) {
  return String(input ?? "").replace(/\s+/g, " ").trim()
}

function looksLikeInternalProjectId(input?: string | null) {
  return /^project_[a-zA-Z0-9_-]+$/.test(sanitizeText(input))
}

function toDisplayCase(input: string) {
  const normalized = sanitizeText(input).replace(/["'`]/g, "")
  if (!normalized) return ""
  if (/^[a-z0-9_-]+$/i.test(normalized) && !/\s/.test(normalized)) {
    if (/morncursor/i.test(normalized)) return "MornCursor"
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }
  return normalized
}

function inferNameFromPrompt(prompt?: string | null, region?: Region, spec?: Partial<AppSpec> | null) {
  const text = sanitizeText(prompt)
  if (!text) return ""

  const explicit =
    text.match(/名字叫\s*([A-Za-z][A-Za-z0-9_-]{1,40})/i)?.[1] ||
    text.match(/叫\s*([A-Za-z][A-Za-z0-9_-]{1,40})/i)?.[1] ||
    text.match(/named\s+([A-Za-z][A-Za-z0-9_-]{1,40})/i)?.[1] ||
    text.match(/name\s+is\s+([A-Za-z][A-Za-z0-9_-]{1,40})/i)?.[1]
  if (explicit) return toDisplayCase(explicit)

  if (spec?.kind === "code_platform" || /cursor|代码编辑|ide|coding/i.test(text)) return "MornCursor"
  if (spec?.kind === "crm" || /crm|销售|客户/i.test(text)) return "CRM Pilot"
  if (spec?.kind === "community" || /community|社区|反馈/i.test(text)) return "Community Hub"
  if (/api|接口|数据平台/i.test(text)) return "API Studio"
  if (/site|website|官网|landing/i.test(text)) return "AI Site Generator"
  if (/task|任务|流程/i.test(text)) return "TaskFlow"
  return region === "cn" ? "AI App Studio" : "AI App Studio"
}

function inferRoutesFromSpec(spec?: Partial<AppSpec> | null) {
  if (Array.isArray(spec?.routeBlueprint) && spec.routeBlueprint.length) {
    const routes = spec.routeBlueprint
      .map((item) => sanitizeText(item?.path))
      .filter(Boolean)
    if (routes.length) return Array.from(new Set(routes))
  }
  const routes = new Set<string>()
  const routeMatchers: Array<[string, string[]]> = [
    ["/dashboard", ["dashboard", "overview"]],
    ["/tasks", ["tasks", "task board", "task queue"]],
    ["/settings", ["settings"]],
    ["/analytics", ["analytics"]],
    ["/reports", ["reports", "reporting"]],
    ["/automations", ["automations", "automation"]],
    ["/team", ["team", "collaboration"]],
    ["/approvals", ["approvals", "approval"]],
    ["/handoff", ["handoff"]],
    ["/playbooks", ["playbooks", "playbook"]],
    ["/about", ["about"]],
    ["/downloads", ["downloads"]],
    ["/docs", ["docs", "documentation"]],
    ["/admin", ["admin"]],
    ["/editor", ["editor", "code"]],
    ["/runs", ["runs", "runtime", "run panel"]],
    ["/templates", ["templates", "template"]],
    ["/pricing", ["pricing", "upgrade"]],
  ]
  if (spec?.kind === "code_platform") {
    ;["/dashboard", "/editor", "/runs", "/templates", "/pricing"].forEach((item) => routes.add(item))
  }

  for (const moduleName of spec?.modules ?? []) {
    const lower = String(moduleName).toLowerCase()
    for (const [route, keywords] of routeMatchers) {
      if (keywords.some((keyword) => lower.includes(keyword))) {
        routes.add(route)
      }
    }
  }

  if (spec?.features?.includes("analytics_page")) routes.add("/analytics")
  if (spec?.features?.includes("about_page")) routes.add("/about")

  if (routes.size === 0) routes.add("/")
  return Array.from(routes)
}

function buildSummary(spec: Partial<AppSpec> | null | undefined, latest?: ProjectHistoryItem | null) {
  const latestSummary = sanitizeText(latest?.summary)
  if (latestSummary) return latestSummary

  const identitySummary = sanitizeText(spec?.appIdentity?.shortDescription)
  if (identitySummary) return identitySummary

  const modules = Array.isArray(spec?.modules) ? spec.modules.slice(0, 5).map((item) => sanitizeText(item)) : []
  if (modules.length) {
    return modules.join(" / ")
  }

  if (spec?.kind === "code_platform") {
    return spec?.region === "cn"
      ? "中国版 AI 代码编辑平台，支持 dashboard / editor / runs / templates / pricing"
      : "AI coding platform with dashboard / editor / runs / templates / pricing"
  }
  return spec?.region === "cn" ? "已生成可继续迭代的产品工作区。" : "Generated product workspace ready for iteration."
}

function buildSubtitle(spec: Partial<AppSpec> | null | undefined, region: Region) {
  const identityCategory = sanitizeText(spec?.appIdentity?.archetypeLabel)
  if (identityCategory) return identityCategory

  if (spec?.kind === "code_platform") {
    return region === "cn" ? "中国版 AI 代码编辑平台" : "AI coding platform"
  }
  if (spec?.kind === "crm") {
    return region === "cn" ? "销售与客户管理工作区" : "Sales and CRM workspace"
  }
  if (spec?.kind === "community") {
    return region === "cn" ? "社区反馈与运营平台" : "Community feedback platform"
  }
  if (spec?.kind === "blog") {
    return region === "cn" ? "官网与内容产品" : "Marketing and content product"
  }
  return region === "cn" ? "AI 生成应用工作区" : "AI generated app workspace"
}

function buildIcon(spec: Partial<AppSpec> | null | undefined): ProjectIconSpec {
  if (spec?.visualSeed?.icon) {
    return {
      glyph: spec.visualSeed.icon.glyph,
      from: spec.visualSeed.icon.from,
      to: spec.visualSeed.icon.to,
      ring: spec.visualSeed.icon.ring,
    }
  }
  if (spec?.appIdentity?.icon) {
    return spec.appIdentity.icon
  }
  if (spec?.kind === "code_platform") {
    return { glyph: "✦", from: "#6d28d9", to: "#a855f7", ring: "rgba(168,85,247,0.24)" }
  }
  if (spec?.kind === "crm") {
    return { glyph: "◫", from: "#0f766e", to: "#14b8a6", ring: "rgba(20,184,166,0.24)" }
  }
  if (spec?.templateId === "taskflow") {
    return { glyph: "◎", from: "#0f766e", to: "#38bdf8", ring: "rgba(56,189,248,0.24)" }
  }
  if (spec?.kind === "community") {
    return { glyph: "◆", from: "#b45309", to: "#f59e0b", ring: "rgba(245,158,11,0.24)" }
  }
  return { glyph: "◈", from: "#1d4ed8", to: "#6366f1", ring: "rgba(99,102,241,0.24)" }
}

export function buildProjectPresentation(args: {
  projectId: string
  region: Region
  spec?: Partial<AppSpec> | null
  latestHistory?: ProjectHistoryItem | null
}) {
  const { projectId, region, spec, latestHistory } = args
  const explicitTitle = sanitizeText(spec?.title)
  const displayName =
    sanitizeText(spec?.appIdentity?.displayName) ||
    (explicitTitle && !looksLikeInternalProjectId(explicitTitle) ? toDisplayCase(explicitTitle) : "") ||
    inferNameFromPrompt(latestHistory?.prompt, region, spec) ||
    (looksLikeInternalProjectId(projectId) ? "AI App Studio" : projectId)
  return {
    displayName,
    subtitle: buildSubtitle(spec, region),
    summary: buildSummary(spec, latestHistory),
    icon: buildIcon(spec),
    routes: inferRoutesFromSpec(spec),
    archetype: sanitizeText(spec?.appIdentity?.category) || sanitizeText(spec?.appIntent?.archetype),
    category: sanitizeText(spec?.appIntent?.productCategory),
    coreModules: Array.isArray(spec?.moduleBlueprint) && spec.moduleBlueprint.length
      ? spec.moduleBlueprint.slice(0, 6).map((item) => sanitizeText(item.label)).filter(Boolean)
      : (spec?.modules ?? []).slice(0, 6).map((item) => sanitizeText(item)).filter(Boolean),
    entities: Array.isArray(spec?.entityBlueprint)
      ? spec.entityBlueprint.slice(0, 6).map((item) => sanitizeText(item.label)).filter(Boolean)
      : [],
    visualTone: sanitizeText(spec?.visualSeed?.tone),
    capabilityFlags: spec?.capabilityFlags,
  } satisfies ProjectPresentation
}
