export type WorkspaceRegion = "cn" | "intl"

export type WorkspaceSymbolRef = {
  kind: string
  name: string
  line: number
}

export type CodePlatformContextSpec = {
  region: WorkspaceRegion
  features?: string[]
}

export type CodePlatformContextRoute = {
  id: string
  href: string
  filePath: string
  labelCn: string
  labelEn: string
  focusCn: string
  focusEn: string
  symbols: string[]
  elementsCn: string[]
  elementsEn: string[]
}

export type WorkspacePageContext = {
  id: string
  label: string
  route: string
  filePath: string
  focus: string
  symbols: string[]
  elements: string[]
}

export type WorkspaceModuleContext = {
  name: string
  source: "symbol" | "file" | "page"
  relatedSymbols: string[]
}

export type WorkspaceElementContext = {
  name: string
  source: "explicit" | "editor_rail" | "output_panel" | "page"
  options: string[]
  detail?: string
}

export type WorkspaceSessionContext = {
  projectName?: string
  specKind?: string
  workspaceSurface?: string
  activeSection?: string
  routeId?: string
  routeLabel?: string
  filePath?: string
  symbolName?: string
  elementName?: string
  deploymentTarget?: string
  databaseTarget?: string
  region?: WorkspaceRegion
  selectedPlanId?: string
  selectedPlanName?: string
  selectedTemplate?: string
  codeExportAllowed?: boolean
  codeExportLevel?: "none" | "manifest" | "full"
  databaseAccessMode?: string
  generationProfile?: "starter" | "builder" | "premium" | "showcase"
  routeBudget?: number
  moduleBudget?: number
  projectLimit?: number
  collaboratorLimit?: number
  subdomainSlots?: number
  assignedDomain?: string
  workspaceStatus?: string
  lastIntent?: string
  lastAction?: string
  lastChangedFile?: string
  lastChangedAt?: string
  readiness?: string
}

function normalizeFilePath(filePath?: string | null) {
  return String(filePath ?? "").replace(/\\/g, "/").replace(/^\/+/, "").trim()
}

function normalizeRoute(route?: string | null) {
  const normalized = String(route ?? "").trim()
  if (!normalized) return ""
  if (normalized === "/") return "/"
  return normalized.startsWith("/") ? normalized : `/${normalized}`
}

function normalizeId(value?: string | null) {
  return String(value ?? "").trim().toLowerCase()
}

function fileNameToModule(filePath: string) {
  const base = normalizeFilePath(filePath).split("/").pop() || "workspace"
  return base.replace(/\.(tsx|ts|jsx|js|json|md|css)$/i, "") || "workspace"
}

