import path from "path"
import { promises as fs } from "fs"
import { spawn } from "child_process"
import { NextResponse } from "next/server"
import {
  appendProjectHistory,
  ensureDir,
  getProject,
  resolveProjectPath,
  safeProjectId,
  type Region,
} from "@/lib/project-workspace"
import { requestJsonChatCompletion, resolveAiConfig } from "@/lib/ai-provider"
import {
  applyPromptToSpec,
  buildSpecDrivenWorkspaceFiles,
  createAppSpec,
  readProjectSpec,
} from "@/lib/project-spec"
import {
  buildCodePlatformContextRoutes,
  inferCodePlatformElementContext,
  inferCodePlatformModuleContext,
  inferCodePlatformPageContext,
  type WorkspaceElementContext,
  type WorkspaceModuleContext,
  type WorkspacePageContext,
  type WorkspaceSessionContext,
  type WorkspaceSymbolRef,
} from "@/lib/workspace-ai-context"
import { buildAssignedAppUrl } from "@/lib/app-subdomain"
import { getPlanDefinition, getPlanPolicy, normalizePlanTier } from "@/lib/plan-catalog"

export const runtime = "nodejs"

type ModelEditOperation =
  | "replace_file"
  | "create_file"
  | "delete_file"
  | "replace_once"
  | "replace_all"
  | "insert_before"
  | "insert_after"

type ModelFileEdit = {
  path: string
  op?: ModelEditOperation
  content?: string
  find?: string
  replaceWith?: string
  anchor?: string
  reason?: string
}

type IterateMode = "explain" | "fix" | "generate" | "refactor"
type IterateWorkflowMode = "act" | "discuss" | "edit_context"

type DiscussPlan = {
  archetype:
    | "code_platform"
    | "crm"
    | "api_platform"
    | "community"
    | "website_landing_download"
    | "admin_ops_internal_tool"
  summary: string
  routeMap: string[]
  modulePlan: string[]
  taskPlan: string[]
  guardrails: string[]
  constraints: string[]
}

type EditorRequestContext = {
  currentFilePath?: string
  currentFileContent?: string
  currentFileSymbols?: WorkspaceSymbolRef[]
  focusedLine?: number
  currentRoute?: string
  relatedPaths?: string[]
  currentPage?: WorkspacePageContext
  currentModule?: WorkspaceModuleContext
  currentElement?: WorkspaceElementContext
  sharedSession?: WorkspaceSessionContext
  openTabs?: string[]
}

type IterateResolvedContext = {
  currentFilePath?: string
  currentRoute?: string
  focusedLine?: number
  currentFileSymbols?: WorkspaceSymbolRef[]
  currentPage?: WorkspacePageContext
  currentModule?: WorkspaceModuleContext
  currentElement?: WorkspaceElementContext
  sharedSession?: WorkspaceSessionContext
  openTabs?: string[]
  relatedPaths?: string[]
}

type ModelOutput = {
  summary: string
  analysis?: string
  files?: ModelFileEdit[]
  reasoning?: string
}

type AppliedEditSummary = {
  path: string
  operation: "created" | "updated" | "patched" | "deleted"
  reason?: string
  existedBefore: boolean
  linesBefore: number
  linesAfter: number
  lineDelta: number
  bytesBefore: number
  bytesAfter: number
}

function normalizeIterateMode(input: unknown): IterateMode {
  const value = String(input ?? "").trim().toLowerCase()
  if (value === "explain" || value === "fix" || value === "refactor") return value
  return "generate"
}

function normalizeIterateWorkflowMode(input: unknown): IterateWorkflowMode {
  const value = String(input ?? "").trim().toLowerCase()
  if (value === "act" || value === "discuss" || value === "edit_context") return value
  return "edit_context"
}

