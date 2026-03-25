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
}

function sanitizeText(input?: string | null) {
  return String(input ?? "").replace(/\s+/g, " ").trim()
}

function inferRoutesFromSpec(spec?: Partial<AppSpec> | null) {
  const routes = new Set<string>()
  if (spec?.kind === "code_platform") {
    ;["/dashboard", "/editor", "/runs", "/templates", "/pricing"].forEach((item) => routes.add(item))
  }

  for (const moduleName of spec?.modules ?? []) {
    const lower = String(moduleName).toLowerCase()
    if (lower.includes("dashboard")) routes.add("/dashboard")
    if (lower.includes("editor")) routes.add("/editor")
    if (lower.includes("runs")) routes.add("/runs")
    if (lower.includes("template")) routes.add("/templates")
    if (lower.includes("pricing") || lower.includes("upgrade")) routes.add("/pricing")
  }

  if (routes.size === 0) routes.add("/")
  return Array.from(routes)
}

function buildSummary(spec: Partial<AppSpec> | null | undefined, latest?: ProjectHistoryItem | null) {
  const latestSummary = sanitizeText(latest?.summary)
  if (latestSummary) return latestSummary

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
  const displayName = sanitizeText(spec?.title) || projectId
  return {
    displayName,
    subtitle: buildSubtitle(spec, region),
    summary: buildSummary(spec, latestHistory),
    icon: buildIcon(spec),
    routes: inferRoutesFromSpec(spec),
  } satisfies ProjectPresentation
}