export function buildCodePlatformContextRoutes(spec: CodePlatformContextSpec): CodePlatformContextRoute[] {
  const routes: CodePlatformContextRoute[] = [
    {
      id: "home",
      href: "/",
      filePath: "app/page.tsx",
      labelCn: "工作台首页",
      labelEn: "Workspace home",
      focusCn: "生成总览、当前项目入口与交付摘要",
      focusEn: "Generation overview, current app entry, and delivery summary",
      symbols: ["HomePage", "WorkspaceHero", "DeliverySummary"],
      elementsCn: ["入口 Hero", "项目列表", "交付摘要", "升级入口"],
      elementsEn: ["Entry hero", "Project list", "Delivery summary", "Upgrade rail"],
    },
    {
      id: "dashboard",
      href: "/dashboard",
      filePath: "app/dashboard/page.tsx",
      labelCn: "控制台总览",
      labelEn: "Control plane overview",
      focusCn: "应用头部、访问控制、交付与集成状态",
      focusEn: "App header, access controls, delivery, and integration status",
      symbols: ["DashboardPage", "ControlPlaneHeader", "WorkspaceMetrics"],
      elementsCn: ["控制台头部", "指标矩阵", "访问策略卡", "交付轨道"],
      elementsEn: ["Control-plane header", "Metric matrix", "Access policy card", "Delivery rail"],
    },
    {
      id: "editor",
      href: "/editor",
      filePath: "app/editor/page.tsx",
      labelCn: "编辑器工作区",
      labelEn: "Editor workspace",
      focusCn: "文件树、多标签、终端、预览与 AI 助手",
      focusEn: "Explorer, tabs, terminal, preview, and AI assistant",
      symbols: ["EditorPage", "WorkbenchShell", "AssistantRail"],
      elementsCn: ["活动栏", "文件树", "标签栏", "预览摘要"],
      elementsEn: ["Activity bar", "Explorer tree", "Tab strip", "Preview summary"],
    },
    {
      id: "runs",
      href: "/runs",
      filePath: "app/runs/page.tsx",
      labelCn: "运行链路",
      labelEn: "Runtime flow",
      focusCn: "生成、构建、预览、部署与回退",
      focusEn: "Generate, build, preview, deploy, and fallback",
      symbols: ["RunsPage", "RunTimeline", "BuildAcceptanceRail"],
      elementsCn: ["运行列表", "构建日志", "回退守卫", "发布检查"],
      elementsEn: ["Run list", "Build logs", "Fallback guards", "Release checks"],
    },
    {
      id: "templates",
      href: "/templates",
      filePath: "app/templates/page.tsx",
      labelCn: "模板轨道",
      labelEn: "Template rails",
      focusCn: "官网、销售、API、社区等生成方向",
      focusEn: "Website, sales, API, community, and other generation tracks",
      symbols: ["TemplatesPage", "TemplateRail", "TrackFilters"],
      elementsCn: ["模板筛选", "模板卡片", "详情面板", "生成入口"],
      elementsEn: ["Template filters", "Template cards", "Detail panel", "Generate entry"],
    },
    {
      id: "pricing",
      href: "/pricing",
      filePath: "app/pricing/page.tsx",
      labelCn: "套餐与升级",
      labelEn: "Plans and upgrades",
      focusCn: "免费版、专业版、精英版能力差异",
      focusEn: "Free, Pro, and Elite capability differences",
      symbols: ["PricingPage", "PlanGrid", "CapabilityComparison"],
      elementsCn: ["套餐卡片", "能力对比表", "升级动作", "推荐说明"],
      elementsEn: ["Plan cards", "Capability table", "Upgrade actions", "Fit narrative"],
    },
    {
      id: "settings",
      href: "/settings",
      filePath: "app/settings/page.tsx",
      labelCn: "环境设置",
      labelEn: "Environment settings",
      focusCn: "部署、数据库、权限、发布通道",
      focusEn: "Deployment, database, access, and publish lane",
      symbols: ["SettingsPage", "DeploymentRail", "AccessPolicyPanel"],
      elementsCn: ["部署轨道", "数据库轨道", "权限策略", "发布通道"],
      elementsEn: ["Deployment rail", "Database rail", "Access policy", "Publish lane"],
    },
  ]

  if (spec.features?.includes("analytics_page")) {
    routes.push({
      id: "analytics",
      href: "/analytics",
      filePath: "app/analytics/page.tsx",
      labelCn: "分析页",
      labelEn: "Analytics",
      focusCn: "趋势、运行表现与业务指标",
      focusEn: "Trends, runtime health, and product metrics",
      symbols: ["AnalyticsPage", "TrendBoard", "HealthMetrics"],
      elementsCn: ["趋势总览", "健康指标", "异常列表", "对比窗口"],
      elementsEn: ["Trend overview", "Health metrics", "Incident list", "Comparison window"],
    })
  }

  if (spec.features?.includes("about_page")) {
    routes.push({
      id: "about",
      href: "/about",
      filePath: "app/about/page.tsx",
      labelCn: "说明页",
      labelEn: "About",
      focusCn: "产品说明、启用能力与模块说明",
      focusEn: "Product notes, enabled features, and module explanation",
      symbols: ["AboutPage", "FeatureNotes", "ModuleSummary"],
      elementsCn: ["产品说明", "能力清单", "模块摘要", "交付边界"],
      elementsEn: ["Product brief", "Capability list", "Module summary", "Delivery bounds"],
    })
  }

  return routes
}

export function getLocalizedRouteLabel(route: CodePlatformContextRoute, region: WorkspaceRegion) {
  return region === "cn" ? route.labelCn : route.labelEn
}

export function getLocalizedRouteFocus(route: CodePlatformContextRoute, region: WorkspaceRegion) {
  return region === "cn" ? route.focusCn : route.focusEn
}

export function getLocalizedRouteElements(route: CodePlatformContextRoute, region: WorkspaceRegion) {
  return region === "cn" ? route.elementsCn : route.elementsEn
}

