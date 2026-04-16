import path from "path"
import { promises as fs } from "fs"
import { spawn } from "child_process"
import { NextResponse } from "next/server"
import {
  appendProjectHistory,
  createProjectId,
  ensureDir,
  getProject,
  getWorkspacePath,
  reserveProjectSlug,
  resolveProjectPath,
  safeProjectId,
  updateProject,
  upsertProject,
  writeTextFile,
  type Region,
} from "@/lib/project-workspace"
import { requestJsonChatCompletion, resolveAiConfig } from "@/lib/ai-provider"
import { buildAssignedAppUrl } from "@/lib/app-subdomain"
import { buildCanonicalPreviewUrl } from "@/lib/preview-url"
import {
  appendGenerateTaskLog,
  createGenerateTask,
  findLatestTaskByProject,
  getGenerateTask,
  updateGenerateTask,
  type GenerateTask,
  type GenerateAcceptanceReport,
  type GenerateArchetype,
  type GeneratePlanSnapshot,
  type GenerateRequestContext,
  type GenerateWorkflowMode,
} from "@/lib/generate-tasks"
import { buildWorkspaceBootstrap } from "@/lib/workspace-bootstrap"
import {
  buildSpecDrivenWorkspaceFiles,
  createAppSpec,
  finalizeAppSpec,
  getScaffoldArchetype,
  isAdminOpsTaskSpec,
  refreshCodePlatformBlueprintNarrative,
  readProjectSpec,
  writeProjectSpec,
  type AppKind,
  type AppIntent,
  type AppSpec,
  type RouteBlueprint,
  type SpecFeature,
  type VisualSeed,
} from "@/lib/project-spec"
import { getCurrentSession } from "@/lib/auth"
import { getLatestCompletedPayment } from "@/lib/payment-store"
import { getPlanDefinition, getPlanPolicy, getPlanRank, normalizePlanTier, type PlanTier } from "@/lib/plan-catalog"
import { getTemplateById, type TemplatePreviewStyle } from "@/lib/template-catalog"
import {
  getDatabaseEnvGuide,
  getDatabaseOption,
  getDefaultDatabaseTarget,
  getDefaultDeploymentTarget,
  getDeploymentEnvGuide,
  getDeploymentOption,
  normalizeDatabaseTarget,
  normalizeDeploymentTarget,
  type DatabaseTarget,
  type DeploymentTarget,
} from "@/lib/fullstack-targets"
import { getDefaultPreviewMode } from "@/lib/sandbox-preview"
import {
  buildCodePlatformContextRoutes,
  inferCodePlatformElementContext,
  inferCodePlatformModuleContext,
  inferCodePlatformPageContext,
  type WorkspaceElementContext,
  type WorkspaceModuleContext,
  type WorkspacePageContext,
  type WorkspaceSessionContext,
} from "@/lib/workspace-ai-context"

export const runtime = "nodejs"
const STALE_TASK_MS = 8 * 60 * 1000
const BUILDER_STALL_MS = 60 * 1000
const BUILDER_TIMEOUT_MS = 55 * 1000
const BUILDER_RETRY_TIMEOUT_MS = 35 * 1000
const BUILDER_POLISH_TIMEOUT_MS = 22 * 1000
const PLANNER_TIMEOUT_MS = 30 * 1000
const BUILDER_WATCHDOG_MS = BUILDER_TIMEOUT_MS + BUILDER_RETRY_TIMEOUT_MS + BUILDER_POLISH_TIMEOUT_MS + 20 * 1000

function shouldInlineGenerateWorker() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
}

function buildProjectPreviewPath(projectId: string) {
  return buildCanonicalPreviewUrl(projectId)
}

function slugifyProjectName(input?: string | null) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function humanizePlannerPage(page: string, region: Region) {
  const isCn = region === "cn"
  const labels: Record<string, string> = isCn
    ? {
        dashboard: "控制台",
        editor: "编辑器",
        runs: "运行",
        templates: "模板库",
        pricing: "定价",
        settings: "设置",
        leads: "线索",
        pipeline: "商机阶段",
        customers: "客户",
        automations: "自动化",
        reports: "报表",
        endpoints: "接口",
        logs: "日志",
        auth: "鉴权",
        environments: "环境",
        webhooks: "Webhook",
        feedback: "反馈",
        roadmap: "路线图",
        posts: "帖子",
        members: "成员",
        events: "活动",
        website: "官网",
        downloads: "下载",
        docs: "文档",
        changelog: "更新日志",
        admin: "分发后台",
        tasks: "任务",
        approvals: "审批",
        analytics: "分析",
      }
    : {
        dashboard: "dashboard",
        editor: "editor",
        runs: "runs",
        templates: "templates",
        pricing: "pricing",
        settings: "settings",
        leads: "leads",
        pipeline: "pipeline",
        customers: "customers",
        automations: "automations",
        reports: "reports",
        endpoints: "endpoints",
        logs: "logs",
        auth: "auth",
        environments: "environments",
        webhooks: "webhooks",
        feedback: "feedback",
        roadmap: "roadmap",
        posts: "posts",
        members: "members",
        events: "events",
        website: "website",
        downloads: "downloads",
        docs: "docs",
        changelog: "changelog",
        admin: "admin",
        tasks: "tasks",
        approvals: "approvals",
        analytics: "analytics",
      }
  return labels[page] || page
}

function describePlannerPages(pages: string[], region: Region, limit = 5) {
  const picked = pages.slice(0, limit).map((page) => humanizePlannerPage(page, region))
  return picked.join(region === "cn" ? "、" : ", ")
}

function inferPlannerProductName(productType: PlannerProductType, prompt: string, region: Region) {
  const explicit = deriveProjectHeadline(prompt)
  if (explicit && !/^build a |^create a |^做一个|^搭一个|^做一套/i.test(explicit)) {
    return explicit
  }

  if (productType === "ai_code_platform") {
    return /morncursor/i.test(prompt) ? "MornCursor" : "MornCursor"
  }
  if (productType === "crm_workspace") {
    return region === "cn" ? "销售增长台" : "Revenue Pilot"
  }
  if (productType === "api_platform") {
    return region === "cn" ? "接口运行台" : "API Console"
  }
  if (productType === "community_hub") {
    return region === "cn" ? "社区反馈站" : "Community Loop"
  }
  if (productType === "content_site") {
    return region === "cn" ? "增长官网站" : "LaunchPad"
  }
  return region === "cn" ? "运营协作台" : "Ops Desk"
}

function buildPlannerSummary(productType: PlannerProductType, pages: string[], deploymentTarget: DeploymentTarget, databaseTarget: DatabaseTarget, region: Region) {
  const routeSummary = describePlannerPages(pages, region)
  if (region === "cn") {
    if (productType === "ai_code_platform") {
      return `已规划为 AI 代码平台，当前主入口包括 ${routeSummary}，默认接入 ${deploymentTarget} + ${databaseTarget}。`
    }
    if (productType === "crm_workspace") {
      return `已规划为 CRM 工作台，当前主入口包括 ${routeSummary}，重点承接销售推进、客户视图与报表能力。`
    }
    if (productType === "api_platform") {
      return `已规划为 API 平台，当前主入口包括 ${routeSummary}，重点承接接口目录、日志、鉴权与环境管理。`
    }
    if (productType === "community_hub") {
      return `已规划为社区产品，当前主入口包括 ${routeSummary}，重点承接帖子、反馈、成员与路线图运营。`
    }
    if (productType === "content_site") {
      return `已规划为官网与下载产品，当前主入口包括 ${routeSummary}，重点承接官网叙事、下载转化与分发后台。`
    }
    return `已规划为内部工作台，当前主入口包括 ${routeSummary}。`
  }

  if (productType === "ai_code_platform") {
    return `Planned as an AI coding platform with ${routeSummary} on ${deploymentTarget} + ${databaseTarget}.`
  }
  if (productType === "crm_workspace") {
    return `Planned as a CRM workspace with ${routeSummary}, focusing on pipeline control, account views, and reporting.`
  }
  if (productType === "api_platform") {
    return `Planned as an API platform with ${routeSummary}, focusing on endpoints, logs, access, and environment operations.`
  }
  if (productType === "community_hub") {
    return `Planned as a community product with ${routeSummary}, covering posts, feedback, members, and roadmap operations.`
  }
  if (productType === "content_site") {
    return `Planned as a website and download product with ${routeSummary}, connecting conversion, docs, and distribution.`
  }
  return `Planned as an internal workspace with ${routeSummary}.`
}

type GeneratedFile = {
  path: string
  content: string
}

type GeneratorModelOutput = {
  summary: string
  files: GeneratedFile[]
}

type GenerateTaskRecord = GenerateTask & {
  rawPrompt?: string
  templateId?: string
  templateTitle?: string
}

type WorkspaceBuildResult = {
  status: "ok" | "failed" | "skipped"
  logs: string[]
}

type PlannerProductType =
  | "ai_code_platform"
  | "crm_workspace"
  | "api_platform"
  | "community_hub"
  | "content_site"
  | "task_workspace"

type PlannerSpec = {
  productName: string
  productType: PlannerProductType
  targetLocale: "zh-CN" | "en-US"
  style: {
    theme: "dark" | "light"
    tone: string
    market: "china" | "global"
  }
  pages: string[]
  layout: {
    editor?: string[]
  }
  aiTools: string[]
  templates: string[]
  plans: string[]
  deploymentDefaults: {
    cn: [string, string]
    global: [string, string]
  }
  preferredScaffold: string
  summary: string
}

type RegionDefaults = {
  language: "zh-CN" | "en-US"
  timezone: string
  dateFormat: string
  currency: "CNY" | "USD"
  labels: {
    title: string
    subtitle: string
    taskTitle: string
    assignee: string
    create: string
    creating: string
    filter: string
    todo: string
    inProgress: string
    done: string
    priority: string
    localeInfo: string
    monthlyTarget: string
  }
  seedTasks: Array<{
    title: string
    description: string
    assignee: string
    priority: "low" | "medium" | "high"
    status: "todo" | "in_progress" | "done"
  }>
}

type GenerateContextKind = AppKind | "workspace"

function getRegionDefaults(region: Region): RegionDefaults {
  if (region === "cn") {
    return {
      language: "zh-CN",
      timezone: "Asia/Shanghai",
      dateFormat: "YYYY/MM/DD",
      currency: "CNY",
      labels: {
        title: "生成任务工作台",
        subtitle: "多地区默认配置演示：语言/时区/日期/货币/种子数据",
        taskTitle: "任务标题",
        assignee: "负责人",
        create: "创建",
        creating: "创建中...",
        filter: "按负责人筛选",
        todo: "待办",
        inProgress: "进行中",
        done: "完成",
        priority: "优先级",
        localeInfo: "区域配置",
        monthlyTarget: "月度目标",
      },
      seedTasks: [
        { title: "联系潜在客户", description: "首轮电话沟通", assignee: "张伟", priority: "high", status: "todo" },
        { title: "准备产品演示", description: "整理案例与报价", assignee: "王芳", priority: "medium", status: "in_progress" },
        { title: "签约回访", description: "确认合同归档", assignee: "李雷", priority: "low", status: "done" },
      ],
    }
  }
  return {
    language: "en-US",
    timezone: "America/Los_Angeles",
    dateFormat: "MM/DD/YYYY",
    currency: "USD",
    labels: {
      title: "Generated Task Workspace",
      subtitle: "Region-aware defaults: language/timezone/date/currency/seed data",
      taskTitle: "Task title",
      assignee: "Assignee",
      create: "Create",
      creating: "Creating...",
      filter: "Filter by assignee",
      todo: "Todo",
      inProgress: "In Progress",
      done: "Done",
      priority: "Priority",
      localeInfo: "Region Config",
      monthlyTarget: "Monthly target",
    },
    seedTasks: [
      { title: "Reach out to inbound lead", description: "Intro call and qualification", assignee: "Liam", priority: "high", status: "todo" },
      { title: "Prepare demo deck", description: "Add ROI section for prospect", assignee: "Emma", priority: "medium", status: "in_progress" },
      { title: "Contract handoff", description: "Sync with legal and finance", assignee: "Noah", priority: "low", status: "done" },
    ],
  }
}

