import path from "path"
import { promises as fs } from "fs"
import { type Region, writeTextFile } from "@/lib/project-workspace"
import type { PlanTier } from "@/lib/plan-catalog"
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

export function deriveProjectHeadline(prompt: string) {
  const explicitName = extractProductNameFromPrompt(prompt)
  if (explicitName) return explicitName
  const clean = sanitizeUiText(prompt)
  if (!clean) return "Generated Task Workspace"
  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean
}

export function inferAppKind(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  if (/cursor|code editor|ide|developer platform|coding workspace|ai coding|代码编辑器|编程平台|开发者平台|代码平台|代码工作台/.test(text)) return "code_platform"
  if (/crm|customer|sales|pipeline|lead|客户|销售|跟进/.test(text)) return "crm"
  if (/website|landing|homepage|download|docs|documentation|官网|落地页|下载页|文档/.test(text)) return "blog"
  if (/blog|article|post|博客|文章|内容/.test(text)) return "blog"
  if (/community|club|social|group|社区|社团|社交/.test(text)) return "community"
  return "task"
}

function inferTemplateIdFromPrompt(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  if (/cursor|code editor|ide|developer platform|coding workspace|ai coding|代码编辑器|编程平台|开发者平台|代码平台|代码工作台/.test(text)) {
    return "siteforge"
  }
  if (/crm|customer|sales|pipeline|lead|客户|销售|跟进/.test(text)) {
    return "opsdesk"
  }
  if (/admin|ops|internal tool|backoffice|back office|control plane|管理后台|运营后台|内部工具|审批|工单|控制台/.test(text)) {
    return "opsdesk"
  }
  if (/website|landing|homepage|download|docs|documentation|官网|落地页|下载页|文档/.test(text)) {
    return "launchpad"
  }
  if (/api|analytics|dashboard|monitoring|usage trend|error alert|接口|分析平台|仪表盘|监控|趋势/.test(text)) {
    return "taskflow"
  }
  if (/community|club|social|group|announcement|event|feedback|社区|社团|社交|公告|活动|反馈/.test(text)) {
    return "orbital"
  }
  return undefined
}

function uniqueStrings(input: string[]) {
  return Array.from(new Set(input.map((item) => sanitizeUiText(item)).filter(Boolean)))
}

function inferScaffoldArchetypeFromPrompt(prompt: string): ScaffoldArchetype {
  const text = String(prompt ?? "").toLowerCase()
  if (/cursor|code editor|ide|developer platform|coding workspace|ai coding|代码编辑器|编程平台|开发者平台|代码平台|代码工作台/.test(text)) {
    return "code_platform"
  }
  if (/crm|customer|sales|pipeline|lead|客户|销售|跟进/.test(text)) {
    return "crm"
  }
  if (/api|sdk|developer portal|endpoint|observability|monitoring|usage trend|error alert|接口|分析平台|监控|趋势|日志|鉴权|环境/.test(text)) {
    return "api_platform"
  }
  if (/website|landing|homepage|download|docs|documentation|marketing|brand|官网|落地页|下载页|文档|品牌|增长/.test(text)) {
    return "marketing_admin"
  }
  if (/community|club|social|group|announcement|event|feedback|社区|社团|社交|公告|活动|反馈/.test(text)) {
    return "community"
  }
  if (/blog|article|post|博客|文章|内容/.test(text)) {
    return "content"
  }
  return "task"
}

function getScaffoldArchetype(spec: Pick<AppSpec, "kind" | "templateId" | "prompt">): ScaffoldArchetype {
  if (spec.kind === "code_platform") return "code_platform"
  if (spec.kind === "crm" || spec.templateId === "opsdesk") return "crm"
  if (spec.kind === "community" || spec.templateId === "orbital") return "community"
  if (spec.kind === "blog") return "content"
  if (spec.templateId === "taskflow") return "api_platform"
  if (spec.templateId === "launchpad") return "marketing_admin"
  return inferScaffoldArchetypeFromPrompt(spec.prompt)
}

function pushFeature(features: SpecFeature[], feature: SpecFeature) {
  if (!features.includes(feature)) features.push(feature)
}