export function findCodePlatformRouteById(routes: CodePlatformContextRoute[], routeId?: string | null) {
  const id = normalizeId(routeId)
  if (!id) return null
  return routes.find((route) => route.id === id) ?? null
}

export function findCodePlatformRouteByFilePath(routes: CodePlatformContextRoute[], filePath?: string | null) {
  const target = normalizeFilePath(filePath)
  if (!target) return null
  return routes.find((route) => normalizeFilePath(route.filePath) === target) ?? null
}

export function findCodePlatformRouteByHref(routes: CodePlatformContextRoute[], route?: string | null) {
  const target = normalizeRoute(route)
  if (!target) return null
  return routes.find((item) => normalizeRoute(item.href) === target) ?? null
}

export function inferCodePlatformPageContext(options: {
  routes: CodePlatformContextRoute[]
  region: WorkspaceRegion
  currentFilePath?: string | null
  currentRoute?: string | null
  activeSection?: string | null
  previewTab?: string | null
}): WorkspacePageContext {
  const { routes, region } = options
  const bySection = findCodePlatformRouteById(routes, options.activeSection)
  const byFile = findCodePlatformRouteByFilePath(routes, options.currentFilePath)
  const byRoute = findCodePlatformRouteByHref(routes, options.currentRoute)
  const byTab = options.previewTab === "code"
    ? findCodePlatformRouteById(routes, "editor")
    : options.previewTab === "dashboard"
      ? findCodePlatformRouteById(routes, normalizeId(options.activeSection) || "dashboard")
      : findCodePlatformRouteById(routes, "home")
  const resolved = bySection ?? byFile ?? byRoute ?? byTab ?? routes[0]

  return {
    id: resolved.id,
    label: getLocalizedRouteLabel(resolved, region),
    route: resolved.href,
    filePath: resolved.filePath,
    focus: getLocalizedRouteFocus(resolved, region),
    symbols: [...resolved.symbols],
    elements: getLocalizedRouteElements(resolved, region),
  }
}

export function inferCodePlatformModuleContext(options: {
  currentFilePath?: string | null
  currentFileSymbols?: WorkspaceSymbolRef[] | null
  currentPage?: WorkspacePageContext | null
  activeSymbolName?: string | null
}): WorkspaceModuleContext {
  const symbols = Array.isArray(options.currentFileSymbols) ? options.currentFileSymbols : []
  const explicitSymbol = String(options.activeSymbolName ?? "").trim()
  const symbolName = explicitSymbol || symbols[0]?.name || ""
  const fallbackName =
    fileNameToModule(options.currentFilePath || "") ||
    options.currentPage?.symbols?.[0] ||
    options.currentPage?.label ||
    "workspace"

  return {
    name: symbolName || fallbackName,
    source: symbolName ? "symbol" : options.currentFilePath ? "file" : "page",
    relatedSymbols: symbols.slice(0, 6).map((item) => item.name).filter(Boolean),
  }
}

export function inferCodePlatformElementContext(options: {
  currentPage?: WorkspacePageContext | null
  activeElementName?: string | null
  previewTab?: string | null
  editorRailLabel?: string | null
  editorBottomTabLabel?: string | null
}): WorkspaceElementContext {
  const explicit = String(options.activeElementName ?? "").trim()
  if (explicit) {
    return {
      name: explicit,
      source: "explicit",
      options: options.currentPage?.elements ?? [],
      detail: options.currentPage?.label,
    }
  }

  if (options.previewTab === "code" && options.editorRailLabel) {
    return {
      name: String(options.editorRailLabel),
      source: "editor_rail",
      options: options.currentPage?.elements ?? [],
      detail: options.editorBottomTabLabel ? `output:${options.editorBottomTabLabel}` : undefined,
    }
  }

  if (options.previewTab === "code" && options.editorBottomTabLabel) {
    return {
      name: String(options.editorBottomTabLabel),
      source: "output_panel",
      options: options.currentPage?.elements ?? [],
      detail: options.currentPage?.label,
    }
  }

  return {
    name: options.currentPage?.elements?.[0] || "Primary surface",
    source: "page",
    options: options.currentPage?.elements ?? [],
    detail: options.currentPage?.focus,
  }
}