function sanitizeUiText(input: string) {
  return input.replace(/[<>`{}]/g, "").replace(/\s+/g, " ").trim()
}

function normalizeTextValue(value: unknown) {
  return sanitizeUiText(String(value ?? "")).trim()
}

function normalizePath(p: string) {
  return p.replace(/\\/g, "/").replace(/^\/+/, "")
}

function normalizePositiveInteger(value: unknown) {
  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized <= 0) return undefined
  return Math.floor(normalized)
}

function normalizeContextPath(value?: unknown) {
  const normalized = normalizePath(String(value ?? ""))
  return isAllowedFile(normalized) ? normalized : ""
}

function isAllowedFile(relativePath: string) {
  const normalized = normalizePath(relativePath)
  if (!normalized || normalized.includes("..")) return false
  if (normalized.startsWith("node_modules/") || normalized.startsWith(".next/") || normalized.startsWith(".git/")) {
    return false
  }
  return true
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

function normalizePageContext(value: unknown): WorkspacePageContext | undefined {
  if (!value || typeof value !== "object") return undefined
  const page = value as Record<string, unknown>
  const id = normalizeTextValue(page.id).toLowerCase()
  const label = normalizeTextValue(page.label)
  const route = String(page.route ?? "").trim()
  const filePath = normalizeContextPath(page.filePath)
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

function hasIncomingGenerateWorkspaceAnchor(body: any, incomingSession?: WorkspaceSessionContext) {
  const hasOpenTabs = Array.isArray(body?.openTabs) && body.openTabs.some((item: unknown) => normalizeContextPath(item))
  const hasRelatedPaths =
    Array.isArray(body?.relatedPaths) && body.relatedPaths.some((item: unknown) => normalizeContextPath(item))

  return Boolean(
    normalizeContextPath(body?.currentFilePath) ||
      (typeof body?.currentRoute === "string" && body.currentRoute.trim()) ||
      normalizePageContext(body?.currentPage) ||
      normalizeModuleContext(body?.currentModule) ||
      normalizeElementContext(body?.currentElement) ||
      hasOpenTabs ||
      hasRelatedPaths ||
      incomingSession?.workspaceSurface ||
      incomingSession?.activeSection ||
      incomingSession?.routeId ||
      incomingSession?.routeLabel ||
      incomingSession?.filePath ||
      incomingSession?.symbolName ||
      incomingSession?.elementName ||
      incomingSession?.lastChangedFile
  )
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

function normalizeGenerateContextKind(value: string): GenerateContextKind {
  if (value === "code_platform" || value === "crm" || value === "blog" || value === "community" || value === "task") {
    return value
  }
  return "workspace"
}

function resolveContextAppKind(prompt: string, context?: GenerateRequestContext): AppKind {
  const sessionKind = normalizeGenerateContextKind(normalizeTextValue(context?.sharedSession?.specKind).toLowerCase())
  if (sessionKind !== "workspace") return sessionKind

  const section = normalizeTextValue(context?.sharedSession?.activeSection || context?.currentPage?.id).toLowerCase()
  const surface = normalizeTextValue(context?.sharedSession?.workspaceSurface).toLowerCase()
  const filePath = normalizeContextPath(context?.currentFilePath || context?.sharedSession?.filePath)
  const route = String(context?.currentRoute || context?.currentPage?.route || "").toLowerCase()

  if (
    surface === "code" ||
    section === "editor" ||
    ["dashboard", "editor", "runs", "templates", "pricing", "settings"].includes(section) ||
    /app\/(dashboard|editor|runs|templates|pricing|settings)\/page\.(tsx|jsx)$/.test(filePath) ||
    /^\/(dashboard|editor|runs|templates|pricing|settings)$/.test(route)
  ) {
    return "code_platform"
  }

  return inferAppKind(prompt)
}

function shouldUseSpecializedWorkspaceTemplateIsolation(prompt: string) {
  return (
    looksLikeSpecializedWorkspacePrompt(prompt) &&
    !looksLikeMarketingDistributionPrompt(prompt) &&
    !looksLikeApiPlatformPrompt(prompt) &&
    !looksLikeCodePlatformPrompt(prompt)
  )
}

function resolveTemplateId(prompt: string, context?: GenerateRequestContext) {
  if (shouldUseSpecializedWorkspaceTemplateIsolation(prompt)) return undefined
  const selectedTemplate = normalizeTextValue(context?.sharedSession?.selectedTemplate).toLowerCase()
  if (selectedTemplate) {
    if (selectedTemplate.includes("siteforge")) return "siteforge"
    if (selectedTemplate.includes("opsdesk")) return "opsdesk"
    if (selectedTemplate.includes("taskflow")) return "taskflow"
    if (selectedTemplate.includes("orbital")) return "orbital"
    if (selectedTemplate.includes("launchpad")) return "launchpad"
  }
  return inferTemplateIdFromPrompt(prompt)
}

function looksLikeCodePlatformPrompt(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  const explicitApiSignals =
    /api|sdk|developer portal|endpoint|endpoints|auth|oauth|token|environment|environments|webhook|webhooks|logs|observability|monitoring|usage|metering|billing|开放平台|接口平台|接口|监控|日志|鉴权|令牌|环境|用量|计费|网关|回调/.test(
      text
    )
  const explicitCodeSignals =
    /cursor|code editor|coding workspace|ai coding|代码编辑器|编程平台|代码平台|代码工作台|开发者工作台|开发者平台|全栈平台|全栈应用生成器|应用生成器|代码助手|base44|app builder|ai app builder|builder workspace|code builder|代码生成平台|ai 编码平台|ai 代码平台|ai 工作台/.test(
      text
    )
  const ideSignals = /\bide\b|editor|file tree|multi-tab|live preview|publish control|模板库|文件树|多标签|实时预览|发布控制|代码标签|代码预览/.test(text)
  if (explicitApiSignals && !ideSignals && !explicitCodeSignals) return false
  return explicitCodeSignals || ideSignals
}

function looksLikeApiPlatformPrompt(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  return /api|sdk|developer portal|endpoint|endpoints|auth|oauth|token|environment|environments|webhook|webhooks|logs|observability|monitoring|usage|metering|billing|开放平台|接口平台|开发者门户|接口|端点|监控|日志|鉴权|令牌|环境|用量|计费|限流|网关|回调|调用量/.test(
    text
  )
}

function looksLikeAdminOpsPrompt(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  return /admin|ops|internal tool|backoffice|back office|control plane|approval|approvals|role-based|permission|permissions|access|audit|incident|incidents|compliance|security|workspace admin|管理后台|后台系统|运维后台|运营后台|内部工具|内控平台|审批|审批流|工单|控制台|权限|角色|审计|告警|故障|合规|安全|策略|风控/.test(
    text
  )
}

function looksLikeMarketingDistributionPrompt(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  return /website|landing|homepage|download|downloads|docs|documentation|devices|device|distribution|installer|ios|android|desktop|mac|windows|官网|产品官网|产品站|落地页|下载|下载中心|下载站|文档|帮助中心|设备|分发|安装包|安装说明|桌面端|更新日志|发布页/.test(
    text
  )
}

function looksLikeCommunityPrompt(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  return /community|club|social|group|announcement|event|feedback|roadmap|moderation|member|members|vote|wishlist|forum|forums|post|posts|comment|comments|社区|社团|社交|论坛|帖子|评论|公告|活动|反馈|建议箱|路线图|审核|治理|成员|投票/.test(
    text
  )
}

function looksLikeEventDrivenCommunityPrompt(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  return /event|events|webinar|webinars|meetup|meetups|session|sessions|registration|registrations|agenda|speaker|ambassador|advocate|invite|invites|member segment|membership tier|活动|直播|会议|报名|议程|讲者|大使|邀请|分层|会员/.test(
    text
  )
}

function looksLikeSpecializedWorkspacePrompt(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  return /health|healthcare|medical|clinic|patient|doctor|hospital|appointment|care plan|nurse|医疗|健康|诊所|门诊|患者|医生|医院|预约|病历|护理|复诊|随访|分诊|education|course|student|assignment|school|learning|课程|学生|作业|学校|学习|排课|教务|finance|bank|ledger|transaction|reconciliation|invoice|金融|银行|账本|交易|对账|发票|账务|recruit|hiring|candidate|interview|job role|talent|offer|ats|招聘|候选人|面试|岗位|人才|录用|简历|support|ticket|helpdesk|sla|knowledge base|customer case|escalation|客服|售后|工单|帮助台|知识库|服务等级|客诉|commerce|ecommerce|store|sku|inventory|fulfillment|warehouse|电商|店铺|库存|履约|仓库|订单/.test(
    text
  )
}

function getSpecializedWorkspaceFlavor(prompt: string, region: Region) {
  const text = String(prompt ?? "").toLowerCase()
  const isCn = region === "cn"
  if (/health|healthcare|medical|clinic|patient|doctor|hospital|appointment|care plan|nurse|医疗|健康|诊所|门诊|患者|医生|医院|预约|病历|护理|复诊|随访|分诊/.test(text)) {
    return {
      category: isCn ? "医疗运营工作台" : "Healthcare operations workspace",
      tone: isCn ? "医疗护理运营工作台" : "Clinical care operations workspace",
      modules: isCn ? ["患者队列", "预约排程", "护理计划", "风险预警"] : ["Patient queue", "Appointment scheduling", "Care plans", "Risk alerts"],
      jobs: isCn ? ["管理患者队列", "安排预约", "跟进护理计划"] : ["Manage patient queues", "schedule appointments", "track care plans"],
      workflow: isCn ? "患者 -> 预约 -> 护理计划 -> 风险跟进" : "Patient -> appointment -> care plan -> risk follow-up",
    }
  }
  if (/recruit|hiring|candidate|interview|job role|talent|offer|ats|招聘|候选人|面试|岗位|人才|录用|简历/.test(text)) {
    return {
      category: isCn ? "招聘人才工作台" : "Recruiting and talent workspace",
      tone: isCn ? "招聘人才运营工作台" : "Talent pipeline workspace",
      modules: isCn ? ["候选人池", "岗位需求", "面试排程", "Offer 审批"] : ["Candidate pool", "Role planning", "Interview scheduling", "Offer approvals"],
      jobs: isCn ? ["管理候选人", "安排面试", "推进 offer 审批"] : ["Manage candidates", "schedule interviews", "advance offer approvals"],
      workflow: isCn ? "候选人 -> 岗位 -> 面试 -> offer 审批" : "Candidate -> role -> interview -> offer approval",
    }
  }
  if (/support|ticket|helpdesk|sla|knowledge base|customer case|escalation|客服|售后|工单|帮助台|知识库|服务等级|客诉/.test(text)) {
    return {
      category: isCn ? "客服工单工作台" : "Support and ticketing workspace",
      tone: isCn ? "客服 SLA 工单工作台" : "Support SLA command center",
      modules: isCn ? ["工单队列", "客户案例", "SLA 升级", "知识库"] : ["Ticket queue", "Customer cases", "SLA escalation", "Knowledge base"],
      jobs: isCn ? ["处理工单", "同步客户案例", "维护知识库"] : ["Resolve tickets", "sync customer cases", "maintain knowledge base"],
      workflow: isCn ? "工单 -> 客户案例 -> 升级 -> 知识库沉淀" : "Ticket -> customer case -> escalation -> knowledge base",
    }
  }
  if (/commerce|ecommerce|store|sku|inventory|fulfillment|warehouse|电商|店铺|库存|履约|仓库|订单/.test(text)) {
    return {
      category: isCn ? "电商运营工作台" : "Commerce operations workspace",
      tone: isCn ? "库存履约运营工作台" : "Inventory and fulfillment workspace",
      modules: isCn ? ["SKU 管理", "库存水位", "履约订单", "补货预警"] : ["SKU management", "Inventory levels", "Fulfillment orders", "Reorder alerts"],
      jobs: isCn ? ["管理 SKU", "跟踪库存", "推进履约订单"] : ["Manage SKUs", "track inventory", "advance fulfillment orders"],
      workflow: isCn ? "SKU -> 库存 -> 履约订单 -> 供应商交接" : "SKU -> inventory -> fulfillment order -> supplier handoff",
    }
  }
  if (/finance|bank|ledger|transaction|reconciliation|invoice|金融|银行|账本|交易|对账|发票|账务/.test(text)) {
    return {
      category: isCn ? "金融财务控制台" : "Finance operations console",
      tone: isCn ? "金融对账控制台" : "Finance reconciliation console",
      modules: isCn ? ["账本视图", "交易流水", "对账队列", "异常处理"] : ["Ledger view", "Transaction feed", "Reconciliation queue", "Exception handling"],
      jobs: isCn ? ["维护账本", "核对交易", "处理异常"] : ["Maintain ledgers", "reconcile transactions", "resolve exceptions"],
      workflow: isCn ? "账本 -> 交易 -> 对账 -> 异常处理" : "Ledger -> transaction -> reconciliation -> exception handling",
    }
  }
  if (/education|course|student|assignment|school|learning|课程|学生|作业|学校|学习|排课|教务/.test(text)) {
    return {
      category: isCn ? "教育学习工作台" : "Education and learning workspace",
      tone: isCn ? "教育课程运营工作台" : "Learning operations workspace",
      modules: isCn ? ["课程目录", "学生进度", "作业流", "学习反馈"] : ["Course catalog", "Student progress", "Assignment flow", "Learning feedback"],
      jobs: isCn ? ["管理课程", "跟踪学生", "安排作业"] : ["Manage courses", "track students", "coordinate assignments"],
      workflow: isCn ? "课程 -> 学生 -> 作业 -> 学习反馈" : "Course -> student -> assignment -> learning feedback",
    }
  }
  return null
}

function shouldPreferAdminOpsOverCrm(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  if (!looksLikeAdminOpsPrompt(text)) return false
  if (looksLikeMarketingDistributionPrompt(text)) return false
  if (looksLikeCommunityPrompt(text)) return false
  if (looksLikeSpecializedWorkspacePrompt(text)) return false
  return !/crm|customer|sales|pipeline|deal|deals|quote|quotes|renewal|renewals|account executive|account executives|客户|销售|线索|商机|报价|报价单|订单审批|续约|客户成功/.test(
    text
  )
}

function inferPromptOnlyPlannerProductType(prompt: string): PlannerProductType {
  const text = String(prompt ?? "").toLowerCase()
  if (looksLikeApiPlatformPrompt(text)) {
    return "api_platform"
  }
  if (looksLikeCodePlatformPrompt(text)) {
    return "ai_code_platform"
  }
  if (looksLikeMarketingDistributionPrompt(text)) {
    return "content_site"
  }
  if (looksLikeSpecializedWorkspacePrompt(text)) {
    return "task_workspace"
  }
  if (looksLikeCommunityPrompt(text)) {
    return "community_hub"
  }
  if (shouldPreferAdminOpsOverCrm(text)) {
    return "task_workspace"
  }
  if (/crm|customer|sales|pipeline|lead|lead management|customer success|renewal|quote|quotes|客户|销售|线索|跟进|商机|客户成功|续约|报价/.test(text)) {
    return "crm_workspace"
  }
  if (/website|landing|homepage|download|downloads|documentation|docs|marketing|brand|官网|下载站|落地页|下载页|文档|品牌|增长/.test(text)) {
    return "content_site"
  }
  if (/admin|ops|internal tool|backoffice|back office|control plane|管理后台|运营后台|内部工具|审批|工单|控制台/.test(text)) {
    return "task_workspace"
  }
  return "task_workspace"
}

function resolvePlannerProductType(prompt: string, context?: GenerateRequestContext): PlannerProductType {
  const kind = resolveContextAppKind(prompt, context)
  if (looksLikeApiPlatformPrompt(prompt) && kind !== "code_platform") return "api_platform"
  if (kind === "code_platform") return "ai_code_platform"
  if (looksLikeMarketingDistributionPrompt(prompt)) return "content_site"
  if (looksLikeSpecializedWorkspacePrompt(prompt)) return "task_workspace"
  if (looksLikeCommunityPrompt(prompt) || kind === "community") return "community_hub"
  if (shouldPreferAdminOpsOverCrm(prompt)) return "task_workspace"
  if (kind === "crm") return "crm_workspace"
  if (looksLikeApiPlatformPrompt(prompt)) return "api_platform"
  if (looksLikeCodePlatformPrompt(prompt)) return "ai_code_platform"
  if (kind === "blog" || /website|landing|homepage|download|官网|下载站|落地页|文档/i.test(prompt)) return "content_site"
  const promptOnly = inferPromptOnlyPlannerProductType(prompt)
  if (promptOnly !== "task_workspace") return promptOnly
  if (/admin|ops|internal tool|backoffice|back office|control plane|管理后台|运营后台|内部工具|审批|工单|控制台/i.test(prompt)) {
    return "task_workspace"
  }
  return "task_workspace"
}

function resolveGenerateWorkspaceContext(args: {
  body: any
  prompt: string
  region: Region
  planTier: PlanTier
  deploymentTarget: DeploymentTarget
  databaseTarget: DatabaseTarget
  templateId?: string
  templateTitle?: string
}): GenerateRequestContext | undefined {
  const { body, prompt, region, planTier, deploymentTarget, databaseTarget, templateId, templateTitle } = args
  const incomingSession = normalizeSessionContext(body?.sharedSession, region)
  const hasExplicitWorkspaceAnchor = hasIncomingGenerateWorkspaceAnchor(body, incomingSession)
  const planPolicy = getPlanPolicy(planTier)
  const currentFilePath =
    normalizeContextPath(body?.currentFilePath) ||
    normalizeContextPath(incomingSession?.lastChangedFile) ||
    normalizeContextPath(incomingSession?.filePath)
  const currentRoute =
    typeof body?.currentRoute === "string" && body.currentRoute.trim()
      ? body.currentRoute.trim()
      : inferRouteFromFilePath(currentFilePath) || undefined
  const openTabs = Array.isArray(body?.openTabs) ? uniqueContextPaths(body.openTabs.map((item: unknown) => String(item))) : []
  const relatedPaths = uniqueContextPaths([
    currentFilePath,
    ...(Array.isArray(body?.relatedPaths) ? body.relatedPaths.map((item: unknown) => String(item)) : []),
    ...openTabs,
  ])

  const shouldUseCodePlatformContext =
    hasExplicitWorkspaceAnchor &&
    resolveContextAppKind(prompt, {
      currentFilePath,
      currentRoute,
      sharedSession: incomingSession,
    }) === "code_platform"

  const routes = shouldUseCodePlatformContext
    ? buildCodePlatformContextRoutes({
        region,
        features: ["about_page", ...(planTier === "pro" || planTier === "elite" ? ["analytics_page"] : [])],
      })
    : []

  const currentPage =
    normalizePageContext(body?.currentPage) ??
    (shouldUseCodePlatformContext
      ? inferCodePlatformPageContext({
          routes,
          region,
          currentFilePath,
          currentRoute,
          activeSection: incomingSession?.activeSection || incomingSession?.routeId,
          previewTab: incomingSession?.workspaceSurface,
        })
      : undefined)

  const currentModule =
    normalizeModuleContext(body?.currentModule) ??
    (shouldUseCodePlatformContext && currentPage
      ? inferCodePlatformModuleContext({
          currentFilePath,
          currentFileSymbols: [],
          currentPage,
          activeSymbolName: incomingSession?.symbolName,
        })
      : undefined)

  const currentElement =
    normalizeElementContext(body?.currentElement) ??
    (shouldUseCodePlatformContext && currentPage
      ? inferCodePlatformElementContext({
          currentPage,
          activeElementName: incomingSession?.elementName,
          previewTab: incomingSession?.workspaceSurface,
        })
      : undefined)

  const currentKind = resolveContextAppKind(prompt, {
    currentFilePath,
    currentRoute,
    currentPage,
    currentModule,
    currentElement,
    sharedSession: incomingSession,
    openTabs,
    relatedPaths,
  })

  const resolvedSurface =
    incomingSession?.workspaceSurface ||
    (currentPage?.id === "editor" ? "code" : currentPage?.id === "dashboard" ? "dashboard" : undefined) ||
    (currentKind === "code_platform" ? "preview" : undefined)

  if (!hasExplicitWorkspaceAnchor) {
    return undefined
  }

  const resolvedSession: WorkspaceSessionContext = {
    ...incomingSession,
    projectName: incomingSession?.projectName || deriveProjectHeadline(prompt),
    specKind: incomingSession?.specKind || currentKind,
    workspaceSurface: resolvedSurface,
    activeSection: incomingSession?.activeSection || currentPage?.id || undefined,
    routeId: incomingSession?.routeId || currentPage?.id || undefined,
    routeLabel: incomingSession?.routeLabel || currentPage?.label || undefined,
    filePath: currentFilePath || currentPage?.filePath || incomingSession?.filePath,
    symbolName: currentModule?.name || incomingSession?.symbolName || undefined,
    elementName: currentElement?.name || incomingSession?.elementName || undefined,
    deploymentTarget: incomingSession?.deploymentTarget || deploymentTarget,
    databaseTarget: incomingSession?.databaseTarget || databaseTarget,
    region: incomingSession?.region || region,
    selectedPlanId: incomingSession?.selectedPlanId || planTier,
    selectedPlanName:
      incomingSession?.selectedPlanName || getPlanDefinition(planTier)[region === "cn" ? "nameCn" : "nameEn"],
    selectedTemplate: incomingSession?.selectedTemplate || templateTitle || templateId || undefined,
    codeExportAllowed:
      typeof incomingSession?.codeExportAllowed === "boolean"
        ? incomingSession.codeExportAllowed
        : planPolicy.codeExportLevel !== "none",
    codeExportLevel: incomingSession?.codeExportLevel || planPolicy.codeExportLevel,
    databaseAccessMode: incomingSession?.databaseAccessMode || planPolicy.databaseAccessMode,
    generationProfile: incomingSession?.generationProfile || planPolicy.generationProfile,
    routeBudget: incomingSession?.routeBudget || planPolicy.maxGeneratedRoutes,
    moduleBudget: incomingSession?.moduleBudget || planPolicy.maxGeneratedModules,
    projectLimit: incomingSession?.projectLimit || planPolicy.projectLimit,
    collaboratorLimit: incomingSession?.collaboratorLimit || planPolicy.collaboratorLimit,
    subdomainSlots: incomingSession?.subdomainSlots || planPolicy.subdomainSlots,
    assignedDomain:
      incomingSession?.assignedDomain ||
      buildAssignedAppUrl({
        projectSlug: deriveProjectHeadline(prompt),
        region,
        planTier,
      }),
    workspaceStatus: incomingSession?.workspaceStatus || "queued",
    lastIntent: incomingSession?.lastIntent || sanitizeUiText(prompt).slice(0, 240),
    lastChangedFile: incomingSession?.lastChangedFile || currentFilePath || currentPage?.filePath,
    lastChangedAt: incomingSession?.lastChangedAt,
    readiness: incomingSession?.readiness || "context_ready",
  }

  const hasContext =
    Boolean(currentFilePath) ||
    Boolean(currentRoute) ||
    Boolean(currentPage) ||
    Boolean(currentModule) ||
    Boolean(currentElement) ||
    Boolean(resolvedSession.projectName) ||
    openTabs.length > 0 ||
    relatedPaths.length > 0

  if (!hasContext) return undefined

  return {
    currentFilePath: currentFilePath || undefined,
    currentRoute: currentRoute || undefined,
    currentPage,
    currentModule,
    currentElement,
    sharedSession: resolvedSession,
    openTabs: openTabs.length ? openTabs : undefined,
    relatedPaths: relatedPaths.length ? relatedPaths : undefined,
  }
}

function buildGenerateContextSummary(context?: GenerateRequestContext, region: Region = "intl") {
  if (!context) return ""
  if (!hasMeaningfulGenerateContext(context)) return ""
  const parts = [
    context.sharedSession?.workspaceSurface,
    context.currentPage?.label || context.sharedSession?.routeLabel,
    context.currentModule?.name || context.sharedSession?.symbolName,
    context.currentElement?.name || context.sharedSession?.elementName,
  ].filter(Boolean)
  if (!parts.length) {
    return context.currentFilePath || context.sharedSession?.filePath || (region === "cn" ? "当前工作区" : "the current workspace")
  }
  return parts.join(" / ")
}

function serializeGenerateContextForPrompt(context?: GenerateRequestContext) {
  if (!context) return ""

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
    : ""

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
    : ""

  const currentElementMeta = context.currentElement
    ? [
        `Current element: ${context.currentElement.name}`,
        `Element source: ${context.currentElement.source}`,
        context.currentElement.detail ? `Element detail: ${context.currentElement.detail}` : "",
        context.currentElement.options.length ? `Available elements: ${context.currentElement.options.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : ""

  const sessionMeta = context.sharedSession
    ? [
        context.sharedSession.projectName ? `Project name: ${context.sharedSession.projectName}` : "",
        context.sharedSession.specKind ? `Workspace kind: ${context.sharedSession.specKind}` : "",
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
        typeof context.sharedSession.codeExportAllowed === "boolean"
          ? `Code export allowed: ${context.sharedSession.codeExportAllowed ? "yes" : "no"}`
          : "",
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
        context.sharedSession.lastChangedFile ? `Last changed file: ${context.sharedSession.lastChangedFile}` : "",
        context.sharedSession.readiness ? `Session readiness: ${context.sharedSession.readiness}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : ""

  return [
    context.currentFilePath ? `Current file: ${context.currentFilePath}` : "",
    context.currentRoute ? `Current route: ${context.currentRoute}` : "",
    currentPageMeta,
    currentModuleMeta,
    currentElementMeta,
    sessionMeta,
    context.openTabs?.length ? `Open tabs: ${context.openTabs.join(", ")}` : "",
    context.relatedPaths?.length ? `Related files: ${context.relatedPaths.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}

function hasMeaningfulGenerateContext(context?: GenerateRequestContext) {
  return Boolean(
    context?.currentFilePath ||
      context?.currentRoute ||
      context?.currentPage ||
      context?.currentModule ||
      context?.currentElement ||
      context?.sharedSession?.specKind ||
      context?.sharedSession?.workspaceSurface ||
      (context?.openTabs?.length ?? 0) > 0 ||
      (context?.relatedPaths?.length ?? 0) > 0
  )
}

function shouldUseDeterministicGeneratePath(args: {
  plannerProductType: PlannerProductType
  workflowMode: GenerateWorkflowMode
  planTier: PlanTier
  context?: GenerateRequestContext
}) {
  if (args.workflowMode === "discuss") return true
  if (!getPlanPolicy(args.planTier).aiBuilderEnabled) return true
  if (hasMeaningfulGenerateContext(args.context) && args.workflowMode === "edit_context") {
    return false
  }
  return false
}

function normalizeGenerateWorkflowMode(input: unknown, context?: GenerateRequestContext): GenerateWorkflowMode {
  const value = String(input ?? "").trim().toLowerCase()
  if (value === "act" || value === "discuss" || value === "edit_context") {
    return value
  }
  return hasMeaningfulGenerateContext(context) ? "edit_context" : "act"
}

function resolveSpecializedGenerateArchetype(text: string): GenerateArchetype | null {
  if (/health|healthcare|medical|clinic|patient|doctor|hospital|appointment|care plan|nurse|医疗|健康|诊所|门诊|患者|医生|医院|预约|病历|护理|复诊|随访|分诊/.test(text)) {
    return "healthcare"
  }
  if (/education|course|student|assignment|school|learning|class|lesson|teacher|课程|学生|作业|学校|学习|排课|教务|班级|老师|教学/.test(text)) {
    return "education"
  }
  if (/finance|financial|bank|ledger|transaction|reconciliation|invoice|expense|portfolio|金融|财务|银行|账本|交易|对账|发票|账务|费用|投资组合/.test(text)) {
    return "finance"
  }
  if (/recruit|hiring|candidate|interview|job role|talent|offer|ats|resume|招聘|候选人|面试|岗位|人才|录用|简历/.test(text)) {
    return "recruiting"
  }
  if (/support|ticket|helpdesk|sla|knowledge base|customer case|escalation|客服|售后|工单|帮助台|知识库|服务等级|客诉/.test(text)) {
    return "support"
  }
  if (/commerce|ecommerce|store|sku|inventory|fulfillment|warehouse|merchant|retail|电商|商城|店铺|库存|商品|履约|仓库|订单|零售|商家/.test(text)) {
    return "commerce_ops"
  }
  return null
}

function resolveGenerateArchetype(
  prompt: string,
  plannerProductType: PlannerProductType,
  context?: GenerateRequestContext
): GenerateArchetype {
  if (plannerProductType === "ai_code_platform") return "code_platform"
  if (plannerProductType === "crm_workspace") return "crm"
  if (plannerProductType === "api_platform") return "api_platform"
  if (plannerProductType === "community_hub") return "community"
  if (plannerProductType === "content_site") return "website_landing_download"

  const text = [
    prompt,
    context?.sharedSession?.activeSection,
    context?.sharedSession?.routeLabel,
    context?.currentPage?.label,
    context?.currentModule?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (plannerProductType === "task_workspace") {
    const specialized = resolveSpecializedGenerateArchetype(text)
    if (specialized) return specialized
  }

  if (/admin|ops|internal tool|backoffice|back office|console|control plane|管理后台|运营后台|内部工具|审批|工单|控制台/.test(text)) {
    return "admin_ops_internal_tool"
  }
  return "admin_ops_internal_tool"
}

function buildPlannerSnapshot(args: {
  planner: PlannerSpec
  plannedSpec: AppSpec
  workflowMode: GenerateWorkflowMode
  archetype: GenerateArchetype
  deploymentTarget: DeploymentTarget
  databaseTarget: DatabaseTarget
  context?: GenerateRequestContext
}): GeneratePlanSnapshot {
  const { planner, plannedSpec, workflowMode, archetype, deploymentTarget, databaseTarget, context } = args
  const planPolicy = getPlanPolicy(plannedSpec.planTier)
  const routeMap = planner.pages.map((page) => {
    const normalized = sanitizeUiText(page).toLowerCase()
    if (!normalized || normalized === "home") return "/"
    return normalized.startsWith("/") ? normalized : `/${normalized}`
  })
  const taskPlan = [
    ...routeMap.slice(0, 4).map((route) => `Ship ${route} as a first-class route`),
    ...plannedSpec.modules.slice(0, 4).map((moduleName) => `Wire ${moduleName} into the primary workflow`),
  ].slice(0, 6)
  const guardrails = [
    workflowMode === "discuss"
      ? "Discuss mode stops at plan/spec and skips workspace code writes"
      : "Keep the first delivery app-grade instead of a poster-like demo",
    planner.productType === "ai_code_platform"
      ? "Preserve the Preview / Dashboard / Code workspace thread"
      : "Keep navigation, settings, and delivery affordances connected",
    "Do not expose premium capabilities that the selected plan does not unlock",
  ]
  const constraints = [
    `Deployment target: ${deploymentTarget}`,
    `Database target: ${databaseTarget}`,
    `Plan tier ${plannedSpec.planTier} keeps generation=${planPolicy.generationProfile}, AI builder=${planPolicy.aiBuilderEnabled ? "enabled" : "disabled"}, code export=${planPolicy.codeExportLevel}, database=${planPolicy.databaseAccessMode}, route budget=${planPolicy.maxGeneratedRoutes}, module budget=${planPolicy.maxGeneratedModules}, project limit=${planPolicy.projectLimit}, collaborator limit=${planPolicy.collaboratorLimit}, subdomains=${planPolicy.subdomainSlots}`,
    context?.sharedSession?.assignedDomain ? `Assigned domain: ${context.sharedSession.assignedDomain}` : "",
  ]
  return {
    workflowMode,
    productName: planner.productName,
    productType: planner.productType,
    archetype,
    summary: planner.summary,
    pages: planner.pages,
    routeMap,
    modules: plannedSpec.modules,
    aiTools: planner.aiTools,
    taskPlan,
    guardrails,
    constraints,
    deploymentTarget,
    databaseTarget,
  }
}

function plannerSnapshotToPlannerSpec(snapshot?: GeneratePlanSnapshot, region: Region = "intl"): PlannerSpec | null {
  if (!snapshot) return null
  const normalizedPages = uniqueLowerStrings(
    (snapshot.pages?.length ? snapshot.pages : snapshot.routeMap ?? []).map((item) =>
      sanitizeUiText(String(item)).replace(/^\//, "") || "home"
    ),
    ["dashboard"]
  )
  const normalizedAiTools = uniqueLowerStrings(snapshot.aiTools ?? [], ["generate"])
  const rawProductType = sanitizeUiText(snapshot.productType || "")
    .toLowerCase()
    .replace(/-/g, "_")
  const productType =
    rawProductType === "ai_code_platform" ||
    rawProductType === "crm_workspace" ||
    rawProductType === "api_platform" ||
    rawProductType === "community_hub" ||
    rawProductType === "content_site" ||
    rawProductType === "task_workspace"
      ? (rawProductType as PlannerProductType)
      : "task_workspace"

  return {
    productName: sanitizeUiText(snapshot.productName || "") || (region === "cn" ? "Mornstack 应用" : "Mornstack App"),
    productType,
    targetLocale: region === "cn" ? "zh-CN" : "en-US",
    style: {
      theme: productType === "content_site" ? "light" : "dark",
      tone: "production-ready",
      market: region === "cn" ? "china" : "global",
    },
    pages: normalizedPages,
    layout: {
      editor: productType === "ai_code_platform" ? ["activity_bar", "file_tree", "tab_editor", "terminal_panel", "ai_assistant_panel"] : [],
    },
    aiTools: normalizedAiTools,
    templates: [],
    plans: region === "cn" ? ["免费版", "专业版", "精英版"] : ["Free", "Pro", "Elite"],
    deploymentDefaults: {
      cn: ["cloudbase", "cloud_docs"],
      global: ["vercel", "supabase"],
    },
    preferredScaffold: `${productType}_scaffold`,
    summary: sanitizeUiText(snapshot.summary || "") || (region === "cn" ? "已恢复规划摘要。" : "Recovered planner summary."),
  }
}

function getDefaultPlannerPages(productType: PlannerProductType) {
  if (productType === "ai_code_platform") return ["dashboard", "editor", "runs", "templates", "pricing", "settings"]
  if (productType === "crm_workspace") return ["dashboard", "leads", "pipeline", "customers", "automations", "reports"]
  if (productType === "api_platform") return ["dashboard", "endpoints", "logs", "auth", "environments", "webhooks"]
  if (productType === "community_hub") return ["dashboard", "events", "members", "feedback", "roadmap", "settings"]
  if (productType === "content_site") return ["dashboard", "website", "pricing", "downloads", "docs", "changelog", "admin"]
  return ["dashboard", "tasks", "settings", "analytics"]
}

function getRequiredPlannerPages(productType: PlannerProductType, planTier?: PlanTier) {
  if (!planTier) {
    return getDefaultPlannerPages(productType)
  }
  const planId = normalizePlanTier(planTier)
  if (productType === "ai_code_platform") {
    if (planId === "free" || planId === "starter") return ["dashboard", "editor", "templates", "settings"]
    return ["dashboard", "editor", "runs", "templates", "pricing", "settings"]
  }
  if (productType === "crm_workspace") {
    if (planId === "free") return ["dashboard", "leads", "pipeline"]
    if (planId === "starter") return ["dashboard", "leads", "pipeline", "customers"]
    return ["dashboard", "leads", "pipeline", "customers", "automations", "reports"]
  }
  if (productType === "api_platform") {
    if (planId === "free") return ["dashboard", "endpoints", "logs"]
    if (planId === "starter") return ["dashboard", "endpoints", "logs", "auth"]
    return ["dashboard", "endpoints", "logs", "auth", "environments", "webhooks"]
  }
  if (productType === "community_hub") {
    if (planId === "free") return ["dashboard", "events", "members"]
    if (planId === "starter") return ["dashboard", "events", "members", "feedback"]
    return ["dashboard", "events", "members", "feedback", "roadmap", "settings"]
  }
  if (productType === "content_site") {
    if (planId === "free") return ["dashboard", "website", "downloads"]
    if (planId === "starter") return ["dashboard", "website", "pricing", "downloads"]
    if (planId === "builder") return ["dashboard", "website", "pricing", "downloads", "docs", "admin"]
    return ["dashboard", "website", "pricing", "downloads", "docs", "changelog", "admin"]
  }
  if (planId === "elite") {
    return ["dashboard", "tasks", "settings", "analytics", "reports", "automations", "team", "approvals", "handoff", "playbooks"]
  }
  if (planId === "pro") {
    return ["dashboard", "tasks", "settings", "analytics", "reports", "automations", "team", "approvals"]
  }
  if (planId === "builder") {
    return ["dashboard", "tasks", "settings", "analytics", "reports", "automations"]
  }
  if (planId === "starter") {
    return ["dashboard", "tasks", "settings", "analytics", "reports"]
  }
  return ["dashboard", "tasks", "settings", "analytics"]
}

function getPinnedPlannerPages(productType: PlannerProductType, planTier?: PlanTier) {
  const planId = planTier ? normalizePlanTier(planTier) : null

  if (productType === "ai_code_platform") {
    return planId === "free" || planId === "starter" ? ["dashboard", "editor"] : ["dashboard", "editor", "runs"]
  }

  if (productType === "crm_workspace") {
    return planId === "free" ? ["dashboard", "leads", "pipeline"] : ["dashboard", "leads", "pipeline", "customers"]
  }

  if (productType === "api_platform") {
    return planId === "free" ? ["dashboard", "endpoints"] : ["dashboard", "endpoints", "logs"]
  }

  if (productType === "community_hub") {
    return planId === "free" ? ["dashboard", "events"] : ["dashboard", "events", "members"]
  }

  if (productType === "content_site") {
    return ["dashboard", "website"]
  }

  if (planId === "elite") return ["dashboard", "tasks", "analytics", "reports"]
  if (planId === "pro") return ["dashboard", "tasks", "analytics"]
  if (planId === "builder") return ["dashboard", "tasks", "analytics"]
  if (planId === "starter") return ["dashboard", "tasks"]
  return ["dashboard", "tasks"]
}

function getPromptDrivenPlannerPages(productType: PlannerProductType, prompt: string) {
  const text = prompt.toLowerCase()
  const pages: string[] = []

  if (productType === "ai_code_platform") {
    if (/assistant|chat|conversation|copilot|agent|助手|对话|智能体/.test(text)) {
      pages.push("assistant")
    }
    if (/publish|deploy|delivery|release|上线|发布|交付/.test(text)) {
      pages.push("publish")
    }
    if (/file|workspace|tree|repo|repository|文件|工作区|仓库/.test(text)) {
      pages.push("files")
    }
  }

  if (productType === "crm_workspace") {
    if (/order|invoice|billing|quote|报价|订单|发票|账单/.test(text)) {
      pages.push("orders")
    }
    if (/report|forecast|quota|analytics|pipeline review|报表|预测|业绩|配额|分析/.test(text)) {
      pages.push("reports")
    }
    if (/customer|account|renewal|success|portfolio|客户|账户|续约|客户成功/.test(text)) {
      pages.push("customers")
    }
    if (/team|rep|manager|leaderboard|团队|销售代表|排行榜/.test(text)) {
      pages.push("team")
    }
  }

  if (productType === "api_platform") {
    if (/webhook|callback|event delivery|subscription|回调|订阅|事件投递/.test(text)) {
      pages.push("webhooks")
    }
    if (/docs|documentation|guide|reference|文档|指南|参考/.test(text)) {
      pages.push("docs")
    }
    if (/usage|metering|analytics|billing|用量|计量|分析|计费/.test(text)) {
      pages.push("usage")
    }
    if (/key|keys|token|oauth|auth|credential|密钥|令牌|鉴权|凭证/.test(text)) {
      pages.push("auth")
    }
  }

  if (productType === "community_hub") {
    if (looksLikeEventDrivenCommunityPrompt(text)) {
      pages.push("events")
    }
    if (/member|community member|invite|segment|membership|成员|邀请|分层|会员|ambassador|advocate|大使|倡导者/.test(text)) {
      pages.push("members")
    }
    if (/feedback|feedback intake|request|requests|post-event feedback|反馈|诉求/.test(text)) {
      pages.push("feedback")
    }
    if (/moderation|review|report abuse|safety|审核|举报|治理|安全/.test(text)) {
      pages.push("moderation")
    }
    if (/roadmap|vote|wishlist|feature request|路线图|投票|愿望单/.test(text)) {
      pages.push("roadmap")
    }
    if (/post|forum|discussion|announcement|feed|帖子|论坛|讨论|公告|动态/.test(text)) {
      pages.push("posts")
    }
  }

  if (productType === "content_site") {
    if (/download|downloads|distribution|distribute|channel|rollout|device|ios|android|apk|mac|windows|desktop|下载|分发|渠道|设备|桌面端|安卓|苹果/.test(text)) {
      pages.push("downloads")
    }
    if (/docs|documentation|guide|faq|reference|文档|指南|faq|参考/.test(text)) {
      pages.push("docs")
    }
    if (/admin|distribution|channel|rollout|后台|分发后台|渠道管理/.test(text)) {
      pages.push("admin")
    }
    if (/pricing|plan|subscription|套餐|定价|价格/.test(text)) {
      pages.push("pricing")
    }
    if (/changelog|release note|release notes|release history|更新日志|版本说明|发布记录/.test(text)) {
      pages.push("changelog")
    }
  }

  if (productType === "task_workspace") {
    if (/health|healthcare|medical|clinic|patient|doctor|hospital|appointment|care plan|医疗|健康|诊所|患者|医生|医院|预约|病历|护理/.test(text)) {
      pages.push("patients", "appointments", "care")
    }
    if (/school|education|course|student|teacher|class|lesson|assignment|campus|教育|学校|课程|学生|老师|班级|作业|校园/.test(text)) {
      pages.push("courses", "students", "assignments")
    }
    if (/finance|financial|bank|ledger|transaction|reconciliation|expense|portfolio|金融|财务|银行|账本|交易|对账|费用|投资组合/.test(text)) {
      pages.push("accounts", "transactions", "reconciliation")
    }
    if (/recruit|hiring|candidate|interview|job|talent|offer|ats|招聘|候选人|面试|岗位|人才|录用/.test(text)) {
      pages.push("candidates", "jobs", "interviews")
    }
    if (/support|ticket|helpdesk|sla|knowledge base|case|客服|工单|帮助台|知识库|服务等级|客诉/.test(text)) {
      pages.push("tickets", "cases", "knowledge")
    }
    if (/commerce|ecommerce|store|sku|inventory|fulfillment|merchant|retail|电商|商城|库存|商品|履约|零售|商家/.test(text)) {
      pages.push("products", "inventory", "orders")
    }
    if (/approval|review|signoff|审批|审核|签批/.test(text)) {
      pages.push("approvals")
    }
    if (/security|access|permission|role|policy|安全|权限|角色|策略/.test(text)) {
      pages.push("security")
    }
    if (/audit|history|trace|compliance|审计|留痕|合规|记录/.test(text)) {
      pages.push("audit")
    }
    if (/incident|alert|outage|incident response|告警|故障|异常|应急/.test(text)) {
      pages.push("incidents")
    }
    if (/team|owner|member|seat|workspace admin|团队|负责人|成员|席位/.test(text)) {
      pages.push("team")
    }
    if (/report|analytics|dashboard review|汇报|分析|报表/.test(text)) {
      pages.push("reports")
    }
    if (/automation|rule|workflow|自动化|规则|流程/.test(text)) {
      pages.push("automations")
    }
  }

  return Array.from(new Set(pages))
}

function getDefaultTemplateIdForPlannerProductType(
  productType: PlannerProductType,
  prompt: string,
  context?: GenerateRequestContext
) {
  if (productType === "crm_workspace") return "opsdesk"
  if (productType === "api_platform") return "taskflow"
  if (productType === "community_hub") return "orbital"
  if (productType === "content_site") return "launchpad"
  if (productType === "task_workspace" && shouldUseSpecializedWorkspaceTemplateIsolation(prompt)) {
    return undefined
  }
  const inferred = resolveTemplateId(prompt, context)
  if (inferred) return inferred
  if (looksLikeMarketingDistributionPrompt(prompt)) return "launchpad"
  if (/website|landing|homepage|download|docs|官网|落地页|下载页|文档/i.test(prompt)) return "launchpad"
  if (/community|club|social|group|announcement|event|feedback|社区|社团|社交|公告|活动|反馈/i.test(prompt)) {
    return "orbital"
  }
  if (/api|sdk|developer portal|endpoint|observability|monitoring|usage trend|error alert|接口|分析平台|监控|趋势|日志|鉴权|环境/i.test(prompt)) {
    return "taskflow"
  }
  if (looksLikeSpecializedWorkspacePrompt(prompt)) {
    return undefined
  }
  if (shouldPreferAdminOpsOverCrm(prompt)) {
    return undefined
  }
  if (/crm|customer|sales|pipeline|lead|admin|ops|internal tool|backoffice|back office|control plane|客户|销售|跟进|管理后台|运营后台|内部工具|审批|工单|控制台/i.test(prompt)) {
    return "opsdesk"
  }
  return undefined
}

function buildGenerationAcceptance(args: {
  prompt: string
  planner: PlannerSpec
  plannedSpec: AppSpec
  workflowMode: GenerateWorkflowMode
  buildResult: WorkspaceBuildResult
  context?: GenerateRequestContext
  contextSummary?: string
  fallbackReason?: string
  changedFiles: string[]
}): GenerateAcceptanceReport {
  const {
    prompt,
    planner,
    plannedSpec,
    workflowMode,
    buildResult,
    context,
    contextSummary,
    fallbackReason,
    changedFiles,
  } = args
  const archetype = resolveGenerateArchetype(prompt, planner.productType, context)
  const requiredPages = getRequiredPlannerPages(planner.productType, plannedSpec.planTier)
  const pinnedPages = getPinnedPlannerPages(planner.productType, plannedSpec.planTier)
  const availablePages = new Set(planner.pages.map((page) => sanitizeUiText(page).toLowerCase()))
  const criticalMissingPieces = pinnedPages
    .filter((page) => !availablePages.has(page))
    .map((page) => `Missing ${page} route`)

  if (workflowMode === "edit_context" && !changedFiles.length) {
    criticalMissingPieces.push("Context-anchored request produced no applicable file changes")
  }
  if (
    planner.productType === "ai_code_platform" &&
    !(
      plannedSpec.routeBlueprint?.some((item) => item.id === "editor" || item.id === "runs") ||
      plannedSpec.modules.some((item) =>
        /ai command center|file workspace|multi-tab editor|split code preview|ai 对话编程|文件工作区|多标签编辑器|分屏代码预览/i.test(
          item
        )
      )
    )
  ) {
    criticalMissingPieces.push("Code workspace AI surfaces were not registered in the generated modules")
  }
  if (buildResult.status === "failed") {
    criticalMissingPieces.push("Build validation failed")
  }
  if (plannedSpec.modules.length < 4) {
    criticalMissingPieces.push("App scaffold is still too shallow")
  }
  if (!plannedSpec.features?.length) {
    criticalMissingPieces.push("Core feature policy was not inferred")
  }

  const previewReadiness =
    workflowMode === "discuss"
      ? "planning_only"
      : buildResult.status === "ok"
        ? "ready"
        : buildResult.status === "failed"
          ? "blocked"
          : "limited"

  const quality =
    workflowMode !== "discuss" &&
    buildResult.status === "ok" &&
    criticalMissingPieces.length === 0 &&
    planner.pages.length >= pinnedPages.length &&
    plannedSpec.modules.length >= 4
      ? "app_grade"
      : "demo_grade"

  return {
    workflowMode,
    archetype,
    quality,
    buildStatus: buildResult.status,
    previewReadiness,
    routeCount: planner.pages.length,
    moduleCount: plannedSpec.modules.length,
    contextAnchored: hasMeaningfulGenerateContext(context),
    contextSummary,
    fallbackReason,
    criticalMissingPieces,
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
    .replace(/\u201c|\u201d/g, "\"")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
}

function parseGeneratorOutput(rawContent: string): GeneratorModelOutput {
  const candidate = extractJsonObject(rawContent)
  try {
    return JSON.parse(candidate) as GeneratorModelOutput
  } catch {
    return JSON.parse(sanitizeJsonText(candidate)) as GeneratorModelOutput
  }
}

function uniqueLowerStrings(input: string[], fallback: string[]) {
  const values = Array.from(new Set(input.map((item) => sanitizeUiText(String(item))).filter(Boolean)))
  return values.length ? values : fallback
}

function mergePlannerPages(productType: PlannerProductType, parsedPages: string[] | undefined, fallbackPages: string[], prompt: string) {
  const merged = uniqueLowerStrings(parsedPages ?? [], fallbackPages)
  for (const page of getPromptDrivenPlannerPages(productType, prompt)) {
    if (!merged.includes(page)) merged.push(page)
  }
  const required = getRequiredPlannerPages(productType)
  for (const page of required) {
    if (!merged.includes(page)) merged.push(page)
  }
  return merged
}

function constrainPlannerByPlanTier(planner: PlannerSpec, planTier: PlanTier, prompt?: string) {
  const policy = getPlanPolicy(planTier)
  const required = getRequiredPlannerPages(planner.productType, planTier)
  const defaults = getDefaultPlannerPages(planner.productType)
  const requiredSet = new Set(required)
  const pinned = getPinnedPlannerPages(planner.productType, planTier)
  const pinnedSet = new Set(pinned)
  const promptPriorityPages = prompt ? getPromptDrivenPlannerPages(planner.productType, prompt) : []
  const promptPrioritySet = new Set(promptPriorityPages)
  const routeBudget = policy.maxGeneratedRoutes
  const trimmedPages: string[] = []

  for (const page of planner.pages) {
    if (trimmedPages.includes(page)) continue
    trimmedPages.push(page)
  }

  for (const page of promptPriorityPages) {
    if (!trimmedPages.includes(page)) {
      trimmedPages.push(page)
    }
  }

  for (const page of required) {
    if (!trimmedPages.includes(page)) {
      trimmedPages.push(page)
    }
  }

  const orderedPromptPriority = promptPriorityPages.filter((page) => trimmedPages.includes(page) && !pinnedSet.has(page))
  const orderedRequired = required.filter((page) => trimmedPages.includes(page) && !pinnedSet.has(page) && !promptPrioritySet.has(page))
  const orderedDefaults = defaults.filter(
    (page) => trimmedPages.includes(page) && !pinnedSet.has(page) && !requiredSet.has(page) && !promptPrioritySet.has(page)
  )
  const orderedExtras = trimmedPages.filter(
    (page) =>
      !pinnedSet.has(page) &&
      !requiredSet.has(page) &&
      !promptPrioritySet.has(page) &&
      !defaults.includes(page)
  )

  const prioritized = [
    ...pinned.filter((page) => trimmedPages.includes(page)),
    ...orderedPromptPriority,
    ...orderedRequired,
    ...orderedDefaults,
    ...orderedExtras,
  ].slice(0, routeBudget)

  return {
    ...planner,
    pages: prioritized,
    summary: planner.summary,
  } satisfies PlannerSpec
}

function inferPlannerProductType(prompt: string, context?: GenerateRequestContext): PlannerProductType {
  return resolvePlannerProductType(prompt, context)
}

function buildOrderedFallbackPlannerPages(productType: PlannerProductType, prompt: string) {
  const safePinnedPages = getPinnedPlannerPages(productType, "free")
  const safeRequiredPages = getRequiredPlannerPages(productType, "free")
  return Array.from(
    new Set([
      ...safePinnedPages,
      ...getPromptDrivenPlannerPages(productType, prompt),
      ...safeRequiredPages,
      ...getDefaultPlannerPages(productType),
    ])
  )
}

function fallbackPlannerSpec(
  prompt: string,
  region: Region,
  deploymentTarget: DeploymentTarget,
  databaseTarget: DatabaseTarget,
  context?: GenerateRequestContext,
  productTypeOverride?: PlannerProductType
): PlannerSpec {
  const productType = productTypeOverride ?? inferPlannerProductType(prompt, context)
  const targetLocale = region === "cn" ? "zh-CN" : "en-US"
  const productName =
    context?.sharedSession?.projectName ||
    inferPlannerProductName(productType, prompt, region) ||
    (region === "cn" ? "Mornstack 应用" : "Mornstack App")
  const cnDefaults: [string, string] = ["cloudbase", "cloud_docs"]
  const globalDefaults: [string, string] = ["vercel", "supabase"]

  if (productType === "ai_code_platform") {
    const pages = buildOrderedFallbackPlannerPages(productType, prompt)
    return {
      productName,
      productType,
      targetLocale,
      style: {
        theme: "dark",
        tone: "production-ready",
        market: region === "cn" ? "china" : "global",
      },
      pages,
      layout: {
        editor: ["activity_bar", "file_tree", "tab_editor", "terminal_panel", "ai_assistant_panel"],
      },
      aiTools: ["explain", "fix", "generate", "refactor"],
      templates:
        region === "cn"
          ? ["AI 命令中心", "运行与日志", "模板工坊", "发布与交付"]
          : ["AI command center", "Runs and logs", "Template workshop", "Publishing and delivery"],
      plans: region === "cn" ? ["免费版", "启动版", "建造者版", "专业版", "精英版"] : ["Free", "Starter", "Builder", "Pro", "Elite"],
      deploymentDefaults: {
        cn: cnDefaults,
        global: globalDefaults,
      },
      preferredScaffold: "ai_code_platform_scaffold",
      summary: buildPlannerSummary(productType, pages, deploymentTarget, databaseTarget, region),
    }
  }

  const fallbackPages = buildOrderedFallbackPlannerPages(productType, prompt)
  const aiTools =
    productType === "crm_workspace" || productType === "api_platform" || productType === "task_workspace"
      ? ["generate", "fix", "refactor"]
      : productType === "community_hub" || productType === "content_site"
        ? ["generate", "refactor"]
        : ["generate"]

  return {
    productName,
    productType,
    targetLocale,
    style: {
      theme: productType === "content_site" ? "light" : "dark",
      tone: "production-ready",
      market: region === "cn" ? "china" : "global",
    },
    pages: fallbackPages,
    layout: {},
    aiTools,
    templates: [],
    plans: region === "cn" ? ["免费版", "启动版", "建造者版", "专业版", "精英版"] : ["Free", "Starter", "Builder", "Pro", "Elite"],
    deploymentDefaults: { cn: cnDefaults, global: globalDefaults },
    preferredScaffold: `${productType}_scaffold`,
    summary: buildPlannerSummary(productType, fallbackPages, deploymentTarget, databaseTarget, region),
  }
}

function isOverbroadPlannerProductName(input: string, prompt: string) {
  const value = sanitizeUiText(input)
  if (!value) return true
  const cleanPrompt = sanitizeUiText(prompt)
  if (cleanPrompt && value === cleanPrompt) return true
  if (value.length > 48) return true
  return /^(build|create|make|generate|构建|创建|生成|做一个|搭建)/i.test(value) || /包含|包括|with/.test(value)
}

function normalizePlannerSpec(
  parsed: Partial<PlannerSpec> | null | undefined,
  prompt: string,
  region: Region,
  deploymentTarget: DeploymentTarget,
  databaseTarget: DatabaseTarget,
  context?: GenerateRequestContext
) {
  const fallback = fallbackPlannerSpec(prompt, region, deploymentTarget, databaseTarget, context)
  const rawProductType = sanitizeUiText(String(parsed?.productType ?? ""))
    .toLowerCase()
    .replace(/-/g, "_")
  const productType =
    looksLikeSpecializedWorkspacePrompt(prompt)
      ? "task_workspace"
      : rawProductType === "ai_code_platform" ||
          rawProductType === "crm_workspace" ||
          rawProductType === "api_platform" ||
          rawProductType === "community_hub" ||
          rawProductType === "content_site" ||
          rawProductType === "task_workspace"
        ? (rawProductType as PlannerProductType)
        : fallback.productType
  const parsedProductName = sanitizeUiText(parsed?.productName || "")
  return {
    ...fallback,
    ...parsed,
    productName: isOverbroadPlannerProductName(parsedProductName, prompt) ? fallback.productName : parsedProductName,
    productType,
    targetLocale: parsed?.targetLocale === "zh-CN" || parsed?.targetLocale === "en-US" ? parsed.targetLocale : fallback.targetLocale,
    style: {
      theme: parsed?.style?.theme === "light" ? "light" : fallback.style.theme,
      tone: sanitizeUiText(parsed?.style?.tone || "") || fallback.style.tone,
      market: parsed?.style?.market === "global" ? "global" : fallback.style.market,
    },
    pages: mergePlannerPages(productType, parsed?.pages, fallback.pages, prompt),
    layout: {
      editor: uniqueLowerStrings(parsed?.layout?.editor ?? [], fallback.layout.editor ?? []),
    },
    aiTools: uniqueLowerStrings(parsed?.aiTools ?? [], fallback.aiTools),
    templates: uniqueLowerStrings(parsed?.templates ?? [], fallback.templates),
    plans: uniqueLowerStrings(parsed?.plans ?? [], fallback.plans),
    deploymentDefaults: fallback.deploymentDefaults,
    preferredScaffold: sanitizeUiText(parsed?.preferredScaffold || "") || fallback.preferredScaffold,
    summary: sanitizeUiText(parsed?.summary || "") || fallback.summary,
  } satisfies PlannerSpec
}

function getPlanGenerationDirective(planTier: PlanTier, region: Region) {
  if (planTier === "elite") {
    return region === "cn"
      ? "面向精英套餐：输出要接近展示级成品，至少体现更强的视觉统一性、多页面结构、更多可复用模块和更完整的信息架构。"
      : "Target the elite tier: make the output feel showcase-grade with stronger visual consistency, more pages, deeper reusable modules, and fuller information architecture."
  }
  if (planTier === "pro") {
    return region === "cn"
      ? "面向专业套餐：输出应明显强于基础版，包含分析页、更多业务区块、更完整组件拆分和更清晰的数据表达。"
      : "Target the pro tier: make it clearly richer than the basic tier with analytics, more business sections, better component splitting, and clearer data expression."
  }
  if (planTier === "builder") {
    return region === "cn"
      ? "面向建造者套餐：输出应包含双视图、增强筛选、统计模块和更成熟的工作台观感。"
      : "Target the builder tier: include dual views, enhanced filtering, metric modules, and a more mature workspace feel."
  }
  return region === "cn"
    ? "面向免费或入门套餐：保持结构完整，但控制在首版可用、可迭代、不过度展开。"
    : "Target the free or starter tier: keep it complete and usable, but scoped to a solid first version without over-expanding."
}

function shouldPreferCompactBuilderPass(planTier: PlanTier) {
  return getPlanRank(planTier) >= getPlanRank("builder")
}

function shouldAttemptPaidPolishPass(args: {
  planTier: PlanTier
  plannerProductType: PlannerProductType
  aiChangedCount: number
}) {
  if (getPlanRank(args.planTier) < getPlanRank("pro")) return false
  if (args.aiChangedCount <= 0) return false
  return args.plannerProductType !== "ai_code_platform"
}

function shouldRetryAfterPrimaryBuilderFailure(args: {
  planTier: PlanTier
  compactFirstPass: boolean
}) {
  if (!getPlanPolicy(args.planTier).aiBuilderEnabled) return false
  if (args.compactFirstPass) {
    return getPlanRank(args.planTier) >= getPlanRank("pro")
  }
  return true
}

function getCompactPlannerPageLimit(planTier: PlanTier) {
  if (planTier === "elite") return 6
  if (planTier === "pro") return 5
  if (planTier === "builder") return 4
  return 4
}

function getCompactBriefLimit(planTier: PlanTier) {
  if (planTier === "elite") return 5
  if (planTier === "pro") return 4
  return 4
}

function getPriorityOnlyPlannerPageLimit(planTier: PlanTier) {
  if (planTier === "elite") return 4
  if (planTier === "pro") return 3
  return 3
}

function getPriorityOnlyBriefLimit(planTier: PlanTier) {
  if (planTier === "elite") return 3
  return 2
}

function getGeneratorMaxTokens(planTier: PlanTier, options?: {
  compact?: boolean
  priorityOnly?: boolean
}) {
  if (options?.priorityOnly) {
    if (planTier === "elite") return 2800
    if (planTier === "pro") return 2400
    return 2200
  }
  if (options?.compact) {
    if (planTier === "elite") return 4200
    if (planTier === "pro") return 3600
    if (planTier === "builder") return 3200
  }
  return undefined
}

function routeIdToAppPagePath(routeId: string) {
  const normalized = sanitizeUiText(routeId).replace(/^\/+/, "").toLowerCase()
  if (!normalized || normalized === "home") return "app/page.tsx"
  return `app/${normalized}/page.tsx`
}

function getPriorityGeneratorFileTargets(args: {
  planner: PlannerSpec
  planTier: PlanTier
  context?: GenerateRequestContext
}) {
  const { planner, planTier, context } = args
  const requiredPages = getRequiredPlannerPages(planner.productType, planTier)
  const plannerPages = planner.pages.length ? planner.pages : requiredPages
  const files = [
    context?.currentFilePath || "",
    context?.sharedSession?.lastChangedFile || "",
    context?.sharedSession?.filePath || "",
    "app/layout.tsx",
    "app/page.tsx",
    ...requiredPages.map(routeIdToAppPagePath),
    ...plannerPages.map(routeIdToAppPagePath),
  ]
    .map((item) => normalizeContextPath(item))
    .filter(Boolean)

  return Array.from(new Set(files)).slice(0, 12)
}

function getPriorityGeneratorRoutes(args: {
  planner: PlannerSpec
  planTier: PlanTier
  context?: GenerateRequestContext
}) {
  const requiredPages = getRequiredPlannerPages(args.planner.productType, args.planTier)
  const plannerPages = args.planner.pages.length ? args.planner.pages : requiredPages
  const routes = [
    args.context?.currentRoute || "",
    args.context?.currentPage?.route || "",
    ...requiredPages.map((item) => (item === "home" ? "/" : `/${item}`)),
    ...plannerPages.map((item) => (item === "home" ? "/" : `/${item}`)),
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)

  return Array.from(new Set(routes)).slice(0, 10)
}

function buildCompactGenerationGuardrails(args: {
  planner: PlannerSpec
  planTier: PlanTier
  context?: GenerateRequestContext
  region: Region
}) {
  const targetFiles = getPriorityGeneratorFileTargets(args)
  const targetRoutes = getPriorityGeneratorRoutes(args)
  const isCn = args.region === "cn"
  const lines = [
    isCn
      ? `紧凑模式优先文件：${targetFiles.join(", ")}`
      : `Compact priority files: ${targetFiles.join(", ")}`,
    isCn
      ? `紧凑模式优先路由：${targetRoutes.join(", ")}`
      : `Compact priority routes: ${targetRoutes.join(", ")}`,
  ]
  if (args.context?.currentFilePath || args.context?.currentRoute) {
    lines.push(
      isCn
        ? "若当前有聚焦文件或路由，先把它及其直接相关页面改对，再扩展到其它表层。"
        : "If a current file or route is focused, fix that surface and its directly related pages first before expanding elsewhere."
    )
  }
  lines.push(
    isCn
      ? "优先改 route-level 页面、layout、最显眼的共享组件与必要 API；避免把时间耗在低价值装饰文件。"
      : "Prioritize route-level pages, layout, the most visible shared components, and necessary API files; avoid spending time on low-value decorative files."
  )
  return lines.join("\n")
}

function buildPlanPolicySummary(planTier: PlanTier, region: Region, assignedDomain?: string) {
  const policy = getPlanPolicy(planTier)
  const isCn = region === "cn"
  const lines = [
    isCn ? `套餐档位：${planTier}` : `Plan tier: ${planTier}`,
    isCn ? `生成档位：${policy.generationProfile}` : `Generation profile: ${policy.generationProfile}`,
    isCn
      ? `AI Builder：${policy.aiBuilderEnabled ? "已开放" : "未开放"}`
      : `AI Builder: ${policy.aiBuilderEnabled ? "enabled" : "disabled"}`,
    isCn ? `页面预算：${policy.maxGeneratedRoutes}` : `Route budget: ${policy.maxGeneratedRoutes}`,
    isCn ? `模块预算：${policy.maxGeneratedModules}` : `Module budget: ${policy.maxGeneratedModules}`,
    isCn ? `代码导出：${policy.codeExportLevel}` : `Code export: ${policy.codeExportLevel}`,
    isCn ? `数据库模式：${policy.databaseAccessMode}` : `Database mode: ${policy.databaseAccessMode}`,
    isCn ? `项目上限：${policy.projectLimit}` : `Project limit: ${policy.projectLimit}`,
    isCn ? `协作人数上限：${policy.collaboratorLimit}` : `Collaborator limit: ${policy.collaboratorLimit}`,
    isCn ? `子域名位：${policy.subdomainSlots}` : `Subdomain slots: ${policy.subdomainSlots}`,
    assignedDomain ? (isCn ? `分配域名：${assignedDomain}` : `Assigned domain: ${assignedDomain}`) : "",
  ]
  return lines.filter(Boolean).join("\n")
}

async function callPlannerModel(args: {
  prompt: string
  region: Region
  planTier: PlanTier
  deploymentTarget: DeploymentTarget
  databaseTarget: DatabaseTarget
  context?: GenerateRequestContext
}): Promise<PlannerSpec> {
  const { prompt, region, planTier, deploymentTarget, databaseTarget, context } = args
  const inferredProductType = inferPlannerProductType(prompt, context)
  const promptOnlyProductType = inferPromptOnlyPlannerProductType(prompt)
  if (promptOnlyProductType !== "task_workspace") {
    return fallbackPlannerSpec(prompt, region, deploymentTarget, databaseTarget, context, promptOnlyProductType)
  }
  if (inferredProductType !== "task_workspace") {
    return fallbackPlannerSpec(prompt, region, deploymentTarget, databaseTarget, context, inferredProductType)
  }
  const contextBlock = serializeGenerateContextForPrompt(context)
  const planPolicySummary = buildPlanPolicySummary(planTier, region, context?.sharedSession?.assignedDomain)
  const config = resolveAiConfig({ mode: "planner" })
  const system = [
    "You are the planning layer for a Next.js application generator.",
    "Return strict JSON only.",
    "Do not write UI copy from the raw prompt. Convert the prompt into structured product intent.",
    "Prefer product language and reusable structure over literal prompt echoing.",
    "For AI code platform or Cursor-like prompts, always include dashboard, editor, runs, templates, pricing, and settings.",
    "For code-platform products, the editor layout must include activity_bar, file_tree, tab_editor, terminal_panel, and ai_assistant_panel.",
    "For code-platform products, AI tools must include explain, fix, generate, and refactor.",
    "If workspace context is provided, keep the product family and active surface aligned with that context instead of reinterpreting the request from scratch.",
    "The selected plan policy is a hard constraint. Do not exceed route/module depth or unlock export/database capabilities that the plan does not include.",
  ].join("\n")

  const user = [
    `Prompt: ${prompt}`,
    `Region: ${region}`,
    `Plan tier: ${planTier}`,
    `Plan policy summary:\n${planPolicySummary}`,
    `Deployment target: ${deploymentTarget}`,
    `Database target: ${databaseTarget}`,
    contextBlock ? `Workspace generation context:\n${contextBlock}` : "",
    'Return JSON with this schema: {"productName":"","productType":"","targetLocale":"zh-CN|en-US","style":{"theme":"dark|light","tone":"","market":"china|global"},"pages":[],"layout":{"editor":[]},"aiTools":[],"templates":[],"plans":[],"deploymentDefaults":{"cn":["cloudbase","cloud_docs"],"global":["vercel","supabase"]},"preferredScaffold":"","summary":""}',
  ].join("\n\n")

  try {
    const { content } = await requestJsonChatCompletion({
      config,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      timeoutMs: 28_000,
      mode: "planner",
    })
    if (!content) {
      return fallbackPlannerSpec(prompt, region, deploymentTarget, databaseTarget, context)
    }
    const parsed = JSON.parse(sanitizeJsonText(extractJsonObject(content))) as Partial<PlannerSpec>
    return normalizePlannerSpec(parsed, prompt, region, deploymentTarget, databaseTarget, context)
  } catch {
    return fallbackPlannerSpec(prompt, region, deploymentTarget, databaseTarget, context)
  }
}

function plannerProductTypeToAppKind(productType: PlannerProductType): AppKind {
  if (productType === "ai_code_platform") return "code_platform"
  if (productType === "crm_workspace") return "crm"
  if (productType === "community_hub") return "community"
  if (productType === "content_site") return "blog"
  return "task"
}

function plannerProductTypeToArchetype(productType: PlannerProductType) {
  if (productType === "ai_code_platform") return "code_platform" as const
  if (productType === "crm_workspace") return "crm" as const
  if (productType === "api_platform") return "api_platform" as const
  if (productType === "community_hub") return "community" as const
  if (productType === "content_site") return "marketing_admin" as const
  return "task" as const
}

function getPlannerRouteActions(route: string, productType: PlannerProductType, region: Region) {
  const isCn = region === "cn"
  const routeKey = String(route).toLowerCase()
  if (routeKey === "dashboard") {
    if (isCn) {
      if (productType === "ai_code_platform") return ["查看状态", "检查运行", "切换模块"]
      if (productType === "crm_workspace") return ["查看预测", "识别风险", "推进交付"]
      if (productType === "api_platform") return ["查看平台状态", "排查告警", "检查用量"]
      if (productType === "community_hub") return ["查看社区节奏", "跟进反馈", "同步活动"]
      if (productType === "content_site") return ["查看转化", "检查分发", "同步版本说明"]
      return ["查看治理状态", "推进审批", "同步规则"]
    }
    if (productType === "ai_code_platform") return ["review status", "inspect runtime", "switch modules"]
    if (productType === "crm_workspace") return ["review forecast", "flag risk", "advance handoff"]
    if (productType === "api_platform") return ["review platform health", "triage alerts", "inspect usage"]
    if (productType === "community_hub") return ["review community rhythm", "triage feedback", "sync events"]
    if (productType === "content_site") return ["review conversion", "inspect distribution", "sync releases"]
    return ["review approvals", "check access", "track incidents"]
  }
  const cn: Record<string, string[]> = {
    editor: ["打开文件", "编辑代码", "切换标签", "预览运行"],
    runs: ["查看日志", "刷新运行", "检查构建"],
    templates: ["筛选模板", "预览模板", "应用模板"],
    pricing: ["比较套餐", "查看权限", "升级"],
    settings: ["修改环境", "管理权限", "检查部署"],
    leads: ["录入线索", "分配负责人", "推进跟进"],
    pipeline: ["推进阶段", "更新风险", "成交转交付"],
    customers: ["查看客户", "准备续约", "同步交付"],
    automations: ["查看规则", "启停规则", "新建自动化"],
    reports: ["查看预测", "分析阶段", "导出摘要"],
    orders: ["查看订单", "确认报价", "同步回款"],
    team: ["查看团队", "调整目标", "同步配额"],
    endpoints: ["浏览接口", "发布版本", "复制路径"],
    logs: ["筛选日志", "查看 trace", "确认恢复"],
    auth: ["查看密钥", "创建 scope", "轮换"],
    environments: ["切换环境", "发布", "回滚"],
    webhooks: ["查看回调", "重试投递", "确认订阅"],
    usage: ["查看用量", "核对计费", "调整限额"],
    website: ["浏览官网", "编辑板块", "检查转化"],
    downloads: ["查看下载项", "分发包", "复制链接"],
    docs: ["浏览文档", "发布更新", "同步说明"],
    changelog: ["查看版本说明", "发布更新", "同步下载"],
    devices: ["查看构建", "上传安装包", "检查签名"],
    admin: ["查看后台", "分发资源", "管理状态"],
    feedback: ["查看反馈", "调整优先级", "进入路线图"],
    roadmap: ["查看路线图", "移动条目", "发布说明"],
    posts: ["查看帖子", "发布公告", "引导讨论"],
    members: ["查看成员", "分组", "邀请"],
    events: ["查看活动", "管理参与", "发送提醒"],
    moderation: ["查看举报", "审核内容", "同步策略"],
    approvals: ["查看审批", "签批", "驳回"],
    security: ["查看权限", "调整策略", "同步访问"],
    audit: ["查看记录", "筛选事件", "导出留痕"],
    incidents: ["查看告警", "确认影响", "推进恢复"],
    team: ["查看成员", "分配负责人", "同步容量"],
  }
  const en: Record<string, string[]> = {
    editor: ["open file", "edit code", "switch tabs", "run preview"],
    runs: ["inspect logs", "refresh runtime", "check build"],
    templates: ["filter templates", "preview template", "apply template"],
    pricing: ["compare plans", "review permissions", "upgrade"],
    settings: ["update environment", "manage access", "inspect deploy"],
    leads: ["capture lead", "assign owner", "advance follow-up"],
    pipeline: ["advance stage", "update risk", "handoff close"],
    customers: ["review customer", "prepare renewal", "sync handoff"],
    automations: ["review rules", "toggle rules", "create automation"],
    reports: ["review forecast", "analyze stages", "export summary"],
    orders: ["review order", "confirm quote", "sync payment"],
    team: ["review team", "adjust targets", "sync quota"],
    endpoints: ["browse endpoint", "publish version", "copy path"],
    logs: ["filter logs", "inspect trace", "confirm recovery"],
    auth: ["review keys", "create scope", "rotate"],
    environments: ["switch environment", "promote release", "rollback"],
    webhooks: ["review callbacks", "retry delivery", "confirm subscription"],
    usage: ["review usage", "verify billing", "adjust rate limits"],
    website: ["browse site", "edit section", "check conversion"],
    downloads: ["review download", "ship package", "copy link"],
    docs: ["browse docs", "publish update", "sync notes"],
    changelog: ["review release notes", "publish update", "sync downloads"],
    devices: ["review builds", "upload installer", "check signing"],
    admin: ["review admin", "distribute assets", "manage status"],
    feedback: ["review feedback", "set priority", "move to roadmap"],
    roadmap: ["review roadmap", "move items", "publish notes"],
    posts: ["review posts", "publish announcement", "shape discussion"],
    members: ["review members", "segment", "invite"],
    events: ["review events", "manage attendance", "send reminders"],
    moderation: ["review reports", "moderate content", "sync policy"],
    approvals: ["review approval", "approve", "reject"],
    security: ["review access", "adjust policy", "sync permissions"],
    audit: ["review trail", "filter events", "export audit"],
    incidents: ["review incident", "check impact", "drive recovery"],
    team: ["review members", "assign owner", "sync capacity"],
  }
  return (isCn ? cn[routeKey] : en[routeKey]) ?? (isCn ? ["查看页面", "执行主操作", "继续生成"] : ["view page", "run action", "continue generation"])
}

function getPlannerRouteEntityIds(productType: PlannerProductType, routeKey: string) {
  if (productType === "api_platform") {
    const mapping: Record<string, string[]> = {
      dashboard: ["endpoint", "log_event", "usage_meter"],
      endpoints: ["endpoint"],
      logs: ["log_event"],
      auth: ["api_key"],
      environments: ["environment"],
      webhooks: ["webhook_subscription"],
      docs: ["developer_doc", "endpoint"],
      usage: ["usage_meter", "api_key"],
    }
    return mapping[routeKey] ?? []
  }
  return []
}

function getPlannerRouteModuleIds(productType: PlannerProductType, routeKey: string) {
  if (productType === "api_platform") {
    const mapping: Record<string, string[]> = {
      dashboard: ["dashboard_surface", "endpoint_catalog", "runtime_observability"],
      endpoints: ["endpoints_surface", "endpoint_catalog"],
      logs: ["logs_surface", "runtime_observability", "webhook_delivery"],
      auth: ["auth_surface", "access_policy"],
      environments: ["environments_surface", "access_policy", "webhook_delivery"],
      webhooks: ["webhooks_surface", "webhook_delivery"],
      docs: ["developer_docs_center", "endpoint_catalog"],
      usage: ["usage_metering", "access_policy"],
    }
    return mapping[routeKey] ?? []
  }
  return []
}

function buildPlannerRouteBlueprint(planner: PlannerSpec, region: Region): RouteBlueprint[] {
  return planner.pages.map((route) => {
    const routeKey = String(route).trim().toLowerCase()
    const label =
      routeKey === "dashboard"
        ? "Dashboard"
        : routeKey === "editor"
          ? region === "cn" ? "编辑器" : "Editor"
          : routeKey === "runs"
            ? region === "cn" ? "运行" : "Runs"
            : routeKey === "templates"
              ? region === "cn" ? "模板库" : "Templates"
              : routeKey === "pricing"
                ? region === "cn" ? "套餐" : "Pricing"
                : routeKey === "settings"
                  ? region === "cn" ? "设置" : "Settings"
                  : routeKey
                      .split(/[-_]/)
                      .filter(Boolean)
                      .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
                      .join(" ")
    return {
      id: routeKey || "route",
      path: routeKey === "home" ? "/" : `/${routeKey}`,
      label,
      purpose:
        region === "cn"
          ? `${label} 是 ${planner.productName} 的核心页面，用于承接 ${planner.summary || "主工作流"}.`
          : `${label} is a core surface in ${planner.productName}, used to support ${planner.summary || "the primary workflow"}.`,
      moduleIds: getPlannerRouteModuleIds(planner.productType, routeKey),
      entityIds: getPlannerRouteEntityIds(planner.productType, routeKey),
      primaryActions: getPlannerRouteActions(routeKey, planner.productType, region),
      surface:
        planner.productType === "api_platform" && (routeKey === "docs" || routeKey === "usage")
          ? "data"
          : routeKey === "editor"
          ? "code"
          : routeKey === "settings"
            ? "settings"
            : routeKey === "website" || routeKey === "downloads" || routeKey === "docs" || routeKey === "pricing"
              ? "marketing"
              : routeKey === "leads" || routeKey === "customers" || routeKey === "endpoints" || routeKey === "logs"
                ? "data"
                : "dashboard",
    }
  })
}

function getPromptDrivenPlannerModules(productType: PlannerProductType, prompt: string, region: Region, pages: string[]) {
  const isCn = region === "cn"
  const text = String(prompt ?? "").toLowerCase()
  const pageSet = new Set(pages.map((page) => String(page || "").toLowerCase()))
  const modules: string[] = []

  const push = (cnLabel: string, enLabel: string, enabled = true) => {
    if (!enabled) return
    modules.push(isCn ? cnLabel : enLabel)
  }

  if (productType === "ai_code_platform") {
    push("命令面板", "Command palette", /command|palette|快捷命令|命令面板/.test(text))
    push("AI 聊天轨道", "AI chat lane", /chat|assistant|prompt|conversation|对话|助手/.test(text))
    push("工作区历史", "Workspace history", /history|timeline|snapshot|历史|时间线|快照/.test(text))
    push("分享与发布", "Share and publish", /share|publish|deploy|delivery|分享|发布|部署|交付/.test(text))
    push("分屏代码预览", "Split code preview", /preview|split|双栏|分屏|预览/.test(text) || pageSet.has("editor"))
  } else if (productType === "crm_workspace") {
    push("报价审批", "Quote approvals", /quote|proposal|pricing|报价|方案|定价/.test(text))
    push("客户成功节奏", "Customer success cadence", /renewal|success|onboarding|续约|成功团队|上线/.test(text))
    push("团队目标追踪", "Quota tracking", /quota|target|forecast|配额|目标|预测/.test(text) || pageSet.has("reports"))
    push("商机健康度", "Deal health score", /risk|health|warning|风险|健康度|预警/.test(text))
  } else if (productType === "api_platform") {
    push("开发者文档", "Developer docs", /docs|documentation|guide|文档|说明/.test(text))
    push("SDK 资产", "SDK kits", /sdk|client library|代码示例|sdk/.test(text))
    push("用量计量", "Usage metering", /usage|metering|billing|rate limit|用量|计费|限流/.test(text))
    push("安全策略", "Security policy", /security|auth|token|oauth|scope|安全|鉴权|令牌/.test(text) || pageSet.has("auth"))
    push("事件回调台", "Event callback desk", /webhook|callback|event|回调|事件/.test(text) || pageSet.has("webhooks"))
  } else if (productType === "community_hub") {
    push("审核队列", "Moderation queue", /moderation|review|审核|审查/.test(text))
    push("投票与路线图", "Voting and roadmap", /vote|wishlist|roadmap|投票|愿望单|路线图/.test(text) || pageSet.has("roadmap"))
    push("公告编排", "Announcement orchestration", /announcement|broadcast|公告|广播/.test(text) || pageSet.has("posts"))
    push("成员成长轨道", "Member lifecycle", /member|invite|segment|成员|邀请|分层/.test(text) || pageSet.has("members"))
  } else if (productType === "content_site") {
    push("设备分发矩阵", "Device distribution matrix", /android|ios|desktop|mac|windows|设备|安装包/.test(text))
    push("转化漏斗", "Conversion funnel", /conversion|funnel|signup|转化|注册/.test(text))
    push("版本说明中心", "Release note center", /release|changelog|version|更新日志|版本/.test(text) || pageSet.has("changelog"))
    push("计划对比", "Plan comparison", /pricing|plan|tier|套餐|价格|版本/.test(text) || pageSet.has("pricing"))
  } else {
    const specialized = getSpecializedWorkspaceFlavor(prompt, region)
    if (specialized) {
      modules.push(...specialized.modules)
      return Array.from(new Set(modules))
    }
    push("审批队列", "Approval queue", /approval|审批/.test(text) || pageSet.has("approvals"))
    push("团队节奏", "Team cadence", /team|owner|负责人|团队/.test(text))
    push("访问策略", "Access policy rail", /security|access|permission|role|policy|安全|权限|角色|策略/.test(text) || pageSet.has("security"))
    push("审计时间线", "Audit timeline", /audit|history|trace|compliance|审计|留痕|合规|记录/.test(text) || pageSet.has("audit"))
    push("异常指挥台", "Incident command", /incident|alert|outage|incident response|告警|故障|异常|应急/.test(text) || pageSet.has("incidents"))
    push("自动化轨道", "Ops automations", /automation|rule|workflow|自动化|规则|流程/.test(text) || pageSet.has("automations"))
  }

  return Array.from(new Set(modules))
}

function getPromptDrivenPlannerIconVariant(productType: PlannerProductType, prompt: string, title: string) {
  const glyph = title
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "M"
  const text = String(prompt ?? "").toLowerCase()

  if (productType === "ai_code_platform") {
    if (/system|ops|control|admin|平台|系统|控制台/.test(text)) {
      return { glyph, from: "#312e81", to: "#6366f1", ring: "rgba(99,102,241,0.26)" }
    }
    if (/cursor|assistant|agent|copilot|助手|智能体/.test(text)) {
      return { glyph, from: "#5b21b6", to: "#8b5cf6", ring: "rgba(139,92,246,0.24)" }
    }
    return { glyph, from: "#0f172a", to: "#7c3aed", ring: "rgba(124,58,237,0.24)" }
  }
  if (productType === "crm_workspace") {
    if (/renewal|success|account|续约|成功团队|账户/.test(text)) {
      return { glyph, from: "#065f46", to: "#14b8a6", ring: "rgba(20,184,166,0.24)" }
    }
    return { glyph, from: "#1d4ed8", to: "#38bdf8", ring: "rgba(56,189,248,0.24)" }
  }
  if (productType === "api_platform") {
    if (/security|auth|token|oauth|安全|鉴权|令牌/.test(text)) {
      return { glyph, from: "#0f172a", to: "#10b981", ring: "rgba(16,185,129,0.24)" }
    }
    if (/sdk|developer|docs|文档|开发者/.test(text)) {
      return { glyph, from: "#0f172a", to: "#3b82f6", ring: "rgba(59,130,246,0.24)" }
    }
    return { glyph, from: "#0f172a", to: "#06b6d4", ring: "rgba(6,182,212,0.22)" }
  }
  if (productType === "community_hub") {
    if (/feedback|roadmap|vote|反馈|路线图|投票/.test(text)) {
      return { glyph, from: "#b45309", to: "#f59e0b", ring: "rgba(245,158,11,0.22)" }
    }
    return { glyph, from: "#9f1239", to: "#fb7185", ring: "rgba(251,113,133,0.22)" }
  }
  if (/download|device|ios|android|desktop|下载|设备/.test(text)) {
    return { glyph, from: "#1e1b4b", to: "#2563eb", ring: "rgba(37,99,235,0.22)" }
  }
  if (/brand|marketing|growth|官网|品牌|增长/.test(text)) {
    return { glyph, from: "#7c2d12", to: "#f97316", ring: "rgba(249,115,22,0.22)" }
  }
  return { glyph, from: "#111827", to: "#6366f1", ring: "rgba(99,102,241,0.22)" }
}

function buildPlannerVisualSeed(planner: PlannerSpec, title: string, prompt: string): VisualSeed {
  const archetype = plannerProductTypeToArchetype(planner.productType)
  const icon = getPromptDrivenPlannerIconVariant(planner.productType, prompt, title)
  const explicitTone = sanitizeUiText(planner.style.tone || "")
  const text = prompt.toLowerCase()
  const specialized = planner.productType === "task_workspace" ? getSpecializedWorkspaceFlavor(prompt, planner.targetLocale === "zh-CN" ? "cn" : "intl") : null
  const derivedTone =
    archetype === "code_platform"
      ? /system|ops|control|admin|系统|控制台/.test(text)
        ? "operator IDE workspace"
        : "generative coding workspace"
      : archetype === "api_platform"
        ? /security|auth|token|oauth|安全|鉴权|令牌/.test(text)
          ? "secure developer gateway"
          : "observable developer platform"
        : archetype === "crm"
          ? /renewal|success|account|续约|成功团队|账户/.test(text)
            ? "customer success command center"
            : "revenue control plane"
          : archetype === "community"
            ? /feedback|roadmap|vote|反馈|路线图|投票/.test(text)
              ? "feedback community workspace"
              : "community operations product"
            : /download|device|ios|android|desktop|下载|设备/.test(text)
              ? "device distribution product"
              : specialized
                ? specialized.tone
              : "brand and growth product"
  return {
    theme: specialized && /clinical|healthcare|learning|医疗|教育/.test(specialized.tone) ? "light" : planner.style.theme,
    tone: explicitTone && explicitTone !== "production-ready" ? explicitTone : derivedTone,
    density: planner.productType === "ai_code_platform" || planner.productType === "api_platform" ? "compact" : "comfortable",
    navStyle:
      planner.productType === "ai_code_platform"
        ? "editor_shell"
        : planner.productType === "content_site"
          ? "marketing_shell"
        : planner.productType === "community_hub"
            ? "community_shell"
            : "control_plane",
    layoutVariant:
      archetype === "code_platform"
        ? /run|terminal|publish|preview|deploy|运行|发布|预览/.test(text)
          ? "docs_console"
          : "split_command"
        : archetype === "crm"
          ? /renewal|success|account|续约|成功团队|账户/.test(text)
            ? "split_command"
            : "sidebar_board"
          : archetype === "api_platform"
            ? /docs|sdk|onboarding|guide|文档|开发者|接入/.test(text)
              ? "docs_console"
              : "split_command"
            : archetype === "community"
              ? /event|events|meetup|webinar|registration|活动|直播|报名/.test(text)
                ? "story_stack"
                : "split_command"
              : /download|device|ios|android|desktop|distribution|release|下载|设备|分发|发布/.test(text)
                ? "marketing_split"
                : "story_stack",
    heroVariant:
      archetype === "crm"
        ? "pipeline"
        : archetype === "api_platform" || archetype === "task"
          ? "operations"
          : archetype === "community"
            ? "community"
            : archetype === "marketing_admin"
              ? "distribution"
              : "statement",
    surfaceVariant:
      archetype === "marketing_admin" || archetype === "community"
        ? "glass"
        : archetype === "api_platform" || archetype === "task"
          ? "soft"
          : "solid",
    ctaVariant:
      archetype === "marketing_admin" || archetype === "community"
        ? "pill"
        : archetype === "api_platform" || archetype === "task"
          ? "outline"
          : "block",
    icon,
  }
}

function buildPlannerIntentSeed(planner: PlannerSpec, region: Region, prompt: string): AppIntent {
  const archetype = plannerProductTypeToArchetype(planner.productType)
  const isCn = region === "cn"
  const pageSet = new Set(planner.pages)
  const routeSummary = describePlannerPages(planner.pages, region)
  const text = String(prompt ?? "").toLowerCase()
  const eventDrivenCommunity = planner.productType === "community_hub" && looksLikeEventDrivenCommunityPrompt(text)
  const specialized = planner.productType === "task_workspace" ? getSpecializedWorkspaceFlavor(prompt, region) : null
  const withOptional = (base: string[], extra: Array<string | false | undefined>) =>
    [...base, ...extra.filter((item): item is string => Boolean(item))]
  return {
    archetype,
    productCategory:
      archetype === "code_platform"
        ? /system|ops|control|admin|系统|控制台/.test(text)
          ? isCn ? "AI 运维与工程平台" : "AI operations and engineering platform"
          : isCn ? "AI 代码平台" : "AI code platform"
        : archetype === "crm"
          ? isCn ? "CRM 与销售工作台" : "CRM and sales workspace"
          : archetype === "api_platform"
            ? isCn ? "API 与运行平台" : "API and runtime platform"
            : archetype === "community"
              ? isCn ? "社区与反馈平台" : "Community and feedback platform"
              : archetype === "marketing_admin"
                ? isCn ? "官网与下载平台" : "Website and download platform"
                : specialized
                  ? specialized.category
                : isCn ? "内部工作台" : "Internal workspace",
    targetAudience:
      archetype === "crm"
        ? (isCn ? ["销售团队", "运营负责人"] : ["Sales teams", "ops leads"])
        : archetype === "api_platform"
          ? (isCn ? ["开发者", "平台工程"] : ["Developers", "platform engineers"])
          : archetype === "community"
            ? eventDrivenCommunity
              ? (isCn ? ["社区运营", "活动负责人", "成员增长负责人"] : ["Community operators", "program managers", "member growth leads"])
              : (isCn ? ["社区运营", "成员管理员"] : ["Community operators", "member admins"])
            : archetype === "marketing_admin"
              ? (isCn ? ["品牌团队", "增长负责人"] : ["Brand teams", "growth leads"])
              : archetype === "code_platform"
                ? (isCn ? ["开发者", "产品团队"] : ["Developers", "product teams"])
                : specialized
                  ? [specialized.category]
                : (isCn ? ["内部团队"] : ["Internal teams"]),
    primaryJobs:
      planner.productType === "ai_code_platform"
        ? withOptional(
            /system|ops|control|admin|系统|控制台/.test(text)
              ? isCn
                ? ["编排 AI 工程工作流", "管理发布与运行态", "审查代码与环境变更"]
                : ["Orchestrate AI engineering workflows", "Manage releases and runtime", "Review code and environment changes"]
              : isCn
                ? ["生成全栈应用", "编辑代码并预览", "发布交付"]
                : ["Generate fullstack apps", "Edit code with preview", "Publish delivery"],
            [
              pageSet.has("runs") && (isCn ? "查看运行与构建" : "Inspect runs and builds"),
              pageSet.has("templates") && (isCn ? "切换模板与脚手架" : "Switch templates and scaffolds"),
              /chat|assistant|prompt|conversation|对话|助手/.test(text) && (isCn ? "驱动 AI 对话改动" : "Drive AI chat changes"),
              /command|palette|快捷命令|命令面板/.test(text) && (isCn ? "使用命令面板切换动作" : "Use a command palette for actions"),
            ]
          )
        : planner.productType === "crm_workspace"
          ? withOptional(
              isCn ? ["管理线索", "推进成交", "同步交付"] : ["Manage leads", "advance deals", "sync handoff"],
              [
                pageSet.has("reports") && (isCn ? "查看预测与阶段报表" : "Review forecasts and stage reports"),
                pageSet.has("customers") && (isCn ? "维护客户账户" : "Manage customer accounts"),
              ]
            )
        : planner.productType === "api_platform"
          ? withOptional(
              /security|auth|token|oauth|安全|鉴权|令牌/.test(text)
                ? isCn
                  ? ["管理 OAuth 与令牌策略", "排查安全访问问题", "审查环境授权"]
                  : ["Manage OAuth and token policies", "Inspect secure access issues", "Review environment authorization"]
                : isCn
                  ? ["浏览接口", "查看日志", "管理权限"]
                  : ["Browse endpoints", "inspect logs", "manage access"],
              [
                pageSet.has("webhooks") && (isCn ? "维护 Webhook 投递" : "Operate webhook delivery"),
                pageSet.has("environments") && (isCn ? "管理环境发布" : "Manage environment promotion"),
                /sdk|docs|documentation|guide|文档|说明/.test(text) && (isCn ? "维护开发者文档与 SDK" : "Maintain developer docs and SDKs"),
                /usage|metering|billing|用量|计量|计费/.test(text) && (isCn ? "跟踪调用量与计量" : "Track API usage and metering"),
              ]
            )
            : planner.productType === "community_hub"
              ? withOptional(
                  eventDrivenCommunity
                    ? isCn
                      ? ["策划活动项目", "管理报名与邀请", "运营成员分层"]
                      : ["Plan event programs", "manage registrations and invites", "operate member segments"]
                    : isCn
                      ? ["运营社区", "管理反馈", "维护成员"]
                      : ["Run community", "manage feedback", "maintain members"],
                  [
                    pageSet.has("roadmap") && (isCn ? "推进路线图" : "Drive roadmap visibility"),
                    pageSet.has("posts") && (isCn ? "发布帖子与公告" : "Publish posts and announcements"),
                    eventDrivenCommunity && pageSet.has("events") && (isCn ? "维护活动日程与会话" : "Maintain event schedules and sessions"),
                  ]
                )
              : planner.productType === "content_site"
                ? withOptional(
                    isCn ? ["展示产品", "下载转化", "管理内容"] : ["Present product", "drive downloads", "manage content"],
                    [
                      pageSet.has("pricing") && (isCn ? "承接定价对比" : "Handle pricing comparisons"),
                      pageSet.has("changelog") && (isCn ? "发布版本说明" : "Publish changelog updates"),
                    ]
                  )
                : specialized
                  ? specialized.jobs
                : withOptional(
                    /security|access|permission|role|policy|安全|权限|角色|策略/.test(text)
                      ? isCn
                        ? ["管理访问权限", "审查策略", "同步审计与审批"]
                        : ["Manage access controls", "review policy", "sync audit and approvals"]
                      : /incident|alert|outage|incident response|告警|故障|异常|应急/.test(text)
                        ? isCn
                          ? ["排查告警", "协调恢复", "同步团队状态"]
                          : ["Triage incidents", "coordinate recovery", "sync team status"]
                        : isCn
                          ? ["管理工作流", "跟踪状态", "执行审批"]
                          : ["Manage workflows", "track status", "run approvals"],
                    [
                      pageSet.has("team") && (isCn ? "管理团队与席位" : "Manage team and seats"),
                      pageSet.has("security") && (isCn ? "维护权限与访问边界" : "Maintain permissions and access boundaries"),
                      pageSet.has("audit") && (isCn ? "审查操作留痕" : "Review audit trails"),
                    ]
                  ),
    primaryWorkflow:
      planner.productType === "ai_code_platform"
        ? /system|ops|control|admin|系统|控制台/.test(text)
          ? (isCn ? "规划 -> 改码 -> 预览 -> 发布 -> 观测" : "Plan -> edit -> preview -> release -> observe")
          : (isCn ? "生成 -> 编辑 -> 预览 -> 发布" : "Generate -> edit -> preview -> publish")
        : planner.productType === "crm_workspace"
          ? (isCn ? "线索 -> 商机 -> 成交 -> 交付" : "Lead -> opportunity -> close -> handoff")
          : planner.productType === "api_platform"
            ? /security|auth|token|oauth|安全|鉴权|令牌/.test(text)
              ? (isCn ? "令牌/鉴权 -> 日志排查 -> 环境授权 -> 发布" : "Token/auth -> log triage -> environment access -> release")
              : (isCn ? "接口 -> 日志 -> 权限 -> 环境" : "Endpoint -> logs -> access -> environment")
            : planner.productType === "community_hub"
              ? eventDrivenCommunity
                ? (isCn ? "活动策划 -> 邀请触达 -> 反馈归档 -> 社区运营" : "Event planning -> invite outreach -> feedback intake -> community ops")
                : (isCn ? "反馈 -> 分类 -> 路线图 -> 社区运营" : "Feedback -> triage -> roadmap -> community ops")
              : planner.productType === "content_site"
                ? (isCn ? "官网 -> 价格 -> 下载 -> 分发" : "Website -> pricing -> download -> distribution")
                : specialized
                  ? specialized.workflow
                : /security|access|permission|role|policy|安全|权限|角色|策略/.test(text)
                  ? (isCn ? "策略变更 -> 权限审查 -> 审计留痕 -> 发布" : "Policy change -> access review -> audit trail -> release")
                  : /incident|alert|outage|incident response|告警|故障|异常|应急/.test(text)
                    ? (isCn ? "告警 -> 排查 -> 恢复 -> 复盘" : "Alert -> triage -> recover -> review")
                    : (isCn ? "创建 -> 跟进 -> 审批 -> 完成" : "Create -> track -> approve -> complete"),
    integrationTargets: planner.deploymentDefaults[region === "cn" ? "cn" : "global"],
    automationScopes:
      planner.productType === "crm_workspace"
        ? withOptional(isCn ? ["提醒", "审批", "交付同步"] : ["reminders", "approvals", "handoff sync"], [
            pageSet.has("reports") && (isCn ? "预测更新" : "forecast refresh"),
          ])
        : planner.productType === "api_platform"
          ? withOptional(isCn ? ["告警", "发布验证", "令牌轮换"] : ["alerts", "release checks", "token rotation"], [
              pageSet.has("webhooks") && (isCn ? "回调重试" : "webhook retries"),
              /sdk|docs|documentation|guide|文档|说明/.test(text) && (isCn ? "文档同步" : "docs sync"),
              /usage|metering|billing|用量|计量|计费/.test(text) && (isCn ? "计量结算" : "usage metering"),
            ])
          : planner.productType === "community_hub"
            ? withOptional(
                eventDrivenCommunity
                  ? (isCn ? ["活动提醒", "报名同步", "成员分层同步"] : ["event reminders", "registration sync", "member segment sync"])
                  : (isCn ? ["审核", "活动提醒", "路线图同步"] : ["moderation", "event reminders", "roadmap sync"]),
                [
                  pageSet.has("posts") && (isCn ? "公告发布" : "announcement publishing"),
                  !eventDrivenCommunity && pageSet.has("moderation") && (isCn ? "审核处理" : "moderation handling"),
                ]
              )
            : planner.productType === "content_site"
              ? withOptional(isCn ? ["下载统计", "内容更新", "版本发布"] : ["download analytics", "content updates", "release publishing"], [
                  pageSet.has("pricing") && (isCn ? "套餐文案更新" : "pricing copy refresh"),
                ])
              : specialized
                ? specialized.modules
              : withOptional(
                  /security|access|permission|role|policy|安全|权限|角色|策略/.test(text)
                    ? isCn
                      ? ["权限变更", "审批", "审计同步"]
                      : ["access changes", "approvals", "audit sync"]
                    : /incident|alert|outage|incident response|告警|故障|异常|应急/.test(text)
                      ? isCn
                        ? ["告警分流", "恢复提醒", "复盘汇总"]
                        : ["incident routing", "recovery reminders", "postmortem summaries"]
                      : isCn
                        ? ["AI 改码", "模板切换", "构建验收"]
                        : ["AI edits", "template switching", "build acceptance"],
                  [
                    pageSet.has("team") && (isCn ? "团队同步" : "team sync"),
                    pageSet.has("automations") && (isCn ? "规则执行" : "rule execution"),
                  ]
                ),
    differentiationNotes: [
      planner.summary,
      isCn ? `当前关键入口：${routeSummary}` : `Current key routes: ${routeSummary}`,
      ...(planner.productType === "ai_code_platform"
        ? [
            isCn ? "必须保留 IDE 式工作区与实时预览。" : "Must preserve an IDE-like workspace with live preview.",
            /system|ops|control|admin|系统|控制台/.test(text)
              ? isCn ? "这次需求更偏工程控制台，不能只生成创作型 IDE。" : "This prompt leans toward an engineering control plane, not just a creator IDE."
              : "",
          ].filter(Boolean)
        : planner.productType === "crm_workspace"
          ? [isCn ? "必须体现线索、pipeline、客户三层结构。" : "Must expose lead, pipeline, and customer layers."]
          : planner.productType === "api_platform"
            ? [
                isCn ? "必须体现 endpoint、logs、auth、environments。" : "Must expose endpoints, logs, auth, and environments.",
                /security|auth|token|oauth|安全|鉴权|令牌/.test(text)
                  ? isCn ? "这次需求强调安全与鉴权，不能退化成普通接口列表。" : "This prompt emphasizes security and auth, not a generic endpoint list."
                  : "",
              ].filter(Boolean)
            : planner.productType === "community_hub"
              ? [
                  eventDrivenCommunity
                    ? (isCn ? "必须体现活动、报名、成员分层与社区运营模块。" : "Must expose events, registrations, member segments, and community ops modules.")
                    : (isCn ? "必须体现社区、反馈、成员、运营模块。" : "Must expose community, feedback, members, and ops modules."),
                ]
              : specialized
                ? [isCn ? `必须体现${specialized.category}的实体、流程、字段和页面原型。` : `Must expose the entities, workflow, fields, and page prototypes for a ${specialized.category}.`]
              : [
                  /security|access|permission|role|policy|安全|权限|角色|策略/.test(text)
                    ? isCn ? "这次需求更偏权限与安全控制平面，不能只做普通任务列表。" : "This prompt leans toward a security and access control plane, not a generic task list."
                    : /incident|alert|outage|incident response|告警|故障|异常|应急/.test(text)
                      ? isCn ? "这次需求更偏异常与运维响应，不能退化成普通待办壳。" : "This prompt leans toward incident and ops response, not a generic task shell."
                      : isCn ? "必须体现官网、下载、文档与后台联动。" : "Must connect website, downloads, docs, and admin surfaces.",
                ])],
  }
}

function mergePlannerRouteHintsIntoSpec(spec: AppSpec, plannerRouteBlueprint: NonNullable<AppSpec["routeBlueprint"]>) {
  if (!spec.routeBlueprint?.length || !plannerRouteBlueprint?.length) return spec

  const specById = new Map(
    spec.routeBlueprint.map((route) => [
      route.id,
      route,
    ])
  )
  const specByPath = new Map(
    spec.routeBlueprint.map((route) => [
      route.path,
      route,
    ])
  )
  const mergedRoutes = plannerRouteBlueprint.map((plannerRoute) => {
    const route = specById.get(plannerRoute.id) || specByPath.get(plannerRoute.path) || plannerRoute
    const looksGenericPurpose =
      /core surface in .*used to support/i.test(plannerRoute.purpose || "") ||
      /key surface in this/i.test(plannerRoute.purpose || "")
    const looksGenericActions =
      (plannerRoute.primaryActions ?? []).map((item) => String(item ?? "").trim().toLowerCase()).join("|") ===
        "view page|run action|continue generation" ||
      (plannerRoute.primaryActions ?? []).map((item) => String(item ?? "").trim().toLowerCase()).join("|") ===
        "查看页面|执行主操作|继续生成" ||
      (plannerRoute.primaryActions ?? []).map((item) => String(item ?? "").trim().toLowerCase()).join("|") ===
        "view surface|run primary action|continue iterating" ||
      (plannerRoute.primaryActions ?? []).map((item) => String(item ?? "").trim().toLowerCase()).join("|") ===
        "查看页面|执行主操作|继续迭代"
    return {
      ...route,
      label: plannerRoute.label || route.label,
      purpose: plannerRoute.purpose && !looksGenericPurpose ? plannerRoute.purpose : route.purpose,
      primaryActions: plannerRoute.primaryActions?.length && !looksGenericActions ? plannerRoute.primaryActions : route.primaryActions,
      surface: route.surface,
    }
  })

  const orderedRouteIds = new Set(mergedRoutes.map((route) => route.id))
  const orderedRoutePaths = new Set(mergedRoutes.map((route) => route.path))
  const appendedSpecRoutes = spec.routeBlueprint.filter(
    (route) => !orderedRouteIds.has(route.id) && !orderedRoutePaths.has(route.path)
  )
  const nextRouteBlueprint = [...mergedRoutes, ...appendedSpecRoutes]

  if (spec.kind !== "code_platform" || !spec.moduleBlueprint?.length) {
    return {
      ...spec,
      routeBlueprint: nextRouteBlueprint,
    }
  }

  const resolvedRouteIds = new Set(nextRouteBlueprint.map((route) => route.id))
  const includeRoutes = (ids: string[]) => ids.filter((item) => resolvedRouteIds.has(item))
  const refreshedModules = spec.moduleBlueprint.map((module) => {
    if (module.id === "assistant_context") {
      return { ...module, routeIds: includeRoutes(["assistant", "editor"]) }
    }
    if (module.id === "publish_lane") {
      return { ...module, routeIds: includeRoutes(["publish", "runs", "dashboard"]) }
    }
    if (module.id === "ai_orchestrator") {
      return { ...module, routeIds: includeRoutes(["dashboard", "editor", "assistant", "runs"]) }
    }
    if (module.id === "release_control") {
      return { ...module, routeIds: includeRoutes(["runs", "publish", "settings", "dashboard"]) }
    }
    return module
  })

  return {
    ...spec,
    routeBlueprint: nextRouteBlueprint,
    moduleBlueprint: refreshedModules,
  }
}

function syncCodePlatformPlannerBlueprint(spec: AppSpec): AppSpec {
  if (spec.kind !== "code_platform" || !spec.routeBlueprint?.length || !spec.moduleBlueprint?.length) return spec
  const routeIds = new Set(spec.routeBlueprint.map((route) => route.id))
  const includeRoutes = (ids: string[]) => ids.filter((item) => routeIds.has(item))
  return {
    ...spec,
    moduleBlueprint: spec.moduleBlueprint.map((module) => {
      if (module.id === "assistant_context") {
        return { ...module, routeIds: includeRoutes(["assistant", "editor"]) }
      }
      if (module.id === "publish_lane") {
        return { ...module, routeIds: includeRoutes(["publish", "runs", "dashboard"]) }
      }
      if (module.id === "ai_orchestrator") {
        return { ...module, routeIds: includeRoutes(["dashboard", "editor", "assistant", "runs"]) }
      }
      if (module.id === "release_control") {
        return { ...module, routeIds: includeRoutes(["runs", "publish", "settings", "dashboard"]) }
      }
      return module
    }),
  }
}

function createPlannedAppSpec(args: {
  prompt: string
  region: Region
  planTier: PlanTier
  planner: PlannerSpec
  deploymentTarget: DeploymentTarget
  databaseTarget: DatabaseTarget
  context?: GenerateRequestContext
}): AppSpec {
  const { prompt, region, planTier, planner, deploymentTarget, databaseTarget, context } = args
  const planPolicy = getPlanPolicy(planTier)
  const kind = plannerProductTypeToAppKind(planner.productType)
  const pageSet = new Set(planner.pages)
  const promptDrivenModules = getPromptDrivenPlannerModules(planner.productType, prompt, region, planner.pages)
  const specialized = planner.productType === "task_workspace" ? getSpecializedWorkspaceFlavor(prompt, region) : null
  const templateId =
    kind === "code_platform"
      ? ""
      : getDefaultTemplateIdForPlannerProductType(planner.productType, prompt, context)
  const modules = Array.from(
    new Set(
      [
        ...planner.pages.map((page) => `${page} page`),
        ...planner.templates,
        ...promptDrivenModules,
        ...(planner.productType === "crm_workspace"
          ? region === "cn"
            ? ["销售阶段推进", "客户交付衔接", "负责人节奏", "自动化提醒"]
            : ["Sales stage flow", "Customer handoff", "Owner cadence", "Automation reminders"]
          : planner.productType === "ai_code_platform"
            ? region === "cn"
              ? ["AI 命令中心", "文件工作区", "多标签编辑器", "运行与交付"]
              : ["AI command center", "File workspace", "Multi-tab editor", "Runs and delivery"]
            : planner.productType === "api_platform"
              ? region === "cn"
                ? ["接口目录", "运行日志", "鉴权策略", "环境发布"]
                : ["Endpoint catalog", "Runtime logs", "Auth policy", "Environment promotion"]
              : planner.productType === "community_hub"
                ? region === "cn"
                  ? ["活动运营", "反馈回路", "成员分层", "社区设置"]
                  : ["Event ops", "Feedback loop", "Member segments", "Community settings"]
                  : planner.productType === "content_site"
                    ? region === "cn"
                      ? ["官网叙事", "下载分发", "文档中心", "后台联动"]
                      : ["Website narrative", "Download distribution", "Docs center", "Admin linkage"]
                    : specialized
                      ? specialized.modules
                  : region === "cn"
                    ? ["审批流", "任务队列", "访问控制", "分析视图"]
                    : ["Approval flow", "Task queue", "Access control", "Analytics view"]),
        ...(planner.productType === "crm_workspace"
          ? [
              pageSet.has("reports") ? (region === "cn" ? "预测报表" : "Forecast reporting") : undefined,
              pageSet.has("customers") ? (region === "cn" ? "客户运营" : "Customer operations") : undefined,
            ]
          : planner.productType === "api_platform"
            ? [
                pageSet.has("webhooks") ? (region === "cn" ? "Webhook 投递" : "Webhook delivery") : undefined,
                pageSet.has("environments") ? (region === "cn" ? "环境发布" : "Environment promotion") : undefined,
                pageSet.has("auth") ? (region === "cn" ? "访问策略" : "Access policy") : undefined,
              ]
            : planner.productType === "community_hub"
              ? [
                  pageSet.has("roadmap") ? (region === "cn" ? "路线图规划" : "Roadmap planning") : undefined,
                  pageSet.has("posts") ? (region === "cn" ? "帖子与公告" : "Community content") : undefined,
                  pageSet.has("members") ? (region === "cn" ? "成员分层" : "Member segments") : undefined,
                ]
              : planner.productType === "content_site"
                ? [
                    pageSet.has("pricing") ? (region === "cn" ? "套餐对比" : "Pricing comparison") : undefined,
                    pageSet.has("changelog") ? (region === "cn" ? "版本说明中心" : "Release center") : undefined,
                    pageSet.has("downloads") ? (region === "cn" ? "下载分发中台" : "Distribution hub") : undefined,
                  ]
                : []),
      ].filter((item): item is string => Boolean(item) && !/^ai:/i.test(String(item)))
    )
  ).slice(0, planPolicy.maxGeneratedModules)
  const promptText = String(prompt ?? body?.prompt ?? "").toLowerCase()
  const features = new Set<SpecFeature>(["description_field", "assignee_filter"])
  if (
    planner.productType === "content_site" ||
    planner.productType === "community_hub" ||
    (kind === "code_platform" && /about|story|intro|介绍|说明|关于/.test(promptText))
  ) {
    features.add("about_page")
  }
  if (
    planner.productType === "crm_workspace" ||
    planner.productType === "api_platform" ||
    planner.productType === "task_workspace" ||
    (kind === "code_platform" && /analytics|metrics|usage|analysis|report|分析|指标|用量|报表/.test(promptText)) ||
    planTier === "pro" ||
    planTier === "elite"
  ) {
    features.add("analytics_page")
  }
  if (
    planner.productType === "crm_workspace" ||
    planner.productType === "task_workspace" ||
    (kind === "code_platform" && /blocked|incident|alert|triage|阻塞|异常|告警|排障/.test(promptText)) ||
    planTier === "builder" ||
    planTier === "pro" ||
    planTier === "elite"
  ) {
    features.add("blocked_status")
  }
  if (planTier === "builder" || planTier === "pro" || planTier === "elite") {
    features.add("csv_export")
  }

  const routeBlueprint = buildPlannerRouteBlueprint(planner, region)
  const visualSeed = buildPlannerVisualSeed(planner, planner.productName, prompt)
  const appIntent = buildPlannerIntentSeed(planner, region, prompt)

  const baseSpec = createAppSpec(prompt, region, {
    title: planner.productName,
    kind,
    planTier,
    templateId,
    deploymentTarget,
    databaseTarget,
    modules,
    features: Array.from(features),
    appIntent,
    routeBlueprint,
    visualSeed,
  })

  const mergedSpec = syncCodePlatformPlannerBlueprint(mergePlannerRouteHintsIntoSpec(baseSpec, routeBlueprint))
  const finalizedSpec = finalizeAppSpec(mergedSpec)
  return kind === "code_platform" ? refreshCodePlatformBlueprintNarrative(finalizedSpec) : finalizedSpec
}

function buildDeterministicScaffoldSummary(planner: PlannerSpec, region: Region) {
  const routeSummary = describePlannerPages(planner.pages, region)
  if (region === "cn") {
    if (planner.productType === "ai_code_platform") {
      return `已生成 ${planner.productName} 的 AI 代码平台骨架，当前主入口包括 ${routeSummary}。`
    }
    if (planner.productType === "crm_workspace") {
      return `已生成 ${planner.productName} 的 CRM 工作台骨架，当前主入口包括 ${routeSummary}。`
    }
    if (planner.productType === "api_platform") {
      return `已生成 ${planner.productName} 的 API 平台骨架，当前主入口包括 ${routeSummary}。`
    }
    if (planner.productType === "community_hub") {
      return `已生成 ${planner.productName} 的社区工作区骨架，当前主入口包括 ${routeSummary}。`
    }
    if (planner.productType === "content_site") {
      return `已生成 ${planner.productName} 的官网与下载产品骨架，当前主入口包括 ${routeSummary}。`
    }
    return `已生成 ${planner.productName} 的稳定骨架，当前主入口包括 ${routeSummary}。`
  }

  if (planner.productType === "ai_code_platform") {
    return `Generated the ${planner.productName} AI code platform scaffold with ${routeSummary}.`
  }
  if (planner.productType === "crm_workspace") {
    return `Generated the ${planner.productName} CRM workspace scaffold with ${routeSummary}.`
  }
  if (planner.productType === "api_platform") {
    return `Generated the ${planner.productName} API platform scaffold with ${routeSummary}.`
  }
  if (planner.productType === "community_hub") {
    return `Generated the ${planner.productName} community workspace scaffold with ${routeSummary}.`
  }
  if (planner.productType === "content_site") {
    return `Generated the ${planner.productName} website and download scaffold with ${routeSummary}.`
  }
  return `Generated the ${planner.productName} stable scaffold with ${routeSummary}.`
}

function getResolvedTemplateTitleForSpec(spec: AppSpec, region: Region) {
  const isCn = region === "cn"
  const archetype = getScaffoldArchetype(spec)
  if (archetype === "code_platform") {
    return isCn ? "AI 代码平台基线" : "AI Code Platform Baseline"
  }
  if (archetype === "api_platform") {
    return isCn ? "API 控制平面基线" : "API Control Plane Baseline"
  }
  if (archetype === "community") {
    return isCn ? "社区工作台基线" : "Community Workspace Baseline"
  }
  if (archetype === "marketing_admin" || archetype === "content") {
    return isCn ? "下载站与分发基线" : "Download Site Baseline"
  }
  if (isAdminOpsTaskSpec(spec)) {
    return isCn ? "内部控制平面基线" : "Internal Control Plane Baseline"
  }
  if (archetype === "crm") {
    return isCn ? "CRM 工作台基线" : "CRM Workspace Baseline"
  }
  const template = spec.templateId ? getTemplateById(spec.templateId) : null
  return template ? (isCn ? template.titleZh : template.titleEn) : undefined
}

async function callGeneratorModel(
  prompt: string,
  planner: PlannerSpec,
  region: Region,
  projectId: string,
  planTier: PlanTier,
  context?: GenerateRequestContext,
  deploymentTarget?: DeploymentTarget,
  databaseTarget?: DatabaseTarget,
  options?: {
    compact?: boolean
    priorityOnly?: boolean
  }
): Promise<GeneratorModelOutput> {
  const config = resolveAiConfig({ mode: "builder" })
  const brief = buildGenerationBrief(prompt, region, planTier, context)
  const contextBlock = serializeGenerateContextForPrompt(context)
  const contextSummary = buildGenerateContextSummary(context, region)
  const planPolicySummary = buildPlanPolicySummary(planTier, region, context?.sharedSession?.assignedDomain)
  const deployment = getDeploymentOption(deploymentTarget ?? getDefaultDeploymentTarget(region))
  const database = getDatabaseOption(databaseTarget ?? getDefaultDatabaseTarget(region))
  const compact = Boolean(options?.compact)
  const priorityOnly = Boolean(options?.priorityOnly)
  const maxTokens = getGeneratorMaxTokens(planTier, options)
  const compactPlannerPageLimit = getCompactPlannerPageLimit(planTier)
  const compactBriefLimit = getCompactBriefLimit(planTier)
  const priorityOnlyPlannerPageLimit = getPriorityOnlyPlannerPageLimit(planTier)
  const priorityOnlyBriefLimit = getPriorityOnlyBriefLimit(planTier)
  const compactGuardrails = compact
    ? buildCompactGenerationGuardrails({
        planner,
        planTier,
        context,
        region,
      })
    : ""
  const plannerPayload = compact
    ? {
        productName: planner.productName,
        productType: planner.productType,
        targetLocale: planner.targetLocale,
        pages: planner.pages.slice(0, priorityOnly ? priorityOnlyPlannerPageLimit : compactPlannerPageLimit),
        aiTools: planner.aiTools.slice(0, priorityOnly ? 2 : 4),
        templates: planner.templates.slice(0, priorityOnly ? 2 : 3),
        preferredScaffold: planner.preferredScaffold,
        summary: planner.summary,
      }
    : planner
  const briefPayload = compact
    ? {
        ...brief,
        mandatorySurfaces: brief.mandatorySurfaces.slice(0, priorityOnly ? priorityOnlyBriefLimit : compactBriefLimit),
        interactionRules: brief.interactionRules.slice(0, priorityOnly ? priorityOnlyBriefLimit : compactBriefLimit),
        requiredOperationalFlows: brief.requiredOperationalFlows.slice(0, priorityOnly ? priorityOnlyBriefLimit : compactBriefLimit),
      }
    : brief

  const system = [
    "You are a fullstack Next.js app generator.",
    "Return strict JSON only with this schema:",
    '{"summary":"...", "files":[{"path":"relative/path","content":"full file content"}]}',
    "Rules:",
    "- Use Next.js app router with TypeScript.",
    "- Generate practical multi-feature UI, not placeholder text.",
    "- Keep output runnable and minimal-dependency.",
    "- Keep visual language consistent across hero, cards, controls, spacing, and secondary pages.",
    "- If a template baseline is provided, preserve its layout mood, color system, typography feel, and component density.",
    "- Do not echo the user's raw prompt into the product UI.",
    "- Do not turn every app into the same admin/task board shell.",
    "- Match the product archetype implied by the prompt: code platform, CRM, marketing site, API platform, community hub, etc.",
    "- For high-end prompts, make the result feel showcase-grade and directly demoable to stakeholders.",
    "- Prefer shipping a coherent product surface over exposing generation steps, prompt text, or scaffolding internals.",
    "- Prefer production-like multi-section pages and reusable components over a single simplistic screen.",
    "- Think in two phases: first infer the product archetype and interaction model, then generate implementation files.",
    "- Infer missing but necessary product structure instead of literally mirroring the prompt as headings.",
    "- Avoid static mock screens with dead buttons. Important controls should navigate, switch state, or reveal behavior.",
    "- A complete app must include real user flows, not just a few presentational pages.",
    "- Prefer stateful CRUD patterns, auth-aware surfaces, settings/state transitions, and actionable controls over decorative cards.",
    "- When generating dashboards, editors, admin panels, CRM, or platforms, include the operational flows those products need in order to feel usable.",
    "- When a product needs data, settings, search, runs, or editor behavior, generate simple local API routes and in-memory or file-backed state so the flows can actually be exercised.",
    "- Generated pages should share stateful navigation, not behave like isolated static posters.",
    "- Include settings, share/distribution, permissions, or publish surfaces when they are naturally expected for the product type.",
    "- Treat auth, billing, data mutation, visibility, and delivery controls as product capabilities, not optional polish.",
    "- Search bars, editors, command inputs, tabs, and action buttons must do something observable in the UI instead of acting as dead placeholders.",
    "- For code platforms or IDE-like products, include real file navigation, tab switching, editable code surfaces, runtime status, logs, and command or global search behavior.",
    "- For generated workspaces, include enough local state and API routes so demo flows can be exercised immediately after generation.",
    "- Make the first generated version feel like a usable product: include a strong primary surface, at least 2 supporting routes or views when the product type needs them, and clear navigation between them.",
    "- Prefer a small set of well-connected modules over many shallow placeholder sections. Each major surface should have a reason to exist.",
    "- Keep dependencies conservative. Do not import packages that are not already declared in package.json unless they are truly necessary.",
    "- Avoid fragile code patterns that often break preview startup: missing default exports, invalid hooks usage, browser-only APIs during server render, or references to undefined config.",
    "- Keep admin and market as separate standalone surfaces rather than embedding them into the end-user workspace navigation.",
    "- Prefer modifying these files: app/page.tsx, app/layout.tsx, app/api/items/route.ts, prisma/schema.prisma, README.md.",
    "- If workspace context is provided, treat that page/module/surface as the primary anchor for naming, information hierarchy, and follow-on capability.",
    "- Keep the generated result inside the same product family suggested by the workspace context and plan constraints.",
    "- Treat plan policy as a hard product boundary: do not invent export, database, or collaboration capabilities above the allowed tier.",
    "- Never return markdown, only JSON.",
    ...(compact
      ? [
          "- Compact retry mode: prioritize updating the highest-value product files fast instead of attempting a full rewrite of every surface.",
          "- In compact retry mode, prefer app/page.tsx, app/dashboard/page.tsx, route-level files, and the most visible supporting components.",
          "- In compact retry mode, do not try to regenerate every route. Upgrade the core shell and the most visible business surfaces first.",
          ...(priorityOnly
            ? [
                "- Priority-only rescue mode: touch only the most important route files and a minimal set of shared support files.",
                "- Priority-only rescue mode: if you cannot confidently improve a file, skip it instead of broadening the rewrite.",
              ]
            : []),
        ]
      : []),
  ].join("\n")

  const user = [
    `Project ID: ${projectId}`,
    `Region: ${region}`,
    `Plan tier: ${planTier}`,
    `Plan policy summary:\n${planPolicySummary}`,
    `Deployment target: ${deployment.id} (${deployment.runtime}, dockerRequired=${deployment.dockerRequired})`,
    `Database target: ${database.id} (${database.engine})`,
    `Raw user prompt: ${prompt}`,
    `Planner spec: ${JSON.stringify(plannerPayload)}`,
    `Generation brief: ${JSON.stringify(briefPayload)}`,
    contextSummary ? `Workspace anchor: ${contextSummary}` : "",
    !compact && contextBlock ? `Workspace generation context:\n${contextBlock}` : "",
    getPlanGenerationDirective(planTier, region),
    region === "cn"
      ? "如果需求是中国团队使用的产品，请优先使用中文工作流、项目交付语义、客户转化或团队协作语境。"
      : "If the product is for international users, prefer globally legible workflow, collaboration, and product language.",
    "Do not expose internal notes, prompt text, generation explanation panels, or 'AI result understanding' copy in the final UI unless explicitly requested.",
    "Make different prompt categories produce visibly different products rather than one reused layout.",
    "Generate a production-like MVP app with meaningful structure and interactions.",
    "Respect the selected deployment and database targets when deciding auth, data flow, runtime assumptions, and infrastructure copy.",
    compactGuardrails,
    region === "cn"
      ? "默认按“完整应用”理解，不要只生成几个页面。要优先补齐数据流、操作按钮、状态切换、分享/交付/设置等真实能力。"
      : "Default to a complete application, not a few isolated pages. Prioritize data flow, actions, state transitions, sharing, delivery, and settings.",
    region === "cn"
      ? "如果是平台、后台、编辑器、CRM、数据面板，默认需要有设置、权限、分享、可见性、发布或交付控制之一。"
      : "For platforms, admin tools, editors, CRM, or data panels, include at least some combination of settings, permissions, sharing, visibility, publishing, or delivery controls.",
    region === "cn"
      ? "如果是代码平台或中国版 Cursor 类产品，必须体现：文件树、标签页、可编辑代码、命令/全局搜索、运行日志、模板入口、发布与交付状态。"
      : "For code platforms or Cursor-like products, include: file tree, tabs, editable code, command/global search, runtime logs, template entry, and publish/delivery state.",
    region === "cn"
      ? "产出目标参考成熟 AI SaaS / Base44 风格：不是静态海报页，而是具备导航、主工作区、可操作面板、设置或发布链路的可演示产品。"
      : "Aim closer to a mature AI SaaS / Base44-style MVP: not a poster page, but a demoable product with navigation, a main workspace, actionable panels, and settings or publish flows.",
    compact
      ? region === "cn"
        ? "当前为紧凑重试：优先把最重要的页面和主工作区做对、做稳，不必一次重写所有文件。"
        : "This is a compact retry: prioritize getting the main pages and core workspace right and stable instead of rewriting every file."
      : "",
    compact && priorityOnly
      ? region === "cn"
        ? "当前还是 priority-only rescue：只改最关键的核心页面、layout 和必要支持文件；如果不确定，不要扩大修改面。"
        : "This is also a priority-only rescue: change only the most critical route pages, layout, and essential support files; do not broaden scope if uncertain."
      : "",
  ].join("\n\n")

  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ]
  const { content: raw } = await requestJsonChatCompletion({
    config,
    messages,
    temperature: 0.3,
    timeoutMs: 90_000,
    maxTokens,
    mode: "builder",
  })
  if (!raw) {
    throw new Error("Empty model response")
  }
  const parsed = parseGeneratorOutput(raw)
  if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
    throw new Error("Model returned no files")
  }
  return parsed
}

async function applyGeneratedFiles(
  outDir: string,
  files: GeneratedFile[]
) {
  const changed: string[] = []
  for (const item of files) {
    const relative = normalizePath(String(item.path ?? ""))
    if (!isAllowedFile(relative)) continue
    const absolute = path.resolve(outDir, relative)
    const root = path.resolve(outDir)
    if (!absolute.startsWith(root + path.sep) && absolute !== root) continue
    await writeTextFile(absolute, String(item.content ?? ""))
    changed.push(relative)
  }
  return changed
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function compactBuildLogs(lines: string[], maxChars = 12_000) {
  const joined = lines.join("").trim()
  if (!joined) return [] as string[]
  const trimmed = joined.length > maxChars ? `...${joined.slice(joined.length - maxChars)}` : joined
  return trimmed.split(/\r?\n/).filter(Boolean).slice(-160)
}

async function hasUsableValidationInstall(workspacePath: string) {
  const workspaceNodeModules = path.join(workspacePath, "node_modules")
  const workspaceNextBin = path.join(workspaceNodeModules, "next", "dist", "bin", "next")
  const workspaceReactPkg = path.join(workspaceNodeModules, "react", "package.json")
  return (await pathExists(workspaceNextBin)) && (await pathExists(workspaceReactPkg))
}

async function ensureWorkspaceValidationModules(workspacePath: string) {
  if (await hasUsableValidationInstall(workspacePath)) {
    return true
  }

  const workspaceNodeModules = path.join(workspacePath, "node_modules")
  const hostNodeModules = path.join(process.cwd(), "node_modules")
  const hostNextBin = path.join(hostNodeModules, "next", "dist", "bin", "next")
  const hostReactPkg = path.join(hostNodeModules, "react", "package.json")

  if (!(await pathExists(hostNextBin)) || !(await pathExists(hostReactPkg))) {
    return false
  }

  if (!(await pathExists(workspaceNodeModules))) {
    try {
      await fs.symlink(hostNodeModules, workspaceNodeModules, "dir")
    } catch {
      // noop
    }
  }

  return await hasUsableValidationInstall(workspacePath)
}

async function validateGeneratedWorkspace(workspacePath: string): Promise<WorkspaceBuildResult> {
  if (shouldInlineGenerateWorker()) {
    return {
      status: "skipped",
      logs: ["Skipped: build validation is disabled in the deployed ephemeral runtime."],
    }
  }

  const packageJsonPath = path.join(workspacePath, "package.json")
  const hostNextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next")
  const hostTscBin = path.join(process.cwd(), "node_modules", "typescript", "bin", "tsc")

  if (!(await pathExists(packageJsonPath))) {
    return { status: "skipped", logs: ["Skipped: package.json missing in generated workspace"] }
  }

  if (!(await pathExists(hostNextBin))) {
    return { status: "skipped", logs: ["Skipped: host next build runtime unavailable"] }
  }

  const validationInstallReady = await ensureWorkspaceValidationModules(workspacePath)
  if (!validationInstallReady) {
    return { status: "skipped", logs: ["Skipped: validation install unavailable for generated workspace"] }
  }

  const runTypeScriptValidation = async () => {
    if (!(await pathExists(hostTscBin))) {
      return { status: "failed", logs: ["TypeScript fallback unavailable: host tsc runtime missing"] } satisfies WorkspaceBuildResult
    }
    return new Promise<WorkspaceBuildResult>((resolve) => {
      const output: string[] = []
      const child = spawn(process.execPath, [hostTscBin, "--noEmit", "--pretty", "false"], {
        cwd: workspacePath,
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
          logs: compactBuildLogs([...output, "\nTypeScript fallback timed out after 120000ms."]),
        })
      }, 120_000)
      child.stdout?.on("data", (data) => output.push(String(data)))
      child.stderr?.on("data", (data) => output.push(String(data)))
      child.on("error", (error) => {
        clearTimeout(timer)
        resolve({
          status: "failed",
          logs: compactBuildLogs([...output, `\n${error.message}`]),
        })
      })
      child.on("close", (code) => {
        clearTimeout(timer)
        if (code === 0) {
          resolve({
            status: "ok",
            logs: compactBuildLogs([
              ...output,
              "TypeScript fallback validation passed after Next build exited without actionable diagnostics.",
            ]),
          })
          return
        }
        resolve({
          status: "failed",
          logs: compactBuildLogs(output),
        })
      })
    })
  }

  const typeScriptValidation = await runTypeScriptValidation()
  if (typeScriptValidation.status === "ok") {
    return {
      status: "ok",
      logs: compactBuildLogs([
        ...typeScriptValidation.logs,
        "TypeScript-first workspace validation passed.",
      ]),
    }
  }

  return new Promise<WorkspaceBuildResult>((resolve) => {
    const output: string[] = []
    const child = spawn(process.execPath, [hostNextBin, "build"], {
      cwd: workspacePath,
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
        logs: compactBuildLogs([...output, "\nBuild validation timed out after 240000ms."]),
      })
    }, 240_000)

    child.stdout?.on("data", (data) => output.push(String(data)))
    child.stderr?.on("data", (data) => output.push(String(data)))
    child.on("error", (error) => {
      clearTimeout(timer)
      resolve({
        status: "failed",
        logs: compactBuildLogs([...output, `\n${error.message}`]),
      })
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve({
          status: "ok",
          logs: compactBuildLogs(output),
        })
        return
      }

      const nextBuildLogs = compactBuildLogs(output)
      const shouldTryTypeScriptFallback =
        nextBuildLogs.length === 0 ||
        nextBuildLogs.some((line) => /Next\.js build worker exited with code/i.test(line))

      if (!shouldTryTypeScriptFallback) {
        resolve({
          status: "failed",
          logs: nextBuildLogs,
        })
        return
      }

      void runTypeScriptValidation().then((fallbackResult) => {
        if (fallbackResult.status === "ok") {
          resolve({
            status: "ok",
            logs: compactBuildLogs([
              ...nextBuildLogs,
              ...fallbackResult.logs,
            ]),
          })
          return
        }
        resolve({
          status: "failed",
          logs: compactBuildLogs([
            ...nextBuildLogs,
            ...fallbackResult.logs,
          ]),
        })
      })
    })
  })
}

async function writeGeneratedProjectFiles(
  outDir: string,
  projectId: string,
  region: Region,
  prompt: string,
  options?: {
    projectSlug?: string
    titleOverride?: string
    templateId?: string
    templateStyle?: TemplatePreviewStyle
    planTier?: PlanTier
    deploymentTarget?: DeploymentTarget
    databaseTarget?: DatabaseTarget
    specOverride?: AppSpec
  }
) {
  const dbFile = region === "cn" ? "cn.db" : "intl.db"
  const previewDatabaseTarget: DatabaseTarget = "sqlite" as DatabaseTarget
  const defaults = getRegionDefaults(region)
  const deploymentTarget = options?.deploymentTarget ?? getDefaultDeploymentTarget(region)
  const databaseTarget = previewDatabaseTarget
  const deployment = getDeploymentOption(deploymentTarget)
  const database = getDatabaseOption(databaseTarget)
  const planTier = options?.planTier ?? "free"
  const planPolicy = getPlanPolicy(planTier)
  const assignedDomain = buildAssignedAppUrl({
    projectSlug: options?.projectSlug || projectId,
    projectId,
    region,
    planTier,
  })

  await writeTextFile(
    path.join(outDir, "README.md"),
    `# Generated Fullstack App (${projectId})

Region: ${region}
Preview DB: ${dbFile}
Deploy target: ${deployment.nameEn}
Deploy runtime: ${deployment.runtime}
Production database: ${database.nameEn}

Prompt:
${prompt}

## Install
\`\`\`bash
npm install
\`\`\`

## Run
\`\`\`bash
npx next dev --webpack -p 3001
\`\`\`

## Deployment target
- ${deployment.nameEn}: ${deployment.descriptionEn}
- ${database.nameEn}: ${database.descriptionEn}

## Deployment env
${[...getDeploymentEnvGuide(deploymentTarget), ...getDatabaseEnvGuide(databaseTarget)].map((item) => `- ${item}`).join("\n")}
`
  )

  await writeTextFile(
    path.join(outDir, "package.json"),
    JSON.stringify(
      {
        name: projectId,
        private: true,
        scripts: {
          dev: "next dev --webpack -p 3001",
          build: "next build",
          start: "next start -p 3001",
        },
        dependencies: {
          next: "16.1.6",
          react: "^19",
          "react-dom": "^19",
          "@prisma/client": "^5.22.0",
          "lucide-react": "^0.309.0",
        },
        devDependencies: {
          prisma: "^5.22.0",
          typescript: "^5.0.0",
          "@types/node": "^20.0.0",
          "@types/react": "^19.0.0",
          "@types/react-dom": "^19.0.0",
          postcss: "^8.5.9",
          tailwindcss: "^3.4.19",
          autoprefixer: "^10.5.0",
          eslint: "^9.18.0",
          "eslint-config-next": "16.1.6",
        },
      },
      null,
      2
    )
  )

  await writeTextFile(
    path.join(outDir, "next.config.ts"),
    `import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' http://localhost:3000 http://127.0.0.1:3000",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
`
  )

  await writeTextFile(
    path.join(outDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: false,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
        exclude: ["node_modules"],
      },
      null,
      2
    )
  )

  await writeTextFile(
    path.join(outDir, "next-env.d.ts"),
    "/// <reference types=\"next\" />\n/// <reference types=\"next/image-types/global\" />\n"
  )

  await writeTextFile(
    path.join(outDir, ".env"),
    `DATABASE_URL="file:./${dbFile}"\nAPP_REGION="${region}"\nAPP_PLAN_TIER="${planTier}"\nAPP_GENERATION_PROFILE="${planPolicy.generationProfile}"\nAPP_CODE_EXPORT_LEVEL="${planPolicy.codeExportLevel}"\nAPP_DATABASE_ACCESS_MODE="${planPolicy.databaseAccessMode}"\nAPP_PROJECT_LIMIT="${planPolicy.projectLimit}"\nAPP_COLLABORATOR_LIMIT="${planPolicy.collaboratorLimit}"\nAPP_SUBDOMAIN_SLOTS="${planPolicy.subdomainSlots}"\nAPP_ASSIGNED_DOMAIN="${assignedDomain}"\nAPP_LOCALE="${defaults.language}"\nAPP_TIMEZONE="${defaults.timezone}"\nAPP_CURRENCY="${defaults.currency}"\nAPP_DEPLOY_TARGET="${deploymentTarget}"\nAPP_DEPLOY_RUNTIME="${deployment.runtime}"\nAPP_DEPLOY_DOCKER_REQUIRED="${deployment.dockerRequired ? "true" : "false"}"\nAPP_DATABASE_TARGET="${databaseTarget}"\nAPP_DATABASE_ENGINE="${database.engine}"\n`
  )

  await writeTextFile(
    path.join(outDir, ".env.example"),
    `DATABASE_URL="file:./${dbFile}"\nAPP_REGION="${region}"\nAPP_PLAN_TIER="${planTier}"\nAPP_GENERATION_PROFILE="${planPolicy.generationProfile}"\nAPP_CODE_EXPORT_LEVEL="${planPolicy.codeExportLevel}"\nAPP_DATABASE_ACCESS_MODE="${planPolicy.databaseAccessMode}"\nAPP_PROJECT_LIMIT="${planPolicy.projectLimit}"\nAPP_COLLABORATOR_LIMIT="${planPolicy.collaboratorLimit}"\nAPP_SUBDOMAIN_SLOTS="${planPolicy.subdomainSlots}"\nAPP_ASSIGNED_DOMAIN="${assignedDomain}"\nAPP_LOCALE="${defaults.language}"\nAPP_TIMEZONE="${defaults.timezone}"\nAPP_CURRENCY="${defaults.currency}"\nAPP_DEPLOY_TARGET="${deploymentTarget}"\nAPP_DEPLOY_RUNTIME="${deployment.runtime}"\nAPP_DEPLOY_DOCKER_REQUIRED="${deployment.dockerRequired ? "true" : "false"}"\nAPP_DATABASE_TARGET="${databaseTarget}"\nAPP_DATABASE_ENGINE="${database.engine}"\n${[...getDeploymentEnvGuide(deploymentTarget), ...getDatabaseEnvGuide(databaseTarget)].map((key) => `${key}=`).join("\n")}\n`
  )

  await writeTextFile(
    path.join(outDir, "region.config.json"),
    JSON.stringify(
      {
        region,
        language: defaults.language,
        timezone: defaults.timezone,
        dateFormat: defaults.dateFormat,
        currency: defaults.currency,
        deploymentTarget,
        deploymentRuntime: deployment.runtime,
        databaseTarget,
        databaseEngine: database.engine,
        seedTasks: defaults.seedTasks,
      },
      null,
      2
    )
  )

  const current = await getCurrentSession()
  const latestCompletedPayment = current ? await getLatestCompletedPayment(current.user.id) : null
  const template = options?.templateId ? getTemplateById(options.templateId) : null
  const specToWrite =
    options?.specOverride ??
    createAppSpec(
      prompt,
      region,
      {
        title: options?.titleOverride,
        planTier: options?.planTier ?? ((latestCompletedPayment?.planId as PlanTier | undefined) ?? "free"),
        templateId: options?.templateId,
        templateStyle: options?.templateStyle,
        deploymentTarget,
        databaseTarget,
      } as Parameters<typeof createAppSpec>[2]
    )
  await writeProjectSpec(
    outDir,
    specToWrite
  )

  await writeTextFile(
    path.join(outDir, "app", "api", "items", "route.ts"),
    `import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DATA_FILE = path.join(process.cwd(), "data", "items.json");

async function readItems() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeItems(items: unknown) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function GET() {
  return NextResponse.json(await readItems());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const items = await readItems();
  const next = [
    {
      id: String(Date.now()),
      title,
      description: String(body?.description ?? "").trim() || null,
      status: String(body?.status ?? "todo"),
      priority: String(body?.priority ?? "medium"),
      assignee: String(body?.assignee ?? "").trim() || null,
      createdAt: new Date().toISOString(),
    },
    ...items,
  ];
  await writeItems(next);
  return NextResponse.json(next[0]);
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const items = await readItems();
  const next = items.map((item: any) => item.id === id ? { ...item, ...body } : item);
  await writeItems(next);
  return NextResponse.json(next.find((item: any) => item.id === id) ?? null);
}
`
  )

  await writeTextFile(
    path.join(outDir, "app", "page.tsx"),
    `"use client";

import { useEffect, useState } from "react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  assignee: string | null;
  createdAt: string;
};

export default function Page() {
  const REGION = {
    region: "${region}",
    language: "${defaults.language}",
    timezone: "${defaults.timezone}",
    dateFormat: "${defaults.dateFormat}",
    currency: "${defaults.currency}",
    labels: ${JSON.stringify(defaults.labels)},
    seedTasks: ${JSON.stringify(defaults.seedTasks)},
  } as const;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [loading, setLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);

  async function load() {
    const res = await fetch("/api/items");
    const data = (await res.json()) as Task[];
    setTasks(data);
  }

  async function add() {
    const t = title.trim();
    if (!t) return;
    setLoading(true);
    try {
      await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          assignee: assignee.trim(),
          priority,
          status: "todo",
        }),
      });
      setTitle("");
      setAssignee("");
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(id: string, status: Task["status"]) {
    await fetch("/api/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (seeded) return;
    if (tasks.length > 0) {
      setSeeded(true);
      return;
    }
    const run = async () => {
      for (const item of REGION.seedTasks) {
        await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
      }
      setSeeded(true);
      await load();
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, seeded]);

  const groups: Array<{ key: Task["status"]; label: string }> = [
    { key: "todo", label: REGION.labels.todo },
    { key: "in_progress", label: REGION.labels.inProgress },
    { key: "done", label: REGION.labels.done },
  ];

  const visibleTasks = tasks.filter((t) => {
    const f = assigneeFilter.trim().toLowerCase();
    if (!f) return true;
    return String(t.assignee || "").toLowerCase().includes(f);
  });

  const currencyFmt = new Intl.NumberFormat(REGION.language, {
    style: "currency",
    currency: REGION.currency,
    maximumFractionDigits: 0,
  });
  const dateFmt = new Intl.DateTimeFormat(REGION.language, {
    dateStyle: "medium",
    timeZone: REGION.timezone,
  });

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1200 }}>
      <h1>{REGION.labels.title}</h1>
      <p style={{ color: "#666" }}>
        {REGION.labels.subtitle}
      </p>
      <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
        {REGION.labels.localeInfo}: {REGION.region} | {REGION.language} | {REGION.timezone} | {REGION.dateFormat} | {REGION.currency}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: "#666" }}>
        {REGION.labels.monthlyTarget}: {currencyFmt.format(120000)}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={REGION.labels.taskTitle}
          style={{ flex: 1, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <input
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder={REGION.labels.assignee}
          style={{ width: 160, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <input
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          placeholder={REGION.labels.filter}
          style={{ width: 180, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
          style={{ width: 120, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button
          onClick={add}
          disabled={loading}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
        >
          {loading ? REGION.labels.creating : REGION.labels.create}
        </button>
      </div>

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(3,minmax(0,1fr))",
          gap: 12,
          alignItems: "start",
        }}
      >
        {groups.map((group) => (
          <section
            key={group.key}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 10,
              minHeight: 220,
              background: "#fafafa",
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 8 }}>{group.label}</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {visibleTasks
                .filter((t) => t.status === group.key)
                .map((task) => (
                  <article
                    key={task.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      background: "#fff",
                      padding: 10,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{task.title}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                      {REGION.labels.priority}: {task.priority} | {REGION.labels.assignee}: {task.assignee || "-"} | {dateFmt.format(new Date(task.createdAt))}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      {group.key !== "todo" ? (
                        <button
                          onClick={() => setStatus(task.id, "todo")}
                          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 8px" }}
                        >
                          Todo
                        </button>
                      ) : null}
                      {group.key !== "in_progress" ? (
                        <button
                          onClick={() => setStatus(task.id, "in_progress")}
                          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 8px" }}
                        >
                          Doing
                        </button>
                      ) : null}
                      {group.key !== "done" ? (
                        <button
                          onClick={() => setStatus(task.id, "done")}
                          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 8px" }}
                        >
                          Done
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
`
  )

  await writeTextFile(
    path.join(outDir, "app", "layout.tsx"),
    `import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="${defaults.language}">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
`
  )

  return dbFile
}

function deriveProjectHeadline(prompt: string) {
  const explicitName = extractProductNameFromPrompt(prompt)
  if (explicitName) return explicitName
  const clean = sanitizeUiText(prompt)
  if (!clean) return "Generated Workspace"
  const stripped = clean
    .replace(/^(please|pls|build|create|make|generate|give me|show me|help me|帮我|请帮我|请|给我|生成一个|生成一套|做一个|做一套|弄一个)\s+/i, "")
    .replace(/^(a|an|the|一个|一套|这个|那个)\s+/i, "")
    .replace(/\s*(with|for|that|which|including|plus|and|以及|并且|用于|供)\s+[\s\S]*$/i, "")
    .replace(/(app|application|platform|workspace|system|console|site|website|panel|tool|应用|系统|平台|工作台|后台|控制台|网站|站点|页面)$/i, "")
    .trim()
  if (!stripped) return clean.length > 24 ? `${clean.slice(0, 24)}...` : clean
  return stripped.length > 24 ? `${stripped.slice(0, 24)}...` : stripped
}

function extractProductNameFromPrompt(prompt: string) {
  const patterns = [
    /(?:名字叫|名字是|项目名(?:字)?(?:叫|是)?|产品名(?:字)?(?:叫|是)?|叫做|叫|名为)\s*["“'`]?([\u4e00-\u9fa5A-Za-z0-9][\u4e00-\u9fa5A-Za-z0-9 _-]{1,40}?)(?=\s*(?:的|，|。|,|\.|包含|包括|要求|并且|用于|供|给|with|for|$))["”'`]?/iu,
    /(?:名字叫|名字是|项目名(?:字)?(?:叫|是)?|产品名(?:字)?(?:叫|是)?|叫做|名为)\s*["“'`]?([A-Za-z0-9][A-Za-z0-9 _-]{1,40}?)(?=\s+(?:with|要求|并且|用于|for)\b|[,.，。]|$)["”'`]?/i,
    /(?:name\s+it|call(?:ed)?|named)\s*["“'`]?([A-Za-z0-9][A-Za-z0-9 _-]{1,40}?)(?=\s+(?:with|for|that)\b|[,.，。]|$)["”'`]?/i,
  ]
  for (const re of patterns) {
    const match = prompt.match(re)
    if (match?.[1]) return sanitizeUiText(match[1])
  }
  return ""
}

function inferAppKind(prompt: string) {
  const text = prompt.toLowerCase()
  if (looksLikeApiPlatformPrompt(text)) {
    return "task"
  }
  if (looksLikeCodePlatformPrompt(text)) {
    return "code_platform"
  }
  if (looksLikeSpecializedWorkspacePrompt(text)) {
    return "task"
  }
  if (
    /crm|customer|sales|pipeline|lead|\u5ba2\u6237|\u9500\u552e|\u8ddf\u8fdb/.test(text)
  ) {
    return "crm"
  }
  if (
    /blog|article|post|\u535a\u5ba2|\u6587\u7ae0|\u5185\u5bb9/.test(text)
  ) {
    return "blog"
  }
  if (
    /community|club|social|group|\u793e\u533a|\u793e\u56e2|\u793e\u4ea4/.test(text)
  ) {
    return "community"
  }
  return "task"
}

function inferTemplateIdFromPrompt(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  if (looksLikeApiPlatformPrompt(text)) {
    return "taskflow"
  }
  if (looksLikeCodePlatformPrompt(text)) {
    return "siteforge"
  }
  if (looksLikeMarketingDistributionPrompt(text)) {
    return "launchpad"
  }
  if (looksLikeSpecializedWorkspacePrompt(text)) {
    return undefined
  }
  if (shouldPreferAdminOpsOverCrm(text)) {
    return undefined
  }
  if (/crm|customer|sales|pipeline|lead|\u5ba2\u6237|\u9500\u552e|\u8ddf\u8fdb/.test(text)) {
    return "opsdesk"
  }
  if (/website|landing|homepage|download|docs|documentation|\u5b98\u7f51|\u843d\u5730\u9875|\u4e0b\u8f7d\u9875|\u6587\u6863/.test(text)) {
    return "launchpad"
  }
  if (/admin|ops|internal tool|backoffice|back office|control plane|\u7ba1\u7406\u540e\u53f0|\u8fd0\u8425\u540e\u53f0|\u5185\u90e8\u5de5\u5177|\u5ba1\u6279|\u5de5\u5355|\u63a7\u5236\u53f0/.test(text)) {
    return "opsdesk"
  }
  if (/api|analytics|dashboard|monitoring|usage trend|error alert|\u63a5\u53e3|\u5206\u6790\u5e73\u53f0|\u4eea\u8868\u76d8|\u76d1\u63a7|\u8d8b\u52bf/.test(text)) {
    return "taskflow"
  }
  if (/community|club|social|group|announcement|event|feedback|\u793e\u533a|\u793e\u56e2|\u793e\u4ea4|\u516c\u544a|\u6d3b\u52a8|\u53cd\u9988/.test(text)) {
    return "orbital"
  }
  return undefined
}

function buildGenerationBrief(prompt: string, region: Region, planTier: PlanTier, context?: GenerateRequestContext) {
  const kind = resolveContextAppKind(prompt, context)
  const templateId = resolveTemplateId(prompt, context)
  const isCn = region === "cn"
  const planPolicy = getPlanPolicy(planTier)

  const productArchetype =
    kind === "code_platform"
      ? isCn
        ? "AI 代码编辑平台"
        : "AI coding platform"
      : kind === "crm"
        ? isCn
          ? "销售与客户管理平台"
          : "sales and CRM workspace"
        : kind === "community"
          ? isCn
            ? "社区与反馈平台"
            : "community and feedback platform"
          : kind === "blog"
            ? isCn
              ? "内容与官网平台"
              : "content and marketing platform"
            : isCn
              ? "任务与运营平台"
              : "task and operations workspace"

  const mandatorySurfaces =
    kind === "code_platform"
      ? isCn
        ? ["dashboard 总览", "editor 编辑器", "runs 运行面板", "templates 模板库", "settings 设置页", "pricing 套餐页"]
        : ["dashboard overview", "editor workspace", "runs panel", "template gallery", "settings page", "pricing page"]
      : templateId === "opsdesk"
        ? isCn
          ? ["总览页", "线索页", "任务页", "分析页"]
          : ["overview", "leads", "tasks", "analytics"]
        : templateId === "taskflow"
          ? isCn
            ? ["总览页", "接口或事件页", "分析页", "文档或下载页"]
            : ["overview", "API or incidents page", "analytics", "docs or downloads"]
          : isCn
            ? ["首页", "二级页", "业务板块", "转化入口"]
            : ["home", "secondary page", "business section", "conversion entry"]

  const interactionRules =
    kind === "code_platform"
      ? isCn
        ? [
            "文件树、标签页、AI 模式、模板入口、运行入口必须可点击切换或跳转",
            "左侧文件树、上方标签和中间代码区要联动，不能彼此断开",
            "搜索要能命中文件、符号或命令，终端和运行状态也要能变化",
            "不要只堆卡片，要有 IDE 主壳和页面之间的导航连续性",
            "不要把用户原始要求、Prompt、AI 理解过程显示在产品页面里",
          ]
        : [
            "File tree, tabs, AI modes, template entry, and runtime entry must be clickable or switchable",
            "The explorer, top tabs, and central code surface must stay linked instead of acting like separate mock panels",
            "Search should hit files, symbols, or commands, and terminal/runtime state must visibly change",
            "Do not only stack cards; keep a coherent IDE shell and cross-page navigation",
            "Do not expose the raw user prompt or AI reasoning in the product UI",
          ]
      : isCn
        ? [
            "核心按钮至少要能进行真实跳转，而不是纯展示",
            "生成结果要符合产品类型，不能退化成同一套任务后台",
            "不要显示内部生成流程、Prompt、AI 理解说明",
          ]
        : [
            "Primary actions must navigate somewhere real instead of being decorative",
            "The output must match the product archetype instead of collapsing into one admin shell",
            "Do not show internal generation flow, prompt text, or AI explanation panels",
          ]

  const tierDepth =
    planTier === "elite"
      ? isCn
        ? "精英档：展示级成品感，更多页面、更强层级、更多真实交互。"
        : "Elite tier: showcase-grade surface with more pages, stronger hierarchy, and more real interactions."
      : planTier === "pro"
        ? isCn
          ? "专业档：产品感明显高于免费版，不能只是更换配色或增加几张卡片。"
          : "Pro tier: clearly more product-grade than free, not just recolored cards."
        : planTier === "builder"
          ? isCn
            ? "建造者档：应有更完整工作流、双视图、统计模块和更成熟的信息架构。"
            : "Builder tier: include fuller workflows, dual views, metric modules, and a more mature information architecture."
          : planTier === "starter"
            ? isCn
              ? "启动档：仍走稳定首版，但要比免费层更完整，且保持轻量可控。"
              : "Starter tier: stay on the stable first-version path, but make it more complete than free while remaining controlled."
        : isCn
          ? "免费档：允许范围更小，但仍然要像可用产品骨架。"
          : "Free tier: narrower scope is acceptable, but it must still feel like a usable product skeleton."

  const requiredOperationalFlows =
    kind === "code_platform"
      ? isCn
        ? ["代码编辑", "运行预览", "模板切换", "命令或全局搜索", "保存与回写", "分享/发布", "设置与权限"]
        : ["code editing", "runtime preview", "template switching", "command or global search", "save and write-back", "share/publish", "settings and permissions"]
      : kind === "crm"
        ? isCn
          ? ["线索流转", "负责人分配", "权限设置", "分享与交付"]
          : ["lead flow", "owner assignment", "permission settings", "sharing and delivery"]
        : templateId === "taskflow"
          ? isCn
            ? ["数据查看", "接口或事件处理", "告警或状态流", "发布与权限"]
            : ["data views", "API or incident handling", "alert or state flows", "publishing and permissions"]
          : isCn
            ? ["内容浏览", "操作入口", "设置或可见性", "交付或分享"]
            : ["content browsing", "action entry", "settings or visibility", "delivery or sharing"]

  return {
    kind,
    templateId,
    planPolicySummary: buildPlanPolicySummary(planTier, region, context?.sharedSession?.assignedDomain),
    productArchetype,
    mandatorySurfaces,
    interactionRules,
    tierDepth,
    requiredOperationalFlows,
    budgetHints: {
      routes: planPolicy.maxGeneratedRoutes,
      modules: planPolicy.maxGeneratedModules,
      exportLevel: planPolicy.codeExportLevel,
      databaseMode: planPolicy.databaseAccessMode,
    },
  }
}

async function enforcePromptIdentity(outDir: string, prompt: string) {
  const title = deriveProjectHeadline(prompt)
  const pagePath = path.join(outDir, "app", "page.tsx")
  const changed: string[] = []
  try {
    const raw = await fs.readFile(pagePath, "utf8")
    let next = raw
    if (!next.includes(title)) {
      if (/<h1[^>]*>[\s\S]*?<\/h1>/.test(next)) {
        next = next.replace(/<h1([^>]*)>[\s\S]*?<\/h1>/, `<h1$1>${title}</h1>`)
      } else {
        next = next.replace("Generated Task Workspace", title)
      }
    }
    if (next !== raw) {
      await fs.writeFile(pagePath, next, "utf8")
      changed.push("app/page.tsx")
    }
  } catch {
    // noop
  }
  return changed
}

async function isAiOutputTooGeneric(outDir: string, prompt: string) {
  const kind = inferAppKind(prompt)
  const inferredTemplateId = inferTemplateIdFromPrompt(prompt)
  const pagePath = path.join(outDir, "app", "page.tsx")
  try {
    const page = await fs.readFile(pagePath, "utf8")
    if (/生成流程|Prompt|AI 结果理解|AI understanding|模板与结果预览|当前工作区说明|Generated Files/i.test(page)) return true
    if (kind === "code_platform" && !/MornCursor|代码编辑平台|AI 助手|编辑器|模板库|运行面板/i.test(page)) return true
    if (kind === "code_platform" && !/settings|share|publish|visibility|权限|分享|发布|可见性/i.test(page)) return true
    if (kind === "crm" && !/Lead|pipeline|Qualified|owner/i.test(page)) return true
    if (kind === "crm" && !/settings|invite|share|权限|分享|邀请|设置/i.test(page)) return true
    if (kind === "community" && !/Event|community|member|announcement/i.test(page)) return true
    if (kind === "blog" && !/Post|category|article|editorial/i.test(page)) return true
    if (inferredTemplateId === "launchpad" && !/pricing|download|docs|cta|pricing|文档|下载|转化|定价/i.test(page)) return true
    if (inferredTemplateId === "taskflow" && !/analytics|api|trend|dashboard|usage|接口|分析|趋势|监控/i.test(page)) return true
    if (inferredTemplateId === "taskflow" && !/settings|share|publish|权限|分享|发布|设置/i.test(page)) return true
    if (inferredTemplateId === "opsdesk" && !/sales|lead|owner|pipeline|成交|线索|负责人|阶段/i.test(page)) return true
    if (inferredTemplateId === "orbital" && !/community|event|announcement|feedback|社区|活动|公告|反馈/i.test(page)) return true
    if (page.includes("Generated Task Workspace") && kind !== "task") return true
  } catch {
    return true
  }

  if (kind === "code_platform" || inferredTemplateId === "siteforge") {
    const codePlatformChecks: Array<{ relative: string; pattern: RegExp }> = [
      {
        relative: "app/dashboard/page.tsx",
        pattern: /MornCursor|AI coding|代码编辑|执行轨道|editor|templates|runs/i,
      },
      {
        relative: "app/editor/page.tsx",
        pattern: /AI Assistant|AI 助手|Terminal|终端|Explorer|资源管理器|Generate code|生成代码/i,
      },
      {
        relative: "app/runs/page.tsx",
        pattern: /Runs|运行面板|build|deploy|preview|workspace|demo/i,
      },
      {
        relative: "app/templates/page.tsx",
        pattern: /Templates|模板库|API platform|销售后台|社区反馈|China-ready Cursor|中国版 Cursor/i,
      },
      {
        relative: "app/settings/page.tsx",
        pattern: /Settings|设置|database|deployment|权限|visibility|publish/i,
      },
      {
        relative: "app/pricing/page.tsx",
        pattern: /Free|Starter|Builder|Pro|Elite|免费版|启动版|建造者版|专业版|精英版/i,
      },
    ]

    for (const item of codePlatformChecks) {
      try {
        const content = await fs.readFile(path.join(outDir, item.relative), "utf8")
        if (!item.pattern.test(content)) return true
      } catch {
        return true
      }
    }
  }

  const requiredByTemplate: Record<string, string[]> = {
    siteforge: ["app/dashboard/page.tsx", "app/editor/page.tsx", "app/runs/page.tsx", "app/templates/page.tsx", "app/settings/page.tsx", "app/pricing/page.tsx"],
    opsdesk: ["app/leads/page.tsx"],
    taskflow: ["app/incidents/page.tsx"],
    orbital: ["app/events/page.tsx"],
    launchpad: ["app/downloads/page.tsx"],
  }

  const requiredFiles = inferredTemplateId ? requiredByTemplate[inferredTemplateId] ?? [] : []
  for (const relative of requiredFiles) {
    try {
      await fs.access(path.join(outDir, relative))
    } catch {
      return true
    }
  }

  return false
}

function isRetriableBuilderError(error: unknown) {
  const message = String((error as any)?.message || error || "").toLowerCase()
  return Boolean(
    message &&
      (/timed out|timeout|empty model response|no files|returned no files|no applicable files|model request failed/.test(message))
  )
}

async function applyPromptDrivenFallback(
  outDir: string,
  prompt: string,
  region: Region,
  options?: {
    plannedSpec?: AppSpec
    projectId?: string
    projectSlug?: string
  }
) {
  const previousSpec = await readProjectSpec(outDir)
  const spec =
    options?.plannedSpec
      ? {
          ...options.plannedSpec,
          title: options.plannedSpec.title || previousSpec?.title || options.plannedSpec.title,
          planTier:
            (options.plannedSpec.planTier as PlanTier | undefined) ??
            (previousSpec?.planTier as PlanTier | undefined) ??
            "free",
          deploymentTarget:
            (options.plannedSpec.deploymentTarget as DeploymentTarget | undefined) ??
            (previousSpec?.deploymentTarget as DeploymentTarget | undefined) ??
            getDefaultDeploymentTarget(region),
          databaseTarget:
            (options.plannedSpec.databaseTarget as DatabaseTarget | undefined) ??
            (previousSpec?.databaseTarget as DatabaseTarget | undefined) ??
            getDefaultDatabaseTarget(region),
          updatedAt: new Date().toISOString(),
        }
      : createAppSpec(prompt, region, previousSpec ?? undefined)
  await writeProjectSpec(outDir, spec)
  const files = await buildSpecDrivenWorkspaceFiles(outDir, spec, undefined, {
    projectId: options?.projectId,
    projectSlug: options?.projectSlug,
    assignedDomain:
      options?.projectId || options?.projectSlug
        ? buildAssignedAppUrl({
            projectSlug: options?.projectSlug || options?.projectId || spec.title,
            projectId: options?.projectId,
            region: spec.region,
            planTier: spec.planTier,
          })
        : undefined,
  })
  const changed = new Set<string>()

  for (const file of files) {
    const relative = normalizePath(file.path)
    if (!isAllowedFile(relative)) continue
    const absolute = path.resolve(outDir, relative)
    const root = path.resolve(outDir)
    if (!absolute.startsWith(root + path.sep) && absolute !== root) continue
    await writeTextFile(absolute, file.content)
    changed.add(relative)
  }

  const identityChanged = await enforcePromptIdentity(outDir, prompt)
  for (const item of identityChanged) {
    changed.add(item)
  }

  return Array.from(changed)
}

async function stabilizeGeneratedWorkspace(
  outDir: string,
  prompt: string,
  region: Region,
  options?: {
    plannedSpec?: AppSpec
    projectId?: string
    projectSlug?: string
  }
) {
  const stabilized = await applyPromptDrivenFallback(outDir, prompt, region, options)
  return stabilized
}

async function forceFinishStalledBuilderTask(task: GenerateTaskRecord) {
  const runningForMs = Date.now() - Date.parse(task.updatedAt)
  const hitBuilderPhase = (task.logs ?? []).some((line) => line.includes("[4/6] 正在调用 AI Builder"))
  if (task.status !== "running" || !hitBuilderPhase || runningForMs < BUILDER_STALL_MS) {
    return null
  }

  const rawPrompt = task.rawPrompt || task.prompt
  const region = task.region
  const workflowMode = normalizeGenerateWorkflowMode(task.workflowMode, task.requestContext)
  const outDir = getWorkspacePath(task.projectId)
  await ensureDir(outDir)

  const previousSpec = await readProjectSpec(outDir)
  const planner =
    plannerSnapshotToPlannerSpec(task.planner, region) ??
    fallbackPlannerSpec(
      rawPrompt,
      region,
      previousSpec?.deploymentTarget ?? getDefaultDeploymentTarget(region),
      previousSpec?.databaseTarget ?? getDefaultDatabaseTarget(region),
      task.requestContext
    )
  const plannedSpec = previousSpec
    ? createAppSpec(rawPrompt, region, {
        ...previousSpec,
        planTier: (previousSpec.planTier as PlanTier | undefined) ?? task.planTier ?? "free",
        deploymentTarget: (previousSpec.deploymentTarget as DeploymentTarget | undefined) ?? getDefaultDeploymentTarget(region),
        databaseTarget: (previousSpec.databaseTarget as DatabaseTarget | undefined) ?? getDefaultDatabaseTarget(region),
      })
    : createPlannedAppSpec({
        prompt: rawPrompt,
        region,
        planTier: task.planTier ?? "free",
        planner,
        deploymentTarget: getDefaultDeploymentTarget(region),
        databaseTarget: getDefaultDatabaseTarget(region),
        context: task.requestContext,
      })
  const stabilized = await stabilizeGeneratedWorkspace(outDir, task.prompt, region, {
    plannedSpec,
    projectId: task.projectId,
    projectSlug: planner.productName,
  })
  const fallbackReason =
    region === "cn"
      ? "轮询检测到 AI Builder 长时间卡住，系统已自动切到稳定 fallback 完成态。"
      : "Polling detected that AI Builder was stalled for too long, so the task was auto-finished with the stable fallback."
  const buildResult: WorkspaceBuildResult = {
    status: "skipped",
    logs: [fallbackReason],
  }
  const acceptance = buildGenerationAcceptance({
    prompt: rawPrompt,
    planner,
    plannedSpec,
    workflowMode,
    buildResult,
    context: task.requestContext,
    contextSummary: task.contextSummary,
    fallbackReason,
    changedFiles: Array.from(new Set([...(task.changedFiles ?? []), ...stabilized])),
  })
  const summary =
    region === "cn"
      ? `已保留 ${planner.productName} 的稳定 scaffold，并在检测到 AI Builder 卡住后自动切换到可继续迭代的 fallback 完成态。`
      : `Kept the stable scaffold for ${planner.productName} and auto-finished the task with a reusable fallback after the AI Builder stall was detected.`

  await appendProjectHistory(task.projectId, {
    id: `evt_${Date.now()}`,
    type: "generate",
    prompt: rawPrompt,
    createdAt: new Date().toISOString(),
    status: "done",
    summary,
    buildStatus: buildResult.status,
    buildLogs: buildResult.logs,
    changedFiles: Array.from(new Set([...(task.changedFiles ?? []), ...stabilized])),
  })
  await updateGenerateTask(task.jobId, (current) => ({
    ...current,
    status: "done",
    summary,
    changedFiles: Array.from(new Set([...(current.changedFiles ?? []), ...stabilized])),
    buildStatus: buildResult.status,
    buildLogs: buildResult.logs,
    workflowMode,
    planner:
      current.planner ??
      buildPlannerSnapshot({
        planner,
        plannedSpec,
        workflowMode,
        archetype: resolveGenerateArchetype(rawPrompt, planner.productType, task.requestContext),
        deploymentTarget: plannedSpec.deploymentTarget,
        databaseTarget: plannedSpec.databaseTarget,
        context: task.requestContext,
      }),
    acceptance,
    logs: [...(current.logs ?? []), `[WARN] ${fallbackReason}`],
    error: undefined,
  }))

  return getGenerateTask(task.jobId)
}

async function runGenerateTaskWorker(jobId: string) {
  const current = (await getGenerateTask(jobId)) as GenerateTaskRecord | null
  if (!current) return

  const outDir = getWorkspacePath(current.projectId)
  const rawPrompt = current.rawPrompt || current.prompt
  const projectRecord = (await getProject(current.projectId)) as
    | ({
        deploymentTarget?: DeploymentTarget
        databaseTarget?: DatabaseTarget
      } & Awaited<ReturnType<typeof getProject>>)
    | null
  const deploymentTarget = projectRecord?.deploymentTarget ?? getDefaultDeploymentTarget(current.region)
  const databaseTarget = projectRecord?.databaseTarget ?? getDefaultDatabaseTarget(current.region)
  const currentTemplate = current.templateId ? getTemplateById(current.templateId) : null
  const requestContext = current.requestContext
  const workflowMode = normalizeGenerateWorkflowMode(current.workflowMode, requestContext)
  const logs: string[] = []
  let summary = "Initial project generated"
  let changedFiles: string[] = []
  let fallbackReason = ""
  let plannerSnapshot: GeneratePlanSnapshot | undefined
  let acceptance: GenerateAcceptanceReport | undefined
  let builderWatchdog: NodeJS.Timeout | undefined
  let plannedProjectSlug = current.projectId
  let buildResult: WorkspaceBuildResult = {
    status: "skipped",
    logs: ["Build validation was not attempted yet."],
  }

  const clearBuilderWatchdog = () => {
    if (builderWatchdog) clearTimeout(builderWatchdog)
    builderWatchdog = undefined
  }

  await updateGenerateTask(jobId, (t) => ({ ...t, status: "running", error: undefined }))
  await appendGenerateTaskLog(jobId, "[1/6] 任务开始：准备工作区")
  if (current.templateTitle) {
    await appendGenerateTaskLog(jobId, `[1.5/6] 已预载模板参考：${current.templateTitle}`)
  }
  if (current.contextSummary) {
    await appendGenerateTaskLog(jobId, `[1.6/6] 已锁定生成锚点：${current.contextSummary}`)
  }

  try {
    await ensureDir(outDir)
    await appendGenerateTaskLog(jobId, "[2/6] 正在规划产品蓝图")
    let planner: PlannerSpec
    try {
      planner = constrainPlannerByPlanTier(
        await withTimeout(
          callPlannerModel({
            prompt: rawPrompt,
            region: current.region,
            planTier: current.planTier ?? "free",
            deploymentTarget,
            databaseTarget,
            context: requestContext,
          }),
          PLANNER_TIMEOUT_MS,
          "Planner"
        ),
        current.planTier ?? "free",
        rawPrompt
      )
    } catch (plannerError: any) {
      const reason = plannerError?.message || String(plannerError)
      planner = constrainPlannerByPlanTier(
        fallbackPlannerSpec(rawPrompt, current.region, deploymentTarget, databaseTarget, requestContext),
        current.planTier ?? "free",
        rawPrompt
      )
      await appendGenerateTaskLog(jobId, `[2.2/6] Planner 超时或失败，已回退到本地蓝图：${reason}`)
    }
    await appendGenerateTaskLog(
      jobId,
      `[2.5/6] 规划完成：${planner.productName} · ${planner.productType} · scaffold=${planner.preferredScaffold}`
    )

    const plannedSpec = createPlannedAppSpec({
      prompt: rawPrompt,
      region: current.region,
      planTier: current.planTier ?? "free",
      planner,
      deploymentTarget,
      databaseTarget,
      context: requestContext,
    })
    plannerSnapshot = buildPlannerSnapshot({
      planner,
      plannedSpec,
      workflowMode,
      archetype: resolveGenerateArchetype(rawPrompt, planner.productType, requestContext),
      deploymentTarget,
      databaseTarget,
      context: requestContext,
    })
    const resolvedTemplateTitle = getResolvedTemplateTitleForSpec(plannedSpec, current.region)
    await updateGenerateTask(jobId, (t) => ({
      ...t,
      templateId: plannedSpec.templateId,
      templateTitle: resolvedTemplateTitle,
      workflowMode,
      planner: plannerSnapshot,
    }))
    if (resolvedTemplateTitle && resolvedTemplateTitle !== current.templateTitle) {
      await appendGenerateTaskLog(jobId, `[2.6/6] 已切换到 archetype 基线：${resolvedTemplateTitle}`)
    }
    const scheduleBuilderWatchdog = () => {
      clearBuilderWatchdog()
      builderWatchdog = setTimeout(() => {
        void (async () => {
          const live = await getGenerateTask(jobId)
          if (!live || live.status !== "running") return

          const watchdogReason =
            current.region === "cn"
              ? "AI Builder 长时间未完成，系统已保留稳定 scaffold 并强制结束任务。"
              : "AI Builder did not finish in time, so the worker kept the stable scaffold and force-finished the task."
          const watchdogBuild: WorkspaceBuildResult = {
            status: "skipped",
            logs: [watchdogReason],
          }
          const watchdogSummary =
            current.region === "cn"
              ? `已保留 ${planner.productName} 的稳定 scaffold，并因 AI Builder 超时切换到可继续迭代的 fallback 完成态。`
              : `Kept the stable scaffold for ${planner.productName} and force-finished the task with a reusable fallback after the AI Builder timeout.`
          const watchdogAcceptance = buildGenerationAcceptance({
            prompt: rawPrompt,
            planner,
            plannedSpec,
            workflowMode,
            buildResult: watchdogBuild,
            context: requestContext,
            contextSummary: current.contextSummary,
            fallbackReason: watchdogReason,
            changedFiles,
          })

          await appendProjectHistory(current.projectId, {
            id: `evt_${Date.now()}`,
            type: "generate",
            prompt: current.rawPrompt || current.prompt,
            createdAt: new Date().toISOString(),
            status: "done",
            summary: watchdogSummary,
            buildStatus: watchdogBuild.status,
            buildLogs: watchdogBuild.logs,
            changedFiles,
          })
          await updateGenerateTask(jobId, (t) => ({
            ...t,
            status: "done",
            summary: watchdogSummary,
            changedFiles,
            buildStatus: watchdogBuild.status,
            buildLogs: watchdogBuild.logs,
            workflowMode,
            planner: plannerSnapshot,
            acceptance: watchdogAcceptance,
            logs: [...(t.logs ?? []), `[WARN] ${watchdogReason}`],
            error: undefined,
          }))
        })()
      }, BUILDER_WATCHDOG_MS)
    }
    await writeProjectSpec(outDir, plannedSpec)
    plannedProjectSlug = await reserveProjectSlug(slugifyProjectName(planner.productName), {
      fallbackSlug: slugifyProjectName(deriveProjectHeadline(rawPrompt)),
      excludeProjectId: current.projectId,
    })
    await updateProject(current.projectId, (record) => ({
      ...record,
      projectSlug: plannedProjectSlug || record.projectSlug || record.projectId,
      updatedAt: new Date().toISOString(),
    }))

    if (workflowMode === "discuss") {
      clearBuilderWatchdog()
      summary =
        current.region === "cn"
          ? `已输出 ${planner.productName} 的 plan/spec，当前保留讨论模式，不直接写入工作区代码。`
          : `Prepared the plan/spec for ${planner.productName} in discuss mode without writing workspace code.`
      fallbackReason =
        current.region === "cn"
          ? "Discuss 模式只产出 plan/spec，不进入 scaffold、AI Builder 或 build 验收。"
          : "Discuss mode stops at plan/spec and skips scaffold, AI Builder, and build validation."
      buildResult = {
        status: "skipped",
        logs: [fallbackReason],
      }
      acceptance = buildGenerationAcceptance({
        prompt: rawPrompt,
        planner,
        plannedSpec,
        workflowMode,
        buildResult,
        context: requestContext,
        contextSummary: current.contextSummary,
        fallbackReason,
        changedFiles,
      })
      logs.push("[OK] Discussion plan generated")
      await appendGenerateTaskLog(jobId, "[3/6] Discuss 模式：已生成 plan/spec，跳过代码写入")
      await appendGenerateTaskLog(jobId, "[4/6] Discuss 模式：不调用 AI Builder")
      await appendGenerateTaskLog(jobId, "[5.5/6] Discuss 模式：不执行 build 验收")
      await appendProjectHistory(current.projectId, {
        id: `evt_${Date.now()}`,
        type: "generate",
        prompt: current.rawPrompt || current.prompt,
        createdAt: new Date().toISOString(),
        status: "done",
        summary,
        buildStatus: buildResult.status,
        buildLogs: buildResult.logs,
        changedFiles,
      })
      await updateGenerateTask(jobId, (t) => ({
        ...t,
        status: "done",
        logs: [...(t.logs ?? []), ...logs],
        summary,
        changedFiles,
        buildStatus: buildResult.status,
        buildLogs: buildResult.logs,
        workflowMode,
        planner: plannerSnapshot,
        acceptance,
        error: undefined,
      }))
      await appendGenerateTaskLog(jobId, "[6/6] 生成完成")
      return
    }

    await writeGeneratedProjectFiles(outDir, current.projectId, current.region, rawPrompt, {
      projectSlug: plannedProjectSlug,
      titleOverride: planner.productName,
      templateId: current.templateId,
      templateStyle: currentTemplate?.previewStyle,
      planTier: current.planTier,
      deploymentTarget,
      databaseTarget,
      specOverride: plannedSpec,
    })
    logs.push("[OK] Base scaffold generated")
    await appendGenerateTaskLog(jobId, "[3/6] 基础脚手架已生成")
    const scaffoldFiles = await buildSpecDrivenWorkspaceFiles(outDir, plannedSpec, undefined, {
      projectId: current.projectId,
      projectSlug: plannedProjectSlug,
      assignedDomain: buildAssignedAppUrl({
        projectSlug: plannedProjectSlug || current.projectId,
        projectId: current.projectId,
        region: current.region,
        planTier: current.planTier ?? plannedSpec.planTier,
      }),
    })
    const scaffoldChanged = await applyGeneratedFiles(
      outDir,
      scaffoldFiles.map((file) => ({ path: file.path, content: file.content }))
    )
    changedFiles = Array.from(new Set([...changedFiles, ...scaffoldChanged]))
    await updateGenerateTask(jobId, (t) => ({
      ...t,
      changedFiles,
      workflowMode,
      planner: plannerSnapshot ?? t.planner,
    }))
    await appendGenerateTaskLog(jobId, `[3.5/6] 已按规划落地 ${scaffoldChanged.length} 个 scaffold 文件`)

    const shouldSkipAiBuilder = shouldUseDeterministicGeneratePath({
      plannerProductType: planner.productType,
      workflowMode,
      planTier: current.planTier ?? "free",
      context: requestContext,
    })

    if (shouldSkipAiBuilder) {
      clearBuilderWatchdog()
      fallbackReason =
        current.region === "cn"
          ? "当前走稳定生成路径：先交付完整可运行骨架，再把后续定制交给 iterate/上下文改写。"
          : "Using the deterministic generation path: ship the runnable app scaffold first, then push deeper customization into iterate/context edits."
      summary = buildDeterministicScaffoldSummary(planner, current.region)
      await appendGenerateTaskLog(jobId, "[4/6] 走稳定生成路径：直接交付完整 scaffold，并跳过长耗时自由生成")
      const stabilized = await stabilizeGeneratedWorkspace(outDir, current.prompt, current.region, {
        plannedSpec,
        projectId: current.projectId,
        projectSlug: plannedProjectSlug,
      })
      changedFiles = Array.from(new Set([...changedFiles, ...stabilized]))
      await appendGenerateTaskLog(jobId, `[4.5/6] 已按规划稳定化 ${stabilized.length} 个工作区文件`)
    } else {
      try {
        const effectivePlanTier = current.planTier ?? "free"
        const prefersCompactFirstPass = shouldPreferCompactBuilderPass(effectivePlanTier)
        scheduleBuilderWatchdog()
        await appendGenerateTaskLog(
          jobId,
          prefersCompactFirstPass
            ? "[4/6] 正在调用 AI Builder 生成业务页面和代码（先走紧凑模式）"
            : "[4/6] 正在调用 AI Builder 生成业务页面和代码"
        )
        let modelOutput = await withTimeout(
          callGeneratorModel(
            rawPrompt,
            planner,
            current.region,
            current.projectId,
            effectivePlanTier,
            requestContext,
            deploymentTarget,
            databaseTarget,
            { compact: prefersCompactFirstPass }
          ),
          BUILDER_TIMEOUT_MS,
          "AI Builder"
        )
        if (!modelOutput?.files?.length) {
          throw new Error("AI Builder returned no files")
        }
        const aiChanged = await applyGeneratedFiles(outDir, modelOutput.files)
        changedFiles = Array.from(new Set([...changedFiles, ...aiChanged]))
        clearBuilderWatchdog()

        if (
          shouldAttemptPaidPolishPass({
            planTier: effectivePlanTier,
            plannerProductType: planner.productType,
            aiChangedCount: aiChanged.length,
          })
        ) {
          try {
            await appendGenerateTaskLog(jobId, "[4.3/6] 已命中高阶套餐，正在补一轮轻量 polish")
            const polishOutput = await withTimeout(
              callGeneratorModel(
                rawPrompt,
                planner,
                current.region,
                current.projectId,
                effectivePlanTier,
                requestContext,
                deploymentTarget,
                databaseTarget,
                { compact: true }
              ),
              BUILDER_POLISH_TIMEOUT_MS,
              "AI Builder polish pass"
            )
            const polishChanged = await applyGeneratedFiles(outDir, polishOutput.files)
            if (polishChanged.length) {
              changedFiles = Array.from(new Set([...changedFiles, ...polishChanged]))
              await appendGenerateTaskLog(jobId, `[4.35/6] 轻量 polish 已追加 ${polishChanged.length} 个核心文件`)
              logs.push(`[OK] Paid polish pass applied: ${polishChanged.length} files`)
            }
          } catch (polishError: any) {
            const message = polishError?.message || String(polishError)
            logs.push(`[WARN] Paid polish pass skipped: ${message}`)
            await appendGenerateTaskLog(jobId, `[4.35/6] 轻量 polish 未完成，继续保留当前稳定结果：${message}`)
          }
        }

        const stabilized = await stabilizeGeneratedWorkspace(outDir, current.prompt, current.region, {
          plannedSpec,
          projectId: current.projectId,
          projectSlug: plannedProjectSlug,
        })
        changedFiles = Array.from(new Set([...changedFiles, ...stabilized]))

        if (aiChanged.length > 0) {
          summary =
            current.region === "cn"
              ? `已生成并稳定化 ${aiChanged.length} 个核心文件，工作区可继续预览与迭代`
              : `Generated and stabilized ${aiChanged.length} core files for further preview and iteration`
          logs.push(`[OK] AI generation applied: ${aiChanged.length} files`)
          await appendGenerateTaskLog(jobId, `[4/6] AI 输出已应用：${aiChanged.length} 个文件`)
          await appendGenerateTaskLog(jobId, "[4.5/6] 已对核心页面执行稳定化与模板锁定")
        } else {
          summary = "Structured workspace generated from the built-in product scaffold"
          fallbackReason =
            current.region === "cn"
              ? "AI Builder 未返回可写入文件，已回退到本地稳定 scaffold。"
              : "AI Builder returned no applicable files, so the worker fell back to the local stable scaffold."
          logs.push("[WARN] AI response had no applicable files; fallback applied")
          await appendGenerateTaskLog(jobId, "[4/6] AI 未返回可用文件，已切换到本地业务模板")
        }
      } catch (e: any) {
        const primaryErrorMessage = e?.message || String(e)
        const retryPlanTier = current.planTier ?? "free"
        const retryCompactFirstPass = shouldPreferCompactBuilderPass(retryPlanTier)
        const shouldRetry = shouldRetryAfterPrimaryBuilderFailure({
          planTier: retryPlanTier,
          compactFirstPass: retryCompactFirstPass,
        })
        try {
          if (!shouldRetry) {
            throw new Error(primaryErrorMessage)
          }
          const usePriorityOnlyRescue = retryCompactFirstPass && getPlanRank(retryPlanTier) >= getPlanRank("pro")
          await appendGenerateTaskLog(
            jobId,
            usePriorityOnlyRescue
              ? `[4.2/6] AI Builder 首次未完成，正在使用 priority-only rescue。原因：${primaryErrorMessage}`
              : `[4.2/6] AI Builder 首次未完成，正在使用紧凑重试。原因：${primaryErrorMessage}`
          )
          const retryOutput = await withTimeout(
            callGeneratorModel(
              rawPrompt,
              planner,
              current.region,
              current.projectId,
              retryPlanTier,
              requestContext,
              deploymentTarget,
              databaseTarget,
              { compact: true, priorityOnly: usePriorityOnlyRescue }
            ),
            BUILDER_RETRY_TIMEOUT_MS,
            usePriorityOnlyRescue ? "AI Builder priority-only rescue" : "AI Builder compact retry"
          )
          const retryChanged = await applyGeneratedFiles(outDir, retryOutput.files)
          changedFiles = Array.from(new Set([...changedFiles, ...retryChanged]))
          clearBuilderWatchdog()

          const stabilized = await stabilizeGeneratedWorkspace(outDir, current.prompt, current.region, {
            plannedSpec,
            projectId: current.projectId,
            projectSlug: plannedProjectSlug,
          })
          changedFiles = Array.from(new Set([...changedFiles, ...stabilized]))

          if (retryChanged.length > 0) {
            summary =
              current.region === "cn"
                ? usePriorityOnlyRescue
                  ? `AI Builder 首次超时后，已通过 priority-only rescue 补全 ${retryChanged.length} 个核心文件并完成稳定化。`
                  : `AI Builder 首次超时后，已通过紧凑重试补全 ${retryChanged.length} 个核心文件并完成稳定化。`
                : usePriorityOnlyRescue
                  ? `After the first AI Builder timeout, a priority-only rescue landed ${retryChanged.length} core files and completed stabilization.`
                  : `After the first AI Builder timeout, a compact retry landed ${retryChanged.length} core files and completed stabilization.`
            logs.push(`[WARN] AI generation retried after initial failure: ${primaryErrorMessage}`)
            logs.push(
              usePriorityOnlyRescue
                ? `[OK] Priority-only AI rescue applied: ${retryChanged.length} files`
                : `[OK] Compact AI retry applied: ${retryChanged.length} files`
            )
            await appendGenerateTaskLog(
              jobId,
              usePriorityOnlyRescue
                ? `[4.4/6] priority-only rescue 成功：已应用 ${retryChanged.length} 个核心文件并完成稳定化`
                : `[4.4/6] 紧凑重试成功：已应用 ${retryChanged.length} 个核心文件并完成稳定化`
            )
          } else {
            throw new Error("Compact retry returned no applicable files")
          }
        } catch (retryError: any) {
          clearBuilderWatchdog()
          const fallbackChanged = await stabilizeGeneratedWorkspace(outDir, current.prompt, current.region, {
            plannedSpec,
            projectId: current.projectId,
            projectSlug: plannedProjectSlug,
          })
          changedFiles = Array.from(new Set([...changedFiles, ...fallbackChanged]))
          summary = "Structured workspace generated from the built-in product scaffold"
          fallbackReason = retryError?.message || primaryErrorMessage
          logs.push(`[WARN] AI generation skipped: ${primaryErrorMessage}`)
          if (shouldRetry) {
            logs.push(
              retryCompactFirstPass && getPlanRank(retryPlanTier) >= getPlanRank("pro")
                ? `[WARN] Priority-only AI rescue failed: ${retryError?.message || String(retryError)}`
                : `[WARN] Compact AI retry failed: ${retryError?.message || String(retryError)}`
            )
          } else {
            logs.push("[WARN] Compact AI retry skipped because the first pass already used the compact paid path")
          }
          logs.push(`[OK] Fallback generation applied: ${fallbackChanged.length} files`)
          await appendGenerateTaskLog(
            jobId,
            shouldRetry
              ? retryCompactFirstPass && getPlanRank(retryPlanTier) >= getPlanRank("pro")
                ? `[4/6] AI 调用失败，priority-only rescue 也未完成，已使用本地业务模板。原因：${retryError?.message || primaryErrorMessage}`
                : `[4/6] AI 调用失败，紧凑重试也未完成，已使用本地业务模板。原因：${retryError?.message || primaryErrorMessage}`
              : `[4/6] AI 调用失败，当前套餐已先走紧凑模式，现直接切换到本地业务模板。原因：${primaryErrorMessage}`
          )
        }
      }
    }

    const identityChanged = await enforcePromptIdentity(outDir, current.prompt)
    if (identityChanged.length) {
      changedFiles = Array.from(new Set([...changedFiles, ...identityChanged]))
      logs.push("[OK] Prompt identity enforced in generated page")
      await appendGenerateTaskLog(jobId, "[5/6] 已强制应用 Prompt 标题与业务身份")
    }

    await appendGenerateTaskLog(jobId, "[5.5/6] 正在执行生成后 build 验收")
    buildResult = await validateGeneratedWorkspace(outDir)
    if (buildResult.status === "ok") {
      logs.push("[OK] Build validation passed")
      await appendGenerateTaskLog(jobId, "[5.5/6] Build 验收通过")
    } else if (buildResult.status === "failed") {
      logs.push("[WARN] Build validation failed")
      await appendGenerateTaskLog(jobId, "[5.5/6] Build 验收失败，当前项目将保留并继续使用自身 fallback")
    } else {
      logs.push("[WARN] Build validation skipped")
      if (!fallbackReason) {
        fallbackReason =
          current.region === "cn"
            ? "当前环境缺少可用验证条件，build 验收被跳过。"
            : "Build validation was skipped because the current environment does not have the required validation runtime."
      }
      await appendGenerateTaskLog(jobId, "[5.5/6] Build 验收被跳过：当前环境缺少可用验证条件")
    }

    acceptance = buildGenerationAcceptance({
      prompt: rawPrompt,
      planner,
      plannedSpec,
      workflowMode,
      buildResult,
      context: requestContext,
      contextSummary: current.contextSummary,
      fallbackReason: fallbackReason || undefined,
      changedFiles,
    })

    await appendProjectHistory(current.projectId, {
      id: `evt_${Date.now()}`,
      type: "generate",
      prompt: current.rawPrompt || current.prompt,
      createdAt: new Date().toISOString(),
      status: "done",
      summary,
      buildStatus: buildResult.status,
      buildLogs: buildResult.logs,
      changedFiles,
    })

    await updateGenerateTask(jobId, (t) => ({
      ...t,
      status: "done",
      logs: [...(t.logs ?? []), ...logs],
      summary,
      changedFiles,
      buildStatus: buildResult.status,
      buildLogs: buildResult.logs,
      workflowMode,
      planner: plannerSnapshot,
      acceptance,
      error: undefined,
    }))
    clearBuilderWatchdog()
    await appendGenerateTaskLog(jobId, "[6/6] 生成完成")
  } catch (e: any) {
    clearBuilderWatchdog()
    const err = e?.message || String(e)
    await appendProjectHistory(current.projectId, {
      id: `evt_${Date.now()}`,
      type: "generate",
      prompt: current.rawPrompt || current.prompt,
      createdAt: new Date().toISOString(),
      status: "error",
      summary: "Generate task failed",
      buildStatus: "skipped",
      error: err,
    })
    await updateGenerateTask(jobId, (t) => ({
      ...t,
      status: "error",
      error: err,
      logs: [...(t.logs ?? []), ...logs],
    }))
    await appendGenerateTaskLog(jobId, `[ERROR] 生成中止：${err}`)
  }
}

function scheduleGenerateTaskWorker(jobId: string) {
  setTimeout(() => {
    void runGenerateTaskWorker(jobId)
  }, 0)
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawPrompt = String(body?.prompt ?? "").trim()
    const region = (body?.region === "cn" ? "cn" : "intl") as Region
    const requestedTemplateId = String(body?.templateId ?? "").trim()
    const current = await getCurrentSession()
    const latestCompletedPayment = current ? await getLatestCompletedPayment(current.user.id) : null
    const maxPlanTier = (latestCompletedPayment?.planId as PlanTier | undefined) ?? "free"
    const requestedPlanTier = String(body?.generationPlanTier ?? "").trim() as PlanTier | ""
    const planTierForGeneration =
      current
        ? requestedPlanTier &&
          getPlanRank(requestedPlanTier) <= getPlanRank(maxPlanTier)
            ? requestedPlanTier
            : maxPlanTier
        : requestedPlanTier || "free"
    const provisionalContext = resolveGenerateWorkspaceContext({
      body,
      prompt: rawPrompt,
      region,
      planTier: planTierForGeneration,
      deploymentTarget: normalizeDeploymentTarget(String(body?.deploymentTarget ?? ""), region),
      databaseTarget: normalizeDatabaseTarget(String(body?.databaseTarget ?? ""), region),
    })
    const inferredKind = resolveContextAppKind(rawPrompt, provisionalContext)
    const initialPlannerProductType = resolvePlannerProductType(rawPrompt, provisionalContext)
    const inferredTemplateId =
      inferredKind === "code_platform"
        ? ""
        : getDefaultTemplateIdForPlannerProductType(initialPlannerProductType, rawPrompt, provisionalContext) ||
          resolveTemplateId(rawPrompt, provisionalContext) ||
          ""
    const templateId = requestedTemplateId || inferredTemplateId
    const template = getTemplateById(templateId)
    const templatePrompt = String(body?.templatePrompt ?? "").trim()
    const shouldInjectTemplateBaseline = Boolean(template && requestedTemplateId && inferredKind !== "code_platform")
    const resolvedTemplateBaseline =
      template && shouldInjectTemplateBaseline ? templatePrompt || (region === "cn" ? template.promptZh : template.promptEn) : ""
    const prompt = shouldInjectTemplateBaseline
      ? `${rawPrompt}\n\nTemplate baseline:\n${resolvedTemplateBaseline}\n\nKeep the generated result stylistically close to the selected template while fulfilling the user's request.\n\nGeneration tier: ${planTierForGeneration}.`
      : rawPrompt
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 })
    }

    const deploymentTarget = normalizeDeploymentTarget(String(body?.deploymentTarget ?? ""), region)
    const databaseTarget = normalizeDatabaseTarget(String(body?.databaseTarget ?? ""), region)
    const requestContext = resolveGenerateWorkspaceContext({
      body,
      prompt: rawPrompt,
      region,
      planTier: planTierForGeneration,
      deploymentTarget,
      databaseTarget,
      templateId: template?.id,
      templateTitle: template ? (region === "cn" ? template.titleZh : template.titleEn) : undefined,
    })
    const workflowMode = normalizeGenerateWorkflowMode(
      body?.workflowMode ?? body?.generationMode ?? body?.assistantMode,
      requestContext
    )
    const contextSummary = buildGenerateContextSummary(requestContext, region)
    const projectId = createProjectId()
    const reservedProjectSlug = await reserveProjectSlug(slugifyProjectName(deriveProjectHeadline(rawPrompt)), {
      fallbackSlug: projectId,
    })
    const createdAt = new Date().toISOString()

    await upsertProject({
      projectId,
      projectSlug: reservedProjectSlug,
      region,
      deploymentTarget,
      databaseTarget,
      createdAt,
      updatedAt: createdAt,
      workspacePath: getWorkspacePath(projectId),
      runtime: {
        status: "stopped",
        port: 3001,
        url: buildProjectPreviewPath(projectId),
      },
      previewMode: getDefaultPreviewMode(),
      sandboxRuntime: {
        status: "stopped",
      },
      history: [],
    } as Parameters<typeof upsertProject>[0])

    const task = await createGenerateTask({
      projectId,
      prompt,
      rawPrompt,
      templateId: template?.id,
      templateTitle: template ? (region === "cn" ? template.titleZh : template.titleEn) : undefined,
      planTier: planTierForGeneration,
      region,
      requestContext,
      contextSummary: contextSummary || undefined,
      workflowMode,
    })
    let currentTask: GenerateTask | null = task
    let workspaceSnapshot = null

    if (shouldInlineGenerateWorker()) {
      await runGenerateTaskWorker(task.jobId)
      currentTask = await getGenerateTask(task.jobId)
      workspaceSnapshot = await buildWorkspaceBootstrap({
        projectId,
        task: currentTask,
      })
    } else {
      scheduleGenerateTaskWorker(task.jobId)
    }

    return NextResponse.json({
      projectId,
      jobId: task.jobId,
      status: currentTask?.status ?? "queued",
      prompt,
      rawPrompt,
      templateId: template?.id,
      planTier: planTierForGeneration,
      region,
      deploymentTarget,
      databaseTarget,
      workflowMode,
      context: requestContext,
      contextSummary: contextSummary || undefined,
      summary: currentTask?.summary,
      error: currentTask?.error,
      workspaceSnapshot,
    })
  } catch (e: any) {
    return NextResponse.json({ status: "error", error: e?.message || String(e) }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const maybeJobId = String(searchParams.get("jobId") ?? "").replace(/[^a-zA-Z0-9_-]/g, "")
  const maybeProjectId = safeProjectId(String(searchParams.get("projectId") ?? ""))
  const includeWorkspaceSnapshot = searchParams.get("snapshot") === "1"

  if (!maybeJobId && !maybeProjectId) {
    return NextResponse.json({ status: "error", error: "jobId or projectId is required" }, { status: 400 })
  }

  const task: GenerateTask | null = maybeJobId
    ? await getGenerateTask(maybeJobId)
    : await findLatestTaskByProject(maybeProjectId)

  if (task) {
    let liveTask = task as GenerateTaskRecord
    if (liveTask.status === "queued" && shouldInlineGenerateWorker()) {
      await runGenerateTaskWorker(liveTask.jobId)
      liveTask = ((await getGenerateTask(liveTask.jobId)) ?? liveTask) as GenerateTaskRecord
    }
    if (liveTask.status === "running") {
      const forced = await forceFinishStalledBuilderTask(liveTask)
      if (forced) {
        liveTask = forced as GenerateTaskRecord
      }
    }
    if ((liveTask.status === "queued" || liveTask.status === "running") && Date.now() - Date.parse(liveTask.updatedAt) > STALE_TASK_MS) {
      if ((liveTask.retries ?? 0) < 1) {
        await updateGenerateTask(liveTask.jobId, (t) => ({
          ...t,
          status: "queued",
          error: undefined,
          retries: (t.retries ?? 0) + 1,
          logs: [
            ...(t.logs ?? []),
            "[WARN] 任务在生成中被中断，系统已自动尝试恢复一次",
          ],
        }))
        if (shouldInlineGenerateWorker()) {
          await runGenerateTaskWorker(liveTask.jobId)
        } else {
          scheduleGenerateTaskWorker(liveTask.jobId)
        }
      } else {
        await updateGenerateTask(liveTask.jobId, (t) => ({
          ...t,
          status: "error",
          error: "Generate worker was interrupted twice. Please retry generation.",
          logs: [...(t.logs ?? []), "[ERROR] 任务长时间无进展，自动恢复失败，请重新生成"],
        }))
      }
    }
    const latest = (await getGenerateTask(liveTask.jobId)) as GenerateTaskRecord | null
    const currentTask = (latest ?? liveTask) as GenerateTaskRecord
    const outDir = await resolveProjectPath(currentTask.projectId)
    const workspaceSnapshot =
      includeWorkspaceSnapshot && currentTask.status === "done"
        ? await buildWorkspaceBootstrap({ projectId: currentTask.projectId, task: currentTask })
        : null
    return NextResponse.json({
      projectId: currentTask.projectId,
      jobId: currentTask.jobId,
      status: currentTask.status,
      logs: currentTask.logs ?? [],
      summary: currentTask.summary,
      contextSummary: currentTask.contextSummary,
      workflowMode: currentTask.workflowMode,
      planner: currentTask.planner,
      acceptance: currentTask.acceptance,
      changedFiles: currentTask.changedFiles ?? [],
      buildStatus: currentTask.buildStatus,
      buildLogs: currentTask.buildLogs ?? [],
      templateTitle: currentTask.templateTitle,
      error: currentTask.error,
      appUrl: buildProjectPreviewPath(currentTask.projectId),
      repoUrl: `local://workspaces/${currentTask.projectId}`,
      localPath: outDir ?? getWorkspacePath(currentTask.projectId),
      runCommands: [
        `cd ${outDir ?? getWorkspacePath(currentTask.projectId)}`,
        "npm install",
        "npx next dev -p 3001",
      ],
      workspaceSnapshot,
    })
  }

  const projectId = maybeProjectId
  if (!projectId) {
    return NextResponse.json({ status: "error", error: "Task not found" }, { status: 404 })
  }
  const outDir = await resolveProjectPath(projectId)
  if (!outDir) {
    return NextResponse.json({ projectId, status: "error", error: "Project not found" }, { status: 404 })
  }

  let region: Region = "intl"
  let dbFile = "intl.db"
  try {
    const envText = await fs.readFile(path.join(outDir, ".env"), "utf8")
    if (envText.includes("cn.db")) {
      region = "cn"
      dbFile = "cn.db"
    }
  } catch {
    // noop
  }

  const project = await getProject(projectId)
  const latestGenerate = project?.history
    ?.slice()
    .reverse()
    .find((item) => item.type === "generate")

  return NextResponse.json({
    projectId,
    jobId: projectId,
    status: "done",
    region,
    dbFile,
    logs: latestGenerate?.summary
      ? [`[OK] ${latestGenerate.summary}`]
      : [
          "[OK] Generated Next.js app",
          "[OK] Generated API route: /api/items",
          "[OK] Generated Prisma + SQLite setup",
        ],
    summary: latestGenerate?.summary,
    contextSummary: undefined,
    workflowMode: undefined,
    planner: undefined,
    acceptance: undefined,
    changedFiles: latestGenerate?.changedFiles ?? [],
    buildStatus: latestGenerate?.buildStatus,
    buildLogs: latestGenerate?.buildLogs ?? [],
    templateTitle: undefined,
    appUrl: buildProjectPreviewPath(projectId),
    repoUrl: `local://workspaces/${projectId}`,
    localPath: outDir,
    runCommands: [
      `cd ${outDir}`,
      "npm install",
      "npx next dev -p 3001",
    ],
  })
}