function pushModule(modules: string[], module: string) {
  const safe = sanitizeUiText(module)
  if (safe && !modules.includes(safe)) modules.push(safe)
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

function getKindModules(kind: AppKind, region: Region) {
  if (kind === "code_platform") {
    return region === "cn"
      ? ["AI 对话编程", "项目文件树", "多标签编辑器", "终端与运行反馈"]
      : ["AI coding panel", "Project file tree", "Multi-tab editor", "Terminal and run feedback"]
  }
  if (kind === "crm") {
    return region === "cn"
      ? ["销售线索", "阶段推进", "负责人视图"]
      : ["Lead pipeline", "Stage workflow", "Owner view"]
  }
  if (kind === "blog") {
    return region === "cn"
      ? ["内容排期", "文章状态", "作者协作"]
      : ["Content planning", "Post status", "Author workflow"]
  }
  if (kind === "community") {
    return region === "cn"
      ? ["活动安排", "成员分组", "公告管理"]
      : ["Events", "Member groups", "Announcements"]
  }
  return region === "cn"
    ? ["任务看板", "优先级管理", "负责人协同"]
    : ["Task board", "Priority management", "Assignee collaboration"]
}

function getArchetypeModules(archetype: ScaffoldArchetype, region: Region) {
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
  if (archetype === "community") {
    return region === "cn"
      ? ["活动编排", "成员分层", "公告与反馈", "内容运营"]
      : ["Event orchestration", "Member segments", "Announcements and feedback", "Content ops"]
  }
  if (archetype === "content") {
    return region === "cn"
      ? ["内容日历", "栏目管理", "作者协作", "发布节奏"]
      : ["Content calendar", "Section management", "Author collaboration", "Publishing cadence"]
  }
  return []
}

function getPlanModules(planTier: PlanTier, region: Region) {
  if (planTier === "elite") {
    return region === "cn"
      ? ["多页面工作台", "展示级视觉系统", "团队协同模块"]
      : ["Multi-page workspace", "Showcase visual system", "Team collaboration modules"]
  }
  if (planTier === "pro") {
    return region === "cn"
      ? ["分析总览", "导出流程", "持续迭代面板"]
      : ["Analytics overview", "Export flow", "Continuous iteration panel"]
  }
  if (planTier === "builder") {
    return region === "cn"
      ? ["看板与列表双视图", "分组筛选", "统计卡片"]
      : ["Board and list views", "Grouped filtering", "Metric cards"]
  }
  if (planTier === "starter" || planTier === "free") {
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
        ? ["深色指挥台", "近期动态", "优先级分布", "数据概览"]
        : ["Dark command center", "Recent activity", "Priority distribution", "Data overview"]
    case "opsdesk":
      return region === "cn"
        ? ["浅色运营后台", "快捷操作", "项目总览", "多彩指标卡"]
        : ["Light ops admin", "Quick actions", "Project overview", "Colorful metrics"]
    case "siteforge":
      return region === "cn"
        ? ["生成流程面板", "模板画廊", "结果预览", "创作型工作台"]
        : ["Generation flow", "Template gallery", "Result preview", "Creator workspace"]
    case "serenity":
      return region === "cn"
        ? ["品牌故事", "预约转化", "服务介绍", "门店信任感"]
        : ["Brand story", "Booking conversion", "Service highlights", "Store trust"]
    case "orbital":
      return region === "cn"
        ? ["未来感英雄区", "功能亮点", "价格方案", "强视觉主屏"]
        : ["Futuristic hero", "Feature blocks", "Pricing plans", "Immersive surface"]
    case "launchpad":
      return region === "cn"
        ? ["高转化首页", "价格对比", "客户背书", "FAQ 模块"]
        : ["Conversion homepage", "Pricing comparison", "Customer proof", "FAQ module"]
    default:
      return []
  }
}

function getTemplateFeatures(templateId: string | undefined, planTier: PlanTier): SpecFeature[] {
  const template = getTemplateById(templateId)
  if (!template) return []

  switch (template.id) {
    case "taskflow":
    case "opsdesk":
      return [
        "description_field",
        "assignee_filter",
        "csv_export",
        ...((planTier === "free" || planTier === "starter") ? [] : (["analytics_page", "blocked_status"] as SpecFeature[])),
      ]
    case "siteforge":
      return ["description_field", "about_page", ...((planTier === "free" ? [] : ["analytics_page"]) as SpecFeature[])]
    case "serenity":
    case "orbital":
    case "launchpad":
      return ["about_page"]
    default:
      return []
  }
}

function getSeedItems(kind: AppKind, region: Region, features: SpecFeature[], planTier: PlanTier): SeedItem[] {
  const blockedEnabled = features.includes("blocked_status")
  const extraCount = planTier === "elite" ? 3 : planTier === "pro" ? 2 : planTier === "builder" ? 1 : 0
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
  const inferredKind = inferAppKind(prompt)
  const inferredTemplateId = existing?.templateId ?? inferTemplateIdFromPrompt(prompt)
  const explicitName = extractProductNameFromPrompt(prompt)
  const template = getTemplateById(inferredTemplateId)
  const templateKind =
    template?.id === "siteforge"
      ? "code_platform"
      : template?.id === "orbital"
        ? "community"
        : template?.id === "serenity" || template?.id === "launchpad"
          ? "blog"
          : template?.id === "opsdesk"
            ? "crm"
            : template?.id === "taskflow"
              ? "task"
        : undefined
  const kind =
    inferredKind !== "task"
      ? inferredKind
      : existing?.kind && existing.kind !== "task"
        ? existing.kind
        : templateKind ?? "task"
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
    ...getKindModules(kind, region),
    ...getArchetypeModules(archetype, region),
    ...getPlanModules(planTier, region),
    ...getTemplateModules(inferredTemplateId, region),
  ])
  return {
    title:
      existing?.title ??
      explicitName ??
      (template ? (region === "cn" ? template.titleZh : template.titleEn) : deriveProjectHeadline(prompt)),
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
    seedItems: existing?.seedItems ?? getSeedItems(kind, region, features, planTier),
  }
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
  const inferredTemplateId = spec.templateId ?? inferTemplateIdFromPrompt(prompt)
  next.templateId = inferredTemplateId
  next.templateStyle = next.templateStyle ?? getTemplateById(inferredTemplateId)?.previewStyle
  const features = [...spec.features, ...getTemplateFeatures(inferredTemplateId, spec.planTier)]
  const nextKind = spec.kind === "task" ? inferAppKind(prompt) : spec.kind
  const nextArchetype = getScaffoldArchetype({ kind: nextKind, templateId: inferredTemplateId, prompt })
  const modules = [...spec.modules, ...getTemplateModules(inferredTemplateId, spec.region), ...getArchetypeModules(nextArchetype, spec.region)]
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
  next.seedItems = getSeedItems(next.kind, next.region, next.features, next.planTier)
  return next
}

