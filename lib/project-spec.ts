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

export type AppKind = "task" | "crm" | "blog" | "community" | "code_platform"

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
      : template?.id === "serenity" || template?.id === "orbital" || template?.id === "launchpad"
      ? "community"
      : template?.id === "taskflow" || template?.id === "opsdesk"
        ? "task"
        : undefined
  const kind =
    inferredKind !== "task"
      ? inferredKind
      : existing?.kind && existing.kind !== "task"
        ? existing.kind
        : templateKind ?? "task"
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
    /(?:名字叫|名字是|项目名(?:字)?(?:叫|是)?|产品名(?:字)?(?:叫|是)?|叫做|名为)\s*["“'`]?([A-Za-z0-9][A-Za-z0-9 _-]{1,40})["”'`]?/i,
    /(?:name\s+it|call(?:ed)?|named)\s*["“'`]?([A-Za-z0-9][A-Za-z0-9 _-]{1,40})["”'`]?/i,
  ]
  for (const re of patterns) {
    const match = prompt.match(re)
    if (match?.[1]) return sanitizeUiText(match[1])
  }
  return ""
}

export function applyPromptToSpec(spec: AppSpec, prompt: string) {
  const next = { ...spec, prompt, updatedAt: new Date().toISOString() }
  const inferredTemplateId = spec.templateId ?? inferTemplateIdFromPrompt(prompt)
  next.templateId = inferredTemplateId
  next.templateStyle = next.templateStyle ?? getTemplateById(inferredTemplateId)?.previewStyle
  const features = [...spec.features, ...getTemplateFeatures(inferredTemplateId, spec.planTier)]
  const modules = [...spec.modules, ...getTemplateModules(inferredTemplateId, spec.region)]
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
              <div style={{ fontSize: 14, color: "#cbd5e1" }}>mornstack.vercel.app</div>
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
          { path: "lib/ai-provider.ts", badge: "ai" },
        ]
      : [
          { path: "app/editor/page.tsx", badge: "active" },
          { path: "app/page.tsx", badge: "preview" },
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
    routes: ["/editor", "/runs", "/templates"],
    readiness: "acceptance-track",
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
  return (
    <main style={{ minHeight: "100vh", padding: 28, background: skin.pageBackground, color: skin.textPrimary, fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 18 }}>
        <section style={{ borderRadius: 28, border: skin.cardBorder, background: skin.panelBackground, padding: 24 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              { href: "/", label: spec.region === "cn" ? "首页" : "Home" },
              ...(spec.features.includes("analytics_page") ? [{ href: "/analytics", label: spec.region === "cn" ? "分析" : "Analytics" }] : []),
              { href: "/about", label: spec.region === "cn" ? "项目说明" : "About", active: true },
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
              {spec.features.map((feature) => (
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
                  {spec.region === "cn" ? "已纳入当前生成工作区的产品能力。" : "Included in the current generated product surface."}
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
  return `"use client";

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

function renderDashboardPage(spec: AppSpec) {
  if (spec.kind === "code_platform") {
    const isCn = spec.region === "cn"
    const brand = spec.title
    const sidebar = isCn
      ? ["总览", "项目", "运行", "模板", "团队", "安全", "Agents", "自动化", "日志", "API", "设置"]
      : ["Overview", "Projects", "Runs", "Templates", "Team", "Security", "Agents", "Automations", "Logs", "API", "Settings"]
    return `// @ts-nocheck
import Link from "next/link";

export default function DashboardPage() {
  const isCn = ${isCn ? "true" : "false"};
  const items = ${JSON.stringify(sidebar, null, 2)} as const;
  const metrics = ${JSON.stringify(
    isCn
      ? [
          { label: "活跃项目", value: "12", tone: "#8b5cf6" },
          { label: "今日运行", value: "47", tone: "#22c55e" },
          { label: "AI 辅助", value: "1,284", tone: "#38bdf8" },
          { label: "升级用户", value: "36", tone: "#f59e0b" },
        ]
      : [
          { label: "Active projects", value: "12", tone: "#8b5cf6" },
          { label: "Runs today", value: "47", tone: "#22c55e" },
          { label: "AI assists", value: "1,284", tone: "#38bdf8" },
          { label: "Upgraded users", value: "36", tone: "#f59e0b" },
        ],
    null,
    2
  )} as const;
  const rails = ${JSON.stringify(
    isCn
      ? [
          { title: "morncursor 主编辑器", note: "文件树、编辑器、终端、右侧 AI 面板", href: "/editor" },
          { title: "运行与演示链路", note: "预览、构建日志、宣传文件夹、视频页、PPT 页", href: "/runs" },
          { title: "模板验收轨道", note: "官网、销售后台、数据平台、社区反馈", href: "/templates" },
        ]
      : [
          { title: "morncursor editor", note: "file tree, editor, terminal, and AI side panel", href: "/editor" },
          { title: "Runtime and demo chain", note: "preview, build logs, promo bundle, storyboard, and PPT pages", href: "/runs" },
          { title: "Acceptance rails", note: "website, sales admin, data platform, and community", href: "/templates" },
        ],
    null,
    2
  )} as const;
  const activity = ${JSON.stringify(
    isCn
      ? [
          { title: "AI 完成 IDE 主壳增强", meta: "editor 页面  ·  6 分钟前" },
          { title: "宣传文件夹 latest 输出已刷新", meta: "admin 资产  ·  12 分钟前" },
          { title: "登录与工作区访问链路状态正常", meta: "auth / workspace  ·  19 分钟前" },
        ]
      : [
          { title: "AI completed the IDE shell pass", meta: "editor page  ·  6 min ago" },
          { title: "Latest promo bundle refreshed", meta: "admin assets  ·  12 min ago" },
          { title: "Auth and workspace access flow healthy", meta: "auth / workspace  ·  19 min ago" },
        ],
    null,
    2
  )} as const;
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#11131a 0%,#171923 100%)", color: "#f8fafc", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1460, margin: "0 auto", borderRadius: 26, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#17181f" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#9333ea)", display: "grid", placeItems: "center", fontSize: 20 }}>✦</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>{${JSON.stringify(brand)}}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "中国版 AI 代码编辑平台总览" : "China-ready AI coding overview"}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { href: "/", label: isCn ? "总览" : "Overview", active: true },
              { href: "/editor", label: isCn ? "编辑器" : "Editor" },
              { href: "/runs", label: isCn ? "运行" : "Runs" },
              { href: "/templates", label: isCn ? "模板库" : "Templates" },
              { href: "/pricing", label: isCn ? "升级" : "Upgrade" },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 14px", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.54)", background: item.active ? "rgba(124,58,237,0.22)" : "transparent", fontSize: 14, fontWeight: 700 }}>
                {item.label}
              </Link>
            ))}
            <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1c1e29", padding: "10px 16px", minWidth: 220, color: "rgba(255,255,255,0.38)", fontSize: 13 }}>
              {isCn ? "搜索项目、运行、模板..." : "Search projects, runs, templates..."}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0,1fr)" }}>
          <aside style={{ borderRight: "1px solid rgba(255,255,255,0.08)", padding: 18, display: "grid", gap: 10, alignContent: "start", background: "#14151c" }}>
            <div style={{ borderRadius: 14, background: "#1c1e29", padding: "12px 14px", color: "rgba(255,255,255,0.42)" }}>{isCn ? "搜索..." : "Search..."}</div>
            {items.map((item, index) => (
              <div key={item} style={{ borderRadius: 14, background: index === 0 ? "rgba(124,58,237,0.22)" : "transparent", padding: "12px 14px", fontWeight: index === 0 ? 700 : 500, color: index === 0 ? "#f8fafc" : "rgba(255,255,255,0.68)" }}>
                {item}
              </div>
            ))}
            <div style={{ marginTop: 10, borderRadius: 18, background: "#1b1c24", border: "1px solid rgba(255,255,255,0.06)", padding: 16 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)" }}>{isCn ? "交付焦点" : "Delivery focus"}</div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {[
                  isCn ? "老板演示 URL 稳定" : "Stable stakeholder URLs",
                  isCn ? "admin 宣传资产输出" : "Admin promo asset export",
                  isCn ? "market 销售闭环联动" : "Market sales loop",
                ].map((item) => (
                  <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: "#232533", color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </aside>
          <section style={{ padding: 24, display: "grid", gap: 18, background: "#17181f" }}>
            <section style={{ borderRadius: 24, border: "1px solid rgba(124,58,237,0.18)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.18), transparent 30%), #1b1827", padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr auto", gap: 18, alignItems: "center" }}>
                <div style={{ width: 100, height: 100, borderRadius: 24, background: "#27272a", display: "grid", placeItems: "center", color: "#a855f7", fontSize: 40 }}>▲</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>{${JSON.stringify(brand)}}</h1>
                    <span style={{ borderRadius: 999, padding: "6px 10px", background: "rgba(124,58,237,0.16)", color: "#d8b4fe", fontSize: 12, fontWeight: 800 }}>
                      ${spec.planTier === "elite" ? (isCn ? "精英版" : "Elite") : spec.planTier === "pro" ? (isCn ? "专业版" : "Pro") : isCn ? "免费版" : "Free"}
                    </span>
                  </div>
                  <p style={{ margin: "10px 0 0", color: "rgba(255,255,255,0.62)", maxWidth: 760, lineHeight: 1.7 }}>
                    {isCn ? "面向中国研发团队的 AI 代码编辑平台，深度集成代码生成、项目交付、宣传资产输出与销售闭环联动。" : "AI coding workspace for delivery-focused engineering teams with generation, delivery, promo assets, and sales linkage."}
                  </p>
                  <div style={{ marginTop: 8, color: "rgba(255,255,255,0.42)" }}>{isCn ? "创建于 14 分钟前" : "Created 14 minutes ago"}</div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link href="/editor" style={{ textDecoration: "none", borderRadius: 14, padding: "14px 18px", background: "#8b5cf6", color: "#ffffff", fontWeight: 800 }}>{isCn ? "进入编辑器" : "Open editor"}</Link>
                  <Link href="/runs" style={{ textDecoration: "none", borderRadius: 14, padding: "14px 18px", border: "1px solid rgba(255,255,255,0.08)", color: "#f8fafc", fontWeight: 700 }}>{isCn ? "查看运行链路" : "Open runs"}</Link>
                  <Link href="/pricing" style={{ textDecoration: "none", borderRadius: 14, padding: "14px 18px", border: "1px solid rgba(124,58,237,0.35)", color: "#d8b4fe", fontWeight: 700 }}>{isCn ? "打开套餐与升级" : "View plans"}</Link>
                </div>
              </div>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
              {metrics.map((item) => (
                <div key={item.label} style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 20 }}>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{item.label}</div>
                  <div style={{ marginTop: 12, fontSize: 30, fontWeight: 900, color: item.tone }}>{item.value}</div>
                </div>
              ))}
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
              <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "主执行轨道" : "Primary execution rails"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  {rails.map((item, index) => (
                    <Link key={item.title} href={item.href} style={{ textDecoration: "none", borderRadius: 16, padding: "14px 16px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: "#f8fafc", display: "block" }}>
                      <div style={{ fontWeight: 800 }}>{item.title}</div>
                      <div style={{ marginTop: 6, color: "rgba(255,255,255,0.54)", fontSize: 13, lineHeight: 1.7 }}>{item.note}</div>
                    </Link>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "产品权限" : "Product access"}</div>
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {[
                    { label: isCn ? "登录入口" : "Login entry", href: "/login?redirect=/editor" },
                      { label: isCn ? "访问控制" : "Access control", href: "/editor" },
                      { label: isCn ? "模板升级" : "Template upgrade", href: "/pricing" },
                    ].map((item, index) => (
                      <Link key={item.label} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.7)", fontSize: 12, display: "block" }}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
                <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "最近动态" : "Recent activity"}</div>
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {activity.map((item, index) => (
                      <div key={item.title} style={{ borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533" }}>
                        <div style={{ fontWeight: 700 }}>{item.title}</div>
                        <div style={{ marginTop: 6, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{item.meta}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
`
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

function renderCodeEditorPage(spec: AppSpec) {
  const isCn = spec.region === "cn"
  const brand = spec.title
  return `"use client";
// @ts-nocheck
import { useState } from "react";
import Link from "next/link";

export default function EditorPage() {
  const isCn = ${isCn ? "true" : "false"};
  const files = [
    {
      id: "dashboard",
      name: "app/dashboard/page.tsx",
      title: isCn ? "总览页" : "Dashboard page",
      body: ${JSON.stringify(`export default function DashboardPage() {
  return (
    <main className="grid gap-6">
      <section className="hero">morncursor dashboard</section>
      <section className="stats">active projects / runs / upgrades</section>
    </main>
  );
}`)},
    },
    {
      id: "editor",
      name: "app/editor/page.tsx",
      title: isCn ? "编辑器页" : "Editor page",
      body: ${JSON.stringify(`export default function EditorPage() {
  return (
    <IDELayout
      activityBar
      fileTree
      editorTabs
      terminalPanel
      aiSidePanel
    />
  );
}`)},
    },
    {
      id: "runs",
      name: "app/runs/page.tsx",
      title: isCn ? "运行页" : "Runs page",
      body: ${JSON.stringify(`export default function RunsPage() {
  return (
    <RuntimeBoard
      pipelines={["generate", "build", "preview", "deploy"]}
      logs
      statusCards
    />
  );
}`)},
    },
    {
      id: "templates",
      name: "app/templates/page.tsx",
      title: isCn ? "模板库页" : "Templates page",
      body: ${JSON.stringify(`export default function TemplatesPage() {
  return (
    <TemplateGallery
      categories={["website", "sales", "api", "community"]}
      acceptanceTracks
    />
  );
}`)},
    },
    {
      id: "ai-panel",
      name: "components/ai-side-panel.tsx",
      title: isCn ? "AI 侧边栏" : "AI side panel",
      body: ${JSON.stringify(`export function AISidePanel() {
  return (
    <aside>
      <ModeTabs />
      <PromptComposer />
      <ActionQueue />
    </aside>
  );
}`)},
    },
  ] as const;
  const starterCommands = isCn
    ? [
        { label: "> 搜索文件", desc: "按名称、路径、模块快速定位文件", action: "files" },
        { label: "> 搜索符号", desc: "定位组件、函数、接口与运行节点", action: "symbols" },
        { label: "> 新建运行任务", desc: "触发生成、构建、部署与预览链路", action: "runs" },
        { label: "> 打开模板库", desc: "在官网、销售后台、API 平台、社区之间切换", action: "templates" },
      ]
    : [
        { label: "> Search files", desc: "Jump by file name, path, and module", action: "files" },
        { label: "> Search symbols", desc: "Locate components, functions, interfaces, and runtime nodes", action: "symbols" },
        { label: "> New run task", desc: "Trigger generation, build, deploy, and preview flows", action: "runs" },
        { label: "> Open templates", desc: "Switch across website, sales admin, API, and community tracks", action: "templates" },
      ];
  const runCards = ${JSON.stringify(
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
  const aiModes = [
    isCn ? "解释代码" : "Explain code",
    isCn ? "修复问题" : "Fix issue",
    isCn ? "生成代码" : "Generate code",
    isCn ? "重构优化" : "Refactor",
  ] as const;
  const templates = isCn
    ? [
        { id: "website", name: "官网与下载站", summary: "首页 / 下载页 / 文档 / 定价" },
        { id: "sales", name: "销售后台", summary: "客户 / 商机 / 支付 / 合同" },
        { id: "api", name: "API 数据平台", summary: "接口 / 趋势 / 监控 / 告警" },
        { id: "community", name: "社区反馈中心", summary: "工单 / 反馈 / 公告 / 知识库" },
      ]
    : [
        { id: "website", name: "Website + downloads", summary: "home / downloads / docs / pricing" },
        { id: "sales", name: "Sales admin", summary: "customers / deals / billing / contracts" },
        { id: "api", name: "API platform", summary: "routes / trends / monitors / alerts" },
        { id: "community", name: "Community hub", summary: "tickets / feedback / announcements / kb" },
      ];
  const [selectedFile, setSelectedFile] = useState(files[0].id);
  const [activeMode, setActiveMode] = useState<typeof aiModes[number]>(aiModes[0]);
  const [search, setSearch] = useState("");
  const [terminalTab, setTerminalTab] = useState<"terminal" | "problems" | "output">("terminal");
  const [runtimeState, setRuntimeState] = useState<"idle" | "running" | "failed" | "ready">("ready");
  const [activeTemplate, setActiveTemplate] = useState(templates[0]);
  const [openTabs, setOpenTabs] = useState([files[0].id, files[1].id, files[2].id]);
  const [aiInput, setAiInput] = useState(isCn ? "继续把 editor、runs、templates 打通成完整产品" : "Continue turning editor, runs, and templates into one complete product");
  const visibleFiles = files.filter((file) => {
    if (!search.trim()) return true;
    const query = search.trim().toLowerCase();
    return [file.name, file.title, file.body].join(" ").toLowerCase().includes(query);
  });
  const currentFile = files.find((file) => file.id === selectedFile) ?? files[0];
  const activeTabs = openTabs.map((id) => files.find((file) => file.id === id)).filter(Boolean);
  const openFile = (id) => {
    setSelectedFile(id);
    setOpenTabs((current) => (current.includes(id) ? current : [...current, id].slice(-5)));
  };
  const closeFile = (id) => {
    setOpenTabs((current) => {
      const next = current.filter((item) => item !== id);
      if (selectedFile === id) setSelectedFile(next[0] ?? files[0].id);
      return next;
    });
  };
  const terminalLogs = {
    terminal: runtimeState === "failed"
      ? [
          "$ pnpm dev",
          "Compiling workspace...",
          "error  /app/editor/page.tsx: missing runtime guard",
          isCn ? "AI 已建议：补 loading 与错误边界" : "AI suggestion: add loading and error guards",
        ]
      : runtimeState === "running"
        ? [
            "$ pnpm dev",
            "ready - local preview booting",
            "hmr - syncing editor surface",
            activeTemplate.name + (isCn ? " 模板已注入运行轨道" : " template loaded into runtime rail"),
          ]
        : runtimeState === "idle"
          ? [
              isCn ? "等待下一次运行..." : "Waiting for the next run...",
              isCn ? "可从右侧 AI 或模板区触发生成" : "Trigger generation from the AI panel or template rail",
            ]
          : [
              "$ pnpm build",
              "lint  ok",
              "type  ok",
              "preview  ready",
              isCn ? "当前版本可用于老板演示" : "Current build is ready for stakeholder review",
            ],
    problems: runtimeState === "failed"
      ? [
          isCn ? "1 error · editor runtime guard 缺失" : "1 error · missing editor runtime guard",
          isCn ? "2 warnings · tabs state 需要去重" : "2 warnings · tabs state should be deduped",
        ]
      : [
          isCn ? "0 error · 1 warning" : "0 errors · 1 warning",
          isCn ? "建议继续补 webhook 与支付回调" : "Next gap: webhook and billing callbacks",
        ],
    output: [
      activeMode === aiModes[0]
        ? (isCn ? "AI 正在解释当前文件职责与模块边界。" : "AI is explaining the current file responsibilities and module boundaries.")
        : activeMode === aiModes[1]
          ? (isCn ? "AI 正在生成修复建议并同步到运行队列。" : "AI is generating a fix plan and syncing it into the run queue.")
          : activeMode === aiModes[2]
            ? (isCn ? "AI 正在扩展模板、编辑器与交付链路。" : "AI is extending the template, editor, and delivery flows.")
            : (isCn ? "AI 正在重构 IDE 主壳以增强产品完成度。" : "AI is refactoring the IDE shell for a fuller product surface."),
      isCn ? "最近一次模板切换会同步影响文件树、运行日志和右侧建议。" : "Recent template switches also update the file tree, runtime logs, and AI guidance.",
    ],
  };
  const aiMessages = {
    [aiModes[0]]: isCn
      ? "当前文件已经和左侧目录联动，点击目录、标签、模板都会切换黑色编辑区内容。下一步建议继续补真实数据持久化。"
      : "The current file is now linked to the left directory. Clicking tree items, tabs, and templates all updates the black editor surface. Next step: add persistent data.",
    [aiModes[1]]: isCn
      ? "建议先修复运行失败态：给 editor 与 runs 增加更稳定的状态守卫，再处理支付与登录回调。"
      : "First fix the failed runtime state by hardening editor and runs guards, then handle billing and auth callbacks.",
    [aiModes[2]]: isCn
      ? "我会继续生成更完整的官网、销售后台、API 平台和社区模板，并同步更新运行链路。"
      : "I will keep generating fuller website, sales admin, API platform, and community templates while updating the run pipeline.",
    [aiModes[3]]: isCn
      ? "建议把 activity bar、文件树、编辑区、终端、AI 侧栏拆成稳定模块，让这个页面更接近真实 IDE。"
      : "Refactor the activity bar, file tree, editor, terminal, and AI side rail into stable modules so this page feels more like a real IDE.",
  };
  const executeQuickAction = (action) => {
    if (action === "files") {
      setSearch("editor");
      openFile("editor");
      return;
    }
    if (action === "symbols") {
      setSearch("page");
      openFile("dashboard");
      return;
    }
    if (action === "runs") {
      setRuntimeState("running");
      return;
    }
    setActiveTemplate(templates[1]);
    openFile("templates");
  };

  return (
    <main style={{ minHeight: "100vh", background: "#12131a", color: "#f8fafc", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1480, margin: "0 auto", display: "grid", gap: 16 }}>
        <section style={{ borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.16), transparent 28%), #17181f", padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", borderRadius: 999, padding: "8px 12px", background: "rgba(124,58,237,0.2)", color: "#d8b4fe", fontSize: 12, fontWeight: 800 }}>
                {isCn ? "编辑器工作区" : "Editor workspace"}
              </div>
              <h1 style={{ margin: "14px 0 8px", fontSize: 30, fontWeight: 900 }}>{isCn ? "多标签编辑、底部终端、右侧 AI 辅助同屏协作" : "Tabbed editing, bottom terminal, and right AI support in one surface"}</h1>
              <p style={{ margin: 0, maxWidth: 860, color: "rgba(255,255,255,0.56)", lineHeight: 1.8 }}>
                {isCn ? "这一页要像真正研发团队在用的 IDE，而不是普通后台。重点体现文件树、编辑器、运行反馈、AI 修复、模板切换与交付链路，而且内部控件都要可用。" : "This page should feel like a real IDE used by delivery teams, not a generic admin panel. File navigation, editing, runtime feedback, AI actions, template switching, and delivery controls should all be usable."}
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
            {runCards.map((card) => (
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
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {[
              { href: "/", label: isCn ? "总览" : "Overview" },
              { href: "/editor", label: isCn ? "编辑器" : "Editor", active: true },
              { href: "/runs", label: isCn ? "运行" : "Runs" },
              { href: "/templates", label: isCn ? "模板库" : "Templates" },
              { href: "/pricing", label: isCn ? "升级" : "Upgrade" },
              ...(${spec.planTier === "elite" ? "true" : "false"}
                ? [
                    { href: "/reports", label: isCn ? "汇报" : "Reports" },
                    { href: "/team", label: isCn ? "团队" : "Team" },
                  ]
                : []),
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 14px", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.54)", background: item.active ? "rgba(124,58,237,0.22)" : "transparent", fontSize: 14, fontWeight: 700 }}>
                {item.label}
              </Link>
            ))}
            <div style={{ marginLeft: 10, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#1c1e29", padding: "10px 16px", minWidth: 240, color: "rgba(255,255,255,0.42)", fontSize: 13 }}>
              {isCn ? "搜索命令..." : "Search commands..."}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "56px 320px minmax(0,1fr) 360px", minHeight: "calc(100vh - 120px)" }}>
          <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "#14151c", padding: "12px 0", display: "grid", alignContent: "start", gap: 10 }}>
            {["📄","⌕","⑂","⚙","✦"].map((icon, index) => (
              <div key={icon} style={{ width: 38, height: 38, borderRadius: 12, background: index === 0 ? "rgba(124,58,237,0.22)" : "transparent", color: index === 0 ? "#c4b5fd" : "rgba(255,255,255,0.42)", margin: "0 auto", display: "grid", placeItems: "center", fontSize: 16 }}>{icon}</div>
            ))}
          </div>

          <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "#17181f", padding: 16, display: "grid", alignContent: "start", gap: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{isCn ? "资源管理器" : "Explorer"}</div>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isCn ? "搜索文件、符号、模板..." : "Search files, symbols, templates..."} style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#11131a", color: "#f8fafc", padding: "10px 12px", outline: "none" }} />
            <div style={{ display: "grid", gap: 8 }}>
              {starterCommands.map((command) => (
                <button key={command.label} onClick={() => executeQuickAction(command.action)} style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#1f212c", color: "#f8fafc", padding: "10px 12px", textAlign: "left", cursor: "pointer" }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{command.label}</div>
                  <div style={{ marginTop: 4, color: "rgba(255,255,255,0.46)", fontSize: 12, lineHeight: 1.6 }}>{command.desc}</div>
                </button>
              ))}
            </div>
            <div style={{ color: "rgba(255,255,255,0.54)", fontSize: 13 }}>src</div>
            <div style={{ display: "grid", gap: 8 }}>
              {visibleFiles.map((file) => (
                <button key={file.id} onClick={() => openFile(file.id)} style={{ borderRadius: 12, padding: "10px 12px", background: selectedFile === file.id ? "rgba(124,58,237,0.18)" : "transparent", color: selectedFile === file.id ? "#e9d5ff" : "rgba(255,255,255,0.72)", border: "1px solid rgba(255,255,255,0.05)", textAlign: "left", cursor: "pointer" }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{file.name}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: selectedFile === file.id ? "rgba(233,213,255,0.78)" : "rgba(255,255,255,0.42)" }}>{file.title}</div>
                </button>
              ))}
            </div>
            <div style={{ borderRadius: 14, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.18)", padding: 12 }}>
              <div style={{ color: "#c4b5fd", fontWeight: 800, fontSize: 12 }}>{isCn ? "当前模板联动" : "Current template sync"}</div>
              <div style={{ marginTop: 8, fontWeight: 800 }}>{activeTemplate.name}</div>
              <div style={{ marginTop: 4, color: "rgba(255,255,255,0.56)", fontSize: 12, lineHeight: 1.7 }}>{activeTemplate.summary}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", background: "#14151b" }}>
            <div style={{ display: "flex", gap: 2, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#161720" }}>
              {activeTabs.map((tab) => (
                <div key={tab.id} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRight: "1px solid rgba(255,255,255,0.06)", color: selectedFile === tab.id ? "#f8fafc" : "rgba(255,255,255,0.46)", background: selectedFile === tab.id ? "#1a1b25" : "transparent", fontSize: 14 }}>
                  <button type="button" onClick={() => openFile(tab.id)} style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer" }}>{tab.name.split("/").slice(-1)[0]}</button>
                  <button type="button" onClick={() => closeFile(tab.id)} style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", opacity: 0.6 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ overflow: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "70px minmax(0,1fr)" }}>
                <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.28)", paddingTop: 18, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, lineHeight: 2 }}>
                  {Array.from({ length: currentFile.body.split("\\n").length }, (_, i) => <div key={i} style={{ padding: "0 18px", textAlign: "right" }}>{i + 1}</div>)}
                </div>
                <pre style={{ margin: 0, padding: 18, color: "#e5e7eb", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13, lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{currentFile.body.replace(/morncursor/g, ${JSON.stringify(brand)})}</pre>
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
                  <div key={line} style={{ color: line.startsWith("error") || line.includes("error") ? "#fca5a5" : line.includes("ok") || line.includes("ready") ? "#22c55e" : line.includes("warning") || line.includes("警告") ? "#facc15" : "#cbd5e1" }}>{line}</div>
                ))}
              </div>
            </div>
          </div>

          <aside style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#17181f", padding: 16, display: "grid", alignContent: "start", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{isCn ? "AI 助手" : "AI Assistant"}</div>
              <div style={{ borderRadius: 10, background: "rgba(124,58,237,0.18)", color: "#c4b5fd", padding: "4px 8px", fontSize: 12, fontWeight: 700 }}>GPT-4</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {aiModes.map((item) => (
                <button key={item} onClick={() => setActiveMode(item)} style={{ borderRadius: 12, padding: "12px 14px", background: activeMode === item ? "rgba(124,58,237,0.22)" : "#1f212c", color: activeMode === item ? "#f8fafc" : "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", textAlign: "left" }}>{item}</button>
              ))}
            </div>
            <div style={{ borderRadius: 18, background: "#241f35", border: "1px solid rgba(124,58,237,0.22)", padding: 16 }}>
              <div style={{ fontWeight: 800 }}>{aiInput}</div>
            </div>
            <div style={{ borderRadius: 18, background: "#1f212c", padding: 16 }}>
              <div style={{ color: "#a78bfa", fontWeight: 800, marginBottom: 10 }}>{${JSON.stringify(brand)}} AI</div>
              <div style={{ color: "rgba(255,255,255,0.74)", fontSize: 13, lineHeight: 1.8 }}>{aiMessages[activeMode]}</div>
              <textarea value={aiInput} onChange={(event) => setAiInput(event.target.value)} spellCheck={false} style={{ width: "100%", minHeight: 96, marginTop: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#0d1119", color: "#f8fafc", padding: 12, resize: "vertical", outline: "none" }} />
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button onClick={() => setRuntimeState("running")} style={{ borderRadius: 10, border: "none", background: "#8b5cf6", color: "#fff", padding: "10px 12px", cursor: "pointer", fontWeight: 700 }}>{isCn ? "提交给 AI" : "Send to AI"}</button>
                <button onClick={() => openFile("ai-panel")} style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#f8fafc", padding: "10px 12px", cursor: "pointer", fontWeight: 700 }}>{isCn ? "插入代码" : "Insert into code"}</button>
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 8, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                <span>{isCn ? "复制" : "Copy"}</span>
                <span>{isCn ? "插入" : "Insert"}</span>
                <span>{isCn ? "有用" : "Helpful"}</span>
              </div>
            </div>
            <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.44)" }}>{isCn ? "模板轨道" : "Template rail"}</div>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {templates.map((item) => (
                  <button key={item.id} onClick={() => setActiveTemplate(item)} style={{ borderRadius: 12, padding: "10px 12px", background: activeTemplate.id === item.id ? "rgba(124,58,237,0.18)" : "#232533", color: activeTemplate.id === item.id ? "#e9d5ff" : "rgba(255,255,255,0.66)", fontSize: 12, border: "none", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ fontWeight: 800 }}>{item.name}</div>
                    <div style={{ marginTop: 4, lineHeight: 1.6 }}>{item.summary}</div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
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
  const rows = isCn
    ? [
        { name: "MornCursor 官网", id: "#281", branch: "main", status: "部署", detail: "AI 自动修复", duration: "1m 23s", time: "2 分钟前", tone: "#10b981" },
        { name: "销售管理后台", id: "#280", branch: "develop", status: "构建", detail: "Git Push", duration: "进行中", time: "5 分钟前", tone: "#3b82f6" },
        { name: "API 数据平台", id: "#279", branch: "feature/auth", status: "测试", detail: "PR 检查", duration: "3m 47s", time: "18 分钟前", tone: "#ef4444" },
        { name: "社区反馈中心", id: "#278", branch: "main", status: "部署", detail: "Git Push", duration: "2m 11s", time: "1 小时前", tone: "#10b981" },
      ]
    : [
        { name: "MornCursor website", id: "#281", branch: "main", status: "deploy", detail: "AI repair", duration: "1m 23s", time: "2 min ago", tone: "#10b981" },
        { name: "Sales admin", id: "#280", branch: "develop", status: "build", detail: "Git Push", duration: "running", time: "5 min ago", tone: "#3b82f6" },
        { name: "API platform", id: "#279", branch: "feature/auth", status: "test", detail: "PR check", duration: "3m 47s", time: "18 min ago", tone: "#ef4444" },
        { name: "Community hub", id: "#278", branch: "main", status: "deploy", detail: "Git Push", duration: "2m 11s", time: "1 hour ago", tone: "#10b981" },
      ]
  return `// @ts-nocheck
import Link from "next/link";

export default function RunsPage() {
  const isCn = ${isCn ? "true" : "false"};
  const rows = ${JSON.stringify(rows, null, 2)} as const;
  const stageCards = ${JSON.stringify(
    isCn
      ? [
          { label: "代码生成", value: "queued -> running -> done" },
          { label: "构建验证", value: "lint / type / preview" },
          { label: "访问链路", value: "login -> workspace -> preview" },
        ]
      : [
          { label: "Code generation", value: "queued -> running -> done" },
          { label: "Build validation", value: "lint / type / preview" },
          { label: "Access flow", value: "login -> workspace -> preview" },
        ],
    null,
    2
  )} as const;

  return (
    <main style={{ minHeight: "100vh", background: "#12131a", color: "#f8fafc", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1460, margin: "0 auto", borderRadius: 24, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#17181f" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#9333ea)", display: "grid", placeItems: "center", fontSize: 20 }}>✦</div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>{${JSON.stringify(brand)}}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {[
              { href: "/", label: isCn ? "总览" : "Overview" },
              { href: "/editor", label: isCn ? "编辑器" : "Editor" },
              { href: "/runs", label: isCn ? "运行" : "Runs", active: true },
              { href: "/templates", label: isCn ? "模板库" : "Templates" },
              { href: "/pricing", label: isCn ? "升级" : "Upgrade" },
              ...(${spec.planTier === "elite" ? "true" : "false"}
                ? [
                    { href: "/reports", label: isCn ? "汇报" : "Reports" },
                    { href: "/team", label: isCn ? "团队" : "Team" },
                  ]
                : []),
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 14px", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.54)", background: item.active ? "rgba(124,58,237,0.22)" : "transparent", fontSize: 14, fontWeight: 700 }}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 18 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>{isCn ? "运行面板" : "Runs"}</h1>
              <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.54)" }}>{isCn ? "管理构建、测试、部署全流程" : "Manage build, test, and deployment flows"}</p>
            </div>
            <Link href="/editor" style={{ textDecoration: "none", borderRadius: 14, background: "#8b5cf6", color: "#fff", padding: "14px 20px", fontWeight: 800 }}>{isCn ? "新建运行" : "New run"}</Link>
          </div>
          <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16, marginBottom: 18 }}>
            <div style={{ borderRadius: 22, border: "1px solid rgba(124,58,237,0.18)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.18), transparent 32%), #1b1827", padding: 22 }}>
              <div style={{ fontSize: 12, color: "#d8b4fe", fontWeight: 800 }}>{isCn ? "运行叙事" : "Runtime narrative"}</div>
              <h2 style={{ margin: "10px 0 8px", fontSize: 24, fontWeight: 900 }}>{isCn ? "把生成、构建、预览、部署链路都放进同一运维视角里" : "Keep generation, build, preview, and deploy inside one runtime view"}</h2>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.56)", lineHeight: 1.8 }}>
                {isCn ? "这一页要让老板看到项目不是只有静态页面，而是包含运行状态、构建日志、环境轨道和交付反馈。" : "This page should show that the product includes execution health, build logs, environment rails, and delivery feedback."}
              </p>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {stageCards.map((card) => (
                <div key={card.label} style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 16 }}>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{card.label}</div>
                  <div style={{ marginTop: 8, fontWeight: 800 }}>{card.value}</div>
                </div>
              ))}
            </div>
          </section>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14, marginBottom: 18 }}>
            {[
              { label: isCn ? "总运行次数" : "Total runs", value: "281", tone: "#8b5cf6" },
              { label: isCn ? "成功率" : "Success rate", value: "94.3%", tone: "#10b981" },
              { label: isCn ? "平均耗时" : "Average time", value: "2m 15s", tone: "#3b82f6" },
              { label: isCn ? "今日部署" : "Deploys today", value: "8", tone: "#f59e0b" },
            ].map((item) => (
              <div key={item.label} style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 20 }}>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>{item.label}</div>
                <div style={{ marginTop: 12, fontSize: 34, color: item.tone, fontWeight: 900 }}>{item.value}</div>
              </div>
            ))}
          </section>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {[(isCn ? "全部" : "All"), (isCn ? "成功" : "Success"), (isCn ? "运行中" : "Running"), (isCn ? "失败" : "Failed"), (isCn ? "警告" : "Warnings")].map((item, index) => (
              <div key={item} style={{ borderRadius: 12, padding: "10px 16px", background: index === 0 ? "rgba(124,58,237,0.2)" : "#1f212c", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.62)", fontWeight: 700 }}>{item}</div>
            ))}
          </div>
          <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#17181f", overflow: "hidden" }}>
            {rows.map((row) => (
              <div key={row.name + row.id} style={{ display: "grid", gridTemplateColumns: "48px 1fr 280px", gap: 14, alignItems: "center", padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ width: 42, height: 42, borderRadius: 14, background: row.tone + "22", display: "grid", placeItems: "center", color: row.tone }}>◉</div>
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{row.name}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)" }}>{row.id}</div>
                    <div style={{ borderRadius: 10, background: "rgba(255,255,255,0.08)", padding: "4px 8px", fontSize: 12 }}>{row.status}</div>
                  </div>
                  <div style={{ marginTop: 8, color: "rgba(255,255,255,0.45)", fontSize: 13 }}>⎇ {row.branch} · {row.detail}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.46)", fontSize: 13 }}>
                  <span>{row.detail}</span>
                  <span>{row.duration}</span>
                  <span>{row.time}</span>
                </div>
              </div>
            ))}
          </div>
          <section style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 16 }}>
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
                {[
                  isCn ? "1. 进入 /demo 查看老板入口" : "1. Open /demo",
                  isCn ? "2. 打开 latest 宣传文件夹页" : "2. Open latest promo bundle pages",
                  isCn ? "3. 进入 /login 与工作区预览验证访问链路" : "3. Walk through /login and workspace preview",
                ].map((item, index) => (
                  <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.66)", fontSize: 12 }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>
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
  const rows = isCn
    ? [
        { title: "企业官网 + 下载站", note: "包含首页、产品介绍、定价、下载中心、博客等完整企业站", tags: ["React", "TailwindCSS", "SEO"], badge: "免费", stats: "2847   ↓ 12.4k", color: "#4c1d95" },
        { title: "销售管理后台 (CRM)", note: "全链路销售管理系统：客户管理、线索跟踪、合同审批、业绩看板", tags: ["CRM", "Dashboard", "数据看板"], badge: "专业版", stats: "1963   ↓ 8.7k", color: "#1e3a5f" },
        { title: "API 数据平台", note: "接口管理、数据监控、Mock 服务、文档自动生成，支持 OpenAPI", tags: ["API", "监控", "OpenAPI"], badge: "专业版", stats: "1421   ↓ 6.2k", color: "#134e4a" },
        { title: "社区反馈中心", note: "用户反馈收集、工单管理、需求投票、版本公告、知识库", tags: ["反馈", "工单", "社区"], badge: "免费", stats: "981   ↓ 3.9k", color: "#78350f" },
        { title: "营销活动管理平台", note: "活动创建、渠道投放、效果追踪、A/B 测试、转化漏斗分析", tags: ["营销", "投放", "AB 测试"], badge: "精英版", stats: "769   ↓ 3.1k", color: "#7f1d1d" },
        { title: "产品落地页生成器", note: "AI 驱动的落地页快速生成工具，支持拖拽编辑、组件库、多端预览", tags: ["Landing Page", "AI", "拖拽"], badge: "专业版", stats: "1152   ↓ 5.3k", color: "#312e81" },
      ]
    : [
        { title: "Company site + downloads", note: "Homepage, pricing, download center, docs, and blogs", tags: ["React", "TailwindCSS", "SEO"], badge: "Free", stats: "2847   ↓ 12.4k", color: "#4c1d95" },
        { title: "Sales admin CRM", note: "Customers, leads, contracts, approvals, and performance views", tags: ["CRM", "Dashboard", "Analytics"], badge: "Pro", stats: "1963   ↓ 8.7k", color: "#1e3a5f" },
        { title: "API platform", note: "API management, monitoring, mock service, and docs", tags: ["API", "Monitoring", "OpenAPI"], badge: "Pro", stats: "1421   ↓ 6.2k", color: "#134e4a" },
        { title: "Community hub", note: "Feedback, ticketing, voting, announcements, and knowledge base", tags: ["Feedback", "Tickets", "Community"], badge: "Free", stats: "981   ↓ 3.9k", color: "#78350f" },
        { title: "Marketing ops", note: "Campaigns, channels, A/B tests, and conversion funnels", tags: ["Marketing", "Ads", "AB Test"], badge: "Elite", stats: "769   ↓ 3.1k", color: "#7f1d1d" },
        { title: "Landing page builder", note: "AI-driven page builder with drag-and-drop and previews", tags: ["Landing Page", "AI", "Builder"], badge: "Pro", stats: "1152   ↓ 5.3k", color: "#312e81" },
      ]
  const visibleRows = spec.planTier === "elite" ? rows : spec.planTier === "pro" ? rows : rows.slice(0, 3)
  return `// @ts-nocheck
"use client";
import Link from "next/link";
import { useState } from "react";

export default function TemplatesPage() {
  const isCn = ${isCn ? "true" : "false"};
  const rows = ${JSON.stringify(visibleRows, null, 2)} as const;
  const acceptanceTracks = ${JSON.stringify(
    isCn
      ? ["中国版 Cursor", "销售后台", "官网与下载站", "API 数据平台", "社区反馈中心"]
      : ["China-ready Cursor", "Sales admin", "Website and downloads", "API platform", "Community hub"],
    null,
    2
  )} as const;
  const groups = isCn ? ["全部模板", "官网与落地页", "管理后台", "数据平台", "社区与运营", "营销工具"] : ["All", "Sites", "Admin", "Data", "Community", "Marketing"];
  const [activeGroup, setActiveGroup] = useState(groups[0]);
  const [templateSearch, setTemplateSearch] = useState("");
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

  return (
    <main style={{ minHeight: "100vh", background: "#12131a", color: "#f8fafc", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1460, margin: "0 auto", borderRadius: 24, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#17181f" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#9333ea)", display: "grid", placeItems: "center", fontSize: 20 }}>✦</div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>{${JSON.stringify(brand)}}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {[
              { href: "/", label: isCn ? "总览" : "Overview" },
              { href: "/editor", label: isCn ? "编辑器" : "Editor" },
              { href: "/runs", label: isCn ? "运行" : "Runs" },
              { href: "/templates", label: isCn ? "模板库" : "Templates", active: true },
              { href: "/pricing", label: isCn ? "升级" : "Upgrade" },
              ...(${spec.planTier === "elite" ? "true" : "false"}
                ? [
                    { href: "/reports", label: isCn ? "汇报" : "Reports" },
                    { href: "/team", label: isCn ? "团队" : "Team" },
                  ]
                : []),
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 14px", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.54)", background: item.active ? "rgba(124,58,237,0.22)" : "transparent", fontSize: 14, fontWeight: 700 }}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div style={{ padding: 22, display: "grid", gap: 18 }}>
          <section style={{ borderRadius: 24, border: "1px solid rgba(124,58,237,0.18)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.18), transparent 32%), #1b1827", padding: 26 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>{isCn ? "模板库" : "Templates"}</h1>
            <p style={{ margin: "10px 0 0", color: "rgba(255,255,255,0.54)", fontSize: 15 }}>{isCn ? "精选项目模板，覆盖官网、后台、数据平台、社区等场景。AI 辅助快速搭建。" : "Curated templates across websites, admin tools, data platforms, and communities."}</p>
            <input value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder={isCn ? "搜索模板..." : "Search templates..."} style={{ marginTop: 18, width: "100%", borderRadius: 16, background: "rgba(255,255,255,0.04)", padding: "16px 18px", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.08)", outline: "none" }} />
          </section>
          <section style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 16 }}>
            <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "验收模板轨道" : "Acceptance rails"}</div>
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
                {acceptanceTracks.map((item, index) => (
                  <div key={item} style={{ borderRadius: 14, padding: "12px 14px", background: index === 0 ? "rgba(124,58,237,0.18)" : "#232533", color: index === 0 ? "#e9d5ff" : "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700 }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.07)", background: "#1b1c24", padding: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "模板策略" : "Template strategy"}</div>
              <p style={{ margin: "12px 0 0", color: "rgba(255,255,255,0.56)", lineHeight: 1.8 }}>
                {isCn ? "这里不是一套壳反复复用，而是按产品类型分成官网、CRM、数据平台、社区、营销工具等不同生成轨道。" : "This should not be one repeated shell. It should branch into distinct product archetypes across websites, CRM, data platforms, community, and marketing tools."}
              </p>
            </div>
          </section>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {groups.map((item) => (
              <button key={item} onClick={() => setActiveGroup(item)} style={{ borderRadius: 12, padding: "10px 16px", background: activeGroup === item ? "rgba(124,58,237,0.2)" : "#1f212c", color: activeGroup === item ? "#e9d5ff" : "rgba(255,255,255,0.62)", fontWeight: 700, border: "none", cursor: "pointer" }}>{item}</button>
            ))}
          </div>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 18 }}>
            {filteredRows.map((row) => (
              <div key={row.title} style={{ borderRadius: 22, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", background: "#17181f" }}>
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
                    <Link href="/pricing" style={{ textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: "#232533", color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 700 }}>
                      {isCn ? "查看适用套餐" : "View plan"}
                    </Link>
                  </div>
                  <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, color: "rgba(255,255,255,0.44)", fontSize: 13 }}>{row.stats}</div>
                </div>
              </div>
            ))}
          </section>
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
        { name: "免费版", sub: "Free", price: "¥0", desc: "个人开发者与学习者", cta: "免费开始", featured: false, points: ["核心 IDE 编辑器", "AI 代码补全 (每日 50 次)", "3 个项目空间", "基础模板", "单人使用"] },
        { name: "专业版", sub: "Pro", price: "¥99", desc: "中小团队与专业开发者", cta: "立即升级", featured: true, points: ["核心 IDE 编辑器", "AI 代码补全 (无限次)", "20 个项目空间", "全部模板库", "构建 / 测试 / 部署面板", "Git 集成与 CI/CD"] },
        { name: "精英版", sub: "Elite", price: "¥299", desc: "大型团队与企业级交付", cta: "立即升级", featured: false, points: ["全部专业版功能", "无限项目空间", "50 人团队协作", "5 类验收项目管理", "汇报中心与周报自动生成", "宣传资产联动与销售闭环"] },
      ]
    : [
        { name: "Free", sub: "Free", price: "$0", desc: "For solo developers", cta: "Start free", featured: false, points: ["Core IDE shell", "AI completions", "3 projects", "Starter templates", "Single user"] },
        { name: "Pro", sub: "Pro", price: "$19", desc: "For serious builders", cta: "Upgrade now", featured: true, points: ["Unlimited AI assists", "20 projects", "Full template library", "Build and deploy panel", "Git and CI/CD"] },
        { name: "Elite", sub: "Elite", price: "$59", desc: "For teams and delivery", cta: "Upgrade now", featured: false, points: ["Everything in Pro", "Unlimited projects", "Team collaboration", "Acceptance suites", "Reporting center"] },
      ]
  return `// @ts-nocheck
import Link from "next/link";

export default function PricingPage() {
  const isCn = ${isCn ? "true" : "false"};
  const plans = ${JSON.stringify(plans, null, 2)} as const;
  return (
    <main style={{ minHeight: "100vh", background: "#12131a", color: "#f8fafc", fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1460, margin: "0 auto", borderRadius: 24, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#17181f" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#9333ea)", display: "grid", placeItems: "center", fontSize: 20 }}>✦</div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>{${JSON.stringify(brand)}}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {[
              { href: "/", label: isCn ? "总览" : "Overview" },
              { href: "/editor", label: isCn ? "编辑器" : "Editor" },
              { href: "/runs", label: isCn ? "运行" : "Runs" },
              { href: "/templates", label: isCn ? "模板库" : "Templates" },
              { href: "/pricing", label: isCn ? "升级" : "Upgrade", active: true },
              ...(${spec.planTier === "elite" ? "true" : "false"}
                ? [
                    { href: "/reports", label: isCn ? "汇报" : "Reports" },
                    { href: "/team", label: isCn ? "团队" : "Team" },
                  ]
                : []),
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none", borderRadius: 12, padding: "10px 14px", color: item.active ? "#f8fafc" : "rgba(255,255,255,0.54)", background: item.active ? "rgba(124,58,237,0.22)" : "transparent", fontSize: 14, fontWeight: 700 }}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div style={{ padding: 28 }}>
          <div style={{ textAlign: "center", maxWidth: 860, margin: "0 auto 28px" }}>
            <h1 style={{ margin: 0, fontSize: 48, fontWeight: 900 }}>{isCn ? "选择适合你的方案" : "Choose your plan"}</h1>
            <p style={{ marginTop: 16, color: "rgba(255,255,255,0.56)", fontSize: 16 }}>{isCn ? ${JSON.stringify(`${brand} 从个人学习到企业交付，为每个阶段提供精准方案`)} : ${JSON.stringify(`${brand} scales from solo use to enterprise delivery.`)}}</p>
          </div>
          <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16, marginBottom: 18 }}>
            <div style={{ borderRadius: 22, border: "1px solid rgba(124,58,237,0.18)", background: "radial-gradient(circle at top left, rgba(124,58,237,0.18), transparent 32%), #1b1827", padding: 22 }}>
              <div style={{ fontSize: 12, color: "#d8b4fe", fontWeight: 800 }}>{isCn ? "套餐差异" : "Tier differentiation"}</div>
              <h2 style={{ margin: "10px 0 8px", fontSize: 24, fontWeight: 900 }}>{isCn ? "免费先给 IDE 壳，专业补运行链路，精英补验收与汇报层" : "Free ships the shell, Pro adds runtime depth, Elite adds acceptance and reporting"}</h2>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.56)", lineHeight: 1.8 }}>
                {isCn ? "这页要直接说明为什么三档生成结果会明显不同，而不是只改价格文案。" : "This page should make it obvious why each tier produces meaningfully different product depth."}
              </p>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                isCn ? "Free: 核心编辑器 + 少量模板 + 基础 AI" : "Free: core editor + fewer templates + basic AI",
                isCn ? "Pro: 运行面板 + 全模板库 + 登录与工作区访问链路" : "Pro: runs + full template library + auth and workspace access flow",
                isCn ? "Elite: 五类验收项目 + 汇报层 + admin/market 联动" : "Elite: five acceptance tracks + reporting + admin/market linkage",
              ].map((item, index) => (
                <div key={item} style={{ borderRadius: 14, padding: "12px 14px", background: index === 1 ? "rgba(124,58,237,0.18)" : "#1b1c24", border: "1px solid rgba(255,255,255,0.07)", color: index === 1 ? "#e9d5ff" : "rgba(255,255,255,0.7)", fontSize: 13 }}>
                  {item}
                </div>
              ))}
            </div>
          </section>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 18 }}>
            {plans.map((plan, index) => (
              <div key={plan.name} style={{ borderRadius: 24, border: plan.featured ? "1px solid rgba(124,58,237,0.55)" : "1px solid rgba(255,255,255,0.08)", background: "#1a1b22", padding: 24, boxShadow: plan.featured ? "0 0 0 1px rgba(124,58,237,0.28) inset" : "none" }}>
                {plan.featured ? <div style={{ color: "#a78bfa", fontWeight: 800, marginBottom: 18 }}>{isCn ? "✦ 最受欢迎" : "✦ Most popular"}</div> : <div style={{ height: 24 }} />}
                <div style={{ fontSize: 16, fontWeight: 900 }}>{plan.name}</div>
                <div style={{ marginTop: 6, color: "rgba(255,255,255,0.48)" }}>{plan.sub}</div>
                <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 46, fontWeight: 900 }}>{plan.price}</span>
                  <span style={{ color: "rgba(255,255,255,0.42)" }}>/月</span>
                </div>
                <div style={{ marginTop: 10, color: "rgba(255,255,255,0.54)" }}>{plan.desc}</div>
                <Link href={index === 0 ? "/login" : index === 1 ? "/login?redirect=/checkout?plan=pro" : "/login?redirect=/checkout?plan=elite"} style={{ marginTop: 24, borderRadius: 14, background: plan.featured ? "linear-gradient(135deg,#8b5cf6,#a855f7)" : "#242633", color: "#fff", padding: "14px 16px", textAlign: "center", fontWeight: 800, textDecoration: "none", display: "block" }}>{plan.cta}</Link>
                <div style={{ marginTop: 22, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 18, display: "grid", gap: 12 }}>
                  {plan.points.map((item) => (
                    <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "rgba(255,255,255,0.74)", lineHeight: 1.8 }}>
                      <span style={{ color: "#34d399" }}>✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
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
          { label: "老板演示链路", value: "ready", note: "demo / promo / login / checkout 已打通演示" },
          { label: "主要风险", value: "2", note: "真实支付回调与正式 OAuth 参数待接入" },
        ]
      : [
          { label: "Generated projects", value: "5", note: "Website, CRM, data, community, and code platform covered" },
          { label: "Stakeholder demo flow", value: "ready", note: "demo / promo / login / checkout are aligned for demos" },
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

export async function buildSpecDrivenWorkspaceFiles(projectDir: string, spec: AppSpec): Promise<WorkspaceFile[]> {
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

  if (spec.planTier !== "free" && spec.planTier !== "starter") {
    files.push({
      path: "app/tasks/page.tsx",
      content: renderTasksPage(spec),
      reason: "Add generated tasks entry page for non-basic tiers",
    })
  }

  if (spec.kind === "code_platform" || spec.planTier === "pro" || spec.planTier === "elite") {
    files.push({
      path: "app/dashboard/page.tsx",
      content: renderDashboardPage(spec),
      reason: spec.kind === "code_platform"
        ? "Add generated dashboard overview entry page for code-platform projects"
        : "Add generated dashboard overview entry page for pro tiers",
    })
  }

  if (spec.kind === "code_platform") {
    files.push(
      {
        path: "app/editor/page.tsx",
        content: renderCodeEditorPage(spec),
        reason: "Add dedicated editor page for code-platform projects",
      },
      {
        path: "app/runs/page.tsx",
        content: renderCodeRunsPage(spec),
        reason: "Add runtime and preview page for code-platform projects",
      },
      {
        path: "app/templates/page.tsx",
        content: renderCodeTemplatesPage(spec),
        reason: "Add template gallery page for code-platform projects",
      },
      {
        path: "app/pricing/page.tsx",
        content: renderCodePricingPage(spec),
        reason: "Add upgrade and pricing page for code-platform projects",
      }
    )
  }

  if (hasFeature(spec, "about_page")) {
    files.push({
      path: "app/about/page.tsx",
      content: renderAboutPage(spec),
      reason: "Add about page requested in spec",
    })
  }

  if (hasFeature(spec, "analytics_page")) {
    files.push({
      path: "app/analytics/page.tsx",
      content: renderAnalyticsPage(spec),
      reason: "Add analytics page requested in spec",
    })
  }

  if (spec.templateId === "opsdesk") {
    files.push({
      path: "app/leads/page.tsx",
      content: renderTemplateExtraPage(spec, "leads"),
      reason: "Add dedicated lead pool page for CRM-style products",
    })
  }

  if (spec.templateId === "taskflow") {
    files.push({
      path: "app/incidents/page.tsx",
      content: renderTemplateExtraPage(spec, "incidents"),
      reason: "Add dedicated incident page for API platform products",
    })
  }

  if (spec.templateId === "orbital") {
    files.push({
      path: "app/events/page.tsx",
      content: renderTemplateExtraPage(spec, "events"),
      reason: "Add event page for community-oriented products",
    })
  }

  if (spec.templateId === "launchpad") {
    files.push({
      path: "app/downloads/page.tsx",
      content: renderTemplateExtraPage(spec, "downloads"),
      reason: "Add download center for launch and website products",
    })
  }

  if (spec.planTier === "elite") {
    files.push(
      {
        path: "app/reports/page.tsx",
        content: renderReportsPage(spec),
        reason: "Add elite reporting page for deeper project structure",
      },
      {
        path: "app/team/page.tsx",
        content: renderTeamPage(spec),
        reason: "Add elite collaboration page for deeper project structure",
      }
    )
  }

  return files
}
