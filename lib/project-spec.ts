import path from "path"
import { promises as fs } from "fs"
import { type Region, writeTextFile } from "@/lib/project-workspace"
import { buildAssignedAppUrl } from "@/lib/app-subdomain"
import { getPlanPolicy, type PlanTier } from "@/lib/plan-catalog"
import { getTemplateById, type TemplatePreviewStyle } from "@/lib/template-catalog"
import {
  getDatabaseOption,
  getDefaultDatabaseTarget,
  getDefaultDeploymentTarget,
  getDeploymentOption,
  type DatabaseTarget,
  type DeploymentTarget,
} from "@/lib/fullstack-targets"
import {
  buildCodePlatformContextRoutes,
  findCodePlatformRouteByFilePath,
  findCodePlatformRouteByHref,
  findCodePlatformRouteById,
  getLocalizedRouteElements,
  getLocalizedRouteLabel,
  type CodePlatformContextRoute,
  type WorkspaceElementContext,
  type WorkspaceModuleContext,
  type WorkspacePageContext,
  type WorkspaceSessionContext,
} from "@/lib/workspace-ai-context"

export type AppKind = "task" | "crm" | "blog" | "community" | "code_platform"
export type ScaffoldArchetype =
  | "task"
  | "crm"
  | "api_platform"
  | "marketing_admin"
  | "community"
  | "content"
  | "code_platform"

export type SpecFeature =
  | "description_field"
  | "assignee_filter"
  | "blocked_status"
  | "about_page"
  | "csv_export"
  | "analytics_page"

export type SeedItem = {
  title: string
  description: string | null
  assignee: string | null
  priority: "low" | "medium" | "high"
  status: string
}

export type AppIdentityIconSeed = {
  glyph: string
  from: string
  to: string
  ring: string
}

export type AppIntent = {
  archetype: ScaffoldArchetype | "admin_ops_internal_tool"
  productCategory: string
  targetAudience: string[]
  primaryJobs: string[]
  primaryWorkflow: string
  integrationTargets: string[]
  automationScopes: string[]
  differentiationNotes: string[]
}

export type AppIdentity = {
  displayName: string
  shortDescription: string
  archetypeLabel: string
  category: string
  icon: AppIdentityIconSeed
}

export type RoutePagePrototype =
  | "dashboard"
  | "hero"
  | "list"
  | "detail"
  | "form"
  | "kanban"
  | "docs"
  | "distribution"
  | "admin_queue"
  | "timeline"
  | "analytics"
  | "settings"
  | "editor"
  | "workflow"
  | "feed"

export type RouteBlueprint = {
  id: string
  path: string
  label: string
  purpose: string
  moduleIds: string[]
  entityIds: string[]
  primaryActions: string[]
  surface: "workspace" | "dashboard" | "code" | "data" | "settings" | "marketing"
  pagePrototype?: RoutePagePrototype
}

export type ModuleBlueprint = {
  id: string
  label: string
  summary: string
  routeIds: string[]
  capabilityIds: string[]
}

export type EntityBlueprint = {
  id: string
  label: string
  summary: string
  fields: string[]
  primaryViews: string[]
  workflows: string[]
}

export type CapabilityFlags = {
  hasAiChat: boolean
  hasVisualEdit: boolean
  hasCodeEditor: boolean
  hasLivePreview: boolean
  hasControlPlane: boolean
  hasDataConsole: boolean
  hasAutomations: boolean
  hasIntegrations: boolean
  hasApiSurface: boolean
  hasPricing: boolean
  hasPermissions: boolean
  hasPublishing: boolean
}

export type VisualSeed = {
  theme: "dark" | "light"
  tone: string
  density: "compact" | "comfortable"
  navStyle: "editor_shell" | "control_plane" | "marketing_shell" | "community_shell"
  layoutVariant: "split_command" | "sidebar_board" | "story_stack" | "marketing_split" | "docs_console"
  heroVariant: "statement" | "pipeline" | "operations" | "distribution" | "community"
  surfaceVariant: "solid" | "glass" | "soft"
  ctaVariant: "pill" | "block" | "outline"
  icon: AppIdentityIconSeed
}

export type RegionDefaults = {
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
    blocked: string
    done: string
    priority: string
    localeInfo: string
    monthlyTarget: string
    description: string
    search: string
    exportCsv: string
    analytics: string
    about: string
  }
  seedTasks: SeedItem[]
}

export type AppSpec = {
  title: string
  prompt: string
  kind: AppKind
  planTier: PlanTier
  templateId?: string
  templateStyle?: TemplatePreviewStyle
  region: Region
  language: "zh-CN" | "en-US"
  timezone: string
  dateFormat: string
  currency: "CNY" | "USD"
  deploymentTarget: DeploymentTarget
  databaseTarget: DatabaseTarget
  generatedAt: string
  updatedAt: string
  features: SpecFeature[]
  modules: string[]
  seedItems: SeedItem[]
  appIntent?: AppIntent
  appIdentity?: AppIdentity
  routeBlueprint?: RouteBlueprint[]
  moduleBlueprint?: ModuleBlueprint[]
  entityBlueprint?: EntityBlueprint[]
  capabilityFlags?: CapabilityFlags
  visualSeed?: VisualSeed
}

type AppSpecSeed = Partial<AppSpec> & {
  title?: string
  planTier?: PlanTier
  templateId?: string
  templateStyle?: TemplatePreviewStyle
}

type WorkspaceFile = {
  path: string
  content: string
  reason: string
}

export type SpecIterationContext = {
  currentFilePath?: string
  currentRoute?: string
  focusedLine?: number
  currentPage?: WorkspacePageContext
  currentModule?: WorkspaceModuleContext
  currentElement?: WorkspaceElementContext
  sharedSession?: WorkspaceSessionContext
  openTabs?: string[]
  relatedPaths?: string[]
  mode?: "explain" | "fix" | "generate" | "refactor"
}

const FEATURE_SET = new Set<SpecFeature>([
  "description_field",
  "assignee_filter",
  "blocked_status",
  "about_page",
  "csv_export",
  "analytics_page",
])

export function sanitizeUiText(input: string) {
  return String(input ?? "").replace(/[<>`{}]/g, "").replace(/\s+/g, " ").trim()
}

export function getRegionDefaults(region: Region): RegionDefaults {
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
        blocked: "阻塞",
        done: "完成",
        priority: "优先级",
        localeInfo: "区域配置",
        monthlyTarget: "月度目标",
        description: "描述",
        search: "搜索任务、负责人或描述",
        exportCsv: "导出 CSV",
        analytics: "分析页面",
        about: "关于",
      },
      seedTasks: [
        {
          title: "联系潜在客户",
          description: "首轮电话沟通",
          assignee: "张伟",
          priority: "high",
          status: "todo",
        },
        {
          title: "准备产品演示",
          description: "整理案例与报价",
          assignee: "王芳",
          priority: "medium",
          status: "in_progress",
        },
        {
          title: "签约回访",
          description: "确认合同归档",
          assignee: "李雷",
          priority: "low",
          status: "done",
        },
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
      subtitle: "Region-aware defaults: language, timezone, date, currency, and seed data",
      taskTitle: "Task title",
      assignee: "Assignee",
      create: "Create",
      creating: "Creating...",
      filter: "Filter by assignee",
      todo: "Todo",
      inProgress: "In Progress",
      blocked: "Blocked",
      done: "Done",
      priority: "Priority",
      localeInfo: "Region Config",
      monthlyTarget: "Monthly target",
      description: "Description",
      search: "Search title, owner, or description",
      exportCsv: "Export CSV",
      analytics: "Analytics",
      about: "About",
    },
    seedTasks: [
      {
        title: "Reach out to inbound lead",
        description: "Intro call and qualification",
        assignee: "Liam",
        priority: "high",
        status: "todo",
      },
      {
        title: "Prepare demo deck",
        description: "Add ROI section for prospect",
        assignee: "Emma",
        priority: "medium",
        status: "in_progress",
      },
      {
        title: "Contract handoff",
        description: "Sync with legal and finance",
        assignee: "Noah",
        priority: "low",
        status: "done",
      },
    ],
  }
}

export function deriveProjectHeadline(prompt: string, region: Region = "intl") {
  const explicitName = extractProductNameFromPrompt(prompt)
  if (explicitName) return explicitName
  return buildRequirementSummaryTitle(prompt, region)
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

function looksLikeSpecializedWorkspacePrompt(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  return /health|healthcare|medical|clinic|patient|doctor|hospital|appointment|care plan|nurse|医疗|健康|诊所|门诊|患者|医生|医院|预约|病历|护理|复诊|随访|分诊|education|course|student|assignment|school|learning|课程|学生|作业|学校|学习|排课|教务|finance|bank|ledger|transaction|reconciliation|invoice|金融|银行|账本|交易|对账|发票|账务|recruit|hiring|candidate|interview|job role|talent|offer|ats|招聘|候选人|面试|岗位|人才|录用|简历|support|ticket|helpdesk|sla|knowledge base|customer case|escalation|客服|售后|工单|帮助台|知识库|服务等级|客诉|commerce|ecommerce|store|sku|inventory|fulfillment|warehouse|电商|店铺|库存|履约|仓库|订单/.test(
    text
  )
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

function buildRequirementSummaryTitle(prompt: string, region: Region = "intl") {
  const clean = sanitizeUiText(prompt)
  const isCn = region === "cn" || /[\u4e00-\u9fa5]/.test(clean)
  const text = String(prompt ?? "").toLowerCase()
  const archetype = inferScaffoldArchetypeFromPrompt(prompt)
  const domainFlavor = inferDomainFlavor(prompt)
  const isAdminOps = archetype === "task" && shouldPreferAdminOpsOverCrm(text)

  if (isAdminOps) {
    return isCn ? "内部管理控制台" : "Internal Control Plane"
  }

  if (archetype === "code_platform") {
    if (/cursor|copilot|assistant|agent|助手|智能体/.test(text)) return isCn ? "AI 编码工作台" : "AI Coding Workspace"
    if (/publish|release|deploy|preview|运行|发布|预览/.test(text)) return isCn ? "应用交付工作台" : "App Delivery Workspace"
    return isCn ? "AI 代码平台" : "AI Code Platform"
  }

  if (archetype === "crm") {
    if (/renewal|success|account health|续约|客户成功|健康度/.test(text)) return isCn ? "客户续约工作台" : "Customer Renewal Workspace"
    if (/quote|approval|order|invoice|报价|审批|订单|发票/.test(text)) return isCn ? "销售成交工作台" : "Revenue Operations Workspace"
    return isCn ? "客户销售工作台" : "CRM Workspace"
  }

  if (archetype === "api_platform") {
    if (/webhook|callback|delivery|retry|回调|投递|重试/.test(text)) return isCn ? "Webhook 交付平台" : "Webhook Delivery Platform"
    if (/docs|sdk|guide|reference|文档|指南|参考/.test(text)) return isCn ? "开发者接口平台" : "Developer API Platform"
    if (/security|auth|token|oauth|安全|鉴权|令牌/.test(text)) return isCn ? "接口安全控制台" : "API Security Console"
    return isCn ? "API 运行平台" : "API Runtime Platform"
  }

  if (archetype === "community") {
    if (/event|events|meetup|webinar|registration|agenda|活动|报名|议程/.test(text)) return isCn ? "社区活动中枢" : "Community Events Hub"
    if (/feedback|roadmap|vote|wishlist|反馈|路线图|投票/.test(text)) return isCn ? "社区反馈平台" : "Community Feedback Platform"
    return isCn ? "社区运营平台" : "Community Operations Platform"
  }

  if (archetype === "marketing_admin" || archetype === "content") {
    if (/download|downloads|distribution|installer|ios|android|mac|windows|下载|分发|安装/.test(text)) return isCn ? "产品下载中心" : "Product Download Hub"
    if (/docs|documentation|guide|faq|文档|指南|faq/.test(text)) return isCn ? "产品文档官网" : "Product Docs Site"
    return isCn ? "产品增长官网" : "Product Growth Site"
  }

  if (domainFlavor === "healthcare") return isCn ? "医疗运营工作台" : "Healthcare Operations Workspace"
  if (domainFlavor === "education") return isCn ? "教学运营工作台" : "Learning Operations Workspace"
  if (domainFlavor === "finance") return isCn ? "财务对账控制台" : "Finance Reconciliation Console"
  if (domainFlavor === "recruiting") return isCn ? "招聘协同工作台" : "Recruiting Operations Workspace"
  if (domainFlavor === "support") return isCn ? "客服工单工作台" : "Support Operations Workspace"
  if (domainFlavor === "commerce_ops") return isCn ? "履约运营工作台" : "Fulfillment Operations Workspace"

  if (!clean) return isCn ? "生成应用" : "Generated App"
  return isCn ? "业务运营工作台" : "Operations Workspace"
}

function looksLikeCodePlatformPrompt(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  const explicitApiSignals = looksLikeApiPlatformPrompt(text)
  const explicitCodeSignals =
    /cursor|code editor|coding workspace|ai coding|代码编辑器|编程平台|代码平台|代码工作台|开发者工作台|开发者平台|全栈平台|全栈应用生成器|应用生成器|代码助手|base44|app builder|ai app builder|builder workspace|code builder|代码生成平台|ai 编码平台|ai 代码平台|ai 工作台/.test(
      text
    )
  const ideSignals = /\bide\b|editor|file tree|multi-tab|live preview|publish control|模板库|文件树|多标签|实时预览|发布控制|代码标签|代码预览/.test(text)
  if (explicitApiSignals && !ideSignals && !explicitCodeSignals) return false
  return explicitCodeSignals || ideSignals
}

function shouldUseSpecializedWorkspaceTemplateIsolation(prompt: string) {
  return (
    looksLikeSpecializedWorkspacePrompt(prompt) &&
    !looksLikeMarketingDistributionPrompt(prompt) &&
    !looksLikeApiPlatformPrompt(prompt) &&
    !looksLikeCodePlatformPrompt(prompt)
  )
}

export function inferAppKind(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  if (looksLikeApiPlatformPrompt(text)) return "task"
  if (looksLikeCodePlatformPrompt(text)) return "code_platform"
  if (looksLikeSpecializedWorkspacePrompt(text)) return "task"
  if (looksLikeCommunityPrompt(text)) return "community"
  if (shouldPreferAdminOpsOverCrm(text)) return "task"
  if (/crm|customer|sales|pipeline|lead|lead management|customer success|renewal|quote|quotes|客户|销售|线索|跟进|商机|客户成功|续约|报价/.test(text)) return "crm"
  if (/website|landing|homepage|download|docs|documentation|官网|产品官网|产品站|落地页|下载页|下载中心|文档/.test(text)) return "blog"
  if (/blog|article|post|博客|文章|内容/.test(text)) return "blog"
  return "task"
}

function inferTemplateIdFromPrompt(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  if (looksLikeApiPlatformPrompt(text)) {
    return "orbital"
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
  if (looksLikeCommunityPrompt(text)) {
    return "serenity"
  }
  if (shouldPreferAdminOpsOverCrm(text)) {
    return "taskflow"
  }
  if (/crm|customer|sales|pipeline|lead|lead management|customer success|renewal|quote|quotes|客户|销售|线索|跟进|商机|客户成功|续约|报价/.test(text)) {
    return "opsdesk"
  }
  if (/website|landing|homepage|download|docs|documentation|官网|产品官网|产品站|落地页|下载页|下载中心|文档/.test(text)) {
    return "launchpad"
  }
  if (/admin|ops|internal tool|backoffice|back office|control plane|管理后台|运营后台|内部工具|审批|工单|控制台/.test(text)) {
    return "opsdesk"
  }
  if (/api|analytics|dashboard|monitoring|usage trend|error alert|接口|分析平台|仪表盘|监控|趋势/.test(text)) {
    return "taskflow"
  }
  return undefined
}

function uniqueStrings(input: string[]) {
  return Array.from(new Set(input.map((item) => sanitizeUiText(item)).filter(Boolean)))
}

function inferScaffoldArchetypeFromPrompt(prompt: string): ScaffoldArchetype {
  const text = String(prompt ?? "").toLowerCase()
  if (looksLikeMarketingDistributionPrompt(text)) {
    return "marketing_admin"
  }
  if (looksLikeSpecializedWorkspacePrompt(text)) {
    return "task"
  }
  if (looksLikeCommunityPrompt(text)) {
    return "community"
  }
  if (shouldPreferAdminOpsOverCrm(text)) {
    return "task"
  }
  if (/crm|customer|sales|pipeline|lead|lead management|customer success|renewal|quote|quotes|客户|销售|线索|跟进|商机|客户成功|续约|报价/.test(text)) {
    return "crm"
  }
  if (looksLikeApiPlatformPrompt(text)) {
    return "api_platform"
  }
  if (looksLikeCodePlatformPrompt(text)) {
    return "code_platform"
  }
  if (/website|landing|homepage|download|docs|documentation|marketing|brand|官网|产品官网|产品站|落地页|下载页|下载中心|文档|品牌|增长/.test(text)) {
    return "marketing_admin"
  }
  if (/blog|article|post|博客|文章|内容/.test(text)) {
    return "content"
  }
  return "task"
}

export function getScaffoldArchetype(spec: Pick<AppSpec, "kind" | "templateId" | "prompt">): ScaffoldArchetype {
  if (spec.kind === "code_platform") return "code_platform"
  if (shouldUseSpecializedWorkspaceTemplateIsolation(spec.prompt)) return "task"
  if (spec.kind === "crm" || spec.templateId === "opsdesk") return "crm"
  if (spec.kind === "community" || spec.templateId === "serenity") return "community"
  if (spec.templateId === "orbital") return "api_platform"
  if (spec.templateId === "taskflow") return "task"
  if (spec.templateId === "launchpad") return "marketing_admin"
  if (spec.kind === "blog") return "content"
  return inferScaffoldArchetypeFromPrompt(spec.prompt)
}

function scaffoldArchetypeToKind(archetype: ScaffoldArchetype): AppKind {
  if (archetype === "code_platform") return "code_platform"
  if (archetype === "crm") return "crm"
  if (archetype === "community") return "community"
  if (archetype === "marketing_admin" || archetype === "content") return "blog"
  return "task"
}

function getDefaultTemplateIdForArchetype(archetype: ScaffoldArchetype) {
  if (archetype === "code_platform") return "siteforge"
  if (archetype === "crm") return "opsdesk"
  if (archetype === "community") return "serenity"
  if (archetype === "marketing_admin" || archetype === "content") return "launchpad"
  if (archetype === "api_platform") return "orbital"
  return undefined
}

function pushFeature(features: SpecFeature[], feature: SpecFeature) {
  if (!features.includes(feature)) features.push(feature)
}

function pushModule(modules: string[], module: string) {
  const safe = sanitizeUiText(module)
  if (safe && !modules.includes(safe)) modules.push(safe)
}

function getSpecializedWorkspaceModules(prompt: string, region: Region, layer: "core" | "surface" | "delivery") {
  const flavor = inferDomainFlavor(prompt)
  const isCn = region === "cn"
  if (flavor === "healthcare") {
    if (layer === "core") return isCn ? ["患者队列", "预约排程", "护理计划", "风险预警"] : ["Patient queue", "Appointment scheduling", "Care plans", "Risk alerts"]
    if (layer === "surface") return isCn ? ["分诊视图", "复诊提醒", "护理任务", "账单状态"] : ["Triage view", "Follow-up reminders", "Care tasks", "Billing status"]
    return isCn ? ["首版医务台", "今日预约流", "护理随访节奏"] : ["First clinic workspace", "Today appointment flow", "Care follow-up rhythm"]
  }
  if (flavor === "education") {
    if (layer === "core") return isCn ? ["课程目录", "学生进度", "作业流", "学习反馈"] : ["Course catalog", "Student progress", "Assignment flow", "Learning feedback"]
    if (layer === "surface") return isCn ? ["班级排课", "课程卡片", "作业批改", "通知提醒"] : ["Class scheduling", "Course cards", "Assignment review", "Learning notices"]
    return isCn ? ["首版教务台", "学习进度看板", "课程运营节奏"] : ["First learning workspace", "Student progress board", "Course operations rhythm"]
  }
  if (flavor === "finance") {
    if (layer === "core") return isCn ? ["账本视图", "交易流水", "对账队列", "异常处理"] : ["Ledger view", "Transaction feed", "Reconciliation queue", "Exception handling"]
    if (layer === "surface") return isCn ? ["账户分层", "凭证匹配", "差异复核", "报表导出"] : ["Account segments", "Receipt matching", "Variance review", "Report export"]
    return isCn ? ["首版财务台", "对账状态流", "异常处理节奏"] : ["First finance console", "Reconciliation status flow", "Exception handling rhythm"]
  }
  if (flavor === "recruiting") {
    if (layer === "core") return isCn ? ["候选人池", "岗位需求", "面试排程", "Offer 审批"] : ["Candidate pool", "Role planning", "Interview scheduling", "Offer approvals"]
    if (layer === "surface") return isCn ? ["简历筛选", "面试反馈", "招聘漏斗", "团队目标"] : ["Resume screening", "Interview feedback", "Hiring funnel", "Team targets"]
    return isCn ? ["首版招聘台", "候选人推进流", "面试协同节奏"] : ["First hiring workspace", "Candidate progression flow", "Interview coordination rhythm"]
  }
  if (flavor === "support") {
    if (layer === "core") return isCn ? ["工单队列", "客户案例", "SLA 升级", "知识库"] : ["Ticket queue", "Customer cases", "SLA escalation", "Knowledge base"]
    if (layer === "surface") return isCn ? ["售后处理", "升级规则", "解决时长", "客服报表"] : ["After-sales handling", "Escalation rules", "Resolution time", "Support reporting"]
    return isCn ? ["首版客服台", "工单解决流", "知识沉淀节奏"] : ["First support desk", "Ticket resolution flow", "Knowledge capture rhythm"]
  }
  if (flavor === "commerce_ops") {
    if (layer === "core") return isCn ? ["SKU 管理", "库存水位", "履约订单", "补货预警"] : ["SKU management", "Inventory levels", "Fulfillment orders", "Reorder alerts"]
    if (layer === "surface") return isCn ? ["仓库分配", "供应商协同", "异常订单", "发货节奏"] : ["Warehouse allocation", "Supplier coordination", "Order exceptions", "Shipping rhythm"]
    return isCn ? ["首版履约台", "库存补货流", "订单异常节奏"] : ["First fulfillment desk", "Inventory replenishment flow", "Order exception rhythm"]
  }
  return []
}

function hasFeature(spec: AppSpec, feature: SpecFeature) {
  return spec.features.includes(feature)
}

function getStatusConfig(spec: AppSpec): Array<{ key: string; label: string }> {
  const base: Array<{ key: string; label: string }> =
    spec.kind === "crm"
      ? spec.region === "cn"
        ? [
            { key: "todo", label: "新线索" },
            { key: "in_progress", label: "已沟通" },
            { key: "done", label: "已成交" },
          ]
        : [
            { key: "todo", label: "New Lead" },
            { key: "in_progress", label: "Qualified" },
            { key: "done", label: "Won" },
          ]
      : [
          { key: "todo", label: spec.region === "cn" ? "待办" : "Todo" },
          { key: "in_progress", label: spec.region === "cn" ? "进行中" : "In Progress" },
          { key: "done", label: spec.region === "cn" ? "完成" : "Done" },
        ]

  if (hasFeature(spec, "blocked_status")) {
    base.splice(2, 0, {
      key: "blocked",
      label: spec.region === "cn" ? "阻塞" : "Blocked",
    })
  }
  return base
}

function getKindModules(kind: AppKind, region: Region, archetype?: ScaffoldArchetype, prompt?: string) {
  const promptText = String(prompt ?? "").toLowerCase()
  const prefersAdminOps = archetype === "task" && shouldPreferAdminOpsOverCrm(promptText)
  const specializedModules = archetype === "task" ? getSpecializedWorkspaceModules(promptText, region, "core") : []
  if (specializedModules.length) return specializedModules
  if (archetype === "api_platform") {
    return region === "cn"
      ? ["接口目录", "日志检索", "鉴权策略", "环境切换"]
      : ["Endpoint catalog", "Log explorer", "Auth policy", "Environment switching"]
  }
  if (archetype === "marketing_admin") {
    return region === "cn"
      ? ["官网入口", "下载分发", "文档中心", "后台控制台"]
      : ["Website entry", "Download distribution", "Docs center", "Admin console"]
  }
  if (kind === "code_platform") {
    return region === "cn"
      ? ["AI 对话编程", "项目文件树", "多标签编辑器", "终端与运行反馈"]
      : ["AI coding panel", "Project file tree", "Multi-tab editor", "Terminal and run feedback"]
  }
  if (kind === "crm") {
    return region === "cn"
      ? ["销售线索", "阶段推进", "报价审批", "负责人视图"]
      : ["Lead pipeline", "Stage workflow", "Quote approvals", "Owner view"]
  }
  if (kind === "blog") {
    return region === "cn"
      ? ["官网首页", "下载中心", "文档入口", "更新日志"]
      : ["Homepage", "Download center", "Docs entry", "Changelog"]
  }
  if (kind === "community") {
    return region === "cn"
      ? ["活动安排", "成员分组", "公告管理"]
      : ["Events", "Member groups", "Announcements"]
  }
  if (prefersAdminOps) {
    return region === "cn"
      ? ["任务推进", "负责人筛选", "优先级筛选", "进度图表", "负载图表"]
      : ["Task progression", "Owner filtering", "Priority filtering", "Progress charts", "Workload charts"]
  }
  return region === "cn"
    ? ["任务看板", "优先级管理", "负责人协同", "状态推进"]
    : ["Task board", "Priority management", "Assignee collaboration", "Status progression"]
}

function getArchetypeModules(archetype: ScaffoldArchetype, region: Region, prompt?: string) {
  const promptText = String(prompt ?? "").toLowerCase()
  const prefersAdminOps = archetype === "task" && shouldPreferAdminOpsOverCrm(promptText)
  const specializedModules = archetype === "task" ? getSpecializedWorkspaceModules(promptText, region, "surface") : []
  if (specializedModules.length) return specializedModules
  if (archetype === "api_platform") {
    return region === "cn"
      ? ["接口目录", "日志检索", "鉴权策略", "环境切换", "Webhook 恢复"]
      : ["Endpoint catalog", "Log explorer", "Auth policy", "Environment switching", "Webhook recovery"]
  }
  if (archetype === "marketing_admin") {
    return region === "cn"
      ? ["官网入口", "下载分发", "文档中心", "更新日志", "后台控制台"]
      : ["Website entry", "Download distribution", "Docs center", "Changelog", "Admin console"]
  }
  if (archetype === "community") {
    return region === "cn"
      ? ["反馈收集", "路线图", "公告与成员", "审核规则"]
      : ["Feedback intake", "Roadmap", "Announcements and members", "Moderation rules"]
  }
  if (archetype === "content") {
    return region === "cn"
      ? ["首页叙事", "下载中心", "文档中心", "定价页面"]
      : ["Homepage narrative", "Download hub", "Docs center", "Pricing page"]
  }
  if (prefersAdminOps) {
    return region === "cn"
      ? ["任务推进", "负责人筛选", "优先级筛选", "进度图表", "负载图表"]
      : ["Task progression", "Owner filtering", "Priority filtering", "Progress charts", "Workload charts"]
  }
  return []
}

function getPlanModules(planTier: PlanTier, region: Region, archetype?: ScaffoldArchetype, prompt?: string) {
  const promptText = String(prompt ?? "").toLowerCase()
  const prefersAdminOps = archetype === "task" && shouldPreferAdminOpsOverCrm(promptText)
  const specializedModules = archetype === "task" ? getSpecializedWorkspaceModules(promptText, region, "delivery") : []
  if (planTier === "elite") {
    if (specializedModules.length) return specializedModules
    if (archetype === "code_platform") {
      return region === "cn"
        ? ["多工作区切换", "发布审计轨道", "团队编码协同"]
        : ["Multi-workspace switcher", "Release audit rail", "Team coding collaboration"]
    }
    if (archetype === "api_platform") {
      return region === "cn"
        ? ["多环境发布", "密钥轮换控制", "团队平台治理"]
        : ["Multi-environment release", "Key rotation controls", "Platform governance"]
    }
    if (archetype === "marketing_admin") {
      return region === "cn"
        ? ["多端分发工作台", "展示级品牌系统", "团队发布协同"]
        : ["Multi-device distribution", "Showcase brand system", "Team publishing collaboration"]
    }
    if (prefersAdminOps) {
      return region === "cn"
        ? ["跨团队访问治理", "审计导出轨道", "事件指挥工作区"]
        : ["Cross-team access governance", "Audit export rail", "Incident command workspace"]
    }
    return region === "cn"
      ? ["多页面工作台", "展示级视觉系统", "团队协同模块"]
      : ["Multi-page workspace", "Showcase visual system", "Team collaboration modules"]
  }
  if (planTier === "pro") {
    if (specializedModules.length) return specializedModules
    if (archetype === "code_platform") {
      return region === "cn"
        ? ["运行分析总览", "导出交付流程", "持续改码面板"]
        : ["Run analytics overview", "Export delivery flow", "Continuous code iteration"]
    }
    if (archetype === "api_platform") {
      return region === "cn"
        ? ["接口分析总览", "日志导出流程", "持续发布面板"]
        : ["API analytics overview", "Log export flow", "Continuous release panel"]
    }
    if (archetype === "community") {
      return region === "cn"
        ? ["社区分析总览", "成员导出流程", "持续运营面板"]
        : ["Community analytics overview", "Member export flow", "Continuous ops panel"]
    }
    if (prefersAdminOps) {
      return region === "cn"
        ? ["安全分析总览", "审批导出流程", "持续治理面板"]
        : ["Security analytics overview", "Approval export flow", "Continuous governance panel"]
    }
    return region === "cn"
      ? ["分析总览", "导出流程", "持续迭代面板"]
      : ["Analytics overview", "Export flow", "Continuous iteration panel"]
  }
  if (planTier === "builder") {
    if (specializedModules.length) return specializedModules
    if (archetype === "code_platform") {
      return region === "cn"
        ? ["分屏代码预览", "文件筛选器", "运行指标卡"]
        : ["Split code preview", "File filters", "Run metrics"]
    }
    if (archetype === "api_platform") {
      return region === "cn"
        ? ["接口列表视图", "环境筛选器", "用量指标卡"]
        : ["Endpoint list views", "Environment filters", "Usage metrics"]
    }
    if (archetype === "community") {
      return region === "cn"
        ? ["成员与反馈双视图", "分群筛选", "活跃度指标卡"]
        : ["Member and feedback views", "Audience filters", "Engagement metrics"]
    }
    if (archetype === "marketing_admin") {
      return region === "cn"
        ? ["落地页与下载双视图", "渠道筛选", "转化指标卡"]
        : ["Landing and download views", "Channel filters", "Conversion metrics"]
    }
    if (prefersAdminOps) {
      return region === "cn"
        ? ["审批与审计双视图", "权限筛选器", "事件指标卡"]
        : ["Approvals and audit views", "Policy filters", "Incident metrics"]
    }
    return region === "cn"
      ? ["看板与列表双视图", "分组筛选", "统计卡片"]
      : ["Board and list views", "Grouped filtering", "Metric cards"]
  }
  if (planTier === "starter" || planTier === "free") {
    if (specializedModules.length) return specializedModules
    if (archetype === "code_platform") {
      return region === "cn"
        ? ["首版编码工作台", "快速生成入口", "运行状态流转"]
        : ["First coding workspace", "Quick generation entry", "Run status workflow"]
    }
    if (archetype === "crm") {
      return region === "cn"
        ? ["Pipeline 控制室", "线索资格分层", "成交与交付节奏"]
        : ["Pipeline control room", "Lead qualification lanes", "Close and handoff rhythm"]
    }
    if (archetype === "api_platform") {
      return region === "cn"
        ? ["首版接口控制台", "快速查看日志", "环境状态流转"]
        : ["First API console", "Quick log review", "Environment status workflow"]
    }
    if (archetype === "community") {
      return region === "cn"
        ? ["反馈分流工作台", "成员信任分层", "公告与活动节奏"]
        : ["Feedback triage workspace", "Member trust segments", "Announcement and event rhythm"]
    }
    if (archetype === "marketing_admin" || archetype === "content") {
      return region === "cn"
        ? ["首版增长官网", "快速下载分发", "版本更新流转"]
        : ["First growth site", "Quick download distribution", "Release update workflow"]
    }
    if (prefersAdminOps) {
      return region === "cn"
        ? ["首版审批控制台", "快速策略调整", "审计状态流转"]
        : ["First approvals console", "Quick policy changes", "Audit status workflow"]
    }
    return region === "cn"
      ? ["首版工作台", "快速录入", "状态流转"]
      : ["First version workspace", "Quick create", "Status workflow"]
  }
  return []
}

function getTemplateModules(templateId: string | undefined, region: Region) {
  const template = getTemplateById(templateId)
  if (!template) return []

  switch (template.id) {
    case "taskflow":
      return region === "cn"
        ? ["任务总览", "推进状态", "负责人负载", "分析图表"]
        : ["Task overview", "Status progression", "Owner workload", "Analytics charts"]
    case "opsdesk":
      return region === "cn"
        ? ["线索列表", "Pipeline", "报价审批", "续约跟进"]
        : ["Lead list", "Pipeline", "Quote approvals", "Renewal follow-up"]
    case "siteforge":
      return region === "cn"
        ? ["Dashboard", "Editor", "Runs", "Templates", "Pricing"]
        : ["Dashboard", "Editor", "Runs", "Templates", "Pricing"]
    case "serenity":
      return region === "cn"
        ? ["反馈收集", "路线图", "公告", "成员", "审核"]
        : ["Feedback intake", "Roadmap", "Announcements", "Members", "Moderation"]
    case "orbital":
      return region === "cn"
        ? ["接口目录", "日志检索", "鉴权策略", "环境切换", "Webhook 恢复"]
        : ["Endpoint catalog", "Log explorer", "Auth policy", "Environment switching", "Webhook recovery"]
    case "launchpad":
      return region === "cn"
        ? ["首页叙事", "下载分发", "文档中心", "更新日志", "定价页面"]
        : ["Homepage narrative", "Download distribution", "Docs center", "Changelog", "Pricing page"]
    default:
      return []
  }
}

function getTemplateFeatures(templateId: string | undefined, planTier: PlanTier): SpecFeature[] {
  const template = getTemplateById(templateId)
  if (!template) return []

  switch (template.id) {
    case "taskflow":
      return [
        "description_field",
        "assignee_filter",
        "blocked_status",
        "csv_export",
        ...((planTier === "free" || planTier === "starter") ? [] : (["analytics_page"] as SpecFeature[])),
      ]
    case "opsdesk":
      return [
        "description_field",
        "assignee_filter",
        "csv_export",
        ...((planTier === "free" || planTier === "starter") ? [] : (["analytics_page"] as SpecFeature[])),
      ]
    case "siteforge":
      return ["description_field", "about_page", "analytics_page"]
    case "serenity":
      return ["about_page", "analytics_page"]
    case "orbital":
      return ["about_page", "analytics_page"]
    case "launchpad":
      return ["about_page", "analytics_page"]
    default:
      return []
  }
}

function toBlueprintId(input: string) {
  const normalized = sanitizeUiText(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return normalized || "module"
}

function getIdentityGlyph(title: string) {
  const normalized = sanitizeUiText(title).replace(/[^A-Za-z0-9 ]/g, " ").trim()
  if (!normalized) return "M"
  const tokens = normalized.split(/\s+/).filter(Boolean)
  if (tokens.length >= 2) {
    return `${tokens[0].charAt(0)}${tokens[1].charAt(0)}`.toUpperCase().slice(0, 2)
  }
  const token = tokens[0] || normalized
  if (token.length >= 2 && /^[A-Z][a-z]+[A-Z]/.test(token)) {
    return `${token.charAt(0)}${token.match(/[A-Z](?=[a-z]*$)/)?.[0] || token.charAt(1)}`.toUpperCase()
  }
  return token.slice(0, 2).toUpperCase()
}

function getArchetypeIconSeed(archetype: ScaffoldArchetype, title: string, prompt?: string): AppIdentityIconSeed {
  const glyph = getIdentityGlyph(title)
  const text = String(prompt ?? title ?? "").toLowerCase()
  if (archetype === "code_platform") {
    if (/system|ops|control|admin|系统|控制台/.test(text)) {
      return { glyph, from: "#312e81", to: "#6366f1", ring: "rgba(99,102,241,0.26)" }
    }
    if (/cursor|assistant|agent|copilot|助手|智能体/.test(text)) {
      return { glyph, from: "#5b21b6", to: "#8b5cf6", ring: "rgba(139,92,246,0.24)" }
    }
    return { glyph, from: "#5b21b6", to: "#8b5cf6", ring: "rgba(139,92,246,0.24)" }
  }
  if (archetype === "crm") {
    if (/renewal|success|account|续约|成功团队|账户/.test(text)) {
      return { glyph, from: "#065f46", to: "#14b8a6", ring: "rgba(20,184,166,0.24)" }
    }
    return { glyph, from: "#1d4ed8", to: "#38bdf8", ring: "rgba(56,189,248,0.24)" }
  }
  if (archetype === "api_platform") {
    if (/security|auth|token|oauth|安全|鉴权|令牌/.test(text)) {
      return { glyph, from: "#0f172a", to: "#10b981", ring: "rgba(16,185,129,0.24)" }
    }
    if (/sdk|developer|docs|文档|开发者/.test(text)) {
      return { glyph, from: "#0f172a", to: "#3b82f6", ring: "rgba(59,130,246,0.24)" }
    }
    return { glyph, from: "#0f172a", to: "#06b6d4", ring: "rgba(6,182,212,0.22)" }
  }
  if (archetype === "community") {
    if (/feedback|roadmap|vote|反馈|路线图|投票/.test(text)) {
      return { glyph, from: "#b45309", to: "#f59e0b", ring: "rgba(245,158,11,0.22)" }
    }
    if (/member|social|community|成员|社区|社交/.test(text)) {
      return { glyph, from: "#9f1239", to: "#fb7185", ring: "rgba(251,113,133,0.22)" }
    }
    return { glyph, from: "#b45309", to: "#f59e0b", ring: "rgba(245,158,11,0.22)" }
  }
  if (archetype === "marketing_admin" || archetype === "content") {
    if (/download|device|ios|android|desktop|下载|设备/.test(text)) {
      return { glyph, from: "#1e1b4b", to: "#2563eb", ring: "rgba(37,99,235,0.22)" }
    }
    if (/brand|marketing|growth|官网|品牌|增长/.test(text)) {
      return { glyph, from: "#7c2d12", to: "#f97316", ring: "rgba(249,115,22,0.22)" }
    }
    return { glyph, from: "#111827", to: "#6366f1", ring: "rgba(99,102,241,0.22)" }
  }
  return { glyph, from: "#0f766e", to: "#22c55e", ring: "rgba(34,197,94,0.22)" }
}

function getArchetypeCategoryLabel(archetype: ScaffoldArchetype, region: Region) {
  const isCn = region === "cn"
  switch (archetype) {
    case "code_platform":
      return isCn ? "AI 代码平台" : "AI code platform"
    case "crm":
      return isCn ? "CRM 与销售工作台" : "CRM and sales workspace"
    case "api_platform":
      return isCn ? "API 与运行平台" : "API and runtime platform"
    case "marketing_admin":
      return isCn ? "官网与下载平台" : "Website and download platform"
    case "community":
      return isCn ? "社区与反馈平台" : "Community and feedback platform"
    case "content":
      return isCn ? "内容与品牌产品" : "Content and brand product"
    default:
      return isCn ? "内部工作台" : "Internal workspace"
  }
}

export function isAdminOpsTaskSpec(spec: Pick<AppSpec, "prompt" | "title" | "kind" | "templateId">) {
  return getScaffoldArchetype(spec) === "task" && shouldPreferAdminOpsOverCrm(String(spec.prompt ?? spec.title ?? "").toLowerCase())
}

type DomainFlavor = "healthcare" | "education" | "finance" | "recruiting" | "support" | "commerce_ops" | "general"

function inferDomainFlavor(prompt: string): DomainFlavor {
  const text = String(prompt ?? "").toLowerCase()
  if (/health|healthcare|medical|clinic|patient|doctor|hospital|appointment|care plan|医疗|健康|诊所|患者|医生|医院|预约|病历|护理/.test(text)) {
    return "healthcare"
  }
  if (/school|education|course|student|teacher|class|lesson|assignment|campus|教育|学校|课程|学生|老师|班级|作业|校园/.test(text)) {
    return "education"
  }
  if (/finance|financial|bank|ledger|transaction|reconciliation|invoice|expense|portfolio|金融|财务|银行|账本|交易|对账|发票|费用|投资组合/.test(text)) {
    return "finance"
  }
  if (/recruit|hiring|candidate|interview|job|talent|offer|ats|招聘|候选人|面试|岗位|人才|录用/.test(text)) {
    return "recruiting"
  }
  if (/support|ticket|helpdesk|sla|knowledge base|incident|case|客服|工单|帮助台|知识库|服务等级|客诉/.test(text)) {
    return "support"
  }
  if (/commerce|ecommerce|store|sku|inventory|fulfillment|merchant|retail|电商|商城|库存|商品|履约|零售|商家/.test(text)) {
    return "commerce_ops"
  }
  return "general"
}

function getDomainFlavorCategory(flavor: DomainFlavor, region: Region) {
  const isCn = region === "cn"
  const labels: Record<DomainFlavor, string> = {
    healthcare: isCn ? "医疗运营工作台" : "Healthcare operations workspace",
    education: isCn ? "教育学习工作台" : "Education and learning workspace",
    finance: isCn ? "金融财务控制台" : "Finance operations console",
    recruiting: isCn ? "招聘人才工作台" : "Recruiting and talent workspace",
    support: isCn ? "客服工单工作台" : "Support and ticketing workspace",
    commerce_ops: isCn ? "电商运营工作台" : "Commerce operations workspace",
    general: isCn ? "内部工作台" : "Internal workspace",
  }
  return labels[flavor]
}

function getSpecCategoryLabel(spec: Pick<AppSpec, "prompt" | "title" | "kind" | "templateId" | "region">, archetype: ScaffoldArchetype) {
  if (isAdminOpsTaskSpec(spec)) {
    return spec.region === "cn" ? "内部管理与控制平面" : "Internal admin and control plane"
  }
  const domainFlavor = inferDomainFlavor(spec.prompt ?? spec.title)
  if (archetype === "task" && domainFlavor !== "general") {
    return getDomainFlavorCategory(domainFlavor, spec.region)
  }
  return getArchetypeCategoryLabel(archetype, spec.region)
}

function getDomainFlavorIntent(flavor: DomainFlavor, region: Region) {
  const isCn = region === "cn"
  const intents: Record<DomainFlavor, Pick<AppIntent, "targetAudience" | "primaryJobs" | "primaryWorkflow" | "automationScopes">> = {
    healthcare: {
      targetAudience: isCn ? ["护士团队", "医生", "诊所运营"] : ["Nurses", "clinicians", "clinic operators"],
      primaryJobs: isCn ? ["管理患者队列", "安排预约", "跟进护理计划"] : ["Manage patient queues", "schedule appointments", "track care plans"],
      primaryWorkflow: isCn ? "患者 -> 预约 -> 护理计划 -> 风险跟进" : "Patient -> appointment -> care plan -> risk follow-up",
      automationScopes: isCn ? ["复诊提醒", "风险预警", "护理任务"] : ["follow-up reminders", "risk alerts", "care tasks"],
    },
    education: {
      targetAudience: isCn ? ["教师", "教务运营", "学生管理"] : ["Teachers", "program operators", "student managers"],
      primaryJobs: isCn ? ["管理课程", "跟踪学生", "安排作业"] : ["Manage courses", "track students", "coordinate assignments"],
      primaryWorkflow: isCn ? "课程 -> 学生 -> 作业 -> 学习反馈" : "Course -> student -> assignment -> learning feedback",
      automationScopes: isCn ? ["作业提醒", "学习进度", "课程通知"] : ["assignment reminders", "learning progress", "course notices"],
    },
    finance: {
      targetAudience: isCn ? ["财务运营", "风控团队", "对账负责人"] : ["Finance ops", "risk teams", "reconciliation owners"],
      primaryJobs: isCn ? ["维护账本", "核对交易", "处理异常"] : ["Maintain ledgers", "reconcile transactions", "resolve exceptions"],
      primaryWorkflow: isCn ? "账本 -> 交易 -> 对账 -> 异常处理" : "Ledger -> transaction -> reconciliation -> exception handling",
      automationScopes: isCn ? ["对账规则", "异常告警", "结算同步"] : ["reconciliation rules", "exception alerts", "settlement sync"],
    },
    recruiting: {
      targetAudience: isCn ? ["招聘负责人", "面试官", "HRBP"] : ["Recruiting leads", "interviewers", "HR business partners"],
      primaryJobs: isCn ? ["管理候选人", "安排面试", "推进 offer 审批"] : ["Manage candidates", "schedule interviews", "advance offer approvals"],
      primaryWorkflow: isCn ? "候选人 -> 岗位 -> 面试 -> offer 审批" : "Candidate -> role -> interview -> offer approval",
      automationScopes: isCn ? ["面试提醒", "候选人阶段", "offer 审批"] : ["interview reminders", "candidate stages", "offer approvals"],
    },
    support: {
      targetAudience: isCn ? ["客服团队", "升级处理人", "客户成功"] : ["Support agents", "escalation owners", "customer success"],
      primaryJobs: isCn ? ["处理工单", "同步客户案例", "维护知识库"] : ["Resolve tickets", "sync customer cases", "maintain knowledge base"],
      primaryWorkflow: isCn ? "工单 -> 客户案例 -> 升级 -> 知识库沉淀" : "Ticket -> customer case -> escalation -> knowledge base",
      automationScopes: isCn ? ["SLA 提醒", "升级规则", "知识库同步"] : ["SLA reminders", "escalation rules", "knowledge sync"],
    },
    commerce_ops: {
      targetAudience: isCn ? ["仓储运营", "履约负责人", "供应链团队"] : ["Warehouse ops", "fulfillment owners", "supply chain teams"],
      primaryJobs: isCn ? ["管理 SKU", "跟踪库存", "推进履约订单"] : ["Manage SKUs", "track inventory", "advance fulfillment orders"],
      primaryWorkflow: isCn ? "SKU -> 库存 -> 履约订单 -> 供应商交接" : "SKU -> inventory -> fulfillment order -> supplier handoff",
      automationScopes: isCn ? ["补货提醒", "履约异常", "供应商同步"] : ["reorder alerts", "fulfillment exceptions", "supplier sync"],
    },
    general: {
      targetAudience: isCn ? ["内部团队"] : ["Internal teams"],
      primaryJobs: isCn ? ["管理工作", "跟踪状态", "协调审批"] : ["Manage work", "track status", "coordinate approvals"],
      primaryWorkflow: isCn ? "创建 -> 跟进 -> 审批 -> 完成" : "Create -> track -> approve -> complete",
      automationScopes: isCn ? ["审批", "提醒", "报表"] : ["approvals", "reminders", "reporting"],
    },
  }
  return intents[flavor]
}

function isGenericAdminOpsAppIdentity(appIdentity: AppIdentity | undefined) {
  if (!appIdentity) return true
  return (
    appIdentity.category === "task" ||
    /internal workspace/i.test(appIdentity.archetypeLabel || "") ||
    /generated internal workspace/i.test(appIdentity.shortDescription || "")
  )
}

function isGenericAdminOpsAppIntent(appIntent: AppIntent | undefined) {
  if (!appIntent) return true
  return (
    appIntent.productCategory === "Internal workspace" ||
    appIntent.productCategory === "内部工作台" ||
    appIntent.primaryWorkflow === "Create -> track -> approve -> complete" ||
    appIntent.primaryWorkflow === "创建 -> 跟进 -> 审批 -> 完成"
  )
}

function shouldRefreshAppIdentity(spec: AppSpec, appIdentity: AppIdentity | undefined, archetype: ScaffoldArchetype) {
  if (!appIdentity) return true
  const isAdminOps = isAdminOpsTaskSpec(spec)
  const domainFlavor = inferDomainFlavor(spec.prompt ?? spec.title)
  const isSpecializedTask = archetype === "task" && !isAdminOps && domainFlavor !== "general"
  const expectedCategory = isAdminOps ? "admin_ops_internal_tool" : archetype
  if (isAdminOps && isGenericAdminOpsAppIdentity(appIdentity)) return true
  if (isSpecializedTask && (appIdentity.category === "task" || /internal workspace/i.test(appIdentity.archetypeLabel || ""))) return true
  if (appIdentity.category !== expectedCategory) return true
  if (expectedCategory !== "task" && /internal workspace/i.test(appIdentity.archetypeLabel || "")) return true
  return false
}

function shouldRefreshAppIntent(spec: AppSpec, appIntent: AppIntent | undefined, archetype: ScaffoldArchetype) {
  if (!appIntent) return true
  const isAdminOps = isAdminOpsTaskSpec(spec)
  const domainFlavor = inferDomainFlavor(spec.prompt ?? spec.title)
  const isSpecializedTask = archetype === "task" && !isAdminOps && domainFlavor !== "general"
  const expectedArchetype = isAdminOps ? "admin_ops_internal_tool" : archetype
  const text = String(spec.prompt ?? spec.title ?? "").toLowerCase()
  const intentSnapshot = `${appIntent.primaryWorkflow} ${appIntent.primaryJobs.join(" ")} ${appIntent.automationScopes.join(" ")}`.toLowerCase()
  if (isAdminOps && isGenericAdminOpsAppIntent(appIntent)) return true
  if (isSpecializedTask && isGenericAdminOpsAppIntent(appIntent)) return true
  if (isSpecializedTask && appIntent.productCategory !== getDomainFlavorCategory(domainFlavor, spec.region)) return true
  if (appIntent.archetype !== expectedArchetype) return true
  if (archetype !== "task" && (appIntent.productCategory === "Internal workspace" || appIntent.productCategory === "内部工作台")) {
    return true
  }
  if (archetype === "code_platform" && /run|runs|terminal|publish|release|preview|运行|发布|预览/.test(text)) {
    if (!/run -> preview -> publish|运行 -> 预览 -> 发布/.test(intentSnapshot)) return true
  }
  if (archetype === "crm" && /order|quote|invoice|billing|approval|订单|报价|发票|账单|审批/.test(text)) {
    if (!/quote -> approval -> order|报价 -> 审批 -> 订单/.test(intentSnapshot)) return true
  }
  if (archetype === "api_platform" && /usage|metering|billing|onboarding|guide|docs|sdk|用量|计量|计费|引导|文档|指南/.test(text)) {
    if (!/developer onboarding|开发者引导|usage metering|计量|docs sync|文档/.test(intentSnapshot)) return true
  }
  if (archetype === "community" && /event|events|meetup|webinar|moderation|review|report|活动|直播|聚会|审核|举报/.test(text)) {
    const eventDrivenCommunity = /event|events|meetup|webinar|registration|registrations|session|sessions|agenda|ambassador|invite|segment|segments|活动|直播|聚会|报名|议程|大使|邀请|分层/.test(
      text
    )
    if (
      eventDrivenCommunity &&
      !/event planning|活动策划|registration sync|报名同步|member segment|成员分层|invite outreach|邀请触达/.test(intentSnapshot)
    ) {
      return true
    }
    if (!eventDrivenCommunity && !/moderation|审核/.test(intentSnapshot)) return true
  }
  if ((archetype === "marketing_admin" || archetype === "content") && /device|distribution|rollout|release|admin|设备|分发|灰度|发布|后台/.test(text)) {
    if (!/device distribution|设备分发|admin sync|后台同步/.test(intentSnapshot)) return true
  }
  return false
}

function shouldRefreshVisualSeed(spec: AppSpec, visualSeed: VisualSeed | undefined, archetype: ScaffoldArchetype) {
  if (!visualSeed) return true
  const isAdminOps = isAdminOpsTaskSpec(spec)
  const domainFlavor = inferDomainFlavor(spec.prompt ?? spec.title)
  const isSpecializedTask = archetype === "task" && !isAdminOps && domainFlavor !== "general"
  if (!isSpecializedTask) return false
  return (
    visualSeed.tone === "brand and growth product" ||
    visualSeed.tone === "Brand and distribution product" ||
    visualSeed.tone === "品牌与分发产品" ||
    visualSeed.icon?.to === "#6366f1"
  )
}

function getArchetypeIntentSeed(archetype: ScaffoldArchetype, region: Region, prompt?: string, title?: string) {
  const isCn = region === "cn"
  const text = String(prompt ?? title ?? "").toLowerCase()
  switch (archetype) {
    case "code_platform":
      return {
        targetAudience:
          /system|ops|control|admin|运维|控制台/.test(text)
            ? isCn
              ? ["平台工程团队", "运维负责人", "交付负责人"]
              : ["Platform engineers", "runtime owners", "delivery leads"]
            : isCn
              ? ["产品团队", "开发者", "交付负责人"]
              : ["Product teams", "developers", "delivery leads"],
        primaryJobs:
          /system|ops|control|admin|运维|控制台/.test(text)
            ? isCn
              ? ["编排 AI 工程工作流", "管理运行与发布状态", "审查环境与代码变更"]
              : ["Orchestrate AI engineering workflows", "Manage runtime and releases", "Review environment and code changes"]
            : isCn
              ? ["生成全栈应用", "编辑代码并即时预览", "跟踪构建与发布状态"]
              : ["Generate fullstack apps", "Edit code with live preview", "Track build and release status"],
        primaryWorkflow:
          /system|ops|control|admin|运维|控制台/.test(text)
            ? isCn ? "规划 -> 改码 -> 预览 -> 发布 -> 观测" : "Plan -> edit -> preview -> release -> observe"
            : /run|runs|terminal|publish|release|preview|运行|发布|预览/.test(text)
              ? isCn
                ? "生成 -> 编辑 -> 运行 -> 预览 -> 发布"
                : "Generate -> edit -> run -> preview -> publish"
            : isCn ? "生成 -> 编辑 -> 预览 -> 发布" : "Generate -> edit -> preview -> publish",
        integrationTargets:
          /doc|docs|knowledge|guide|文档|知识库/.test(text)
            ? isCn
              ? ["CloudBase", "文档库", "Git 仓库", "知识库"]
              : ["Vercel", "Supabase", "Git repos", "knowledge base"]
            : isCn
              ? ["CloudBase", "文档库", "Git 仓库"]
              : ["Vercel", "Supabase", "Git repos"],
        automationScopes:
          /assistant|chat|copilot|agent|助手|对话|智能体/.test(text)
            ? isCn
              ? ["AI 改码", "对话驱动修改", "构建验收", "模板切换"]
              : ["AI edits", "chat-driven updates", "build acceptance", "template switching"]
            : isCn
              ? ["AI 改码", "构建验收", "模板切换"]
              : ["AI edits", "build acceptance", "template switching"],
        differentiationNotes: isCn
          ? ["应具备 IDE 主工作区而不是普通后台", "Code/Preview/Dashboard 需要同一上下文"]
          : ["Must feel like an IDE workspace, not a generic admin", "Code/preview/dashboard should share one context"],
      }
    case "crm":
      return {
        targetAudience:
          /order|quote|invoice|billing|approval|account executive|account executives|订单|报价|发票|账单|审批|客户经理|销售/.test(text)
            ? isCn
              ? ["销售团队", "客户经理", "报价审批负责人"]
              : ["Sales teams", "account executives", "quote approvers"]
            : /renewal|account|success|续约|账户|成功/.test(text)
            ? isCn
              ? ["客户成功团队", "续约负责人", "交付协同"]
              : ["Customer success teams", "renewal owners", "handoff managers"]
            : isCn
              ? ["销售团队", "运营负责人", "交付协同"]
              : ["Sales teams", "ops leads", "handoff managers"],
        primaryJobs:
          /order|quote|invoice|billing|订单|报价|发票|账单/.test(text)
            ? isCn
              ? ["管理报价与订单", "推进成交阶段", "同步客户交付状态"]
              : ["Manage quotes and orders", "Advance pipeline stages", "Sync customer handoff"]
            : isCn
              ? ["管理线索和商机", "推进成交阶段", "同步客户交付状态"]
              : ["Manage leads and deals", "Advance pipeline stages", "Sync customer handoff"],
        primaryWorkflow:
          /order|quote|invoice|billing|approval|订单|报价|发票|账单|审批/.test(text)
              ? isCn
                ? "线索 -> 报价 -> 审批 -> 订单 -> 交付"
                : "Lead -> quote -> approval -> order -> handoff"
            : /renewal|account|success|续约|账户|成功/.test(text)
              ? isCn ? "账户健康 -> 续约 -> 扩容 -> 交付" : "Account health -> renew -> expand -> handoff"
            : isCn ? "线索 -> 商机 -> 成交 -> 交付" : "Lead -> opportunity -> close -> handoff",
        integrationTargets:
          /quote|invoice|billing|报价|发票|账单/.test(text)
            ? isCn
              ? ["邮件或表单线索", "报价系统", "回款/账单工具"]
              : ["Inbound forms", "quoting", "billing tooling"]
            : isCn
              ? ["邮件或表单线索", "报价系统", "客户成功工具"]
              : ["Inbound forms", "quoting", "success tooling"],
        automationScopes:
          /quota|leaderboard|team|配额|排行|团队/.test(text)
            ? isCn
              ? ["提醒", "审批", "配额同步", "交付同步"]
              : ["reminders", "approvals", "quota sync", "handoff sync"]
            : isCn
              ? ["提醒", "审批", "交付同步"]
              : ["reminders", "approvals", "handoff sync"],
        differentiationNotes: isCn
          ? ["不能退化成普通任务面板", "需要 pipeline 与客户视图"]
          : ["Cannot collapse into a task board", "Needs pipeline and customer views"],
      }
    case "api_platform":
      return {
        targetAudience:
          /security|auth|token|oauth|安全|鉴权|令牌/.test(text)
            ? isCn
              ? ["平台安全团队", "开发者", "运维负责人"]
              : ["Platform security teams", "developers", "runtime owners"]
            : isCn
              ? ["开发者", "平台工程团队", "运维负责人"]
              : ["Developers", "platform engineers", "runtime owners"],
        primaryJobs:
          /docs|sdk|guide|reference|文档|sdk|指南|参考/.test(text)
            ? isCn
              ? ["浏览接口目录", "维护开发者文档", "管理令牌和环境"]
              : ["Browse endpoints", "Maintain developer docs", "Manage tokens and environments"]
            : isCn
              ? ["浏览接口目录", "排查日志与错误", "管理令牌和环境"]
              : ["Browse endpoints", "Inspect logs and errors", "Manage tokens and environments"],
        primaryWorkflow:
          /usage|metering|billing|onboarding|guide|docs|sdk|developer onboarding|用量|计量|计费|引导|文档|指南/.test(text)
            ? isCn
              ? "开发者引导 -> 接口试用 -> 用量计量 -> Webhook 交付"
              : "Developer onboarding -> endpoint trial -> usage metering -> webhook delivery"
            : /security|auth|token|oauth|安全|鉴权|令牌/.test(text)
              ? isCn ? "令牌/鉴权 -> 日志排查 -> 环境授权 -> 发布" : "Token/auth -> log triage -> environment access -> release"
            : isCn ? "接口查看 -> 日志排查 -> 权限控制 -> 环境发布" : "Endpoint review -> log triage -> access control -> environment release",
        integrationTargets:
          /docs|sdk|guide|reference|文档|sdk|指南|参考/.test(text)
            ? isCn
              ? ["Webhook", "SDK", "密钥管理", "开发者文档"]
              : ["Webhooks", "SDKs", "secret management", "developer docs"]
            : isCn
              ? ["Webhook", "SDK", "密钥管理"]
              : ["Webhooks", "SDKs", "secret management"],
        automationScopes:
          /usage|metering|billing|onboarding|guide|docs|sdk|用量|计量|计费|引导|文档|指南/.test(text)
            ? isCn
              ? ["告警", "发布验证", "令牌轮换", "计量结算", "开发者引导同步", "文档同步"]
              : ["alerts", "release checks", "token rotation", "usage metering", "developer onboarding sync", "docs sync"]
            : isCn
              ? ["告警", "发布验证", "令牌轮换"]
              : ["alerts", "release checks", "token rotation"],
        differentiationNotes: isCn
          ? ["应体现开发者平台与 observability", "不能套销售或任务后台"]
          : ["Should feel like an API product and observability console", "Cannot reuse CRM/task shells"],
      }
    case "community":
      return {
        targetAudience:
          /event|events|meetup|webinar|registration|registrations|session|sessions|agenda|ambassador|invite|segment|segments|活动|直播|聚会|报名|议程|大使|邀请|分层/.test(
            text
          )
            ? isCn
              ? ["社区运营", "活动负责人", "成员增长负责人"]
              : ["Community operators", "program managers", "member growth leads"]
            : /member|invite|segment|成员|邀请|分层/.test(text)
              ? isCn
                ? ["成员管理员", "社区运营", "内容团队"]
                : ["Member admins", "community operators", "content teams"]
              : isCn
                ? ["社区运营", "成员管理员", "内容团队"]
                : ["Community operators", "member admins", "content teams"],
        primaryJobs:
          /event|events|meetup|webinar|registration|registrations|session|sessions|agenda|ambassador|invite|segment|segments|活动|直播|聚会|报名|议程|大使|邀请|分层/.test(
            text
          )
            ? isCn
              ? ["策划活动项目", "维护报名与邀请", "运营成员分层"]
              : ["Plan event programs", "Maintain registrations and invites", "Operate member segments"]
            : isCn
              ? ["管理反馈和公告", "组织活动", "维护成员分层"]
              : ["Manage feedback and announcements", "Organize events", "Maintain member segments"],
        primaryWorkflow:
          /event|events|meetup|webinar|registration|registrations|session|sessions|agenda|ambassador|invite|segment|segments|活动|直播|聚会|报名|议程|大使|邀请|分层/.test(
            text
          )
            ? isCn
              ? "活动策划 -> 邀请触达 -> 反馈归档 -> 社区运营"
              : "Event planning -> invite outreach -> feedback intake -> community ops"
            : /moderation|review|report|审核|举报|治理/.test(text)
              ? isCn ? "发帖/反馈 -> 审核 -> 路线图 -> 社区运营" : "Post/feedback -> moderation -> roadmap -> community ops"
              : isCn ? "发帖/反馈 -> 处理 -> 路线图 -> 社区运营" : "Post/feedback -> moderation -> roadmap -> community ops",
        integrationTargets:
          /event|events|meetup|webinar|registration|registrations|session|sessions|agenda|ambassador|invite|segment|segments|活动|直播|聚会|报名|议程|大使|邀请|分层/.test(
            text
          )
            ? isCn
              ? ["通知", "问卷", "成员邀请", "活动报名"]
              : ["Notifications", "surveys", "member invites", "event registration"]
            : isCn
              ? ["通知", "问卷", "成员邀请"]
              : ["Notifications", "surveys", "member invites"],
        automationScopes:
          /event|events|meetup|webinar|registration|registrations|session|sessions|agenda|ambassador|invite|segment|segments|活动|直播|聚会|报名|议程|大使|邀请|分层/.test(
            text
          )
            ? isCn
              ? ["活动提醒", "报名同步", "成员分层同步", "路线图同步"]
              : ["event reminders", "registration sync", "member segment sync", "roadmap sync"]
            : /roadmap|vote|wishlist|路线图|投票|愿望单/.test(text)
              ? isCn
                ? ["审核", "路线图同步", "投票统计", "活动提醒"]
                : ["moderation", "roadmap sync", "vote aggregation", "event reminders"]
              : isCn
                ? ["审核", "路线图同步", "活动提醒"]
                : ["moderation", "roadmap sync", "event reminders"],
        differentiationNotes: isCn
          ? [
              /event|events|meetup|webinar|registration|registrations|session|sessions|agenda|ambassador|invite|segment|segments|活动|直播|聚会|报名|议程|大使|邀请|分层/.test(
                text
              )
                ? "需要活动、报名、成员分层与社区运营路由"
                : "需要帖子、反馈、成员与运营路由",
              "不能长成后台报表页",
            ]
          : [
              /event|events|meetup|webinar|registration|registrations|session|sessions|agenda|ambassador|invite|segment|segments|活动|直播|聚会|报名|议程|大使|邀请|分层/.test(
                text
              )
                ? "Needs events, registrations, member segments, and community ops surfaces"
                : "Needs posts, feedback, members, and ops surfaces",
              "Cannot look like a dashboard-only admin",
            ],
      }
    case "marketing_admin":
    case "content":
      return {
        targetAudience:
          /download|device|ios|android|apk|mac|windows|desktop|下载|设备|安装/.test(text)
            ? isCn
              ? ["访客", "分发运营", "增长负责人"]
              : ["Visitors", "distribution operators", "growth leads"]
            : isCn
              ? ["访客", "品牌团队", "增长负责人"]
              : ["Visitors", "brand teams", "growth leads"],
        primaryJobs:
          /docs|documentation|guide|faq|文档|指南|faq/.test(text)
            ? isCn
              ? ["展示产品价值", "承接下载或转化", "维护文档和分发"]
              : ["Show product value", "Handle downloads or conversion", "Manage docs and distribution"]
            : isCn
              ? ["展示产品价值", "承接下载或转化", "维护内容和分发"]
              : ["Show product value", "Handle downloads or conversion", "Manage content and distribution"],
        primaryWorkflow:
          /download|device|ios|android|apk|mac|windows|desktop|下载|设备|安装/.test(text)
            ? isCn ? "官网浏览 -> 下载对比 -> 设备分发 -> 后台联动" : "Site browse -> download compare -> device distribution -> admin linkage"
            : /release|distribution|rollout|changelog|admin|发布|分发|灰度|更新日志|后台/.test(text)
              ? isCn
                ? "官网浏览 -> 版本说明 -> 分发控制 -> 后台同步"
                : "Site browse -> release notes -> distribution control -> admin sync"
            : isCn ? "官网浏览 -> 价格对比 -> 下载/转化 -> 后台分发" : "Site browse -> pricing compare -> download/convert -> admin distribution",
        integrationTargets:
          /docs|documentation|guide|faq|文档|指南|faq/.test(text)
            ? isCn
              ? ["下载分发", "FAQ/文档", "运营后台", "版本说明"]
              : ["Downloads", "docs", "admin distribution", "release notes"]
            : isCn
              ? ["下载分发", "FAQ/文档", "运营后台"]
              : ["Downloads", "docs", "admin distribution"],
        automationScopes:
          /device|distribution|rollout|release|admin|设备|分发|灰度|发布|后台/.test(text)
            ? isCn
              ? uniqueStrings(["版本发布", "设备分发", "内容更新", "后台分发同步", /pricing|plan|subscription|套餐|定价|价格/.test(text) ? "套餐文案更新" : "下载统计"].filter(Boolean))
              : uniqueStrings(["release publishing", "device distribution", "content updates", "admin distribution sync", /pricing|plan|subscription|套餐|定价|价格/.test(text) ? "pricing copy refresh" : "download analytics"].filter(Boolean))
            : /pricing|plan|subscription|套餐|定价|价格/.test(text)
              ? isCn
                ? ["版本发布", "下载统计", "内容更新", "套餐文案更新"]
                : ["release publishing", "download analytics", "content updates", "pricing copy refresh"]
            : isCn
              ? ["版本发布", "下载统计", "内容更新"]
              : ["release publishing", "download analytics", "content updates"],
        differentiationNotes: isCn
          ? ["需要官网与后台联动", "不能变成统一控制台首页"]
          : ["Needs website-to-admin linkage", "Cannot turn into a single console homepage"],
      }
    default:
      if (shouldPreferAdminOpsOverCrm(text)) {
        return {
          targetAudience: isCn ? ["运营负责人", "安全管理员", "内部团队"] : ["Ops leads", "security admins", "internal teams"],
          primaryJobs:
            isCn
              ? ["管理审批与访问策略", "跟踪审计与事件响应", "协调团队席位与自动化规则"]
              : ["Manage approvals and access policy", "Track audit and incident response", "Coordinate team seats and automation rules"],
          primaryWorkflow:
            isCn ? "接收事项 -> 审批/策略调整 -> 审计留痕 -> 事件响应 -> 治理收口" : "Intake -> approve or adjust policy -> audit trail -> incident response -> governance closeout",
          integrationTargets: isCn ? ["身份目录", "告警渠道", "审计导出"] : ["Identity directory", "alert channels", "audit exports"],
          automationScopes: isCn ? ["审批", "权限同步", "审计导出", "事件编排"] : ["approvals", "policy sync", "audit export", "incident orchestration"],
          differentiationNotes: isCn
            ? ["需要像内部 control plane，而不是普通任务板"]
            : ["Needs to feel like an internal control plane, not a generic task board"],
        }
      }
      return {
        targetAudience: isCn ? ["内部团队", "项目负责人"] : ["Internal teams", "project leads"],
        primaryJobs: isCn ? ["管理任务", "跟踪状态", "协调审批"] : ["Manage work", "Track status", "Coordinate approvals"],
        primaryWorkflow: isCn ? "创建 -> 跟进 -> 审批 -> 完成" : "Create -> track -> approve -> complete",
        integrationTargets: isCn ? ["表单", "提醒", "导出"] : ["Forms", "reminders", "exports"],
        automationScopes: isCn ? ["审批", "提醒", "报表"] : ["approvals", "reminders", "reporting"],
        differentiationNotes: isCn
          ? ["需要内部控制平面而不是营销页"]
          : ["Needs a control-plane workspace rather than a marketing site"],
      }
  }
}

function getArchetypeEntityBlueprints(spec: AppSpec): EntityBlueprint[] {
  const isCn = spec.region === "cn"
  const archetype = getScaffoldArchetype(spec)
  const text = String(spec.prompt ?? spec.title ?? "").toLowerCase()
  if (archetype === "code_platform") {
    const entities: EntityBlueprint[] = [
      {
        id: "workspace_project",
        label: isCn ? "应用项目" : "App project",
        summary: isCn ? "记录生成应用的元信息、状态与交付信息" : "Tracks generated app metadata, state, and delivery",
        fields: ["name", "planTier", "buildStatus", "previewStatus", "assignedDomain"],
        primaryViews: ["/dashboard", "/settings"],
        workflows: isCn ? ["生成", "发布", "升级"] : ["generate", "publish", "upgrade"],
      },
      {
        id: "source_file",
        label: isCn ? "源文件" : "Source file",
        summary: isCn ? "承接代码编辑、标签页与文件树" : "Backs editor tabs and the file tree",
        fields: ["path", "module", "language", "dirtyState", "updatedAt"],
        primaryViews: ["/editor"],
        workflows: isCn ? ["打开", "编辑", "保存", "回滚"] : ["open", "edit", "save", "revert"],
      },
      {
        id: "runtime_run",
        label: isCn ? "运行记录" : "Runtime run",
        summary: isCn ? "记录构建、预览与发布链路" : "Tracks builds, previews, and release steps",
        fields: ["status", "mode", "logs", "startedAt", "acceptance"],
        primaryViews: ["/runs", "/dashboard"],
        workflows: isCn ? ["运行", "刷新", "回退"] : ["run", "refresh", "rollback"],
      },
      {
        id: "ai_session",
        label: isCn ? "AI 会话" : "AI session",
        summary: isCn ? "记录 Discuss / Generate / Fix / Refactor 的上下文。" : "Tracks Discuss / Generate / Fix / Refactor context.",
        fields: ["mode", "prompt", "currentFile", "routeId", "status"],
        primaryViews: ["/editor", "/dashboard"],
        workflows: isCn ? ["讨论", "生成", "修复", "重构"] : ["discuss", "generate", "fix", "refactor"],
      },
      {
        id: "template_asset",
        label: isCn ? "模板资产" : "Template asset",
        summary: isCn ? "用于模板切换与生成起点" : "Supports template selection and generation starting points",
        fields: ["templateId", "category", "previewStyle", "recommendedPlan"],
        primaryViews: ["/templates"],
        workflows: isCn ? ["切换模板", "预览模板", "按模板生成"] : ["switch", "preview", "generate from template"],
      },
    ]
    if (/assistant|chat|conversation|copilot|agent|助手|对话|智能体/.test(text)) {
      entities.push({
        id: "assistant_thread",
        label: isCn ? "助手线程" : "Assistant thread",
        summary: isCn ? "记录 AI 对话、上下文与操作分支" : "Tracks AI conversations, context, and action branches",
        fields: ["title", "mode", "route", "file", "status"],
        primaryViews: ["/assistant", "/editor"],
        workflows: isCn ? ["发起对话", "跟进修改", "回看历史"] : ["start chat", "apply change", "review history"],
      })
    }
    if (/publish|deploy|delivery|release|上线|发布|交付/.test(text)) {
      entities.push({
        id: "release_deployment",
        label: isCn ? "发布批次" : "Release deployment",
        summary: isCn ? "记录发布、预览、回滚和交付状态" : "Tracks releases, previews, rollbacks, and delivery state",
        fields: ["version", "channel", "status", "previewUrl", "releasedAt"],
        primaryViews: ["/publish", "/runs", "/dashboard"],
        workflows: isCn ? ["发布", "回滚", "确认交付"] : ["release", "rollback", "confirm handoff"],
      })
    }
    return entities
  }
  if (archetype === "crm") {
    const entities: EntityBlueprint[] = [
      { id: "lead", label: isCn ? "线索" : "Lead", summary: isCn ? "潜在客户与来源信息" : "Inbound prospect and source info", fields: ["name", "source", "owner", "budget", "stage"], primaryViews: ["/leads", "/pipeline"], workflows: isCn ? ["认领", "跟进", "转商机"] : ["assign", "follow up", "qualify"] },
      { id: "opportunity", label: isCn ? "商机" : "Opportunity", summary: isCn ? "成交推进与风险判断" : "Deal progression and risk tracking", fields: ["account", "stage", "amount", "owner", "risk"], primaryViews: ["/pipeline", "/dashboard"], workflows: isCn ? ["推进阶段", "审批报价", "成交"] : ["advance stage", "approve quote", "close"] },
      { id: "customer_account", label: isCn ? "客户账户" : "Customer account", summary: isCn ? "续约、扩容与交付健康度" : "Renewal, expansion, and account health", fields: ["name", "plan", "renewalDate", "health", "owner"], primaryViews: ["/customers", "/reports"], workflows: isCn ? ["续约", "扩容", "交付同步"] : ["renew", "expand", "handoff"] },
      { id: "automation_rule", label: isCn ? "自动化规则" : "Automation rule", summary: isCn ? "自动推进线索、提醒和审批动作" : "Automates pipeline movement, reminders, and approvals", fields: ["name", "trigger", "owner", "status"], primaryViews: ["/automations", "/settings"], workflows: isCn ? ["启用", "停用", "调整范围"] : ["enable", "disable", "retune"] },
    ]
    if (/order|invoice|billing|quote|报价|订单|发票|账单/.test(text)) {
      entities.push({
        id: "sales_order",
        label: isCn ? "销售订单" : "Sales order",
        summary: isCn ? "承接报价、订单、回款和交付节点" : "Tracks quote, order, payment, and handoff milestones",
        fields: ["customer", "amount", "status", "owner", "dueDate"],
        primaryViews: ["/orders", "/dashboard"],
        workflows: isCn ? ["生成报价", "确认订单", "同步回款"] : ["create quote", "confirm order", "sync payment"],
      })
    }
    if (/team|rep|leaderboard|quota|manager|团队|销售代表|排行榜|配额/.test(text)) {
      entities.push({
        id: "sales_rep",
        label: isCn ? "销售成员" : "Sales rep",
        summary: isCn ? "记录配额、排行和成交节奏" : "Tracks quota, leaderboard, and close cadence",
        fields: ["name", "territory", "quota", "closedAmount", "rank"],
        primaryViews: ["/team", "/reports"],
        workflows: isCn ? ["查看排行", "调整配额", "同步团队目标"] : ["review rank", "adjust quota", "sync team target"],
      })
    }
    return entities
  }
  if (archetype === "api_platform") {
    const entities: EntityBlueprint[] = [
      { id: "endpoint", label: isCn ? "接口" : "Endpoint", summary: isCn ? "服务、版本和消费量入口" : "Service, version, and usage entry", fields: ["path", "method", "version", "owner", "status"], primaryViews: ["/endpoints", "/dashboard"], workflows: isCn ? ["发布", "下线", "文档同步"] : ["publish", "deprecate", "sync docs"] },
      { id: "log_event", label: isCn ? "日志事件" : "Log event", summary: isCn ? "运行诊断与异常追踪" : "Runtime diagnostics and incident trace", fields: ["level", "service", "traceId", "latency", "createdAt"], primaryViews: ["/logs"], workflows: isCn ? ["检索", "诊断", "恢复"] : ["search", "triage", "recover"] },
      { id: "api_key", label: isCn ? "访问密钥" : "API key", summary: isCn ? "作用域与访问权限控制" : "Scope and access control", fields: ["label", "scope", "environment", "lastUsedAt", "status"], primaryViews: ["/auth"], workflows: isCn ? ["创建", "轮换", "停用"] : ["create", "rotate", "revoke"] },
      { id: "environment", label: isCn ? "运行环境" : "Environment", summary: isCn ? "记录发布环境、版本和回滚状态" : "Tracks deploy environments, versions, and rollback state", fields: ["name", "release", "region", "health", "status"], primaryViews: ["/environments", "/dashboard"], workflows: isCn ? ["发布", "回滚", "校验"] : ["promote", "rollback", "verify"] },
      { id: "webhook_subscription", label: isCn ? "Webhook 订阅" : "Webhook subscription", summary: isCn ? "管理事件回调、重试和状态" : "Manages event callbacks, retries, and delivery state", fields: ["target", "event", "status", "lastDelivery"], primaryViews: ["/webhooks", "/logs"], workflows: isCn ? ["创建", "重试", "禁用"] : ["create", "retry", "disable"] },
    ]
    if (/docs|documentation|guide|reference|文档|指南|参考/.test(text)) {
      entities.push({
        id: "developer_doc",
        label: isCn ? "开发者文档" : "Developer doc",
        summary: isCn ? "接口说明、SDK 引导与错误码参考" : "API reference, SDK guides, and error-code documentation",
        fields: ["title", "section", "version", "status", "updatedAt"],
        primaryViews: ["/docs", "/endpoints"],
        workflows: isCn ? ["更新说明", "发布文档", "同步 SDK"] : ["update docs", "publish docs", "sync SDK"],
      })
    }
    if (/usage|metering|analytics|billing|用量|计量|分析|计费/.test(text)) {
      entities.push({
        id: "usage_meter",
        label: isCn ? "调用计量" : "Usage meter",
        summary: isCn ? "统计调用量、计费和限流状态" : "Tracks request volume, billing, and rate-limit state",
        fields: ["environment", "requestCount", "billableUnits", "window", "status"],
        primaryViews: ["/usage", "/dashboard"],
        workflows: isCn ? ["查看用量", "校验账单", "调整限流"] : ["review usage", "verify billing", "adjust rate limits"],
      })
    }
    return entities
  }
  if (archetype === "community") {
    const entities: EntityBlueprint[] = [
      { id: "post", label: isCn ? "帖子" : "Post", summary: isCn ? "社区内容与讨论流" : "Community content and discussion", fields: ["title", "author", "channel", "status", "engagement"], primaryViews: ["/dashboard"], workflows: isCn ? ["发布", "置顶", "归档"] : ["publish", "pin", "archive"] },
      { id: "feedback_item", label: isCn ? "反馈" : "Feedback item", summary: isCn ? "用户建议与问题收集" : "User requests and issue intake", fields: ["title", "type", "priority", "owner", "state"], primaryViews: ["/feedback", "/dashboard"], workflows: isCn ? ["受理", "归档路线图", "回复"] : ["triage", "roadmap", "reply"] },
      { id: "member", label: isCn ? "成员" : "Member", summary: isCn ? "成员分层与权限" : "Member segmentation and access", fields: ["name", "segment", "role", "status"], primaryViews: ["/members"], workflows: isCn ? ["邀请", "分组", "审核"] : ["invite", "segment", "moderate"] },
      { id: "community_event", label: isCn ? "社区活动" : "Community event", summary: isCn ? "记录活动编排、报名和提醒" : "Tracks event scheduling, attendance, and reminders", fields: ["title", "format", "date", "status", "host"], primaryViews: ["/events"], workflows: isCn ? ["创建活动", "管理报名", "发送提醒"] : ["create", "manage attendance", "remind"] },
      { id: "roadmap_item", label: isCn ? "路线图事项" : "Roadmap item", summary: isCn ? "把反馈转成公开路线图动作" : "Turns feedback into visible roadmap work", fields: ["title", "status", "owner", "eta"], primaryViews: ["/feedback", "/roadmap", "/dashboard"], workflows: isCn ? ["纳入路线图", "更新状态", "公开说明"] : ["add to roadmap", "update status", "publish note"] },
    ]
    if (/moderation|review|report abuse|safety|审核|举报|治理|安全/.test(text)) {
      entities.push({
        id: "moderation_case",
        label: isCn ? "审核案件" : "Moderation case",
        summary: isCn ? "记录审核队列、举报与社区治理动作" : "Tracks moderation queues, abuse reports, and safety actions",
        fields: ["target", "reporter", "severity", "status", "owner"],
        primaryViews: ["/moderation", "/feedback"],
        workflows: isCn ? ["受理举报", "审核处理", "同步规则"] : ["intake report", "moderate", "sync policy"],
      })
    }
    return entities
  }
  if (archetype === "marketing_admin" || archetype === "content") {
    const entities: EntityBlueprint[] = [
      { id: "site_page", label: isCn ? "站点页面" : "Site page", summary: isCn ? "官网、下载页与说明页内容" : "Site, download, and docs content", fields: ["slug", "title", "status", "owner"], primaryViews: ["/website", "/docs"], workflows: isCn ? ["发布", "改版", "排期"] : ["publish", "revise", "schedule"] },
      { id: "download_asset", label: isCn ? "下载资产" : "Download asset", summary: isCn ? "客户端或分发包信息" : "Client build or distribution asset", fields: ["name", "platform", "version", "channel"], primaryViews: ["/download"], workflows: isCn ? ["上传", "分发", "下架"] : ["upload", "distribute", "retire"] },
      { id: "release_note", label: isCn ? "版本说明" : "Release note", summary: isCn ? "更新记录与变更说明" : "Changelog and release narrative", fields: ["version", "headline", "publishedAt"], primaryViews: ["/docs", "/changelog", "/admin"], workflows: isCn ? ["发布说明", "同步下载页"] : ["publish note", "sync downloads"] },
      { id: "distribution_channel", label: isCn ? "分发渠道" : "Distribution channel", summary: isCn ? "承接平台下载、版本可见性和分发规则" : "Controls store visibility, device distribution, and rollout rules", fields: ["name", "platform", "visibility", "status"], primaryViews: ["/download", "/pricing", "/admin"], workflows: isCn ? ["更新渠道", "灰度发布", "下架渠道"] : ["update channel", "roll out", "retire channel"] },
    ]
    if (/device|ios|android|apk|mac|windows|desktop|设备|安卓|苹果|桌面端/.test(text)) {
      entities.push({
        id: "device_build",
        label: isCn ? "设备构建包" : "Device build",
        summary: isCn ? "记录不同端的安装包、版本和签名状态" : "Tracks per-device builds, versions, and signing state",
        fields: ["platform", "version", "channel", "signatureStatus", "releasedAt"],
        primaryViews: ["/devices", "/download"],
        workflows: isCn ? ["上传构建", "更新版本", "检查签名"] : ["upload build", "update version", "check signing"],
      })
    }
    return entities
  }
  const domainFlavor = inferDomainFlavor(text)
  if (archetype === "task" && domainFlavor === "healthcare" && !shouldPreferAdminOpsOverCrm(text)) {
    return [
      { id: "patient", label: isCn ? "患者" : "Patient", summary: isCn ? "患者档案、风险分层和护理状态" : "Patient profile, risk tier, and care status", fields: ["name", "riskTier", "careOwner", "nextVisit", "status"], primaryViews: ["/patients", "/dashboard"], workflows: isCn ? ["建档", "分诊", "随访"] : ["intake", "triage", "follow up"] },
      { id: "appointment", label: isCn ? "预约" : "Appointment", summary: isCn ? "医生排班、预约和提醒" : "Doctor schedule, appointment, and reminder", fields: ["patient", "clinician", "time", "room", "state"], primaryViews: ["/appointments", "/dashboard"], workflows: isCn ? ["排班", "确认", "提醒"] : ["schedule", "confirm", "remind"] },
      { id: "care_plan", label: isCn ? "护理计划" : "Care plan", summary: isCn ? "护理任务、复诊节点和用药提醒" : "Care tasks, revisit milestones, and medication reminders", fields: ["patient", "goal", "task", "dueAt", "owner"], primaryViews: ["/care", "/tasks"], workflows: isCn ? ["制定计划", "执行护理", "复查"] : ["plan care", "complete task", "review"] },
    ]
  }
  if (archetype === "task" && domainFlavor === "education" && !shouldPreferAdminOpsOverCrm(text)) {
    return [
      { id: "course", label: isCn ? "课程" : "Course", summary: isCn ? "课程、章节和学习路径" : "Course, modules, and learning path", fields: ["title", "level", "teacher", "progress", "status"], primaryViews: ["/courses", "/dashboard"], workflows: isCn ? ["创建课程", "发布章节", "跟踪进度"] : ["create course", "publish lesson", "track progress"] },
      { id: "student", label: isCn ? "学生" : "Student", summary: isCn ? "学生画像、班级和掌握情况" : "Student profile, cohort, and mastery", fields: ["name", "cohort", "score", "risk", "mentor"], primaryViews: ["/students", "/dashboard"], workflows: isCn ? ["分班", "辅导", "反馈"] : ["assign cohort", "coach", "feedback"] },
      { id: "assignment", label: isCn ? "作业" : "Assignment", summary: isCn ? "作业、提交和批改流" : "Assignment, submission, and grading flow", fields: ["title", "course", "dueAt", "submitted", "grade"], primaryViews: ["/assignments", "/tasks"], workflows: isCn ? ["布置", "提交", "批改"] : ["assign", "submit", "grade"] },
    ]
  }
  if (archetype === "task" && domainFlavor === "finance" && !shouldPreferAdminOpsOverCrm(text)) {
    return [
      { id: "ledger_account", label: isCn ? "账本账户" : "Ledger account", summary: isCn ? "账户余额、归属和风险状态" : "Account balance, ownership, and risk state", fields: ["name", "balance", "owner", "risk", "updatedAt"], primaryViews: ["/accounts", "/dashboard"], workflows: isCn ? ["查看账户", "标记风险", "同步余额"] : ["review account", "flag risk", "sync balance"] },
      { id: "transaction", label: isCn ? "交易流水" : "Transaction", summary: isCn ? "交易、状态和对账信息" : "Transaction, state, and reconciliation data", fields: ["merchant", "amount", "status", "category", "postedAt"], primaryViews: ["/transactions", "/dashboard"], workflows: isCn ? ["导入流水", "匹配凭证", "确认状态"] : ["import", "match receipt", "confirm status"] },
      { id: "reconciliation", label: isCn ? "对账批次" : "Reconciliation batch", summary: isCn ? "批次差异、审批和导出" : "Batch variance, approvals, and export", fields: ["period", "variance", "owner", "state", "closedAt"], primaryViews: ["/reconciliation", "/approvals"], workflows: isCn ? ["对账", "审批", "关账"] : ["reconcile", "approve", "close"] },
    ]
  }
  if (archetype === "task" && domainFlavor === "recruiting" && !shouldPreferAdminOpsOverCrm(text)) {
    return [
      { id: "candidate", label: isCn ? "候选人" : "Candidate", summary: isCn ? "候选人阶段、评分和来源" : "Candidate stage, score, and source", fields: ["name", "role", "stage", "score", "owner"], primaryViews: ["/candidates", "/pipeline"], workflows: isCn ? ["筛选", "安排面试", "发 offer"] : ["screen", "schedule interview", "offer"] },
      { id: "job_role", label: isCn ? "岗位" : "Job role", summary: isCn ? "岗位需求、HC 和招聘进度" : "Role requirements, headcount, and hiring progress", fields: ["title", "team", "headcount", "status", "priority"], primaryViews: ["/jobs", "/dashboard"], workflows: isCn ? ["发布岗位", "匹配候选人", "关闭岗位"] : ["publish role", "match candidates", "close role"] },
      { id: "interview", label: isCn ? "面试" : "Interview", summary: isCn ? "面试安排、反馈和下一步" : "Interview schedule, feedback, and next step", fields: ["candidate", "panel", "time", "feedback", "decision"], primaryViews: ["/interviews", "/tasks"], workflows: isCn ? ["安排", "收集反馈", "推进决策"] : ["schedule", "collect feedback", "decide"] },
    ]
  }
  if (archetype === "task" && domainFlavor === "support" && !shouldPreferAdminOpsOverCrm(text)) {
    return [
      { id: "support_ticket", label: isCn ? "客服工单" : "Support ticket", summary: isCn ? "问题、优先级、SLA 与负责人" : "Issue, priority, SLA, and owner", fields: ["subject", "priority", "sla", "owner", "state"], primaryViews: ["/tickets", "/dashboard"], workflows: isCn ? ["受理", "升级", "解决"] : ["intake", "escalate", "resolve"] },
      { id: "customer_case", label: isCn ? "客户案例" : "Customer case", summary: isCn ? "客户上下文、历史和影响范围" : "Customer context, history, and impact scope", fields: ["account", "impact", "history", "segment", "status"], primaryViews: ["/cases", "/tickets"], workflows: isCn ? ["查看上下文", "同步客户", "关闭案例"] : ["review context", "sync customer", "close case"] },
      { id: "knowledge_article", label: isCn ? "知识库文章" : "Knowledge article", summary: isCn ? "解决方案、标签和发布状态" : "Resolution content, tags, and publish state", fields: ["title", "topic", "status", "owner", "updatedAt"], primaryViews: ["/knowledge", "/docs"], workflows: isCn ? ["撰写", "审核", "发布"] : ["draft", "review", "publish"] },
    ]
  }
  if (archetype === "task" && domainFlavor === "commerce_ops" && !shouldPreferAdminOpsOverCrm(text)) {
    return [
      { id: "product_sku", label: isCn ? "商品 SKU" : "Product SKU", summary: isCn ? "商品、库存和上架状态" : "Product, inventory, and listing state", fields: ["sku", "name", "stock", "price", "status"], primaryViews: ["/products", "/inventory"], workflows: isCn ? ["上架", "补货", "调价"] : ["list", "restock", "price"] },
      { id: "fulfillment_order", label: isCn ? "履约订单" : "Fulfillment order", summary: isCn ? "订单、仓库和配送节点" : "Order, warehouse, and shipping milestones", fields: ["orderNo", "customer", "warehouse", "carrier", "state"], primaryViews: ["/orders", "/dashboard"], workflows: isCn ? ["确认订单", "分配仓库", "发货"] : ["confirm", "allocate", "ship"] },
      { id: "inventory_alert", label: isCn ? "库存预警" : "Inventory alert", summary: isCn ? "库存阈值、补货和异常" : "Stock thresholds, restock, and exception handling", fields: ["sku", "threshold", "currentStock", "owner", "severity"], primaryViews: ["/inventory", "/analytics"], workflows: isCn ? ["识别预警", "创建补货", "关闭异常"] : ["flag alert", "create restock", "close exception"] },
    ]
  }
  if (shouldPreferAdminOpsOverCrm(text)) {
    return [
      {
        id: "approval_request",
        label: isCn ? "审批请求" : "Approval request",
        summary: isCn ? "记录待审批事项、责任人和截止时间" : "Tracks pending approvals, owners, and due dates",
        fields: ["title", "requestor", "owner", "state", "dueAt"],
        primaryViews: ["/approvals", "/dashboard"],
        workflows: isCn ? ["提交", "审批", "驳回"] : ["submit", "approve", "reject"],
      },
      {
        id: "access_policy",
        label: isCn ? "访问策略" : "Access policy",
        summary: isCn ? "管理角色、权限边界和生效范围" : "Manages roles, permission boundaries, and scope",
        fields: ["name", "scope", "role", "status", "updatedAt"],
        primaryViews: ["/security", "/dashboard"],
        workflows: isCn ? ["创建策略", "调整角色", "发布变更"] : ["create policy", "adjust role", "publish change"],
      },
      {
        id: "audit_event",
        label: isCn ? "审计事件" : "Audit event",
        summary: isCn ? "承接审计留痕、合规记录和关键操作历史" : "Captures audit trails, compliance records, and critical actions",
        fields: ["actor", "action", "target", "severity", "createdAt"],
        primaryViews: ["/audit", "/dashboard", "/security"],
        workflows: isCn ? ["查看记录", "导出审计", "核对异常"] : ["review log", "export audit", "verify anomaly"],
      },
      {
        id: "incident_case",
        label: isCn ? "事件工单" : "Incident case",
        summary: isCn ? "记录告警、故障与响应编排" : "Tracks alerts, incidents, and response orchestration",
        fields: ["title", "severity", "owner", "status", "startedAt"],
        primaryViews: ["/incidents", "/dashboard"],
        workflows: isCn ? ["升级告警", "分派负责人", "恢复关闭"] : ["escalate alert", "assign owner", "resolve"],
      },
      {
        id: "team_seat",
        label: isCn ? "团队席位" : "Team seat",
        summary: isCn ? "管理成员席位、角色与工作区权限" : "Manages member seats, roles, and workspace access",
        fields: ["name", "role", "seatType", "status", "workspace"],
        primaryViews: ["/team", "/security"],
        workflows: isCn ? ["分配席位", "调整角色", "停用访问"] : ["assign seat", "adjust role", "disable access"],
      },
      {
        id: "ops_rule",
        label: isCn ? "治理规则" : "Ops rule",
        summary: isCn ? "连接审批、告警和权限同步自动化" : "Connects approval, alerting, and policy-sync automation",
        fields: ["name", "trigger", "scope", "owner", "status"],
        primaryViews: ["/automations", "/dashboard"],
        workflows: isCn ? ["启用规则", "调整范围", "暂停规则"] : ["enable rule", "retune scope", "pause rule"],
      },
    ]
  }
  return [
    { id: "task", label: isCn ? "任务" : "Task", summary: isCn ? "工作项与状态流转" : "Work item and status flow", fields: ["title", "status", "assignee", "priority"], primaryViews: ["/tasks", "/dashboard"], workflows: isCn ? ["创建", "分配", "完成"] : ["create", "assign", "complete"] },
    { id: "approval", label: isCn ? "审批" : "Approval", summary: isCn ? "审批与权限边界" : "Approval and access boundary", fields: ["title", "owner", "state", "dueAt"], primaryViews: ["/approvals"], workflows: isCn ? ["提交", "审批", "驳回"] : ["submit", "approve", "reject"] },
  ]
}

function getRoutePrimaryActions(route: string, archetype: ScaffoldArchetype, region: Region) {
  const isCn = region === "cn"
  if (route === "dashboard") {
    if (isCn) {
      if (archetype === "code_platform") return ["查看状态", "检查运行", "切换模块"]
      if (archetype === "crm") return ["查看预测", "识别风险", "推进交付"]
      if (archetype === "api_platform") return ["查看平台状态", "排查告警", "检查用量"]
      if (archetype === "community") return ["查看社区节奏", "跟进反馈", "同步活动"]
      if (archetype === "marketing_admin" || archetype === "content") return ["查看转化", "检查分发", "同步版本说明"]
      if (archetype === "task") return ["查看治理状态", "推进任务", "同步规则"]
    } else {
      if (archetype === "code_platform") return ["review status", "inspect runtime", "switch modules"]
      if (archetype === "crm") return ["review forecast", "flag risk", "advance handoff"]
      if (archetype === "api_platform") return ["review platform health", "triage alerts", "inspect usage"]
      if (archetype === "community") return ["review community rhythm", "triage feedback", "sync events"]
      if (archetype === "marketing_admin" || archetype === "content") return ["review conversion", "inspect distribution", "sync releases"]
      if (archetype === "task") return ["review approvals", "check access", "track incidents"]
    }
  }
  const cnActions: Record<string, string[]> = {
    dashboard: ["查看状态", "检查运行", "切换模块"],
    editor: ["打开文件", "编辑代码", "保存变更", "切换预览"],
    assistant: ["继续对话", "应用修改", "查看上下文"],
    publish: ["检查发布", "确认预览", "提升通道"],
    runs: ["查看日志", "刷新状态", "检查构建"],
    templates: ["筛选模板", "切换模板", "按模板生成"],
    pricing: ["查看套餐", "比较权限", "升级套餐"],
    settings: ["修改配置", "检查权限", "管理环境"],
    leads: ["录入线索", "分配负责人", "推进跟进"],
    pipeline: ["推进阶段", "识别风险", "成交转交付"],
    customers: ["查看账户", "准备续约", "同步交付"],
    automations: ["查看规则", "启停规则", "新建自动化"],
    reports: ["查看预测", "分析阶段", "导出摘要"],
    orders: ["查看订单", "确认报价", "同步回款"],
    team: ["查看排行", "调整配额", "同步团队目标"],
    endpoints: ["查看接口", "发布版本", "同步文档"],
    logs: ["筛选日志", "查看 trace", "确认恢复"],
    auth: ["查看 scopes", "创建密钥", "轮换密钥"],
    environments: ["检查环境", "发布", "回滚"],
    webhooks: ["查看回调", "重试投递", "确认订阅"],
    usage: ["查看用量", "校验账单", "调整限流"],
    website: ["浏览官网", "编辑板块", "检查转化"],
    pricing: ["查看套餐", "比较版本", "调整权益"],
    downloads: ["查看资产", "上传包", "复制下载链路"],
    docs: ["浏览文档", "编辑说明", "发布更新"],
    changelog: ["查看版本说明", "发布更新", "同步下载页"],
    admin: ["查看分发", "修改后台", "同步状态"],
    devices: ["查看构建包", "上传安装包", "检查签名"],
    feedback: ["查看反馈", "归类优先级", "进入路线图"],
    roadmap: ["查看路线图", "推进事项", "公开说明"],
    posts: ["查看帖子", "发布公告", "整理讨论"],
    members: ["查看成员", "调整分层", "发起邀请"],
    events: ["查看活动", "管理报名", "发送提醒"],
    moderation: ["查看举报", "处理审核", "同步规则"],
    tasks: ["查看待办", "分配负责人", "推进治理"],
    approvals: ["查看审批", "批量处理", "同步状态"],
    security: ["查看策略", "调整角色", "发布权限"],
    audit: ["查看审计", "导出留痕", "核对异常"],
    incidents: ["查看告警", "分派负责人", "推动恢复"],
    analytics: ["查看指标", "对比趋势", "导出治理摘要"],
    patients: ["查看患者", "安排随访", "更新护理计划"],
    appointments: ["查看预约", "确认排班", "发送提醒"],
    care: ["查看护理计划", "分派任务", "完成复查"],
    courses: ["查看课程", "发布章节", "跟踪学习"],
    students: ["查看学生", "调整分组", "同步反馈"],
    assignments: ["查看作业", "批改提交", "发布反馈"],
    accounts: ["查看账户", "标记风险", "同步余额"],
    transactions: ["查看流水", "匹配凭证", "确认状态"],
    reconciliation: ["查看对账", "处理差异", "关账"],
    candidates: ["查看候选人", "推进阶段", "安排面试"],
    jobs: ["查看岗位", "匹配候选人", "关闭岗位"],
    interviews: ["查看面试", "收集反馈", "推进决策"],
    tickets: ["查看工单", "升级处理", "关闭问题"],
    cases: ["查看案例", "同步客户", "更新影响"],
    knowledge: ["查看知识库", "编辑方案", "发布文章"],
    products: ["查看商品", "调整库存", "更新价格"],
    inventory: ["查看库存", "创建补货", "关闭预警"],
  }
  const fallback = isCn ? ["查看页面", "执行主操作", "继续迭代"] : ["view surface", "run primary action", "continue iterating"]
  const raw = cnActions[route] ?? fallback
  if (isCn) return raw
  const translation: Record<string, string[]> = {
    dashboard: ["review status", "inspect runtime", "switch modules"],
    editor: ["open file", "edit code", "save changes", "switch preview"],
    assistant: ["continue thread", "apply change", "inspect context"],
    publish: ["review release", "verify preview", "promote channel"],
    runs: ["inspect logs", "refresh status", "check build"],
    templates: ["filter templates", "switch template", "generate from template"],
    pricing: ["review plans", "compare permissions", "upgrade"],
    settings: ["update config", "check access", "manage environments"],
    leads: ["add lead", "assign owner", "advance follow-up"],
    pipeline: ["move stage", "flag risk", "handoff closed deal"],
    customers: ["review account", "prepare renewal", "sync handoff"],
    automations: ["review rules", "toggle rules", "create automation"],
    reports: ["review forecast", "analyze stages", "export summary"],
    orders: ["review order", "confirm quote", "sync payment"],
    team: ["review leaderboard", "adjust quota", "sync team goals"],
    endpoints: ["review endpoint", "publish version", "sync docs"],
    logs: ["filter logs", "inspect trace", "confirm recovery"],
    auth: ["review scopes", "create key", "rotate key"],
    environments: ["inspect environment", "promote release", "rollback"],
    webhooks: ["review callbacks", "retry delivery", "confirm subscription"],
    usage: ["review usage", "verify billing", "adjust rate limits"],
    website: ["browse site", "edit sections", "check conversion"],
    pricing: ["review plans", "compare tiers", "adjust entitlements"],
    downloads: ["review asset", "upload build", "copy distribution link"],
    docs: ["browse docs", "edit notes", "publish update"],
    changelog: ["review release notes", "publish update", "sync downloads"],
    admin: ["review distribution", "edit backend", "sync status"],
    devices: ["review builds", "upload installer", "check signing"],
    feedback: ["review feedback", "set priority", "move to roadmap"],
    roadmap: ["review roadmap", "move items", "publish notes"],
    posts: ["review posts", "publish announcement", "shape discussion"],
    members: ["review members", "update segment", "invite member"],
    events: ["review events", "manage attendance", "send reminders"],
    moderation: ["review reports", "moderate content", "sync policy"],
    tasks: ["review queue", "assign owner", "advance governance"],
    approvals: ["review approvals", "batch decision", "sync status"],
    security: ["review policy", "adjust role", "publish access"],
    audit: ["review audit", "export trail", "verify anomaly"],
    incidents: ["review incidents", "assign responder", "drive recovery"],
    analytics: ["review metrics", "compare trends", "export governance summary"],
    patients: ["review patients", "schedule follow-up", "update care plan"],
    appointments: ["review appointments", "confirm schedule", "send reminders"],
    care: ["review care plan", "assign task", "complete review"],
    courses: ["review courses", "publish lesson", "track learning"],
    students: ["review students", "update cohort", "sync feedback"],
    assignments: ["review assignments", "grade submissions", "publish feedback"],
    accounts: ["review accounts", "flag risk", "sync balance"],
    transactions: ["review transactions", "match receipts", "confirm status"],
    reconciliation: ["review reconciliation", "resolve variance", "close books"],
    candidates: ["review candidates", "advance stage", "schedule interview"],
    jobs: ["review roles", "match candidates", "close role"],
    interviews: ["review interviews", "collect feedback", "advance decision"],
    tickets: ["review tickets", "escalate issue", "close resolution"],
    cases: ["review cases", "sync customer", "update impact"],
    knowledge: ["review knowledge", "edit resolution", "publish article"],
    products: ["review products", "adjust inventory", "update pricing"],
    inventory: ["review inventory", "create restock", "close alert"],
  }
  return translation[route] ?? fallback
}

function getRouteSurface(route: string, archetype: ScaffoldArchetype): RouteBlueprint["surface"] {
  if (route === "editor") return "code"
  if (route === "assistant" && archetype === "code_platform") return "code"
  if (route === "settings") return "settings"
  if (archetype === "api_platform" && (route === "docs" || route === "usage")) {
    return "data"
  }
  if (route === "pricing" || route === "website" || route === "downloads" || route === "docs" || route === "changelog" || route === "admin" || route === "devices") {
    return "marketing"
  }
  if (
    archetype === "crm" ||
    archetype === "api_platform" ||
    [
      "customers",
      "reports",
      "orders",
      "team",
      "endpoints",
      "logs",
      "auth",
      "environments",
      "webhooks",
      "usage",
      "feedback",
      "members",
      "events",
      "roadmap",
      "moderation",
      "patients",
      "appointments",
      "care",
      "courses",
      "students",
      "assignments",
      "accounts",
      "transactions",
      "reconciliation",
      "candidates",
      "jobs",
      "interviews",
      "tickets",
      "cases",
      "knowledge",
      "products",
      "inventory",
    ].includes(route)
  ) {
    return "data"
  }
  return "dashboard"
}

function getRoutePagePrototype(route: string, archetype: ScaffoldArchetype): RoutePagePrototype {
  if (route === "dashboard" || route === "home") return archetype === "marketing_admin" || archetype === "content" ? "hero" : "dashboard"
  if (route === "settings") return "settings"

  if (archetype === "code_platform") {
    const mapping: Record<string, RoutePagePrototype> = {
      editor: "editor",
      assistant: "workflow",
      publish: "workflow",
      runs: "timeline",
      templates: "list",
      pricing: "analytics",
    }
    return mapping[route] ?? "dashboard"
  }

  if (archetype === "crm") {
    const mapping: Record<string, RoutePagePrototype> = {
      leads: "list",
      pipeline: "kanban",
      customers: "detail",
      accounts: "detail",
      orders: "workflow",
      quotes: "admin_queue",
      reports: "analytics",
      team: "analytics",
      automations: "workflow",
      onboarding: "workflow",
      renewals: "timeline",
    }
    return mapping[route] ?? "dashboard"
  }

  if (archetype === "api_platform") {
    const mapping: Record<string, RoutePagePrototype> = {
      endpoints: "list",
      logs: "timeline",
      auth: "settings",
      environments: "workflow",
      webhooks: "timeline",
      usage: "analytics",
      docs: "docs",
      keys: "settings",
    }
    return mapping[route] ?? "dashboard"
  }

  if (archetype === "marketing_admin" || archetype === "content") {
    const mapping: Record<string, RoutePagePrototype> = {
      website: "hero",
      pricing: "analytics",
      downloads: "distribution",
      devices: "distribution",
      docs: "docs",
      changelog: "timeline",
      admin: "admin_queue",
      faq: "docs",
      home: "hero",
    }
    return mapping[route] ?? "hero"
  }

  if (archetype === "community") {
    const mapping: Record<string, RoutePagePrototype> = {
      feedback: "feed",
      roadmap: "kanban",
      posts: "feed",
      members: "list",
      events: "timeline",
      moderation: "admin_queue",
      analytics: "analytics",
    }
    return mapping[route] ?? "feed"
  }

  const adminMapping: Record<string, RoutePagePrototype> = {
    tasks: "list",
    approvals: "admin_queue",
    security: "settings",
    audit: "timeline",
    incidents: "workflow",
    team: "list",
    automations: "workflow",
    reports: "analytics",
    analytics: "analytics",
    patients: "list",
    appointments: "timeline",
    care: "workflow",
    courses: "docs",
    students: "list",
    assignments: "workflow",
    accounts: "detail",
    transactions: "timeline",
    reconciliation: "admin_queue",
    candidates: "list",
    jobs: "detail",
    interviews: "timeline",
    tickets: "admin_queue",
    cases: "detail",
    knowledge: "docs",
    products: "list",
    inventory: "analytics",
    orders: "workflow",
  }
  return adminMapping[route] ?? "dashboard"
}

function pickEntityIds(entityIds: string[], available: Set<string>) {
  return entityIds.filter((item) => available.has(item))
}

function getDefaultEntityIdsForRoute(route: string, archetype: ScaffoldArchetype, entities: EntityBlueprint[]) {
  const available = new Set(entities.map((item) => item.id))
  if (archetype === "code_platform") {
    const mapping: Record<string, string[]> = {
      dashboard: ["workspace_project", "runtime_run"],
      editor: ["source_file", "ai_session"],
      assistant: ["assistant_thread", "ai_session"],
      publish: ["release_deployment", "runtime_run", "workspace_project"],
      runs: ["runtime_run"],
      templates: ["template_asset"],
      pricing: ["workspace_project"],
      settings: ["workspace_project", "runtime_run"],
    }
    return pickEntityIds(mapping[route] ?? ["workspace_project"], available)
  }
  if (archetype === "crm") {
    const mapping: Record<string, string[]> = {
      dashboard: ["opportunity", "customer_account", "sales_order"],
      leads: ["lead"],
      pipeline: ["lead", "opportunity"],
      customers: ["customer_account"],
      automations: ["automation_rule", "opportunity"],
      reports: ["opportunity", "customer_account"],
      orders: ["sales_order", "customer_account"],
      team: ["sales_rep", "opportunity"],
    }
    return pickEntityIds(mapping[route] ?? ["opportunity"], available)
  }
  if (archetype === "api_platform") {
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
    return pickEntityIds(mapping[route] ?? ["endpoint"], available)
  }
  if (archetype === "community") {
    const mapping: Record<string, string[]> = {
      dashboard: ["feedback_item", "post"],
      feedback: ["feedback_item", "roadmap_item"],
      members: ["member"],
      events: ["community_event"],
      posts: ["post"],
      settings: ["member", "feedback_item"],
      roadmap: ["roadmap_item"],
      moderation: ["moderation_case", "post", "feedback_item"],
    }
    return pickEntityIds(mapping[route] ?? ["feedback_item"], available)
  }
  if (archetype === "marketing_admin" || archetype === "content") {
    const mapping: Record<string, string[]> = {
      dashboard: ["site_page", "download_asset"],
      website: ["site_page"],
      downloads: ["download_asset", "distribution_channel"],
      docs: ["release_note", "site_page"],
      admin: ["distribution_channel", "release_note"],
      changelog: ["release_note"],
      devices: ["device_build", "download_asset"],
      pricing: ["distribution_channel", "download_asset"],
    }
    return pickEntityIds(mapping[route] ?? ["site_page"], available)
  }
  const adminOpsMapping: Record<string, string[]> = {
    dashboard: ["approval_request", "audit_event", "incident_case"],
    tasks: ["approval_request", "incident_case", "ops_rule"],
    approvals: ["approval_request"],
    security: ["access_policy", "team_seat", "audit_event"],
    audit: ["audit_event"],
    incidents: ["incident_case"],
    team: ["team_seat"],
    automations: ["ops_rule"],
    reports: ["audit_event", "approval_request", "incident_case"],
    patients: ["patient", "care_plan"],
    appointments: ["appointment", "patient"],
    care: ["care_plan", "patient"],
    courses: ["course", "assignment"],
    students: ["student", "course"],
    assignments: ["assignment", "student"],
    accounts: ["ledger_account", "transaction"],
    transactions: ["transaction", "ledger_account"],
    reconciliation: ["reconciliation", "transaction"],
    candidates: ["candidate", "interview"],
    jobs: ["job_role", "candidate"],
    interviews: ["interview", "candidate"],
    tickets: ["support_ticket", "customer_case"],
    cases: ["customer_case", "support_ticket"],
    knowledge: ["knowledge_article", "support_ticket"],
    products: ["product_sku", "inventory_alert"],
    inventory: ["inventory_alert", "product_sku"],
    orders: ["fulfillment_order", "product_sku"],
  }
  const mappedAdminOps = pickEntityIds(adminOpsMapping[route] ?? [], available)
  if (mappedAdminOps.length) return mappedAdminOps
  const fallback = route === "approvals" ? ["approval"] : ["task"]
  return pickEntityIds(fallback, available)
}

function getArchetypeModuleBlueprintSeeds(spec: AppSpec, routeBlueprint: RouteBlueprint[]) {
  const isCn = spec.region === "cn"
  const availableRouteIds = new Set(routeBlueprint.map((item) => item.id))
  const includeRoutes = (ids: string[]) => ids.filter((item) => availableRouteIds.has(item))
  const domainFlavor = inferDomainFlavor(spec.prompt ?? spec.title)
  const isSpecializedTask = getScaffoldArchetype(spec) === "task" && domainFlavor !== "general" && !shouldPreferAdminOpsOverCrm(String(spec.prompt ?? spec.title ?? ""))
  const specializedTaskSeeds: ModuleBlueprint[] | null =
    !isSpecializedTask
      ? null
      : domainFlavor === "healthcare"
        ? [
            {
              id: "patient_flow",
              label: isCn ? "患者队列与分诊" : "Patient queue and triage",
              summary: isCn ? "把患者档案、风险分层和分诊状态连成诊疗入口。" : "Connects patient profiles, risk tiers, and triage state into the care entry point.",
              routeIds: includeRoutes(["dashboard", "patients"]),
              capabilityIds: isCn ? ["查看患者", "标记风险", "安排分诊"] : ["review patients", "flag risk", "triage"],
            },
            {
              id: "care_schedule",
              label: isCn ? "预约与护理计划" : "Appointments and care plans",
              summary: isCn ? "承接预约排班、复诊提醒和护理任务闭环。" : "Owns scheduling, follow-up reminders, and care-plan task loops.",
              routeIds: includeRoutes(["appointments", "care", "dashboard"]),
              capabilityIds: isCn ? ["确认预约", "更新护理计划", "发送提醒"] : ["confirm appointment", "update care plan", "send reminder"],
            },
          ]
        : domainFlavor === "education"
          ? [
              {
                id: "learning_catalog",
                label: isCn ? "课程目录与学习路径" : "Course catalog and learning path",
                summary: isCn ? "把课程、章节和作业设计成教学产品骨架。" : "Shapes courses, lessons, and assignments into a learning-product structure.",
                routeIds: includeRoutes(["dashboard", "courses", "assignments"]),
                capabilityIds: isCn ? ["发布课程", "布置作业", "跟踪进度"] : ["publish course", "assign work", "track progress"],
              },
              {
                id: "student_success",
                label: isCn ? "学生画像与反馈" : "Student profile and feedback",
                summary: isCn ? "维护学生分班、学习状态和反馈动作。" : "Tracks cohorts, learning state, and feedback actions.",
                routeIds: includeRoutes(["students", "dashboard"]),
                capabilityIds: isCn ? ["查看学生", "调整分班", "同步反馈"] : ["review students", "adjust cohort", "sync feedback"],
              },
            ]
          : domainFlavor === "finance"
            ? [
                {
                  id: "ledger_reconciliation",
                  label: isCn ? "账本与对账轨道" : "Ledger and reconciliation rail",
                  summary: isCn ? "把账户、交易和对账差异组织成财务控制台。" : "Organizes accounts, transactions, and variance handling into a finance console.",
                  routeIds: includeRoutes(["dashboard", "accounts", "transactions", "reconciliation"]),
                  capabilityIds: isCn ? ["查看流水", "匹配凭证", "处理差异"] : ["review transactions", "match receipts", "resolve variance"],
                },
              ]
            : domainFlavor === "recruiting"
              ? [
                  {
                    id: "candidate_pipeline",
                    label: isCn ? "候选人与岗位漏斗" : "Candidate and role pipeline",
                    summary: isCn ? "串联候选人池、岗位需求、面试和 offer 决策。" : "Connects candidate pools, roles, interviews, and offer decisions.",
                    routeIds: includeRoutes(["dashboard", "candidates", "jobs", "interviews"]),
                    capabilityIds: isCn ? ["推进候选人", "安排面试", "推进 offer"] : ["advance candidate", "schedule interview", "advance offer"],
                  },
                ]
              : domainFlavor === "support"
                ? [
                    {
                      id: "support_resolution",
                      label: isCn ? "工单与知识库闭环" : "Ticket and knowledge loop",
                      summary: isCn ? "把工单、客户案例、SLA 升级和知识库沉淀做成支持工作流。" : "Turns tickets, customer cases, SLA escalation, and knowledge capture into a support workflow.",
                      routeIds: includeRoutes(["dashboard", "tickets", "cases", "knowledge"]),
                      capabilityIds: isCn ? ["处理工单", "升级 SLA", "沉淀知识"] : ["resolve ticket", "escalate SLA", "capture knowledge"],
                    },
                  ]
                : [
                    {
                      id: "commerce_fulfillment",
                      label: isCn ? "商品库存与履约" : "Product inventory and fulfillment",
                      summary: isCn ? "把商品 SKU、库存水位和履约订单组织成电商运营流。" : "Organizes SKUs, inventory levels, and fulfillment orders into a commerce ops flow.",
                      routeIds: includeRoutes(["dashboard", "products", "inventory", "orders"]),
                      capabilityIds: isCn ? ["查看库存", "创建补货", "推进履约"] : ["review inventory", "create restock", "advance fulfillment"],
                    },
                  ]
  const seeds: ModuleBlueprint[] =
    getScaffoldArchetype(spec) === "code_platform"
      ? [
          {
            id: "ai_orchestrator",
            label: isCn ? "AI 编排器" : "AI orchestrator",
            summary: isCn ? "承接 Discuss / Generate / Fix / Refactor 的上下文执行。" : "Runs Discuss / Generate / Fix / Refactor with shared context.",
            routeIds: includeRoutes(["dashboard", "editor", "assistant", "runs"]),
            capabilityIds: isCn ? ["讨论需求", "生成修改", "解释差异"] : ["discuss", "generate", "explain"],
          },
          {
            id: "file_tree",
            label: isCn ? "文件树与标签页" : "File tree and tabs",
            summary: isCn ? "维护当前文件、相关路径和多标签切换。" : "Tracks current files, related paths, and multi-tab switching.",
            routeIds: includeRoutes(["editor"]),
            capabilityIds: isCn ? ["打开文件", "切换标签", "定位模块"] : ["open file", "switch tab", "focus module"],
          },
          {
            id: "live_preview",
            label: isCn ? "实时预览面板" : "Live preview panel",
            summary: isCn ? "让代码编辑、运行结果和实时预览联动。" : "Keeps code editing, runtime feedback, and live preview in sync.",
            routeIds: includeRoutes(["dashboard", "editor", "runs"]),
            capabilityIds: isCn ? ["切换预览", "刷新运行时", "查看状态"] : ["toggle preview", "refresh runtime", "review status"],
          },
          {
            id: "template_gallery",
            label: isCn ? "模板与脚手架库" : "Template and scaffold gallery",
            summary: isCn ? "管理模板、起始点和推荐套餐。" : "Manages templates, starting points, and recommended plans.",
            routeIds: includeRoutes(["templates", "dashboard"]),
            capabilityIds: isCn ? ["筛选模板", "切换模板", "按模板生成"] : ["filter", "switch", "generate"],
          },
          {
            id: "release_control",
            label: isCn ? "运行与发布控制" : "Run and release control",
            summary: isCn ? "展示 build、preview、publish 和回退链路。" : "Surfaces build, preview, publish, and rollback state.",
            routeIds: includeRoutes(["runs", "publish", "settings", "dashboard"]),
            capabilityIds: isCn ? ["查看构建", "回滚发布", "确认验收"] : ["review builds", "rollback", "accept"],
          },
          {
            id: "assistant_context",
            label: isCn ? "助手上下文轨道" : "Assistant context rail",
            summary: isCn ? "把线程历史、当前文件和页面上下文绑定到 AI 助手页。" : "Binds thread history, current files, and page context into the assistant surface.",
            routeIds: includeRoutes(["assistant", "editor"]),
            capabilityIds: isCn ? ["查看线程", "应用修改", "对齐上下文"] : ["review thread", "apply change", "align context"],
          },
          {
            id: "publish_lane",
            label: isCn ? "发布通道" : "Publish lane",
            summary: isCn ? "承接预览验收、发布通道和交付状态。" : "Owns preview acceptance, release channels, and delivery state.",
            routeIds: includeRoutes(["publish", "runs", "dashboard"]),
            capabilityIds: isCn ? ["确认发布", "切换通道", "回看交付"] : ["confirm release", "switch channel", "review handoff"],
          },
        ]
      : getScaffoldArchetype(spec) === "crm"
        ? [
            {
              id: "lead_pipeline",
              label: isCn ? "线索与商机漏斗" : "Lead and opportunity pipeline",
              summary: isCn ? "串联线索收集、阶段推进和成交预测。" : "Connects lead intake, stage progression, and close forecasting.",
              routeIds: includeRoutes(["leads", "pipeline", "dashboard"]),
              capabilityIds: isCn ? ["认领线索", "推进阶段", "预测成交"] : ["assign lead", "move stage", "forecast close"],
            },
            {
              id: "account_portfolio",
              label: isCn ? "客户账户视图" : "Customer account portfolio",
              summary: isCn ? "跟踪续约、健康度和交付同步。" : "Tracks renewals, account health, and handoff readiness.",
              routeIds: includeRoutes(["customers", "dashboard"]),
              capabilityIds: isCn ? ["查看账户", "推进续约", "同步交付"] : ["review account", "renew", "sync handoff"],
            },
            {
              id: "automation_rules",
              label: isCn ? "销售自动化规则" : "Sales automation rules",
              summary: isCn ? "处理提醒、审批和阶段自动推进。" : "Handles reminders, approvals, and automatic stage progression.",
              routeIds: includeRoutes(["automations", "settings"]),
              capabilityIds: isCn ? ["启停规则", "审批报价", "同步团队"] : ["toggle rules", "approve quote", "sync team"],
            },
            {
              id: "forecast_reporting",
              label: isCn ? "成交预测与报表" : "Forecast and reporting",
              summary: isCn ? "汇总成交概率、阶段分布和负责人节奏。" : "Summarizes close probability, stage distribution, and owner cadence.",
              routeIds: includeRoutes(["reports", "dashboard", "pipeline"]),
              capabilityIds: isCn ? ["查看预测", "导出摘要", "识别风险"] : ["review forecast", "export summary", "flag risk"],
            },
          ]
        : getScaffoldArchetype(spec) === "api_platform"
          ? [
              {
                id: "endpoint_catalog",
                label: isCn ? "接口目录" : "Endpoint catalog",
                summary: isCn ? "承接服务、路径、版本和文档联动。" : "Owns services, paths, versions, and docs sync.",
                routeIds: includeRoutes(["endpoints", "dashboard"]),
                capabilityIds: isCn ? ["发布版本", "复制路径", "同步文档"] : ["publish version", "copy path", "sync docs"],
              },
              {
                id: "runtime_observability",
                label: isCn ? "运行观测台" : "Runtime observability",
                summary: isCn ? "聚合日志、trace、告警和恢复动作。" : "Aggregates logs, traces, alerts, and recovery actions.",
                routeIds: includeRoutes(["logs", "dashboard"]),
                capabilityIds: isCn ? ["筛选日志", "查看 trace", "确认恢复"] : ["filter logs", "inspect trace", "recover"],
              },
              {
                id: "access_policy",
                label: isCn ? "访问与密钥策略" : "Access and key policy",
                summary: isCn ? "管理 scopes、密钥轮换和环境授权。" : "Manages scopes, key rotation, and environment access.",
                routeIds: includeRoutes(["auth", "environments"]),
                capabilityIds: isCn ? ["创建密钥", "轮换密钥", "授权环境"] : ["create key", "rotate", "grant environment"],
              },
              {
                id: "webhook_delivery",
                label: isCn ? "Webhook 交付链路" : "Webhook delivery rail",
                summary: isCn ? "展示回调、失败重试和环境切换。" : "Shows callbacks, retries, and environment switching.",
                routeIds: includeRoutes(["webhooks", "environments", "logs"]),
                capabilityIds: isCn ? ["查看回调", "重试投递", "切换环境"] : ["review callbacks", "retry delivery", "switch environment"],
              },
              {
                id: "developer_docs_center",
                label: isCn ? "开发者文档中心" : "Developer docs center",
                summary: isCn ? "把 API 参考、SDK 指南和接入文档收进一套开发者内容面板。" : "Collects API reference, SDK guides, and onboarding docs into one developer surface.",
                routeIds: includeRoutes(["docs", "endpoints"]),
                capabilityIds: isCn ? ["浏览文档", "发布说明", "同步 SDK"] : ["browse docs", "publish docs", "sync SDK"],
              },
              {
                id: "usage_metering",
                label: isCn ? "用量与计量轨道" : "Usage and metering rail",
                summary: isCn ? "跟踪请求量、账单窗口和限流状态。" : "Tracks request volume, billing windows, and rate-limit posture.",
                routeIds: includeRoutes(["usage", "dashboard", "auth"]),
                capabilityIds: isCn ? ["查看用量", "校验账单", "调整限流"] : ["review usage", "verify billing", "adjust rate limits"],
              },
            ]
          : getScaffoldArchetype(spec) === "community"
            ? [
                {
                  id: "feedback_triage",
                  label: isCn ? "反馈分流台" : "Feedback triage desk",
                  summary: isCn ? "把建议、问题和需求转成路线图动作。" : "Turns requests, issues, and ideas into roadmap actions.",
                  routeIds: includeRoutes(["feedback", "dashboard"]),
                  capabilityIds: isCn ? ["归类优先级", "移入路线图", "回复成员"] : ["prioritize", "move to roadmap", "reply"],
                },
                {
                  id: "member_segments",
                  label: isCn ? "成员分层系统" : "Member segmentation system",
                  summary: isCn ? "维护成员角色、信任等级和邀请流程。" : "Maintains member roles, trust levels, and invites.",
                  routeIds: includeRoutes(["members", "settings", "dashboard"]),
                  capabilityIds: isCn ? ["邀请成员", "调整角色", "审核权限"] : ["invite", "adjust role", "moderate access"],
                },
                {
                  id: "event_programs",
                  label: isCn ? "活动与运营编排" : "Event and campaign orchestration",
                  summary: isCn ? "统一活动日历、报名和运营提醒。" : "Unifies event calendar, attendance, and reminder flows.",
                  routeIds: includeRoutes(["events", "dashboard"]),
                  capabilityIds: isCn ? ["创建活动", "管理报名", "发送提醒"] : ["create event", "manage attendance", "send reminders"],
                },
                {
                  id: "moderation_policy",
                  label: isCn ? "审核与规则策略" : "Moderation and policy rail",
                  summary: isCn ? "定义敏感词、审核队列和社区边界。" : "Defines moderation queues, keyword rules, and community boundaries.",
                  routeIds: includeRoutes(["settings", "feedback"]),
                  capabilityIds: isCn ? ["查看规则", "处理审核", "同步通知"] : ["review rules", "moderate", "sync notifications"],
                },
                {
                  id: "roadmap_planning",
                  label: isCn ? "路线图编排" : "Roadmap planning",
                  summary: isCn ? "把反馈优先级转成公开路线图与版本说明。" : "Turns feedback priorities into a public roadmap and release plan.",
                  routeIds: includeRoutes(["feedback", "roadmap", "dashboard"]),
                  capabilityIds: isCn ? ["纳入路线图", "更新状态", "公开说明"] : ["move to roadmap", "update status", "publish note"],
                },
                {
                  id: "community_content",
                  label: isCn ? "内容与公告流" : "Content and announcement flow",
                  summary: isCn ? "管理帖子、公告和社区讨论节奏。" : "Runs posts, announcements, and community discussion rhythm.",
                  routeIds: includeRoutes(["posts", "dashboard"]),
                  capabilityIds: isCn ? ["发布公告", "整理帖子", "推动互动"] : ["publish announcement", "curate posts", "drive engagement"],
                },
              ]
            : getScaffoldArchetype(spec) === "marketing_admin" || getScaffoldArchetype(spec) === "content"
              ? [
                  {
                    id: "website_story",
                    label: isCn ? "官网叙事系统" : "Website narrative system",
                    summary: isCn ? "管理 hero、卖点、背书和 CTA。" : "Manages hero, proof, feature narrative, and CTA blocks.",
                    routeIds: includeRoutes(["website", "dashboard"]),
                    capabilityIds: isCn ? ["编辑首页", "检查转化", "更新卖点"] : ["edit site", "check conversion", "update narrative"],
                  },
                  {
                    id: "download_distribution",
                    label: isCn ? "下载与分发中心" : "Download and distribution hub",
                    summary: isCn ? "统一客户端包、设备矩阵和分发渠道。" : "Unifies client builds, device coverage, and distribution channels.",
                    routeIds: includeRoutes(["downloads", "dashboard"]),
                    capabilityIds: isCn ? ["上传安装包", "复制下载链路", "同步设备说明"] : ["upload build", "copy link", "sync device guide"],
                  },
                  {
                    id: "docs_release_center",
                    label: isCn ? "文档与版本中心" : "Docs and release center",
                    summary: isCn ? "承接 changelog、安装说明和版本叙事。" : "Carries changelog, install guides, and release storytelling.",
                    routeIds: includeRoutes(["docs", "changelog", "admin"]),
                    capabilityIds: isCn ? ["发布说明", "同步下载页", "更新文档"] : ["publish note", "sync downloads", "update docs"],
                  },
                  {
                    id: "growth_ops",
                    label: isCn ? "增长与后台控制" : "Growth and admin controls",
                    summary: isCn ? "连接价格、分发规则和后台配置。" : "Connects pricing, distribution rules, and admin settings.",
                    routeIds: includeRoutes(["admin", "dashboard", "pricing"]),
                    capabilityIds: isCn ? ["修改套餐", "检查后台", "同步状态"] : ["update plans", "check admin", "sync status"],
                  },
                ]
              : specializedTaskSeeds
                ? specializedTaskSeeds
                : shouldPreferAdminOpsOverCrm(String(spec.prompt ?? spec.title ?? "").toLowerCase())
                ? [
                    {
                      id: "approval_control",
                      label: isCn ? "审批控制台" : "Approval control center",
                      summary: isCn ? "承接待办审批、责任人和批量决策。" : "Handles pending approvals, owners, and batch decisions.",
                      routeIds: includeRoutes(["dashboard", "approvals", "tasks"]),
                      capabilityIds: isCn ? ["查看审批", "批量处理", "同步状态"] : ["review approvals", "batch decision", "sync status"],
                    },
                    {
                      id: "policy_governance",
                      label: isCn ? "权限治理轨道" : "Policy governance rail",
                      summary: isCn ? "连接角色、访问策略和工作区边界。" : "Connects roles, access policy, and workspace boundaries.",
                      routeIds: includeRoutes(["security", "dashboard"]),
                      capabilityIds: isCn ? ["查看策略", "调整角色", "发布权限"] : ["review policy", "adjust role", "publish access"],
                    },
                    {
                      id: "audit_response",
                      label: isCn ? "审计与响应轨道" : "Audit and response rail",
                      summary: isCn ? "统一审计事件、告警和恢复动作。" : "Unifies audit events, alerts, and recovery actions.",
                      routeIds: includeRoutes(["dashboard", "security", "tasks"]),
                      capabilityIds: isCn ? ["查看审计", "跟进告警", "导出记录"] : ["review audit", "triage alert", "export log"],
                    },
                    {
                      id: "team_governance",
                      label: isCn ? "团队席位治理" : "Team seat governance",
                      summary: isCn ? "管理成员席位、负责人和规则生效范围。" : "Manages team seats, ownership, and rollout scope.",
                      routeIds: includeRoutes(["security", "tasks"]),
                      capabilityIds: isCn ? ["分配席位", "调整负责人", "同步规则"] : ["assign seat", "adjust owner", "sync rule"],
                    },
                  ]
                : [
                  {
                    id: "task_ops",
                    label: isCn ? "任务控制平面" : "Task operations plane",
                    summary: isCn ? "聚合工作项、审批与状态推进。" : "Aggregates work items, approvals, and status progression.",
                    routeIds: includeRoutes(["dashboard", "tasks", "approvals"]),
                    capabilityIds: isCn ? ["创建任务", "推进状态", "审批"] : ["create task", "move state", "approve"],
                  },
                ]

  return seeds
}

function buildCapabilityFlags(spec: AppSpec): CapabilityFlags {
  const archetype = getScaffoldArchetype(spec)
  const isAdminOps = isAdminOpsTaskSpec(spec)
  return {
    hasAiChat: archetype === "code_platform" || spec.kind === "code_platform",
    hasVisualEdit: archetype === "code_platform",
    hasCodeEditor: archetype === "code_platform",
    hasLivePreview: archetype === "code_platform",
    hasControlPlane: true,
    hasDataConsole: archetype === "crm" || archetype === "api_platform" || archetype === "task",
    hasAutomations: archetype === "crm" || archetype === "community" || isAdminOps || spec.planTier === "pro" || spec.planTier === "elite",
    hasIntegrations: archetype === "api_platform" || archetype === "marketing_admin" || archetype === "code_platform" || isAdminOps,
    hasApiSurface: archetype === "api_platform",
    hasPricing: archetype === "code_platform" || archetype === "marketing_admin" || spec.kind === "blog",
    hasPermissions: spec.planTier !== "free" || archetype === "crm" || archetype === "api_platform" || isAdminOps,
    hasPublishing: archetype === "marketing_admin" || archetype === "content" || archetype === "code_platform",
  }
}

function inferVisualSeed(spec: AppSpec): VisualSeed {
  const archetype = getScaffoldArchetype(spec)
  const icon = getArchetypeIconSeed(archetype, spec.title, spec.prompt)
  const text = String(spec.prompt ?? spec.title ?? "").toLowerCase()
  const isAdminOps = isAdminOpsTaskSpec(spec)
  const domainFlavor = inferDomainFlavor(text)
  const isSpecializedTask = archetype === "task" && !isAdminOps && domainFlavor !== "general"
  return {
    theme:
      archetype === "marketing_admin" || archetype === "content" || domainFlavor === "healthcare" || domainFlavor === "education"
        ? "light"
        : "dark",
    tone:
      archetype === "code_platform"
        ? /system|ops|control|admin|系统|控制台/.test(text)
          ? spec.region === "cn" ? "运维型 IDE 工作台" : "Operator IDE workspace"
          : spec.region === "cn" ? "生成式 IDE 工作台" : "Generative IDE workspace"
        : archetype === "crm"
          ? /renewal|success|account|续约|成功团队|账户/.test(text)
            ? spec.region === "cn" ? "客户成功控制台" : "Customer success control plane"
            : spec.region === "cn" ? "销售成交控制台" : "Revenue control plane"
          : archetype === "api_platform"
            ? /security|auth|token|oauth|安全|鉴权|令牌/.test(text)
              ? spec.region === "cn" ? "安全开发者网关" : "Secure developer gateway"
              : spec.region === "cn" ? "开发者平台" : "Developer platform"
            : archetype === "community"
              ? /feedback|roadmap|vote|反馈|路线图|投票/.test(text)
                ? spec.region === "cn" ? "反馈与路线图产品" : "Feedback and roadmap product"
                : spec.region === "cn" ? "社区与反馈产品" : "Community and feedback product"
              : isAdminOps
                ? spec.region === "cn"
                  ? "内部控制平面"
                  : "Internal control plane"
              : isSpecializedTask
                ? getDomainFlavorCategory(domainFlavor, spec.region)
              : /download|device|ios|android|desktop|下载|设备/.test(text)
                ? spec.region === "cn" ? "设备分发产品" : "Device distribution product"
                : spec.region === "cn"
                  ? "品牌与分发产品"
                  : "Brand and distribution product",
    density: archetype === "code_platform" || archetype === "api_platform" || isAdminOps || domainFlavor === "finance" ? "compact" : "comfortable",
    navStyle:
      archetype === "code_platform"
        ? "editor_shell"
        : archetype === "marketing_admin" || archetype === "content"
          ? "marketing_shell"
          : archetype === "community"
            ? "community_shell"
            : domainFlavor === "support" || domainFlavor === "recruiting"
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
              : archetype === "marketing_admin" || archetype === "content"
                ? /download|device|ios|android|desktop|distribution|release|下载|设备|分发|发布/.test(text)
                  ? "marketing_split"
                  : "story_stack"
                : domainFlavor === "healthcare" || domainFlavor === "education"
                  ? "story_stack"
                : domainFlavor === "support" || domainFlavor === "recruiting"
                  ? "split_command"
                : domainFlavor === "finance" || domainFlavor === "commerce_ops" || /incident|alert|outage|recovery|告警|故障|恢复|异常/.test(text)
                  ? "split_command"
                  : "sidebar_board",
    heroVariant:
      archetype === "crm"
        ? "pipeline"
        : archetype === "api_platform" || isAdminOps || domainFlavor === "finance" || domainFlavor === "support"
          ? "operations"
          : archetype === "marketing_admin" || archetype === "content"
            ? "distribution"
            : archetype === "community"
              ? "community"
              : "statement",
    surfaceVariant:
      archetype === "marketing_admin" || archetype === "community" || domainFlavor === "healthcare" || domainFlavor === "education"
        ? "glass"
        : archetype === "crm"
          ? "solid"
          : archetype === "api_platform" || isAdminOps
            ? "soft"
            : "solid",
    ctaVariant:
      archetype === "marketing_admin" || archetype === "community" || domainFlavor === "healthcare" || domainFlavor === "education"
        ? "pill"
        : archetype === "api_platform" || isAdminOps
          ? "outline"
          : "block",
    icon,
  }
}

function buildAppIdentity(spec: AppSpec): AppIdentity {
  const archetype = getScaffoldArchetype(spec)
  const isAdminOps = isAdminOpsTaskSpec(spec)
  const domainFlavor = inferDomainFlavor(spec.prompt ?? spec.title)
  const isSpecializedTask = archetype === "task" && !isAdminOps && domainFlavor !== "general"
  const icon = spec.visualSeed?.icon ?? getArchetypeIconSeed(archetype, spec.title, spec.prompt)
  const pageDefinitions = getArchetypePageDefinitions(spec)
  const shortDescription =
    (isAdminOps
      ? spec.region === "cn"
        ? "生成了内部 admin/control plane，承接审批、权限、审计、事件响应和团队治理。"
        : "Generated an internal admin control plane for approvals, access, audit, incident response, and team governance."
      : isSpecializedTask
        ? spec.region === "cn"
          ? `生成了${getDomainFlavorCategory(domainFlavor, spec.region)}，承接 ${extractPlannedRouteNames(spec).slice(0, 4).join(" / ")} 等核心业务入口。`
          : `Generated a ${getDomainFlavorCategory(domainFlavor, spec.region)} with core surfaces such as ${extractPlannedRouteNames(spec).slice(0, 4).join(" / ")}.`
      : pageDefinitions[0]?.summary) ||
    (spec.region === "cn"
      ? `已生成 ${getArchetypeCategoryLabel(archetype, spec.region)}，包含 ${extractPlannedRouteNames(spec).slice(0, 4).join(" / ")} 等核心入口。`
      : `Generated ${getArchetypeCategoryLabel(archetype, spec.region)} with core routes such as ${extractPlannedRouteNames(spec).slice(0, 4).join(" / ")}.`)
  return {
    displayName: deriveProjectHeadline(spec.prompt ?? spec.title, spec.region),
    shortDescription,
    archetypeLabel: isAdminOps
      ? spec.region === "cn"
        ? "内部管理与控制平面"
        : "Internal admin and control plane"
      : isSpecializedTask
        ? getDomainFlavorCategory(domainFlavor, spec.region)
      : getArchetypeCategoryLabel(archetype, spec.region),
    category: isAdminOps ? "admin_ops_internal_tool" : isSpecializedTask ? domainFlavor : archetype,
    icon,
  }
}

function sortPageDefinitionsByPlannedRoutes(pageDefinitions: ArchetypePageDefinition[], spec: AppSpec) {
  const plannedRoutes = extractPlannedRouteNames(spec)
  if (!plannedRoutes.length) return pageDefinitions
  const plannedOrder = new Map(plannedRoutes.map((route, index) => [route, index]))
  const originalOrder = new Map(pageDefinitions.map((page, index) => [page.route, index]))
  return [...pageDefinitions].sort((left, right) => {
    const leftRank = plannedOrder.has(left.route) ? plannedOrder.get(left.route)! : Number.MAX_SAFE_INTEGER
    const rightRank = plannedOrder.has(right.route) ? plannedOrder.get(right.route)! : Number.MAX_SAFE_INTEGER
    if (leftRank !== rightRank) return leftRank - rightRank
    return (originalOrder.get(left.route) ?? 0) - (originalOrder.get(right.route) ?? 0)
  })
}

function buildAppIntent(spec: AppSpec, intentSeed: ReturnType<typeof getArchetypeIntentSeed>, archetype: ScaffoldArchetype): AppIntent {
  const isAdminOps = isAdminOpsTaskSpec(spec)
  const domainFlavor = inferDomainFlavor(spec.prompt ?? spec.title)
  const isSpecializedTask = archetype === "task" && !isAdminOps && domainFlavor !== "general"
  const domainIntent = isSpecializedTask ? getDomainFlavorIntent(domainFlavor, spec.region) : null
  return {
    archetype: isAdminOps ? "admin_ops_internal_tool" : archetype,
    productCategory: isAdminOps
      ? spec.region === "cn"
        ? "内部管理与控制平面"
        : "Internal admin and control plane"
      : isSpecializedTask
        ? getDomainFlavorCategory(domainFlavor, spec.region)
      : getArchetypeCategoryLabel(archetype, spec.region),
    targetAudience: domainIntent?.targetAudience ?? intentSeed.targetAudience,
    primaryJobs: domainIntent?.primaryJobs ?? intentSeed.primaryJobs,
    primaryWorkflow: domainIntent?.primaryWorkflow ?? intentSeed.primaryWorkflow,
    integrationTargets: intentSeed.integrationTargets,
    automationScopes: domainIntent?.automationScopes ?? intentSeed.automationScopes,
    differentiationNotes: intentSeed.differentiationNotes,
  }
}

function buildBlueprintRouteNote(routeBlueprint: RouteBlueprint[], region: Region) {
  const routeLabels = routeBlueprint
    .slice(0, 4)
    .map((route) => {
      const routeKey = String(route.path || route.id || "")
        .replace(/^\/+/, "")
        .trim()
      return getGeneratedRouteLabel(routeKey, region === "cn")
    })
  if (!routeLabels.length) return null
  return region === "cn"
    ? `当前关键路由：${routeLabels.join(" / ")}`
    : `Current key routes: ${routeLabels.join(", ")}`
}

function buildBlueprintEntityNote(entityBlueprint: EntityBlueprint[], region: Region) {
  const entityLabels = entityBlueprint.slice(0, 4).map((entity) => entity.label)
  if (!entityLabels.length) return null
  return region === "cn"
    ? `核心数据对象：${entityLabels.join(" / ")}`
    : `Core data objects: ${entityLabels.join(", ")}`
}

function getPromptRoutePriority(spec: AppSpec, routeId: string) {
  const archetype = getScaffoldArchetype(spec)
  const text = String(spec.prompt ?? spec.title ?? "").toLowerCase()
  if (routeId === "dashboard") return 1000

  const score = (matched: boolean, weight: number) => (matched ? weight : 0)

  if (archetype === "crm") {
    return (
      score(/lead|leads|pipeline|deal|deals|客户线索|线索|商机/.test(text) && routeId === "leads", 150) +
      score(/pipeline|deal|deals|stage|阶段|商机/.test(text) && routeId === "pipeline", 145) +
      score(/order|orders|quote|quotes|billing|invoice|renewal|handoff|订单|报价|账单|发票|续约|交付/.test(text) && routeId === "orders", 155) +
      score(/quote approval|quote approvals|approval queue|payment sync|handoff|审批|报价审批|回款同步|交付/.test(text) && routeId === "orders", 8) +
      score(/report|reports|forecast|quota|health|renewal|报表|分析|预测|配额|健康度|续约/.test(text) && routeId === "reports", 152) +
      score(/customer|customers|account|accounts|客户|账户/.test(text) && routeId === "customers", 140) +
      score(/team|owner|quota|leaderboard|团队|负责人|配额|排行/.test(text) && routeId === "team", 135) +
      score(/account executive|account executives|seat|leaderboard|territory|团队目标|席位|领地/.test(text) && routeId === "team", 6) +
      score(/automation|automations|rule|rules|自动化|规则/.test(text) && routeId === "automations", 138)
    )
  }

  if (archetype === "community") {
    const eventDrivenCommunity = /event|events|meetup|webinar|registration|registrations|schedule|scheduling|session|sessions|ambassador|invite|segment|segments|活动|直播|聚会|报名|日程|议程|邀请|大使|分层/.test(
      text
    )
    return (
      score(/feedback|feedback intake|request|requests|反馈/.test(text) && routeId === "feedback", 150) +
      score(/moderation|moderate|report abuse|safety|审核|治理|举报|安全/.test(text) && routeId === "moderation", eventDrivenCommunity ? 146 : 154) +
      score(/queue|queues|policy|policies|trust|safety|队列|策略|信任与安全/.test(text) && routeId === "moderation", 8) +
      score(/roadmap|vote|wishlist|ambassador|路线图|投票|愿望单|大使/.test(text) && routeId === "roadmap", eventDrivenCommunity ? 144 : 152) +
      score(/member|members|segment|segments|invite|ambassador|成员|分层|邀请|大使/.test(text) && routeId === "members", eventDrivenCommunity ? 157 : 145) +
      score(/segment|segments|cohort|invite|cohorts|分层|分群|邀请/.test(text) && routeId === "members", eventDrivenCommunity ? 12 : 6) +
      score(/event|events|meetup|webinar|registration|registrations|schedule|scheduling|活动|直播|聚会|报名|日程|排期/.test(text) && routeId === "events", eventDrivenCommunity ? 168 : 158) +
      score(/registration|registrations|ambassador|invite|member segment|member segments|报名|大使|邀请|成员分层/.test(text) && routeId === "members", eventDrivenCommunity ? 14 : 10) +
      score(/post|posts|announcement|announcements|content|帖子|公告|内容/.test(text) && routeId === "posts", 140)
    )
  }

  if (archetype === "marketing_admin" || archetype === "content") {
    return (
      score(/website|site|story|marketing|brand|官网|站点|品牌/.test(text) && routeId === "website", 148) +
      score(/download|downloads|distribution|installer|apk|ipa|mac|windows|desktop|ios|android|下载|分发|安装/.test(text) && routeId === "download", 155) +
      score(/release distribution|distribution control|installer|desktop app|mobile app|发布分发|分发控制|安装包|桌面端|移动端/.test(text) && routeId === "download", 8) +
      score(/docs|documentation|guide|faq|release notes|文档|指南|faq|说明|发布说明/.test(text) && routeId === "docs", 150) +
      score(/onboarding|release notes|setup guide|developer guide|上手|发布说明|安装指南/.test(text) && routeId === "docs", 6) +
      score(/device|devices|ios|android|mac|windows|desktop|设备|安装包/.test(text) && routeId === "devices", 149) +
      score(/device builds|desktop and mobile|windows|mac|ios|android|设备构建|桌面和移动|安装包/.test(text) && routeId === "devices", 8) +
      score(/pricing|plan|plans|subscription|price|定价|套餐|价格/.test(text) && routeId === "pricing", 146) +
      score(/changelog|release|releases|version|versions|变更|版本|发布/.test(text) && routeId === "changelog", 144) +
      score(/admin|distribution control|backend|ops|后台|分发控制|后台管理/.test(text) && routeId === "admin", 143) +
      score(/admin distribution|release console|ops desk|后台分发|版本后台|分发后台/.test(text) && routeId === "admin", 7)
    )
  }

  if (archetype === "api_platform") {
    return (
      score(/endpoint|endpoints|api|apis|接口|端点/.test(text) && routeId === "endpoints", 150) +
      score(/log|logs|trace|observability|日志|追踪|观测/.test(text) && routeId === "logs", 146) +
      score(/auth|oauth|token|key|keys|scope|鉴权|令牌|密钥|权限/.test(text) && routeId === "auth", 149) +
      score(/environment|environments|release|deploy|发布|环境|部署/.test(text) && routeId === "environments", 145) +
      score(/webhook|webhooks|callback|callbacks|回调|订阅/.test(text) && routeId === "webhooks", 151) +
      score(/delivery|retry|subscription|event callback|交付|重试|订阅|事件回调/.test(text) && routeId === "webhooks", 6) +
      score(/docs|sdk|guide|reference|developer onboarding|文档|sdk|指南|参考|上手/.test(text) && routeId === "docs", 152) +
      score(/developer onboarding|sdk docs|reference|quickstart|上手|sdk 文档|参考|快速开始/.test(text) && routeId === "docs", 6) +
      score(/usage|metering|billing|rate limit|用量|计量|计费|限流/.test(text) && routeId === "usage", 150) +
      score(/billing visibility|quota|quota review|cost|计费可见性|配额|成本/.test(text) && routeId === "usage", 8)
    )
  }

  if (archetype === "code_platform") {
    return (
      score(/editor|code|file|files|tree|编辑器|代码|文件/.test(text) && routeId === "editor", 150) +
      score(/assistant|chat|copilot|agent|助手|对话|智能体/.test(text) && routeId === "assistant", 152) +
      score(/command palette|agentic|inline edit|visual edit|命令面板|行内改动|可视化编辑/.test(text) && routeId === "assistant", 7) +
      score(/run|runs|runtime|log|logs|运行|日志/.test(text) && routeId === "runs", 146) +
      score(/template|templates|starter|scaffold|模板|起始点|脚手架/.test(text) && routeId === "templates", 144) +
      score(/publish|release|deploy|delivery|发布|交付|上线/.test(text) && routeId === "publish", 148) +
      score(/handoff|share|production push|交接|分享|生产发布/.test(text) && routeId === "publish", 6) +
      score(/price|pricing|plan|plans|套餐|价格|定价/.test(text) && routeId === "pricing", 142)
    )
  }

  if (isAdminOpsTaskSpec(spec)) {
    return (
      score(/approval|approvals|signoff|审批|签批/.test(text) && routeId === "approvals", 154) +
      score(/queue|queues|backlog|审批队列|处理队列|积压/.test(text) && routeId === "approvals", 7) +
      score(/security|access|permission|role|policy|安全|权限|角色|策略/.test(text) && routeId === "security", 152) +
      score(/rbac|role-based|access review|policy sync|基于角色|访问审查|策略同步/.test(text) && routeId === "security", 7) +
      score(/audit|history|trace|compliance|审计|留痕|合规/.test(text) && routeId === "audit", 150) +
      score(/incident|incidents|alert|outage|告警|故障|异常|应急/.test(text) && routeId === "incidents", 149) +
      score(/incident response|triage|postmortem|应急响应|排障|复盘/.test(text) && routeId === "incidents", 7) +
      score(/team|seat|owner|member|workspace admin|团队|席位|负责人|成员/.test(text) && routeId === "team", 142) +
      score(/automation|automations|rule|rules|自动化|规则/.test(text) && routeId === "automations", 144) +
      score(/task|tasks|queue|queues|事项|队列|任务/.test(text) && routeId === "tasks", 146)
    )
  }

  return 0
}

function sortRouteBlueprintByPromptPriority(spec: AppSpec, routeBlueprint: RouteBlueprint[]) {
  const originalOrder = new Map(routeBlueprint.map((route, index) => [route.id, index]))
  return [...routeBlueprint].sort((left, right) => {
    const scoreDelta = getPromptRoutePriority(spec, right.id) - getPromptRoutePriority(spec, left.id)
    if (scoreDelta !== 0) return scoreDelta
    return (originalOrder.get(left.id) ?? 0) - (originalOrder.get(right.id) ?? 0)
  })
}

function buildBlueprintAwarePrimaryWorkflow(
  spec: AppSpec,
  appIntent: AppIntent,
  routeBlueprint: RouteBlueprint[],
  entityBlueprint: EntityBlueprint[]
) {
  const archetype = getScaffoldArchetype(spec)
  const isCn = spec.region === "cn"
  const routeIds = new Set(routeBlueprint.map((route) => route.id))
  const entityIds = new Set(entityBlueprint.map((entity) => entity.id))
  const isAdminOps = isAdminOpsTaskSpec(spec)

  if (archetype === "crm") {
    if (entityIds.has("sales_order") && routeIds.has("reports")) {
      return isCn ? "线索 -> 商机 -> 报价/订单 -> 交付" : "Lead -> opportunity -> quote/order -> handoff"
    }
    if (routeIds.has("reports")) {
      return isCn ? "线索 -> 商机 -> 汇报 -> 交付" : "Lead -> opportunity -> reporting -> handoff"
    }
  }

  if (archetype === "community") {
    if (
      /event planning|organize events|event registration|event reminders|events|活动策划|组织活动|活动报名|活动提醒|直播|聚会/.test(
        `${appIntent.primaryWorkflow} ${appIntent.primaryJobs.join(" ")} ${appIntent.automationScopes.join(" ")}`.toLowerCase()
      )
    ) {
      return isCn ? "活动策划 -> 邀请触达 -> 反馈归档 -> 社区运营" : "Event planning -> invite outreach -> feedback intake -> community ops"
    }
    if (entityIds.has("moderation_case") || routeIds.has("moderation")) {
      return isCn ? "发帖/反馈 -> 审核 -> 路线图 -> 成员运营" : "Post/feedback -> moderation -> roadmap -> member ops"
    }
    if (routeIds.has("roadmap")) {
      return isCn ? "反馈 -> 路线图 -> 公告 -> 成员运营" : "Feedback -> roadmap -> announcements -> member ops"
    }
  }

  if (archetype === "api_platform") {
    if (routeIds.has("docs") && routeIds.has("usage")) {
      return isCn ? "文档上手 -> 接口接入 -> 用量计量 -> 发布" : "Docs onboarding -> endpoint access -> usage metering -> release"
    }
    if (routeIds.has("webhooks") && routeIds.has("environments")) {
      return isCn ? "接口接入 -> 回调验证 -> 环境发布" : "Endpoint access -> webhook validation -> environment release"
    }
  }

  if (archetype === "marketing_admin" || archetype === "content") {
    if (entityIds.has("device_build")) {
      return isCn ? "官网浏览 -> 下载对比 -> 设备分发 -> 后台同步" : "Website browse -> download compare -> device distribution -> admin sync"
    }
    if (routeIds.has("download") && routeIds.has("docs")) {
      return isCn ? "官网浏览 -> 文档教育 -> 下载分发 -> 后台联动" : "Website browse -> docs education -> download distribution -> admin linkage"
    }
  }

  if (isAdminOps) {
    if (routeIds.has("approvals") && routeIds.has("security") && routeIds.has("audit")) {
      return isCn ? "审批 intake -> 策略调整 -> 审计留痕 -> 事件响应" : "Approval intake -> policy change -> audit trail -> incident response"
    }
  }

  if (archetype === "code_platform" && routeIds.has("assistant") && routeIds.has("publish")) {
    return isCn ? "生成 -> 改码 -> 预览 -> 发布" : "Generate -> edit -> preview -> publish"
  }

  return appIntent.primaryWorkflow
}

function finalizeAppIntentWithBlueprint(
  spec: AppSpec,
  appIntent: AppIntent,
  routeBlueprint: RouteBlueprint[],
  entityBlueprint: EntityBlueprint[]
) {
  const firstNote = appIntent.differentiationNotes[0]
  return {
    ...appIntent,
    primaryWorkflow: buildBlueprintAwarePrimaryWorkflow(spec, appIntent, routeBlueprint, entityBlueprint),
    differentiationNotes: uniqueStrings(
      [
        firstNote,
        buildBlueprintRouteNote(routeBlueprint, spec.region),
        buildBlueprintEntityNote(entityBlueprint, spec.region),
      ].filter((item): item is string => Boolean(item))
    ),
  }
}

function buildBlueprintsForSpec(spec: AppSpec) {
  const archetype = getScaffoldArchetype(spec)
  const categoryLabel = getSpecCategoryLabel(spec, archetype)
  const pageDefinitions = sortPageDefinitionsByPlannedRoutes(getArchetypePageDefinitions(spec), spec)
  const routes = pageDefinitions.length
    ? pageDefinitions.map((page) => page.route)
    : extractPlannedRouteNames(spec)
  const entities = getArchetypeEntityBlueprints(spec)
  const entityIds = new Set(entities.map((item) => item.id))
  const baseRouteBlueprint: RouteBlueprint[] = (archetype === "code_platform"
    ? getCodePlatformBlueprintRouteDefinitions(spec, entities)
    : pageDefinitions.length
    ? pageDefinitions.map((page) => ({
        id: toBlueprintId(page.route),
        path: page.route === "dashboard" ? "/dashboard" : page.route === "home" ? "/" : `/${page.route}`,
        label: page.label,
        purpose: page.summary,
        moduleIds: [],
        entityIds: getDefaultEntityIdsForRoute(page.route, archetype, entities),
        primaryActions: getRoutePrimaryActions(page.route, archetype, spec.region),
        surface: getRouteSurface(page.route, archetype),
        pagePrototype: getRoutePagePrototype(page.route, archetype),
      }))
    : routes.map((route) => ({
        id: toBlueprintId(route),
        path: route === "home" ? "/" : `/${route}`,
        label: getGeneratedRouteLabel(route, spec.region === "cn"),
        purpose:
          spec.region === "cn"
            ? `${getGeneratedRouteLabel(route, true)} 是 ${categoryLabel} 的关键入口。`
            : `${getGeneratedRouteLabel(route, false)} is a key surface in this ${categoryLabel}.`,
        moduleIds: [],
        entityIds: getDefaultEntityIdsForRoute(route, archetype, entities),
        primaryActions: getRoutePrimaryActions(route, archetype, spec.region),
        surface: getRouteSurface(route, archetype),
        pagePrototype: getRoutePagePrototype(route, archetype),
      }))) as RouteBlueprint[]

  const routeBlueprintSeedIds = new Set(baseRouteBlueprint.map((route) => route.id))
  const routeSurfaceModules: ModuleBlueprint[] = baseRouteBlueprint.map((route) => ({
    id: `${route.id}_surface`,
    label: spec.region === "cn" ? `${route.label} 工作区` : `${route.label} workspace`,
    summary:
      archetype === "code_platform"
        ? buildCodePlatformSurfaceSummary(pageDefinitions.find((page) => page.route === route.id), spec.region, route.label)
        : spec.region === "cn"
          ? `${route.label} 页面承接 ${route.purpose}`
          : `${route.label} is the workspace surface responsible for ${route.purpose.toLowerCase()}`,
    routeIds: [route.id],
    capabilityIds: route.primaryActions.slice(0, 3),
  }))

  const seededModules = getArchetypeModuleBlueprintSeeds(spec, baseRouteBlueprint)
  const reservedModuleIds = new Set([
    ...routeSurfaceModules.map((item) => item.id),
    ...seededModules.map((item) => item.id),
    ...baseRouteBlueprint.map((route) => route.id),
  ])
  const genericModuleTokens = new Set([
    "the",
    "and",
    "for",
    "with",
    "first",
    "quick",
    "dark",
    "light",
    "workspace",
    "surface",
    "system",
    "center",
    "centre",
    "rail",
    "flow",
    "workflow",
    "ops",
    "page",
    "control",
    "plane",
    "hub",
    "desk",
    "view",
    "entry",
  ])
  const tokenizeBlueprintText = (value: string) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
      .split(/\s+/)
      .filter((token) => token && !genericModuleTokens.has(token))
  const inferFallbackRouteIds = (moduleLabel: string) => {
    const text = String(moduleLabel ?? "").toLowerCase()
    const matches = new Set<string>()
    const push = (...routeIds: string[]) => {
      for (const routeId of routeIds) {
        if (routeBlueprintSeedIds.has(routeId)) {
          matches.add(routeId)
        }
      }
    }

    if (archetype === "api_platform") {
      if (/doc|sdk|guide|reference|onboard|developer/.test(text)) push("docs", "endpoints")
      if (/usage|meter|billing|bill|rate|quota/.test(text)) push("usage", "dashboard")
      if (/webhook|callback|event/.test(text)) push("webhooks", "logs")
      if (/auth|scope|key|security|policy|oauth/.test(text)) push("auth", "environments")
      if (/environment|deploy|release|version/.test(text)) push("environments", "dashboard")
      if (/log|trace|observ/.test(text)) push("logs", "dashboard")
      if (/endpoint|catalog/.test(text)) push("endpoints", "dashboard")
      if (/console|dashboard|platform/.test(text)) push("dashboard")
    } else if (archetype === "community") {
      if (/moderation|report|safety|policy|queue/.test(text)) push("moderation", "feedback", "settings")
      if (/roadmap|vote/.test(text)) push("roadmap", "feedback")
      if (/member|trust|segment|invite/.test(text)) push("members", "settings")
      if (/event|attendance|reminder|orchestration|program/.test(text)) push("events", "dashboard")
      if (/announcement|post|content|discussion/.test(text)) push("posts", "dashboard")
      if (/feedback|triage/.test(text)) push("feedback", "dashboard")
    } else if (archetype === "crm") {
      if (/lead|qualification/.test(text)) push("leads", "pipeline")
      if (/pipeline|stage|deal|opportunity/.test(text)) push("pipeline", "dashboard")
      if (/customer|account|handoff|renewal/.test(text)) push("customers", "dashboard")
      if (/automation|reminder/.test(text)) push("automations", "dashboard")
      if (/report|forecast|summary/.test(text)) push("reports", "dashboard")
      if (/order|quote|approval|payment/.test(text)) push("orders", "pipeline")
      if (/quota|owner|team|leaderboard|cadence/.test(text)) push("team", "reports")
    } else if (archetype === "marketing_admin" || archetype === "content") {
      if (/website|homepage|narrative|proof|story|hero/.test(text)) push("website", "dashboard")
      if (/download|distribution|asset|channel/.test(text)) push("download", "admin")
      if (/device|build|sign|installer|matrix/.test(text)) push("devices", "download")
      if (/doc|release|changelog|note|faq|guide/.test(text)) push("docs", "changelog", "admin")
      if (/pricing|plan|compare/.test(text)) push("pricing", "dashboard")
      if (/admin|console|ops|growth|control/.test(text)) push("admin", "dashboard")
    } else if (archetype === "task") {
      if (/approval/.test(text)) push("approvals", "tasks")
      if (/security|access|role|policy/.test(text)) push("security", "dashboard")
      if (/audit|trail|compliance/.test(text)) push("audit", "dashboard")
      if (/incident|alert|recovery/.test(text)) push("incidents", "dashboard")
      if (/team|seat|owner/.test(text)) push("team", "security")
      if (/automation|rule/.test(text)) push("automations", "tasks")
      if (/report|analytics|summary/.test(text)) push("reports", "dashboard")
      if (/task|queue|control/.test(text)) push("tasks", "dashboard")
    }

    if (matches.size) {
      return Array.from(matches)
    }

    const moduleTokens = tokenizeBlueprintText(moduleLabel)
    if (!moduleTokens.length) return []
    return baseRouteBlueprint
      .filter((route) => {
        const routeTokens = new Set([
          ...tokenizeBlueprintText(route.id),
          ...tokenizeBlueprintText(route.label),
          ...tokenizeBlueprintText(route.purpose),
          ...route.primaryActions.flatMap((action) => tokenizeBlueprintText(action)),
        ])
        return moduleTokens.some((token) => routeTokens.has(token))
      })
      .map((route) => route.id)
  }
  const buildFallbackSummary = (moduleLabel: string, linkedRoutes: RouteBlueprint[]) =>
    archetype === "code_platform"
      ? buildCodePlatformModuleSummary(
          {
            id: toBlueprintId(moduleLabel),
            label: moduleLabel,
            summary: "",
            routeIds: linkedRoutes.map((item) => item.id),
            capabilityIds: linkedRoutes.flatMap((item) => item.primaryActions).slice(0, 3),
          },
          spec.region
        )
      : spec.region === "cn"
        ? `${moduleLabel} 负责承接 ${linkedRoutes.map((item) => item.label).join(" / ")} 的关键动作。`
        : `${moduleLabel} powers ${linkedRoutes.map((item) => item.label).join(" / ")} workflows.`

  const allModuleLabels = uniqueStrings([
    ...spec.modules,
    ...pageDefinitions.flatMap((page) => page.focusAreas),
  ])
  const fallbackModules: ModuleBlueprint[] = allModuleLabels.slice(0, 24).map((moduleLabel) => {
    const moduleId = toBlueprintId(moduleLabel)
    if (reservedModuleIds.has(moduleId)) {
      return null
    }
    const linkedRouteIds = uniqueStrings(inferFallbackRouteIds(moduleLabel))
    const linkedRoutes = linkedRouteIds
      .map((routeId) => baseRouteBlueprint.find((route) => route.id === routeId))
      .filter(Boolean) as RouteBlueprint[]
    if (!linkedRoutes.length) {
      return null
    }
    return {
      id: moduleId,
      label: moduleLabel,
      summary: buildFallbackSummary(moduleLabel, linkedRoutes),
      routeIds: linkedRoutes.map((route) => route.id),
      capabilityIds: linkedRoutes[0]?.primaryActions.slice(0, 3) ?? [],
    }
  }).filter(Boolean) as ModuleBlueprint[]

  const moduleBlueprint = uniqueStrings([
    ...routeSurfaceModules.map((item) => item.id),
    ...seededModules.map((item) => item.id),
    ...fallbackModules.map((item) => item.id),
  ]).map((id) => {
    return (
      routeSurfaceModules.find((item) => item.id === id) ||
      seededModules.find((item) => item.id === id) ||
      fallbackModules.find((item) => item.id === id)
    )!
  })
  const boundModuleBlueprint = moduleBlueprint.map((module) => {
    const routeIds = new Set(module.routeIds ?? [])
    if (archetype === "crm" && module.id === "quote_approvals" && routeBlueprintSeedIds.has("orders")) {
      routeIds.add("orders")
    }
    if (archetype === "community" && routeBlueprintSeedIds.has("moderation")) {
      if (module.id === "moderation_queue" || module.id === "moderation_policy" || module.id === "moderation") {
        routeIds.add("moderation")
      }
    }
    return routeIds.size === (module.routeIds ?? []).length ? module : { ...module, routeIds: Array.from(routeIds) }
  })

  const routeBlueprint = baseRouteBlueprint.map((route) => {
    const linkedModuleIds = boundModuleBlueprint
      .filter((module) => module.routeIds.includes(route.id))
      .map((module) => module.id)
    return {
      ...route,
      moduleIds: linkedModuleIds.length ? linkedModuleIds : [`${route.id}_surface`],
      entityIds: route.entityIds.length ? route.entityIds : Array.from(entityIds).slice(0, 2),
    }
  })

  return {
    entityBlueprint: entities,
    routeBlueprint,
    moduleBlueprint: boundModuleBlueprint,
  }
}

function isGenericSeedItemSet(seedItems: SeedItem[] | undefined) {
  const titles = (seedItems ?? []).map((item) => item.title)
  if (!titles.length) return true
  return titles.some((title) =>
    [
      "Reach out to inbound lead",
      "Prepare demo deck",
      "Contract handoff",
      "Refine mobile layout",
      "设计移动端适配",
      "梳理自动化规则",
      "发布首轮演示版",
    ].includes(title)
  )
}

function isGenericTaskEntityBlueprintSet(entityBlueprint: EntityBlueprint[] | undefined) {
  const ids = (entityBlueprint ?? []).map((item) => item.id)
  if (!ids.length) return true
  return ids.every((id) => id === "task" || id === "approval")
}

function isGenericTaskModuleBlueprintSet(moduleBlueprint: ModuleBlueprint[] | undefined) {
  const ids = (moduleBlueprint ?? []).map((item) => item.id)
  if (!ids.length) return true
  return ids.includes("task_ops") || ids.every((id) => id.endsWith("_surface"))
}

function sanitizeModulesForArchetype(modules: string[], archetype: ScaffoldArchetype, region: Region, prompt?: string) {
  const normalizedModules = modules.filter((item) => {
    const text = String(item ?? "").trim()
    if (!text) return false
    if (/^[a-z0-9_-]+\s+page$/i.test(text)) return false
    if (/[^\s]+页面$/.test(text)) return false
    return true
  })
  if (archetype === "code_platform") {
    const blocked = new Set(region === "cn" ? ["官网与下载站", "销售后台"] : ["Website and downloads", "Sales admin"])
    return normalizedModules.filter((item) => !blocked.has(item))
  }
  if (archetype === "crm") {
    const blocked = new Set(
      region === "cn"
        ? ["浅色运营后台", "快捷操作", "项目总览", "多彩指标卡"]
        : ["Light ops admin", "Quick actions", "Project overview", "Colorful metrics"]
    )
    return normalizedModules.filter((item) => !blocked.has(item))
  }
  if (archetype === "api_platform") {
    const blocked = new Set(
      region === "cn"
        ? ["任务看板", "优先级管理", "负责人协同", "深色指挥台", "近期动态", "优先级分布", "数据概览"]
        : [
            "Task board",
            "Priority management",
            "Assignee collaboration",
            "Dark command center",
            "Recent activity",
            "Priority distribution",
            "Data overview",
          ]
    )
    return normalizedModules.filter((item) => !blocked.has(item))
  }
  if (archetype === "community") {
    const blocked = new Set(
      region === "cn"
        ? ["未来感英雄区", "功能亮点", "价格方案", "强视觉主屏"]
        : ["Futuristic hero", "Feature blocks", "Pricing plans", "Immersive surface"]
    )
    return normalizedModules.filter((item) => !blocked.has(item))
  }
  if (archetype === "marketing_admin") {
    const blocked = new Set(region === "cn" ? ["内容排期", "文章状态", "作者协作"] : ["Content planning", "Post status", "Author workflow"])
    return normalizedModules.filter((item) => !blocked.has(item))
  }
  if (archetype === "task") {
    const specializedModules = getSpecializedWorkspaceModules(String(prompt ?? ""), region, "core")
    const isSpecializedWorkspace = specializedModules.length > 0
    const blocked = new Set(
      region === "cn"
        ? [
            ...(isSpecializedWorkspace ? ["任务看板", "优先级管理", "负责人协同", "首版工作台", "快速录入", "状态流转"] : []),
            "首版销售驾驶舱",
            "线索快速录入",
            "成交状态流转",
            "浅色运营后台",
            "快捷操作",
            "项目总览",
            "多彩指标卡",
            "未来感英雄区",
            "功能亮点",
            "价格方案",
            "强视觉主屏",
            "反馈分流工作台",
            "成员信任分层",
            "公告与活动节奏",
          ]
        : [
            ...(isSpecializedWorkspace ? ["Task board", "Priority management", "Assignee collaboration", "First version workspace", "Quick create", "Status workflow"] : []),
            "First sales cockpit",
            "Quick lead capture",
            "Deal status workflow",
            "Light ops admin",
            "Quick actions",
            "Project overview",
            "Colorful metrics",
            "Futuristic hero",
            "Feature blocks",
            "Pricing plans",
            "Immersive surface",
            "Feedback triage workspace",
            "Member trust segments",
            "Announcement and event rhythm",
          ]
    )
    const cleaned = normalizedModules.filter((item) => !blocked.has(item))
    if (isSpecializedWorkspace && cleaned.length < specializedModules.length) {
      return uniqueStrings([...cleaned, ...specializedModules])
    }
    return cleaned
  }
  return normalizedModules
}

function isGenericPrimaryActionSet(actions: string[] | undefined) {
  if (!actions?.length) return true
  const joined = actions.map((item) => String(item ?? "").trim().toLowerCase()).join("|")
  return (
    joined === "view page|run action|continue generation" ||
    joined === "查看页面|执行主操作|继续生成" ||
    joined === "view surface|run primary action|continue iterating" ||
    joined === "查看页面|执行主操作|继续迭代"
  )
}

function isWeakModuleBlueprint(module: ModuleBlueprint | undefined) {
  if (!module) return true
  const summary = String(module.summary ?? "").trim()
  const label = String(module.label ?? "").trim()
  const routeIds = module.routeIds ?? []
  const hasGenericSummary =
    /supports the core workflow/i.test(summary) ||
    /负责支撑\s*主工作流/.test(summary) ||
    (!!label && new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} supports`, "i").test(summary))
  const hasGenericCapabilities = isGenericPrimaryActionSet(module.capabilityIds)
  const looksLikeRouteEcho = !routeIds.length ? false : routeIds.includes(module.id)
  return (!routeIds.length && (hasGenericSummary || hasGenericCapabilities)) || (looksLikeRouteEcho && hasGenericSummary)
}

function shouldRefreshRouteEntityIds(routeKey: string, archetype: ScaffoldArchetype, entityIds: string[] | undefined) {
  if (!entityIds?.length) return true
  if (archetype === "code_platform" && routeKey === "assistant") {
    return !entityIds.includes("assistant_thread") || !entityIds.includes("ai_session")
  }
  if (archetype === "code_platform" && routeKey === "publish") {
    return !entityIds.includes("release_deployment") || !entityIds.includes("runtime_run")
  }
  return false
}

function shouldRefreshRouteModuleIds(routeKey: string, archetype: ScaffoldArchetype, moduleIds: string[] | undefined) {
  if (!moduleIds?.length) return true
  if (archetype === "code_platform" && routeKey === "assistant") {
    return !moduleIds.includes("assistant_context")
  }
  if (archetype === "code_platform" && routeKey === "publish") {
    return !moduleIds.includes("publish_lane")
  }
  return false
}

function shouldRefreshModuleBlueprint(
  moduleId: string,
  archetype: ScaffoldArchetype,
  routeIds: string[] | undefined,
  capabilityIds: string[] | undefined
) {
  if (!routeIds?.length) return true
  if (archetype !== "code_platform") {
    return isGenericPrimaryActionSet(capabilityIds)
  }
  if (moduleId === "assistant_context") {
    return !routeIds.includes("assistant") || !routeIds.includes("editor")
  }
  if (moduleId === "publish_lane") {
    return !routeIds.includes("publish") || !routeIds.includes("runs")
  }
  if (moduleId === "ai_orchestrator") {
    return !routeIds.includes("assistant") || !capabilityIds?.includes("discuss")
  }
  if (moduleId === "release_control") {
    return !routeIds.includes("publish") || !capabilityIds?.includes("review builds")
  }
  return isGenericPrimaryActionSet(capabilityIds)
}

function getFinalCodePlatformModuleRouteIds(moduleId: string, routeIds: Set<string>) {
  const include = (ids: string[]) => ids.filter((item) => routeIds.has(item))
  switch (moduleId) {
    case "assistant_context":
      return include(["assistant", "editor"])
    case "publish_lane":
      return include(["publish", "runs", "dashboard"])
    case "ai_orchestrator":
      return include(["dashboard", "editor", "assistant", "runs"])
    case "release_control":
      return include(["runs", "publish", "settings", "dashboard"])
    default:
      return []
  }
}

function syncCodePlatformModuleBlueprintRoutes(modules: ModuleBlueprint[], routeIds: Set<string>) {
  return modules.map((module) => {
    const preferredRouteIds = getFinalCodePlatformModuleRouteIds(module.id, routeIds)
    return preferredRouteIds.length ? { ...module, routeIds: preferredRouteIds } : module
  })
}

function buildCodePlatformSurfaceSummary(
  page: ArchetypePageDefinition | undefined,
  region: Region,
  routeLabel: string
) {
  if (!page) {
    return region === "cn"
      ? `${routeLabel} 工作区承接当前工程上下文与关键操作。`
      : `${routeLabel} owns the current engineering context and primary actions.`
  }
  const focusSummary = page.focusAreas.slice(0, 4).join(region === "cn" ? " / " : " / ")
  return region === "cn"
    ? `${page.label} 工作区围绕 ${focusSummary} 组织当前工程上下文。`
    : `${page.label} organizes the current engineering context around ${focusSummary}.`
}

function buildCodePlatformModuleSummary(module: ModuleBlueprint, region: Region) {
  const routeLabels = module.routeIds.length
    ? module.routeIds.map((routeId) => getGeneratedRouteLabel(routeId, region === "cn")).join(region === "cn" ? " / " : " / ")
    : region === "cn"
      ? "当前工作区"
      : "the current workspace"
  const capabilitySummary = module.capabilityIds.slice(0, 3).join(region === "cn" ? " / " : " / ")
  const summaries: Record<string, { cn: string; en: string }> = {
    ai_command_center: {
      cn: "把 AI 线程、当前路由和工程状态收进同一条指挥轨道。",
      en: "Brings AI threads, active routes, and engineering status into one command rail.",
    },
    runs_and_logs: {
      cn: "承接构建验收、运行日志和恢复检查。",
      en: "Owns build acceptance, runtime logs, and recovery checks.",
    },
    template_workshop: {
      cn: "管理模板、脚手架变体和推荐起始点。",
      en: "Manages templates, scaffold variants, and recommended starters.",
    },
    ai_chat_lane: {
      cn: "把 Discuss / Generate / Fix / Refactor 绑到当前页面和文件上下文。",
      en: "Binds Discuss / Generate / Fix / Refactor to the current page and file context.",
    },
    share_and_publish: {
      cn: "连接预览验收、分享链接和发布确认。",
      en: "Connects preview acceptance, share links, and release confirmation.",
    },
    ai_coding_panel: {
      cn: "把代码编辑、预览、运行和 AI 修改汇到同一工程工作区。",
      en: "Unifies editing, preview, runtime, and AI edits in one engineering workspace.",
    },
    project_file_tree: {
      cn: "维护文件树、相关路径和多标签切换。",
      en: "Tracks the file tree, related paths, and multi-tab navigation.",
    },
  }
  const exact = summaries[module.id]
  if (exact) return region === "cn" ? exact.cn : exact.en
  return region === "cn"
    ? `${module.label} 负责串联 ${routeLabels}，重点动作包括 ${capabilitySummary || "当前工程操作"}。`
    : `${module.label} connects ${routeLabels}, with primary actions such as ${capabilitySummary || "the current engineering workflow"}.`
}

function getCodePlatformBlueprintRouteDefinitions(spec: AppSpec, entities: EntityBlueprint[]) {
  const isCn = spec.region === "cn"
  const pageDefinitions = getArchetypePageDefinitions(spec)
  const pageDefinitionMap = new Map(pageDefinitions.map((page) => [page.route, page]))
  const routeIds = Array.from(new Set(extractPlannedRouteNames(spec)))
  const defaults: Record<
    string,
    {
      label: string
      purpose: string
      primaryActions: string[]
      surface: RouteBlueprint["surface"]
    }
  > = isCn
    ? {
        dashboard: {
          label: "Dashboard",
          purpose: "这页应该像代码平台的控制平面，而不是普通概览卡片页。",
          primaryActions: ["查看状态", "检查运行", "切换模块"],
          surface: "dashboard",
        },
        editor: {
          label: "Editor",
          purpose: "这页是代码平台的主工作区，不该退化成静态代码展示。",
          primaryActions: ["打开文件", "编辑代码", "切换标签", "运行预览"],
          surface: "code",
        },
        runs: {
          label: "Runs",
          purpose: "这页体现代码平台的运行与验收能力，不只是日志列表。",
          primaryActions: ["查看日志", "刷新状态", "检查构建"],
          surface: "dashboard",
        },
        templates: {
          label: "Templates",
          purpose: "这页承接生成起点与路线差异。",
          primaryActions: ["筛选模板", "切换模板", "按模板生成"],
          surface: "dashboard",
        },
        assistant: {
          label: "Assistant",
          purpose: "这页体现 discuss / generate / fix / refactor 的真实工作流。",
          primaryActions: ["继续对话", "应用修改", "查看上下文"],
          surface: "code",
        },
        publish: {
          label: "Publish",
          purpose: "这页是代码平台的发布控制面，不是普通分享卡片。",
          primaryActions: ["检查发布", "确认预览", "提升通道"],
          surface: "dashboard",
        },
        settings: {
          label: "Settings",
          purpose: "这页承接配置与访问控制，而不是普通表单集合。",
          primaryActions: ["修改配置", "检查权限", "管理环境"],
          surface: "settings",
        },
        pricing: {
          label: "Pricing",
          purpose: "这页承接套餐差异，不只是价格卡片。",
          primaryActions: ["查看套餐", "比较权限", "升级套餐"],
          surface: "dashboard",
        },
      }
    : {
        dashboard: {
          label: "Dashboard",
          purpose: "This should feel like the control plane of an AI code platform, not a generic overview grid.",
          primaryActions: ["review status", "inspect runtime", "switch modules"],
          surface: "dashboard",
        },
        editor: {
          label: "Editor",
          purpose: "This is the primary workspace of the code product, not a static code dump.",
          primaryActions: ["open file", "edit code", "switch tabs", "run preview"],
          surface: "code",
        },
        runs: {
          label: "Runs",
          purpose: "This route expresses runtime acceptance, not just a log table.",
          primaryActions: ["inspect logs", "refresh status", "check build"],
          surface: "dashboard",
        },
        templates: {
          label: "Templates",
          purpose: "This route carries starting points and generation variants.",
          primaryActions: ["filter templates", "switch template", "generate from template"],
          surface: "dashboard",
        },
        assistant: {
          label: "Assistant",
          purpose: "This route expresses Discuss / Generate / Fix / Refactor as a real product workflow.",
          primaryActions: ["continue thread", "apply change", "inspect context"],
          surface: "code",
        },
        publish: {
          label: "Publish",
          purpose: "This route is the release control surface of the code product, not a generic share card.",
          primaryActions: ["review release", "verify preview", "promote channel"],
          surface: "dashboard",
        },
        settings: {
          label: "Settings",
          purpose: "This route carries configuration and governance, not a random form stack.",
          primaryActions: ["update config", "check access", "manage environments"],
          surface: "settings",
        },
        pricing: {
          label: "Pricing",
          purpose: "This route should explain plan entitlements, not just show price cards.",
          primaryActions: ["review plans", "compare permissions", "upgrade"],
          surface: "dashboard",
        },
      }

  return routeIds
    .map((routeId) => {
      const page = pageDefinitionMap.get(routeId)
      const fallback = defaults[routeId]
      if (!page && !fallback) return null
      return {
        id: routeId,
        path: routeId === "home" ? "/" : `/${routeId}`,
        label: page?.label ?? fallback?.label ?? getGeneratedRouteLabel(routeId, isCn),
        purpose: page?.summary ?? fallback?.purpose ?? (isCn ? `${routeId} 页面承接代码平台关键工作流。` : `${routeId} carries a key code-platform workflow.`),
        moduleIds: [],
        entityIds: getDefaultEntityIdsForRoute(routeId, "code_platform", entities),
        primaryActions: page ? getRoutePrimaryActions(routeId, "code_platform", spec.region) : fallback?.primaryActions ?? getRoutePrimaryActions(routeId, "code_platform", spec.region),
        surface: fallback?.surface ?? getRouteSurface(routeId, "code_platform"),
        pagePrototype: getRoutePagePrototype(routeId, "code_platform"),
      } satisfies RouteBlueprint
    })
    .filter((route): route is RouteBlueprint => Boolean(route))
}

function finalizeCodePlatformBlueprintNarrative(
  spec: AppSpec,
  routeBlueprint: RouteBlueprint[],
  moduleBlueprint: ModuleBlueprint[]
) {
  const entityBlueprint = getArchetypeEntityBlueprints(spec)
  const routeDefinitionMap = new Map(
    getCodePlatformBlueprintRouteDefinitions(spec, entityBlueprint).map((route) => [route.id, route])
  )
  const pageDefinitions = getArchetypePageDefinitions(spec)
  const pageDefinitionMap = new Map(pageDefinitions.map((page) => [page.route, page]))
  const resolvedRouteBlueprint = routeBlueprint.map((route) => {
    const routeKey = String(route.id || route.path || "")
      .replace(/^\/+/, "")
      .trim()
    const routeDefinition = routeDefinitionMap.get(routeKey)
    const page = pageDefinitionMap.get(routeKey)
    return routeDefinition || page
      ? {
          ...route,
          label: routeDefinition?.label ?? page?.label ?? route.label,
          purpose: routeDefinition?.purpose ?? page?.summary ?? route.purpose,
          primaryActions: routeDefinition?.primaryActions?.length ? routeDefinition.primaryActions : route.primaryActions,
          surface: routeDefinition?.surface ?? route.surface,
          pagePrototype: routeDefinition?.pagePrototype ?? route.pagePrototype,
          entityIds: route.entityIds?.length ? route.entityIds : routeDefinition?.entityIds ?? route.entityIds,
        }
      : route
  })
  const routeLabelMap = new Map(resolvedRouteBlueprint.map((route) => [route.id, route.label]))
  const resolvedModuleBlueprint = moduleBlueprint.map((module) => {
    if (module.id.endsWith("_surface")) {
      const primaryRouteId = module.routeIds[0]
      const page = primaryRouteId ? pageDefinitionMap.get(primaryRouteId) : undefined
      const routeLabel = routeLabelMap.get(primaryRouteId) || module.label.replace(/\s+workspace$/i, "")
      return {
        ...module,
        label: routeLabel ? `${routeLabel} workspace` : module.label,
        summary: buildCodePlatformSurfaceSummary(page, spec.region, routeLabel || module.label),
      }
    }
    return {
      ...module,
      summary: buildCodePlatformModuleSummary(module, spec.region),
    }
  })
  return {
    routeBlueprint: resolvedRouteBlueprint,
    moduleBlueprint: resolvedModuleBlueprint,
  }
}

export function refreshCodePlatformBlueprintNarrative(spec: AppSpec): AppSpec {
  if (getScaffoldArchetype(spec) !== "code_platform" || !spec.routeBlueprint?.length || !spec.moduleBlueprint?.length) {
    return spec
  }
  const resolved = finalizeCodePlatformBlueprintNarrative(spec, spec.routeBlueprint, spec.moduleBlueprint)
  return {
    ...spec,
    routeBlueprint: resolved.routeBlueprint,
    moduleBlueprint: resolved.moduleBlueprint,
  }
}

export function finalizeAppSpec(spec: AppSpec): AppSpec {
  const archetype = getScaffoldArchetype(spec)
  const isAdminOps = isAdminOpsTaskSpec(spec)
  const visualSeed = shouldRefreshVisualSeed(spec, spec.visualSeed, archetype) ? inferVisualSeed(spec) : (spec.visualSeed ?? inferVisualSeed(spec))
  const normalizedModules = sanitizeModulesForArchetype(spec.modules, archetype, spec.region, spec.prompt)
  const normalizedSeedItems =
    isGenericSeedItemSet(spec.seedItems) && ["api_platform", "community", "marketing_admin"].includes(archetype)
      ? getSeedItems(spec.kind, spec.region, spec.features, spec.planTier, archetype)
      : spec.seedItems
  const appIdentity = shouldRefreshAppIdentity(spec, spec.appIdentity, archetype)
    ? buildAppIdentity({ ...spec, modules: normalizedModules, seedItems: normalizedSeedItems, visualSeed })
    : spec.appIdentity ?? buildAppIdentity({ ...spec, modules: normalizedModules, seedItems: normalizedSeedItems, visualSeed })
  const capabilityFlags = spec.capabilityFlags ?? buildCapabilityFlags(spec)
  const blueprintBundle = buildBlueprintsForSpec({ ...spec, modules: normalizedModules, seedItems: normalizedSeedItems, visualSeed, appIdentity, capabilityFlags })
  const intentSeed = getArchetypeIntentSeed(archetype, spec.region, spec.prompt, spec.title)
  const availableModuleIds = new Set(blueprintBundle.moduleBlueprint.map((item) => item.id))
  const availableEntityIds = new Set(blueprintBundle.entityBlueprint.map((item) => item.id))
  const shouldRefreshAdminBlueprint =
    archetype === "task" &&
    shouldPreferAdminOpsOverCrm(String(spec.prompt ?? spec.title ?? "").toLowerCase()) &&
    (isGenericTaskEntityBlueprintSet(spec.entityBlueprint) || isGenericTaskModuleBlueprintSet(spec.moduleBlueprint))
  const shouldRefreshCommunityBlueprint =
    archetype === "community" &&
    /event|events|meetup|webinar|registration|registrations|session|sessions|agenda|ambassador|invite|segment|segments|活动|直播|聚会|报名|议程|大使|邀请|分层/.test(
      String(spec.prompt ?? spec.title ?? "").toLowerCase()
    ) &&
    (!spec.routeBlueprint?.some((route) => route.id === "events") || !spec.routeBlueprint?.some((route) => route.id === "members"))
  const shouldRefreshCodePlatformBlueprint =
    archetype === "code_platform" &&
    Boolean(
      spec.routeBlueprint?.some((route) => /key surface in this ai code platform/i.test(String(route.purpose ?? ""))) ||
        spec.moduleBlueprint?.some(
          (module) =>
            /workspace surface responsible for .*key surface in this ai code platform/i.test(String(module.summary ?? "")) ||
            /workspace surface responsible for .*ai code platform/i.test(String(module.summary ?? ""))
        )
    )
  const resolvedRouteBlueprint =
    !shouldRefreshAdminBlueprint && !shouldRefreshCommunityBlueprint && !shouldRefreshCodePlatformBlueprint && spec.routeBlueprint?.length
      ? sortRouteBlueprintByPromptPriority(
          spec,
          uniqueStrings([
            ...spec.routeBlueprint.map((route) => route.id),
            ...blueprintBundle.routeBlueprint.map((route) => route.id),
          ])
            .map((routeId) => {
              const route = spec.routeBlueprint?.find((item) => item.id === routeId)
              const fallback =
                blueprintBundle.routeBlueprint.find((item) => item.id === routeId) ||
                blueprintBundle.routeBlueprint.find((item) => item.path === route?.path)
              if (!route && fallback) {
                return fallback
              }
              if (!route) {
                return null
              }
              const routeKey = String(route.id || route.path || "")
                .replace(/^\/+/, "")
                .trim()
              const fallbackModuleIds = blueprintBundle.moduleBlueprint
                .filter((item) => item.routeIds.includes(route.id))
                .map((item) => item.id)
              const fallbackEntityIds = getDefaultEntityIdsForRoute(routeKey, archetype, blueprintBundle.entityBlueprint)
              const fallbackSurface = getRouteSurface(routeKey, archetype)
              const validModuleIds = (route.moduleIds ?? []).filter((item) => availableModuleIds.has(item))
              const validEntityIds = (route.entityIds ?? []).filter((item) => availableEntityIds.has(item))
              const shouldRefreshModules = shouldRefreshRouteModuleIds(routeKey, archetype, validModuleIds)
              const shouldRefreshEntities = shouldRefreshRouteEntityIds(routeKey, archetype, validEntityIds)
              const looksGenericPurpose =
                /core surface in .*used to support/i.test(route.purpose || "") ||
                /key surface in this/i.test(route.purpose || "")
              const shouldRefreshSurface =
                !route.surface ||
                ((route.id === "docs" || route.id === "usage") && archetype === "api_platform" && route.surface === "marketing")
              const preferredActions =
                !isGenericPrimaryActionSet(route.primaryActions) && route.primaryActions?.length
                  ? route.primaryActions
                  : fallback?.primaryActions?.length
                    ? fallback.primaryActions
                    : getRoutePrimaryActions(routeKey, archetype, spec.region)
              return {
                ...fallback,
                ...route,
                purpose: route.purpose && !looksGenericPurpose ? route.purpose : fallback?.purpose ?? route.purpose,
                moduleIds:
                  validModuleIds.length && !shouldRefreshModules
                    ? validModuleIds
                    : fallback?.moduleIds?.length
                      ? fallback.moduleIds
                      : fallbackModuleIds,
                entityIds:
                  validEntityIds.length && !shouldRefreshEntities
                    ? validEntityIds
                    : fallback?.entityIds?.length
                      ? fallback.entityIds
                      : fallbackEntityIds,
                primaryActions: preferredActions,
                surface: shouldRefreshSurface
                  ? fallback?.surface || fallbackSurface
                  : route.surface || fallback?.surface || fallbackSurface,
              }
            })
            .filter((route): route is RouteBlueprint => Boolean(route))
        )
      : sortRouteBlueprintByPromptPriority(spec, blueprintBundle.routeBlueprint)
  const resolvedRouteIds = new Set(resolvedRouteBlueprint.map((route) => route.id))
  const resolvedModuleBlueprint =
    !shouldRefreshAdminBlueprint && !shouldRefreshCommunityBlueprint && !shouldRefreshCodePlatformBlueprint && spec.moduleBlueprint?.length
      ? syncCodePlatformModuleBlueprintRoutes(
          uniqueStrings([
            ...spec.moduleBlueprint.map((module) => module.id),
            ...blueprintBundle.moduleBlueprint.map((module) => module.id),
          ])
            .map((moduleId) => {
              const module = spec.moduleBlueprint?.find((item) => item.id === moduleId)
              const fallback = blueprintBundle.moduleBlueprint.find((item) => item.id === moduleId)
              const shouldRefreshModule =
                shouldRefreshModuleBlueprint(moduleId, archetype, module?.routeIds, module?.capabilityIds) && Boolean(fallback)
              const preferredCodePlatformRouteIds =
                archetype === "code_platform" ? getFinalCodePlatformModuleRouteIds(moduleId, resolvedRouteIds) : []
              const merged = {
                ...fallback,
                ...module,
                routeIds:
                  preferredCodePlatformRouteIds.length
                    ? preferredCodePlatformRouteIds
                    : module?.routeIds?.length && !shouldRefreshModule
                      ? module.routeIds
                      : fallback?.routeIds ?? module?.routeIds ?? [],
                capabilityIds:
                  module?.capabilityIds?.length && !shouldRefreshModule
                    ? module.capabilityIds
                    : fallback?.capabilityIds ?? module?.capabilityIds ?? [],
                summary:
                  module?.summary && !isWeakModuleBlueprint(module) && !shouldRefreshModule
                    ? module.summary
                    : fallback?.summary ?? module?.summary ?? "",
              } satisfies ModuleBlueprint
              if (!fallback && isWeakModuleBlueprint(merged)) {
                return null
              }
              return merged
            })
            .filter((module): module is ModuleBlueprint => Boolean(module)),
          resolvedRouteIds
        )
      : archetype === "code_platform"
        ? syncCodePlatformModuleBlueprintRoutes(blueprintBundle.moduleBlueprint, resolvedRouteIds)
        : blueprintBundle.moduleBlueprint
  const finalizedCodePlatformNarrative =
    archetype === "code_platform"
      ? finalizeCodePlatformBlueprintNarrative(spec, resolvedRouteBlueprint, resolvedModuleBlueprint)
      : null
  const finalRouteBlueprint = finalizedCodePlatformNarrative?.routeBlueprint ?? resolvedRouteBlueprint
  const resolvedEntityBlueprint =
    !shouldRefreshAdminBlueprint && !shouldRefreshCommunityBlueprint && spec.entityBlueprint?.length
      ? spec.entityBlueprint.map((entity) => {
          const fallback = blueprintBundle.entityBlueprint.find((item) => item.id === entity.id)
          return {
            ...fallback,
            ...entity,
            fields: entity.fields?.length ? entity.fields : fallback?.fields ?? [],
            primaryViews: entity.primaryViews?.length ? entity.primaryViews : fallback?.primaryViews ?? [],
            workflows: entity.workflows?.length ? entity.workflows : fallback?.workflows ?? [],
          }
        })
      : blueprintBundle.entityBlueprint
  const nextAppIntent = finalizeAppIntentWithBlueprint(
    spec,
    buildAppIntent(spec, intentSeed, archetype),
    finalRouteBlueprint,
    resolvedEntityBlueprint
  )

  return {
    ...spec,
    modules: normalizedModules,
    seedItems: normalizedSeedItems,
    visualSeed,
    appIdentity,
    capabilityFlags,
    appIntent: nextAppIntent,
    routeBlueprint: finalRouteBlueprint,
    moduleBlueprint: finalizedCodePlatformNarrative?.moduleBlueprint ?? resolvedModuleBlueprint,
    entityBlueprint: resolvedEntityBlueprint,
  }
}

function getSeedItems(kind: AppKind, region: Region, features: SpecFeature[], planTier: PlanTier, archetype?: ScaffoldArchetype): SeedItem[] {
  const blockedEnabled = features.includes("blocked_status")
  const extraCount = planTier === "elite" ? 3 : planTier === "pro" ? 2 : planTier === "builder" ? 1 : 0
  if (archetype === "api_platform") {
    const items: SeedItem[] = region === "cn"
      ? [
          { title: "核对生产环境接口目录", description: "确认公开与内部接口的分层", assignee: "张伟", priority: "high", status: "todo" },
          { title: "排查最新异常日志", description: "聚焦 500 错误与 webhook 重试", assignee: "王芳", priority: "high", status: "in_progress" },
          { title: "轮换测试密钥", description: blockedEnabled ? "等待安全窗口开放" : "同步沙盒与正式环境", assignee: "陈晨", priority: "medium", status: blockedEnabled ? "blocked" : "done" },
          { title: "补充环境发布说明", description: "把 staging 到 production 的差异写清楚", assignee: "赵敏", priority: "medium", status: "todo" },
          { title: "整理 webhook 回放", description: "确认失败事件的恢复策略", assignee: "刘洋", priority: "medium", status: "in_progress" },
          { title: "更新 API 使用文档", description: "补充认证、限流和错误码", assignee: "李雷", priority: "low", status: "done" },
        ] satisfies SeedItem[]
      : [
          { title: "Review production endpoint catalog", description: "Confirm public versus internal API boundaries", assignee: "Liam", priority: "high", status: "todo" },
          { title: "Triage latest runtime errors", description: "Focus on 500s and webhook retries", assignee: "Emma", priority: "high", status: "in_progress" },
          { title: "Rotate test credentials", description: blockedEnabled ? "Waiting on the approved security window" : "Sync sandbox and production keys", assignee: "Mason", priority: "medium", status: blockedEnabled ? "blocked" : "done" },
          { title: "Document environment promotion", description: "Clarify staging-to-production checks", assignee: "Sophia", priority: "medium", status: "todo" },
          { title: "Replay failed webhooks", description: "Validate recovery behavior across retries", assignee: "Noah", priority: "medium", status: "in_progress" },
          { title: "Refresh API usage docs", description: "Add auth, rate limit, and error-code details", assignee: "Olivia", priority: "low", status: "done" },
        ] satisfies SeedItem[]
    return items.slice(0, 3 + extraCount + 1)
  }
  if (archetype === "community") {
    const items: SeedItem[] = region === "cn"
      ? [
          { title: "整理本周高频反馈", description: "把功能建议归类到路线图", assignee: "张伟", priority: "high", status: "todo" },
          { title: "确认活动报名名单", description: "检查成员分层与提醒状态", assignee: "王芳", priority: "high", status: "in_progress" },
          { title: "审核敏感内容队列", description: blockedEnabled ? "等待管理员复核" : "完成自动审核规则调优", assignee: "陈晨", priority: "medium", status: blockedEnabled ? "blocked" : "done" },
          { title: "更新社区公告", description: "同步本月路线图与活动安排", assignee: "赵敏", priority: "medium", status: "todo" },
          { title: "处理成员标签迁移", description: "确认新成员欢迎流是否生效", assignee: "刘洋", priority: "medium", status: "in_progress" },
          { title: "复盘反馈转路线图链路", description: "看哪些需求需要进入下一版本", assignee: "李雷", priority: "low", status: "done" },
        ] satisfies SeedItem[]
      : [
          { title: "Review this week's top feedback", description: "Sort high-signal requests into the roadmap", assignee: "Liam", priority: "high", status: "todo" },
          { title: "Confirm the next event roster", description: "Check member segments and reminder status", assignee: "Emma", priority: "high", status: "in_progress" },
          { title: "Moderate the flagged queue", description: blockedEnabled ? "Waiting on admin review" : "Tune the auto-moderation rules", assignee: "Mason", priority: "medium", status: blockedEnabled ? "blocked" : "done" },
          { title: "Publish the latest community update", description: "Sync roadmap and event messaging", assignee: "Sophia", priority: "medium", status: "todo" },
          { title: "Refresh member segments", description: "Validate the welcome and retention flow", assignee: "Noah", priority: "medium", status: "in_progress" },
          { title: "Close the roadmap feedback loop", description: "Decide what moves into the next release", assignee: "Olivia", priority: "low", status: "done" },
        ] satisfies SeedItem[]
    return items.slice(0, 3 + extraCount + 1)
  }
  if (archetype === "marketing_admin") {
    const items: SeedItem[] = region === "cn"
      ? [
          { title: "更新首页转化叙事", description: "突出下载入口和核心价值", assignee: "张伟", priority: "high", status: "todo" },
          { title: "检查下载分发链路", description: "确认各端包体与按钮都可用", assignee: "王芳", priority: "high", status: "in_progress" },
          { title: "发布本周更新日志", description: blockedEnabled ? "等待版本说明确认" : "同步 changelog 与文档中心", assignee: "陈晨", priority: "medium", status: blockedEnabled ? "blocked" : "done" },
          { title: "整理定价与权限对比", description: "让各套餐升级路径更清晰", assignee: "赵敏", priority: "medium", status: "todo" },
          { title: "核对官网后台分发数据", description: "确认下载统计与渠道状态", assignee: "刘洋", priority: "medium", status: "in_progress" },
          { title: "补齐设备安装说明", description: "覆盖桌面端与移动端入口", assignee: "李雷", priority: "low", status: "done" },
        ] satisfies SeedItem[]
      : [
          { title: "Refresh the homepage conversion story", description: "Highlight downloads and product value", assignee: "Liam", priority: "high", status: "todo" },
          { title: "Check download distribution links", description: "Validate packages and CTA routing across devices", assignee: "Emma", priority: "high", status: "in_progress" },
          { title: "Publish this week's changelog", description: blockedEnabled ? "Waiting on release-note signoff" : "Sync the changelog and docs center", assignee: "Mason", priority: "medium", status: blockedEnabled ? "blocked" : "done" },
          { title: "Tighten pricing comparisons", description: "Make the upgrade path and entitlement tiers clearer", assignee: "Sophia", priority: "medium", status: "todo" },
          { title: "Verify admin distribution status", description: "Review channel analytics and package health", assignee: "Noah", priority: "medium", status: "in_progress" },
          { title: "Finish device install guides", description: "Cover desktop and mobile distribution entry points", assignee: "Olivia", priority: "low", status: "done" },
        ] satisfies SeedItem[]
    return items.slice(0, 3 + extraCount + 1)
  }
  if (kind === "code_platform") {
    const items: SeedItem[] = region === "cn"
      ? [
          { title: "补齐文件树和工作区布局", description: "对齐左侧导航、编辑区和 AI 助手栏", assignee: "张伟", priority: "high", status: "todo" },
          { title: "强化代码编辑器体验", description: "加入标签栏、状态栏和运行反馈", assignee: "王芳", priority: "high", status: "in_progress" },
          { title: "接入 AI 编程指令面板", description: blockedEnabled ? "等待模型策略确认" : "完善解释、修复和生成模式", assignee: "陈晨", priority: "medium", status: blockedEnabled ? "blocked" : "done" },
          { title: "增加模板和示例项目入口", description: "支持 morncursor、后台、官网等场景切换", assignee: "赵敏", priority: "medium", status: "todo" },
          { title: "完善运行与预览链路", description: "展示 dev server、构建和日志结果", assignee: "刘洋", priority: "medium", status: "in_progress" },
          { title: "打磨收费与权限体系", description: "让免费、专业、精英的输出差异更明显", assignee: "李雷", priority: "low", status: "done" },
        ] satisfies SeedItem[]
      : [
          { title: "Refine file tree and workspace shell", description: "Align navigation, editor surface, and AI side panel", assignee: "Liam", priority: "high", status: "todo" },
          { title: "Upgrade editor interactions", description: "Add tabs, status bar, and run feedback", assignee: "Emma", priority: "high", status: "in_progress" },
          { title: "Ship AI coding control panel", description: blockedEnabled ? "Waiting on model policy review" : "Polish explain, fix, and generate actions", assignee: "Mason", priority: "medium", status: blockedEnabled ? "blocked" : "done" },
          { title: "Add templates and sample projects", description: "Support morncursor, dashboards, and landing pages", assignee: "Sophia", priority: "medium", status: "todo" },
          { title: "Improve run and preview pipeline", description: "Surface dev server, builds, and logs", assignee: "Noah", priority: "medium", status: "in_progress" },
          { title: "Tighten tiered product access", description: "Make free, pro, and elite outputs visibly different", assignee: "Olivia", priority: "low", status: "done" },
        ] satisfies SeedItem[]
    return items.slice(0, 3 + extraCount + 1)
  }
  if (kind === "crm") {
    if (region === "cn") {
      const items = [
        { title: "星云科技年度合同", description: "安排演示与预算确认", assignee: "张伟", priority: "high", status: "todo" },
        { title: "远航数据扩容线索", description: "整理需求与报价", assignee: "王芳", priority: "medium", status: "in_progress" },
        {
          title: "华岳软件采购跟进",
          description: blockedEnabled ? "等待法务盖章" : "准备成交材料",
          assignee: "李雷",
          priority: "medium",
          status: blockedEnabled ? "blocked" : "done",
        },
        { title: "浩川制造复购机会", description: "补充付款节奏与预算窗口", assignee: "赵敏", priority: "high", status: "todo" },
        { title: "合一供应链试点", description: "对齐对接人和试点范围", assignee: "陈晨", priority: "medium", status: "in_progress" },
        { title: "景曜智能续约", description: "确认扩容席位与采购周期", assignee: "刘洋", priority: "low", status: "done" },
      ] satisfies SeedItem[]
      return items.slice(0, 3 + extraCount + 1)
    }
    const items = [
      { title: "Aster Labs renewal", description: "Book the stakeholder demo", assignee: "Liam", priority: "high", status: "todo" },
      { title: "Nimbus expansion", description: "Finalize pricing proposal", assignee: "Emma", priority: "medium", status: "in_progress" },
      {
        title: "Vivid Tech procurement",
        description: blockedEnabled ? "Waiting on legal approval" : "Ready for close plan",
        assignee: "Noah",
        priority: "medium",
        status: blockedEnabled ? "blocked" : "done",
      },
      { title: "Northstar pilot account", description: "Map rollout scope and champion team", assignee: "Sophia", priority: "high", status: "todo" },
      { title: "Horizon logistics follow-up", description: "Review regional procurement workflow", assignee: "Mason", priority: "medium", status: "in_progress" },
      { title: "Bluepeak upsell", description: "Confirm add-on budget and success metrics", assignee: "Olivia", priority: "low", status: "done" },
    ] satisfies SeedItem[]
    return items.slice(0, 3 + extraCount + 1)
  }
  const base: SeedItem[] = [
    ...(getRegionDefaults(region).seedTasks as SeedItem[]),
    ...(region === "cn"
      ? [
          { title: "设计移动端适配", description: "补齐抽屉与响应式间距", assignee: "赵敏", priority: "medium", status: "todo" },
          { title: "梳理自动化规则", description: "补充提醒与截止日期动作", assignee: "陈晨", priority: "high", status: "in_progress" },
          { title: "发布首轮演示版", description: "整理验收截图与变更记录", assignee: "刘洋", priority: "low", status: "done" },
        ] satisfies SeedItem[]
      : [
          { title: "Refine mobile layout", description: "Polish drawer behavior and spacing", assignee: "Sophia", priority: "medium", status: "todo" },
          { title: "Define automations", description: "Add reminders and due-date actions", assignee: "Mason", priority: "high", status: "in_progress" },
          { title: "Ship v1 demo", description: "Collect screenshots and change notes", assignee: "Olivia", priority: "low", status: "done" },
        ] satisfies SeedItem[]),
  ]
  return base.slice(0, 3 + extraCount + 1).map((item, index) => {
    if (index === 2 && blockedEnabled) {
      return { ...item, status: "blocked" }
    }
    return item
  })
}

export function createAppSpec(prompt: string, region: Region, existing?: AppSpecSeed): AppSpec {
  const defaults = getRegionDefaults(region)
  const now = new Date().toISOString()
  const intentArchetype = existing?.appIntent?.archetype
  const inferredKind = inferAppKind(prompt)
  const isolateSpecializedTemplate = shouldUseSpecializedWorkspaceTemplateIsolation(prompt)
  const inferredTemplateId =
    isolateSpecializedTemplate
      ? undefined
      : existing?.templateId ??
        (intentArchetype ? getDefaultTemplateIdForArchetype(intentArchetype) : undefined) ??
        inferTemplateIdFromPrompt(prompt)
  const explicitName = extractProductNameFromPrompt(prompt)
  const template = getTemplateById(inferredTemplateId)
  const templateKind =
    template?.id === "siteforge"
      ? "code_platform"
      : template?.id === "opsdesk"
        ? "crm"
        : template?.id === "orbital"
          ? "api_platform"
          : template?.id === "serenity"
            ? "community"
            : template?.id === "launchpad"
              ? "blog"
              : template?.id === "taskflow"
                ? "task"
        : undefined
  const kind =
    isolateSpecializedTemplate
      ? "task"
      : existing?.kind ??
        (intentArchetype
          ? scaffoldArchetypeToKind(intentArchetype)
          : inferredKind !== "task"
            ? inferredKind
            : templateKind ?? "task")
  const archetype = getScaffoldArchetype({ kind, templateId: inferredTemplateId, prompt })
  const planTier = existing?.planTier ?? "free"
  const features = uniqueStrings([
    ...(existing?.features ?? []),
    "description_field",
    "assignee_filter",
    ...(planTier === "builder" || planTier === "pro" || planTier === "elite" ? ["csv_export"] : []),
    ...(planTier === "pro" || planTier === "elite" ? ["about_page", "analytics_page", "blocked_status"] : []),
    ...getTemplateFeatures(inferredTemplateId, planTier),
  ]).filter((item): item is SpecFeature => FEATURE_SET.has(item as SpecFeature))
  const modules = uniqueStrings([
    ...(existing?.modules ?? []),
    ...getKindModules(kind, region, archetype, prompt),
    ...getArchetypeModules(archetype, region, prompt),
    ...getPlanModules(planTier, region, archetype, prompt),
    ...getTemplateModules(inferredTemplateId, region),
  ])
  return finalizeAppSpec({
    title:
      existing?.title ??
      explicitName ??
      (template ? (region === "cn" ? template.titleZh : template.titleEn) : deriveProjectHeadline(prompt, region)),
    prompt,
    kind,
    planTier,
    templateId: inferredTemplateId,
    templateStyle: existing?.templateStyle ?? template?.previewStyle,
    region,
    language: defaults.language,
    timezone: defaults.timezone,
    dateFormat: defaults.dateFormat,
    currency: defaults.currency,
    deploymentTarget: existing?.deploymentTarget ?? getDefaultDeploymentTarget(region),
    databaseTarget: existing?.databaseTarget ?? getDefaultDatabaseTarget(region),
    generatedAt: existing?.generatedAt ?? now,
    updatedAt: now,
    features,
    modules,
    seedItems: existing?.seedItems ?? getSeedItems(kind, region, features, planTier, archetype),
    appIntent: existing?.appIntent,
    appIdentity: existing?.appIdentity,
    routeBlueprint: existing?.routeBlueprint,
    moduleBlueprint: existing?.moduleBlueprint,
    entityBlueprint: existing?.entityBlueprint,
    capabilityFlags: existing?.capabilityFlags,
    visualSeed: existing?.visualSeed,
  })
}

export async function readProjectSpec(projectDir: string) {
  const specPath = path.join(projectDir, "spec.json")
  try {
    const raw = await fs.readFile(specPath, "utf8")
    const parsed = JSON.parse(raw) as Partial<AppSpec>
    if (!parsed || typeof parsed !== "object") return null
    return parsed
  } catch {
    return null
  }
}

export async function writeProjectSpec(projectDir: string, spec: AppSpec) {
  await writeTextFile(path.join(projectDir, "spec.json"), JSON.stringify(spec, null, 2))
}

function extractTitleFromPrompt(prompt: string) {
  const patterns = [
    /(?:修改|更改|改)(?:页面)?(?:主)?标题(?:为|改为|改成|:|：)?\s*["“]?([^"\n”]+)["”]?/i,
    /(?:set|change|update)\s+title\s+(?:to)?\s*["“]?([^"\n”]+)["”]?/i,
  ]
  for (const re of patterns) {
    const match = prompt.match(re)
    if (match?.[1]) return sanitizeUiText(match[1])
  }
  return ""
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

function normalizeSpecContextPath(value?: string | null) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "").trim()
}

function normalizeSpecContextRoute(value?: string | null) {
  const route = String(value ?? "").trim()
  if (!route) return ""
  return route.startsWith("/") ? route : `/${route}`
}

function normalizeSpecContextLabel(value?: string | null) {
  return sanitizeUiText(String(value ?? ""))
}

function getCodePlatformContextModules(pageId: string, region: Region) {
  const isCn = region === "cn"
  switch (pageId) {
    case "editor":
      return isCn
        ? ["当前文件上下文", "页面感知 AI", "元素级动作锚点", "共享会话轨道"]
        : ["Current file context", "Page-aware AI", "Element-level action anchors", "Shared session rail"]
    case "dashboard":
      return isCn
        ? ["控制平面焦点", "交付检查轨道", "运行与资源摘要"]
        : ["Control-plane focus", "Delivery checklist rail", "Runtime and resource summary"]
    case "runs":
      return isCn
        ? ["构建验收", "运行历史", "回退守卫"]
        : ["Build acceptance", "Run history", "Fallback guards"]
    case "templates":
      return isCn
        ? ["模板检索", "模板复用入口", "模板切换轨道"]
        : ["Template search", "Template reuse entry", "Template switching rail"]
    case "pricing":
      return isCn
        ? ["资源权限对比", "导出策略", "套餐升级路径"]
        : ["Resource policy comparison", "Export policy", "Plan upgrade path"]
    case "settings":
      return isCn
        ? ["环境与访问控制", "数据路径", "发布配置轨道"]
        : ["Environment and access control", "Data path", "Publish configuration rail"]
    default:
      return isCn
        ? ["页面感知工作区", "当前会话摘要"]
        : ["Page-aware workspace", "Current session summary"]
  }
}

function applyIterationContextToSpec(spec: AppSpec, modules: string[], features: SpecFeature[], context?: SpecIterationContext) {
  if (!context) return

  const currentFilePath = normalizeSpecContextPath(context.currentFilePath || context.sharedSession?.filePath)
  const currentRoute = normalizeSpecContextRoute(context.currentRoute || context.currentPage?.route)
  const currentPageId = normalizeSpecContextLabel(
    context.currentPage?.id || context.sharedSession?.routeId || context.sharedSession?.activeSection
  ).toLowerCase()
  const currentModuleName = normalizeSpecContextLabel(context.currentModule?.name || context.sharedSession?.symbolName)
  const currentElementName = normalizeSpecContextLabel(context.currentElement?.name || context.sharedSession?.elementName)
  const selectedTemplate = normalizeSpecContextLabel(context.sharedSession?.selectedTemplate)
  const workspaceSurface = normalizeSpecContextLabel(context.sharedSession?.workspaceSurface).toLowerCase()
  const workspaceStatus = normalizeSpecContextLabel(context.sharedSession?.workspaceStatus)

  if (
    currentPageId === "about" ||
    currentRoute === "/about" ||
    currentFilePath.endsWith("/about/page.tsx")
  ) {
    pushFeature(features, "about_page")
  }

  if (
    currentPageId === "analytics" ||
    currentRoute === "/analytics" ||
    currentFilePath.endsWith("/analytics/page.tsx")
  ) {
    pushFeature(features, "analytics_page")
  }

  if (spec.kind === "code_platform") {
    for (const module of getCodePlatformContextModules(currentPageId, spec.region)) {
      pushModule(modules, module)
    }
    if (workspaceSurface === "code") {
      pushModule(modules, spec.region === "cn" ? "多文件工作区" : "Multi-file workspace")
    }
    if (workspaceStatus) {
      pushModule(modules, spec.region === "cn" ? "工作区状态联动" : "Workspace status sync")
    }
  }

  if (currentModuleName && currentModuleName.length <= 48) {
    pushModule(
      modules,
      spec.region === "cn" ? `模块焦点：${currentModuleName}` : `Module focus: ${currentModuleName}`
    )
  }

  if (currentElementName && currentElementName.length <= 48) {
    pushModule(
      modules,
      spec.region === "cn" ? `元素焦点：${currentElementName}` : `Element focus: ${currentElementName}`
    )
  }

  if (selectedTemplate) {
    pushModule(
      modules,
      spec.region === "cn" ? `模板轨道：${selectedTemplate}` : `Template rail: ${selectedTemplate}`
    )
  }
}

export function applyPromptToSpec(spec: AppSpec, prompt: string, context?: SpecIterationContext) {
  const next = { ...spec, prompt, updatedAt: new Date().toISOString() }
  const lockedArchetype = spec.appIntent?.archetype
  const inferredTemplateId =
    spec.templateId ??
    (lockedArchetype ? getDefaultTemplateIdForArchetype(lockedArchetype) : undefined) ??
    inferTemplateIdFromPrompt(prompt)
  next.templateId = inferredTemplateId
  next.templateStyle = next.templateStyle ?? getTemplateById(inferredTemplateId)?.previewStyle
  const features = [...spec.features, ...getTemplateFeatures(inferredTemplateId, spec.planTier)]
  const nextKind =
    lockedArchetype
      ? scaffoldArchetypeToKind(lockedArchetype)
      : spec.kind === "task"
        ? inferAppKind(prompt)
        : spec.kind
  const nextArchetype = getScaffoldArchetype({ kind: nextKind, templateId: inferredTemplateId, prompt })
  const modules = [
    ...spec.modules,
    ...getTemplateModules(inferredTemplateId, spec.region),
    ...getArchetypeModules(nextArchetype, spec.region, prompt),
    ...getPlanModules(spec.planTier, spec.region, nextArchetype, prompt),
  ]
  const promptSafe = sanitizeUiText(prompt)
  const lower = prompt.toLowerCase()
  const title = extractTitleFromPrompt(prompt)
  const productName = extractProductNameFromPrompt(prompt)

  if (title) next.title = title
  else if (productName) next.title = productName
  if (/描述|详情|description|detail/i.test(prompt)) pushFeature(features, "description_field")
  if (/负责人筛选|按负责人筛选|assignee filter|filter/i.test(prompt)) pushFeature(features, "assignee_filter")
  if (/阻塞|blocked|block column/i.test(prompt)) {
    pushFeature(features, "blocked_status")
    pushModule(modules, spec.region === "cn" ? "阻塞处理" : "Blocked workflow")
  }
  if (/导出|csv|export/i.test(prompt)) {
    pushFeature(features, "csv_export")
    pushModule(modules, spec.region === "cn" ? "导出报表" : "Export reporting")
  }
  if (/about|关于页|新增.*页面|新建.*页面/.test(lower) || /关于页面|about 页面/.test(prompt)) {
    pushFeature(features, "about_page")
  }
  if (/分析|趋势|analytics|trend|跟进分析|analysis/i.test(prompt)) {
    pushFeature(features, "analytics_page")
    pushModule(modules, spec.region === "cn" ? "趋势分析" : "Trend analysis")
  }

  const inferredKind = inferAppKind(prompt)
  if (spec.kind === "task" && inferredKind !== "task") {
    next.kind = inferredKind
  }

  const knownIntent =
    title ||
    productName ||
    /描述|详情|description|detail|负责人筛选|筛选|filter|阻塞|blocked|导出|csv|export|about|关于|分析|趋势|analytics|trend/i.test(prompt)

  if (!knownIntent && promptSafe) {
    pushModule(modules, promptSafe)
  }

  applyIterationContextToSpec(next, modules, features, context)

  next.features = uniqueStrings(features).filter((item): item is SpecFeature => FEATURE_SET.has(item as SpecFeature))
  next.modules = uniqueStrings(modules)
  next.seedItems = getSeedItems(next.kind, next.region, next.features, next.planTier, nextArchetype)
  return finalizeAppSpec(next)
}

function mergeEnv(
  existing: string | null,
  spec: AppSpec,
  options?: {
    projectId?: string
    projectSlug?: string
    assignedDomain?: string | null
  }
) {
  const database = getDatabaseOption(spec.databaseTarget)
  const dbMatch = existing?.match(/^DATABASE_URL=.*$/m)
  const dbLine =
    dbMatch?.[0] ??
    (database.engine === "postgres"
      ? `DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/${spec.region === "cn" ? "mornstack_cn" : "mornstack_intl"}?schema=public"`
      : database.engine === "sqlite"
        ? `DATABASE_URL="file:./${spec.region === "cn" ? "cn" : "intl"}.db"`
        : `DATABASE_URL="file:./${spec.region === "cn" ? "cn" : "intl"}.db"`)
  const deployment = getDeploymentOption(spec.deploymentTarget)
  const planPolicy = getPlanPolicy(spec.planTier)
  const assignedDomainValue =
    options?.assignedDomain ||
    existing?.match(/^APP_ASSIGNED_DOMAIN="?(.*?)"?$/m)?.[1] ||
    buildAssignedAppUrl({
      projectSlug: options?.projectSlug || options?.projectId || spec.title,
      projectId: options?.projectId,
      region: spec.region,
      planTier: spec.planTier,
    })
  return [
    dbLine,
    `APP_REGION="${spec.region}"`,
    `APP_PLAN_TIER="${spec.planTier}"`,
    `APP_GENERATION_PROFILE="${planPolicy.generationProfile}"`,
    `APP_CODE_EXPORT_LEVEL="${planPolicy.codeExportLevel}"`,
    `APP_DATABASE_ACCESS_MODE="${planPolicy.databaseAccessMode}"`,
    `APP_PROJECT_LIMIT="${planPolicy.projectLimit}"`,
    `APP_COLLABORATOR_LIMIT="${planPolicy.collaboratorLimit}"`,
    `APP_SUBDOMAIN_SLOTS="${planPolicy.subdomainSlots}"`,
    `APP_ASSIGNED_DOMAIN="${assignedDomainValue}"`,
    `APP_LOCALE="${spec.language}"`,
    `APP_TIMEZONE="${spec.timezone}"`,
    `APP_CURRENCY="${spec.currency}"`,
    `APP_DEPLOY_TARGET="${spec.deploymentTarget}"`,
    `APP_DEPLOY_RUNTIME="${deployment.runtime}"`,
    `APP_DEPLOY_DOCKER_REQUIRED="${deployment.dockerRequired ? "true" : "false"}"`,
    `APP_DATABASE_TARGET="${spec.databaseTarget}"`,
    `APP_DATABASE_ENGINE="${database.engine}"`,
    "",
  ].join("\n")
}

function getCopy(spec: AppSpec) {
  const cn = spec.region === "cn"
  const archetype = getScaffoldArchetype(spec)
  const itemSingular =
    archetype === "crm"
      ? cn
        ? "线索"
        : "Lead"
      : archetype === "code_platform"
        ? cn
          ? "开发任务"
          : "Dev task"
      : archetype === "marketing_admin" || archetype === "content"
        ? cn
          ? "文章"
          : "Post"
        : archetype === "community"
          ? cn
            ? "事项"
            : "Item"
          : archetype === "api_platform"
            ? cn
              ? "端点"
              : "Endpoint"
          : cn
            ? "任务"
            : "Task"
  return {
    itemSingular,
    itemPlural: cn ? `${itemSingular}列表` : `${itemSingular}s`,
    header:
      spec.kind === "crm"
        ? cn
          ? "持续跟进你的销售线索、负责人和成交节奏。"
          : "Track leads, owners, and deal momentum in one workspace."
        : spec.kind === "code_platform"
          ? cn
            ? "把 AI 对话、文件树、编辑器、终端和项目交付放进同一个代码工作台。"
            : "Bring AI chat, file navigation, editing, terminal feedback, and delivery into one coding workspace."
        : cn
          ? "在同一 workspace 中持续迭代页面、数据与 API。"
          : "Keep iterating UI, data, and API in the same workspace.",
    formDescription:
      spec.kind === "crm"
        ? cn
          ? "客户背景 / 跟进备注"
          : "Company context / follow-up note"
        : spec.kind === "code_platform"
          ? cn
            ? "实现说明 / 编程目标 / 验收标准"
            : "Implementation note / coding goal / acceptance detail"
        : cn
          ? "补充说明"
          : "Supporting details",
    createItem: cn ? `新增${itemSingular}` : `Add ${itemSingular}`,
    modules: cn ? "当前模块" : "Current modules",
    total: cn ? "总数" : "Total",
    active: cn ? "进行中" : "Active",
    blocked: cn ? "阻塞" : "Blocked",
    owners: cn ? "负责人" : "Owners",
    quickSummary:
      archetype === "code_platform"
        ? cn
          ? "开发驾驶舱"
          : "Engineering cockpit"
        : archetype === "api_platform"
          ? cn
            ? "接口控制台"
            : "API console"
        : cn
          ? "运营概览"
          : "Workspace summary",
    recentTrend: cn ? "最近趋势" : "Recent trend",
    empty: cn ? "暂无数据，将自动写入种子数据。" : "No data yet. Seed records will be added automatically.",
    openAbout: cn ? "查看关于页" : "Open about page",
    openAnalytics: cn ? "查看分析页" : "Open analytics page",
  }
}

function getTemplateSkin(spec: AppSpec) {
  if (spec.templateStyle === "dark-dashboard") {
    return {
      pageBackground: "linear-gradient(180deg, #0b1020 0%, #0f172a 42%, #111827 100%)",
      panelBackground: "rgba(15, 23, 42, 0.72)",
      panelBorder: "1px solid rgba(56, 189, 248, 0.14)",
      heroBackground: "radial-gradient(circle at top right, rgba(34,211,238,0.24), transparent 26%), linear-gradient(135deg, rgba(15,23,42,0.94), rgba(17,24,39,0.96))",
      textPrimary: "#f8fafc",
      textSecondary: "#94a3b8",
      cardBackground: "rgba(15,23,42,0.68)",
      cardBorder: "1px solid rgba(148, 163, 184, 0.12)",
      accentSoft: "#0f172a",
      accentStrong: "#06b6d4",
      sidebarBackground: "rgba(2,6,23,0.72)",
      inputBackground: "rgba(15,23,42,0.85)",
      progressBackground: "linear-gradient(90deg,#22d3ee 0%,#6366f1 100%)",
    }
  }
  if (spec.templateStyle === "spa-landing") {
    return {
      pageBackground: "linear-gradient(180deg, #f3ece4 0%, #fffaf5 44%, #f7f0e8 100%)",
      panelBackground: "rgba(255, 251, 245, 0.9)",
      panelBorder: "1px solid rgba(180, 138, 103, 0.2)",
      heroBackground: "radial-gradient(circle at top right, rgba(191,161,129,0.22), transparent 28%), linear-gradient(135deg, rgba(122,87,63,0.18), rgba(255,251,245,0.92))",
      textPrimary: "#34251d",
      textSecondary: "#7c675a",
      cardBackground: "#fffdf9",
      cardBorder: "1px solid rgba(180, 138, 103, 0.16)",
      accentSoft: "#f5ede2",
      accentStrong: "#c08457",
      sidebarBackground: "rgba(255,248,240,0.88)",
      inputBackground: "#fffaf4",
      progressBackground: "linear-gradient(90deg,#fb7185 0%,#c08457 100%)",
    }
  }
  if (spec.templateStyle === "purple-builder") {
    return {
      pageBackground: "linear-gradient(180deg, #f5f3ff 0%, #ffffff 42%, #faf5ff 100%)",
      panelBackground: "rgba(255,255,255,0.92)",
      panelBorder: "1px solid rgba(147, 51, 234, 0.14)",
      heroBackground: "radial-gradient(circle at top right, rgba(168,85,247,0.22), transparent 28%), linear-gradient(135deg, rgba(91,33,182,0.08), rgba(255,255,255,0.96))",
      textPrimary: "#1f1235",
      textSecondary: "#7c3aed",
      cardBackground: "#ffffff",
      cardBorder: "1px solid rgba(196, 181, 253, 0.6)",
      accentSoft: "#f5f3ff",
      accentStrong: "#7c3aed",
      sidebarBackground: "rgba(250,245,255,0.92)",
      inputBackground: "#faf5ff",
      progressBackground: "linear-gradient(90deg,#8b5cf6 0%,#ec4899 100%)",
    }
  }
  if (spec.templateStyle === "light-admin") {
    return {
      pageBackground: "linear-gradient(180deg, #f6f8fc 0%, #ffffff 44%, #f8fbff 100%)",
      panelBackground: "rgba(255,255,255,0.94)",
      panelBorder: "1px solid rgba(148, 163, 184, 0.16)",
      heroBackground: "radial-gradient(circle at top right, rgba(59,130,246,0.16), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.98), rgba(241,245,249,0.94))",
      textPrimary: "#0f172a",
      textSecondary: "#64748b",
      cardBackground: "#ffffff",
      cardBorder: "1px solid rgba(226, 232, 240, 0.95)",
      accentSoft: "#eff6ff",
      accentStrong: "#2563eb",
      sidebarBackground: "rgba(255,255,255,0.84)",
      inputBackground: "#f8fafc",
      progressBackground: "linear-gradient(90deg,#3b82f6 0%,#8b5cf6 100%)",
    }
  }
  if (spec.templateStyle === "cosmic-app") {
    return {
      pageBackground: "radial-gradient(circle at top, rgba(96,165,250,0.14), transparent 24%), linear-gradient(180deg, #020617 0%, #0b1120 48%, #111827 100%)",
      panelBackground: "rgba(8, 15, 33, 0.78)",
      panelBorder: "1px solid rgba(99, 102, 241, 0.2)",
      heroBackground: "radial-gradient(circle at top right, rgba(99,102,241,0.28), transparent 28%), linear-gradient(135deg, rgba(2,6,23,0.96), rgba(15,23,42,0.94))",
      textPrimary: "#e5eefc",
      textSecondary: "#94a3b8",
      cardBackground: "rgba(15,23,42,0.72)",
      cardBorder: "1px solid rgba(148, 163, 184, 0.1)",
      accentSoft: "rgba(79, 70, 229, 0.12)",
      accentStrong: "#818cf8",
      sidebarBackground: "rgba(2,6,23,0.84)",
      inputBackground: "rgba(15,23,42,0.9)",
      progressBackground: "linear-gradient(90deg,#60a5fa 0%,#8b5cf6 55%,#22d3ee 100%)",
    }
  }
  if (spec.templateStyle === "launch-ui") {
    return {
      pageBackground: "linear-gradient(180deg, #0f172a 0%, #111827 38%, #f8fafc 38%, #ffffff 100%)",
      panelBackground: "#ffffff",
      panelBorder: "1px solid rgba(15, 23, 42, 0.08)",
      heroBackground: "linear-gradient(135deg, #0f172a 0%, #111827 68%, #1e293b 100%)",
      textPrimary: "#0f172a",
      textSecondary: "#64748b",
      cardBackground: "#ffffff",
      cardBorder: "1px solid #e2e8f0",
      accentSoft: "#e0f2fe",
      accentStrong: "#0f172a",
      sidebarBackground: "rgba(255,255,255,0.82)",
      inputBackground: "#f8fafc",
      progressBackground: "linear-gradient(90deg,#0f172a 0%,#38bdf8 100%)",
    }
  }
  return {
    pageBackground: "linear-gradient(180deg, #f5f7fb 0%, #ffffff 45%, #f8fafc 100%)",
    panelBackground: "#ffffff",
    panelBorder: "1px solid #e2e8f0",
    heroBackground: "radial-gradient(circle at top right, rgba(99,102,241,0.16), transparent 28%), #ffffff",
    textPrimary: "#0f172a",
    textSecondary: "#64748b",
    cardBackground: "#ffffff",
    cardBorder: "1px solid #e2e8f0",
    accentSoft: "#eef2ff",
    accentStrong: "#4338ca",
    sidebarBackground: "rgba(255,255,255,0.75)",
    inputBackground: "#f8fafc",
    progressBackground: "linear-gradient(90deg,#60a5fa 0%,#818cf8 100%)",
  }
}

function getTemplateHero(spec: AppSpec) {
  const archetype = getScaffoldArchetype(spec)
  if (spec.templateStyle === "dark-dashboard") {
    return {
      badge: spec.region === "cn" ? "营销看板模板" : "Marketing dashboard template",
      title:
        spec.region === "cn"
          ? "一个接近成品的深色任务与运营工作台"
          : "A dark task and operations workspace that feels production-ready",
      description:
        spec.region === "cn"
          ? "重点突出数据面板、最近活动、协作任务和多视图切换，适合生成像 Base44 那种一眼可演示的工作区。"
          : "Designed around metrics, recent activity, collaboration flows, and multi-view switching so the workspace feels demo-ready at first glance.",
    }
  }
  if (spec.templateStyle === "spa-landing") {
    return {
      badge: spec.region === "cn" ? "高端品牌模板" : "Luxury brand template",
      title:
        spec.region === "cn"
          ? "适合门店、服务业与品牌展示的高级体验"
          : "A premium experience for hospitality, services, and brand showcase sites",
      description:
        spec.region === "cn"
          ? "页面强调品牌气质、预约入口与故事感，适合做高端官网和预约型业务页面。"
          : "Built around brand atmosphere, booking flows, and storytelling for premium marketing websites.",
    }
  }
  if (spec.templateStyle === "purple-builder") {
    return {
      badge: spec.region === "cn" ? "创作平台模板" : "Creator platform template",
      title:
        spec.region === "cn"
          ? "用更强的创作工具视觉来呈现你的 AI 产品"
          : "Present your AI product with a stronger creator-platform visual language",
      description:
        spec.region === "cn"
          ? "强调输入、生成、预览和模板入口，让产品更像创作型 SaaS 而不是普通表单站点。"
          : "Emphasizes prompting, generation, preview, and template entry so the product feels like a creation tool, not a plain form page.",
    }
  }
  if (spec.templateStyle === "light-admin") {
    return {
      badge: spec.region === "cn" ? "运营后台模板" : "Operations admin template",
      title:
        spec.region === "cn"
          ? "更清爽、更产品化的浅色运营工作台"
          : "A cleaner and more product-like light operations workspace",
      description:
        spec.region === "cn"
          ? "强调欢迎区、快捷入口、指标卡和可交付的后台观感，适合运营、项目和任务场景。"
          : "Built around welcome sections, quick actions, metric cards, and a ship-ready admin feel for ops and project workflows.",
    }
  }
  if (spec.templateStyle === "cosmic-app") {
    return {
      badge: spec.region === "cn" ? "未来科技模板" : "Futuristic product template",
      title:
        spec.region === "cn"
          ? "带强主视觉与发光层次的科技感产品页面"
          : "A technology-forward product surface with bold hero visuals and glow layers",
      description:
        spec.region === "cn"
          ? "适合做强品牌感、强视觉冲击的 AI 产品首页、发布页和展示页。"
          : "Well-suited for AI product homepages, launch pages, and showcase experiences with strong branding.",
    }
  }
  if (spec.templateStyle === "launch-ui") {
    return {
      badge: spec.region === "cn" ? "高转化模板" : "Conversion template",
      title:
        spec.region === "cn"
          ? "更克制但更有成交感的 SaaS 发布页面"
          : "A restrained but conversion-focused SaaS launch page",
      description:
        spec.region === "cn"
          ? "重心放在价值主张、价格结构、FAQ 和行动按钮，适合做收费型 SaaS 首页。"
          : "Focused on value proposition, pricing structure, FAQ, and action moments for paid SaaS products.",
    }
  }
  return {
    badge: spec.region === "cn" ? "精美任务工作台" : "Polished task workspace",
    title:
      archetype === "crm"
        ? spec.region === "cn"
          ? "跟进线索、推进阶段、掌握负责人节奏"
          : "Track leads, stages, and owner momentum in one place"
        : archetype === "code_platform"
          ? spec.region === "cn"
            ? "更像中国版 Cursor 的 AI 代码工作台"
            : "An AI coding workspace shaped more like a modern Cursor-style product"
        : archetype === "api_platform"
          ? spec.region === "cn"
            ? "围绕端点、日志、鉴权与环境的接口控制台"
            : "An API control plane focused on endpoints, logs, auth, and environments"
          : archetype === "community"
            ? spec.region === "cn"
              ? "把反馈、成员、路线图和公告收进同一社区工作台"
              : "Bring feedback, members, roadmap, and announcements into one community workspace"
            : archetype === "marketing_admin" || archetype === "content"
              ? spec.region === "cn"
                ? "围绕官网、下载、文档与分发的增长工作区"
                : "A growth workspace centered on website, downloads, docs, and distribution"
        : spec.region === "cn"
          ? "一个看起来像成品的任务管理工作区"
          : "A task management workspace that already feels like a product",
    description:
      archetype === "code_platform"
        ? spec.region === "cn"
          ? "把项目导航、标签编辑器、终端运行反馈、AI 解释与生成链路放进同一体验里，让首版就更像可演示的代码平台。"
          : "Bring project navigation, tabbed editing, terminal feedback, and AI-assisted generation into a single surface so the first pass already feels like a code platform."
        : getCopy(spec).header,
  }
}

type ArchetypePageDefinition = {
  route: string
  label: string
  headline: string
  subheadline: string
  summary: string
  metricLabel: string
  metricValue: string
  insightLabel: string
  insightValue: string
  records: Array<{ title: string; meta: string; status: string }>
  focusAreas: string[]
}

function getArchetypePageDefinitions(spec: AppSpec): ArchetypePageDefinition[] {
  const isCn = spec.region === "cn"
  const archetype = getScaffoldArchetype(spec)
  const promptText = String(spec.prompt ?? spec.title ?? "").toLowerCase()
  const routeSet = new Set(extractPlannedRouteNames(spec))

  if (archetype === "code_platform") {
    const pages: ArchetypePageDefinition[] = isCn
      ? [
          {
            route: "dashboard",
            label: "Dashboard",
            headline: "AI 代码工作台总览",
            subheadline: "把生成、运行、预览、发布和助手上下文收进同一条工程工作流。",
            summary: "这页应该像代码平台的控制平面，而不是普通概览卡片页。",
            metricLabel: "活跃工作区",
            metricValue: "12",
            insightLabel: "最近发布",
            insightValue: "9m ago",
            records: [
              { title: "预览运行链路", meta: "最近一次构建已通过并同步到预览", status: "Healthy" },
              { title: "AI 改码线程", meta: "3 条上下文修改等待应用", status: "Ready" },
              { title: "发布通道", meta: "当前分支等待最后验收", status: "Queued" },
            ],
            focusAreas: ["AI", "Preview", "Runs", "Publish"],
          },
          {
            route: "editor",
            label: "Editor",
            headline: "多文件编辑与预览工作区",
            subheadline: "保留文件树、标签页、代码区和预览联动，让它更像真实 IDE。",
            summary: "这页是代码平台的主工作区，不该退化成静态代码展示。",
            metricLabel: "打开文件",
            metricValue: "8",
            insightLabel: "脏文件",
            insightValue: "2",
            records: [
              { title: "app/editor/page.tsx", meta: "当前聚焦在编辑体验和上下文联动", status: "Focused" },
              { title: "components/generated/workspace-shell.tsx", meta: "承接主工作区外壳与 split preview", status: "Open" },
              { title: "最近 AI 变更", meta: "已把 assistant / publish 路由并回代码上下文", status: "Synced" },
            ],
            focusAreas: ["Files", "Tabs", "Preview", "Context"],
          },
        ]
      : [
          {
            route: "dashboard",
            label: "Dashboard",
            headline: "AI coding control plane",
            subheadline: "Bring generation, runtime, preview, publish, and assistant context into one engineering workflow.",
            summary: "This should feel like the control plane of an AI code platform, not a generic overview grid.",
            metricLabel: "Active workspaces",
            metricValue: "12",
            insightLabel: "Latest release",
            insightValue: "9m ago",
            records: [
              { title: "Preview runtime", meta: "Latest build passed and synced to preview", status: "Healthy" },
              { title: "AI edit threads", meta: "3 context-aware changes are ready to apply", status: "Ready" },
              { title: "Release channel", meta: "Current branch is waiting on final acceptance", status: "Queued" },
            ],
            focusAreas: ["AI", "Preview", "Runs", "Publish"],
          },
          {
            route: "editor",
            label: "Editor",
            headline: "Multi-file editing workspace",
            subheadline: "Keep file tree, tabs, code, and preview in one IDE-like surface.",
            summary: "This is the primary workspace of the code product, not a static code dump.",
            metricLabel: "Open files",
            metricValue: "8",
            insightLabel: "Dirty tabs",
            insightValue: "2",
            records: [
              { title: "app/editor/page.tsx", meta: "Focused on editor experience and context binding", status: "Focused" },
              { title: "components/generated/workspace-shell.tsx", meta: "Owns the workspace shell and split preview", status: "Open" },
              { title: "Recent AI edits", meta: "Assistant and publish routes are now linked back into code context", status: "Synced" },
            ],
            focusAreas: ["Files", "Tabs", "Preview", "Context"],
          },
        ]
    if (routeSet.has("runs")) {
      pages.push(
        isCn
          ? {
              route: "runs",
              label: "Runs",
              headline: "运行与构建验收面板",
              subheadline: "让构建、预览、日志和错误恢复变成同一条运行轨道。",
              summary: "这页体现代码平台的运行与验收能力，不只是日志列表。",
              metricLabel: "最近构建",
              metricValue: "14",
              insightLabel: "成功率",
              insightValue: "93%",
              records: [
                { title: "preview build", meta: "最近一次生成后 build 已通过", status: "Passed" },
                { title: "assistant patch run", meta: "上下文改写进入构建校验", status: "Running" },
                { title: "runtime retry", meta: "1 条失败任务已自动恢复", status: "Recovered" },
              ],
              focusAreas: ["Builds", "Preview", "Logs", "Recovery"],
            }
          : {
              route: "runs",
              label: "Runs",
              headline: "Runtime and build rail",
              subheadline: "Keep builds, preview verification, logs, and recovery in one execution surface.",
              summary: "This route expresses runtime acceptance, not just a log table.",
              metricLabel: "Recent builds",
              metricValue: "14",
              insightLabel: "Pass rate",
              insightValue: "93%",
              records: [
                { title: "preview build", meta: "Latest post-generation build has passed", status: "Passed" },
                { title: "assistant patch run", meta: "Context edit is moving through build validation", status: "Running" },
                { title: "runtime retry", meta: "1 failed task recovered automatically", status: "Recovered" },
              ],
              focusAreas: ["Builds", "Preview", "Logs", "Recovery"],
            }
      )
    }
    if (routeSet.has("templates")) {
      pages.push(
        isCn
          ? {
              route: "templates",
              label: "Templates",
              headline: "模板与起始点画廊",
              subheadline: "用模板库、脚手架和推荐起始点组织生成入口，而不是只放一组卡片。",
              summary: "这页承接生成起点与路线差异。",
              metricLabel: "模板库",
              metricValue: "16",
              insightLabel: "推荐起点",
              insightValue: "4",
              records: [
                { title: "代码平台基线", meta: "适合 AI IDE 与工作区生成", status: "Pinned" },
                { title: "下载站起点", meta: "适合官网与分发型产品", status: "Suggested" },
                { title: "API 控制台", meta: "适合日志、文档和 webhook 产品", status: "Ready" },
              ],
              focusAreas: ["Starters", "Scaffolds", "Plans", "Variants"],
            }
          : {
              route: "templates",
              label: "Templates",
              headline: "Template and starter gallery",
              subheadline: "Organize scaffold entry points as a real template library instead of a loose card wall.",
              summary: "This route carries starting points and generation variants.",
              metricLabel: "Template library",
              metricValue: "16",
              insightLabel: "Recommended starters",
              insightValue: "4",
              records: [
                { title: "Code platform baseline", meta: "Best for AI IDE and workspace generation", status: "Pinned" },
                { title: "Download-site starter", meta: "Best for marketing + distribution products", status: "Suggested" },
                { title: "API console starter", meta: "Best for logs, docs, and webhooks", status: "Ready" },
              ],
              focusAreas: ["Starters", "Scaffolds", "Plans", "Variants"],
            }
      )
    }
    if (routeSet.has("assistant")) {
      pages.push(
        isCn
          ? {
              route: "assistant",
              label: "Assistant",
              headline: "AI 助手上下文轨道",
              subheadline: "把线程历史、当前文件、当前页面和 apply change 都绑到同一条助手链路里。",
              summary: "这页体现 discuss / generate / fix / refactor 的真实工作流。",
              metricLabel: "活跃线程",
              metricValue: "3",
              insightLabel: "待应用",
              insightValue: "5",
              records: [
                { title: "Discuss 模式", meta: "围绕 editor 上下文梳理需求", status: "Live" },
                { title: "Generate 模式", meta: "准备写入 2 个新页面模块", status: "Queued" },
                { title: "Refactor 模式", meta: "正在整理文件树与共享组件", status: "Running" },
              ],
              focusAreas: ["Discuss", "Generate", "Fix", "Refactor"],
            }
          : {
              route: "assistant",
              label: "Assistant",
              headline: "AI assistant context rail",
              subheadline: "Bind thread history, current file, current page, and apply-change into one assistant workflow.",
              summary: "This route expresses Discuss / Generate / Fix / Refactor as a real product workflow.",
              metricLabel: "Active threads",
              metricValue: "3",
              insightLabel: "Pending applies",
              insightValue: "5",
              records: [
                { title: "Discuss mode", meta: "Grounding requirements in the editor context", status: "Live" },
                { title: "Generate mode", meta: "Preparing writes for 2 new route modules", status: "Queued" },
                { title: "Refactor mode", meta: "Reshaping file tree and shared components", status: "Running" },
              ],
              focusAreas: ["Discuss", "Generate", "Fix", "Refactor"],
            }
      )
    }
    if (routeSet.has("publish")) {
      pages.push(
        isCn
          ? {
              route: "publish",
              label: "Publish",
              headline: "发布与交付通道",
              subheadline: "把验收、发布、分享和回退变成同一个交付轨道。",
              summary: "这页是代码平台的发布控制面，不是普通分享卡片。",
              metricLabel: "发布通道",
              metricValue: "3",
              insightLabel: "待确认",
              insightValue: "1",
              records: [
                { title: "Preview 验收", meta: "当前分支等待最后 UI 与运行确认", status: "Review" },
                { title: "分享链接", meta: "已生成 canonical preview 可供团队验收", status: "Ready" },
                { title: "发布回退", meta: "保留最近两次构建可快速回滚", status: "Protected" },
              ],
              focusAreas: ["Acceptance", "Release", "Share", "Rollback"],
            }
          : {
              route: "publish",
              label: "Publish",
              headline: "Release and delivery lane",
              subheadline: "Turn acceptance, release, sharing, and rollback into one delivery rail.",
              summary: "This route is the release control surface of the code product, not a generic share card.",
              metricLabel: "Release lanes",
              metricValue: "3",
              insightLabel: "Pending acceptance",
              insightValue: "1",
              records: [
                { title: "Preview acceptance", meta: "Current branch is waiting on final UI and runtime checks", status: "Review" },
                { title: "Share links", meta: "Canonical preview is ready for team review", status: "Ready" },
                { title: "Release rollback", meta: "Latest two builds remain available for quick recovery", status: "Protected" },
              ],
              focusAreas: ["Acceptance", "Release", "Share", "Rollback"],
            }
      )
    }
    if (routeSet.has("settings")) {
      pages.push(
        isCn
          ? {
              route: "settings",
              label: "Settings",
              headline: "环境与权限设置",
              subheadline: "把数据库、环境变量、访问边界和运行策略放到同一条设置轨道。",
              summary: "这页承接配置与访问控制，而不是普通表单集合。",
              metricLabel: "活跃环境",
              metricValue: "3",
              insightLabel: "受管配置",
              insightValue: "7",
              records: [
                { title: "Runtime 环境", meta: "预览与生产环境变量已分层", status: "Scoped" },
                { title: "数据库访问", meta: "套餐权限已并入数据库接入模式", status: "Synced" },
                { title: "协作者访问", meta: "当前工作区权限边界已生效", status: "Protected" },
              ],
              focusAreas: ["Env", "Database", "Access", "Policies"],
            }
          : {
              route: "settings",
              label: "Settings",
              headline: "Environment and access settings",
              subheadline: "Keep database, environment variables, access boundaries, and runtime policy in one configuration rail.",
              summary: "This route carries configuration and governance, not a random form stack.",
              metricLabel: "Active environments",
              metricValue: "3",
              insightLabel: "Managed configs",
              insightValue: "7",
              records: [
                { title: "Runtime environments", meta: "Preview and production variables are now scoped", status: "Scoped" },
                { title: "Database access", meta: "Plan policy is reflected in database mode", status: "Synced" },
                { title: "Collaborator access", meta: "Workspace access boundaries are enforced", status: "Protected" },
              ],
              focusAreas: ["Env", "Database", "Access", "Policies"],
            }
      )
    }
    if (routeSet.has("pricing")) {
      pages.push(
        isCn
          ? {
              route: "pricing",
              label: "Pricing",
              headline: "套餐与能力结构",
              subheadline: "清楚区分免费、建造者、专业版与精英版的生成、导出和交付权限。",
              summary: "这页承接套餐差异，不只是价格卡片。",
              metricLabel: "套餐层级",
              metricValue: "5",
              insightLabel: "升级线索",
              insightValue: "8",
              records: [
                { title: "免费版限制", meta: "仅在线、无导出、低资源预算", status: "Defined" },
                { title: "专业版交付", meta: "支持更完整导出与交付控制", status: "Ready" },
                { title: "精英版 handoff", meta: "预留更强交付与控制能力", status: "Planned" },
              ],
              focusAreas: ["Plans", "Entitlements", "Exports", "Upgrade"],
            }
          : {
              route: "pricing",
              label: "Pricing",
              headline: "Plans and capability tiers",
              subheadline: "Separate free, builder, pro, and elite generation, export, and delivery rights clearly.",
              summary: "This route carries plan differentiation, not just price cards.",
              metricLabel: "Plan tiers",
              metricValue: "5",
              insightLabel: "Upgrade leads",
              insightValue: "8",
              records: [
                { title: "Free-tier limits", meta: "Online-only, no export, low resource budget", status: "Defined" },
                { title: "Pro delivery", meta: "Supports stronger export and release controls", status: "Ready" },
                { title: "Elite handoff", meta: "Keeps stronger delivery and governance headroom", status: "Planned" },
              ],
              focusAreas: ["Plans", "Entitlements", "Exports", "Upgrade"],
            }
      )
    }
    if (routeSet.has("about")) {
      pages.push(
        isCn
          ? {
              route: "about",
              label: "About",
              headline: "产品定位与体验说明",
              subheadline: "用产品叙事解释这个代码平台的目标、工作方式和交付边界。",
              summary: "这页用于更强的品牌与产品说明，不是默认必备页。",
              metricLabel: "定位摘要",
              metricValue: "1",
              insightLabel: "品牌语气",
              insightValue: "Aligned",
              records: [
                { title: "产品定位", meta: "围绕 AI 编码与全栈生成工作流", status: "Published" },
                { title: "交付边界", meta: "说明预览、导出与套餐差异", status: "Documented" },
                { title: "团队体验", meta: "统一 explain/fix/generate/refactor 口径", status: "Ready" },
              ],
              focusAreas: ["Positioning", "Story", "Boundaries", "Tone"],
            }
          : {
              route: "about",
              label: "About",
              headline: "Product story and positioning",
              subheadline: "Explain what this code platform is for, how it works, and where the delivery boundaries sit.",
              summary: "This route exists for stronger product storytelling, not as a default requirement.",
              metricLabel: "Positioning",
              metricValue: "1",
              insightLabel: "Brand tone",
              insightValue: "Aligned",
              records: [
                { title: "Product position", meta: "Grounded in AI coding and full-stack generation", status: "Published" },
                { title: "Delivery boundaries", meta: "Explains preview, export, and plan differences", status: "Documented" },
                { title: "Team workflow", meta: "Unifies explain/fix/generate/refactor language", status: "Ready" },
              ],
              focusAreas: ["Positioning", "Story", "Boundaries", "Tone"],
            }
      )
    }
    if (routeSet.has("analytics")) {
      pages.push(
        isCn
          ? {
              route: "analytics",
              label: "Analytics",
              headline: "运行与协作分析",
              subheadline: "把生成成功率、预览稳定性、改码线程和交付节奏放进同一视图。",
              summary: "这页体现代码平台的运营与使用分析能力。",
              metricLabel: "成功生成率",
              metricValue: "91%",
              insightLabel: "协作线程",
              insightValue: "14",
              records: [
                { title: "生成成功率", meta: "按 archetype 统计最近 7 天表现", status: "Tracked" },
                { title: "预览稳定性", meta: "canonical 与 runtime 准备情况已并表", status: "Healthy" },
                { title: "AI 线程吞吐", meta: "最近 explain/fix/generate 比例平衡", status: "Observed" },
              ],
              focusAreas: ["Generation", "Preview", "Threads", "Delivery"],
            }
          : {
              route: "analytics",
              label: "Analytics",
              headline: "Runtime and collaboration analytics",
              subheadline: "Bring generation success, preview readiness, edit threads, and delivery rhythm into one surface.",
              summary: "This route makes the operational side of the code platform visible.",
              metricLabel: "Generation success",
              metricValue: "91%",
              insightLabel: "Collab threads",
              insightValue: "14",
              records: [
                { title: "Generation success rate", meta: "Tracked by archetype over the last 7 days", status: "Tracked" },
                { title: "Preview stability", meta: "Canonical and runtime readiness are now linked", status: "Healthy" },
                { title: "AI thread throughput", meta: "Recent explain/fix/generate mix is balanced", status: "Observed" },
              ],
              focusAreas: ["Generation", "Preview", "Threads", "Delivery"],
            }
      )
    }
    return pages
  }

  if (isAdminOpsTaskSpec(spec)) {
    const base = isCn
      ? [
          {
            route: "dashboard",
            label: "Dashboard",
            headline: "内部控制平面总览",
            subheadline: "把审批、权限、审计、告警和团队治理收进一个内部控制平面。",
            summary: "这页应该像内部 control plane，而不是普通任务看板。",
            metricLabel: "待处理事项",
            metricValue: "26",
            insightLabel: "高风险事件",
            insightValue: "4",
            records: [
              { title: "访问策略变更", meta: "2 条待审批 · 涉及生产环境", status: "Review" },
              { title: "权限审计异常", meta: "昨夜 3 条高风险留痕需复核", status: "Alert" },
              { title: "团队席位治理", meta: "5 个席位待分配给新负责人", status: "Queued" },
            ],
            focusAreas: ["Approvals", "Security", "Audit", "Incidents"],
          },
          {
            route: "tasks",
            label: "Tasks",
            headline: "治理任务与处理队列",
            subheadline: "按责任人、状态和策略影响范围组织内部治理动作。",
            summary: "这页承接审批前后的治理任务，而不是普通待办列表。",
            metricLabel: "治理任务",
            metricValue: "42",
            insightLabel: "超时事项",
            insightValue: "6",
            records: [
              { title: "生产权限收口", meta: "负责人 Lena · 今日需完成策略调整", status: "In progress" },
              { title: "审计导出复核", meta: "负责人 Mason · 等待法务确认", status: "Review" },
              { title: "事件演练清单", meta: "负责人 Sofia · 本周例行演练", status: "Queued" },
            ],
            focusAreas: ["Queues", "Owners", "Policies", "Escalations"],
          },
          {
            route: "approvals",
            label: "Approvals",
            headline: "审批与决策中心",
            subheadline: "集中处理访问申请、变更请求和风险确认。",
            summary: "这页是审批控制中心，不是普通流程卡片页。",
            metricLabel: "待审批",
            metricValue: "13",
            insightLabel: "批量决策",
            insightValue: "3",
            records: [
              { title: "生产访问申请", meta: "申请人 Olivia · 需要主管批准", status: "Pending" },
              { title: "策略例外请求", meta: "跨区域部署临时放行", status: "Escalated" },
              { title: "高权限席位申请", meta: "等待安全负责人确认", status: "Review" },
            ],
            focusAreas: ["Approvals", "Risk review", "Owners", "SLA"],
          },
          {
            route: "security",
            label: "Security",
            headline: "权限与策略治理",
            subheadline: "把角色、权限边界、工作区访问和策略发布放到同一轨道。",
            summary: "这页要像策略中心和访问治理台，不是通用设置页。",
            metricLabel: "活跃策略",
            metricValue: "18",
            insightLabel: "待发布策略",
            insightValue: "2",
            records: [
              { title: "Workspace admin policy", meta: "将新角色同步到 4 个环境", status: "Ready" },
              { title: "External contractor access", meta: "周五到期 · 需回收权限", status: "Alert" },
              { title: "Audit export rule", meta: "新增合规导出时间窗", status: "Draft" },
            ],
            focusAreas: ["Roles", "Policies", "Access", "Audit"],
          },
        ]
      : [
          {
            route: "dashboard",
            label: "Dashboard",
            headline: "Internal control plane overview",
            subheadline: "Bring approvals, access policy, audit response, and team governance into one operating surface.",
            summary: "This should read like an internal control plane, not a generic task board.",
            metricLabel: "Queued governance items",
            metricValue: "26",
            insightLabel: "High-risk events",
            insightValue: "4",
            records: [
              { title: "Access policy change", meta: "2 approvals pending · touches production", status: "Review" },
              { title: "Audit anomaly review", meta: "3 overnight events need validation", status: "Alert" },
              { title: "Team seat governance", meta: "5 seats waiting on owner assignment", status: "Queued" },
            ],
            focusAreas: ["Approvals", "Security", "Audit", "Incidents"],
          },
          {
            route: "tasks",
            label: "Tasks",
            headline: "Governance queue and task rail",
            subheadline: "Organize operational work by owner, status, and policy impact instead of dumping it into a generic todo list.",
            summary: "This route carries governance execution before and after approvals.",
            metricLabel: "Governance tasks",
            metricValue: "42",
            insightLabel: "Breached SLAs",
            insightValue: "6",
            records: [
              { title: "Production access rollback", meta: "Owner Lena · policy update due today", status: "In progress" },
              { title: "Audit export review", meta: "Owner Mason · waiting on legal confirmation", status: "Review" },
              { title: "Incident drill checklist", meta: "Owner Sofia · scheduled for this week", status: "Queued" },
            ],
            focusAreas: ["Queues", "Owners", "Policies", "Escalations"],
          },
          {
            route: "approvals",
            label: "Approvals",
            headline: "Approval and decision center",
            subheadline: "Handle access requests, change approvals, and risk signoffs in one decision surface.",
            summary: "This is the approval control room for the internal admin product.",
            metricLabel: "Pending approvals",
            metricValue: "13",
            insightLabel: "Batch decisions",
            insightValue: "3",
            records: [
              { title: "Production access request", meta: "Requester Olivia · manager signoff required", status: "Pending" },
              { title: "Policy exception request", meta: "Temporary cross-region rollout allowance", status: "Escalated" },
              { title: "Privileged seat request", meta: "Waiting on security lead confirmation", status: "Review" },
            ],
            focusAreas: ["Approvals", "Risk review", "Owners", "SLA"],
          },
          {
            route: "security",
            label: "Security",
            headline: "Access policy and governance rail",
            subheadline: "Keep roles, workspace boundaries, seat access, and policy publishing in one control surface.",
            summary: "This should feel like the policy center of the control plane, not a generic settings page.",
            metricLabel: "Active policies",
            metricValue: "18",
            insightLabel: "Policies pending publish",
            insightValue: "2",
            records: [
              { title: "Workspace admin policy", meta: "Syncing new role scopes across 4 environments", status: "Ready" },
              { title: "External contractor access", meta: "Expires Friday · needs revocation plan", status: "Alert" },
              { title: "Audit export rule", meta: "Adds a compliance export window", status: "Draft" },
            ],
            focusAreas: ["Roles", "Policies", "Access", "Audit"],
          },
        ]
    const pages = [...base]
    if (routeSet.has("audit") || /audit|history|trace|compliance|审计|留痕|合规|记录/.test(promptText)) {
      pages.push(
        isCn
          ? {
              route: "audit",
              label: "Audit",
              headline: "审计留痕与合规视图",
              subheadline: "让操作记录、合规导出和异常追踪成为同一条审计链。",
              summary: "这页体现审计时间线和合规留痕能力。",
              metricLabel: "审计事件",
              metricValue: "218",
              insightLabel: "待复核",
              insightValue: "9",
              records: [
                { title: "权限提升记录", meta: "过去 24 小时内 7 次高权限变更", status: "Tracked" },
                { title: "导出审计包", meta: "本周合规审计包待归档", status: "Queued" },
                { title: "异常登录回放", meta: "3 条需要安全确认", status: "Review" },
              ],
              focusAreas: ["Audit trail", "Compliance", "Exports", "Exceptions"],
            }
          : {
              route: "audit",
              label: "Audit",
              headline: "Audit trail and compliance view",
              subheadline: "Keep action logs, compliance exports, and anomaly review in one audit lane.",
              summary: "This route makes the audit trail and compliance posture visible.",
              metricLabel: "Audit events",
              metricValue: "218",
              insightLabel: "Needs review",
              insightValue: "9",
              records: [
                { title: "Privilege escalation log", meta: "7 high-scope changes in the last 24 hours", status: "Tracked" },
                { title: "Compliance export package", meta: "Weekly archive bundle is pending", status: "Queued" },
                { title: "Suspicious login replay", meta: "3 events need security review", status: "Review" },
              ],
              focusAreas: ["Audit trail", "Compliance", "Exports", "Exceptions"],
            }
      )
    }
    if (routeSet.has("incidents") || /incident|alert|outage|incident response|告警|故障|异常|应急/.test(promptText)) {
      pages.push(
        isCn
          ? {
              route: "incidents",
              label: "Incidents",
              headline: "异常与恢复指挥台",
              subheadline: "把告警、影响面、负责人和恢复动作放到同一个响应面板里。",
              summary: "这页体现内部控制平面的应急与恢复工作流。",
              metricLabel: "活跃事件",
              metricValue: "4",
              insightLabel: "恢复中",
              insightValue: "1",
              records: [
                { title: "预览运行异常", meta: "影响中国区预览 12 分钟", status: "Mitigating" },
                { title: "权限同步延迟", meta: "已切换备用同步通道", status: "Stabilizing" },
                { title: "审计导出队列拥堵", meta: "等待批处理窗口恢复", status: "Monitoring" },
              ],
              focusAreas: ["Alerts", "Impact", "Recovery", "Postmortem"],
            }
          : {
              route: "incidents",
              label: "Incidents",
              headline: "Incident command center",
              subheadline: "Keep alerts, impact assessment, responders, and recovery work in one response surface.",
              summary: "This route carries the incident and recovery workflow of the control plane.",
              metricLabel: "Active incidents",
              metricValue: "4",
              insightLabel: "Recovering",
              insightValue: "1",
              records: [
                { title: "Preview runtime incident", meta: "CN preview affected for 12 minutes", status: "Mitigating" },
                { title: "Permission sync lag", meta: "Fallback sync lane is active", status: "Stabilizing" },
                { title: "Audit export congestion", meta: "Waiting on batch window recovery", status: "Monitoring" },
              ],
              focusAreas: ["Alerts", "Impact", "Recovery", "Postmortem"],
            }
      )
    }
    return pages
  }

  if (archetype === "crm") {
    return isCn
      ? [
          {
            route: "dashboard",
            label: "Dashboard",
            headline: "销售与交付控制台",
            subheadline: "把线索、成交、升级与交付并到一个运营后台里。",
            summary: "更像 CRM 控制台，而不是普通任务页。",
            metricLabel: "当月 pipeline",
            metricValue: "¥842k",
            insightLabel: "成交预测",
            insightValue: "68%",
            records: [
              { title: "华星科技年度续约", meta: "负责人 张伟 · 等待预算确认", status: "Proposal" },
              { title: "景曜智能升级包", meta: "负责人 王芳 · 演示已完成", status: "Qualified" },
              { title: "浩川制造复购机会", meta: "负责人 陈晨 · 交付侧已同步", status: "Expansion" },
            ],
            focusAreas: ["Leads", "Pipeline", "Customers", "Automations"],
          },
          {
            route: "leads",
            label: "Leads",
            headline: "线索池",
            subheadline: "按来源、意向和负责人拆开线索，而不是都堆在首页。",
            summary: "用于承接入站咨询、销售跟进和演示安排。",
            metricLabel: "高意向线索",
            metricValue: "19",
            insightLabel: "待首联",
            insightValue: "7",
            records: [
              { title: "官网咨询 · AI 代码平台", meta: "来源 官网表单 · 预算 18w", status: "New" },
              { title: "渠道推荐 · 销售后台", meta: "来源 合作伙伴 · 预算 9w", status: "Review" },
              { title: "老客户扩容 · API 平台", meta: "来源 CSM · 预算 6w", status: "Hot" },
            ],
            focusAreas: ["Inbound", "Owner queue", "Qualification", "Demo slots"],
          },
          {
            route: "pipeline",
            label: "Pipeline",
            headline: "成交推进面板",
            subheadline: "清楚看见每个商机在哪个阶段卡住。",
            summary: "重点是阶段推进、风险识别和负责人节奏。",
            metricLabel: "本周推进",
            metricValue: "14",
            insightLabel: "风险单",
            insightValue: "3",
            records: [
              { title: "首次沟通 -> 方案确认", meta: "3 个机会本周跨阶段", status: "Moving" },
              { title: "报价 -> 采购", meta: "2 个项目等待法务", status: "Blocked" },
              { title: "成交 -> 交付", meta: "4 个项目进入 onboarding", status: "Won" },
            ],
            focusAreas: ["Stage health", "Risk flags", "Forecast", "Handoff"],
          },
          ...(routeSet.has("orders")
            ? [
                {
                  route: "orders",
                  label: "Orders",
                  headline: "报价审批与订单推进",
                  subheadline: "把报价审批、订单确认、回款同步和交付移交流程放到一个订单工作台里。",
                  summary: "这页负责把 CRM 从商机推进延伸到报价与订单执行，不该退回通用列表。",
                  metricLabel: "待处理订单",
                  metricValue: "11",
                  insightLabel: "待审批报价",
                  insightValue: "4",
                  records: [
                    { title: "智链云 · 企业版续约", meta: "报价待财务签批 · 金额 ¥168k", status: "Approval" },
                    { title: "北辰科技 · 新签订单", meta: "采购单已回传 · 等待回款确认", status: "Pending payment" },
                    { title: "远航数据 · 扩容加购", meta: "交付移交同步到 CSM", status: "Handoff" },
                  ],
                  focusAreas: ["Quote approvals", "Order desk", "Payment sync", "Handoff"],
                },
              ]
            : []),
          {
            route: "customers",
            label: "Customers",
            headline: "客户与账户视图",
            subheadline: "把签约客户、续约、扩容和交付健康度放到同一层。",
            summary: "这页更像账户运营控制台。",
            metricLabel: "活跃客户",
            metricValue: "42",
            insightLabel: "续约窗口",
            insightValue: "11",
            records: [
              { title: "合一供应链", meta: "下月续约 · 需确认席位扩容", status: "Renewal" },
              { title: "景曜智能", meta: "本周上线 · 已开通管理员", status: "Onboarding" },
              { title: "远航数据", meta: "成功团队推进复购", status: "Expansion" },
            ],
            focusAreas: ["Renewals", "Success notes", "Seat growth", "Account health"],
          },
          {
            route: "automations",
            label: "Automations",
            headline: "销售自动化与提醒",
            subheadline: "把催跟进、提醒、报价审批和交付同步做成规则。",
            summary: "体现 CRM 的自动化能力，不是只靠人工记忆。",
            metricLabel: "自动化规则",
            metricValue: "12",
            insightLabel: "命中率",
            insightValue: "91%",
            records: [
              { title: "3 天未跟进自动提醒", meta: "触达销售与负责人", status: "Active" },
              { title: "成交后开通交付群", meta: "同步 CSM 与交付 PM", status: "Active" },
              { title: "报价审批超时提醒", meta: "财务与销售主管双通知", status: "Testing" },
            ],
            focusAreas: ["Reminders", "Approval flow", "Customer handoff", "Agent tasks"],
          },
          {
            route: "reports",
            label: "Reports",
            headline: "销售预测与阶段报表",
            subheadline: "把 pipeline、赢单率和负责人节奏沉到一个分析视图里。",
            summary: "这页负责把 CRM 从列表推进到经营视角。",
            metricLabel: "季度预测",
            metricValue: "¥3.8M",
            insightLabel: "高风险机会",
            insightValue: "6",
            records: [
              { title: "华东区域 pipeline", meta: "提案转成交率 34%", status: "Healthy" },
              { title: "续约与扩容", meta: "11 个账户在 45 天窗口内", status: "Tracked" },
              { title: "负责人节奏", meta: "2 位销售跟进延迟超过 3 天", status: "Alert" },
            ],
            focusAreas: ["Forecast", "Win rate", "Pipeline mix", "Owner cadence"],
          },
        ]
      : [
          {
            route: "dashboard",
            label: "Dashboard",
            headline: "Sales and delivery console",
            subheadline: "Keep leads, closes, expansions, and onboarding in one workspace.",
            summary: "This should read like a CRM control room, not a task board.",
            metricLabel: "Monthly pipeline",
            metricValue: "$118k",
            insightLabel: "Win forecast",
            insightValue: "68%",
            records: [
              { title: "Huaxing renewal", meta: "Owner Liam · budget confirmation pending", status: "Proposal" },
              { title: "Jingyao expansion", meta: "Owner Emma · demo complete", status: "Qualified" },
              { title: "Northstar follow-up", meta: "Owner Mason · delivery sync complete", status: "Expansion" },
            ],
            focusAreas: ["Leads", "Pipeline", "Customers", "Automations"],
          },
          {
            route: "leads",
            label: "Leads",
            headline: "Lead pool",
            subheadline: "Separate inbound, intent, and owners instead of overloading the home page.",
            summary: "This is where website leads and sales follow-up live.",
            metricLabel: "High-intent leads",
            metricValue: "19",
            insightLabel: "Awaiting first touch",
            insightValue: "7",
            records: [
              { title: "Inbound · AI coding platform", meta: "Source website · budget $26k", status: "New" },
              { title: "Partner referral · CRM workspace", meta: "Source partner network · budget $14k", status: "Review" },
              { title: "Expansion · API platform", meta: "Source CSM · budget $8k", status: "Hot" },
            ],
            focusAreas: ["Inbound", "Owner queue", "Qualification", "Demo slots"],
          },
          {
            route: "pipeline",
            label: "Pipeline",
            headline: "Deal progression board",
            subheadline: "See exactly which stage each opportunity is stuck in.",
            summary: "The focus here is stage movement, risk, and cadence.",
            metricLabel: "Advances this week",
            metricValue: "14",
            insightLabel: "At-risk deals",
            insightValue: "3",
            records: [
              { title: "First touch -> proposal", meta: "3 opportunities moved stages", status: "Moving" },
              { title: "Proposal -> procurement", meta: "2 accounts waiting on legal", status: "Blocked" },
              { title: "Close -> onboarding", meta: "4 customers entered onboarding", status: "Won" },
            ],
            focusAreas: ["Stage health", "Risk flags", "Forecast", "Handoff"],
          },
          ...(routeSet.has("orders")
            ? [
                {
                  route: "orders",
                  label: "Orders",
                  headline: "Quote approvals and order execution",
                  subheadline: "Keep quote review, order confirmation, payment sync, and delivery handoff in one order desk.",
                  summary: "This route extends the CRM beyond opportunity tracking into order execution.",
                  metricLabel: "Open orders",
                  metricValue: "11",
                  insightLabel: "Quotes awaiting approval",
                  insightValue: "4",
                  records: [
                    { title: "Zhilink Cloud · enterprise renewal", meta: "Quote pending finance sign-off · $24k", status: "Approval" },
                    { title: "Northstar Tech · new order", meta: "PO received · waiting for payment confirmation", status: "Pending payment" },
                    { title: "Farway Data · seat expansion", meta: "Delivery handoff synced with CSM", status: "Handoff" },
                  ],
                  focusAreas: ["Quote approvals", "Order desk", "Payment sync", "Handoff"],
                },
              ]
            : []),
          {
            route: "customers",
            label: "Customers",
            headline: "Customer account view",
            subheadline: "Put renewals, onboarding, expansions, and account health in one place.",
            summary: "This page should feel like account operations.",
            metricLabel: "Active customers",
            metricValue: "42",
            insightLabel: "Renewal windows",
            insightValue: "11",
            records: [
              { title: "Heyi Supply", meta: "Renews next month · seats may expand", status: "Renewal" },
              { title: "Jingyao AI", meta: "Live this week · admin provisioned", status: "Onboarding" },
              { title: "Farway Data", meta: "CS team is driving an upsell", status: "Expansion" },
            ],
            focusAreas: ["Renewals", "Success notes", "Seat growth", "Account health"],
          },
          {
            route: "automations",
            label: "Automations",
            headline: "Sales automations",
            subheadline: "Turn reminders, quote approvals, and handoff rules into workflows.",
            summary: "This is how the CRM stops relying on memory alone.",
            metricLabel: "Active automations",
            metricValue: "12",
            insightLabel: "Hit rate",
            insightValue: "91%",
            records: [
              { title: "3-day no-follow-up reminder", meta: "Messages sales and the owner", status: "Active" },
              { title: "Create onboarding lane after close", meta: "Syncs CSM and PM", status: "Active" },
              { title: "Quote approval timeout notice", meta: "Alerts finance and sales lead", status: "Testing" },
            ],
            focusAreas: ["Reminders", "Approval flow", "Customer handoff", "Agent tasks"],
          },
          {
            route: "reports",
            label: "Reports",
            headline: "Forecasting and stage reports",
            subheadline: "Pull pipeline, win rate, and owner cadence into one operating view.",
            summary: "This page turns the CRM into a management surface, not just a list system.",
            metricLabel: "Quarterly forecast",
            metricValue: "$540k",
            insightLabel: "At-risk deals",
            insightValue: "6",
            records: [
              { title: "East region pipeline", meta: "Proposal-to-close rate at 34%", status: "Healthy" },
              { title: "Renewal and expansion lane", meta: "11 accounts in the next 45-day window", status: "Tracked" },
              { title: "Owner cadence", meta: "2 reps are behind on follow-up", status: "Alert" },
            ],
            focusAreas: ["Forecast", "Win rate", "Pipeline mix", "Owner cadence"],
          },
        ]
  }

  if (archetype === "api_platform") {
    const apiText = String(spec.prompt ?? spec.title ?? "").toLowerCase()
    const includeUsage =
      /usage|metering|billing|rate limit|rate-limit|quota|计量|用量|账单|限流|配额/.test(apiText) ||
      spec.modules.some((item) => /usage|metering|billing|计量|用量|账单|限流/.test(item.toLowerCase()))
    return isCn
      ? [
          {
            route: "dashboard",
            label: "Dashboard",
            headline: "接口与运行态控制台",
            subheadline: "把 endpoints、日志、鉴权和环境切换放进一个开发者平台里。",
            summary: "重点是开发者运营与运行诊断，不是普通后台。",
            metricLabel: "本周请求量",
            metricValue: "18.2M",
            insightLabel: "错误率",
            insightValue: "0.12%",
            records: [
              { title: "支付接口集群", meta: "99.97% SLA · 峰值稳定", status: "Healthy" },
              { title: "Webhook 通知链路", meta: "平均延迟 182ms", status: "Monitored" },
              { title: "Agent runtime API", meta: "今日新增 4 个 consumers", status: "Growing" },
            ],
            focusAreas: ["Endpoints", "Logs", "Auth", "Environments"],
          },
          {
            route: "endpoints",
            label: "Endpoints",
            headline: "接口目录",
            subheadline: "按服务、版本和消费量组织 API，而不是只给一份文档。",
            summary: "更像 API catalog 与控制台。",
            metricLabel: "在线接口",
            metricValue: "64",
            insightLabel: "新版本",
            insightValue: "5",
            records: [
              { title: "POST /v1/projects/generate", meta: "生成应用主入口", status: "v1" },
              { title: "GET /v1/runs", meta: "返回运行链路与日志摘要", status: "stable" },
              { title: "POST /v1/auth/issue-token", meta: "发放 workspace 访问令牌", status: "beta" },
            ],
            focusAreas: ["Versioning", "Owners", "Usage", "SDK mapping"],
          },
          {
            route: "logs",
            label: "Logs",
            headline: "日志与诊断检索",
            subheadline: "把异常、延迟、trace 和最近发布一起拉通。",
            summary: "这一页要看起来像 observability 工作区。",
            metricLabel: "异常日志",
            metricValue: "24",
            insightLabel: "平均延迟",
            insightValue: "182ms",
            records: [
              { title: "preview-runtime WARN", meta: "Sandbox boot took 2.3s", status: "Notice" },
              { title: "auth-service ERROR", meta: "2 OAuth callbacks timed out", status: "Error" },
              { title: "billing-webhook INFO", meta: "Retries recovered all failed events", status: "Recovered" },
            ],
            focusAreas: ["Search", "Trace", "Latency", "Recovery"],
          },
          {
            route: "auth",
            label: "Auth",
            headline: "鉴权与令牌策略",
            subheadline: "把 keys、scopes、成员访问和环境权限放到同一处。",
            summary: "更像开发者权限中心。",
            metricLabel: "活跃 keys",
            metricValue: "128",
            insightLabel: "高权限 scope",
            insightValue: "17",
            records: [
              { title: "workspace:write", meta: "用于 AI 修改与文件写入", status: "Scoped" },
              { title: "preview:launch", meta: "仅供 preview worker 使用", status: "Internal" },
              { title: "billing:read", meta: "只读运营报表消费方", status: "Restricted" },
            ],
            focusAreas: ["Scopes", "Members", "Policies", "Secrets"],
          },
          {
            route: "environments",
            label: "Environments",
            headline: "环境与发布轨道",
            subheadline: "开发、预发、生产和区域部署不再混在一起。",
            summary: "体现平台工程与多环境控制能力。",
            metricLabel: "运行环境",
            metricValue: "4",
            insightLabel: "最近发布",
            insightValue: "12m ago",
            records: [
              { title: "dev / cn", meta: "CloudBase preview runtime", status: "Ready" },
              { title: "staging / global", meta: "Canonical preview on Vercel", status: "Stable" },
              { title: "prod / global", meta: "Pending sandbox verification", status: "Queued" },
            ],
            focusAreas: ["Deploy targets", "Runtime", "Secrets", "Rollbacks"],
          },
          {
            route: "webhooks",
            label: "Webhooks",
            headline: "Webhook 与回调交付",
            subheadline: "把事件订阅、重试投递和失败恢复放进同一条交付轨道。",
            summary: "这一页体现 API 产品的事件驱动能力。",
            metricLabel: "活跃订阅",
            metricValue: "37",
            insightLabel: "重试成功率",
            insightValue: "96%",
            records: [
              { title: "billing.invoice.paid", meta: "目标 Slack + CRM 自动化", status: "Healthy" },
              { title: "project.preview.ready", meta: "失败事件进入回放队列", status: "Retrying" },
              { title: "auth.token.revoked", meta: "同步安全日志和成员通知", status: "Live" },
            ],
            focusAreas: ["Subscriptions", "Retries", "Delivery logs", "Environment routing"],
          },
          {
            route: "docs",
            label: "Docs",
            headline: "开发者文档中心",
            subheadline: "让 API 参考、SDK 指南、接入说明和认证策略在同一个开发者入口里。",
            summary: "这页是开发者 onboarding 与文档协同中枢。",
            metricLabel: "文档页面",
            metricValue: "27",
            insightLabel: "SDK 覆盖",
            insightValue: "6",
            records: [
              { title: "快速开始", meta: "3 分钟完成首个请求", status: "Popular" },
              { title: "OAuth 接入指南", meta: "覆盖 scopes、回调和环境区分", status: "Core" },
              { title: "SDK 示例", meta: "Node / Python / Webhook 示例已同步", status: "Updated" },
            ],
            focusAreas: ["Quickstart", "Reference", "SDK", "Onboarding"],
          },
          ...(includeUsage
            ? [
                {
                  route: "usage",
                  label: "Usage",
                  headline: "用量与计量看板",
                  subheadline: "把请求量、账单窗口、限流状态和高消耗接口放在一起看。",
                  summary: "这页体现 API 产品的商业化与用量控制能力。",
                  metricLabel: "本周请求量",
                  metricValue: "18.2M",
                  insightLabel: "账单窗口",
                  insightValue: "Open",
                  records: [
                    { title: "生成接口", meta: "本周调用 4.8M", status: "High traffic" },
                    { title: "Webhook 重放", meta: "计费外请求已排除", status: "Validated" },
                    { title: "高频 consumer", meta: "3 个租户接近限流阈值", status: "Watched" },
                  ],
                  focusAreas: ["Usage", "Billing", "Rate limits", "Tenants"],
                },
              ]
            : []),
        ]
      : [
          {
            route: "dashboard",
            label: "Dashboard",
            headline: "API and runtime command center",
            subheadline: "Bring endpoints, logs, auth, and environments into one developer platform.",
            summary: "This should read like a developer product, not a generic admin.",
            metricLabel: "Weekly requests",
            metricValue: "18.2M",
            insightLabel: "Error rate",
            insightValue: "0.12%",
            records: [
              { title: "Payments cluster", meta: "99.97% SLA · stable peak traffic", status: "Healthy" },
              { title: "Webhook delivery rail", meta: "182ms median latency", status: "Monitored" },
              { title: "Agent runtime API", meta: "4 new consumers today", status: "Growing" },
            ],
            focusAreas: ["Endpoints", "Logs", "Auth", "Environments"],
          },
          {
            route: "endpoints",
            label: "Endpoints",
            headline: "Endpoint catalog",
            subheadline: "Organize APIs by service, version, and traffic instead of shipping docs alone.",
            summary: "This page should feel like an API catalog and control room.",
            metricLabel: "Live endpoints",
            metricValue: "64",
            insightLabel: "New versions",
            insightValue: "5",
            records: [
              { title: "POST /v1/projects/generate", meta: "Primary app generation entry", status: "v1" },
              { title: "GET /v1/runs", meta: "Returns runtime and log summaries", status: "stable" },
              { title: "POST /v1/auth/issue-token", meta: "Issues workspace access tokens", status: "beta" },
            ],
            focusAreas: ["Versioning", "Owners", "Usage", "SDK mapping"],
          },
          {
            route: "logs",
            label: "Logs",
            headline: "Logs and diagnostics",
            subheadline: "Pull together errors, latency, traces, and releases in one place.",
            summary: "This should feel like observability tooling.",
            metricLabel: "Exception logs",
            metricValue: "24",
            insightLabel: "Median latency",
            insightValue: "182ms",
            records: [
              { title: "preview-runtime WARN", meta: "Sandbox boot took 2.3s", status: "Notice" },
              { title: "auth-service ERROR", meta: "2 OAuth callbacks timed out", status: "Error" },
              { title: "billing-webhook INFO", meta: "Retries recovered all failed events", status: "Recovered" },
            ],
            focusAreas: ["Search", "Trace", "Latency", "Recovery"],
          },
          {
            route: "auth",
            label: "Auth",
            headline: "Auth and token policies",
            subheadline: "Put keys, scopes, memberships, and environment access in one place.",
            summary: "This is the developer access layer.",
            metricLabel: "Active keys",
            metricValue: "128",
            insightLabel: "Privileged scopes",
            insightValue: "17",
            records: [
              { title: "workspace:write", meta: "Used for AI edits and file writes", status: "Scoped" },
              { title: "preview:launch", meta: "Reserved for preview worker access", status: "Internal" },
              { title: "billing:read", meta: "Read-only reporting consumer", status: "Restricted" },
            ],
            focusAreas: ["Scopes", "Members", "Policies", "Secrets"],
          },
          {
            route: "environments",
            label: "Environments",
            headline: "Environment rail",
            subheadline: "Keep dev, staging, production, and region lanes clearly separated.",
            summary: "This is where platform engineering becomes visible.",
            metricLabel: "Runtime lanes",
            metricValue: "4",
            insightLabel: "Latest release",
            insightValue: "12m ago",
            records: [
              { title: "dev / cn", meta: "CloudBase preview runtime", status: "Ready" },
              { title: "staging / global", meta: "Canonical preview on Vercel", status: "Stable" },
              { title: "prod / global", meta: "Pending sandbox verification", status: "Queued" },
            ],
            focusAreas: ["Deploy targets", "Runtime", "Secrets", "Rollbacks"],
          },
          {
            route: "webhooks",
            label: "Webhooks",
            headline: "Webhook delivery rail",
            subheadline: "Keep event subscriptions, retry flows, and delivery recovery in one operating surface.",
            summary: "This is the event-driven layer of the API product.",
            metricLabel: "Active subscriptions",
            metricValue: "37",
            insightLabel: "Retry recovery",
            insightValue: "96%",
            records: [
              { title: "billing.invoice.paid", meta: "Targets Slack + CRM automations", status: "Healthy" },
              { title: "project.preview.ready", meta: "Failed deliveries enter replay queue", status: "Retrying" },
              { title: "auth.token.revoked", meta: "Syncs with security logs and member notices", status: "Live" },
            ],
            focusAreas: ["Subscriptions", "Retries", "Delivery logs", "Environment routing"],
          },
          {
            route: "docs",
            label: "Docs",
            headline: "Developer docs center",
            subheadline: "Keep API reference, SDK guides, onboarding, and auth policies in one developer surface.",
            summary: "This page should feel like the docs and onboarding hub for an API product.",
            metricLabel: "Doc pages",
            metricValue: "27",
            insightLabel: "SDK coverage",
            insightValue: "6",
            records: [
              { title: "Quickstart", meta: "3-minute first request path", status: "Popular" },
              { title: "OAuth guide", meta: "Scopes, callbacks, and environment rules", status: "Core" },
              { title: "SDK examples", meta: "Node / Python / webhook examples stay synced", status: "Updated" },
            ],
            focusAreas: ["Quickstart", "Reference", "SDK", "Onboarding"],
          },
          ...(includeUsage
            ? [
                {
                  route: "usage",
                  label: "Usage",
                  headline: "Usage and metering board",
                  subheadline: "Bring request volume, billing windows, rate limits, and heavy consumers into one surface.",
                  summary: "This page should make API monetization and metering visible.",
                  metricLabel: "Weekly requests",
                  metricValue: "18.2M",
                  insightLabel: "Billing window",
                  insightValue: "Open",
                  records: [
                    { title: "Generate API", meta: "4.8M requests this week", status: "High traffic" },
                    { title: "Webhook replay", meta: "Non-billable traffic excluded", status: "Validated" },
                    { title: "Heavy consumers", meta: "3 tenants near rate thresholds", status: "Watched" },
                  ],
                  focusAreas: ["Usage", "Billing", "Rate limits", "Tenants"],
                },
              ]
            : []),
        ]
  }

  if (archetype === "marketing_admin") {
    return isCn
      ? [
          {
            route: "dashboard",
            label: "Dashboard",
            headline: "官网与后台联动控制台",
            subheadline: "让官网、下载、文档和后台工作区成为同一个产品体系。",
            summary: "这条线不再只是 landing page，而是增长与管理联动。",
            metricLabel: "本周访问",
            metricValue: "82k",
            insightLabel: "转化率",
            insightValue: "5.8%",
            records: [
              { title: "官网首页 CTA", meta: "下载转化提升 12%", status: "Live" },
              { title: "下载中心", meta: "Android / iOS / Docs 三轨联动", status: "Healthy" },
              { title: "后台配置", meta: "文案、版本与套餐已同步", status: "Synced" },
            ],
            focusAreas: ["Website", "Downloads", "Docs", "Admin"],
          },
          {
            route: "website",
            label: "Website",
            headline: "官网结构总览",
            subheadline: "管理 Hero、功能区、客户背书和 CTA，而不是单独改静态页面。",
            summary: "这页体现官网运营和转化管理。",
            metricLabel: "活跃版块",
            metricValue: "9",
            insightLabel: "首屏转化",
            insightValue: "6.2%",
            records: [
              { title: "Hero 主叙事", meta: "中国版 AI 产品定位已收口", status: "Ready" },
              { title: "功能亮点区", meta: "展示 editor / runs / templates", status: "Updated" },
              { title: "客户背书区", meta: "新增 4 组案例卡片", status: "Queued" },
            ],
            focusAreas: ["Hero", "Social proof", "CTA", "SEO"],
          },
          {
            route: "pricing",
            label: "Pricing",
            headline: "定价与权益结构",
            subheadline: "把套餐、设备覆盖、分发权益和升级文案放到一个转化面里。",
            summary: "这页承接转化和权益表达，不只是价格表。",
            metricLabel: "套餐层级",
            metricValue: "4",
            insightLabel: "升级转化",
            insightValue: "8.4%",
            records: [
              { title: "探索版 vs 启动版", meta: "突出生成深度和导出边界", status: "Live" },
              { title: "专业版权益说明", meta: "增加交付与分发能力描述", status: "Updated" },
              { title: "企业提案档", meta: "等待销售补充案例素材", status: "Queued" },
            ],
            focusAreas: ["Plan tiers", "Entitlements", "Upgrade copy", "Conversion"],
          },
          {
            route: "downloads",
            label: "Downloads",
            headline: "下载分发中心",
            subheadline: "统一 Android、iOS、文档和安装说明。",
            summary: "这页更像产品分发中心。",
            metricLabel: "下载转化",
            metricValue: "18.4%",
            insightLabel: "文档触达",
            insightValue: "42%",
            records: [
              { title: "Android 包", meta: "云端镜像已同步", status: "Ready" },
              { title: "iOS TestFlight", meta: "本周演示包已更新", status: "Live" },
              { title: "安装文档", meta: "新手引导覆盖 3 个平台", status: "Updated" },
            ],
            focusAreas: ["Packages", "Install guide", "Docs", "Device coverage"],
          },
          {
            route: "docs",
            label: "Docs",
            headline: "文档中心",
            subheadline: "让产品文档、API 文档和 onboarding 指南成为同一套内容系统。",
            summary: "承接下载后和销售前的知识链路。",
            metricLabel: "文档页面",
            metricValue: "27",
            insightLabel: "搜到答案率",
            insightValue: "87%",
            records: [
              { title: "快速开始", meta: "3 分钟完成项目接入", status: "Popular" },
              { title: "环境配置", meta: "Vercel / CloudBase / Supabase", status: "Core" },
              { title: "团队协作", meta: "角色、权限、分享链路", status: "Drafting" },
            ],
            focusAreas: ["Quickstart", "Reference", "Guides", "Search"],
          },
          {
            route: "changelog",
            label: "Changelog",
            headline: "更新日志与版本节奏",
            subheadline: "把版本说明、平台更新和发版节奏公开整理成一条线。",
            summary: "这页负责把产品更新转成可阅读、可追踪的叙事。",
            metricLabel: "最近版本",
            metricValue: "v0.9.4",
            insightLabel: "近 30 天更新",
            insightValue: "12",
            records: [
              { title: "增加微信支付二维码页", meta: "支付链路现在支持自动拉起二维码", status: "Published" },
              { title: "预览链路切 canonical", meta: "国际/国内打开预览更稳定", status: "Published" },
              { title: "生成器 archetype 分层", meta: "不同 prompt 开始明显分化", status: "Rolling out" },
            ],
            focusAreas: ["Release notes", "Version history", "Platform updates", "Ship rhythm"],
          },
          {
            route: "admin",
            label: "Admin",
            headline: "后台配置台",
            subheadline: "在同一个地方改官网内容、版本、套餐和投放策略。",
            summary: "后台与官网联动，才像真正产品。",
            metricLabel: "待发布改动",
            metricValue: "6",
            insightLabel: "同步状态",
            insightValue: "healthy",
            records: [
              { title: "定价文案更新", meta: "待同步到首页与下载页", status: "Review" },
              { title: "版本发布说明", meta: "等待运营确认发布时间", status: "Queued" },
              { title: "表单与转化策略", meta: "已绑定市场追踪参数", status: "Live" },
            ],
            focusAreas: ["CMS", "Releases", "Pricing", "Growth ops"],
          },
        ]
      : [
          {
            route: "dashboard",
            label: "Dashboard",
            headline: "Website + admin command center",
            subheadline: "Treat website, downloads, docs, and admin as one product surface.",
            summary: "This moves the output beyond a landing page into a growth system.",
            metricLabel: "Weekly visits",
            metricValue: "82k",
            insightLabel: "Conversion rate",
            insightValue: "5.8%",
            records: [
              { title: "Homepage CTA rail", meta: "Download conversion up 12%", status: "Live" },
              { title: "Download center", meta: "Android / iOS / docs are linked", status: "Healthy" },
              { title: "Admin settings", meta: "Copy, releases, and pricing stay synced", status: "Synced" },
            ],
            focusAreas: ["Website", "Downloads", "Docs", "Admin"],
          },
          {
            route: "website",
            label: "Website",
            headline: "Website structure",
            subheadline: "Manage hero, proof, features, and CTA instead of editing a static page.",
            summary: "This page should feel like marketing operations.",
            metricLabel: "Active sections",
            metricValue: "9",
            insightLabel: "Hero conversion",
            insightValue: "6.2%",
            records: [
              { title: "Hero narrative", meta: "Positioning is now aligned", status: "Ready" },
              { title: "Feature rail", meta: "Now highlights editor / runs / templates", status: "Updated" },
              { title: "Proof section", meta: "4 new customer cards queued", status: "Queued" },
            ],
            focusAreas: ["Hero", "Social proof", "CTA", "SEO"],
          },
          {
            route: "pricing",
            label: "Pricing",
            headline: "Pricing and entitlement structure",
            subheadline: "Bring plans, device coverage, distribution rights, and upgrade messaging into one surface.",
            summary: "This route handles conversion and entitlement framing, not just a price list.",
            metricLabel: "Plan tiers",
            metricValue: "4",
            insightLabel: "Upgrade conversion",
            insightValue: "8.4%",
            records: [
              { title: "Explorer vs Starter", meta: "Highlights generation depth and export boundaries", status: "Live" },
              { title: "Pro entitlements", meta: "Expanded delivery and distribution messaging", status: "Updated" },
              { title: "Enterprise proposal rail", meta: "Waiting on sales proof assets", status: "Queued" },
            ],
            focusAreas: ["Plan tiers", "Entitlements", "Upgrade copy", "Conversion"],
          },
          {
            route: "downloads",
            label: "Downloads",
            headline: "Distribution hub",
            subheadline: "Unify Android, iOS, docs, and install guidance.",
            summary: "This is a distribution surface, not just a pair of buttons.",
            metricLabel: "Download conversion",
            metricValue: "18.4%",
            insightLabel: "Docs reach",
            insightValue: "42%",
            records: [
              { title: "Android package", meta: "Mirrors synced", status: "Ready" },
              { title: "iOS TestFlight", meta: "Latest demo build published", status: "Live" },
              { title: "Install docs", meta: "Covers 3 setup paths", status: "Updated" },
            ],
            focusAreas: ["Packages", "Install guide", "Docs", "Device coverage"],
          },
          {
            route: "docs",
            label: "Docs",
            headline: "Docs center",
            subheadline: "Keep product docs, API docs, and onboarding guides in one system.",
            summary: "This page connects pre-sale and post-download education.",
            metricLabel: "Doc pages",
            metricValue: "27",
            insightLabel: "Search success",
            insightValue: "87%",
            records: [
              { title: "Quickstart", meta: "3-minute setup path", status: "Popular" },
              { title: "Environment guide", meta: "Vercel / CloudBase / Supabase", status: "Core" },
              { title: "Team collaboration", meta: "Roles, access, and sharing", status: "Drafting" },
            ],
            focusAreas: ["Quickstart", "Reference", "Guides", "Search"],
          },
          {
            route: "changelog",
            label: "Changelog",
            headline: "Release notes and ship rhythm",
            subheadline: "Organize version notes, platform updates, and release cadence into one visible stream.",
            summary: "This route turns product changes into readable release storytelling.",
            metricLabel: "Latest version",
            metricValue: "v0.9.4",
            insightLabel: "Updates in 30 days",
            insightValue: "12",
            records: [
              { title: "WeChat Pay QR flow", meta: "Hosted payment now renders QR directly", status: "Published" },
              { title: "Canonical preview routing", meta: "Intl and CN open preview are more stable", status: "Published" },
              { title: "Archetype generation split", meta: "Prompt outputs now diverge more clearly", status: "Rolling out" },
            ],
            focusAreas: ["Release notes", "Version history", "Platform updates", "Ship rhythm"],
          },
          {
            route: "admin",
            label: "Admin",
            headline: "Admin control room",
            subheadline: "Edit website content, releases, pricing, and growth rules in one place.",
            summary: "This is what turns a website into a product system.",
            metricLabel: "Pending changes",
            metricValue: "6",
            insightLabel: "Sync status",
            insightValue: "healthy",
            records: [
              { title: "Pricing copy update", meta: "Needs homepage + download sync", status: "Review" },
              { title: "Release notes", meta: "Waiting for ops publish window", status: "Queued" },
              { title: "Form and conversion rules", meta: "Tracking params are wired", status: "Live" },
            ],
            focusAreas: ["CMS", "Releases", "Pricing", "Growth ops"],
          },
        ]
  }

  if (archetype === "community") {
    return isCn
      ? [
          {
            route: "dashboard",
            label: "Dashboard",
            headline: "社区运营与反馈中枢",
            subheadline: "把帖子、反馈、成员分层和活动编排整理成一个社区 control plane。",
            summary: "这一类产品应该看起来像社区运营后台，而不是报表总览。",
            metricLabel: "本周新增反馈",
            metricValue: "128",
            insightLabel: "处理完成率",
            insightValue: "84%",
            records: [
              { title: "新版本下载体验建议", meta: "来源 Beta 用户群 · 高优先级", status: "Triaged" },
              { title: "路线图投票活跃", meta: "312 位成员参与投票", status: "Live" },
              { title: "活动报名同步", meta: "线下 meetup 已同步到社区", status: "Ready" },
            ],
            focusAreas: ["Feedback", "Members", "Events", "Moderation"],
          },
          {
            route: "feedback",
            label: "Feedback",
            headline: "反馈与路线图入口",
            subheadline: "把需求、Bug、建议按优先级和产品线整理，而不是扔进同一列表。",
            summary: "这是社区产品最关键的产品改进入口。",
            metricLabel: "待处理反馈",
            metricValue: "46",
            insightLabel: "进入路线图",
            insightValue: "12",
            records: [
              { title: "MornCursor 代码补全体验", meta: "希望更快切到 Code Tab", status: "Under review" },
              { title: "下载页设备引导", meta: "需要更明确的平台分发说明", status: "Planned" },
              { title: "社区身份勋章", meta: "希望给核心用户更强标识", status: "New" },
            ],
            focusAreas: ["Intake", "Priority", "Roadmap", "Replies"],
          },
          ...(routeSet.has("moderation")
            ? [
                {
                  route: "moderation",
                  label: "Moderation",
                  headline: "审核队列与社区治理",
                  subheadline: "把举报、敏感内容、社区规则和通知联动收进一个审核工作台里。",
                  summary: "这页是社区产品的安全与治理控制平面，不是设置页的附属面板。",
                  metricLabel: "待审核队列",
                  metricValue: "17",
                  insightLabel: "高风险案件",
                  insightValue: "3",
                  records: [
                    { title: "敏感词命中", meta: "帖子进入审核队列 · 需确认处理规则", status: "Queued" },
                    { title: "成员举报", meta: "3 条反馈等待治理动作", status: "Review" },
                    { title: "活动评论争议", meta: "需同步规则与公告说明", status: "Escalated" },
                  ],
                  focusAreas: ["Moderation queue", "Policy sync", "Reports", "Safety"],
                },
              ]
            : []),
          {
            route: "roadmap",
            label: "Roadmap",
            headline: "公开路线图与交付节奏",
            subheadline: "把已受理的反馈、版本计划和交付时间窗口公开整理。",
            summary: "这页体现社区产品的透明度和承诺节奏。",
            metricLabel: "公开事项",
            metricValue: "18",
            insightLabel: "本月交付",
            insightValue: "5",
            records: [
              { title: "MornCursor 代码预览优化", meta: "预计本周进入验证", status: "In progress" },
              { title: "下载站平台筛选", meta: "列入 4 月发布计划", status: "Planned" },
              { title: "成员勋章系统", meta: "正在设计展示层", status: "Research" },
            ],
            focusAreas: ["Roadmap", "Release notes", "ETA", "Public updates"],
          },
          {
            route: "members",
            label: "Members",
            headline: "成员与分层视图",
            subheadline: "区分核心用户、普通成员、候补测试者和管理员。",
            summary: "成员管理是社区和反馈产品的主工作流之一。",
            metricLabel: "活跃成员",
            metricValue: "2,431",
            insightLabel: "核心贡献者",
            insightValue: "84",
            records: [
              { title: "核心创作者", meta: "持续输出使用案例和建议", status: "Champion" },
              { title: "候补测试者", meta: "等待加入下个测试批次", status: "Queued" },
              { title: "社区管理员", meta: "负责审核与活动通知", status: "Active" },
            ],
            focusAreas: ["Segments", "Roles", "Invites", "Trust"],
          },
          {
            route: "events",
            label: "Events",
            headline: "活动与运营编排",
            subheadline: "把线上 AMA、线下 meetup、版本直播和反馈日统一管理。",
            summary: "活动页承接社区增长与留存，不只是内容展示。",
            metricLabel: "本月活动",
            metricValue: "6",
            insightLabel: "报名转化",
            insightValue: "38%",
            records: [
              { title: "MornSystem 直播发布会", meta: "预计 480 人报名", status: "Scheduled" },
              { title: "核心用户 AMA", meta: "整理 23 个高频问题", status: "Drafting" },
              { title: "城市 meetup", meta: "深圳站场地已确认", status: "Confirmed" },
            ],
            focusAreas: ["Calendar", "Invites", "Attendance", "Campaigns"],
          },
          {
            route: "posts",
            label: "Posts",
            headline: "帖子与公告流",
            subheadline: "把社区动态、公告和讨论串统一到一个内容流里。",
            summary: "这页承接社区内容节奏，不只是反馈列表。",
            metricLabel: "本周帖子",
            metricValue: "74",
            insightLabel: "公告点击率",
            insightValue: "28%",
            records: [
              { title: "MornSystem 迭代说明", meta: "面向核心用户的更新公告", status: "Pinned" },
              { title: "本周最佳实践合集", meta: "整理了 6 个应用案例", status: "Live" },
              { title: "功能投票总结", meta: "已同步到路线图页", status: "Synced" },
            ],
            focusAreas: ["Announcements", "Discussions", "Pinned updates", "Community feed"],
          },
          {
            route: "settings",
            label: "Settings",
            headline: "社区规则与权限",
            subheadline: "管理审核规则、成员权限、通知和自动化策略。",
            summary: "这页承接社区安全和运营边界。",
            metricLabel: "规则集",
            metricValue: "9",
            insightLabel: "自动化命中",
            insightValue: "92%",
            records: [
              { title: "敏感词审核", meta: "命中后自动进入 review queue", status: "Active" },
              { title: "成员邀请规则", meta: "限定 Beta 资格和邮箱域名", status: "Scoped" },
              { title: "活动提醒自动化", meta: "提前 24 小时推送通知", status: "Healthy" },
            ],
            focusAreas: ["Policies", "Automation", "Notifications", "Roles"],
          },
        ]
      : [
          {
            route: "dashboard",
            label: "Dashboard",
            headline: "Community operations control plane",
            subheadline: "Bring posts, feedback, member tiers, and events into one operating surface.",
            summary: "This archetype should feel like a community ops product, not a reporting dashboard.",
            metricLabel: "New feedback this week",
            metricValue: "128",
            insightLabel: "Resolution rate",
            insightValue: "84%",
            records: [
              { title: "New download UX request", meta: "Raised from the beta user group", status: "Triaged" },
              { title: "Roadmap voting is active", meta: "312 members voted this week", status: "Live" },
              { title: "Meetup enrollment synced", meta: "Offline event is in the ops calendar", status: "Ready" },
            ],
            focusAreas: ["Feedback", "Members", "Events", "Moderation"],
          },
          {
            route: "feedback",
            label: "Feedback",
            headline: "Feedback and roadmap intake",
            subheadline: "Sort requests, issues, and ideas by priority and product line instead of dumping them into one inbox.",
            summary: "This is the product-improvement engine for community apps.",
            metricLabel: "Open feedback",
            metricValue: "46",
            insightLabel: "Moved to roadmap",
            insightValue: "12",
            records: [
              { title: "MornCursor code completion flow", meta: "Users want faster Code Tab transitions", status: "Under review" },
              { title: "Download page device guide", meta: "Needs stronger platform install guidance", status: "Planned" },
              { title: "Member badge system", meta: "Power users want clearer identity markers", status: "New" },
            ],
            focusAreas: ["Intake", "Priority", "Roadmap", "Replies"],
          },
          ...(routeSet.has("moderation")
            ? [
                {
                  route: "moderation",
                  label: "Moderation",
                  headline: "Moderation queue and safety rail",
                  subheadline: "Keep reports, flagged content, policy updates, and member notices in one moderation desk.",
                  summary: "This is the safety control plane of the community product, not a side panel in settings.",
                  metricLabel: "Queued cases",
                  metricValue: "17",
                  insightLabel: "High-risk reports",
                  insightValue: "3",
                  records: [
                    { title: "Keyword policy hit", meta: "Post moved into moderation queue for review", status: "Queued" },
                    { title: "Member abuse report", meta: "3 issues are waiting on moderation action", status: "Review" },
                    { title: "Event comment escalation", meta: "Needs policy sync and announcement follow-up", status: "Escalated" },
                  ],
                  focusAreas: ["Moderation queue", "Policy sync", "Reports", "Safety"],
                },
              ]
            : []),
          {
            route: "roadmap",
            label: "Roadmap",
            headline: "Public roadmap and delivery rhythm",
            subheadline: "Turn accepted feedback into visible release planning and delivery windows.",
            summary: "This page makes the community product feel transparent and accountable.",
            metricLabel: "Public items",
            metricValue: "18",
            insightLabel: "Shipping this month",
            insightValue: "5",
            records: [
              { title: "MornCursor preview polish", meta: "Expected to enter validation this week", status: "In progress" },
              { title: "Download site platform filters", meta: "Included in April launch plan", status: "Planned" },
              { title: "Member badge system", meta: "Display system is under design", status: "Research" },
            ],
            focusAreas: ["Roadmap", "Release notes", "ETA", "Public updates"],
          },
          {
            route: "members",
            label: "Members",
            headline: "Member tiers and access",
            subheadline: "Separate champions, everyday members, beta testers, and admins.",
            summary: "Membership is a primary workflow in a community product.",
            metricLabel: "Active members",
            metricValue: "2,431",
            insightLabel: "Core contributors",
            insightValue: "84",
            records: [
              { title: "Champions", meta: "Power users sharing best practices", status: "Champion" },
              { title: "Beta waitlist", meta: "Queued for the next cohort", status: "Queued" },
              { title: "Community admins", meta: "Moderating and announcing events", status: "Active" },
            ],
            focusAreas: ["Segments", "Roles", "Invites", "Trust"],
          },
          {
            route: "events",
            label: "Events",
            headline: "Event and campaign orchestration",
            subheadline: "Manage livestreams, AMAs, meetups, and launch sessions in one place.",
            summary: "This route supports retention and growth, not just content display.",
            metricLabel: "Events this month",
            metricValue: "6",
            insightLabel: "Attendance conversion",
            insightValue: "38%",
            records: [
              { title: "MornSystem launch stream", meta: "Forecasting 480 signups", status: "Scheduled" },
              { title: "Champion AMA", meta: "23 top questions prepared", status: "Drafting" },
              { title: "City meetup", meta: "Venue confirmed for Shenzhen", status: "Confirmed" },
            ],
            focusAreas: ["Calendar", "Invites", "Attendance", "Campaigns"],
          },
          {
            route: "posts",
            label: "Posts",
            headline: "Posts and announcement stream",
            subheadline: "Keep announcements, discussion threads, and content highlights in one community flow.",
            summary: "This route handles content rhythm, not just feedback intake.",
            metricLabel: "Posts this week",
            metricValue: "74",
            insightLabel: "Announcement CTR",
            insightValue: "28%",
            records: [
              { title: "MornSystem iteration note", meta: "Pinned for core users", status: "Pinned" },
              { title: "Weekly best practices", meta: "Curates 6 community use cases", status: "Live" },
              { title: "Feature vote recap", meta: "Already synced to the roadmap", status: "Synced" },
            ],
            focusAreas: ["Announcements", "Discussions", "Pinned updates", "Community feed"],
          },
          {
            route: "settings",
            label: "Settings",
            headline: "Community rules and permissions",
            subheadline: "Manage moderation rules, member access, notifications, and automation policies.",
            summary: "This route defines safety and operating boundaries.",
            metricLabel: "Rule sets",
            metricValue: "9",
            insightLabel: "Automation hit rate",
            insightValue: "92%",
            records: [
              { title: "Keyword moderation", meta: "Matched posts move into review queues", status: "Active" },
              { title: "Invite rules", meta: "Scoped to beta domains and cohorts", status: "Scoped" },
              { title: "Event reminders", meta: "Scheduled 24 hours before sessions", status: "Healthy" },
            ],
            focusAreas: ["Policies", "Automation", "Notifications", "Roles"],
          },
        ]
  }

  return []
}

function getPreviewRouteBlueprints(spec: AppSpec, limit = 6) {
  return Array.isArray(spec.routeBlueprint)
    ? spec.routeBlueprint
        .filter((item) => item.path && item.path !== "/")
        .slice(0, limit)
        .map((item) => ({
          label: item.label,
          path: item.path,
          purpose: item.purpose,
          actions: item.primaryActions.slice(0, 3),
        }))
    : []
}

function getPreviewEntityBlueprints(spec: AppSpec, limit = 4) {
  return Array.isArray(spec.entityBlueprint)
    ? spec.entityBlueprint.slice(0, limit).map((item) => ({
        label: item.label,
        summary: item.summary,
        fields: item.fields.slice(0, 4),
        workflows: item.workflows.slice(0, 3),
      }))
    : []
}

function getPreviewModuleBlueprints(spec: AppSpec, limit = 6) {
  return Array.isArray(spec.moduleBlueprint)
    ? spec.moduleBlueprint.slice(0, limit).map((item) => ({
        label: item.label,
        summary: item.summary,
        capabilities: item.capabilityIds.slice(0, 3),
      }))
    : []
}

function getWorkflowSteps(spec: AppSpec) {
  return uniqueStrings(
    String(spec.appIntent?.primaryWorkflow ?? "")
      .split(/->|→/)
      .map((item) => sanitizeUiText(item))
      .filter(Boolean)
  )
}

function buildArchetypeConsoleWidgets(
  spec: AppSpec,
  current: ArchetypePageDefinition,
  relatedModules: Array<{ label: string; summary: string }>,
  relatedEntities: Array<{ label: string; workflows: string[] }>,
  workflowSteps: string[]
) {
  const isCn = spec.region === "cn"
  const archetype = getScaffoldArchetype(spec)
  const promptText = String(spec.prompt ?? spec.title ?? "").toLowerCase()
  const relatedEntityLabels = relatedEntities.map((item) => item.label)
  const relatedModuleLabels = relatedModules.map((item) => item.label)

  if (archetype === "crm") {
    const renewalHeavy = /renewal|renewals|onboarding|handoff|success|续约|交付|上线|客户成功/.test(promptText)
    const approvalsHeavy = /quote|quotes|approval|approvals|order|orders|报价|审批|订单/.test(promptText)
    const teamHeavy = /team target|team targets|quota|owner cadence|manager|负责人|团队目标|配额/.test(promptText)
    return {
      heroStats: renewalHeavy
        ? [
            { label: isCn ? "续约窗口" : "Renewal window", value: "11", note: isCn ? "未来 45 天到期账户" : "Accounts renewing in 45 days", tone: "#f59e0b" },
            { label: isCn ? "交付中客户" : "Onboarding accounts", value: "7", note: isCn ? "等待实施与上线" : "Waiting on launch handoff", tone: "#14b8a6" },
            { label: isCn ? "扩容机会" : "Expansion deals", value: "$188K", note: isCn ? "续约与增购并行" : "Renewal and upsell in flight", tone: "#2563eb" },
            { label: isCn ? "健康告警" : "Health alerts", value: "3", note: isCn ? "需 CSM 联动处理" : "Needs CSM attention", tone: "#7c3aed" },
          ]
        : approvalsHeavy
          ? [
              { label: isCn ? "待批报价" : "Pending quotes", value: "6", note: isCn ? "等待主管与财务确认" : "Waiting on sales and finance", tone: "#f59e0b" },
              { label: isCn ? "开放订单" : "Open orders", value: "11", note: isCn ? "报价转单与回款同步" : "Order execution in motion", tone: "#14b8a6" },
              { label: isCn ? "赢单收入" : "Revenue won", value: "$245K", note: isCn ? "最近 30 天成交" : "Closed in the last 30 days", tone: "#2563eb" },
              { label: isCn ? "升级商机" : "Expansion deals", value: "9", note: isCn ? "等待交付交接" : "Waiting on handoff", tone: "#7c3aed" },
            ]
          : [
              { label: isCn ? "管道金额" : "Pipeline value", value: "$955K", note: isCn ? "本季度在跟进机会" : "Open opportunity value", tone: "#2563eb" },
              { label: isCn ? "已赢收入" : "Revenue won", value: "$245K", note: isCn ? "最近 30 天成交" : "Closed in the last 30 days", tone: "#14b8a6" },
              { label: isCn ? "活跃线索" : "Active leads", value: "26", note: isCn ? "待推进线索池" : "Open leads in motion", tone: "#7c3aed" },
              { label: isCn ? "待批报价" : "Pending quotes", value: "4", note: isCn ? "等待主管签批" : "Waiting on manager approval", tone: "#f59e0b" },
            ],
      laneTitle: renewalHeavy
        ? (isCn ? "续约与交付轨道" : "Renewal and onboarding lanes")
        : approvalsHeavy
          ? (isCn ? "报价与订单执行" : "Quote and order execution")
          : (isCn ? "销售阶段分布" : "Pipeline by stage"),
      laneItems: renewalHeavy
        ? [
            { label: isCn ? "续约准备" : "Renewal prep", value: "5", progress: 58, note: isCn ? "等待商务与成功团队联动" : "Sales and success alignment" },
            { label: isCn ? "合同确认" : "Contract review", value: "4", progress: 42, note: isCn ? "法务条款确认中" : "Legal terms in review" },
            { label: isCn ? "上线交接" : "Go-live handoff", value: "7", progress: 74, note: isCn ? "实施与支持已排期" : "Implementation scheduled" },
            { label: isCn ? "扩容推进" : "Expansion push", value: "$188K", progress: 51, note: isCn ? "增购与续约并行" : "Upsell moving with renewals" },
          ]
        : approvalsHeavy
          ? [
              { label: isCn ? "报价提交" : "Quote intake", value: "9", progress: 46, note: isCn ? "等待初审" : "Initial review queue" },
              { label: isCn ? "财务审批" : "Finance approval", value: "4", progress: 62, note: isCn ? "待金额确认" : "Pending pricing sign-off" },
              { label: isCn ? "订单确认" : "Order confirmation", value: "6", progress: 53, note: isCn ? "PO 与回款同步" : "PO and payment sync" },
              { label: isCn ? "交付交接" : "Delivery handoff", value: "3", progress: 29, note: isCn ? "PM 与 CSM 已接收" : "PM and CSM handoff" },
            ]
          : [
              { label: isCn ? "发现" : "Discovery", value: "$160K", progress: 36, note: isCn ? "4 笔机会" : "4 deals" },
              { label: isCn ? "方案" : "Proposal", value: "$310K", progress: 72, note: isCn ? "6 笔机会" : "6 deals" },
              { label: isCn ? "谈判" : "Negotiation", value: "$248K", progress: 58, note: isCn ? "3 笔机会" : "3 deals" },
              { label: isCn ? "赢单" : "Closed won", value: "$237K", progress: 48, note: isCn ? "2 笔成交" : "2 wins" },
            ],
      rightTitle: teamHeavy
        ? (isCn ? "团队与配额" : "Team and quota")
        : renewalHeavy
          ? (isCn ? "客户成功节奏" : "Customer success cadence")
          : (isCn ? "团队节奏" : "Team cadence"),
      rightItems: teamHeavy
        ? [
            { title: isCn ? "团队目标完成度" : "Quarter target", note: isCn ? "72% 已达成" : "72% completed", accent: "#2563eb" },
            { title: isCn ? "负责人节奏" : "Owner cadence", note: isCn ? "2 位 AE 跟进滞后" : "2 reps behind on follow-up", accent: "#7c3aed" },
            { title: isCn ? "配额缺口" : "Quota gap", note: isCn ? "东区仍有 18% 缺口" : "East region still 18% short", accent: "#14b8a6" },
          ]
        : renewalHeavy
          ? [
              { title: isCn ? "续约提醒" : "Renewal watchlist", note: isCn ? "3 个账户本周到期" : "3 accounts renewing this week", accent: "#f59e0b" },
              { title: isCn ? "上线任务" : "Onboarding handoff", note: isCn ? "7 个客户等待交付" : "7 accounts waiting on launch", accent: "#14b8a6" },
              { title: isCn ? "成功团队联动" : "CSM coordination", note: isCn ? "续约与增购共用同一条轨道" : "Renewal and upsell share one rail", accent: "#2563eb" },
            ]
          : [
              { title: isCn ? "团队目标完成度" : "Quarter target", note: isCn ? "72% 已达成" : "72% completed", accent: "#2563eb" },
              { title: isCn ? "续约提醒" : "Renewal watchlist", note: isCn ? "3 个账户本周到期" : "3 accounts renewing this week", accent: "#f59e0b" },
              { title: isCn ? "报价审批" : "Quote approvals", note: isCn ? "2 份报价等待负责人确认" : "2 approvals waiting on lead review", accent: "#14b8a6" },
            ],
      progressLabel: teamHeavy ? (isCn ? "团队目标" : "Team target") : renewalHeavy ? (isCn ? "续约推进" : "Renewal progress") : (isCn ? "本季度目标" : "Quarter target"),
      progressValue: renewalHeavy ? 68 : approvalsHeavy ? 64 : 72,
      progressBreakdown: renewalHeavy
        ? (isCn ? ["续约 34%", "交付 21%", "增购 13%", "风险 32%"] : ["Renewals 34%", "Onboarding 21%", "Expansion 13%", "Risk 32%"])
        : approvalsHeavy
          ? (isCn ? ["报价 28%", "审批 19%", "订单 17%", "缺口 36%"] : ["Quotes 28%", "Approvals 19%", "Orders 17%", "Gap 36%"])
          : (isCn ? ["已签 52%", "推进中 20%", "缺口 28%"] : ["Closed 52%", "In review 20%", "Gap 28%"]),
      spotlightTitle: isCn ? "核心对象" : "Core objects",
      spotlightItems: relatedEntityLabels.length
        ? relatedEntityLabels
        : [isCn ? "线索" : "Lead", isCn ? "客户" : "Account", isCn ? "商机" : "Opportunity", isCn ? "订单" : "Order"],
    }
  }

  if (archetype === "api_platform") {
    const docsHeavy = /docs|documentation|sdk|developer onboarding|文档|sdk|开发者/.test(promptText)
    const usageHeavy = /usage|metering|billing|rate limit|quota|用量|计费|额度/.test(promptText)
    const webhookHeavy = /webhook|webhooks|callback|callbacks|事件|回调/.test(promptText)
    return {
      heroStats: docsHeavy
        ? [
            { label: isCn ? "文档阅读" : "Docs sessions", value: "1.9K", note: isCn ? "开发者 onboarding 流量" : "Developer onboarding traffic", tone: "#7c3aed" },
            { label: isCn ? "SDK 下载" : "SDK downloads", value: "324", note: isCn ? "最近 7 天" : "Across the last 7 days", tone: "#06b6d4" },
            { label: isCn ? "示例调用" : "Sample executions", value: "8.7K", note: isCn ? "沙盒示例运行" : "Sandbox sample runs", tone: "#14b8a6" },
            { label: isCn ? "激活密钥" : "Activated keys", value: "114", note: isCn ? "通过 docs 转化" : "Activated from docs", tone: "#3b82f6" },
          ]
        : usageHeavy
          ? [
              { label: isCn ? "计量请求" : "Metered requests", value: "8.4M", note: isCn ? "近 24 小时流量" : "Across the last 24 hours", tone: "#06b6d4" },
              { label: isCn ? "计费账户" : "Billable accounts", value: "218", note: isCn ? "活跃付费团队" : "Active paid teams", tone: "#14b8a6" },
              { label: isCn ? "额度预警" : "Quota alerts", value: "17", note: isCn ? "接近速率上限" : "Near rate limits", tone: "#f59e0b" },
              { label: isCn ? "P95 延迟" : "P95 latency", value: "182ms", note: isCn ? "核心端点聚合" : "Across critical endpoints", tone: "#3b82f6" },
            ]
          : [
              { label: isCn ? "每日请求" : "Daily requests", value: "8.4M", note: isCn ? "近 24 小时流量" : "Across the last 24 hours", tone: "#06b6d4" },
              { label: isCn ? "P95 延迟" : "P95 latency", value: "182ms", note: isCn ? "核心端点聚合" : "Across critical endpoints", tone: "#3b82f6" },
              { label: isCn ? "Webhook 送达" : "Webhook delivery", value: "99.2%", note: isCn ? "最近 12 小时" : "Across the last 12 hours", tone: "#14b8a6" },
              { label: isCn ? "文档阅读" : "Docs sessions", value: "1.2K", note: isCn ? "开发者 onboarding" : "Developer onboarding traffic", tone: "#7c3aed" },
            ],
      laneTitle: docsHeavy ? (isCn ? "开发者上手流" : "Developer onboarding flow") : webhookHeavy ? (isCn ? "事件投递流" : "Webhook delivery rails") : isCn ? "平台流量分布" : "Platform request mix",
      laneItems: docsHeavy
        ? [
            { label: isCn ? "文档入口" : "Docs entry", value: "42%", progress: 42, note: isCn ? "从官网和 SDK 跳入" : "Site and SDK inbound" },
            { label: isCn ? "示例执行" : "Sample runs", value: "8.7K", progress: 76, note: isCn ? "文档示例成功执行" : "Docs examples executed" },
            { label: isCn ? "密钥申请" : "Key issuance", value: "114", progress: 64, note: isCn ? "新开发者获取密钥" : "New developer keys issued" },
            { label: isCn ? "沙盒转正式" : "Sandbox -> prod", value: "38", progress: 31, note: isCn ? "完成生产切换" : "Promoted to production" },
          ]
        : webhookHeavy
          ? [
              { label: isCn ? "回调接收" : "Callback intake", value: "3.4M", progress: 88, note: isCn ? "事件进入网关" : "Events entering gateway" },
              { label: isCn ? "重试队列" : "Retry queue", value: "1.8K", progress: 27, note: isCn ? "等待恢复投递" : "Awaiting redelivery" },
              { label: isCn ? "签名校验" : "Signature checks", value: "99.7%", progress: 83, note: isCn ? "回调签名通过率" : "Webhook signature pass rate" },
              { label: isCn ? "端点回放" : "Replay rail", value: "214", progress: 46, note: isCn ? "最近回放事件" : "Recent event replays" },
            ]
          : [
              { label: isCn ? "认证" : "Auth", value: "2.1M", progress: 78, note: isCn ? "OAuth 与令牌流" : "OAuth and token flows" },
              { label: isCn ? "事件" : "Events", value: "3.4M", progress: 88, note: isCn ? "Webhook 与回调" : "Webhooks and callbacks" },
              { label: isCn ? "计费" : "Billing", value: "1.5M", progress: 46, note: isCn ? "Usage 与计费同步" : "Usage and billing sync" },
              { label: isCn ? "管理" : "Admin", value: "1.4M", progress: 39, note: isCn ? "控制平面请求" : "Control-plane traffic" },
            ],
      rightTitle: docsHeavy ? (isCn ? "文档与 SDK" : "Docs and SDK") : usageHeavy ? (isCn ? "用量与计费" : "Usage and billing") : (isCn ? "发布与环境" : "Release rails"),
      rightItems: docsHeavy
        ? [
            { title: isCn ? "SDK 套件" : "SDK kits", note: isCn ? "JS / Python / Go 套件已准备" : "JS / Python / Go kits are ready", accent: "#06b6d4" },
            { title: isCn ? "示例工程" : "Sample apps", note: isCn ? "Docs / SDK / examples 已接通" : "Docs / SDK / samples are wired", accent: "#14b8a6" },
            { title: isCn ? "开发者激活" : "Developer activation", note: isCn ? "从文档流转为正式密钥" : "Docs traffic is converting to live keys", accent: "#2563eb" },
          ]
        : usageHeavy
          ? [
              { title: isCn ? "计费可见性" : "Billing visibility", note: isCn ? "usage / quota / invoices 已串联" : "Usage / quota / invoices are linked", accent: "#06b6d4" },
              { title: isCn ? "额度治理" : "Quota governance", note: isCn ? "4 个团队接近上限" : "4 teams nearing limits", accent: "#f59e0b" },
              { title: isCn ? "环境提升" : "Environment promotion", note: isCn ? "staging -> production 等待批准" : "staging -> production waiting on approval", accent: "#14b8a6" },
            ]
          : [
              { title: isCn ? "环境提升" : "Environment promotion", note: isCn ? "staging -> production 等待批准" : "staging -> production waiting on approval", accent: "#06b6d4" },
              { title: isCn ? "API 密钥治理" : "Key governance", note: isCn ? "4 个团队正在轮换访问密钥" : "4 teams rotating access keys", accent: "#2563eb" },
              { title: isCn ? "开发者上手" : "Developer onboarding", note: isCn ? "Docs / SDK / samples 已接通" : "Docs / SDK / samples are wired", accent: "#14b8a6" },
            ],
      progressLabel: usageHeavy ? (isCn ? "计费健康度" : "Billing health") : isCn ? "生产稳定性" : "Production health",
      progressValue: usageHeavy ? 86 : 91,
      progressBreakdown: usageHeavy
        ? (isCn ? ["计费 41%", "额度 22%", "稳定 23%", "事件 14%"] : ["Billing 41%", "Quota 22%", "Healthy 23%", "Incidents 14%"])
        : (isCn ? ["稳定 91%", "观察 6%", "事件 3%"] : ["Healthy 91%", "Observe 6%", "Incidents 3%"]),
      spotlightTitle: isCn ? "已接入对象" : "Platform objects",
      spotlightItems: relatedEntityLabels.length
        ? relatedEntityLabels
        : [isCn ? "端点" : "Endpoint", isCn ? "日志" : "Log stream", isCn ? "密钥" : "API key", isCn ? "文档" : "Developer doc"],
    }
  }

  if (archetype === "community") {
    const eventsHeavy = /event|events|meetup|webinar|registration|invite|活动|报名|邀请/.test(promptText)
    const moderationHeavy = /moderation|moderate|safety|governance|审核|治理|风控/.test(promptText)
    return {
      heroStats: eventsHeavy
        ? [
            { label: isCn ? "活动报名" : "Event signups", value: "624", note: isCn ? "本月活动注册" : "This month’s registrations", tone: "#2563eb" },
            { label: isCn ? "出席率" : "Attendance rate", value: "71%", note: isCn ? "最近 4 场活动" : "Across the last 4 events", tone: "#14b8a6" },
            { label: isCn ? "邀请接受" : "Invite accepts", value: "214", note: isCn ? "大使与会员邀请" : "Ambassador and member invites", tone: "#7c3aed" },
            { label: isCn ? "会后反馈" : "Post-event feedback", value: "86", note: isCn ? "活动结束后收集" : "Collected after events", tone: "#f59e0b" },
          ]
        : [
            { label: isCn ? "活跃成员" : "Active members", value: "4.8K", note: isCn ? "最近 30 天" : "Across the last 30 days", tone: "#7c3aed" },
            { label: isCn ? "活动报名" : "Event signups", value: "624", note: isCn ? "本月活动注册" : "This month’s registrations", tone: "#2563eb" },
            { label: isCn ? "反馈队列" : "Feedback queue", value: "38", note: isCn ? "待分发与归档" : "Waiting to triage", tone: "#14b8a6" },
            { label: isCn ? "路线图票数" : "Roadmap votes", value: "1.9K", note: isCn ? "本周累计" : "Captured this week", tone: "#f59e0b" },
          ],
      laneTitle: moderationHeavy ? (isCn ? "治理与审核" : "Moderation and governance") : isCn ? "社区节奏" : "Community rhythm",
      laneItems: moderationHeavy
        ? [
            { label: isCn ? "审核队列" : "Moderation queue", value: "9", progress: 28, note: isCn ? "待人工审核" : "Awaiting moderator review" },
            { label: isCn ? "成员申诉" : "Appeals", value: "4", progress: 17, note: isCn ? "待治理处理" : "Waiting on governance review" },
            { label: isCn ? "路线图票数" : "Roadmap votes", value: "1.9K", progress: 63, note: isCn ? "治理后同步 roadmap" : "Votes syncing after moderation" },
            { label: isCn ? "反馈分流" : "Feedback triage", value: "38", progress: 54, note: isCn ? "待分级处理" : "Needs triage" },
          ]
        : [
            { label: isCn ? "活动" : "Events", value: "3", progress: 62, note: isCn ? "本周活动排期" : "Scheduled this week" },
            { label: isCn ? "反馈" : "Feedback", value: "38", progress: 54, note: isCn ? "待分级处理" : "Needs triage" },
            { label: isCn ? "成员" : "Members", value: "124", progress: 71, note: isCn ? "待分群与触达" : "Pending segmentation" },
            { label: isCn ? "审核" : "Moderation", value: "9", progress: 28, note: isCn ? "待人工审核" : "Awaiting moderator review" },
          ],
      rightTitle: eventsHeavy ? (isCn ? "活动运营" : "Event operations") : isCn ? "运营信号" : "Community signals",
      rightItems: [
        { title: isCn ? "Roadmap 投票" : "Roadmap momentum", note: isCn ? "3 个主题快速升温" : "3 themes gaining momentum", accent: "#7c3aed" },
        { title: isCn ? "成员分层" : "Member segments", note: isCn ? "新成员 / 核心贡献者 / 大使已分层" : "New / core / ambassador segments ready", accent: "#2563eb" },
        { title: isCn ? "活动运营" : "Event operations", note: isCn ? "直播与 meetup 共用同一条运营轨道" : "Webinars and meetups share one rail", accent: "#14b8a6" },
      ],
      progressLabel: isCn ? "社区健康度" : "Community health",
      progressValue: 78,
      progressBreakdown: isCn ? ["互动 48%", "活动 30%", "待处理 22%"] : ["Engagement 48%", "Events 30%", "Pending 22%"],
      spotlightTitle: isCn ? "社区对象" : "Community objects",
      spotlightItems: relatedEntityLabels.length
        ? relatedEntityLabels
        : [isCn ? "活动" : "Event", isCn ? "成员" : "Member", isCn ? "反馈" : "Feedback", isCn ? "路线图" : "Roadmap item"],
    }
  }

  if (archetype === "marketing_admin") {
    const devicesHeavy = /device|devices|desktop|mobile|ios|android|mac|windows|设备|桌面|移动|安卓|苹果/.test(promptText)
    const docsHeavy = /docs|documentation|install guide|changelog|release note|文档|安装|更新日志|发布说明/.test(promptText)
    return {
      heroStats: docsHeavy
        ? [
            { label: isCn ? "文档会话" : "Docs sessions", value: "9.8K", note: isCn ? "安装与变更日志入口" : "Install and changelog traffic", tone: "#2563eb" },
            { label: isCn ? "下载转化" : "Docs-to-download", value: "12.4%", note: isCn ? "文档承接下载流" : "Docs converting to downloads", tone: "#14b8a6" },
            { label: isCn ? "更新日志阅读" : "Changelog reads", value: "3.4K", note: isCn ? "最近版本波峰" : "Latest release spike", tone: "#111827" },
            { label: isCn ? "版本分发" : "Release lanes", value: "5", note: isCn ? "官网 / 商店 / 企业" : "Site / stores / enterprise", tone: "#f59e0b" },
          ]
        : [
            { label: isCn ? "下载量" : "Downloads", value: "18.2K", note: isCn ? "近 30 天" : "Across the last 30 days", tone: "#111827" },
            { label: isCn ? "转化率" : "Conversion rate", value: "6.8%", note: isCn ? "官网到下载" : "Site to download", tone: "#2563eb" },
            { label: isCn ? "活跃构建" : "Active builds", value: "9", note: isCn ? "桌面与移动分发" : "Desktop and mobile releases", tone: "#14b8a6" },
            { label: isCn ? "分发通道" : "Distribution lanes", value: "5", note: isCn ? "商店 / 官网 / 企业分发" : "Stores / site / enterprise", tone: "#f59e0b" },
          ],
      laneTitle: devicesHeavy ? (isCn ? "设备分发进度" : "Device rollout") : docsHeavy ? (isCn ? "文档转化路径" : "Docs conversion path") : (isCn ? "设备分发进度" : "Device rollout"),
      laneItems: [
        { label: isCn ? "macOS" : "macOS", value: "v1.8.2", progress: 82, note: isCn ? "官网与商店已同步" : "Site and store synced" },
        { label: isCn ? "Windows" : "Windows", value: "v1.8.2", progress: 88, note: isCn ? "分发通道稳定" : "Distribution lane stable" },
        { label: isCn ? "iOS" : "iOS", value: "v1.7.9", progress: 51, note: isCn ? "等待审核" : "Waiting on review" },
        { label: isCn ? "Android" : "Android", value: "v1.8.2", progress: 74, note: isCn ? "APK 与商店并行" : "APK and store rollout" },
      ],
      rightTitle: docsHeavy ? (isCn ? "内容与文档" : "Content and docs") : (isCn ? "内容与发布" : "Story and release"),
      rightItems: docsHeavy
        ? [
            { title: isCn ? "安装文档" : "Install docs", note: isCn ? "系统要求和安装指引已承接下载流" : "Requirements and install guides catch download flow", accent: "#2563eb" },
            { title: isCn ? "发布说明" : "Release notes", note: isCn ? "最近三次迭代已同步到 changelog" : "Latest 3 iterations landed in changelog", accent: "#111827" },
            { title: isCn ? "后台分发" : "Admin distribution", note: isCn ? "后台控制台可以灰度与渠道切换" : "Admin rail manages staged rollouts", accent: "#14b8a6" },
          ]
        : [
            { title: isCn ? "发布说明" : "Release notes", note: isCn ? "最近三次迭代已同步到 changelog" : "Latest 3 iterations landed in changelog", accent: "#111827" },
            { title: isCn ? "Docs 转化" : "Docs conversion", note: isCn ? "安装文档正在承接下载流量" : "Install docs are converting download traffic", accent: "#2563eb" },
            { title: isCn ? "后台分发" : "Admin distribution", note: isCn ? "后台控制台可以灰度与渠道切换" : "Admin rail manages staged rollouts", accent: "#14b8a6" },
          ],
      progressLabel: isCn ? "版本发布完成度" : "Release completion",
      progressValue: 84,
      progressBreakdown: isCn ? ["官网 38%", "商店 28%", "后台 18%", "待审 16%"] : ["Website 38%", "Stores 28%", "Admin 18%", "Review 16%"],
      spotlightTitle: isCn ? "分发对象" : "Distribution objects",
      spotlightItems: relatedEntityLabels.length
        ? relatedEntityLabels
        : [isCn ? "下载资产" : "Download asset", isCn ? "设备构建" : "Device build", isCn ? "版本说明" : "Release note", isCn ? "渠道" : "Distribution lane"],
    }
  }

  if (isAdminOpsTaskSpec(spec)) {
    return {
      heroStats: [
        { label: isCn ? "待批队列" : "Approval queue", value: "17", note: isCn ? "等待签批" : "Waiting on approval", tone: "#7c3aed" },
        { label: isCn ? "策略变更" : "Policy changes", value: "5", note: isCn ? "过去 24 小时" : "Across the last 24 hours", tone: "#2563eb" },
        { label: isCn ? "告警事件" : "Open incidents", value: "2", note: isCn ? "高优先级事件" : "High-priority incidents", tone: "#ef4444" },
        { label: isCn ? "审计覆盖" : "Audit coverage", value: "96%", note: isCn ? "关键动作已留痕" : "Critical actions are tracked", tone: "#14b8a6" },
      ],
      laneTitle: isCn ? "控制平面队列" : "Control-plane queues",
      laneItems: [
        { label: isCn ? "审批" : "Approvals", value: "9", progress: 64, note: isCn ? "待主管签批" : "Needs approver review" },
        { label: isCn ? "权限" : "Access", value: "5", progress: 42, note: isCn ? "待策略确认" : "Policy changes in review" },
        { label: isCn ? "审计" : "Audit", value: "13", progress: 81, note: isCn ? "可导出留痕" : "Exportable trail ready" },
        { label: isCn ? "事件" : "Incidents", value: "2", progress: 24, note: isCn ? "待恢复验证" : "Recovery still in progress" },
      ],
      rightTitle: isCn ? "运维信号" : "Ops signals",
      rightItems: [
        { title: isCn ? "席位与团队" : "Team and seats", note: isCn ? "两组团队等待容量调整" : "Two teams need seat updates", accent: "#7c3aed" },
        { title: isCn ? "自动化规则" : "Automation rules", note: isCn ? "审批和审计已接到同一条规则轨道" : "Approval and audit share one rule rail", accent: "#2563eb" },
        { title: isCn ? "事件恢复" : "Recovery rail", note: isCn ? "已锁定事件负责人和恢复动作" : "Incident owner and recovery steps are locked", accent: "#14b8a6" },
      ],
      progressLabel: isCn ? "治理就绪度" : "Governance readiness",
      progressValue: 79,
      progressBreakdown: isCn ? ["审批 31%", "权限 26%", "审计 22%", "事件 21%"] : ["Approvals 31%", "Access 26%", "Audit 22%", "Incidents 21%"],
      spotlightTitle: isCn ? "治理对象" : "Governance objects",
      spotlightItems: relatedEntityLabels.length
        ? relatedEntityLabels
        : [isCn ? "审批请求" : "Approval request", isCn ? "访问策略" : "Access policy", isCn ? "审计事件" : "Audit event", isCn ? "事故" : "Incident"],
    }
  }

  return {
    heroStats: [
      { label: current.metricLabel, value: current.metricValue, note: current.summary, tone: "#7c3aed" },
      { label: current.insightLabel, value: current.insightValue, note: relatedModules[0]?.summary || current.subheadline, tone: "#2563eb" },
      { label: isCn ? "模块数量" : "Linked modules", value: String(relatedModules.length || current.focusAreas.length), note: relatedModuleLabels.slice(0, 2).join(" / "), tone: "#14b8a6" },
      { label: isCn ? "实体数量" : "Entities", value: String(relatedEntities.length || workflowSteps.length || 1), note: relatedEntityLabels.slice(0, 2).join(" / "), tone: "#f59e0b" },
    ],
    laneTitle: isCn ? "当前工作流" : "Current workflow",
    laneItems: (workflowSteps.length ? workflowSteps : current.focusAreas).slice(0, 4).map((item, index) => ({
      label: item,
      value: `${index + 1}`,
      progress: 25 + index * 18,
      note: current.label,
    })),
    rightTitle: isCn ? "关联模块" : "Linked modules",
    rightItems: (relatedModules.length
      ? relatedModules
      : current.focusAreas.map((item) => ({ label: item, summary: current.summary }))).slice(0, 3).map((item, index) => ({
      title: item.label,
      note: item.summary,
      accent: ["#7c3aed", "#2563eb", "#14b8a6"][index] ?? "#7c3aed",
    })),
    progressLabel: isCn ? "当前页进度" : "Current route progress",
    progressValue: 68,
    progressBreakdown: current.focusAreas.slice(0, 3),
    spotlightTitle: isCn ? "关键对象" : "Key objects",
    spotlightItems: relatedEntityLabels.length ? relatedEntityLabels : current.focusAreas,
  }
}

function renderArchetypeWorkspaceHome(spec: AppSpec) {
  const dashboardConsole = renderArchetypeConsolePage(spec, "dashboard")
  if (dashboardConsole) {
    return dashboardConsole
  }
  const pages = getArchetypePageDefinitions(spec)
  if (!pages.length) return null
  const isCn = spec.region === "cn"
  const brand = spec.appIdentity?.displayName ?? spec.title
  const archetype = getScaffoldArchetype(spec)
  const identity = spec.appIdentity
  const intent = spec.appIntent
  const icon = spec.visualSeed?.icon ?? identity?.icon ?? getArchetypeIconSeed(archetype, spec.title)
  const visualTone = spec.visualSeed?.tone ?? getArchetypeCategoryLabel(archetype, spec.region)
  const workflowSteps = getWorkflowSteps(spec)
  const routeCards = getPreviewRouteBlueprints(spec)
  const entityCards = getPreviewEntityBlueprints(spec)
  const accent =
    archetype === "crm" ? "#2563eb" : archetype === "api_platform" ? "#06b6d4" : archetype === "marketing_admin" ? "#111827" : "#7c3aed"

  return `import Link from "next/link";

export default function Page() {
  const isCn = ${isCn ? "true" : "false"};
  const pages = ${JSON.stringify(pages, null, 2)} as const;
  const routeCards = ${JSON.stringify(routeCards, null, 2)} as const;
  const entityCards = ${JSON.stringify(entityCards, null, 2)} as const;
  const workflowSteps = ${JSON.stringify(workflowSteps, null, 2)} as const;
  const brand = ${JSON.stringify(brand)};
  const accent = ${JSON.stringify(accent)};
  const icon = ${JSON.stringify(icon, null, 2)} as const;
  const shortDescription = ${JSON.stringify(identity?.shortDescription ?? "")};
  const primaryWorkflow = ${JSON.stringify(intent?.primaryWorkflow ?? "")};
  const visualTone = ${JSON.stringify(visualTone)};
  const targetAudience = ${JSON.stringify(intent?.targetAudience?.slice(0, 3) ?? [], null, 2)} as const;
  return (
    <main style={{ minHeight: "100vh", padding: 28, fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", background: "linear-gradient(180deg,#f7f8fc 0%,#ffffff 54%,#eef4ff 100%)", color: "#0f172a" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, padding: 26, background: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,255,255,0.96))", border: "1px solid rgba(148,163,184,0.18)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: 18, background: \`linear-gradient(135deg,\${icon.from},\${icon.to})\`, boxShadow: \`0 18px 40px \${icon.ring}\`, display: "grid", placeItems: "center", color: "#fff", fontWeight: 900, fontSize: 20 }}>
                  {icon.glyph}
                </div>
                <div>
                  <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(15,23,42,0.06)", color: accent, fontSize: 12, fontWeight: 800 }}>
                    {visualTone}
                  </div>
                  <h1 style={{ margin: "10px 0 0", fontSize: 36, fontWeight: 900 }}>{brand}</h1>
                </div>
              </div>
              <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(15,23,42,0.06)", color: accent, fontSize: 12, fontWeight: 800 }}>
                {isCn ? "应用工作区骨架" : "Application workspace scaffold"}
              </div>
              <p style={{ margin: 0, maxWidth: 860, color: "#475569", lineHeight: 1.8 }}>
                {shortDescription || (isCn
                  ? "这一版不再只输出页面，而是把首页、控制台、模块页和运营路径组织成一个可继续扩展的应用工作区。"
                  : "This version moves beyond page generation and organizes the result as an extensible application workspace with modules and control surfaces.")}
              </p>
              {primaryWorkflow ? (
                <div style={{ display: "inline-flex", borderRadius: 14, padding: "10px 12px", background: "#ffffff", border: "1px solid rgba(148,163,184,0.18)", color: "#334155", fontSize: 13 }}>
                  {(isCn ? "主流程：" : "Primary workflow: ") + primaryWorkflow}
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {pages.slice(0, 4).map((item) => (
                <Link key={item.route} href={item.route === "dashboard" ? "/dashboard" : "/" + item.route} style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", background: item.route === "dashboard" ? accent : "#ffffff", color: item.route === "dashboard" ? "#ffffff" : "#0f172a", border: item.route === "dashboard" ? "none" : "1px solid rgba(148,163,184,0.18)", fontWeight: 800 }}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
          {pages.slice(0, 4).map((page) => (
            <div key={page.route} style={{ borderRadius: 22, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 18 }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>{page.label}</div>
              <div style={{ marginTop: 10, fontWeight: 900, fontSize: 20 }}>{page.metricValue}</div>
              <div style={{ marginTop: 8, color: "#334155", fontSize: 13 }}>{page.metricLabel}</div>
              <div style={{ marginTop: 12, color: "#64748b", lineHeight: 1.7, fontSize: 13 }}>{page.summary}</div>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 16 }}>
          <div style={{ borderRadius: 24, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "路由蓝图" : "Route blueprint"}</div>
            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              {(routeCards.length ? routeCards : pages.map((page) => ({
                label: page.label,
                path: page.route === "dashboard" ? "/dashboard" : \`/\${page.route}\`,
                purpose: page.summary,
                actions: page.focusAreas.slice(0, 3),
              }))).map((page, index) => (
                <Link key={page.path} href={page.path} style={{ textDecoration: "none", borderRadius: 16, padding: "14px 16px", background: index === 0 ? "rgba(37,99,235,0.08)" : "#f8fafc", color: "#0f172a", border: "1px solid rgba(148,163,184,0.14)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 800 }}>{page.label}</div>
                    <div style={{ borderRadius: 999, padding: "4px 8px", background: "#ffffff", color: accent, fontSize: 11, fontWeight: 800 }}>{page.path}</div>
                  </div>
                  <div style={{ marginTop: 8, color: "#64748b", fontSize: 13, lineHeight: 1.7 }}>{page.purpose}</div>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {page.actions.map((item) => (
                      <div key={item} style={{ borderRadius: 999, background: "#ffffff", border: "1px solid rgba(148,163,184,0.14)", padding: "4px 8px", fontSize: 12, color: "#475569" }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ borderRadius: 24, background: "#0f172a", color: "#e2e8f0", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "核心实体" : "Core entities"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {(entityCards.length ? entityCards : [{
                  label: isCn ? "应用实体" : "App entity",
                  summary: isCn ? "当前 archetype 的关键数据结构会在这里呈现。" : "Core data structures for the current archetype show up here.",
                  fields: targetAudience,
                  workflows: workflowSteps,
                }]).map((item) => (
                  <div key={item.label} style={{ borderRadius: 12, background: "rgba(255,255,255,0.06)", padding: "12px 12px", color: "#cbd5e1", fontSize: 13 }}>
                    <div style={{ fontWeight: 800, color: "#f8fafc" }}>{item.label}</div>
                    <div style={{ marginTop: 6, color: "#cbd5e1", lineHeight: 1.7 }}>{item.summary}</div>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {item.fields.map((field) => (
                        <div key={field} style={{ borderRadius: 999, background: "rgba(255,255,255,0.08)", padding: "4px 8px" }}>
                          {field}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderRadius: 24, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "主工作流" : "Primary workflow"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {(workflowSteps.length ? workflowSteps : pages[0].focusAreas).map((item) => (
                  <div key={item} style={{ borderRadius: 12, background: "#f8fafc", padding: "10px 12px", color: "#334155", fontSize: 13 }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
`
}

function renderArchetypeConsolePage(spec: AppSpec, route: string) {
  const pages = getArchetypePageDefinitions(spec)
  const current = pages.find((page) => page.route === route)
  if (!current) return null
  const isCn = spec.region === "cn"
  const brand = spec.appIdentity?.displayName ?? spec.title
  const archetype = getScaffoldArchetype(spec)
  const domainFlavor = inferDomainFlavor(spec.prompt ?? spec.title)
  const routeBlueprint =
    spec.routeBlueprint?.find((item) => item.path === `/${route}` || item.id === toBlueprintId(route)) ?? null
  const relatedModules = (spec.moduleBlueprint ?? [])
    .filter((item) => routeBlueprint?.moduleIds.includes(item.id))
    .slice(0, 4)
    .map((item) => ({ label: item.label, summary: item.summary }))
  const relatedEntities = (spec.entityBlueprint ?? [])
    .filter((item) => routeBlueprint?.entityIds.includes(item.id))
    .slice(0, 4)
    .map((item) => ({ label: item.label, workflows: item.workflows.slice(0, 3) }))
  const workflowSteps = getWorkflowSteps(spec)
  const dashboardWidgets = buildArchetypeConsoleWidgets(spec, current, relatedModules, relatedEntities, workflowSteps)
  const accent =
    archetype === "crm" ? "#2563eb" : archetype === "api_platform" ? "#06b6d4" : archetype === "marketing_admin" ? "#111827" : "#7c3aed"
  const panelBackground = archetype === "api_platform" ? "#081120" : "#ffffff"
  const panelText = archetype === "api_platform" ? "#e2e8f0" : "#0f172a"
  const mutedText = archetype === "api_platform" ? "#94a3b8" : "#64748b"
  const surface = archetype === "api_platform" ? "rgba(15,23,42,0.78)" : "#f8fafc"
  const border = archetype === "api_platform" ? "1px solid rgba(148,163,184,0.12)" : "1px solid rgba(148,163,184,0.16)"
  const isAdminOps = isAdminOpsTaskSpec(spec)
  const isSpecializedTask = archetype === "task" && !isAdminOps && domainFlavor !== "general"
  const specializedTaskModel = isSpecializedTask
    ? domainFlavor === "healthcare"
      ? {
          eyebrow: isCn ? "临床工作流" : "Clinical workflow",
          title: isCn ? "患者、预约和护理计划共用一条医疗路径" : "Patients, appointments, and care plans share one care path",
          summary: isCn ? "这不是审批后台换标题，而是围绕诊所运营、护理随访和风险提醒组织的真实医疗面。" : "This is not an approval dashboard with a new title. It is a clinic-native surface built around care ops, follow-up, and risk management.",
          actionA: isCn ? "打开患者队列" : "Open patients",
          actionB: isCn ? "查看今日预约" : "View appointments",
          routeA: "patients",
          routeB: "appointments",
          layout: "healthcare",
        }
      : domainFlavor === "education"
        ? {
            eyebrow: isCn ? "教务与学习" : "Learning operations",
            title: isCn ? "课程、学生、作业和班级反馈不再挤进通用任务板" : "Courses, students, assignments, and classes no longer collapse into one task board",
            summary: isCn ? "教育场景会直接生成课程卡片、班级节奏、作业看板和学习反馈，而不是审批面板。" : "Education prompts now generate course cards, class rhythm, assignment boards, and learning feedback instead of approval rails.",
            actionA: isCn ? "打开课程表" : "Open courses",
            actionB: isCn ? "查看学生进度" : "View students",
            routeA: "courses",
            routeB: "students",
            layout: "education",
          }
        : domainFlavor === "finance"
          ? {
              eyebrow: isCn ? "财务与对账" : "Finance and reconciliation",
              title: isCn ? "账户、交易、对账和风险复核形成独立财务控制台" : "Accounts, transactions, reconciliation, and risk review form a dedicated finance console",
              summary: isCn ? "财务场景会使用对账、异常、账本和报表结构，而不是销售管道或审批壳。" : "Finance prompts now use reconciliation, exception, ledger, and reporting structure instead of sales or approval shells.",
              actionA: isCn ? "打开交易台账" : "Open transactions",
              actionB: isCn ? "查看对账" : "Open reconciliation",
              routeA: "transactions",
              routeB: "reconciliation",
              layout: "finance",
            }
          : domainFlavor === "recruiting"
            ? {
                eyebrow: isCn ? "招聘流水线" : "Hiring pipeline",
                title: isCn ? "候选人、岗位、面试和 Offer 审批是一条招聘路径" : "Candidates, roles, interviews, and offers become one hiring path",
                summary: isCn ? "招聘场景直接生成 ATS 风格界面，不再复用 CRM 或内部后台框架。" : "Recruiting prompts now generate ATS-style structure instead of reusing CRM or internal admin frames.",
                actionA: isCn ? "打开候选人池" : "Open candidates",
                actionB: isCn ? "安排面试" : "Schedule interviews",
                routeA: "candidates",
                routeB: "interviews",
                layout: "recruiting",
              }
            : domainFlavor === "support"
              ? {
                  eyebrow: isCn ? "客服与知识库" : "Support and knowledge",
                  title: isCn ? "工单、SLA、升级和知识沉淀是一条完整解决闭环" : "Tickets, SLAs, escalations, and knowledge updates form one resolution loop",
                  summary: isCn ? "客服场景会生成工单流、知识库和升级轨道，不再退回成通用后台。" : "Support prompts now generate ticket flows, knowledge surfaces, and escalation rails instead of a generic ops console.",
                  actionA: isCn ? "打开工单队列" : "Open tickets",
                  actionB: isCn ? "查看知识库" : "Open knowledge",
                  routeA: "tickets",
                  routeB: "knowledge",
                  layout: "support",
                }
              : {
                  eyebrow: isCn ? "库存与履约" : "Inventory and fulfillment",
                  title: isCn ? "商品、库存、履约和供应商形成真正的电商运营面" : "Products, inventory, fulfillment, and suppliers form a real commerce operations surface",
                  summary: isCn ? "电商运营场景直接生成 SKU、库存、补货和履约轨道，不再只是控制台卡片。" : "Commerce operations prompts now generate SKU, inventory, reorder, and fulfillment rails instead of generic control cards.",
                  actionA: isCn ? "打开库存" : "Open inventory",
                  actionB: isCn ? "查看履约" : "Open fulfillment",
                  routeA: "inventory",
                  routeB: "fulfillment",
                  layout: "commerce_ops",
                }
    : null

  return `// @ts-nocheck
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export default function GeneratedConsolePage() {
  const isCn = ${isCn ? "true" : "false"};
  const brand = ${JSON.stringify(brand)};
  const pages = ${JSON.stringify(pages, null, 2)} as const;
  const current = ${JSON.stringify(current, null, 2)} as const;
  const routeBlueprint = ${JSON.stringify(routeBlueprint, null, 2)} as const;
  const relatedModules = ${JSON.stringify(relatedModules, null, 2)} as const;
  const relatedEntities = ${JSON.stringify(relatedEntities, null, 2)} as const;
  const workflowSteps = ${JSON.stringify(workflowSteps, null, 2)} as const;
  const dashboardWidgets = ${JSON.stringify(dashboardWidgets, null, 2)} as const;
  const accent = ${JSON.stringify(accent)};
  const panelBackground = ${JSON.stringify(panelBackground)};
  const panelText = ${JSON.stringify(panelText)};
  const mutedText = ${JSON.stringify(mutedText)};
  const surface = ${JSON.stringify(surface)};
  const border = ${JSON.stringify(border)};
  const isDashboard = current.route === "dashboard";
  const archetype = ${JSON.stringify(archetype)};
  const isAdminOps = ${isAdminOps ? "true" : "false"};
  const isSpecializedTask = ${isSpecializedTask ? "true" : "false"};
  const specializedTaskModel = ${JSON.stringify(specializedTaskModel, null, 2)} as const;
  const focusCards = [
    ...(routeBlueprint?.primaryActions ?? []).slice(0, 3).map((item, index) => ({
      label: item,
      note: isCn ? "点击即可切换控制焦点" : "Click to switch the control focus",
      tone: index === 0 ? accent : index === 1 ? "#14b8a6" : "#f59e0b",
    })),
    ...relatedModules.slice(0, 2).map((item, index) => ({
      label: item.label,
      note: item.summary || (isCn ? "关联模块" : "Linked module"),
      tone: index === 0 ? accent : "#8b5cf6",
    })),
    ...relatedEntities.slice(0, 2).map((item, index) => ({
      label: item.label,
      note: item.workflows.join(" / ") || (isCn ? "关联实体" : "Linked entity"),
      tone: index === 0 ? "#2563eb" : "#0ea5e9",
    })),
    ...(workflowSteps.length ? workflowSteps.slice(0, 2).map((item, index) => ({
      label: item,
      note: isCn ? "工作流步骤" : "Workflow step",
      tone: index === 0 ? "#7c3aed" : "#16a34a",
    })) : []),
  ];
  const [activeFocus, setActiveFocus] = useState(focusCards[0]?.label ?? current.label);
  const [quickNote, setQuickNote] = useState("");
  const [focusNotes, setFocusNotes] = useState<string[]>(
    () =>
      [
        current.summary,
        routeBlueprint?.purpose || current.subheadline,
      ].filter((item): item is string => Boolean(item))
  );
  const activeFocusDetail = useMemo(() => {
    const hit = focusCards.find((item) => item.label === activeFocus);
    return hit ?? { label: current.label, note: current.summary, tone: accent };
  }, [activeFocus, accent, current.label, current.summary, focusCards]);

  const renderProgressRail = (value, tone = accent) => (
    <div style={{ marginTop: 12, height: 10, borderRadius: 999, background: ${JSON.stringify(archetype === "api_platform" ? "rgba(255,255,255,0.08)" : "#e2e8f0")}, overflow: "hidden" }}>
      <div style={{ width: \`\${value}%\`, height: "100%", borderRadius: 999, background: \`linear-gradient(90deg,\${tone}, rgba(255,255,255,0.75))\` }} />
    </div>
  );

  const renderDashboardShell = () => {
    if (isSpecializedTask && specializedTaskModel) {
      const accentTone =
        specializedTaskModel.layout === "healthcare"
          ? "#0f766e"
          : specializedTaskModel.layout === "education"
            ? "#2563eb"
            : specializedTaskModel.layout === "finance"
              ? "#0891b2"
              : specializedTaskModel.layout === "recruiting"
                ? "#14b8a6"
                : specializedTaskModel.layout === "support"
                  ? "#38bdf8"
                  : "#a16207";
      const altTone =
        specializedTaskModel.layout === "healthcare"
          ? "#2563eb"
          : specializedTaskModel.layout === "education"
            ? "#8b5cf6"
            : specializedTaskModel.layout === "finance"
              ? "#22c55e"
              : specializedTaskModel.layout === "recruiting"
                ? "#8b5cf6"
                : specializedTaskModel.layout === "support"
                  ? "#f97316"
                  : "#22c55e";
      return (
        <section style={{ display: "grid", gap: 16 }}>
          <section style={{ display: "grid", gridTemplateColumns: specializedTaskModel.layout === "support" ? "0.92fr 1.08fr" : "1.08fr 0.92fr", gap: 16 }}>
            <div style={{ borderRadius: 28, border, background: specializedTaskModel.layout === "healthcare" ? "linear-gradient(180deg,#f8fffd 0%,#ecfeff 100%)" : specializedTaskModel.layout === "education" ? "linear-gradient(180deg,#f8fbff 0%,#eef2ff 100%)" : specializedTaskModel.layout === "finance" ? "linear-gradient(180deg,#f5fbff 0%,#eefdf5 100%)" : specializedTaskModel.layout === "recruiting" ? "linear-gradient(180deg,#f8fffc 0%,#f5f3ff 100%)" : specializedTaskModel.layout === "support" ? "linear-gradient(180deg,#f8fbff 0%,#fff7ed 100%)" : "linear-gradient(180deg,#fffaf0 0%,#f0fdf4 100%)", padding: 24, color: "#0f172a", boxShadow: "0 24px 60px rgba(15,23,42,0.08)" }}>
              <div style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(15,23,42,0.48)", fontWeight: 800 }}>{specializedTaskModel.eyebrow}</div>
              <h2 style={{ margin: "16px 0 0", fontSize: 52, lineHeight: 1.08, fontWeight: 900, maxWidth: 780 }}>{specializedTaskModel.title}</h2>
              <p style={{ margin: "18px 0 0", maxWidth: 760, lineHeight: 1.8, color: "rgba(15,23,42,0.68)", fontSize: 16 }}>{specializedTaskModel.summary}</p>
              <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href={"/" + specializedTaskModel.routeA} style={{ textDecoration: "none", borderRadius: 18, padding: "14px 18px", background: "linear-gradient(135deg, " + accentTone + ", " + altTone + ")", color: "#fff", fontWeight: 800, boxShadow: "0 18px 34px " + accentTone + "44" }}>
                  {specializedTaskModel.actionA}
                </Link>
                <Link href={"/" + specializedTaskModel.routeB} style={{ textDecoration: "none", borderRadius: 18, padding: "14px 18px", background: "#ffffff", color: "#0f172a", fontWeight: 800, border: "1px solid rgba(148,163,184,0.2)" }}>
                  {specializedTaskModel.actionB}
                </Link>
              </div>
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              {dashboardWidgets.laneItems.map((item, index) => (
                <div key={item.label} style={{ borderRadius: 20, border, background: panelBackground, padding: "18px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{item.label}</div>
                      <div style={{ marginTop: 6, color: mutedText, fontSize: 12 }}>{item.note}</div>
                    </div>
                    <div style={{ borderRadius: 999, padding: "6px 10px", background: index === 0 ? accentTone + "18" : altTone + "18", color: index === 0 ? accentTone : altTone, fontSize: 12, fontWeight: 800 }}>{item.value}</div>
                  </div>
                  {renderProgressRail(item.progress, index === 0 ? accentTone : altTone)}
                </div>
              ))}
            </div>
          </section>
          <section style={{ display: "grid", gridTemplateColumns: specializedTaskModel.layout === "healthcare" ? "1.05fr 0.95fr 0.95fr" : specializedTaskModel.layout === "support" ? "0.95fr 1.05fr 0.95fr" : "repeat(3,minmax(0,1fr))", gap: 14 }}>
            {dashboardWidgets.heroStats.map((item, index) => (
              <div key={item.label} style={{ borderRadius: 22, border, background: panelBackground, padding: 22, overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", right: -26, bottom: -32, width: 122, height: 122, borderRadius: "50%", background: (index === 0 ? accentTone : index === 1 ? altTone : item.tone) + "18" }} />
                <div style={{ color: mutedText, fontSize: 13, position: "relative" }}>{item.label}</div>
                <div style={{ marginTop: 12, fontSize: 36, fontWeight: 900, color: index === 0 ? accentTone : index === 1 ? altTone : item.tone, position: "relative" }}>{item.value}</div>
                <div style={{ marginTop: 12, color: mutedText, fontSize: 13, lineHeight: 1.7, position: "relative" }}>{item.note}</div>
              </div>
            ))}
          </section>
          <section style={{ display: "grid", gridTemplateColumns: specializedTaskModel.layout === "finance" ? "0.88fr 1.12fr" : "1.12fr 0.88fr", gap: 16 }}>
            <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.spotlightTitle}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {dashboardWidgets.spotlightItems.map((item, index) => (
                  <div key={item} style={{ borderRadius: 16, padding: "13px 15px", background: index === 0 ? accentTone + "12" : surface, border, color: panelText, fontSize: 13, fontWeight: 700 }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.rightTitle}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {dashboardWidgets.rightItems.map((item) => (
                  <div key={item.title} style={{ borderRadius: 16, padding: "14px 16px", background: surface, border }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div style={{ fontWeight: 800 }}>{item.title}</div>
                      <div style={{ width: 10, height: 10, borderRadius: 999, background: item.accent }} />
                    </div>
                    <div style={{ marginTop: 8, color: mutedText, fontSize: 13, lineHeight: 1.7 }}>{item.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </section>
      );
    }

    if (archetype === "crm") {
      return (
        <section style={{ display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", gap: 16 }}>
          <div style={{ borderRadius: 26, background: "linear-gradient(180deg,#0f172a 0%,#111827 100%)", color: "#e2e8f0", padding: 20, border: "1px solid rgba(148,163,184,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 16, background: "linear-gradient(135deg,#2563eb,#14b8a6)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 900 }}>
                {brand.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 900 }}>{brand}</div>
                <div style={{ marginTop: 2, color: "rgba(226,232,240,0.62)", fontSize: 12 }}>{isCn ? "销售工作台" : "Revenue workspace"}</div>
              </div>
            </div>
            <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
              {pages.slice(0, 8).map((item) => (
                <Link key={item.route} href={item.route === "dashboard" ? "/dashboard" : "/" + item.route} style={{ textDecoration: "none", borderRadius: 16, padding: "12px 14px", background: item.route === current.route ? "rgba(37,99,235,0.24)" : "rgba(255,255,255,0.04)", color: "#f8fafc", fontWeight: 700 }}>
                  {item.label}
                </Link>
              ))}
            </div>
            <div style={{ marginTop: 18, borderRadius: 18, background: "rgba(255,255,255,0.05)", padding: 14 }}>
              <div style={{ fontSize: 12, color: "rgba(226,232,240,0.62)" }}>{isCn ? "季度目标完成度" : "Quarter target"}</div>
              <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900 }}>{dashboardWidgets.progressValue}%</div>
              {renderProgressRail(dashboardWidgets.progressValue, "#60a5fa")}
            </div>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}>
              {dashboardWidgets.heroStats.map((item) => (
                <div key={item.label} style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
                  <div style={{ width: 50, height: 50, borderRadius: 18, background: "rgba(37,99,235,0.08)", display: "grid", placeItems: "center", color: item.tone, fontSize: 24, fontWeight: 900 }}>
                    {item.label.charAt(0)}
                  </div>
                  <div style={{ marginTop: 18, fontSize: 18, color: mutedText }}>{item.label}</div>
                  <div style={{ marginTop: 6, fontSize: 36, fontWeight: 900, color: "#0f172a" }}>{item.value}</div>
                  <div style={{ marginTop: 8, fontSize: 13, color: mutedText }}>{item.note}</div>
                </div>
              ))}
            </section>
            <section style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
              <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.laneTitle}</div>
                <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
                  {dashboardWidgets.laneItems.map((item) => (
                    <div key={item.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div style={{ fontWeight: 700 }}>{item.label}</div>
                        <div style={{ fontWeight: 800, color: accent }}>{item.value}</div>
                      </div>
                      {renderProgressRail(item.progress, "#2563eb")}
                      <div style={{ marginTop: 8, color: mutedText, fontSize: 12 }}>{item.note}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "Deal distribution" : "Deal distribution"}</div>
                <div style={{ marginTop: 22, display: "grid", placeItems: "center" }}>
                  <div style={{ width: 210, height: 210, borderRadius: "50%", background: "conic-gradient(#2563eb 0 28%, #f59e0b 28% 52%, #7c3aed 52% 76%, #14b8a6 76% 100%)", position: "relative" }}>
                    <div style={{ position: "absolute", inset: 34, borderRadius: "50%", background: "#fff" }} />
                  </div>
                </div>
                <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
                  {dashboardWidgets.rightItems.map((item) => (
                    <div key={item.title} style={{ display: "flex", alignItems: "center", gap: 10, color: mutedText, fontSize: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 999, background: item.accent }} />
                      <span>{item.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </section>
      );
    }

    if (archetype === "api_platform") {
      return (
        <section style={{ display: "grid", gap: 16 }}>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
            {dashboardWidgets.heroStats.map((item) => (
              <div key={item.label} style={{ borderRadius: 22, border, background: panelBackground, padding: 20 }}>
                <div style={{ color: mutedText, fontSize: 12 }}>{item.label}</div>
                <div style={{ marginTop: 8, fontSize: 34, fontWeight: 900, color: item.tone }}>{item.value}</div>
                <div style={{ marginTop: 8, color: mutedText, fontSize: 13 }}>{item.note}</div>
              </div>
            ))}
          </section>
          <section style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 16 }}>
            <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.laneTitle}</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: mutedText }}>{isCn ? "端点、事件、计费和治理流量分布" : "Endpoint, event, billing, and governance traffic"}</div>
                </div>
                <div style={{ borderRadius: 999, padding: "8px 12px", background: "rgba(6,182,212,0.16)", color: "#67e8f9", fontSize: 11, fontWeight: 800 }}>
                  {dashboardWidgets.progressLabel}
                </div>
              </div>
              <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
                {dashboardWidgets.laneItems.map((item) => (
                  <div key={item.label} style={{ borderRadius: 16, padding: "14px 16px", background: "rgba(255,255,255,0.03)", border }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{item.label}</div>
                        <div style={{ marginTop: 4, color: mutedText, fontSize: 12 }}>{item.note}</div>
                      </div>
                      <div style={{ fontWeight: 900, color: "#67e8f9" }}>{item.value}</div>
                    </div>
                    {renderProgressRail(item.progress, "#06b6d4")}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.rightTitle}</div>
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {dashboardWidgets.rightItems.map((item) => (
                    <div key={item.title} style={{ borderRadius: 16, padding: "14px 16px", background: "rgba(255,255,255,0.03)", border }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 800 }}>{item.title}</div>
                        <div style={{ width: 10, height: 10, borderRadius: 999, background: item.accent }} />
                      </div>
                      <div style={{ marginTop: 8, color: mutedText, lineHeight: 1.7, fontSize: 13 }}>{item.note}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.spotlightTitle}</div>
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {dashboardWidgets.spotlightItems.map((item, index) => (
                    <div key={item} style={{ borderRadius: 16, padding: "12px 14px", background: index === 0 ? "rgba(6,182,212,0.16)" : "rgba(255,255,255,0.03)", border, color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </section>
      );
    }

    if (archetype === "community") {
      return (
        <section style={{ display: "grid", gap: 16 }}>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
            {dashboardWidgets.heroStats.map((item) => (
              <div key={item.label} style={{ borderRadius: 22, border, background: panelBackground, padding: 20 }}>
                <div style={{ color: mutedText, fontSize: 12 }}>{item.label}</div>
                <div style={{ marginTop: 8, fontSize: 32, fontWeight: 900, color: item.tone }}>{item.value}</div>
                <div style={{ marginTop: 8, color: mutedText, fontSize: 13 }}>{item.note}</div>
              </div>
            ))}
          </section>
          <section style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 16 }}>
            <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.laneTitle}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {dashboardWidgets.laneItems.map((item) => (
                  <div key={item.label} style={{ borderRadius: 18, border, background: surface, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 800 }}>{item.label}</div>
                      <div style={{ fontWeight: 900, color: accent }}>{item.value}</div>
                    </div>
                    {renderProgressRail(item.progress, "#7c3aed")}
                    <div style={{ marginTop: 8, color: mutedText, fontSize: 12 }}>{item.note}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.rightTitle}</div>
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {dashboardWidgets.rightItems.map((item) => (
                    <div key={item.title} style={{ borderRadius: 18, border, background: surface, padding: "14px 16px" }}>
                      <div style={{ fontWeight: 800 }}>{item.title}</div>
                      <div style={{ marginTop: 8, color: mutedText, fontSize: 13, lineHeight: 1.7 }}>{item.note}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.spotlightTitle}</div>
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {dashboardWidgets.spotlightItems.map((item, index) => (
                    <div key={item} style={{ borderRadius: 16, padding: "12px 14px", background: index === 0 ? "rgba(124,58,237,0.08)" : surface, border, color: panelText, fontSize: 13, fontWeight: 700 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </section>
      );
    }

    if (archetype === "marketing_admin") {
      return (
        <section style={{ display: "grid", gap: 16 }}>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
            {dashboardWidgets.heroStats.map((item) => (
              <div key={item.label} style={{ borderRadius: 22, border, background: panelBackground, padding: 20 }}>
                <div style={{ color: mutedText, fontSize: 12 }}>{item.label}</div>
                <div style={{ marginTop: 8, fontSize: 32, fontWeight: 900, color: item.tone }}>{item.value}</div>
                <div style={{ marginTop: 8, color: mutedText, fontSize: 13 }}>{item.note}</div>
              </div>
            ))}
          </section>
          <section style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 16 }}>
            <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.laneTitle}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                {dashboardWidgets.laneItems.map((item) => (
                  <div key={item.label} style={{ borderRadius: 16, border, background: surface, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{item.label}</div>
                        <div style={{ marginTop: 4, color: mutedText, fontSize: 12 }}>{item.note}</div>
                      </div>
                      <div style={{ fontWeight: 900, color: accent }}>{item.value}</div>
                    </div>
                    {renderProgressRail(item.progress, "#111827")}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.rightTitle}</div>
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {dashboardWidgets.rightItems.map((item) => (
                    <div key={item.title} style={{ borderRadius: 16, border, background: surface, padding: "14px 16px" }}>
                      <div style={{ fontWeight: 800 }}>{item.title}</div>
                      <div style={{ marginTop: 8, color: mutedText, fontSize: 13, lineHeight: 1.7 }}>{item.note}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.progressLabel}</div>
                <div style={{ marginTop: 10, fontSize: 30, fontWeight: 900 }}>{dashboardWidgets.progressValue}%</div>
                {renderProgressRail(dashboardWidgets.progressValue, "#111827")}
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {dashboardWidgets.progressBreakdown.map((item) => (
                    <div key={item} style={{ borderRadius: 999, border, background: surface, padding: "6px 10px", fontSize: 12, color: panelText }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </section>
      );
    }

    if (isAdminOps) {
      return (
        <section style={{ display: "grid", gap: 16 }}>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
            {dashboardWidgets.heroStats.map((item) => (
              <div key={item.label} style={{ borderRadius: 22, border, background: panelBackground, padding: 20 }}>
                <div style={{ color: mutedText, fontSize: 12 }}>{item.label}</div>
                <div style={{ marginTop: 8, fontSize: 32, fontWeight: 900, color: item.tone }}>{item.value}</div>
                <div style={{ marginTop: 8, color: mutedText, fontSize: 13 }}>{item.note}</div>
              </div>
            ))}
          </section>
          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.laneTitle}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {dashboardWidgets.laneItems.map((item) => (
                  <div key={item.label} style={{ borderRadius: 16, border, background: surface, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 800 }}>{item.label}</div>
                      <div style={{ fontWeight: 900, color: accent }}>{item.value}</div>
                    </div>
                    {renderProgressRail(item.progress, item.label.toLowerCase().includes("incident") || item.label.includes("事件") ? "#ef4444" : "#7c3aed")}
                    <div style={{ marginTop: 8, color: mutedText, fontSize: 12 }}>{item.note}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.rightTitle}</div>
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {dashboardWidgets.rightItems.map((item) => (
                    <div key={item.title} style={{ borderRadius: 16, border, background: surface, padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 800 }}>{item.title}</div>
                        <div style={{ width: 10, height: 10, borderRadius: 999, background: item.accent }} />
                      </div>
                      <div style={{ marginTop: 8, color: mutedText, fontSize: 13, lineHeight: 1.7 }}>{item.note}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderRadius: 24, border, background: panelBackground, padding: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.spotlightTitle}</div>
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {dashboardWidgets.spotlightItems.map((item, index) => (
                    <div key={item} style={{ borderRadius: 16, padding: "12px 14px", background: index === 0 ? "rgba(124,58,237,0.08)" : surface, border, color: panelText, fontSize: 13, fontWeight: 700 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </section>
      );
    }

    return (
      <section style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 16 }}>
        <div style={{ borderRadius: 24, border, background: panelBackground, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.laneTitle}</div>
              <div style={{ marginTop: 6, color: mutedText, fontSize: 13 }}>{routeBlueprint?.purpose || current.summary}</div>
            </div>
            <div style={{ borderRadius: 999, padding: "8px 12px", background: surface, border, color: accent, fontSize: 11, fontWeight: 800 }}>
              {dashboardWidgets.progressLabel}
            </div>
          </div>
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            {dashboardWidgets.laneItems.map((item) => (
              <div key={item.label} style={{ borderRadius: 18, border, background: surface, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.label}</div>
                    <div style={{ marginTop: 4, color: mutedText, fontSize: 12 }}>{item.note}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: accent }}>{item.value}</div>
                  </div>
                </div>
                {renderProgressRail(item.progress)}
              </div>
            ))}
          </div>
          {routeBlueprint?.primaryActions?.length ? (
            <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {routeBlueprint.primaryActions.map((item) => (
                <div key={item} style={{ borderRadius: 999, padding: "8px 12px", background: accent, color: "#ffffff", fontSize: 12, fontWeight: 700, boxShadow: "0 14px 28px rgba(15,23,42,0.12)" }}>
                  {item}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ borderRadius: 24, border, background: panelBackground, padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.rightTitle}</div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {dashboardWidgets.rightItems.map((item) => (
                <div key={item.title} style={{ borderRadius: 16, border, background: surface, padding: "14px 15px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div style={{ fontWeight: 800 }}>{item.title}</div>
                    <div style={{ width: 12, height: 12, borderRadius: 999, background: item.accent }} />
                  </div>
                  <div style={{ marginTop: 8, color: mutedText, fontSize: 13, lineHeight: 1.7 }}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 24, border, background: panelBackground, padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{dashboardWidgets.progressLabel}</div>
            <div style={{ marginTop: 14, fontSize: 30, fontWeight: 900, color: accent }}>{dashboardWidgets.progressValue}%</div>
            {renderProgressRail(dashboardWidgets.progressValue)}
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {dashboardWidgets.progressBreakdown.map((item) => (
                <div key={item} style={{ borderRadius: 999, background: surface, border, padding: "6px 10px", fontSize: 12, color: panelText }}>
                  {item}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{dashboardWidgets.spotlightTitle}</div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {dashboardWidgets.spotlightItems.map((item, index) => (
                  <div key={item} style={{ borderRadius: 14, padding: "10px 12px", background: index === 0 ? ${JSON.stringify(archetype === "api_platform" ? "rgba(6,182,212,0.16)" : "rgba(37,99,235,0.08)")} : surface, border, color: panelText, fontSize: 13, fontWeight: 700 }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  };

  return (
    <main style={{ minHeight: "100vh", padding: 28, fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", background: ${JSON.stringify(
      archetype === "api_platform"
        ? "linear-gradient(180deg,#07111f 0%,#0b1220 100%)"
        : isSpecializedTask && domainFlavor === "healthcare"
          ? "radial-gradient(circle at top left, rgba(209,250,229,0.76), transparent 26%), linear-gradient(180deg,#f8fffd 0%,#eefbf6 42%,#ecfeff 100%)"
          : isSpecializedTask && domainFlavor === "education"
            ? "radial-gradient(circle at top right, rgba(219,234,254,0.86), transparent 28%), linear-gradient(180deg,#f8fbff 0%,#eef2ff 54%,#f5f3ff 100%)"
            : isSpecializedTask && domainFlavor === "finance"
              ? "radial-gradient(circle at top left, rgba(186,230,253,0.66), transparent 24%), linear-gradient(180deg,#f5fbff 0%,#eff6ff 45%,#eefdf5 100%)"
              : isSpecializedTask && domainFlavor === "recruiting"
                ? "radial-gradient(circle at top right, rgba(221,214,254,0.78), transparent 24%), linear-gradient(180deg,#f8fffc 0%,#f0fdfa 48%,#f5f3ff 100%)"
                : isSpecializedTask && domainFlavor === "support"
                  ? "radial-gradient(circle at top left, rgba(224,242,254,0.82), transparent 26%), linear-gradient(180deg,#f8fbff 0%,#eff6ff 42%,#fff7ed 100%)"
                  : isSpecializedTask && domainFlavor === "commerce_ops"
                    ? "radial-gradient(circle at top right, rgba(254,249,195,0.74), transparent 24%), linear-gradient(180deg,#fffdf5 0%,#fffbeb 44%,#f0fdf4 100%)"
                    : "linear-gradient(180deg,#f6f8fc 0%,#ffffff 52%,#eef4ff 100%)"
    )}, color: panelText }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 26, border, background: panelBackground, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
                <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: ${JSON.stringify(
                  archetype === "api_platform"
                    ? "rgba(6,182,212,0.16)"
                    : isSpecializedTask
                      ? "rgba(255,255,255,0.7)"
                      : "rgba(15,23,42,0.06)"
                )}, color: accent, fontSize: 12, fontWeight: 800 }}>
                {brand}
              </div>
              <h1 style={{ margin: "14px 0 8px", fontSize: 34, fontWeight: 900 }}>{current.headline}</h1>
              <p style={{ margin: 0, maxWidth: 860, color: mutedText, lineHeight: 1.8 }}>{routeBlueprint?.purpose || current.subheadline}</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {pages.map((item) => (
                <Link key={item.route} href={item.route === "dashboard" ? "/dashboard" : "/" + item.route} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 14px", background: item.route === current.route ? accent : ${JSON.stringify(archetype === "api_platform" ? "rgba(255,255,255,0.04)" : "#ffffff")}, color: item.route === current.route ? "#ffffff" : panelText, border: item.route === current.route ? "none" : border, fontSize: 13, fontWeight: 700 }}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
          {dashboardWidgets.heroStats.map((item) => (
            <div key={item.label} style={{ borderRadius: 20, border, background: panelBackground, padding: 18 }}>
              <div style={{ color: mutedText, fontSize: 12 }}>{item.label}</div>
              <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: item.tone }}>{item.value}</div>
              <div style={{ marginTop: 10, color: mutedText, fontSize: 12, lineHeight: 1.6 }}>{item.note}</div>
            </div>
          ))}
        </section>
        {isDashboard ? renderDashboardShell() : (
          <section style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 16 }}>
            <div style={{ borderRadius: 24, border, background: panelBackground, padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "当前页说明" : "Current page overview"}</div>
              <p style={{ marginTop: 12, color: mutedText, lineHeight: 1.8 }}>{current.summary}</p>
              {routeBlueprint?.primaryActions?.length ? (
                <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {routeBlueprint.primaryActions.map((item) => (
                    <div key={item} style={{ borderRadius: 999, padding: "6px 10px", background: surface, border, color: panelText, fontSize: 12, fontWeight: 700 }}>
                      {item}
                    </div>
                  ))}
                </div>
              ) : null}
              <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                {current.records.map((item) => (
                  <div key={item.title} style={{ borderRadius: 16, background: surface, border, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div style={{ fontWeight: 800 }}>{item.title}</div>
                      <div style={{ borderRadius: 999, padding: "4px 10px", background: ${JSON.stringify(archetype === "api_platform" ? "rgba(6,182,212,0.16)" : "rgba(37,99,235,0.08)")}, color: accent, fontSize: 11, fontWeight: 800 }}>
                        {item.status}
                      </div>
                    </div>
                    <div style={{ marginTop: 8, color: mutedText, lineHeight: 1.7, fontSize: 13 }}>{item.meta}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ borderRadius: 24, border, background: panelBackground, padding: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "关联模块" : "Linked modules"}</div>
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {(relatedModules.length ? relatedModules : current.focusAreas.map((item) => ({ label: item, summary: "" }))).map((item, index) => (
                    <div key={item.label} style={{ borderRadius: 14, padding: "12px 14px", background: index === 0 ? ${JSON.stringify(archetype === "api_platform" ? "rgba(6,182,212,0.16)" : "rgba(37,99,235,0.08)")} : surface, border, color: panelText }}>
                      <div style={{ fontWeight: 800 }}>{item.label}</div>
                      {"summary" in item && item.summary ? <div style={{ marginTop: 6, color: mutedText, fontSize: 12, lineHeight: 1.6 }}>{item.summary}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderRadius: 24, border, background: panelBackground, padding: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "关联实体与流程" : "Entities and workflows"}</div>
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {(relatedEntities.length
                    ? relatedEntities.map((item) => ({
                        title: item.label,
                        note: item.workflows.join(" / "),
                      }))
                    : (workflowSteps.length ? workflowSteps : (isCn
                        ? ["补真实数据读写", "让 AI 修改能反写到当前模块", "继续拉开各 archetype 的模块深度"]
                        : ["Connect real data reads and writes", "Let AI edits write back into this module", "Keep widening archetype-specific depth"])).map((item) => ({
                        title: item,
                        note: routeBlueprint?.label || current.label,
                      }))).map((item, index) => (
                    <div key={item.title} style={{ borderRadius: 14, padding: "12px 14px", background: index === 0 ? ${JSON.stringify(archetype === "api_platform" ? "rgba(6,182,212,0.16)" : "rgba(37,99,235,0.08)")} : surface, border, color: panelText, fontSize: 13 }}>
                      <div style={{ fontWeight: 800 }}>{item.title}</div>
                      <div style={{ marginTop: 6, color: mutedText }}>{item.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
        <section style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 16 }}>
          <div style={{ borderRadius: 24, border, background: panelBackground, padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "可操作焦点" : "Interactive focus"}</div>
            <p style={{ marginTop: 10, color: mutedText, lineHeight: 1.8, fontSize: 13 }}>
              {isCn
                ? "这里不是静态说明，而是可点、可切换、可记录的工作焦点。你可以直接把当前应用的模块、实体和流程切到眼前。"
                : "This is not a static summary. It is a live focus rail where modules, entities, and workflows can be switched in place."}
            </p>
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {focusCards.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActiveFocus(item.label)}
                  style={{
                    borderRadius: 999,
                    border: item.label === activeFocus ? "none" : border,
                    background: item.label === activeFocus ? item.tone : surface,
                    color: item.label === activeFocus ? "#ffffff" : panelText,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 16, borderRadius: 18, background: surface, border, padding: 16 }}>
              <div style={{ fontSize: 12, color: mutedText, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {isCn ? "当前焦点" : "Current focus"}
              </div>
              <div style={{ marginTop: 8, fontWeight: 900, fontSize: 20 }}>{activeFocusDetail.label}</div>
              <div style={{ marginTop: 8, color: mutedText, lineHeight: 1.8, fontSize: 13 }}>{activeFocusDetail.note}</div>
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {focusNotes.map((item) => (
                <div key={item} style={{ borderRadius: 16, background: surface, border, padding: "12px 14px", color: panelText, fontSize: 13 }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 24, border, background: panelBackground, padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "快速修改" : "Quick edit"}</div>
            <div style={{ marginTop: 12, color: mutedText, lineHeight: 1.8, fontSize: 13 }}>
              {isCn ? "模拟 AI 继续迭代当前工作区的地方。输入一句需求，按下按钮就会把它记到当前焦点上。" : "This simulates the AI iteration surface. Type a request and attach it to the current focus."}
            </div>
            <textarea
              value={quickNote}
              onChange={(event) => setQuickNote(event.target.value)}
              placeholder={isCn ? "例如：把当前模块切成更深色的控制台并加上审批队列" : "e.g. switch this module to a darker control panel and add an approval queue"}
              style={{
                marginTop: 14,
                width: "100%",
                minHeight: 120,
                borderRadius: 18,
                border,
                background: surface,
                color: panelText,
                padding: 16,
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
              }}
            />
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  const value = quickNote.trim()
                  if (!value) return
                  setFocusNotes((prev) => [value, ...prev].slice(0, 4))
                  setQuickNote("")
                }}
                style={{
                  borderRadius: 14,
                  border: "none",
                  background: accent,
                  color: "#fff",
                  padding: "10px 14px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {isCn ? "应用到当前焦点" : "Apply to focus"}
              </button>
              <button
                type="button"
                onClick={() => setFocusNotes((prev) => prev.slice(0, 1))}
                style={{
                  borderRadius: 14,
                  border,
                  background: surface,
                  color: panelText,
                  padding: "10px 14px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {isCn ? "重置" : "Reset"}
              </button>
              {current.route !== "dashboard" ? (
                <Link
                  href={current.route === "dashboard" ? "/dashboard" : "/" + current.route}
                  style={{
                    textDecoration: "none",
                    borderRadius: 14,
                    border,
                    background: "transparent",
                    color: accent,
                    padding: "10px 14px",
                    fontWeight: 800,
                  }}
                >
                  {isCn ? "打开当前页" : "Open current page"}
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
`
}

function renderCodePlatformHome(spec: AppSpec) {
  const isCn = spec.region === "cn"
  const brand = spec.appIdentity?.displayName ?? spec.title
  const icon = spec.visualSeed?.icon ?? spec.appIdentity?.icon ?? getArchetypeIconSeed("code_platform", spec.title)
  const heroTitle = isCn ? `欢迎回来，${brand}` : `Welcome back to ${brand}`
  const heroDesc =
    spec.appIdentity?.shortDescription ||
    (isCn
      ? "继续围绕当前工作区推进生成、编辑、预览和交付。"
      : "Continue from the current workspace across generate, edit, preview, and delivery.")
  const routeSeeds = getPreviewRouteBlueprints(spec)
  const entitySeeds = getPreviewEntityBlueprints(spec)
  const projectRows = (routeSeeds.length ? routeSeeds : [
    { label: isCn ? "编辑器" : "Editor", path: "/editor", purpose: isCn ? "主编码工作区" : "Primary coding surface", actions: [] },
    { label: isCn ? "运行" : "Runs", path: "/runs", purpose: isCn ? "查看构建与预览" : "Inspect builds and preview", actions: [] },
    { label: isCn ? "模板库" : "Templates", path: "/templates", purpose: isCn ? "选择生成起点" : "Choose generation starting points", actions: [] },
  ]).slice(0, 4).map((item, index) => ({
    name: item.label,
    stack: item.path.replace(/^\//, "") || "home",
    desc: item.purpose,
    progress: 72 + index * 7,
    tone: ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"][index] ?? "#8b5cf6",
    time: isCn ? `${index * 12 + 3} 分钟前` : `${index * 12 + 3} min ago`,
  }))
  const quickActions = [
    {
      title: isCn ? "AI 生成" : "AI generate",
      desc: isCn ? (spec.appIntent?.primaryWorkflow || "描述需求自动生成完整应用") : (spec.appIntent?.primaryWorkflow || "Describe the app and generate it"),
      tone: "#0ea5e9",
    },
    {
      title: isCn ? "进入编辑器" : "Open editor",
      desc: isCn ? "切到当前文件树和多标签编辑器" : "Jump into the file tree and multi-tab editor",
      tone: "#7c3aed",
    },
    {
      title: isCn ? "查看实体" : "Inspect entities",
      desc: entitySeeds[0]?.label ? `${entitySeeds[0].label} / ${entitySeeds[1]?.label ?? (isCn ? "运行记录" : "runtime")}` : (isCn ? "查看初始数据结构" : "Review initial data structures"),
      tone: "#10b981",
    },
    {
      title: isCn ? "部署预览" : "Deploy preview",
      desc: isCn ? "检查构建状态并打开预览" : "Check build state and open preview",
      tone: "#f59e0b",
    },
  ]
  const activityItems = (entitySeeds.length ? entitySeeds : [
    { label: isCn ? "源文件" : "Source file", summary: isCn ? "编辑器与文件树已建立" : "Editor and file tree are ready" },
    { label: isCn ? "运行记录" : "Runtime run", summary: isCn ? "构建验收链路正常" : "Build acceptance rail is healthy" },
    { label: isCn ? "模板资产" : "Template asset", summary: isCn ? "模板与套餐已同步" : "Templates and plans are synced" },
  ]).slice(0, 3).map((item, index) => ({
    title: isCn ? `${item.label} 已接入 ${brand}` : `${item.label} is now wired into ${brand}`,
    meta: item.summary + (isCn ? `  ·  ${index * 11 + 2} 分钟前` : `  ·  ${index * 11 + 2} min ago`),
    tone: ["#8b5cf6", "#10b981", "#3b82f6"][index] ?? "#8b5cf6",
  }))

  return `// @ts-nocheck
import Link from "next/link";

export default function Page() {
  const isCn = ${isCn ? "true" : "false"};
  const rows = ${JSON.stringify(projectRows, null, 2)} as const;
  const actions = ${JSON.stringify(quickActions, null, 2)} as const;
  const activities = ${JSON.stringify(activityItems, null, 2)} as const;
  const nav = [
    { href: "/", label: isCn ? "总览" : "Overview", active: true },
    { href: "/editor", label: isCn ? "编辑器" : "Editor", active: false },
    { href: "/runs", label: isCn ? "运行" : "Runs", active: false },
    { href: "/templates", label: isCn ? "模板库" : "Templates", active: false },
    { href: "/pricing", label: isCn ? "升级" : "Upgrade", active: false },
    ...(${spec.planTier === "elite" ? "true" : "false"}
      ? [
          { href: "/reports", label: isCn ? "汇报" : "Reports", active: false },
          { href: "/team", label: isCn ? "团队" : "Team", active: false },
        ]
      : []),
  ] as const;

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#12131a 0%,#161720 100%)", color: "#f5f7ff", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1460, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 26, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(22,23,32,0.96)", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: \`linear-gradient(135deg,\${icon.from},\${icon.to})\`, boxShadow: \`0 14px 34px \${icon.ring}\`, display: "grid", placeItems: "center", fontSize: 16, fontWeight: 900 }}>{icon.glyph}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{${JSON.stringify(brand)}}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{${JSON.stringify(spec.visualSeed?.tone ?? (isCn ? "AI 代码平台" : "AI code platform"))}}</div>
              </div>
              <div style={{ borderRadius: 10, padding: "6px 10px", background: "rgba(124,58,237,0.2)", color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>
                ${getCompactPlanTag(spec.planTier)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {nav.map((item) => (
                <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 14px", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.54)", background: item.active ? "rgba(124,58,237,0.22)" : "transparent", fontSize: 14, fontWeight: 700 }}>
                  {item.label}
                </Link>
              ))}
              <div style={{ marginLeft: 10, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1c1e29", padding: "10px 16px", minWidth: 220, color: "rgba(255,255,255,0.42)", fontSize: 13 }}>
                {isCn ? "搜索命令..." : "Search commands..."}
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 999, background: \`linear-gradient(135deg,\${icon.from},\${icon.to})\`, display: "grid", placeItems: "center", fontWeight: 800 }}>{icon.glyph}</div>
            </div>
          </div>

          <div style={{ padding: 22, display: "grid", gap: 18 }}>
            <section style={{ borderRadius: 24, border: "1px solid rgba(124,58,237,0.18)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.18), transparent 32%), #1b1827", padding: 26 }}>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>{${JSON.stringify(heroTitle)}} <span style={{ color: "#a78bfa" }}>👋</span></h1>
              <p style={{ margin: "10px 0 0", color: "rgba(255,255,255,0.58)", fontSize: 15 }}>{${JSON.stringify(heroDesc)}}</p>
              <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.65)" }}>
                {["M","L","Z","W"].map((name, index) => (
                  <div key={name} style={{ width: 32, height: 32, borderRadius: 999, display: "grid", placeItems: "center", background: index === 0 ? "linear-gradient(135deg,#8b5cf6,#a855f7)" : "linear-gradient(135deg,#6d28d9,#8b5cf6)", border: "2px solid #1b1827", marginLeft: index === 0 ? 0 : -8, fontSize: 12, fontWeight: 800 }}>
                    {name}
                  </div>
                ))}
                <span style={{ marginLeft: 10, fontSize: 13 }}>{isCn ? "4 位团队成员在线" : "4 teammates online"}</span>
              </div>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
              {[
                { label: isCn ? "活跃项目" : "Active projects", value: "12", delta: "+3", tone: "#8b5cf6" },
                { label: isCn ? "今日构建" : "Builds today", value: "47", delta: "+12", tone: "#38bdf8" },
                { label: isCn ? "AI 补全" : "AI assists", value: "1,284", delta: "+186", tone: "#f59e0b" },
                { label: "Git ${isCn ? "提交" : "commits"}", value: "89", delta: "-2", tone: "#10b981" },
              ].map((item) => (
                <div key={item.label} style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 48, height: 48, borderRadius: 16, background: item.tone, opacity: 0.9 }} />
                    <div style={{ color: item.delta.startsWith("-") ? "#f87171" : "#34d399", fontSize: 13, fontWeight: 700 }}>{item.delta}</div>
                  </div>
                  <div style={{ marginTop: 18, fontSize: 18, color: "rgba(255,255,255,0.54)" }}>{item.label}</div>
                  <div style={{ marginTop: 8, fontSize: 30, fontWeight: 900 }}>{item.value}</div>
                </div>
              ))}
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "1.35fr 0.65fr", gap: 16 }}>
              <div style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.07)", background: "#17181f", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "最近项目" : "Recent projects"}</div>
                  <div style={{ color: "#a78bfa", fontSize: 14 }}>{isCn ? "查看全部 →" : "View all →"}</div>
                </div>
                <div>
                  {rows.map((row) => (
                    <div key={row.name} style={{ display: "grid", gridTemplateColumns: "48px 1fr 220px", gap: 14, alignItems: "center", padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ width: 48, height: 48, borderRadius: 16, background: row.tone + "22", display: "grid", placeItems: "center", color: row.tone, fontWeight: 900 }}>◉</div>
                      <div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ fontSize: 16, fontWeight: 800 }}>{row.name}</div>
                          <div style={{ borderRadius: 10, background: "rgba(255,255,255,0.06)", padding: "4px 8px", color: "rgba(255,255,255,0.55)", fontSize: 12 }}>{row.stack}</div>
                        </div>
                        <div style={{ marginTop: 6, color: "rgba(255,255,255,0.5)", fontSize: 14 }}>{row.desc}</div>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.56)", fontSize: 12 }}>
                          <span>{row.progress}%</span>
                          <span>{row.time}</span>
                        </div>
                        <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                          <div style={{ width: row.progress + "%", height: "100%", background: row.tone, borderRadius: 999 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.07)", background: "#17181f", padding: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "快速开始" : "Quick start"}</div>
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
                    {actions.map((action, index) => (
                      <Link
                        key={action.title}
                        href={index === 0 ? "/templates" : index === 1 ? "/editor" : index === 2 ? "/runs" : "/pricing"}
                        style={{ textDecoration: "none", borderRadius: 18, background: "#1f212c", padding: 16, display: "block", color: "#f8fafc" }}
                      >
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: action.tone, marginBottom: 14 }} />
                        <div style={{ fontWeight: 800 }}>{action.title}</div>
                        <div style={{ marginTop: 6, color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.7 }}>{action.desc}</div>
                      </Link>
                    ))}
                </div>
              </div>

                <div style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.07)", background: "#17181f", padding: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "动态日志" : "Activity log"}</div>
                  <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                    {activities.map((item) => (
                      <div key={item.title} style={{ borderRadius: 18, background: "#1f212c", padding: 14 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <div style={{ width: 12, height: 12, borderRadius: 999, background: item.tone }} />
                          <div style={{ fontWeight: 700 }}>{item.title}</div>
                        </div>
                        <div style={{ marginTop: 8, color: "rgba(255,255,255,0.48)", fontSize: 13 }}>{item.meta}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
`
}

function renderPremiumTemplateHome(spec: AppSpec) {
  const isCn = spec.region === "cn"
  const templateId = spec.templateId ?? "default"

  if (templateId === "taskflow") {
    const metrics = isCn
      ? [
          { label: "待办任务", value: "128", tone: "#38bdf8" },
          { label: "进行中", value: "42", tone: "#8b5cf6" },
          { label: "已完成", value: "87%", tone: "#10b981" },
          { label: "团队成员", value: "19", tone: "#f59e0b" },
        ]
      : [
          { label: "Todo items", value: "128", tone: "#38bdf8" },
          { label: "In progress", value: "42", tone: "#8b5cf6" },
          { label: "Completed", value: "87%", tone: "#10b981" },
          { label: "Team members", value: "19", tone: "#f59e0b" },
        ]
    const rows = isCn
      ? [
          { name: "审批队列优化", owner: "张伟", status: "进行中", progress: 82 },
          { name: "负责人负载图", owner: "王芳", status: "待办", progress: 56 },
          { name: "任务完成回流", owner: "陈晨", status: "已完成", progress: 94 },
        ]
      : [
          { name: "Approval queue tuning", owner: "Wei Zhang", status: "In progress", progress: 82 },
          { name: "Owner workload chart", owner: "Fang Wang", status: "Todo", progress: 56 },
          { name: "Completion handoff", owner: "Chen Chen", status: "Done", progress: 94 },
        ]
    return `// @ts-nocheck
import Link from "next/link";

export default function Page() {
  const isCn = ${isCn ? "true" : "false"};
  const metrics = ${JSON.stringify(metrics, null, 2)} as const;
  const rows = ${JSON.stringify(rows, null, 2)} as const;
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#0b1020 0%,#111827 100%)", color: "#f8fafc", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1420, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, background: "radial-gradient(circle at top right, rgba(34,211,238,0.18), transparent 28%), rgba(15,23,42,0.92)", border: "1px solid rgba(56,189,248,0.14)", padding: 24 }}>
          <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(34,211,238,0.12)", color: "#67e8f9", fontSize: 12, fontWeight: 800 }}>{isCn ? "运营任务管理" : "Operations task management"}</div>
          <h1 style={{ margin: "14px 0 10px", fontSize: 40, fontWeight: 900 }}>{isCn ? "任务推进、负责人和优先级全部收在一个后台里" : "Keep task progression, owners, and priorities in one control plane"}</h1>
          <p style={{ margin: 0, maxWidth: 820, color: "#94a3b8", fontSize: 16, lineHeight: 1.8 }}>{isCn ? "这不是普通待办列表，而是带进度图、负载图和筛选动作的运营控制台。" : "This is not a to-do list. It is an operations console with progress charts, workload views, and filters."}</p>
          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/tasks" style={{ textDecoration: "none", borderRadius: 999, padding: "10px 14px", background: "#06b6d4", color: "#082f49", fontWeight: 800 }}>{isCn ? "查看任务" : "Open tasks"}</Link>
            <Link href="/analytics" style={{ textDecoration: "none", borderRadius: 999, padding: "10px 14px", border: "1px solid rgba(56,189,248,0.16)", color: "#67e8f9", fontWeight: 700 }}>{isCn ? "负载分析" : "Workload analytics"}</Link>
          </div>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
          {metrics.map((item) => (
            <div key={item.label} style={{ borderRadius: 22, background: "rgba(15,23,42,0.76)", border: "1px solid rgba(148,163,184,0.1)", padding: 20 }}>
              <div style={{ color: "#94a3b8", fontSize: 14 }}>{item.label}</div>
              <div style={{ marginTop: 12, fontSize: 34, color: item.tone, fontWeight: 900 }}>{item.value}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 16 }}>
          <div style={{ borderRadius: 24, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(148,163,184,0.1)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "推进列表" : "Progress list"}</div>
            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              {rows.map((item) => (
                <div key={item.name} style={{ borderRadius: 16, background: "#111827", padding: "14px 16px", color: "#cbd5e1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{item.name}</div>
                      <div style={{ marginTop: 4, color: "#94a3b8", fontSize: 13 }}>{item.owner}</div>
                    </div>
                    <div style={{ borderRadius: 999, background: "rgba(34,211,238,0.14)", color: "#67e8f9", padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>{item.status}</div>
                  </div>
                  <div style={{ marginTop: 12, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ width: item.progress + "%", height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#22d3ee,#8b5cf6)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ borderRadius: 24, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(148,163,184,0.1)", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "筛选与动作" : "Filters and actions"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {(isCn ? ["负责人筛选", "优先级筛选", "状态推进", "标记完成"] : ["Owner filter", "Priority filter", "Status progression", "Mark complete"]).map((item) => (
                  <div key={item} style={{ borderRadius: 14, background: "#111827", padding: "12px 14px", color: "#cbd5e1" }}>{item}</div>
                ))}
              </div>
            </div>
            <div style={{ borderRadius: 24, background: "linear-gradient(135deg,rgba(14,165,233,0.18),rgba(99,102,241,0.16))", border: "1px solid rgba(56,189,248,0.14)", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "首页图表" : "Dashboard charts"}</div>
              <p style={{ marginTop: 12, color: "#cbd5e1", lineHeight: 1.8 }}>{isCn ? "这里会承接任务进度图和负责人负载图，用来判断当前版本到底能不能跑起来。" : "This home view surfaces progress charts and owner workload charts so the team can judge readiness at a glance."}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
`
  }

  if (templateId === "orbital") {
    const metrics = isCn
      ? [
          { label: "接口数", value: "84", tone: "#38bdf8" },
          { label: "投递失败", value: "3", tone: "#f59e0b" },
          { label: "鉴权策略", value: "12", tone: "#10b981" },
          { label: "环境配置", value: "5", tone: "#8b5cf6" },
        ]
      : [
          { label: "Endpoints", value: "84", tone: "#38bdf8" },
          { label: "Delivery fails", value: "3", tone: "#f59e0b" },
          { label: "Auth policies", value: "12", tone: "#10b981" },
          { label: "Environments", value: "5", tone: "#8b5cf6" },
        ]
    const rows = isCn
      ? [
          { name: "POST /checkout", status: "健康", detail: "最近 1h 无失败" },
          { name: "POST /webhook/order", status: "重试中", detail: "2 次重试待恢复" },
          { name: "GET /docs", status: "稳定", detail: "文档与 SDK 已同步" },
        ]
      : [
          { name: "POST /checkout", status: "Healthy", detail: "No failure in the last hour" },
          { name: "POST /webhook/order", status: "Retrying", detail: "2 retries awaiting recovery" },
          { name: "GET /docs", status: "Stable", detail: "Docs and SDKs are synced" },
        ]
    return `// @ts-nocheck
import Link from "next/link";

export default function Page() {
  const isCn = ${isCn ? "true" : "false"};
  const metrics = ${JSON.stringify(metrics, null, 2)} as const;
  const rows = ${JSON.stringify(rows, null, 2)} as const;
  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(circle at top, rgba(96,165,250,0.14), transparent 24%), linear-gradient(180deg,#020617 0%,#0b1220 100%)", color: "#e5eefc", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, border: "1px solid rgba(99,102,241,0.2)", background: "rgba(8,15,33,0.78)", padding: 24 }}>
          <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(6,182,212,0.16)", color: "#67e8f9", fontSize: 12, fontWeight: 800 }}>{isCn ? "API 平台" : "API platform"}</div>
          <h1 style={{ margin: "14px 0 10px", fontSize: 40, fontWeight: 900 }}>{isCn ? "接口、日志、鉴权和 webhook 恢复放在一个运行态控制台里" : "Keep endpoints, logs, auth, and webhook recovery in one runtime console"}</h1>
          <p style={{ margin: 0, maxWidth: 840, color: "#94a3b8", fontSize: 16, lineHeight: 1.8 }}>{isCn ? "这类需求要看起来像真正的开发者平台，而不是普通列表页。" : "This archetype should feel like a real developer platform, not a list page."}</p>
          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/endpoints" style={{ textDecoration: "none", borderRadius: 999, padding: "10px 14px", background: "#06b6d4", color: "#082f49", fontWeight: 800 }}>{isCn ? "接口目录" : "Endpoints"}</Link>
            <Link href="/webhooks" style={{ textDecoration: "none", borderRadius: 999, padding: "10px 14px", border: "1px solid rgba(56,189,248,0.16)", color: "#67e8f9", fontWeight: 700 }}>{isCn ? "投递恢复" : "Recovery"}</Link>
          </div>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
          {metrics.map((item) => (
            <div key={item.label} style={{ borderRadius: 22, background: "rgba(15,23,42,0.76)", border: "1px solid rgba(148,163,184,0.1)", padding: 20 }}>
              <div style={{ color: "#94a3b8", fontSize: 14 }}>{item.label}</div>
              <div style={{ marginTop: 12, fontSize: 34, color: item.tone, fontWeight: 900 }}>{item.value}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
          <div style={{ borderRadius: 24, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(148,163,184,0.1)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "运行表面" : "Runtime surfaces"}</div>
            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              {(isCn ? ["接口目录", "日志检索", "鉴权策略", "环境开关"] : ["Endpoint catalog", "Log explorer", "Auth policy", "Environment switches"]).map((item) => (
                <div key={item} style={{ borderRadius: 16, background: "#111827", padding: "14px 16px", color: "#cbd5e1" }}>{item}</div>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ borderRadius: 24, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(148,163,184,0.1)", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "Webhook 恢复" : "Webhook recovery"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {rows.map((item, index) => (
                  <div key={item.name} style={{ borderRadius: 14, background: index === 0 ? "rgba(239,68,68,0.12)" : "#111827", color: "#cbd5e1", padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 800 }}>{item.name}</div>
                      <div style={{ borderRadius: 999, background: "rgba(6,182,212,0.16)", color: "#67e8f9", padding: "4px 8px", fontSize: 12, fontWeight: 700 }}>{item.status}</div>
                    </div>
                    <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 13 }}>{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderRadius: 24, background: "linear-gradient(135deg,rgba(14,165,233,0.18),rgba(99,102,241,0.16))", border: "1px solid rgba(56,189,248,0.14)", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "平台说明" : "Platform note"}</div>
              <p style={{ marginTop: 12, color: "#cbd5e1", lineHeight: 1.8 }}>{isCn ? "接口、鉴权和环境开关是一套运行态，而 webhook 投递恢复要单独突出重试与回放。" : "Endpoints, auth, and environment controls form the runtime rail, while webhook recovery deserves its own replay and retry surface."}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
`
  }

  if (templateId === "serenity") {
    const cards = isCn
      ? [
          { title: "反馈收集", note: "把建议、问题和需求聚合成优先级清单" },
          { title: "路线图", note: "把反馈流转到正在推进的版本计划" },
          { title: "成员与审核", note: "展示成员、公告和审核边界" },
        ]
      : [
          { title: "Feedback intake", note: "Aggregate ideas, issues, and requests into priority queues" },
          { title: "Roadmap", note: "Turn feedback into active version plans" },
          { title: "Members and moderation", note: "Show members, announcements, and policy boundaries" },
        ]
    return `// @ts-nocheck
import Link from "next/link";

export default function Page() {
  const isCn = ${isCn ? "true" : "false"};
  const cards = ${JSON.stringify(cards, null, 2)} as const;
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#fff7f2 0%,#ffffff 42%,#f8fafc 100%)", color: "#1f2937", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1380, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, background: "#ffffff", border: "1px solid rgba(148,163,184,0.18)", padding: 26 }}>
          <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "#ffedd5", color: "#c2410c", fontSize: 12, fontWeight: 800 }}>{isCn ? "社区反馈中心" : "Community feedback hub"}</div>
          <h1 style={{ margin: "16px 0 12px", fontSize: 44, fontWeight: 900 }}>{isCn ? "让反馈、路线图、公告和成员运营在同一页面里发生" : "Keep feedback, roadmap, announcements, and member ops in one surface"}</h1>
          <p style={{ margin: 0, color: "#64748b", maxWidth: 860, lineHeight: 1.8 }}>{isCn ? "这类需求应该看起来像真实社区团队每天在用的反馈中心，而不是普通首页。" : "This should feel like a real community feedback center used every day, not a generic landing page."}</p>
          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/feedback" style={{ textDecoration: "none", borderRadius: 999, padding: "10px 14px", background: "#7c3aed", color: "#ffffff", fontWeight: 700 }}>{isCn ? "进入反馈" : "Open feedback"}</Link>
            <Link href="/roadmap" style={{ textDecoration: "none", borderRadius: 999, padding: "10px 14px", border: "1px solid rgba(124,58,237,0.16)", color: "#7c3aed", fontWeight: 700 }}>{isCn ? "查看路线图" : "View roadmap"}</Link>
          </div>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
          {cards.map((card, index) => (
            <div key={card.title} style={{ borderRadius: 24, background: index === 0 ? "rgba(124,58,237,0.08)" : "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 22, minHeight: 280 }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: index === 0 ? "#7c3aed" : index === 1 ? "#0ea5e9" : "#f59e0b", marginBottom: 20 }} />
              <div style={{ fontSize: 22, fontWeight: 900 }}>{card.title}</div>
              <div style={{ marginTop: 12, color: "#64748b", lineHeight: 1.8 }}>{card.note}</div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
`
  }

  if (templateId === "opsdesk") {
    const metrics = isCn
      ? [
          { label: "本月新增线索", value: "128", tone: "#2563eb" },
          { label: "推进中商机", value: "42", tone: "#8b5cf6" },
          { label: "成交率", value: "31%", tone: "#10b981" },
          { label: "待跟进客户", value: "19", tone: "#f59e0b" },
        ]
      : [
          { label: "New leads", value: "128", tone: "#2563eb" },
          { label: "Open deals", value: "42", tone: "#8b5cf6" },
          { label: "Close rate", value: "31%", tone: "#10b981" },
          { label: "Follow-ups", value: "19", tone: "#f59e0b" },
        ]
    const deals = isCn
      ? [
          { name: "华星科技年度合作", owner: "张伟", stage: "方案确认", amount: "¥186,000" },
          { name: "景曜智能扩容采购", owner: "王芳", stage: "商务谈判", amount: "¥92,000" },
          { name: "合一供应链试点", owner: "陈晨", stage: "产品演示", amount: "¥58,000" },
        ]
      : [
          { name: "Huaxing annual deal", owner: "Zhang Wei", stage: "Proposal", amount: "$26,000" },
          { name: "Jingyao expansion", owner: "Wang Fang", stage: "Negotiation", amount: "$12,000" },
          { name: "Heyi supply-chain pilot", owner: "Chen Chen", stage: "Demo", amount: "$8,000" },
        ]
    return `// @ts-nocheck
import Link from "next/link";

export default function Page() {
  const isCn = ${isCn ? "true" : "false"};
  const metrics = ${JSON.stringify(metrics, null, 2)} as const;
  const deals = ${JSON.stringify(deals, null, 2)} as const;
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f6f8fc 0%,#eef4ff 100%)", color: "#0f172a", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1420, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, background: "#ffffff", border: "1px solid rgba(148,163,184,0.18)", padding: 24, boxShadow: "0 24px 70px rgba(15,23,42,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                {[
                  { href: "/", label: isCn ? "销售总览" : "Overview", active: true },
                  { href: "/leads", label: isCn ? "线索池" : "Leads" },
                  { href: "/tasks", label: isCn ? "跟进任务" : "Tasks" },
                  { href: "/analytics", label: isCn ? "分析" : "Analytics" },
                ].map((item) => (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "#2563eb" : "#eff6ff", color: item.active ? "#ffffff" : "#2563eb", fontSize: 13, fontWeight: 700 }}>
                    {item.label}
                  </Link>
                ))}
              </div>
              <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "#dbeafe", color: "#2563eb", fontSize: 12, fontWeight: 800 }}>{isCn ? "销售管理后台" : "Sales workspace"}</div>
              <h1 style={{ margin: "14px 0 10px", fontSize: 40, fontWeight: 900 }}>{isCn ? "销售线索与成交推进中枢" : "Lead and revenue command center"}</h1>
              <p style={{ margin: 0, maxWidth: 820, color: "#64748b", fontSize: 16, lineHeight: 1.8 }}>
                {isCn ? "更像真正成交团队使用的 CRM 后台，覆盖线索、推进阶段、负责人、回款节奏和市场转化联动。" : "A CRM workspace for real revenue teams, combining leads, stages, owners, billing rhythm, and market conversion."}
              </p>
              <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/leads" style={{ textDecoration: "none", borderRadius: 999, padding: "10px 14px", background: "#2563eb", color: "#ffffff", fontWeight: 700 }}>
                  {isCn ? "进入线索池" : "Open lead pool"}
                </Link>
                <Link href="/tasks" style={{ textDecoration: "none", borderRadius: 999, padding: "10px 14px", border: "1px solid rgba(37,99,235,0.16)", color: "#2563eb", fontWeight: 700 }}>
                  {isCn ? "跟进任务" : "Follow-up tasks"}
                </Link>
              </div>
            </div>
            <div style={{ borderRadius: 18, background: "#2563eb", color: "#fff", padding: "14px 18px", fontWeight: 800 }}>{isCn ? "新建线索" : "New lead"}</div>
          </div>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
          {metrics.map((item) => (
            <div key={item.label} style={{ borderRadius: 22, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20 }}>
              <div style={{ color: "#64748b", fontSize: 14 }}>{item.label}</div>
              <div style={{ marginTop: 12, fontSize: 34, color: item.tone, fontWeight: 900 }}>{item.value}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
          <div style={{ borderRadius: 24, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(148,163,184,0.14)", fontSize: 18, fontWeight: 800 }}>{isCn ? "重点商机" : "Key opportunities"}</div>
            {deals.map((deal) => (
              <div key={deal.name} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, alignItems: "center", padding: "18px 20px", borderBottom: "1px solid rgba(148,163,184,0.12)" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{deal.name}</div>
                  <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>{deal.owner}</div>
                </div>
                <div style={{ borderRadius: 999, background: "#eef2ff", color: "#4338ca", padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>{deal.stage}</div>
                <div style={{ fontWeight: 800 }}>{deal.amount}</div>
                <div style={{ color: "#2563eb", fontWeight: 700 }}>{isCn ? "查看" : "Open"}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ borderRadius: 24, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "本周动作" : "This week"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {(isCn ? ["批量导入市场线索", "同步 payment 升级客户", "输出销售周报"] : ["Import market leads", "Sync billing-upgraded users", "Export weekly report"]).map((item) => (
                  <div key={item} style={{ borderRadius: 14, background: "#f8fafc", padding: "12px 14px", color: "#334155" }}>{item}</div>
                ))}
              </div>
            </div>
            <div style={{ borderRadius: 24, background: "#0f172a", color: "#e2e8f0", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "成交提醒" : "Closing reminders"}</div>
              <p style={{ marginTop: 12, color: "#94a3b8", lineHeight: 1.8 }}>{isCn ? "让 market 销售链路和后台权限升级绑定在一起，确保客户成交后能立刻反映到产品能力。" : "Bind the market sales loop to workspace upgrades so paid conversions unlock product access immediately."}</p>
            </div>
          </div>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
          {(isCn
            ? [
                { title: "渠道来源", note: "按官网、市场投放、私域推荐拆解线索来源" },
                { title: "成交节奏", note: "把跟进、报价、签约、升级串成完整收入路径" },
                { title: "交付衔接", note: "支付完成后同步套餐权限与客户 onboarding" },
              ]
            : [
                { title: "Acquisition channels", note: "Break lead sources into website, campaigns, and referrals" },
                { title: "Close cadence", note: "Connect outreach, pricing, closing, and upgrades in one path" },
                { title: "Delivery handoff", note: "Sync billing upgrades to onboarding and access immediately" },
              ]).map((item) => (
            <div key={item.title} style={{ borderRadius: 22, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20 }}>
              <div style={{ fontWeight: 900 }}>{item.title}</div>
              <div style={{ marginTop: 10, color: "#64748b", lineHeight: 1.8 }}>{item.note}</div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
`
  }

  if (templateId === "taskflow") {
    const metrics = isCn
      ? [
          { label: "API 请求量", value: "2.4M", tone: "#38bdf8" },
          { label: "告警事件", value: "18", tone: "#f59e0b" },
          { label: "可用率", value: "99.97%", tone: "#10b981" },
          { label: "文档模块", value: "28", tone: "#8b5cf6" },
        ]
      : [
          { label: "API requests", value: "2.4M", tone: "#38bdf8" },
          { label: "Alerts", value: "18", tone: "#f59e0b" },
          { label: "Uptime", value: "99.97%", tone: "#10b981" },
          { label: "Docs modules", value: "28", tone: "#8b5cf6" },
        ]
    return `// @ts-nocheck
import Link from "next/link";

export default function Page() {
  const isCn = ${isCn ? "true" : "false"};
  const metrics = ${JSON.stringify(metrics, null, 2)} as const;
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#07111f 0%,#0f172a 100%)", color: "#e2e8f0", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1420, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, border: "1px solid rgba(56,189,248,0.14)", background: "radial-gradient(circle at top right, rgba(34,211,238,0.16), transparent 28%), rgba(15,23,42,0.92)", padding: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: isCn ? "平台总览" : "Overview", active: true },
              { href: "/analytics", label: isCn ? "分析中心" : "Analytics" },
              { href: "/incidents", label: isCn ? "告警中心" : "Incidents" },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "#06b6d4" : "rgba(34,211,238,0.12)", color: item.active ? "#082f49" : "#67e8f9", fontSize: 13, fontWeight: 700 }}>
                {item.label}
              </Link>
            ))}
          </div>
          <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(34,211,238,0.12)", color: "#67e8f9", fontSize: 12, fontWeight: 800 }}>{isCn ? "API 数据平台" : "API platform"}</div>
          <h1 style={{ margin: "14px 0 10px", fontSize: 40, fontWeight: 900 }}>{isCn ? "接口监控、趋势分析与文档中枢" : "API monitoring, trends, and docs center"}</h1>
          <p style={{ margin: 0, maxWidth: 820, color: "#94a3b8", fontSize: 16, lineHeight: 1.8 }}>{isCn ? "这类需求应直接生成更像控制台的数据平台，而不是普通任务面板。" : "This archetype should render as a true data platform, not a generic task board."}</p>
          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/analytics" style={{ textDecoration: "none", borderRadius: 999, padding: "10px 14px", background: "#06b6d4", color: "#082f49", fontWeight: 800 }}>
              {isCn ? "查看分析中心" : "Open analytics"}
            </Link>
            <Link href="/incidents" style={{ textDecoration: "none", borderRadius: 999, padding: "10px 14px", border: "1px solid rgba(56,189,248,0.16)", color: "#67e8f9", fontWeight: 700 }}>
              {isCn ? "告警中心" : "Incident center"}
            </Link>
          </div>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
          {metrics.map((item) => (
            <div key={item.label} style={{ borderRadius: 22, background: "rgba(15,23,42,0.76)", border: "1px solid rgba(148,163,184,0.1)", padding: 20 }}>
              <div style={{ color: "#94a3b8", fontSize: 14 }}>{item.label}</div>
              <div style={{ marginTop: 12, fontSize: 34, color: item.tone, fontWeight: 900 }}>{item.value}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 16 }}>
          <div style={{ borderRadius: 24, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(148,163,184,0.1)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "核心图层" : "Core surfaces"}</div>
            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              {(isCn ? ["调用趋势总览", "错误告警列表", "接口文档中心", "SDK 与代码示例"] : ["Usage trends", "Incident alerts", "API docs", "SDK and code samples"]).map((item) => (
                <div key={item} style={{ borderRadius: 16, background: "#111827", padding: "14px 16px", color: "#cbd5e1" }}>{item}</div>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ borderRadius: 24, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(148,163,184,0.1)", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "当前异常" : "Current incidents"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {(isCn ? ["支付接口 5xx 波动", "Webhook 延迟超阈值", "文档同步任务等待中"] : ["Payment API 5xx spikes", "Webhook delay above threshold", "Docs sync pending"]).map((item, index) => (
                  <div key={item} style={{ borderRadius: 14, background: index === 0 ? "rgba(239,68,68,0.12)" : "#111827", color: index === 0 ? "#fca5a5" : "#cbd5e1", padding: "12px 14px" }}>{item}</div>
                ))}
              </div>
            </div>
            <div style={{ borderRadius: 24, background: "linear-gradient(135deg,rgba(14,165,233,0.18),rgba(99,102,241,0.16))", border: "1px solid rgba(56,189,248,0.14)", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "平台说明" : "Platform note"}</div>
              <p style={{ marginTop: 12, color: "#cbd5e1", lineHeight: 1.8 }}>{isCn ? "未来这里还能继续接 Supabase / Cloudbase 数据、真实回调、告警和权限层，而页面骨架已经有明显的数据平台感。" : "This shell is ready to extend with auth, payments, callbacks, and permissions while already looking like a data platform."}</p>
            </div>
          </div>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
          {(isCn
            ? [
                { title: "接口文档", note: "OpenAPI、SDK、示例代码与错误码统一收口" },
                { title: "监控视角", note: "趋势、告警、延迟、回调异常分层展示" },
                { title: "平台扩展", note: "后续继续接真实 auth、payment、callback 与权限系统" },
              ]
            : [
                { title: "Documentation layer", note: "OpenAPI, SDKs, examples, and errors are grouped clearly" },
                { title: "Monitoring view", note: "Trends, alerts, latency, and callback failures are separated" },
                { title: "Platform expansion", note: "Ready to extend with auth, billing, callbacks, and permissions" },
              ]).map((item) => (
            <div key={item.title} style={{ borderRadius: 22, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(148,163,184,0.1)", padding: 20 }}>
              <div style={{ fontWeight: 900 }}>{item.title}</div>
              <div style={{ marginTop: 10, color: "#94a3b8", lineHeight: 1.8 }}>{item.note}</div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
`
  }

  if (templateId === "launchpad") {
    return `// @ts-nocheck
import Link from "next/link";

export default function Page() {
  const isCn = ${isCn ? "true" : "false"};
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#fff8f1 0%,#fff 38%,#f8fafc 100%)", color: "#1f2937", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif" }}>
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "44px 24px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>mornstack</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: "#6b7280" }}>
            <Link href="/" style={{ textDecoration: "none", color: "#111827", fontWeight: 700 }}>${isCn ? "产品能力" : "Product"}</Link>
            <Link href="/download" style={{ textDecoration: "none", color: "#6b7280" }}>${isCn ? "下载" : "Download"}</Link>
            <Link href="/about" style={{ textDecoration: "none", color: "#6b7280" }}>${isCn ? "品牌" : "About"}</Link>
            <span>${isCn ? "价格" : "Pricing"}</span>
          </div>
        </div>
        <div style={{ marginTop: 60, display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "#ffedd5", color: "#c2410c", fontSize: 12, fontWeight: 800 }}>${isCn ? "官网与下载站" : "Website and downloads"}</div>
            <h1 style={{ margin: "18px 0 14px", fontSize: 54, lineHeight: 1.02, fontWeight: 900 }}>{isCn ? "面向老板演示与客户转化的 AI 产品官网" : "An AI product website built for demos and conversion"}</h1>
            <p style={{ margin: 0, color: "#6b7280", fontSize: 18, lineHeight: 1.8 }}>{isCn ? "这类需求不应该落成任务工作台，而应直接长成带官网叙事、下载入口、文档和价格对比的成品首页。" : "This archetype should land as a polished marketing site with narrative, downloads, docs, and pricing."}</p>
            <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/download/android" style={{ textDecoration: "none", borderRadius: 14, padding: "14px 18px", background: "#111827", color: "#fff", fontWeight: 800 }}>${isCn ? "下载 Android" : "Download Android"}</Link>
              <Link href="/api-docs" style={{ textDecoration: "none", borderRadius: 14, padding: "14px 18px", border: "1px solid rgba(17,24,39,0.12)", color: "#111827", fontWeight: 800 }}>${isCn ? "打开文档" : "Open docs"}</Link>
              <Link href="/download" style={{ textDecoration: "none", borderRadius: 14, padding: "14px 18px", border: "1px solid rgba(17,24,39,0.12)", color: "#111827", fontWeight: 800 }}>${isCn ? "下载中心" : "Download center"}</Link>
            </div>
          </div>
          <div style={{ borderRadius: 28, background: "linear-gradient(135deg,#111827,#1f2937)", padding: 24, color: "#f9fafb", minHeight: 420 }}>
            <div style={{ borderRadius: 20, background: "rgba(255,255,255,0.06)", padding: 20 }}>
              <div style={{ fontSize: 14, color: "#cbd5e1" }}>www.mornscience.app</div>
              <div style={{ marginTop: 12, fontSize: 28, fontWeight: 900 }}>{isCn ? "国内 / 国际统一主域名分入口" : "Unified domain with regional entry points"}</div>
              <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
                {["/cn","/intl","/download/android","/download/ios","/api-docs"].map((item) => (
                  <div key={item} style={{ borderRadius: 14, background: "rgba(255,255,255,0.06)", padding: "12px 14px" }}>{item}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <section style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
          {(isCn
            ? [
                { title: "老板演示", note: "首页、demo、宣传文件夹和下载入口都能直接打开" },
                { title: "客户转化", note: "官网、文档、下载、登录、支付链路逐步收口到正式入口" },
                { title: "双区域入口", note: "主域名下承接国内与国际入口，而不是分裂成两个站" },
              ]
            : [
                { title: "Stakeholder demos", note: "Homepage, demo, promo assets, and downloads are presentation-ready" },
                { title: "Conversion flow", note: "Website, docs, downloads, login, and billing converge into one product path" },
                { title: "Regional entry points", note: "The main domain supports CN and Intl entry points instead of split sites" },
              ]).map((item) => (
            <div key={item.title} style={{ borderRadius: 22, background: "#ffffff", border: "1px solid rgba(15,23,42,0.08)", padding: 20 }}>
              <div style={{ fontWeight: 900 }}>{item.title}</div>
              <div style={{ marginTop: 10, color: "#6b7280", lineHeight: 1.8 }}>{item.note}</div>
            </div>
          ))}
        </section>
      </section>
    </main>
  );
}
`
  }

  if (templateId === "orbital") {
    return `// @ts-nocheck
import Link from "next/link";

export default function Page() {
  const isCn = ${isCn ? "true" : "false"};
  const cards = ${JSON.stringify(
    isCn
      ? [
          { title: "社区反馈中心", note: "用户反馈、工单、版本公告和知识库" },
          { title: "活动运营区", note: "线上活动、投票、报名和积分互动" },
          { title: "创作者内容流", note: "帖子、教程、案例和模板分享" },
        ]
      : [
          { title: "Feedback hub", note: "Feedback, tickets, releases, and docs" },
          { title: "Events zone", note: "Online events, voting, and interactions" },
          { title: "Creator feed", note: "Posts, tutorials, cases, and template sharing" },
        ],
    null,
    2
  )} as const;
  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(circle at top, rgba(124,58,237,0.14), transparent 24%), linear-gradient(180deg,#0b1020 0%,#12131a 100%)", color: "#f8fafc", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1380, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, background: "rgba(16,18,28,0.86)", border: "1px solid rgba(124,58,237,0.16)", padding: 26 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: isCn ? "社区总览" : "Overview", active: true },
              { href: "/events", label: isCn ? "活动" : "Events" },
              { href: "/about", label: isCn ? "品牌介绍" : "About" },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "#7c3aed" : "rgba(124,58,237,0.14)", color: item.active ? "#ffffff" : "#d8b4fe", fontSize: 13, fontWeight: 700 }}>
                {item.label}
              </Link>
            ))}
          </div>
          <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(124,58,237,0.14)", color: "#c4b5fd", fontSize: 12, fontWeight: 800 }}>{isCn ? "社区与反馈中心" : "Community and feedback"}</div>
          <h1 style={{ margin: "16px 0 12px", fontSize: 44, fontWeight: 900 }}>{isCn ? "让内容、活动、反馈和公告长在同一社区中枢里" : "Bring content, events, feedback, and announcements into one community hub"}</h1>
          <p style={{ margin: 0, color: "#94a3b8", maxWidth: 860, lineHeight: 1.8 }}>{isCn ? "这类需求要做出社区产品的氛围感和品牌感，而不是普通后台管理器。" : "This archetype should feel like a branded community product, not a generic admin screen."}</p>
          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/events" style={{ textDecoration: "none", borderRadius: 999, padding: "10px 14px", background: "#7c3aed", color: "#ffffff", fontWeight: 700 }}>
              {isCn ? "查看活动中心" : "Open events"}
            </Link>
            <Link href="/about" style={{ textDecoration: "none", borderRadius: 999, padding: "10px 14px", border: "1px solid rgba(124,58,237,0.16)", color: "#c4b5fd", fontWeight: 700 }}>
              {isCn ? "社区介绍" : "Community brief"}
            </Link>
          </div>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
          {cards.map((card, index) => (
            <div key={card.title} style={{ borderRadius: 24, background: index === 0 ? "rgba(124,58,237,0.12)" : "rgba(17,24,39,0.78)", border: "1px solid rgba(255,255,255,0.08)", padding: 22, minHeight: 280 }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: index === 0 ? "#7c3aed" : index === 1 ? "#0ea5e9" : "#f59e0b", marginBottom: 20 }} />
              <div style={{ fontSize: 22, fontWeight: 900 }}>{card.title}</div>
              <div style={{ marginTop: 12, color: "#cbd5e1", lineHeight: 1.8 }}>{card.note}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
          <div style={{ borderRadius: 24, background: "rgba(17,24,39,0.78)", border: "1px solid rgba(255,255,255,0.08)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "社区节奏" : "Community rhythm"}</div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {(isCn
                ? ["版本公告 -> 用户反馈 -> 活动报名", "内容沉淀 -> 教程案例 -> 模板分享", "投票互动 -> 社区氛围 -> 产品改进"]
                : ["Announcements -> feedback -> event signups", "Editorial flow -> tutorials -> template sharing", "Voting -> engagement -> product improvements"]).map((item) => (
                <div key={item} style={{ borderRadius: 14, background: "#111827", padding: "12px 14px", color: "#cbd5e1" }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 24, background: "rgba(17,24,39,0.78)", border: "1px solid rgba(255,255,255,0.08)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "品牌氛围" : "Brand atmosphere"}</div>
            <p style={{ marginTop: 12, color: "#94a3b8", lineHeight: 1.8 }}>
              {isCn ? "社区类产品需要的是内容流、活动感、反馈回路和品牌归属感，而不是一套简单后台导航。" : "Community products need a branded content flow, event energy, and feedback loop rather than a plain admin navigation."}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
`
  }

  return null
}

function renderPage(spec: AppSpec) {
  if (getScaffoldArchetype(spec) === "code_platform") {
    return renderCodePlatformHome(spec)
  }
  const archetypeHome = renderArchetypeWorkspaceHome(spec)
  if (archetypeHome) {
    return archetypeHome
  }
  const premiumTemplateHome = renderPremiumTemplateHome(spec)
  if (premiumTemplateHome) {
    return premiumTemplateHome
  }
  const defaults = getRegionDefaults(spec.region)
  const statusConfig = getStatusConfig(spec)
  const copy = getCopy(spec)
  const hero = getTemplateHero(spec)
  const specPayload = {
    ...spec,
    templateId: spec.templateId ?? null,
    templateStyle: spec.templateStyle ?? null,
    labels: defaults.labels,
    statusConfig,
    copy,
    skin: getTemplateSkin(spec),
    hero,
  }

  return `// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "../components/generated/workspace-shell";
import { WorkspaceStatCard } from "../components/generated/workspace-stat-card";
import { TaskCard } from "../components/generated/task-card";
import { BoardColumn } from "../components/generated/board-column";
import { PageSection } from "../components/generated/page-section";
import { RecentItemCard } from "../components/generated/recent-item-card";
import { ProgressPanel } from "../components/generated/progress-panel";
import { ActivityFeed } from "../components/generated/activity-feed";
import { InsightTile } from "../components/generated/insight-tile";

type WorkItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: "low" | "medium" | "high";
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
};

const SPEC = ${JSON.stringify(specPayload, null, 2)} as const;
const LANDING_STYLE = ["spa-landing", "cosmic-app", "launch-ui"].includes(String(SPEC.templateStyle ?? ""));
const BUILDER_STYLE = SPEC.templateStyle === "purple-builder";
const PRO_STYLE = SPEC.planTier === "pro" || SPEC.planTier === "elite";
const ELITE_STYLE = SPEC.planTier === "elite";
const CODE_PLATFORM = SPEC.kind === "code_platform";

function toCsv(rows: WorkItem[]) {
  const head = "id,title,description,status,priority,assignee,createdAt,updatedAt";
  const body = rows
    .map((row) =>
      [
        row.id,
        row.title,
        row.description ?? "",
        row.status,
        row.priority,
        row.assignee ?? "",
        row.createdAt,
        row.updatedAt,
      ]
        .map((value) => \`"\${String(value).replace(/"/g, '""')}"\`)
        .join(",")
    )
    .join("\\n");
  return \`\${head}\\n\${body}\`;
}

export default function Page() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [query, setQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [view, setView] = useState<"board" | "list">("board");
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [selectedFile, setSelectedFile] = useState("app/page.tsx");
  const [editorTab, setEditorTab] = useState<"editor" | "preview" | "terminal">("editor");
  const [aiMode, setAiMode] = useState<"explain" | "fix" | "generate" | "refactor">("generate");

  async function load() {
    const res = await fetch("/api/items");
    const data = (await res.json()) as WorkItem[];
    setItems(Array.isArray(data) ? data : []);
  }

  async function addOrUpdate() {
    const safeTitle = title.trim();
    if (!safeTitle) return;
    setLoading(true);
    try {
      const payload = {
        title: safeTitle,
        description: description.trim(),
        assignee: assignee.trim(),
        priority,
      };
      if (editingId) {
        await fetch("/api/items", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            status: SPEC.statusConfig[0]?.key ?? "todo",
          }),
        });
      }
      setTitle("");
      setDescription("");
      setAssignee("");
      setPriority("medium");
      setEditingId("");
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch("/api/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  async function removeItem(id: string) {
    const target = items.find((item) => item.id === id);
    if (!target) return;
    await fetch("/api/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "archived", title: \`[archived] \${target.title}\` }),
    });
    await load();
  }

  function startEdit(item: WorkItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setAssignee(item.assignee ?? "");
    setPriority(item.priority);
  }

  function exportCsv() {
    const blob = new Blob([toCsv(visible)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "workspace-export.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (seeded) return;
    if (items.length > 0) {
      setSeeded(true);
      return;
    }

    const run = async () => {
      for (const item of SPEC.seedItems) {
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
  }, [items, seeded]);

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (item.status === "archived") return false;
      const haystack = [item.title, item.description ?? "", item.assignee ?? "", item.status].join(" ").toLowerCase();
      const queryOk = !query.trim() || haystack.includes(query.trim().toLowerCase());
      const assigneeOk =
        !SPEC.features.includes("assignee_filter") ||
        !assigneeFilter.trim() ||
        String(item.assignee ?? "").toLowerCase().includes(assigneeFilter.trim().toLowerCase());
      return queryOk && assigneeOk;
    });
  }, [assigneeFilter, items, query]);

  const summary = useMemo(() => {
    const owners = new Set(visible.map((item) => item.assignee).filter(Boolean));
    const done = visible.filter((item) => item.status === "done").length;
    const progress = visible.length ? Math.round((done / visible.length) * 100) : 0;
    return {
      total: visible.length,
      active: visible.filter((item) => item.status === "in_progress").length,
      blocked: visible.filter((item) => item.status === "blocked").length,
      owners: owners.size,
      done,
      progress,
    };
  }, [visible]);

  const recentItems = useMemo(() => {
    return [...visible]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 4);
  }, [visible]);

  const currencyFmt = new Intl.NumberFormat(SPEC.language, {
    style: "currency",
    currency: SPEC.currency,
    maximumFractionDigits: 0,
  });
  const dateFmt = new Intl.DateTimeFormat(SPEC.language, {
    dateStyle: "medium",
    timeZone: SPEC.timezone,
  });

  const priorityColor = {
    low: "#94a3b8",
    medium: "#6366f1",
    high: "#f97316",
  } as const;

  const overviewTiles = [
    {
      label: SPEC.region === "cn" ? "本周新增" : "Added this week",
      value: visible.filter((item) => Date.now() - new Date(item.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000).length,
      tone: "info" as const,
    },
    {
      label: SPEC.region === "cn" ? "高优先级" : "High priority",
      value: visible.filter((item) => item.priority === "high").length,
      tone: "warning" as const,
    },
    {
      label: SPEC.region === "cn" ? "已完成" : "Completed",
      value: summary.done,
      tone: "success" as const,
    },
  ];

  const deliveryTiles = [
    {
      label: SPEC.region === "cn" ? "结构完成度" : "Structure depth",
      value: ELITE_STYLE ? "High" : "Medium",
      tone: "accent" as const,
    },
    {
      label: SPEC.region === "cn" ? "可复用组件" : "Reusable components",
      value: ELITE_STYLE ? 12 : 8,
      tone: "info" as const,
    },
    {
      label: SPEC.region === "cn" ? "页面层级" : "Page layers",
      value: ELITE_STYLE ? 5 : 3,
      tone: "success" as const,
    },
  ];

  const activityRows = recentItems.map((item) => ({
    id: item.id,
    title: item.title,
    meta: item.assignee || (SPEC.region === "cn" ? "未分配" : "Unassigned"),
    time: dateFmt.format(new Date(item.updatedAt)),
  }));

  const crmPipelineRows =
    SPEC.region === "cn"
      ? [
          { label: "新线索", value: visible.filter((item) => item.status === "todo").length, detail: "等待首轮触达" },
          { label: "推进中", value: visible.filter((item) => item.status === "in_progress").length, detail: "方案、报价与演示" },
          { label: "已成交", value: visible.filter((item) => item.status === "done").length, detail: "进入交付与续费" },
        ]
      : [
          { label: "New leads", value: visible.filter((item) => item.status === "todo").length, detail: "Awaiting first touch" },
          { label: "In motion", value: visible.filter((item) => item.status === "in_progress").length, detail: "Demo, pricing, and solution work" },
          { label: "Closed", value: visible.filter((item) => item.status === "done").length, detail: "Moved into delivery and renewal" },
        ];

  const contentOpsRows =
    SPEC.region === "cn"
      ? [
          { label: "内容计划", value: Math.max(summary.total, 4), detail: "文章、专题、落地稿" },
          { label: "待发布", value: Math.max(summary.active, 2), detail: "待二审与排期" },
          { label: "品牌一致性", value: "High", detail: "语气、模块、CTA 统一" },
        ]
      : [
          { label: "Content plan", value: Math.max(summary.total, 4), detail: "Posts, launches, and editorial pages" },
          { label: "Queued", value: Math.max(summary.active, 2), detail: "Awaiting review and scheduling" },
          { label: "Brand consistency", value: "High", detail: "Voice, modules, and CTAs aligned" },
        ];

  const apiPlatformRows =
    SPEC.region === "cn"
      ? [
          { label: "接口调用量", value: "2.4M", detail: "近 7 天 API 请求" },
          { label: "错误告警", value: PRO_STYLE ? 6 : 3, detail: "待处理异常与波动" },
          { label: "文档模块", value: ELITE_STYLE ? 8 : 5, detail: "参考页、SDK、示例" },
        ]
      : [
          { label: "API requests", value: "2.4M", detail: "Requests in the last 7 days" },
          { label: "Alerts", value: PRO_STYLE ? 6 : 3, detail: "Open incidents and anomalies" },
          { label: "Docs modules", value: ELITE_STYLE ? 8 : 5, detail: "References, SDKs, and examples" },
        ];

  const communityRows =
    SPEC.region === "cn"
      ? [
          { label: "公告区", value: 3, detail: "版本更新 / 活动通知" },
          { label: "互动区", value: Math.max(summary.total, 6), detail: "帖子流、评论、反馈" },
          { label: "活动页", value: PRO_STYLE ? 4 : 2, detail: "线上活动与转化入口" },
        ]
      : [
          { label: "Announcements", value: 3, detail: "Release updates and event notices" },
          { label: "Engagement", value: Math.max(summary.total, 6), detail: "Feed, comments, and feedback" },
          { label: "Event pages", value: PRO_STYLE ? 4 : 2, detail: "Campaign and conversion entries" },
        ];

  const acceptancePromptExamples =
    SPEC.kind === "crm"
      ? (SPEC.region === "cn"
          ? ["销售后台首页", "线索池和负责人", "成交推进与支付升级"]
          : ["Sales admin home", "Lead pool and owners", "Deal progression and billing upgrade"])
      : /api|analytics|dashboard|monitoring|usage trend|error alert|接口|分析平台|仪表盘|监控|趋势/i.test(SPEC.prompt)
        ? (SPEC.region === "cn"
            ? ["总览仪表盘", "趋势与告警页", "文档与 SDK 中心"]
            : ["Overview dashboard", "Trends and alerts", "Docs and SDK center"])
      : SPEC.kind === "blog"
        ? (SPEC.region === "cn"
            ? ["官网内容首页", "文章专题页", "下载与文档转化位"]
            : ["Editorial homepage", "Article and campaign pages", "Download and docs conversion slots"])
        : SPEC.kind === "community"
          ? (SPEC.region === "cn"
              ? ["社区首页", "活动公告页", "反馈与互动区"]
              : ["Community homepage", "Events and announcements", "Feedback and engagement zone"])
          : [];

  const sidebarLabels = [
    SPEC.region === "cn" ? "总览" : "Overview",
    CODE_PLATFORM
      ? (SPEC.region === "cn" ? "工作区" : "Workspace")
      : LANDING_STYLE
        ? (SPEC.region === "cn" ? "页面区块" : "Sections")
        : SPEC.copy.itemPlural,
    SPEC.labels.analytics,
    SPEC.labels.about,
  ];

  const codeWorkspaceHighlights = [
    {
      label: SPEC.region === "cn" ? "打开文件" : "Open files",
      value: ELITE_STYLE ? 18 : PRO_STYLE ? 14 : 8,
      detail: SPEC.region === "cn" ? "代码与配置面" : "Code and config surfaces",
    },
    {
      label: SPEC.region === "cn" ? "AI 指令模式" : "AI modes",
      value: ELITE_STYLE ? 4 : PRO_STYLE ? 4 : 2,
      detail: SPEC.region === "cn" ? "解释 / 修复 / 生成 / 重构" : "Explain / Fix / Generate / Refactor",
    },
    {
      label: SPEC.region === "cn" ? "预览链路" : "Preview loops",
      value: ELITE_STYLE ? "Live + build" : PRO_STYLE ? "Live + QA" : "Live",
      detail: SPEC.region === "cn" ? "运行、构建和日志反馈" : "Run, build, and log feedback",
    },
  ];

  const tierWorkspaceDepth =
    ELITE_STYLE
      ? {
          quality: SPEC.region === "cn" ? "精英交付深度" : "Elite delivery depth",
          shell: SPEC.region === "cn" ? "完整 IDE 主壳 + 五类验收轨道" : "Full IDE shell + five acceptance tracks",
          execution: SPEC.region === "cn" ? "多页面结构 / 汇报 / 团队层" : "Multi-page structure / reporting / team layer",
        }
      : PRO_STYLE
        ? {
            quality: SPEC.region === "cn" ? "专业交付深度" : "Pro delivery depth",
            shell: SPEC.region === "cn" ? "稳定 IDE 主壳 + 关键业务轨道" : "Stable IDE shell + key business tracks",
            execution: SPEC.region === "cn" ? "分析页 / 运行面板 / 模板库" : "Analytics / runtime panel / template gallery",
          }
        : {
            quality: SPEC.region === "cn" ? "免费首版深度" : "Free first-pass depth",
            shell: SPEC.region === "cn" ? "先把 morncursor 核心工作区做出来" : "Focus on the morncursor core workspace first",
            execution: SPEC.region === "cn" ? "单主壳 / 基础终端 / 少量模板" : "Single shell / basic terminal / fewer templates",
          };

  const codeFiles = [
    "app/editor/page.tsx",
    "app/page.tsx",
    "app/dashboard/page.tsx",
    "app/settings/page.tsx",
    "components/generated/workspace-shell.tsx",
    "lib/ai-provider.ts",
    "spec.json",
    "README.md",
  ];

  const activityBarItems =
    SPEC.region === "cn"
      ? ["资源管理器", "搜索", "生成队列", "Git", "运行", "扩展"]
      : ["Explorer", "Search", "Generate", "Git", "Run", "Extensions"];

  const openEditors =
    SPEC.region === "cn"
      ? [
          { path: "app/editor/page.tsx", badge: "active" },
          { path: "app/page.tsx", badge: "preview" },
          { path: "app/settings/page.tsx", badge: "env" },
          { path: "lib/ai-provider.ts", badge: "ai" },
        ]
      : [
          { path: "app/editor/page.tsx", badge: "active" },
          { path: "app/page.tsx", badge: "preview" },
          { path: "app/settings/page.tsx", badge: "env" },
          { path: "lib/ai-provider.ts", badge: "ai" },
        ];

  const runtimeSignals =
    SPEC.region === "cn"
      ? [
          { label: "分支", value: "main" },
          { label: "诊断", value: ELITE_STYLE ? "2 warnings" : "1 warning" },
          { label: "预览", value: "mornstack.dev" },
          { label: "模型", value: "GPT / DashScope" },
        ]
      : [
          { label: "Branch", value: "main" },
          { label: "Diagnostics", value: ELITE_STYLE ? "2 warnings" : "1 warning" },
          { label: "Preview", value: "mornstack.dev" },
          { label: "Model", value: "GPT / DashScope" },
        ];

  const aiConversation =
    SPEC.region === "cn"
      ? [
          {
            role: "你",
            title: "把这个项目继续做成中国版 Cursor",
            body: "重点把文件树、编辑器、终端、运行预览和模板切换做得更像真正产品，不要像 demo。",
          },
          {
            role: "AI",
            title: "已生成产品级工作区方案",
            body: "我会优先补 IDE 主壳、底部终端和右侧 AI 面板，再继续拉开 free / pro / elite 的结果差异。",
          },
        ]
      : [
          {
            role: "You",
            title: "Push this into a China-ready Cursor-like product",
            body: "Prioritize the file tree, editor, terminal, preview loop, and templates so the result feels less like a demo.",
          },
          {
            role: "AI",
            title: "Product-grade workspace plan prepared",
            body: "I will strengthen the IDE shell, bottom terminal, and right AI panel first, then widen the free / pro / elite output gap.",
          },
        ];

  const acceptanceScaffolds =
    SPEC.region === "cn"
      ? [
          "Morncursor AI 代码编辑器",
          "销售线索与成交后台",
          "官网与下载转化站点",
          "API 数据与文档平台",
          "社区内容与反馈中心",
        ]
      : [
          "Morncursor AI code editor",
          "Sales pipeline and closing workspace",
          "Marketing site and download funnel",
          "API analytics and docs platform",
          "Community content and feedback hub",
        ];

  const tierAiModes = ELITE_STYLE
    ? (["explain", "fix", "generate", "refactor"] as const)
    : PRO_STYLE
      ? (["explain", "fix", "generate", "refactor"] as const)
      : (["generate", "fix"] as const);

  const tierAcceptanceTracks = ELITE_STYLE ? acceptanceScaffolds : PRO_STYLE ? acceptanceScaffolds.slice(0, 4) : acceptanceScaffolds.slice(0, 2);

  const tierExecutionRail =
    SPEC.region === "cn"
      ? ELITE_STYLE
        ? ["五类验收项目", "汇报中心", "团队协作层", "模板批量切换"]
        : PRO_STYLE
          ? ["Morncursor 主轨", "销售后台", "官网转化", "数据平台"]
          : ["Morncursor 主轨", "基础模板", "运行预览"]
      : ELITE_STYLE
        ? ["Five acceptance tracks", "Reporting hub", "Team layer", "Bulk template switching"]
        : PRO_STYLE
          ? ["Morncursor core", "Sales admin", "Marketing funnel", "Data platform"]
          : ["Morncursor core", "Starter templates", "Preview loop"];

  const codeSuggestions =
    SPEC.region === "cn"
      ? {
          explain: "解释当前文件职责，并指出还缺哪些编辑器级能力。",
          fix: "修复运行问题，让预览、登录和支付链路更稳定。",
          generate: "继续生成文件树、编辑器、终端、模板库等代码平台能力。",
          refactor: "把当前工作台重构成更像中国版 Cursor 的产品结构。",
        }
      : {
          explain: "Explain the current file responsibility and identify the missing editor-grade capabilities.",
          fix: "Fix runtime issues so preview, auth, and billing flows feel more stable.",
          generate: "Generate the next layer of file tree, editor, terminal, and template-gallery capabilities.",
          refactor: "Refactor the workspace into a more China-ready Cursor-like product structure.",
        };

  const editorTabs = [
    { key: "editor", label: SPEC.region === "cn" ? "编辑器" : "Editor" },
    { key: "preview", label: SPEC.region === "cn" ? "预览" : "Preview" },
    { key: "terminal", label: SPEC.region === "cn" ? "终端" : "Terminal" },
  ] as const;

  const aiModeLabels = {
    explain: SPEC.region === "cn" ? "解释" : "Explain",
    fix: SPEC.region === "cn" ? "修复" : "Fix",
    generate: SPEC.region === "cn" ? "生成" : "Generate",
    refactor: SPEC.region === "cn" ? "重构" : "Refactor",
  } as const;

  const codeSnippet = useMemo(() => {
    const snippets: Record<string, string> = {
      "app/editor/page.tsx": ${JSON.stringify(
        `export function EditorSurface() {
  return {
    shell: ["activity-bar", "explorer", "editor", "terminal", "ai-panel"],
    acceptance: ${spec.planTier === "elite" ? '"five project tracks"' : '"morncursor first"'},
  }
}`
      )},
      "app/page.tsx": ${JSON.stringify(
        `export default function Workspace() {
  return {
    product: "${spec.title}",
    mode: "${spec.region}",
    next: "${spec.planTier}",
  }
}`
      )},
      "app/dashboard/page.tsx": ${JSON.stringify(
        `export default function Dashboard() {
  return {
    routes: ["/editor", "/runs", "/templates", "/settings"],
    readiness: "acceptance-track",
  }
}`
      )},
      "app/settings/page.tsx": ${JSON.stringify(
        `export default function SettingsPage() {
  return {
    deployment: "cloudbase | vercel | docker",
    database: "cloudbase-doc | supabase-postgres | mysql",
    access: "private | team | public",
  }
}`
      )},
      "components/generated/workspace-shell.tsx": ${JSON.stringify(
        `export function WorkspaceShell() {
  return "Left tree + center editor + right AI + bottom runtime"
}`
      )},
      "lib/ai-provider.ts": ${JSON.stringify(
        `export async function requestCopilot(mode: string) {
  return { mode, target: "${spec.title}" }
}`
      )},
      "spec.json": JSON.stringify(
        {
          kind: SPEC.kind,
          title: SPEC.title,
          region: SPEC.region,
          planTier: SPEC.planTier,
          modules: SPEC.modules.slice(0, 4),
        },
        null,
        2
      ),
      "README.md": ${JSON.stringify(
        `# ${spec.title}

- Build a China-ready Cursor-style AI coding product
- Keep admin for operations and market for external sales flow
- Differentiate free / pro / elite output quality clearly`
      )},
    };
    return snippets[selectedFile] ?? snippets["app/page.tsx"];
  }, [selectedFile]);

  const terminalLines =
    SPEC.region === "cn"
      ? [
          "$ pnpm dev",
          "ready - local preview connected",
          "ai-mode: " + aiModeLabels[aiMode],
          "selected-file: " + selectedFile,
          "build-track: " + (ELITE_STYLE ? "acceptance-suite" : PRO_STYLE ? "product-suite" : "morncursor-core"),
          "hot-reload: waiting for file diff",
          "next-step: 继续补齐编辑器能力和多页面结构",
        ]
      : [
          "$ pnpm dev",
          "ready - local preview connected",
          "ai-mode: " + aiModeLabels[aiMode],
          "selected-file: " + selectedFile,
          "build-track: " + (ELITE_STYLE ? "acceptance-suite" : PRO_STYLE ? "product-suite" : "morncursor-core"),
          "hot-reload: waiting for file diff",
          "next-step: continue expanding editor capabilities and page depth",
        ];

  return (
    <WorkspaceShell
      style={SPEC.skin}
      sidebar={
        <>
          <div>
            <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: SPEC.skin.textSecondary }}>
              {SPEC.planTier}
            </div>
            <h1 style={{ margin: "10px 0 6px", fontSize: 26 }}>{SPEC.title}</h1>
            <p style={{ color: SPEC.skin.textSecondary, margin: 0, lineHeight: 1.6 }}>{SPEC.copy.header}</p>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {sidebarLabels.map((label, index) => (
              <div
                key={label}
                style={{
                  borderRadius: 14,
                  padding: "12px 14px",
                  background: index === 0 ? SPEC.skin.accentSoft : SPEC.skin.cardBackground,
                  color: index === 0 ? SPEC.skin.accentStrong : SPEC.skin.textPrimary,
                  border: index === 0 ? "none" : SPEC.skin.cardBorder,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {label}
              </div>
            ))}
          </div>

          <div style={{ marginTop: "auto", borderRadius: 20, padding: 18, background: SPEC.skin.accentSoft, border: SPEC.skin.cardBorder }}>
            <div style={{ fontSize: 12, color: SPEC.skin.accentStrong, fontWeight: 700 }}>{SPEC.labels.localeInfo}</div>
            <div style={{ marginTop: 8, lineHeight: 1.8, fontSize: 13, color: SPEC.skin.textSecondary }}>
              <div>{SPEC.region} / {SPEC.language}</div>
              <div>{SPEC.timezone}</div>
              <div>{SPEC.dateFormat} / {SPEC.currency}</div>
              <div>{SPEC.labels.monthlyTarget}: {currencyFmt.format(SPEC.kind === "crm" ? 420000 : 120000)}</div>
            </div>
          </div>
        </>
      }
      hero={
        <section
          style={{
            borderRadius: 28,
            padding: 28,
            background: SPEC.skin.heroBackground,
            border: SPEC.skin.cardBorder,
            boxShadow: "0 24px 80px rgba(15,23,42,0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 700 }}>
              <div style={{ display: "inline-flex", borderRadius: 999, padding: "6px 12px", background: SPEC.skin.accentSoft, color: SPEC.skin.accentStrong, fontSize: 12, fontWeight: 700 }}>
                {SPEC.hero.badge}
              </div>
              <h2 style={{ margin: "16px 0 10px", fontSize: 34, lineHeight: 1.1 }}>{SPEC.hero.title}</h2>
              <p style={{ margin: 0, color: SPEC.skin.textSecondary, lineHeight: 1.7 }}>{SPEC.hero.description}</p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
              {SPEC.features.includes("about_page") ? (
                <a href="/about" style={{ borderRadius: 999, padding: "10px 14px", border: SPEC.skin.cardBorder, color: SPEC.skin.textPrimary, textDecoration: "none" }}>
                  {SPEC.copy.openAbout}
                </a>
              ) : null}
              {SPEC.features.includes("analytics_page") ? (
                <a href="/analytics" style={{ borderRadius: 999, padding: "10px 14px", background: SPEC.skin.accentStrong, color: "#ffffff", textDecoration: "none" }}>
                  {SPEC.copy.openAnalytics}
                </a>
              ) : null}
            </div>
          </div>

          <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
            {[
              { label: LANDING_STYLE ? (SPEC.region === "cn" ? "页面区块" : "Sections") : SPEC.copy.total, value: LANDING_STYLE ? 6 : summary.total, detail: LANDING_STYLE ? (SPEC.region === "cn" ? "首版已铺开" : "First version covered") : SPEC.region === "cn" ? "全部事项" : "All items" },
              { label: LANDING_STYLE ? (SPEC.region === "cn" ? "CTA 数量" : "CTA count") : SPEC.copy.active, value: LANDING_STYLE ? 4 : summary.active, detail: LANDING_STYLE ? (SPEC.region === "cn" ? "转化触点" : "Conversion points") : SPEC.region === "cn" ? "处理中" : "In progress" },
              { label: LANDING_STYLE ? (SPEC.region === "cn" ? "信任模块" : "Trust modules") : SPEC.copy.owners, value: LANDING_STYLE ? 3 : summary.owners, detail: LANDING_STYLE ? (SPEC.region === "cn" ? "评价 / FAQ / 品牌" : "Testimonials / FAQ / logos") : SPEC.region === "cn" ? "协作成员" : "Owners" },
              { label: SPEC.region === "cn" ? "完成进度" : "Progress", value: \`\${summary.progress || 84}%\`, detail: SPEC.region === "cn" ? "本周推进率" : "Weekly completion" },
            ].map((card, index) => (
              <WorkspaceStatCard key={card.label} label={card.label} value={card.value} detail={card.detail} highlight={index === 3} style={SPEC.skin} />
            ))}
          </div>
        </section>
      }
      content={
        <>
          {CODE_PLATFORM ? (
            <>
              <PageSection title={SPEC.region === "cn" ? "AI 编程工作区" : "AI coding workspace"} subtitle={SPEC.region === "cn" ? "先把代码平台的骨架立住，再继续扩到完整的项目生成与交付。" : "Establish the coding-product skeleton first, then grow it into a fuller generation and delivery platform."} style={SPEC.skin}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 14 }}>
                  <div style={{ borderRadius: 26, border: SPEC.skin.cardBorder, background: SPEC.skin.panelBackground, padding: 12, display: "grid", gridTemplateColumns: "60px 240px minmax(0,1fr)", gap: 12, minHeight: 720 }}>
                    <div style={{ borderRadius: 20, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, padding: "14px 10px", display: "grid", alignContent: "start", gap: 10 }}>
                      {activityBarItems.map((item, index) => (
                        <div
                          key={item}
                          style={{
                            borderRadius: 16,
                            padding: "12px 6px",
                            background: index === 0 ? SPEC.skin.accentSoft : "transparent",
                            border: index === 0 ? SPEC.skin.cardBorder : "1px solid transparent",
                            color: index === 0 ? SPEC.skin.accentStrong : SPEC.skin.textSecondary,
                            fontSize: 11,
                            textAlign: "center",
                            lineHeight: 1.3,
                            fontWeight: 700,
                          }}
                        >
                          {item}
                        </div>
                      ))}
                    </div>

                    <div style={{ borderRadius: 20, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, padding: 14, display: "grid", alignContent: "start", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: SPEC.skin.textSecondary, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                          {SPEC.region === "cn" ? "资源管理器" : "Explorer"}
                        </div>
                        <div style={{ marginTop: 8, fontWeight: 700 }}>{SPEC.region === "cn" ? "morncursor-workspace" : "morncursor-workspace"}</div>
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {codeFiles.map((item) => (
                          <button
                            key={item}
                            onClick={() => setSelectedFile(item)}
                            style={{
                              borderRadius: 14,
                              padding: "10px 12px",
                              background: selectedFile === item ? SPEC.skin.accentSoft : SPEC.skin.cardBackground,
                              border: SPEC.skin.cardBorder,
                              fontSize: 13,
                              textAlign: "left",
                              color: selectedFile === item ? SPEC.skin.accentStrong : SPEC.skin.textPrimary,
                            }}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                      <div style={{ borderRadius: 16, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground, padding: 12 }}>
                        <div style={{ fontSize: 11, color: SPEC.skin.textSecondary }}>{SPEC.region === "cn" ? "打开的工作区" : "Open workspace"}</div>
                        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                          {openEditors.map((item) => (
                            <div key={item.path} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                              <span style={{ color: SPEC.skin.textPrimary }}>{item.path}</span>
                              <span style={{ color: SPEC.skin.textSecondary }}>{item.badge}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={{ borderRadius: 20, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground, overflow: "hidden", display: "grid", gridTemplateRows: "auto auto minmax(0,1fr) auto auto" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", borderBottom: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {openEditors.map((item) => (
                            <button
                              key={item.path}
                              onClick={() => setSelectedFile(item.path)}
                              style={{
                                borderRadius: 999,
                                padding: "8px 12px",
                                background: selectedFile === item.path ? SPEC.skin.accentStrong : SPEC.skin.cardBackground,
                                color: selectedFile === item.path ? "#ffffff" : SPEC.skin.textPrimary,
                                border: selectedFile === item.path ? "none" : SPEC.skin.cardBorder,
                                fontSize: 12,
                              }}
                            >
                              {item.path.split("/").slice(-2).join("/")}
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: 12, color: SPEC.skin.textSecondary }}>{selectedFile}</div>
                      </div>

                      <div style={{ padding: "12px 16px", borderBottom: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {editorTabs.map((tab) => (
                            <button
                              key={tab.key}
                              onClick={() => setEditorTab(tab.key)}
                              style={{
                                borderRadius: 999,
                                padding: "8px 12px",
                                background: editorTab === tab.key ? SPEC.skin.accentStrong : SPEC.skin.cardBackground,
                                color: editorTab === tab.key ? "#ffffff" : SPEC.skin.textPrimary,
                                border: editorTab === tab.key ? "none" : SPEC.skin.cardBorder,
                                fontSize: 12,
                              }}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ padding: 16, overflow: "auto" }}>
                        {editorTab === "editor" ? (
                          <div style={{ borderRadius: 18, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, padding: 16, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", minHeight: 280 }}>
                            {codeSnippet}
                          </div>
                        ) : null}
                        {editorTab === "preview" ? (
                          <div style={{ borderRadius: 18, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, padding: 18, minHeight: 280 }}>
                            <div style={{ fontSize: 12, color: SPEC.skin.textSecondary }}>{SPEC.region === "cn" ? "当前预览" : "Current preview"}</div>
                            <div style={{ marginTop: 14, borderRadius: 18, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground, padding: 18 }}>
                              <div style={{ fontWeight: 700 }}>{SPEC.title}</div>
                              <div style={{ marginTop: 8, color: SPEC.skin.textSecondary, lineHeight: 1.7 }}>{SPEC.hero.description}</div>
                              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
                                {codeWorkspaceHighlights.map((card) => (
                                  <InsightTile key={card.label} title={card.label} value={card.value} tone="default" style={SPEC.skin} />
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        {editorTab === "terminal" ? (
                          <div style={{ borderRadius: 18, border: SPEC.skin.cardBorder, background: "#0b1120", padding: 16, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, lineHeight: 1.9, color: "#cbd5e1", minHeight: 280 }}>
                            {terminalLines.join("\\n")}
                          </div>
                        ) : null}
                      </div>

                      <div style={{ padding: "0 16px 16px", display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10 }}>
                        {runtimeSignals.map((item, index) => (
                          <InsightTile key={item.label} title={item.label} value={item.value} tone={index === 0 ? "accent" : "default"} style={SPEC.skin} />
                        ))}
                      </div>

                      <div style={{ borderTop: SPEC.skin.cardBorder, background: "#050b18", padding: 14 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr", gap: 12 }}>
                          <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.16)", background: "rgba(15,23,42,0.78)", padding: 14 }}>
                            <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                              {SPEC.region === "cn" ? "终端" : "Terminal"}
                            </div>
                            <div style={{ marginTop: 10, whiteSpace: "pre-wrap", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, lineHeight: 1.8, color: "#e2e8f0" }}>
                              {terminalLines.join("\\n")}
                            </div>
                          </div>
                          <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.16)", background: "rgba(15,23,42,0.78)", padding: 14 }}>
                            <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                              {SPEC.region === "cn" ? "验收模板轨道" : "Acceptance tracks"}
                            </div>
                            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                              {tierAcceptanceTracks.slice(0, 3).map((item) => (
                                <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: "rgba(30,41,59,0.82)", color: "#cbd5e1", fontSize: 12 }}>
                                  {item}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderRadius: 24, border: SPEC.skin.cardBorder, background: SPEC.skin.panelBackground, padding: 16, display: "grid", gap: 14, alignContent: "start" }}>
                    <div>
                      <div style={{ fontSize: 12, color: SPEC.skin.textSecondary }}>{SPEC.region === "cn" ? "AI 助手" : "AI copilot"}</div>
                      <div style={{ marginTop: 8, fontWeight: 700 }}>{SPEC.region === "cn" ? "解释、修复、重构与生成" : "Explain, fix, refactor, and generate"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {tierAiModes.map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setAiMode(mode)}
                          style={{
                            borderRadius: 999,
                            padding: "8px 12px",
                            background: aiMode === mode ? SPEC.skin.accentStrong : SPEC.skin.cardBackground,
                            color: aiMode === mode ? "#ffffff" : SPEC.skin.textPrimary,
                            border: aiMode === mode ? "none" : SPEC.skin.cardBorder,
                            fontSize: 12,
                          }}
                        >
                          {aiModeLabels[mode]}
                        </button>
                      ))}
                    </div>
                    <div style={{ borderRadius: 16, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, padding: 12, fontSize: 13, color: SPEC.skin.textSecondary, lineHeight: 1.7 }}>
                      {codeSuggestions[aiMode]}
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      {aiConversation.map((item) => (
                        <div key={item.title} style={{ borderRadius: 16, border: SPEC.skin.cardBorder, background: item.role === (SPEC.region === "cn" ? "AI" : "AI") ? SPEC.skin.accentSoft : SPEC.skin.cardBackground, padding: 12 }}>
                          <div style={{ fontSize: 11, color: SPEC.skin.textSecondary }}>{item.role}</div>
                          <div style={{ marginTop: 6, fontWeight: 700, color: SPEC.skin.textPrimary }}>{item.title}</div>
                          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: SPEC.skin.textSecondary }}>{item.body}</div>
                        </div>
                      ))}
                    </div>
                    {[
                      SPEC.region === "cn" ? "当前文件：" + selectedFile : "Current file: " + selectedFile,
                      SPEC.region === "cn" ? "目标：生成更完整的中国版 Cursor 产品结构" : "Goal: generate a fuller China-ready Cursor-like product structure",
                      SPEC.region === "cn" ? "联动：admin 宣传资产 + market 销售闭环" : "Linked flow: admin promo assets + market sales surface",
                    ].map((item) => (
                      <div key={item} style={{ borderRadius: 16, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, padding: 12, fontSize: 13, color: SPEC.skin.textSecondary }}>
                        {item}
                      </div>
                    ))}
                    <div style={{ borderRadius: 16, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground, padding: 14 }}>
                      <div style={{ fontSize: 12, color: SPEC.skin.textSecondary }}>{tierWorkspaceDepth.quality}</div>
                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        {[tierWorkspaceDepth.shell, tierWorkspaceDepth.execution].map((item) => (
                          <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: SPEC.skin.inputBackground, color: SPEC.skin.textPrimary, fontSize: 12 }}>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ borderRadius: 16, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground, padding: 14 }}>
                      <div style={{ fontSize: 12, color: SPEC.skin.textSecondary }}>{SPEC.region === "cn" ? "当前执行轨道" : "Current execution rail"}</div>
                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        {tierExecutionRail.map((item) => (
                          <div key={item} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
                            <span style={{ color: SPEC.skin.textPrimary }}>{item}</span>
                            <span style={{ color: SPEC.skin.textSecondary }}>{SPEC.planTier}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ borderRadius: 16, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground, padding: 14 }}>
                      <div style={{ fontSize: 12, color: SPEC.skin.textSecondary }}>{SPEC.region === "cn" ? "本轮优先样板" : "Priority acceptance templates"}</div>
                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        {tierAcceptanceTracks.map((item, index) => (
                          <div key={item} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
                            <span style={{ color: SPEC.skin.textPrimary }}>{item}</span>
                            <span style={{ color: index === 0 ? SPEC.skin.accentStrong : SPEC.skin.textSecondary }}>
                              {index === 0 ? (SPEC.region === "cn" ? "核心验收" : "Core acceptance") : SPEC.region === "cn" ? "候选" : "Candidate"}
                            </span>
                          </div>
                        ))}
                        {!ELITE_STYLE ? (
                          <div style={{ borderRadius: 12, padding: "10px 12px", background: SPEC.skin.inputBackground, color: SPEC.skin.textSecondary, fontSize: 12, lineHeight: 1.7 }}>
                            {PRO_STYLE
                              ? SPEC.region === "cn"
                                ? "精英版会继续补齐第五类验收项目和更深的团队/汇报层。"
                                : "Elite will unlock the fifth acceptance track plus deeper team and reporting layers."
                              : SPEC.region === "cn"
                                ? "升级后会继续开放更多验收模板、更多 AI 模式和更完整的运行链路。"
                                : "Upgrading unlocks more acceptance templates, more AI modes, and a fuller runtime chain."}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ borderRadius: 16, background: SPEC.skin.accentStrong, color: "#ffffff", padding: 14, fontSize: 13, lineHeight: 1.7 }}>
                      {SPEC.region === "cn" ? "下一步建议：先稳定 morncursor 主壳，再逐步把 5 类验收项目模板都做成可一键生成的路线。" : "Suggested next move: stabilize the morncursor shell first, then turn all five acceptance templates into direct one-click generation paths."}
                    </div>
                  </div>
                </div>
              </PageSection>

              <PageSection title={SPEC.region === "cn" ? "实现队列" : "Implementation queue"} subtitle={SPEC.region === "cn" ? "这里用来承接代码平台继续往可验收成品推进的任务。" : "This queue tracks the work required to move the coding product toward acceptance-ready quality."} style={SPEC.skin}>
                <div style={{ display: "grid", gap: 12 }}>
                  {visible.map((item) => (
                    <article key={item.id} style={{ borderRadius: 20, border: SPEC.skin.cardBorder, padding: 16, background: SPEC.skin.cardBackground, display: "grid", gridTemplateColumns: "1.5fr 0.7fr 0.8fr auto", gap: 14, alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{item.title}</div>
                        <div style={{ marginTop: 6, color: SPEC.skin.textSecondary, fontSize: 13, lineHeight: 1.6 }}>{item.description || "-"}</div>
                      </div>
                      <div style={{ color: SPEC.skin.textSecondary, fontSize: 13 }}>{item.assignee || "-"}</div>
                      <div style={{ color: priorityColor[item.priority], fontSize: 13, fontWeight: 700 }}>{item.priority}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {SPEC.statusConfig.filter((status) => status.key !== item.status).slice(0, 2).map((status) => (
                          <button key={status.key} onClick={() => setStatus(item.id, status.key)} style={{ borderRadius: 999, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, color: SPEC.skin.textPrimary, padding: "8px 10px", fontSize: 12 }}>
                            {status.label}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </PageSection>
            </>
          ) : LANDING_STYLE ? (
            <>
              <PageSection title={SPEC.region === "cn" ? "页面亮点" : "Page highlights"} subtitle={SPEC.region === "cn" ? "这一版会优先把品牌感和转化结构铺出来。" : "This version prioritizes brand feel and conversion structure."} style={SPEC.skin}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
                  {(SPEC.region === "cn"
                    ? ["沉浸式英雄区", "清晰价值主张", "价格与转化路径", "真实落地页结构"]
                    : ["Immersive hero surface", "Clear value proposition", "Pricing and conversion path", "Real landing-page structure"]).map((item, index) => (
                    <InsightTile key={item} title={item} value={index + 1} tone={index % 2 === 0 ? "accent" : "default"} style={SPEC.skin} />
                  ))}
                </div>
              </PageSection>

              <PageSection title={SPEC.region === "cn" ? "页面结构" : "Page structure"} subtitle={SPEC.region === "cn" ? "模板会真实生成这些首屏区块。" : "These are the concrete blocks generated from the template."} style={SPEC.skin}>
                <div style={{ display: "grid", gap: 12 }}>
                  {(SPEC.region === "cn"
                    ? ["英雄区与主 CTA", "核心功能亮点", "客户评价与品牌背书", "价格区与 FAQ", "联系入口与二次 CTA", "关于与团队说明"]
                    : ["Hero and primary CTA", "Core feature highlights", "Testimonials and brand proof", "Pricing and FAQ", "Contact entry and secondary CTA", "About and team story"]).map((item, index) => (
                    <div key={item} style={{ borderRadius: 18, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground, padding: 16, display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, color: SPEC.skin.textSecondary }}>0{index + 1}</div>
                        <strong style={{ display: "block", marginTop: 6 }}>{item}</strong>
                      </div>
                      <div style={{ alignSelf: "center", color: SPEC.skin.accentStrong, fontWeight: 700 }}>
                        {SPEC.region === "cn" ? "已生成" : "Included"}
                      </div>
                    </div>
                  ))}
                </div>
              </PageSection>
            </>
          ) : BUILDER_STYLE ? (
            <>
              <PageSection title={SPEC.region === "cn" ? "生成流程" : "Generation flow"} subtitle={SPEC.region === "cn" ? "让首页本身就像一个 AI 建站产品。" : "The homepage itself should feel like an AI product builder."} style={SPEC.skin}>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.9fr", gap: 14 }}>
                  <div style={{ borderRadius: 22, padding: 18, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground }}>
                    <div style={{ fontSize: 12, color: SPEC.skin.textSecondary }}>{SPEC.region === "cn" ? "Prompt" : "Prompt"}</div>
                    <div style={{ marginTop: 10, borderRadius: 18, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, padding: 16, lineHeight: 1.8 }}>
                      {SPEC.prompt}
                    </div>
                    <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
                      {[
                        SPEC.region === "cn" ? "页面结构" : "Pages",
                        SPEC.region === "cn" ? "组件模块" : "Components",
                        SPEC.region === "cn" ? "数据能力" : "Data",
                      ].map((label, index) => (
                        <InsightTile key={label} title={label} value={index === 0 ? 4 : index === 1 ? 9 : 3} tone={index === 0 ? "accent" : "default"} style={SPEC.skin} />
                      ))}
                    </div>
                  </div>
                  <ActivityFeed title={SPEC.region === "cn" ? "AI 结果理解" : "AI understanding"} rows={activityRows} style={SPEC.skin} />
                </div>
              </PageSection>

              <PageSection title={SPEC.region === "cn" ? "模板与结果预览" : "Templates and result preview"} subtitle={SPEC.region === "cn" ? "在工作区里直接露出模板与输出产物。" : "Expose templates and outputs directly in the workspace."} style={SPEC.skin}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                  {SPEC.modules.slice(0, 4).map((module) => (
                    <div key={module} style={{ borderRadius: 20, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground, padding: 18 }}>
                      <div style={{ fontSize: 12, color: SPEC.skin.textSecondary }}>{SPEC.region === "cn" ? "模块" : "Module"}</div>
                      <div style={{ marginTop: 8, fontWeight: 700 }}>{module}</div>
                      <div style={{ marginTop: 12, height: 96, borderRadius: 16, background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))", border: SPEC.skin.cardBorder }} />
                    </div>
                  ))}
                </div>
              </PageSection>
            </>
          ) : (
            <>
              {SPEC.kind === "crm" ? (
                <PageSection title={SPEC.region === "cn" ? "销售推进骨架" : "Sales pipeline skeleton"} subtitle={SPEC.region === "cn" ? "这类项目会优先长成真正的销售后台，而不是普通任务板。" : "This project type should feel like a true sales workspace, not a generic task board."} style={SPEC.skin}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                    {crmPipelineRows.map((item, index) => (
                      <InsightTile key={item.label} title={item.label} value={item.value} tone={index === 1 ? "accent" : "default"} style={SPEC.skin} />
                    ))}
                  </div>
                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14 }}>
                    <div style={{ borderRadius: 20, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground, padding: 16 }}>
                      <div style={{ fontSize: 12, color: SPEC.skin.textSecondary }}>{SPEC.region === "cn" ? "成交链路" : "Closing flow"}</div>
                      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                        {(SPEC.region === "cn"
                          ? ["线索池 -> 首轮沟通", "方案与演示 -> 报价确认", "支付升级 -> 成交归档"]
                          : ["Lead pool -> first touch", "Solution and demo -> pricing alignment", "Billing upgrade -> closed account"]).map((item) => (
                          <div key={item} style={{ borderRadius: 14, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, padding: 12, fontSize: 13 }}>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ borderRadius: 20, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground, padding: 16 }}>
                      <div style={{ fontSize: 12, color: SPEC.skin.textSecondary }}>{SPEC.region === "cn" ? "验收页面" : "Acceptance pages"}</div>
                      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                        {acceptancePromptExamples.map((item) => (
                          <RecentItemCard key={item} title={item} meta={SPEC.planTier} time="crm" style={SPEC.skin} />
                        ))}
                      </div>
                    </div>
                  </div>
                </PageSection>
              ) : null}

              {SPEC.kind === "blog" ? (
                <PageSection title={SPEC.region === "cn" ? "内容与转化骨架" : "Content and conversion skeleton"} subtitle={SPEC.region === "cn" ? "这类项目会优先朝官网、内容页、下载和文档联动去长。" : "This project type grows toward marketing pages, content flows, downloads, and docs."} style={SPEC.skin}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                    {(/api|analytics|dashboard|monitoring|usage trend|error alert|接口|分析平台|仪表盘|监控|趋势/i.test(SPEC.prompt) ? apiPlatformRows : contentOpsRows).map((item, index) => (
                      <InsightTile key={item.label} title={item.label} value={item.value} tone={index === 2 ? "accent" : "default"} style={SPEC.skin} />
                    ))}
                  </div>
                  <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                    {(/api|analytics|dashboard|monitoring|usage trend|error alert|接口|分析平台|仪表盘|监控|趋势/i.test(SPEC.prompt)
                      ? (SPEC.region === "cn"
                          ? ["总览仪表盘", "趋势与告警页", "文档页 / SDK 页 / API 示例"]
                          : ["Overview dashboard", "Trends and alerts", "Docs / SDK / API examples"])
                      : (SPEC.region === "cn"
                          ? ["首页价值主张", "专题内容页", "下载页 / 文档页 / 注册 CTA"]
                          : ["Homepage value proposition", "Editorial and campaign page", "Downloads / docs / sign-up CTA"])).map((item) => (
                      <div key={item} style={{ borderRadius: 16, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground, padding: 14, fontSize: 13 }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </PageSection>
              ) : null}

              {SPEC.kind === "community" ? (
                <PageSection title={SPEC.region === "cn" ? "社区互动骨架" : "Community engagement skeleton"} subtitle={SPEC.region === "cn" ? "这类项目会更偏社区首页、活动区、反馈区和公告中心。" : "This project type should feel closer to a community homepage, events area, feedback zone, and announcement hub."} style={SPEC.skin}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                    {communityRows.map((item, index) => (
                      <InsightTile key={item.label} title={item.label} value={item.value} tone={index === 0 ? "accent" : "default"} style={SPEC.skin} />
                    ))}
                  </div>
                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                    {acceptancePromptExamples.map((item) => (
                      <div key={item} style={{ borderRadius: 16, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground, padding: 14 }}>
                        <div style={{ fontSize: 12, color: SPEC.skin.textSecondary }}>{SPEC.region === "cn" ? "生成方向" : "Generation direction"}</div>
                        <div style={{ marginTop: 8, fontWeight: 700 }}>{item}</div>
                      </div>
                    ))}
                  </div>
                </PageSection>
              ) : null}

              {PRO_STYLE ? (
                <PageSection title={SPEC.region === "cn" ? "交付驾驶舱" : "Delivery cockpit"} subtitle={SPEC.region === "cn" ? "更高套餐会生成更完整的产物结构与展示层次。" : "Higher tiers generate a fuller delivery structure and presentation layer."} style={SPEC.skin}>
                  <div style={{ display: "grid", gridTemplateColumns: ELITE_STYLE ? "1.15fr 0.85fr" : "1fr", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                      {deliveryTiles.map((card) => (
                        <InsightTile key={card.label} title={card.label} value={card.value} tone={card.tone} style={SPEC.skin} />
                      ))}
                    </div>
                    {ELITE_STYLE ? (
                      <div style={{ borderRadius: 22, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground, padding: 18 }}>
                        <div style={{ fontSize: 12, color: SPEC.skin.textSecondary }}>{SPEC.region === "cn" ? "团队推进节奏" : "Team operating rhythm"}</div>
                        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                          {(SPEC.region === "cn"
                            ? ["任务录入 -> 看板推进", "列表治理 -> 细节编辑", "分析页 -> 总览汇报"]
                            : ["Capture -> board execution", "List governance -> item editing", "Analytics -> executive review"]).map((item) => (
                            <div key={item} style={{ borderRadius: 16, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, padding: 12, fontSize: 13 }}>
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </PageSection>
              ) : null}

              <PageSection title={SPEC.copy.quickSummary} subtitle={SPEC.copy.recentTrend} style={SPEC.skin}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, flex: 1 }}>
                    {overviewTiles.map((card) => (
                      <InsightTile key={card.label} title={card.label} value={card.value} tone={card.tone} style={SPEC.skin} />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => setView("board")} style={{ borderRadius: 999, border: view === "board" ? "none" : SPEC.skin.cardBorder, background: view === "board" ? SPEC.skin.accentStrong : SPEC.skin.cardBackground, color: view === "board" ? "#ffffff" : SPEC.skin.textPrimary, padding: "9px 14px" }}>
                      {SPEC.region === "cn" ? "看板视图" : "Board"}
                    </button>
                    <button onClick={() => setView("list")} style={{ borderRadius: 999, border: view === "list" ? "none" : SPEC.skin.cardBorder, background: view === "list" ? SPEC.skin.accentStrong : SPEC.skin.cardBackground, color: view === "list" ? "#ffffff" : SPEC.skin.textPrimary, padding: "9px 14px" }}>
                      {SPEC.region === "cn" ? "列表视图" : "List"}
                    </button>
                    {SPEC.features.includes("csv_export") ? (
                      <button onClick={exportCsv} style={{ borderRadius: 999, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground, color: SPEC.skin.textPrimary, padding: "9px 14px" }}>
                        {SPEC.labels.exportCsv}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={SPEC.labels.search} style={{ flex: 1, minWidth: 260, padding: 12, borderRadius: 14, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, color: SPEC.skin.textPrimary }} />
                  {SPEC.features.includes("assignee_filter") ? (
                    <input value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} placeholder={SPEC.labels.filter} style={{ width: 200, padding: 12, borderRadius: 14, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, color: SPEC.skin.textPrimary }} />
                  ) : null}
                </div>

                {visible.length === 0 ? (
                  <p style={{ color: SPEC.skin.textSecondary, marginTop: 20 }}>{SPEC.copy.empty}</p>
                ) : view === "board" ? (
                  <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: \`repeat(\${SPEC.statusConfig.length}, minmax(0, 1fr))\`, gap: 14, alignItems: "start" }}>
                    {SPEC.statusConfig.map((group) => (
                      <BoardColumn key={group.key} title={group.label} count={visible.filter((item) => item.status === group.key).length} style={SPEC.skin}>
                        {visible
                          .filter((item) => item.status === group.key)
                          .map((item) => (
                            <TaskCard
                              key={item.id}
                              item={item}
                              descriptionEnabled={SPEC.features.includes("description_field")}
                              assigneeLabel={SPEC.labels.assignee}
                              dateLabel={dateFmt.format(new Date(item.updatedAt))}
                              priorityColor={priorityColor}
                              style={SPEC.skin}
                              onEdit={() => startEdit(item)}
                              onDelete={() => removeItem(item.id)}
                              onMove={(status) => setStatus(item.id, status)}
                              statusActions={SPEC.statusConfig.filter((status) => status.key !== group.key).slice(0, 2)}
                              editLabel={SPEC.region === "cn" ? "编辑" : "Edit"}
                              deleteLabel={SPEC.region === "cn" ? "删除" : "Delete"}
                            />
                          ))}
                      </BoardColumn>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
                    {visible.map((item) => (
                      <article key={item.id} style={{ borderRadius: 20, border: SPEC.skin.cardBorder, padding: 16, background: SPEC.skin.cardBackground, display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.8fr 1fr auto", gap: 14, alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{item.title}</div>
                          <div style={{ fontSize: 13, color: SPEC.skin.textSecondary, marginTop: 4 }}>{item.description || "-"}</div>
                        </div>
                        <div style={{ color: SPEC.skin.textSecondary, fontSize: 13 }}>{item.assignee || "-"}</div>
                        <div style={{ color: priorityColor[item.priority], fontSize: 13, fontWeight: 700 }}>{item.priority}</div>
                        <div style={{ color: SPEC.skin.textSecondary, fontSize: 13 }}>{dateFmt.format(new Date(item.updatedAt))}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => startEdit(item)} style={{ borderRadius: 999, border: SPEC.skin.cardBorder, background: SPEC.skin.cardBackground, color: SPEC.skin.textPrimary, padding: "8px 10px", fontSize: 12 }}>
                            {SPEC.region === "cn" ? "编辑" : "Edit"}
                          </button>
                          <button onClick={() => removeItem(item.id)} style={{ borderRadius: 999, border: "1px solid #fecaca", background: "#fff1f2", color: "#be123c", padding: "8px 10px", fontSize: 12 }}>
                            {SPEC.region === "cn" ? "删除" : "Delete"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </PageSection>
            </>
          )}
        </>
      }
      rightRail={
        <>
          {CODE_PLATFORM ? (
            <>
              <PageSection title={SPEC.region === "cn" ? "代码平台指标" : "Coding platform metrics"} subtitle={SPEC.region === "cn" ? "这些指标用来表达代码平台是否已经接近验收目标。" : "These metrics communicate how close the coding platform is to acceptance-ready quality."} style={SPEC.skin}>
                <div style={{ display: "grid", gap: 10 }}>
                  {codeWorkspaceHighlights.map((card) => (
                    <RecentItemCard key={card.label} title={card.label} meta={card.detail} time={String(card.value)} style={SPEC.skin} />
                  ))}
                </div>
              </PageSection>
              <PageSection title={SPEC.region === "cn" ? "本轮生成目标" : "Current generation goals"} subtitle={SPEC.region === "cn" ? "围绕 morncursor 和代码平台场景持续拉齐。" : "Keep aligning the product around morncursor and code-platform scenarios."} style={SPEC.skin}>
                <div style={{ display: "grid", gap: 10 }}>
                  {(SPEC.region === "cn"
                    ? ["生成中国版 Cursor 骨架", "稳定预览和运行链路", "拉开免费 / 专业 / 精英差异"]
                    : ["Generate a China-ready Cursor shell", "Stabilize preview and runtime flow", "Increase free / pro / elite differentiation"]).map((item, index) => (
                    <div key={item} style={{ borderRadius: 16, border: SPEC.skin.cardBorder, background: index === 0 ? SPEC.skin.accentSoft : SPEC.skin.inputBackground, padding: 12, fontSize: 13 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </PageSection>
              <ProgressPanel title={SPEC.region === "cn" ? "代码平台成熟度" : "Coding platform maturity"} description={SPEC.region === "cn" ? \`当前已完成 \${summary.done} 个开发任务，整体成熟度估算 \${Math.max(summary.progress, 72)}%\` : \`\${summary.done} engineering tasks completed, estimated maturity \${Math.max(summary.progress, 72)}%\`} progress={Math.max(summary.progress, 72)} style={SPEC.skin} />
            </>
          ) : LANDING_STYLE ? (
            <>
              <ActivityFeed title={SPEC.region === "cn" ? "首版输出摘要" : "Output summary"} rows={activityRows} style={SPEC.skin} />
              <ProgressPanel title={SPEC.region === "cn" ? "页面完成度" : "Build completeness"} description={SPEC.region === "cn" ? "首版页面、模块和转化节点已经铺开，可继续迭代细化。" : "The first pass covers the core pages, modules, and conversion points and is ready for further iteration."} progress={88} style={SPEC.skin} />
            </>
          ) : (
            <>
              {SPEC.kind === "crm" ? (
                <PageSection title={SPEC.region === "cn" ? "销售视角" : "Sales lens"} subtitle={SPEC.region === "cn" ? "这里强调成交阶段、负责人和升级节点。" : "This emphasizes deal stages, owners, and upgrade checkpoints."} style={SPEC.skin}>
                  <div style={{ display: "grid", gap: 10 }}>
                    {crmPipelineRows.map((item) => (
                      <RecentItemCard key={item.label} title={item.label} meta={item.detail} time={String(item.value)} style={SPEC.skin} />
                    ))}
                  </div>
                </PageSection>
              ) : null}

              {SPEC.kind === "blog" ? (
                <PageSection title={SPEC.region === "cn" ? "内容视角" : "Content lens"} subtitle={SPEC.region === "cn" ? "这里强调内容排期、下载转化和文档联动。" : "This highlights editorial cadence, download conversion, and docs linkage."} style={SPEC.skin}>
                  <div style={{ display: "grid", gap: 10 }}>
                    {(/api|analytics|dashboard|monitoring|usage trend|error alert|接口|分析平台|仪表盘|监控|趋势/i.test(SPEC.prompt) ? apiPlatformRows : contentOpsRows).map((item) => (
                      <RecentItemCard key={item.label} title={item.label} meta={item.detail} time={String(item.value)} style={SPEC.skin} />
                    ))}
                  </div>
                </PageSection>
              ) : null}

              {SPEC.kind === "community" ? (
                <PageSection title={SPEC.region === "cn" ? "社区视角" : "Community lens"} subtitle={SPEC.region === "cn" ? "这里强调活动、互动和反馈热度。" : "This highlights events, engagement, and feedback activity."} style={SPEC.skin}>
                  <div style={{ display: "grid", gap: 10 }}>
                    {communityRows.map((item) => (
                      <RecentItemCard key={item.label} title={item.label} meta={item.detail} time={String(item.value)} style={SPEC.skin} />
                    ))}
                  </div>
                </PageSection>
              ) : null}

              {ELITE_STYLE ? (
                <PageSection title={SPEC.region === "cn" ? "精英侧栏总览" : "Elite side overview"} subtitle={SPEC.region === "cn" ? "更高套餐会生成更强的汇报与总览表达。" : "Higher tiers generate a stronger reporting and overview layer."} style={SPEC.skin}>
                  <div style={{ display: "grid", gap: 10 }}>
                    {(SPEC.region === "cn"
                      ? ["多页面交付骨架", "更强模板风格锁定", "更高视觉完成度"]
                      : ["Multi-page delivery scaffold", "Stronger template locking", "Higher visual polish"]).map((item, index) => (
                      <RecentItemCard key={item} title={item} meta={SPEC.planTier} time={"0" + (index + 1)} style={SPEC.skin} />
                    ))}
                  </div>
                </PageSection>
              ) : null}

              <PageSection title={editingId ? (SPEC.region === "cn" ? "编辑条目" : "Edit item") : SPEC.copy.createItem} subtitle={SPEC.region === "cn" ? "当前工作区会直接写入真实数据。" : "This workspace writes directly into real local data."} style={SPEC.skin}>
                <div style={{ display: "grid", gap: 12 }}>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={SPEC.kind === "crm" ? (SPEC.region === "cn" ? "线索标题" : "Lead title") : SPEC.labels.taskTitle} style={{ padding: 12, borderRadius: 14, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, color: SPEC.skin.textPrimary }} />
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={SPEC.copy.formDescription} rows={4} style={{ padding: 12, borderRadius: 14, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, color: SPEC.skin.textPrimary, resize: "vertical" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10 }}>
                    <input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder={SPEC.labels.assignee} style={{ padding: 12, borderRadius: 14, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, color: SPEC.skin.textPrimary }} />
                    <select value={priority} onChange={(event) => setPriority(event.target.value as "low" | "medium" | "high")} style={{ padding: 12, borderRadius: 14, border: SPEC.skin.cardBorder, background: SPEC.skin.inputBackground, color: SPEC.skin.textPrimary }}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <button onClick={addOrUpdate} disabled={loading} style={{ borderRadius: 16, border: "none", background: SPEC.skin.accentStrong, color: "#ffffff", padding: "12px 16px", fontWeight: 700 }}>
                    {loading ? SPEC.labels.creating : editingId ? (SPEC.region === "cn" ? "保存修改" : "Save changes") : SPEC.copy.createItem}
                  </button>
                </div>
              </PageSection>

              <PageSection title={SPEC.region === "cn" ? "最近任务" : "Recent items"} subtitle={SPEC.region === "cn" ? "最近变动会优先显示在这里。" : "The newest changes surface here first."} style={SPEC.skin}>
                <div style={{ display: "grid", gap: 10 }}>
                  {recentItems.map((item) => (
                    <RecentItemCard key={item.id} title={item.title} meta={item.assignee || "-"} time={dateFmt.format(new Date(item.updatedAt))} style={SPEC.skin} />
                  ))}
                </div>
              </PageSection>

              <ProgressPanel title={SPEC.region === "cn" ? "进度追踪" : "Progress tracking"} description={SPEC.region === "cn" ? \`已完成 \${summary.done} / \${summary.total}，整体进度 \${summary.progress}%\` : \`\${summary.done} of \${summary.total} completed, \${summary.progress}% overall progress\`} progress={summary.progress} style={SPEC.skin} />
            </>
          )}
        </>
      }
    />
  );
}
`
}

function renderLayout(spec: AppSpec) {
  return `import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="${spec.language}">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
`
}

function renderApiRoute() {
  return `export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createItem, listItems, updateItem } from "../../../lib/items-store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const items = await listItems({
    query: url.searchParams.get("q") ?? "",
    assignee: url.searchParams.get("assignee") ?? "",
    status: url.searchParams.get("status") ?? "",
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const item = await createItem({
    title,
    description: String(body?.description ?? "").trim() || null,
    status: String(body?.status ?? "todo"),
    priority: (String(body?.priority ?? "medium") as "low" | "medium" | "high"),
    assignee: String(body?.assignee ?? "").trim() || null,
  });
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const item = await updateItem(id, {
    title: typeof body?.title === "string" ? body.title : undefined,
    description: typeof body?.description === "string" ? body.description : undefined,
    assignee: typeof body?.assignee === "string" ? body.assignee : undefined,
    priority: typeof body?.priority === "string" ? body.priority : undefined,
    status: typeof body?.status === "string" ? body.status : undefined,
  });
  return NextResponse.json(item);
}
`
}

function renderItemsStore() {
  return `import path from "path";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";

export type StoredItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: "low" | "medium" | "high";
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
};

type ItemFilters = {
  query?: string;
  assignee?: string;
  status?: string;
};

type CreateItemInput = {
  title: string;
  description: string | null;
  status: string;
  priority: "low" | "medium" | "high";
  assignee: string | null;
};

type UpdateItemInput = Partial<CreateItemInput>;

const STORE_PATH = path.join(process.cwd(), "data", "items.json");

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]\\n", "utf8");
  }
}

async function readItems() {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const parsed = JSON.parse(raw) as StoredItem[];
  return Array.isArray(parsed) ? parsed : [];
}

async function writeItems(items: StoredItem[]) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(items, null, 2), "utf8");
}

export async function listItems(filters: ItemFilters = {}) {
  const items = await readItems();
  return items.filter((item) => {
    const query = String(filters.query ?? "").trim().toLowerCase();
    const assignee = String(filters.assignee ?? "").trim().toLowerCase();
    const status = String(filters.status ?? "").trim().toLowerCase();
    const haystack = [item.title, item.description ?? "", item.assignee ?? "", item.status].join(" ").toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (assignee && !String(item.assignee ?? "").toLowerCase().includes(assignee)) return false;
    if (status && String(item.status).toLowerCase() !== status) return false;
    return true;
  });
}

export async function createItem(input: CreateItemInput) {
  const items = await readItems();
  const now = new Date().toISOString();
  const next: StoredItem = {
    id: randomUUID(),
    title: input.title,
    description: input.description ?? null,
    status: input.status || "todo",
    priority: input.priority || "medium",
    assignee: input.assignee ?? null,
    createdAt: now,
    updatedAt: now,
  };
  items.unshift(next);
  await writeItems(items);
  return next;
}

export async function updateItem(id: string, patch: UpdateItemInput) {
  const items = await readItems();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error("Item not found");
  }
  const current = items[index];
  const next: StoredItem = {
    ...current,
    title: typeof patch.title === "string" ? patch.title.trim() || current.title : current.title,
    description:
      typeof patch.description === "string"
        ? patch.description.trim() || null
        : current.description,
    assignee:
      typeof patch.assignee === "string"
        ? patch.assignee.trim() || null
        : current.assignee,
    priority:
      typeof patch.priority === "string"
        ? (patch.priority as "low" | "medium" | "high")
        : current.priority,
    status: typeof patch.status === "string" ? patch.status : current.status,
    updatedAt: new Date().toISOString(),
  };
  items[index] = next;
  await writeItems(items);
  return next;
}
`
}

function renderWorkspaceShellComponent() {
  return `import type { ReactNode } from "react";

export function WorkspaceShell({
  sidebar,
  hero,
  content,
  rightRail,
  style,
}: {
  sidebar: ReactNode;
  hero: ReactNode;
  content: ReactNode;
  rightRail: ReactNode;
  style: {
    pageBackground: string;
    textPrimary: string;
    cardBorder: string;
    sidebarBackground: string;
  };
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: style.pageBackground,
        color: style.textPrimary,
        fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", minHeight: "100vh" }}>
        <aside
          style={{
            padding: 24,
            borderRight: style.cardBorder,
            background: style.sidebarBackground,
            backdropFilter: "blur(12px)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {sidebar}
        </aside>

        <section style={{ padding: 28 }}>
          <div style={{ display: "grid", gap: 18 }}>
            {hero}
            <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1.65fr) minmax(320px,0.95fr)", gap: 18, alignItems: "start" }}>
              <div style={{ display: "grid", gap: 18 }}>{content}</div>
              <div style={{ display: "grid", gap: 18 }}>{rightRail}</div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
`
}

function renderWorkspaceStatCardComponent() {
  return `export function WorkspaceStatCard({
  label,
  value,
  detail,
  highlight = false,
  style,
}: {
  label: string;
  value: string | number;
  detail: string;
  highlight?: boolean;
  style: {
    panelBackground: string;
    cardBorder: string;
    textPrimary: string;
    textSecondary: string;
    accentStrong: string;
  };
}) {
  return (
    <div
      style={{
        borderRadius: 22,
        padding: 18,
        background: highlight ? style.accentStrong : style.panelBackground,
        color: highlight ? "#ffffff" : style.textPrimary,
        border: style.cardBorder,
      }}
    >
      <div style={{ fontSize: 12, color: highlight ? "rgba(255,255,255,0.7)" : style.textSecondary }}>{label}</div>
      <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: highlight ? "rgba(255,255,255,0.7)" : style.textSecondary }}>{detail}</div>
    </div>
  );
}
`
}

function renderTaskCardComponent() {
  return `type WorkItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: "low" | "medium" | "high";
  assignee: string | null;
  updatedAt: string;
};

export function TaskCard({
  item,
  descriptionEnabled,
  assigneeLabel,
  dateLabel,
  priorityColor,
  style,
  onEdit,
  onDelete,
  onMove,
  statusActions,
  editLabel,
  deleteLabel,
}: {
  item: WorkItem;
  descriptionEnabled: boolean;
  assigneeLabel: string;
  dateLabel: string;
  priorityColor: Record<"low" | "medium" | "high", string>;
  style: {
    textPrimary: string;
    textSecondary: string;
    cardBackground: string;
    cardBorder: string;
  };
  onEdit: () => void;
  onDelete: () => void;
  onMove: (status: string) => void;
  statusActions: Array<{ key: string; label: string }>;
  editLabel: string;
  deleteLabel: string;
}) {
  return (
    <article
      style={{
        borderRadius: 18,
        padding: 14,
        background: style.cardBackground,
        border: style.cardBorder,
        boxShadow: "0 10px 30px rgba(148,163,184,0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 700, lineHeight: 1.5, color: style.textPrimary }}>{item.title}</div>
        <span
          style={{
            borderRadius: 999,
            padding: "4px 8px",
            background: "rgba(255,255,255,0.08)",
            color: priorityColor[item.priority],
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {item.priority}
        </span>
      </div>
      {descriptionEnabled && item.description ? (
        <div style={{ fontSize: 13, color: style.textSecondary, marginTop: 8, lineHeight: 1.6 }}>{item.description}</div>
      ) : null}
      <div style={{ fontSize: 12, color: style.textSecondary, marginTop: 10 }}>
        {assigneeLabel}: {item.assignee || "-"} · {dateLabel}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        {statusActions.map((status) => (
          <button
            key={status.key}
            onClick={() => onMove(status.key)}
            style={{
              borderRadius: 999,
              border: style.cardBorder,
              background: style.cardBackground,
              color: style.textPrimary,
              padding: "6px 10px",
              fontSize: 12,
            }}
          >
            {status.label}
          </button>
        ))}
        <button
          onClick={onEdit}
          style={{
            borderRadius: 999,
            border: style.cardBorder,
            background: style.cardBackground,
            color: style.textPrimary,
            padding: "6px 10px",
            fontSize: 12,
          }}
        >
          {editLabel}
        </button>
        <button
          onClick={onDelete}
          style={{
            borderRadius: 999,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#be123c",
            padding: "6px 10px",
            fontSize: 12,
          }}
        >
          {deleteLabel}
        </button>
      </div>
    </article>
  );
}
`
}

function renderBoardColumnComponent() {
  return `import type { ReactNode } from "react";

export function BoardColumn({
  title,
  count,
  children,
  style,
}: {
  title: string;
  count: number;
  children: ReactNode;
  style: {
    cardBorder: string;
    inputBackground: string;
    textSecondary: string;
  };
}) {
  return (
    <section style={{ borderRadius: 20, border: style.cardBorder, background: style.inputBackground, padding: 12, minHeight: 280 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 15 }}>{title}</h4>
        <span style={{ fontSize: 12, color: style.textSecondary }}>{count}</span>
      </div>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </section>
  );
}
`
}

function renderPageSectionComponent() {
  return `import type { ReactNode } from "react";

export function PageSection({
  title,
  subtitle,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  style: {
    cardBorder: string;
    panelBackground: string;
    textSecondary: string;
  };
}) {
  return (
    <section style={{ borderRadius: 24, border: style.cardBorder, background: style.panelBackground, padding: 22 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 20 }}>{title}</h3>
        {subtitle ? <p style={{ margin: "8px 0 0", color: style.textSecondary, fontSize: 14 }}>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
`
}

function renderRecentItemCardComponent() {
  return `export function RecentItemCard({
  title,
  meta,
  time,
  style,
}: {
  title: string;
  meta: string;
  time: string;
  style: {
    inputBackground: string;
    cardBorder: string;
    textSecondary: string;
  };
}) {
  return (
    <div style={{ borderRadius: 18, padding: 14, background: style.inputBackground, border: style.cardBorder }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <strong>{title}</strong>
        <span style={{ fontSize: 12, color: style.textSecondary }}>{time}</span>
      </div>
      <div style={{ fontSize: 13, color: style.textSecondary, marginTop: 8 }}>{meta}</div>
    </div>
  );
}
`
}

function renderProgressPanelComponent() {
  return `export function ProgressPanel({
  title,
  description,
  progress,
  style,
}: {
  title: string;
  description: string;
  progress: number;
  style: {
    cardBorder: string;
    accentStrong: string;
    progressBackground: string;
  };
}) {
  return (
    <section style={{ borderRadius: 24, border: style.cardBorder, background: style.accentStrong, color: "#ffffff", padding: 22 }}>
      <h3 style={{ margin: 0, fontSize: 20 }}>{title}</h3>
      <div style={{ marginTop: 18, height: 12, borderRadius: 999, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
        <div style={{ width: \`\${progress}%\`, height: "100%", background: style.progressBackground }} />
      </div>
      <div style={{ marginTop: 12, color: "rgba(255,255,255,0.78)", fontSize: 14 }}>{description}</div>
    </section>
  );
}
`
}

function renderActivityFeedComponent() {
  return `export function ActivityFeed({
  title,
  rows,
  style,
}: {
  title: string;
  rows: Array<{ id: string; title: string; meta: string; time: string }>;
  style: {
    cardBorder: string;
    panelBackground: string;
    inputBackground: string;
    textSecondary: string;
  };
}) {
  return (
    <section style={{ borderRadius: 24, border: style.cardBorder, background: style.panelBackground, padding: 22 }}>
      <h3 style={{ margin: 0, fontSize: 20 }}>{title}</h3>
      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {rows.length === 0 ? (
          <div style={{ borderRadius: 18, border: style.cardBorder, background: style.inputBackground, padding: 14, color: style.textSecondary }}>
            No recent activity yet.
          </div>
        ) : (
          rows.map((row, index) => (
            <div key={row.id} style={{ borderRadius: 18, border: style.cardBorder, background: index === 0 ? style.inputBackground : style.panelBackground, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <strong>{row.title}</strong>
                <span style={{ fontSize: 12, color: style.textSecondary }}>{row.time}</span>
              </div>
              <div style={{ marginTop: 8, color: style.textSecondary, fontSize: 13 }}>{row.meta}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
`
}

function renderInsightTileComponent() {
  return `export function InsightTile({
  title,
  value,
  tone = "default",
  style,
}: {
  title: string;
  value: string | number;
  tone?: "default" | "accent" | "info" | "warning" | "success";
  style: {
    cardBorder: string;
    cardBackground: string;
    textPrimary: string;
    textSecondary: string;
    accentStrong: string;
  };
}) {
  const accents = {
    default: { background: style.cardBackground, color: style.textPrimary },
    accent: { background: style.accentStrong, color: "#ffffff" },
    info: { background: style.cardBackground, color: "#0284c7" },
    warning: { background: style.cardBackground, color: "#ea580c" },
    success: { background: style.cardBackground, color: "#16a34a" },
  } as const;
  const active = accents[tone];

  return (
    <div style={{ borderRadius: 20, border: style.cardBorder, background: active.background, padding: 16 }}>
      <div style={{ fontSize: 12, color: tone === "accent" ? "rgba(255,255,255,0.72)" : style.textSecondary }}>{title}</div>
      <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700, color: active.color }}>{value}</div>
    </div>
  );
}
`
}

function renderAboutPage(spec: AppSpec) {
  if (spec.templateId === "launchpad") {
    return `export default function AboutPage() {
  const isCn = ${spec.region === "cn" ? "true" : "false"};
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#fff8f1 0%,#ffffff 48%,#f8fafc 100%)", color: "#111827", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 28 }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, background: "#ffffff", border: "1px solid rgba(15,23,42,0.08)", padding: 28, boxShadow: "0 24px 70px rgba(15,23,42,0.08)" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: isCn ? "官网首页" : "Homepage" },
              { href: "/download", label: isCn ? "下载中心" : "Downloads" },
              { href: "/about", label: isCn ? "品牌说明" : "About", active: true },
            ].map((item) => (
              <a key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "#111827" : "#f8fafc", color: item.active ? "#ffffff" : "#111827", fontSize: 13, fontWeight: 700, border: item.active ? "none" : "1px solid rgba(15,23,42,0.08)" }}>
                {item.label}
              </a>
            ))}
          </div>
          <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#c2410c" }}>{isCn ? "品牌说明" : "Brand brief"}</div>
          <h1 style={{ margin: "12px 0 10px", fontSize: 38, fontWeight: 900 }}>{isCn ? "关于这个产品官网" : "About this product site"}</h1>
          <p style={{ color: "#6b7280", lineHeight: 1.9, fontSize: 16 }}>{isCn ? "这个项目类型更像完整品牌官网与下载站，页面重点是品牌主张、下载入口、文档中心、价格方案与转化路径，而不是通用工作台。" : "This project type is a polished website and download funnel rather than a generic workspace."}</p>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
          {(isCn
            ? [
                { title: "品牌定位", note: "面向老板演示、客户转化与正式上线预热" },
                { title: "内容结构", note: "官网、下载、文档、价格与案例相互串联" },
                { title: "转化目标", note: "把浏览、注册、登录、支付尽量收敛到同一链路" },
              ]
            : [
                { title: "Brand positioning", note: "Built for demos, conversion, and launch readiness" },
                { title: "Content structure", note: "Homepage, downloads, docs, pricing, and proof are connected" },
                { title: "Conversion goal", note: "Guide traffic toward signup, login, and billing in one flow" },
              ]).map((item) => (
            <div key={item.title} style={{ borderRadius: 22, background: "#ffffff", border: "1px solid rgba(15,23,42,0.08)", padding: 22 }}>
              <div style={{ fontWeight: 900 }}>{item.title}</div>
              <div style={{ marginTop: 10, color: "#6b7280", lineHeight: 1.8 }}>{item.note}</div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
`
  }
  const copy = getCopy(spec)
  const skin = getTemplateSkin(spec)
  return `export default function AboutPage() {
  const spec = ${JSON.stringify(spec, null, 2)} as const;
  const skin = ${JSON.stringify(skin, null, 2)} as const;
  const modules = ${JSON.stringify(spec.modules.slice(0, 6), null, 2)} as const;
  const features = ${JSON.stringify(spec.features, null, 2)} as readonly string[];
  const isCn = ${spec.region === "cn" ? "true" : "false"};
  return (
    <main style={{ minHeight: "100vh", padding: 28, background: skin.pageBackground, color: skin.textPrimary, fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, border: skin.cardBorder, background: skin.panelBackground, padding: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: isCn ? "首页" : "Home" },
              ...(features.includes("analytics_page") ? [{ href: "/analytics", label: isCn ? "分析" : "Analytics" }] : []),
              { href: "/about", label: isCn ? "项目说明" : "About", active: true },
            ].map((item) => (
              <a key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? skin.accentStrong : skin.inputBackground, color: item.active ? "#ffffff" : skin.textPrimary, fontSize: 13, fontWeight: 700, border: item.active ? "none" : skin.cardBorder }}>
                {item.label}
              </a>
            ))}
          </div>
          <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: skin.textSecondary }}>
            ${spec.region === "cn" ? "项目说明" : "Workspace brief"}
          </div>
          <h1>${spec.region === "cn" ? "关于这个工作区" : "About this workspace"}</h1>
          <p style={{ color: skin.textSecondary, lineHeight: 1.8 }}>
            ${copy.header}
          </p>
        </section>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ border: skin.cardBorder, borderRadius: 20, padding: 18, background: skin.cardBackground }}>
            <div style={{ fontWeight: 600 }}>Spec</div>
            <div style={{ color: skin.textSecondary, fontSize: 12, marginTop: 6 }}>
              {spec.kind} | {spec.region} | {spec.language} | {spec.timezone}
            </div>
          </div>
          <div style={{ border: skin.cardBorder, borderRadius: 20, padding: 18, background: skin.cardBackground }}>
            <div style={{ fontWeight: 600 }}>${spec.region === "cn" ? "已启用能力" : "Enabled features"}</div>
            <ul style={{ margin: "12px 0 0", paddingLeft: 18, color: skin.textSecondary, lineHeight: 1.8 }}>
              {features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
        </div>
        <section style={{ borderRadius: 24, border: skin.cardBorder, background: skin.panelBackground, padding: 22 }}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>${spec.region === "cn" ? "当前模块视图" : "Current module map"}</h2>
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
            {modules.map((module) => (
              <div key={module} style={{ borderRadius: 16, border: skin.cardBorder, background: skin.inputBackground, padding: 14 }}>
                <div style={{ fontWeight: 700 }}>{module}</div>
                <div style={{ marginTop: 8, color: skin.textSecondary, fontSize: 13, lineHeight: 1.7 }}>
                  {isCn ? "已纳入当前生成工作区的产品能力。" : "Included in the current generated product surface."}
                </div>
              </div>
            ))}
          </div>
        </section>
        <a href="/" style={{ display: "inline-flex", width: "fit-content", padding: "10px 14px", borderRadius: 999, textDecoration: "none", background: skin.accentStrong, color: "#ffffff" }}>
          ${spec.region === "cn" ? "返回首页" : "Back to home"}
        </a>
      </div>
    </main>
  );
}
`
}

function renderAnalyticsPage(spec: AppSpec) {
  if (spec.templateId === "taskflow") {
    return `// @ts-nocheck
"use client";

export default function AnalyticsPage() {
  const isCn = ${spec.region === "cn" ? "true" : "false"};
  const cards = ${JSON.stringify(
    spec.region === "cn"
      ? [
          { title: "请求趋势", value: "2.4M", detail: "近 7 天调用量", tone: "#38bdf8" },
          { title: "错误告警", value: "18", detail: "待处理异常", tone: "#f59e0b" },
          { title: "接口成功率", value: "99.97%", detail: "生产环境", tone: "#10b981" },
          { title: "文档覆盖", value: "28", detail: "模块与示例", tone: "#8b5cf6" },
        ]
      : [
          { title: "Usage trends", value: "2.4M", detail: "7 day traffic", tone: "#38bdf8" },
          { title: "Alerts", value: "18", detail: "Open incidents", tone: "#f59e0b" },
          { title: "Success rate", value: "99.97%", detail: "Production", tone: "#10b981" },
          { title: "Docs coverage", value: "28", detail: "Modules and samples", tone: "#8b5cf6" },
        ],
    null,
    2
  )} as const;

  return (
    <main style={{ minHeight: "100vh", background: "#07111f", color: "#e2e8f0", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 28 }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, border: "1px solid rgba(56,189,248,0.14)", background: "rgba(15,23,42,0.92)", padding: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: isCn ? "平台总览" : "Platform home" },
              { href: "/analytics", label: isCn ? "分析中心" : "Analytics", active: true },
              { href: "/incidents", label: isCn ? "告警中心" : "Incidents" },
            ].map((item) => (
              <a key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "#06b6d4" : "rgba(34,211,238,0.12)", color: item.active ? "#082f49" : "#67e8f9", fontSize: 13, fontWeight: 700 }}>
                {item.label}
              </a>
            ))}
          </div>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900 }}>{isCn ? "接口分析中心" : "API analytics center"}</h1>
          <p style={{ marginTop: 10, color: "#94a3b8", lineHeight: 1.8 }}>{isCn ? "这类项目在分析页上应该直接给出趋势、告警和文档覆盖，而不是普通任务统计。" : "This analytics page should emphasize usage, alerts, and documentation coverage."}</p>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
          {cards.map((card) => (
            <div key={card.title} style={{ borderRadius: 22, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(148,163,184,0.1)", padding: 20 }}>
              <div style={{ color: "#94a3b8" }}>{card.title}</div>
              <div style={{ marginTop: 10, fontSize: 34, color: card.tone, fontWeight: 900 }}>{card.value}</div>
              <div style={{ marginTop: 8, color: "#64748b" }}>{card.detail}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
          <div style={{ borderRadius: 22, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(148,163,184,0.1)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "重点观察" : "Focus areas"}</div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {(isCn
                ? ["支付回调稳定性", "Webhook 延迟波动", "OpenAPI 文档覆盖"]
                : ["Billing callback stability", "Webhook latency variance", "OpenAPI documentation coverage"]).map((item, index) => (
                <div key={item} style={{ borderRadius: 14, background: index === 0 ? "rgba(239,68,68,0.12)" : "#111827", color: index === 0 ? "#fca5a5" : "#cbd5e1", padding: "12px 14px" }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 22, background: "linear-gradient(135deg,rgba(14,165,233,0.18),rgba(99,102,241,0.16))", border: "1px solid rgba(56,189,248,0.14)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "分析页定位" : "Why this page matters"}</div>
            <p style={{ marginTop: 12, color: "#cbd5e1", lineHeight: 1.8 }}>
              {isCn ? "这里要承接真实数据平台该有的观察视角，让项目一眼看上去就是 API 分析与运维产品，而不是普通任务统计表。" : "This page should make the project read as an operations-grade API analytics product rather than a generic task dashboard."}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
`
  }
  const skin = getTemplateSkin(spec)
  const analyticsTitle = spec.region === "cn" ? "跟进分析" : "Workspace analytics"
  const analyticsIntro =
    spec.region === "cn"
      ? "基于当前 workspace 数据生成趋势和负责人分布。"
      : "Trend and owner distribution generated from current workspace data."
  const ownerDistributionTitle = spec.region === "cn" ? "负责人分布" : "Owner distribution"
  const unassignedLabel = spec.region === "cn" ? "未分配" : "Unassigned"
  return `// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";

type WorkItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
};

const SPEC = ${JSON.stringify(spec, null, 2)} as const;
const SKIN = ${JSON.stringify(skin, null, 2)} as const;

export default function AnalyticsPage() {
  const [items, setItems] = useState<WorkItem[]>([]);

  useEffect(() => {
    fetch("/api/items")
      .then((res) => res.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, []);

  const statusSummary = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [items]);

  const ownerSummary = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      const owner = item.assignee || "${unassignedLabel}";
      acc[owner] = (acc[owner] ?? 0) + 1;
      return acc;
    }, {});
  }, [items]);

  return (
    <main style={{ minHeight: "100vh", padding: 28, background: SKIN.pageBackground, color: SKIN.textPrimary, fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, border: SKIN.cardBorder, background: SKIN.panelBackground, padding: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: SPEC.region === "cn" ? "首页" : "Home" },
              { href: "/analytics", label: SPEC.region === "cn" ? "分析" : "Analytics", active: true },
              ...(SPEC.features.includes("about_page") ? [{ href: "/about", label: SPEC.region === "cn" ? "说明" : "About" }] : []),
            ].map((item) => (
              <a key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? SKIN.accentStrong : SKIN.inputBackground, color: item.active ? "#ffffff" : SKIN.textPrimary, fontSize: 13, fontWeight: 700, border: item.active ? "none" : SKIN.cardBorder }}>
                {item.label}
              </a>
            ))}
          </div>
          <h1>${analyticsTitle}</h1>
          <p style={{ color: SKIN.textSecondary, lineHeight: 1.8 }}>
            ${analyticsIntro}
          </p>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          {Object.entries(statusSummary).map(([status, count]) => (
            <div key={status} style={{ border: SKIN.cardBorder, borderRadius: 20, padding: 18, background: SKIN.cardBackground }}>
              <div style={{ color: SKIN.textSecondary, fontSize: 12 }}>{status}</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 10 }}>{count}</div>
            </div>
          ))}
        </section>

        <section style={{ borderRadius: 24, border: SKIN.cardBorder, background: SKIN.panelBackground, padding: 22 }}>
          <h2 style={{ fontSize: 18, marginTop: 0 }}>${ownerDistributionTitle}</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {Object.entries(ownerSummary).map(([owner, count]) => (
              <div key={owner} style={{ border: SKIN.cardBorder, borderRadius: 16, padding: 14, background: SKIN.inputBackground, display: "flex", justifyContent: "space-between" }}>
                <span>{owner}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14 }}>
          <div style={{ borderRadius: 22, border: SKIN.cardBorder, background: SKIN.cardBackground, padding: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>${spec.region === "cn" ? "状态解读" : "Status reading"}</div>
            <div style={{ marginTop: 12, color: SKIN.textSecondary, lineHeight: 1.8 }}>
              ${spec.region === "cn"
                ? "这里用来承接当前工作区的任务、线索或内容推进情况，让分析页看起来更像真实业务面板。"
                : "This section interprets current workspace momentum so the page feels like a real operating dashboard."}
            </div>
          </div>
          <div style={{ borderRadius: 22, border: SKIN.cardBorder, background: SKIN.cardBackground, padding: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>${spec.region === "cn" ? "下一步建议" : "Suggested next move"}</div>
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {[
                ${JSON.stringify(spec.region === "cn" ? "继续补强多页面结构" : "Expand multi-page depth")},
                ${JSON.stringify(spec.region === "cn" ? "让不同类型模板差异更明显" : "Widen archetype differences")},
                ${JSON.stringify(spec.region === "cn" ? "让生成结果更接近验收成品" : "Push outputs closer to acceptance-grade quality")},
              ].map((item) => (
                <div key={item} style={{ borderRadius: 12, background: SKIN.inputBackground, padding: "10px 12px", color: SKIN.textPrimary, fontSize: 13 }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <a href="/" style={{ display: "inline-flex", width: "fit-content", padding: "10px 14px", borderRadius: 999, textDecoration: "none", background: SKIN.accentStrong, color: "#ffffff" }}>
          ${spec.region === "cn" ? "返回首页" : "Back to home"}
        </a>
      </div>
    </main>
  );
}
`
}

type CodePlatformRouteSeed = CodePlatformContextRoute

type CodePlatformFileSeed = {
  id: string
  name: string
  fullPath: string
  symbols: string[]
  body: string
}

type CodePlatformFileGroupSeed = {
  id: string
  name: string
  files: CodePlatformFileSeed[]
}

type CodePlatformTemplateSeed = {
  id: string
  name: string
  summary: string
  focus: string
  tags: string[]
  badge: string
  color: string
}

type CodePlatformRunSeed = {
  id: string
  name: string
  branch: string
  status: string
  detail: string
  duration: string
  time: string
  tone: string
}

function buildCodePlatformRoutes(spec: AppSpec): CodePlatformRouteSeed[] {
  return buildCodePlatformContextRoutes({
    region: spec.region,
    features: spec.features,
  })
}

function buildCodePlatformEditorFileGroups(spec: AppSpec): CodePlatformFileGroupSeed[] {
  const isCn = spec.region === "cn"
  const routeFiles = buildCodePlatformRoutes(spec).map((route) => {
    const componentName = route.filePath === "app/page.tsx"
      ? "HomePage"
      : `${route.id.charAt(0).toUpperCase()}${route.id.slice(1)}Page`
    return {
      id: route.id,
      name: route.filePath.replace(/^app\//, ""),
      fullPath: route.filePath,
      symbols: route.symbols,
      body: `export default function ${componentName}() {\n  return {\n    brand: ${JSON.stringify(spec.title)},\n    route: ${JSON.stringify(route.href)},\n    focus: ${JSON.stringify(isCn ? route.focusCn : route.focusEn)},\n    modules: ${JSON.stringify(spec.modules.slice(0, 4), null, 2)},\n  }\n}`,
    }
  })

  return [
    {
      id: "app",
      name: "app",
      files: routeFiles,
    },
    {
      id: "components",
      name: "components/generated",
      files: [
        {
          id: "workspace-shell",
          name: "generated/workspace-shell.tsx",
          fullPath: "components/generated/workspace-shell.tsx",
          symbols: ["WorkspaceShell", "AppShellHeader", "WorkspaceSidebar"],
          body: `export function WorkspaceShell() {\n  return {\n    surfaces: ["activity-bar", "file-tree", "editor", "terminal", "assistant"],\n    brand: ${JSON.stringify(spec.title)},\n  }\n}`,
        },
        {
          id: "activity-feed",
          name: "generated/activity-feed.tsx",
          fullPath: "components/generated/activity-feed.tsx",
          symbols: ["ActivityFeed", "ActivityRow", "ActivityPill"],
          body: `export function ActivityFeed() {\n  return {\n    recent: ${JSON.stringify(spec.modules.slice(0, 3), null, 2)},\n    tone: ${JSON.stringify(isCn ? "中文交付工作流" : "delivery-focused workflow")},\n  }\n}`,
        },
        {
          id: "board-column",
          name: "generated/board-column.tsx",
          fullPath: "components/generated/board-column.tsx",
          symbols: ["BoardColumn", "StatusRail", "CardStack"],
          body: `export function BoardColumn() {\n  return {\n    statuses: ["todo", "in_progress", "done"],\n    region: ${JSON.stringify(spec.region)},\n  }\n}`,
        },
        {
          id: "insight-tile",
          name: "generated/insight-tile.tsx",
          fullPath: "components/generated/insight-tile.tsx",
          symbols: ["InsightTile", "InsightValue", "InsightMeta"],
          body: `export function InsightTile() {\n  return {\n    planTier: ${JSON.stringify(spec.planTier)},\n    features: ${JSON.stringify(spec.features.slice(0, 4), null, 2)},\n  }\n}`,
        },
      ],
    },
    {
      id: "runtime",
      name: "runtime",
      files: [
        {
          id: "items-store",
          name: "lib/items-store.ts",
          fullPath: "lib/items-store.ts",
          symbols: ["readItems", "writeItems", "listItems"],
          body: `export const storageProfile = {\n  region: ${JSON.stringify(spec.region)},\n  database: ${JSON.stringify(spec.databaseTarget)},\n  deployment: ${JSON.stringify(spec.deploymentTarget)},\n}`,
        },
        {
          id: "api-items",
          name: "api/items/route.ts",
          fullPath: "app/api/items/route.ts",
          symbols: ["GET", "POST", "PATCH"],
          body: `export const runtimeFlow = {\n  methods: ["GET", "POST", "PATCH"],\n  focus: ${JSON.stringify(isCn ? "让工作区中的任务、模块和状态能被真正修改" : "Make tasks, modules, and state mutable inside the workspace")},\n}`,
        },
        {
          id: "spec-json",
          name: "spec.json",
          fullPath: "spec.json",
          symbols: ["title", "kind", "planTier", "modules"],
          body: JSON.stringify(
            {
              title: spec.title,
              kind: spec.kind,
              planTier: spec.planTier,
              modules: spec.modules.slice(0, 6),
              features: spec.features,
            },
            null,
            2
          ),
        },
        {
          id: "region-config",
          name: "region.config.json",
          fullPath: "region.config.json",
          symbols: ["region", "deploymentTarget", "databaseTarget"],
          body: JSON.stringify(
            {
              region: spec.region,
              deploymentTarget: spec.deploymentTarget,
              databaseTarget: spec.databaseTarget,
              language: spec.language,
              timezone: spec.timezone,
            },
            null,
            2
          ),
        },
      ],
    },
  ]
}

function buildCodePlatformTemplateSeeds(spec: AppSpec): CodePlatformTemplateSeed[] {
  const isCn = spec.region === "cn"
  const tiers = {
    free: isCn ? "免费" : "Free",
    pro: isCn ? "专业版" : "Pro",
    elite: isCn ? "精英版" : "Elite",
  } as const
  return [
    {
      id: "website",
      name: isCn ? "官网与下载站" : "Website + downloads",
      summary: isCn ? "首页、下载页、文档与定价串成一套对外路径" : "Home, downloads, docs, and pricing tied into one external path",
      focus: "home",
      tags: ["website", "downloads", "docs"],
      badge: tiers.free,
      color: "#4c1d95",
    },
    {
      id: "sales",
      name: isCn ? "销售后台" : "Sales admin",
      summary: isCn ? "客户、商机、合同与交付看板联动" : "Customers, deals, contracts, and delivery boards",
      focus: "dashboard",
      tags: ["crm", "delivery", "ops"],
      badge: tiers.pro,
      color: "#1e3a5f",
    },
    {
      id: "api",
      name: isCn ? "API 数据平台" : "API platform",
      summary: isCn ? "接口、日志、鉴权、环境和监控" : "Endpoints, logs, auth, environments, and monitoring",
      focus: "runs",
      tags: ["api", "monitoring", "auth"],
      badge: tiers.pro,
      color: "#134e4a",
    },
    {
      id: "community",
      name: isCn ? "社区反馈中心" : "Community hub",
      summary: isCn ? "反馈、工单、公告、知识库同屏协同" : "Feedback, tickets, announcements, and knowledge base in one flow",
      focus: "templates",
      tags: ["community", "feedback", "support"],
      badge: tiers.elite,
      color: "#78350f",
    },
  ]
}

function buildCodePlatformRunSeeds(spec: AppSpec): CodePlatformRunSeed[] {
  const isCn = spec.region === "cn"
  return [
    {
      id: "run-overview",
      name: `${spec.title} ${isCn ? "总览链路" : "overview flow"}`,
      branch: "main",
      status: isCn ? "通过" : "ready",
      detail: isCn ? "控制台与交付面板同步" : "Control plane and delivery panels synced",
      duration: "1m 18s",
      time: isCn ? "3 分钟前" : "3 min ago",
      tone: "#10b981",
    },
    {
      id: "run-editor",
      name: `${spec.title} ${isCn ? "编辑器工作区" : "editor workspace"}`,
      branch: "workspace/editor",
      status: isCn ? "构建中" : "running",
      detail: isCn ? "文件树、AI 助手与终端联动" : "Explorer, AI rail, and terminal syncing",
      duration: isCn ? "进行中" : "running",
      time: isCn ? "刚刚" : "just now",
      tone: "#3b82f6",
    },
    {
      id: "run-preview",
      name: `${spec.title} ${isCn ? "预览回退链路" : "preview fallback chain"}`,
      branch: "preview/recovery",
      status: isCn ? "待验证" : "pending",
      detail: isCn ? "canonical / runtime / fallback 收口" : "canonical / runtime / fallback convergence",
      duration: "52s",
      time: isCn ? "8 分钟前" : "8 min ago",
      tone: "#f59e0b",
    },
    {
      id: "run-delivery",
      name: `${spec.title} ${isCn ? "模板与交付" : "templates and delivery"}`,
      branch: "delivery/templates",
      status: isCn ? "通过" : "ready",
      detail: isCn ? "模板轨道、套餐与设置页已对齐" : "Template rails, pricing, and settings aligned",
      duration: "2m 04s",
      time: isCn ? "15 分钟前" : "15 min ago",
      tone: "#22c55e",
    },
  ]
}

function buildCodePlatformDashboardMetrics(spec: AppSpec) {
  const isCn = spec.region === "cn"
  const routeCount = buildCodePlatformRoutes(spec).length
  const moduleCount = spec.modules.length
  const featureCount = spec.features.length
  return isCn
    ? [
        { label: "当前路由", value: String(routeCount), tone: "#8b5cf6", delta: `+${Math.max(1, routeCount - 4)}` },
        { label: "模块数量", value: String(moduleCount), tone: "#22c55e", delta: `+${Math.max(1, moduleCount - 6)}` },
        { label: "AI 能力", value: String(featureCount + 4), tone: "#38bdf8", delta: `+${featureCount}` },
        { label: "验收状态", value: getPlanAcceptanceLabel(spec.planTier, spec.region), tone: "#f59e0b", delta: spec.deploymentTarget },
      ]
    : [
        { label: "Routes", value: String(routeCount), tone: "#8b5cf6", delta: `+${Math.max(1, routeCount - 4)}` },
        { label: "Modules", value: String(moduleCount), tone: "#22c55e", delta: `+${Math.max(1, moduleCount - 6)}` },
        { label: "AI surfaces", value: String(featureCount + 4), tone: "#38bdf8", delta: `+${featureCount}` },
        { label: "Acceptance", value: getPlanAcceptanceLabel(spec.planTier, spec.region), tone: "#f59e0b", delta: spec.deploymentTarget },
      ]
}

function buildCodePlatformActivitySeeds(spec: AppSpec) {
  const isCn = spec.region === "cn"
  return [
    {
      title: isCn ? "AI 已同步当前文件树与模板轨道" : "AI synced the current file tree and template rails",
      meta: isCn
        ? `当前核心模块：${spec.modules.slice(0, 3).join(" / ")}`
        : `Current core modules: ${spec.modules.slice(0, 3).join(" / ")}`,
      status: isCn ? "已联动" : "linked",
    },
    {
      title: isCn ? "预览链路已围绕当前项目收口" : "Preview routing has converged around the current project",
      meta: isCn
        ? `${spec.deploymentTarget} · ${spec.databaseTarget} · fallback ready`
        : `${spec.deploymentTarget} · ${spec.databaseTarget} · fallback ready`,
      status: isCn ? "稳定" : "stable",
    },
    {
      title: isCn ? "套餐与模板深度已映射到当前样板" : "Plan depth and template rails are mapped into the current sample",
      meta: isCn
        ? `plan=${spec.planTier} · features=${spec.features.join(" / ")}`
        : `plan=${spec.planTier} · features=${spec.features.join(" / ")}`,
      status: isCn ? "可演示" : "demo-ready",
    },
  ]
}

function buildCodePlatformManagementCards(spec: AppSpec) {
  const isCn = spec.region === "cn"
  return [
    {
      title: isCn ? "访问与可见性" : "Access and visibility",
      value: isCn
        ? `team visible · ${spec.planTier} tier · ${spec.region === "cn" ? "国内路径" : "国际路径"}`
        : `team visible · ${spec.planTier} tier · ${spec.region === "cn" ? "china path" : "global path"}`,
    },
    {
      title: isCn ? "域名与发布" : "Domains and release",
      value: isCn
        ? `${spec.deploymentTarget} · canonical preview · runtime enhancement`
        : `${spec.deploymentTarget} · canonical preview · runtime enhancement`,
    },
    {
      title: isCn ? "数据与集成" : "Data and integrations",
      value: isCn
        ? `${spec.databaseTarget} · auth / docs / delivery rails`
        : `${spec.databaseTarget} · auth / docs / delivery rails`,
    },
    {
      title: isCn ? "自动化与守卫" : "Automation and guards",
      value: isCn
        ? `${spec.features.length} feature flags · build acceptance rail`
        : `${spec.features.length} feature flags · build acceptance rail`,
    },
  ]
}

function buildCodePlatformAcceptanceTracks(spec: AppSpec) {
  const templateSeeds = buildCodePlatformTemplateSeeds(spec)
  return [
    spec.region === "cn" ? "当前代码平台" : "Current code platform",
    ...templateSeeds.map((item) => item.name),
  ]
}

function buildCodePlatformFeaturedBundles(spec: AppSpec) {
  const isCn = spec.region === "cn"
  return [
    {
      title: isCn ? "工作区主壳" : "Workspace shell",
      note: isCn
        ? `Explorer / Editor / Runs / Assistant 围绕 ${spec.title} 收口`
        : `Explorer / Editor / Runs / Assistant converge around ${spec.title}`,
      color: "#8b5cf6",
    },
    {
      title: isCn ? "验收与回退" : "Acceptance and fallback",
      note: isCn
        ? `${spec.deploymentTarget} + ${spec.databaseTarget} + current-project fallback`
        : `${spec.deploymentTarget} + ${spec.databaseTarget} + current-project fallback`,
      color: "#22c55e",
    },
    {
      title: isCn ? "模板与升级" : "Templates and upgrades",
      note: isCn
        ? `${spec.planTier} tier drives template breadth and delivery depth`
        : `${spec.planTier} tier drives template breadth and delivery depth`,
      color: "#38bdf8",
    },
  ]
}

function getCodePlatformPlanLabel(planTier: PlanTier, region: Region) {
  if (region === "cn") {
    if (planTier === "elite") return "精英版"
    if (planTier === "pro") return "专业版"
    if (planTier === "builder") return "建造者版"
    if (planTier === "starter") return "启动版"
    return "免费版"
  }

  if (planTier === "elite") return "Elite"
  if (planTier === "pro") return "Pro"
  if (planTier === "builder") return "Builder"
  if (planTier === "starter") return "Starter"
  return "Free"
}

function getCompactPlanTag(planTier: PlanTier) {
  if (planTier === "elite") return "Elite"
  if (planTier === "pro") return "Pro"
  if (planTier === "builder") return "Builder"
  if (planTier === "starter") return "Starter"
  return "Free"
}

function getPlanAcceptanceLabel(planTier: PlanTier, region: Region) {
  if (region === "cn") {
    if (planTier === "elite") return "展示级"
    if (planTier === "pro") return "高级"
    if (planTier === "builder") return "建造者"
    if (planTier === "starter") return "启动版"
    return "基础版"
  }
  if (planTier === "elite") return "Showcase"
  if (planTier === "pro") return "Premium"
  if (planTier === "builder") return "Builder"
  if (planTier === "starter") return "Starter"
  return "Scaffold"
}

function buildCodePlatformElementSeeds(spec: AppSpec) {
  return buildCodePlatformRoutes(spec).map((route) => ({
    routeId: route.id,
    elements: getLocalizedRouteElements(route, spec.region),
  }))
}

type CodePlatformIterationSeed = {
  routeId: string
  routeLabel: string
  fileId: string
  filePath: string
  openTabIds: string[]
  symbolName: string
  elementName: string
  selectedTemplateName: string
  aiPrompt: string
  sessionNote: string
  mode: "explain" | "fix" | "generate" | "refactor"
}

function buildCodePlatformIterationSeed(
  spec: AppSpec,
  fileGroups: CodePlatformFileGroupSeed[],
  routes: CodePlatformRouteSeed[],
  templates: CodePlatformTemplateSeed[],
  context?: SpecIterationContext
): CodePlatformIterationSeed {
  const allFiles = fileGroups.flatMap((group) => group.files)
  const pageRoute =
    findCodePlatformRouteById(routes, context?.currentPage?.id || context?.sharedSession?.routeId || context?.sharedSession?.activeSection) ??
    findCodePlatformRouteByFilePath(routes, context?.currentFilePath || context?.sharedSession?.filePath) ??
    findCodePlatformRouteByHref(routes, context?.currentRoute || context?.currentPage?.route) ??
    routes[0]
  const pageLabel = getLocalizedRouteLabel(pageRoute, spec.region)
  const routeFile =
    allFiles.find((file) => file.fullPath === normalizeSpecContextPath(context?.currentFilePath || context?.sharedSession?.filePath)) ??
    allFiles.find((file) => file.fullPath === pageRoute.filePath) ??
    allFiles[0]
  const normalizedMode = context?.mode === "explain" || context?.mode === "fix" || context?.mode === "refactor"
    ? context.mode
    : "generate"
  const routeElements = getLocalizedRouteElements(pageRoute, spec.region)
  const selectedTemplateName =
    normalizeSpecContextLabel(context?.sharedSession?.selectedTemplate) ||
    templates[0]?.name ||
    ""
  const openTabIds = uniqueStrings([
    normalizeSpecContextPath(context?.currentFilePath || context?.sharedSession?.filePath),
    normalizeSpecContextPath(context?.currentPage?.filePath),
    ...((context?.openTabs ?? []).map((item) => normalizeSpecContextPath(item))),
    ...((context?.relatedPaths ?? []).map((item) => normalizeSpecContextPath(item))),
  ])
    .map((filePath) => allFiles.find((file) => file.fullPath === filePath)?.id)
    .filter((item): item is string => Boolean(item))
    .slice(0, 4)

  const moduleName =
    normalizeSpecContextLabel(context?.currentModule?.name || context?.sharedSession?.symbolName) ||
    routeFile?.symbols[0] ||
    pageRoute.symbols[0] ||
    (spec.region === "cn" ? "主模块" : "Primary module")
  const elementName =
    normalizeSpecContextLabel(context?.currentElement?.name || context?.sharedSession?.elementName) ||
    routeElements[0] ||
    (spec.region === "cn" ? "主容器" : "Primary surface")
  const aiPrompt = sanitizeUiText(spec.prompt) || (spec.region === "cn" ? "继续沿当前文件上下文扩展工作区能力。" : "Keep extending the workspace from the current file context.")
  const sessionNote = [
    pageLabel,
    moduleName,
    elementName,
  ].filter(Boolean).join(" / ")

  return {
    routeId: pageRoute.id,
    routeLabel: pageLabel,
    fileId: routeFile?.id || allFiles[0]?.id || "dashboard",
    filePath: routeFile?.fullPath || pageRoute.filePath,
    openTabIds: openTabIds.length ? openTabIds : [routeFile?.id || allFiles[0]?.id || "dashboard"],
    symbolName: moduleName,
    elementName,
    selectedTemplateName,
    aiPrompt,
    sessionNote,
    mode: normalizedMode,
  }
}

function renderDashboardPage(spec: AppSpec) {
  if (spec.kind === "code_platform") {
    const isCn = spec.region === "cn"
    const brand = spec.title
    const routeSeeds = buildCodePlatformRoutes(spec)
    const generatedRouteSummary = routeSeeds.map((item) => item.href === "/" ? "home" : item.href.replace(/^\//, "")).join(" / ")
    const metrics = buildCodePlatformDashboardMetrics(spec)
    const activity = buildCodePlatformActivitySeeds(spec)
    const managementCards = buildCodePlatformManagementCards(spec)
    const planLabel = getCodePlatformPlanLabel(spec.planTier, spec.region)
    const elementSeeds = buildCodePlatformElementSeeds(spec)
    const sidebar = isCn
      ? ["Overview", "Users", "Data", "Analytics", "Domains", "Integrations", "Security", "Agents", "Automations", "Logs", "API", "Settings"]
      : ["Overview", "Users", "Data", "Analytics", "Domains", "Integrations", "Security", "Agents", "Automations", "Logs", "API", "Settings"]
    return `// @ts-nocheck
"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function DashboardPage() {
  const isCn = ${isCn ? "true" : "false"};
  const STORAGE_KEY = "mornstack-generated-workspace-config";
  const SESSION_KEY = "mornstack-generated-workspace-session";
  const defaultPlanName = ${JSON.stringify(planLabel)};
  const items = ${JSON.stringify(sidebar, null, 2)} as const;
  const routeManifest = ${JSON.stringify(routeSeeds.map((route) => ({
    id: route.id,
    href: route.href,
    filePath: route.filePath,
    label: isCn ? route.labelCn : route.labelEn,
    focus: isCn ? route.focusCn : route.focusEn,
  })), null, 2)} as Array<{ id: string; href: string; filePath: string; label: string; focus: string }>;
  const elementCatalog = ${JSON.stringify(elementSeeds, null, 2)} as Array<{ routeId: string; elements: string[] }>;
  const sidebarControlIndex = {
    Overview: 0,
    Users: 1,
    Data: 2,
    Analytics: 2,
    Domains: 1,
    Integrations: 3,
    Security: 1,
    Agents: 0,
    Automations: 2,
    Logs: 2,
    API: 3,
    Settings: 1,
  } as const;
  const metrics = ${JSON.stringify(metrics, null, 2)} as const;
  const controlCards = ${JSON.stringify(
    isCn
      ? [
          { title: "工作区入口", note: "Editor / Dashboard / Code 三块联动查看", href: "/editor", badge: "Open editor" },
          { title: "访问与分享", note: "Share link、可见性、邀请成员、公开演示", href: "/settings", badge: "Share" },
          { title: "运行链路", note: "Generate -> Build -> Preview -> Deploy 的状态可追踪", href: "/runs", badge: "Runtime" },
          { title: "模板与升级", note: "Templates + Pricing 一起决定生成结果深度", href: "/templates", badge: "Growth" },
        ]
      : [
          { title: "Workspace entry", note: "Open the linked Preview / Dashboard / Code workspace", href: "/editor", badge: "Open editor" },
          { title: "Access and sharing", note: "Share links, visibility, invites, and public demo controls", href: "/settings", badge: "Share" },
          { title: "Runtime chain", note: "Track Generate -> Build -> Preview -> Deploy in one place", href: "/runs", badge: "Runtime" },
          { title: "Templates and plans", note: "Templates plus pricing determine the product depth", href: "/templates", badge: "Growth" },
        ],
    null,
    2
  )} as const;
  const workspaceModules = ${JSON.stringify(
    isCn
      ? [
          { label: "产品类型", value: "AI 代码编辑平台" },
          { label: "目标市场", value: "中国团队 / 中文工作流 / 项目交付" },
          { label: "已生成页面", value: generatedRouteSummary },
          { label: "AI 工具", value: "explain / fix / generate / refactor" },
          { label: "当前路径", value: (spec.region === "cn" ? "国内" : "国际") + " · " + spec.deploymentTarget + " · " + spec.databaseTarget },
          { label: "最近修改", value: spec.modules.slice(0, 3).join(" / ") },
        ]
      : [
          { label: "Product type", value: "AI coding platform" },
          { label: "Target market", value: "China-ready teams / localized workflow / delivery" },
          { label: "Generated pages", value: generatedRouteSummary },
          { label: "AI tools", value: "explain / fix / generate / refactor" },
          { label: "Current path", value: (spec.region === "cn" ? "China" : "Global") + " · " + spec.deploymentTarget + " · " + spec.databaseTarget },
          { label: "Latest change", value: spec.modules.slice(0, 3).join(" / ") },
        ],
    null,
    2
  )} as const;
  const activity = ${JSON.stringify(activity, null, 2)} as const;
  const managementCards = ${JSON.stringify(managementCards, null, 2)} as const;
  const [workspaceConfig, setWorkspaceConfig] = useState({
    deploymentTarget: isCn ? "cloudbase" : "vercel",
    databaseTarget: isCn ? "cloudbase-doc" : "supabase-postgres",
    visibility: "team",
    loginPolicy: "hybrid",
    publishChannel: "preview",
  });
  const [activeSidebar, setActiveSidebar] = useState(items[0]);
  const [selectedActivity, setSelectedActivity] = useState(activity[0]?.title ?? "");
  const [activeElementName, setActiveElementName] = useState("");
  const [workspaceSession, setWorkspaceSession] = useState({
    selectedTemplateName: isCn ? "官网与下载站" : "Website + downloads",
    selectedPlanName: defaultPlanName,
    routeLabel: isCn ? "控制台总览" : "Dashboard overview",
    filePath: "app/dashboard/page.tsx",
    lastAction: isCn ? "查看控制台总览" : "Viewing dashboard overview",
    lastChangedAt: isCn ? "未写入" : "No draft yet",
    lastChangedFile: "app/dashboard/page.tsx",
    readiness: "overview",
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setWorkspaceConfig((current) => ({ ...current, ...parsed }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      setWorkspaceSession((current) => ({
        ...current,
        ...parsed,
        selectedPlanName: parsed.selectedPlanName ?? parsed.planName ?? current.selectedPlanName,
      }));
      if (typeof parsed.dashboardFocus === "string") setActiveSidebar(parsed.dashboardFocus);
      if (typeof parsed.dashboardActivity === "string") setSelectedActivity(parsed.dashboardActivity);
      if (typeof parsed.elementName === "string") setActiveElementName(parsed.elementName);
    } catch {}
  }, []);

  const activeControlCard = useMemo(() => {
    const controlIndex = sidebarControlIndex[activeSidebar] ?? 0;
    return controlCards[controlIndex] ?? controlCards[0];
  }, [activeSidebar, controlCards, sidebarControlIndex]);

  const activeLog = useMemo(() => {
    return activity.find((item) => item.title === selectedActivity) ?? activity[0];
  }, [selectedActivity]);

  const linkedRoute = useMemo(() => {
    return routeManifest.find((item) => item.id === (workspaceSession.routeId ?? "")) ?? routeManifest.find((item) => item.id === "dashboard") ?? routeManifest[0];
  }, [routeManifest, workspaceSession.routeId]);

  const dashboardElements =
    elementCatalog.find((item) => item.routeId === "dashboard")?.elements ??
    (isCn ? ["控制台头部", "指标矩阵", "访问策略卡"] : ["Control-plane header", "Metric matrix", "Access policy card"]);

  const activeElement =
    dashboardElements.find((item) => item === activeElementName) ??
    dashboardElements[0] ??
    (isCn ? "控制台头部" : "Control-plane header");

  const workspaceContext = [
    { label: isCn ? "当前模板" : "Current template", value: workspaceSession.selectedTemplateName },
    { label: isCn ? "当前套餐" : "Current plan", value: workspaceSession.selectedPlanName || defaultPlanName },
    { label: isCn ? "联动页面" : "Linked page", value: linkedRoute?.label ?? workspaceSession.routeLabel },
    { label: isCn ? "最近写入文件" : "Last changed file", value: workspaceSession.lastChangedFile || workspaceSession.filePath },
    { label: isCn ? "最近动作" : "Last action", value: workspaceSession.lastAction },
    { label: isCn ? "最近写入" : "Last write", value: workspaceSession.lastChangedAt },
  ];
  const workspaceSurfaceLinks = [
    { href: "/", label: isCn ? "预览" : "Preview" },
    { href: "/dashboard", label: "Dashboard", active: true },
    { href: "/editor", label: "Code" },
  ] as const;
  const workspacePanelLinks = [
    { href: "/runs", label: isCn ? "运行" : "Runs" },
    { href: "/templates", label: isCn ? "模板库" : "Templates" },
    { href: "/settings", label: isCn ? "设置" : "Settings" },
    { href: "/pricing", label: isCn ? "升级" : "Upgrade" },
    ...(${spec.planTier === "elite" ? "true" : "false"} ? [{ href: "/reports", label: isCn ? "汇报" : "Reports" }, { href: "/team", label: isCn ? "团队" : "Team" }] : []),
  ] as const;

  useEffect(() => {
    if (!activeElementName) setActiveElementName(dashboardElements[0] ?? "");
  }, [activeElementName, dashboardElements]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...workspaceSession,
          selectedPlanName: workspaceSession.selectedPlanName || defaultPlanName,
          routeId: "dashboard",
          routeLabel: isCn ? "控制台总览" : "Dashboard overview",
          filePath: "app/dashboard/page.tsx",
          dashboardFocus: activeSidebar,
          dashboardActivity: activeLog?.title ?? selectedActivity,
          elementName: activeElement,
          lastChangedFile: workspaceSession.lastChangedFile || "app/dashboard/page.tsx",
          readiness: workspaceSession.readiness || "overview",
        })
      );
    } catch {}
  }, [SESSION_KEY, activeElement, activeLog?.title, activeSidebar, defaultPlanName, isCn, selectedActivity, workspaceSession]);

  const handleSidebarSelect = (item) => {
    setActiveSidebar(item);
    setWorkspaceSession((current) => ({
      ...current,
      lastAction: (isCn ? "控制台焦点切到 " : "Console focus moved to ") + item,
    }));
  };

  const handleActivitySelect = (title) => {
    setSelectedActivity(title);
    setWorkspaceSession((current) => ({
      ...current,
      lastAction: (isCn ? "查看创作记录 " : "Opened creation log ") + title,
    }));
  };

  const handleElementSelect = (element) => {
    setActiveElementName(element);
    setWorkspaceSession((current) => ({
      ...current,
      lastAction: (isCn ? "聚焦控制元素 " : "Focused control element ") + element,
    }));
  };

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#11131a 0%,#171923 100%)", color: "#f8fafc", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gap: 16 }}>
        <section style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.16), transparent 28%), #17181f", padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(124,58,237,0.2)", color: "#d8b4fe", fontSize: 12, fontWeight: 800 }}>
                {isCn ? "控制台工作区" : "Control-plane workspace"}
              </div>
              <h1 style={{ margin: "14px 0 8px", fontSize: 30, fontWeight: 900 }}>
                {isCn ? "先把老板能看到的主工作台做得更像真实产品" : "Make the main workspace feel like a real product before going deeper"}
              </h1>
              <p style={{ margin: 0, maxWidth: 860, color: "rgba(255,255,255,0.56)", lineHeight: 1.8 }}>
                {isCn ? "这一页现在优先承接 Preview / Dashboard / Code 的主工作流，把高频入口放前面，低频控制项压到下面，方便直接上线给老板看。" : "This page now prioritizes the Preview / Dashboard / Code workflow, keeps high-frequency entry points first, and pushes low-frequency controls lower for a cleaner demo-ready surface."}
              </p>
            </div>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 6, borderRadius: 18, background: "#11131a", border: "1px solid rgba(255,255,255,0.08)" }}>
                {workspaceSurfaceLinks.map((item) => (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 16px", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.6)", background: item.active ? "rgba(124,58,237,0.22)" : "transparent", fontSize: 14, fontWeight: 800 }}>
                    {item.label}
                  </Link>
                ))}
              </div>
              <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 12 }}>
                {isCn ? "运行、模板、设置、升级已收进 Overview，避免打散主工作区。" : "Runs, templates, settings, and pricing are moved into Overview to keep the main workspace focused."}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
            {metrics.slice(0, 4).map((item) => (
              <div key={item.label} style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.06)", background: "#1b1c24", padding: 16 }}>
                <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 12 }}>{item.label}</div>
                <div style={{ marginTop: 10, fontSize: 22, fontWeight: 900, color: item.tone }}>{item.value}</div>
                <div style={{ marginTop: 8, color: "rgba(255,255,255,0.42)", fontSize: 12 }}>{item.delta}</div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ borderRadius: 24, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#17181f" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#9333ea)", display: "grid", placeItems: "center", fontSize: 20 }}>✦</div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>{${JSON.stringify(brand)}}</div>
              <div style={{ borderRadius: 10, padding: "6px 10px", background: "rgba(124,58,237,0.2)", color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>{workspaceSession.selectedPlanName || defaultPlanName}</div>
            </div>
            <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>
              {(isCn ? "当前联动页面: " : "Linked page: ") + (linkedRoute?.label ?? workspaceSession.routeLabel)}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "40px 320px minmax(0,1fr)", minHeight: "calc(100vh - 150px)" }}>
            <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "#14151c", padding: "12px 0", display: "grid", alignContent: "start", gap: 10 }}>
              {[
                { label: items[0], icon: "◎" },
                { label: items[1], icon: "◪" },
                { label: items[2], icon: "▦" },
                { label: items[items.length - 1], icon: "⚙" },
              ].map((item) => (
                <button key={item.label} type="button" title={item.label} onClick={() => handleSidebarSelect(item.label)} style={{ width: 28, height: 28, borderRadius: 9, border: "none", background: activeSidebar === item.label ? "rgba(124,58,237,0.22)" : "transparent", color: activeSidebar === item.label ? "#c4b5fd" : "rgba(255,255,255,0.42)", margin: "0 auto", display: "grid", placeItems: "center", fontSize: 13, cursor: "pointer" }}>
                  {item.icon}
                </button>
              ))}
            </div>

            <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "#17181f", padding: 14, display: "grid", alignContent: "start", gap: 14, maxHeight: "calc(100vh - 150px)", overflowY: "auto" }}>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "AI 助手" : "AI Assistant"}</div>
                <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900 }}>{isCn ? "左侧共创对话" : "Left copilot thread"}</div>
              </div>

              <div style={{ borderRadius: 18, background: "#1f212c", padding: 16 }}>
                <div style={{ color: "#a78bfa", fontWeight: 800, marginBottom: 10 }}>{isCn ? "当前对话主题" : "Current thread"}</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    isCn ? "先把 Preview / Dashboard / Code 这条主工作流做顺。" : "Keep the Preview / Dashboard / Code flow clean and obvious first.",
                    isCn ? "高频入口放前面，低频功能沉到底部。" : "Keep high-frequency entry points up front and low-frequency controls lower.",
                    isCn ? "这一页优先给老板看产品感，不先讨论底层架构。" : "This surface is optimized for stakeholder review before deeper architecture work.",
                  ].map((item, index) => (
                    <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 1.7 }}>
                      {item}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href="/editor" style={{ textDecoration: "none", borderRadius: 10, background: "#8b5cf6", color: "#fff", padding: "10px 12px", fontWeight: 700, fontSize: 12 }}>
                    {isCn ? "打开 Code" : "Open Code"}
                  </Link>
                  <Link href="/runs" style={{ textDecoration: "none", borderRadius: 10, background: "#232533", color: "#f8fafc", padding: "10px 12px", fontWeight: 700, fontSize: 12 }}>
                    {isCn ? "打开运行" : "Open runs"}
                  </Link>
                </div>
              </div>

              <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "当前工作区联动" : "Current workspace linkage"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {workspaceContext.map((item) => (
                    <div key={item.label} style={{ borderRadius: 12, background: "#232533", padding: "12px 14px" }}>
                      <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{item.label}</div>
                      <div style={{ marginTop: 8, fontWeight: 800, lineHeight: 1.7 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "最近创作记录" : "Recent creation log"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {activity.slice(0, 4).map((item, index) => (
                    <button key={item.title} type="button" onClick={() => handleActivitySelect(item.title)} style={{ borderRadius: 12, border: "none", cursor: "pointer", padding: "10px 12px", background: activeLog.title === item.title || index === 0 ? "rgba(124,58,237,0.18)" : "#232533", textAlign: "left" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 700, color: "#f8fafc" }}>{item.title}</div>
                        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{item.status}</div>
                      </div>
                      <div style={{ marginTop: 6, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{item.meta}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", minHeight: 0 }}>
              <div style={{ padding: 16, display: "grid", alignContent: "start", gap: 16, maxHeight: "calc(100vh - 150px)", overflowY: "auto", background: "#14151b" }}>
                <section style={{ borderRadius: 22, border: "1px solid rgba(124,58,237,0.18)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.16), transparent 32%), #1b1827", padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#d8b4fe", fontWeight: 800 }}>{isCn ? "Dashboard" : "Dashboard"}</div>
                      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{isCn ? "把工作台首页收成更清晰的控制面" : "Turn the workspace home into a cleaner control surface"}</div>
                    </div>
                    <Link href="/editor" style={{ textDecoration: "none", borderRadius: 12, background: "#8b5cf6", color: "#fff", padding: "10px 14px", fontWeight: 800 }}>
                      {isCn ? "进入 Code" : "Open Code"}
                    </Link>
                  </div>
                </section>

                <section style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 16 }}>
                  <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "主工作区入口" : "Primary workspace entry"}</div>
                    <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                      {controlCards.map((item, index) => (
                        <Link key={item.title} href={item.href} style={{ textDecoration: "none", borderRadius: 16, padding: "14px 16px", background: activeControlCard.title === item.title || index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: "#f8fafc", display: "block" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                            <div style={{ fontWeight: 800 }}>{item.title}</div>
                            <div style={{ borderRadius: 999, padding: "4px 10px", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)", fontSize: 11 }}>{item.badge}</div>
                          </div>
                          <div style={{ marginTop: 6, color: "rgba(255,255,255,0.54)", fontSize: 13, lineHeight: 1.7 }}>{item.note}</div>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "当前控制焦点" : "Current control focus"}</div>
                    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                      {[
                        { label: isCn ? "当前侧栏" : "Sidebar focus", value: activeSidebar },
                        { label: isCn ? "当前动作" : "Primary action", value: activeControlCard.title },
                        { label: isCn ? "联动页面" : "Linked route", value: linkedRoute?.label ?? workspaceSession.routeLabel },
                        { label: isCn ? "当前元素" : "Active element", value: activeElement },
                      ].map((item) => (
                        <div key={item.label} style={{ borderRadius: 12, background: "#232533", padding: "12px 14px" }}>
                          <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{item.label}</div>
                          <div style={{ marginTop: 8, fontWeight: 800, lineHeight: 1.7 }}>{item.value}</div>
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {dashboardElements.map((item) => (
                          <button key={item} type="button" onClick={() => handleElementSelect(item)} style={{ borderRadius: 999, border: "none", cursor: "pointer", padding: "6px 10px", background: item === activeElement ? "rgba(124,58,237,0.18)" : "#232533", color: item === activeElement ? "#e9d5ff" : "rgba(255,255,255,0.68)", fontSize: 11, fontWeight: 700 }}>
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
                  <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "项目概览" : "Project overview"}</div>
                    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
                      {workspaceModules.map((item) => (
                        <div key={item.label} style={{ borderRadius: 14, background: "#232533", padding: "12px 14px" }}>
                          <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{item.label}</div>
                          <div style={{ marginTop: 8, fontWeight: 800, lineHeight: 1.7 }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "当前环境策略" : "Current environment profile"}</div>
                    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                      {[
                        { label: isCn ? "部署目标" : "Deployment", value: workspaceConfig.deploymentTarget },
                        { label: isCn ? "数据库" : "Database", value: workspaceConfig.databaseTarget },
                        { label: isCn ? "可见性" : "Visibility", value: workspaceConfig.visibility },
                        { label: isCn ? "发布通道" : "Publish lane", value: workspaceConfig.publishChannel },
                        { label: isCn ? "登录策略" : "Login policy", value: workspaceConfig.loginPolicy },
                      ].map((item) => (
                        <div key={item.label} style={{ borderRadius: 14, background: "#232533", padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{item.label}</div>
                          <div style={{ fontWeight: 800 }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>

              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#11131a", padding: 16, display: "grid", alignContent: "start", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "Overview 总览" : "Overview"}</div>
                    <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: "#f8fafc" }}>
                      {isCn ? "Preview、Dashboard 与 Code 保持一条清晰主线" : "Preview, Dashboard, and Code stay on one clear thread"}
                    </div>
                  </div>
                  <Link href="/dashboard" style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: "rgba(124,58,237,0.18)", color: "#e9d5ff", fontWeight: 800, fontSize: 12 }}>
                    Dashboard
                  </Link>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {workspaceSurfaceLinks.map((item) => (
                    <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "rgba(124,58,237,0.22)" : "#1b1c24", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: 700 }}>
                      {item.label}
                    </Link>
                  ))}
                </div>

                <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                  <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "工作区面板" : "Workspace panels"}</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {workspacePanelLinks.map((item) => (
                      <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: "#232533", color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 700 }}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                  <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "当前工作区焦点" : "Current workspace focus"}</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {workspaceContext.slice(0, 4).map((item) => (
                      <div key={item.label} style={{ borderRadius: 10, background: "#232533", padding: "8px 10px" }}>
                        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{item.label}</div>
                        <div style={{ marginTop: 4, color: "rgba(255,255,255,0.72)", fontSize: 12, lineHeight: 1.7 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 14, background: "rgba(124,58,237,0.14)", border: "1px solid rgba(124,58,237,0.22)", padding: 14 }}>
                  <div style={{ color: "#c4b5fd", fontWeight: 800, fontSize: 12 }}>{isCn ? "老板会先看到什么" : "What stakeholders see first"}</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {[
                      isCn ? "1. 顶部 Preview / Dashboard / Code 主入口" : "1. Top-level Preview / Dashboard / Code entry",
                      isCn ? "2. 左侧 AI 共创区与中间主工作区" : "2. Left AI panel with the main workspace to the right",
                      isCn ? "3. 低频功能和后续项已经下沉到底部" : "3. Lower-priority and later features have been pushed down",
                    ].map((item, index) => (
                      <div key={item} style={{ borderRadius: 10, background: index === 0 ? "rgba(124,58,237,0.14)" : "#232533", padding: "8px 10px", color: "rgba(255,255,255,0.74)", fontSize: 12, lineHeight: 1.7 }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 4, paddingTop: 12, display: "grid", gap: 12 }}>
                  <div style={{ color: "rgba(255,255,255,0.34)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    {isCn ? "后续再看" : "Later"}
                  </div>
                  <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                    <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "更多控制项" : "More controls"}</div>
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {items.slice(4).map((item) => (
                        <button key={item} type="button" onClick={() => handleSidebarSelect(item)} style={{ borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left", background: activeSidebar === item ? "rgba(124,58,237,0.18)" : "#232533", padding: "8px 10px", color: activeSidebar === item ? "#e9d5ff" : "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: 700 }}>
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                    <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "管理面板" : "Management panel"}</div>
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {managementCards.map((item, index) => (
                        <div key={item.title} style={{ borderRadius: 10, padding: "8px 10px", background: index === 0 ? "rgba(124,58,237,0.14)" : "#232533", color: "rgba(255,255,255,0.74)", fontSize: 12, lineHeight: 1.7 }}>
                          <div style={{ fontWeight: 800 }}>{item.title}</div>
                          <div style={{ marginTop: 4 }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
`
  }
  const archetypeDashboard = renderArchetypeConsolePage(spec, "dashboard")
  if (archetypeDashboard) {
    return archetypeDashboard
  }
  const skin = getTemplateSkin(spec)
  const dashboardBadge = spec.templateId ?? spec.kind
  const isCodePlatform = false
  const tierLabel =
    spec.region === "cn"
      ? spec.planTier === "elite"
        ? "精英生成等级"
        : spec.planTier === "pro"
          ? "专业生成等级"
          : spec.planTier === "builder"
            ? "建造者生成等级"
            : spec.planTier === "starter"
              ? "启动生成等级"
              : "免费生成等级"
      : spec.planTier === "elite"
        ? "Elite generation tier"
        : spec.planTier === "pro"
          ? "Pro generation tier"
          : spec.planTier === "builder"
            ? "Builder generation tier"
            : spec.planTier === "starter"
              ? "Starter generation tier"
              : "Free generation tier"
  const tierHighlights =
    spec.planTier === "elite"
      ? spec.region === "cn"
        ? ["多页面结构", "更强视觉统一", "更深模块层次"]
        : ["Multi-page structure", "Stronger visual consistency", "Deeper module hierarchy"]
      : spec.planTier === "pro"
        ? spec.region === "cn"
          ? ["分析页", "导出能力", "更完整业务模块"]
          : ["Analytics page", "Export flow", "Richer business modules"]
        : spec.planTier === "builder"
          ? spec.region === "cn"
            ? ["双视图", "增强筛选", "统计卡片"]
            : ["Dual views", "Enhanced filters", "Metric cards"]
          : spec.region === "cn"
            ? ["基础首版", "快速录入", "可继续迭代"]
            : ["Baseline first version", "Quick create", "Ready to iterate"]
  return `// @ts-nocheck
import Link from "next/link";

export default function DashboardPage() {
  const spec = ${JSON.stringify(spec, null, 2)} as const;
  const skin = ${JSON.stringify(skin, null, 2)} as const;
  const isCn = spec.region === "cn";

  return (
    <main style={{ minHeight: "100vh", padding: 28, fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", background: skin.pageBackground, color: skin.textPrimary }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, border: skin.cardBorder, padding: 24, background: skin.panelBackground }}>
          <div style={{ fontSize: 12, color: skin.textSecondary, letterSpacing: "0.18em", textTransform: "uppercase" }}>
            ${dashboardBadge}
          </div>
          <h1 style={{ margin: "12px 0 8px", fontSize: 36 }}>{spec.title}</h1>
          <p style={{ margin: 0, color: skin.textSecondary, lineHeight: 1.7 }}>
            {isCodePlatform
              ? isCn
                ? "这是生成代码平台的总览页，你可以从这里进入编辑器、运行面板、模板库和分析页。"
                : "This is the generated coding-platform overview. From here you can open the editor, runtime panel, template gallery, and analytics."
              : isCn
                ? "这是生成项目的总览页，你可以从这里进入任务工作台、分析页和关于页。"
                : "This is the generated project overview page. From here you can enter the task workspace, analytics, and about pages."}
          </p>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            <div style={{ borderRadius: 18, border: skin.cardBorder, background: skin.cardBackground, padding: 16 }}>
              <div style={{ fontSize: 12, color: skin.textSecondary }}>${tierLabel}</div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 700 }}>{spec.planTier}</div>
            </div>
            ${tierHighlights
              .map(
                (item) => `<div style={{ borderRadius: 18, border: skin.cardBorder, background: skin.cardBackground, padding: 16 }}>
              <div style={{ fontSize: 12, color: skin.textSecondary }}>${spec.region === "cn" ? "交付重点" : "Delivery focus"}</div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>${item}</div>
            </div>`
              )
              .join("")}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
            ${isCodePlatform
              ? `<Link href="/" style={{ borderRadius: "999px", padding: "10px 14px", background: skin.accentStrong, color: "#ffffff", textDecoration: "none" }}>
              {isCn ? "打开代码工作台" : "Open coding workspace"}
            </Link>
            <Link href="/editor" style={{ borderRadius: "999px", padding: "10px 14px", border: skin.cardBorder, color: skin.textPrimary, textDecoration: "none" }}>
              {isCn ? "编辑器页面" : "Editor page"}
            </Link>
            <Link href="/runs" style={{ borderRadius: "999px", padding: "10px 14px", border: skin.cardBorder, color: skin.textPrimary, textDecoration: "none" }}>
              {isCn ? "运行面板" : "Run panel"}
            </Link>
            <Link href="/templates" style={{ borderRadius: "999px", padding: "10px 14px", border: skin.cardBorder, color: skin.textPrimary, textDecoration: "none" }}>
              {isCn ? "模板库" : "Template gallery"}
            </Link>`
              : `<Link href="/" style={{ borderRadius: "999px", padding: "10px 14px", background: skin.accentStrong, color: "#ffffff", textDecoration: "none" }}>
              {isCn ? "打开主工作台" : "Open workspace"}
            </Link>
            <Link href="/tasks" style={{ borderRadius: "999px", padding: "10px 14px", border: skin.cardBorder, color: skin.textPrimary, textDecoration: "none" }}>
              {isCn ? "任务页面" : "Tasks page"}
            </Link>`}
            ${
              hasFeature(spec, "analytics_page")
                ? ` <Link href="/analytics" style={{ borderRadius: "999px", padding: "10px 14px", border: skin.cardBorder, color: skin.textPrimary, textDecoration: "none" }}>
              {isCn ? "分析页面" : "Analytics page"}
            </Link>`
                : ""
            }
            ${
              spec.planTier === "elite"
                ? ` <Link href="/reports" style={{ borderRadius: "999px", padding: "10px 14px", border: skin.cardBorder, color: skin.textPrimary, textDecoration: "none" }}>
              {isCn ? "汇报中心" : "Reports hub"}
            </Link>
            <Link href="/team" style={{ borderRadius: "999px", padding: "10px 14px", border: skin.cardBorder, color: skin.textPrimary, textDecoration: "none" }}>
              {isCn ? "团队协作" : "Team panel"}
            </Link>`
                : ""
            }
          </div>
        </section>
      </div>
    </main>
  );
}
`
}

function renderCodeEditorPage(spec: AppSpec, iterationContext?: SpecIterationContext) {
  const isCn = spec.region === "cn"
  const brand = spec.title
  const fileGroups = buildCodePlatformEditorFileGroups(spec)
  const templateTracks = buildCodePlatformTemplateSeeds(spec)
  const routeSeeds = buildCodePlatformRoutes(spec)
  const planLabel = getCodePlatformPlanLabel(spec.planTier, spec.region)
  const elementSeeds = buildCodePlatformElementSeeds(spec)
  const iterationSeed = buildCodePlatformIterationSeed(spec, fileGroups, routeSeeds, templateTracks, iterationContext)
  return `// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function EditorPage() {
  const isCn = ${isCn ? "true" : "false"};
  const STORAGE_KEY = "mornstack-generated-workspace-config";
  const SESSION_KEY = "mornstack-generated-workspace-session";
  const DRAFT_STORAGE_KEY = "mornstack-generated-workspace-drafts";
  const defaultPlanName = ${JSON.stringify(planLabel)};
  type WorkbenchFile = {
    id: string;
    name: string;
    fullPath: string;
    symbols: readonly string[];
    body: string;
  };
  type WorkbenchGroup = {
    id: string;
    name: string;
    files: WorkbenchFile[];
  };
  const fileGroups: WorkbenchGroup[] = ${JSON.stringify(fileGroups, null, 2)} as WorkbenchGroup[];

  const aiModes = [
    isCn ? "解释" : "Explain",
    isCn ? "修复" : "Fix",
    isCn ? "生成" : "Generate",
    isCn ? "重构" : "Refactor",
  ] as const;
  const activityBarItems = isCn
    ? [
        { icon: "📄", label: "资源管理器" },
        { icon: "⌕", label: "全局搜索" },
        { icon: "⑂", label: "Git 变更" },
        { icon: "▶", label: "运行与调试" },
        { icon: "✦", label: "AI 助手" },
        { icon: "⚙", label: "工作区设置" },
      ]
    : [
        { icon: "📄", label: "Explorer" },
        { icon: "⌕", label: "Global search" },
        { icon: "⑂", label: "Git changes" },
        { icon: "▶", label: "Run and debug" },
        { icon: "✦", label: "AI assistant" },
        { icon: "⚙", label: "Workspace settings" },
      ];

  const templates = ${JSON.stringify(templateTracks, null, 2)} as Array<{
    id: string;
    name: string;
    summary: string;
    focus: string;
    tags: string[];
    badge: string;
    color: string;
  }>;
  const elementCatalog = ${JSON.stringify(elementSeeds, null, 2)} as Array<{
    routeId: string;
    elements: string[];
  }>;
  const workspaceRail = isCn
    ? [
        { title: "活动栏", value: "Explorer / Search / Git / Run / AI / Settings" },
        { title: "文件结构", value: fileGroups.map((group) => group.name).join(" / ") },
        { title: "运行状态", value: "dev server / preview / terminal output / build acceptance" },
      ]
    : [
        { title: "Activity bar", value: "Explorer / Search / Git / Run / AI / Settings" },
        { title: "File structure", value: fileGroups.map((group) => group.name).join(" / ") },
        { title: "Runtime state", value: "dev server / preview / terminal output / build acceptance" },
      ];
  const assistantActions = isCn
    ? [
        { mode: aiModes[0], title: "Explain 当前文件", note: "解释职责、依赖边界和可拆分模块" },
        { mode: aiModes[1], title: "Fix 当前报错", note: "优先处理 preview guard、lint、类型问题" },
        { mode: aiModes[2], title: "Generate 新能力", note: "补页面、补组件、补交互和数据骨架" },
        { mode: aiModes[3], title: "Refactor 主壳", note: "整理 editor、terminal、assistant 的模块边界" },
      ]
    : [
        { mode: aiModes[0], title: "Explain current file", note: "Describe responsibilities, boundaries, and split points" },
        { mode: aiModes[1], title: "Fix current errors", note: "Prioritize preview guards, lint, and type issues" },
        { mode: aiModes[2], title: "Generate new capability", note: "Add pages, components, interactions, and data rails" },
        { mode: aiModes[3], title: "Refactor the shell", note: "Clean the editor, terminal, and assistant module boundaries" },
      ];
  const assistantHistory = isCn
    ? [
        "用户：把终端区做得更像真实 IDE",
        "AI：已补 Terminal / Problems / Output 三段式切换",
        "用户：把销售后台模板加入同一工作区",
        "AI：已同步模板轨道与当前文件焦点",
      ]
    : [
        "User: Make the terminal feel more like a real IDE",
        "AI: Added Terminal / Problems / Output switching",
        "User: Bring the sales admin template into the same workspace",
        "AI: Synced template rails with the current file focus",
      ];

  const quickCommands = isCn
    ? [
        { id: "open-editor", label: "> 打开 editor/page.tsx", desc: "切到主工作区入口", type: "file", target: "editor" },
        { id: "open-runs", label: "> 打开 runs/page.tsx", desc: "查看构建、预览和部署日志", type: "file", target: "runs" },
        { id: "open-settings", label: "> 打开 settings/page.tsx", desc: "切换部署、数据库与权限策略", type: "file", target: "settings" },
        { id: "search-symbols", label: "> 搜索符号 WorkspaceShell", desc: "定位编辑器主壳组件", type: "symbol", target: "workspace-shell" },
        { id: "run-preview", label: "> 启动预览链路", desc: "触发生成后的预览和热更新", type: "run", target: "preview" },
      ]
    : [
        { id: "open-editor", label: "> Open editor/page.tsx", desc: "Jump to the main workbench entry", type: "file", target: "editor" },
        { id: "open-runs", label: "> Open runs/page.tsx", desc: "Inspect build, preview, and deploy logs", type: "file", target: "runs" },
        { id: "open-settings", label: "> Open settings/page.tsx", desc: "Switch deployment, database, and access policies", type: "file", target: "settings" },
        { id: "search-symbols", label: "> Search symbol WorkspaceShell", desc: "Locate the main editor-shell component", type: "symbol", target: "workspace-shell" },
        { id: "run-preview", label: "> Start preview flow", desc: "Trigger generated preview and hot reload", type: "run", target: "preview" },
      ];

  const routeManifest = ${JSON.stringify(routeSeeds.map((route) => ({
    id: route.id,
    href: route.href,
    filePath: route.filePath,
    label: isCn ? route.labelCn : route.labelEn,
    focus: isCn ? route.focusCn : route.focusEn,
  })), null, 2)} as Array<{ id: string; href: string; filePath: string; label: string; focus: string }>;
  const iterationSeed = ${JSON.stringify(iterationSeed, null, 2)} as const;
  const allFiles = fileGroups.flatMap((group) => group.files);
  const initialTargetFile = allFiles.find((file) => file.id === iterationSeed.fileId) ?? allFiles[0];
  const initialTemplate = templates.find((item) => item.name === iterationSeed.selectedTemplateName) ?? templates[0];
  const initialMode =
    iterationSeed.mode === "explain"
      ? aiModes[0]
      : iterationSeed.mode === "fix"
        ? aiModes[1]
        : iterationSeed.mode === "refactor"
          ? aiModes[3]
          : aiModes[2];
  const [selectedFile, setSelectedFile] = useState(initialTargetFile.id);
  const [openTabs, setOpenTabs] = useState(
    iterationSeed.openTabIds.length ? iterationSeed.openTabIds : allFiles.slice(0, 3).map((file) => file.id)
  );
  const [activeMode, setActiveMode] = useState<typeof aiModes[number]>(initialMode);
  const [activeRail, setActiveRail] = useState(activityBarItems[0].label);
  const [commandQuery, setCommandQuery] = useState("");
  const [terminalTab, setTerminalTab] = useState<"terminal" | "problems" | "output">("terminal");
  const [runtimeState, setRuntimeState] = useState<"idle" | "running" | "failed" | "ready">("ready");
  const [codeAiRunCount, setCodeAiRunCount] = useState(iterationSeed.mode === "generate" ? 2 : 1);
  const [activeTemplate, setActiveTemplate] = useState(initialTemplate);
  const [activeRouteId, setActiveRouteId] = useState(iterationSeed.routeId || (routeManifest[0]?.id ?? "dashboard"));
  const [activeSymbolName, setActiveSymbolName] = useState(iterationSeed.symbolName);
  const [activeElementName, setActiveElementName] = useState(iterationSeed.elementName);
  const [aiInput, setAiInput] = useState(iterationSeed.aiPrompt);
  const [saveNote, setSaveNote] = useState(isCn ? "未保存变更" : "Unsaved changes");
  const [assistantTrail, setAssistantTrail] = useState(assistantHistory);
  const [previewRailNotes, setPreviewRailNotes] = useState(() => [
    (isCn ? "当前页面: " : "Current page: ") + iterationSeed.routeLabel,
    (isCn ? "当前文件: " : "Current file: ") + iterationSeed.filePath,
    (isCn ? "当前模块: " : "Current module: ") + iterationSeed.symbolName,
    (isCn ? "当前元素: " : "Current element: ") + iterationSeed.elementName,
  ]);
  const [expandedGroups, setExpandedGroups] = useState(() =>
    Object.fromEntries(fileGroups.map((group) => [group.id, true]))
  );
  const [workspaceConfig, setWorkspaceConfig] = useState({
    deploymentTarget: isCn ? "cloudbase" : "vercel",
    databaseTarget: isCn ? "cloudbase-doc" : "supabase-postgres",
    visibility: "team",
    publishChannel: "preview",
  });
  const [workspaceSession, setWorkspaceSession] = useState({
    selectedTemplateId: initialTemplate?.id ?? templates[0]?.id ?? "",
    selectedTemplateName: initialTemplate?.name ?? templates[0]?.name ?? "",
    selectedPlanName: defaultPlanName,
    lastAction: (isCn ? "继续从 AI 上下文切入 " : "Continue from AI context: ") + iterationSeed.sessionNote,
    lastIntent: iterationSeed.aiPrompt,
    lastChangedFile: initialTargetFile?.fullPath ?? allFiles[0]?.fullPath ?? "",
    lastChangedAt: isCn ? "刚刚" : "just now",
    readiness: "context_ready",
    routeId: iterationSeed.routeId || (routeManifest[0]?.id ?? "editor"),
    routeLabel: iterationSeed.routeLabel || (routeManifest[0]?.label ?? ""),
    fileId: initialTargetFile?.id ?? allFiles[0]?.id ?? "",
    filePath: initialTargetFile?.fullPath ?? allFiles[0]?.fullPath ?? "",
    symbolName: iterationSeed.symbolName,
    elementName: iterationSeed.elementName,
  });
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(allFiles.map((file) => [file.id, file.body.replace(/morncursor/g, ${JSON.stringify(brand)})]))
  );
  const formatSessionTime = () => {
    const now = new Date();
    return isCn
      ? now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      : now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };
  const updateWorkspaceSession = (patch) => {
    setWorkspaceSession((current) => ({ ...current, ...patch }));
  };

  const currentFile = allFiles.find((file) => file.id === selectedFile) ?? allFiles[0];
  const currentDraft = drafts[currentFile.id] ?? "";
  const currentSnippet = currentDraft.split("\\n").slice(0, 8).join("\\n");
  const dirtyFileIds = allFiles
    .filter((file) => drafts[file.id] !== file.body.replace(/morncursor/g, ${JSON.stringify(brand)}))
    .map((file) => file.id);
  const currentSymbols = currentFile.symbols.slice(0, 4);

  const visibleGroups = fileGroups
    .map((group) => ({
      ...group,
      files: group.files.filter((file) => {
        if (!commandQuery.trim()) return true;
        const query = commandQuery.trim().toLowerCase();
        return [file.name, file.fullPath, file.body, file.symbols.join(" ")].join(" ").toLowerCase().includes(query);
      }),
    }))
    .filter((group) => group.files.length > 0);

  const activeTabs = openTabs
    .map((id) => allFiles.find((file) => file.id === id))
    .filter(Boolean);
  const currentGroup = fileGroups.find((group) => group.files.some((file) => file.id === selectedFile)) ?? fileGroups[0];
  const activeRoute = useMemo(() => {
    return routeManifest.find((item) => item.id === activeRouteId) ?? routeManifest[0];
  }, [activeRouteId, routeManifest]);
  const routeElements = useMemo(() => {
    return (
      elementCatalog.find((item) => item.routeId === (activeRoute?.id ?? ""))?.elements ??
      (isCn ? ["主容器", "动作条", "状态摘要"] : ["Primary surface", "Action bar", "Status summary"])
    );
  }, [activeRoute?.id, isCn]);
  const routeFocusedFile = useMemo(() => {
    return allFiles.find((file) => file.fullPath === activeRoute?.filePath) ?? currentFile;
  }, [activeRoute, allFiles, currentFile]);
  const aiTargetFile = routeFocusedFile ?? currentFile;
  const aiTargetSymbols = aiTargetFile.symbols.slice(0, 4);
  const activeSymbol =
    aiTargetSymbols.find((symbol) => symbol === activeSymbolName) ??
    aiTargetSymbols[0] ??
    currentSymbols[0] ??
    (isCn ? "主模块" : "Primary module");
  const activeElement =
    routeElements.find((item) => item === activeElementName) ??
    routeElements[0] ??
    (isCn ? "主容器" : "Primary surface");
  const aiContextChips = [
    (isCn ? "页面" : "Page") + ": " + (activeRoute?.label ?? routeManifest[0]?.label ?? ""),
    (isCn ? "文件" : "File") + ": " + aiTargetFile.name,
    (isCn ? "模块" : "Module") + ": " + activeSymbol,
    (isCn ? "元素" : "Element") + ": " + activeElement,
    (isCn ? "模板" : "Template") + ": " + activeTemplate.name,
    (isCn ? "套餐" : "Plan") + ": " + (workspaceSession.selectedPlanName || defaultPlanName),
  ];
  const aiWorkflowStats = [
    {
      label: isCn ? "AI 改动次数" : "AI edits",
      value: String(codeAiRunCount),
      note: isCn ? "已写入当前代码轨道" : "Applied into the current code rail",
    },
    {
      label: isCn ? "目标文件" : "Target file",
      value: aiTargetFile.name,
      note: activeRoute?.label ?? routeManifest[0]?.label ?? "",
    },
    {
      label: isCn ? "运行状态" : "Runtime",
      value:
        runtimeState === "running"
          ? isCn
            ? "运行中"
            : "Running"
          : runtimeState === "failed"
            ? isCn
              ? "失败"
              : "Failed"
            : runtimeState === "idle"
              ? isCn
                ? "空闲"
                : "Idle"
              : isCn
                ? "就绪"
                : "Ready",
      note: isCn ? "AI 改动后会同步刷新终端与预览" : "Terminal and preview update after each AI action",
    },
  ];
  const contextBundle = [
    { label: isCn ? "页面" : "Page", value: activeRoute?.label ?? routeManifest[0]?.label ?? "" },
    { label: isCn ? "文件" : "File", value: aiTargetFile.fullPath },
    { label: isCn ? "模块" : "Module", value: activeSymbol },
    { label: isCn ? "元素" : "Element", value: activeElement },
    { label: isCn ? "模板" : "Template", value: activeTemplate.name },
    { label: isCn ? "套餐" : "Plan", value: workspaceSession.selectedPlanName || defaultPlanName },
    { label: isCn ? "最近写入" : "Last write", value: workspaceSession.lastChangedAt },
  ];
  const changePlan = useMemo(
    () => [
      {
        title: isCn ? "当前作用对象" : "Current target",
        value: (activeRoute?.label ?? routeManifest[0]?.label ?? "") + " / " + activeSymbol + " / " + activeElement,
      },
      {
        title: isCn ? "预览变化" : "Preview effect",
        value: isCn
          ? "预览摘要、运行日志与当前文件草稿会一起刷新"
          : "Preview summary, run logs, and the target draft will refresh together",
      },
      {
        title: isCn ? "交付轨道" : "Delivery rail",
        value:
          activeTemplate.name +
          " · " +
          (workspaceSession.selectedPlanName || defaultPlanName) +
          " · " +
          workspaceConfig.publishChannel,
      },
      {
        title: isCn ? "下一步守卫" : "Next guard",
        value:
          activeMode === aiModes[1]
            ? isCn
              ? "回到 Runs 检查 preview guard、fallback 和错误恢复"
              : "Go back to Runs to verify preview guards, fallback, and recovery"
            : isCn
              ? "保存草稿后继续做 build acceptance 和交付检查"
              : "Save the draft, then continue with build acceptance and delivery checks",
      },
    ],
    [
      activeElement,
      activeMode,
      activeRoute?.label,
      activeSymbol,
      activeTemplate.name,
      aiModes,
      defaultPlanName,
      isCn,
      routeManifest,
      workspaceConfig.publishChannel,
      workspaceSession.selectedPlanName,
    ]
  );
  const promptPresets = isCn
    ? [
        "解释当前页面的数据流和主要职责",
        "修复当前模块的预览与运行问题",
        "为当前页面生成一个更完整的控制面板",
        "重构当前文件，让模块边界更清楚",
      ]
    : [
        "Explain the current page data flow and responsibilities",
        "Fix preview and runtime issues in this module",
        "Generate a richer control panel for this page",
        "Refactor this file into cleaner module boundaries",
      ];

  const commandResults = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    const fileResults = allFiles
      .filter((file) => !query || [file.name, file.fullPath, file.symbols.join(" ")].join(" ").toLowerCase().includes(query))
      .slice(0, 6)
      .map((file) => ({
        id: "file-" + file.id,
        label: file.fullPath,
        desc: file.symbols.join(" · "),
        type: "file",
        target: file.id,
      }));

    const quickResults = quickCommands.filter((item) => !query || [item.label, item.desc].join(" ").toLowerCase().includes(query));
    return [...quickResults, ...fileResults].slice(0, 8);
  }, [commandQuery]);

  useEffect(() => {
    setSaveNote(isCn ? "未保存变更" : "Unsaved changes");
  }, [selectedFile, isCn]);

  useEffect(() => {
    setActiveSymbolName((current) => (current && currentSymbols.includes(current) ? current : currentSymbols[0] ?? ""));
  }, [currentFile.id, currentSymbols]);

  useEffect(() => {
    setActiveElementName((current) => (current && routeElements.includes(current) ? current : routeElements[0] ?? ""));
  }, [activeRoute?.id, routeElements]);

  useEffect(() => {
    setPreviewRailNotes((current) => [
      (isCn ? "当前文件: " : "Current file: ") + currentFile.fullPath,
      (isCn ? "当前 AI 模式: " : "Current AI mode: ") + activeMode,
      (isCn ? "当前模板轨道: " : "Current template rail: ") + activeTemplate.name,
      (isCn ? "当前元素: " : "Current element: ") + activeElement,
      ...current.filter((item, index) => index < 2),
    ].slice(0, 4));
  }, [activeElement, activeMode, activeTemplate.name, currentFile.fullPath, isCn]);

  useEffect(() => {
    const inferredRoute =
      routeManifest.find((item) =>
        item.id === "dashboard"
          ? /dashboard/.test(currentFile.fullPath)
          : currentFile.fullPath.toLowerCase().includes("/" + item.id.toLowerCase())
      ) ?? routeManifest[0];
    if (inferredRoute?.id) setActiveRouteId(inferredRoute.id);
  }, [currentFile.fullPath, routeManifest]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setWorkspaceConfig((current) => ({ ...current, ...parsed }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setDrafts((current) => ({ ...current, ...parsed }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (parsed.selectedTemplateId || parsed.selectedTemplateName) {
          const savedTemplate =
            templates.find((item) => item.id === parsed.selectedTemplateId) ??
            templates.find((item) => item.name === parsed.selectedTemplateName);
          if (savedTemplate) setActiveTemplate(savedTemplate);
        }
        if (parsed.routeId) setActiveRouteId(parsed.routeId);
        if (parsed.fileId) {
          setSelectedFile(parsed.fileId);
          setOpenTabs((current) => (current.includes(parsed.fileId) ? current : [...current, parsed.fileId].slice(-6)));
        }
        if (parsed.symbolName) setActiveSymbolName(parsed.symbolName);
        if (parsed.elementName) setActiveElementName(parsed.elementName);
        setWorkspaceSession((current) => ({
          ...current,
          ...parsed,
          selectedPlanName: parsed.selectedPlanName ?? parsed.planName ?? current.selectedPlanName,
        }));
      }
    } catch {}
  }, [templates]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    } catch {}
  }, [drafts]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...workspaceSession,
          selectedTemplateId: activeTemplate.id,
          selectedTemplateName: activeTemplate.name,
          selectedPlanName: workspaceSession.selectedPlanName || defaultPlanName,
          routeId: activeRoute?.id ?? routeManifest[0]?.id ?? "editor",
          routeLabel: activeRoute?.label ?? routeManifest[0]?.label ?? "",
          fileId: aiTargetFile.id,
          filePath: aiTargetFile.fullPath,
          symbolName: activeSymbol,
          elementName: activeElement,
          publishChannel: workspaceConfig.publishChannel,
          visibility: workspaceConfig.visibility,
        })
      );
    } catch {}
  }, [
    activeElement,
    activeRoute?.id,
    activeRoute?.label,
    activeSymbol,
    activeTemplate.id,
    activeTemplate.name,
    aiTargetFile.fullPath,
    aiTargetFile.id,
    defaultPlanName,
    routeManifest,
    workspaceConfig.publishChannel,
    workspaceConfig.visibility,
    workspaceSession,
  ]);

  const openFile = (id) => {
    setActiveRail(activityBarItems[0].label);
    setSelectedFile(id);
    setOpenTabs((current) => (current.includes(id) ? current : [...current, id].slice(-6)));
    const nextFile = allFiles.find((file) => file.id === id);
    if (nextFile) {
      updateWorkspaceSession({
        lastAction: (isCn ? "切换文件到 " : "Focused file ") + nextFile.fullPath,
        lastChangedFile: nextFile.fullPath,
      });
    }
  };

  const focusRoute = (routeId) => {
    setActiveRouteId(routeId);
    const routeFile = allFiles.find((file) => file.id === routeId);
    if (routeFile) {
      openFile(routeFile.id);
      setActiveSymbolName(routeFile.symbols[0] ?? "");
      updateWorkspaceSession({
        lastAction: (isCn ? "切到页面上下文 " : "Switched route context to ") + (routeManifest.find((item) => item.id === routeId)?.label ?? routeId),
      });
    }
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  };

  const closeFile = (id) => {
    setOpenTabs((current) => {
      const next = current.filter((item) => item !== id);
      if (selectedFile === id) {
        setSelectedFile(next[0] ?? allFiles[0].id);
      }
      return next;
    });
  };

  const runCommand = (command) => {
    if (command.type === "file" || command.type === "symbol") {
      openFile(command.target);
      if (command.type === "symbol") {
        setActiveMode(aiModes[0]);
        const symbolFile = allFiles.find((file) => file.id === command.target);
        setActiveSymbolName(symbolFile?.symbols[0] ?? "WorkspaceShell");
      }
      updateWorkspaceSession({
        lastAction: (isCn ? "执行命令 " : "Ran command ") + command.label,
      });
      return;
    }
    setActiveRail(activityBarItems[3].label);
    setRuntimeState("running");
    setTerminalTab("terminal");
    updateWorkspaceSession({
      lastAction: isCn ? "触发预览运行链路" : "Triggered preview runtime flow",
      readiness: "running",
    });
  };

  const saveCurrentFile = () => {
    setDrafts((current) => ({
      ...current,
      [currentFile.id]: drafts[currentFile.id],
    }));
    setRuntimeState("ready");
    setSaveNote(isCn ? "刚刚已保存到工作区草稿" : "Saved to workspace draft just now");
    updateWorkspaceSession({
      lastAction: isCn ? "保存当前文件草稿" : "Saved current file draft",
      lastIntent: aiInput,
      lastChangedFile: currentFile.fullPath,
      lastChangedAt: formatSessionTime(),
      readiness: "draft_saved",
    });
  };

  const injectTemplate = (template) => {
    setActiveTemplate(template);
    openFile(template.focus);
    setRuntimeState("running");
    setActiveMode(aiModes[2]);
    setDrafts((current) => ({
      ...current,
      [template.focus]:
        current[template.focus] +
        "\\n\\n" +
        (isCn
          ? "// Template sync: 已按「" + template.name + "」方向补齐当前模块骨架"
          : "// Template sync: current module expanded toward the " + template.name + " direction"),
    }));
    setAiInput(
      isCn
        ? "把当前工作区继续朝「" + template.name + "」方向补齐，并保持编辑器主壳不散。"
        : "Push the current workspace toward the " + template.name + " direction without breaking the main editor shell."
    );
    setAssistantTrail((current) => [
      (isCn ? "AI：已切换模板轨道到 " : "AI: switched template rail to ") + template.name,
      ...current,
    ].slice(0, 6));
    updateWorkspaceSession({
      selectedTemplateId: template.id,
      selectedTemplateName: template.name,
      lastAction: (isCn ? "模板轨道切换到 " : "Template rail switched to ") + template.name,
      lastIntent: isCn ? "继续扩展当前模板方向" : "Continue expanding the selected template direction",
      lastChangedFile: allFiles.find((file) => file.id === template.focus)?.fullPath ?? template.focus,
      lastChangedAt: formatSessionTime(),
      readiness: "template_sync",
    });
  };

  const applyAiAction = (mode) => {
    const targetFile = aiTargetFile;
    const targetSymbol = activeSymbol;
    const tag =
      mode === aiModes[0]
        ? isCn
          ? "// Explain: " + (activeRoute?.label ?? "当前页面") + " / " + targetSymbol + " 的职责、边界与后续拆分建议"
          : "// Explain: responsibilities, boundaries, and next split suggestions for " + (activeRoute?.label ?? "current page") + " / " + targetSymbol
        : mode === aiModes[1]
          ? isCn
            ? "// Fix: 已补 " + (activeRoute?.label ?? "当前页面") + " 的运行守卫、错误提示与恢复路径"
            : "// Fix: runtime guards, error handling, and recovery path added for " + (activeRoute?.label ?? "current page")
          : mode === aiModes[2]
            ? isCn
              ? "// Generate: 已为 " + targetSymbol + " 补模块骨架、交互钩子与状态轨道"
              : "// Generate: module scaffold, interaction hooks, and state rails added for " + targetSymbol
            : isCn
              ? "// Refactor: 已整理 " + targetFile.name + " 与 " + targetSymbol + " 的边界"
              : "// Refactor: boundaries reorganized for " + targetFile.name + " / " + targetSymbol;
    const workflowNote =
      mode === aiModes[0]
        ? isCn
          ? "AI 正在解释现有文件结构，方便继续拆分与改写。"
          : "AI is explaining the current file structure so the next change can stay grounded."
        : mode === aiModes[1]
          ? isCn
            ? "AI 已补运行守卫并把修复信息同步到 Problems / Output。"
            : "AI added runtime guards and synced the fix details into Problems / Output."
          : mode === aiModes[2]
            ? isCn
              ? "AI 已把新的交互状态和执行轨道写进目标文件。"
              : "AI wrote new interaction state and execution rails into the target file."
            : isCn
              ? "AI 已整理模块边界，便于继续做生成器演进。"
              : "AI reorganized the module boundaries for the next generator step.";

    setActiveMode(mode);
    setActiveRail(activityBarItems[4].label);
    setRuntimeState(mode === aiModes[1] ? "running" : "ready");
    setTerminalTab(mode === aiModes[1] ? "problems" : "output");
    setCodeAiRunCount((count) => count + 1);
    openFile(targetFile.id);
    setDrafts((current) => ({
      ...current,
      [targetFile.id]: current[targetFile.id].includes(tag)
        ? current[targetFile.id]
        : current[targetFile.id] +
          "\n\n" +
          tag +
          "\n" +
          (isCn
            ? "// Intent: " + aiInput
            : "// Intent: " + aiInput),
    }));
    setSaveNote(isCn ? "AI 已写入目标文件草稿" : "AI wrote changes into the target draft");
    setPreviewRailNotes([
      (isCn ? "页面更新: " : "Updated view: ") + (activeRoute?.label ?? currentFile.name),
      (isCn ? "当前动作: " : "Current action: ") + mode,
      (isCn ? "当前模块: " : "Current module: ") + targetSymbol,
      (isCn ? "模板轨道: " : "Template rail: ") + activeTemplate.name,
    ]);
    setAssistantTrail((current) => [
      (isCn ? "AI：" : "AI: ") + workflowNote,
      (isCn ? "AI：" : "AI: ") + mode + (isCn ? " 已作用到 " : " applied to ") + targetFile.fullPath + " / " + targetSymbol,
      (isCn ? "用户：" : "User: ") + aiInput,
      ...current,
    ].slice(0, 6));
    updateWorkspaceSession({
      selectedTemplateId: activeTemplate.id,
      selectedTemplateName: activeTemplate.name,
      lastAction:
        (isCn ? "AI " : "AI ") +
        mode +
        (isCn ? " 已写入 " : " updated ") +
        targetFile.fullPath +
        " / " +
        targetSymbol,
      lastIntent: aiInput,
      lastChangedFile: targetFile.fullPath,
      lastChangedAt: formatSessionTime(),
      readiness: mode === aiModes[1] ? "running_fix" : "draft_updated",
    });
  };

  const terminalLogs = {
    terminal:
      runtimeState === "failed"
        ? [
            "$ pnpm dev",
            "error  app/editor/page.tsx: preview guard missing",
            isCn ? "建议：补运行状态守卫并清理旧的 dev 锁。" : "Suggestion: add runtime guards and clear stale dev locks.",
            isCn ? "恢复策略：重新启动 preview worker。" : "Recovery strategy: restart the preview worker.",
          ]
        : runtimeState === "running"
          ? [
              "$ pnpm dev",
              "ready - preview worker booting",
              "hmr - syncing " + currentFile.fullPath,
              (isCn ? "模板已切换到 " : "Template switched to ") + activeTemplate.name,
            ]
          : runtimeState === "idle"
            ? [
                isCn ? "等待下一次运行..." : "Waiting for the next run...",
                isCn ? "可以从命令搜索或右侧 AI 直接触发预览。" : "Trigger preview from command search or the AI rail.",
              ]
            : [
                "$ pnpm build",
                "lint  ok",
                "type  ok",
                "preview  ready",
                isCn ? "当前版本可直接用于演示" : "This build is ready for demos",
              ],
    problems:
      runtimeState === "failed"
        ? [
            isCn ? "1 error · preview guard 缺失" : "1 error · preview guard missing",
            isCn ? "2 warnings · tabs 与 explorer 仍需去重" : "2 warnings · tabs and explorer still need dedupe",
          ]
        : [
            isCn ? "0 error · 1 warning" : "0 errors · 1 warning",
            isCn ? "建议继续补全局搜索和运行守卫。" : "Next improvement: global search and runtime guards.",
          ],
    output: [
      activeMode === aiModes[0]
        ? (isCn ? "AI 正在解释当前文件职责、依赖边界和可继续拆分的模块。" : "AI is explaining the current file responsibilities, dependency boundaries, and split points.")
        : activeMode === aiModes[1]
          ? (isCn ? "AI 正在生成修复建议，并同步更新 preview 与终端状态。" : "AI is generating a fix plan and syncing preview and terminal states.")
          : activeMode === aiModes[2]
            ? (isCn ? "AI 正在补齐模板、编辑器行为和运行链路。" : "AI is expanding templates, editor behavior, and runtime flow.")
            : (isCn ? "AI 正在重构主壳，让 activity bar、文件树、编辑区和 AI 栏更像真实 IDE。" : "AI is refactoring the main shell so the activity bar, explorer, editor, and AI rail feel more like a real IDE."),
      isCn ? "模板切换会联动更新文件焦点、终端日志与右侧 AI 建议。" : "Template switches update file focus, terminal logs, and the AI suggestions on the right.",
    ],
  };

  const aiMessages = {
    [aiModes[0]]: isCn
      ? "当前黑色编辑区已经和左侧目录、上方标签、命令结果联动。下一步要继续补真实持久化和更强的命令搜索。"
      : "The black editor surface is now linked to the explorer, top tabs, and command results. Next step: add persistence and stronger command search.",
    [aiModes[1]]: isCn
      ? "优先修复 preview 失败态、锁文件冲突和运行守卫，让生成应用更稳定。"
      : "Prioritize preview failures, lock conflicts, and runtime guards so generated apps become more stable.",
    [aiModes[2]]: isCn
      ? "继续为官网、销售后台、API 平台和社区中心生成不同的工作轨道，同时保住 IDE 主壳。"
      : "Keep generating distinct tracks for website, sales admin, API platform, and community hub while preserving the IDE shell.",
    [aiModes[3]]: isCn
      ? "把 explorer、editor、preview、terminal、assistant 拆成稳定子模块，生成结果会更接近真实产品。"
      : "Split explorer, editor, preview, terminal, and assistant into stable modules to move closer to a real product.",
  };

  const topMetricCards = ${JSON.stringify(
    isCn
      ? [
          { label: "当前分支", value: "main", tone: "#8b5cf6" },
          { label: "运行态", value: "dev + preview", tone: "#22c55e" },
          { label: "AI 队列", value: "3 tasks", tone: "#38bdf8" },
          { label: "热更新", value: "ready", tone: "#f59e0b" },
        ]
      : [
          { label: "Current branch", value: "main", tone: "#8b5cf6" },
          { label: "Runtime", value: "dev + preview", tone: "#22c55e" },
          { label: "AI queue", value: "3 tasks", tone: "#38bdf8" },
          { label: "Hot reload", value: "ready", tone: "#f59e0b" },
        ],
    null,
    2
  )} as const;
  const workspaceSurfaceLinks = [
    { href: "/", label: isCn ? "预览" : "Preview" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/editor", label: "Code", active: true },
  ] as const;
  const workspacePanelLinks = [
    { href: "/runs", label: isCn ? "运行" : "Runs" },
    { href: "/templates", label: isCn ? "模板库" : "Templates" },
    { href: "/settings", label: isCn ? "设置" : "Settings" },
    { href: "/pricing", label: isCn ? "升级" : "Upgrade" },
    ...(${spec.planTier === "elite" ? "true" : "false"}
      ? [
          { href: "/reports", label: isCn ? "汇报" : "Reports" },
          { href: "/team", label: isCn ? "团队" : "Team" },
        ]
      : []),
  ] as const;

  return (
    <main style={{ minHeight: "100vh", background: "#12131a", color: "#f8fafc", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gap: 16 }}>
        <section style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.16), transparent 28%), #17181f", padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(124,58,237,0.2)", color: "#d8b4fe", fontSize: 12, fontWeight: 800 }}>
                {isCn ? "编辑器工作区" : "Editor workspace"}
              </div>
              <h1 style={{ margin: "14px 0 8px", fontSize: 30, fontWeight: 900 }}>
                {isCn ? "文件树、多标签、终端、预览与 AI 助手同屏协作" : "File tree, tabs, terminal, preview, and AI assistant in one surface"}
              </h1>
              <p style={{ margin: 0, maxWidth: 860, color: "rgba(255,255,255,0.56)", lineHeight: 1.8 }}>
                {isCn ? "这一页要像真正团队在用的 AI IDE。点击目录、标签、命令结果、模板和 AI 模式，中心编辑区、预览摘要和终端状态都要跟着变化。" : "This page should feel like a real AI IDE used by teams. Clicking explorer items, tabs, command results, templates, and AI modes should update the editor, preview summary, and terminal state together."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/runs" style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", background: "#8b5cf6", color: "#ffffff", fontWeight: 800 }}>
                {isCn ? "打开运行面板" : "Open runs"}
              </Link>
              <Link href="/templates" style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.08)", color: "#f8fafc", fontWeight: 700 }}>
                {isCn ? "切换模板库" : "Browse templates"}
              </Link>
            </div>
          </div>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
            {topMetricCards.map((card) => (
              <div key={card.label} style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.06)", background: "#1b1c24", padding: 16 }}>
                <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 12 }}>{card.label}</div>
                <div style={{ marginTop: 10, fontSize: 22, fontWeight: 900, color: card.tone }}>{card.value}</div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ borderRadius: 24, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#17181f" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#9333ea)", display: "grid", placeItems: "center", fontSize: 20 }}>✦</div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>{${JSON.stringify(brand)}}</div>
              <div style={{ borderRadius: 10, padding: "6px 10px", background: "rgba(124,58,237,0.2)", color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>${getCompactPlanTag(spec.planTier)}</div>
            </div>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 6, borderRadius: 18, background: "#11131a", border: "1px solid rgba(255,255,255,0.08)" }}>
                {workspaceSurfaceLinks.map((item) => (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 16px", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.6)", background: item.active ? "rgba(124,58,237,0.22)" : "transparent", fontSize: 14, fontWeight: 800 }}>
                    {item.label}
                  </Link>
                ))}
              </div>
              <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 12 }}>
                {isCn ? "其它工作区入口已收进 Overview，避免打散主工作区。" : "Other workspace panels are moved into Overview to keep the main surface focused."}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "40px 340px minmax(0,1fr)", minHeight: "calc(100vh - 150px)" }}>
            <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "#14151c", padding: "12px 0", display: "grid", alignContent: "start", gap: 10 }}>
              {activityBarItems.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  title={item.label}
                  onClick={() => setActiveRail(item.label)}
                  style={{ width: 28, height: 28, borderRadius: 9, border: "none", background: activeRail === item.label ? "rgba(124,58,237,0.22)" : "transparent", color: activeRail === item.label ? "#c4b5fd" : "rgba(255,255,255,0.42)", margin: "0 auto", display: "grid", placeItems: "center", fontSize: 13, cursor: "pointer" }}
                >
                  {item.icon}
                </button>
              ))}
            </div>

            <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "#17181f", padding: 14, display: "grid", alignContent: "start", gap: 14, maxHeight: "calc(100vh - 150px)", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "AI 助手" : "AI Assistant"}</div>
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900 }}>{isCn ? "左侧共创对话" : "Left copilot thread"}</div>
                </div>
                <div style={{ borderRadius: 10, background: "rgba(124,58,237,0.18)", color: "#c4b5fd", padding: "4px 8px", fontSize: 12, fontWeight: 700 }}>GPT-4</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {aiModes.map((item) => (
                  <button key={item} onClick={() => setActiveMode(item)} style={{ borderRadius: 12, padding: "12px 14px", background: activeMode === item ? "rgba(124,58,237,0.22)" : "#1f212c", color: activeMode === item ? "#f8fafc" : "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", textAlign: "left" }}>
                    {item}
                  </button>
                ))}
              </div>

              <div style={{ borderRadius: 18, background: "#1f212c", padding: 16 }}>
                <div style={{ color: "#a78bfa", fontWeight: 800, marginBottom: 10 }}>{${JSON.stringify(brand)}} AI</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {aiContextChips.map((item) => (
                    <div key={item} style={{ borderRadius: 999, padding: "6px 10px", background: "rgba(124,58,237,0.16)", color: "#ddd6fe", fontSize: 11, fontWeight: 700 }}>
                      {item}
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginBottom: 12 }}>
                  {aiWorkflowStats.map((item) => (
                    <div key={item.label} style={{ borderRadius: 12, background: "#232533", padding: "10px 12px" }}>
                      <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 11 }}>{item.label}</div>
                      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: "#f8fafc" }}>{item.value}</div>
                      <div style={{ marginTop: 4, color: "rgba(255,255,255,0.52)", fontSize: 11, lineHeight: 1.5 }}>{item.note}</div>
                    </div>
                  ))}
                </div>
                <div style={{ color: "rgba(255,255,255,0.74)", fontSize: 13, lineHeight: 1.8 }}>{aiMessages[activeMode]}</div>
                <textarea value={aiInput} onChange={(event) => setAiInput(event.target.value)} spellCheck={false} style={{ width: "100%", minHeight: 120, marginTop: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#0d1119", color: "#f8fafc", padding: 12, resize: "vertical", outline: "none" }} />
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {promptPresets.map((item, index) => (
                    <button key={item} type="button" onClick={() => setAiInput(item)} style={{ borderRadius: 12, border: "none", cursor: "pointer", textAlign: "left", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.68)", padding: "10px 12px", fontSize: 12 }}>
                      {item}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => applyAiAction(activeMode)} style={{ borderRadius: 10, border: "none", background: "#8b5cf6", color: "#fff", padding: "10px 12px", cursor: "pointer", fontWeight: 700 }}>
                    {isCn ? "提交给 AI" : "Send to AI"}
                  </button>
                  <button onClick={() => {
                    openFile(aiTargetFile.id);
                    applyAiAction(aiModes[2]);
                  }} style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#f8fafc", padding: "10px 12px", cursor: "pointer", fontWeight: 700 }}>
                    {isCn ? "插入到代码" : "Insert into code"}
                  </button>
                </div>
              </div>

              <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "代码动作" : "Code actions"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {assistantActions.map((item) => (
                    <button key={item.title} onClick={() => applyAiAction(item.mode)} style={{ borderRadius: 12, padding: "10px 12px", background: activeMode === item.mode ? "rgba(124,58,237,0.18)" : "#232533", color: activeMode === item.mode ? "#e9d5ff" : "rgba(255,255,255,0.66)", fontSize: 12, border: "none", cursor: "pointer", textAlign: "left" }}>
                      <div style={{ fontWeight: 800 }}>{item.title}</div>
                      <div style={{ marginTop: 4, lineHeight: 1.6 }}>{item.note}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{isCn ? "资源管理器" : "Explorer"}</div>
                  <div style={{ borderRadius: 999, padding: "4px 8px", background: "rgba(124,58,237,0.18)", color: "#d8b4fe", fontSize: 11, fontWeight: 800 }}>
                    {activeRail}
                  </div>
                </div>
                <input value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder={isCn ? "搜索命令、文件、符号..." : "Search commands, files, symbols..."} style={{ width: "100%", marginTop: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#11131a", color: "#f8fafc", padding: "10px 12px", outline: "none" }} />
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {workspaceRail.map((item) => (
                    <div key={item.title} style={{ borderRadius: 12, background: "#232533", padding: "10px 12px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{item.title}</div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.72)", lineHeight: 1.7 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {commandResults.map((command) => (
                    <button key={command.id} onClick={() => runCommand(command)} style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#1f212c", color: "#f8fafc", padding: "10px 12px", textAlign: "left", cursor: "pointer" }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{command.label}</div>
                      <div style={{ marginTop: 4, color: "rgba(255,255,255,0.46)", fontSize: 12, lineHeight: 1.6 }}>{command.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                {isCn ? "工作区文件" : "Workspace files"}
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {visibleGroups.map((group) => (
                  <div key={group.id} style={{ display: "grid", gap: 8 }}>
                    <button type="button" onClick={() => toggleGroup(group.id)} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", border: "none", background: "transparent", padding: 0, cursor: "pointer" }}>
                      <div style={{ color: "rgba(255,255,255,0.54)", fontSize: 13, fontWeight: 700 }}>
                        {expandedGroups[group.id] ? "▾ " : "▸ "}
                        {group.name}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.36)", fontSize: 11 }}>{group.files.length}</div>
                    </button>
                    {expandedGroups[group.id] && group.files.map((file) => (
                      <button key={file.id} onClick={() => openFile(file.id)} style={{ borderRadius: 12, padding: "10px 12px", background: selectedFile === file.id ? "rgba(124,58,237,0.18)" : "transparent", color: selectedFile === file.id ? "#e9d5ff" : "rgba(255,255,255,0.72)", border: "1px solid rgba(255,255,255,0.05)", textAlign: "left", cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>
                            {file.name}
                            {dirtyFileIds.includes(file.id) ? " •" : ""}
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{file.fullPath.split("/")[0]}</div>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: selectedFile === file.id ? "rgba(233,213,255,0.78)" : "rgba(255,255,255,0.42)" }}>{file.symbols.join(" · ")}</div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "模板轨道" : "Template rail"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {templates.map((item) => (
                    <button key={item.id} onClick={() => injectTemplate(item)} style={{ borderRadius: 12, padding: "10px 12px", background: activeTemplate.id === item.id ? "rgba(124,58,237,0.18)" : "#232533", color: activeTemplate.id === item.id ? "#e9d5ff" : "rgba(255,255,255,0.66)", fontSize: 12, border: "none", cursor: "pointer", textAlign: "left" }}>
                      <div style={{ fontWeight: 800 }}>{item.name}</div>
                      <div style={{ marginTop: 4, lineHeight: 1.6 }}>{item.summary}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "创作记录" : "Creation history"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {assistantTrail.map((item, index) => (
                    <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 1.7 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", background: "#14151b" }}>
              <div style={{ display: "flex", gap: 2, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#161720", overflowX: "auto" }}>
                {activeTabs.map((tab) => (
                  <div key={tab.id} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRight: "1px solid rgba(255,255,255,0.06)", color: selectedFile === tab.id ? "#f8fafc" : "rgba(255,255,255,0.46)", background: selectedFile === tab.id ? "#1a1b25" : "transparent", fontSize: 14 }}>
                    <button type="button" onClick={() => openFile(tab.id)} style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer" }}>
                      {tab.name.split("/").slice(-1)[0]}{dirtyFileIds.includes(tab.id) ? " •" : ""}
                    </button>
                    <button type="button" onClick={() => closeFile(tab.id)} style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", opacity: 0.6 }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", minHeight: 0 }}>
                <div style={{ display: "grid", gridTemplateRows: "auto minmax(0,1fr)", minHeight: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#14151b" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{currentFile.fullPath}</div>
                      <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.62)" }}>{currentFile.symbols.join(" · ")}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ borderRadius: 999, padding: "4px 8px", background: dirtyFileIds.includes(currentFile.id) ? "rgba(245,158,11,0.18)" : "rgba(34,197,94,0.16)", color: dirtyFileIds.includes(currentFile.id) ? "#fcd34d" : "#86efac", fontSize: 11, fontWeight: 800 }}>
                        {dirtyFileIds.includes(currentFile.id) ? (isCn ? "未提交" : "Dirty") : (isCn ? "已同步" : "Synced")}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.46)" }}>{saveNote}</div>
                      <button onClick={saveCurrentFile} style={{ borderRadius: 10, border: "none", background: "#8b5cf6", color: "#fff", padding: "10px 12px", cursor: "pointer", fontWeight: 700 }}>
                        {isCn ? "保存草稿" : "Save draft"}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#12131a", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                    <div>{isCn ? "当前目录" : "Current folder"}: {currentGroup.name}</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span>{isCn ? "页面上下文" : "Page context"}: {activeRoute?.label ?? routeManifest[0]?.label}</span>
                      <span>{isCn ? "选区 AI" : "Selection AI"}: {activeMode}</span>
                      <span>{isCn ? "模板轨道" : "Template rail"}: {activeTemplate.name}</span>
                      <span>{isCn ? "运行态" : "Runtime"}: {runtimeState}</span>
                    </div>
                  </div>
                  <div style={{ overflow: "auto" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "70px minmax(0,1fr)" }}>
                      <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.28)", paddingTop: 18, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, lineHeight: 2 }}>
                        {Array.from({ length: currentDraft.split("\\n").length }, (_, i) => (
                          <div key={i} style={{ padding: "0 18px", textAlign: "right" }}>{i + 1}</div>
                        ))}
                      </div>
                      <textarea
                        value={currentDraft}
                        onChange={(event) => {
                          const next = event.target.value;
                          setDrafts((current) => ({ ...current, [currentFile.id]: next }));
                          setSaveNote(isCn ? "编辑中..." : "Editing...");
                        }}
                        spellCheck={false}
                        style={{ margin: 0, minHeight: "100%", padding: 18, color: "#e5e7eb", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13, lineHeight: 1.85, background: "transparent", border: "none", outline: "none", resize: "none" }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#11131a", padding: 16, display: "grid", alignContent: "start", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "Overview 总览" : "Overview"}</div>
                      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: "#f8fafc" }}>
                        {isCn ? "预览、Dashboard 与 Code 共用同一条工作区线索" : "Preview, Dashboard, and Code stay on one workspace thread"}
                      </div>
                    </div>
                    <Link href="/dashboard" style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: "rgba(124,58,237,0.18)", color: "#e9d5ff", fontWeight: 800, fontSize: 12 }}>
                      Dashboard
                    </Link>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {workspaceSurfaceLinks.map((item) => (
                      <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "rgba(124,58,237,0.22)" : "#1b1c24", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: 700 }}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                  <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                    <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "工作区面板" : "Workspace panels"}</div>
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {workspacePanelLinks.map((item) => (
                        <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: "#232533", color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 700 }}>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                    <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "当前主区焦点" : "Current workspace focus"}</div>
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {routeManifest.map((item) => (
                        <button key={item.id} type="button" onClick={() => focusRoute(item.id)} style={{ borderRadius: 12, border: "none", cursor: "pointer", background: activeRoute?.id === item.id ? "rgba(124,58,237,0.18)" : "#232533", color: activeRoute?.id === item.id ? "#e9d5ff" : "rgba(255,255,255,0.72)", padding: "10px 12px", textAlign: "left" }}>
                          <div style={{ fontWeight: 800, fontSize: 12 }}>{item.label}</div>
                          <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.6, color: activeRoute?.id === item.id ? "rgba(233,213,255,0.78)" : "rgba(255,255,255,0.44)" }}>{item.focus}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                    <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "当前页面元素" : "Current page elements"}</div>
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {routeElements.map((item) => (
                        <button key={item} type="button" onClick={() => setActiveElementName(item)} style={{ borderRadius: 999, border: "none", cursor: "pointer", padding: "6px 10px", background: item === activeElement ? "rgba(124,58,237,0.18)" : "#232533", color: item === activeElement ? "#e9d5ff" : "rgba(255,255,255,0.62)", fontSize: 11, fontWeight: 700 }}>
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                  {previewRailNotes.map((item) => (
                    <div key={item} style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: "12px 14px", color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 1.7 }}>
                      {item}
                    </div>
                  ))}
                  <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                    <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "当前代码片段" : "Current code snippet"}</div>
                    <pre style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", color: "#cbd5e1", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, lineHeight: 1.7 }}>
                      {currentSnippet}
                    </pre>
                  </div>
                  <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                    <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "工作区环境配置" : "Workspace environment"}</div>
                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      {[
                        (isCn ? "部署" : "Deploy") + ": " + workspaceConfig.deploymentTarget,
                        (isCn ? "数据库" : "Database") + ": " + workspaceConfig.databaseTarget,
                        (isCn ? "可见性" : "Visibility") + ": " + workspaceConfig.visibility,
                        (isCn ? "发布通道" : "Publish lane") + ": " + workspaceConfig.publishChannel,
                      ].map((item) => (
                        <div key={item} style={{ borderRadius: 10, background: "#232533", padding: "8px 10px", fontSize: 12, color: "rgba(255,255,255,0.68)" }}>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ borderRadius: 14, background: "rgba(124,58,237,0.14)", border: "1px solid rgba(124,58,237,0.22)", padding: 14 }}>
                    <div style={{ color: "#c4b5fd", fontWeight: 800, fontSize: 12 }}>{isCn ? "当前模板联动" : "Current template sync"}</div>
                    <div style={{ marginTop: 8, fontWeight: 800 }}>{activeTemplate.name}</div>
                    <div style={{ marginTop: 4, color: "rgba(255,255,255,0.56)", fontSize: 12, lineHeight: 1.7 }}>{activeTemplate.summary}</div>
                  </div>
                  <div style={{ borderRadius: 14, background: "#1b1c24", border: "1px solid rgba(255,255,255,0.08)", padding: 14 }}>
                    <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "当前文件动作" : "Current file actions"}</div>
                    <div style={{ marginTop: 8, color: "rgba(255,255,255,0.62)", fontSize: 12, lineHeight: 1.7 }}>
                      {(isCn ? "AI 当前目标文件: " : "AI target file: ") + aiTargetFile.fullPath}
                    </div>
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {aiTargetSymbols.map((symbol) => (
                        <button key={symbol} type="button" onClick={() => setActiveSymbolName(symbol)} style={{ borderRadius: 999, border: "none", cursor: "pointer", padding: "6px 10px", background: symbol === activeSymbol ? "rgba(124,58,237,0.18)" : "#232533", color: symbol === activeSymbol ? "#e9d5ff" : "rgba(255,255,255,0.62)", fontSize: 11, fontWeight: 700 }}>
                          {symbol}
                        </button>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {assistantActions.map((item) => (
                        <button key={item.mode} onClick={() => applyAiAction(item.mode)} style={{ borderRadius: 12, padding: "10px 12px", border: "none", textAlign: "left", cursor: "pointer", background: activeMode === item.mode ? "rgba(124,58,237,0.18)" : "#232533", color: activeMode === item.mode ? "#e9d5ff" : "rgba(255,255,255,0.72)" }}>
                          <div style={{ fontWeight: 800, fontSize: 12 }}>{item.title}</div>
                          <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6 }}>{item.note}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 4, paddingTop: 12, display: "grid", gap: 12 }}>
                    <div style={{ color: "rgba(255,255,255,0.34)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                      {isCn ? "后续再看" : "Later"}
                    </div>
                    <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                      <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "当前上下文包" : "Current context bundle"}</div>
                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        {contextBundle.map((item) => (
                          <div key={item.label} style={{ borderRadius: 10, background: "#232533", padding: "8px 10px" }}>
                            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{item.label}</div>
                            <div style={{ marginTop: 4, color: "rgba(255,255,255,0.72)", fontSize: 12, lineHeight: 1.7 }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ borderRadius: 14, border: "1px solid rgba(124,58,237,0.22)", background: "rgba(124,58,237,0.1)", padding: 14 }}>
                      <div style={{ color: "#c4b5fd", fontWeight: 800, fontSize: 12 }}>{isCn ? "本轮变更计划" : "Current change plan"}</div>
                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        {changePlan.map((item, index) => (
                          <div key={item.title} style={{ borderRadius: 10, background: index === 0 ? "rgba(124,58,237,0.14)" : "#232533", padding: "8px 10px" }}>
                            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{item.title}</div>
                            <div style={{ marginTop: 4, color: "rgba(255,255,255,0.74)", fontSize: 12, lineHeight: 1.7 }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#11131a" }}>
                <div style={{ display: "flex", gap: 16, padding: "10px 14px", color: "rgba(255,255,255,0.62)", fontSize: 13 }}>
                  {[
                    { key: "terminal", label: isCn ? "终端" : "Terminal" },
                    { key: "problems", label: isCn ? "问题" : "Problems" },
                    { key: "output", label: isCn ? "输出" : "Output" },
                  ].map((item) => (
                    <button key={item.key} onClick={() => setTerminalTab(item.key)} style={{ border: "none", background: "transparent", color: terminalTab === item.key ? "#f8fafc" : "rgba(255,255,255,0.62)", cursor: "pointer" }}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <div style={{ padding: "0 16px 18px", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12.5, lineHeight: 1.9 }}>
                  {terminalLogs[terminalTab].map((line) => (
                    <div key={line} style={{ color: line.startsWith("error") || line.includes("error") ? "#fca5a5" : line.includes("ok") || line.includes("ready") ? "#22c55e" : line.includes("warning") || line.includes("警告") ? "#facc15" : "#cbd5e1" }}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
`
}

function renderCodeRunsPage(spec: AppSpec) {
  const isCn = spec.region === "cn"
  const brand = spec.title
  const rows = buildCodePlatformRunSeeds(spec)
  return `// @ts-nocheck
"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function RunsPage() {
  const isCn = ${isCn ? "true" : "false"};
  const STORAGE_KEY = "mornstack-generated-workspace-config";
  const SESSION_KEY = "mornstack-generated-workspace-session";
  const rows = ${JSON.stringify(rows, null, 2)} as const;
  const workspaceSurfaceLinks = [
    { href: "/", label: isCn ? "预览" : "Preview" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/editor", label: "Code", active: true },
  ] as const;
  const workspacePanelLinks = [
    { href: "/runs", label: isCn ? "运行" : "Runs", active: true },
    { href: "/templates", label: isCn ? "模板库" : "Templates" },
    { href: "/settings", label: isCn ? "设置" : "Settings" },
    { href: "/pricing", label: isCn ? "升级" : "Upgrade" },
    ...(${spec.planTier === "elite" ? "true" : "false"}
      ? [
          { href: "/reports", label: isCn ? "汇报" : "Reports" },
          { href: "/team", label: isCn ? "团队" : "Team" },
        ]
      : []),
  ] as const;
  const stageCards = ${JSON.stringify(
    isCn
      ? [
          { label: "代码生成", value: "queued -> running -> done" },
          { label: "构建验证", value: "lint / type / preview" },
          { label: "访问链路", value: "login -> workspace -> preview" },
          { label: "交付闭环", value: "share -> review -> deploy -> report" },
        ]
      : [
          { label: "Code generation", value: "queued -> running -> done" },
          { label: "Build validation", value: "lint / type / preview" },
          { label: "Access flow", value: "login -> workspace -> preview" },
          { label: "Delivery loop", value: "share -> review -> deploy -> report" },
        ],
    null,
    2
  )} as const;
  const pipelines = ${JSON.stringify(
    isCn
      ? [
          { title: "生成任务", note: "Planner -> Builder -> Fixer", status: "稳定", color: "#8b5cf6" },
          { title: "预览发布", note: "Canonical preview / runtime fallback", status: "运行中", color: "#22c55e" },
          { title: "验收材料", note: "截图、宣传资产、PPT、演示路径", status: "已同步", color: "#38bdf8" },
        ]
      : [
          { title: "Generation jobs", note: "Planner -> Builder -> Fixer", status: "stable", color: "#8b5cf6" },
          { title: "Preview release", note: "Canonical preview / runtime fallback", status: "running", color: "#22c55e" },
          { title: "Acceptance assets", note: "screens, promo assets, PPT, and demo paths", status: "synced", color: "#38bdf8" },
        ],
    null,
    2
  )} as const;
  const activityRail = [
    { icon: "◫", label: isCn ? "运行" : "Runs", active: true },
    { icon: "◎", label: "Overview" },
    { icon: "</>", label: "Code" },
    { icon: "⚙", label: isCn ? "环境" : "Env" },
  ] as const;
  const copilotNotes = isCn
    ? [
        "AI 正在把构建日志、预览状态和交付路径串成一条可演示的运行叙事。",
        "切换不同 run 后，左侧上下文、右侧 overview 和当前日志片段会一起变化。",
        "这一页要像控制平面，不是单独的表格页。"
      ]
    : [
        "The copilot is turning build logs, preview health, and delivery checkpoints into one runtime story.",
        "Selecting a run should update the left context, the overview rail, and the current log excerpt together.",
        "This page should read like a control plane, not an isolated table."
      ];
  const deliverySteps = isCn
    ? [
        "1. 先看 Preview / Dashboard / Code 是否指向同一项目线索",
        "2. 再确认当前 run 的构建、预览与部署动作",
        "3. 最后把日志与交付说明带到老板演示路径里",
      ]
    : [
        "1. Confirm Preview / Dashboard / Code stay on the same project thread",
        "2. Verify the current run across build, preview, and deploy actions",
        "3. Carry the logs and delivery notes into the demo path",
      ];
  const [workspaceConfig, setWorkspaceConfig] = useState({
    deploymentTarget: isCn ? "cloudbase" : "vercel",
    databaseTarget: isCn ? "cloudbase-doc" : "supabase-postgres",
    visibility: "team",
    publishChannel: "preview",
  });
  const [workspaceSession, setWorkspaceSession] = useState({
    selectedTemplateName: isCn ? "官网与下载站" : "Website + downloads",
    selectedPlanName: ${JSON.stringify(getCodePlatformPlanLabel(spec.planTier, spec.region))},
    routeLabel: isCn ? "编辑器工作区" : "Editor workspace",
    filePath: "app/editor/page.tsx",
    lastAction: isCn ? "等待下一次运行" : "Waiting for the next run",
    lastChangedAt: isCn ? "未写入" : "No draft yet",
    readiness: "ready",
  });
  const filters = isCn
    ? ["全部", "成功", "运行中", "失败", "最近 1 小时"]
    : ["All", "Success", "Running", "Failed", "Last hour"];
  const [activeFilter, setActiveFilter] = useState(filters[0]);
  const [selectedRunId, setSelectedRunId] = useState(rows[0]?.id ?? "");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setWorkspaceConfig((current) => ({ ...current, ...parsed }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setWorkspaceSession((current) => ({ ...current, ...parsed }));
    } catch {}
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (activeFilter === filters[0]) return true;
      if (activeFilter === filters[1]) return /成功|deploy/i.test(row.status);
      if (activeFilter === filters[2]) return /构建中|build|running/i.test(row.status);
      if (activeFilter === filters[3]) return /失败|test|error/i.test(row.status);
      return /2 分钟前|5 分钟前|1 hour|18 min|2 min|5 min/i.test(row.time);
    });
  }, [activeFilter, filters, rows]);

  const selectedRun = filteredRows.find((row) => row.id === selectedRunId) ?? filteredRows[0] ?? rows[0];
  const sessionContext = [
    { label: isCn ? "当前页面" : "Current page", value: workspaceSession.routeLabel },
    { label: isCn ? "目标文件" : "Target file", value: workspaceSession.filePath },
    { label: isCn ? "模板轨道" : "Template rail", value: workspaceSession.selectedTemplateName },
    { label: isCn ? "当前套餐" : "Current plan", value: workspaceSession.selectedPlanName },
    { label: isCn ? "最近动作" : "Last action", value: workspaceSession.lastAction },
    { label: isCn ? "最近写入" : "Last write", value: workspaceSession.lastChangedAt },
  ];
  const runLogs = {
    "run-overview": [
      "$ pnpm build",
      "planner -> scaffold -> acceptance",
      "control plane routes synced",
      "current project overview ready",
    ],
    "run-editor": [
      "$ pnpm dev",
      "editor workspace syncing current file groups",
      "assistant rail switched into file-aware mode",
      "terminal and preview notes refreshed",
      "focused file -> " + workspaceSession.filePath,
    ],
    "run-preview": [
      "$ pnpm preview:check",
      "canonical / runtime / fallback converging",
      "resolved preview URL verified",
      "fallback reason captured for the current project",
    ],
    "run-delivery": [
      "$ pnpm ship:prep",
      "template rails aligned with current spec",
      "pricing + settings connected to the delivery story",
      "handoff notes refreshed",
      "delivery context -> " + workspaceSession.selectedTemplateName + " / " + workspaceSession.selectedPlanName,
    ],
  };
  const overviewCards = [
    { label: isCn ? "当前运行" : "Active run", value: selectedRun?.id ?? rows[0]?.id ?? "", tone: "#8b5cf6" },
    { label: isCn ? "部署目标" : "Deploy target", value: workspaceConfig.deploymentTarget, tone: "#22c55e" },
    { label: isCn ? "数据库" : "Database", value: workspaceConfig.databaseTarget, tone: "#38bdf8" },
    { label: isCn ? "发布通道" : "Publish lane", value: workspaceConfig.publishChannel, tone: "#f59e0b" },
  ];
  const selectedLogLines = runLogs[selectedRun?.id ?? ""] ?? runLogs["run-overview"];

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...workspaceSession,
          routeId: "runs",
          routeLabel: isCn ? "运行链路" : "Runtime flow",
          lastAction:
            (isCn ? "查看运行记录 " : "Opened run record ") +
            (selectedRun?.id ?? rows[0]?.id ?? ""),
          readiness: selectedRun?.status ?? workspaceSession.readiness,
        })
      );
    } catch {}
  }, [SESSION_KEY, isCn, rows, selectedRun?.id, selectedRun?.status, workspaceSession]);

  return (
    <main style={{ minHeight: "100vh", background: "#12131a", color: "#f8fafc", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gap: 16 }}>
        <section style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.16), transparent 28%), #17181f", padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(124,58,237,0.2)", color: "#d8b4fe", fontSize: 12, fontWeight: 800 }}>
                {isCn ? "运行控制平面" : "Runs control plane"}
              </div>
              <h1 style={{ margin: "14px 0 8px", fontSize: 30, fontWeight: 900 }}>
                {isCn ? "让生成、构建、预览与部署共享同一条运行叙事" : "Keep generation, build, preview, and deploy on one runtime thread"}
              </h1>
              <p style={{ margin: 0, maxWidth: 860, color: "rgba(255,255,255,0.56)", lineHeight: 1.8 }}>
                {isCn ? "这一页现在不再只是运行列表，而是和 Preview、Dashboard、Code 共用一个工作区上下文，让老板能看到真正的控制平面。" : "This surface should no longer feel like a standalone run list. It now stays connected to Preview, Dashboard, and Code so the workspace reads like a real control plane."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/editor" style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", background: "#8b5cf6", color: "#ffffff", fontWeight: 800 }}>
                {isCn ? "回到 Code" : "Return to Code"}
              </Link>
              <Link href="/settings" style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.08)", color: "#f8fafc", fontWeight: 700 }}>
                {isCn ? "检查环境" : "Check settings"}
              </Link>
            </div>
          </div>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
            {[
              { label: isCn ? "总运行次数" : "Total runs", value: "281", tone: "#8b5cf6" },
              { label: isCn ? "成功率" : "Success rate", value: "94.3%", tone: "#10b981" },
              { label: isCn ? "平均耗时" : "Average time", value: "2m 15s", tone: "#3b82f6" },
              { label: isCn ? "今日部署" : "Deploys today", value: "8", tone: "#f59e0b" },
            ].map((item) => (
              <div key={item.label} style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.06)", background: "#1b1c24", padding: 16 }}>
                <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 12 }}>{item.label}</div>
                <div style={{ marginTop: 10, fontSize: 24, fontWeight: 900, color: item.tone }}>{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ borderRadius: 24, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#17181f" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#9333ea)", display: "grid", placeItems: "center", fontSize: 20 }}>✦</div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>{${JSON.stringify(brand)}}</div>
              <div style={{ borderRadius: 10, padding: "6px 10px", background: "rgba(124,58,237,0.2)", color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>${getCompactPlanTag(spec.planTier)}</div>
            </div>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 6, borderRadius: 18, background: "#11131a", border: "1px solid rgba(255,255,255,0.08)" }}>
                {workspaceSurfaceLinks.map((item) => (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 16px", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.6)", background: item.active ? "rgba(124,58,237,0.22)" : "transparent", fontSize: 14, fontWeight: 800 }}>
                    {item.label}
                  </Link>
                ))}
              </div>
              <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 12 }}>
                {isCn ? "运行、模板、设置、升级已收进 Overview，避免打散主工作区。" : "Runs, templates, settings, and pricing are moved into Overview to keep the main surface focused."}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "40px 320px minmax(0,1fr)", minHeight: "calc(100vh - 150px)" }}>
            <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "#14151c", padding: "12px 0", display: "grid", alignContent: "start", gap: 10 }}>
              {activityRail.map((item) => (
                <div key={item.label} title={item.label} style={{ width: 28, height: 28, borderRadius: 9, background: item.active ? "rgba(124,58,237,0.22)" : "transparent", color: item.active ? "#c4b5fd" : "rgba(255,255,255,0.42)", margin: "0 auto", display: "grid", placeItems: "center", fontSize: 13 }}>
                  {item.icon}
                </div>
              ))}
            </div>

            <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "#17181f", padding: 14, display: "grid", alignContent: "start", gap: 14, maxHeight: "calc(100vh - 150px)", overflowY: "auto" }}>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "AI 助手" : "AI Assistant"}</div>
                <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900 }}>{isCn ? "左侧共创对话" : "Left copilot thread"}</div>
              </div>

              <div style={{ borderRadius: 18, background: "#1f212c", padding: 16 }}>
                <div style={{ color: "#a78bfa", fontWeight: 800, marginBottom: 10 }}>{isCn ? "运行叙事" : "Runtime narrative"}</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {copilotNotes.map((item, index) => (
                    <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 1.7 }}>
                      {item}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href="/editor" style={{ textDecoration: "none", borderRadius: 10, background: "#8b5cf6", color: "#fff", padding: "10px 12px", fontWeight: 700, fontSize: 12 }}>
                    {isCn ? "打开 Code" : "Open Code"}
                  </Link>
                  <Link href="/dashboard" style={{ textDecoration: "none", borderRadius: 10, background: "#232533", color: "#f8fafc", padding: "10px 12px", fontWeight: 700, fontSize: 12 }}>
                    Dashboard
                  </Link>
                </div>
              </div>

              <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "当前工作区上下文" : "Current workspace context"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {sessionContext.map((item) => (
                    <div key={item.label} style={{ borderRadius: 12, background: "#232533", padding: "12px 14px" }}>
                      <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{item.label}</div>
                      <div style={{ marginTop: 8, fontWeight: 800, lineHeight: 1.7 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "运行阶段" : "Runtime stages"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {stageCards.map((card) => (
                    <div key={card.label} style={{ borderRadius: 12, background: "#232533", padding: "12px 14px" }}>
                      <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{card.label}</div>
                      <div style={{ marginTop: 8, fontWeight: 800 }}>{card.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", minHeight: 0 }}>
              <div style={{ padding: 16, display: "grid", alignContent: "start", gap: 16, maxHeight: "calc(100vh - 150px)", overflowY: "auto", background: "#14151b" }}>
                <section style={{ borderRadius: 22, border: "1px solid rgba(124,58,237,0.18)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.16), transparent 32%), #1b1827", padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#d8b4fe", fontWeight: 800 }}>{isCn ? "运行面板" : "Runs"}</div>
                      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{isCn ? "从当前工作区直接推进 build、preview 与 deploy" : "Push build, preview, and deploy directly from the active workspace"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {filters.map((item) => (
                        <button key={item} onClick={() => setActiveFilter(item)} style={{ borderRadius: 12, padding: "10px 14px", background: activeFilter === item ? "rgba(124,58,237,0.22)" : "#1f212c", color: activeFilter === item ? "#e9d5ff" : "rgba(255,255,255,0.62)", fontWeight: 700, border: "none", cursor: "pointer" }}>
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
                  {pipelines.map((item) => (
                    <div key={item.title} style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div style={{ fontWeight: 800 }}>{item.title}</div>
                        <div style={{ color: item.color, fontSize: 12, fontWeight: 800 }}>{item.status}</div>
                      </div>
                      <div style={{ marginTop: 8, color: "rgba(255,255,255,0.56)", fontSize: 13, lineHeight: 1.7 }}>{item.note}</div>
                    </div>
                  ))}
                </section>

                <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
                  {overviewCards.map((item) => (
                    <div key={item.label} style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{item.label}</div>
                      <div style={{ marginTop: 10, fontSize: 20, fontWeight: 900, color: item.tone }}>{item.value}</div>
                    </div>
                  ))}
                </section>

                <section style={{ display: "grid", gridTemplateColumns: "1.12fr 0.88fr", gap: 16 }}>
                  <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#17181f", overflow: "hidden" }}>
                    {filteredRows.map((row) => (
                      <button key={row.name + row.id} onClick={() => setSelectedRunId(row.id)} style={{ width: "100%", border: "none", background: selectedRun?.id === row.id ? "rgba(124,58,237,0.1)" : "transparent", cursor: "pointer", display: "grid", gridTemplateColumns: "48px 1fr 220px", gap: 14, alignItems: "center", padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", textAlign: "left" }}>
                        <div style={{ width: 42, height: 42, borderRadius: 14, background: row.tone + "22", display: "grid", placeItems: "center", color: row.tone }}>◉</div>
                        <div>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ fontSize: 16, fontWeight: 800 }}>{row.name}</div>
                            <div style={{ color: "rgba(255,255,255,0.4)" }}>{row.id}</div>
                            <div style={{ borderRadius: 10, background: "rgba(255,255,255,0.08)", padding: "4px 8px", fontSize: 12 }}>{row.status}</div>
                          </div>
                          <div style={{ marginTop: 8, color: "rgba(255,255,255,0.45)", fontSize: 13 }}>⎇ {row.branch} · {row.detail}</div>
                        </div>
                        <div style={{ display: "grid", gap: 6, color: "rgba(255,255,255,0.46)", fontSize: 12, textAlign: "right" }}>
                          <span>{row.duration}</span>
                          <span>{row.time}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "grid", gap: 16 }}>
                    <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "当前运行详情" : "Selected run"}</div>
                        <div style={{ borderRadius: 999, padding: "4px 10px", background: "rgba(124,58,237,0.18)", color: "#d8b4fe", fontSize: 11, fontWeight: 800 }}>{selectedRun?.id}</div>
                      </div>
                      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                        {[
                          { label: isCn ? "项目" : "Project", value: selectedRun?.name },
                          { label: isCn ? "分支" : "Branch", value: selectedRun?.branch },
                          { label: isCn ? "状态" : "Status", value: selectedRun?.status },
                          { label: isCn ? "动作" : "Action", value: selectedRun?.detail },
                          { label: isCn ? "耗时" : "Duration", value: selectedRun?.duration },
                        ].map((item) => (
                          <div key={item.label} style={{ borderRadius: 12, background: "#232533", padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{item.label}</div>
                            <div style={{ fontWeight: 800, textAlign: "right" }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button style={{ borderRadius: 12, border: "none", background: "#8b5cf6", color: "#fff", padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}>{isCn ? "重新运行" : "Re-run"}</button>
                        <button style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#f8fafc", padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>{isCn ? "打开日志" : "Open logs"}</button>
                      </div>
                    </div>

                    <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "运行日志片段" : "Run log excerpt"}</div>
                      <div style={{ marginTop: 12, borderRadius: 16, background: "#0d1119", padding: 14, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, lineHeight: 1.85, color: "#cbd5e1", whiteSpace: "pre-wrap" }}>
                        {selectedLogLines.join("\\n")}
                      </div>
                    </div>
                  </div>
                </section>

                <section style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 16 }}>
                  <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "最近日志" : "Recent logs"}</div>
                    <div style={{ marginTop: 12, borderRadius: 16, background: "#0d1119", padding: 14, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, lineHeight: 1.85, color: "#cbd5e1", whiteSpace: "pre-wrap" }}>
                      {[
                        "$ pnpm build",
                        "route: /api/generate  -> ok",
                        "preview: /demo  -> ready",
                        "preview: auth -> workspace -> ready",
                        isCn ? "next-step: 继续补强运行守卫与错误恢复" : "next-step: harden runtime guards and recovery",
                      ].join("\\n")}
                    </div>
                  </div>
                  <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "演示链路" : "Demo chain"}</div>
                    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                      {deliverySteps.map((item, index) => (
                        <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.66)", fontSize: 12, lineHeight: 1.8 }}>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>

              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#11131a", padding: 16, display: "grid", alignContent: "start", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "Overview 总览" : "Overview"}</div>
                    <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: "#f8fafc" }}>
                      {isCn ? "Preview、Dashboard 与 Runs 共用同一条工作区线索" : "Preview, Dashboard, and Runs stay on one workspace thread"}
                    </div>
                  </div>
                  <Link href="/dashboard" style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: "rgba(124,58,237,0.18)", color: "#e9d5ff", fontWeight: 800, fontSize: 12 }}>
                    Dashboard
                  </Link>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {workspaceSurfaceLinks.map((item) => (
                    <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "rgba(124,58,237,0.22)" : "#1b1c24", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 700 }}>
                      {item.label}
                    </Link>
                  ))}
                </div>

                <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                  <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "工作区面板" : "Workspace panels"}</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {workspacePanelLinks.map((item) => (
                      <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: item.active ? "rgba(124,58,237,0.18)" : "#232533", color: item.active ? "#e9d5ff" : "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 700 }}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                  <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "当前选中 run" : "Selected run focus"}</div>
                  <div style={{ marginTop: 8, fontWeight: 800 }}>{selectedRun?.name}</div>
                  <div style={{ marginTop: 6, color: "rgba(255,255,255,0.62)", fontSize: 12, lineHeight: 1.8 }}>
                    {(isCn ? "当前状态: " : "Current status: ") + (selectedRun?.status ?? "")}
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {[
                      (isCn ? "分支" : "Branch") + ": " + (selectedRun?.branch ?? ""),
                      (isCn ? "动作" : "Action") + ": " + (selectedRun?.detail ?? ""),
                      (isCn ? "耗时" : "Duration") + ": " + (selectedRun?.duration ?? ""),
                    ].map((item) => (
                      <div key={item} style={{ borderRadius: 10, background: "#232533", padding: "8px 10px", fontSize: 12, color: "rgba(255,255,255,0.68)" }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                  <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "工作区环境配置" : "Workspace environment"}</div>
                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    {[
                      (isCn ? "部署" : "Deploy") + ": " + workspaceConfig.deploymentTarget,
                      (isCn ? "数据库" : "Database") + ": " + workspaceConfig.databaseTarget,
                      (isCn ? "可见性" : "Visibility") + ": " + workspaceConfig.visibility,
                      (isCn ? "发布通道" : "Publish lane") + ": " + workspaceConfig.publishChannel,
                    ].map((item) => (
                      <div key={item} style={{ borderRadius: 10, background: "#232533", padding: "8px 10px", fontSize: 12, color: "rgba(255,255,255,0.68)" }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 14, background: "rgba(124,58,237,0.14)", border: "1px solid rgba(124,58,237,0.22)", padding: 14 }}>
                  <div style={{ color: "#c4b5fd", fontWeight: 800, fontSize: 12 }}>{isCn ? "下一步动作" : "Next actions"}</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {deliverySteps.map((item, index) => (
                      <div key={item} style={{ borderRadius: 10, background: index === 0 ? "rgba(124,58,237,0.14)" : "#232533", padding: "8px 10px", color: "rgba(255,255,255,0.74)", fontSize: 12, lineHeight: 1.7 }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                  <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "当前日志片段" : "Current log excerpt"}</div>
                  <pre style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", color: "#cbd5e1", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, lineHeight: 1.7 }}>
                    {selectedLogLines.join("\\n")}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
`
}

function renderCodeTemplatesPage(spec: AppSpec) {
  const isCn = spec.region === "cn"
  const brand = spec.title
  const acceptanceTracks = buildCodePlatformAcceptanceTracks(spec)
  const featuredBundles = buildCodePlatformFeaturedBundles(spec)
  const templateRows = buildCodePlatformTemplateSeeds(spec).map((item, index) => ({
    title: item.name,
    note: item.summary,
    tags: item.tags,
    badge: item.badge,
    stats: `${1800 - index * 280}   ↓ ${Math.max(2.4, 8.4 - index * 1.3)}k`,
    color: item.color,
  }))
  const visibleRows = spec.planTier === "elite" ? templateRows : spec.planTier === "pro" ? templateRows : templateRows.slice(0, 3)
  return `// @ts-nocheck
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function TemplatesPage() {
  const isCn = ${isCn ? "true" : "false"};
  const STORAGE_KEY = "mornstack-generated-workspace-config";
  const SESSION_KEY = "mornstack-generated-workspace-session";
  const rows = ${JSON.stringify(visibleRows, null, 2)} as const;
  const workspaceSurfaceLinks = [
    { href: "/", label: isCn ? "预览" : "Preview" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/editor", label: "Code", active: true },
  ] as const;
  const workspacePanelLinks = [
    { href: "/runs", label: isCn ? "运行" : "Runs" },
    { href: "/templates", label: isCn ? "模板库" : "Templates", active: true },
    { href: "/settings", label: isCn ? "设置" : "Settings" },
    { href: "/pricing", label: isCn ? "升级" : "Upgrade" },
    ...(${spec.planTier === "elite" ? "true" : "false"}
      ? [
          { href: "/reports", label: isCn ? "汇报" : "Reports" },
          { href: "/team", label: isCn ? "团队" : "Team" },
        ]
      : []),
  ] as const;
  const acceptanceTracks = ${JSON.stringify(acceptanceTracks, null, 2)} as const;
  const groups = isCn ? ["全部模板", "官网与落地页", "管理后台", "数据平台", "社区与运营", "营销工具"] : ["All", "Sites", "Admin", "Data", "Community", "Marketing"];
  const featuredBundles = ${JSON.stringify(featuredBundles, null, 2)} as const;
  const activityRail = [
    { icon: "▦", label: isCn ? "模板" : "Templates", active: true },
    { icon: "◎", label: "Overview" },
    { icon: "</>", label: "Code" },
    { icon: "⚙", label: isCn ? "环境" : "Env" },
  ] as const;
  const copilotNotes = isCn
    ? [
        "左侧 AI 会把模板选择和当前工作区上下文绑在一起，而不是只做图库浏览。",
        "切换模板后，右侧 overview、当前套餐和下一步生成动作都会同步变化。",
        "这一页要像应用生成器的模板轨道，而不是孤立的卡片墙。"
      ]
    : [
        "The left copilot keeps template selection tied to the active workspace instead of showing a static gallery.",
        "Switching templates should update the overview rail, current tier, and the next generation action together.",
        "This page should feel like a template rail for an app generator, not a disconnected card wall."
      ];
  const nextSteps = isCn
    ? [
        "1. 在模板轨道里确认 archetype 与当前套餐匹配",
        "2. 把选中的模板带回 Code 或 Dashboard 继续做厚",
        "3. 再用 Runs / Settings 验证发布与环境路径",
      ]
    : [
        "1. Match the archetype against the active plan in the template rail",
        "2. Bring the selected template back into Code or Dashboard for depth work",
        "3. Validate release and environment paths through Runs and Settings",
      ];
  const [activeGroup, setActiveGroup] = useState(groups[0]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(rows[0]?.title ?? "");
  const [workspaceConfig, setWorkspaceConfig] = useState({
    deploymentTarget: isCn ? "cloudbase" : "vercel",
    databaseTarget: isCn ? "cloudbase-doc" : "supabase-postgres",
    publishChannel: "preview",
  });
  const [workspaceSession, setWorkspaceSession] = useState({
    selectedTemplateName: rows[0]?.title ?? "",
    selectedPlanName: ${JSON.stringify(getCodePlatformPlanLabel(spec.planTier, spec.region))},
    routeLabel: isCn ? "模板轨道" : "Template rails",
    filePath: "app/templates/page.tsx",
    lastAction: isCn ? "等待模板选择" : "Waiting for template selection",
    lastChangedAt: isCn ? "未写入" : "No draft yet",
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setWorkspaceConfig((current) => ({ ...current, ...parsed }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setWorkspaceSession((current) => ({ ...current, ...parsed }));
      if (parsed.selectedTemplateName) setSelectedTemplateId(parsed.selectedTemplateName);
    } catch {}
  }, []);
  const filteredRows = rows.filter((row) => {
    const matchesGroup =
      activeGroup === groups[0] ||
      (activeGroup === groups[1] && /官网|Company|Landing|download|site/i.test(row.title + row.note)) ||
      (activeGroup === groups[2] && /销售|CRM|admin/i.test(row.title + row.note)) ||
      (activeGroup === groups[3] && /API|数据|monitor|OpenAPI/i.test(row.title + row.note)) ||
      (activeGroup === groups[4] && /社区|反馈|Community|ticket/i.test(row.title + row.note)) ||
      (activeGroup === groups[5] && /营销|Marketing|campaign|AB/i.test(row.title + row.note));
    const matchesSearch = !templateSearch.trim() || (row.title + row.note + row.tags.join(" ")).toLowerCase().includes(templateSearch.trim().toLowerCase());
    return matchesGroup && matchesSearch;
  });
  const selectedTemplate = filteredRows.find((row) => row.title === selectedTemplateId) ?? filteredRows[0] ?? rows[0];
  const visibleTemplateRows = filteredRows;
  const sessionContext = [
    { label: isCn ? "当前页面" : "Current page", value: workspaceSession.routeLabel },
    { label: isCn ? "目标文件" : "Target file", value: workspaceSession.filePath },
    { label: isCn ? "当前套餐" : "Current plan", value: workspaceSession.selectedPlanName },
    { label: isCn ? "最近动作" : "Last action", value: workspaceSession.lastAction },
    { label: isCn ? "最近写入" : "Last write", value: workspaceSession.lastChangedAt },
  ];
  const templateSignals = [
    { label: isCn ? "当前模板" : "Selected template", value: selectedTemplate?.title ?? rows[0]?.title ?? "", tone: "#8b5cf6" },
    { label: isCn ? "部署" : "Deploy", value: workspaceConfig.deploymentTarget, tone: "#22c55e" },
    { label: isCn ? "数据库" : "Database", value: workspaceConfig.databaseTarget, tone: "#38bdf8" },
    { label: isCn ? "发布通道" : "Publish lane", value: workspaceConfig.publishChannel, tone: "#f59e0b" },
  ];

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...workspaceSession,
          selectedTemplateName: selectedTemplate?.title ?? rows[0]?.title ?? workspaceSession.selectedTemplateName,
          routeId: "templates",
          routeLabel: isCn ? "模板轨道" : "Template rails",
          filePath: "app/templates/page.tsx",
          lastAction:
            (isCn ? "查看模板 " : "Inspecting template ") +
            (selectedTemplate?.title ?? rows[0]?.title ?? ""),
        })
      );
    } catch {}
  }, [SESSION_KEY, isCn, rows, selectedTemplate?.title, workspaceSession]);

  return (
    <main style={{ minHeight: "100vh", background: "#12131a", color: "#f8fafc", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gap: 16 }}>
        <section style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.16), transparent 28%), #17181f", padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(124,58,237,0.2)", color: "#d8b4fe", fontSize: 12, fontWeight: 800 }}>
                {isCn ? "模板轨道" : "Template rail"}
              </div>
              <h1 style={{ margin: "14px 0 8px", fontSize: 30, fontWeight: 900 }}>
                {isCn ? "把模板选择也纳入统一工作区上下文" : "Bring template selection into the shared workspace context"}
              </h1>
              <p style={{ margin: 0, maxWidth: 860, color: "rgba(255,255,255,0.56)", lineHeight: 1.8 }}>
                {isCn ? "这里不是静态图库，而是和 Preview、Dashboard、Code 一起联动的 archetype 轨道。切换模板时，工作区叙事、套餐深度和下一步生成动作都应该一起变化。" : "This should not be a static gallery. It is an archetype rail connected to Preview, Dashboard, and Code, where changing the template shifts workspace narrative, plan depth, and the next generation action together."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/editor" style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", background: "#8b5cf6", color: "#ffffff", fontWeight: 800 }}>
                {isCn ? "回到 Code" : "Return to Code"}
              </Link>
              <Link href="/dashboard" style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.08)", color: "#f8fafc", fontWeight: 700 }}>
                Dashboard
              </Link>
            </div>
          </div>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
            {templateSignals.map((item) => (
              <div key={item.label} style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.06)", background: "#1b1c24", padding: 16 }}>
                <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 12 }}>{item.label}</div>
                <div style={{ marginTop: 10, fontSize: 22, fontWeight: 900, color: item.tone }}>{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ borderRadius: 24, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#17181f" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#9333ea)", display: "grid", placeItems: "center", fontSize: 20 }}>✦</div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>{${JSON.stringify(brand)}}</div>
              <div style={{ borderRadius: 10, padding: "6px 10px", background: "rgba(124,58,237,0.2)", color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>${getCompactPlanTag(spec.planTier)}</div>
            </div>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 6, borderRadius: 18, background: "#11131a", border: "1px solid rgba(255,255,255,0.08)" }}>
                {workspaceSurfaceLinks.map((item) => (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 16px", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.6)", background: item.active ? "rgba(124,58,237,0.22)" : "transparent", fontSize: 14, fontWeight: 800 }}>
                    {item.label}
                  </Link>
                ))}
              </div>
              <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 12 }}>
                {isCn ? "模板、运行、设置与升级已收进 Overview，避免打散主工作区。" : "Templates, runs, settings, and pricing are moved into Overview to keep the main surface focused."}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "40px 320px minmax(0,1fr)", minHeight: "calc(100vh - 150px)" }}>
            <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "#14151c", padding: "12px 0", display: "grid", alignContent: "start", gap: 10 }}>
              {activityRail.map((item) => (
                <div key={item.label} title={item.label} style={{ width: 28, height: 28, borderRadius: 9, background: item.active ? "rgba(124,58,237,0.22)" : "transparent", color: item.active ? "#c4b5fd" : "rgba(255,255,255,0.42)", margin: "0 auto", display: "grid", placeItems: "center", fontSize: 13 }}>
                  {item.icon}
                </div>
              ))}
            </div>

            <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "#17181f", padding: 14, display: "grid", alignContent: "start", gap: 14, maxHeight: "calc(100vh - 150px)", overflowY: "auto" }}>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "AI 助手" : "AI Assistant"}</div>
                <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900 }}>{isCn ? "左侧共创对话" : "Left copilot thread"}</div>
              </div>

              <div style={{ borderRadius: 18, background: "#1f212c", padding: 16 }}>
                <div style={{ color: "#a78bfa", fontWeight: 800, marginBottom: 10 }}>{isCn ? "模板策略" : "Template strategy"}</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {copilotNotes.map((item, index) => (
                    <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 1.7 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "验收轨道" : "Acceptance rails"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {acceptanceTracks.map((item, index) => (
                    <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, lineHeight: 1.7 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "当前工作区焦点" : "Current workspace focus"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {sessionContext.map((item) => (
                    <div key={item.label} style={{ borderRadius: 12, background: "#232533", padding: "12px 14px" }}>
                      <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{item.label}</div>
                      <div style={{ marginTop: 8, fontWeight: 800, lineHeight: 1.7 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", minHeight: 0 }}>
              <div style={{ padding: 16, display: "grid", alignContent: "start", gap: 16, maxHeight: "calc(100vh - 150px)", overflowY: "auto", background: "#14151b" }}>
                <section style={{ borderRadius: 22, border: "1px solid rgba(124,58,237,0.18)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.16), transparent 32%), #1b1827", padding: 20 }}>
                  <div style={{ fontSize: 12, color: "#d8b4fe", fontWeight: 800 }}>{isCn ? "模板库" : "Templates"}</div>
                  <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{isCn ? "按 archetype 分化生成路径，而不是重复一套壳" : "Branch the generator by archetype instead of repeating one shell"}</div>
                  <input value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder={isCn ? "搜索模板..." : "Search templates..."} style={{ marginTop: 16, width: "100%", borderRadius: 16, background: "rgba(255,255,255,0.04)", padding: "16px 18px", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.08)", outline: "none" }} />
                  <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {groups.map((item) => (
                      <button key={item} onClick={() => setActiveGroup(item)} style={{ borderRadius: 12, padding: "10px 16px", background: activeGroup === item ? "rgba(124,58,237,0.2)" : "#1f212c", color: activeGroup === item ? "#e9d5ff" : "rgba(255,255,255,0.62)", fontWeight: 700, border: "none", cursor: "pointer" }}>
                        {item}
                      </button>
                    ))}
                  </div>
                </section>

                <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
                  {featuredBundles.map((item) => (
                    <div key={item.title} style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 800 }}>{item.title}</div>
                        <div style={{ color: item.color, fontSize: 12 }}>●</div>
                      </div>
                      <div style={{ marginTop: 8, color: "rgba(255,255,255,0.56)", fontSize: 13, lineHeight: 1.7 }}>{item.note}</div>
                    </div>
                  ))}
                </section>

                <section style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 18 }}>
                    {visibleTemplateRows.length > 0 ? visibleTemplateRows.map((row) => (
                      <button key={row.title} onClick={() => setSelectedTemplateId(row.title)} style={{ borderRadius: 22, overflow: "hidden", border: selectedTemplate?.title === row.title ? "1px solid rgba(124,58,237,0.38)" : "1px solid rgba(255,255,255,0.07)", background: "#17181f", padding: 0, cursor: "pointer", textAlign: "left" }}>
                        <div style={{ height: 150, background: row.color, opacity: 0.85 }} />
                        <div style={{ padding: 20 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                            <div style={{ fontSize: 16, fontWeight: 900 }}>{row.title}</div>
                            <div style={{ borderRadius: 999, padding: "4px 10px", background: "rgba(124,58,237,0.18)", color: "#d8b4fe", fontSize: 11, fontWeight: 700 }}>{row.badge}</div>
                          </div>
                          <div style={{ marginTop: 10, color: "rgba(255,255,255,0.56)", fontSize: 14, lineHeight: 1.7 }}>{row.note}</div>
                          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {row.tags.map((tag) => (
                              <div key={tag} style={{ borderRadius: 10, background: "rgba(255,255,255,0.06)", padding: "4px 8px", color: "rgba(255,255,255,0.48)", fontSize: 12 }}>{tag}</div>
                            ))}
                          </div>
                          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <Link href={row.title.includes("官网") || row.title.includes("Company") ? "/" : row.title.includes("销售") || row.title.includes("CRM") ? "/dashboard" : row.title.includes("API") ? "/runs" : "/templates"} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: "rgba(124,58,237,0.18)", color: "#e9d5ff", fontSize: 12, fontWeight: 700 }}>
                              {isCn ? "打开模板" : "Open template"}
                            </Link>
                            <Link href="/settings" style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: "#232533", color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 700 }}>
                              {isCn ? "查看环境设置" : "View settings"}
                            </Link>
                          </div>
                          <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, color: "rgba(255,255,255,0.44)", fontSize: 13 }}>{row.stats}</div>
                        </div>
                      </button>
                    )) : (
                      <div style={{ gridColumn: "1 / -1", borderRadius: 22, border: "1px dashed rgba(124,58,237,0.28)", background: "#17181f", padding: 24 }}>
                        <div style={{ fontWeight: 800 }}>{isCn ? "当前筛选下暂无模板" : "No templates match the current filter"}</div>
                        <div style={{ marginTop: 8, color: "rgba(255,255,255,0.56)", lineHeight: 1.8 }}>
                          {isCn ? "可以切回全部模板，或换一个关键词继续搜索。" : "Try returning to All templates or adjust the search query."}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 16 }}>
                    <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "模板详情" : "Template details"}</div>
                        <div style={{ borderRadius: 999, padding: "4px 10px", background: "rgba(124,58,237,0.18)", color: "#d8b4fe", fontSize: 11, fontWeight: 800 }}>{selectedTemplate?.badge}</div>
                      </div>
                      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                        {[
                          { label: isCn ? "名称" : "Name", value: selectedTemplate?.title },
                          { label: isCn ? "说明" : "Summary", value: selectedTemplate?.note },
                          { label: isCn ? "技术标签" : "Tags", value: selectedTemplate?.tags.join(" / ") },
                          { label: isCn ? "使用热度" : "Usage", value: selectedTemplate?.stats },
                        ].map((item) => (
                          <div key={item.label} style={{ borderRadius: 12, background: "#232533", padding: "12px 14px" }}>
                            <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{item.label}</div>
                            <div style={{ marginTop: 8, fontWeight: 800, lineHeight: 1.7 }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "预期生成结果" : "Expected output"}</div>
                      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                        {(selectedTemplate?.tags ?? []).map((tag, index) => (
                          <div key={tag} style={{ borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.72)", fontSize: 12 }}>
                            {(isCn ? "将优先补强: " : "Will prioritize: ") + tag}
                          </div>
                        ))}
                        <div style={{ borderRadius: 14, background: "#232533", padding: 12, color: "rgba(255,255,255,0.62)", fontSize: 12, lineHeight: 1.8 }}>
                          {isCn
                            ? "模板会继续影响 scaffold、页面结构、工作区重点与演示路径，而不只是视觉换皮。"
                            : "Templates continue shaping scaffold, page structure, workspace emphasis, and demo flow instead of merely changing visuals."}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#11131a", padding: 16, display: "grid", alignContent: "start", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "Overview 总览" : "Overview"}</div>
                    <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: "#f8fafc" }}>
                      {isCn ? "Preview、Dashboard 与 Templates 共用同一条工作区线索" : "Preview, Dashboard, and Templates stay on one workspace thread"}
                    </div>
                  </div>
                  <Link href="/dashboard" style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: "rgba(124,58,237,0.18)", color: "#e9d5ff", fontWeight: 800, fontSize: 12 }}>
                    Dashboard
                  </Link>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {workspaceSurfaceLinks.map((item) => (
                    <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "rgba(124,58,237,0.22)" : "#1b1c24", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 700 }}>
                      {item.label}
                    </Link>
                  ))}
                </div>

                <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                  <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "工作区面板" : "Workspace panels"}</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {workspacePanelLinks.map((item) => (
                      <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: item.active ? "rgba(124,58,237,0.18)" : "#232533", color: item.active ? "#e9d5ff" : "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 700 }}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                  <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "当前模板联动" : "Current template sync"}</div>
                  <div style={{ marginTop: 8, fontWeight: 800 }}>{selectedTemplate?.title}</div>
                  <div style={{ marginTop: 6, color: "rgba(255,255,255,0.62)", fontSize: 12, lineHeight: 1.8 }}>
                    {selectedTemplate?.note}
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {[
                      (isCn ? "当前套餐" : "Current plan") + ": " + workspaceSession.selectedPlanName,
                      (isCn ? "部署" : "Deploy") + ": " + workspaceConfig.deploymentTarget,
                      (isCn ? "发布通道" : "Publish lane") + ": " + workspaceConfig.publishChannel,
                    ].map((item) => (
                      <div key={item} style={{ borderRadius: 10, background: "#232533", padding: "8px 10px", fontSize: 12, color: "rgba(255,255,255,0.68)" }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                  <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "当前工作区焦点" : "Current workspace focus"}</div>
                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    {sessionContext.map((item) => (
                      <div key={item.label} style={{ borderRadius: 10, background: "#232533", padding: "8px 10px" }}>
                        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{item.label}</div>
                        <div style={{ marginTop: 4, color: "rgba(255,255,255,0.72)", fontSize: 12, lineHeight: 1.7 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 14, background: "rgba(124,58,237,0.14)", border: "1px solid rgba(124,58,237,0.22)", padding: 14 }}>
                  <div style={{ color: "#c4b5fd", fontWeight: 800, fontSize: 12 }}>{isCn ? "下一步动作" : "Next actions"}</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {nextSteps.map((item, index) => (
                      <div key={item} style={{ borderRadius: 10, background: index === 0 ? "rgba(124,58,237,0.14)" : "#232533", padding: "8px 10px", color: "rgba(255,255,255,0.74)", fontSize: 12, lineHeight: 1.7 }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <button onClick={() => {
                    try {
                      window.localStorage.setItem(
                        SESSION_KEY,
                        JSON.stringify({
                          ...workspaceSession,
                          selectedTemplateName: selectedTemplate?.title ?? rows[0]?.title ?? workspaceSession.selectedTemplateName,
                          routeId: "templates",
                          routeLabel: isCn ? "模板轨道" : "Template rails",
                          filePath: "app/templates/page.tsx",
                          lastAction:
                            (isCn ? "基于模板继续生成: " : "Continue generation from template: ") +
                            (selectedTemplate?.title ?? rows[0]?.title ?? ""),
                        })
                      );
                    } catch {}
                  }} style={{ borderRadius: 12, border: "none", background: "#8b5cf6", color: "#fff", padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}>{isCn ? "基于模板生成" : "Generate from template"}</button>
                  <Link href="/editor" style={{ textDecoration: "none", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", color: "#f8fafc", padding: "10px 14px", fontWeight: 700, textAlign: "center" }}>{isCn ? "带到编辑器" : "Open in editor"}</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
`
}

function renderCodePricingPage(spec: AppSpec) {
  const isCn = spec.region === "cn"
  const brand = spec.title
  const currentPlanName = getCodePlatformPlanLabel(spec.planTier, spec.region)
  const plans = isCn
    ? [
        { name: "免费版", sub: "Free", price: "¥0", desc: "个人开发者与学习者", cta: "免费开始", featured: false, points: ["稳定首版生成", "1 个子域名位", "3 个项目空间", "代码在线查看，不可导出", "数据库仅在线试用"] },
        { name: "启动版", sub: "Starter", price: "¥29", desc: "试运行与早期验证", cta: "升级启动版", featured: false, points: ["稳定生成 + 轻量多页", "1 个子域名位", "5 个项目空间", "代码仍不可导出", "托管数据库配置"] },
        { name: "建造者版", sub: "Builder", price: "¥79", desc: "开始交付业务原型", cta: "升级建造者版", featured: true, points: ["更厚的业务模块", "Manifest 导出", "12 个项目空间", "更高路由与模块预算", "托管数据库配置"] },
        { name: "专业版", sub: "Pro", price: "¥159", desc: "中小团队与专业开发者", cta: "立即升级", featured: false, points: ["完整代码导出", "10 个子域名位", "30 个项目空间", "数据库可连接正式环境", "构建 / 测试 / 部署面板"] },
        { name: "精英版", sub: "Elite", price: "¥399", desc: "大型团队与企业级交付", cta: "立即升级", featured: false, points: ["全部专业版功能", "50 个子域名位", "100 个项目空间", "团队级代码导出与交接", "数据库权限分层与资源配额", "汇报中心与宣传资产联动"] },
      ]
    : [
        { name: "Free", sub: "Free", price: "$0", desc: "For solo builders", cta: "Start free", featured: false, points: ["Stable first-pass generation", "1 subdomain slot", "3 projects", "Code stays in-browser, no export", "Database stays online-only"] },
        { name: "Starter", sub: "Starter", price: "$9", desc: "For early validation", cta: "Upgrade Starter", featured: false, points: ["Stable generation with light multi-page depth", "1 subdomain slot", "5 projects", "Code still cannot export", "Managed database config"] },
        { name: "Builder", sub: "Builder", price: "$29", desc: "For shipping business prototypes", cta: "Upgrade Builder", featured: true, points: ["Thicker app structure", "Manifest export", "12 projects", "Higher route and module budgets", "Managed database config"] },
        { name: "Pro", sub: "Pro", price: "$79", desc: "For serious teams", cta: "Upgrade Pro", featured: false, points: ["Full code export", "10 subdomain slots", "30 projects", "Production database access", "Build and deploy panel"] },
        { name: "Elite", sub: "Elite", price: "$199", desc: "For delivery and handoff", cta: "Upgrade Elite", featured: false, points: ["Everything in Pro", "50 subdomain slots", "100 projects", "Team handoff and code export", "Database quotas and role controls", "Reporting center"] },
      ]
  return `// @ts-nocheck
"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function PricingPage() {
  const isCn = ${isCn ? "true" : "false"};
  const STORAGE_KEY = "mornstack-generated-workspace-config";
  const SESSION_KEY = "mornstack-generated-workspace-session";
  const plans = ${JSON.stringify(plans, null, 2)} as const;
  const workspaceSurfaceLinks = [
    { href: "/", label: isCn ? "预览" : "Preview" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/editor", label: "Code", active: true },
  ] as const;
  const workspacePanelLinks = [
    { href: "/runs", label: isCn ? "运行" : "Runs" },
    { href: "/templates", label: isCn ? "模板库" : "Templates" },
    { href: "/settings", label: isCn ? "设置" : "Settings" },
    { href: "/pricing", label: isCn ? "升级" : "Upgrade", active: true },
    ...(${spec.planTier === "pro" || spec.planTier === "elite" ? "true" : "false"}
      ? [
          { href: "/reports", label: isCn ? "汇报" : "Reports" },
        ]
      : []),
    ...(${spec.planTier === "elite" ? "true" : "false"}
      ? [
          { href: "/team", label: isCn ? "团队" : "Team" },
        ]
      : []),
  ] as const;
  const comparisons = ${JSON.stringify(
    isCn
      ? [
          { label: "生成档位", free: "基础", starter: "稳定", builder: "建造者", pro: "高级", elite: "展示级" },
          { label: "工作区数量", free: "3", starter: "5", builder: "12", pro: "30", elite: "100" },
          { label: "代码导出", free: "不可导出", starter: "不可导出", builder: "Manifest", pro: "完整导出", elite: "团队级交接包" },
          { label: "数据库使用", free: "仅在线试用", starter: "托管配置", builder: "托管配置", pro: "正式环境连接", elite: "配额与角色控制" },
          { label: "子域名位", free: "1", starter: "1", builder: "3", pro: "10", elite: "50" },
          { label: "验收深度", free: "基础首版", starter: "稳定首版", builder: "业务原型", pro: "交付版本", elite: "展示与交接" },
        ]
      : [
          { label: "Generation profile", free: "Starter", starter: "Starter+", builder: "Builder", pro: "Premium", elite: "Showcase" },
          { label: "Workspaces", free: "3", starter: "5", builder: "12", pro: "30", elite: "100" },
          { label: "Code export", free: "Not available", starter: "Not available", builder: "Manifest", pro: "Full export", elite: "Handoff bundle" },
          { label: "Database access", free: "Online only", starter: "Managed config", builder: "Managed config", pro: "Production ready", elite: "Quota + role controls" },
          { label: "Subdomain slots", free: "1", starter: "1", builder: "3", pro: "10", elite: "50" },
          { label: "Delivery depth", free: "Baseline", starter: "Stable starter", builder: "Business prototype", pro: "Delivery ready", elite: "Showcase + handoff" },
        ],
    null,
    2
  )} as const;
  const activityRail = [
    { icon: "$", label: isCn ? "套餐" : "Pricing", active: true },
    { icon: "◎", label: "Overview" },
    { icon: "</>", label: "Code" },
    { icon: "⚙", label: isCn ? "环境" : "Env" },
  ] as const;
  const copilotNotes = isCn
    ? [
        "套餐不是单纯价格文案，而是直接决定生成器能交付多深的工作区、数据库能力和导出权限。",
        "免费版和启动版保留稳定在线体验，建造者版开放 manifest 导出，专业版开放完整导出与正式数据库，精英版再补协作和交付闭环。",
        "这一页要像控制平面里的权限模型，而不是单独的营销页。"
      ]
    : [
        "Tiers are not just pricing copy. They define how much workspace depth, database access, and export capability the generator can deliver.",
        "Free and Starter stay focused on stable online delivery, Builder unlocks manifest export, Pro opens full export and production DB access, and Elite adds collaboration and handoff depth.",
        "This page should read like a permissions model inside the control plane, not a standalone marketing screen."
      ];
  const nextSteps = isCn
    ? [
        "1. 先确认当前套餐是否匹配这次交付深度",
        "2. 再把套餐能力同步到 Templates、Runs 和 Settings",
        "3. 最后再推进导出、数据库与发布权限的真实实现",
      ]
    : [
        "1. Confirm the active plan matches the intended delivery depth",
        "2. Propagate tier capabilities into Templates, Runs, and Settings",
        "3. Then implement export, database, and publishing permissions for real",
      ];
  const [workspaceConfig, setWorkspaceConfig] = useState({
    deploymentTarget: isCn ? "cloudbase" : "vercel",
    databaseTarget: isCn ? "cloudbase-doc" : "supabase-postgres",
    loginPolicy: "hybrid",
  });
  const [selectedPlanName, setSelectedPlanName] = useState(${JSON.stringify(currentPlanName)});
  const [workspaceSession, setWorkspaceSession] = useState({
    selectedTemplateName: isCn ? "官网与下载站" : "Website + downloads",
    selectedPlanName: ${JSON.stringify(currentPlanName)},
    routeLabel: isCn ? "套餐与升级" : "Plans and upgrades",
    filePath: "app/pricing/page.tsx",
    lastAction: isCn ? "等待套餐选择" : "Waiting for plan selection",
    lastChangedAt: isCn ? "未写入" : "No draft yet",
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setWorkspaceConfig((current) => ({ ...current, ...parsed }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setWorkspaceSession((current) => ({ ...current, ...parsed }));
      if (parsed.selectedPlanName) setSelectedPlanName(parsed.selectedPlanName);
    } catch {}
  }, []);

  const selectedPlan = useMemo(() => plans.find((plan) => plan.name === selectedPlanName) ?? plans[0], [plans, selectedPlanName]);
  const sessionContext = [
    { label: isCn ? "当前模板" : "Current template", value: workspaceSession.selectedTemplateName },
    { label: isCn ? "最近页面" : "Recent page", value: workspaceSession.routeLabel },
    { label: isCn ? "目标文件" : "Target file", value: workspaceSession.filePath },
    { label: isCn ? "最近动作" : "Last action", value: workspaceSession.lastAction },
    { label: isCn ? "当前套餐" : "Current plan", value: selectedPlan?.name },
  ];
  const planSignals = [
    { label: isCn ? "当前套餐" : "Selected plan", value: selectedPlan?.name ?? plans[0]?.name ?? "", tone: "#8b5cf6" },
    { label: isCn ? "部署" : "Deploy", value: workspaceConfig.deploymentTarget, tone: "#22c55e" },
    { label: isCn ? "数据库" : "Database", value: workspaceConfig.databaseTarget, tone: "#38bdf8" },
    { label: isCn ? "登录策略" : "Login", value: workspaceConfig.loginPolicy, tone: "#f59e0b" },
  ];

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...workspaceSession,
          selectedPlanName: selectedPlan?.name ?? plans[0]?.name ?? workspaceSession.selectedPlanName,
          routeId: "pricing",
          routeLabel: isCn ? "套餐与升级" : "Plans and upgrades",
          filePath: "app/pricing/page.tsx",
          lastAction:
            (isCn ? "查看套餐 " : "Reviewing plan ") +
            (selectedPlan?.name ?? plans[0]?.name ?? ""),
        })
      );
    } catch {}
  }, [SESSION_KEY, isCn, plans, selectedPlan?.name, workspaceSession]);
  return (
    <main style={{ minHeight: "100vh", background: "#12131a", color: "#f8fafc", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gap: 16 }}>
        <section style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.16), transparent 28%), #17181f", padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(124,58,237,0.2)", color: "#d8b4fe", fontSize: 12, fontWeight: 800 }}>
                {isCn ? "套餐与权限" : "Plans and permissions"}
              </div>
              <h1 style={{ margin: "14px 0 8px", fontSize: 30, fontWeight: 900 }}>
                {isCn ? "把套餐差异明确成真实工作区权限模型" : "Turn tier differences into a real workspace permission model"}
              </h1>
              <p style={{ margin: 0, maxWidth: 860, color: "rgba(255,255,255,0.56)", lineHeight: 1.8 }}>
                {isCn ? ${JSON.stringify(`${brand} 现在不只是写价格，而是开始把代码导出、数据库使用、工作区深度这些差异收进套餐模型里。`)} : ${JSON.stringify(`${brand} now starts turning code export, database access, and workspace depth into concrete tier differences instead of just pricing copy.`)}}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/settings" style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", background: "#8b5cf6", color: "#ffffff", fontWeight: 800 }}>
                {isCn ? "同步到设置" : "Sync to settings"}
              </Link>
              <Link href="/templates" style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.08)", color: "#f8fafc", fontWeight: 700 }}>
                {isCn ? "回到模板轨道" : "Back to templates"}
              </Link>
            </div>
          </div>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
            {planSignals.map((item) => (
              <div key={item.label} style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.06)", background: "#1b1c24", padding: 16 }}>
                <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 12 }}>{item.label}</div>
                <div style={{ marginTop: 10, fontSize: 22, fontWeight: 900, color: item.tone }}>{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ borderRadius: 24, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#17181f" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#9333ea)", display: "grid", placeItems: "center", fontSize: 20 }}>✦</div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>{${JSON.stringify(brand)}}</div>
              <div style={{ borderRadius: 10, padding: "6px 10px", background: "rgba(124,58,237,0.2)", color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>${getCompactPlanTag(spec.planTier)}</div>
            </div>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 6, borderRadius: 18, background: "#11131a", border: "1px solid rgba(255,255,255,0.08)" }}>
                {workspaceSurfaceLinks.map((item) => (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 16px", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.6)", background: item.active ? "rgba(124,58,237,0.22)" : "transparent", fontSize: 14, fontWeight: 800 }}>
                    {item.label}
                  </Link>
                ))}
              </div>
              <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 12 }}>
                {isCn ? "套餐、运行、模板与设置已收进 Overview，避免打散主工作区。" : "Pricing, runs, templates, and settings are moved into Overview to keep the main surface focused."}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "40px 320px minmax(0,1fr)", minHeight: "calc(100vh - 150px)" }}>
            <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "#14151c", padding: "12px 0", display: "grid", alignContent: "start", gap: 10 }}>
              {activityRail.map((item) => (
                <div key={item.label} title={item.label} style={{ width: 28, height: 28, borderRadius: 9, background: item.active ? "rgba(124,58,237,0.22)" : "transparent", color: item.active ? "#c4b5fd" : "rgba(255,255,255,0.42)", margin: "0 auto", display: "grid", placeItems: "center", fontSize: 13 }}>
                  {item.icon}
                </div>
              ))}
            </div>

            <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "#17181f", padding: 14, display: "grid", alignContent: "start", gap: 14, maxHeight: "calc(100vh - 150px)", overflowY: "auto" }}>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "AI 助手" : "AI Assistant"}</div>
                <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900 }}>{isCn ? "左侧共创对话" : "Left copilot thread"}</div>
              </div>

              <div style={{ borderRadius: 18, background: "#1f212c", padding: 16 }}>
                <div style={{ color: "#a78bfa", fontWeight: 800, marginBottom: 10 }}>{isCn ? "套餐分层" : "Tier differentiation"}</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {copilotNotes.map((item, index) => (
                    <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 1.7 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "当前工作区联动" : "Current workspace linkage"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {sessionContext.map((item) => (
                    <div key={item.label} style={{ borderRadius: 12, background: "#232533", padding: "12px 14px" }}>
                      <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{item.label}</div>
                      <div style={{ marginTop: 8, fontWeight: 800, lineHeight: 1.7 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "套餐会影响什么" : "What tiers change"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {[
                    isCn ? "代码是否允许导出与交接" : "Whether code can be exported and handed off",
                    isCn ? "数据库是在线试用还是正式连接" : "Whether databases stay online-only or connect to production",
                    isCn ? "工作区是否开放更深的运行与汇报能力" : "How much runtime and reporting depth the workspace unlocks",
                  ].map((item, index) => (
                    <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 1.7 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", minHeight: 0 }}>
              <div style={{ padding: 16, display: "grid", alignContent: "start", gap: 16, maxHeight: "calc(100vh - 150px)", overflowY: "auto", background: "#14151b" }}>
                <section style={{ borderRadius: 22, border: "1px solid rgba(124,58,237,0.18)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.16), transparent 32%), #1b1827", padding: 20 }}>
                  <div style={{ fontSize: 12, color: "#d8b4fe", fontWeight: 800 }}>{isCn ? "套餐差异" : "Tier differentiation"}</div>
                  <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{isCn ? "五档套餐直接影响生成厚度、导出权限、数据库模式与子域名资源" : "Five plan tiers directly change generation depth, export rights, database mode, and subdomain capacity"}</div>
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {[
                      isCn ? "Free / Starter: 保持在线体验和稳定生成，代码仍不可导出" : "Free / Starter: keep the online flow and stable generation, with code staying non-exportable",
                      isCn ? "Builder / Pro: 开始拉开结构厚度，并开放 manifest 或完整导出" : "Builder / Pro: add route depth and unlock manifest or full export",
                      isCn ? "Elite: 进入展示级交付、团队交接与更高资源配额" : "Elite: move into showcase delivery, team handoff, and the highest resource envelope",
                    ].map((item, index) => (
                      <div key={item} style={{ borderRadius: 14, padding: "12px 14px", background: index === 1 ? "rgba(124,58,237,0.18)" : "#1b1c24", border: "1px solid rgba(255,255,255,0.07)", color: index === 1 ? "#e9d5ff" : "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.7 }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </section>

                <section style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "当前工作区配置" : "Current workspace profile"}</div>
                  <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
                    {[
                      { label: isCn ? "部署" : "Deploy", value: workspaceConfig.deploymentTarget },
                      { label: isCn ? "数据库" : "Database", value: workspaceConfig.databaseTarget },
                      { label: isCn ? "登录策略" : "Login", value: workspaceConfig.loginPolicy },
                    ].map((item) => (
                      <div key={item.label} style={{ borderRadius: 12, background: "#232533", padding: "12px 14px" }}>
                        <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{item.label}</div>
                        <div style={{ marginTop: 8, fontWeight: 800 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 18 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 }}>
                    {plans.map((plan, index) => (
                      <button key={plan.name} type="button" onClick={() => setSelectedPlanName(plan.name)} style={{ borderRadius: 24, border: selectedPlan?.name === plan.name || plan.featured ? "1px solid rgba(124,58,237,0.55)" : "1px solid rgba(255,255,255,0.08)", background: "#1a1b22", padding: 24, boxShadow: selectedPlan?.name === plan.name || plan.featured ? "0 0 0 1px rgba(124,58,237,0.28) inset" : "none", cursor: "pointer", textAlign: "left" }}>
                        {plan.featured ? <div style={{ color: "#a78bfa", fontWeight: 800, marginBottom: 18 }}>{isCn ? "✦ 最受欢迎" : "✦ Most popular"}</div> : <div style={{ height: 24 }} />}
                        <div style={{ fontSize: 16, fontWeight: 900 }}>{plan.name}</div>
                        <div style={{ marginTop: 6, color: "rgba(255,255,255,0.48)" }}>{plan.sub}</div>
                        <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 46, fontWeight: 900 }}>{plan.price}</span>
                          <span style={{ color: "rgba(255,255,255,0.42)" }}>{isCn ? "/月" : "/mo"}</span>
                        </div>
                        <div style={{ marginTop: 10, color: "rgba(255,255,255,0.54)" }}>{plan.desc}</div>
                        <Link href={plan.sub === "Free" ? "/login?redirect=/editor" : plan.sub === "Starter" ? "/login?redirect=/pricing" : plan.sub === "Builder" ? "/login?redirect=/runs" : plan.sub === "Pro" ? "/login?redirect=/reports" : "/login?redirect=/team"} style={{ marginTop: 24, borderRadius: 14, background: plan.featured ? "linear-gradient(135deg,#8b5cf6,#a855f7)" : "#242633", color: "#fff", padding: "14px 16px", textAlign: "center", fontWeight: 800, textDecoration: "none", display: "block" }}>{plan.cta}</Link>
                        <div style={{ marginTop: 22, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 18, display: "grid", gap: 12 }}>
                          {plan.points.map((item) => (
                            <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "rgba(255,255,255,0.74)", lineHeight: 1.8 }}>
                              <span style={{ color: "#34d399" }}>✓</span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "grid", gap: 16 }}>
                    <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "当前方案详情" : "Selected plan"}</div>
                        <div style={{ borderRadius: 999, padding: "4px 10px", background: "rgba(124,58,237,0.18)", color: "#d8b4fe", fontSize: 11, fontWeight: 800 }}>{selectedPlan?.sub}</div>
                      </div>
                      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                        {[
                          { label: isCn ? "方案" : "Plan", value: selectedPlan?.name },
                          { label: isCn ? "价格" : "Price", value: selectedPlan?.price + (isCn ? " /月" : " /month") },
                          { label: isCn ? "定位" : "Positioning", value: selectedPlan?.desc },
                          { label: isCn ? "推荐环境" : "Suggested environment", value: workspaceConfig.deploymentTarget + " + " + workspaceConfig.databaseTarget },
                        ].map((item) => (
                          <div key={item.label} style={{ borderRadius: 12, background: "#232533", padding: "12px 14px" }}>
                            <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{item.label}</div>
                            <div style={{ marginTop: 8, fontWeight: 800, lineHeight: 1.7 }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "为什么推荐这个方案" : "Why this tier fits"}</div>
                      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                        {(selectedPlan?.points ?? []).slice(0, 5).map((item, index) => (
                          <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.72)", fontSize: 12, lineHeight: 1.7 }}>
                            {item}
                          </div>
                        ))}
                        <div style={{ borderRadius: 14, background: "#232533", padding: "12px 14px", color: "rgba(255,255,255,0.62)", fontSize: 12, lineHeight: 1.8 }}>
                          {isCn
                            ? "这里开始明确 free / starter / builder / pro / elite 在代码导出、数据库和资源上的真实差异。"
                            : "This makes the free / starter / builder / pro / elite differences around export, database access, and resources explicit."}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "能力对比" : "Capability comparison"}</div>
                  <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                    {comparisons.map((row) => (
                      <div key={row.label} style={{ display: "grid", gridTemplateColumns: "1.2fr repeat(5,minmax(0,1fr))", gap: 10, alignItems: "center", borderRadius: 14, background: "#232533", padding: "12px 14px", fontSize: 13 }}>
                        <div style={{ fontWeight: 800 }}>{row.label}</div>
                        <div style={{ color: "rgba(255,255,255,0.7)" }}>{row.free}</div>
                        <div style={{ color: "#cbd5e1" }}>{row.starter}</div>
                        <div style={{ color: "#d8b4fe" }}>{row.builder}</div>
                        <div style={{ color: "#e9d5ff" }}>{row.pro}</div>
                        <div style={{ color: "#c4f5d1" }}>{row.elite}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#11131a", padding: 16, display: "grid", alignContent: "start", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "Overview 总览" : "Overview"}</div>
                    <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: "#f8fafc" }}>
                      {isCn ? "Preview、Dashboard 与 Pricing 共用同一条工作区线索" : "Preview, Dashboard, and Pricing stay on one workspace thread"}
                    </div>
                  </div>
                  <Link href="/dashboard" style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: "rgba(124,58,237,0.18)", color: "#e9d5ff", fontWeight: 800, fontSize: 12 }}>
                    Dashboard
                  </Link>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {workspaceSurfaceLinks.map((item) => (
                    <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "rgba(124,58,237,0.22)" : "#1b1c24", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 700 }}>
                      {item.label}
                    </Link>
                  ))}
                </div>

                <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                  <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "工作区面板" : "Workspace panels"}</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {workspacePanelLinks.map((item) => (
                      <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: item.active ? "rgba(124,58,237,0.18)" : "#232533", color: item.active ? "#e9d5ff" : "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 700 }}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                  <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "当前方案联动" : "Current tier linkage"}</div>
                  <div style={{ marginTop: 8, fontWeight: 800 }}>{selectedPlan?.name}</div>
                  <div style={{ marginTop: 6, color: "rgba(255,255,255,0.62)", fontSize: 12, lineHeight: 1.8 }}>
                    {(isCn ? "当前套餐会继续影响模板深度、运行链路和权限模型。" : "The selected plan keeps shaping template depth, runtime tooling, and the permissions model.")}
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {[
                      (isCn ? "当前模板" : "Current template") + ": " + workspaceSession.selectedTemplateName,
                      (isCn ? "部署" : "Deploy") + ": " + workspaceConfig.deploymentTarget,
                      (isCn ? "数据库" : "Database") + ": " + workspaceConfig.databaseTarget,
                    ].map((item) => (
                      <div key={item} style={{ borderRadius: 10, background: "#232533", padding: "8px 10px", fontSize: 12, color: "rgba(255,255,255,0.68)" }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 14, background: "rgba(124,58,237,0.14)", border: "1px solid rgba(124,58,237,0.22)", padding: 14 }}>
                  <div style={{ color: "#c4b5fd", fontWeight: 800, fontSize: 12 }}>{isCn ? "下一步动作" : "Next actions"}</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {nextSteps.map((item, index) => (
                      <div key={item} style={{ borderRadius: 10, background: index === 0 ? "rgba(124,58,237,0.14)" : "#232533", padding: "8px 10px", color: "rgba(255,255,255,0.74)", fontSize: 12, lineHeight: 1.7 }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <Link href={selectedPlan?.sub === "Free" ? "/login?redirect=/editor" : selectedPlan?.sub === "Starter" ? "/login?redirect=/pricing" : selectedPlan?.sub === "Builder" ? "/login?redirect=/runs" : selectedPlan?.sub === "Pro" ? "/login?redirect=/reports" : "/login?redirect=/team"} style={{ textDecoration: "none", borderRadius: 12, background: "#8b5cf6", color: "#fff", padding: "10px 14px", fontWeight: 800, textAlign: "center" }}>
                    {isCn ? "按当前方案继续" : "Continue with this plan"}
                  </Link>
                  <Link href="/settings" style={{ textDecoration: "none", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", color: "#f8fafc", padding: "10px 14px", fontWeight: 700, textAlign: "center" }}>
                    {isCn ? "调整环境配置" : "Adjust environment"}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
`
}

function renderCodeSettingsPage(spec: AppSpec) {
  const isCn = spec.region === "cn"
  const brand = spec.title
  const deployments = isCn
    ? [
        { id: "cloudbase", name: "CloudBase 云托管", note: "国内默认，适合云托管与容器发布", badge: "CN default" },
        { id: "vercel", name: "Vercel Node 部署", note: "适合国际版和快速预览发布", badge: "INTL ready" },
        { id: "docker", name: "Docker 自托管", note: "适合企业私有化和云托管迁移", badge: "Portable" },
        { id: "edge", name: "Edge / Static 混合", note: "适合官网、下载站与轻交互产品", badge: "Fast" },
      ]
    : [
        { id: "vercel", name: "Vercel Node deploy", note: "Default international runtime for preview and launch", badge: "INTL default" },
        { id: "cloudbase", name: "CloudBase hosting", note: "Available when a China deployment path is needed", badge: "CN ready" },
        { id: "docker", name: "Docker self-hosted", note: "Useful for enterprise-controlled delivery", badge: "Portable" },
        { id: "edge", name: "Edge / static hybrid", note: "Good for websites, docs, and fast public surfaces", badge: "Fast" },
      ]
  const databases = isCn
    ? [
        { id: "cloudbase-doc", name: "CloudBase 文档型数据库", note: "国内默认，适合账号、配置、业务单据", badge: "CN default" },
        { id: "supabase-postgres", name: "Supabase Postgres", note: "国际版数据层，适合 auth 与结构化数据", badge: "INTL ready" },
        { id: "mysql", name: "MySQL / PlanetScale", note: "适合 CRM、订单、报表等结构化业务", badge: "Structured" },
        { id: "sqlite", name: "SQLite 本地模式", note: "适合首版演示和低门槛样机", badge: "Starter" },
      ]
    : [
        { id: "supabase-postgres", name: "Supabase Postgres", note: "Default international database for auth and app data", badge: "INTL default" },
        { id: "cloudbase-doc", name: "CloudBase document DB", note: "Available for China-region projects and doc data", badge: "CN ready" },
        { id: "mysql", name: "MySQL / PlanetScale", note: "Works well for CRM and transactional workloads", badge: "Structured" },
        { id: "sqlite", name: "SQLite local mode", note: "Useful for demos and lightweight prototypes", badge: "Starter" },
      ]

  return `// @ts-nocheck
"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function SettingsPage() {
  const isCn = ${isCn ? "true" : "false"};
  const STORAGE_KEY = "mornstack-generated-workspace-config";
  const SESSION_KEY = "mornstack-generated-workspace-session";
  const deployments = ${JSON.stringify(deployments, null, 2)} as const;
  const databases = ${JSON.stringify(databases, null, 2)} as const;
  const workspaceSurfaceLinks = [
    { href: "/", label: isCn ? "预览" : "Preview" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/editor", label: "Code", active: true },
  ] as const;
  const workspacePanelLinks = [
    { href: "/runs", label: isCn ? "运行" : "Runs" },
    { href: "/templates", label: isCn ? "模板库" : "Templates" },
    { href: "/settings", label: isCn ? "设置" : "Settings", active: true },
    { href: "/pricing", label: isCn ? "升级" : "Upgrade" },
    ...(${spec.planTier === "elite" ? "true" : "false"} ? [{ href: "/reports", label: isCn ? "汇报" : "Reports" }, { href: "/team", label: isCn ? "团队" : "Team" }] : []),
  ] as const;
  const activityRail = [
    { icon: "⚙", label: isCn ? "设置" : "Settings", active: true },
    { icon: "◎", label: "Overview" },
    { icon: "</>", label: "Code" },
    { icon: "⛁", label: isCn ? "发布" : "Publish" },
  ] as const;
  const copilotNotes = isCn
    ? [
        "这里决定生成器默认走哪套部署、数据库、访问权限和发布通道。",
        "切换环境不只是改文案，还会影响 Runs、Templates、Pricing 和后续发布路径的叙事。",
        "这一页要像控制平面的策略中心，而不是单独的设置表单。"
      ]
    : [
        "This surface decides which deployment, database, access policy, and publish lane the generator should default to.",
        "Changing environment choices should affect Runs, Templates, Pricing, and the later publishing story instead of just editing copy.",
        "This page should feel like the policy center of the control plane, not a standalone settings form."
      ];
  const nextSteps = isCn
    ? [
        "1. 先锁定部署目标、数据库与发布通道",
        "2. 再让 Templates、Runs 与 Pricing 读取同一份环境叙事",
        "3. 最后补正式地址、子域名和权限控制的真实实现",
      ]
    : [
        "1. Lock deployment target, database, and publish lane first",
        "2. Keep Templates, Runs, and Pricing reading the same environment story",
        "3. Then implement real address, subdomain, and permission controls",
      ];
  const [deploymentTarget, setDeploymentTarget] = useState(deployments[0].id);
  const [databaseTarget, setDatabaseTarget] = useState(databases[0].id);
  const [visibility, setVisibility] = useState<"private" | "team" | "public">("team");
  const [loginPolicy, setLoginPolicy] = useState<"password" | "oauth" | "hybrid">("hybrid");
  const [publishChannel, setPublishChannel] = useState<"preview" | "staging" | "production">("preview");
  const [savedNote, setSavedNote] = useState(isCn ? "尚未同步" : "Not synced yet");
  const [workspaceSession, setWorkspaceSession] = useState({
    selectedTemplateName: isCn ? "官网与下载站" : "Website + downloads",
    selectedPlanName: ${JSON.stringify(getCodePlatformPlanLabel(spec.planTier, spec.region))},
    routeLabel: isCn ? "环境设置" : "Environment settings",
    filePath: "app/settings/page.tsx",
    lastAction: isCn ? "等待环境调整" : "Waiting for environment updates",
    lastChangedAt: isCn ? "未写入" : "No draft yet",
  });

  const deploymentCard = useMemo(() => deployments.find((item) => item.id === deploymentTarget) ?? deployments[0], [deploymentTarget]);
  const databaseCard = useMemo(() => databases.find((item) => item.id === databaseTarget) ?? databases[0], [databaseTarget]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.deploymentTarget) setDeploymentTarget(parsed.deploymentTarget);
      if (parsed.databaseTarget) setDatabaseTarget(parsed.databaseTarget);
      if (parsed.visibility) setVisibility(parsed.visibility);
      if (parsed.loginPolicy) setLoginPolicy(parsed.loginPolicy);
      if (parsed.publishChannel) setPublishChannel(parsed.publishChannel);
      setSavedNote(isCn ? "已读取上次工作区配置" : "Loaded previous workspace profile");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setWorkspaceSession((current) => ({ ...current, ...parsed }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ deploymentTarget, databaseTarget, visibility, loginPolicy, publishChannel })
      );
      window.localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...workspaceSession,
          routeId: "settings",
          routeLabel: isCn ? "环境设置" : "Environment settings",
          filePath: "app/settings/page.tsx",
          lastAction: isCn ? "更新部署、数据库与权限策略" : "Updated deployment, database, and access policy",
          readiness: publishChannel,
        })
      );
      setSavedNote(isCn ? "已同步到工作区" : "Synced to workspace");
    } catch {}
  }, [SESSION_KEY, STORAGE_KEY, databaseTarget, deploymentTarget, isCn, loginPolicy, publishChannel, visibility, workspaceSession]);

  const sessionContext = [
    { label: isCn ? "当前模板" : "Current template", value: workspaceSession.selectedTemplateName },
    { label: isCn ? "当前套餐" : "Current plan", value: workspaceSession.selectedPlanName },
    { label: isCn ? "最近页面" : "Recent page", value: workspaceSession.routeLabel },
    { label: isCn ? "最近动作" : "Last action", value: workspaceSession.lastAction },
    { label: isCn ? "目标文件" : "Target file", value: workspaceSession.filePath },
  ];
  const envSignals = [
    { label: isCn ? "部署" : "Deploy", value: deploymentCard.name, tone: "#8b5cf6" },
    { label: isCn ? "数据库" : "Database", value: databaseCard.name, tone: "#22c55e" },
    { label: isCn ? "发布通道" : "Publish lane", value: publishChannel, tone: "#38bdf8" },
    { label: isCn ? "可见性" : "Visibility", value: visibility, tone: "#f59e0b" },
  ];

  return (
    <main style={{ minHeight: "100vh", background: "#12131a", color: "#f8fafc", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gap: 16 }}>
        <section style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.16), transparent 28%), #17181f", padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(124,58,237,0.2)", color: "#d8b4fe", fontSize: 12, fontWeight: 800 }}>
                {isCn ? "环境策略中心" : "Environment policy center"}
              </div>
              <h1 style={{ margin: "14px 0 8px", fontSize: 30, fontWeight: 900 }}>
                {isCn ? "把部署、数据库与发布策略放回统一控制平面" : "Bring deployment, database, and release strategy back into the shared control plane"}
              </h1>
              <p style={{ margin: 0, maxWidth: 860, color: "rgba(255,255,255,0.56)", lineHeight: 1.8 }}>
                {isCn ? "环境配置不该只是单页表单，而要和 Preview、Dashboard、Code、Runs 一起讲同一条应用生成与发布故事。" : "Environment settings should not live as a standalone form. They need to stay aligned with Preview, Dashboard, Code, and Runs inside the same app-generation and release story."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/runs" style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", background: "#8b5cf6", color: "#ffffff", fontWeight: 800 }}>
                {isCn ? "查看运行链路" : "Open runs"}
              </Link>
              <Link href="/pricing" style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.08)", color: "#f8fafc", fontWeight: 700 }}>
                {isCn ? "同步套餐策略" : "Sync pricing"}
              </Link>
            </div>
          </div>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
            {envSignals.map((item) => (
              <div key={item.label} style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.06)", background: "#1b1c24", padding: 16 }}>
                <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 12 }}>{item.label}</div>
                <div style={{ marginTop: 10, fontSize: 22, fontWeight: 900, color: item.tone }}>{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ borderRadius: 24, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#17181f" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#9333ea)", display: "grid", placeItems: "center", fontSize: 20 }}>✦</div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>{${JSON.stringify(brand)}}</div>
              <div style={{ borderRadius: 10, padding: "6px 10px", background: "rgba(124,58,237,0.2)", color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>${getCompactPlanTag(spec.planTier)}</div>
            </div>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 6, borderRadius: 18, background: "#11131a", border: "1px solid rgba(255,255,255,0.08)" }}>
                {workspaceSurfaceLinks.map((item) => (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 16px", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.6)", background: item.active ? "rgba(124,58,237,0.22)" : "transparent", fontSize: 14, fontWeight: 800 }}>
                    {item.label}
                  </Link>
                ))}
              </div>
              <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 12 }}>
                {isCn ? "设置、运行、模板与升级已收进 Overview，避免打散主工作区。" : "Settings, runs, templates, and pricing are moved into Overview to keep the main surface focused."}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "40px 320px minmax(0,1fr)", minHeight: "calc(100vh - 150px)" }}>
            <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "#14151c", padding: "12px 0", display: "grid", alignContent: "start", gap: 10 }}>
              {activityRail.map((item) => (
                <div key={item.label} title={item.label} style={{ width: 28, height: 28, borderRadius: 9, background: item.active ? "rgba(124,58,237,0.22)" : "transparent", color: item.active ? "#c4b5fd" : "rgba(255,255,255,0.42)", margin: "0 auto", display: "grid", placeItems: "center", fontSize: 13 }}>
                  {item.icon}
                </div>
              ))}
            </div>

            <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "#17181f", padding: 14, display: "grid", alignContent: "start", gap: 14, maxHeight: "calc(100vh - 150px)", overflowY: "auto" }}>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "AI 助手" : "AI Assistant"}</div>
                <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900 }}>{isCn ? "左侧共创对话" : "Left copilot thread"}</div>
              </div>

              <div style={{ borderRadius: 18, background: "#1f212c", padding: 16 }}>
                <div style={{ color: "#a78bfa", fontWeight: 800, marginBottom: 10 }}>{isCn ? "环境叙事" : "Environment narrative"}</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {copilotNotes.map((item, index) => (
                    <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 1.7 }}>
                      {item}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(255,255,255,0.08)", color: "#e9d5ff", fontSize: 12, fontWeight: 700 }}>
                  {savedNote}
                </div>
              </div>

              <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "当前工作区联动" : "Current workspace linkage"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {sessionContext.map((item) => (
                    <div key={item.label} style={{ borderRadius: 12, background: "#232533", padding: "12px 14px" }}>
                      <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{item.label}</div>
                      <div style={{ marginTop: 8, fontWeight: 800, lineHeight: 1.7 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "环境会影响什么" : "What the environment changes"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {[
                    isCn ? "部署目标会影响 preview、runtime 和正式上线链路" : "Deployment target changes preview, runtime, and production release paths",
                    isCn ? "数据库目标会改变 auth、结构化数据和演示数据假设" : "Database choice reshapes auth, structured data, and demo data assumptions",
                    isCn ? "发布通道会继续影响独立访问地址与交付说明" : "Publish lane continues into app address strategy and delivery notes",
                  ].map((item, index) => (
                    <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 1.7 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", minHeight: 0 }}>
              <div style={{ padding: 16, display: "grid", alignContent: "start", gap: 16, maxHeight: "calc(100vh - 150px)", overflowY: "auto", background: "#14151b" }}>
                <section style={{ borderRadius: 22, border: "1px solid rgba(124,58,237,0.18)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.16), transparent 32%), #1b1827", padding: 20 }}>
                  <div style={{ fontSize: 12, color: "#d8b4fe", fontWeight: 800 }}>{isCn ? "环境与权限设置" : "Environment and access settings"}</div>
                  <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{isCn ? "先锁环境策略，再生成可持续使用的应用" : "Lock environment policy first, then generate an app that can actually be used"}</div>
                  <div style={{ marginTop: 10, color: "rgba(255,255,255,0.62)", lineHeight: 1.8 }}>
                    {isCn ? "这里会继续决定默认部署、数据库、访问权限和发布路径，让产物更像真正应用，而不只是几张页面。" : "These choices shape deployment defaults, database assumptions, access policy, and release flow so the generated result behaves like a real app instead of just a few pages."}
                  </div>
                </section>

                <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
                  <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "部署目标" : "Deployment target"}</div>
                    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                      {deployments.map((item) => (
                        <button key={item.id} onClick={() => setDeploymentTarget(item.id)} style={{ borderRadius: 14, padding: "12px 14px", background: deploymentTarget === item.id ? "rgba(124,58,237,0.18)" : "#232533", color: deploymentTarget === item.id ? "#e9d5ff" : "rgba(255,255,255,0.68)", border: "none", cursor: "pointer", textAlign: "left" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                            <div style={{ fontWeight: 800 }}>{item.name}</div>
                            <div style={{ borderRadius: 999, background: "rgba(255,255,255,0.08)", padding: "4px 8px", fontSize: 11 }}>{item.badge}</div>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.7 }}>{item.note}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "数据库目标" : "Database target"}</div>
                    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                      {databases.map((item) => (
                        <button key={item.id} onClick={() => setDatabaseTarget(item.id)} style={{ borderRadius: 14, padding: "12px 14px", background: databaseTarget === item.id ? "rgba(124,58,237,0.18)" : "#232533", color: databaseTarget === item.id ? "#e9d5ff" : "rgba(255,255,255,0.68)", border: "none", cursor: "pointer", textAlign: "left" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                            <div style={{ fontWeight: 800 }}>{item.name}</div>
                            <div style={{ borderRadius: 999, background: "rgba(255,255,255,0.08)", padding: "4px 8px", fontSize: 11 }}>{item.badge}</div>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.7 }}>{item.note}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
                  {[
                    {
                      title: isCn ? "可见性" : "Visibility",
                      value: visibility,
                      options: [
                        { key: "private", label: isCn ? "私有" : "Private" },
                        { key: "team", label: isCn ? "团队" : "Team" },
                        { key: "public", label: isCn ? "公开" : "Public" },
                      ],
                      action: setVisibility,
                    },
                    {
                      title: isCn ? "登录策略" : "Login policy",
                      value: loginPolicy,
                      options: [
                        { key: "password", label: isCn ? "邮箱密码" : "Password" },
                        { key: "oauth", label: "OAuth" },
                        { key: "hybrid", label: isCn ? "混合" : "Hybrid" },
                      ],
                      action: setLoginPolicy,
                    },
                    {
                      title: isCn ? "发布通道" : "Publish lane",
                      value: publishChannel,
                      options: [
                        { key: "preview", label: isCn ? "预览" : "Preview" },
                        { key: "staging", label: "Staging" },
                        { key: "production", label: isCn ? "生产" : "Production" },
                      ],
                      action: setPublishChannel,
                    },
                  ].map((group) => (
                    <div key={group.title} style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{group.title}</div>
                      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                        {group.options.map((item) => (
                          <button key={item.key} onClick={() => group.action(item.key)} style={{ borderRadius: 12, padding: "10px 12px", background: group.value === item.key ? "rgba(124,58,237,0.18)" : "#232533", color: group.value === item.key ? "#e9d5ff" : "rgba(255,255,255,0.68)", border: "none", cursor: "pointer", textAlign: "left", fontWeight: 700 }}>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>

                <section style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 16 }}>
                  <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "当前生成决策" : "Current generation decision"}</div>
                    <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                      <div style={{ borderRadius: 12, background: "#232533", padding: "12px 14px" }}>
                        <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "部署" : "Deployment"}</div>
                        <div style={{ marginTop: 6, fontWeight: 800 }}>{deploymentCard.name}</div>
                        <div style={{ marginTop: 4, color: "rgba(255,255,255,0.56)", fontSize: 12, lineHeight: 1.7 }}>{deploymentCard.note}</div>
                      </div>
                      <div style={{ borderRadius: 12, background: "#232533", padding: "12px 14px" }}>
                        <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "数据库" : "Database"}</div>
                        <div style={{ marginTop: 6, fontWeight: 800 }}>{databaseCard.name}</div>
                        <div style={{ marginTop: 4, color: "rgba(255,255,255,0.56)", fontSize: 12, lineHeight: 1.7 }}>{databaseCard.note}</div>
                      </div>
                      <div style={{ borderRadius: 12, background: "rgba(124,58,237,0.14)", border: "1px solid rgba(124,58,237,0.2)", padding: "12px 14px" }}>
                        <div style={{ fontWeight: 800 }}>{isCn ? "生成结果预期" : "Expected output behavior"}</div>
                        <div style={{ marginTop: 6, color: "rgba(255,255,255,0.62)", fontSize: 13, lineHeight: 1.8 }}>
                          {isCn ? "后续生成器会根据这里的选择决定默认登录链路、数据库适配、部署文案、发布通道与独立访问地址策略。" : "The generator will continue using these choices to shape auth defaults, database assumptions, deployment copy, publish flow, and the future app-address strategy."}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "下一步动作" : "Suggested next actions"}</div>
                    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                      {nextSteps.map((item, index) => (
                        <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.66)", fontSize: 12, lineHeight: 1.8 }}>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>

              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#11131a", padding: 16, display: "grid", alignContent: "start", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "Overview 总览" : "Overview"}</div>
                    <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: "#f8fafc" }}>
                      {isCn ? "Preview、Dashboard 与 Settings 共用同一条工作区线索" : "Preview, Dashboard, and Settings stay on one workspace thread"}
                    </div>
                  </div>
                  <Link href="/dashboard" style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: "rgba(124,58,237,0.18)", color: "#e9d5ff", fontWeight: 800, fontSize: 12 }}>
                    Dashboard
                  </Link>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {workspaceSurfaceLinks.map((item) => (
                    <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "rgba(124,58,237,0.22)" : "#1b1c24", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 700 }}>
                      {item.label}
                    </Link>
                  ))}
                </div>

                <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                  <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "工作区面板" : "Workspace panels"}</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {workspacePanelLinks.map((item) => (
                      <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: item.active ? "rgba(124,58,237,0.18)" : "#232533", color: item.active ? "#e9d5ff" : "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 700 }}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                  <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "当前工作区焦点" : "Current workspace focus"}</div>
                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    {sessionContext.map((item) => (
                      <div key={item.label} style={{ borderRadius: 10, background: "#232533", padding: "8px 10px" }}>
                        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{item.label}</div>
                        <div style={{ marginTop: 4, color: "rgba(255,255,255,0.72)", fontSize: 12, lineHeight: 1.7 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1b1c24", padding: 14 }}>
                  <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 12 }}>{isCn ? "当前发布策略" : "Current release policy"}</div>
                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    {[
                      (isCn ? "发布通道" : "Publish lane") + ": " + publishChannel,
                      (isCn ? "可见性" : "Visibility") + ": " + visibility,
                      (isCn ? "登录策略" : "Login") + ": " + loginPolicy,
                      isCn ? "独立访问地址策略: 待继续实现" : "App address strategy: to be implemented next",
                    ].map((item) => (
                      <div key={item} style={{ borderRadius: 10, background: "#232533", padding: "8px 10px", fontSize: 12, color: "rgba(255,255,255,0.68)" }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderRadius: 14, background: "rgba(124,58,237,0.14)", border: "1px solid rgba(124,58,237,0.22)", padding: 14 }}>
                  <div style={{ color: "#c4b5fd", fontWeight: 800, fontSize: 12 }}>{isCn ? "下一步动作" : "Next actions"}</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {nextSteps.map((item, index) => (
                      <div key={item} style={{ borderRadius: 10, background: index === 0 ? "rgba(124,58,237,0.14)" : "#232533", padding: "8px 10px", color: "rgba(255,255,255,0.74)", fontSize: 12, lineHeight: 1.7 }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
`
}

type TaskWorkbenchScene =
  | "task_manager"
  | "crm"
  | "admin_ops"
  | "support"
  | "education"
  | "finance"
  | "recruiting"
  | "commerce_ops"

type TaskWorkbenchProfile = {
  scene: TaskWorkbenchScene
  heroEyebrow: string
  heroTitle: string
  heroSubtitle: string
  nav: { overview: string; tasks: string; analytics: string }
  stats: Array<{ label: string; value: string; note: string }>
  searchPlaceholder: string
  boardLabel: string
  listLabel: string
  addButton: string
  titlePlaceholder: string
  ownerPlaceholder: string
  descPlaceholder: string
  progressTitle: string
  progressItems: string[]
  currentObjectLabel: string
  currentObjectTitle: string
  currentObjectNote: string
  currentObjectTag: string
  pageRoleTitle: string
  pageRoleBody: string
  backLabel: string
  chartTitle: string
  chartSubtitle: string
  chartModes: {
    primary: string
    secondary: string
    tertiary: string
    quaternary: string
  }
  chartSeriesLabel: string
  chartBreakdownLabel: string
  chartProgressLabel: string
  chartHierarchyLabel: string
  chartSummary: {
    primaryMetricLabel: string
    secondaryMetricLabel: string
    tertiaryMetricLabel: string
    quaternaryMetricLabel: string
  }
  workflowLabels: {
    create: string
    progress: string
    done: string
    focus: string
  }
  initialRows: Array<{
    id: string
    title: string
    desc: string
    status: "todo" | "doing" | "done"
    owner: string
    priority: "low" | "medium" | "high"
  }>
}

function shouldRenderTaskWorkbench(spec: Pick<AppSpec, "prompt" | "title" | "kind" | "templateId">) {
  if (spec.kind === "code_platform") return false
  const text = String(spec.prompt ?? spec.title ?? "").toLowerCase()
  if (looksLikeCodePlatformPrompt(text) || looksLikeMarketingDistributionPrompt(text) || looksLikeCommunityPrompt(text) || looksLikeApiPlatformPrompt(text)) {
    return false
  }
  if (spec.templateId === "opsdesk" || spec.templateId === "taskflow") return true
  if (isAdminOpsTaskSpec(spec)) return true
  if (inferDomainFlavor(text) !== "general") return true
  return /\btask\b|\btasks\b|todo|to-do|workflow|kanban|board|queue|任务|待办|看板|工单|事项|流程|进度/.test(text)
}

function getTaskWorkbenchScene(spec: AppSpec): TaskWorkbenchScene {
  const text = String(spec.prompt ?? spec.title ?? "").toLowerCase()
  if (isAdminOpsTaskSpec(spec)) return "admin_ops"
  const flavor = inferDomainFlavor(text)
  if (flavor === "support") return "support"
  if (flavor === "education") return "education"
  if (flavor === "finance") return "finance"
  if (flavor === "recruiting") return "recruiting"
  if (flavor === "commerce_ops") return "commerce_ops"
  if (getScaffoldArchetype(spec) === "crm") return "crm"
  return "task_manager"
}

function getTaskWorkbenchProfile(spec: AppSpec): TaskWorkbenchProfile {
  const isCn = spec.region === "cn"
  const scene = getTaskWorkbenchScene(spec)
  const profiles: Record<TaskWorkbenchScene, Omit<TaskWorkbenchProfile, "scene">> = {
    task_manager: isCn
      ? {
          heroEyebrow: "任务管理工作台",
          heroTitle: "把任务、进度和责任人放进同一个可操作工作台。",
          heroSubtitle: "这一页可以直接新建任务、切换看板与列表、推进状态，不再只是演示卡片。",
          nav: { overview: "概览", tasks: "任务", analytics: "分析" },
          stats: [
            { label: "待处理", value: "18", note: "还有 6 条任务今天需要推进" },
            { label: "进行中", value: "9", note: "跨团队协作正在推进" },
            { label: "已完成", value: "14", note: "本周已收尾的工作项" },
          ],
          searchPlaceholder: "搜索任务、负责人或标签...",
          boardLabel: "看板",
          listLabel: "列表",
          addButton: "新建任务",
          titlePlaceholder: "输入任务标题...",
          ownerPlaceholder: "负责人",
          descPlaceholder: "添加任务描述...",
          progressTitle: "推进路径",
          progressItems: ["收集需求", "拆分任务", "推进执行", "复盘交付"],
          currentObjectLabel: "当前对象",
          currentObjectTitle: "任务流",
          currentObjectNote: "任务可以直接从看板推进到完成，不再只是展示。",
          currentObjectTag: "Tasks",
          pageRoleTitle: "页面角色",
          pageRoleBody: "这一页现在支持新建任务、切换看板与列表、推进状态和筛选搜索。",
          backLabel: "返回总览",
          chartTitle: "任务推进图谱",
          chartSubtitle: "看新增任务、状态分布、负责人负载和整体完成度是否一起变化。",
          chartModes: {
            primary: "进度条",
            secondary: "饼图",
            tertiary: "柱状图",
            quaternary: "树状分布",
          },
          chartSeriesLabel: "任务走势",
          chartBreakdownLabel: "状态分布",
          chartProgressLabel: "完成进度",
          chartHierarchyLabel: "负责人负载",
          chartSummary: {
            primaryMetricLabel: "新增任务",
            secondaryMetricLabel: "完成率",
            tertiaryMetricLabel: "高优先级",
            quaternaryMetricLabel: "负责人",
          },
          workflowLabels: {
            create: "新建任务",
            progress: "推进状态",
            done: "标记完成",
            focus: "聚焦阻塞任务",
          },
          initialRows: [
            { id: "t1", title: "完成产品原型", desc: "把新需求拆成可执行任务", status: "doing", owner: "李雷", priority: "high" },
            { id: "t2", title: "整理 API 文档", desc: "补充接口说明和示例", status: "todo", owner: "王芳", priority: "medium" },
            { id: "t3", title: "用户调研回收", desc: "汇总访谈并输出结论", status: "done", owner: "赵敏", priority: "low" },
          ],
        }
      : {
          heroEyebrow: "Task management workspace",
          heroTitle: "Keep tasks, progress, and owners in one working surface.",
          heroSubtitle: "This page can create tasks, switch between board and list, and move status instead of staying a static mock.",
          nav: { overview: "Overview", tasks: "Tasks", analytics: "Analytics" },
          stats: [
            { label: "Queued", value: "18", note: "6 items need action today" },
            { label: "In progress", value: "9", note: "Cross-team work is moving" },
            { label: "Completed", value: "14", note: "Work items closed this week" },
          ],
          searchPlaceholder: "Search tasks, owners, or tags...",
          boardLabel: "Board",
          listLabel: "List",
          addButton: "New task",
          titlePlaceholder: "Task title",
          ownerPlaceholder: "Owner",
          descPlaceholder: "Task description...",
          progressTitle: "Progress path",
          progressItems: ["Collect needs", "Split tasks", "Execute", "Review"],
          currentObjectLabel: "Current object",
          currentObjectTitle: "Task flow",
          currentObjectNote: "Tasks can move from the board to done instead of staying decorative.",
          currentObjectTag: "Tasks",
          pageRoleTitle: "Page role",
          pageRoleBody: "This page now supports task creation, board/list toggles, status movement, and filtering.",
          backLabel: "Back to overview",
          chartTitle: "Task execution map",
          chartSubtitle: "Watch incoming work, status mix, owner load, and completion move together.",
          chartModes: {
            primary: "Progress",
            secondary: "Pie",
            tertiary: "Bar",
            quaternary: "Tree",
          },
          chartSeriesLabel: "Task flow",
          chartBreakdownLabel: "Status mix",
          chartProgressLabel: "Completion",
          chartHierarchyLabel: "Owner load",
          chartSummary: {
            primaryMetricLabel: "Incoming",
            secondaryMetricLabel: "Completion rate",
            tertiaryMetricLabel: "High priority",
            quaternaryMetricLabel: "Owners",
          },
          workflowLabels: {
            create: "Create task",
            progress: "Move status",
            done: "Mark done",
            focus: "Focus blocked work",
          },
          initialRows: [
            { id: "t1", title: "Finish product prototype", desc: "Break the new request into actionable tasks", status: "doing", owner: "Liam", priority: "high" },
            { id: "t2", title: "Document the API", desc: "Add endpoints and examples", status: "todo", owner: "Emma", priority: "medium" },
            { id: "t3", title: "Collect user research", desc: "Summarize interviews and findings", status: "done", owner: "Noah", priority: "low" },
          ],
        },
    crm: isCn
      ? {
          heroEyebrow: "销售任务工作台",
          heroTitle: "把跟进、报价、回访和交付衔接成一条销售任务流。",
          heroSubtitle: "这不是普通待办板，而是销售推进里的任务执行层。",
          nav: { overview: "概览", tasks: "任务", analytics: "分析" },
          stats: [
            { label: "待跟进", value: "24", note: "首轮沟通与复盘安排" },
            { label: "报价中", value: "11", note: "需要补齐方案与预算" },
            { label: "已签约", value: "7", note: "已进入交付和回访" },
          ],
          searchPlaceholder: "搜索线索、任务或负责人...",
          boardLabel: "看板",
          listLabel: "列表",
          addButton: "新建销售任务",
          titlePlaceholder: "输入销售任务...",
          ownerPlaceholder: "销售负责人",
          descPlaceholder: "添加跟进说明...",
          progressTitle: "推进路径",
          progressItems: ["线索识别", "首次沟通", "方案报价", "签约回访"],
          currentObjectLabel: "当前对象",
          currentObjectTitle: "销售推进",
          currentObjectNote: "任务会围绕客户推进、报价和回访展开。",
          currentObjectTag: "CRM",
          pageRoleTitle: "页面角色",
          pageRoleBody: "这一页承接销售任务、看板推进和回访节奏，不只是通用待办。",
          backLabel: "返回总览",
          chartTitle: "销售推进图谱",
          chartSubtitle: "线索跟进更适合看漏斗、阶段占比、团队负载和推进趋势。",
          chartModes: {
            primary: "漏斗条",
            secondary: "折线图",
            tertiary: "柱状图",
            quaternary: "饼图",
          },
          chartSeriesLabel: "跟进趋势",
          chartBreakdownLabel: "阶段占比",
          chartProgressLabel: "签约进度",
          chartHierarchyLabel: "负责人负载",
          chartSummary: {
            primaryMetricLabel: "新增线索",
            secondaryMetricLabel: "签约率",
            tertiaryMetricLabel: "高优先客户",
            quaternaryMetricLabel: "销售负责人",
          },
          workflowLabels: {
            create: "创建跟进",
            progress: "推进商机",
            done: "完成签约",
            focus: "聚焦高意向客户",
          },
          initialRows: [
            { id: "t1", title: "跟进重点客户", desc: "安排本周的首轮电话与演示", status: "doing", owner: "张伟", priority: "high" },
            { id: "t2", title: "整理报价方案", desc: "补齐版本、价格与交付说明", status: "todo", owner: "王芳", priority: "medium" },
            { id: "t3", title: "签约回访", desc: "确认合同和下一步交付", status: "done", owner: "李雷", priority: "low" },
          ],
        }
      : {
          heroEyebrow: "Sales task workspace",
          heroTitle: "Turn follow-ups, pricing, and handoff into one sales task flow.",
          heroSubtitle: "This is an execution rail for sales motions, not a generic todo board.",
          nav: { overview: "Overview", tasks: "Tasks", analytics: "Analytics" },
          stats: [
            { label: "To follow up", value: "24", note: "First-touch and review calls" },
            { label: "Pricing", value: "11", note: "Needs proposal and budget work" },
            { label: "Closed", value: "7", note: "Now in delivery and follow-up" },
          ],
          searchPlaceholder: "Search leads, tasks, or owners...",
          boardLabel: "Board",
          listLabel: "List",
          addButton: "New sales task",
          titlePlaceholder: "Task title",
          ownerPlaceholder: "Sales owner",
          descPlaceholder: "Add follow-up notes...",
          progressTitle: "Progress path",
          progressItems: ["Lead qualification", "First touch", "Proposal", "Close and handoff"],
          currentObjectLabel: "Current object",
          currentObjectTitle: "Sales motion",
          currentObjectNote: "Tasks are organized around customer motion, pricing, and handoff.",
          currentObjectTag: "CRM",
          pageRoleTitle: "Page role",
          pageRoleBody: "This page carries sales tasks, board movement, and follow-up cadence instead of a generic todo list.",
          backLabel: "Back to overview",
          chartTitle: "Sales motion board",
          chartSubtitle: "Track funnel progression, stage mix, owner load, and close trend from the same workflow state.",
          chartModes: {
            primary: "Funnel",
            secondary: "Line",
            tertiary: "Bar",
            quaternary: "Pie",
          },
          chartSeriesLabel: "Pipeline trend",
          chartBreakdownLabel: "Stage mix",
          chartProgressLabel: "Close progress",
          chartHierarchyLabel: "Owner load",
          chartSummary: {
            primaryMetricLabel: "New leads",
            secondaryMetricLabel: "Win rate",
            tertiaryMetricLabel: "Priority accounts",
            quaternaryMetricLabel: "Sales owners",
          },
          workflowLabels: {
            create: "Create follow-up",
            progress: "Advance deal",
            done: "Mark closed",
            focus: "Focus high-intent accounts",
          },
          initialRows: [
            { id: "t1", title: "Follow key accounts", desc: "Plan the first call and demo this week", status: "doing", owner: "Mia", priority: "high" },
            { id: "t2", title: "Prepare proposal", desc: "Add pricing, tier, and handoff notes", status: "todo", owner: "Alex", priority: "medium" },
            { id: "t3", title: "Closed-won follow-up", desc: "Confirm contract and next delivery step", status: "done", owner: "Jordan", priority: "low" },
          ],
        },
    admin_ops: isCn
      ? {
          heroEyebrow: "治理任务工作台",
          heroTitle: "把审批、权限、审计和告警同步到一条执行轨道里。",
          heroSubtitle: "这页更像内部控制面的任务执行层，而不是普通待办板。",
          nav: { overview: "概览", tasks: "任务", analytics: "分析" },
          stats: [
            { label: "待处理", value: "18", note: "审批与治理任务待推进" },
            { label: "审计事件", value: "92", note: "需要复核的留痕记录" },
            { label: "规则", value: "11", note: "权限与策略配置项" },
          ],
          searchPlaceholder: "搜索治理任务、审批或告警...",
          boardLabel: "看板",
          listLabel: "列表",
          addButton: "新建治理任务",
          titlePlaceholder: "输入治理任务...",
          ownerPlaceholder: "负责人",
          descPlaceholder: "补充任务说明...",
          progressTitle: "当前推进",
          progressItems: ["审批", "审计", "自动化", "复盘"],
          currentObjectLabel: "当前对象",
          currentObjectTitle: "控制平面",
          currentObjectNote: "审批、审计和团队治理已经放在同一条工作流里。",
          currentObjectTag: "Admin",
          pageRoleTitle: "页面角色",
          pageRoleBody: "这一页承接治理任务、状态推进和权限协同，不是静态展示。",
          backLabel: "返回总览",
          chartTitle: "治理执行图谱",
          chartSubtitle: "审批、审计和告警更适合看规则覆盖、事件趋势、恢复进度和责任人分布。",
          chartModes: {
            primary: "柱状图",
            secondary: "折线图",
            tertiary: "进度条",
            quaternary: "饼图",
          },
          chartSeriesLabel: "审计趋势",
          chartBreakdownLabel: "规则分布",
          chartProgressLabel: "恢复进度",
          chartHierarchyLabel: "责任归属",
          chartSummary: {
            primaryMetricLabel: "待审批",
            secondaryMetricLabel: "事件关闭率",
            tertiaryMetricLabel: "高风险",
            quaternaryMetricLabel: "治理负责人",
          },
          workflowLabels: {
            create: "创建治理动作",
            progress: "推进审批",
            done: "关闭事件",
            focus: "聚焦高风险策略",
          },
          initialRows: [
            { id: "t1", title: "复核访问策略", desc: "检查新环境的权限边界", status: "doing", owner: "张伟", priority: "high" },
            { id: "t2", title: "导出审计留痕", desc: "生成合规报表并归档", status: "todo", owner: "王芳", priority: "medium" },
            { id: "t3", title: "整理事件演练", desc: "补充告警和恢复步骤", status: "done", owner: "李雷", priority: "low" },
          ],
        }
      : {
          heroEyebrow: "Governance task workspace",
          heroTitle: "Keep approvals, access, audit, and alerts in one execution rail.",
          heroSubtitle: "This page feels like an internal control-plane task surface instead of a generic todo board.",
          nav: { overview: "Overview", tasks: "Tasks", analytics: "Analytics" },
          stats: [
            { label: "Queued", value: "18", note: "Governance items waiting to move" },
            { label: "Audit events", value: "92", note: "Records needing review" },
            { label: "Rules", value: "11", note: "Policy and access settings" },
          ],
          searchPlaceholder: "Search governance tasks, approvals, or alerts...",
          boardLabel: "Board",
          listLabel: "List",
          addButton: "New governance task",
          titlePlaceholder: "Task title",
          ownerPlaceholder: "Owner",
          descPlaceholder: "Add task details...",
          progressTitle: "Current progress",
          progressItems: ["Approval", "Audit", "Automation", "Review"],
          currentObjectLabel: "Current object",
          currentObjectTitle: "Control plane",
          currentObjectNote: "Approvals, audits, and team governance are now in the same workflow.",
          currentObjectTag: "Admin",
          pageRoleTitle: "Page role",
          pageRoleBody: "This page carries governance tasks, status movement, and permission collaboration instead of a static showcase.",
          backLabel: "Back to overview",
          chartTitle: "Governance execution board",
          chartSubtitle: "Use incident trend, rule coverage, recovery progress, and ownership mix to run the control plane.",
          chartModes: {
            primary: "Bar",
            secondary: "Line",
            tertiary: "Progress",
            quaternary: "Pie",
          },
          chartSeriesLabel: "Audit trend",
          chartBreakdownLabel: "Rule mix",
          chartProgressLabel: "Recovery progress",
          chartHierarchyLabel: "Ownership",
          chartSummary: {
            primaryMetricLabel: "Pending approvals",
            secondaryMetricLabel: "Closure rate",
            tertiaryMetricLabel: "High risk",
            quaternaryMetricLabel: "Governance owners",
          },
          workflowLabels: {
            create: "Create governance action",
            progress: "Advance approval",
            done: "Close incident",
            focus: "Focus risky policy",
          },
          initialRows: [
            { id: "t1", title: "Review access policy", desc: "Check permission boundaries for the new environment", status: "doing", owner: "Lena", priority: "high" },
            { id: "t2", title: "Export audit trail", desc: "Generate the compliance report and archive it", status: "todo", owner: "Mason", priority: "medium" },
            { id: "t3", title: "Incident drill prep", desc: "Add alert and recovery steps", status: "done", owner: "Sofia", priority: "low" },
          ],
        },
    support: isCn
      ? {
          heroEyebrow: "客服工单工作台",
          heroTitle: "把工单、升级和知识库处理放在同一个服务台里。",
          heroSubtitle: "任务不是普通待办，而是围绕客户问题和 SLA 的处理流。",
          nav: { overview: "概览", tasks: "工单", analytics: "分析" },
          stats: [
            { label: "待处理", value: "21", note: "需要优先响应的工单" },
            { label: "升级", value: "5", note: "需要团队协作处理" },
            { label: "已解决", value: "38", note: "本周关闭的客户请求" },
          ],
          searchPlaceholder: "搜索工单、客户或关键字...",
          boardLabel: "看板",
          listLabel: "列表",
          addButton: "新建工单",
          titlePlaceholder: "输入工单标题...",
          ownerPlaceholder: "处理人",
          descPlaceholder: "添加处理说明...",
          progressTitle: "处理路径",
          progressItems: ["收件", "分诊", "处理", "回访"],
          currentObjectLabel: "当前对象",
          currentObjectTitle: "服务台",
          currentObjectNote: "工单流、升级和知识沉淀要在同一页里完成。",
          currentObjectTag: "Support",
          pageRoleTitle: "页面角色",
          pageRoleBody: "这一页承接工单处理、状态推进和客户回访，不只是列表演示。",
          backLabel: "返回总览",
          chartTitle: "工单处理图谱",
          chartSubtitle: "SLA 更适合看队列、升级趋势、解决进度和问题分类。",
          chartModes: {
            primary: "柱状图",
            secondary: "折线图",
            tertiary: "饼图",
            quaternary: "进度条",
          },
          chartSeriesLabel: "工单走势",
          chartBreakdownLabel: "问题分类",
          chartProgressLabel: "解决进度",
          chartHierarchyLabel: "SLA 覆盖",
          chartSummary: {
            primaryMetricLabel: "新增工单",
            secondaryMetricLabel: "解决率",
            tertiaryMetricLabel: "升级工单",
            quaternaryMetricLabel: "响应人",
          },
          workflowLabels: {
            create: "创建工单",
            progress: "推进处理",
            done: "标记已解决",
            focus: "聚焦升级问题",
          },
          initialRows: [
            { id: "t1", title: "客户无法登录", desc: "排查账号和验证码状态", status: "doing", owner: "小王", priority: "high" },
            { id: "t2", title: "导出账单失败", desc: "检查权限和报表接口", status: "todo", owner: "小陈", priority: "medium" },
            { id: "t3", title: "问题已解决回访", desc: "确认工单关闭并记录知识库", status: "done", owner: "小李", priority: "low" },
          ],
        }
      : {
          heroEyebrow: "Support desk workspace",
          heroTitle: "Keep tickets, escalation, and knowledge in one service lane.",
          heroSubtitle: "Tasks here are support flows, not generic todos.",
          nav: { overview: "Overview", tasks: "Tickets", analytics: "Analytics" },
          stats: [
            { label: "Open", value: "21", note: "Tickets needing response" },
            { label: "Escalations", value: "5", note: "Need team collaboration" },
            { label: "Solved", value: "38", note: "Closed this week" },
          ],
          searchPlaceholder: "Search tickets, customers, or keywords...",
          boardLabel: "Board",
          listLabel: "List",
          addButton: "New ticket",
          titlePlaceholder: "Ticket title",
          ownerPlaceholder: "Agent",
          descPlaceholder: "Add resolution notes...",
          progressTitle: "Resolution path",
          progressItems: ["Intake", "Triage", "Resolve", "Follow up"],
          currentObjectLabel: "Current object",
          currentObjectTitle: "Service desk",
          currentObjectNote: "Ticket flow, escalation, and knowledge capture live together here.",
          currentObjectTag: "Support",
          pageRoleTitle: "Page role",
          pageRoleBody: "This page carries ticket handling, status movement, and customer follow-up instead of a demo list.",
          backLabel: "Back to overview",
          chartTitle: "Support operations map",
          chartSubtitle: "Run support from queue mix, escalation trend, issue categories, and resolution progress.",
          chartModes: {
            primary: "Bar",
            secondary: "Line",
            tertiary: "Pie",
            quaternary: "Progress",
          },
          chartSeriesLabel: "Ticket trend",
          chartBreakdownLabel: "Issue categories",
          chartProgressLabel: "Resolution progress",
          chartHierarchyLabel: "SLA coverage",
          chartSummary: {
            primaryMetricLabel: "New tickets",
            secondaryMetricLabel: "Resolution rate",
            tertiaryMetricLabel: "Escalations",
            quaternaryMetricLabel: "Agents",
          },
          workflowLabels: {
            create: "Create ticket",
            progress: "Advance resolution",
            done: "Mark solved",
            focus: "Focus escalations",
          },
          initialRows: [
            { id: "t1", title: "Customer login issue", desc: "Check account and OTP state", status: "doing", owner: "Ava", priority: "high" },
            { id: "t2", title: "Billing export failed", desc: "Inspect permission and report API", status: "todo", owner: "Ben", priority: "medium" },
            { id: "t3", title: "Solved issue follow-up", desc: "Confirm closure and capture knowledge", status: "done", owner: "Cora", priority: "low" },
          ],
        },
    education: isCn
      ? {
          heroEyebrow: "教务任务工作台",
          heroTitle: "把课程、作业和学生进度放在一条教务任务流里。",
          heroSubtitle: "每一个任务都对应课程推进、作业收集或学习反馈。",
          nav: { overview: "概览", tasks: "教务", analytics: "分析" },
          stats: [
            { label: "待批改", value: "17", note: "本周作业和测验" },
            { label: "课程中", value: "9", note: "正在推进的课程" },
            { label: "已完成", value: "28", note: "已归档的教务事项" },
          ],
          searchPlaceholder: "搜索课程、任务或学生...",
          boardLabel: "看板",
          listLabel: "列表",
          addButton: "新建教务任务",
          titlePlaceholder: "输入教务任务...",
          ownerPlaceholder: "教师/助教",
          descPlaceholder: "添加任务说明...",
          progressTitle: "推进路径",
          progressItems: ["排课", "布置作业", "批改反馈", "总结复盘"],
          currentObjectLabel: "当前对象",
          currentObjectTitle: "教务台",
          currentObjectNote: "课程推进、作业流转和学生反馈要一体化。",
          currentObjectTag: "Education",
          pageRoleTitle: "页面角色",
          pageRoleBody: "这一页承接教务任务、状态推进和课程协同，不只是通用待办。",
          backLabel: "返回总览",
          chartTitle: "教务推进图谱",
          chartSubtitle: "课程进度更适合看学习趋势、任务分布、完成进度和班级负载。",
          chartModes: {
            primary: "折线图",
            secondary: "柱状图",
            tertiary: "进度条",
            quaternary: "饼图",
          },
          chartSeriesLabel: "课程趋势",
          chartBreakdownLabel: "任务分布",
          chartProgressLabel: "学习进度",
          chartHierarchyLabel: "班级负载",
          chartSummary: {
            primaryMetricLabel: "课程任务",
            secondaryMetricLabel: "完成率",
            tertiaryMetricLabel: "待反馈",
            quaternaryMetricLabel: "教师",
          },
          workflowLabels: {
            create: "创建教务任务",
            progress: "推进课程",
            done: "标记已完成",
            focus: "聚焦待反馈班级",
          },
          initialRows: [
            { id: "t1", title: "安排课程进度", desc: "确认本周的授课安排", status: "doing", owner: "王老师", priority: "high" },
            { id: "t2", title: "批改作业", desc: "完成学生作业反馈", status: "todo", owner: "李老师", priority: "medium" },
            { id: "t3", title: "整理学情报告", desc: "输出班级学习总结", status: "done", owner: "赵老师", priority: "low" },
          ],
        }
      : {
          heroEyebrow: "Education task workspace",
          heroTitle: "Keep course work, assignments, and student progress in one flow.",
          heroSubtitle: "Tasks here map to class operations, assignments, or learning feedback.",
          nav: { overview: "Overview", tasks: "Classes", analytics: "Analytics" },
          stats: [
            { label: "To grade", value: "17", note: "Assignments and quizzes this week" },
            { label: "In course", value: "9", note: "Classes in motion" },
            { label: "Closed", value: "28", note: "Archived school ops" },
          ],
          searchPlaceholder: "Search courses, tasks, or students...",
          boardLabel: "Board",
          listLabel: "List",
          addButton: "New school task",
          titlePlaceholder: "Task title",
          ownerPlaceholder: "Teacher / TA",
          descPlaceholder: "Add task details...",
          progressTitle: "Progress path",
          progressItems: ["Schedule", "Assign work", "Feedback", "Review"],
          currentObjectLabel: "Current object",
          currentObjectTitle: "Academic ops",
          currentObjectNote: "Course work, assignments, and student feedback stay in one place.",
          currentObjectTag: "Education",
          pageRoleTitle: "Page role",
          pageRoleBody: "This page carries school tasks, status movement, and class coordination instead of a generic todo list.",
          backLabel: "Back to overview",
          chartTitle: "Academic operations board",
          chartSubtitle: "Track class progress, workload mix, completion progress, and teacher coverage from one state model.",
          chartModes: {
            primary: "Line",
            secondary: "Bar",
            tertiary: "Progress",
            quaternary: "Pie",
          },
          chartSeriesLabel: "Class trend",
          chartBreakdownLabel: "Workload mix",
          chartProgressLabel: "Learning progress",
          chartHierarchyLabel: "Class coverage",
          chartSummary: {
            primaryMetricLabel: "Course tasks",
            secondaryMetricLabel: "Completion rate",
            tertiaryMetricLabel: "Pending feedback",
            quaternaryMetricLabel: "Teachers",
          },
          workflowLabels: {
            create: "Create school task",
            progress: "Advance class work",
            done: "Mark complete",
            focus: "Focus pending feedback",
          },
          initialRows: [
            { id: "t1", title: "Plan the course schedule", desc: "Confirm this week's teaching plan", status: "doing", owner: "Ms. Wang", priority: "high" },
            { id: "t2", title: "Grade assignments", desc: "Complete student feedback", status: "todo", owner: "Mr. Li", priority: "medium" },
            { id: "t3", title: "Summarize learning report", desc: "Publish the class learning summary", status: "done", owner: "Ms. Zhao", priority: "low" },
          ],
        },
    finance: isCn
      ? {
          heroEyebrow: "财务任务工作台",
          heroTitle: "把对账、审核和异常处理放在同一条财务任务流里。",
          heroSubtitle: "任务对应账本、交易、对账和异常，而不是普通待办。",
          nav: { overview: "概览", tasks: "财务", analytics: "分析" },
          stats: [
            { label: "待对账", value: "15", note: "需要核对的交易" },
            { label: "异常", value: "4", note: "差异待复核" },
            { label: "已完成", value: "31", note: "本周财务事项" },
          ],
          searchPlaceholder: "搜索账目、任务或异常...",
          boardLabel: "看板",
          listLabel: "列表",
          addButton: "新建财务任务",
          titlePlaceholder: "输入财务任务...",
          ownerPlaceholder: "财务负责人",
          descPlaceholder: "添加核对说明...",
          progressTitle: "推进路径",
          progressItems: ["收集单据", "核对差异", "审批确认", "归档报表"],
          currentObjectLabel: "当前对象",
          currentObjectTitle: "财务台",
          currentObjectNote: "任务要围绕账本、交易与对账节奏展开。",
          currentObjectTag: "Finance",
          pageRoleTitle: "页面角色",
          pageRoleBody: "这一页承接财务任务、状态推进和异常处理，不是装饰性的报表页。",
          backLabel: "返回总览",
          chartTitle: "财务执行图谱",
          chartSubtitle: "财务流更适合看异常趋势、任务分布、核对进度和责任归属。",
          chartModes: {
            primary: "柱状图",
            secondary: "折线图",
            tertiary: "饼图",
            quaternary: "进度条",
          },
          chartSeriesLabel: "异常趋势",
          chartBreakdownLabel: "账目分布",
          chartProgressLabel: "核对进度",
          chartHierarchyLabel: "责任归属",
          chartSummary: {
            primaryMetricLabel: "待核对",
            secondaryMetricLabel: "完成率",
            tertiaryMetricLabel: "差异项目",
            quaternaryMetricLabel: "财务负责人",
          },
          workflowLabels: {
            create: "创建财务任务",
            progress: "推进核对",
            done: "归档完成",
            focus: "聚焦异常账目",
          },
          initialRows: [
            { id: "t1", title: "核对付款流水", desc: "检查当日入账和出账差异", status: "doing", owner: "周财务", priority: "high" },
            { id: "t2", title: "整理报销单", desc: "补齐附件并审批", status: "todo", owner: "林财务", priority: "medium" },
            { id: "t3", title: "输出月报", desc: "完成月度财务总结", status: "done", owner: "孙财务", priority: "low" },
          ],
        }
      : {
          heroEyebrow: "Finance task workspace",
          heroTitle: "Keep reconciliation, review, and exception handling in one finance flow.",
          heroSubtitle: "Tasks here map to ledger work, transactions, reconciliation, and exceptions.",
          nav: { overview: "Overview", tasks: "Finance", analytics: "Analytics" },
          stats: [
            { label: "To reconcile", value: "15", note: "Transactions to verify" },
            { label: "Exceptions", value: "4", note: "Variance review needed" },
            { label: "Closed", value: "31", note: "This week's finance ops" },
          ],
          searchPlaceholder: "Search ledger items, tasks, or exceptions...",
          boardLabel: "Board",
          listLabel: "List",
          addButton: "New finance task",
          titlePlaceholder: "Task title",
          ownerPlaceholder: "Finance owner",
          descPlaceholder: "Add verification notes...",
          progressTitle: "Progress path",
          progressItems: ["Collect docs", "Match differences", "Approve", "Archive"],
          currentObjectLabel: "Current object",
          currentObjectTitle: "Finance desk",
          currentObjectNote: "Tasks should follow ledger, transaction, and reconciliation rhythm.",
          currentObjectTag: "Finance",
          pageRoleTitle: "Page role",
          pageRoleBody: "This page carries finance tasks, status movement, and exception handling rather than decorative reporting.",
          backLabel: "Back to overview",
          chartTitle: "Finance execution board",
          chartSubtitle: "Run reconciliation from variance trend, task mix, exception load, and archive progress.",
          chartModes: {
            primary: "Bar",
            secondary: "Line",
            tertiary: "Pie",
            quaternary: "Progress",
          },
          chartSeriesLabel: "Variance trend",
          chartBreakdownLabel: "Ledger mix",
          chartProgressLabel: "Reconciliation progress",
          chartHierarchyLabel: "Ownership",
          chartSummary: {
            primaryMetricLabel: "To reconcile",
            secondaryMetricLabel: "Completion rate",
            tertiaryMetricLabel: "Exception items",
            quaternaryMetricLabel: "Finance owners",
          },
          workflowLabels: {
            create: "Create finance task",
            progress: "Advance reconciliation",
            done: "Archive complete",
            focus: "Focus exceptions",
          },
          initialRows: [
            { id: "t1", title: "Match payment feed", desc: "Check today’s incoming and outgoing differences", status: "doing", owner: "Finance Ops", priority: "high" },
            { id: "t2", title: "Process reimbursements", desc: "Attach receipts and route approval", status: "todo", owner: "Finance Ops", priority: "medium" },
            { id: "t3", title: "Publish monthly report", desc: "Finish the monthly finance summary", status: "done", owner: "Finance Ops", priority: "low" },
          ],
        },
    recruiting: isCn
      ? {
          heroEyebrow: "招聘任务工作台",
          heroTitle: "把候选人、面试和录用动作放进同一条招聘任务流。",
          heroSubtitle: "任务不是待办，而是招聘流程里的动作执行层。",
          nav: { overview: "概览", tasks: "招聘", analytics: "分析" },
          stats: [
            { label: "候选人", value: "23", note: "正在推进面试" },
            { label: "待安排", value: "8", note: "面试和反馈要同步" },
            { label: "已录用", value: "4", note: "本周完成录用" },
          ],
          searchPlaceholder: "搜索候选人、任务或岗位...",
          boardLabel: "看板",
          listLabel: "列表",
          addButton: "新建招聘任务",
          titlePlaceholder: "输入招聘任务...",
          ownerPlaceholder: "招聘负责人",
          descPlaceholder: "添加面试说明...",
          progressTitle: "推进路径",
          progressItems: ["筛选简历", "安排面试", "发放 Offer", "入职跟进"],
          currentObjectLabel: "当前对象",
          currentObjectTitle: "招聘台",
          currentObjectNote: "候选人推进、面试协同和录用动作需要一页完成。",
          currentObjectTag: "Recruiting",
          pageRoleTitle: "页面角色",
          pageRoleBody: "这一页承接招聘任务、状态推进和协同安排，不只是一个列表。",
          backLabel: "返回总览",
          chartTitle: "招聘推进图谱",
          chartSubtitle: "招聘流程更适合看候选人漏斗、阶段负载、推进趋势和入职进度。",
          chartModes: {
            primary: "漏斗条",
            secondary: "柱状图",
            tertiary: "折线图",
            quaternary: "进度条",
          },
          chartSeriesLabel: "候选人趋势",
          chartBreakdownLabel: "阶段负载",
          chartProgressLabel: "录用进度",
          chartHierarchyLabel: "岗位分布",
          chartSummary: {
            primaryMetricLabel: "候选人",
            secondaryMetricLabel: "录用率",
            tertiaryMetricLabel: "待安排面试",
            quaternaryMetricLabel: "招聘负责人",
          },
          workflowLabels: {
            create: "创建招聘任务",
            progress: "推进候选人",
            done: "完成录用",
            focus: "聚焦关键岗位",
          },
          initialRows: [
            { id: "t1", title: "筛选简历", desc: "整理本周候选人池", status: "doing", owner: "HR 小张", priority: "high" },
            { id: "t2", title: "安排面试", desc: "同步面试官和时间", status: "todo", owner: "HR 小王", priority: "medium" },
            { id: "t3", title: "录用回访", desc: "确认入职和首周安排", status: "done", owner: "HR 小李", priority: "low" },
          ],
        }
      : {
          heroEyebrow: "Hiring task workspace",
          heroTitle: "Keep candidates, interviews, and offers in one hiring flow.",
          heroSubtitle: "Tasks here are hiring motions, not a plain todo list.",
          nav: { overview: "Overview", tasks: "Hiring", analytics: "Analytics" },
          stats: [
            { label: "Candidates", value: "23", note: "In interview motion" },
            { label: "Pending", value: "8", note: "Interviews and feedback sync" },
            { label: "Hired", value: "4", note: "Closed this week" },
          ],
          searchPlaceholder: "Search candidates, tasks, or roles...",
          boardLabel: "Board",
          listLabel: "List",
          addButton: "New hiring task",
          titlePlaceholder: "Task title",
          ownerPlaceholder: "Hiring owner",
          descPlaceholder: "Add interview notes...",
          progressTitle: "Progress path",
          progressItems: ["Screen resumes", "Schedule interviews", "Make offer", "Onboard"],
          currentObjectLabel: "Current object",
          currentObjectTitle: "Hiring desk",
          currentObjectNote: "Candidate motion, interview coordination, and hiring actions belong on one page.",
          currentObjectTag: "Recruiting",
          pageRoleTitle: "Page role",
          pageRoleBody: "This page carries hiring tasks, status movement, and scheduling coordination instead of a plain list.",
          backLabel: "Back to overview",
          chartTitle: "Hiring motion board",
          chartSubtitle: "Run recruiting from candidate funnel, stage load, offer progress, and hiring trend.",
          chartModes: {
            primary: "Funnel",
            secondary: "Bar",
            tertiary: "Line",
            quaternary: "Progress",
          },
          chartSeriesLabel: "Candidate trend",
          chartBreakdownLabel: "Stage load",
          chartProgressLabel: "Offer progress",
          chartHierarchyLabel: "Role mix",
          chartSummary: {
            primaryMetricLabel: "Candidates",
            secondaryMetricLabel: "Hire rate",
            tertiaryMetricLabel: "Pending interviews",
            quaternaryMetricLabel: "Hiring owners",
          },
          workflowLabels: {
            create: "Create hiring task",
            progress: "Advance candidate",
            done: "Mark hired",
            focus: "Focus key roles",
          },
          initialRows: [
            { id: "t1", title: "Screen resumes", desc: "Organize this week's candidate pool", status: "doing", owner: "HR", priority: "high" },
            { id: "t2", title: "Schedule interviews", desc: "Sync interviewers and time slots", status: "todo", owner: "HR", priority: "medium" },
            { id: "t3", title: "Offer follow-up", desc: "Confirm onboarding and first-week plan", status: "done", owner: "HR", priority: "low" },
          ],
        },
    commerce_ops: isCn
      ? {
          heroEyebrow: "履约任务工作台",
          heroTitle: "把库存、补货和发货动作放进同一条履约任务流。",
          heroSubtitle: "任务围绕订单履约、仓储和补货，而不是通用待办。",
          nav: { overview: "概览", tasks: "履约", analytics: "分析" },
          stats: [
            { label: "待发货", value: "12", note: "今天需要处理的订单" },
            { label: "补货", value: "5", note: "库存低位提醒" },
            { label: "已完成", value: "28", note: "已出库的履约动作" },
          ],
          searchPlaceholder: "搜索订单、任务或 SKU...",
          boardLabel: "看板",
          listLabel: "列表",
          addButton: "新建履约任务",
          titlePlaceholder: "输入履约任务...",
          ownerPlaceholder: "仓配负责人",
          descPlaceholder: "添加履约说明...",
          progressTitle: "推进路径",
          progressItems: ["拣货", "打包", "发货", "签收"],
          currentObjectLabel: "当前对象",
          currentObjectTitle: "履约台",
          currentObjectNote: "库存、补货和发货要在同一页协同处理。",
          currentObjectTag: "Commerce",
          pageRoleTitle: "页面角色",
          pageRoleBody: "这一页承接履约任务、状态推进和仓配协作，不只是静态列表。",
          backLabel: "返回总览",
          chartTitle: "履约执行图谱",
          chartSubtitle: "履约更适合看库存压力、发货趋势、状态分布和交付进度。",
          chartModes: {
            primary: "柱状图",
            secondary: "折线图",
            tertiary: "饼图",
            quaternary: "进度条",
          },
          chartSeriesLabel: "发货趋势",
          chartBreakdownLabel: "状态分布",
          chartProgressLabel: "交付进度",
          chartHierarchyLabel: "SKU 负载",
          chartSummary: {
            primaryMetricLabel: "待发货",
            secondaryMetricLabel: "完成率",
            tertiaryMetricLabel: "低库存",
            quaternaryMetricLabel: "仓配负责人",
          },
          workflowLabels: {
            create: "创建履约任务",
            progress: "推进出库",
            done: "标记已签收",
            focus: "聚焦低库存 SKU",
          },
          initialRows: [
            { id: "t1", title: "处理今日订单", desc: "安排优先发货和跟踪", status: "doing", owner: "仓配", priority: "high" },
            { id: "t2", title: "检查库存低位", desc: "确认补货和供应商协同", status: "todo", owner: "仓配", priority: "medium" },
            { id: "t3", title: "出库复盘", desc: "完成出库记录和异常处理", status: "done", owner: "仓配", priority: "low" },
          ],
        }
      : {
          heroEyebrow: "Fulfillment task workspace",
          heroTitle: "Keep inventory, replenishment, and shipping in one fulfillment flow.",
          heroSubtitle: "Tasks here are fulfillment motions rather than generic todos.",
          nav: { overview: "Overview", tasks: "Fulfillment", analytics: "Analytics" },
          stats: [
            { label: "To ship", value: "12", note: "Orders to process today" },
            { label: "Replenishment", value: "5", note: "Low-stock alerts" },
            { label: "Closed", value: "28", note: "Fulfillment actions completed" },
          ],
          searchPlaceholder: "Search orders, tasks, or SKUs...",
          boardLabel: "Board",
          listLabel: "List",
          addButton: "New fulfillment task",
          titlePlaceholder: "Task title",
          ownerPlaceholder: "Ops owner",
          descPlaceholder: "Add fulfillment notes...",
          progressTitle: "Progress path",
          progressItems: ["Pick", "Pack", "Ship", "Delivered"],
          currentObjectLabel: "Current object",
          currentObjectTitle: "Fulfillment desk",
          currentObjectNote: "Inventory, replenishment, and shipping should all live on one page.",
          currentObjectTag: "Commerce",
          pageRoleTitle: "Page role",
          pageRoleBody: "This page carries fulfillment tasks, status movement, and warehouse collaboration instead of a static list.",
          backLabel: "Back to overview",
          chartTitle: "Fulfillment operations board",
          chartSubtitle: "Track shipment trend, stock pressure, status mix, and delivery progress from live fulfillment state.",
          chartModes: {
            primary: "Bar",
            secondary: "Line",
            tertiary: "Pie",
            quaternary: "Progress",
          },
          chartSeriesLabel: "Shipment trend",
          chartBreakdownLabel: "Status mix",
          chartProgressLabel: "Delivery progress",
          chartHierarchyLabel: "SKU load",
          chartSummary: {
            primaryMetricLabel: "To ship",
            secondaryMetricLabel: "Completion rate",
            tertiaryMetricLabel: "Low stock",
            quaternaryMetricLabel: "Ops owners",
          },
          workflowLabels: {
            create: "Create fulfillment task",
            progress: "Advance shipment",
            done: "Mark delivered",
            focus: "Focus low-stock SKUs",
          },
          initialRows: [
            { id: "t1", title: "Process today's orders", desc: "Prioritize shipping and tracking", status: "doing", owner: "Ops", priority: "high" },
            { id: "t2", title: "Check low stock", desc: "Confirm replenishment and vendor sync", status: "todo", owner: "Ops", priority: "medium" },
            { id: "t3", title: "Outbound review", desc: "Finish logs and exceptions", status: "done", owner: "Ops", priority: "low" },
          ],
        },
  }
  return { scene, ...profiles[scene] }
}

function renderTasksPage(spec: AppSpec) {
  if (shouldRenderTaskWorkbench(spec)) {
    return `// @ts-nocheck
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type TaskRow = {
  id: string;
  title: string;
  desc: string;
  status: "todo" | "doing" | "done";
  owner: string;
  priority: "low" | "medium" | "high";
};

export default function TasksEntryPage() {
  const isCn = ${spec.region === "cn" ? "true" : "false"};
  const profile = ${JSON.stringify(getTaskWorkbenchProfile(spec), null, 2)} as const;
  const initialRows = profile.initialRows as TaskRow[];
  const [rows, setRows] = useState<TaskRow[]>(initialRows);
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftOwner, setDraftOwner] = useState("");
  const [draftPriority, setDraftPriority] = useState<TaskRow["priority"]>("medium");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = [row.title, row.desc, row.owner, row.status, row.priority].join(" ").toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }, [query, rows]);

  const grouped = useMemo(() => {
    return {
      todo: visible.filter((row) => row.status === "todo"),
      doing: visible.filter((row) => row.status === "doing"),
      done: visible.filter((row) => row.status === "done"),
    } as const;
  }, [visible]);

  const metrics = useMemo(() => {
    const done = rows.filter((row) => row.status === "done").length;
    const doing = rows.filter((row) => row.status === "doing").length;
    const todo = rows.filter((row) => row.status === "todo").length;
    const highPriority = rows.filter((row) => row.priority === "high").length;
    const owners = Array.from(new Set(rows.map((row) => row.owner.trim() || (isCn ? "未分配" : "Unassigned"))));
    const completionRate = rows.length ? Math.round((done / rows.length) * 100) : 0;
    return {
      done,
      doing,
      todo,
      highPriority,
      owners: owners.length,
      completionRate,
      activeFocus: rows.find((row) => row.priority === "high" && row.status !== "done") ?? rows[0] ?? null,
      timeline: [
        {
          label: isCn ? "新增" : "Incoming",
          value: rows.length,
          note: profile.chartSummary.primaryMetricLabel,
        },
        {
          label: isCn ? "已完成" : "Completed",
          value: done,
          note: profile.chartSummary.secondaryMetricLabel,
        },
        {
          label: isCn ? "高优先级" : "High priority",
          value: highPriority,
          note: profile.chartSummary.tertiaryMetricLabel,
        },
        {
          label: isCn ? "负责人" : "Owners",
          value: owners.length,
          note: profile.chartSummary.quaternaryMetricLabel,
        },
      ],
      ownerLoad: owners.map((owner) => {
        const count = rows.filter((row) => (row.owner.trim() || (isCn ? "未分配" : "Unassigned")) === owner).length;
        return {
          owner,
          count,
          share: rows.length ? Math.round((count / rows.length) * 100) : 0,
        };
      }),
    };
  }, [isCn, profile.chartSummary.primaryMetricLabel, profile.chartSummary.quaternaryMetricLabel, profile.chartSummary.secondaryMetricLabel, profile.chartSummary.tertiaryMetricLabel, rows]);

  const chartRows = useMemo(
    () => [
      {
        label: isCn ? "待办" : "Todo",
        count: grouped.todo.length,
        tone: "#94a3b8",
      },
      {
        label: isCn ? "进行中" : "Doing",
        count: grouped.doing.length,
        tone: "#2563eb",
      },
      {
        label: isCn ? "已完成" : "Done",
        count: grouped.done.length,
        tone: "#16a34a",
      },
    ],
    [grouped.doing.length, grouped.done.length, grouped.todo.length, isCn]
  );

  const moveRow = (id: string, direction: -1 | 1) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const order: TaskRow["status"][] = ["todo", "doing", "done"];
        const nextIndex = Math.max(0, Math.min(order.length - 1, order.indexOf(row.status) + direction));
        return { ...row, status: order[nextIndex] };
      })
    );
  };

  const addTask = () => {
    const title = draftTitle.trim();
    if (!title) return;
    setRows((prev) => [
      {
        id: \`task_\${Date.now()}\`,
        title,
        desc: draftDesc.trim() || (isCn ? "新建的任务项" : "New task item"),
        status: "todo",
        owner: draftOwner.trim() || (isCn ? "未分配" : "Unassigned"),
        priority: draftPriority,
      },
      ...prev,
    ]);
    setDraftTitle("");
    setDraftDesc("");
    setDraftOwner("");
    setDraftPriority("medium");
  };

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f6f8fc 0%,#eef4ff 100%)", color: "#0f172a", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 28 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 16 }}>
        <section style={{ borderRadius: 28, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: profile.nav.overview },
              { href: "/tasks", label: profile.nav.tasks, active: true },
              { href: "/analytics", label: profile.nav.analytics },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "#2563eb" : "#eff6ff", color: item.active ? "#ffffff" : "#2563eb", fontSize: 13, fontWeight: 700 }}>
                {item.label}
              </Link>
            ))}
          </div>
          <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" }}>{profile.heroEyebrow}</div>
          <h1 style={{ marginTop: 10, marginBottom: 12, fontSize: 34, fontWeight: 900, lineHeight: 1.15 }}>{profile.heroTitle}</h1>
          <p style={{ color: "#64748b", lineHeight: 1.8, marginBottom: 0 }}>{profile.heroSubtitle}</p>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
          {profile.stats.map((item) => (
            <div key={item.label} style={{ borderRadius: 20, background: "#ffffff", border: "1px solid rgba(148,163,184,0.14)", padding: 18 }}>
              <div style={{ color: "#64748b", fontSize: 13 }}>{item.label}</div>
              <div style={{ marginTop: 10, fontSize: 30, fontWeight: 900 }}>{item.value}</div>
              <div style={{ marginTop: 8, color: "#64748b", lineHeight: 1.7, fontSize: 13 }}>{item.note}</div>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 16 }}>
          <div style={{ borderRadius: 24, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20, display: "grid", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{profile.chartTitle}</div>
                <div style={{ marginTop: 8, color: "#64748b", lineHeight: 1.7, fontSize: 13 }}>{profile.chartSubtitle}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {[profile.chartModes.primary, profile.chartModes.secondary, profile.chartModes.tertiary, profile.chartModes.quaternary].map((label) => (
                  <span key={label} style={{ borderRadius: 999, padding: "7px 10px", background: "#eff6ff", color: "#2563eb", fontSize: 12, fontWeight: 700 }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10 }}>
              {metrics.timeline.map((item, index) => (
                <div key={item.label} style={{ borderRadius: 16, background: index === 0 ? "#eff6ff" : "#f8fafc", padding: "14px 12px" }}>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{item.note}</div>
                  <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{item.value}</div>
                  <div style={{ marginTop: 6, color: "#334155", fontSize: 12 }}>{item.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ borderRadius: 18, background: "#f8fafc", padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{profile.chartSeriesLabel}</div>
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {chartRows.map((item) => (
                    <div key={item.label} style={{ display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                        <span style={{ color: "#334155", fontWeight: 700 }}>{item.label}</span>
                        <span style={{ color: item.tone, fontWeight: 800 }}>{item.count}</span>
                      </div>
                      <div style={{ height: 10, borderRadius: 999, background: "rgba(148,163,184,0.18)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: String(rows.length ? Math.max(10, Math.round((item.count / rows.length) * 100)) : 0) + "%", borderRadius: 999, background: item.tone }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderRadius: 18, background: "#f8fafc", padding: 16, display: "grid", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{profile.chartBreakdownLabel}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center", justifyContent: "center" }}>
                    <div
                      style={{
                        width: 150,
                        height: 150,
                        borderRadius: "50%",
                        background: "conic-gradient(#94a3b8 0 " + String(rows.length ? Math.round((grouped.todo.length / rows.length) * 360) : 0) + "deg, #2563eb " + String(rows.length ? Math.round((grouped.todo.length / rows.length) * 360) : 0) + "deg " + String(rows.length ? Math.round(((grouped.todo.length + grouped.doing.length) / rows.length) * 360) : 0) + "deg, #16a34a " + String(rows.length ? Math.round(((grouped.todo.length + grouped.doing.length) / rows.length) * 360) : 0) + "deg 360deg)",
                        display: "grid",
                        placeItems: "center",
                        margin: "0 auto",
                      }}
                    >
                      <div style={{ width: 86, height: 86, borderRadius: "50%", background: "#ffffff", display: "grid", placeItems: "center", textAlign: "center" }}>
                        <div>
                          <div style={{ fontSize: 22, fontWeight: 900 }}>{metrics.completionRate}%</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{profile.chartProgressLabel}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {chartRows.map((item) => (
                    <div key={item.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: item.tone, display: "inline-block" }} />
                        <span style={{ color: "#334155", fontWeight: 700 }}>{item.label}</span>
                      </div>
                      <span style={{ color: "#64748b" }}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderRadius: 24, background: "#0f172a", color: "#e2e8f0", padding: 20, display: "grid", gap: 14 }}>
            <div>
              <div style={{ color: "#93c5fd", fontSize: 13, fontWeight: 800 }}>{profile.currentObjectLabel}</div>
              <div style={{ marginTop: 10, fontSize: 26, fontWeight: 900 }}>{profile.currentObjectTitle}</div>
              <div style={{ marginTop: 10, color: "#94a3b8", lineHeight: 1.7 }}>{profile.currentObjectNote}</div>
            </div>
            <div style={{ borderRadius: 18, background: "rgba(37,99,235,0.16)", padding: 16 }}>
              <div style={{ fontSize: 13, color: "#bfdbfe", fontWeight: 700 }}>{profile.workflowLabels.focus}</div>
              <div style={{ marginTop: 10, fontWeight: 800 }}>{metrics.activeFocus?.title ?? (isCn ? "暂无焦点任务" : "No focused item")}</div>
              <div style={{ marginTop: 8, color: "#cbd5e1", fontSize: 13, lineHeight: 1.7 }}>{metrics.activeFocus?.desc ?? profile.pageRoleBody}</div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                { label: profile.workflowLabels.create, value: rows.length },
                { label: profile.workflowLabels.progress, value: metrics.doing },
                { label: profile.workflowLabels.done, value: metrics.done },
                { label: profile.chartHierarchyLabel, value: metrics.owners },
              ].map((item) => (
                <div key={item.label} style={{ borderRadius: 14, background: "rgba(255,255,255,0.06)", padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ color: "#cbd5e1", fontSize: 13 }}>{item.label}</span>
                  <span style={{ fontWeight: 800 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ borderRadius: 24, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
            <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder={profile.titlePlaceholder} style={{ padding: 12, borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)" }} />
            <input value={draftOwner} onChange={(event) => setDraftOwner(event.target.value)} placeholder={profile.ownerPlaceholder} style={{ padding: 12, borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)" }} />
          </div>
          <textarea value={draftDesc} onChange={(event) => setDraftDesc(event.target.value)} placeholder={profile.descPlaceholder} style={{ minHeight: 92, padding: 12, borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)", resize: "vertical", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select value={draftPriority} onChange={(event) => setDraftPriority(event.target.value as TaskRow["priority"])} style={{ padding: 12, borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)" }}>
              <option value="low">{isCn ? "低" : "Low"}</option>
              <option value="medium">{isCn ? "中" : "Medium"}</option>
              <option value="high">{isCn ? "高" : "High"}</option>
            </select>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={profile.searchPlaceholder} style={{ flex: 1, minWidth: 240, padding: 12, borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)" }} />
            <button type="button" onClick={() => setView("board")} style={{ borderRadius: 999, border: "1px solid rgba(37,99,235,0.16)", background: view === "board" ? "#2563eb" : "#eff6ff", color: view === "board" ? "#fff" : "#2563eb", padding: "9px 14px", fontWeight: 700, cursor: "pointer" }}>
              {profile.boardLabel}
            </button>
            <button type="button" onClick={() => setView("list")} style={{ borderRadius: 999, border: "1px solid rgba(37,99,235,0.16)", background: view === "list" ? "#2563eb" : "#eff6ff", color: view === "list" ? "#fff" : "#2563eb", padding: "9px 14px", fontWeight: 700, cursor: "pointer" }}>
              {profile.listLabel}
            </button>
            <button type="button" onClick={addTask} style={{ borderRadius: 999, border: "none", background: "#2563eb", color: "#fff", padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>
              {profile.addButton}
            </button>
          </div>
        </section>

        {view === "board" ? (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
            {([
              { key: "todo", label: isCn ? "待办" : "Todo", tone: "#64748b" },
              { key: "doing", label: isCn ? "进行中" : "Doing", tone: "#2563eb" },
              { key: "done", label: isCn ? "已完成" : "Done", tone: "#16a34a" },
            ] as const).map((column) => (
              <div key={column.key} style={{ borderRadius: 20, background: "#ffffff", border: "1px solid rgba(148,163,184,0.14)", padding: 16, minHeight: 260 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 800, color: column.tone }}>{column.label}</div>
                  <div style={{ borderRadius: 999, padding: "4px 10px", background: "#eff6ff", color: column.tone, fontSize: 12, fontWeight: 800 }}>
                    {grouped[column.key].length}
                  </div>
                </div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {grouped[column.key].map((row) => (
                    <div key={row.id} style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: "#f8fafc", padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div style={{ fontWeight: 800 }}>{row.title}</div>
                        <div style={{ fontSize: 12, color: "#f97316", fontWeight: 800 }}>{row.priority}</div>
                      </div>
                      <div style={{ marginTop: 8, color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>{row.desc}</div>
                      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => moveRow(row.id, -1)} style={{ borderRadius: 999, border: "1px solid rgba(148,163,184,0.18)", background: "#fff", padding: "6px 10px", cursor: "pointer" }}>
                          {isCn ? "上移" : "Back"}
                        </button>
                        <button type="button" onClick={() => moveRow(row.id, 1)} style={{ borderRadius: 999, border: "1px solid rgba(148,163,184,0.18)", background: "#fff", padding: "6px 10px", cursor: "pointer" }}>
                          {isCn ? "推进" : "Advance"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ) : (
          <section style={{ borderRadius: 20, background: "#ffffff", border: "1px solid rgba(148,163,184,0.14)", overflow: "hidden" }}>
            {visible.map((row) => (
              <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.7fr 0.5fr auto", gap: 12, padding: "16px 18px", borderBottom: "1px solid rgba(148,163,184,0.12)", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{row.title}</div>
                  <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>{row.desc}</div>
                </div>
                <div style={{ color: "#2563eb", fontWeight: 700 }}>{row.owner}</div>
                <div style={{ color: "#f97316", fontWeight: 700 }}>{row.priority}</div>
                <div style={{ color: "#475569" }}>{row.status}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => moveRow(row.id, -1)} style={{ borderRadius: 999, border: "1px solid rgba(148,163,184,0.18)", background: "#fff", padding: "6px 10px", cursor: "pointer" }}>
                    {isCn ? "回退" : "Back"}
                  </button>
                  <button type="button" onClick={() => moveRow(row.id, 1)} style={{ borderRadius: 999, border: "1px solid rgba(148,163,184,0.18)", background: "#fff", padding: "6px 10px", cursor: "pointer" }}>
                    {isCn ? "推进" : "Advance"}
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
          <div style={{ borderRadius: 22, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{profile.progressTitle}</div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {profile.progressItems.map((item, index) => (
                <div key={item} style={{ borderRadius: 14, background: index === 0 ? "#eff6ff" : "#f8fafc", padding: "12px 14px", color: "#334155" }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 22, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20, display: "grid", gap: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{profile.chartHierarchyLabel}</div>
            {metrics.ownerLoad.map((item, index) => (
              <div key={item.owner} style={{ borderRadius: 14, background: index === 0 ? "#eff6ff" : "#f8fafc", padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontWeight: 700 }}>
                  <span>{item.owner}</span>
                  <span>{item.count}</span>
                </div>
                <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "rgba(148,163,184,0.18)", overflow: "hidden" }}>
                  <div style={{ width: String(Math.max(8, item.share)) + "%", height: "100%", borderRadius: 999, background: "#2563eb" }}></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ borderRadius: 22, background: "#0f172a", color: "#e2e8f0", padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{profile.pageRoleTitle}</div>
          <p style={{ marginTop: 12, color: "#94a3b8", lineHeight: 1.8 }}>
            {profile.pageRoleBody}
          </p>
        </section>
        <Link href="/" style={{ width: "fit-content", textDecoration: "none", borderRadius: 999, padding: "10px 14px", background: "#2563eb", color: "#ffffff" }}>
          {profile.backLabel}
        </Link>
      </div>
    </main>
  );
}
`
  }
  const skin = getTemplateSkin(spec)
  return `import Link from "next/link";

export default function TasksEntryPage() {
  const isCn = ${spec.region === "cn" ? "true" : "false"};
  const skin = ${JSON.stringify(skin, null, 2)} as const;
  return (
    <main style={{ minHeight: "100vh", padding: 28, fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", background: skin.pageBackground, color: skin.textPrimary }}>
      <div style={{ maxWidth: 960, margin: "0 auto", borderRadius: 28, border: skin.cardBorder, background: skin.panelBackground, padding: 28 }}>
        <h1 style={{ marginTop: 0 }}>{isCn ? "任务入口页" : "Tasks entry page"}</h1>
        <p style={{ color: skin.textSecondary, lineHeight: 1.7 }}>
          {isCn ? "这里保留为独立入口，用于承接后续拆分出来的任务模块、列表视图和表单页。" : "This page exists as a dedicated entry so the generated project can evolve into separated task modules, list views, and form pages."}
        </p>
        <div style={{ marginTop: 18 }}>
          <Link href="/" style={{ textDecoration: "underline", color: skin.accentStrong }}>
            {isCn ? "返回主工作台" : "Back to main workspace"}
          </Link>
        </div>
      </div>
    </main>
  );
}
`
}

function renderTemplateExtraPage(spec: AppSpec, page: "leads" | "incidents" | "events" | "download" | "downloads") {
  const isCn = spec.region === "cn"

  if (page === "leads") {
    return `import Link from "next/link";

export default function LeadsPage() {
  const rows = ${JSON.stringify(
    isCn
      ? [
          { company: "华星科技", owner: "张伟", stage: "待首轮沟通", budget: "¥180,000" },
          { company: "景曜智能", owner: "王芳", stage: "方案确认中", budget: "¥92,000" },
          { company: "合一供应链", owner: "陈晨", stage: "演示完成", budget: "¥58,000" },
        ]
      : [
          { company: "Huaxing Tech", owner: "Zhang Wei", stage: "First touch", budget: "$26,000" },
          { company: "Jingyao AI", owner: "Wang Fang", stage: "Proposal review", budget: "$12,000" },
          { company: "Heyi Supply", owner: "Chen Chen", stage: "Demo completed", budget: "$8,000" },
        ],
    null,
    2
  )} as const;
  const isCn = ${isCn ? "true" : "false"};
  return (
    <main style={{ minHeight: "100vh", background: "#f6f8fc", color: "#0f172a", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 28 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 24, background: "#fff", border: "1px solid rgba(148,163,184,0.16)", padding: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: isCn ? "销售总览" : "Sales home" },
              { href: "/leads", label: isCn ? "线索池" : "Lead pool", active: true },
              { href: "/tasks", label: isCn ? "跟进任务" : "Tasks" },
              { href: "/analytics", label: isCn ? "分析" : "Analytics" },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "#2563eb" : "#eff6ff", color: item.active ? "#ffffff" : "#2563eb", fontSize: 13, fontWeight: 700 }}>
                {item.label}
              </Link>
            ))}
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>{isCn ? "线索池" : "Lead pool"}</h1>
          <p style={{ marginTop: 10, color: "#64748b" }}>{isCn ? "CRM 项目会继续拆出专门的线索视图，而不是都挤在首页。" : "CRM products keep a dedicated lead surface instead of overloading the homepage."}</p>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
          {(isCn
            ? [
                { label: "高意向", value: "12", note: "本周优先推进演示与报价" },
                { label: "待回访", value: "19", note: "需要销售和运营共同跟进" },
                { label: "已升级客户", value: "8", note: "支付完成后进入交付轨道" },
              ]
            : [
                { label: "High intent", value: "12", note: "Prioritize demos and proposals this week" },
                { label: "Awaiting follow-up", value: "19", note: "Requires sales and ops coordination" },
                { label: "Upgraded accounts", value: "8", note: "Move into delivery after billing" },
              ]).map((item) => (
            <div key={item.label} style={{ borderRadius: 20, background: "#ffffff", border: "1px solid rgba(148,163,184,0.14)", padding: 18 }}>
              <div style={{ color: "#64748b", fontSize: 13 }}>{item.label}</div>
              <div style={{ marginTop: 10, fontSize: 30, fontWeight: 900 }}>{item.value}</div>
              <div style={{ marginTop: 8, color: "#64748b", lineHeight: 1.7, fontSize: 13 }}>{item.note}</div>
            </div>
          ))}
        </section>
        <section style={{ borderRadius: 24, overflow: "hidden", background: "#fff", border: "1px solid rgba(148,163,184,0.16)" }}>
          {rows.map((row) => (
            <div key={row.company} style={{ display: "grid", gridTemplateColumns: "1fr 160px 180px 140px", gap: 12, padding: "18px 20px", borderBottom: "1px solid rgba(148,163,184,0.12)", alignItems: "center" }}>
              <div style={{ fontWeight: 800 }}>{row.company}</div>
              <div style={{ color: "#475569" }}>{row.owner}</div>
              <div style={{ color: "#2563eb", fontWeight: 700 }}>{row.stage}</div>
              <div style={{ fontWeight: 800 }}>{row.budget}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
          <div style={{ borderRadius: 22, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "来源结构" : "Source mix"}</div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {(isCn ? ["官网咨询", "market 销售线索", "老客户转介绍"] : ["Website inbound", "Market sales funnel", "Customer referrals"]).map((item, index) => (
                <div key={item} style={{ borderRadius: 14, background: index === 0 ? "#eff6ff" : "#f8fafc", padding: "12px 14px", color: "#334155" }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 22, background: "#0f172a", color: "#e2e8f0", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "动作建议" : "Action suggestions"}</div>
            <p style={{ marginTop: 12, color: "#94a3b8", lineHeight: 1.8 }}>
              {isCn ? "下一步优先把高意向线索和升级客户绑定到登录支付链路，形成可闭环的销售后台体验。" : "Next priority: bind high-intent leads and upgraded accounts to the auth and billing flow for a true closing loop."}
            </p>
          </div>
        </section>
        <Link href="/" style={{ width: "fit-content", textDecoration: "none", borderRadius: 999, padding: "10px 14px", background: "#2563eb", color: "#fff" }}>{isCn ? "返回首页" : "Back to home"}</Link>
      </div>
    </main>
  );
}
`
  }

  if (page === "incidents") {
    return `import Link from "next/link";

export default function IncidentsPage() {
  const rows = ${JSON.stringify(
    isCn
      ? [
          { title: "支付接口 5xx 波动", severity: "High", owner: "支付组" },
          { title: "Webhook 延迟超阈值", severity: "Medium", owner: "后端平台" },
          { title: "文档同步任务堆积", severity: "Low", owner: "文档服务" },
        ]
      : [
          { title: "Payment API 5xx spikes", severity: "High", owner: "Payments" },
          { title: "Webhook delay above threshold", severity: "Medium", owner: "Platform" },
          { title: "Docs sync backlog", severity: "Low", owner: "Docs service" },
        ],
    null,
    2
  )} as const;
  const isCn = ${isCn ? "true" : "false"};
  return (
    <main style={{ minHeight: "100vh", background: "#07111f", color: "#e2e8f0", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 28 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 24, background: "rgba(15,23,42,0.88)", border: "1px solid rgba(56,189,248,0.14)", padding: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: isCn ? "平台总览" : "Platform home" },
              { href: "/analytics", label: isCn ? "分析中心" : "Analytics" },
              { href: "/incidents", label: isCn ? "告警中心" : "Incidents", active: true },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "#06b6d4" : "rgba(34,211,238,0.12)", color: item.active ? "#082f49" : "#67e8f9", fontSize: 13, fontWeight: 700 }}>
                {item.label}
              </Link>
            ))}
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>{isCn ? "告警中心" : "Incident center"}</h1>
          <p style={{ marginTop: 10, color: "#94a3b8" }}>{isCn ? "API 数据平台会继续拆出告警列表与异常处理页面。" : "API platforms keep a dedicated incident and alert workflow."}</p>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
          {(isCn
            ? [
                { label: "严重异常", value: "2", note: "影响支付回调和 webhook" },
                { label: "处理中", value: "5", note: "已进入平台排障流程" },
                { label: "本周 SLA", value: "99.97%", note: "仍在可接受范围内" },
              ]
            : [
                { label: "Critical", value: "2", note: "Affecting billing callbacks and webhooks" },
                { label: "In progress", value: "5", note: "Already assigned to platform triage" },
                { label: "Weekly SLA", value: "99.97%", note: "Still within acceptable range" },
              ]).map((item) => (
            <div key={item.label} style={{ borderRadius: 20, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(148,163,184,0.1)", padding: 18 }}>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>{item.label}</div>
              <div style={{ marginTop: 10, fontSize: 30, fontWeight: 900 }}>{item.value}</div>
              <div style={{ marginTop: 8, color: "#94a3b8", lineHeight: 1.7, fontSize: 13 }}>{item.note}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gap: 12 }}>
          {rows.map((row) => (
            <div key={row.title} style={{ borderRadius: 20, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(148,163,184,0.1)", padding: 18, display: "grid", gridTemplateColumns: "1fr 120px 180px", gap: 12 }}>
              <div style={{ fontWeight: 800 }}>{row.title}</div>
              <div style={{ color: row.severity === "High" ? "#f87171" : row.severity === "Medium" ? "#fbbf24" : "#34d399", fontWeight: 800 }}>{row.severity}</div>
              <div style={{ color: "#94a3b8" }}>{row.owner}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
          <div style={{ borderRadius: 22, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(148,163,184,0.1)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "排障路径" : "Triage path"}</div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {(isCn ? ["告警发现", "日志比对", "根因确认", "回滚或修复"] : ["Alert detection", "Log comparison", "Root-cause confirmation", "Rollback or patch"]).map((item, index) => (
                <div key={item} style={{ borderRadius: 14, background: index === 0 ? "rgba(14,165,233,0.12)" : "#111827", color: "#cbd5e1", padding: "12px 14px" }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 22, background: "linear-gradient(135deg,rgba(14,165,233,0.18),rgba(99,102,241,0.16))", border: "1px solid rgba(56,189,248,0.14)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "页面角色" : "Page role"}</div>
            <p style={{ marginTop: 12, color: "#cbd5e1", lineHeight: 1.8 }}>
              {isCn ? "这个页面要看起来像真正的平台异常中心，承接运维与回调排障，而不是简单的列表页。" : "This page should read as an operations-grade incident center, not just a plain list of issues."}
            </p>
          </div>
        </section>
        <Link href="/" style={{ width: "fit-content", textDecoration: "none", borderRadius: 999, padding: "10px 14px", background: "#0ea5e9", color: "#fff" }}>{isCn ? "返回平台首页" : "Back to platform home"}</Link>
      </div>
    </main>
  );
}
`
  }

  if (page === "events") {
    return `import Link from "next/link";

export default function EventsPage() {
  const rows = ${JSON.stringify(
    isCn
      ? [
          { title: "春季产品发布会", state: "报名中", date: "04/18" },
          { title: "开发者案例征集", state: "征集中", date: "04/22" },
          { title: "社区功能投票", state: "进行中", date: "04/30" },
        ]
      : [
          { title: "Spring product launch", state: "Open", date: "04/18" },
          { title: "Developer case showcase", state: "Collecting", date: "04/22" },
          { title: "Community voting", state: "Live", date: "04/30" },
        ],
    null,
    2
  )} as const;
  const isCn = ${isCn ? "true" : "false"};
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#0b1020 0%,#12131a 100%)", color: "#f8fafc", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 28 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 24, background: "rgba(16,18,28,0.86)", border: "1px solid rgba(124,58,237,0.16)", padding: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: isCn ? "社区首页" : "Community home" },
              { href: "/events", label: isCn ? "活动中心" : "Events", active: true },
              { href: "/about", label: isCn ? "品牌介绍" : "About" },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "#7c3aed" : "rgba(124,58,237,0.14)", color: item.active ? "#ffffff" : "#d8b4fe", fontSize: 13, fontWeight: 700 }}>
                {item.label}
              </Link>
            ))}
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>{isCn ? "活动中心" : "Events hub"}</h1>
          <p style={{ marginTop: 10, color: "#94a3b8" }}>{isCn ? "社区类型产品会进一步拆出活动与公告，而不是单一首页。" : "Community products should include event and announcement layers."}</p>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
          {(isCn
            ? [
                { label: "报名人数", value: "1,248", note: "本月累计活动参与" },
                { label: "待发布活动", value: "4", note: "营销与社区联合策划中" },
                { label: "互动热度", value: "High", note: "投票与评论活跃上升" },
              ]
            : [
                { label: "Signups", value: "1,248", note: "Monthly community participation" },
                { label: "Upcoming events", value: "4", note: "Planned across marketing and community" },
                { label: "Engagement", value: "High", note: "Voting and discussion are rising" },
              ]).map((item) => (
            <div key={item.label} style={{ borderRadius: 20, background: "rgba(17,24,39,0.8)", border: "1px solid rgba(255,255,255,0.08)", padding: 18 }}>
              <div style={{ color: "#c4b5fd", fontSize: 13 }}>{item.label}</div>
              <div style={{ marginTop: 10, fontSize: 30, fontWeight: 900 }}>{item.value}</div>
              <div style={{ marginTop: 8, color: "#94a3b8", lineHeight: 1.7, fontSize: 13 }}>{item.note}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
          {rows.map((row) => (
            <div key={row.title} style={{ borderRadius: 22, background: "rgba(17,24,39,0.8)", border: "1px solid rgba(255,255,255,0.08)", padding: 20 }}>
              <div style={{ color: "#c4b5fd", fontSize: 12, fontWeight: 800 }}>{row.date}</div>
              <div style={{ marginTop: 10, fontSize: 20, fontWeight: 900 }}>{row.title}</div>
              <div style={{ marginTop: 12, color: "#94a3b8" }}>{row.state}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
          <div style={{ borderRadius: 22, background: "rgba(17,24,39,0.8)", border: "1px solid rgba(255,255,255,0.08)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "活动链路" : "Event flow"}</div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {(isCn ? ["公告预热", "报名转化", "活动互动", "反馈沉淀"] : ["Announcement", "Signup conversion", "Live engagement", "Feedback capture"]).map((item, index) => (
                <div key={item} style={{ borderRadius: 14, background: index === 0 ? "rgba(124,58,237,0.18)" : "#111827", padding: "12px 14px", color: "#cbd5e1" }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 22, background: "rgba(17,24,39,0.8)", border: "1px solid rgba(255,255,255,0.08)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "社区价值" : "Community value"}</div>
            <p style={{ marginTop: 12, color: "#94a3b8", lineHeight: 1.8 }}>
              {isCn ? "活动页承接的是社区增长、互动和品牌粘性，应该看起来像内容产品，而不是普通表格后台。" : "This page should feel like a branded community-growth surface, not a simple back-office list."}
            </p>
          </div>
        </section>
        <Link href="/" style={{ width: "fit-content", textDecoration: "none", borderRadius: 999, padding: "10px 14px", background: "#7c3aed", color: "#fff" }}>{isCn ? "返回社区首页" : "Back to community home"}</Link>
      </div>
    </main>
  );
}
`
  }

  return `import Link from "next/link";

export default function DownloadPage() {
  const isCn = ${isCn ? "true" : "false"};
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#fff8f1 0%,#fff 48%,#f8fafc 100%)", color: "#111827", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 28 }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 24, background: "#fff", border: "1px solid rgba(15,23,42,0.08)", padding: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: isCn ? "官网首页" : "Homepage" },
              { href: "/download", label: isCn ? "下载中心" : "Download center", active: true },
              { href: "/about", label: isCn ? "产品介绍" : "About" },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "#111827" : "#f8fafc", color: item.active ? "#ffffff" : "#111827", fontSize: 13, fontWeight: 700, border: item.active ? "none" : "1px solid rgba(15,23,42,0.08)" }}>
                {item.label}
              </Link>
            ))}
          </div>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900 }}>{isCn ? "下载中心" : "Download center"}</h1>
          <p style={{ marginTop: 10, color: "#6b7280" }}>{isCn ? "官网类型项目会继续拆出独立下载页，承接 Android / iOS / 文档链路。" : "Website archetypes include a dedicated download center for devices and docs."}</p>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
          {(isCn
            ? [
                { label: "Android", value: "Ready", note: "APK 下载与安装说明" },
                { label: "iOS", value: "TestFlight", note: "演示入口与提审说明" },
                { label: "文档", value: "API + FAQ", note: "下载前后帮助统一承接" },
              ]
            : [
                { label: "Android", value: "Ready", note: "APK downloads and setup guide" },
                { label: "iOS", value: "TestFlight", note: "Demo entry and review flow" },
                { label: "Docs", value: "API + FAQ", note: "Pre and post-download guidance" },
              ]).map((item) => (
            <div key={item.label} style={{ borderRadius: 20, background: "#fff", border: "1px solid rgba(15,23,42,0.08)", padding: 18 }}>
              <div style={{ color: "#6b7280", fontSize: 13 }}>{item.label}</div>
              <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900 }}>{item.value}</div>
              <div style={{ marginTop: 8, color: "#6b7280", lineHeight: 1.7, fontSize: 13 }}>{item.note}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {["Android","iOS"].map((item) => (
            <div key={item} style={{ borderRadius: 22, background: "#fff", border: "1px solid rgba(15,23,42,0.08)", padding: 22 }}>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{item}</div>
              <div style={{ marginTop: 10, color: "#6b7280" }}>{isCn ? "下载页与安装说明" : "Download and install guide"}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
          <div style={{ borderRadius: 22, background: "#fff", border: "1px solid rgba(15,23,42,0.08)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "下载路径" : "Download path"}</div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {(isCn ? ["官网首页", "下载中心", "安装说明", "登录与升级"] : ["Homepage", "Download center", "Install guide", "Login and upgrade"]).map((item, index) => (
                <div key={item} style={{ borderRadius: 14, background: index === 0 ? "#fff7ed" : "#f8fafc", padding: "12px 14px", color: "#334155" }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 22, background: "#111827", color: "#f9fafb", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "页面角色" : "Page role"}</div>
            <p style={{ marginTop: 12, color: "#cbd5e1", lineHeight: 1.8 }}>
              {isCn ? "这个页面承接的是官网之后的下载与安装体验，应该更像产品分发页，而不是两张平台卡片。" : "This page should feel like a real product-distribution surface after the homepage, not just two plain device cards."}
            </p>
          </div>
        </section>
        <Link href="/" style={{ width: "fit-content", textDecoration: "none", borderRadius: 999, padding: "10px 14px", background: "#111827", color: "#fff" }}>{isCn ? "返回官网首页" : "Back to homepage"}</Link>
      </div>
    </main>
  );
}
`
}

function renderReportsPage(spec: AppSpec) {
  const skin = getTemplateSkin(spec)
  const isCn = spec.region === "cn"
  const archetype = getScaffoldArchetype(spec)
  return `import Link from "next/link";

export default function ReportsPage() {
  const skin = ${JSON.stringify(skin, null, 2)} as const;
  const isCn = ${isCn ? "true" : "false"};
  const reports = ${JSON.stringify(
    isCn
      ? ["周报摘要", "交付节奏", "风险与阻塞", "负责人负载"]
      : ["Weekly summary", "Delivery cadence", "Risks and blockers", "Owner workload"],
    null,
    2
  )} as const;
  const cards = ${JSON.stringify(
    isCn
      ? [
          { label: "本周生成项目", value: "5", note: "覆盖官网、CRM、数据平台、社区与代码平台" },
          { label: "老板演示链路", value: "ready", note: "demo / promo / login / workspace 已打通演示" },
          { label: "主要风险", value: "2", note: "真实支付回调与正式 OAuth 参数待接入" },
        ]
      : [
          { label: "Generated projects", value: "5", note: "Website, CRM, data, community, and code platform covered" },
          { label: "Stakeholder demo flow", value: "ready", note: "demo / promo / login / workspace are aligned for demos" },
          { label: "Primary risks", value: "2", note: "Real payment callbacks and production OAuth params remain" },
        ],
    null,
    2
  )} as const;

  return (
    <main style={{ minHeight: "100vh", padding: 28, fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", background: skin.pageBackground, color: skin.textPrimary }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, border: skin.cardBorder, background: skin.panelBackground, padding: 28 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: isCn ? "总览" : "Overview" },
              ...(${JSON.stringify(archetype === "code_platform")} ? [{ href: "/editor", label: isCn ? "编辑器" : "Editor" }] : []),
              { href: "/reports", label: isCn ? "汇报中心" : "Reports", active: true },
              { href: "/team", label: isCn ? "团队" : "Team" },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? skin.accentStrong : skin.inputBackground, color: item.active ? "#ffffff" : skin.textPrimary, fontSize: 13, fontWeight: 700, border: item.active ? "none" : skin.cardBorder }}>
                {item.label}
              </Link>
            ))}
          </div>
          <div style={{ fontSize: 12, color: skin.textSecondary, letterSpacing: "0.18em", textTransform: "uppercase" }}>
            Elite reporting
          </div>
          <h1 style={{ margin: "12px 0 8px", fontSize: 34 }}>{isCn ? "高级汇报中心" : "Executive reporting hub"}</h1>
          <p style={{ margin: 0, color: skin.textSecondary, lineHeight: 1.7 }}>
            {isCn ? "精英版会额外生成更偏交付汇报的页面结构，用来承接团队同步、阶段总结和对外展示。" : "Elite tier adds a delivery-oriented reporting surface for team syncs, phase summaries, and stakeholder review."}
          </p>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
          {cards.map((item) => (
            <div key={item.label} style={{ borderRadius: 20, border: skin.cardBorder, background: skin.cardBackground, padding: 18 }}>
              <div style={{ fontSize: 12, color: skin.textSecondary }}>{item.label}</div>
              <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900 }}>{item.value}</div>
              <div style={{ marginTop: 8, color: skin.textSecondary, lineHeight: 1.7, fontSize: 13 }}>{item.note}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          {reports.map((item, index) => (
            <div key={item} style={{ borderRadius: 20, border: skin.cardBorder, background: skin.cardBackground, padding: 18 }}>
              <div style={{ fontSize: 12, color: skin.textSecondary }}>0{index + 1}</div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>{item}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14 }}>
          <div style={{ borderRadius: 22, border: skin.cardBorder, background: skin.panelBackground, padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "汇报摘要" : "Executive summary"}</div>
            <p style={{ marginTop: 12, color: skin.textSecondary, lineHeight: 1.8 }}>
              {isCn
                ? "当前阶段已经把 morncursor 主工作区、老板演示链路、宣传文件夹输出和销售闭环页面放进同一产品体系，后续重点是继续接真实登录支付参数与回调。"
                : "The current phase aligns the morncursor workspace, stakeholder demo flow, promo asset export, and sales loop into one system. Next focus: real auth and billing callbacks."}
            </p>
          </div>
          <div style={{ borderRadius: 22, border: skin.cardBorder, background: skin.panelBackground, padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "下一阶段" : "Next phase"}</div>
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {[
                isCn ? "继续提升生成结果接近 Base44 的稳定性" : "Increase Base44-like output consistency",
                isCn ? "完成正式 OAuth / 支付参数接入" : "Connect production OAuth and billing params",
                isCn ? "补齐 5 类验收项目的深层页面" : "Expand deeper pages for all five acceptance archetypes",
              ].map((item) => (
                <div key={item} style={{ borderRadius: 12, background: skin.inputBackground, padding: "10px 12px", color: skin.textPrimary, fontSize: 13 }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
        <Link href="/" style={{ width: "fit-content", textDecoration: "none", borderRadius: 999, padding: "10px 14px", background: skin.accentStrong, color: "#ffffff" }}>
          {isCn ? "返回主工作台" : "Back to workspace"}
        </Link>
      </div>
    </main>
  );
}
`
}

function renderTeamPage(spec: AppSpec) {
  const skin = getTemplateSkin(spec)
  const isCn = spec.region === "cn"
  return `import Link from "next/link";

export default function TeamPage() {
  const skin = ${JSON.stringify(skin, null, 2)} as const;
  const isCn = ${isCn ? "true" : "false"};
  const rows = ${JSON.stringify(
    isCn
      ? [
          { name: "张伟", role: "项目负责人", focus: "排期与交付" },
          { name: "王芳", role: "设计负责人", focus: "视觉与组件系统" },
          { name: "陈晨", role: "运营负责人", focus: "内容与验收跟进" },
        ]
      : [
          { name: "Liam", role: "Project lead", focus: "Planning and delivery" },
          { name: "Emma", role: "Design lead", focus: "Visual system and components" },
          { name: "Mason", role: "Operations lead", focus: "Content and rollout" },
        ],
    null,
    2
  )} as const;
  const lanes = ${JSON.stringify(
    isCn
      ? ["产品与验收", "生成链路", "宣传资产", "登录支付"]
      : ["Product and acceptance", "Generation pipeline", "Promo assets", "Auth and billing"],
    null,
    2
  )} as const;

  return (
    <main style={{ minHeight: "100vh", padding: 28, fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", background: skin.pageBackground, color: skin.textPrimary }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
        <section style={{ borderRadius: 28, border: skin.cardBorder, background: skin.panelBackground, padding: 28 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: isCn ? "总览" : "Overview" },
              { href: "/reports", label: isCn ? "汇报中心" : "Reports" },
              { href: "/team", label: isCn ? "团队" : "Team", active: true },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? skin.accentStrong : skin.inputBackground, color: item.active ? "#ffffff" : skin.textPrimary, fontSize: 13, fontWeight: 700, border: item.active ? "none" : skin.cardBorder }}>
                {item.label}
              </Link>
            ))}
          </div>
          <h1 style={{ margin: 0, fontSize: 32 }}>{isCn ? "团队协作面板" : "Team collaboration panel"}</h1>
          <p style={{ marginTop: 10, color: skin.textSecondary, lineHeight: 1.7 }}>
            {isCn ? "精英版会把生成结果继续拆到团队和角色层，避免只是一页主界面看起来强，结构深度却不够。" : "Elite tier pushes the generated result into team and role layers so the project structure stays deeper than a single polished homepage."}
          </p>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
          {lanes.map((item, index) => (
            <div key={item} style={{ borderRadius: 18, border: skin.cardBorder, background: index === 0 ? skin.accentSoft : skin.cardBackground, padding: 16 }}>
              <div style={{ fontWeight: 800, color: index === 0 ? skin.accentStrong : skin.textPrimary }}>{item}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gap: 12 }}>
          {rows.map((item) => (
            <div key={item.name} style={{ borderRadius: 20, border: skin.cardBorder, background: skin.cardBackground, padding: 18 }}>
              <div style={{ fontWeight: 700 }}>{item.name}</div>
              <div style={{ marginTop: 6, color: skin.textSecondary }}>{item.role}</div>
              <div style={{ marginTop: 10 }}>{item.focus}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14 }}>
          <div style={{ borderRadius: 22, border: skin.cardBorder, background: skin.panelBackground, padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "协作说明" : "Collaboration note"}</div>
            <p style={{ marginTop: 12, color: skin.textSecondary, lineHeight: 1.8 }}>
              {isCn
                ? "这一层要体现的不是联系人名录，而是项目已经进入团队协作和角色分工层，能承接生成、交付、宣传和销售同步。"
                : "This layer should show role-based collaboration, not just a contacts list, so the product feels ready for delivery, promo, and sales coordination."}
            </p>
          </div>
          <div style={{ borderRadius: 22, border: skin.cardBorder, background: skin.panelBackground, padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "当前重点" : "Current priorities"}</div>
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {[
                isCn ? "稳定老板演示 URL" : "Stabilize stakeholder demo URLs",
                isCn ? "持续拉开 archetype 差异" : "Widen archetype differentiation",
                isCn ? "后续接真实登录与支付配置" : "Connect real auth and billing later",
              ].map((item) => (
                <div key={item} style={{ borderRadius: 12, background: skin.inputBackground, padding: "10px 12px", color: skin.textPrimary, fontSize: 13 }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
        <Link href="/" style={{ width: "fit-content", textDecoration: "none", borderRadius: 999, padding: "10px 14px", border: skin.cardBorder, color: skin.textPrimary }}>
          {isCn ? "回到主工作台" : "Return to workspace"}
        </Link>
      </div>
    </main>
  );
}
`
}

function renderHandoffPage(spec: AppSpec) {
  const skin = getTemplateSkin(spec)
  const isCn = spec.region === "cn"
  return `import Link from "next/link";

export default function HandoffPage() {
  const skin = ${JSON.stringify(skin, null, 2)} as const;
  const isCn = ${isCn ? "true" : "false"};
  const checklist = ${JSON.stringify(
    isCn
      ? [
          { title: "交付说明", note: "环境变量、部署入口和回滚步骤已经整理", status: "Ready" },
          { title: "数据库交接", note: "线上使用说明、额度和角色边界已写明", status: "Synced" },
          { title: "代码导出包", note: "Elite 支持团队级交付与本地接手", status: "Included" },
          { title: "演示域名", note: "子域名与 canonical preview 已保持一致", status: "Live" },
        ]
      : [
          { title: "Delivery notes", note: "Env vars, deploy entry, and rollback steps are documented", status: "Ready" },
          { title: "Database handoff", note: "Online usage, quotas, and role boundaries are written down", status: "Synced" },
          { title: "Code export bundle", note: "Elite includes team-grade handoff for local continuation", status: "Included" },
          { title: "Demo domains", note: "Assigned subdomain and canonical preview stay aligned", status: "Live" },
        ],
    null,
    2
  )} as const;
  const nextSteps = ${JSON.stringify(
    isCn
      ? ["上传仓库并锁定分支", "补真实登录支付密钥", "跑线上 smoke 与验收清单"]
      : ["Push the repo and lock the branch", "Connect production auth and billing keys", "Run hosted smoke checks and acceptance"],
    null,
    2
  )} as const;

  return (
    <main style={{ minHeight: "100vh", padding: 28, fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", background: skin.pageBackground, color: skin.textPrimary }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 16 }}>
        <section style={{ borderRadius: 28, border: skin.cardBorder, background: skin.panelBackground, padding: 28 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: isCn ? "总览" : "Overview" },
              { href: "/reports", label: isCn ? "汇报中心" : "Reports" },
              { href: "/team", label: isCn ? "团队" : "Team" },
              { href: "/handoff", label: isCn ? "交付" : "Handoff", active: true },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? skin.accentStrong : skin.inputBackground, color: item.active ? "#ffffff" : skin.textPrimary, fontSize: 13, fontWeight: 700, border: item.active ? "none" : skin.cardBorder }}>
                {item.label}
              </Link>
            ))}
          </div>
          <h1 style={{ margin: 0, fontSize: 32 }}>{isCn ? "交付与交接中心" : "Delivery and handoff hub"}</h1>
          <p style={{ marginTop: 10, color: skin.textSecondary, lineHeight: 1.7 }}>
            {isCn ? "精英版不仅要有更深的页面层级，还要把代码、环境、数据库和演示入口整理成可交接状态。" : "Elite should not only look deeper, it should organize code, environment, database, and demo entry points into a handoff-ready state."}
          </p>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}>
          {checklist.map((item) => (
            <div key={item.title} style={{ borderRadius: 20, border: skin.cardBorder, background: skin.cardBackground, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div style={{ fontWeight: 800 }}>{item.title}</div>
                <div style={{ borderRadius: 999, padding: "4px 10px", background: skin.accentSoft, color: skin.accentStrong, fontSize: 11, fontWeight: 800 }}>{item.status}</div>
              </div>
              <div style={{ marginTop: 8, color: skin.textSecondary, lineHeight: 1.7, fontSize: 13 }}>{item.note}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14 }}>
          <div style={{ borderRadius: 22, border: skin.cardBorder, background: skin.panelBackground, padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "交接说明" : "Handoff note"}</div>
            <p style={{ marginTop: 12, color: skin.textSecondary, lineHeight: 1.8 }}>
              {isCn ? "这页承接的是从工作区到交付的最后一公里，应该让团队看清当前套餐能力、导出边界、数据库模式和演示地址。" : "This page covers the last mile from workspace to delivery so the team can clearly see plan capabilities, export limits, database mode, and demo domains."}
            </p>
          </div>
          <div style={{ borderRadius: 22, border: skin.cardBorder, background: skin.panelBackground, padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "下一步动作" : "Next actions"}</div>
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {nextSteps.map((item) => (
                <div key={item} style={{ borderRadius: 12, background: skin.inputBackground, padding: "10px 12px", color: skin.textPrimary, fontSize: 13 }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
`
}

function renderPlaybooksPage(spec: AppSpec) {
  const skin = getTemplateSkin(spec)
  const isCn = spec.region === "cn"
  return `import Link from "next/link";

export default function PlaybooksPage() {
  const skin = ${JSON.stringify(skin, null, 2)} as const;
  const isCn = ${isCn ? "true" : "false"};
  const playbooks = ${JSON.stringify(
    isCn
      ? [
          { name: "生成上线检查", owner: "产品", stage: "Preview → Runtime → Domain" },
          { name: "客户演示流程", owner: "销售", stage: "Landing → Workspace → Upgrade" },
          { name: "交付移交流程", owner: "交付", stage: "Export → Handoff → Docs" },
        ]
      : [
          { name: "Generation release check", owner: "Product", stage: "Preview → Runtime → Domain" },
          { name: "Client demo flow", owner: "Sales", stage: "Landing → Workspace → Upgrade" },
          { name: "Delivery handoff flow", owner: "Delivery", stage: "Export → Handoff → Docs" },
        ],
    null,
    2
  )} as const;

  return (
    <main style={{ minHeight: "100vh", padding: 28, fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", background: skin.pageBackground, color: skin.textPrimary }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
        <section style={{ borderRadius: 28, border: skin.cardBorder, background: skin.panelBackground, padding: 28 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: isCn ? "总览" : "Overview" },
              { href: "/handoff", label: isCn ? "交付" : "Handoff" },
              { href: "/playbooks", label: isCn ? "剧本" : "Playbooks", active: true },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? skin.accentStrong : skin.inputBackground, color: item.active ? "#ffffff" : skin.textPrimary, fontSize: 13, fontWeight: 700, border: item.active ? "none" : skin.cardBorder }}>
                {item.label}
              </Link>
            ))}
          </div>
          <h1 style={{ margin: 0, fontSize: 32 }}>{isCn ? "交付剧本与流程" : "Playbooks and rollout flows"}</h1>
          <p style={{ marginTop: 10, color: skin.textSecondary, lineHeight: 1.7 }}>
            {isCn ? "精英版会把生成、演示、交付三个阶段都整理成可执行剧本，而不是只留一个漂亮页面。" : "Elite turns generation, demo, and delivery into reusable playbooks instead of stopping at a polished single page."}
          </p>
        </section>
        <section style={{ display: "grid", gap: 12 }}>
          {playbooks.map((item) => (
            <div key={item.name} style={{ borderRadius: 20, border: skin.cardBorder, background: skin.cardBackground, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800 }}>{item.name}</div>
                <div style={{ color: skin.textSecondary, fontSize: 12 }}>{item.owner}</div>
              </div>
              <div style={{ marginTop: 8, color: skin.textSecondary, lineHeight: 1.7, fontSize: 13 }}>{item.stage}</div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
`
}

function extractPlannedRouteNames(spec: AppSpec) {
  const routes = new Set<string>()
  const archetype = getScaffoldArchetype(spec)
  const text = String(spec.prompt ?? spec.title ?? "").toLowerCase()
  if (Array.isArray(spec.routeBlueprint) && spec.routeBlueprint.length) {
    for (const route of spec.routeBlueprint) {
      const normalized = String(route.path || route.id || "")
        .trim()
        .replace(/^\/+/, "")
        .replace(/\/+$/, "")
      if (!normalized) {
        routes.add("home")
        continue
      }
      routes.add(normalized)
    }
  }
  for (const moduleName of spec.modules) {
    const match = String(moduleName)
      .trim()
      .toLowerCase()
      .match(/^([a-z0-9_-]+)\s+page$/)
    if (match?.[1]) {
      routes.add(match[1])
    }
  }
  if (archetype === "code_platform") {
    const entityIds = new Set((spec.entityBlueprint ?? []).map((item) => item.id))
    const codeRoutes = new Set<string>(["dashboard", "editor"])
    const push = (route: string, enabled: boolean) => {
      if (enabled) codeRoutes.add(route)
    }
    push("runs", /run|runs|runtime|log|logs|preview|terminal|构建|运行|日志|预览|终端/.test(text) || entityIds.has("runtime_run"))
    push("templates", /template|templates|scaffold|gallery|模板|脚手架|模板库/.test(text) || entityIds.has("template_asset"))
    push(
      "assistant",
      /assistant|chat|conversation|copilot|agent|助手|对话|智能体/.test(text) || entityIds.has("assistant_thread") || entityIds.has("ai_session")
    )
    push(
      "publish",
      /publish|deploy|delivery|release|上线|发布|交付/.test(text) || entityIds.has("release_deployment")
    )
    push("pricing", /pricing|price|plan|subscription|套餐|定价|价格|升级/.test(text))
    push("settings", /setting|settings|config|database|access|permission|environment|设置|配置|数据库|权限|环境/.test(text))
    push("about", /about|story|intro|介绍|说明|关于/.test(text))
    push("analytics", /analytics|metrics|usage|analysis|report|分析|指标|用量|报表/.test(text))
    return Array.from(codeRoutes)
  }
  if (archetype === "community") {
    const eventDrivenCommunity = /event|events|meetup|webinar|registration|registrations|schedule|scheduling|session|sessions|ambassador|invite|segment|segments|活动|直播|聚会|报名|日程|议程|邀请|大使|分层/.test(
      text
    )
    if (eventDrivenCommunity) routes.add("events")
    if (/member|members|invite|segment|segments|membership|ambassador|成员|邀请|分层|会员|大使/.test(text)) routes.add("members")
    if (/feedback|feedback intake|request|requests|post-event feedback|反馈|诉求/.test(text)) routes.add("feedback")
    if (/moderation|moderate|review|report abuse|safety|审核|治理|举报|安全/.test(text)) routes.add("moderation")
    if (/roadmap|vote|wishlist|路线图|投票|愿望单/.test(text)) routes.add("roadmap")
    if (/post|posts|forum|announcement|discussion|content|帖子|论坛|公告|讨论|内容/.test(text)) routes.add("posts")
    const orderedRoutes = eventDrivenCommunity
      ? ["dashboard", "events", "members", "feedback", "moderation", "roadmap", "posts", "settings", "about"]
      : ["dashboard", "feedback", "moderation", "roadmap", "members", "events", "posts", "settings", "about"]
    return orderedRoutes.filter((route) => routes.has(route))
  }
  if (archetype === "marketing_admin") {
    routes.add("dashboard")
    routes.add("website")
    routes.add("market")
    routes.add("download")
    routes.add("demo")
    routes.add("pricing")
    routes.add("docs")
    routes.add("admin")
    return ["dashboard", "website", "market", "download", "demo", "pricing", "docs", "admin"].filter((route) => routes.has(route))
  }
  if (archetype !== "code_platform" && hasFeature(spec, "about_page")) routes.add("about")
  if (archetype !== "code_platform" && hasFeature(spec, "analytics_page")) routes.add("analytics")
  if (archetype === "task") {
    if (spec.planTier === "builder" || spec.planTier === "pro" || spec.planTier === "elite") {
      routes.add("reports")
      routes.add("automations")
    }
    if (spec.planTier === "pro" || spec.planTier === "elite") {
      routes.add("team")
      routes.add("approvals")
    }
    if (spec.planTier === "elite") {
      routes.add("handoff")
      routes.add("playbooks")
    }
  } else if (spec.planTier === "elite") {
    routes.add("reports")
    routes.add("team")
  }
  return Array.from(routes)
}

function getGeneratedRouteLabel(route: string, isCn: boolean) {
  const labels: Record<string, [string, string]> = {
    dashboard: ["Dashboard", "Dashboard"],
    tasks: ["Tasks", "Tasks"],
    settings: ["Settings", "Settings"],
    analytics: ["Analytics", "Analytics"],
    pricing: ["Pricing", "Pricing"],
    reports: ["Reports", "Reports"],
    team: ["Team", "Team"],
    approvals: ["Approvals", "Approvals"],
    handoff: ["Handoff", "Handoff"],
    playbooks: ["Playbooks", "Playbooks"],
    members: ["Members", "Members"],
    feedback: ["Feedback", "Feedback"],
    website: ["Website", "Website"],
    market: ["Market", "Market"],
    download: ["Download", "Download"],
    downloads: ["Downloads", "Downloads"],
    demo: ["Demo", "Demo"],
    docs: ["Docs", "Docs"],
    admin: ["Admin", "Admin"],
    patients: ["患者", "Patients"],
    appointments: ["预约", "Appointments"],
    care: ["护理", "Care"],
    courses: ["课程", "Courses"],
    students: ["学生", "Students"],
    assignments: ["作业", "Assignments"],
    accounts: ["账户", "Accounts"],
    transactions: ["交易", "Transactions"],
    reconciliation: ["对账", "Reconciliation"],
    candidates: ["候选人", "Candidates"],
    jobs: ["岗位", "Jobs"],
    interviews: ["面试", "Interviews"],
    tickets: ["工单", "Tickets"],
    cases: ["案例", "Cases"],
    knowledge: ["知识库", "Knowledge"],
    products: ["商品", "Products"],
    inventory: ["库存", "Inventory"],
    orders: ["订单", "Orders"],
  }
  const mapped = labels[route]
  if (mapped) return isCn ? mapped[0] : mapped[1]
  return route
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ")
}

function renderGenericPlannerPage(spec: AppSpec, route: string, plannedRoutes: string[]) {
  const isCn = spec.region === "cn"
  const label = getGeneratedRouteLabel(route, isCn)
  const routeBlueprint =
    spec.routeBlueprint?.find((item) => item.path === `/${route}` || item.id === toBlueprintId(route)) ?? null
  const navItems = plannedRoutes
    .filter((item) => item !== "home")
    .slice(0, 8)
    .map((item) => ({
      href: `/${item}`,
      label: getGeneratedRouteLabel(item, isCn),
      active: item === route,
    }))
  const focusAreas =
    (spec.moduleBlueprint ?? [])
      .filter((item) => routeBlueprint?.moduleIds.includes(item.id))
      .slice(0, 6)
      .map((item) => item.label)
      .filter(Boolean)
      .length
      ? (spec.moduleBlueprint ?? [])
          .filter((item) => routeBlueprint?.moduleIds.includes(item.id))
          .slice(0, 6)
          .map((item) => item.label)
      : spec.modules
          .filter((item) => !/^([a-z0-9_-]+)\s+page$/i.test(item))
          .slice(0, 6)
  const linkedEntities = (spec.entityBlueprint ?? [])
    .filter((item) => routeBlueprint?.entityIds.includes(item.id))
    .slice(0, 4)
    .map((item) => ({
      label: item.label,
      summary: item.summary,
      workflows: item.workflows.slice(0, 3),
    }))
  const primaryActions = routeBlueprint?.primaryActions?.slice(0, 4) ?? []
  const workflowSteps = getWorkflowSteps(spec)
  const records = (isCn
    ? [
        { title: `${label} 视图`, meta: "已按生成规划落地为独立路由", status: "Ready" },
        { title: "权限与套餐约束", meta: `当前套餐 ${spec.planTier} 的限制已并入生成结果`, status: "Synced" },
        { title: "后续迭代入口", meta: "可继续通过 iterate 围绕当前页面做定点改写", status: "Open" },
      ]
    : [
        { title: `${label} surface`, meta: "Landed as a dedicated route from the generated plan", status: "Ready" },
        { title: "Plan and policy constraints", meta: `The ${spec.planTier} tier policy is reflected in the generated shell`, status: "Synced" },
        { title: "Follow-up iteration", meta: "This route is ready for focused iterate edits", status: "Open" },
      ]) as Array<{ title: string; meta: string; status: string }>
  const actions = isCn
    ? ["继续补真实数据读写", "围绕当前页面做上下文改写", "把权限和交付链路接到真实接口"]
    : ["Connect real data reads and writes", "Iterate directly on this page context", "Wire permissions and delivery flows to real APIs"]
  const specialized =
    route === "handoff"
      ? renderHandoffPage(spec)
      : route === "playbooks"
        ? renderPlaybooksPage(spec)
        : route === "approvals"
          ? renderArchetypeConsolePage(spec, route)
          : null
  if (specialized) return specialized

  return `// @ts-nocheck
import Link from "next/link";

export default function GeneratedPlannerPage() {
  const spec = ${JSON.stringify(spec, null, 2)} as const;
  const navItems = ${JSON.stringify(navItems, null, 2)} as const;
  const focusAreas = ${JSON.stringify(focusAreas, null, 2)} as const;
  const routeBlueprint = ${JSON.stringify(routeBlueprint, null, 2)} as const;
  const linkedEntities = ${JSON.stringify(linkedEntities, null, 2)} as const;
  const primaryActions = ${JSON.stringify(primaryActions, null, 2)} as const;
  const workflowSteps = ${JSON.stringify(workflowSteps, null, 2)} as const;
  const records = ${JSON.stringify(records, null, 2)} as const;
  const actions = ${JSON.stringify(actions, null, 2)} as const;
  const isCn = spec.region === "cn";
  const prototype = routeBlueprint?.pagePrototype || "dashboard";
  const prototypeRows = linkedEntities.length
    ? linkedEntities.map((item, index) => ({
        title: item.label,
        note: item.summary,
        status: primaryActions[index] || (isCn ? "已接入" : "Connected"),
      }))
    : records;
  const prototypeStages = [
    { label: isCn ? "待处理" : "Queued", value: 32, tone: "#2563eb" },
    { label: isCn ? "推进中" : "Active", value: 56, tone: "#7c3aed" },
    { label: isCn ? "已完成" : "Done", value: 44, tone: "#059669" },
  ];

  return (
    <main style={{ minHeight: "100vh", padding: 28, fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", background: "linear-gradient(180deg,#f8fafc 0%,#ffffff 54%,#eef4ff 100%)", color: "#0f172a" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(15,23,42,0.06)", color: "#2563eb", fontSize: 12, fontWeight: 800 }}>
                {spec.title}
              </div>
              <h1 style={{ margin: "14px 0 8px", fontSize: 34, fontWeight: 900 }}>${label}</h1>
              <p style={{ margin: 0, maxWidth: 860, color: "#64748b", lineHeight: 1.8 }}>
                {routeBlueprint?.purpose || (isCn
                  ? "这一页来自生成规划里的独立模块，不再被塞回首页或一块静态演示卡片里。"
                  : "This route comes directly from the generated plan instead of being collapsed back into a single poster-like homepage.")}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 14, padding: "10px 14px", background: item.active ? "#2563eb" : "#f8fafc", color: item.active ? "#ffffff" : "#0f172a", border: item.active ? "none" : "1px solid rgba(148,163,184,0.16)", fontWeight: 700 }}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
          {[
            { label: isCn ? "当前路由" : "Current route", value: ${JSON.stringify(route)} },
            { label: isCn ? "套餐层级" : "Plan tier", value: spec.planTier },
            { label: isCn ? "模块数量" : "Linked modules", value: String(focusAreas.length) },
            { label: isCn ? "数据目标" : "Database target", value: spec.databaseTarget },
          ].map((item) => (
            <div key={item.label} style={{ borderRadius: 22, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 18 }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>{item.label}</div>
              <div style={{ marginTop: 12, fontSize: 24, fontWeight: 900 }}>{item.value}</div>
            </div>
          ))}
        </section>

        {prototype === "kanban" ? (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
            {prototypeStages.map((stage) => (
              <div key={stage.label} style={{ borderRadius: 24, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 18, minHeight: 230 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{stage.label}</div>
                  <div style={{ color: stage.tone, fontWeight: 900 }}>{stage.value}</div>
                </div>
                <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                  {prototypeRows.slice(0, 3).map((item) => (
                    <div key={item.title} style={{ borderRadius: 16, background: "#f8fafc", border: "1px solid rgba(148,163,184,0.14)", padding: 14 }}>
                      <div style={{ fontWeight: 800 }}>{item.title}</div>
                      <div style={{ marginTop: 8, color: "#64748b", lineHeight: 1.6, fontSize: 13 }}>{item.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ) : prototype === "docs" ? (
          <section style={{ display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", gap: 16 }}>
            <aside style={{ borderRadius: 24, background: "#0f172a", color: "#e2e8f0", padding: 20 }}>
              <div style={{ fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: "#93c5fd" }}>{isCn ? "文档目录" : "Docs rail"}</div>
              <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                {prototypeRows.slice(0, 5).map((item) => (
                  <div key={item.title} style={{ borderRadius: 14, background: "rgba(255,255,255,0.06)", padding: "12px 14px" }}>
                    <div style={{ fontWeight: 800 }}>{item.title}</div>
                    <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 13 }}>{item.status}</div>
                  </div>
                ))}
              </div>
            </aside>
            <article style={{ borderRadius: 24, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 24 }}>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{isCn ? "接入指南与运行说明" : "Implementation guide and runtime notes"}</div>
              <p style={{ marginTop: 12, color: "#64748b", lineHeight: 1.8 }}>{routeBlueprint?.purpose}</p>
              <pre style={{ marginTop: 18, whiteSpace: "pre-wrap", borderRadius: 18, background: "#0f172a", color: "#e2e8f0", padding: 18, lineHeight: 1.7 }}>{"const response = await client.runPrimaryAction({\\n  route: routeBlueprint.id,\\n  mode: prototype,\\n})"}</pre>
            </article>
          </section>
        ) : prototype === "distribution" ? (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
            {["macOS", "Windows", "Mobile"].map((platform, index) => (
              <div key={platform} style={{ borderRadius: 26, background: index === 0 ? "#0f172a" : "#ffffff", color: index === 0 ? "#f8fafc" : "#0f172a", border: "1px solid rgba(148,163,184,0.16)", padding: 22, minHeight: 220 }}>
                <div style={{ fontSize: 24, fontWeight: 900 }}>{platform}</div>
                <div style={{ marginTop: 12, color: index === 0 ? "#cbd5e1" : "#64748b", lineHeight: 1.7 }}>{isCn ? "安装包、签名状态和分发渠道保持同步。" : "Installer, signing state, and distribution channel stay in sync."}</div>
                <button style={{ marginTop: 18, border: 0, borderRadius: 14, padding: "12px 14px", background: index === 0 ? "#38bdf8" : "#0f172a", color: "#ffffff", fontWeight: 800, cursor: "pointer" }}>{isCn ? "查看下载" : "View build"}</button>
              </div>
            ))}
          </section>
        ) : prototype === "admin_queue" || prototype === "workflow" ? (
          <section style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 16 }}>
            <div style={{ borderRadius: 24, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{isCn ? "操作队列" : "Action queue"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {prototypeRows.map((item) => (
                  <div key={item.title} style={{ borderRadius: 16, background: "#f8fafc", border: "1px solid rgba(148,163,184,0.14)", padding: 14, display: "flex", justifyContent: "space-between", gap: 16 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{item.title}</div>
                      <div style={{ marginTop: 6, color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>{item.note}</div>
                    </div>
                    <div style={{ color: "#2563eb", fontSize: 12, fontWeight: 900 }}>{item.status}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderRadius: 24, background: "#0f172a", color: "#e2e8f0", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{isCn ? "端到端流程" : "End-to-end flow"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {actions.map((item, index) => (
                  <div key={item} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 10, alignItems: "start" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(37,99,235,0.24)", color: "#93c5fd", fontWeight: 900 }}>{index + 1}</div>
                    <div style={{ borderRadius: 14, background: "rgba(255,255,255,0.06)", padding: "10px 12px" }}>{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : prototype === "timeline" || prototype === "analytics" ? (
          <section style={{ borderRadius: 24, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{prototype === "timeline" ? (isCn ? "时间线" : "Timeline") : (isCn ? "指标分析" : "Analytics")}</div>
            <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
              {prototypeStages.map((stage) => (
                <div key={stage.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", marginBottom: 8 }}>
                    <span>{stage.label}</span>
                    <strong style={{ color: "#0f172a" }}>{stage.value}%</strong>
                  </div>
                  <div style={{ height: 12, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                    <div style={{ width: stage.value + "%", height: "100%", background: stage.tone }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 16 }}>
          <div style={{ borderRadius: 24, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "页面记录" : "Route records"}</div>
            {primaryActions.length ? (
              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {primaryActions.map((item) => (
                  <div key={item} style={{ borderRadius: 999, padding: "6px 10px", background: "rgba(37,99,235,0.08)", color: "#2563eb", fontSize: 12, fontWeight: 700 }}>
                    {item}
                  </div>
                ))}
              </div>
            ) : null}
            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              {records.map((item) => (
                <div key={item.title} style={{ borderRadius: 16, background: "#f8fafc", border: "1px solid rgba(148,163,184,0.14)", padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div style={{ fontWeight: 800 }}>{item.title}</div>
                    <div style={{ borderRadius: 999, padding: "4px 10px", background: "rgba(37,99,235,0.08)", color: "#2563eb", fontSize: 11, fontWeight: 800 }}>
                      {item.status}
                    </div>
                  </div>
                  <div style={{ marginTop: 8, color: "#64748b", lineHeight: 1.7, fontSize: 13 }}>{item.meta}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ borderRadius: 24, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "核心模块" : "Core modules"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {focusAreas.map((item, index) => (
                  <div key={item} style={{ borderRadius: 14, padding: "12px 14px", background: index === 0 ? "rgba(37,99,235,0.08)" : "#f8fafc", border: "1px solid rgba(148,163,184,0.14)" }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderRadius: 24, background: "#0f172a", color: "#e2e8f0", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "实体与工作流" : "Entities and workflow"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {(linkedEntities.length
                  ? linkedEntities.map((item) => ({
                      title: item.label,
                      note: item.workflows.join(" / ") || item.summary,
                    }))
                  : (workflowSteps.length ? workflowSteps : actions).map((item) => ({
                      title: item,
                      note: routeBlueprint?.label || ${JSON.stringify(label)},
                    }))).map((item) => (
                  <div key={item.title} style={{ borderRadius: 12, background: "rgba(255,255,255,0.06)", padding: "10px 12px", color: "#cbd5e1", fontSize: 13 }}>
                    <div style={{ fontWeight: 800, color: "#f8fafc" }}>{item.title}</div>
                    <div style={{ marginTop: 6 }}>{item.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
`
}

export async function buildSpecDrivenWorkspaceFiles(
  projectDir: string,
  spec: AppSpec,
  iterationContext?: SpecIterationContext,
  options?: {
    projectId?: string
    projectSlug?: string
    assignedDomain?: string | null
  }
): Promise<WorkspaceFile[]> {
  const envPath = path.join(projectDir, ".env")
  const currentEnv = await fs.readFile(envPath, "utf8").catch(() => null)
  const dataPath = path.join(projectDir, "data", "items.json")
  const currentData = await fs.readFile(dataPath, "utf8").catch(() => null)
  const files: WorkspaceFile[] = [
    {
      path: ".env",
      content: mergeEnv(currentEnv, spec, options),
      reason: "Sync region-aware environment variables",
    },
    {
      path: "region.config.json",
      content: JSON.stringify(
        {
          region: spec.region,
          planTier: spec.planTier,
          language: spec.language,
          timezone: spec.timezone,
          dateFormat: spec.dateFormat,
          currency: spec.currency,
          deploymentTarget: spec.deploymentTarget,
          databaseTarget: spec.databaseTarget,
          seedTasks: spec.seedItems,
        },
        null,
        2
      ),
      reason: "Persist region config and seed data",
    },
    {
      path: "spec.json",
      content: JSON.stringify(spec, null, 2),
      reason: "Persist spec-driven app definition",
    },
    {
      path: "app/layout.tsx",
      content: renderLayout(spec),
      reason: "Align html lang with workspace region",
    },
    {
      path: "app/page.tsx",
      content: renderPage(spec),
      reason: "Render spec-driven primary workspace page",
    },
    {
      path: "app/api/items/route.ts",
      content: renderApiRoute(),
      reason: "Use JSON-backed workspace API for iteration-safe data edits",
    },
    {
      path: "lib/items-store.ts",
      content: renderItemsStore(),
      reason: "Add durable local data store for generated workspace",
    },
    {
      path: "components/generated/workspace-shell.tsx",
      content: renderWorkspaceShellComponent(),
      reason: "Split generated workspace layout into reusable shell component",
    },
    {
      path: "components/generated/workspace-stat-card.tsx",
      content: renderWorkspaceStatCardComponent(),
      reason: "Split generated dashboard stats into reusable component",
    },
    {
      path: "components/generated/task-card.tsx",
      content: renderTaskCardComponent(),
      reason: "Split generated task cards into reusable component",
    },
    {
      path: "components/generated/board-column.tsx",
      content: renderBoardColumnComponent(),
      reason: "Split generated board columns into reusable component",
    },
    {
      path: "components/generated/page-section.tsx",
      content: renderPageSectionComponent(),
      reason: "Split repeated workspace sections into reusable component",
    },
    {
      path: "components/generated/recent-item-card.tsx",
      content: renderRecentItemCardComponent(),
      reason: "Split recent activity cards into reusable component",
    },
    {
      path: "components/generated/progress-panel.tsx",
      content: renderProgressPanelComponent(),
      reason: "Split progress tracker into reusable component",
    },
    {
      path: "components/generated/activity-feed.tsx",
      content: renderActivityFeedComponent(),
      reason: "Split activity feed into reusable component",
    },
    {
      path: "components/generated/insight-tile.tsx",
      content: renderInsightTileComponent(),
      reason: "Split metric insight tiles into reusable component",
    },
    {
      path: "data/items.json",
      content: currentData ?? "[]\n",
      reason: "Initialize workspace data file",
    },
  ]
  const pushWorkspaceFile = (file: WorkspaceFile) => {
    if (!files.some((item) => item.path === file.path)) {
      files.push(file)
    }
  }
  const archetype = getScaffoldArchetype(spec)
  const routeSet = new Set(extractPlannedRouteNames(spec))
  const shouldEmitTasksPage = routeSet.has("tasks") || shouldRenderTaskWorkbench(spec)

  if (shouldEmitTasksPage) {
    pushWorkspaceFile({
      path: "app/tasks/page.tsx",
      content: renderTasksPage(spec),
      reason: shouldRenderTaskWorkbench(spec)
        ? "Add a scene-aware generated tasks entry page"
        : "Add generated tasks entry page for planned task routes",
    })
  }

  if (archetype === "code_platform" || archetype !== "task" || spec.planTier === "pro" || spec.planTier === "elite") {
    pushWorkspaceFile({
      path: "app/dashboard/page.tsx",
      content: renderDashboardPage(spec),
      reason: archetype === "code_platform"
        ? "Add generated dashboard overview entry page for code-platform projects"
        : archetype !== "task"
          ? "Add generated dashboard overview entry page for scaffold-driven application projects"
          : "Add generated dashboard overview entry page for pro tiers",
    })
  }

  if (archetype === "code_platform") {
    if (routeSet.has("editor")) {
      pushWorkspaceFile({
        path: "app/editor/page.tsx",
        content: renderCodeEditorPage(spec, iterationContext),
        reason: "Add dedicated editor page for code-platform projects",
      })
    }
    if (routeSet.has("runs")) {
      pushWorkspaceFile({
        path: "app/runs/page.tsx",
        content: renderCodeRunsPage(spec),
        reason: "Add runtime and preview page for code-platform projects",
      })
    }
    if (routeSet.has("templates")) {
      pushWorkspaceFile({
        path: "app/templates/page.tsx",
        content: renderCodeTemplatesPage(spec),
        reason: "Add template gallery page for code-platform projects",
      })
    }
    if (routeSet.has("pricing")) {
      pushWorkspaceFile({
        path: "app/pricing/page.tsx",
        content: renderCodePricingPage(spec),
        reason: "Add upgrade and pricing page for code-platform projects",
      })
    }
    if (routeSet.has("settings")) {
      pushWorkspaceFile({
        path: "app/settings/page.tsx",
        content: renderCodeSettingsPage(spec),
        reason: "Add environment, database, and access settings page for code-platform projects",
      })
    }
  }

  if (archetype === "crm") {
    pushWorkspaceFile(
      {
        path: "app/leads/page.tsx",
        content: renderArchetypeConsolePage(spec, "leads") ?? renderTemplateExtraPage(spec, "leads"),
        reason: "Add lead pool page for CRM scaffold",
      }
    )
    pushWorkspaceFile(
      {
        path: "app/pipeline/page.tsx",
        content: renderArchetypeConsolePage(spec, "pipeline") ?? renderTasksPage(spec),
        reason: "Add deal progression page for CRM scaffold",
      }
    )
    pushWorkspaceFile(
      {
        path: "app/customers/page.tsx",
        content: renderArchetypeConsolePage(spec, "customers") ?? renderTasksPage(spec),
        reason: "Add customer account page for CRM scaffold",
      }
    )
    pushWorkspaceFile(
      {
        path: "app/automations/page.tsx",
        content: renderArchetypeConsolePage(spec, "automations") ?? renderTasksPage(spec),
        reason: "Add automation rules page for CRM scaffold",
      }
    )
  }

  if (archetype === "api_platform") {
    pushWorkspaceFile(
      {
        path: "app/endpoints/page.tsx",
        content: renderArchetypeConsolePage(spec, "endpoints") ?? renderTemplateExtraPage(spec, "incidents"),
        reason: "Add endpoint catalog page for API platform scaffold",
      }
    )
    pushWorkspaceFile(
      {
        path: "app/logs/page.tsx",
        content: renderArchetypeConsolePage(spec, "logs") ?? renderTemplateExtraPage(spec, "incidents"),
        reason: "Add logs and diagnostics page for API platform scaffold",
      }
    )
    pushWorkspaceFile(
      {
        path: "app/auth/page.tsx",
        content: renderArchetypeConsolePage(spec, "auth") ?? renderTasksPage(spec),
        reason: "Add auth and policy page for API platform scaffold",
      }
    )
    pushWorkspaceFile(
      {
        path: "app/environments/page.tsx",
        content: renderArchetypeConsolePage(spec, "environments") ?? renderTasksPage(spec),
        reason: "Add environments page for API platform scaffold",
      }
    )
  }

  if (archetype === "marketing_admin") {
    pushWorkspaceFile(
      {
        path: "app/website/page.tsx",
        content: renderArchetypeConsolePage(spec, "website") ?? renderTasksPage(spec),
        reason: "Add website structure page for marketing-admin scaffold",
      }
    )
    pushWorkspaceFile(
      {
        path: "app/download/page.tsx",
        content: renderArchetypeConsolePage(spec, "download") ?? renderTemplateExtraPage(spec, "download"),
        reason: "Add download center page for marketing-admin scaffold",
      }
    )
    pushWorkspaceFile(
      {
        path: "app/docs/page.tsx",
        content: renderArchetypeConsolePage(spec, "docs") ?? renderTasksPage(spec),
        reason: "Add docs center page for marketing-admin scaffold",
      }
    )
    pushWorkspaceFile(
      {
        path: "app/admin/page.tsx",
        content: renderArchetypeConsolePage(spec, "admin") ?? renderTasksPage(spec),
        reason: "Add admin console page for marketing-admin scaffold",
      }
    )
  }

  if (archetype === "community") {
    pushWorkspaceFile(
      {
        path: "app/feedback/page.tsx",
        content: renderArchetypeConsolePage(spec, "feedback") ?? renderTemplateExtraPage(spec, "events"),
        reason: "Add feedback page for community scaffold",
      }
    )
  }

  if (hasFeature(spec, "about_page") && (archetype !== "code_platform" || routeSet.has("about"))) {
    pushWorkspaceFile({
      path: "app/about/page.tsx",
      content: renderAboutPage(spec),
      reason: "Add about page requested in spec",
    })
  }

  if (hasFeature(spec, "analytics_page") && (archetype !== "code_platform" || routeSet.has("analytics"))) {
    pushWorkspaceFile({
      path: "app/analytics/page.tsx",
      content: renderAnalyticsPage(spec),
      reason: "Add analytics page requested in spec",
    })
  }

  if (spec.templateId === "opsdesk" && archetype !== "crm") {
    pushWorkspaceFile({
      path: "app/leads/page.tsx",
      content: renderTemplateExtraPage(spec, "leads"),
      reason: "Add dedicated lead pool page for CRM-style products",
    })
  }

  if (spec.templateId === "taskflow" && archetype !== "task") {
    pushWorkspaceFile({
      path: "app/incidents/page.tsx",
      content: renderTemplateExtraPage(spec, "incidents"),
      reason: "Add dedicated incident page for API platform products",
    })
  }

  if (spec.templateId === "orbital" && archetype !== "api_platform") {
    pushWorkspaceFile({
      path: "app/events/page.tsx",
      content: renderTemplateExtraPage(spec, "events"),
      reason: "Add event page for community-oriented products",
    })
  }

  if (spec.templateId === "serenity" && archetype !== "community") {
    pushWorkspaceFile({
      path: "app/feedback/page.tsx",
      content: renderTemplateExtraPage(spec, "events"),
      reason: "Add feedback page for community-oriented products",
    })
  }

  if (spec.templateId === "launchpad" && archetype !== "marketing_admin") {
    pushWorkspaceFile({
      path: "app/download/page.tsx",
      content: renderTemplateExtraPage(spec, "download"),
      reason: "Add download center for launch and website products",
    })
  }

  const plannedRoutes = extractPlannedRouteNames(spec)
  for (const route of plannedRoutes) {
    if (route === "home") continue
    const filePath = `app/${route}/page.tsx`
    if (files.some((item) => item.path === filePath)) continue
    const content =
      route === "dashboard"
        ? renderDashboardPage(spec)
        : route === "tasks"
          ? renderTasksPage(spec)
          : route === "analytics"
            ? renderAnalyticsPage(spec)
            : route === "about"
              ? renderAboutPage(spec)
              : renderArchetypeConsolePage(spec, route) ?? renderGenericPlannerPage(spec, route, plannedRoutes)
    pushWorkspaceFile({
      path: filePath,
      content,
      reason: `Add planned ${route} page inferred from the generation spec`,
    })
  }

  if (spec.planTier === "elite") {
    pushWorkspaceFile(
      {
        path: "app/reports/page.tsx",
        content: renderReportsPage(spec),
        reason: "Add elite reporting page for deeper project structure",
      }
    )
    pushWorkspaceFile(
      {
        path: "app/team/page.tsx",
        content: renderTeamPage(spec),
        reason: "Add elite collaboration page for deeper project structure",
      }
    )
  }

  return files
}