function mergeEnv(existing: string | null, spec: AppSpec) {
  const dbMatch = existing?.match(/^DATABASE_URL=.*$/m)
  const dbLine = dbMatch?.[0] ?? `DATABASE_URL="file:./${spec.region === "cn" ? "cn" : "intl"}.db"`
  const deployment = getDeploymentOption(spec.deploymentTarget)
  const database = getDatabaseOption(spec.databaseTarget)
  return [
    dbLine,
    `APP_REGION="${spec.region}"`,
    `APP_PLAN_TIER="${spec.planTier}"`,
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
  const itemSingular =
    spec.kind === "crm"
      ? cn
        ? "线索"
        : "Lead"
      : spec.kind === "code_platform"
        ? cn
          ? "开发任务"
          : "Dev task"
      : spec.kind === "blog"
        ? cn
          ? "文章"
          : "Post"
        : spec.kind === "community"
          ? cn
            ? "事项"
            : "Item"
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
      spec.kind === "code_platform"
        ? cn
          ? "开发驾驶舱"
          : "Engineering cockpit"
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
      spec.kind === "crm"
        ? spec.region === "cn"
          ? "跟进线索、推进阶段、掌握负责人节奏"
          : "Track leads, stages, and owner momentum in one place"
        : spec.kind === "code_platform"
          ? spec.region === "cn"
            ? "更像中国版 Cursor 的 AI 代码工作台"
            : "An AI coding workspace shaped more like a modern Cursor-style product"
        : spec.region === "cn"
          ? "一个看起来像成品的任务管理工作区"
          : "A task management workspace that already feels like a product",
    description:
      spec.kind === "code_platform"
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
        ]
  }

  if (archetype === "api_platform") {
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

  return []
}