function sanitizeUiText(input: string) {
  return input.replace(/[<>`{}]/g, "").trim()
}

function normalizeModelEditOperation(input: unknown): ModelEditOperation | undefined {
  const value = String(input ?? "").trim().toLowerCase()
  if (!value) return undefined
  if (value === "replace_file" || value === "replace" || value === "overwrite" || value === "rewrite") return "replace_file"
  if (value === "create_file" || value === "create" || value === "new_file") return "create_file"
  if (value === "delete_file" || value === "delete" || value === "remove") return "delete_file"
  if (value === "replace_once" || value === "patch_once") return "replace_once"
  if (value === "replace_all" || value === "patch_all") return "replace_all"
  if (value === "insert_before") return "insert_before"
  if (value === "insert_after") return "insert_after"
  return undefined
}

function hasIntent(prompt: string, patterns: RegExp[]) {
  return patterns.some((re) => re.test(prompt))
}

function extractTargetTitle(prompt: string) {
  const patterns = [
    /(?:\u4fee\u6539|\u66f4\u6539|\u6539)(?:\u9875\u9762)?(?:\u4e3b)?\u6807\u9898(?:\u4e3a|\u6539\u4e3a|\u6539\u6210|:|\uff1a)?\s*["“]?([^"\n”]+)["”]?/i,
    /(?:set|change|update)\s+title\s+(?:to)?\s*["“]?([^"\n”]+)["”]?/i,
  ]
  for (const re of patterns) {
    const m = prompt.match(re)
    if (m?.[1]) {
      const safe = sanitizeUiText(m[1])
      if (safe) return safe
    }
  }
  return null
}

function isChineseUiRequest(prompt: string) {
  return hasIntent(prompt, [/\u4e2d\u6587/, /\u6c49\u5316/, /\u7b80\u4f53/, /chinese/i, /localiz/i])
}

function isDescriptionFieldRequest(prompt: string) {
  return hasIntent(prompt, [/\u63cf\u8ff0/, /\u8be6\u60c5/, /description/i, /detail/i])
}

function isBlockedColumnRequest(prompt: string) {
  return hasIntent(prompt, [/\u963b\u585e/, /\u5361\u4f4f/, /blocked/i, /block column/i])
}

function isAboutPageRequest(prompt: string) {
  return hasIntent(prompt, [
    /\u65b0\u589e\u9875\u9762/,
    /\u65b0\u5efa\u9875\u9762/,
    /\u5173\u4e8e\u9875/,
    /\u65b0\u589e.*about/i,
    /about.*\u9875\u9762/i,
    /about page/i,
    /new page/i,
  ])
}

function isAssigneeFilterRequest(prompt: string) {
  return hasIntent(prompt, [/\u7b5b\u9009/, /\u8fc7\u6ee4/, /filter/i, /assignee filter/i])
}

function normalizePath(p: string) {
  return p.replace(/\\/g, "/").replace(/^\/+/, "")
}

function toSafeSlug(input: string) {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-_]/g, " ")
    .trim()
  if (!cleaned) return "new-page"
  const pinyinLike = cleaned
    .replace(/[\u4e00-\u9fa5]/g, " page ")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return pinyinLike || "new-page"
}

function extractNewPageName(prompt: string) {
  const patterns = [
    /(?:新增|新建|添加)\s*([a-zA-Z0-9\u4e00-\u9fa5\-_ ]{1,30})\s*页面/i,
    /(?:add|create)\s+([a-zA-Z0-9\-_ ]{1,30})\s+page/i,
  ]
  for (const re of patterns) {
    const m = prompt.match(re)
    if (m?.[1]) return sanitizeUiText(m[1]).trim()
  }
  return null
}

function isAllowedFile(relativePath: string) {
  const normalized = normalizePath(relativePath)
  if (!normalized || normalized.includes("..")) {
    return false
  }
  if (normalized.startsWith("node_modules/") || normalized.startsWith(".next/") || normalized.startsWith(".git/")) {
    return false
  }
  return true
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function collectContextFiles(rootDir: string) {
  const out: string[] = []
  const allowedExt = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".prisma"])

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      const relative = normalizePath(path.relative(rootDir, fullPath))
      if (!relative) continue
      if (!isAllowedFile(relative)) continue
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (!allowedExt.has(path.extname(entry.name))) continue
      out.push(relative)
      if (out.length >= 60) return
    }
  }

  await walk(rootDir)
  return out
}

function normalizeContextPath(value?: unknown) {
  const normalized = normalizePath(String(value ?? ""))
  return isAllowedFile(normalized) ? normalized : ""
}

function uniqueContextPaths(input: Array<string | undefined | null>) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of input) {
    const normalized = normalizeContextPath(item)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

function normalizeTextValue(value: unknown) {
  return sanitizeUiText(String(value ?? "")).trim()
}

function normalizeTextList(value: unknown) {
  if (!Array.isArray(value)) return undefined
  const items = value.map((item) => normalizeTextValue(item)).filter(Boolean)
  return items.length ? items : undefined
}

function normalizePositiveInteger(value: unknown) {
  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized <= 0) return undefined
  return Math.floor(normalized)
}

function normalizeContextSymbols(value: unknown): WorkspaceSymbolRef[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const symbol = item as Record<string, unknown>
      const kind = normalizeTextValue(symbol?.kind)
      const name = normalizeTextValue(symbol?.name)
      const line = Number(symbol?.line ?? 0)
      if (!kind || !name || !Number.isFinite(line) || line <= 0) return null
      return { kind, name, line }
    })
    .filter((item): item is WorkspaceSymbolRef => Boolean(item))
}

function normalizePageContext(value: unknown): WorkspacePageContext | undefined {
  if (!value || typeof value !== "object") return undefined
  const page = value as Record<string, unknown>
  const id = normalizeTextValue(page.id).toLowerCase()
  const label = normalizeTextValue(page.label)
  const route = String(page.route ?? "").trim()
  const filePath = normalizeContextPath(String(page.filePath ?? ""))
  const focus = normalizeTextValue(page.focus)
  const symbols = Array.isArray(page.symbols) ? page.symbols.map((item) => normalizeTextValue(item)).filter(Boolean) : []
  const elements = Array.isArray(page.elements) ? page.elements.map((item) => normalizeTextValue(item)).filter(Boolean) : []
  if (!id && !label && !route && !filePath) return undefined
  return {
    id: id || "workspace",
    label: label || id || "Workspace",
    route: route || "/",
    filePath,
    focus,
    symbols,
    elements,
  }
}

function normalizeModuleContext(value: unknown): WorkspaceModuleContext | undefined {
  if (!value || typeof value !== "object") return undefined
  const module = value as Record<string, unknown>
  const name = normalizeTextValue(module.name)
  if (!name) return undefined
  const source = String(module.source ?? "page")
  const relatedSymbols = Array.isArray(module.relatedSymbols)
    ? module.relatedSymbols.map((item) => normalizeTextValue(item)).filter(Boolean)
    : []
  return {
    name,
    source: source === "symbol" || source === "file" ? source : "page",
    relatedSymbols,
  }
}

function normalizeElementContext(value: unknown): WorkspaceElementContext | undefined {
  if (!value || typeof value !== "object") return undefined
  const element = value as Record<string, unknown>
  const name = normalizeTextValue(element.name)
  if (!name) return undefined
  const source = String(element.source ?? "page")
  const detail = normalizeTextValue(element.detail)
  const options = Array.isArray(element.options)
    ? element.options.map((item) => normalizeTextValue(item)).filter(Boolean)
    : []
  return {
    name,
    source:
      source === "explicit" || source === "editor_rail" || source === "output_panel"
        ? source
        : "page",
    options,
    detail: detail || undefined,
  }
}

function normalizeSessionContext(value: unknown, region: Region): WorkspaceSessionContext | undefined {
  if (!value || typeof value !== "object") return undefined
  const session = value as Record<string, unknown>
  const selectedPlanId = normalizeTextValue(session.selectedPlanId)
  const codeExportAllowedValue = session.codeExportAllowed
  const codeExportLevel = normalizeTextValue(session.codeExportLevel)
  const databaseAccessMode = normalizeTextValue(session.databaseAccessMode)
  const generationProfile = normalizeTextValue(session.generationProfile)
  return {
    projectName: normalizeTextValue(session.projectName) || undefined,
    specKind: normalizeTextValue(session.specKind) || undefined,
    appArchetype: normalizeTextValue(session.appArchetype) || undefined,
    appCategory: normalizeTextValue(session.appCategory) || undefined,
    appSummary: normalizeTextValue(session.appSummary) || undefined,
    primaryWorkflow: normalizeTextValue(session.primaryWorkflow) || undefined,
    visualTone: normalizeTextValue(session.visualTone) || undefined,
    routeBlueprintSummary: normalizeTextList(session.routeBlueprintSummary),
    moduleBlueprintSummary: normalizeTextList(session.moduleBlueprintSummary),
    entityBlueprintSummary: normalizeTextList(session.entityBlueprintSummary),
    activeRoutePurpose: normalizeTextValue(session.activeRoutePurpose) || undefined,
    activeModuleSummary: normalizeTextValue(session.activeModuleSummary) || undefined,
    activeEntitySummary: normalizeTextValue(session.activeEntitySummary) || undefined,
    workspaceSurface: normalizeTextValue(session.workspaceSurface) || undefined,
    activeSection: normalizeTextValue(session.activeSection) || undefined,
    routeId: normalizeTextValue(session.routeId) || undefined,
    routeLabel: normalizeTextValue(session.routeLabel) || undefined,
    filePath: normalizeContextPath(session.filePath),
    symbolName: normalizeTextValue(session.symbolName) || undefined,
    elementName: normalizeTextValue(session.elementName) || undefined,
    deploymentTarget: normalizeTextValue(session.deploymentTarget) || undefined,
    databaseTarget: normalizeTextValue(session.databaseTarget) || undefined,
    region: session.region === "cn" || session.region === "intl" ? (session.region as Region) : region,
    selectedPlanId: selectedPlanId ? normalizePlanTier(selectedPlanId) : undefined,
    selectedPlanName: normalizeTextValue(session.selectedPlanName) || undefined,
    selectedTemplate: normalizeTextValue(session.selectedTemplate) || undefined,
    codeExportAllowed: typeof codeExportAllowedValue === "boolean" ? codeExportAllowedValue : undefined,
    codeExportLevel:
      codeExportLevel === "none" || codeExportLevel === "manifest" || codeExportLevel === "full"
        ? codeExportLevel
        : undefined,
    databaseAccessMode: databaseAccessMode || undefined,
    generationProfile:
      generationProfile === "starter" ||
      generationProfile === "builder" ||
      generationProfile === "premium" ||
      generationProfile === "showcase"
        ? generationProfile
        : undefined,
    routeBudget: normalizePositiveInteger(session.routeBudget),
    moduleBudget: normalizePositiveInteger(session.moduleBudget),
    projectLimit: normalizePositiveInteger(session.projectLimit),
    collaboratorLimit: normalizePositiveInteger(session.collaboratorLimit),
    subdomainSlots: normalizePositiveInteger(session.subdomainSlots),
    assignedDomain: normalizeTextValue(session.assignedDomain) || undefined,
    workspaceStatus: normalizeTextValue(session.workspaceStatus) || undefined,
    lastIntent: normalizeTextValue(session.lastIntent) || undefined,
    lastAction: normalizeTextValue(session.lastAction) || undefined,
    lastChangedFile: normalizeContextPath(session.lastChangedFile),
    lastChangedAt: normalizeTextValue(session.lastChangedAt) || undefined,
    readiness: normalizeTextValue(session.readiness) || undefined,
  }
}

function inferRouteFromFilePath(filePath?: string | null) {
  const normalized = normalizeContextPath(filePath)
  if (!normalized) return ""
  if (normalized === "app/page.tsx") return "/"
  const match = normalized.match(/^app\/(.+)\/page\.(tsx|jsx)$/)
  if (!match?.[1]) return ""
  return `/${match[1]}`
}

function pickPrimaryChangedFile(changedFiles: string[] | undefined, context: EditorRequestContext) {
  const candidates = uniqueContextPaths(changedFiles ?? [])
  if (!candidates.length) return ""

  const currentFile = normalizeContextPath(context.currentFilePath)
  const pageFile = normalizeContextPath(context.currentPage?.filePath)
  const sessionFile = normalizeContextPath(context.sharedSession?.filePath)
  const sessionLastChangedFile = normalizeContextPath(context.sharedSession?.lastChangedFile)
  const openTabs = new Set(uniqueContextPaths(context.openTabs ?? []))
  const relatedPaths = new Set(uniqueContextPaths(context.relatedPaths ?? []))

  const ranked = candidates
    .map((filePath, index) => {
      let score = 0
      if (filePath === currentFile) score += 120
      if (filePath === pageFile) score += 100
      if (filePath === sessionLastChangedFile) score += 85
      if (filePath === sessionFile) score += 70
      if (openTabs.has(filePath)) score += 50
      if (relatedPaths.has(filePath)) score += 35
      if (/^app\/.+\.(tsx|ts|jsx|js)$/.test(filePath)) score += 30
      else if (/^(components|lib)\/.+\.(tsx|ts|jsx|js)$/.test(filePath)) score += 24
      else if (/^app\/api\/.+\.(ts|js)$/.test(filePath)) score += 18
      else if (/^data\/.+\.json$/.test(filePath)) score += 8

      if (filePath === ".env") score -= 40
      if (filePath === "spec.json" || filePath === "region.config.json") score -= 24
      if (/\.json$/.test(filePath)) score -= 8

      return { filePath, score, index }
    })
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))

  return ranked[0]?.filePath || candidates[0] || ""
}

function buildResolvedSessionContext(options: {
  session?: WorkspaceSessionContext
  context: EditorRequestContext
  mode: IterateMode
  prompt: string
  now: string
  summary?: string
  changedFiles?: string[]
  buildStatus?: "ok" | "failed" | "skipped"
}) {
  const { session, context, mode, prompt, now, summary, changedFiles, buildStatus } = options
  const firstChangedFile = pickPrimaryChangedFile(changedFiles, context)
  const resolvedFilePath =
    firstChangedFile ||
    normalizeContextPath(context.currentFilePath) ||
    normalizeContextPath(context.currentPage?.filePath) ||
    normalizeContextPath(session?.filePath)
  const resolvedRoute =
    context.currentRoute ||
    context.currentPage?.route ||
    inferRouteFromFilePath(firstChangedFile) ||
    inferRouteFromFilePath(resolvedFilePath)
  const resolvedWorkspaceStatus =
    buildStatus === "ok"
      ? "build_ok"
      : buildStatus === "failed"
        ? "build_failed"
        : buildStatus === "skipped"
          ? "context_ready"
          : context.sharedSession?.workspaceStatus || session?.workspaceStatus

  return {
    ...session,
    projectName: context.sharedSession?.projectName || session?.projectName,
    specKind: context.sharedSession?.specKind || session?.specKind,
    appArchetype: context.sharedSession?.appArchetype || session?.appArchetype,
    appCategory: context.sharedSession?.appCategory || session?.appCategory,
    appSummary: context.sharedSession?.appSummary || session?.appSummary,
    primaryWorkflow: context.sharedSession?.primaryWorkflow || session?.primaryWorkflow,
    visualTone: context.sharedSession?.visualTone || session?.visualTone,
    routeBlueprintSummary:
      context.sharedSession?.routeBlueprintSummary?.length
        ? context.sharedSession.routeBlueprintSummary
        : session?.routeBlueprintSummary,
    moduleBlueprintSummary:
      context.sharedSession?.moduleBlueprintSummary?.length
        ? context.sharedSession.moduleBlueprintSummary
        : session?.moduleBlueprintSummary,
    entityBlueprintSummary:
      context.sharedSession?.entityBlueprintSummary?.length
        ? context.sharedSession.entityBlueprintSummary
        : session?.entityBlueprintSummary,
    activeRoutePurpose: context.sharedSession?.activeRoutePurpose || session?.activeRoutePurpose,
    activeModuleSummary: context.sharedSession?.activeModuleSummary || session?.activeModuleSummary,
    activeEntitySummary: context.sharedSession?.activeEntitySummary || session?.activeEntitySummary,
    workspaceSurface: context.sharedSession?.workspaceSurface || session?.workspaceSurface,
    activeSection: context.currentPage?.id || context.sharedSession?.activeSection || session?.activeSection,
    routeId: context.currentPage?.id || session?.routeId,
    routeLabel: context.currentPage?.label || session?.routeLabel,
    filePath: resolvedFilePath || session?.filePath,
    symbolName: context.currentModule?.name || session?.symbolName,
    elementName: context.currentElement?.name || session?.elementName,
    deploymentTarget: context.sharedSession?.deploymentTarget || session?.deploymentTarget,
    databaseTarget: context.sharedSession?.databaseTarget || session?.databaseTarget,
    region: context.sharedSession?.region || session?.region,
    selectedPlanId: context.sharedSession?.selectedPlanId || session?.selectedPlanId,
    selectedPlanName: context.sharedSession?.selectedPlanName || session?.selectedPlanName,
    selectedTemplate: context.sharedSession?.selectedTemplate || session?.selectedTemplate,
    codeExportAllowed:
      typeof context.sharedSession?.codeExportAllowed === "boolean"
        ? context.sharedSession.codeExportAllowed
        : session?.codeExportAllowed,
    codeExportLevel: context.sharedSession?.codeExportLevel || session?.codeExportLevel,
    databaseAccessMode: context.sharedSession?.databaseAccessMode || session?.databaseAccessMode,
    generationProfile: context.sharedSession?.generationProfile || session?.generationProfile,
    routeBudget: context.sharedSession?.routeBudget || session?.routeBudget,
    moduleBudget: context.sharedSession?.moduleBudget || session?.moduleBudget,
    projectLimit: context.sharedSession?.projectLimit || session?.projectLimit,
    collaboratorLimit: context.sharedSession?.collaboratorLimit || session?.collaboratorLimit,
    subdomainSlots: context.sharedSession?.subdomainSlots || session?.subdomainSlots,
    assignedDomain: context.sharedSession?.assignedDomain || session?.assignedDomain,
    workspaceStatus: resolvedWorkspaceStatus || undefined,
    lastIntent: sanitizeUiText(prompt).slice(0, 240) || session?.lastIntent,
    lastAction: summary || session?.lastAction || `${mode}:${sanitizeUiText(prompt).slice(0, 120)}`,
    lastChangedFile: firstChangedFile || session?.lastChangedFile || resolvedFilePath,
    lastChangedAt: now,
    readiness:
      buildStatus === "ok"
        ? "change_applied"
        : buildStatus === "failed"
          ? "build_failed"
          : mode === "explain"
            ? "context_ready"
            : session?.readiness || "context_ready",
  } satisfies WorkspaceSessionContext
}

function prioritizeContextFiles(files: string[], context: EditorRequestContext) {
  const priority = uniqueContextPaths([
    context.currentFilePath,
    context.currentPage?.filePath,
    ...(context.openTabs ?? []),
    ...(context.relatedPaths ?? []),
  ])
  const remainder = files.filter((file) => !priority.includes(file))
  return [...priority, ...remainder]
}

function titleCaseRouteSegment(input: string) {
  return input
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()
}

function buildGenericWorkspacePageContext(context: EditorRequestContext, region: Region): WorkspacePageContext {
  const normalizedFile =
    normalizeContextPath(context.currentFilePath) ||
    normalizeContextPath(context.currentPage?.filePath) ||
    normalizeContextPath(context.sharedSession?.filePath)
  const normalizedRoute =
    context.currentRoute ||
    context.currentPage?.route ||
    inferRouteFromFilePath(normalizedFile) ||
    inferRouteFromFilePath(context.sharedSession?.filePath) ||
    "/"
  const routeKey = normalizedRoute === "/" ? "home" : normalizedRoute.replace(/^\/+/, "").split("/")[0] || "home"
  const existingPageMatches =
    Boolean(context.currentPage) &&
    (
      normalizeTextValue(context.currentPage?.id) === normalizeTextValue(routeKey) ||
      normalizeTextValue(context.currentPage?.route) === normalizeTextValue(normalizedRoute) ||
      normalizeContextPath(context.currentPage?.filePath) === normalizedFile
    )
  const label =
    (existingPageMatches ? context.currentPage?.label : "") ||
    context.sharedSession?.routeLabel ||
    (routeKey === "home" ? (region === "cn" ? "首页" : "Home") : titleCaseRouteSegment(routeKey))
  const focus =
    (existingPageMatches ? context.currentPage?.focus : "") ||
    (region === "cn"
      ? `围绕 ${label} 页面继续补主工作流、状态与页面操作。`
      : `Keep extending the core workflow, states, and actions around the ${label} page.`)
  const symbols =
    existingPageMatches && context.currentPage?.symbols?.length
      ? context.currentPage.symbols
      : (context.currentFileSymbols ?? []).map((item) => item.name).filter(Boolean).slice(0, 6)
  const fallbackElements =
    region === "cn"
      ? ["主要内容", "操作入口", "状态卡片", "设置入口"]
      : ["Primary content", "Actions", "Status cards", "Settings entry"]
  const elements =
    existingPageMatches && context.currentPage?.elements?.length
      ? context.currentPage.elements
      : [context.currentElement?.name, context.sharedSession?.elementName, ...fallbackElements].filter(Boolean).slice(0, 6) as string[]

  return {
    id: (existingPageMatches ? context.currentPage?.id : "") || context.sharedSession?.routeId || routeKey,
    label,
    route: normalizedRoute,
    filePath: normalizedFile || (normalizedRoute === "/" ? "app/page.tsx" : `app${normalizedRoute}/page.tsx`),
    focus,
    symbols,
    elements,
  }
}

function findBlueprintRouteForContext(
  projectSpec: Awaited<ReturnType<typeof readProjectSpec>> | null | undefined,
  context: EditorRequestContext
) {
  const routes = Array.isArray(projectSpec?.routeBlueprint) ? projectSpec.routeBlueprint : []
  if (!routes.length) return null

  const normalizedRoute =
    context.currentRoute ||
    context.currentPage?.route ||
    inferRouteFromFilePath(context.currentFilePath) ||
    inferRouteFromFilePath(context.sharedSession?.filePath)
  const normalizedRouteId =
    normalizeTextValue(context.currentPage?.id || context.sharedSession?.routeId || context.sharedSession?.activeSection) ||
    ""
  const normalizedFile = normalizeContextPath(context.currentFilePath || context.currentPage?.filePath || context.sharedSession?.filePath)

  return (
    routes.find((item) => normalizeTextValue(item.path) === normalizeTextValue(normalizedRoute)) ||
    routes.find((item) => normalizeTextValue(item.id) === normalizedRouteId) ||
    routes.find((item) => {
      const itemFile = item.path === "/" ? "app/page.tsx" : `app${item.path}/page.tsx`
      return normalizeContextPath(itemFile) === normalizedFile
    }) ||
    routes[0] ||
    null
  )
}

function findBlueprintModuleForContext(
  projectSpec: Awaited<ReturnType<typeof readProjectSpec>> | null | undefined,
  context: EditorRequestContext,
  routeBlueprint: NonNullable<Awaited<ReturnType<typeof readProjectSpec>>["routeBlueprint"]>[number] | null
) {
  const modules = Array.isArray(projectSpec?.moduleBlueprint) ? projectSpec.moduleBlueprint : []
  if (!modules.length) return null
  const explicitName = normalizeTextValue(context.currentModule?.name || context.sharedSession?.symbolName)
  const routeModuleIds = routeBlueprint?.moduleIds ?? []

  return (
    modules.find((item) => normalizeTextValue(item.label) === explicitName || normalizeTextValue(item.id) === explicitName) ||
    modules.find((item) => routeModuleIds.includes(item.id)) ||
    modules[0] ||
    null
  )
}

function findBlueprintEntityForContext(
  projectSpec: Awaited<ReturnType<typeof readProjectSpec>> | null | undefined,
  context: EditorRequestContext,
  routeBlueprint: NonNullable<Awaited<ReturnType<typeof readProjectSpec>>["routeBlueprint"]>[number] | null
) {
  const entities = Array.isArray(projectSpec?.entityBlueprint) ? projectSpec.entityBlueprint : []
  if (!entities.length) return null
  const explicitName = normalizeTextValue(context.currentElement?.name || context.sharedSession?.elementName)
  const routeEntityIds = routeBlueprint?.entityIds ?? []

  return (
    entities.find((item) => normalizeTextValue(item.label) === explicitName || normalizeTextValue(item.id) === explicitName) ||
    entities.find((item) => routeEntityIds.includes(item.id)) ||
    entities[0] ||
    null
  )
}

function buildBlueprintWorkspacePageContext(
  projectSpec: Awaited<ReturnType<typeof readProjectSpec>> | null | undefined,
  context: EditorRequestContext,
  region: Region
) {
  const routeBlueprint = findBlueprintRouteForContext(projectSpec, context)
  if (!routeBlueprint) {
    return {
      pageContext: buildGenericWorkspacePageContext(context, region),
      routeBlueprint: null,
      moduleBlueprint: null,
      entityBlueprint: null,
    }
  }

  const moduleBlueprint = findBlueprintModuleForContext(projectSpec, context, routeBlueprint)
  const entityBlueprint = findBlueprintEntityForContext(projectSpec, context, routeBlueprint)
  const fallbackFilePath =
    routeBlueprint.path === "/" ? "app/page.tsx" : `app${routeBlueprint.path}/page.tsx`
  const pageContext: WorkspacePageContext = {
    id: routeBlueprint.id,
    label: routeBlueprint.label,
    route: routeBlueprint.path,
    filePath:
      normalizeContextPath(context.currentPage?.filePath) ||
      normalizeContextPath(context.currentFilePath) ||
      normalizeContextPath(context.sharedSession?.filePath) ||
      fallbackFilePath,
    focus: routeBlueprint.purpose,
    symbols: [moduleBlueprint?.label, ...(moduleBlueprint?.capabilityIds ?? [])].filter(Boolean).slice(0, 6) as string[],
    elements: [
      ...(routeBlueprint.primaryActions ?? []),
      moduleBlueprint?.label,
      entityBlueprint?.label,
    ].filter(Boolean).slice(0, 6) as string[],
  }

  return {
    pageContext,
    routeBlueprint,
    moduleBlueprint,
    entityBlueprint,
  }
}

function shouldUseBlueprintRouteForCodePlatform(
  routeBlueprint: ReturnType<typeof buildBlueprintWorkspacePageContext>["routeBlueprint"],
  routes: ReturnType<typeof buildCodePlatformContextRoutes>
) {
  if (!routeBlueprint) return false
  return !routes.some((item) => item.id === routeBlueprint.id) && !routes.some((item) => item.href === routeBlueprint.path)
}

function resolveWorkspacePageContext(args: {
  region: Region
  routes: ReturnType<typeof buildCodePlatformContextRoutes>
  context: EditorRequestContext
  explicitPage?: WorkspacePageContext
  specKind?: string | null
}) {
  if (args.explicitPage) return args.explicitPage
  if (args.specKind === "code_platform") {
    return inferCodePlatformPageContext({
      routes: args.routes,
      region: args.region,
      currentFilePath: args.context.currentFilePath,
      currentRoute: args.context.currentRoute,
      activeSection:
        args.context.sharedSession?.activeSection ||
        args.context.sharedSession?.routeId ||
        args.context.currentPage?.id,
      previewTab: args.context.sharedSession?.workspaceSurface,
    })
  }
  return buildGenericWorkspacePageContext(args.context, args.region)
}

function rebuildNonCodePlatformFocus(
  context: EditorRequestContext,
  region: Region,
  projectSpec?: Awaited<ReturnType<typeof readProjectSpec>> | null
) {
  const blueprintFocus = buildBlueprintWorkspacePageContext(projectSpec, context, region)
  const pageContext = blueprintFocus.pageContext
  const moduleContext: WorkspaceModuleContext =
    blueprintFocus.moduleBlueprint
      ? {
          name: blueprintFocus.moduleBlueprint.label,
          source: "page",
          relatedSymbols: blueprintFocus.moduleBlueprint.capabilityIds.slice(0, 6),
        }
      : inferCodePlatformModuleContext({
          currentFilePath: context.currentFilePath,
          currentFileSymbols: context.currentFileSymbols,
          currentPage: pageContext,
          activeSymbolName: context.currentModule?.name || context.sharedSession?.symbolName,
        })
  const elementContext: WorkspaceElementContext =
    context.currentElement?.source === "explicit" && context.currentElement.name
      ? {
          ...context.currentElement,
          options: context.currentElement.options.length ? context.currentElement.options : pageContext.elements,
        }
      : {
          name:
            blueprintFocus.entityBlueprint?.label ||
            pageContext.elements[0] ||
            context.sharedSession?.elementName ||
            (region === "cn" ? "主要内容" : "Primary surface"),
          source: "page",
          options: [
            ...(pageContext.elements ?? []),
            ...(blueprintFocus.entityBlueprint?.primaryViews ?? []),
          ].filter(Boolean).slice(0, 8) as string[],
          detail:
            blueprintFocus.entityBlueprint?.summary ||
            context.currentElement?.detail ||
            pageContext.focus,
        }

  return {
    currentPage: pageContext,
    currentModule: moduleContext,
    currentElement: {
      ...elementContext,
      options: elementContext.options.length ? elementContext.options : pageContext.elements,
    },
  }
}

type IterateTargetStrategy = {
  snapshotFiles: string[]
  targetFiles: string[]
  promptNotes: string[]
}

type ScopedEditResult = {
  edits: ModelFileEdit[]
  droppedPaths: string[]
}

function collectSiblingFiles(files: string[], targetPath?: string | null, limit = 6) {
  const normalized = normalizeContextPath(targetPath)
  if (!normalized) return []
  const dirname = path.posix.dirname(normalized)
  return files
    .filter((file) => file !== normalized && path.posix.dirname(file) === dirname)
    .slice(0, limit)
}

function buildIterateTargetStrategy(files: string[], context: EditorRequestContext, mode: IterateMode): IterateTargetStrategy {
  const currentFile = normalizeContextPath(context.currentFilePath)
  const pageFile = normalizeContextPath(context.currentPage?.filePath)
  const sessionFile = normalizeContextPath(context.sharedSession?.filePath)
  const sessionLastChangedFile = normalizeContextPath(context.sharedSession?.lastChangedFile)
  const openTabs = uniqueContextPaths(context.openTabs ?? []).slice(0, 6)
  const related = uniqueContextPaths(context.relatedPaths ?? []).slice(0, 8)
  const hintedSupport = collectHintMatchedFiles(files, context, mode === "explain" ? 4 : 6)
  const currentSiblings = collectSiblingFiles(files, currentFile, 5)
  const pageSiblings = collectSiblingFiles(files, pageFile, 5)
  const currentDirFiles = uniqueContextPaths([...currentSiblings, ...pageSiblings])

  const coreScope = uniqueContextPaths([
    currentFile,
    pageFile,
    sessionLastChangedFile,
    sessionFile,
    ...hintedSupport,
    ...openTabs,
    ...related,
  ])

  const fixScope = uniqueContextPaths([
    currentFile,
    pageFile,
    sessionLastChangedFile,
    sessionFile,
    ...hintedSupport,
    ...currentDirFiles,
    ...openTabs,
    ...related,
  ]).slice(0, 12)

  const refactorScope = uniqueContextPaths([
    currentFile,
    ...currentSiblings,
    pageFile,
    sessionLastChangedFile,
    sessionFile,
    ...hintedSupport,
    ...pageSiblings,
    ...openTabs,
    ...related,
  ]).slice(0, 14)

  const generateScope = uniqueContextPaths([
    pageFile,
    currentFile,
    sessionLastChangedFile,
    sessionFile,
    ...hintedSupport,
    ...pageSiblings,
    ...currentSiblings,
    ...openTabs,
    ...related,
  ]).slice(0, 14)

  const explainScope = uniqueContextPaths([
    currentFile,
    pageFile,
    sessionLastChangedFile,
    sessionFile,
    ...hintedSupport,
    ...openTabs,
    ...related,
  ]).slice(0, 10)

  const snapshotSeed =
    mode === "fix"
      ? fixScope
      : mode === "refactor"
        ? refactorScope
        : mode === "generate"
          ? generateScope
          : explainScope

  const targetFiles = snapshotSeed.length ? snapshotSeed : coreScope
  const snapshotFiles = [...targetFiles, ...files.filter((file) => !targetFiles.includes(file))]

  const promptNotes =
    mode === "fix"
      ? [
          `Primary repair scope: ${targetFiles.join(", ") || "current file only"}`,
          "Prefer editing the current file and directly related files before touching broader workspace surfaces.",
          "Avoid creating new files unless the repair is impossible without a small supporting helper.",
        ]
      : mode === "refactor"
        ? [
            `Primary refactor scope: ${targetFiles.join(", ") || "current module"}`,
            "Restructure around the current module boundary and neighboring files instead of rewriting the whole app.",
            "If you split code, keep the changes anchored to the current module or current page directory.",
          ]
        : mode === "generate"
          ? [
              `Primary generation scope: ${targetFiles.join(", ") || "current page"}`,
              "Extend capability from the current page, current file, and directly related route/module files first.",
              "Create new files only when they directly support the current page, module, or route request.",
            ]
          : [
              `Primary explanation scope: ${targetFiles.join(", ") || "current workspace"}`,
              "Explain the current file first, then use neighboring files only as supporting context.",
              "Do not propose broad rewrites before grounding the explanation in the current page/module context.",
            ]

  return {
    snapshotFiles,
    targetFiles,
    promptNotes,
  }
}

function splitContextHintTokens(...values: Array<string | undefined | null>) {
  const out = new Set<string>()
  const blocked = new Set(["page", "pages", "app", "workspace", "surface", "module", "route"])
  for (const value of values) {
    const normalized = String(value ?? "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
    if (!normalized) continue
    for (const part of normalized.split(/\s+/)) {
      if (part.length >= 3 && !blocked.has(part)) out.add(part)
    }
  }
  return Array.from(out)
}

function pathMatchesHintToken(filePath: string, tokens: string[]) {
  if (!tokens.length) return false
  const normalized = normalizeContextPath(filePath).toLowerCase()
  return tokens.some((token) => normalized.includes(token))
}

function collectHintMatchedFiles(files: string[], context: EditorRequestContext, limit = 6) {
  const currentFile = normalizeContextPath(context.currentFilePath)
  const pageFile = normalizeContextPath(context.currentPage?.filePath)
  const sessionFile = normalizeContextPath(context.sharedSession?.filePath)
  const sessionLastChangedFile = normalizeContextPath(context.sharedSession?.lastChangedFile)
  const openTabs = uniqueContextPaths(context.openTabs ?? [])
  const relatedPaths = uniqueContextPaths(context.relatedPaths ?? [])
  const blocked = new Set<string>(
    [currentFile, pageFile, sessionFile, sessionLastChangedFile, ...openTabs, ...relatedPaths].filter(Boolean)
  )

  const hintTokens = splitContextHintTokens(
    context.currentPage?.id,
    context.currentPage?.label,
    context.currentPage?.focus,
    ...(context.currentPage?.symbols ?? []),
    ...(context.currentPage?.elements ?? []),
    context.currentModule?.name,
    ...(context.currentModule?.relatedSymbols ?? []),
    context.currentElement?.name,
    context.sharedSession?.routeId,
    context.sharedSession?.routeLabel,
    context.sharedSession?.activeRoutePurpose,
    context.sharedSession?.symbolName,
    context.sharedSession?.activeModuleSummary,
    context.sharedSession?.elementName,
    context.sharedSession?.activeEntitySummary,
    ...((context.currentFileSymbols ?? []).map((item) => item.name))
  )

  if (!hintTokens.length) return []

  return files
    .filter((filePath) => !blocked.has(filePath))
    .map((filePath, index) => {
      let score = 0
      if (pathMatchesHintToken(filePath, hintTokens)) score += 52
      if (pathSharesDirectory(filePath, [currentFile, pageFile, sessionFile, sessionLastChangedFile])) score += 22
      if (/^(components|lib)\/.+\.(tsx|ts|jsx|js)$/.test(filePath)) score += 24
      else if (/^app\/(?!api\/).+\.(tsx|ts|jsx|js)$/.test(filePath)) score += 18
      else if (/^data\/.+\.(json|ts)$/.test(filePath)) score += 8
      if (/\/page\.(tsx|jsx)$/.test(filePath) && filePath !== pageFile) score -= 16
      return { filePath, score, index }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .slice(0, limit)
    .map((item) => item.filePath)
}

function pathSharesDirectory(filePath: string, anchors: Array<string | undefined | null>) {
  const normalized = normalizeContextPath(filePath)
  if (!normalized) return false
  const targetDir = path.posix.dirname(normalized)
  return anchors.some((anchor) => {
    const normalizedAnchor = normalizeContextPath(anchor)
    return normalizedAnchor ? path.posix.dirname(normalizedAnchor) === targetDir : false
  })
}

function isScopedSupportFile(
  filePath: string,
  anchors: Array<string | undefined | null>,
  tokens: string[],
  existingFiles: Set<string>
) {
  const normalized = normalizeContextPath(filePath)
  if (!normalized) return false
  if (pathSharesDirectory(normalized, anchors)) return true
  if (pathMatchesHintToken(normalized, tokens)) return true
  if (!existingFiles.has(normalized) && /^app\/.+\/[^/]+\.(tsx|ts|jsx|js)$/.test(normalized)) return true
  if (/^(components|lib)\/.+\.(tsx|ts|jsx|js)$/.test(normalized) && pathMatchesHintToken(normalized, tokens)) return true
  return false
}

function constrainModelEdits(
  edits: ModelFileEdit[],
  existingFiles: string[],
  targetStrategy: IterateTargetStrategy,
  context: EditorRequestContext,
  mode: IterateMode
): ScopedEditResult {
  if (mode === "explain") {
    return { edits: [], droppedPaths: edits.map((edit) => normalizeContextPath(edit.path)).filter(Boolean) }
  }

  const currentFile = normalizeContextPath(context.currentFilePath)
  const pageFile = normalizeContextPath(context.currentPage?.filePath)
  const targetFiles = new Set(uniqueContextPaths(targetStrategy.targetFiles))
  const relatedFiles = new Set(uniqueContextPaths(context.relatedPaths ?? []))
  const openTabs = new Set(uniqueContextPaths(context.openTabs ?? []))
  const existing = new Set(uniqueContextPaths(existingFiles))
  const hintTokens = splitContextHintTokens(
    context.currentPage?.id,
    context.currentPage?.label,
    context.currentPage?.focus,
    ...(context.currentPage?.symbols ?? []),
    ...(context.currentPage?.elements ?? []),
    context.currentModule?.name,
    ...(context.currentModule?.relatedSymbols ?? []),
    context.currentElement?.name,
    context.sharedSession?.routeId,
    context.sharedSession?.routeLabel,
    context.sharedSession?.activeRoutePurpose,
    context.sharedSession?.symbolName,
    context.sharedSession?.activeModuleSummary,
    context.sharedSession?.elementName,
    context.sharedSession?.activeEntitySummary,
    ...((context.currentFileSymbols ?? []).map((item) => item.name))
  )
  const anchors = [currentFile, pageFile, ...targetStrategy.targetFiles]
  const limit = mode === "fix" ? 4 : mode === "refactor" ? 6 : 5
  const maxNewFiles = mode === "fix" ? 1 : mode === "refactor" ? 3 : 2

  const ranked = edits
    .map((edit, index) => {
      const filePath = normalizeContextPath(edit.path)
      let score = 0
      const exists = existing.has(filePath)
      const inSupportScope = isScopedSupportFile(filePath, anchors, hintTokens, existing)

      if (filePath === currentFile) score += 180
      if (filePath === pageFile) score += 140
      if (targetFiles.has(filePath)) score += 110
      if (openTabs.has(filePath)) score += 50
      if (relatedFiles.has(filePath)) score += 40
      if (pathSharesDirectory(filePath, anchors)) score += 36
      if (pathMatchesHintToken(filePath, hintTokens)) score += 28
      if (/^app\/.+\.(tsx|ts|jsx|js)$/.test(filePath)) score += 22
      else if (/^(components|lib)\/.+\.(tsx|ts|jsx|js)$/.test(filePath)) score += 16
      else if (/^data\/.+\.json$/.test(filePath)) score += 6

      if (!exists && !inSupportScope) score -= mode === "fix" ? 120 : 70
      if (mode === "fix" && !inSupportScope && !targetFiles.has(filePath)) score -= 60
      if (filePath === "app/page.tsx" && pageFile && pageFile !== "app/page.tsx") {
        score -= mode === "generate" ? 20 : 45
      }
      if (filePath === "app/layout.tsx" && filePath !== currentFile && filePath !== pageFile) {
        score -= mode === "refactor" ? 18 : 32
      }
      if (
        /^app\/[^/]+\/page\.(tsx|jsx)$/.test(filePath) &&
        filePath !== pageFile &&
        !pathSharesDirectory(filePath, anchors)
      ) {
        score -= mode === "generate" ? 24 : 52
      }
      if (mode === "refactor" && /^app\/(?!api\/).+\/page\.(tsx|jsx)$/.test(filePath) && !pathSharesDirectory(filePath, anchors)) {
        score -= 48
      }
      if (filePath === ".env") score -= 100
      if (filePath === "spec.json" || filePath === "region.config.json") score -= 80

      return {
        edit: { ...edit, path: filePath || edit.path },
        filePath,
        exists,
        inSupportScope,
        score,
        index,
      }
    })
    .filter((item) => item.filePath)
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))

  const kept: ModelFileEdit[] = []
  const seen = new Set<string>()
  let newFileCount = 0

  for (const item of ranked) {
    const isDirectContext =
      targetFiles.has(item.filePath) ||
      relatedFiles.has(item.filePath) ||
      openTabs.has(item.filePath) ||
      pathSharesDirectory(item.filePath, anchors)
    const isHintMatched = pathMatchesHintToken(item.filePath, hintTokens)
    if (seen.has(item.filePath)) continue
    if (mode === "fix" && !isDirectContext) continue
    if (mode === "generate" && !isDirectContext && !item.inSupportScope) continue
    if (mode === "refactor" && !isDirectContext && !isHintMatched && !item.inSupportScope) continue
    if (mode === "refactor" && /^app\/(?!api\/).+\.(tsx|ts|jsx|js)$/.test(item.filePath) && !isDirectContext && !isHintMatched) {
      continue
    }
    if (!item.exists) {
      if (!item.inSupportScope) continue
      if (newFileCount >= maxNewFiles) continue
    }
    if (kept.length >= limit) break
    if (item.score < 0 && kept.length > 0) continue
    kept.push(item.edit)
    seen.add(item.filePath)
    if (!item.exists) newFileCount += 1
  }

  if (!kept.length && ranked[0]) {
    kept.push(ranked[0].edit)
    seen.add(ranked[0].filePath)
  }

  return {
    edits: kept,
    droppedPaths: ranked.map((item) => item.filePath).filter((filePath) => !seen.has(filePath)),
  }
}

function inferSymbolsFromContent(content?: string | null): WorkspaceSymbolRef[] {
  const source = String(content ?? "")
  if (!source.trim()) return []
  const lines = source.split(/\r?\n/)
  const out: WorkspaceSymbolRef[] = []
  const seen = new Set<string>()
  const patterns: Array<{ kind: string; re: RegExp }> = [
    { kind: "function", re: /^\s*export\s+default\s+function\s+([A-Za-z0-9_]+)/ },
    { kind: "function", re: /^\s*export\s+function\s+([A-Za-z0-9_]+)/ },
    { kind: "function", re: /^\s*function\s+([A-Za-z0-9_]+)/ },
    { kind: "component", re: /^\s*export\s+const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|<[^>]+>\s*\([^)]*\))\s*=>/ },
    { kind: "component", re: /^\s*const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|<[^>]+>\s*\([^)]*\))\s*=>/ },
    { kind: "class", re: /^\s*export\s+class\s+([A-Za-z0-9_]+)/ },
    { kind: "class", re: /^\s*class\s+([A-Za-z0-9_]+)/ },
  ]

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    for (const pattern of patterns) {
      const match = line.match(pattern.re)
      const name = match?.[1]
      if (!name || seen.has(name)) continue
      seen.add(name)
      out.push({ kind: pattern.kind, name, line: index + 1 })
      break
    }
    if (out.length >= 8) break
  }

  return out
}

function rebuildEditorFocus(
  context: EditorRequestContext,
  region: Region,
  routes: ReturnType<typeof buildCodePlatformContextRoutes>,
  projectSpec?: Awaited<ReturnType<typeof readProjectSpec>> | null
) {
  if (context.sharedSession?.specKind && context.sharedSession.specKind !== "code_platform") {
    const rebuilt = rebuildNonCodePlatformFocus(context, region, projectSpec)
    return {
      ...context,
      currentRoute: context.currentRoute || rebuilt.currentPage.route,
      currentPage: rebuilt.currentPage,
      currentModule: rebuilt.currentModule,
      currentElement: rebuilt.currentElement,
    } satisfies EditorRequestContext
  }

  const blueprintFocus = buildBlueprintWorkspacePageContext(projectSpec, context, region)
  if (shouldUseBlueprintRouteForCodePlatform(blueprintFocus.routeBlueprint, routes)) {
    const currentPage = blueprintFocus.pageContext
    const currentModule: WorkspaceModuleContext =
      blueprintFocus.moduleBlueprint
        ? {
            name: blueprintFocus.moduleBlueprint.label,
            source: "page",
            relatedSymbols: blueprintFocus.moduleBlueprint.capabilityIds.slice(0, 6),
          }
        : inferCodePlatformModuleContext({
            currentFilePath: context.currentFilePath,
            currentFileSymbols: context.currentFileSymbols,
            currentPage,
            activeSymbolName: context.currentModule?.name || context.sharedSession?.symbolName,
          })
    const currentElement: WorkspaceElementContext =
      context.currentElement?.source === "explicit" && context.currentElement.name
        ? {
            ...context.currentElement,
            options: context.currentElement.options.length ? context.currentElement.options : currentPage.elements,
          }
        : {
            name:
              blueprintFocus.entityBlueprint?.label ||
              currentPage.elements[0] ||
              context.sharedSession?.elementName ||
              "Primary surface",
            source: "page",
            options: [
              ...(currentPage.elements ?? []),
              ...(blueprintFocus.entityBlueprint?.primaryViews ?? []),
            ].filter(Boolean).slice(0, 8) as string[],
            detail: blueprintFocus.entityBlueprint?.summary || currentPage.focus,
          }

    return {
      ...context,
      currentRoute: context.currentRoute || currentPage.route,
      currentPage,
      currentModule,
      currentElement,
    } satisfies EditorRequestContext
  }

  const currentPage = resolveWorkspacePageContext({
    routes,
    region,
    context,
    specKind: context.sharedSession?.specKind,
  })

  const symbolCandidate = [
    context.currentModule?.name,
    context.sharedSession?.symbolName,
  ].find((value) =>
    value
      ? (context.currentFileSymbols ?? []).some((item) => item.name === value)
      : false
  )

  const currentModule = inferCodePlatformModuleContext({
    currentFilePath: context.currentFilePath,
    currentFileSymbols: context.currentFileSymbols,
    currentPage,
    activeSymbolName: symbolCandidate,
  })

  const elementCandidate =
    (context.currentElement?.name && currentPage.elements.includes(context.currentElement.name)
      ? context.currentElement.name
      : undefined) ||
    (context.sharedSession?.elementName && currentPage.elements.includes(context.sharedSession.elementName)
      ? context.sharedSession.elementName
      : undefined)

  const currentElement = inferCodePlatformElementContext({
    currentPage,
    activeElementName: elementCandidate,
    previewTab: context.sharedSession?.workspaceSurface,
    editorRailLabel: context.currentElement?.source === "editor_rail" ? context.currentElement.name : undefined,
    editorBottomTabLabel: context.currentElement?.source === "output_panel" ? context.currentElement.name : undefined,
  })

  return {
    ...context,
    currentRoute: context.currentRoute || currentPage.route,
    currentPage,
    currentModule,
    currentElement: {
      ...currentElement,
      options: currentElement.options.length ? currentElement.options : currentPage.elements,
    },
  } satisfies EditorRequestContext
}

function buildExplainFallback(prompt: string, context: EditorRequestContext, region: Region): ModelOutput {
  const filePath = normalizeContextPath(context.currentFilePath)
  const symbols = Array.isArray(context.currentFileSymbols) ? context.currentFileSymbols : []
  const focusedLine =
    typeof context.focusedLine === "number" && Number.isFinite(context.focusedLine) && context.focusedLine > 0
      ? context.focusedLine
      : null
  const route = String(context.currentRoute ?? "").trim()
  const pageLabel = context.currentPage?.label || ""
  const pageFocus = context.currentPage?.focus || ""
  const moduleName = context.currentModule?.name || ""
  const elementName = context.currentElement?.name || ""
  const sessionSurface = context.sharedSession?.workspaceSurface || ""
  const sessionSection = context.sharedSession?.activeSection || ""
  const planLabel = context.sharedSession?.selectedPlanName || context.sharedSession?.selectedPlanId || ""
  const exportPolicy =
    context.sharedSession?.codeExportLevel
      ? context.sharedSession.codeExportLevel === "full"
        ? region === "cn"
          ? "当前套餐开放完整代码导出。"
          : "The current plan unlocks full code export."
        : context.sharedSession.codeExportLevel === "manifest"
          ? region === "cn"
            ? "当前套餐开放代码清单导出。"
            : "The current plan unlocks manifest export."
          : region === "cn"
            ? "当前套餐仍锁定代码导出。"
            : "The current plan still keeps code export locked."
      : typeof context.sharedSession?.codeExportAllowed === "boolean"
        ? context.sharedSession.codeExportAllowed
          ? region === "cn"
            ? "当前套餐允许代码导出。"
            : "The current plan allows code export."
          : region === "cn"
            ? "当前套餐仍锁定代码导出。"
            : "The current plan still keeps code export locked."
        : ""
  const generationProfile =
    context.sharedSession?.generationProfile
      ? region === "cn"
        ? `生成档位：${context.sharedSession.generationProfile}`
        : `Generation profile: ${context.sharedSession.generationProfile}`
      : ""
  const databaseMode = context.sharedSession?.databaseAccessMode || ""
  const summary = filePath
    ? region === "cn"
      ? `已解释当前文件 ${filePath} 的职责与修改方向。`
      : `Explained the current file ${filePath} and the best next changes.`
    : region === "cn"
      ? "已解释当前页面/模块的职责与修改方向。"
      : "Explained the current page/module and the best next changes."

  const analysisLines = [
    filePath
      ? region === "cn"
        ? `当前文件：${filePath}`
        : `Current file: ${filePath}`
      : region === "cn"
        ? "当前文件：未提供，已回退为页面级解释。"
        : "Current file: not provided, so the explanation falls back to page level.",
    route
      ? region === "cn"
        ? `当前路由：${route}`
        : `Current route: ${route}`
      : "",
    pageLabel
      ? region === "cn"
        ? `当前页面：${pageLabel}`
        : `Current page: ${pageLabel}`
      : "",
    pageFocus
      ? region === "cn"
        ? `页面焦点：${pageFocus}`
        : `Page focus: ${pageFocus}`
      : "",
    moduleName
      ? region === "cn"
        ? `当前模块：${moduleName}`
        : `Current module: ${moduleName}`
      : "",
    elementName
      ? region === "cn"
        ? `当前元素：${elementName}`
        : `Current element: ${elementName}`
      : "",
    sessionSurface || sessionSection
      ? region === "cn"
        ? `工作区会话：${[sessionSurface, sessionSection].filter(Boolean).join(" / ")}`
        : `Workspace session: ${[sessionSurface, sessionSection].filter(Boolean).join(" / ")}`
      : "",
    planLabel
      ? region === "cn"
        ? `当前套餐：${planLabel}`
        : `Current plan: ${planLabel}`
      : "",
    exportPolicy,
    generationProfile,
    databaseMode
      ? region === "cn"
        ? `数据库模式：${databaseMode}`
        : `Database mode: ${databaseMode}`
      : "",
    focusedLine
      ? region === "cn"
        ? `当前焦点行：第 ${focusedLine} 行`
        : `Focused line: ${focusedLine}`
      : "",
    symbols.length
      ? region === "cn"
        ? `当前文件识别到 ${symbols.length} 个符号，可优先围绕这些结构解释与拆分。`
        : `Detected ${symbols.length} symbols in the current file, which are good anchors for explanation and refactoring.`
      : region === "cn"
        ? "当前文件没有识别到显式符号，说明它可能更偏页面布局或配置入口。"
        : "No explicit symbols were detected, which usually means this file is more layout- or config-oriented.",
    region === "cn"
      ? `用户当前意图：${prompt}`
      : `Current user intent: ${prompt}`,
    region === "cn"
      ? "下一步建议：如果你想要我继续改代码，请切换到 fix / generate / refactor 任一模式，我会基于当前文件继续执行。"
      : "Suggested next step: switch to fix, generate, or refactor to keep working directly against this file.",
  ].filter(Boolean)

  return {
    summary,
    analysis: analysisLines.join("\n"),
    reasoning: analysisLines.join("\n"),
    files: [],
  }
}

function shouldPreferLocalFallback(prompt: string, mode: IterateMode, context: EditorRequestContext) {
  if (mode === "explain") return false
  if (!context.currentFilePath && !context.currentPage?.filePath) return false
  return (
    Boolean(extractTargetTitle(prompt)) ||
    isChineseUiRequest(prompt) ||
    isDescriptionFieldRequest(prompt) ||
    isBlockedColumnRequest(prompt) ||
    isAssigneeFilterRequest(prompt) ||
    isAboutPageRequest(prompt) ||
    /(?:status note|health status|api health|header note|note near .*header|missing status labeling|copy issue|copy tweak|文案|标题附近.*说明|健康状态|状态说明)/i.test(prompt)
  )
}

async function resolveEditorContext(
  projectDir: string,
  projectId: string,
  projectSlug: string | undefined,
  body: any,
  region: Region
): Promise<EditorRequestContext> {
  const projectSpec = await readProjectSpec(projectDir)
  const specRegion = projectSpec?.region === "cn" ? "cn" : region
  const incomingSession = normalizeSessionContext(body?.sharedSession, specRegion)
  let currentFileSymbols = normalizeContextSymbols(body?.currentFileSymbols)
  const requestedFilePath =
    normalizeContextPath(body?.currentFilePath) ||
    normalizeContextPath(incomingSession?.lastChangedFile) ||
    normalizeContextPath(incomingSession?.filePath)
  if (!currentFileSymbols.length && requestedFilePath) {
    const candidateContent =
      typeof body?.currentFileContent === "string"
        ? body.currentFileContent
        : await fs.readFile(path.join(projectDir, requestedFilePath), "utf8").catch(() => "")
    currentFileSymbols = inferSymbolsFromContent(candidateContent)
  }
  const context: EditorRequestContext = {
    currentFilePath: requestedFilePath,
    currentFileContent: typeof body?.currentFileContent === "string" ? body.currentFileContent : undefined,
    currentFileSymbols,
    focusedLine: typeof body?.focusedLine === "number" ? body.focusedLine : undefined,
    currentRoute:
      typeof body?.currentRoute === "string"
        ? body.currentRoute
        : inferRouteFromFilePath(requestedFilePath) || undefined,
    relatedPaths: Array.isArray(body?.relatedPaths) ? body.relatedPaths.map((item: unknown) => String(item)) : undefined,
    openTabs: Array.isArray(body?.openTabs) ? body.openTabs.map((item: unknown) => String(item)) : undefined,
  }

  const routes = buildCodePlatformContextRoutes({
    region: specRegion,
    features: Array.isArray(projectSpec?.features) ? projectSpec.features.filter((item) => typeof item === "string") : [],
  })
  const resolvedSpecKind =
    normalizeTextValue(projectSpec?.kind) ||
    incomingSession?.specKind ||
    normalizeTextValue(body?.sharedSession?.specKind) ||
    undefined
  const explicitPage = normalizePageContext(body?.currentPage)

  const currentPage = resolveWorkspacePageContext({
    routes,
    region: specRegion,
    context: {
      ...context,
      sharedSession: {
        ...incomingSession,
        specKind: resolvedSpecKind || incomingSession?.specKind,
      },
      currentPage: explicitPage,
    },
    explicitPage,
    specKind: resolvedSpecKind,
  })

  const earlyBlueprintFocus =
    resolvedSpecKind === "code_platform" ? buildBlueprintWorkspacePageContext(projectSpec, context, specRegion) : null
  const shouldUseCodeBlueprint =
    resolvedSpecKind === "code_platform" &&
    shouldUseBlueprintRouteForCodePlatform(earlyBlueprintFocus?.routeBlueprint ?? null, routes)
  const codePlatformPage = shouldUseCodeBlueprint ? earlyBlueprintFocus?.pageContext ?? currentPage : currentPage

  const currentModule =
    normalizeModuleContext(body?.currentModule) ??
    (shouldUseCodeBlueprint && earlyBlueprintFocus?.moduleBlueprint
      ? {
          name: earlyBlueprintFocus.moduleBlueprint.label,
          source: "page" as const,
          relatedSymbols: earlyBlueprintFocus.moduleBlueprint.capabilityIds.slice(0, 6),
        }
      : inferCodePlatformModuleContext({
          currentFilePath: context.currentFilePath,
          currentFileSymbols,
          currentPage: codePlatformPage,
          activeSymbolName: normalizeTextValue(body?.currentModule?.name) || incomingSession?.symbolName,
        }))

  const currentElement =
    normalizeElementContext(body?.currentElement) ??
    (shouldUseCodeBlueprint
      ? {
          name:
            earlyBlueprintFocus?.entityBlueprint?.label ||
            codePlatformPage.elements[0] ||
            normalizeTextValue(body?.currentElement?.name) ||
            incomingSession?.elementName ||
            "Primary surface",
          source: "page" as const,
          options: [
            ...(codePlatformPage.elements ?? []),
            ...(earlyBlueprintFocus?.entityBlueprint?.primaryViews ?? []),
          ].filter(Boolean).slice(0, 8) as string[],
          detail: earlyBlueprintFocus?.entityBlueprint?.summary || codePlatformPage.focus,
        }
      : inferCodePlatformElementContext({
          currentPage: codePlatformPage,
          activeElementName: normalizeTextValue(body?.currentElement?.name) || incomingSession?.elementName,
          previewTab: incomingSession?.workspaceSurface,
        }))

  const initialFocus =
    resolvedSpecKind && resolvedSpecKind !== "code_platform"
      ? rebuildNonCodePlatformFocus(
          {
            ...context,
            currentPage,
            currentModule,
            currentElement,
            sharedSession: {
              ...incomingSession,
              specKind: resolvedSpecKind,
            },
          },
          specRegion,
          projectSpec
        )
      : {
          currentPage: codePlatformPage,
          currentModule,
          currentElement: {
            ...currentElement,
            options: currentElement.options.length ? currentElement.options : codePlatformPage.elements,
          },
        }

  const matchedRouteBlueprint = findBlueprintRouteForContext(projectSpec, {
    ...context,
    currentPage: initialFocus.currentPage,
    currentModule: initialFocus.currentModule,
    currentElement: initialFocus.currentElement,
    sharedSession: incomingSession,
  })
  const matchedModuleBlueprint = findBlueprintModuleForContext(projectSpec, {
    ...context,
    currentPage: initialFocus.currentPage,
    currentModule: initialFocus.currentModule,
    currentElement: initialFocus.currentElement,
    sharedSession: incomingSession,
  }, matchedRouteBlueprint)
  const matchedEntityBlueprint = findBlueprintEntityForContext(projectSpec, {
    ...context,
    currentPage: initialFocus.currentPage,
    currentModule: initialFocus.currentModule,
    currentElement: initialFocus.currentElement,
    sharedSession: incomingSession,
  }, matchedRouteBlueprint)

  const planTier = normalizePlanTier(projectSpec?.planTier)
  const planPolicy = getPlanPolicy(planTier)
  const sessionDefaults = {
    projectName: normalizeTextValue(projectSpec?.title) || undefined,
    specKind: resolvedSpecKind,
    appArchetype: normalizeTextValue(projectSpec?.appIdentity?.category || projectSpec?.appIntent?.archetype) || undefined,
    appCategory: normalizeTextValue(projectSpec?.appIntent?.productCategory || projectSpec?.appIdentity?.archetypeLabel) || undefined,
    appSummary: normalizeTextValue(projectSpec?.appIdentity?.shortDescription) || undefined,
    primaryWorkflow: normalizeTextValue(projectSpec?.appIntent?.primaryWorkflow) || undefined,
    visualTone: normalizeTextValue(projectSpec?.visualSeed?.tone) || undefined,
    routeBlueprintSummary: Array.isArray(projectSpec?.routeBlueprint)
      ? projectSpec.routeBlueprint
          .slice(0, 8)
          .map((item) => normalizeTextValue(`${item.label} (${item.path})`))
          .filter(Boolean)
      : undefined,
    moduleBlueprintSummary: Array.isArray(projectSpec?.moduleBlueprint)
      ? projectSpec.moduleBlueprint
          .slice(0, 10)
          .map((item) => normalizeTextValue(item.label))
          .filter(Boolean)
      : undefined,
    entityBlueprintSummary: Array.isArray(projectSpec?.entityBlueprint)
      ? projectSpec.entityBlueprint
          .slice(0, 10)
          .map((item) => normalizeTextValue(item.label))
          .filter(Boolean)
      : undefined,
    activeRoutePurpose: normalizeTextValue(matchedRouteBlueprint?.purpose) || undefined,
    activeModuleSummary: normalizeTextValue(matchedModuleBlueprint?.summary) || undefined,
    activeEntitySummary: normalizeTextValue(matchedEntityBlueprint?.summary) || undefined,
    workspaceSurface: normalizeTextValue(body?.sharedSession?.workspaceSurface) || undefined,
    activeSection: normalizeTextValue(body?.sharedSession?.activeSection) || initialFocus.currentPage.id,
    routeId: initialFocus.currentPage.id,
    routeLabel: initialFocus.currentPage.label,
    filePath: context.currentFilePath || initialFocus.currentPage.filePath,
    symbolName: initialFocus.currentModule.name,
    elementName: initialFocus.currentElement.name,
    deploymentTarget: normalizeTextValue(projectSpec?.deploymentTarget) || undefined,
    databaseTarget: normalizeTextValue(projectSpec?.databaseTarget) || undefined,
    region: specRegion,
    selectedPlanId: planTier,
    selectedPlanName: getPlanDefinition(planTier)[specRegion === "cn" ? "nameCn" : "nameEn"],
    selectedTemplate: normalizeTextValue(body?.sharedSession?.selectedTemplate) || undefined,
    codeExportAllowed: planPolicy.codeExportLevel !== "none",
    codeExportLevel: planPolicy.codeExportLevel,
    databaseAccessMode: planPolicy.databaseAccessMode,
    generationProfile: planPolicy.generationProfile,
    routeBudget: planPolicy.maxGeneratedRoutes,
    moduleBudget: planPolicy.maxGeneratedModules,
    projectLimit: planPolicy.projectLimit,
    collaboratorLimit: planPolicy.collaboratorLimit,
    subdomainSlots: planPolicy.subdomainSlots,
    assignedDomain: buildAssignedAppUrl({
      projectSlug: projectSlug || projectId,
      projectId,
      region: specRegion,
      planTier,
    }),
    workspaceStatus: normalizeTextValue(body?.sharedSession?.workspaceStatus) || undefined,
    lastIntent: normalizeTextValue(body?.prompt) || undefined,
    lastChangedFile: context.currentFilePath || initialFocus.currentPage.filePath,
    readiness: "context_ready",
  } satisfies WorkspaceSessionContext

  const sharedSession = {
    ...sessionDefaults,
    ...incomingSession,
    specKind: incomingSession?.specKind || sessionDefaults.specKind,
    appArchetype: incomingSession?.appArchetype || sessionDefaults.appArchetype,
    appCategory: incomingSession?.appCategory || sessionDefaults.appCategory,
    appSummary: incomingSession?.appSummary || sessionDefaults.appSummary,
    primaryWorkflow: incomingSession?.primaryWorkflow || sessionDefaults.primaryWorkflow,
    visualTone: incomingSession?.visualTone || sessionDefaults.visualTone,
    routeBlueprintSummary:
      incomingSession?.routeBlueprintSummary?.length
        ? incomingSession.routeBlueprintSummary
        : sessionDefaults.routeBlueprintSummary,
    moduleBlueprintSummary:
      incomingSession?.moduleBlueprintSummary?.length
        ? incomingSession.moduleBlueprintSummary
        : sessionDefaults.moduleBlueprintSummary,
    entityBlueprintSummary:
      incomingSession?.entityBlueprintSummary?.length
        ? incomingSession.entityBlueprintSummary
        : sessionDefaults.entityBlueprintSummary,
    activeRoutePurpose: incomingSession?.activeRoutePurpose || sessionDefaults.activeRoutePurpose,
    activeModuleSummary: incomingSession?.activeModuleSummary || sessionDefaults.activeModuleSummary,
    activeEntitySummary: incomingSession?.activeEntitySummary || sessionDefaults.activeEntitySummary,
    routeId: incomingSession?.routeId || sessionDefaults.routeId,
    routeLabel: incomingSession?.routeLabel || sessionDefaults.routeLabel,
    filePath: incomingSession?.filePath || sessionDefaults.filePath,
    symbolName: incomingSession?.symbolName || sessionDefaults.symbolName,
    elementName: incomingSession?.elementName || sessionDefaults.elementName,
  } satisfies WorkspaceSessionContext

  context.sharedSession = buildResolvedSessionContext({
    session: sharedSession,
    context: {
      ...context,
      currentPage: initialFocus.currentPage,
      currentModule: initialFocus.currentModule,
      currentElement: initialFocus.currentElement,
      sharedSession,
    },
    mode: normalizeIterateMode(body?.mode),
    prompt: typeof body?.prompt === "string" ? body.prompt : "",
    now: new Date().toISOString(),
  })

  const resolvedContext = rebuildEditorFocus(
    {
      ...context,
      currentPage: initialFocus.currentPage,
      currentModule: initialFocus.currentModule,
      currentElement: initialFocus.currentElement,
      sharedSession: context.sharedSession,
      openTabs: uniqueContextPaths(context.openTabs ?? []),
      relatedPaths: uniqueContextPaths([
        context.currentFilePath,
        initialFocus.currentPage.filePath,
        ...(context.relatedPaths ?? []),
        ...(context.openTabs ?? []),
      ]),
    },
    specRegion,
    routes,
    projectSpec
  )

  return {
    ...resolvedContext,
    ...context,
    currentRoute: resolvedContext.currentRoute,
    currentPage: resolvedContext.currentPage,
    currentModule: resolvedContext.currentModule,
    currentElement: resolvedContext.currentElement,
    sharedSession: resolvedContext.sharedSession,
    openTabs: resolvedContext.openTabs,
    relatedPaths: resolvedContext.relatedPaths,
  }
}

function serializeEditorContext(context: EditorRequestContext): IterateResolvedContext {
  return {
    currentFilePath: context.currentFilePath || undefined,
    currentRoute: context.currentRoute || undefined,
    focusedLine: typeof context.focusedLine === "number" ? context.focusedLine : undefined,
    currentFileSymbols: context.currentFileSymbols?.length ? context.currentFileSymbols : undefined,
    currentPage: context.currentPage,
    currentModule: context.currentModule,
    currentElement: context.currentElement,
    sharedSession: context.sharedSession,
    openTabs: context.openTabs?.length ? context.openTabs : undefined,
    relatedPaths: context.relatedPaths?.length ? context.relatedPaths : undefined,
  }
}

function extractJsonObject(raw: string) {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)
  const payload = fenced?.[1] ?? raw
  const start = payload.indexOf("{")
  const end = payload.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response is not valid JSON")
  }
  return payload.slice(start, end + 1)
}

function sanitizeJsonText(input: string) {
  return input
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
}

function normalizeModelFileEdit(rawEdit: any): ModelFileEdit | null {
  const pathValue = String(rawEdit?.path ?? rawEdit?.filePath ?? "").trim()
  if (!pathValue) return null

  const content =
    typeof rawEdit?.content === "string"
      ? rawEdit.content
      : typeof rawEdit?.nextContent === "string"
        ? rawEdit.nextContent
        : undefined

  const find =
    typeof rawEdit?.find === "string"
      ? rawEdit.find
      : typeof rawEdit?.search === "string"
        ? rawEdit.search
        : typeof rawEdit?.findText === "string"
          ? rawEdit.findText
          : undefined

  const replaceWith =
    typeof rawEdit?.replaceWith === "string"
      ? rawEdit.replaceWith
      : typeof rawEdit?.replace === "string"
        ? rawEdit.replace
        : typeof rawEdit?.replacement === "string"
          ? rawEdit.replacement
          : undefined

  const anchor =
    typeof rawEdit?.anchor === "string"
      ? rawEdit.anchor
      : typeof rawEdit?.anchorText === "string"
        ? rawEdit.anchorText
        : undefined

  const op =
    normalizeModelEditOperation(rawEdit?.op ?? rawEdit?.operation ?? rawEdit?.type) ??
    (find ? "replace_once" : content !== undefined ? "replace_file" : undefined)

  return {
    path: pathValue,
    op,
    content,
    find,
    replaceWith,
    anchor,
    reason: typeof rawEdit?.reason === "string" ? rawEdit.reason : undefined,
  }
}

function parseModelOutput(rawContent: string) {
  const candidate = extractJsonObject(rawContent)
  try {
    const parsed = JSON.parse(candidate) as ModelOutput
    parsed.files = Array.isArray(parsed.files) ? parsed.files.map(normalizeModelFileEdit).filter(Boolean) as ModelFileEdit[] : []
    return parsed
  } catch {
    const sanitized = sanitizeJsonText(candidate)
    const parsed = JSON.parse(sanitized) as ModelOutput
    parsed.files = Array.isArray(parsed.files) ? parsed.files.map(normalizeModelFileEdit).filter(Boolean) as ModelFileEdit[] : []
    return parsed
  }
}

function trimText(input: string, maxLen = 1800) {
  const text = String(input ?? "")
  if (text.length <= maxLen) return text
  return `...${text.slice(text.length - maxLen)}`
}

function getTextLineCount(content: string | null) {
  if (content === null) return 0
  if (!content.length) return 0
  return content.split(/\r?\n/).length
}

function buildAppliedEditSummary(args: {
  path: string
  operation: AppliedEditSummary["operation"]
  reason?: string
  existedBefore: boolean
  beforeContent: string | null
  afterContent: string | null
}): AppliedEditSummary {
  const { path, operation, reason, existedBefore, beforeContent, afterContent } = args
  const beforeText = beforeContent ?? ""
  const afterText = afterContent ?? ""
  return {
    path,
    operation,
    reason,
    existedBefore,
    linesBefore: getTextLineCount(beforeContent),
    linesAfter: getTextLineCount(afterContent),
    lineDelta: getTextLineCount(afterContent) - getTextLineCount(beforeContent),
    bytesBefore: Buffer.byteLength(beforeText, "utf8"),
    bytesAfter: Buffer.byteLength(afterText, "utf8"),
  }
}

function applyInstructionalEdit(args: {
  edit: ModelFileEdit
  relativePath: string
  previousContent: string | null
  exists: boolean
}): { nextContent: string | null; operation: AppliedEditSummary["operation"] } {
  const { edit, relativePath, previousContent, exists } = args
  const op = edit.op ?? (edit.content !== undefined ? "replace_file" : undefined)
  const source = previousContent ?? ""

  if (!op) {
    throw new Error(`Edit for ${relativePath} is missing an operation and full file content.`)
  }

  if (op === "delete_file") {
    return { nextContent: null, operation: "deleted" }
  }

  if (op === "create_file" || op === "replace_file") {
    if (typeof edit.content !== "string") {
      throw new Error(`Edit for ${relativePath} requires content for ${op}.`)
    }
    return {
      nextContent: edit.content,
      operation: exists ? "updated" : "created",
    }
  }

  if (!exists && previousContent === null) {
    throw new Error(`Patch-style edit for ${relativePath} requires an existing file.`)
  }

  if (op === "replace_once" || op === "replace_all") {
    if (typeof edit.find !== "string") {
      throw new Error(`Edit for ${relativePath} requires find text for ${op}.`)
    }
    if (!source.includes(edit.find)) {
      throw new Error(`Could not locate target text in ${relativePath} for ${op}.`)
    }
    const replacement = typeof edit.replaceWith === "string" ? edit.replaceWith : ""
    const nextContent =
      op === "replace_all" ? source.split(edit.find).join(replacement) : source.replace(edit.find, replacement)
    return { nextContent, operation: "patched" }
  }

  if (op === "insert_before" || op === "insert_after") {
    if (typeof edit.anchor !== "string") {
      throw new Error(`Edit for ${relativePath} requires an anchor for ${op}.`)
    }
    if (typeof edit.content !== "string") {
      throw new Error(`Edit for ${relativePath} requires content for ${op}.`)
    }
    if (!source.includes(edit.anchor)) {
      throw new Error(`Could not locate anchor text in ${relativePath} for ${op}.`)
    }
    const insertion = op === "insert_before" ? `${edit.content}${edit.anchor}` : `${edit.anchor}${edit.content}`
    return {
      nextContent: source.replace(edit.anchor, insertion),
      operation: "patched",
    }
  }

  throw new Error(`Unsupported edit operation for ${relativePath}: ${op}`)
}

async function readStreamToModelOutput(res: Response): Promise<{ content: string; reasoning: string }> {
  if (!res.body) {
    throw new Error("Empty stream body from model")
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""
  let content = ""
  let reasoning = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""

    for (const evt of events) {
      const lines = evt
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
      for (const line of lines) {
        const payload = line.slice(5).trim()
        if (!payload || payload === "[DONE]") continue

        let parsed: any
        try {
          parsed = JSON.parse(payload)
        } catch {
          continue
        }
        const delta = parsed?.choices?.[0]?.delta ?? {}
        if (typeof delta.reasoning_content === "string") reasoning += delta.reasoning_content
        if (typeof delta.content === "string") content += delta.content
      }
    }
  }

  return { content: content.trim(), reasoning: reasoning.trim() }
}

async function callEditorModel(
  projectDir: string,
  prompt: string,
  region: Region,
  context: EditorRequestContext,
  body: any,
  mode: IterateMode,
  workflowMode: IterateWorkflowMode
): Promise<ModelOutput> {
  const config = resolveAiConfig({
    apiKey: String(body?.apiKey ?? "").trim() || undefined,
    baseUrl: String(body?.baseUrl ?? "").trim() || undefined,
    model: String(body?.model ?? "").trim() || undefined,
    enableThinking: typeof body?.enableThinking === "boolean" ? body.enableThinking : undefined,
    mode: "fixer",
  })

  const allFiles = prioritizeContextFiles(await collectContextFiles(projectDir), context)
  const targetStrategy = buildIterateTargetStrategy(allFiles, context, mode)
  const files = targetStrategy.snapshotFiles
  const snapshotLimit = mode === "explain" ? 8 : mode === "fix" ? 8 : mode === "refactor" ? 10 : 12
  const snapshotChars = mode === "explain" ? 5000 : mode === "fix" ? 6000 : 7000
  const snapshots: string[] = []
  for (const relativePath of files.slice(0, snapshotLimit)) {
    const fullPath = path.join(projectDir, relativePath)
    const content =
      context.currentFilePath === relativePath && typeof context.currentFileContent === "string"
        ? context.currentFileContent
        : await fs.readFile(fullPath, "utf8")
    snapshots.push(
      `FILE: ${relativePath}\n` +
        "```text\n" +
        `${content.slice(0, snapshotChars)}\n` +
        "```\n"
    )
  }

  const system = [
    "You are a code editor for an existing Next.js workspace.",
    "Return strict JSON only with this schema:",
    '{"summary":"...","analysis":"","files":[{"path":"relative/path","op":"replace_file|create_file|delete_file|replace_once|replace_all|insert_before|insert_after","content":"full file content or inserted text","find":"target text for replace_*","replaceWith":"replacement text for replace_*","anchor":"anchor text for insert_*","reason":"..."}]}',
    "Rules:",
    "- Use relative paths only.",
    "- Do not modify node_modules, .next, or .git.",
    "- Keep changes minimal and executable.",
    "- Prefer patch-style edits (replace_once, replace_all, insert_before, insert_after) for small local changes in the current file or nearby module.",
    "- Use replace_file/create_file only when a patch-style edit would be too brittle or when a new file is required.",
    "- Always anchor your reasoning in the provided current file/page/module context when it exists.",
    "- If the requested mode is explain, prefer returning analysis with an empty files array unless the user explicitly asks for code edits.",
    "- If workflow mode is act, directly implement the requested product change instead of turning the response into a discussion-only answer.",
    "- If workflow mode is edit_context, keep the edit set tightly scoped to the current file, current page, current module, and neighboring support files.",
    "- Respect the primary target scope. If you must edit a file outside it, keep that expansion minimal and justified by the request.",
    "- Respect current plan/resource constraints. If export is locked or database usage is online-only, keep that gating explicit instead of pretending those capabilities are already live.",
  ].join("\n")

  const workflowDirective =
    workflowMode === "act"
      ? region === "cn"
        ? "当前 workflow mode：act。请直接落代码并优先补成能运行的工作流，不要把回答停留在讨论层。"
        : "Workflow mode: act. Apply the change directly and prefer a runnable workflow over a discussion-only response."
      : region === "cn"
        ? "当前 workflow mode：edit_context。请把改动收敛在当前文件、当前页面、当前模块和直接支持文件附近。"
        : "Workflow mode: edit_context. Keep the edit scope anchored to the current file, page, module, and directly supporting files."

  const modeDirective =
    mode === "explain"
      ? region === "cn"
        ? "当前模式：explain。请重点解释当前文件、当前页面、当前模块的职责、依赖边界、风险点和下一步修改建议；除非用户明确要求改代码，否则 files 返回空数组。"
        : "Mode: explain. Focus on explaining the current file, page, and module responsibilities, boundaries, risks, and the best next changes. Unless the user explicitly asks for edits, return an empty files array."
      : mode === "fix"
        ? region === "cn"
          ? "当前模式：fix。请优先修复当前文件和当前页面相关的问题，避免大面积重写整个项目。"
          : "Mode: fix. Prioritize repairs tied to the current file and current page instead of rewriting the whole project."
        : mode === "refactor"
          ? region === "cn"
            ? "当前模式：refactor。请围绕当前文件和相关模块重构结构、拆分边界、提升可维护性。"
            : "Mode: refactor. Refactor around the current file and related modules to improve structure and maintainability."
          : region === "cn"
            ? "当前模式：generate。请基于当前文件和页面继续补能力，而不是回到全局空泛修改。"
            : "Mode: generate. Extend capability from the current file and page context instead of drifting back into global edits."

  const currentPageMeta = context.currentPage
    ? [
        `Current page: ${context.currentPage.label} (${context.currentPage.id})`,
        `Page route: ${context.currentPage.route}`,
        context.currentPage.filePath ? `Page file: ${context.currentPage.filePath}` : "",
        context.currentPage.focus ? `Page focus: ${context.currentPage.focus}` : "",
        context.currentPage.elements.length ? `Page elements: ${context.currentPage.elements.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Current page context: not provided"

  const currentModuleMeta = context.currentModule
    ? [
        `Current module: ${context.currentModule.name}`,
        `Module source: ${context.currentModule.source}`,
        context.currentModule.relatedSymbols.length
          ? `Module symbols: ${context.currentModule.relatedSymbols.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Current module context: not provided"

  const currentElementMeta = context.currentElement
    ? [
        `Current element: ${context.currentElement.name}`,
        `Element source: ${context.currentElement.source}`,
        context.currentElement.detail ? `Element detail: ${context.currentElement.detail}` : "",
        context.currentElement.options.length ? `Available elements: ${context.currentElement.options.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Current element context: not provided"

  const sharedSessionMeta = context.sharedSession
    ? [
        context.sharedSession.projectName ? `Project name: ${context.sharedSession.projectName}` : "",
        context.sharedSession.specKind ? `Workspace kind: ${context.sharedSession.specKind}` : "",
        context.sharedSession.appArchetype ? `App archetype: ${context.sharedSession.appArchetype}` : "",
        context.sharedSession.appCategory ? `App category: ${context.sharedSession.appCategory}` : "",
        context.sharedSession.appSummary ? `App summary: ${context.sharedSession.appSummary}` : "",
        context.sharedSession.primaryWorkflow ? `Primary workflow: ${context.sharedSession.primaryWorkflow}` : "",
        context.sharedSession.visualTone ? `Visual tone: ${context.sharedSession.visualTone}` : "",
        context.sharedSession.routeBlueprintSummary?.length
          ? `Route blueprints: ${context.sharedSession.routeBlueprintSummary.join(", ")}`
          : "",
        context.sharedSession.activeRoutePurpose ? `Active route purpose: ${context.sharedSession.activeRoutePurpose}` : "",
        context.sharedSession.moduleBlueprintSummary?.length
          ? `Module blueprints: ${context.sharedSession.moduleBlueprintSummary.join(", ")}`
          : "",
        context.sharedSession.activeModuleSummary ? `Active module summary: ${context.sharedSession.activeModuleSummary}` : "",
        context.sharedSession.entityBlueprintSummary?.length
          ? `Entity blueprints: ${context.sharedSession.entityBlueprintSummary.join(", ")}`
          : "",
        context.sharedSession.activeEntitySummary ? `Active entity summary: ${context.sharedSession.activeEntitySummary}` : "",
        context.sharedSession.workspaceSurface ? `Workspace surface: ${context.sharedSession.workspaceSurface}` : "",
        context.sharedSession.activeSection ? `Active section: ${context.sharedSession.activeSection}` : "",
        context.sharedSession.routeId ? `Route id: ${context.sharedSession.routeId}` : "",
        context.sharedSession.routeLabel ? `Route label: ${context.sharedSession.routeLabel}` : "",
        context.sharedSession.filePath ? `Session file: ${context.sharedSession.filePath}` : "",
        context.sharedSession.symbolName ? `Session symbol: ${context.sharedSession.symbolName}` : "",
        context.sharedSession.elementName ? `Session element: ${context.sharedSession.elementName}` : "",
        context.sharedSession.selectedTemplate ? `Selected template: ${context.sharedSession.selectedTemplate}` : "",
        context.sharedSession.selectedPlanId ? `Selected plan id: ${context.sharedSession.selectedPlanId}` : "",
        context.sharedSession.selectedPlanName ? `Selected plan name: ${context.sharedSession.selectedPlanName}` : "",
        typeof context.sharedSession.codeExportAllowed === "boolean" ? `Code export allowed: ${context.sharedSession.codeExportAllowed ? "yes" : "no"}` : "",
        context.sharedSession.codeExportLevel ? `Code export level: ${context.sharedSession.codeExportLevel}` : "",
        context.sharedSession.databaseAccessMode ? `Database access mode: ${context.sharedSession.databaseAccessMode}` : "",
        context.sharedSession.generationProfile ? `Generation profile: ${context.sharedSession.generationProfile}` : "",
        context.sharedSession.routeBudget ? `Route budget: ${context.sharedSession.routeBudget}` : "",
        context.sharedSession.moduleBudget ? `Module budget: ${context.sharedSession.moduleBudget}` : "",
        context.sharedSession.projectLimit ? `Project limit: ${context.sharedSession.projectLimit}` : "",
        context.sharedSession.collaboratorLimit ? `Collaborator limit: ${context.sharedSession.collaboratorLimit}` : "",
        context.sharedSession.subdomainSlots ? `Subdomain slots: ${context.sharedSession.subdomainSlots}` : "",
        context.sharedSession.assignedDomain ? `Assigned domain: ${context.sharedSession.assignedDomain}` : "",
        context.sharedSession.deploymentTarget ? `Deployment target: ${context.sharedSession.deploymentTarget}` : "",
        context.sharedSession.databaseTarget ? `Database target: ${context.sharedSession.databaseTarget}` : "",
        context.sharedSession.workspaceStatus ? `Workspace status: ${context.sharedSession.workspaceStatus}` : "",
        context.sharedSession.lastIntent ? `Last intent: ${context.sharedSession.lastIntent}` : "",
        context.sharedSession.lastAction ? `Last action: ${context.sharedSession.lastAction}` : "",
        context.sharedSession.lastChangedFile ? `Last changed file: ${context.sharedSession.lastChangedFile}` : "",
        context.sharedSession.readiness ? `Session readiness: ${context.sharedSession.readiness}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Shared workspace session: not provided"

  const currentFileMeta = context.currentFilePath
    ? [
        `Current file: ${context.currentFilePath}`,
        context.currentRoute ? `Current route: ${context.currentRoute}` : "",
        typeof context.focusedLine === "number" ? `Focused line: ${context.focusedLine}` : "",
        context.currentFileSymbols?.length
          ? `Current symbols: ${context.currentFileSymbols.map((item) => `${item.kind}:${item.name}@${item.line}`).join(", ")}`
          : "Current symbols: none detected",
        typeof context.currentFileContent === "string"
          ? `Current unsaved draft for ${context.currentFilePath}:\n\`\`\`text\n${context.currentFileContent.slice(0, 12000)}\n\`\`\``
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Current file context: not provided"

  const user = [
    `Project region: ${region}`,
    `Workflow mode: ${workflowMode}`,
    `Requested mode: ${mode}`,
    `User request: ${prompt}`,
    workflowDirective,
    modeDirective,
    ...targetStrategy.promptNotes,
    currentFileMeta,
    currentPageMeta,
    currentModuleMeta,
    currentElementMeta,
    sharedSessionMeta,
    context.openTabs?.length ? `Open tabs: ${context.openTabs.join(", ")}` : "Open tabs: none",
    context.relatedPaths?.length ? `Related files: ${context.relatedPaths.join(", ")}` : "Related files: none",
    "Current file snapshots:",
    snapshots.join("\n"),
  ].join("\n\n")

  const { content: rawContent, reasoning } = await requestJsonChatCompletion({
    config,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    timeoutMs: 45_000,
    mode: "fixer",
  })

  if (!rawContent) {
    throw new Error("Empty model response")
  }

  let parsed: ModelOutput
  try {
    parsed = parseModelOutput(rawContent)
  } catch (err: any) {
    throw new Error(`Model JSON parse failed: ${err?.message || String(err)}\nRaw tail:\n${trimText(rawContent, 1200)}`)
  }

  if (reasoning) parsed.reasoning = reasoning
  if (!Array.isArray(parsed.files)) {
    parsed.files = []
  }
  if (mode !== "explain" && parsed.files.length === 0) {
    throw new Error("Model returned no file edits")
  }
  return parsed
}

async function runBuild(projectDir: string) {
  const hasPackage = await pathExists(path.join(projectDir, "package.json"))
  if (!hasPackage) {
    return { status: "skipped" as const, logs: ["Skipped: no package.json"] }
  }
  const hasModules = await pathExists(path.join(projectDir, "node_modules"))
  if (!hasModules) {
    return { status: "skipped" as const, logs: ["Skipped: node_modules missing; run npm install first"] }
  }

  const hostTscBin = path.join(process.cwd(), "node_modules", "typescript", "bin", "tsc")
  if (await pathExists(hostTscBin)) {
    const typeCheck = await new Promise<{ status: "ok" | "failed"; logs: string[] }>((resolve) => {
      const logs: string[] = []
      const child = spawn(process.execPath, [hostTscBin, "--noEmit", "--pretty", "false"], {
        cwd: projectDir,
        env: {
          ...process.env,
          NODE_ENV: "production",
          NEXT_TELEMETRY_DISABLED: "1",
        },
        windowsHide: true,
        shell: false,
      })

      const timer = setTimeout(() => {
        try {
          child.kill()
        } catch {
          // noop
        }
        resolve({
          status: "failed",
          logs: [...logs, "TypeScript validation timed out after 60000ms"],
        })
      }, 60_000)

      child.stdout?.on("data", (data) => logs.push(String(data)))
      child.stderr?.on("data", (data) => logs.push(String(data)))
      child.on("error", (err) => {
        clearTimeout(timer)
        resolve({ status: "failed", logs: [...logs, err.message] })
      })
      child.on("close", (code) => {
        clearTimeout(timer)
        resolve({
          status: code === 0 ? "ok" : "failed",
          logs: code === 0 ? ["TypeScript-first iterate validation passed."] : logs,
        })
      })
    })

    if (typeCheck.status === "ok") {
      return typeCheck
    }
  }

  return new Promise<{ status: "ok" | "failed"; logs: string[] }>((resolve) => {
    const logs: string[] = []
    const child =
      process.platform === "win32"
        ? (() => {
            const npmExecPath = process.env.npm_execpath
            const npmCli =
              npmExecPath && npmExecPath.endsWith(".js")
                ? npmExecPath
                : path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
            return spawn(process.execPath, [npmCli, "run", "build"], {
              cwd: projectDir,
              windowsHide: true,
              shell: false,
              creationFlags: 0x08000000,
            } as any)
          })()
        : spawn("npm", ["run", "build"], { cwd: projectDir, windowsHide: true, shell: false })

    child.stdout.on("data", (data) => logs.push(String(data)))
    child.stderr.on("data", (data) => logs.push(String(data)))
    child.on("error", (err) => resolve({ status: "failed", logs: [...logs, err.message] }))
    child.on("close", (code) => resolve({ status: code === 0 ? "ok" : "failed", logs }))
  })
}

async function repairLegacyPrismaImport(projectDir: string) {
  const apiPath = path.join(projectDir, "app", "api", "items", "route.ts")
  if (!(await pathExists(apiPath))) {
    return
  }
  const raw = await fs.readFile(apiPath, "utf8")
  const next = raw
    .replace('import { prisma } from "../../../../lib/prisma";', 'import { prisma } from "../../../lib/prisma";')
    .replace('import { prisma } from "../../lib/prisma";', 'import { prisma } from "../../../lib/prisma";')
  if (next !== raw) {
    await fs.writeFile(apiPath, next, "utf8")
  }
}

function buildIterateContextSummary(context: EditorRequestContext, region: Region) {
  const parts = [
    context.currentPage?.label || context.sharedSession?.routeLabel,
    context.currentModule?.name || context.sharedSession?.symbolName,
    context.currentElement?.name || context.sharedSession?.elementName,
  ].filter(Boolean)
  if (!parts.length && (context.currentFilePath || context.sharedSession?.filePath)) {
    return context.currentFilePath || context.sharedSession?.filePath || (region === "cn" ? "当前工作区" : "the current workspace")
  }
  if (!parts.length) return region === "cn" ? "当前工作区" : "the current workspace"
  return parts.join(" / ")
}

function resolveDiscussionArchetype(prompt: string, context: EditorRequestContext, spec: Awaited<ReturnType<typeof readProjectSpec>>) {
  const explicitArchetype = normalizeTextValue(
    context.sharedSession?.appArchetype ||
      spec?.appIntent?.archetype ||
      spec?.appIdentity?.category
  ).toLowerCase()
  if (explicitArchetype === "code_platform") return "code_platform" as const
  if (explicitArchetype === "crm") return "crm" as const
  if (explicitArchetype === "api_platform") return "api_platform" as const
  if (explicitArchetype === "community") return "community" as const
  if (explicitArchetype === "marketing_admin" || explicitArchetype === "content") {
    return "website_landing_download" as const
  }

  const text = [
    prompt,
    spec?.prompt,
    spec?.templateId,
    spec?.kind,
    context.currentPage?.label,
    context.sharedSession?.activeSection,
    context.sharedSession?.routeLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (/cursor|code editor|ide|developer platform|coding workspace|ai coding|代码编辑器|编程平台|开发者平台|代码平台|代码工作台/.test(text)) {
    return "code_platform" as const
  }
  if (/crm|customer|sales|pipeline|lead|客户|销售|跟进/.test(text)) {
    return "crm" as const
  }
  if (/api|sdk|endpoint|observability|monitoring|usage trend|error alert|接口|分析平台|监控|趋势|日志|鉴权|环境/.test(text)) {
    return "api_platform" as const
  }
  if (/community|club|social|group|announcement|event|feedback|社区|社团|社交|公告|活动|反馈/.test(text)) {
    return "community" as const
  }
  if (/website|landing|homepage|download|docs|documentation|官网|落地页|下载页|文档|品牌|增长/.test(text)) {
    return "website_landing_download" as const
  }
  return "admin_ops_internal_tool" as const
}

function getDiscussionRouteMap(
  archetype: DiscussPlan["archetype"],
  spec: Awaited<ReturnType<typeof readProjectSpec>>
) {
  if (Array.isArray(spec?.routeBlueprint) && spec.routeBlueprint.length) {
    const routes = spec.routeBlueprint
      .map((item) => String(item.path || "").trim())
      .filter(Boolean)
    if (routes.length) return Array.from(new Set(routes))
  }
  if (spec?.kind === "code_platform" || archetype === "code_platform") {
    return ["/dashboard", "/editor", "/runs", "/templates", "/pricing", "/settings"]
  }
  if (archetype === "crm") return ["/dashboard", "/leads", "/pipeline", "/customers", "/automations"]
  if (archetype === "api_platform") return ["/dashboard", "/endpoints", "/logs", "/auth", "/environments"]
  if (archetype === "community") return ["/", "/events", "/feedback", "/pricing"]
  if (archetype === "website_landing_download") return ["/", "/downloads", "/docs", "/pricing"]
  return ["/dashboard", "/users", "/data", "/analytics", "/settings"]
}

function buildWorkspaceDiscussionPlan(args: {
  prompt: string
  region: Region
  context: EditorRequestContext
  projectSpec: Awaited<ReturnType<typeof readProjectSpec>>
}): DiscussPlan {
  const { prompt, region, context, projectSpec } = args
  const isCn = region === "cn"
  const basePrompt = projectSpec?.prompt || prompt
  const nextSpec = applyPromptToSpec(createAppSpec(basePrompt, region, projectSpec ?? undefined), prompt, context)
  const archetype = resolveDiscussionArchetype(prompt, context, projectSpec)
  const routeMap = getDiscussionRouteMap(archetype, nextSpec)
  const modulePlan = Array.from(new Set(nextSpec.modules)).slice(0, 8)
  const constraints = [
    context.sharedSession?.appCategory
      ? `${isCn ? "应用类别" : "App category"}: ${context.sharedSession.appCategory}`
      : "",
    context.sharedSession?.primaryWorkflow
      ? `${isCn ? "主工作流" : "Primary workflow"}: ${context.sharedSession.primaryWorkflow}`
      : "",
    context.sharedSession?.visualTone
      ? `${isCn ? "视觉方向" : "Visual tone"}: ${context.sharedSession.visualTone}`
      : "",
    context.sharedSession?.routeBlueprintSummary?.length
      ? `${isCn ? "关键路由" : "Key routes"}: ${context.sharedSession.routeBlueprintSummary.join(" / ")}`
      : "",
    context.sharedSession?.activeRoutePurpose
      ? `${isCn ? "当前路由职责" : "Active route purpose"}: ${context.sharedSession.activeRoutePurpose}`
      : "",
    context.sharedSession?.moduleBlueprintSummary?.length
      ? `${isCn ? "关键模块" : "Key modules"}: ${context.sharedSession.moduleBlueprintSummary.join(" / ")}`
      : "",
    context.sharedSession?.activeModuleSummary
      ? `${isCn ? "当前模块摘要" : "Active module summary"}: ${context.sharedSession.activeModuleSummary}`
      : "",
    context.sharedSession?.entityBlueprintSummary?.length
      ? `${isCn ? "关键实体" : "Key entities"}: ${context.sharedSession.entityBlueprintSummary.join(" / ")}`
      : "",
    context.sharedSession?.activeEntitySummary
      ? `${isCn ? "当前实体摘要" : "Active entity summary"}: ${context.sharedSession.activeEntitySummary}`
      : "",
    context.sharedSession?.selectedPlanName
      ? `${isCn ? "当前套餐" : "Current plan"}: ${context.sharedSession.selectedPlanName}`
      : "",
    context.sharedSession?.codeExportLevel
      ? `${isCn ? "代码导出级别" : "Code export level"}: ${context.sharedSession.codeExportLevel}`
      : typeof context.sharedSession?.codeExportAllowed === "boolean"
        ? context.sharedSession.codeExportAllowed
          ? isCn
            ? "当前套餐允许代码导出。"
            : "The current plan allows code export."
          : isCn
            ? "当前套餐仍锁定代码导出。"
            : "The current plan still keeps code export locked."
        : "",
    context.sharedSession?.generationProfile
      ? `${isCn ? "生成档位" : "Generation profile"}: ${context.sharedSession.generationProfile}`
      : "",
    context.sharedSession?.routeBudget
      ? `${isCn ? "页面预算" : "Route budget"}: ${context.sharedSession.routeBudget}`
      : "",
    context.sharedSession?.moduleBudget
      ? `${isCn ? "模块预算" : "Module budget"}: ${context.sharedSession.moduleBudget}`
      : "",
    context.sharedSession?.databaseAccessMode
      ? `${isCn ? "数据库访问" : "Database access"}: ${context.sharedSession.databaseAccessMode}`
      : "",
    context.sharedSession?.projectLimit
      ? `${isCn ? "项目上限" : "Project limit"}: ${context.sharedSession.projectLimit}`
      : "",
    context.sharedSession?.collaboratorLimit
      ? `${isCn ? "协作人数上限" : "Collaborator limit"}: ${context.sharedSession.collaboratorLimit}`
      : "",
    context.sharedSession?.subdomainSlots
      ? `${isCn ? "子域名位" : "Subdomain slots"}: ${context.sharedSession.subdomainSlots}`
      : "",
    context.sharedSession?.assignedDomain
      ? `${isCn ? "已分配域名" : "Assigned domain"}: ${context.sharedSession.assignedDomain}`
      : "",
    context.sharedSession?.deploymentTarget
      ? `${isCn ? "部署目标" : "Deployment target"}: ${context.sharedSession.deploymentTarget}`
      : "",
  ].filter(Boolean)

  const guardrails = [
    isCn
      ? `保持改动锚定在 ${buildIterateContextSummary(context, region)}，不要回到全局大改。`
      : `Keep the change anchored to ${buildIterateContextSummary(context, region)} instead of drifting into global rewrites.`,
    isCn
      ? "先补主工作流和页面关系，再补视觉细节。"
      : "Stabilize the main workflow and route relationships before polishing visuals.",
    isCn
      ? "继续沿用当前项目的套餐、数据和部署约束。"
      : "Preserve the current project's plan, data, and deployment constraints.",
  ]

  const taskPlan = [
    isCn
      ? "先确认 archetype、主页面关系和导航入口。"
      : "Confirm the archetype, route map, and navigation entrypoints first.",
    isCn
      ? "围绕当前文件/页面补主工作流和关键交互。"
      : "Expand the core workflow and key interactions around the current file/page.",
    isCn
      ? "把数据、权限、套餐限制接进页面行为和文案。"
      : "Thread data, permissions, and plan limits into page behavior and copy.",
    isCn
      ? "最后做 build/preview 验证并整理缺口。"
      : "Finish with build/preview validation and a concise gap list.",
  ]

  return {
    archetype,
    summary: isCn
      ? `已为当前需求整理 ${routeMap.length} 个主路由、${modulePlan.length} 个模块的讨论规划。`
      : `Prepared a discussion plan with ${routeMap.length} core routes and ${modulePlan.length} modules.`,
    routeMap,
    modulePlan,
    taskPlan,
    guardrails,
    constraints,
  }
}

function renderDiscussionPlan(plan: DiscussPlan, region: Region) {
  const isCn = region === "cn"
  return [
    `${isCn ? "Archetype" : "Archetype"}: ${plan.archetype}`,
    `${isCn ? "主路由" : "Route map"}: ${plan.routeMap.join(", ")}`,
    `${isCn ? "模块规划" : "Module plan"}: ${plan.modulePlan.join(", ")}`,
    `${isCn ? "执行顺序" : "Execution sequence"}:`,
    ...plan.taskPlan.map((item, index) => `${index + 1}. ${item}`),
    `${isCn ? "约束" : "Constraints"}:`,
    ...plan.constraints.map((item) => `- ${item}`),
    `${isCn ? "护栏" : "Guardrails"}:`,
    ...plan.guardrails.map((item) => `- ${item}`),
  ].join("\n")
}

async function tryLocalFallbackEdits(
  projectDir: string,
  prompt: string,
  context: EditorRequestContext,
  mode: IterateMode,
  region: Region
): Promise<ModelOutput | null> {
  const allFiles = await collectContextFiles(projectDir)
  const targetStrategy = buildIterateTargetStrategy(allFiles, context, mode)
  const candidatePaths = uniqueContextPaths([
    ...targetStrategy.targetFiles,
    context.currentFilePath,
    context.currentPage?.filePath,
    "app/page.tsx",
  ])
  const drafts = new Map<string, { raw: string; next: string }>()
  const createdFiles: ModelFileEdit[] = []
  const changes: string[] = []

  async function ensureDraft(relativePath: string) {
    const normalized = normalizeContextPath(relativePath)
    if (!normalized) return null
    const existing = drafts.get(normalized)
    if (existing) return existing
    const absolutePath = path.join(projectDir, normalized)
    if (!(await pathExists(absolutePath))) return null
    const raw = await fs.readFile(absolutePath, "utf8")
    const draft = { raw, next: raw }
    drafts.set(normalized, draft)
    return draft
  }

  if (!(await ensureDraft(candidatePaths[0] || "app/page.tsx"))) {
    return null
  }

  const focusedPagePath =
    context.currentFilePath ||
    context.currentPage?.filePath ||
    candidatePaths[0] ||
    "app/page.tsx"
  const focusedDraft = await ensureDraft(focusedPagePath)

  const title = extractTargetTitle(prompt)
  if (title) {
    for (const relativePath of candidatePaths) {
      const draft = await ensureDraft(relativePath)
      if (!draft) continue
      if (/<h1[^>]*>[\s\S]*?<\/h1>/.test(draft.next)) {
        draft.next = draft.next.replace(/<h1([^>]*)>[\s\S]*?<\/h1>/, `<h1$1>${title}</h1>`)
        changes.push(`title -> ${title}`)
        break
      }
      if (draft.next.includes("Generated Task Workspace")) {
        draft.next = draft.next.replace("Generated Task Workspace", title)
        changes.push(`title -> ${title}`)
        break
      }
    }
  }

  const workspacePagePath = candidatePaths.find((item) => item === "app/page.tsx") || candidatePaths[0] || "app/page.tsx"
  const workspaceDraft = await ensureDraft(workspacePagePath)
  if (!workspaceDraft) {
    return null
  }

  const wantsHeaderNote =
    /(?:status note|health status|api health|header note|note near .*header|状态说明|健康状态|标题附近.*说明)/i.test(prompt)
  if (focusedDraft && wantsHeaderNote && /<h1[^>]*>[\s\S]*?<\/h1>/.test(focusedDraft.next)) {
    const before = focusedDraft.next
    const noteText =
      region === "cn"
        ? "API 健康状态已同步，当前页聚焦端点、鉴权与环境准备度。"
        : "API health is in sync here, with endpoint readiness, auth coverage, and environment status in one view."
    if (!focusedDraft.next.includes(noteText)) {
      focusedDraft.next = focusedDraft.next.replace(
        /(<h1[^>]*>[\s\S]*?<\/h1>)/,
        `$1
              <p style={{ margin: "10px 0 0", maxWidth: 720, color: "#64748b", lineHeight: 1.7, fontSize: 14 }}>
                ${noteText}
              </p>`
      )
      changes.push("added focused header status note")
    }
    if (focusedDraft.next !== before && /missing status labeling|文案|copy|label/i.test(prompt)) {
      const badgeNeedle = '{item.status}'
      if (focusedDraft.next.includes(badgeNeedle) && !focusedDraft.next.includes("Status")) {
        focusedDraft.next = focusedDraft.next.replace(badgeNeedle, `{isCn ? "状态 " : "Status "}{item.status}`)
        changes.push("clarified status labeling")
      }
    }
  }

  if (isChineseUiRequest(prompt)) {
    const before = workspaceDraft.next
    const replacements: Array<[string, string]> = [
      ["Task title", "任务标题"],
      ["Assignee", "负责人"],
      ["Create", "创建"],
      ["Adding...", "创建中..."],
      ["Todo", "待办"],
      ["In Progress", "进行中"],
      ["Done", "完成"],
      ["Doing", "进行中"],
      ["Priority:", "优先级:"],
      ["Unassigned", "未分配"],
      ["Filter by assignee", "按负责人筛选"],
      ["Blocked", "阻塞"],
    ]
    for (const [from, to] of replacements) workspaceDraft.next = workspaceDraft.next.split(from).join(to)
    if (workspaceDraft.next !== before) changes.push("localized labels to Chinese")
  }

  if (isDescriptionFieldRequest(prompt)) {
    const before = workspaceDraft.next
    if (!workspaceDraft.next.includes("const [description, setDescription]")) {
      workspaceDraft.next = workspaceDraft.next.replace(
        '  const [title, setTitle] = useState("");',
        '  const [title, setTitle] = useState("");\n  const [description, setDescription] = useState("");'
      )
      workspaceDraft.next = workspaceDraft.next.replace(
        "          assignee: assignee.trim(),",
        "          description: description.trim(),\n          assignee: assignee.trim(),"
      )
      workspaceDraft.next = workspaceDraft.next.replace(
        '      setTitle("");\n      setAssignee("");',
        '      setTitle("");\n      setDescription("");\n      setAssignee("");'
      )
      workspaceDraft.next = workspaceDraft.next.replace(
        `        <input
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder="Assignee"
          style={{ width: 160, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />`,
        `        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          style={{ width: 220, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <input
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder="Assignee"
          style={{ width: 160, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />`
      )
      workspaceDraft.next = workspaceDraft.next.replace(
        '                    <div style={{ fontWeight: 600 }}>{task.title}</div>',
        '                    <div style={{ fontWeight: 600 }}>{task.title}</div>\n                    {task.description ? <div style={{ fontSize: 12, color: "#444", marginTop: 4 }}>{task.description}</div> : null}'
      )
    }
    if (workspaceDraft.next !== before) changes.push("added description input and card rendering")
  }

  if (isBlockedColumnRequest(prompt)) {
    const before = workspaceDraft.next
    workspaceDraft.next = workspaceDraft.next.replace(
      'status: "todo" | "in_progress" | "done";',
      'status: "todo" | "in_progress" | "blocked" | "done";'
    )
    workspaceDraft.next = workspaceDraft.next.replace(
      '{ key: "in_progress", label: "In Progress" },\n    { key: "done", label: "Done" },',
      '{ key: "in_progress", label: "In Progress" },\n    { key: "blocked", label: "Blocked" },\n    { key: "done", label: "Done" },'
    )
    if (!workspaceDraft.next.includes('setStatus(task.id, "blocked")')) {
      workspaceDraft.next = workspaceDraft.next.replace(
        `{group.key !== "done" ? (
                        <button
                          onClick={() => setStatus(task.id, "done")}
                          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 8px" }}
                        >
                          Done
                        </button>
                      ) : null}`,
        `{group.key !== "blocked" ? (
                        <button
                          onClick={() => setStatus(task.id, "blocked")}
                          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 8px" }}
                        >
                          Blocked
                        </button>
                      ) : null}
                      {group.key !== "done" ? (
                        <button
                          onClick={() => setStatus(task.id, "done")}
                          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 8px" }}
                        >
                          Done
                        </button>
                      ) : null}`
      )
    }
    if (workspaceDraft.next !== before) changes.push("added blocked column and action")
  }

  if (isAssigneeFilterRequest(prompt)) {
    const before = workspaceDraft.next
    if (!workspaceDraft.next.includes("const [assigneeFilter, setAssigneeFilter]")) {
      workspaceDraft.next = workspaceDraft.next.replace(
        '  const [assignee, setAssignee] = useState("");',
        '  const [assignee, setAssignee] = useState("");\n  const [assigneeFilter, setAssigneeFilter] = useState("");'
      )
      workspaceDraft.next = workspaceDraft.next.replace(
        '  const groups: Array<{ key: Task["status"]; label: string }> = [',
        `  const visibleTasks = tasks.filter((t) => {
    const f = assigneeFilter.trim().toLowerCase();
    if (!f) return true;
    return String(t.assignee || "").toLowerCase().includes(f);
  });

  const groups: Array<{ key: Task["status"]; label: string }> = [`
      )
      workspaceDraft.next = workspaceDraft.next.replace("{tasks", "{visibleTasks")
      workspaceDraft.next = workspaceDraft.next.replace(
        `        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
          style={{ width: 120, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        >`,
        `        <input
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          placeholder="Filter by assignee"
          style={{ width: 180, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
          style={{ width: 120, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        >`
      )
    }
    if (workspaceDraft.next !== before) changes.push("added assignee filter")
  }

  if (isAboutPageRequest(prompt)) {
    const aboutPath = path.join(projectDir, "app", "about", "page.tsx")
    const aboutTitle = region === "cn" ? "关于当前工作区" : "About This Workspace"
    const aboutContext = buildIterateContextSummary(context, region)
    const aboutContent = `export default function AboutPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 860 }}>
      <h1>${aboutTitle}</h1>
      <p style={{ color: "#666" }}>
        ${region === "cn" ? "当模型 API 不可用时，本页面由本地 fallback 规则生成。" : "This page was generated by local fallback rules when the model API was unavailable."}
      </p>
      <p style={{ color: "#666" }}>
        ${region === "cn" ? "当前聚焦：" : "Current focus:"} ${aboutContext}
      </p>
      <a href="/" style={{ textDecoration: "underline" }}>
        ${region === "cn" ? "回到首页" : "Back to Home"}
      </a>
    </main>
  )
}
`
    await ensureDir(path.dirname(aboutPath))
    await fs.writeFile(aboutPath, aboutContent, "utf8")
    createdFiles.push({ path: "app/about/page.tsx", content: aboutContent, reason: "Add about page" })
    const linkTargetPath =
      (context.currentPage?.filePath && /\/page\.(tsx|jsx)$/.test(context.currentPage.filePath) && context.currentPage.filePath) ||
      workspacePagePath
    const linkDraft = await ensureDraft(linkTargetPath)
    if (linkDraft && !linkDraft.next.includes('href="/about"')) {
      linkDraft.next = linkDraft.next.replace(
        "</h1>",
        `</h1>
      <div style={{ marginBottom: 8 }}>
        <a href="/about" style={{ textDecoration: "underline" }}>${region === "cn" ? "关于" : "About"}</a>
      </div>`
      )
    }
    changes.push("added /about page")
  }

  const changedFiles = Array.from(drafts.entries())
    .filter(([, draft]) => draft.next !== draft.raw)
    .map(([relativePath, draft]) => ({
      path: relativePath,
      content: draft.next,
      reason:
        mode === "refactor"
          ? `Refactor fallback applied from ${buildIterateContextSummary(context, region)}`
          : changes.join("; ") || `Fallback update from ${buildIterateContextSummary(context, region)}`,
    }))

  if (changes.length === 0 && changedFiles.length === 0 && createdFiles.length === 0) {
    return null
  }

  return {
    summary: `Local fallback edits applied on ${[...changedFiles.map((file) => file.path), ...createdFiles.map((file) => file.path)].join(", ")}: ${changes.join("; ") || "context-aware fallback"}`,
    reasoning: "Model API unavailable, fallback rule applied.",
    files: [...changedFiles, ...createdFiles],
  }
}

async function tryFocusedHeaderNoteEdit(
  projectDir: string,
  prompt: string,
  context: EditorRequestContext,
  region: Region
): Promise<ModelOutput | null> {
  if (!/(?:status note|health status|api health|header note|note near .*header|标题附近.*说明|健康状态|状态说明)/i.test(prompt)) {
    return null
  }

  const targetPath = normalizeContextPath(context.currentFilePath || context.currentPage?.filePath)
  if (!targetPath) return null
  const absolutePath = path.join(projectDir, targetPath)
  if (!(await pathExists(absolutePath))) return null

  const raw = await fs.readFile(absolutePath, "utf8")
  if (!/<h1[^>]*>[\s\S]*?<\/h1>/.test(raw)) return null

  const noteText =
    region === "cn"
      ? "API 健康状态已同步，当前页聚焦端点、鉴权与环境准备度。"
      : "API health is in sync here, with endpoint readiness, auth coverage, and environment status in one view."

  if (raw.includes(noteText)) return null

  const next = raw.replace(
    /(<h1[^>]*>[\s\S]*?<\/h1>)/,
    `$1
              <p style={{ margin: "10px 0 0", maxWidth: 720, color: "#64748b", lineHeight: 1.7, fontSize: 14 }}>
                ${noteText}
              </p>`
  )

  if (next === raw) return null

  return {
    summary:
      region === "cn"
        ? `已在 ${targetPath} 的标题下插入 API 状态说明。`
        : `Added an API status note directly under the header in ${targetPath}.`,
    reasoning: "Preferred local file-scoped fallback matched a header-note request.",
    files: [
      {
        path: targetPath,
        content: next,
        reason: "Insert a concise status note under the existing header without changing layout",
      },
    ],
  }
}

async function tryFocusedStatusLabelEdit(
  projectDir: string,
  prompt: string,
  context: EditorRequestContext,
  region: Region
): Promise<ModelOutput | null> {
  if (!/(?:missing status labeling|status labeling|copy issue|copy tweak|文案|状态标签|状态标识)/i.test(prompt)) {
    return null
  }

  const targetPath = normalizeContextPath(context.currentFilePath || context.currentPage?.filePath)
  if (!targetPath) return null
  const absolutePath = path.join(projectDir, targetPath)
  if (!(await pathExists(absolutePath))) return null

  const raw = await fs.readFile(absolutePath, "utf8")
  if (!raw.includes("{item.status}") || raw.includes('{isCn ? "状态 " : "Status "}{item.status}')) {
    return null
  }

  const next = raw.replace("{item.status}", '{isCn ? "状态 " : "Status "}{item.status}')
  if (next === raw) return null

  return {
    summary:
      region === "cn"
        ? `已在 ${targetPath} 中补齐状态标签文案。`
        : `Added clearer status labeling in ${targetPath}.`,
    reasoning: "Preferred local file-scoped fallback matched a status-labeling repair request.",
    files: [
      {
        path: targetPath,
        content: next,
        reason: "Clarify status labeling inline without changing the overall layout",
      },
    ],
  }
}

async function tryGenericFallbackEdits(
  projectDir: string,
  prompt: string,
  projectId: string,
  projectSlug: string | undefined,
  region: Region,
  context?: EditorRequestContext,
  mode?: IterateMode
): Promise<ModelOutput> {
  const previous = await readProjectSpec(projectDir)
  const baseRegion = previous?.region === "cn" ? "cn" : region
  const basePrompt = previous?.prompt || prompt
  const spec = applyPromptToSpec(
    createAppSpec(basePrompt, baseRegion, previous ?? undefined),
    prompt,
    context
  )
  if (previous?.templateId) {
    spec.templateId = previous.templateId
  }
  if (previous?.templateStyle) {
    spec.templateStyle = previous.templateStyle
  }
  const generated = await buildSpecDrivenWorkspaceFiles(projectDir, spec, context, {
    projectId,
    projectSlug,
    assignedDomain:
      projectId || projectSlug
        ? buildAssignedAppUrl({
            projectSlug: projectSlug || projectId || spec.title,
            projectId,
            region: spec.region,
            planTier: spec.planTier,
          })
        : undefined,
  })
  return {
    summary: `Spec-driven fallback applied for ${buildIterateContextSummary(context ?? {}, region)}: "${sanitizeUiText(prompt).slice(0, 80)}"`,
    reasoning: `Model API unavailable, so the request was applied through the local spec-driven workspace editor${mode ? ` in ${mode} mode` : ""}.`,
    files: generated.map((file) => ({
      path: file.path,
      content: file.content,
      reason: file.reason,
    })),
  }
}

export async function POST(req: Request) {
  const now = new Date().toISOString()
  const body = await req.json().catch(() => ({}))
  const projectId = safeProjectId(String(body?.projectId ?? body?.jobId ?? ""))
  const prompt = String(body?.prompt ?? "").trim()
  const requestedMode = normalizeIterateMode(body?.mode)
  const workflowMode = normalizeIterateWorkflowMode(body?.workflowMode ?? body?.assistantMode)
  const mode = workflowMode === "discuss" ? "explain" : workflowMode === "act" && requestedMode === "explain" ? "generate" : requestedMode
  const region = (body?.region === "cn" ? "cn" : "intl") as Region

  if (!projectId || !prompt) {
    return NextResponse.json({ error: "projectId and prompt are required" }, { status: 400 })
  }

  const projectDir = await resolveProjectPath(projectId)
  if (!projectDir) {
    return NextResponse.json({ error: "Project not found", projectId }, { status: 404 })
  }
  const project = await getProject(projectId)
  const effectiveRegion = project?.region ?? region
  const projectSpec = await readProjectSpec(projectDir)
  const workspaceRoutes = buildCodePlatformContextRoutes({
    region: effectiveRegion,
    features: Array.isArray(projectSpec?.features) ? projectSpec.features.filter((item) => typeof item === "string") : [],
  })

  const backups = new Map<string, string | null>()
  try {
    await repairLegacyPrismaImport(projectDir)
    const baselineBuild =
      mode === "explain"
        ? { status: "skipped" as const, logs: ["Skipped: explain mode does not need baseline build validation"] }
        : await runBuild(projectDir)
    const requestContext = await resolveEditorContext(projectDir, projectId, project?.projectSlug, body, effectiveRegion)
    let responseContext = serializeEditorContext(requestContext)
    const discussionPlan =
      workflowMode === "discuss"
        ? buildWorkspaceDiscussionPlan({
            prompt,
            region: effectiveRegion,
            context: requestContext,
            projectSpec,
          })
        : null
    let modelResult: ModelOutput

    if (discussionPlan) {
      modelResult = {
        summary: discussionPlan.summary,
        analysis: renderDiscussionPlan(discussionPlan, effectiveRegion),
        reasoning: renderDiscussionPlan(discussionPlan, effectiveRegion),
        files: [],
      }
    } else {
      const localHeaderFirst =
        workflowMode !== "discuss" && mode !== "explain"
          ? await tryFocusedHeaderNoteEdit(projectDir, prompt, requestContext, effectiveRegion)
          : null
      const localStatusLabelFirst =
        !localHeaderFirst && workflowMode !== "discuss" && mode !== "explain"
          ? await tryFocusedStatusLabelEdit(projectDir, prompt, requestContext, effectiveRegion)
          : null
      const localFirst =
        localHeaderFirst ||
        localStatusLabelFirst ||
        (workflowMode !== "discuss" && shouldPreferLocalFallback(prompt, mode, requestContext)
          ? await tryLocalFallbackEdits(projectDir, prompt, requestContext, mode, effectiveRegion)
          : null)

      if (localFirst) {
        modelResult = {
          ...localFirst,
          reasoning: `${localFirst.reasoning}\nPreferred local file-scoped fallback matched the request before calling the model.`,
        }
      } else {
        try {
          modelResult = await callEditorModel(projectDir, prompt, effectiveRegion, requestContext, body, mode, workflowMode)
        } catch (modelErr: any) {
          if (mode === "explain") {
            const explained = buildExplainFallback(prompt, requestContext, effectiveRegion)
            modelResult = {
              ...explained,
              reasoning: `${explained.reasoning}\nOriginal model error: ${modelErr?.message || String(modelErr)}`,
            }
          } else {
            const localFallback = await tryLocalFallbackEdits(projectDir, prompt, requestContext, mode, effectiveRegion)
            if (localFallback) {
              modelResult = {
                ...localFallback,
                reasoning: `${localFallback.reasoning}\nOriginal model error: ${modelErr?.message || String(modelErr)}`,
              }
            } else {
              const specDriven = await tryGenericFallbackEdits(
                projectDir,
                prompt,
                projectId,
                project?.projectSlug,
                effectiveRegion,
                requestContext,
                mode
              )
              modelResult = {
                ...specDriven,
                reasoning: `${specDriven.reasoning}\nOriginal model error: ${modelErr?.message || String(modelErr)}`,
              }
            }
          }
        }
      }
    }

    const requestedFiles = Array.isArray(modelResult.files) ? modelResult.files : []
    const workspaceFiles = await collectContextFiles(projectDir)
    const scopeStrategy = buildIterateTargetStrategy(prioritizeContextFiles(workspaceFiles, requestContext), requestContext, mode)
    const scopedResult = constrainModelEdits(requestedFiles, workspaceFiles, scopeStrategy, requestContext, mode)
    const appliedEdits = mode === "explain" ? [] : scopedResult.edits

    if (scopedResult.droppedPaths.length) {
      const scopeNote =
        effectiveRegion === "cn"
          ? `已按当前文件/页面上下文收敛改动范围，保留 ${appliedEdits.length}/${requestedFiles.length} 个文件。`
          : `Scoped the edit set back to the current file/page context and kept ${appliedEdits.length}/${requestedFiles.length} files.`
      modelResult.reasoning = [modelResult.reasoning, scopeNote].filter(Boolean).join("\n")
      modelResult.summary = `${modelResult.summary} ${scopeNote}`.trim()
    }

    const updateResponseContext = (changedFiles: string[], buildStatus?: "ok" | "failed" | "skipped") => {
      const firstChangedFile = pickPrimaryChangedFile(changedFiles, requestContext)
      const previousFile = normalizeContextPath(requestContext.currentFilePath)
      const changedDraft = appliedEdits.find((edit) => normalizeContextPath(edit.path) === firstChangedFile)
      if (firstChangedFile) {
        requestContext.currentFilePath = firstChangedFile
        requestContext.currentRoute =
          inferRouteFromFilePath(firstChangedFile) ||
          requestContext.currentRoute ||
          requestContext.currentPage?.route
        if (previousFile && previousFile !== firstChangedFile) {
          requestContext.currentFileSymbols = []
        }
        if (changedDraft?.content) {
          requestContext.currentFileSymbols = inferSymbolsFromContent(changedDraft.content)
        }
      }
      const rebuiltContext = rebuildEditorFocus(requestContext, effectiveRegion, workspaceRoutes, projectSpec)
      requestContext.currentRoute = rebuiltContext.currentRoute
      requestContext.currentPage = rebuiltContext.currentPage
      requestContext.currentModule = rebuiltContext.currentModule
      requestContext.currentElement = rebuiltContext.currentElement
      requestContext.relatedPaths = uniqueContextPaths([
        requestContext.currentFilePath,
        rebuiltContext.currentPage?.filePath,
        ...(requestContext.relatedPaths ?? []),
        ...(requestContext.openTabs ?? []),
      ])
      requestContext.sharedSession = buildResolvedSessionContext({
        session: requestContext.sharedSession,
        context: requestContext,
        mode,
        prompt,
        now,
        summary: modelResult.summary,
        changedFiles,
        buildStatus,
      })
      responseContext = serializeEditorContext(requestContext)
    }

    if (mode === "explain") {
      updateResponseContext([], "skipped")
      const skippedReason =
        workflowMode === "discuss"
          ? "Skipped: discuss mode returns plan/spec without file edits"
          : "Skipped: explain mode does not apply file edits"
      await appendProjectHistory(projectId, {
        id: `evt_${Date.now()}`,
        type: "iterate",
        prompt,
        createdAt: now,
        status: "done",
        summary: modelResult.summary,
        changedFiles: [],
        buildStatus: "skipped",
        buildLogs: [skippedReason],
      })

      return NextResponse.json({
        projectId,
        status: "done",
        summary: modelResult.summary,
        thinking: modelResult.reasoning ?? modelResult.analysis ?? "",
        workflowMode,
        plan: discussionPlan ?? undefined,
        context: responseContext,
        changedFiles: [],
        build: {
          status: "skipped",
          logs: [skippedReason],
        },
      })
    }

    const changedFiles: string[] = []
    const appliedEditSummaries: AppliedEditSummary[] = []
    const fileBackups: Array<{ path: string; previousContent: string | null }> = []
    for (const edit of appliedEdits) {
      if (!isAllowedFile(edit.path)) {
        throw new Error(`Blocked path from model: ${edit.path}`)
      }
      const relative = normalizePath(edit.path)
      const absolute = path.resolve(projectDir, relative)
      const root = path.resolve(projectDir)
      if (!absolute.startsWith(root + path.sep) && absolute !== root) {
        throw new Error(`Path escapes workspace: ${relative}`)
      }

      if (!backups.has(absolute)) {
        if (await pathExists(absolute)) {
          const previous = await fs.readFile(absolute, "utf8")
          backups.set(absolute, previous)
          fileBackups.push({ path: relative, previousContent: previous })
        } else {
          backups.set(absolute, null)
          fileBackups.push({ path: relative, previousContent: null })
        }
      }

      const previousContent = backups.get(absolute) ?? null
      const existedBefore = previousContent !== null
      const { nextContent, operation } = applyInstructionalEdit({
        edit,
        relativePath: relative,
        previousContent,
        exists: existedBefore,
      })
      const noChange = previousContent === nextContent
      if (noChange) {
        continue
      }
      if (nextContent === null) {
        if (await pathExists(absolute)) {
          await fs.rm(absolute, { force: true })
        }
      } else {
        await ensureDir(path.dirname(absolute))
        await fs.writeFile(absolute, nextContent, "utf8")
      }
      changedFiles.push(relative)
      appliedEditSummaries.push(
        buildAppliedEditSummary({
          path: relative,
          operation,
          reason: edit.reason,
          existedBefore,
          beforeContent: previousContent,
          afterContent: nextContent,
        })
      )
    }

    const build = await runBuild(projectDir)
    if (build.status === "failed" && baselineBuild.status === "ok") {
      updateResponseContext(changedFiles, "failed")
      for (const [filePath, oldContent] of backups.entries()) {
        if (oldContent === null) {
          if (await pathExists(filePath)) await fs.rm(filePath, { force: true })
        } else {
          await fs.writeFile(filePath, oldContent, "utf8")
        }
      }
      await appendProjectHistory(projectId, {
        id: `evt_${Date.now()}`,
        type: "iterate",
        prompt,
        createdAt: now,
        status: "error",
        summary: modelResult.summary,
        changedFiles,
        fileBackups,
        buildStatus: "failed",
        buildLogs: build.logs,
        error: "Build failed and changes were rolled back",
      })
      return NextResponse.json(
        {
          projectId,
          status: "error",
          summary: modelResult.summary,
          workflowMode,
          context: responseContext,
          changedFiles,
          edits: appliedEditSummaries,
          build: { status: "failed", logs: build.logs },
          error: "Build failed and changes were rolled back",
        },
        { status: 500 }
      )
    }

    if (build.status === "failed" && baselineBuild.status === "failed") {
      updateResponseContext(changedFiles, "failed")
      await appendProjectHistory(projectId, {
        id: `evt_${Date.now()}`,
        type: "iterate",
        prompt,
        createdAt: now,
        status: "done",
        summary: `${modelResult.summary} (Workspace already had build errors before this change; changes kept.)`,
        changedFiles,
        fileBackups,
        buildStatus: "failed",
        buildLogs: build.logs,
      })
      return NextResponse.json({
        projectId,
        status: "done",
        summary: `${modelResult.summary} (Workspace already had build errors before this change; changes kept.)`,
        thinking: modelResult.reasoning ?? "",
        workflowMode,
        context: responseContext,
        changedFiles,
        edits: appliedEditSummaries,
        build,
        warning: "Build failed, but changes were kept because baseline build was already failing.",
      })
    }

    updateResponseContext(changedFiles, build.status)
    await appendProjectHistory(projectId, {
      id: `evt_${Date.now()}`,
      type: "iterate",
      prompt,
      createdAt: now,
      status: "done",
      summary: modelResult.summary,
      changedFiles,
      fileBackups,
      buildStatus: build.status,
      buildLogs: build.logs,
    })

    return NextResponse.json({
      projectId,
      status: "done",
      summary: modelResult.summary,
      thinking: modelResult.reasoning ?? "",
      workflowMode,
      context: responseContext,
      changedFiles,
      edits: appliedEditSummaries,
      build,
    })
  } catch (error: any) {
    await appendProjectHistory(projectId, {
      id: `evt_${Date.now()}`,
      type: "iterate",
      prompt,
      createdAt: now,
      status: "error",
      error: error?.message || String(error),
      buildStatus: "skipped",
    })
    return NextResponse.json(
      {
        projectId,
        status: "error",
        workflowMode,
        error: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}