function renderArchetypeWorkspaceHome(spec: AppSpec) {
  const pages = getArchetypePageDefinitions(spec)
  if (!pages.length) return null
  const isCn = spec.region === "cn"
  const brand = spec.title
  const archetype = getScaffoldArchetype(spec)
  const accent =
    archetype === "crm" ? "#2563eb" : archetype === "api_platform" ? "#06b6d4" : archetype === "marketing_admin" ? "#111827" : "#7c3aed"

  return `import Link from "next/link";

export default function Page() {
  const isCn = ${isCn ? "true" : "false"};
  const pages = ${JSON.stringify(pages, null, 2)} as const;
  const brand = ${JSON.stringify(brand)};
  const accent = ${JSON.stringify(accent)};
  return (
    <main style={{ minHeight: "100vh", padding: 28, fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", background: "linear-gradient(180deg,#f7f8fc 0%,#ffffff 54%,#eef4ff 100%)", color: "#0f172a" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, padding: 26, background: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,255,255,0.96))", border: "1px solid rgba(148,163,184,0.18)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(15,23,42,0.06)", color: accent, fontSize: 12, fontWeight: 800 }}>
                {isCn ? "应用工作区骨架" : "Application workspace scaffold"}
              </div>
              <h1 style={{ margin: "14px 0 8px", fontSize: 36, fontWeight: 900 }}>{brand}</h1>
              <p style={{ margin: 0, maxWidth: 860, color: "#475569", lineHeight: 1.8 }}>
                {isCn
                  ? "这一版不再只输出页面，而是把首页、控制台、模块页和运营路径组织成一个可继续扩展的应用工作区。"
                  : "This version moves beyond page generation and organizes the result as an extensible application workspace with modules and control surfaces."}
              </p>
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
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "模块导航" : "Module navigation"}</div>
            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              {pages.map((page, index) => (
                <Link key={page.route} href={page.route === "dashboard" ? "/dashboard" : "/" + page.route} style={{ textDecoration: "none", borderRadius: 16, padding: "14px 16px", background: index === 0 ? "rgba(37,99,235,0.08)" : "#f8fafc", color: "#0f172a", border: "1px solid rgba(148,163,184,0.14)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 800 }}>{page.headline}</div>
                    <div style={{ borderRadius: 999, padding: "4px 8px", background: "#ffffff", color: accent, fontSize: 11, fontWeight: 800 }}>{page.label}</div>
                  </div>
                  <div style={{ marginTop: 8, color: "#64748b", fontSize: 13, lineHeight: 1.7 }}>{page.subheadline}</div>
                </Link>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ borderRadius: 24, background: "#0f172a", color: "#e2e8f0", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "为什么这更像应用" : "Why this feels like an app"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {(isCn
                  ? ["不再只靠首页承接全部信息", "每个 archetype 都有自己的一组模块页", "控制台、运营页、文档页和后台配置开始分层"]
                  : ["The home page no longer carries everything", "Each archetype gets its own module set", "Console, ops, docs, and admin layers now diverge"]).map((item) => (
                  <div key={item} style={{ borderRadius: 12, background: "rgba(255,255,255,0.06)", padding: "10px 12px", color: "#cbd5e1", fontSize: 13 }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderRadius: 24, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "当前重点" : "Current focus"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {pages[0].focusAreas.map((item) => (
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
  const brand = spec.title
  const archetype = getScaffoldArchetype(spec)
  const accent =
    archetype === "crm" ? "#2563eb" : archetype === "api_platform" ? "#06b6d4" : archetype === "marketing_admin" ? "#111827" : "#7c3aed"
  const panelBackground = archetype === "api_platform" ? "#081120" : "#ffffff"
  const panelText = archetype === "api_platform" ? "#e2e8f0" : "#0f172a"
  const mutedText = archetype === "api_platform" ? "#94a3b8" : "#64748b"
  const surface = archetype === "api_platform" ? "rgba(15,23,42,0.78)" : "#f8fafc"
  const border = archetype === "api_platform" ? "1px solid rgba(148,163,184,0.12)" : "1px solid rgba(148,163,184,0.16)"

  return `// @ts-nocheck
import Link from "next/link";

export default function GeneratedConsolePage() {
  const isCn = ${isCn ? "true" : "false"};
  const brand = ${JSON.stringify(brand)};
  const pages = ${JSON.stringify(pages, null, 2)} as const;
  const current = ${JSON.stringify(current, null, 2)} as const;
  const accent = ${JSON.stringify(accent)};
  const panelBackground = ${JSON.stringify(panelBackground)};
  const panelText = ${JSON.stringify(panelText)};
  const mutedText = ${JSON.stringify(mutedText)};
  const surface = ${JSON.stringify(surface)};
  const border = ${JSON.stringify(border)};

  return (
    <main style={{ minHeight: "100vh", padding: 28, fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", background: ${JSON.stringify(archetype === "api_platform" ? "linear-gradient(180deg,#07111f 0%,#0b1220 100%)" : "linear-gradient(180deg,#f6f8fc 0%,#ffffff 52%,#eef4ff 100%)")}, color: panelText }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 26, border, background: panelBackground, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: ${JSON.stringify(archetype === "api_platform" ? "rgba(6,182,212,0.16)" : "rgba(15,23,42,0.06)")}, color: accent, fontSize: 12, fontWeight: 800 }}>
                {brand}
              </div>
              <h1 style={{ margin: "14px 0 8px", fontSize: 34, fontWeight: 900 }}>{current.headline}</h1>
              <p style={{ margin: 0, maxWidth: 860, color: mutedText, lineHeight: 1.8 }}>{current.subheadline}</p>
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
          {[
            { label: current.metricLabel, value: current.metricValue, tone: accent },
            { label: current.insightLabel, value: current.insightValue, tone: accent },
            { label: isCn ? "页面角色" : "Page role", value: current.label, tone: panelText },
            { label: isCn ? "模块数量" : "Linked modules", value: String(current.focusAreas.length), tone: panelText },
          ].map((item) => (
            <div key={item.label} style={{ borderRadius: 20, border, background: panelBackground, padding: 18 }}>
              <div style={{ color: mutedText, fontSize: 12 }}>{item.label}</div>
              <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: item.tone }}>{item.value}</div>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 16 }}>
          <div style={{ borderRadius: 24, border, background: panelBackground, padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "当前页说明" : "Current page overview"}</div>
            <p style={{ marginTop: 12, color: mutedText, lineHeight: 1.8 }}>{current.summary}</p>
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
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "核心模块" : "Core modules"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {current.focusAreas.map((item, index) => (
                  <div key={item} style={{ borderRadius: 14, padding: "12px 14px", background: index === 0 ? ${JSON.stringify(archetype === "api_platform" ? "rgba(6,182,212,0.16)" : "rgba(37,99,235,0.08)")} : surface, border, color: panelText }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderRadius: 24, border, background: panelBackground, padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "下一步动作" : "Suggested next actions"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {(isCn
                  ? ["补真实数据读写", "让 AI 修改能反写到当前模块", "继续拉开各 archetype 的模块深度"]
                  : ["Connect real data reads and writes", "Let AI edits write back into this module", "Keep widening archetype-specific depth"]).map((item, index) => (
                  <div key={item} style={{ borderRadius: 14, padding: "12px 14px", background: index === 0 ? ${JSON.stringify(archetype === "api_platform" ? "rgba(6,182,212,0.16)" : "rgba(37,99,235,0.08)")} : surface, border, color: panelText, fontSize: 13 }}>
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

function renderCodePlatformHome(spec: AppSpec) {
  const isCn = spec.region === "cn"
  const brand = spec.title
  const heroTitle = isCn ? "早上好，开发者" : "Good morning, builder"
  const heroDesc = isCn
    ? "今日已完成 47 次构建，AI 协助修复了 12 个问题。项目整体进度良好。"
    : "47 builds completed today, with AI assisting on 12 fixes. Overall progress is healthy."
  const projectRows = isCn
    ? [
        { name: "MornCursor 官网", stack: "TypeScript", desc: "产品官网与下载站", progress: 85, tone: "#8b5cf6", time: "3 分钟前" },
        { name: "销售管理后台", stack: "React", desc: "CRM 销售闭环系统", progress: 62, tone: "#3b82f6", time: "1 小时前" },
        { name: "API 数据平台", stack: "Python", desc: "接口管理与监控中心", progress: 41, tone: "#10b981", time: "2 小时前" },
        { name: "社区反馈中心", stack: "Vue", desc: "用户反馈与工单系统", progress: 93, tone: "#f59e0b", time: "5 小时前" },
      ]
    : [
        { name: "MornCursor website", stack: "TypeScript", desc: "Homepage and download hub", progress: 85, tone: "#8b5cf6", time: "3 min ago" },
        { name: "Sales admin", stack: "React", desc: "CRM closing workspace", progress: 62, tone: "#3b82f6", time: "1 hour ago" },
        { name: "API platform", stack: "Python", desc: "Interface and monitoring center", progress: 41, tone: "#10b981", time: "2 hours ago" },
        { name: "Community hub", stack: "Vue", desc: "Feedback and ticketing workspace", progress: 93, tone: "#f59e0b", time: "5 hours ago" },
      ]
  const quickActions = isCn
    ? [
        { title: "新建项目", desc: "从模板快速创建", tone: "#7c3aed" },
        { title: "AI 生成", desc: "描述需求自动生成", tone: "#0ea5e9" },
        { title: "导入仓库", desc: "从 Git 导入项目", tone: "#10b981" },
        { title: "快速部署", desc: "一键发布到预览链路", tone: "#f59e0b" },
      ]
    : [
        { title: "New project", desc: "Start from a template", tone: "#7c3aed" },
        { title: "AI generate", desc: "Describe the app and build", tone: "#0ea5e9" },
        { title: "Import repo", desc: "Bring in an existing Git repo", tone: "#10b981" },
        { title: "Deploy", desc: "Ship to a preview instantly", tone: "#f59e0b" },
      ]
  const activityItems = isCn
    ? [
        { title: "AI 自动修复了 3 个 ESLint 错误", meta: "官网项目  ·  2 分钟前", tone: "#8b5cf6" },
        { title: "构建成功 #247 已部署到预发布", meta: "销售后台  ·  15 分钟前", tone: "#10b981" },
        { title: "模板同步完成，更新了价格页套餐差异", meta: "MornCursor  ·  28 分钟前", tone: "#3b82f6" },
      ]
    : [
        { title: "AI repaired 3 ESLint issues", meta: "Website  ·  2 min ago", tone: "#8b5cf6" },
        { title: "Build #247 shipped to preview", meta: "Sales admin  ·  15 min ago", tone: "#10b981" },
        { title: "Template sync updated pricing tiers", meta: "MornCursor  ·  28 min ago", tone: "#3b82f6" },
      ]

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
              <div style={{ width: 40, height: 40, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#9333ea)", display: "grid", placeItems: "center", fontSize: 20 }}>✦</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{${JSON.stringify(brand)}}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{isCn ? "中国版 AI 编程平台" : "China-ready AI coding platform"}</div>
              </div>
              <div style={{ borderRadius: 10, padding: "6px 10px", background: "rgba(124,58,237,0.2)", color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>
                ${spec.planTier === "elite" ? "Elite" : spec.planTier === "pro" ? "Pro" : "Free"}
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
              <div style={{ width: 38, height: 38, borderRadius: 999, background: "linear-gradient(135deg,#8b5cf6,#a855f7)", display: "grid", placeItems: "center", fontWeight: 800 }}>M</div>
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
            <Link href="/downloads" style={{ textDecoration: "none", color: "#6b7280" }}>${isCn ? "下载" : "Download"}</Link>
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
              <Link href="/downloads" style={{ textDecoration: "none", borderRadius: 14, padding: "14px 18px", border: "1px solid rgba(17,24,39,0.12)", color: "#111827", fontWeight: 800 }}>${isCn ? "下载中心" : "Download center"}</Link>
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
  if (spec.kind === "code_platform") {
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
              { href: "/downloads", label: isCn ? "下载中心" : "Downloads" },
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
        { label: "验收状态", value: spec.planTier === "elite" ? "Showcase" : spec.planTier === "pro" ? "Demo+" : "Scaffold", tone: "#f59e0b", delta: spec.deploymentTarget },
      ]
    : [
        { label: "Routes", value: String(routeCount), tone: "#8b5cf6", delta: `+${Math.max(1, routeCount - 4)}` },
        { label: "Modules", value: String(moduleCount), tone: "#22c55e", delta: `+${Math.max(1, moduleCount - 6)}` },
        { label: "AI surfaces", value: String(featureCount + 4), tone: "#38bdf8", delta: `+${featureCount}` },
        { label: "Acceptance", value: spec.planTier === "elite" ? "Showcase" : spec.planTier === "pro" ? "Demo+" : "Scaffold", tone: "#f59e0b", delta: spec.deploymentTarget },
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

    setActiveMode(mode);
    setActiveRail(activityBarItems[4].label);
    setRuntimeState(mode === aiModes[1] ? "running" : "ready");
    setTerminalTab(mode === aiModes[1] ? "problems" : "output");
    openFile(targetFile.id);
    setDrafts((current) => ({
      ...current,
      [targetFile.id]: current[targetFile.id].includes(tag)
        ? current[targetFile.id]
        : current[targetFile.id] +
          "\\n\\n" +
          tag +
          "\\n" +
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
              <div style={{ borderRadius: 10, padding: "6px 10px", background: "rgba(124,58,237,0.2)", color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>${spec.planTier === "elite" ? "Elite" : spec.planTier === "pro" ? "Pro" : "Free"}</div>
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
              <div style={{ borderRadius: 10, padding: "6px 10px", background: "rgba(124,58,237,0.2)", color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>${spec.planTier === "elite" ? "Elite" : spec.planTier === "pro" ? "Pro" : "Free"}</div>
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
              <div style={{ borderRadius: 10, padding: "6px 10px", background: "rgba(124,58,237,0.2)", color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>${spec.planTier === "elite" ? "Elite" : spec.planTier === "pro" ? "Pro" : "Free"}</div>
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
  const plans = isCn
    ? [
        { name: "免费版", sub: "Free", price: "¥0", desc: "个人开发者与学习者", cta: "免费开始", featured: false, points: ["核心 IDE 编辑器", "AI 代码补全 (每日 50 次)", "3 个项目空间", "代码在线查看，不可导出", "数据库仅在线试用"] },
        { name: "专业版", sub: "Pro", price: "¥99", desc: "中小团队与专业开发者", cta: "立即升级", featured: true, points: ["核心 IDE 编辑器", "AI 代码补全 (无限次)", "20 个项目空间", "代码可导出", "数据库可连接正式环境", "构建 / 测试 / 部署面板"] },
        { name: "精英版", sub: "Elite", price: "¥299", desc: "大型团队与企业级交付", cta: "立即升级", featured: false, points: ["全部专业版功能", "无限项目空间", "50 人团队协作", "团队级代码导出与交接", "数据库权限分层与资源配额", "汇报中心与宣传资产联动"] },
      ]
    : [
        { name: "Free", sub: "Free", price: "$0", desc: "For solo developers", cta: "Start free", featured: false, points: ["Core IDE shell", "AI completions", "3 projects", "Code stays in-browser, no export", "Database stays online-only"] },
        { name: "Pro", sub: "Pro", price: "$19", desc: "For serious builders", cta: "Upgrade now", featured: true, points: ["Unlimited AI assists", "20 projects", "Full template library", "Code export enabled", "Production database access", "Build and deploy panel"] },
        { name: "Elite", sub: "Elite", price: "$59", desc: "For teams and delivery", cta: "Upgrade now", featured: false, points: ["Everything in Pro", "Unlimited projects", "Team collaboration", "Team handoff and code export", "Database quotas and role controls", "Reporting center"] },
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
    ...(${spec.planTier === "elite" ? "true" : "false"}
      ? [
          { href: "/reports", label: isCn ? "汇报" : "Reports" },
          { href: "/team", label: isCn ? "团队" : "Team" },
        ]
      : []),
  ] as const;
  const comparisons = ${JSON.stringify(
    isCn
      ? [
          { label: "AI 生成次数", free: "50 / 天", pro: "无限", elite: "无限 + 团队队列" },
          { label: "工作区数量", free: "3", pro: "20", elite: "无限" },
          { label: "代码导出", free: "不可导出", pro: "可导出", elite: "团队级导出与交接" },
          { label: "数据库使用", free: "仅在线试用", pro: "正式环境连接", elite: "配额与角色控制" },
          { label: "验收项目", free: "1 类", pro: "4 类", elite: "5 类全量" },
          { label: "汇报与宣传", free: "无", pro: "基础", elite: "完整联动" },
        ]
      : [
          { label: "AI generations", free: "50 / day", pro: "Unlimited", elite: "Unlimited + team queues" },
          { label: "Workspaces", free: "3", pro: "20", elite: "Unlimited" },
          { label: "Code export", free: "Not available", pro: "Enabled", elite: "Team handoff ready" },
          { label: "Database access", free: "Online only", pro: "Production ready", elite: "Quota + role controls" },
          { label: "Acceptance tracks", free: "1 type", pro: "4 types", elite: "5 full types" },
          { label: "Reporting and promo", free: "None", pro: "Basic", elite: "Full linkage" },
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
        "免费版保留在线体验，专业版开始开放代码导出与正式数据库，精英版再补协作与交付闭环。",
        "这一页要像控制平面里的权限模型，而不是单独的营销页。"
      ]
    : [
        "Tiers are not just pricing copy. They define how much workspace depth, database access, and export capability the generator can deliver.",
        "Free stays focused on the online experience, Pro opens code export and production DB access, and Elite adds collaboration and delivery closure.",
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
  const [selectedPlanName, setSelectedPlanName] = useState(plans[1]?.name ?? plans[0]?.name ?? "");
  const [workspaceSession, setWorkspaceSession] = useState({
    selectedTemplateName: isCn ? "官网与下载站" : "Website + downloads",
    selectedPlanName: plans[1]?.name ?? plans[0]?.name ?? "",
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
              <div style={{ borderRadius: 10, padding: "6px 10px", background: "rgba(124,58,237,0.2)", color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>${spec.planTier === "elite" ? "Elite" : spec.planTier === "pro" ? "Pro" : "Free"}</div>
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
                  <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{isCn ? "免费保留在线体验，Pro 开始交付，Elite 进入团队化交接" : "Free keeps the online experience, Pro starts delivery depth, and Elite moves into team handoff"}</div>
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {[
                      isCn ? "Free: 核心编辑器 + 在线代码 + 在线数据库试用" : "Free: core editor + online code + online DB trial",
                      isCn ? "Pro: 运行面板 + 代码导出 + 正式数据库连接" : "Pro: runs + code export + production DB access",
                      isCn ? "Elite: 汇报层 + 团队协作 + 权限与配额" : "Elite: reporting + collaboration + quotas and roles",
                    ].map((item, index) => (
                      <div key={item} style={{ borderRadius: 14, padding: "12px 14px", background: index === 1 ? "rgba(124,58,237,0.18)" : "#1b1c24", border: "1px solid rgba(255,255,255,0.07)", color: index === 1 ? "#e9d5ff" : "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.7 }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </section>

                <section style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "当前工作区配置" : "Current workspace profile"}</div>
                  <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 18 }}>
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
                        <Link href={index === 0 ? "/login?redirect=/editor" : index === 1 ? "/login?redirect=/runs" : "/login?redirect=/reports"} style={{ marginTop: 24, borderRadius: 14, background: plan.featured ? "linear-gradient(135deg,#8b5cf6,#a855f7)" : "#242633", color: "#fff", padding: "14px 16px", textAlign: "center", fontWeight: 800, textDecoration: "none", display: "block" }}>{plan.cta}</Link>
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
                            ? "这里开始明确 free / paid 在代码导出和数据库使用上的真实差异。"
                            : "This starts making the free / paid differences around code export and database access explicit."}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "能力对比" : "Capability comparison"}</div>
                  <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                    {comparisons.map((row) => (
                      <div key={row.label} style={{ display: "grid", gridTemplateColumns: "1.2fr repeat(3,minmax(0,1fr))", gap: 10, alignItems: "center", borderRadius: 14, background: "#232533", padding: "12px 14px", fontSize: 13 }}>
                        <div style={{ fontWeight: 800 }}>{row.label}</div>
                        <div style={{ color: "rgba(255,255,255,0.7)" }}>{row.free}</div>
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
                  <Link href={selectedPlan?.name === plans[0]?.name ? "/login?redirect=/editor" : selectedPlan?.name === plans[1]?.name ? "/login?redirect=/runs" : "/login?redirect=/reports"} style={{ textDecoration: "none", borderRadius: 12, background: "#8b5cf6", color: "#fff", padding: "10px 14px", fontWeight: 800, textAlign: "center" }}>
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
              <div style={{ borderRadius: 10, padding: "6px 10px", background: "rgba(124,58,237,0.2)", color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>${spec.planTier === "elite" ? "Elite" : spec.planTier === "pro" ? "Pro" : "Free"}</div>
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

function renderTasksPage(spec: AppSpec) {
  if (spec.templateId === "opsdesk") {
    return `import Link from "next/link";

export default function TasksEntryPage() {
  const isCn = ${spec.region === "cn" ? "true" : "false"};
  const rows = ${JSON.stringify(
    spec.region === "cn"
      ? [
          { title: "待跟进客户", desc: "需要本周完成首轮沟通" },
          { title: "报价推进中", desc: "等待客户确认预算与版本" },
          { title: "已成交交付", desc: "同步升级权限与交付节奏" },
        ]
      : [
          { title: "Follow-up queue", desc: "Prospects needing first-touch this week" },
          { title: "Pricing review", desc: "Waiting on budget and tier confirmation" },
          { title: "Closed and onboarding", desc: "Sync upgraded access and rollout cadence" },
        ],
    null,
    2
  )} as const;
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f6f8fc 0%,#eef4ff 100%)", color: "#0f172a", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 28 }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 16 }}>
        <section style={{ borderRadius: 28, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: isCn ? "销售总览" : "Overview" },
              { href: "/leads", label: isCn ? "线索池" : "Leads" },
              { href: "/tasks", label: isCn ? "跟进任务" : "Tasks", active: true },
              { href: "/analytics", label: isCn ? "分析" : "Analytics" },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 999, padding: "8px 12px", background: item.active ? "#2563eb" : "#eff6ff", color: item.active ? "#ffffff" : "#2563eb", fontSize: 13, fontWeight: 700 }}>
                {item.label}
              </Link>
            ))}
          </div>
          <h1 style={{ marginTop: 0, fontSize: 34, fontWeight: 900 }}>{isCn ? "销售任务与线索入口" : "Sales tasks and lead entry"}</h1>
          <p style={{ color: "#64748b", lineHeight: 1.8 }}>{isCn ? "CRM 类型项目在这个入口页里应该承接线索分组、阶段推进和交付衔接。" : "CRM projects should use this entry point for grouped leads, stage transitions, and delivery handoff."}</p>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
          {(isCn
            ? [
                { label: "今日待办", value: "9", note: "首轮跟进和 demo 安排" },
                { label: "报价推进", value: "4", note: "等待版本和预算确认" },
                { label: "交付同步", value: "3", note: "付款完成后同步权限升级" },
              ]
            : [
                { label: "Today", value: "9", note: "First-touch follow-ups and demos" },
                { label: "Pricing", value: "4", note: "Waiting on version and budget alignment" },
                { label: "Delivery", value: "3", note: "Sync access after completed billing" },
              ]).map((item) => (
            <div key={item.label} style={{ borderRadius: 20, background: "#ffffff", border: "1px solid rgba(148,163,184,0.14)", padding: 18 }}>
              <div style={{ color: "#64748b", fontSize: 13 }}>{item.label}</div>
              <div style={{ marginTop: 10, fontSize: 30, fontWeight: 900 }}>{item.value}</div>
              <div style={{ marginTop: 8, color: "#64748b", lineHeight: 1.7, fontSize: 13 }}>{item.note}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gap: 12 }}>
          {rows.map((row) => (
            <div key={row.title} style={{ borderRadius: 20, background: "#ffffff", border: "1px solid rgba(148,163,184,0.14)", padding: 18 }}>
              <div style={{ fontWeight: 800 }}>{row.title}</div>
              <div style={{ marginTop: 8, color: "#64748b" }}>{row.desc}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
          <div style={{ borderRadius: 22, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "推进路径" : "Progress path"}</div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {(isCn ? ["线索识别", "首次沟通", "方案与报价", "签约与升级"] : ["Lead qualification", "First touch", "Proposal and pricing", "Close and upgrade"]).map((item, index) => (
                <div key={item} style={{ borderRadius: 14, background: index === 0 ? "#eff6ff" : "#f8fafc", padding: "12px 14px", color: "#334155" }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 22, background: "#0f172a", color: "#e2e8f0", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "页面角色" : "Page role"}</div>
            <p style={{ marginTop: 12, color: "#94a3b8", lineHeight: 1.8 }}>
              {isCn ? "这一页承接销售任务和成交节奏，应该看起来像真正销售后台的推进页，而不是普通任务列表。" : "This page should feel like a true sales progression workspace, not a generic task list."}
            </p>
          </div>
        </section>
        <Link href="/" style={{ width: "fit-content", textDecoration: "none", borderRadius: 999, padding: "10px 14px", background: "#2563eb", color: "#ffffff" }}>
          {isCn ? "返回销售总览" : "Back to sales overview"}
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

function renderTemplateExtraPage(spec: AppSpec, page: "leads" | "incidents" | "events" | "downloads") {
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

export default function DownloadsPage() {
  const isCn = ${isCn ? "true" : "false"};
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#fff8f1 0%,#fff 48%,#f8fafc 100%)", color: "#111827", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 28 }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 24, background: "#fff", border: "1px solid rgba(15,23,42,0.08)", padding: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: isCn ? "官网首页" : "Homepage" },
              { href: "/downloads", label: isCn ? "下载中心" : "Downloads", active: true },
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
              {(isCn ? ["官网首页", "下载中心", "安装说明", "登录与升级"] : ["Homepage", "Downloads", "Install guide", "Login and upgrade"]).map((item, index) => (
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
              ...(spec.kind === "code_platform" ? [{ href: "/editor", label: isCn ? "编辑器" : "Editor" }] : []),
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

function extractPlannedRouteNames(spec: AppSpec) {
  const routes = new Set<string>()
  for (const moduleName of spec.modules) {
    const match = String(moduleName)
      .trim()
      .toLowerCase()
      .match(/^([a-z0-9_-]+)\s+page$/)
    if (match?.[1]) {
      routes.add(match[1])
    }
  }
  if (spec.kind === "code_platform") {
    ;["dashboard", "editor", "runs", "templates", "pricing", "settings"].forEach((route) => routes.add(route))
  }
  if (hasFeature(spec, "about_page")) routes.add("about")
  if (hasFeature(spec, "analytics_page")) routes.add("analytics")
  if (spec.planTier === "elite") {
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
    members: ["Members", "Members"],
    feedback: ["Feedback", "Feedback"],
    website: ["Website", "Website"],
    downloads: ["Downloads", "Downloads"],
    docs: ["Docs", "Docs"],
    admin: ["Admin", "Admin"],
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
  const navItems = plannedRoutes
    .filter((item) => item !== "home")
    .slice(0, 8)
    .map((item) => ({
      href: `/${item}`,
      label: getGeneratedRouteLabel(item, isCn),
      active: item === route,
    }))
  const focusAreas = spec.modules
    .filter((item) => !/^([a-z0-9_-]+)\s+page$/i.test(item))
    .slice(0, 6)
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

  return `// @ts-nocheck
import Link from "next/link";

export default function GeneratedPlannerPage() {
  const spec = ${JSON.stringify(spec, null, 2)} as const;
  const navItems = ${JSON.stringify(navItems, null, 2)} as const;
  const focusAreas = ${JSON.stringify(focusAreas, null, 2)} as const;
  const records = ${JSON.stringify(records, null, 2)} as const;
  const actions = ${JSON.stringify(actions, null, 2)} as const;
  const isCn = spec.region === "cn";

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
                {isCn
                  ? "这一页来自生成规划里的独立模块，不再被塞回首页或一块静态演示卡片里。"
                  : "This route comes directly from the generated plan instead of being collapsed back into a single poster-like homepage."}
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

        <section style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 16 }}>
          <div style={{ borderRadius: 24, background: "#ffffff", border: "1px solid rgba(148,163,184,0.16)", padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "页面记录" : "Route records"}</div>
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
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isCn ? "下一步动作" : "Suggested next actions"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {actions.map((item) => (
                  <div key={item} style={{ borderRadius: 12, background: "rgba(255,255,255,0.06)", padding: "10px 12px", color: "#cbd5e1", fontSize: 13 }}>
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

export async function buildSpecDrivenWorkspaceFiles(
  projectDir: string,
  spec: AppSpec,
  iterationContext?: SpecIterationContext
): Promise<WorkspaceFile[]> {
  const envPath = path.join(projectDir, ".env")
  const currentEnv = await fs.readFile(envPath, "utf8").catch(() => null)
  const dataPath = path.join(projectDir, "data", "items.json")
  const currentData = await fs.readFile(dataPath, "utf8").catch(() => null)
  const files: WorkspaceFile[] = [
    {
      path: ".env",
      content: mergeEnv(currentEnv, spec),
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

  if (spec.planTier !== "free" && spec.planTier !== "starter") {
    pushWorkspaceFile({
      path: "app/tasks/page.tsx",
      content: renderTasksPage(spec),
      reason: "Add generated tasks entry page for non-basic tiers",
    })
  }

  if (spec.kind === "code_platform" || archetype !== "task" || spec.planTier === "pro" || spec.planTier === "elite") {
    pushWorkspaceFile({
      path: "app/dashboard/page.tsx",
      content: renderDashboardPage(spec),
      reason: spec.kind === "code_platform"
        ? "Add generated dashboard overview entry page for code-platform projects"
        : archetype !== "task"
          ? "Add generated dashboard overview entry page for scaffold-driven application projects"
          : "Add generated dashboard overview entry page for pro tiers",
    })
  }

  if (spec.kind === "code_platform") {
    pushWorkspaceFile(
      {
        path: "app/editor/page.tsx",
        content: renderCodeEditorPage(spec, iterationContext),
        reason: "Add dedicated editor page for code-platform projects",
      }
    )
    pushWorkspaceFile(
      {
        path: "app/runs/page.tsx",
        content: renderCodeRunsPage(spec),
        reason: "Add runtime and preview page for code-platform projects",
      }
    )
    pushWorkspaceFile(
      {
        path: "app/templates/page.tsx",
        content: renderCodeTemplatesPage(spec),
        reason: "Add template gallery page for code-platform projects",
      }
    )
    pushWorkspaceFile(
      {
        path: "app/pricing/page.tsx",
        content: renderCodePricingPage(spec),
        reason: "Add upgrade and pricing page for code-platform projects",
      }
    )
    pushWorkspaceFile(
      {
        path: "app/settings/page.tsx",
        content: renderCodeSettingsPage(spec),
        reason: "Add environment, database, and access settings page for code-platform projects",
      }
    )
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
        path: "app/downloads/page.tsx",
        content: renderArchetypeConsolePage(spec, "downloads") ?? renderTemplateExtraPage(spec, "downloads"),
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
        path: "app/events/page.tsx",
        content: renderTemplateExtraPage(spec, "events"),
        reason: "Add events page for community scaffold",
      }
    )
  }

  if (hasFeature(spec, "about_page")) {
    pushWorkspaceFile({
      path: "app/about/page.tsx",
      content: renderAboutPage(spec),
      reason: "Add about page requested in spec",
    })
  }

  if (hasFeature(spec, "analytics_page")) {
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

  if (spec.templateId === "taskflow" && archetype !== "api_platform") {
    pushWorkspaceFile({
      path: "app/incidents/page.tsx",
      content: renderTemplateExtraPage(spec, "incidents"),
      reason: "Add dedicated incident page for API platform products",
    })
  }

  if (spec.templateId === "orbital" && archetype !== "community") {
    pushWorkspaceFile({
      path: "app/events/page.tsx",
      content: renderTemplateExtraPage(spec, "events"),
      reason: "Add event page for community-oriented products",
    })
  }

  if (spec.templateId === "launchpad" && archetype !== "marketing_admin") {
    pushWorkspaceFile({
      path: "app/downloads/page.tsx",
      content: renderTemplateExtraPage(spec, "downloads"),
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
