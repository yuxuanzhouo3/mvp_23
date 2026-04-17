"use client"

import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react"

type PreviewSpec = {
  title?: string
  kind?: string
  planTier?: string
  modules?: string[]
  features?: string[]
  deploymentTarget?: string
  databaseTarget?: string
  appIntent?: {
    archetype?: string
    productCategory?: string
    targetAudience?: string[]
    primaryJobs?: string[]
    primaryWorkflow?: string
    automationScopes?: string[]
  }
  appIdentity?: {
    category?: string
  }
  routeBlueprint?: Array<{
    id?: string
    path?: string
    label?: string
    purpose?: string
    pagePrototype?: string
    moduleIds?: string[]
    entityIds?: string[]
    primaryActions?: string[]
    surface?: string
  }>
  visualSeed?: {
    theme?: "dark" | "light"
    tone?: string
    density?: "compact" | "comfortable"
    navStyle?: "editor_shell" | "control_plane" | "marketing_shell" | "community_shell"
    layoutVariant?: "split_command" | "sidebar_board" | "story_stack" | "marketing_split" | "docs_console"
    heroVariant?: "statement" | "pipeline" | "operations" | "distribution" | "community"
    surfaceVariant?: "solid" | "glass" | "soft"
    ctaVariant?: "pill" | "block" | "outline"
  }
} | null

type PreviewDelivery = {
  assignedDomain?: string
  subdomainSlots?: number
  generationProfile?: "starter" | "builder" | "premium" | "showcase"
  codeExportLevel?: "none" | "manifest" | "full"
  databaseAccessMode?: "online_only" | "managed_config" | "production_access" | "handoff_ready"
  projectLimit?: number
  collaboratorLimit?: number
  routeBudget?: number
  moduleBudget?: number
} | null

type PreviewPresentation = {
  displayName: string
  subtitle: string
  summary: string
  routes: string[]
  icon: {
    glyph: string
    from: string
    to: string
    ring: string
  }
}

type PreviewHistoryItem = {
  createdAt: string
  summary?: string
  status: "done" | "error"
  type: "generate" | "iterate"
}

type CanonicalPreviewPageProps = {
  projectId: string
  projectKey: string
  region: "cn" | "intl"
  page: string
  spec: PreviewSpec
  delivery?: PreviewDelivery
  presentation: PreviewPresentation
  history: PreviewHistoryItem[]
}

type PreviewTaskRow = {
  id: string
  title: string
  desc: string
  status: "todo" | "doing" | "done"
  owner: string
  priority: "low" | "medium" | "high"
}

type PreviewTaskExperience = {
  title: string
  subtitle: string
  addLabel: string
  searchPlaceholder: string
  boardLabel: string
  listLabel: string
  focusLabel: string
  chartTitle: string
  chartModeLabels: [string, string, string, string]
  rows: PreviewTaskRow[]
}

type PreviewFile = {
  id: string
  group: string
  label: string
  path: string
  content: string
}

function cardStyle(background = "#13151d") {
  return {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background,
    padding: 18,
  } as const
}

function PreviewAnchor({
  href,
  className,
  style,
  children,
}: {
  href: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <a
      href={href}
      className={className}
      style={style}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return
        }
        const targetUrl = new URL(href, window.location.href)
        const targetPath = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
        const isPreviewRoute = targetUrl.pathname.split("/").filter(Boolean).includes("preview")
        event.preventDefault()
        if (isPreviewRoute) {
          window.history.pushState(null, "", targetPath)
          window.dispatchEvent(new CustomEvent("mornstack-preview:navigate", { detail: { href: targetPath } }))
          window.scrollTo({ top: 0, behavior: "smooth" })
          return
        }
        window.location.assign(href)
      }}
    >
      {children}
    </a>
  )
}

function getPreviewPageFromHref(href: string, projectKey: string) {
  try {
    const parsed = new URL(href, window.location.origin)
    const parts = parsed.pathname.split("/").filter(Boolean)
    const previewIndex = parts.indexOf("preview")
    if (previewIndex < 0) return null
    const routeKey = parts[previewIndex + 1]
    if (routeKey !== projectKey) return null
    return parts[previewIndex + 2] || "dashboard"
  } catch {
    return null
  }
}

function titleCase(input: string) {
  return input.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function getNavLabel(route: string, isCn: boolean) {
  const key = route.replace(/^\//, "")
  const labels: Record<string, { cn: string; en: string }> = {
    dashboard: { cn: "总览", en: "Dashboard" },
    tasks: { cn: "任务", en: "Tasks" },
    editor: { cn: "编辑器", en: "Editor" },
    runs: { cn: "运行", en: "Runs" },
    templates: { cn: "模板库", en: "Templates" },
    pricing: { cn: "升级", en: "Pricing" },
    settings: { cn: "设置", en: "Settings" },
    analytics: { cn: "分析", en: "Analytics" },
    reports: { cn: "汇报", en: "Reports" },
    automations: { cn: "自动化", en: "Automations" },
    team: { cn: "团队", en: "Team" },
    approvals: { cn: "审批", en: "Approvals" },
    handoff: { cn: "交接", en: "Handoff" },
    playbooks: { cn: "手册", en: "Playbooks" },
    about: { cn: "关于", en: "About" },
    downloads: { cn: "下载", en: "Downloads" },
    devices: { cn: "设备", en: "Devices" },
    docs: { cn: "文档", en: "Docs" },
    admin: { cn: "后台", en: "Admin" },
    changelog: { cn: "更新日志", en: "Changelog" },
    endpoints: { cn: "接口", en: "Endpoints" },
    webhooks: { cn: "回调", en: "Webhooks" },
    usage: { cn: "用量", en: "Usage" },
    leads: { cn: "线索", en: "Leads" },
    pipeline: { cn: "管道", en: "Pipeline" },
    orders: { cn: "订单", en: "Orders" },
    customers: { cn: "客户", en: "Customers" },
    feedback: { cn: "反馈", en: "Feedback" },
    members: { cn: "成员", en: "Members" },
    roadmap: { cn: "路线图", en: "Roadmap" },
    events: { cn: "活动", en: "Events" },
    moderation: { cn: "审核", en: "Moderation" },
    security: { cn: "安全", en: "Security" },
    audit: { cn: "审计", en: "Audit" },
    incidents: { cn: "异常", en: "Incidents" },
    patients: { cn: "患者", en: "Patients" },
    appointments: { cn: "预约", en: "Appointments" },
    care: { cn: "护理", en: "Care" },
    courses: { cn: "课程", en: "Courses" },
    students: { cn: "学生", en: "Students" },
    assignments: { cn: "作业", en: "Assignments" },
    accounts: { cn: "账户", en: "Accounts" },
    transactions: { cn: "交易", en: "Transactions" },
    reconciliation: { cn: "对账", en: "Reconciliation" },
    candidates: { cn: "候选人", en: "Candidates" },
    jobs: { cn: "岗位", en: "Jobs" },
    interviews: { cn: "面试", en: "Interviews" },
    tickets: { cn: "工单", en: "Tickets" },
    cases: { cn: "案例", en: "Cases" },
    knowledge: { cn: "知识库", en: "Knowledge" },
    products: { cn: "商品", en: "Products" },
    inventory: { cn: "库存", en: "Inventory" },
    home: { cn: "首页", en: "Home" },
  }
  return isCn ? labels[key]?.cn ?? titleCase(key) : labels[key]?.en ?? titleCase(key)
}

function getPlanLabel(planTier: string | undefined, isCn: boolean) {
  if (isCn) {
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

function getGenerationProfileLabel(profile: string | undefined, isCn: boolean) {
  if (isCn) {
    if (profile === "showcase") return "展示级"
    if (profile === "premium") return "高级"
    if (profile === "builder") return "建造者"
    return "基础"
  }
  if (profile === "showcase") return "Showcase"
  if (profile === "premium") return "Premium"
  if (profile === "builder") return "Builder"
  return "Starter"
}

function getExportLabel(level: string | undefined, isCn: boolean) {
  if (isCn) {
    if (level === "full") return "完整导出"
    if (level === "manifest") return "清单导出"
    return "仅在线"
  }
  if (level === "full") return "Full export"
  if (level === "manifest") return "Manifest export"
  return "Online only"
}

function getDatabaseModeLabel(mode: string | undefined, isCn: boolean) {
  if (isCn) {
    if (mode === "handoff_ready") return "交接就绪"
    if (mode === "production_access") return "正式环境"
    if (mode === "managed_config") return "托管配置"
    return "仅在线"
  }
  if (mode === "handoff_ready") return "Handoff ready"
  if (mode === "production_access") return "Production access"
  if (mode === "managed_config") return "Managed config"
  return "Online only"
}

function formatDate(value: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function getPreviewTaskExperience({
  isCn,
  previewKind,
  promptText,
}: {
  isCn: boolean
  previewKind: string
  promptText: string
}): PreviewTaskExperience {
  if (previewKind === "crm") {
    return isCn
      ? {
          title: "销售任务流",
          subtitle: "跟进、报价、回访和签约动作直接在预览里推进。",
          addLabel: "新建跟进",
          searchPlaceholder: "搜索客户、负责人或阶段...",
          boardLabel: "销售看板",
          listLabel: "线索列表",
          focusLabel: "高意向客户",
          chartTitle: "商机推进图",
          chartModeLabels: ["漏斗", "折线", "柱状", "占比"],
          rows: [
            { id: "crm-1", title: "跟进华星续约", desc: "确认预算与法务反馈", status: "doing", owner: "Liam", priority: "high" },
            { id: "crm-2", title: "输出景曜报价", desc: "补齐版本与交付说明", status: "todo", owner: "Emma", priority: "medium" },
            { id: "crm-3", title: "Northstar 签约回访", desc: "同步上线计划与管理员名单", status: "done", owner: "Noah", priority: "low" },
          ],
        }
      : {
          title: "Sales execution flow",
          subtitle: "Advance follow-ups, proposals, handoff, and close actions directly inside preview.",
          addLabel: "New follow-up",
          searchPlaceholder: "Search accounts, owners, or stages...",
          boardLabel: "Pipeline board",
          listLabel: "Lead list",
          focusLabel: "High-intent accounts",
          chartTitle: "Deal progression",
          chartModeLabels: ["Funnel", "Line", "Bar", "Mix"],
          rows: [
            { id: "crm-1", title: "Follow Huaxing renewal", desc: "Confirm budget and legal feedback", status: "doing", owner: "Liam", priority: "high" },
            { id: "crm-2", title: "Prepare Jingyao quote", desc: "Add tier and handoff notes", status: "todo", owner: "Emma", priority: "medium" },
            { id: "crm-3", title: "Northstar close follow-up", desc: "Sync onboarding plan and admin seats", status: "done", owner: "Noah", priority: "low" },
          ],
        }
  }

  if (previewKind === "api_platform") {
    const webhookHeavy = /webhook|callback|delivery|event|retry|回调|投递|事件/.test(promptText)
    return isCn
      ? {
          title: webhookHeavy ? "事件投递轨道" : "接口运行轨道",
          subtitle: webhookHeavy ? "重试、恢复和订阅状态在预览里联动变化。" : "接口、环境和运行状态在预览里一起变化。",
          addLabel: webhookHeavy ? "新建回调动作" : "新建接口动作",
          searchPlaceholder: webhookHeavy ? "搜索事件、订阅或环境..." : "搜索接口、日志或环境...",
          boardLabel: webhookHeavy ? "投递轨道" : "运行看板",
          listLabel: webhookHeavy ? "事件列表" : "接口列表",
          focusLabel: webhookHeavy ? "待恢复事件" : "高负载接口",
          chartTitle: webhookHeavy ? "事件恢复图" : "API 运行概览",
          chartModeLabels: webhookHeavy ? ["进度", "折线", "柱状", "占比"] : ["柱状", "折线", "进度", "占比"],
          rows: webhookHeavy
            ? [
                { id: "api-1", title: "恢复 project.preview.ready", desc: "检查失败原因并触发重试", status: "doing", owner: "Gateway", priority: "high" },
                { id: "api-2", title: "同步 invoice.paid 订阅", desc: "把计费回调映射到 CRM", status: "todo", owner: "Billing", priority: "medium" },
                { id: "api-3", title: "清理 token.revoked 队列", desc: "安全事件已完成回放", status: "done", owner: "Security", priority: "low" },
              ]
            : [
                { id: "api-1", title: "检查 Generate API 配额", desc: "观察高流量租户请求趋势", status: "doing", owner: "Platform", priority: "high" },
                { id: "api-2", title: "整理 OAuth 接入规则", desc: "补齐回调与 scope 说明", status: "todo", owner: "Docs", priority: "medium" },
                { id: "api-3", title: "发布 Preview runtime 变更", desc: "当前环境已准备就绪", status: "done", owner: "Runtime", priority: "low" },
              ],
        }
      : {
          title: webhookHeavy ? "Webhook delivery rail" : "API operating rail",
          subtitle: webhookHeavy ? "Retries, recovery, and subscription health move together inside preview." : "Endpoints, environments, and runtime health now move together inside preview.",
          addLabel: webhookHeavy ? "New event action" : "New API action",
          searchPlaceholder: webhookHeavy ? "Search events, subscriptions, or environments..." : "Search endpoints, logs, or environments...",
          boardLabel: webhookHeavy ? "Delivery rail" : "Runtime board",
          listLabel: webhookHeavy ? "Event list" : "Endpoint list",
          focusLabel: webhookHeavy ? "Recovering events" : "High-load endpoints",
          chartTitle: webhookHeavy ? "Delivery recovery" : "API runtime overview",
          chartModeLabels: webhookHeavy ? ["Progress", "Line", "Bar", "Mix"] : ["Bar", "Line", "Progress", "Mix"],
          rows: webhookHeavy
            ? [
                { id: "api-1", title: "Recover project.preview.ready", desc: "Inspect failure and replay delivery", status: "doing", owner: "Gateway", priority: "high" },
                { id: "api-2", title: "Sync invoice.paid subscription", desc: "Route billing callbacks into CRM", status: "todo", owner: "Billing", priority: "medium" },
                { id: "api-3", title: "Clear token.revoked queue", desc: "Security replay finished", status: "done", owner: "Security", priority: "low" },
              ]
            : [
                { id: "api-1", title: "Review Generate API quota", desc: "Watch heavy-tenant traffic trend", status: "doing", owner: "Platform", priority: "high" },
                { id: "api-2", title: "Polish OAuth onboarding", desc: "Add callback and scope guidance", status: "todo", owner: "Docs", priority: "medium" },
                { id: "api-3", title: "Ship Preview runtime update", desc: "Current environment is ready", status: "done", owner: "Runtime", priority: "low" },
              ],
        }
  }

  if (previewKind === "code_platform") {
    return isCn
      ? {
          title: "AI 改码工作流",
          subtitle: "解释、修复、生成和重构不再是静态文案，而是会改动文件轨道。",
          addLabel: "新建 AI 任务",
          searchPlaceholder: "搜索文件、符号或 AI 动作...",
          boardLabel: "改动轨道",
          listLabel: "文件列表",
          focusLabel: "当前改动焦点",
          chartTitle: "AI 改动与运行图",
          chartModeLabels: ["进度", "折线", "柱状", "树状"],
          rows: [
            { id: "code-1", title: "为 editor/page.tsx 注入 AI 交互轨道", desc: "保持主壳不散并补状态同步", status: "doing", owner: "Copilot", priority: "high" },
            { id: "code-2", title: "检查 runs/page.tsx 预览守卫", desc: "补回退与输出提示", status: "todo", owner: "Runtime", priority: "medium" },
            { id: "code-3", title: "同步 templates 轨道状态", desc: "模板切换已写入工作区会话", status: "done", owner: "Template", priority: "low" },
          ],
        }
      : {
          title: "AI code-edit workflow",
          subtitle: "Explain, fix, generate, and refactor now change the file rail instead of acting like static copy.",
          addLabel: "New AI task",
          searchPlaceholder: "Search files, symbols, or AI actions...",
          boardLabel: "Change rail",
          listLabel: "File list",
          focusLabel: "Current code focus",
          chartTitle: "AI edits and runtime",
          chartModeLabels: ["Progress", "Line", "Bar", "Tree"],
          rows: [
            { id: "code-1", title: "Inject AI workflow into editor/page.tsx", desc: "Keep the shell stable while syncing state", status: "doing", owner: "Copilot", priority: "high" },
            { id: "code-2", title: "Review preview guards in runs/page.tsx", desc: "Add fallback and output hints", status: "todo", owner: "Runtime", priority: "medium" },
            { id: "code-3", title: "Sync template rail state", desc: "Template switching now updates workspace session", status: "done", owner: "Template", priority: "low" },
          ],
        }
  }

  return isCn
    ? {
        title: "任务执行面",
        subtitle: "新增、推进、完成和筛选都直接作用于当前工作流。",
        addLabel: "新建任务",
        searchPlaceholder: "搜索任务、负责人或标签...",
        boardLabel: "任务看板",
        listLabel: "任务列表",
        focusLabel: "当前焦点任务",
        chartTitle: "任务推进图",
        chartModeLabels: ["进度", "占比", "柱状", "树状"],
        rows: [
          { id: "task-1", title: "完成生成器任务页", desc: "保证新增、推进与完成可操作", status: "doing", owner: "产品", priority: "high" },
          { id: "task-2", title: "同步预览图表状态", desc: "让不同 prompt 看到不同图形", status: "todo", owner: "预览", priority: "medium" },
          { id: "task-3", title: "整理交付检查项", desc: "准备部署与登录测试", status: "done", owner: "交付", priority: "low" },
        ],
      }
    : {
        title: "Task execution surface",
        subtitle: "Create, advance, complete, and filter actions directly change the current workflow.",
        addLabel: "New task",
        searchPlaceholder: "Search tasks, owners, or tags...",
        boardLabel: "Task board",
        listLabel: "Task list",
        focusLabel: "Current focus",
        chartTitle: "Task progression",
        chartModeLabels: ["Progress", "Mix", "Bar", "Tree"],
        rows: [
          { id: "task-1", title: "Finish generator tasks page", desc: "Make create, advance, and complete actions usable", status: "doing", owner: "Product", priority: "high" },
          { id: "task-2", title: "Sync preview chart state", desc: "Let different prompts render different chart forms", status: "todo", owner: "Preview", priority: "medium" },
          { id: "task-3", title: "Prepare release checks", desc: "Get deployment and login testing ready", status: "done", owner: "Delivery", priority: "low" },
        ],
      }
}
function buildWorkbenchFiles({
  kind,
  brand,
  region,
  isCn,
}: {
  kind?: string
  brand: string
  region: "cn" | "intl"
  isCn: boolean
}) {
  if (kind === "admin_ops") {
    return [
      {
        id: "admin-approvals",
        group: "app",
        label: "approvals/page.tsx",
        path: "app/approvals/page.tsx",
        content: `export const approvalQueues = ["access_review", "policy_change", "incident_signoff"]\nexport const workspaceMode = "${isCn ? "china-control-plane" : "internal-control-plane"}"`,
      },
      {
        id: "admin-security",
        group: "app",
        label: "security/page.tsx",
        path: "app/security/page.tsx",
        content: `export const policyScopes = ["workspace", "billing", "preview", "deploy"]\nexport const auditMode = "${isCn ? "审计优先" : "audit-first"}"`,
      },
      {
        id: "admin-automation",
        group: "lib",
        label: "governance-rules.ts",
        path: "lib/governance-rules.ts",
        content: `export function syncGovernanceRule(event: string) {\n  return { event, notify: ["security", "ops", "workspace-admin"], export: true }\n}`,
      },
    ] satisfies PreviewFile[]
  }

  if (kind === "crm") {
    return [
      {
        id: "crm-dashboard",
        group: "app",
        label: "dashboard/page.tsx",
        path: "app/dashboard/page.tsx",
        content: `export default function DashboardPage() {
  return {
    product: "${brand}",
    market: "${region}",
    focus: "leads, pipeline, automations",
    summary: "${isCn ? "用更强的中国团队交付节奏推动销售闭环" : "Drive the sales loop with a stronger operator workflow"}",
  }
}`,
      },
      {
        id: "crm-leads",
        group: "app",
        label: "leads/page.tsx",
        path: "app/leads/page.tsx",
        content: `export const leadStages = ["new", "qualified", "proposal", "won"]\nexport const ownerMode = "china-sales-ops"`,
      },
      {
        id: "crm-automation",
        group: "lib",
        label: "automations.ts",
        path: "lib/automations.ts",
        content: `export function queueAutomation(trigger: string) {\n  return { trigger, mode: "handoff-first", notify: ["sales", "delivery"] }\n}`,
      },
    ] satisfies PreviewFile[]
  }

  if (kind === "api_platform") {
    return [
      {
        id: "api-endpoints",
        group: "app",
        label: "endpoints/page.tsx",
        path: "app/endpoints/page.tsx",
        content: `export const endpoints = ["/auth/token", "/projects", "/logs", "/environments"]\nexport const authMode = "${isCn ? "企业访问密钥" : "workspace API token"}"`,
      },
      {
        id: "api-logs",
        group: "app",
        label: "logs/page.tsx",
        path: "app/logs/page.tsx",
        content: `export const logStreams = ["gateway", "worker", "preview", "deploy"]\nexport const retention = "30d"`,
      },
      {
        id: "api-auth",
        group: "lib",
        label: "auth.ts",
        path: "lib/auth.ts",
        content: `export function assertApiAccess(scope: string) {\n  return { scope, tenant: "${brand.toLowerCase()}", mode: "project-bound" }\n}`,
      },
    ] satisfies PreviewFile[]
  }

  if (kind === "community") {
    return [
      {
        id: "community-home",
        group: "app",
        label: "community/page.tsx",
        path: "app/community/page.tsx",
        content: `export default function CommunityPage() {
  return {
    brand: "${brand}",
    sections: ["announcements", "feedback", "knowledge-base", "events"],
    tone: "${isCn ? "更贴近中文团队运营与反馈闭环" : "community feedback and ops workflow"}",
  }
}`,
      },
      {
        id: "community-moderation",
        group: "app",
        label: "moderation/page.tsx",
        path: "app/moderation/page.tsx",
        content: `export const moderationQueues = ["new", "triage", "escalated", "published"]\nexport const ownerMode = "community-ops"`,
      },
      {
        id: "community-automation",
        group: "lib",
        label: "automation.ts",
        path: "lib/automation.ts",
        content: `export function routeFeedback(channel: string) {\n  return { channel, targets: ["ops", "product", "support"], cadence: "daily" }\n}`,
      },
    ] satisfies PreviewFile[]
  }

  if (kind === "blog") {
    return [
      {
        id: "site-home",
        group: "app",
        label: "page.tsx",
        path: "app/page.tsx",
        content: `export default function MarketingHome() {\n  return { brand: "${brand}", sections: ["hero", "downloads", "pricing", "faq"] }\n}`,
      },
      {
        id: "site-docs",
        group: "app",
        label: "docs/page.tsx",
        path: "app/docs/page.tsx",
        content: `export const docsSections = ["quickstart", "deployment", "integrations", "billing"]\nexport const locale = "${region}"`,
      },
      {
        id: "site-content",
        group: "components",
        label: "content-grid.tsx",
        path: "components/content-grid.tsx",
        content: `export function ContentGrid() {\n  return ["launch story", "feature comparison", "download CTA", "changelog"]\n}`,
      },
    ] satisfies PreviewFile[]
  }

  return [
    {
      id: "editor-main",
      group: "app",
      label: "editor/page.tsx",
      path: "app/editor/page.tsx",
      content: `export default function EditorPage() {
  return {
    brand: "${brand}",
    locale: "${region}",
    panels: ["activity_bar", "file_tree", "tab_editor", "terminal_panel", "ai_assistant_panel"],
  }
}`,
    },
    {
      id: "editor-files",
      group: "components",
      label: "file-tree.tsx",
      path: "components/file-tree.tsx",
      content: `export function FileTree() {\n  return ["app/dashboard/page.tsx", "app/editor/page.tsx", "app/runs/page.tsx", "lib/ai-actions.ts"]\n}`,
    },
    {
      id: "editor-ai",
      group: "lib",
      label: "ai-actions.ts",
      path: "lib/ai-actions.ts",
      content: `export const aiActions = {\n  explain: "${isCn ? "解释当前文件职责与依赖边界" : "Explain the current file responsibility and boundaries"}",\n  fix: "${isCn ? "修复预览、运行与交付链路" : "Fix preview, runtime, and delivery flows"}",\n  generate: "${isCn ? "继续生成页面、终端和模板能力" : "Generate more pages, terminal flow, and templates"}",\n  refactor: "${isCn ? "重构为更完整的中国版 AI 代码平台" : "Refactor into a fuller AI coding workspace"}",\n}`,
    },
    {
      id: "editor-runtime",
      group: "lib",
      label: "runtime.ts",
      path: "lib/runtime.ts",
      content: `export const runtimeState = {\n  preview: "canonical",\n  status: "ready",\n  delivery: ["admin assets", "market sync", "handoff docs"],\n}`,
    },
  ] satisfies PreviewFile[]
}

export function CanonicalPreviewPage({
  projectId,
  projectKey,
  region,
  page,
  spec,
  delivery,
  presentation,
  history,
}: CanonicalPreviewPageProps) {
  const isCn = region === "cn"
  const locale = isCn ? "zh-CN" : "en-US"
  const routes = presentation.routes.length ? presentation.routes : ["/dashboard", "/editor", "/runs", "/templates", "/pricing"]
  const defaultPage = page || (routes[0] ? routes[0].replace(/^\//, "") : "dashboard")
  const [clientPage, setClientPage] = useState(defaultPage)
  useEffect(() => {
    setClientPage(defaultPage)
  }, [defaultPage])
  useEffect(() => {
    function handlePreviewNavigate(event: Event) {
      const href = (event as CustomEvent<{ href?: string }>).detail?.href
      if (!href) return
      const nextPage = getPreviewPageFromHref(href, projectKey)
      if (nextPage) {
        setClientPage(nextPage)
      }
    }

    function handlePopState() {
      const nextPage = getPreviewPageFromHref(window.location.href, projectKey)
      if (nextPage) {
        setClientPage(nextPage)
      }
    }

    window.addEventListener("mornstack-preview:navigate", handlePreviewNavigate)
    window.addEventListener("popstate", handlePopState)
    return () => {
      window.removeEventListener("mornstack-preview:navigate", handlePreviewNavigate)
      window.removeEventListener("popstate", handlePopState)
    }
  }, [projectKey])
  const activePage = clientPage || defaultPage
  const routeBlueprintEntries = Array.isArray(spec?.routeBlueprint) ? spec.routeBlueprint : []
  const activeRouteBlueprint =
    routeBlueprintEntries.find((route) => {
      const id = String(route.id ?? "").replace(/^\//, "")
      const path = String(route.path ?? "").replace(/^\//, "")
      return id === activePage || path === activePage || (activePage === "dashboard" && (id === "dashboard" || path === "dashboard"))
    }) ?? null
  const activeRoutePrototype = activeRouteBlueprint?.pagePrototype
  const latestHistory = history[0]
  const basePageSummary =
    latestHistory?.summary ||
    presentation.summary ||
    (isCn ? "已生成可演示的产品骨架。" : "A demo-ready product scaffold has been generated.")
  const routeKeysForKind = routes.map((route) => route.replace(/^\//, "").toLowerCase())
  const routeSignalForKind = routeKeysForKind.join(" ")
  const rawPreviewSignals = [
    spec?.kind,
    spec?.appIntent?.archetype,
    spec?.appIntent?.productCategory,
    spec?.appIdentity?.category,
    spec?.modules?.join(" "),
    spec?.features?.join(" "),
    routeBlueprintEntries.map((route) => `${route.id ?? ""} ${route.path ?? ""} ${route.pagePrototype ?? ""}`).join(" "),
    routeSignalForKind,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  const routeSuggestsApi = /\b(endpoints?|webhooks?|auth|logs?|environments?|usage|keys?|sdk)\b/.test(routeSignalForKind)
  const routeSuggestsMarketing = /\b(downloads?|devices?|website|changelog|release|pricing|docs)\b/.test(routeSignalForKind) && /\b(downloads?|devices?|website|changelog|release)\b/.test(routeSignalForKind)
  const routeSuggestsCommunity = /\b(feedback|roadmap|members?|events?|moderation|posts?)\b/.test(routeSignalForKind)
  const routeSuggestsCrm = /\b(leads?|pipeline|orders?|customers?|accounts?|quotes?|renewals?|reports)\b/.test(routeSignalForKind)
  const routeSuggestsAdmin = /\b(approvals?|security|audit|incidents?|access|team)\b/.test(routeSignalForKind)
  const routeSuggestsHealthcare = /\b(patients?|appointments?|care|doctors?|nurses?)\b/.test(routeSignalForKind)
  const routeSuggestsEducation = /\b(courses?|students?|assignments?|classes?)\b/.test(routeSignalForKind)
  const routeSuggestsFinance = /\b(accounts?|transactions?|reconciliation|ledger|billing)\b/.test(routeSignalForKind) && /\b(transactions?|reconciliation|ledger)\b/.test(routeSignalForKind)
  const routeSuggestsRecruiting = /\b(candidates?|jobs?|interviews?|offers?)\b/.test(routeSignalForKind)
  const routeSuggestsSupport = /\b(tickets?|cases?|knowledge|sla|escalations?)\b/.test(routeSignalForKind)
  const routeSuggestsCommerceOps = /\b(products?|inventory|skus?|fulfillment|suppliers?)\b/.test(routeSignalForKind)
  const previewArchetype =
    routeSuggestsApi || /\b(api_platform|api platform|developer control|endpoint|webhook|sdk)\b/.test(rawPreviewSignals)
      ? "api_platform"
      : routeSuggestsMarketing || /\b(marketing_admin|website_landing_download|content_site|download|downloads|release|changelog)\b/.test(rawPreviewSignals)
        ? "marketing_admin"
        : routeSuggestsCommunity || /\b(community|feedback|roadmap|moderation)\b/.test(rawPreviewSignals)
          ? "community"
          : routeSuggestsHealthcare || /\b(healthcare|clinic|patient|appointment|care plan|medical|nurse)\b/.test(rawPreviewSignals)
              ? "healthcare"
              : routeSuggestsEducation || /\b(education|learning|course|student|assignment|classroom)\b/.test(rawPreviewSignals)
                ? "education"
                : routeSuggestsFinance || /\b(finance|ledger|transaction|reconciliation|banking|accounting)\b/.test(rawPreviewSignals)
                  ? "finance"
                  : routeSuggestsRecruiting || /\b(recruiting|candidate|interview|hiring|talent|offer approval)\b/.test(rawPreviewSignals)
                    ? "recruiting"
                    : routeSuggestsSupport || /\b(support|ticket|helpdesk|sla|knowledge base|escalation)\b/.test(rawPreviewSignals)
                      ? "support"
                      : routeSuggestsCommerceOps || /\b(commerce_ops|inventory|warehouse|fulfillment|product sku|supplier)\b/.test(rawPreviewSignals)
                        ? "commerce_ops"
                        : routeSuggestsCrm || /\b(crm|sales|pipeline|leads|accounts|quotes)\b/.test(rawPreviewSignals)
                          ? "crm"
                          : routeSuggestsAdmin || /\b(admin_ops_internal_tool|internal admin|backoffice|control plane|approval|audit|incident)\b/.test(rawPreviewSignals)
                            ? "admin_ops_internal_tool"
                            : spec?.appIdentity?.category ?? spec?.appIntent?.archetype ?? spec?.kind
  const previewKind =
    previewArchetype === "marketing_admin"
      ? "blog"
      : previewArchetype === "admin_ops_internal_tool"
        ? "admin_ops"
        : previewArchetype
  const isCrmPreview = previewKind === "crm"
  const isApiPreview = previewKind === "api_platform"
  const isCommunityPreview = previewKind === "community"
  const isMarketingPreview = previewKind === "blog"
  const isHealthcarePreview = previewKind === "healthcare"
  const isEducationPreview = previewKind === "education"
  const isFinancePreview = previewKind === "finance"
  const isRecruitingPreview = previewKind === "recruiting"
  const isSupportPreview = previewKind === "support"
  const isCommerceOpsPreview = previewKind === "commerce_ops"
  const isSpecializedOpsPreview = isHealthcarePreview || isEducationPreview || isFinancePreview || isRecruitingPreview || isSupportPreview || isCommerceOpsPreview
  const isAdminPreview = previewKind === "admin_ops" || previewKind === "task"
  const workbenchKind = previewKind === "admin_ops" ? "admin_ops" : isSpecializedOpsPreview ? "task" : previewKind

  const dashboardSections = useMemo(() => {
    if (isCrmPreview) {
      return isCn
        ? ["概览", "线索", "自动化", "分析", "权限", "设置"]
        : ["Overview", "Leads", "Automations", "Analytics", "Access", "Settings"]
    }
    if (isApiPreview) {
      return isCn
        ? ["概览", "Endpoints", "日志", "鉴权", "环境", "设置"]
        : ["Overview", "Endpoints", "Logs", "Auth", "Environments", "Settings"]
    }
    if (isCommunityPreview) {
      return isCn
        ? ["概览", "反馈", "公告", "成员", "自动化", "设置"]
        : ["Overview", "Feedback", "Announcements", "Members", "Automations", "Settings"]
    }
    if (isMarketingPreview) {
      return isCn
        ? ["概览", "内容", "下载", "文档", "定价", "设置"]
        : ["Overview", "Content", "Downloads", "Docs", "Pricing", "Settings"]
    }
    if (isHealthcarePreview) return isCn ? ["概览", "患者", "预约", "护理", "风险", "设置"] : ["Overview", "Patients", "Appointments", "Care", "Risk", "Settings"]
    if (isRecruitingPreview) return isCn ? ["概览", "候选人", "岗位", "面试", "Offer", "分析"] : ["Overview", "Candidates", "Jobs", "Interviews", "Offers", "Analytics"]
    if (isSupportPreview) return isCn ? ["概览", "工单", "客户案例", "SLA", "知识库", "升级"] : ["Overview", "Tickets", "Cases", "SLA", "Knowledge", "Escalations"]
    if (isCommerceOpsPreview) return isCn ? ["概览", "商品", "库存", "履约", "供应商", "预警"] : ["Overview", "Products", "Inventory", "Fulfillment", "Suppliers", "Alerts"]
    if (isFinancePreview) return isCn ? ["概览", "账户", "交易", "对账", "风控", "报表"] : ["Overview", "Accounts", "Transactions", "Reconciliation", "Risk", "Reports"]
    if (isEducationPreview) return isCn ? ["概览", "课程", "学生", "作业", "班级", "报告"] : ["Overview", "Courses", "Students", "Assignments", "Classes", "Reports"]
    return isCn
      ? ["概览", "用户", "数据", "集成", "安全", "设置"]
      : ["Overview", "Users", "Data", "Integrations", "Security", "Settings"]
  }, [isApiPreview, isCn, isCommerceOpsPreview, isCommunityPreview, isCrmPreview, isEducationPreview, isFinancePreview, isHealthcarePreview, isMarketingPreview, isRecruitingPreview, isSupportPreview])
  const [dashboardSection, setDashboardSection] = useState(dashboardSections[0] || "Overview")
  useEffect(() => {
    if (!dashboardSections.includes(dashboardSection)) {
      setDashboardSection(dashboardSections[0] || "Overview")
    }
  }, [dashboardSection, dashboardSections])

  const workbenchFiles = useMemo(
    () =>
      buildWorkbenchFiles({
        kind: workbenchKind,
        brand: presentation.displayName,
        region,
        isCn,
      }),
    [isCn, presentation.displayName, region, workbenchKind]
  )
  const [selectedFileId, setSelectedFileId] = useState(() => workbenchFiles[0]?.id ?? "")
  const [openFileIds, setOpenFileIds] = useState<string[]>(() => workbenchFiles.slice(0, 2).map((item) => item.id))
  const [activityView, setActivityView] = useState<"explorer" | "search" | "runs" | "settings">("explorer")
  const [terminalTab, setTerminalTab] = useState<"terminal" | "problems" | "output">("terminal")
  const [templateCategory, setTemplateCategory] = useState<"product" | "ops" | "data">("product")
  const [aiMode, setAiMode] = useState<"explain" | "fix" | "generate" | "refactor">("explain")
  const [runsFilter, setRunsFilter] = useState<"all" | "ready" | "running" | "failed">("all")
  useEffect(() => {
    if (!workbenchFiles.some((item) => item.id === selectedFileId)) {
      setSelectedFileId(workbenchFiles[0]?.id ?? "")
    }
  }, [selectedFileId, workbenchFiles])
  useEffect(() => {
    setOpenFileIds((current) => {
      const valid = current.filter((id) => workbenchFiles.some((item) => item.id === id))
      if (valid.length) return valid
      return workbenchFiles.slice(0, 2).map((item) => item.id)
    })
  }, [workbenchFiles])

  const previewTaskExperience = useMemo(
    () =>
      getPreviewTaskExperience({
        isCn,
        previewKind,
        promptText: String((spec as { prompt?: string } | null)?.prompt ?? presentation.displayName ?? "").toLowerCase(),
      }),
    [isCn, presentation.displayName, previewKind, spec]
  )
  const [previewTaskRows, setPreviewTaskRows] = useState<PreviewTaskRow[]>(previewTaskExperience.rows)
  const [previewTaskQuery, setPreviewTaskQuery] = useState("")
  const [previewTaskView, setPreviewTaskView] = useState<"board" | "list">("board")
  useEffect(() => {
    setPreviewTaskRows(previewTaskExperience.rows)
  }, [previewTaskExperience])

  const filteredPreviewTaskRows = useMemo(() => {
    const needle = previewTaskQuery.trim().toLowerCase()
    return previewTaskRows.filter((row) => {
      const haystack = [row.title, row.desc, row.owner, row.status, row.priority].join(" ").toLowerCase()
      return !needle || haystack.includes(needle)
    })
  }, [previewTaskQuery, previewTaskRows])

  const previewTaskGroups = useMemo(
    () => ({
      todo: filteredPreviewTaskRows.filter((row) => row.status === "todo"),
      doing: filteredPreviewTaskRows.filter((row) => row.status === "doing"),
      done: filteredPreviewTaskRows.filter((row) => row.status === "done"),
    }),
    [filteredPreviewTaskRows]
  )

  const previewTaskMetrics = useMemo(() => {
    const total = previewTaskRows.length
    const done = previewTaskRows.filter((row) => row.status === "done").length
    const doing = previewTaskRows.filter((row) => row.status === "doing").length
    const todo = previewTaskRows.filter((row) => row.status === "todo").length
    const owners = Array.from(new Set(previewTaskRows.map((row) => row.owner)))
    const completionRate = total ? Math.round((done / total) * 100) : 0
    return { total, done, doing, todo, owners, completionRate, focus: previewTaskRows.find((row) => row.priority === "high" && row.status !== "done") ?? previewTaskRows[0] ?? null }
  }, [previewTaskRows])

  const movePreviewTask = (id: string, direction: -1 | 1) => {
    const order: PreviewTaskRow["status"][] = ["todo", "doing", "done"]
    setPreviewTaskRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row
        const nextIndex = Math.max(0, Math.min(order.length - 1, order.indexOf(row.status) + direction))
        return { ...row, status: order[nextIndex] }
      })
    )
  }

  const addPreviewTask = () => {
    setPreviewTaskRows((current) => [
      {
        id: `preview-task-${Date.now()}`,
        title: previewTaskExperience.addLabel,
        desc: previewTaskExperience.subtitle,
        status: "todo",
        owner: isCn ? "新负责人" : "New owner",
        priority: "medium",
      },
      ...current,
    ])
  }

  const previewTaskChartRows = [
    { label: isCn ? "待办" : "Todo", value: previewTaskMetrics.todo, tone: "#94a3b8" },
    { label: isCn ? "进行中" : "Doing", value: previewTaskMetrics.doing, tone: "#2563eb" },
    { label: isCn ? "已完成" : "Done", value: previewTaskMetrics.done, tone: "#16a34a" },
  ]
  const previewTaskTotal = Math.max(1, previewTaskMetrics.total)
  const previewTaskSegments = [
    `${previewTaskChartRows[0].tone} 0 ${(previewTaskChartRows[0].value / previewTaskTotal) * 360}deg`,
    `${previewTaskChartRows[1].tone} ${(previewTaskChartRows[0].value / previewTaskTotal) * 360}deg ${((previewTaskChartRows[0].value + previewTaskChartRows[1].value) / previewTaskTotal) * 360}deg`,
    `${previewTaskChartRows[2].tone} ${((previewTaskChartRows[0].value + previewTaskChartRows[1].value) / previewTaskTotal) * 360}deg 360deg`,
  ].join(", ")
  const previewTaskOwnerLoad = previewTaskMetrics.owners.map((owner) => {
    const count = previewTaskRows.filter((row) => row.owner === owner).length
    return {
      owner,
      count,
      share: previewTaskRows.length ? Math.round((count / previewTaskRows.length) * 100) : 0,
    }
  })
  const renderPreviewTaskSurface = ({ dark = false }: { dark?: boolean } = {}) => {
    const surfaceBackground = dark ? "#161a24" : "rgba(255,255,255,0.92)"
    const panelBackground = dark ? "#111827" : "rgba(239,246,255,0.86)"
    const borderColor = dark ? "rgba(255,255,255,0.08)" : "rgba(148,163,184,0.18)"
    const textColor = dark ? "#f8fafc" : "#0f172a"
    const mutedColor = dark ? "rgba(226,232,240,0.72)" : "rgba(15,23,42,0.62)"
    const ctaBackground = dark ? "#8b5cf6" : "#0f172a"

    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ ...cardStyle(surfaceBackground), border: `1px solid ${borderColor}`, boxShadow: dark ? "none" : "0 16px 40px rgba(15,23,42,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: textColor }}>{previewTaskExperience.title}</div>
              <div style={{ marginTop: 8, color: mutedColor, lineHeight: 1.7 }}>{previewTaskExperience.subtitle}</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={addPreviewTask}
                style={{ borderRadius: 14, padding: "11px 16px", background: ctaBackground, color: "#fff", fontWeight: 800, border: "none", cursor: "pointer" }}
              >
                {previewTaskExperience.addLabel}
              </button>
              <div style={{ display: "flex", gap: 8, padding: 4, borderRadius: 999, background: panelBackground, border: `1px solid ${borderColor}` }}>
                {[
                  { key: "board", label: previewTaskExperience.boardLabel },
                  { key: "list", label: previewTaskExperience.listLabel },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPreviewTaskView(item.key as "board" | "list")}
                    style={{
                      borderRadius: 999,
                      padding: "8px 12px",
                      background: previewTaskView === item.key ? (dark ? "rgba(124,58,237,0.28)" : "rgba(124,58,237,0.18)") : "transparent",
                      color: previewTaskView === item.key ? textColor : mutedColor,
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            {[
              { label: isCn ? "总任务" : "Total items", value: String(previewTaskMetrics.total), note: previewTaskExperience.chartModeLabels[0] },
              { label: isCn ? "完成率" : "Completion", value: `${previewTaskMetrics.completionRate}%`, note: previewTaskExperience.chartModeLabels[1] },
              { label: isCn ? "负责人" : "Owners", value: String(previewTaskMetrics.owners.length), note: previewTaskExperience.chartModeLabels[3] },
              { label: isCn ? "焦点任务" : "Focus item", value: previewTaskMetrics.focus?.title ?? "—", note: previewTaskExperience.focusLabel },
            ].map((item) => (
              <div key={item.label} style={{ borderRadius: 18, background: panelBackground, border: `1px solid ${borderColor}`, padding: 14 }}>
                <div style={{ color: mutedColor, fontSize: 12 }}>{item.label}</div>
                <div style={{ marginTop: 10, color: textColor, fontWeight: 900, fontSize: item.label === (isCn ? "焦点任务" : "Focus item") ? 16 : 28, lineHeight: 1.3 }}>{item.value}</div>
                <div style={{ marginTop: 8, color: mutedColor, fontSize: 12 }}>{item.note}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 16 }}>
          <div style={{ ...cardStyle(surfaceBackground), border: `1px solid ${borderColor}`, boxShadow: dark ? "none" : "0 16px 40px rgba(15,23,42,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: textColor }}>{previewTaskExperience.chartTitle}</div>
                <div style={{ marginTop: 6, color: mutedColor, fontSize: 13 }}>{previewTaskExperience.chartModeLabels.join(" · ")}</div>
              </div>
              <input
                value={previewTaskQuery}
                onChange={(event) => setPreviewTaskQuery(event.target.value)}
                placeholder={previewTaskExperience.searchPlaceholder}
                style={{
                  minWidth: 220,
                  borderRadius: 12,
                  border: `1px solid ${borderColor}`,
                  background: panelBackground,
                  color: textColor,
                  padding: "10px 12px",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 180px", gap: 18, alignItems: "center" }}>
              <div style={{ display: "grid", gap: 12 }}>
                {previewTaskChartRows.map((item) => (
                  <div key={item.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: mutedColor }}>
                      <span>{item.label}</span>
                      <span style={{ color: textColor, fontWeight: 700 }}>{item.value}</span>
                    </div>
                    <div style={{ height: 12, borderRadius: 999, background: dark ? "#1f2937" : "#e2e8f0", overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(10, Math.round((item.value / previewTaskTotal) * 100))}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${item.tone}, ${item.tone}cc)` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", placeItems: "center" }}>
                <div style={{ width: 150, height: 150, borderRadius: "50%", background: `conic-gradient(${previewTaskSegments})`, display: "grid", placeItems: "center" }}>
                  <div style={{ width: 88, height: 88, borderRadius: "50%", background: dark ? "#0f172a" : "#fff", display: "grid", placeItems: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: textColor, fontSize: 24, fontWeight: 900 }}>{previewTaskMetrics.completionRate}%</div>
                      <div style={{ color: mutedColor, fontSize: 11 }}>{previewTaskExperience.chartModeLabels[0]}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle(surfaceBackground), border: `1px solid ${borderColor}`, boxShadow: dark ? "none" : "0 16px 40px rgba(15,23,42,0.08)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: textColor }}>{previewTaskExperience.focusLabel}</div>
            {previewTaskMetrics.focus ? (
              <div style={{ marginTop: 14, borderRadius: 18, background: panelBackground, border: `1px solid ${borderColor}`, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 800, color: textColor }}>{previewTaskMetrics.focus.title}</div>
                  <div style={{ color: previewTaskMetrics.focus.priority === "high" ? "#f97316" : previewTaskMetrics.focus.priority === "medium" ? "#8b5cf6" : "#94a3b8", fontSize: 12, fontWeight: 800 }}>
                    {previewTaskMetrics.focus.priority}
                  </div>
                </div>
                <div style={{ marginTop: 8, color: mutedColor, lineHeight: 1.6 }}>{previewTaskMetrics.focus.desc}</div>
                <div style={{ marginTop: 10, color: mutedColor, fontSize: 13 }}>{previewTaskMetrics.focus.owner}</div>
              </div>
            ) : null}
            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              {previewTaskOwnerLoad.map((item) => (
                <div key={item.owner}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: mutedColor }}>
                    <span>{item.owner}</span>
                    <span style={{ color: textColor, fontWeight: 700 }}>{item.count}</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: dark ? "#1f2937" : "#e2e8f0", overflow: "hidden" }}>
                    <div style={{ width: `${Math.max(10, item.share)}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #8b5cf6, #38bdf8)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {previewTaskView === "board" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
            {[
              { key: "todo", label: isCn ? "待办" : "Todo", rows: previewTaskGroups.todo },
              { key: "doing", label: isCn ? "进行中" : "Doing", rows: previewTaskGroups.doing },
              { key: "done", label: isCn ? "已完成" : "Done", rows: previewTaskGroups.done },
            ].map((column, columnIndex) => (
              <div key={column.key} style={{ ...cardStyle(surfaceBackground), border: `1px solid ${borderColor}`, boxShadow: dark ? "none" : "0 16px 40px rgba(15,23,42,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ color: textColor, fontWeight: 800 }}>{column.label}</div>
                  <div style={{ color: mutedColor, fontSize: 12 }}>{column.rows.length}</div>
                </div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {column.rows.map((row) => (
                    <div key={row.id} style={{ borderRadius: 18, background: panelBackground, border: `1px solid ${borderColor}`, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 800, color: textColor }}>{row.title}</div>
                        <div style={{ color: row.priority === "high" ? "#f97316" : row.priority === "medium" ? "#8b5cf6" : "#94a3b8", fontSize: 12, fontWeight: 800 }}>{row.priority}</div>
                      </div>
                      <div style={{ marginTop: 8, color: mutedColor, lineHeight: 1.6 }}>{row.desc}</div>
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <span style={{ color: mutedColor, fontSize: 12 }}>{row.owner}</span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => movePreviewTask(row.id, -1)}
                            disabled={columnIndex === 0}
                            style={{ borderRadius: 10, padding: "6px 10px", border: `1px solid ${borderColor}`, background: "transparent", color: columnIndex === 0 ? `${mutedColor}88` : textColor, cursor: columnIndex === 0 ? "not-allowed" : "pointer" }}
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            onClick={() => movePreviewTask(row.id, 1)}
                            disabled={columnIndex === 2}
                            style={{ borderRadius: 10, padding: "6px 10px", border: `1px solid ${borderColor}`, background: "transparent", color: columnIndex === 2 ? `${mutedColor}88` : textColor, cursor: columnIndex === 2 ? "not-allowed" : "pointer" }}
                          >
                            →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!column.rows.length ? <div style={{ color: mutedColor, fontSize: 13 }}>{isCn ? "当前筛选下暂无内容" : "No items for the current filter"}</div> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...cardStyle(surfaceBackground), border: `1px solid ${borderColor}`, boxShadow: dark ? "none" : "0 16px 40px rgba(15,23,42,0.08)" }}>
            <div style={{ display: "grid", gap: 10 }}>
              {filteredPreviewTaskRows.map((row) => (
                <div key={row.id} style={{ borderRadius: 18, background: panelBackground, border: `1px solid ${borderColor}`, padding: 14, display: "grid", gridTemplateColumns: "1.4fr 1fr 120px 120px", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ color: textColor, fontWeight: 800 }}>{row.title}</div>
                    <div style={{ marginTop: 6, color: mutedColor, lineHeight: 1.6 }}>{row.desc}</div>
                  </div>
                  <div style={{ color: mutedColor }}>{row.owner}</div>
                  <div style={{ color: textColor, fontWeight: 700 }}>{row.status}</div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button type="button" onClick={() => movePreviewTask(row.id, -1)} style={{ borderRadius: 10, padding: "6px 10px", border: `1px solid ${borderColor}`, background: "transparent", color: textColor, cursor: "pointer" }}>←</button>
                    <button type="button" onClick={() => movePreviewTask(row.id, 1)} style={{ borderRadius: 10, padding: "6px 10px", border: `1px solid ${borderColor}`, background: "transparent", color: textColor, cursor: "pointer" }}>→</button>
                  </div>
                </div>
              ))}
              {!filteredPreviewTaskRows.length ? <div style={{ color: mutedColor, fontSize: 13 }}>{isCn ? "当前筛选下暂无内容" : "No items for the current filter"}</div> : null}
            </div>
          </div>
        )}
      </div>
    )
  }

  const [pricingFocus, setPricingFocus] = useState<"free" | "starter" | "builder" | "pro" | "elite">(
    spec?.planTier === "elite" || spec?.planTier === "pro" || spec?.planTier === "builder" || spec?.planTier === "starter"
      ? spec.planTier
      : "builder"
  )
  const planLabel = getPlanLabel(spec?.planTier, isCn)
  const generationProfileLabel = getGenerationProfileLabel(delivery?.generationProfile, isCn)
  const exportLabel = getExportLabel(delivery?.codeExportLevel, isCn)
  const databaseModeLabel = getDatabaseModeLabel(delivery?.databaseAccessMode, isCn)
  const dashboardModel = useMemo(() => {
    const promptText = String((spec as { prompt?: string } | null)?.prompt ?? presentation.displayName ?? "").toLowerCase()

    if (isCrmPreview) {
      const renewalHeavy = /renewal|onboarding|customer success|续约|交付|上线/.test(promptText)
      const approvalsHeavy = /quote|approval|order|contract|报价|审批|订单|合同/.test(promptText)
      return {
        eyebrow: isCn ? "销售控制平面" : "Revenue control plane",
        headline: renewalHeavy
          ? isCn ? "续约、交付和客户扩张在同一个收入工作台里推进。" : "Drive renewals, onboarding, and expansion from one revenue workspace."
          : approvalsHeavy
            ? isCn ? "把报价审批、订单执行和成交节奏放进同一个 CRM 驾驶舱。" : "Bring quote approvals, order execution, and close cadence into one CRM cockpit."
            : isCn ? "把线索、商机、预测和团队节奏收进一个 CRM 驾驶舱。" : "Pull leads, pipeline, forecasting, and team cadence into one CRM cockpit.",
        primaryCta: isCn ? "打开成交工作台" : "Open revenue workspace",
        secondaryCta: isCn ? "查看本周预测" : "View weekly forecast",
        stats: renewalHeavy
          ? [
              { label: isCn ? "本月续约金额" : "Renewal pipeline", value: "$146k", tone: "#14b8a6" },
              { label: isCn ? "待上线客户" : "Onboarding accounts", value: "9", tone: "#38bdf8" },
              { label: isCn ? "扩张机会" : "Expansion plays", value: "6", tone: "#8b5cf6" },
              { label: isCn ? "风险客户" : "At-risk renewals", value: "2", tone: "#f97316" },
            ]
          : approvalsHeavy
            ? [
                { label: isCn ? "待审批报价" : "Quotes pending", value: "4", tone: "#8b5cf6" },
                { label: isCn ? "开放订单" : "Open orders", value: "11", tone: "#22c55e" },
                { label: isCn ? "待付款确认" : "Payment follow-up", value: "3", tone: "#f59e0b" },
                { label: isCn ? "本周成交" : "Deals won", value: "$118k", tone: "#14b8a6" },
              ]
            : [
                { label: isCn ? "本月管道" : "Monthly pipeline", value: "$118k", tone: "#14b8a6" },
                { label: isCn ? "赢单预测" : "Win forecast", value: "68%", tone: "#8b5cf6" },
                { label: isCn ? "高意向线索" : "Hot leads", value: "19", tone: "#38bdf8" },
                { label: isCn ? "团队达成率" : "Quota attainment", value: "73%", tone: "#f59e0b" },
              ],
        chartTitle: renewalHeavy
          ? (isCn ? "续约与上线节奏" : "Renewal and onboarding rhythm")
          : approvalsHeavy
            ? (isCn ? "报价到订单转化" : "Quote to order conversion")
            : (isCn ? "销售阶段分布" : "Pipeline by stage"),
        chartBars: renewalHeavy
          ? [
              { label: isCn ? "续约中" : "Renewing", value: 76, color: "#14b8a6" },
              { label: isCn ? "签约后上线" : "Onboarding", value: 54, color: "#38bdf8" },
              { label: isCn ? "扩张机会" : "Expansion", value: 42, color: "#8b5cf6" },
              { label: isCn ? "风险提醒" : "Risk watch", value: 18, color: "#f97316" },
            ]
          : approvalsHeavy
            ? [
                { label: isCn ? "已出报价" : "Quoted", value: 84, color: "#8b5cf6" },
                { label: isCn ? "待审批" : "Awaiting approval", value: 61, color: "#f59e0b" },
                { label: isCn ? "待付款" : "Pending payment", value: 38, color: "#38bdf8" },
                { label: isCn ? "已成交" : "Won", value: 52, color: "#22c55e" },
              ]
            : [
                { label: isCn ? "发现" : "Discovery", value: 26, color: "#38bdf8" },
                { label: isCn ? "方案" : "Proposal", value: 48, color: "#8b5cf6" },
                { label: isCn ? "谈判" : "Negotiation", value: 42, color: "#14b8a6" },
                { label: isCn ? "成交" : "Won", value: 31, color: "#22c55e" },
              ],
        panelTitle: renewalHeavy
          ? (isCn ? "客户推进" : "Customer rollout")
          : approvalsHeavy
            ? (isCn ? "订单与审批" : "Orders and approvals")
            : (isCn ? "重点机会" : "Key deals"),
        panelItems: renewalHeavy
          ? [
              { title: isCn ? "华星续约" : "Huaxing renewal", meta: isCn ? "预算已锁定，等待法务确认" : "Budget locked, waiting on legal", status: isCn ? "续约" : "Renewal" },
              { title: isCn ? "景曜 AI 上线" : "Jingyao AI go-live", meta: isCn ? "CSM 已同步管理员名单" : "CSM synced admin seats", status: isCn ? "上线中" : "Onboarding" },
              { title: isCn ? "北辰扩张" : "Northstar expansion", meta: isCn ? "已进入高管评审" : "Entered exec review", status: isCn ? "扩张" : "Expansion" },
            ]
          : approvalsHeavy
            ? [
                { title: isCn ? "智联云企业续约" : "Zhilink enterprise renewal", meta: isCn ? "财务审批中 · $24k" : "Finance approval · $24k", status: isCn ? "审批中" : "Approval" },
                { title: isCn ? "Northstar 新订单" : "Northstar new order", meta: isCn ? "PO 已到，等待付款确认" : "PO received, awaiting payment", status: isCn ? "待付款" : "Pending payment" },
                { title: isCn ? "Farway 扩席" : "Farway seat expansion", meta: isCn ? "交付已交给 CSM" : "Handoff synced with CSM", status: isCn ? "交接" : "Handoff" },
              ]
            : [
                { title: isCn ? "华星续约" : "Huaxing renewal", meta: isCn ? "负责人 Liam · 预算确认中" : "Owner Liam · budget confirmation pending", status: isCn ? "方案中" : "Proposal" },
                { title: isCn ? "景曜扩张" : "Jingyao expansion", meta: isCn ? "负责人 Emma · 演示已完成" : "Owner Emma · demo complete", status: isCn ? "已确认" : "Qualified" },
                { title: isCn ? "Northstar 跟进" : "Northstar follow-up", meta: isCn ? "交付同步已完成" : "Delivery sync complete", status: isCn ? "扩张" : "Expansion" },
              ],
        railTitle: isCn ? "本周推进" : "This week",
        railItems: renewalHeavy
          ? [
              isCn ? "把续约窗口和上线节奏放在同一条控制线上" : "Keep renewals and onboarding on the same rail",
              isCn ? "扩张机会由 CSM 和销售共管" : "Co-own expansions across CSM and sales",
              isCn ? "风险客户自动进入复盘提醒" : "At-risk accounts trigger review reminders",
            ]
          : approvalsHeavy
            ? [
                isCn ? "报价审批和订单执行同屏可见" : "Quote approvals and order execution stay in one view",
                isCn ? "付款确认后自动触发交付" : "Payment confirmation triggers handoff automatically",
                isCn ? "审批超时会通知销售与财务" : "Approval delays notify sales and finance",
              ]
            : [
                isCn ? "线索、阶段、客户和自动化保持在同一节奏面板中" : "Leads, stages, accounts, and automations stay in one operating loop",
                isCn ? "重点机会和团队目标在首页直接可见" : "Key deals and quota progress stay visible on the first screen",
                isCn ? "交付和续约不再藏在通用任务壳里" : "Handoff and renewals are no longer buried in a generic task shell",
              ],
      }
    }

    if (isApiPreview) {
      const docsHeavy = /docs|sdk|guide|onboarding|文档|sdk|接入/.test(promptText)
      const usageHeavy = /usage|billing|meter|quota|rate limit|用量|计费|配额/.test(promptText)
      const webhookHeavy = /webhook|callback|delivery|event|retry|webhook|回调|投递|事件/.test(promptText)
      return {
        eyebrow: isCn ? "开发者控制平面" : "Developer control plane",
        headline: docsHeavy
          ? isCn ? "把文档、SDK、接入和鉴权做成真正的开发者门户。" : "Turn docs, SDKs, onboarding, and auth into a real developer portal."
          : usageHeavy
            ? isCn ? "让用量、配额、账单和环境升级在一个平台驾驶舱里可见。" : "Make usage, quotas, billing, and promotions visible in one platform cockpit."
            : webhookHeavy
              ? isCn ? "把事件回调、重试恢复和环境投递做成事件控制平面。" : "Turn callbacks, retries, and delivery rails into an event-driven control plane."
              : isCn ? "把接口、日志、鉴权和环境推进合成一个 API 控制平面。" : "Fuse endpoints, logs, auth, and environments into one API control plane.",
        primaryCta: isCn ? "打开开发者控制台" : "Open developer console",
        secondaryCta: isCn ? "查看运行健康" : "View runtime health",
        stats: docsHeavy
          ? [
              { label: isCn ? "文档页面" : "Doc pages", value: "27", tone: "#38bdf8" },
              { label: isCn ? "SDK 覆盖" : "SDK coverage", value: "6", tone: "#8b5cf6" },
              { label: isCn ? "接入完成率" : "Onboarding success", value: "82%", tone: "#22c55e" },
              { label: isCn ? "鉴权策略" : "Auth policies", value: "14", tone: "#f59e0b" },
            ]
          : usageHeavy
            ? [
                { label: isCn ? "周请求量" : "Weekly requests", value: "18.2M", tone: "#38bdf8" },
                { label: isCn ? "重度租户" : "Heavy consumers", value: "12", tone: "#8b5cf6" },
                { label: isCn ? "配额命中" : "Quota alerts", value: "5", tone: "#f59e0b" },
                { label: isCn ? "计费窗口" : "Billing window", value: "Open", tone: "#22c55e" },
              ]
            : webhookHeavy
              ? [
                  { label: isCn ? "活跃订阅" : "Subscriptions", value: "37", tone: "#8b5cf6" },
                  { label: isCn ? "重试恢复率" : "Retry recovery", value: "96%", tone: "#22c55e" },
                  { label: isCn ? "投递中位延迟" : "Median latency", value: "182ms", tone: "#38bdf8" },
                  { label: isCn ? "待处理事件" : "Queued events", value: "19", tone: "#f59e0b" },
                ]
              : [
                  { label: isCn ? "周请求量" : "Weekly requests", value: "18.2M", tone: "#38bdf8" },
                  { label: isCn ? "错误率" : "Error rate", value: "0.12%", tone: "#f97316" },
                  { label: isCn ? "活跃端点" : "Live endpoints", value: "64", tone: "#8b5cf6" },
                  { label: isCn ? "最新发布" : "Latest release", value: "12m", tone: "#22c55e" },
                ],
        chartTitle: docsHeavy
          ? (isCn ? "开发者接入漏斗" : "Developer onboarding funnel")
          : usageHeavy
            ? (isCn ? "用量与计费分布" : "Usage and billing mix")
            : webhookHeavy
              ? (isCn ? "事件投递轨道" : "Webhook delivery rail")
              : (isCn ? "API 运行概览" : "API runtime overview"),
        chartBars: docsHeavy
          ? [
              { label: isCn ? "Quickstart" : "Quickstart", value: 82, color: "#38bdf8" },
              { label: isCn ? "OAuth" : "OAuth", value: 61, color: "#8b5cf6" },
              { label: isCn ? "SDK" : "SDK", value: 57, color: "#22c55e" },
              { label: isCn ? "Reference" : "Reference", value: 73, color: "#f59e0b" },
            ]
          : usageHeavy
            ? [
                { label: isCn ? "生成 API" : "Generate API", value: 88, color: "#38bdf8" },
                { label: isCn ? "预览运行" : "Preview runtime", value: 54, color: "#8b5cf6" },
                { label: isCn ? "Webhook 计费" : "Webhook billing", value: 41, color: "#22c55e" },
                { label: isCn ? "配额告警" : "Quota alerts", value: 26, color: "#f59e0b" },
              ]
            : webhookHeavy
              ? [
                  { label: isCn ? "成功" : "Delivered", value: 92, color: "#22c55e" },
                  { label: isCn ? "重试" : "Retrying", value: 46, color: "#f59e0b" },
                  { label: isCn ? "排队" : "Queued", value: 28, color: "#8b5cf6" },
                  { label: isCn ? "失败" : "Failed", value: 9, color: "#f97316" },
                ]
              : [
                  { label: isCn ? "端点" : "Endpoints", value: 76, color: "#38bdf8" },
                  { label: isCn ? "日志" : "Logs", value: 58, color: "#8b5cf6" },
                  { label: isCn ? "鉴权" : "Auth", value: 43, color: "#22c55e" },
                  { label: isCn ? "环境" : "Environments", value: 31, color: "#f59e0b" },
                ],
        panelTitle: docsHeavy
          ? (isCn ? "开发者文档" : "Developer docs")
          : usageHeavy
            ? (isCn ? "计费与用量" : "Billing and usage")
            : webhookHeavy
              ? (isCn ? "事件订阅" : "Event subscriptions")
              : (isCn ? "关键服务" : "Critical services"),
        panelItems: docsHeavy
          ? [
              { title: "Quickstart", meta: isCn ? "3 分钟首个请求路径" : "3-minute first request path", status: isCn ? "热门" : "Popular" },
              { title: isCn ? "OAuth 指南" : "OAuth guide", meta: isCn ? "回调、scope、环境规则" : "Callbacks, scopes, env rules", status: isCn ? "核心" : "Core" },
              { title: isCn ? "SDK 示例" : "SDK examples", meta: isCn ? "Node / Python / Webhooks" : "Node / Python / webhooks", status: isCn ? "已更新" : "Updated" },
            ]
          : usageHeavy
            ? [
                { title: isCn ? "Generate API" : "Generate API", meta: isCn ? "本周 4.8M 请求" : "4.8M requests this week", status: isCn ? "高流量" : "High traffic" },
                { title: isCn ? "Preview runtime" : "Preview runtime", meta: isCn ? "配额命中保护中" : "Quota protected", status: isCn ? "稳定" : "Stable" },
                { title: isCn ? "Billing close" : "Billing close", meta: isCn ? "账单窗口已打开" : "Billing window open", status: isCn ? "进行中" : "Open" },
              ]
            : webhookHeavy
              ? [
                  { title: "project.preview.ready", meta: isCn ? "失败会进入 replay 队列" : "Failures enter replay queue", status: isCn ? "重试中" : "Retrying" },
                  { title: "billing.invoice.paid", meta: isCn ? "同步 Slack 与 CRM" : "Targets Slack and CRM", status: isCn ? "健康" : "Healthy" },
                  { title: "auth.token.revoked", meta: isCn ? "联动安全日志" : "Syncs security logs", status: isCn ? "实时" : "Live" },
                ]
              : [
                  { title: isCn ? "支付集群" : "Payments cluster", meta: isCn ? "99.97% SLA · 峰值稳定" : "99.97% SLA · stable peak traffic", status: isCn ? "健康" : "Healthy" },
                  { title: isCn ? "Webhook 投递轨" : "Webhook delivery rail", meta: "182ms median latency", status: isCn ? "监控中" : "Monitored" },
                  { title: isCn ? "Agent runtime API" : "Agent runtime API", meta: isCn ? "今日新增 4 个消费者" : "4 new consumers today", status: isCn ? "增长中" : "Growing" },
                ],
        railTitle: isCn ? "平台节奏" : "Platform rhythm",
        railItems: docsHeavy
          ? [
              isCn ? "Docs、SDK、Quickstart 和鉴权文档在一个开发者面板里" : "Docs, SDKs, quickstart, and auth live in one developer surface",
              isCn ? "接入漏斗和文档热度在首页直接可见" : "Onboarding funnel and doc heat stay visible on the first screen",
              isCn ? "不再只是平台卡片，而是开发者门户" : "This now reads like a developer portal, not generic platform cards",
            ]
          : usageHeavy
            ? [
                isCn ? "用量、配额、计费窗口和重度租户在同一控制面" : "Usage, quotas, billing windows, and heavy consumers stay in one control surface",
                isCn ? "配额告警和账单视图直接挂在 preview 首页" : "Quota alerts and billing views stay on the first preview screen",
                isCn ? "平台 monetization 不再藏进通用后台壳里" : "API monetization is no longer buried inside a generic admin shell",
              ]
            : webhookHeavy
              ? [
                isCn ? "Webhook、事件恢复和回调重试都在同一条投递轨上" : "Webhooks, recovery, and callback retries live on the same delivery rail",
                isCn ? "事件驱动流程比普通平台卡更靠前" : "Event delivery is now first-class, not hidden behind platform summary cards",
                isCn ? "异常事件会直接露出恢复节奏" : "Failed events surface the recovery rhythm directly",
              ]
            : [
                isCn ? "端点、日志、鉴权和环境推进形成真正的平台工作台" : "Endpoints, logs, auth, and environments form a real platform cockpit",
                isCn ? "不是把 API 产品塞进 CRM 或任务壳里" : "This is no longer an API product squeezed into a CRM or task shell",
                isCn ? "开发者平台的首页已经开始像 control plane" : "The developer platform homepage now reads like a control plane",
              ],
      }
    }

    if (isCommunityPreview) {
      const eventsHeavy = /event|webinar|invite|registration|活动|直播|邀请|报名/.test(promptText)
      const moderationHeavy = /moderation|roadmap|feedback|vote|社区治理|审核|反馈|路线图/.test(promptText)
      return {
        eyebrow: isCn ? "社区运营工作台" : "Community ops workspace",
        headline: eventsHeavy
          ? isCn ? "把活动节奏、成员邀约和反馈收集放进一个社区指挥台。" : "Bring event cadence, member invites, and feedback intake into one community command center."
          : moderationHeavy
            ? isCn ? "把反馈、路线图和审核队列做成社区控制面。" : "Turn feedback, roadmap, and moderation into a community control surface."
            : isCn ? "把成员运营、公告和社区节奏集中在一个首页里。" : "Pull member ops, announcements, and community rhythm into one homepage.",
        primaryCta: isCn ? "打开社区工作台" : "Open community workspace",
        secondaryCta: isCn ? "查看成员节奏" : "View member cadence",
        stats: eventsHeavy
          ? [
              { label: isCn ? "本月活动" : "Events this month", value: "12", tone: "#38bdf8" },
              { label: isCn ? "报名人数" : "Registrations", value: "486", tone: "#8b5cf6" },
              { label: isCn ? "大使邀约" : "Ambassador invites", value: "34", tone: "#22c55e" },
              { label: isCn ? "活动反馈" : "Event feedback", value: "89", tone: "#f59e0b" },
            ]
          : [
              { label: isCn ? "反馈项" : "Feedback items", value: "132", tone: "#38bdf8" },
              { label: isCn ? "路线图投票" : "Roadmap votes", value: "1.8k", tone: "#8b5cf6" },
              { label: isCn ? "待审核" : "Moderation queue", value: "17", tone: "#f59e0b" },
              { label: isCn ? "活跃成员" : "Active members", value: "842", tone: "#22c55e" },
            ],
        chartTitle: eventsHeavy ? (isCn ? "活动推进" : "Event cadence") : (isCn ? "社区反馈流" : "Community feedback flow"),
        chartBars: eventsHeavy
          ? [
              { label: isCn ? "筹备" : "Planning", value: 34, color: "#38bdf8" },
              { label: isCn ? "推广" : "Promotion", value: 57, color: "#8b5cf6" },
              { label: isCn ? "进行中" : "Live", value: 41, color: "#22c55e" },
              { label: isCn ? "复盘" : "Review", value: 28, color: "#f59e0b" },
            ]
          : [
              { label: isCn ? "反馈" : "Feedback", value: 61, color: "#38bdf8" },
              { label: isCn ? "审核" : "Moderation", value: 39, color: "#8b5cf6" },
              { label: isCn ? "路线图" : "Roadmap", value: 47, color: "#22c55e" },
              { label: isCn ? "公告" : "Announcements", value: 22, color: "#f59e0b" },
            ],
        panelTitle: eventsHeavy ? (isCn ? "活动与邀约" : "Events and invites") : (isCn ? "社区运营" : "Community ops"),
        panelItems: eventsHeavy
          ? [
              { title: isCn ? "AI Builder 研讨会" : "AI Builder webinar", meta: isCn ? "今天 19:30 · 126 人报名" : "Today 19:30 · 126 registered", status: isCn ? "即将开始" : "Upcoming" },
              { title: isCn ? "开发者圆桌" : "Developer roundtable", meta: isCn ? "大使邀约已发出 18 份" : "18 ambassador invites sent", status: isCn ? "推进中" : "Active" },
              { title: isCn ? "活动复盘" : "Event review", meta: isCn ? "收集 NPS 与亮点片段" : "Collecting NPS and highlight clips", status: isCn ? "复盘" : "Review" },
            ]
          : [
              { title: isCn ? "发布后反馈" : "Post-launch feedback", meta: isCn ? "58 条反馈等待分组" : "58 items awaiting triage", status: isCn ? "待处理" : "Queued" },
              { title: isCn ? "路线图投票" : "Roadmap voting", meta: isCn ? "最热视频主题进入前五" : "Top webinar theme entered top five", status: isCn ? "增长中" : "Trending" },
              { title: isCn ? "审核队列" : "Moderation queue", meta: isCn ? "17 条待复核" : "17 items pending review", status: isCn ? "审核中" : "Review" },
            ],
        railTitle: isCn ? "社区节奏" : "Community rhythm",
        railItems: [
          isCn ? "社区不是静态首页，而是活动、成员和反馈的运营系统" : "This is not a static site; it is an operating system for members, events, and feedback",
          isCn ? "不同社区 prompt 会把重心放到活动或审核上" : "Different community prompts now emphasize events or moderation differently",
          isCn ? "首页已经开始体现社区主工作流" : "The homepage now reflects the primary community workflow",
        ],
      }
    }

    if (isMarketingPreview) {
      const devicesHeavy = /devices|desktop|mobile|release distribution|installer|设备|桌面|移动端|分发/.test(promptText)
      const docsHeavy = /docs|guide|changelog|release notes|文档|指南|更新日志|发行说明/.test(promptText)
      return {
        eyebrow: isCn ? "下载与分发站点" : "Download and distribution site",
        headline: devicesHeavy
          ? isCn ? "把下载、设备分发和版本发布做成真正的产品官网首页。" : "Turn downloads, device distribution, and releases into a real product website."
          : docsHeavy
            ? isCn ? "把官网叙事、文档、更新日志和分发控制放进同一个内容站。" : "Bring website storytelling, docs, changelog, and distribution controls into one content site."
            : isCn ? "这不是后台壳，而是面向用户的官网与下载站。" : "This is a user-facing website and download hub, not an admin shell.",
        primaryCta: isCn ? "打开下载页" : "Open downloads",
        secondaryCta: isCn ? "查看最新发布" : "View latest release",
        stats: devicesHeavy
          ? [
              { label: isCn ? "下载量" : "Downloads", value: "48k", tone: "#38bdf8" },
              { label: isCn ? "设备包" : "Device builds", value: "9", tone: "#8b5cf6" },
              { label: isCn ? "发布通道" : "Release channels", value: "4", tone: "#22c55e" },
              { label: isCn ? "安装转化" : "Install conversion", value: "17%", tone: "#f59e0b" },
            ]
          : [
              { label: isCn ? "文档页" : "Docs pages", value: "32", tone: "#38bdf8" },
              { label: isCn ? "更新日志" : "Changelog entries", value: "18", tone: "#8b5cf6" },
              { label: isCn ? "下载渠道" : "Download channels", value: "5", tone: "#22c55e" },
              { label: isCn ? "升级率" : "Upgrade CTR", value: "11%", tone: "#f59e0b" },
            ],
        chartTitle: devicesHeavy ? (isCn ? "设备分发" : "Device distribution") : (isCn ? "官网内容节奏" : "Website content rhythm"),
        chartBars: devicesHeavy
          ? [
              { label: "macOS", value: 72, color: "#38bdf8" },
              { label: "Windows", value: 68, color: "#8b5cf6" },
              { label: "Android", value: 41, color: "#22c55e" },
              { label: "iOS", value: 29, color: "#f59e0b" },
            ]
          : [
              { label: isCn ? "官网" : "Website", value: 54, color: "#38bdf8" },
              { label: isCn ? "文档" : "Docs", value: 61, color: "#8b5cf6" },
              { label: isCn ? "更新日志" : "Changelog", value: 37, color: "#22c55e" },
              { label: isCn ? "下载" : "Downloads", value: 46, color: "#f59e0b" },
            ],
        panelTitle: devicesHeavy ? (isCn ? "版本分发" : "Release distribution") : (isCn ? "内容与转化" : "Content and conversion"),
        panelItems: devicesHeavy
          ? [
              { title: isCn ? "桌面稳定版" : "Desktop stable", meta: isCn ? "macOS / Windows 同步发布" : "macOS / Windows released together", status: isCn ? "已上线" : "Live" },
              { title: isCn ? "Android Beta" : "Android beta", meta: isCn ? "等待 QA 完成签名验证" : "Waiting on signed QA pass", status: isCn ? "测试中" : "Beta" },
              { title: isCn ? "iOS TestFlight" : "iOS TestFlight", meta: isCn ? "安装引导已同步官网" : "Install instructions synced to site", status: isCn ? "分发中" : "Rolling out" },
            ]
          : [
              { title: isCn ? "Launch story" : "Launch story", meta: isCn ? "首页叙事与产品优势" : "Hero story and product advantages", status: isCn ? "发布中" : "Live" },
              { title: isCn ? "Release notes" : "Release notes", meta: isCn ? "版本更新摘要和迁移提示" : "Release summary and migration tips", status: isCn ? "已更新" : "Updated" },
              { title: isCn ? "Download CTA" : "Download CTA", meta: isCn ? "导向各设备安装包和说明" : "Routes users to device installers", status: isCn ? "转化中" : "Converting" },
            ],
        railTitle: isCn ? "站点节奏" : "Site rhythm",
        railItems: [
          isCn ? "官网、下载、文档和分发控制已经收口到一套内容站逻辑里" : "Website, downloads, docs, and distribution controls now live in one content-site logic",
          isCn ? "带 admin controls 的下载站不会再误吸成后台工具" : "Download websites with admin controls no longer collapse into admin tools",
          isCn ? "这条首页已经开始像真正的官网和下载站" : "This homepage now reads like a real website and download hub",
        ],
      }
    }

    const securityHeavy = /security|access|permission|role|policy|权限|角色|安全|策略/.test(promptText)
    const incidentHeavy = /incident|alert|outage|recovery|告警|故障|恢复|异常/.test(promptText)
    return {
      eyebrow: isCn ? "内部控制平面" : "Internal control plane",
      headline: securityHeavy
        ? isCn ? "把审批、权限、访问边界和审计留痕放进一个内部控制平面。" : "Bring approvals, permissions, access boundaries, and audit trails into one internal control plane."
        : incidentHeavy
          ? isCn ? "把异常响应、审计轨迹和团队协同做成运维控制台。" : "Turn incident response, audit trails, and team coordination into an operations control plane."
          : isCn ? "把审批、团队、自动化和审计收进真正的后台工作台。" : "Pull approvals, team operations, automations, and audits into a real backoffice workspace.",
      primaryCta: isCn ? "打开控制平面" : "Open control plane",
      secondaryCta: isCn ? "查看审批队列" : "View approval queue",
      stats: securityHeavy
        ? [
            { label: isCn ? "待审策略" : "Policies pending", value: "7", tone: "#8b5cf6" },
            { label: isCn ? "高权限角色" : "Privileged roles", value: "14", tone: "#38bdf8" },
            { label: isCn ? "审计留痕" : "Audit events", value: "128", tone: "#22c55e" },
            { label: isCn ? "异常访问" : "Access alerts", value: "3", tone: "#f59e0b" },
          ]
        : incidentHeavy
          ? [
              { label: isCn ? "活跃告警" : "Active incidents", value: "4", tone: "#f97316" },
              { label: isCn ? "恢复中" : "Recovering", value: "2", tone: "#38bdf8" },
              { label: isCn ? "审计记录" : "Audit entries", value: "92", tone: "#8b5cf6" },
              { label: isCn ? "自动化规则" : "Ops automations", value: "11", tone: "#22c55e" },
            ]
          : [
              { label: isCn ? "审批队列" : "Approval queue", value: "18", tone: "#8b5cf6" },
              { label: isCn ? "团队席位" : "Seats in scope", value: "42", tone: "#38bdf8" },
              { label: isCn ? "自动化规则" : "Automation rules", value: "11", tone: "#22c55e" },
              { label: isCn ? "审计事件" : "Audit events", value: "92", tone: "#f59e0b" },
            ],
      chartTitle: securityHeavy ? (isCn ? "权限与审计轨迹" : "Access and audit trail") : incidentHeavy ? (isCn ? "异常响应节奏" : "Incident response rhythm") : (isCn ? "审批与运维节奏" : "Approvals and operations rhythm"),
      chartBars: securityHeavy
        ? [
            { label: isCn ? "策略" : "Policies", value: 48, color: "#8b5cf6" },
            { label: isCn ? "角色" : "Roles", value: 34, color: "#38bdf8" },
            { label: isCn ? "审计" : "Audit", value: 61, color: "#22c55e" },
            { label: isCn ? "告警" : "Alerts", value: 19, color: "#f59e0b" },
          ]
        : incidentHeavy
          ? [
              { label: isCn ? "排查" : "Triage", value: 39, color: "#f97316" },
              { label: isCn ? "恢复" : "Recovery", value: 28, color: "#38bdf8" },
              { label: isCn ? "复盘" : "Review", value: 17, color: "#8b5cf6" },
              { label: isCn ? "自动化" : "Automation", value: 33, color: "#22c55e" },
            ]
          : [
              { label: isCn ? "审批" : "Approvals", value: 52, color: "#8b5cf6" },
              { label: isCn ? "团队" : "Team", value: 37, color: "#38bdf8" },
              { label: isCn ? "审计" : "Audit", value: 49, color: "#22c55e" },
              { label: isCn ? "自动化" : "Automation", value: 26, color: "#f59e0b" },
            ],
      panelTitle: securityHeavy ? (isCn ? "访问与策略" : "Access and policy") : incidentHeavy ? (isCn ? "异常响应" : "Incident response") : (isCn ? "后台运营" : "Backoffice ops"),
      panelItems: securityHeavy
        ? [
            { title: isCn ? "管理员角色调整" : "Admin role change", meta: isCn ? "待策略审批" : "Awaiting policy approval", status: isCn ? "审批中" : "Review" },
            { title: isCn ? "外部协作者权限" : "External collaborator access", meta: isCn ? "边界收紧待同步" : "Boundary tightening pending", status: isCn ? "变更中" : "Updating" },
            { title: isCn ? "审计导出" : "Audit export", meta: isCn ? "准备交付合规复核" : "Preparing compliance handoff", status: isCn ? "已排队" : "Queued" },
          ]
        : incidentHeavy
          ? [
              { title: isCn ? "预览故障告警" : "Preview incident", meta: isCn ? "已进入恢复轨道" : "Recovery workflow started", status: isCn ? "处理中" : "Open" },
              { title: isCn ? "支付回调异常" : "Webhook failure", meta: isCn ? "自动重试已接管" : "Retry automation took over", status: isCn ? "恢复中" : "Recovering" },
              { title: isCn ? "复盘归档" : "Postmortem archive", meta: isCn ? "等待主管签收" : "Waiting on ops sign-off", status: isCn ? "复盘" : "Review" },
            ]
          : [
              { title: isCn ? "报价审批" : "Quote approvals", meta: isCn ? "今天 8 笔待签批" : "8 requests waiting today", status: isCn ? "排队中" : "Queued" },
              { title: isCn ? "团队席位同步" : "Seat sync", meta: isCn ? "新增成员待分组" : "New members awaiting grouping", status: isCn ? "进行中" : "Active" },
              { title: isCn ? "自动化规则" : "Automation rules", meta: isCn ? "审批后触发审计留痕" : "Approvals trigger audit trails", status: isCn ? "已启用" : "Enabled" },
            ],
      railTitle: isCn ? "控制平面节奏" : "Control-plane rhythm",
      railItems: [
        isCn ? "这已经不再是 CRM 或任务板换皮，而是审批 / 权限 / 审计 / 异常响应的后台工作台" : "This is no longer a CRM or task board reskin; it is a real approvals / access / audit / incident workspace",
        isCn ? "不同后台 prompt 会把重心落到安全或异常响应上" : "Different backoffice prompts now shift emphasis between security and incident response",
        isCn ? "首页已经体现后台控制平面的主工作流" : "The homepage now reflects the core backoffice control-plane workflow",
      ],
    }
  }, [isCn, presentation.displayName, spec])

  const dashboardChartVariant = useMemo<"bar" | "line" | "donut" | "progress">(() => {
    const promptText = String((spec as { prompt?: string } | null)?.prompt ?? presentation.displayName ?? "").toLowerCase()

    if (isApiPreview) {
      if (/docs|sdk|guide|onboarding|文档|sdk|接入/.test(promptText)) return "line"
      if (/usage|billing|meter|quota|rate limit|用量|计费|配额/.test(promptText)) return "donut"
      if (/webhook|callback|delivery|event|retry|webhook|回调|投递|事件/.test(promptText)) return "progress"
      return "bar"
    }

    if (isCrmPreview) {
      if (/renewal|onboarding|customer success|续约|交付|上线/.test(promptText)) return "line"
      if (/quote|approval|order|contract|报价|审批|订单|合同/.test(promptText)) return "bar"
      return "progress"
    }

    if (isMarketingPreview) {
      if (/devices|desktop|mobile|release distribution|installer|设备|桌面|移动端|分发/.test(promptText)) return "bar"
      if (/docs|guide|changelog|release notes|文档|指南|更新日志|发行说明/.test(promptText)) return "line"
      return "donut"
    }

    if (isCommunityPreview) {
      if (/event|webinar|invite|registration|活动|直播|邀请|报名/.test(promptText)) return "line"
      return "donut"
    }

    if (isSpecializedOpsPreview) {
      if (/incident|alert|outage|recovery|告警|故障|恢复|异常/.test(promptText)) return "line"
      if (/security|access|permission|role|policy|权限|角色|安全|策略/.test(promptText)) return "progress"
      return "bar"
    }

    return "progress"
  }, [isApiPreview, isCommunityPreview, isCrmPreview, isMarketingPreview, isSpecializedOpsPreview, presentation.displayName, spec])

  const tactileClassName =
    "cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:brightness-[1.03] hover:shadow-[0_18px_44px_rgba(15,23,42,0.16)] active:translate-y-[1px] active:scale-[0.99]"
  const routeKeySet = useMemo(() => new Set(routes.map((route) => route.replace(/^\//, ""))), [routes])
  const previewHrefFor = (routeKey: string) =>
    routeKey === "dashboard" ? `/preview/${encodeURIComponent(projectKey)}` : `/preview/${encodeURIComponent(projectKey)}/${encodeURIComponent(routeKey)}`
  const resolvePreviewRoute = (...candidates: string[]) => {
    for (const candidate of candidates) {
      if (routeKeySet.has(candidate)) return candidate
    }
    return routeKeySet.has("dashboard") ? "dashboard" : activePage || "dashboard"
  }
  const dashboardTargets = useMemo(() => {
    if (isCrmPreview) {
      return {
        stats: ["pipeline", "reports", "leads", "orders"],
        panels: ["orders", "customers", "leads"],
        rails: ["pipeline", "automations", "reports"],
      }
    }
    if (isApiPreview) {
      return {
        stats: ["endpoints", "usage", "webhooks", "docs"],
        panels: ["docs", "webhooks", "endpoints"],
        rails: ["endpoints", "docs", "webhooks"],
      }
    }
    if (isCommunityPreview) {
      return {
        stats: ["members", "feedback", "moderation", "events"],
        panels: ["events", "feedback", "moderation"],
        rails: ["events", "feedback", "members"],
      }
    }
    if (isMarketingPreview) {
      return {
        stats: ["downloads", "devices", "admin", "docs"],
        panels: ["downloads", "admin", "docs"],
        rails: ["downloads", "docs", "admin"],
      }
    }
    return {
      stats: ["approvals", "audit", "security", "incidents"],
      panels: ["approvals", "security", "incidents"],
      rails: ["approvals", "audit", "incidents"],
    }
  }, [isApiPreview, isCommunityPreview, isCrmPreview, isMarketingPreview])

  const routeExperienceModel = useMemo(() => {
    const routeKey = activePage || "dashboard"
    const routePrototype = activeRoutePrototype ?? "dashboard"
    if (routeKey === "dashboard" || routeKey === "editor" || routeKey === "runs" || routeKey === "templates" || routeKey === "pricing") {
      return null
    }

    const darkShell = !isCommunityPreview && !isMarketingPreview && !isHealthcarePreview && !isEducationPreview
    const isControlPlaneRoute = previewKind === "admin_ops" || routePrototype === "admin_queue" || routeKey === "approvals" || routeKey === "security" || routeKey === "audit" || routeKey === "incidents"

    if (isCrmPreview) {
      if (routeKey === "leads") {
        return {
          darkShell,
          eyebrow: isCn ? "线索台" : "Lead desk",
          headline: isCn ? "把新线索、跟进节奏和负责人分发放进同一条漏斗。" : "Keep new leads, follow-up cadence, and ownership in one funnel.",
          metrics: [
            { label: isCn ? "新增线索" : "New leads", value: "24", tone: "#38bdf8" },
            { label: isCn ? "待分配" : "Awaiting owner", value: "5", tone: "#8b5cf6" },
            { label: isCn ? "高意向" : "High intent", value: "9", tone: "#22c55e" },
          ],
          lanes: [
            { title: isCn ? "官网表单" : "Website intake", meta: isCn ? "7 条等待初筛" : "7 awaiting triage", status: isCn ? "新线索" : "New" },
            { title: isCn ? "合作伙伴引荐" : "Partner referrals", meta: isCn ? "4 条需分配 AE" : "4 need AE assignment", status: isCn ? "待分配" : "Assign" },
            { title: isCn ? "演示申请" : "Demo requests", meta: isCn ? "3 条进入高优先级" : "3 promoted to high priority", status: isCn ? "升温中" : "Heating" },
          ],
          bars: [
            { label: isCn ? "表单" : "Forms", value: 62, color: "#38bdf8" },
            { label: isCn ? "引荐" : "Referrals", value: 34, color: "#8b5cf6" },
            { label: isCn ? "活动" : "Events", value: 29, color: "#22c55e" },
          ],
        }
      }
      if (routeKey === "pipeline") {
        return {
          darkShell,
          eyebrow: isCn ? "销售阶段板" : "Pipeline board",
          headline: isCn ? "阶段推进、审批和成交在同一条 revenue rail 上完成。" : "Move stage progression, approvals, and close rhythm through one revenue rail.",
          metrics: [
            { label: isCn ? "发现" : "Discovery", value: "12", tone: "#38bdf8" },
            { label: isCn ? "方案" : "Proposal", value: "8", tone: "#8b5cf6" },
            { label: isCn ? "谈判" : "Negotiation", value: "5", tone: "#f59e0b" },
          ],
          lanes: [
            { title: isCn ? "华星续约" : "Huaxing renewal", meta: isCn ? "预算锁定，等法务确认" : "Budget locked, waiting legal", status: isCn ? "方案中" : "Proposal" },
            { title: isCn ? "Northstar 扩张" : "Northstar expansion", meta: isCn ? "进入高层评审" : "Entered exec review", status: isCn ? "谈判中" : "Negotiation" },
            { title: isCn ? "景曜 AI" : "Jingyao AI", meta: isCn ? "演示完成，待报价" : "Demo done, quote next", status: isCn ? "发现" : "Discovery" },
          ],
          bars: [
            { label: isCn ? "发现" : "Discovery", value: 26, color: "#38bdf8" },
            { label: isCn ? "方案" : "Proposal", value: 48, color: "#8b5cf6" },
            { label: isCn ? "成交" : "Won", value: 31, color: "#22c55e" },
          ],
        }
      }
      if (routeKey === "orders" || routeKey === "reports" || routeKey === "customers" || routeKey === "automations") {
        return {
          darkShell,
          eyebrow: routeKey === "orders" ? (isCn ? "订单执行" : "Order execution") : routeKey === "reports" ? (isCn ? "收入汇报" : "Revenue reporting") : routeKey === "customers" ? (isCn ? "客户工作台" : "Accounts workspace") : (isCn ? "自动化规则" : "Automation rules"),
          headline:
            routeKey === "orders"
              ? isCn ? "成交后执行、交付和续费触发保持可见。" : "Keep post-close execution, handoff, and renewal triggers visible."
              : routeKey === "reports"
                ? isCn ? "把预测、目标和回款节奏做成收入视图。" : "Turn forecast, quota, and collection cadence into a revenue view."
                : routeKey === "customers"
                  ? isCn ? "用客户健康度、席位和扩张机会驱动后续动作。" : "Drive next steps from account health, seats, and expansion plays."
                  : isCn ? "让销售节奏和交付提醒通过规则持续推进。" : "Keep sales cadence and handoff nudges moving through rules.",
          metrics: [
            { label: isCn ? "处理中" : "Active", value: routeKey === "reports" ? "6" : "14", tone: "#38bdf8" },
            { label: isCn ? "本周" : "This week", value: routeKey === "customers" ? "11" : "$84k", tone: "#8b5cf6" },
            { label: isCn ? "风险" : "Risk watch", value: routeKey === "automations" ? "3" : "2", tone: "#f59e0b" },
          ],
          lanes: [
            { title: isCn ? "重点动作" : "Priority action", meta: isCn ? "把该页变成真实操作平面" : "Turn this page into an operating surface", status: titleCase(routeKey) },
            { title: isCn ? "负责人节奏" : "Owner rhythm", meta: isCn ? "聚焦负责人、状态和推进" : "Focus on owners, status, and movement", status: isCn ? "运行中" : "Active" },
          ],
          bars: [
            { label: isCn ? "推进" : "Progress", value: 58, color: "#38bdf8" },
            { label: isCn ? "审批" : "Approvals", value: 43, color: "#8b5cf6" },
            { label: isCn ? "完成" : "Done", value: 29, color: "#22c55e" },
          ],
        }
      }
    }

    if (isApiPreview) {
      return {
        darkShell,
        eyebrow:
          routeKey === "docs" || routePrototype === "docs" ? (isCn ? "开发者文档" : "Developer docs")
          : routeKey === "webhooks" ? (isCn ? "事件投递" : "Event delivery")
          : routeKey === "logs" || routePrototype === "timeline" ? (isCn ? "运行日志" : "Runtime logs")
          : routeKey === "auth" || routePrototype === "settings" ? (isCn ? "鉴权与密钥" : "Auth and keys")
          : routeKey === "environments" || routePrototype === "workflow" ? (isCn ? "环境发布" : "Environment promotion")
          : routeKey === "endpoints" ? (isCn ? "接口目录" : "Endpoint catalog")
          : routeKey === "usage" ? (isCn ? "用量计费" : "Usage and billing")
          : (isCn ? "平台工作台" : "Platform workspace"),
        headline:
          routeKey === "docs" || routePrototype === "docs"
            ? isCn ? "把接入指南、SDK 和鉴权说明做成真正的开发者门户。" : "Turn onboarding, SDK, and auth guides into a real developer portal."
            : routeKey === "webhooks"
              ? isCn ? "事件、重试和恢复节奏收口到一条 delivery rail。" : "Bring events, retries, and recovery into one delivery rail."
              : routeKey === "logs"
                ? isCn ? "让日志、trace 和恢复动作像平台运维台一样可追踪。" : "Make logs, traces, and recovery actions behave like a platform ops desk."
                : routeKey === "auth"
                  ? isCn ? "把 scopes、密钥轮换和访问策略做成真正的安全面。" : "Turn scopes, key rotation, and access policy into a real security surface."
                  : routeKey === "environments"
                    ? isCn ? "把环境推广、回滚和版本边界收进一条发布轨道。" : "Bring promotion, rollback, and version boundaries into one release rail."
              : routeKey === "endpoints"
                ? isCn ? "让端点、版本和环境切换成为真正的平台首页。" : "Make endpoints, versions, and promotions the first-class platform surface."
                : isCn ? "让 API 的运行、用量和平台动作保持可见。" : "Keep runtime, usage, and platform actions visible.",
        metrics: [
          { label: isCn ? "活跃对象" : "Active objects", value: routeKey === "docs" ? "27" : "64", tone: "#38bdf8" },
          { label: isCn ? "健康度" : "Health", value: routeKey === "webhooks" ? "96%" : "99.9%", tone: "#22c55e" },
          { label: isCn ? "告警" : "Alerts", value: routeKey === "usage" ? "5" : "3", tone: "#f59e0b" },
        ],
        lanes: [
          { title: routeKey === "docs" ? "Quickstart" : routeKey === "webhooks" ? "project.preview.ready" : isCn ? "Generate API" : "Generate API", meta: isCn ? "正在承接真实对象和操作流" : "Now carries real objects and action flows", status: titleCase(routeKey) },
          { title: isCn ? "平台节奏" : "Platform rhythm", meta: isCn ? "不是模板卡片，而是控制平面" : "This is no longer generic cards; it is a control plane", status: isCn ? "稳定" : "Stable" },
        ],
        bars: [
          { label: isCn ? "请求" : "Requests", value: 76, color: "#38bdf8" },
          { label: isCn ? "文档" : "Docs", value: routeKey === "docs" ? 68 : 34, color: "#8b5cf6" },
          { label: isCn ? "事件" : "Events", value: routeKey === "webhooks" ? 58 : 26, color: "#22c55e" },
        ],
      }
    }

    if (isMarketingPreview) {
      return {
        darkShell: false,
        eyebrow:
          routeKey === "downloads" || routeKey === "devices" ? (isCn ? "下载分发" : "Download distribution")
          : routeKey === "docs" || routeKey === "changelog" ? (isCn ? "文档内容" : "Docs and changelog")
          : routeKey === "admin" ? (isCn ? "分发后台" : "Distribution admin")
          : (isCn ? "官网转化" : "Website conversion"),
        headline:
          routeKey === "downloads" || routeKey === "devices"
            ? isCn ? "把设备包、下载渠道和发布状态做成真正的下载站。" : "Turn device builds, channels, and release states into a real download hub."
            : routeKey === "docs" || routeKey === "changelog"
              ? isCn ? "把文档、更新日志和版本说明变成真实内容面。" : "Turn docs, changelog, and release notes into a real content surface."
              : routeKey === "admin"
                ? isCn ? "用轻量后台承接分发、版本和可见性管理。" : "Use a light admin surface for distribution, releases, and visibility."
                : isCn ? "让官网、转化和设备分发保持同一视觉系统。" : "Keep website, conversion, and device distribution in one visual system.",
        metrics: [
          { label: isCn ? "下载量" : "Downloads", value: "48k", tone: "#38bdf8" },
          { label: isCn ? "设备包" : "Builds", value: "9", tone: "#8b5cf6" },
          { label: isCn ? "转化率" : "CTR", value: "17%", tone: "#22c55e" },
        ],
        lanes: [
          { title: isCn ? "桌面稳定版" : "Desktop stable", meta: isCn ? "macOS / Windows 同步发布" : "macOS / Windows shipping together", status: isCn ? "Live" : "Live" },
          { title: isCn ? "移动端分发" : "Mobile rollout", meta: isCn ? "Android / iOS 安装说明联动" : "Android / iOS install guidance synced", status: isCn ? "Rolling" : "Rolling" },
        ],
        bars: [
          { label: "macOS", value: 72, color: "#38bdf8" },
          { label: "Windows", value: 68, color: "#8b5cf6" },
          { label: isCn ? "移动端" : "Mobile", value: 41, color: "#22c55e" },
        ],
      }
    }

    if (isCommunityPreview) {
      return {
        darkShell: false,
        eyebrow:
          routeKey === "feedback" ? (isCn ? "反馈工作台" : "Feedback workspace")
          : routeKey === "members" ? (isCn ? "成员运营" : "Member ops")
          : routeKey === "roadmap" ? (isCn ? "路线图" : "Roadmap")
          : routeKey === "events" ? (isCn ? "活动节奏" : "Event cadence")
          : (isCn ? "社区治理" : "Community moderation"),
        headline:
          routeKey === "events"
            ? isCn ? "活动、邀约和反馈一起驱动社区节奏。" : "Events, invites, and feedback drive the community rhythm together."
            : isCn ? "把成员、反馈和治理面板做成真实运营台。" : "Turn members, feedback, and governance into a real operating surface.",
        metrics: [
          { label: isCn ? "成员" : "Members", value: "842", tone: "#38bdf8" },
          { label: isCn ? "反馈" : "Feedback", value: "132", tone: "#8b5cf6" },
          { label: isCn ? "审核" : "Moderation", value: "17", tone: "#f59e0b" },
        ],
        lanes: [
          { title: isCn ? "本周重点" : "This week", meta: isCn ? "活动和反馈同时推进" : "Events and feedback move together", status: titleCase(routeKey) },
          { title: isCn ? "社区节奏" : "Community rhythm", meta: isCn ? "不再是静态卡片壳" : "No longer a static card shell", status: isCn ? "活跃" : "Active" },
        ],
        bars: [
          { label: isCn ? "活动" : "Events", value: 57, color: "#f97316" },
          { label: isCn ? "反馈" : "Feedback", value: 49, color: "#8b5cf6" },
          { label: isCn ? "成员" : "Members", value: 63, color: "#22c55e" },
        ],
      }
    }

    if (isSpecializedOpsPreview) {
      const specializedCopy =
        isHealthcarePreview
          ? {
              eyebrow: isCn ? "护理运营台" : "Clinic care desk",
              headline: isCn ? "把患者、预约、护理计划和风险提醒放进一个温和清晰的护理工作流。" : "Coordinate patients, appointments, care plans, and risk alerts in one calm clinical workflow.",
              metrics: [
                { label: isCn ? "待随访患者" : "Follow-ups", value: "18", tone: "#0f766e" },
                { label: isCn ? "今日预约" : "Today appointments", value: "12", tone: "#2563eb" },
                { label: isCn ? "风险提醒" : "Risk alerts", value: "4", tone: "#f97316" },
              ],
              lanes: [
                { title: isCn ? "慢病随访" : "Chronic care follow-up", meta: isCn ? "护士确认护理计划与下次复诊" : "Nurse reviews care plan and next visit", status: isCn ? "待处理" : "Queued" },
                { title: isCn ? "上午门诊" : "Morning clinic", meta: isCn ? "预约、医生和风险标签同屏" : "Appointments, doctor, and risk tags together", status: isCn ? "进行中" : "In care" },
              ],
              bars: [
                { label: isCn ? "预约" : "Appointments", value: 72, color: "#2563eb" },
                { label: isCn ? "护理计划" : "Care plans", value: 58, color: "#0f766e" },
                { label: isCn ? "风险" : "Risk", value: 28, color: "#f97316" },
              ],
            }
          : isRecruitingPreview
            ? {
                eyebrow: isCn ? "招聘流水线" : "Talent pipeline",
                headline: isCn ? "候选人、岗位、面试和 offer 审批沿同一条 hiring rail 推进。" : "Move candidates, roles, interviews, and offer approvals through one hiring rail.",
                metrics: [
                  { label: isCn ? "候选人" : "Candidates", value: "42", tone: "#14b8a6" },
                  { label: isCn ? "本周面试" : "Interviews", value: "16", tone: "#8b5cf6" },
                  { label: isCn ? "待审批 Offer" : "Offers pending", value: "5", tone: "#f59e0b" },
                ],
                lanes: [
                  { title: isCn ? "产品负责人" : "Product Lead", meta: isCn ? "终面完成，等待薪资审批" : "Final interview done, comp approval next", status: isCn ? "Offer" : "Offer" },
                  { title: isCn ? "全栈工程师" : "Full-stack Engineer", meta: isCn ? "技术面试排期中" : "Technical interview scheduling", status: isCn ? "面试" : "Interview" },
                ],
                bars: [
                  { label: isCn ? "筛选" : "Screen", value: 66, color: "#14b8a6" },
                  { label: isCn ? "面试" : "Interview", value: 48, color: "#8b5cf6" },
                  { label: "Offer", value: 31, color: "#f59e0b" },
                ],
              }
            : isSupportPreview
              ? {
                  eyebrow: isCn ? "客服解决台" : "Support resolution desk",
                  headline: isCn ? "工单、SLA、客户案例和知识库更新在同一个解决闭环里运行。" : "Run tickets, SLAs, customer cases, and knowledge updates in one resolution loop.",
                  metrics: [
                    { label: isCn ? "开放工单" : "Open tickets", value: "31", tone: "#38bdf8" },
                    { label: isCn ? "SLA 风险" : "SLA risk", value: "6", tone: "#f97316" },
                    { label: isCn ? "知识库命中" : "KB matches", value: "84%", tone: "#22c55e" },
                  ],
                  lanes: [
                    { title: isCn ? "企业客户升级" : "Enterprise escalation", meta: isCn ? "SLA 剩余 42 分钟，需二线介入" : "42m SLA left, needs tier-2 help", status: isCn ? "升级" : "Escalate" },
                    { title: isCn ? "知识库缺口" : "Knowledge gap", meta: isCn ? "解决后自动生成文章草稿" : "Draft article after resolution", status: isCn ? "待写入" : "Draft" },
                  ],
                  bars: [
                    { label: "SLA", value: 76, color: "#f97316" },
                    { label: isCn ? "解决" : "Resolved", value: 62, color: "#22c55e" },
                    { label: isCn ? "知识库" : "Knowledge", value: 54, color: "#38bdf8" },
                  ],
                }
              : isCommerceOpsPreview
                ? {
                    eyebrow: isCn ? "库存履约台" : "Inventory command",
                    headline: isCn ? "SKU、库存、履约订单和补货提醒组成真正的供应链操作面。" : "Turn SKUs, inventory, fulfillment orders, and reorder alerts into a real supply-chain surface.",
                    metrics: [
                      { label: isCn ? "低库存 SKU" : "Low-stock SKUs", value: "14", tone: "#f97316" },
                      { label: isCn ? "履约订单" : "Fulfillment orders", value: "128", tone: "#38bdf8" },
                      { label: isCn ? "补货提醒" : "Reorder alerts", value: "9", tone: "#22c55e" },
                    ],
                    lanes: [
                      { title: isCn ? "华东仓补货" : "East warehouse refill", meta: isCn ? "三款 SKU 低于安全库存" : "Three SKUs below safety stock", status: isCn ? "补货" : "Reorder" },
                      { title: isCn ? "跨境履约异常" : "Cross-border exception", meta: isCn ? "等待供应商确认交付窗口" : "Supplier delivery window pending", status: isCn ? "异常" : "Exception" },
                    ],
                    bars: [
                      { label: "SKU", value: 69, color: "#38bdf8" },
                      { label: isCn ? "库存" : "Inventory", value: 52, color: "#22c55e" },
                      { label: isCn ? "异常" : "Exceptions", value: 24, color: "#f97316" },
                    ],
                  }
                : isFinancePreview
                  ? {
                      eyebrow: isCn ? "财务对账台" : "Finance reconciliation desk",
                      headline: isCn ? "账户、交易、对账和风控提示以审计友好的方式推进。" : "Move accounts, transactions, reconciliation, and risk flags with audit-friendly structure.",
                      metrics: [
                        { label: isCn ? "待对账" : "Pending match", value: "37", tone: "#38bdf8" },
                        { label: isCn ? "异常交易" : "Exceptions", value: "8", tone: "#f97316" },
                        { label: isCn ? "已匹配" : "Matched", value: "92%", tone: "#22c55e" },
                      ],
                      lanes: [
                        { title: isCn ? "银行流水匹配" : "Bank feed matching", meta: isCn ? "需人工确认两笔差额" : "Two variance items need review", status: isCn ? "复核" : "Review" },
                        { title: isCn ? "月末关账" : "Month-end close", meta: isCn ? "对账、凭证和审计留痕同步" : "Reconcile, post, and audit together", status: isCn ? "关账" : "Close" },
                      ],
                      bars: [
                        { label: isCn ? "匹配" : "Matched", value: 78, color: "#22c55e" },
                        { label: isCn ? "复核" : "Review", value: 36, color: "#38bdf8" },
                        { label: isCn ? "异常" : "Exceptions", value: 18, color: "#f97316" },
                      ],
                    }
                  : {
                      eyebrow: isCn ? "学习运营台" : "Learning operations",
                      headline: isCn ? "课程、学生、作业和班级反馈形成清晰的教学闭环。" : "Connect courses, students, assignments, and class feedback into one learning loop.",
                      metrics: [
                        { label: isCn ? "活跃课程" : "Active courses", value: "12", tone: "#2563eb" },
                        { label: isCn ? "待批作业" : "Assignments", value: "46", tone: "#8b5cf6" },
                        { label: isCn ? "风险学生" : "At-risk students", value: "7", tone: "#f97316" },
                      ],
                      lanes: [
                        { title: isCn ? "项目制课程" : "Project course", meta: isCn ? "作业、反馈和下一讲联动" : "Assignments, feedback, and next lesson synced", status: isCn ? "进行中" : "Active" },
                        { title: isCn ? "学习风险提醒" : "Learning risk alert", meta: isCn ? "三名学生需要跟进" : "Three students need follow-up", status: isCn ? "跟进" : "Follow-up" },
                      ],
                      bars: [
                        { label: isCn ? "课程" : "Courses", value: 64, color: "#2563eb" },
                        { label: isCn ? "作业" : "Assignments", value: 58, color: "#8b5cf6" },
                        { label: isCn ? "反馈" : "Feedback", value: 42, color: "#22c55e" },
                      ],
                    }

      return {
        darkShell,
        ...specializedCopy,
      }
    }

    return {
      darkShell: true,
      eyebrow:
        routeKey === "approvals" ? (isCn ? "审批队列" : "Approval queue")
        : routeKey === "security" ? (isCn ? "访问策略" : "Access policy")
        : routeKey === "audit" ? (isCn ? "审计轨迹" : "Audit trail")
        : routeKey === "incidents" ? (isCn ? "异常响应" : "Incident response")
        : routeKey === "team" ? (isCn ? "团队席位" : "Team seats")
        : (isCn ? "后台工作台" : "Backoffice workspace"),
      headline:
        routeKey === "security"
          ? isCn ? "把权限、角色和访问边界放进真正的控制平面。" : "Bring roles, permissions, and access boundaries into a real control plane."
          : routeKey === "incidents"
            ? isCn ? "异常、恢复和复盘在同一条响应轨道里推进。" : "Move incidents, recovery, and postmortems through one response rail."
            : isControlPlaneRoute
              ? isCn ? "让审批、审计、访问策略和响应动作成为一个真正可操作的控制平面。" : "Turn approvals, audit, access policy, and response actions into one practical control plane."
              : isCn ? "让后台动作、审批和审计保持在同一工作台里。" : "Keep approvals, audit, and backoffice actions in one workspace.",
      metrics: [
        { label: isCn ? "待处理" : "Queued", value: isControlPlaneRoute ? "26" : "18", tone: "#8b5cf6" },
        { label: isCn ? "审计事件" : "Audit events", value: isControlPlaneRoute ? "128" : "92", tone: "#38bdf8" },
        { label: isCn ? "规则" : "Rules", value: isControlPlaneRoute ? "17" : "11", tone: "#22c55e" },
      ],
      lanes: [
        {
          title: isControlPlaneRoute ? (isCn ? "高风险访问审查" : "High-risk access review") : (isCn ? "关键动作" : "Priority action"),
          meta: isControlPlaneRoute
            ? isCn ? "审批、策略和恢复动作按优先级集中处理" : "Approvals, policies, and recovery actions are triaged by priority"
            : isCn ? "审批、审计和团队节奏同屏推进" : "Approvals, audit, and team rhythm stay together",
          status: titleCase(routeKey),
        },
        {
          title: isCn ? "控制平面" : "Control plane",
          meta: isControlPlaneRoute
            ? isCn ? "这里是治理轨道，不再像通用任务板" : "This is a governance rail, not a generic task board"
            : isCn ? "已经脱离通用任务板壳" : "Detached from the generic task-shell",
          status: isCn ? "稳定" : "Stable",
        },
      ],
      bars: [
        { label: isCn ? "审批" : "Approvals", value: isControlPlaneRoute ? 64 : 52, color: "#8b5cf6" },
        { label: isCn ? "审计" : "Audit", value: isControlPlaneRoute ? 56 : 49, color: "#38bdf8" },
        { label: isCn ? "自动化" : "Automation", value: isControlPlaneRoute ? 38 : 26, color: "#22c55e" },
      ],
    }
  }, [
    activePage,
    activeRoutePrototype,
    isApiPreview,
    isCommerceOpsPreview,
    isCommunityPreview,
    isCrmPreview,
    isCn,
    isEducationPreview,
    isFinancePreview,
    isHealthcarePreview,
    isMarketingPreview,
    isRecruitingPreview,
    isSpecializedOpsPreview,
    isSupportPreview,
    presentation.displayName,
  ])

  const selectedFile = workbenchFiles.find((item) => item.id === selectedFileId) ?? workbenchFiles[0]

  const aiContextText = {
    explain: isCn
      ? `正在解释 ${selectedFile?.path ?? "当前文件"} 的职责、依赖和还能继续拆分的模块。`
      : `Explaining the responsibilities, dependencies, and next split points for ${selectedFile?.path ?? "the current file"}.`,
    fix: isCn
      ? `正在修复 ${selectedFile?.label ?? "当前文件"} 关联的 preview、运行和交付问题。`
      : `Fixing preview, runtime, and delivery issues tied to ${selectedFile?.label ?? "the current file"}.`,
    generate: isCn
      ? `正在继续生成文件树、终端输出和 AI 工作流，让 ${presentation.displayName} 更像成品。`
      : `Generating more file-tree, terminal, and AI workflow depth so ${presentation.displayName} feels more production-ready.`,
    refactor: isCn
      ? `正在重构主壳，让 activity bar、编辑区和 AI 侧栏协作更像真实 IDE。`
      : `Refactoring the main shell so the activity bar, editor, and AI rail collaborate like a real IDE.`,
  } as const

  const terminalOutput = {
    terminal: [
      "$ pnpm install",
      isCn ? "依赖已同步，准备构建预览。" : "Dependencies synced. Preparing preview build.",
      "$ pnpm build",
      "lint ok",
      "types ok",
      isCn ? "预览热更新已就绪" : "Preview hot reload ready",
    ],
    problems: [
      isCn ? "1. pricing 页还缺支付入口埋点说明" : "1. Pricing page still needs billing instrumentation copy",
      isCn ? "2. editor 工作区需要补文件级 explain/fix 动作" : "2. Editor workspace still needs file-level explain/fix actions",
      isCn ? "3. 线上 sandbox 启动失败时需自动退回 canonical" : "3. Sandbox startup should always fall back to canonical",
    ],
    output: [
      aiContextText[aiMode],
      isCn ? "最近一次生成结果已同步到 Preview / Dashboard / Code。" : "The latest generation output is synced across Preview / Dashboard / Code.",
      isCn ? "下一步建议：补支付入口、增强模板差异、接入团队成员权限。" : "Suggested next step: expand billing entry, template differences, and team roles.",
    ],
  } as const
  const activeTerminalOutput = terminalOutput[terminalTab] ?? terminalOutput.output

  const runRows = [
    { id: "run-1", status: "ready", branch: "main", action: isCn ? "生成应用骨架" : "Generate scaffold", duration: "1m 24s", updatedAt: "2026-03-26T12:00:00.000Z" },
    { id: "run-2", status: "running", branch: "workspace-preview", action: isCn ? "启动 sandbox preview" : "Start sandbox preview", duration: "32s", updatedAt: "2026-03-26T12:06:00.000Z" },
    { id: "run-3", status: "failed", branch: "hotfix/preview", action: isCn ? "修复预览路由" : "Fix preview routing", duration: "54s", updatedAt: "2026-03-26T12:09:00.000Z" },
  ]
  const visibleRuns = runRows.filter((item) => runsFilter === "all" || item.status === runsFilter)
  const previewLayoutVariant =
    spec?.visualSeed?.layoutVariant ??
    (isMarketingPreview
      ? "marketing_split"
      : isCommunityPreview
        ? "story_stack"
        : isCrmPreview
          ? "sidebar_board"
          : isApiPreview
            ? "docs_console"
            : "split_command")
  const previewHeroVariant =
    spec?.visualSeed?.heroVariant ??
    (isMarketingPreview ? "distribution" : isCommunityPreview ? "community" : isCrmPreview ? "pipeline" : "operations")
  const previewSurfaceVariant =
    spec?.visualSeed?.surfaceVariant ?? (isMarketingPreview || isCommunityPreview ? "glass" : isApiPreview ? "soft" : "solid")
  const previewCtaVariant =
    spec?.visualSeed?.ctaVariant ?? (isMarketingPreview || isCommunityPreview ? "pill" : isApiPreview ? "outline" : "block")
  const previewShellIsLight = isCommunityPreview || isMarketingPreview || spec?.visualSeed?.theme === "light"
  const previewShellBackground =
    isMarketingPreview
      ? previewSurfaceVariant === "glass"
        ? "radial-gradient(circle at top left, rgba(255,255,255,0.92), rgba(240,249,255,0.82) 38%, rgba(255,247,237,0.88) 100%), linear-gradient(180deg,#fffdf8 0%,#eff6ff 100%)"
        : "linear-gradient(180deg,#fffaf1 0%,#eaf2ff 100%)"
      : isCommunityPreview
        ? previewSurfaceVariant === "glass"
          ? "radial-gradient(circle at top left, rgba(255,255,255,0.92), rgba(254,242,242,0.8) 34%, rgba(245,243,255,0.92) 100%), linear-gradient(180deg,#fffaf5 0%,#f5f3ff 100%)"
          : "linear-gradient(180deg,#fff8f1 0%,#f8f4ff 100%)"
        : previewShellIsLight
          ? previewSurfaceVariant === "glass"
            ? "radial-gradient(circle at 18% 12%, rgba(240,253,250,0.96), rgba(239,246,255,0.88) 44%, rgba(255,255,255,0.94) 100%), linear-gradient(180deg,#f8fafc 0%,#ecfeff 100%)"
            : "linear-gradient(180deg,#f8fafc 0%,#eef6ff 100%)"
        : isCrmPreview
          ? "radial-gradient(circle at top right, rgba(20,184,166,0.12), transparent 34%), radial-gradient(circle at left top, rgba(59,130,246,0.14), transparent 26%), linear-gradient(180deg,#08131f 0%,#101827 42%,#152238 100%)"
          : isApiPreview
            ? previewSurfaceVariant === "soft"
              ? "radial-gradient(circle at top left, rgba(56,189,248,0.12), transparent 34%), radial-gradient(circle at top right, rgba(139,92,246,0.12), transparent 28%), linear-gradient(180deg,#07111b 0%,#10192a 42%,#0f172a 100%)"
              : "linear-gradient(180deg,#060d16 0%,#0d1522 100%)"
            : "radial-gradient(circle at top left, rgba(139,92,246,0.12), transparent 34%), radial-gradient(circle at top right, rgba(34,197,94,0.08), transparent 28%), linear-gradient(180deg,#0d0f15 0%,#131722 100%)"
  const previewHeaderBackground =
    isMarketingPreview
      ? "rgba(255,255,255,0.84)"
      : isCommunityPreview
        ? "rgba(255,255,255,0.82)"
        : previewShellIsLight
          ? "rgba(255,255,255,0.86)"
        : isCrmPreview
          ? "rgba(7,15,25,0.84)"
          : isApiPreview
            ? "rgba(9,18,31,0.84)"
            : "#141722"
  const previewHeaderBorder = previewShellIsLight ? "1px solid rgba(148,163,184,0.18)" : "1px solid rgba(255,255,255,0.08)"
  const previewHeaderText = previewShellIsLight ? "#0f172a" : "#f8fafc"
  const previewHeaderMuted = previewShellIsLight ? "rgba(15,23,42,0.52)" : "rgba(255,255,255,0.5)"
  const previewNavIdle = previewShellIsLight ? "rgba(15,23,42,0.68)" : "rgba(255,255,255,0.62)"
  const previewNavBorder = previewShellIsLight ? "1px solid rgba(148,163,184,0.18)" : "1px solid rgba(255,255,255,0.08)"
  const previewNavActiveBackground =
    isMarketingPreview
      ? "linear-gradient(135deg,#0f172a,#334155)"
      : isCommunityPreview
        ? "linear-gradient(135deg,#f97316,#fb7185)"
        : isHealthcarePreview
          ? "linear-gradient(135deg,#0f766e,#22c55e)"
          : isEducationPreview
            ? "linear-gradient(135deg,#2563eb,#8b5cf6)"
        : isCrmPreview
          ? "linear-gradient(135deg,#0f766e,#14b8a6)"
          : isApiPreview
            ? "linear-gradient(135deg,#2563eb,#7c3aed)"
            : "rgba(124,58,237,0.22)"
  const previewNavActiveColor = "#fff"
  const previewHeaderJustify = previewLayoutVariant === "docs_console" ? "flex-start" : "space-between"
  const previewHeaderDirection = previewLayoutVariant === "docs_console" ? "column" : "row"
  const previewHeaderNavJustify = previewLayoutVariant === "marketing_split" ? "flex-end" : previewLayoutVariant === "docs_console" ? "flex-start" : "flex-start"

  const templateGroups = {
    product: isCn
      ? [
          ["官网与下载站", "首页、下载、文档、定价、FAQ"],
          ["中国版 AI 代码平台", "dashboard、editor、runs、templates、pricing"],
        ]
      : [
          ["Website and downloads", "Home, downloads, docs, pricing, FAQ"],
          ["AI coding workspace", "dashboard, editor, runs, templates, pricing"],
        ],
    ops: isCn
      ? [
          ["销售后台", "线索、商机、合同、交付、汇报"],
          ["社区反馈中心", "工单、反馈、公告、知识库"],
        ]
      : [
          ["Sales admin", "Leads, pipeline, contracts, handoff, reporting"],
          ["Community hub", "Tickets, feedback, notice, knowledge base"],
        ],
    data: isCn
      ? [
          ["API 数据平台", "接口、日志、鉴权、环境、监控"],
          ["运维看板", "运行、错误、告警、巡检、环境"],
        ]
      : [
          ["API data platform", "Endpoints, logs, auth, envs, monitoring"],
          ["Ops cockpit", "Runs, errors, alerts, checks, environments"],
        ],
  } as const
  const activeTemplateGroup = templateGroups[templateCategory] ?? templateGroups.product

  const renderDashboard = () => {
    const isLightSurface = isCommunityPreview || isMarketingPreview || spec?.visualSeed?.theme === "light"
    const shellBackground =
      isMarketingPreview
        ? "linear-gradient(180deg,#f8fafc 0%,#eef4ff 100%)"
        : isCommunityPreview
          ? "linear-gradient(180deg,#fffaf5 0%,#f6f2ff 100%)"
          : isHealthcarePreview
            ? "radial-gradient(circle at top left, rgba(209,250,229,0.72), transparent 34%), linear-gradient(180deg,#f8fafc 0%,#ecfeff 100%)"
            : isEducationPreview
              ? "radial-gradient(circle at top right, rgba(219,234,254,0.84), transparent 34%), linear-gradient(180deg,#f8fafc 0%,#eef2ff 100%)"
          : isApiPreview
            ? "linear-gradient(180deg,#0c1220 0%,#111a2a 100%)"
            : isCrmPreview
              ? "linear-gradient(180deg,#101625 0%,#151b2b 100%)"
              : "linear-gradient(180deg,#0d1118 0%,#131a26 100%)"
    const shellText = isLightSurface ? "#0f172a" : "#f8fafc"
    const shellMuted = isLightSurface ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.68)"
    const shellBorder = isLightSurface ? "rgba(148,163,184,0.18)" : "rgba(255,255,255,0.08)"
    const primaryCtaBackground = isMarketingPreview ? "#0f172a" : isCommunityPreview ? "#f97316" : "#8b5cf6"
    const navSurface = isLightSurface ? "rgba(255,255,255,0.82)" : "rgba(11,15,24,0.78)"
    const cardSurface = isLightSurface ? "rgba(255,255,255,0.92)" : "rgba(17,23,35,0.86)"
    const secondarySurface = isLightSurface ? "rgba(239,246,255,0.86)" : "rgba(23,29,42,0.86)"
    const ctaSurface = isMarketingPreview ? "#0f172a" : isCommunityPreview ? "#f97316" : "#8b5cf6"
    const heroSplitColumns =
      previewLayoutVariant === "story_stack"
        ? "1fr"
        : previewLayoutVariant === "marketing_split"
          ? "1.15fr 0.85fr"
          : previewLayoutVariant === "docs_console"
            ? "1fr 0.85fr"
            : "1.2fr 0.8fr"
    const marketingFeatureColumns = previewLayoutVariant === "story_stack" ? "1fr" : "1.05fr 0.95fr 0.9fr"
    const marketingSecondaryColumns = previewLayoutVariant === "story_stack" ? "1fr" : "1fr 1fr"
    const communityHeroColumns = previewLayoutVariant === "story_stack" ? "1fr" : "1.05fr 0.95fr"

    const tactileButton = (primary = false) =>
      ({
        textDecoration: "none",
        borderRadius: previewCtaVariant === "block" ? 22 : previewCtaVariant === "outline" ? 14 : 999,
        padding: previewCtaVariant === "block" ? "16px 20px" : "13px 18px",
        background: primary ? ctaSurface : secondarySurface,
        color: primary ? "#fff" : shellText,
        fontWeight: 800,
        border: `1px solid ${primary ? `${ctaSurface}55` : shellBorder}`,
        boxShadow: primary
          ? `0 14px 28px ${ctaSurface}33, inset 0 1px 0 rgba(255,255,255,0.18)`
          : `0 10px 24px rgba(15,23,42,0.08), inset 0 1px 0 ${isLightSurface ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.08)"}`,
        transform: "translateY(0)",
        transition: "transform 160ms ease, box-shadow 160ms ease, filter 160ms ease, background 160ms ease",
      }) as const

    const statCards = (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
        {dashboardModel.stats.map((item, index) => {
          const targetRoute = resolvePreviewRoute(dashboardTargets.stats[index] ?? "dashboard")
          return (
          <PreviewAnchor
            key={item.label}
            href={previewHrefFor(targetRoute)}
            className={tactileClassName}
            style={{ ...cardStyle(cardSurface), textDecoration: "none", position: "relative", overflow: "hidden", boxShadow: isLightSurface ? "0 16px 40px rgba(15,23,42,0.08)" : "none" }}
          >
            <div style={{ position: "absolute", right: -24, bottom: -32, width: 112, height: 112, borderRadius: "50%", background: `${item.tone}18` }} />
            <div style={{ color: isLightSurface ? "rgba(15,23,42,0.56)" : "rgba(255,255,255,0.45)", fontSize: 12, position: "relative" }}>{item.label}</div>
            <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: item.tone }}>{item.value}</div>
            <div style={{ marginTop: 12, color: shellMuted, fontSize: 12, position: "relative" }}>
              {isCn ? `进入${getNavLabel(`/${targetRoute}`, isCn)}` : `Open ${getNavLabel(`/${targetRoute}`, isCn)}`}
            </div>
          </PreviewAnchor>
        )})}
      </div>
    )

    const renderChartRows = () => (
      <div style={{ display: "grid", gap: 14 }}>
        {dashboardModel.chartBars.map((bar) => (
          <div key={bar.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: shellMuted }}>
              <span>{bar.label}</span>
              <span style={{ color: shellText, fontWeight: 700 }}>{bar.value}</span>
            </div>
            <div style={{ height: 12, borderRadius: 999, background: isLightSurface ? "#e2e8f0" : "#1b1f2b", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, Math.max(12, bar.value))}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${bar.color}, ${bar.color}cc)` }} />
            </div>
          </div>
        ))}
      </div>
    )

    const renderChartBar = () => {
      const max = Math.max(...dashboardModel.chartBars.map((bar) => bar.value), 100)
      return (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${dashboardModel.chartBars.length}, minmax(0, 1fr))`, gap: 14, alignItems: "end", height: 220, paddingTop: 8 }}>
            {dashboardModel.chartBars.map((bar) => {
              const height = Math.max(22, Math.round((bar.value / max) * 180))
              return (
                <div key={bar.label} style={{ display: "grid", gap: 10, alignItems: "end" }}>
                  <div style={{ borderRadius: 16, height, background: `linear-gradient(180deg, ${bar.color}, ${bar.color}cc)`, boxShadow: `0 16px 26px ${bar.color}33` }} />
                  <div style={{ textAlign: "center", color: shellMuted, fontSize: 12, lineHeight: 1.3 }}>
                    <div style={{ color: shellText, fontWeight: 700, marginBottom: 2 }}>{bar.label}</div>
                    <div>{bar.value}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {dashboardModel.chartBars.map((bar) => (
              <span key={bar.label} style={{ borderRadius: 999, padding: "6px 10px", background: `${bar.color}18`, color: bar.color, fontSize: 12, fontWeight: 800 }}>
                {bar.label}
              </span>
            ))}
          </div>
        </div>
      )
    }

    const renderChartLine = () => {
      const points = dashboardModel.chartBars.map((bar, index) => {
        const x = dashboardModel.chartBars.length === 1 ? 32 : 32 + (index * 240) / Math.max(1, dashboardModel.chartBars.length - 1)
        const y = 210 - (Math.min(100, Math.max(0, bar.value)) / 100) * 150
        return { ...bar, x, y }
      })
      const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")
      return (
        <div style={{ display: "grid", gap: 14 }}>
          <svg viewBox="0 0 280 220" width="100%" height="220" role="img" aria-label={dashboardModel.chartTitle}>
            <defs>
              <linearGradient id={`line-${dashboardModel.chartTitle}`} x1="0%" y1="0%" x2="100%" y2="0%">
                {points.map((point, index) => (
                  <stop key={point.label} offset={`${(index / Math.max(1, points.length - 1)) * 100}%`} stopColor={point.color} />
                ))}
              </linearGradient>
            </defs>
            {[40, 80, 120, 160].map((y) => (
              <line key={y} x1="20" y1={y} x2="260" y2={y} stroke={isLightSurface ? "#dbe4f0" : "#273043"} strokeDasharray="4 6" />
            ))}
            <path d={`${path} L 260 210 L 20 210 Z`} fill="rgba(99,102,241,0.08)" />
            <path d={path} fill="none" stroke={`url(#line-${dashboardModel.chartTitle})`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point) => (
              <g key={point.label}>
                <circle cx={point.x} cy={point.y} r="5" fill={point.color} />
                <circle cx={point.x} cy={point.y} r="10" fill={point.color} opacity="0.12" />
              </g>
            ))}
          </svg>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            {dashboardModel.chartBars.map((bar) => (
              <div key={bar.label} style={{ borderRadius: 16, padding: "10px 12px", background: secondarySurface, border: `1px solid ${shellBorder}` }}>
                <div style={{ color: shellMuted, fontSize: 12 }}>{bar.label}</div>
                <div style={{ marginTop: 6, color: bar.color, fontWeight: 900, fontSize: 18 }}>{bar.value}</div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    const renderChartDonut = () => {
      const total = dashboardModel.chartBars.reduce((sum, bar) => sum + Math.max(1, bar.value), 0)
      let cumulative = 0
      return (
        <div style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: 16, alignItems: "center" }}>
          <svg viewBox="0 0 180 180" width="100%" height="180" role="img" aria-label={dashboardModel.chartTitle}>
            <circle cx="90" cy="90" r="54" fill="none" stroke={isLightSurface ? "#e2e8f0" : "#1c2330"} strokeWidth="18" />
            {dashboardModel.chartBars.map((bar) => {
              const normalized = Math.max(1, bar.value) / total
              const dash = normalized * Math.PI * 2 * 54
              const circle = (
                <circle
                  key={bar.label}
                  cx="90"
                  cy="90"
                  r="54"
                  fill="none"
                  stroke={bar.color}
                  strokeWidth="18"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${Math.max(1, Math.PI * 2 * 54 - dash)}`}
                  strokeDashoffset={-cumulative * Math.PI * 2 * 54}
                  transform="rotate(-90 90 90)"
                />
              )
              cumulative += normalized
              return circle
            })}
            <text x="90" y="84" textAnchor="middle" fill={shellText} fontSize="26" fontWeight="900">
              {dashboardModel.chartBars[0]?.value ?? 0}
            </text>
            <text x="90" y="104" textAnchor="middle" fill={shellMuted} fontSize="10" fontWeight="700">
              {isCn ? "当前重点" : "current mix"}
            </text>
          </svg>
          <div style={{ display: "grid", gap: 10 }}>
            {dashboardModel.chartBars.map((bar) => (
              <div key={bar.label} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", borderRadius: 16, padding: "10px 12px", background: secondarySurface, border: `1px solid ${shellBorder}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: bar.color, boxShadow: `0 0 0 4px ${bar.color}22` }} />
                  <span style={{ color: shellText, fontWeight: 800 }}>{bar.label}</span>
                </div>
                <span style={{ color: bar.color, fontWeight: 900 }}>{bar.value}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    const chartBlock = (
      <div style={{ ...cardStyle(cardSurface), boxShadow: isLightSurface ? "0 16px 40px rgba(15,23,42,0.08)" : "none" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{dashboardModel.chartTitle}</div>
        <div style={{ marginTop: 16 }}>
          {dashboardChartVariant === "bar" ? renderChartBar() : dashboardChartVariant === "line" ? renderChartLine() : dashboardChartVariant === "donut" ? renderChartDonut() : renderChartRows()}
        </div>
      </div>
    )

    const panelBlock = (
      <div style={{ ...cardStyle(cardSurface), boxShadow: isLightSurface ? "0 16px 40px rgba(15,23,42,0.08)" : "none" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{dashboardModel.panelTitle}</div>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {dashboardModel.panelItems.map((item, index) => {
            const targetRoute = resolvePreviewRoute(dashboardTargets.panels[index] ?? "dashboard")
            return (
            <PreviewAnchor key={item.title} href={previewHrefFor(targetRoute)} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 18, background: secondarySurface, padding: 14, border: `1px solid ${shellBorder}`, display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 800, color: shellText }}>{item.title}</div>
                <div style={{ color: item.status.toLowerCase().includes("open") || item.status.toLowerCase().includes("queued") ? "#f59e0b" : "#8b5cf6", fontSize: 12, fontWeight: 700 }}>{item.status}</div>
              </div>
              <div style={{ marginTop: 8, color: shellMuted, lineHeight: 1.6 }}>{item.meta}</div>
            </PreviewAnchor>
          )})}
        </div>
      </div>
    )

    const railBlock = (
      <div style={{ ...cardStyle(cardSurface), boxShadow: isLightSurface ? "0 16px 40px rgba(15,23,42,0.08)" : "none" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{dashboardModel.railTitle}</div>
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {dashboardModel.railItems.map((item, index) => {
            const targetRoute = resolvePreviewRoute(dashboardTargets.rails[index] ?? "dashboard")
            return (
            <PreviewAnchor key={item} href={previewHrefFor(targetRoute)} className={tactileClassName} style={{ textDecoration: "none", display: "grid", gridTemplateColumns: "32px 1fr", gap: 12, alignItems: "start" }}>
              <div style={{ width: 32, height: 32, borderRadius: 12, display: "grid", placeItems: "center", background: index === 0 ? `${ctaSurface}22` : secondarySurface, color: ctaSurface, fontWeight: 800, border: `1px solid ${shellBorder}` }}>
                {index + 1}
              </div>
              <div style={{ borderRadius: 18, background: secondarySurface, padding: "13px 15px", color: shellMuted, lineHeight: 1.7, border: `1px solid ${shellBorder}` }}>
                {item}
              </div>
            </PreviewAnchor>
          )})}
        </div>
      </div>
    )

    if (isSpecializedOpsPreview) {
      const specializedTone =
        isHealthcarePreview
          ? {
              eyebrow: isCn ? "护理工作流" : "Clinical workflow",
              headline: isCn ? "患者、预约、护理计划和风险提醒不是通用任务，而是一条可执行的护理路径。" : "Patients, appointments, care plans, and risk alerts become an executable care path, not a generic task board.",
              accent: "#0f766e",
              secondary: "#2563eb",
              actionA: isCn ? "打开患者队列" : "Open patient queue",
              actionB: isCn ? "查看今日预约" : "View appointments",
              routeA: "patients",
              routeB: "appointments",
              sideTitle: isCn ? "今日护理节奏" : "Today care rhythm",
              cards: [
                [isCn ? "待随访" : "Follow-ups", "18", "#0f766e"],
                [isCn ? "今日预约" : "Appointments", "12", "#2563eb"],
                [isCn ? "风险提醒" : "Risk alerts", "4", "#f97316"],
              ],
            }
          : isRecruitingPreview
            ? {
                eyebrow: isCn ? "招聘流水线" : "Hiring pipeline",
                headline: isCn ? "候选人、岗位、面试和 offer 审批以招聘节奏推进，而不是套销售或后台壳。" : "Candidates, roles, interviews, and offer approvals move with hiring cadence instead of a sales or admin shell.",
                accent: "#14b8a6",
                secondary: "#8b5cf6",
                actionA: isCn ? "打开候选人池" : "Open candidates",
                actionB: isCn ? "安排面试" : "Schedule interviews",
                routeA: "candidates",
                routeB: "interviews",
                sideTitle: isCn ? "招聘推进" : "Hiring motion",
                cards: [
                  [isCn ? "候选人" : "Candidates", "42", "#14b8a6"],
                  [isCn ? "本周面试" : "Interviews", "16", "#8b5cf6"],
                  [isCn ? "待批 Offer" : "Offers", "5", "#f59e0b"],
                ],
              }
            : isSupportPreview
              ? {
                  eyebrow: isCn ? "客服解决闭环" : "Support resolution loop",
                  headline: isCn ? "工单、SLA、客户案例和知识库形成真实解决闭环，不再是普通任务列表。" : "Tickets, SLAs, customer cases, and knowledge updates form a real resolution loop, not a generic task list.",
                  accent: "#38bdf8",
                  secondary: "#f97316",
                  actionA: isCn ? "打开工单队列" : "Open ticket queue",
                  actionB: isCn ? "查看知识库" : "View knowledge",
                  routeA: "tickets",
                  routeB: "knowledge",
                  sideTitle: "SLA desk",
                  cards: [
                    [isCn ? "开放工单" : "Open tickets", "31", "#38bdf8"],
                    [isCn ? "SLA 风险" : "SLA risk", "6", "#f97316"],
                    [isCn ? "知识库命中" : "KB hit rate", "84%", "#22c55e"],
                  ],
                }
              : isCommerceOpsPreview
                ? {
                    eyebrow: isCn ? "库存与履约" : "Inventory and fulfillment",
                    headline: isCn ? "SKU、库存、履约订单和供应商交接组成供应链操作面。" : "SKUs, inventory, fulfillment orders, and supplier handoffs form a supply-chain operations surface.",
                    accent: "#f97316",
                    secondary: "#22c55e",
                    actionA: isCn ? "打开库存" : "Open inventory",
                    actionB: isCn ? "查看商品" : "View products",
                    routeA: "inventory",
                    routeB: "products",
                    sideTitle: isCn ? "仓储信号" : "Warehouse signals",
                    cards: [
                      [isCn ? "低库存 SKU" : "Low-stock SKUs", "14", "#f97316"],
                      [isCn ? "履约订单" : "Fulfillment", "128", "#38bdf8"],
                      [isCn ? "补货提醒" : "Reorder alerts", "9", "#22c55e"],
                    ],
                  }
                : isFinancePreview
                  ? {
                      eyebrow: isCn ? "财务对账" : "Finance reconciliation",
                      headline: isCn ? "账户、交易、对账和异常复核按审计友好流程推进。" : "Accounts, transactions, reconciliation, and exception review move through an audit-friendly workflow.",
                      accent: "#22c55e",
                      secondary: "#38bdf8",
                      actionA: isCn ? "打开交易" : "Open transactions",
                      actionB: isCn ? "进入对账" : "Start reconciliation",
                      routeA: "transactions",
                      routeB: "reconciliation",
                      sideTitle: isCn ? "关账节奏" : "Close cadence",
                      cards: [
                        [isCn ? "待匹配" : "Pending match", "37", "#38bdf8"],
                        [isCn ? "异常交易" : "Exceptions", "8", "#f97316"],
                        [isCn ? "已匹配" : "Matched", "92%", "#22c55e"],
                      ],
                    }
                  : {
                      eyebrow: isCn ? "学习运营" : "Learning operations",
                      headline: isCn ? "课程、学生、作业和学习风险形成教学运营闭环。" : "Courses, students, assignments, and learning risk form an education operations loop.",
                      accent: "#2563eb",
                      secondary: "#8b5cf6",
                      actionA: isCn ? "打开课程" : "Open courses",
                      actionB: isCn ? "查看作业" : "View assignments",
                      routeA: "courses",
                      routeB: "assignments",
                      sideTitle: isCn ? "教学节奏" : "Class rhythm",
                      cards: [
                        [isCn ? "活跃课程" : "Active courses", "12", "#2563eb"],
                        [isCn ? "待批作业" : "Assignments", "46", "#8b5cf6"],
                        [isCn ? "风险学生" : "At-risk students", "7", "#f97316"],
                      ],
                    }

      const specializedDark = !isLightSurface
      const specializedPanelBackground = specializedDark ? "rgba(15,23,42,0.78)" : "rgba(255,255,255,0.9)"
      return (
        <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: previewLayoutVariant === "story_stack" ? "1fr" : "300px minmax(0,1fr)", gap: 18 }}>
            <aside style={{ borderRadius: 26, background: specializedPanelBackground, border: `1px solid ${shellBorder}`, padding: 20, display: "grid", alignContent: "start", gap: 16, boxShadow: isLightSurface ? "0 18px 48px rgba(15,23,42,0.08)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: 20, display: "grid", placeItems: "center", color: "#fff", fontWeight: 900, fontSize: 22, background: `linear-gradient(135deg, ${specializedTone.accent}, ${specializedTone.secondary})`, boxShadow: `0 16px 36px ${specializedTone.accent}33` }}>{presentation.icon.glyph}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: shellText }}>{presentation.displayName}</div>
                  <div style={{ color: shellMuted }}>{spec?.appIdentity?.category ?? spec?.appIntent?.productCategory}</div>
                </div>
              </div>
              <div style={{ display: "grid", gap: 9 }}>
                {routes.slice(0, 7).map((route) => {
                  const routeKey = route.replace(/^\//, "")
                  const active = routeKey === activePage || (activePage === "" && routeKey === "dashboard")
                  return (
                    <PreviewAnchor
                      key={route}
                      href={routeKey === "dashboard" ? `/preview/${encodeURIComponent(projectKey)}` : `/preview/${encodeURIComponent(projectKey)}/${routeKey}`}
                      className={tactileClassName}
                      style={{
                        borderRadius: isHealthcarePreview ? 999 : 16,
                        padding: "13px 16px",
                        textDecoration: "none",
                        background: active ? `linear-gradient(135deg, ${specializedTone.accent}, ${specializedTone.secondary})` : secondarySurface,
                        color: active ? "#fff" : shellText,
                        fontWeight: 800,
                        border: `1px solid ${active ? `${specializedTone.accent}77` : shellBorder}`,
                        boxShadow: active ? `0 18px 36px ${specializedTone.accent}2f` : "none",
                      }}
                    >
                      {getNavLabel(route, isCn)}
                    </PreviewAnchor>
                  )
                })}
              </div>
            </aside>
            <section style={{ display: "grid", gap: 16 }}>
              <div style={{ ...cardStyle(cardSurface), padding: 26, border: `1px solid ${shellBorder}`, boxShadow: isLightSurface ? "0 24px 60px rgba(15,23,42,0.1)" : "0 24px 54px rgba(15,23,42,0.24)" }}>
                <div style={{ display: "grid", gridTemplateColumns: previewLayoutVariant === "story_stack" ? "1fr" : "1fr 280px", gap: 18, alignItems: "center" }}>
                  <div>
                    <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase" }}>{specializedTone.eyebrow}</div>
                    <h1 style={{ margin: "12px 0 0", color: shellText, fontSize: isHealthcarePreview || isEducationPreview ? 42 : 38, lineHeight: 1.08, fontWeight: 900 }}>{specializedTone.headline}</h1>
                    <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <PreviewAnchor href={previewHrefFor(resolvePreviewRoute(specializedTone.routeA))} className={tactileClassName} style={{ ...tactileButton(true), background: `linear-gradient(135deg, ${specializedTone.accent}, ${specializedTone.secondary})` }}>{specializedTone.actionA}</PreviewAnchor>
                      <PreviewAnchor href={previewHrefFor(resolvePreviewRoute(specializedTone.routeB))} className={tactileClassName} style={tactileButton()}>{specializedTone.actionB}</PreviewAnchor>
                    </div>
                  </div>
                  <div style={{ borderRadius: 24, padding: 18, background: isLightSurface ? "rgba(236,253,245,0.9)" : "rgba(255,255,255,0.05)", border: `1px solid ${shellBorder}` }}>
                    <div style={{ fontWeight: 900, color: shellText }}>{specializedTone.sideTitle}</div>
                    <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                      {specializedTone.cards.map(([label, value, tone]) => (
                        <div key={label} style={{ borderRadius: 16, padding: "12px 14px", background: secondarySurface, border: `1px solid ${shellBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                          <span style={{ color: shellMuted }}>{label}</span>
                          <span style={{ color: tone, fontSize: 24, fontWeight: 900 }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                {specializedTone.cards.map(([label, value, tone], index) => (
                  <PreviewAnchor key={label} href={previewHrefFor(resolvePreviewRoute(index === 0 ? specializedTone.routeA : index === 1 ? specializedTone.routeB : routes[0]?.replace(/^\//, "") || "dashboard"))} className={tactileClassName} style={{ ...cardStyle(cardSurface), textDecoration: "none", border: `1px solid ${shellBorder}`, position: "relative", overflow: "hidden", minHeight: 150 }}>
                    <div style={{ position: "absolute", right: -24, bottom: -30, width: 112, height: 112, borderRadius: 999, background: `${tone}18` }} />
                    <div style={{ color: shellMuted }}>{label}</div>
                    <div style={{ marginTop: 12, color: tone, fontSize: 34, fontWeight: 900 }}>{value}</div>
                    <div style={{ marginTop: 12, color: shellMuted, fontSize: 12 }}>{isCn ? "进入业务面" : "Open workflow"}</div>
                  </PreviewAnchor>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: previewLayoutVariant === "story_stack" ? "1fr" : "1fr 1fr", gap: 16 }}>
                <div style={{ ...cardStyle(cardSurface), border: `1px solid ${shellBorder}` }}>
                  <div style={{ fontWeight: 900, color: shellText }}>{isCn ? "核心流程" : "Core workflow"}</div>
                  <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                    {[
                      spec?.appIntent?.primaryWorkflow ?? specializedTone.headline,
                      spec?.appIntent?.primaryJobs?.[0] ?? specializedTone.actionA,
                      spec?.appIntent?.automationScopes?.[0] ?? specializedTone.actionB,
                    ].filter(Boolean).map((item, index) => (
                      <div key={item} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 12, alignItems: "start" }}>
                        <div style={{ width: 34, height: 34, borderRadius: 14, display: "grid", placeItems: "center", color: "#fff", fontWeight: 900, background: index === 0 ? specializedTone.accent : index === 1 ? specializedTone.secondary : "#f97316" }}>{index + 1}</div>
                        <div style={{ borderRadius: 18, background: secondarySurface, border: `1px solid ${shellBorder}`, padding: "13px 15px", color: shellMuted, lineHeight: 1.65 }}>{item}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {chartBlock}
              </div>
            </section>
          </div>
        </div>
      )
    }

    if (isCrmPreview) {
      return (
        <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", gap: 18 }}>
            <aside style={{ borderRadius: 24, background: navSurface, border: `1px solid ${shellBorder}`, padding: 18, display: "grid", alignContent: "start", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: 18, display: "grid", placeItems: "center", color: "#fff", fontWeight: 900, fontSize: 24, background: `linear-gradient(135deg, ${presentation.icon.from}, ${presentation.icon.to})` }}>{presentation.icon.glyph}</div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: shellText }}>{presentation.displayName}</div>
                  <div style={{ color: shellMuted }}>{isCn ? "收入工作台" : "Revenue workspace"}</div>
                </div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {routes.slice(0, 7).map((route) => {
                  const routeKey = route.replace(/^\//, "")
                  const active = routeKey === activePage || (activePage === "" && routeKey === "dashboard")
                  return (
                    <PreviewAnchor
                      key={route}
                      href={routeKey === "dashboard" ? `/preview/${encodeURIComponent(projectKey)}` : `/preview/${encodeURIComponent(projectKey)}/${routeKey}`}
                      style={{
                        borderRadius: 16,
                        padding: "13px 16px",
                        textDecoration: "none",
                        background: active ? "linear-gradient(135deg,#4f46e5,#2563eb)" : secondarySurface,
                        color: active ? "#fff" : shellText,
                        fontWeight: 800,
                        border: `1px solid ${active ? "rgba(99,102,241,0.55)" : shellBorder}`,
                        boxShadow: active ? "0 18px 36px rgba(37,99,235,0.22)" : "none",
                      }}
                    >
                      {getNavLabel(route, isCn)}
                    </PreviewAnchor>
                  )
                })}
              </div>
              <div style={{ ...cardStyle(secondarySurface), padding: 16, border: `1px solid ${shellBorder}` }}>
                <div style={{ fontWeight: 800, color: shellText }}>{isCn ? "本周推进" : "This week"}</div>
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {dashboardModel.railItems.slice(0, 3).map((item) => (
                    <div key={item} style={{ color: shellMuted, lineHeight: 1.6 }}>{item}</div>
                  ))}
                </div>
              </div>
            </aside>
            <section style={{ display: "grid", gap: 16 }}>
              <div style={{ ...cardStyle(cardSurface), padding: 22, border: `1px solid ${shellBorder}`, boxShadow: "0 24px 54px rgba(15,23,42,0.24)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}>
                  <div>
                    <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{dashboardModel.eyebrow}</div>
                    <h1 style={{ margin: "10px 0 0", color: shellText, fontSize: 34, fontWeight: 900 }}>{dashboardModel.headline}</h1>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/pipeline`} className={tactileClassName} style={tactileButton(true)}>{dashboardModel.primaryCta}</PreviewAnchor>
                    <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/orders`} className={tactileClassName} style={tactileButton()}>{dashboardModel.secondaryCta}</PreviewAnchor>
                  </div>
                </div>
              </div>
              {statCards}
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
                <div style={{ ...cardStyle(cardSurface), boxShadow: "0 18px 42px rgba(15,23,42,0.18)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{isCn ? "成交流转" : "Deal motion"}</div>
                    <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/pipeline`} className={tactileClassName} style={{ textDecoration: "none", color: "#99f6e4", fontWeight: 700, fontSize: 12 }}>
                      {isCn ? "查看漏斗" : "Open pipeline"}
                    </PreviewAnchor>
                  </div>
                  <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                    {[
                      [isCn ? "线索采集" : "Lead capture", isCn ? "营销与转介绍新线索进入队列" : "Marketing and referrals feed fresh leads into the queue"],
                      [isCn ? "商机推进" : "Opportunity review", isCn ? "分配负责人、更新阶段并同步下一步" : "Assign owners, update stages, and sync the next action"],
                      [isCn ? "报价审批" : "Quote approvals", isCn ? "折扣与条款进入审批后自动提醒" : "Discounts and terms move into approval with automated reminders"],
                      [isCn ? "签约交付" : "Order handoff", isCn ? "成交后同步订单、交付与续约节奏" : "Closed deals sync orders, onboarding, and renewal cadence"],
                    ].map(([title, meta], index) => (
                      <PreviewAnchor
                        key={title}
                        href={previewHrefFor(resolvePreviewRoute(index < 2 ? "pipeline" : index === 2 ? "orders" : "customers"))}
                        className={tactileClassName}
                        style={{ textDecoration: "none", borderRadius: 18, padding: "14px 16px", background: secondarySurface, border: `1px solid ${shellBorder}`, display: "grid", gridTemplateColumns: "30px 1fr", gap: 12, alignItems: "start" }}
                      >
                        <div style={{ width: 30, height: 30, borderRadius: 12, display: "grid", placeItems: "center", background: `${index < 2 ? "#14b8a6" : "#8b5cf6"}22`, color: index < 2 ? "#5eead4" : "#c4b5fd", fontSize: 12, fontWeight: 800 }}>
                          {index + 1}
                        </div>
                        <div>
                          <div style={{ color: shellText, fontWeight: 800 }}>{title}</div>
                          <div style={{ marginTop: 6, color: shellMuted, lineHeight: 1.6 }}>{meta}</div>
                        </div>
                      </PreviewAnchor>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 16 }}>
                  <div style={{ ...cardStyle(cardSurface), boxShadow: "0 18px 42px rgba(15,23,42,0.18)" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{isCn ? "重点客户动态" : "Account watchlist"}</div>
                    <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                      {[
                        [isCn ? "Northwind" : "Northwind", isCn ? "续约窗口将在 5 天后开启" : "Renewal window opens in 5 days", "#f59e0b"],
                        [isCn ? "BrightPath" : "BrightPath", isCn ? "报价已进入 VP 审批" : "Quote is waiting on VP approval", "#8b5cf6"],
                        [isCn ? "Atlas AI" : "Atlas AI", isCn ? "新增试点席位 12 个" : "12 new pilot seats requested", "#14b8a6"],
                      ].map(([title, meta, tone]) => (
                        <PreviewAnchor key={title} href={previewHrefFor(resolvePreviewRoute("customers"))} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 16, padding: "13px 14px", background: secondarySurface, border: `1px solid ${shellBorder}`, display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 999, background: tone as string, boxShadow: `0 0 0 6px ${tone}22` }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: shellText, fontWeight: 800 }}>{title}</div>
                            <div style={{ marginTop: 4, color: shellMuted, lineHeight: 1.5 }}>{meta}</div>
                          </div>
                        </PreviewAnchor>
                      ))}
                    </div>
                  </div>
                  <div style={{ ...cardStyle("linear-gradient(135deg, rgba(20,184,166,0.12), rgba(59,130,246,0.12))"), border: `1px solid rgba(45,212,191,0.18)` }}>
                    <div style={{ color: shellText, fontWeight: 800 }}>{isCn ? "团队目标进度" : "Team target pulse"}</div>
                    <div style={{ marginTop: 12, color: shellMuted, lineHeight: 1.7 }}>
                      {isCn ? "本周成交推进、报价审批和续约提醒会自动回写到团队节奏面板。" : "Weekly deal progression, quote approvals, and renewal reminders automatically flow back into the team cadence panel."}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 16 }}>
                {chartBlock}
                {panelBlock}
              </div>
              {railBlock}
            </section>
          </div>
        </div>
      )
    }

    if (isMarketingPreview) {
      return (
        <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
          <section style={{ display: "grid", gap: 18 }}>
            <div style={{ ...cardStyle("linear-gradient(135deg, rgba(255,255,255,0.98), rgba(241,245,249,0.92))"), padding: 28, border: `1px solid ${shellBorder}`, boxShadow: "0 24px 60px rgba(15,23,42,0.08)" }}>
              <div style={{ display: "grid", gridTemplateColumns: heroSplitColumns, gap: 22, alignItems: "center" }}>
                <div>
                  <div style={{ color: "rgba(15,23,42,0.45)", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{dashboardModel.eyebrow}</div>
                  <h1 style={{ margin: "12px 0 0", color: "#0f172a", fontSize: 42, lineHeight: 1.05, fontWeight: 900 }}>{dashboardModel.headline}</h1>
                  <p style={{ margin: "14px 0 0", color: "rgba(15,23,42,0.7)", lineHeight: 1.75 }}>{presentation.summary}</p>
                  <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/downloads`} className={tactileClassName} style={tactileButton(true)}>{dashboardModel.primaryCta}</PreviewAnchor>
                    <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/docs`} className={tactileClassName} style={tactileButton()}>{dashboardModel.secondaryCta}</PreviewAnchor>
                  </div>
                </div>
                <div style={{ ...cardStyle("#0f172a"), minHeight: 240, display: "grid", alignContent: "space-between", boxShadow: "0 24px 60px rgba(15,23,42,0.18)" }}>
                  <div style={{ color: "rgba(255,255,255,0.56)" }}>{isCn ? "分发概览" : "Distribution overview"}</div>
                  <div style={{ display: "grid", gap: 12 }}>
                    {dashboardModel.panelItems.map((item) => (
                      <div key={item.title} style={{ borderRadius: 16, background: "rgba(255,255,255,0.06)", padding: 14 }}>
                        <div style={{ color: "#fff", fontWeight: 800 }}>{item.title}</div>
                        <div style={{ marginTop: 6, color: "rgba(255,255,255,0.66)", lineHeight: 1.6 }}>{item.meta}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {statCards}
            <div style={{ display: "grid", gridTemplateColumns: marketingFeatureColumns, gap: 16 }}>
              <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/downloads`} className={tactileClassName} style={{ ...cardStyle("linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.94))"), textDecoration: "none", minHeight: 220, boxShadow: "0 24px 60px rgba(15,23,42,0.18)" }}>
                <div style={{ color: "rgba(255,255,255,0.56)", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{isCn ? "下载入口" : "Download entry"}</div>
                <div style={{ marginTop: 12, color: "#fff", fontSize: 28, fontWeight: 900 }}>{isCn ? "桌面与移动版本" : "Desktop and mobile builds"}</div>
                <div style={{ marginTop: 10, color: "rgba(255,255,255,0.68)", lineHeight: 1.7 }}>
                  {isCn ? "按设备、渠道和发布波次组织下载入口，而不是只给一个按钮。" : "Organize download entry by device, channel, and rollout wave instead of a single CTA."}
                </div>
              </PreviewAnchor>
              <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/docs`} className={tactileClassName} style={{ ...cardStyle(cardSurface), textDecoration: "none", minHeight: 220, boxShadow: "0 18px 42px rgba(15,23,42,0.08)" }}>
                <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{isCn ? "文档与更新" : "Docs and updates"}</div>
                <div style={{ marginTop: 12, color: shellText, fontSize: 24, fontWeight: 900 }}>{isCn ? "文档、变更日志与发布说明" : "Docs, changelog, and release notes"}</div>
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {[
                    isCn ? "快速安装指南" : "Quick install guide",
                    isCn ? "版本差异摘要" : "Release delta summary",
                    isCn ? "企业分发说明" : "Enterprise distribution notes",
                  ].map((item) => (
                    <div key={item} style={{ borderRadius: 14, background: secondarySurface, padding: "11px 12px", color: shellText, border: `1px solid ${shellBorder}` }}>
                      {item}
                    </div>
                  ))}
                </div>
              </PreviewAnchor>
              <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/admin`} className={tactileClassName} style={{ ...cardStyle(cardSurface), textDecoration: "none", minHeight: 220, boxShadow: "0 18px 42px rgba(15,23,42,0.08)" }}>
                <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{isCn ? "分发后台" : "Distribution admin"}</div>
                <div style={{ marginTop: 12, color: shellText, fontSize: 24, fontWeight: 900 }}>{isCn ? "渠道包、审批与回滚" : "Channels, approvals, and rollback"}</div>
                <div style={{ marginTop: 10, color: shellMuted, lineHeight: 1.7 }}>
                  {isCn ? "这里直接管理审核流、灰度发布、下载渠道和版本冻结。" : "Manage approvals, staged rollout, download channels, and release freeze from one control rail."}
                </div>
              </PreviewAnchor>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: marketingSecondaryColumns, gap: 16 }}>
              {chartBlock}
              {railBlock}
            </div>
          </section>
        </div>
      )
    }

    if (isCommunityPreview) {
      return (
        <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
          <section style={{ display: "grid", gap: 16 }}>
            <div style={{ ...cardStyle(cardSurface), padding: 22, border: `1px solid ${shellBorder}`, boxShadow: "0 18px 48px rgba(15,23,42,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                <div>
                  <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{dashboardModel.eyebrow}</div>
                  <div style={{ marginTop: 8, color: shellText, fontSize: 34, fontWeight: 900 }}>{dashboardModel.headline}</div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/feedback`} className={tactileClassName} style={tactileButton(true)}>{dashboardModel.primaryCta}</PreviewAnchor>
                  <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/members`} className={tactileClassName} style={tactileButton()}>{dashboardModel.secondaryCta}</PreviewAnchor>
                </div>
              </div>
            </div>
            {statCards}
            <div style={{ display: "grid", gridTemplateColumns: communityHeroColumns, gap: 16 }}>
              <div style={{ ...cardStyle(cardSurface), boxShadow: "0 16px 40px rgba(15,23,42,0.08)" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{isCn ? "社区工作流" : "Community workflow"}</div>
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {[
                    [isCn ? "活动编排" : "Event orchestration", isCn ? "排期、邀请和直播提醒" : "Scheduling, invites, and live reminders"],
                    [isCn ? "反馈归类" : "Feedback intake", isCn ? "按主题聚合问题、建议与投票" : "Group issues, ideas, and votes by theme"],
                    [isCn ? "治理执行" : "Moderation ops", isCn ? "把成员治理与路线图联动起来" : "Connect moderation decisions with the roadmap"],
                  ].map(([title, meta], index) => (
                    <PreviewAnchor key={title} href={previewHrefFor(resolvePreviewRoute(index === 0 ? "events" : index === 1 ? "feedback" : "moderation"))} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 18, padding: "14px 16px", background: secondarySurface, border: `1px solid ${shellBorder}` }}>
                      <div style={{ color: shellText, fontWeight: 800 }}>{title}</div>
                      <div style={{ marginTop: 6, color: shellMuted, lineHeight: 1.6 }}>{meta}</div>
                    </PreviewAnchor>
                  ))}
                </div>
              </div>
              <div style={{ ...cardStyle(cardSurface), boxShadow: "0 16px 40px rgba(15,23,42,0.08)" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{isCn ? "成员与路线图" : "Members and roadmap"}</div>
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {[
                    isCn ? "高活跃成员待联系" : "High-signal members to follow up",
                    isCn ? "本周待归档反馈 12 条" : "12 feedback items pending triage this week",
                    isCn ? "路线图候选将在周会上评审" : "Roadmap candidates will be reviewed in the weekly sync",
                  ].map((item) => (
                    <div key={item} style={{ borderRadius: 16, padding: "12px 14px", background: secondarySurface, border: `1px solid ${shellBorder}`, color: shellText }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 16 }}>
              {chartBlock}
              {panelBlock}
            </div>
            {railBlock}
          </section>
        </div>
      )
    }

    if (isApiPreview) {
      return (
        <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
          <section style={{ display: "grid", gap: 16 }}>
            <div style={{ ...cardStyle("linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.92))"), padding: 22, boxShadow: "0 24px 60px rgba(2,6,23,0.34)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 18, alignItems: "center" }}>
                <div>
                  <div style={{ color: "rgba(148,163,184,0.72)", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{dashboardModel.eyebrow}</div>
                  <div style={{ marginTop: 10, color: "#f8fafc", fontSize: 34, fontWeight: 900 }}>{dashboardModel.headline}</div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/endpoints`} className={tactileClassName} style={tactileButton(true)}>{dashboardModel.primaryCta}</PreviewAnchor>
                  <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/docs`} className={tactileClassName} style={tactileButton()}>{dashboardModel.secondaryCta}</PreviewAnchor>
                </div>
              </div>
            </div>
            {statCards}
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
              <div style={{ ...cardStyle(cardSurface), boxShadow: "0 24px 60px rgba(2,6,23,0.24)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{isCn ? "平台对象流" : "Platform object flow"}</div>
                  <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/endpoints`} className={tactileClassName} style={{ textDecoration: "none", color: "#93c5fd", fontWeight: 700, fontSize: 12 }}>
                    {isCn ? "查看端点" : "Open endpoints"}
                  </PreviewAnchor>
                </div>
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {[
                    [isCn ? "端点目录" : "Endpoint catalog", isCn ? "按版本、环境和访问策略组织接口" : "Organize endpoints by version, environment, and access policy"],
                    [isCn ? "身份与密钥" : "Auth and keys", isCn ? "OAuth、API keys 与服务账户策略联动" : "OAuth, API keys, and service-account policy move together"],
                    [isCn ? "事件与回调" : "Events and webhooks", isCn ? "交付状态、失败重试和回调日志全部可见" : "Delivery status, retries, and webhook logs stay visible"],
                    [isCn ? "计量与账单" : "Usage and billing", isCn ? "按租户、产品线和环境观察消耗" : "Observe consumption by tenant, product line, and environment"],
                  ].map(([title, meta], index) => (
                    <PreviewAnchor key={title} href={previewHrefFor(resolvePreviewRoute(index === 0 ? "endpoints" : index === 1 ? "usage" : index === 2 ? "webhooks" : "docs"))} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 18, padding: "14px 16px", background: secondarySurface, border: `1px solid ${shellBorder}` }}>
                      <div style={{ color: shellText, fontWeight: 800 }}>{title}</div>
                      <div style={{ marginTop: 6, color: shellMuted, lineHeight: 1.6 }}>{meta}</div>
                    </PreviewAnchor>
                  ))}
                </div>
              </div>
              <div style={{ ...cardStyle(cardSurface), boxShadow: "0 24px 60px rgba(2,6,23,0.24)" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{isCn ? "交付与文档同步" : "Delivery and docs sync"}</div>
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {[
                    isCn ? "开发者 onboarding 版本保持最新" : "Developer onboarding stays synced to the latest release",
                    isCn ? "文档页会随 SDK 与 usage 变更更新" : "Docs pages update with SDK and usage changes",
                    isCn ? "故障恢复与 webhook 重试共享同一状态面板" : "Incident recovery and webhook retries share one status panel",
                  ].map((item) => (
                    <div key={item} style={{ borderRadius: 16, padding: "12px 14px", background: secondarySurface, border: `1px solid ${shellBorder}`, color: shellText }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
              {chartBlock}
              {panelBlock}
            </div>
            {railBlock}
          </section>
        </div>
      )
    }

    return (
      <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
        <section style={{ display: "grid", gap: 16 }}>
          <div style={{ ...cardStyle(cardSurface), padding: 22, border: `1px solid ${shellBorder}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
              <div>
                <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{dashboardModel.eyebrow}</div>
                <div style={{ marginTop: 10, color: shellText, fontSize: 34, fontWeight: 900 }}>{dashboardModel.headline}</div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/approvals`} className={tactileClassName} style={tactileButton(true)}>{dashboardModel.primaryCta}</PreviewAnchor>
                <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/security`} className={tactileClassName} style={tactileButton()}>{dashboardModel.secondaryCta}</PreviewAnchor>
              </div>
            </div>
          </div>
          {statCards}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
            <div style={{ ...cardStyle(cardSurface), boxShadow: "0 18px 42px rgba(15,23,42,0.24)" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{isCn ? "控制平面回路" : "Control-plane loop"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {[
                  [isCn ? "审批队列" : "Approvals queue", isCn ? "待签批项目进入同一优先级队列" : "Pending sign-offs enter one prioritized queue"],
                  [isCn ? "访问策略" : "Access policy", isCn ? "角色、权限和策略变更联动审查" : "Roles, permissions, and policy changes are reviewed together"],
                  [isCn ? "审计留痕" : "Audit trail", isCn ? "关键动作自动记录到审计时间线" : "Critical actions automatically land in the audit timeline"],
                  [isCn ? "异常响应" : "Incident response", isCn ? "告警、恢复与复盘共享同一工作台" : "Alerts, recovery, and review share one response surface"],
                ].map(([title, meta], index) => (
                  <PreviewAnchor key={title} href={previewHrefFor(resolvePreviewRoute(index === 0 ? "approvals" : index === 1 ? "security" : index === 2 ? "audit" : "incidents"))} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 18, padding: "14px 16px", background: secondarySurface, border: `1px solid ${shellBorder}` }}>
                    <div style={{ color: shellText, fontWeight: 800 }}>{title}</div>
                    <div style={{ marginTop: 6, color: shellMuted, lineHeight: 1.6 }}>{meta}</div>
                  </PreviewAnchor>
                ))}
              </div>
            </div>
            <div style={{ ...cardStyle(cardSurface), boxShadow: "0 18px 42px rgba(15,23,42,0.24)" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{isCn ? "实时队列" : "Live queues"}</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {[
                  isCn ? "2 个高优先审批待签批" : "2 high-priority approvals awaiting sign-off",
                  isCn ? "1 条权限策略变更需要复核" : "1 access policy change needs review",
                  isCn ? "3 条异常事件正在恢复中" : "3 incident cases are currently in recovery",
                ].map((item) => (
                  <div key={item} style={{ borderRadius: 16, padding: "12px 14px", background: secondarySurface, border: `1px solid ${shellBorder}`, color: shellText }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {chartBlock}
            {panelBlock}
          </div>
          {railBlock}
        </section>
      </div>
    )
  }

  const renderRouteWorkspace = () => {
    if (!routeExperienceModel) return null

    const routeKey = activePage || "dashboard"
    const shellBackground = routeExperienceModel.darkShell
      ? isCrmPreview
        ? "radial-gradient(circle at top right, rgba(20,184,166,0.14), transparent 32%), linear-gradient(180deg,#0f1828 0%,#18263d 100%)"
        : isApiPreview
          ? "radial-gradient(circle at top left, rgba(56,189,248,0.14), transparent 32%), linear-gradient(180deg,#0b1320 0%,#132034 100%)"
          : "linear-gradient(180deg,#101625 0%,#151b2b 100%)"
      : isMarketingPreview
        ? "radial-gradient(circle at top left, rgba(255,255,255,0.92), rgba(240,249,255,0.82) 42%, rgba(255,247,237,0.88) 100%), linear-gradient(180deg,#fffdf8 0%,#eff6ff 100%)"
        : "radial-gradient(circle at top left, rgba(255,255,255,0.92), rgba(254,242,242,0.8) 34%, rgba(245,243,255,0.92) 100%), linear-gradient(180deg,#fffaf5 0%,#f5f3ff 100%)"
    const shellText = routeExperienceModel.darkShell ? "#f8fafc" : "#0f172a"
    const shellMuted = routeExperienceModel.darkShell ? "rgba(255,255,255,0.68)" : "rgba(15,23,42,0.62)"
    const shellBorder = routeExperienceModel.darkShell ? "rgba(255,255,255,0.08)" : "rgba(148,163,184,0.18)"
    const cardBackground = routeExperienceModel.darkShell ? "rgba(17,23,35,0.86)" : "rgba(255,255,255,0.92)"
    const railBackground = routeExperienceModel.darkShell ? "rgba(23,29,42,0.86)" : "rgba(239,246,255,0.86)"
    const primaryCtaBackground =
      isCrmPreview
        ? "linear-gradient(135deg,#0f766e,#14b8a6)"
        : isApiPreview
          ? "linear-gradient(135deg,#2563eb,#7c3aed)"
          : routeExperienceModel.darkShell
            ? "#8b5cf6"
            : "#0f172a"

    if (isCrmPreview && routeKey === "pipeline") {
      const stages = [
        {
          title: isCn ? "发现" : "Discovery",
          amount: "$180k",
          deals: [
            { name: isCn ? "景曜 AI" : "Jingyao AI", meta: isCn ? "演示完成，待分配方案顾问" : "Demo done, solution consultant next" },
            { name: "Northstar", meta: isCn ? "进入预算确认" : "Budget confirmation in progress" },
          ],
        },
        {
          title: isCn ? "方案" : "Proposal",
          amount: "$340k",
          deals: [
            { name: isCn ? "华星续约" : "Huaxing renewal", meta: isCn ? "法务复核中" : "Legal review underway" },
            { name: isCn ? "Lakeview 扩容" : "Lakeview expansion", meta: isCn ? "报价版本 v3" : "Quote version v3" },
          ],
        },
        {
          title: isCn ? "谈判" : "Negotiation",
          amount: "$210k",
          deals: [
            { name: isCn ? "Atlas 集团" : "Atlas Group", meta: isCn ? "采购会签" : "Procurement sign-off" },
          ],
        },
        {
          title: isCn ? "成交" : "Won",
          amount: "$96k",
          deals: [
            { name: isCn ? "Morn Labs" : "Morn Labs", meta: isCn ? "交付已接棒" : "Delivery handoff completed" },
          ],
        },
      ]
      return (
        <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
          <section style={{ display: "grid", gap: 16 }}>
            <div style={{ ...cardStyle(cardBackground), padding: 22, border: `1px solid ${shellBorder}`, boxShadow: "0 20px 48px rgba(15,23,42,0.24)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "start" }}>
                <div>
                  <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{routeExperienceModel.eyebrow}</div>
                  <h1 style={{ margin: "10px 0 0", color: shellText, fontSize: 34, fontWeight: 900 }}>{routeExperienceModel.headline}</h1>
                  <div style={{ marginTop: 10, color: shellMuted, maxWidth: 720, lineHeight: 1.7 }}>
                    {isCn ? "把阶段推进、报价审批和成交交接放进同一条 revenue rail，像销售团队真的每天会看的那种 pipeline 面。" : "Keep stage motion, quote approvals, and close handoff inside one revenue rail that feels like a real sales operating surface."}
                  </div>
                </div>
                <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}`} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 16, padding: "13px 18px", background: primaryCtaBackground, color: "#fff", fontWeight: 800, boxShadow: "0 14px 28px rgba(20,184,166,0.28)" }}>
                  {isCn ? "返回总览" : "Back to overview"}
                </PreviewAnchor>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
              {stages.map((stage) => (
                <div key={stage.title} style={{ ...cardStyle(cardBackground), minHeight: 320, border: `1px solid ${shellBorder}`, display: "grid", alignContent: "start", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: shellText, fontWeight: 900, fontSize: 18 }}>{stage.title}</div>
                      <div style={{ color: shellMuted, fontSize: 13, marginTop: 4 }}>{stage.amount}</div>
                    </div>
                    <div style={{ minWidth: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(20,184,166,0.14)", color: "#5eead4", fontWeight: 800 }}>
                      {stage.deals.length}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {stage.deals.map((deal) => (
                      <div key={deal.name} style={{ borderRadius: 18, background: railBackground, border: `1px solid ${shellBorder}`, padding: 14 }}>
                        <div style={{ color: shellText, fontWeight: 800 }}>{deal.name}</div>
                        <div style={{ marginTop: 8, color: shellMuted, lineHeight: 1.6 }}>{deal.meta}</div>
                        <PreviewAnchor
                          href={`/preview/${encodeURIComponent(projectKey)}/orders`}
                          className={tactileClassName}
                          style={{ display: "inline-block", marginTop: 12, textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: "rgba(20,184,166,0.16)", color: "#99f6e4", fontWeight: 800, textAlign: "left" }}
                        >
                          {isCn ? "查看阶段动作" : "Open stage actions"}
                        </PreviewAnchor>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )
    }

    if (isCrmPreview && routeKey === "leads") {
      const leadRows = [
        { name: isCn ? "晨星制造" : "Morning Manufacturing", channel: isCn ? "官网表单" : "Website intake", score: "86", owner: "Lena" },
        { name: "Northstar", channel: isCn ? "伙伴引荐" : "Partner referral", score: "74", owner: "Kai" },
        { name: isCn ? "星图教育" : "StarMap Edu", channel: isCn ? "活动报名" : "Event signup", score: "68", owner: "Mira" },
      ]
      return (
        <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
          <section style={{ display: "grid", gridTemplateColumns: "1.12fr 0.88fr", gap: 16 }}>
            <div style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{routeExperienceModel.eyebrow}</div>
                  <h1 style={{ margin: "10px 0 0", color: shellText, fontSize: 32, fontWeight: 900 }}>{routeExperienceModel.headline}</h1>
                </div>
                <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}`} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", background: primaryCtaBackground, color: "#fff", fontWeight: 800 }}>
                  {isCn ? "返回总览" : "Back to overview"}
                </PreviewAnchor>
              </div>
              <div style={{ marginTop: 18, borderRadius: 20, overflow: "hidden", border: `1px solid ${shellBorder}` }}>
                {leadRows.map((row, index) => (
                  <div key={row.name} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.55fr 0.55fr 0.7fr", gap: 12, padding: "14px 16px", background: index % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent", borderBottom: index === leadRows.length - 1 ? "none" : `1px solid ${shellBorder}`, alignItems: "center" }}>
                    <div style={{ color: shellText, fontWeight: 800 }}>{row.name}</div>
                    <div style={{ color: shellMuted }}>{row.channel}</div>
                    <div style={{ color: "#5eead4", fontWeight: 800 }}>{row.score}</div>
                    <div style={{ color: shellText }}>{row.owner}</div>
                    <PreviewAnchor
                      href={`/preview/${encodeURIComponent(projectKey)}/pipeline`}
                      className={tactileClassName}
                      style={{ display: "inline-block", textDecoration: "none", borderRadius: 12, padding: "10px 12px", background: "rgba(20,184,166,0.16)", color: "#99f6e4", fontWeight: 800 }}
                    >
                      {isCn ? "分配" : "Assign"}
                    </PreviewAnchor>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}` }}>
                <div style={{ color: shellText, fontWeight: 900, fontSize: 18 }}>{isCn ? "线索资格轨道" : "Qualification rail"}</div>
                <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                  {routeExperienceModel.lanes.map((item) => (
                    <div key={item.title} style={{ borderRadius: 16, background: railBackground, padding: 14, border: `1px solid ${shellBorder}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ color: shellText, fontWeight: 800 }}>{item.title}</div>
                        <div style={{ color: "#99f6e4", fontSize: 12, fontWeight: 700 }}>{item.status}</div>
                      </div>
                      <div style={{ marginTop: 8, color: shellMuted, lineHeight: 1.6 }}>{item.meta}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}` }}>
                <div style={{ color: shellText, fontWeight: 900, fontSize: 18 }}>{isCn ? "来源占比" : "Source mix"}</div>
                <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                  {routeExperienceModel.bars.map((bar) => (
                    <div key={bar.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: shellMuted }}>
                        <span>{bar.label}</span>
                        <span style={{ color: shellText, fontWeight: 700 }}>{bar.value}%</span>
                      </div>
                      <div style={{ height: 10, borderRadius: 999, background: "#1b1f2b", overflow: "hidden" }}>
                        <div style={{ width: `${bar.value}%`, height: "100%", background: `linear-gradient(90deg, ${bar.color}, ${bar.color}cc)` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )
    }

    if (isCrmPreview && (routeKey === "orders" || routeKey === "customers" || routeKey === "reports" || routeKey === "automations")) {
      return (
        <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
          <section style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <div>
                    <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{routeExperienceModel.eyebrow}</div>
                    <h1 style={{ margin: "10px 0 0", color: shellText, fontSize: 32, fontWeight: 900 }}>{routeExperienceModel.headline}</h1>
                  </div>
                  <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}`} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", background: primaryCtaBackground, color: "#fff", fontWeight: 800 }}>
                    {isCn ? "返回总览" : "Back to overview"}
                  </PreviewAnchor>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
                {routeExperienceModel.metrics.map((item) => (
                  <div key={item.label} style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}` }}>
                    <div style={{ color: shellMuted, fontSize: 12 }}>{item.label}</div>
                    <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: item.tone }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <aside style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}`, display: "grid", alignContent: "start", gap: 12 }}>
              <div style={{ color: shellText, fontWeight: 900, fontSize: 18 }}>{isCn ? "动作轨道" : "Action rail"}</div>
              {routeExperienceModel.lanes.map((item) => (
                <PreviewAnchor
                  key={item.title}
                  href={`/preview/${encodeURIComponent(projectKey)}/${encodeURIComponent(routeKey)}`}
                  className={tactileClassName}
                  style={{ display: "block", textDecoration: "none", border: `1px solid ${shellBorder}`, borderRadius: 16, padding: "14px 14px", background: railBackground, textAlign: "left", color: shellText }}
                >
                  <div style={{ fontWeight: 800 }}>{item.title}</div>
                  <div style={{ marginTop: 8, color: shellMuted, lineHeight: 1.5 }}>{item.meta}</div>
                </PreviewAnchor>
              ))}
            </aside>
          </section>
        </div>
      )
    }

    if (isApiPreview && routeKey === "docs") {
      const chapters = [
        { title: isCn ? "Quickstart" : "Quickstart", meta: isCn ? "五分钟跑通第一个 token 和 SDK" : "First token and SDK in five minutes" },
        { title: isCn ? "认证与权限" : "Auth and scopes", meta: isCn ? "OAuth、API keys、环境边界" : "OAuth, API keys, and environment boundaries" },
        { title: isCn ? "Webhook 事件" : "Webhook events", meta: isCn ? "投递、重试、签名校验" : "Delivery, retries, and signature verification" },
      ]
      return (
        <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
          <section style={{ display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", gap: 16 }}>
            <aside style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}`, display: "grid", alignContent: "start", gap: 10 }}>
              <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{routeExperienceModel.eyebrow}</div>
              {chapters.map((chapter) => (
                <PreviewAnchor
                  key={chapter.title}
                  href={`/preview/${encodeURIComponent(projectKey)}/docs`}
                  className={tactileClassName}
                  style={{ display: "block", textDecoration: "none", border: `1px solid ${shellBorder}`, borderRadius: 16, padding: "14px 14px", background: railBackground, textAlign: "left", color: shellText }}
                >
                  <div style={{ fontWeight: 800 }}>{chapter.title}</div>
                  <div style={{ marginTop: 8, color: shellMuted, lineHeight: 1.5 }}>{chapter.meta}</div>
                </PreviewAnchor>
              ))}
            </aside>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <div>
                    <h1 style={{ margin: 0, color: shellText, fontSize: 34, fontWeight: 900 }}>{routeExperienceModel.headline}</h1>
                    <div style={{ marginTop: 10, color: shellMuted, lineHeight: 1.7 }}>{isCn ? "让开发者文档看起来像真正的 portal：左侧章节、右侧示例、底部交付状态。" : "Make the docs feel like a real developer portal: chapter rail, code examples, and delivery state."}</div>
                  </div>
                  <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}`} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", background: primaryCtaBackground, color: "#fff", fontWeight: 800 }}>
                    {isCn ? "返回总览" : "Back to overview"}
                  </PreviewAnchor>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
                <div style={{ ...cardStyle("#08111f"), border: `1px solid ${shellBorder}`, color: "#e2e8f0", boxShadow: "0 24px 60px rgba(15,23,42,0.24)" }}>
                  <div style={{ color: "rgba(226,232,240,0.58)", fontSize: 12 }}>POST /v1/events</div>
                  <pre style={{ margin: "16px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 13 }}>{`curl -X POST https://api.gatemesh.app/v1/events \\\n  -H "Authorization: Bearer gm_live_xxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{"type":"project.preview.ready","data":{"projectId":"proj_482"}}'`}</pre>
                </div>
                <div style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}` }}>
                  {routeExperienceModel.metrics.map((item) => (
                    <div key={item.label} style={{ marginBottom: 14 }}>
                      <div style={{ color: shellMuted, fontSize: 12 }}>{item.label}</div>
                      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, color: item.tone }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )
    }

    if (isApiPreview && (routeKey === "endpoints" || routeKey === "webhooks" || routeKey === "usage" || routeKey === "auth" || routeKey === "logs" || routeKey === "environments")) {
      return (
        <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
          <section style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
            <div style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{routeExperienceModel.eyebrow}</div>
                  <h1 style={{ margin: "10px 0 0", color: shellText, fontSize: 32, fontWeight: 900 }}>{routeExperienceModel.headline}</h1>
                </div>
                <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}`} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", background: primaryCtaBackground, color: "#fff", fontWeight: 800 }}>
                  {isCn ? "返回总览" : "Back to overview"}
                </PreviewAnchor>
              </div>
              <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
                {routeExperienceModel.lanes.map((item) => (
                  <div key={item.title} style={{ borderRadius: 16, background: railBackground, border: `1px solid ${shellBorder}`, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ color: shellText, fontWeight: 800 }}>{item.title}</div>
                      <div style={{ color: "#93c5fd", fontSize: 12, fontWeight: 700 }}>{item.status}</div>
                    </div>
                    <div style={{ marginTop: 8, color: shellMuted, lineHeight: 1.6 }}>{item.meta}</div>
                  </div>
                ))}
              </div>
            </div>
            <aside style={{ display: "grid", gap: 16 }}>
              <div style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}` }}>
                <div style={{ color: shellText, fontWeight: 900, fontSize: 18 }}>{isCn ? "运行指标" : "Runtime metrics"}</div>
                <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                  {routeExperienceModel.metrics.map((item) => (
                    <div key={item.label}>
                      <div style={{ color: shellMuted, fontSize: 12 }}>{item.label}</div>
                      <div style={{ marginTop: 8, fontSize: 26, fontWeight: 900, color: item.tone }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}` }}>
                <div style={{ color: shellText, fontWeight: 900, fontSize: 18 }}>{isCn ? "平台节奏" : "Platform cadence"}</div>
                <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                  {routeExperienceModel.bars.map((bar) => (
                    <div key={bar.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: shellMuted }}>
                        <span>{bar.label}</span>
                        <span style={{ color: shellText, fontWeight: 700 }}>{bar.value}%</span>
                      </div>
                      <div style={{ height: 10, borderRadius: 999, background: "#172032", overflow: "hidden" }}>
                        <div style={{ width: `${bar.value}%`, height: "100%", background: `linear-gradient(90deg, ${bar.color}, ${bar.color}cc)` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </section>
        </div>
      )
    }

    if (isMarketingPreview && (routeKey === "downloads" || routeKey === "devices")) {
      const deviceRows = [
        { label: "macOS", meta: isCn ? "通用包 + Apple Silicon" : "Universal + Apple Silicon", cta: isCn ? "下载 dmg" : "Download dmg" },
        { label: "Windows", meta: isCn ? "安装包 + zip 便携版" : "Installer + portable zip", cta: isCn ? "下载 exe" : "Download exe" },
        { label: isCn ? "移动端" : "Mobile", meta: isCn ? "Android / iOS 引导页" : "Android / iOS install guides", cta: isCn ? "查看安装" : "View install" },
      ]
      return (
        <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
          <section style={{ display: "grid", gap: 16 }}>
            <div style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}`, boxShadow: "0 20px 48px rgba(15,23,42,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{routeExperienceModel.eyebrow}</div>
                  <h1 style={{ margin: "10px 0 0", color: shellText, fontSize: 38, fontWeight: 900 }}>{routeExperienceModel.headline}</h1>
                </div>
                <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}`} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", background: primaryCtaBackground, color: "#fff", fontWeight: 800 }}>
                  {isCn ? "返回总览" : "Back to overview"}
                </PreviewAnchor>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
              {deviceRows.map((row) => (
                <div key={row.label} style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}`, boxShadow: "0 16px 40px rgba(15,23,42,0.08)" }}>
                  <div style={{ color: shellText, fontWeight: 900, fontSize: 24 }}>{row.label}</div>
                  <div style={{ marginTop: 10, color: shellMuted, lineHeight: 1.7 }}>{row.meta}</div>
                  <PreviewAnchor
                    href={row.label === (isCn ? "移动端" : "Mobile") ? `/preview/${encodeURIComponent(projectKey)}/docs` : `/preview/${encodeURIComponent(projectKey)}/downloads`}
                    className={tactileClassName}
                    style={{ display: "inline-block", marginTop: 18, textDecoration: "none", borderRadius: 14, padding: "12px 14px", background: primaryCtaBackground, color: "#fff", fontWeight: 800 }}
                  >
                    {row.cta}
                  </PreviewAnchor>
                </div>
              ))}
            </div>
          </section>
        </div>
      )
    }

    if (isMarketingPreview && (routeKey === "docs" || routeKey === "admin" || routeKey === "changelog" || routeKey === "website")) {
      return (
        <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
          <section style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 16 }}>
            <aside style={{ ...cardStyle("#0f172a"), color: "#e2e8f0", boxShadow: "0 24px 60px rgba(15,23,42,0.18)" }}>
              {routeExperienceModel.lanes.map((item) => (
                <div key={item.title} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 0 16px", marginBottom: 16 }}>
                  <div style={{ fontWeight: 800, color: "#fff" }}>{item.title}</div>
                  <div style={{ marginTop: 8, color: "rgba(226,232,240,0.66)", lineHeight: 1.6 }}>{item.meta}</div>
                </div>
              ))}
            </aside>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}`, boxShadow: "0 16px 40px rgba(15,23,42,0.08)" }}>
                <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{routeExperienceModel.eyebrow}</div>
                <h1 style={{ margin: "10px 0 0", color: shellText, fontSize: 34, fontWeight: 900 }}>{routeExperienceModel.headline}</h1>
                <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}`} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", background: primaryCtaBackground, color: "#fff", fontWeight: 800 }}>
                    {isCn ? "返回总览" : "Back to overview"}
                  </PreviewAnchor>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
                {routeExperienceModel.metrics.map((item) => (
                  <div key={item.label} style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}`, boxShadow: "0 16px 40px rgba(15,23,42,0.08)" }}>
                    <div style={{ color: shellMuted, fontSize: 12 }}>{item.label}</div>
                    <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: item.tone }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )
    }

    if (!isCrmPreview && !isApiPreview && (routeKey === "approvals" || routeKey === "security" || routeKey === "audit" || routeKey === "incidents")) {
      const controlSteps = [
        { label: isCn ? "识别" : "Identify", meta: isCn ? "队列里识别需要升级的动作" : "Identify items that need escalation" },
        { label: isCn ? "执行" : "Execute", meta: isCn ? "审批、权限或恢复动作落地" : "Run approval, access, or recovery actions" },
        { label: isCn ? "留痕" : "Record", meta: isCn ? "同步审计和后续复盘" : "Sync audit trail and postmortem context" },
      ]
      return (
        <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
          <section style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 16 }}>
            <div style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{routeExperienceModel.eyebrow}</div>
                  <h1 style={{ margin: "10px 0 0", color: shellText, fontSize: 34, fontWeight: 900 }}>{routeExperienceModel.headline}</h1>
                </div>
                <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}`} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", background: primaryCtaBackground, color: "#fff", fontWeight: 800 }}>
                  {isCn ? "返回总览" : "Back to overview"}
                </PreviewAnchor>
              </div>
              <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
                {controlSteps.map((step, index) => (
                  <div key={step.label} style={{ display: "grid", gridTemplateColumns: "42px 1fr", gap: 12, alignItems: "start" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(139,92,246,0.16)", color: "#ddd6fe", display: "grid", placeItems: "center", fontWeight: 900 }}>{index + 1}</div>
                    <div style={{ borderRadius: 18, background: railBackground, border: `1px solid ${shellBorder}`, padding: 14 }}>
                      <div style={{ color: shellText, fontWeight: 800 }}>{step.label}</div>
                      <div style={{ marginTop: 8, color: shellMuted, lineHeight: 1.6 }}>{step.meta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}` }}>
                {routeExperienceModel.metrics.map((item) => (
                  <div key={item.label} style={{ marginBottom: 14 }}>
                    <div style={{ color: shellMuted, fontSize: 12 }}>{item.label}</div>
                    <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, color: item.tone }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...cardStyle(cardBackground), border: `1px solid ${shellBorder}` }}>
                <div style={{ color: shellText, fontWeight: 900, fontSize: 18 }}>{isCn ? "控制平面对象" : "Control-plane objects"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {routeExperienceModel.lanes.map((item) => (
                    <div key={item.title} style={{ borderRadius: 16, background: railBackground, border: `1px solid ${shellBorder}`, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ color: shellText, fontWeight: 800 }}>{item.title}</div>
                        <div style={{ color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>{item.status}</div>
                      </div>
                      <div style={{ marginTop: 8, color: shellMuted, lineHeight: 1.6 }}>{item.meta}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )
    }

    if (isCrmPreview) {
      return (
        <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
          <section style={{ display: "grid", gridTemplateColumns: "260px minmax(0,1fr)", gap: 16 }}>
            <aside style={{ borderRadius: 24, background: railBackground, border: `1px solid ${shellBorder}`, padding: 18, display: "grid", alignContent: "start", gap: 12 }}>
              <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{routeExperienceModel.eyebrow}</div>
              <div style={{ fontSize: 26, lineHeight: 1.15, fontWeight: 900, color: shellText }}>{getNavLabel(`/${activePage}`, isCn)}</div>
              <div style={{ color: shellMuted, lineHeight: 1.7 }}>{routeExperienceModel.headline}</div>
              <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                {routes.slice(0, 7).map((route) => {
                  const routeKey = route.replace(/^\//, "")
                  const active = routeKey === activePage
                  return (
                    <PreviewAnchor
                      key={route}
                      href={routeKey === "dashboard" ? `/preview/${encodeURIComponent(projectKey)}` : `/preview/${encodeURIComponent(projectKey)}/${routeKey}`}
                      className={tactileClassName}
                      style={{
                        textDecoration: "none",
                        borderRadius: 16,
                        padding: "12px 14px",
                        background: active ? "linear-gradient(135deg,#0f766e,#14b8a6)" : "rgba(255,255,255,0.02)",
                        color: active ? "#fff" : shellText,
                        fontWeight: 800,
                        border: `1px solid ${active ? "rgba(20,184,166,0.44)" : shellBorder}`,
                      }}
                    >
                      {getNavLabel(route, isCn)}
                    </PreviewAnchor>
                  )
                })}
              </div>
            </aside>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ ...cardStyle(cardBackground), padding: 22, border: `1px solid ${shellBorder}`, boxShadow: "0 20px 48px rgba(15,23,42,0.24)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}>
                  <div>
                    <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{routeExperienceModel.eyebrow}</div>
                    <h1 style={{ margin: "10px 0 0", color: shellText, fontSize: 34, fontWeight: 900 }}>{routeExperienceModel.headline}</h1>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}`} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 16, padding: "13px 18px", background: primaryCtaBackground, color: "#fff", fontWeight: 800, boxShadow: "0 14px 28px rgba(20,184,166,0.28)" }}>
                      {isCn ? "返回总览" : "Back to overview"}
                    </PreviewAnchor>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
                {routeExperienceModel.metrics.map((item) => (
                  <div key={item.label} style={{ ...cardStyle(cardBackground), position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", right: -24, bottom: -28, width: 108, height: 108, borderRadius: "50%", background: `${item.tone}18` }} />
                    <div style={{ color: shellMuted, fontSize: 12, position: "relative" }}>{item.label}</div>
                    <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: item.tone }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 16 }}>
                <div style={{ ...cardStyle(cardBackground) }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{isCn ? "阶段推进" : "Stage progression"}</div>
                  <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
                    {routeExperienceModel.bars.map((bar) => (
                      <div key={bar.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: shellMuted }}>
                          <span>{bar.label}</span>
                          <span style={{ color: shellText, fontWeight: 700 }}>{bar.value}%</span>
                        </div>
                        <div style={{ height: 12, borderRadius: 999, background: "#1b1f2b", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, Math.max(12, bar.value))}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${bar.color}, ${bar.color}cc)` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ ...cardStyle(cardBackground) }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{isCn ? "关键对象" : "Live objects"}</div>
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {routeExperienceModel.lanes.map((item) => (
                      <div key={item.title} style={{ borderRadius: 18, background: railBackground, padding: 14, border: `1px solid ${shellBorder}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ fontWeight: 800, color: shellText }}>{item.title}</div>
                          <div style={{ color: "#99f6e4", fontSize: 12, fontWeight: 700 }}>{item.status}</div>
                        </div>
                        <div style={{ marginTop: 8, color: shellMuted, lineHeight: 1.6 }}>{item.meta}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )
    }

    if (isMarketingPreview || isCommunityPreview) {
      return (
        <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
          <section style={{ display: "grid", gap: 16 }}>
            <div style={{ ...cardStyle(cardBackground), padding: 24, border: `1px solid ${shellBorder}`, boxShadow: "0 20px 48px rgba(15,23,42,0.08)" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMarketingPreview ? "1.15fr 0.85fr" : "1fr", gap: 18, alignItems: "center" }}>
                <div>
                  <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{routeExperienceModel.eyebrow}</div>
                  <h1 style={{ margin: "10px 0 0", color: shellText, fontSize: isMarketingPreview ? 40 : 34, fontWeight: 900, lineHeight: 1.05 }}>{routeExperienceModel.headline}</h1>
                  <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}`} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 16, padding: "13px 18px", background: primaryCtaBackground, color: "#fff", fontWeight: 800, boxShadow: "0 14px 28px rgba(15,23,42,0.16)" }}>
                      {isCn ? "返回总览" : "Back to overview"}
                    </PreviewAnchor>
                    <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/${encodeURIComponent(activePage)}`} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 16, padding: "13px 18px", background: railBackground, color: shellText, fontWeight: 800, border: `1px solid ${shellBorder}` }}>
                      {getNavLabel(`/${activePage}`, isCn)}
                    </PreviewAnchor>
                  </div>
                </div>
                {isMarketingPreview ? (
                  <div style={{ ...cardStyle("#0f172a"), minHeight: 220, display: "grid", gap: 10, alignContent: "start", boxShadow: "0 24px 60px rgba(15,23,42,0.18)" }}>
                    {routeExperienceModel.lanes.map((item) => (
                      <div key={item.title} style={{ borderRadius: 16, background: "rgba(255,255,255,0.06)", padding: 14 }}>
                        <div style={{ color: "#fff", fontWeight: 800 }}>{item.title}</div>
                        <div style={{ marginTop: 6, color: "rgba(255,255,255,0.66)", lineHeight: 1.6 }}>{item.meta}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
              {routeExperienceModel.metrics.map((item) => (
                <div key={item.label} style={{ ...cardStyle(cardBackground), position: "relative", overflow: "hidden", boxShadow: "0 16px 40px rgba(15,23,42,0.08)" }}>
                  <div style={{ position: "absolute", right: -24, bottom: -28, width: 108, height: 108, borderRadius: "50%", background: `${item.tone}18` }} />
                  <div style={{ color: shellMuted, fontSize: 12, position: "relative" }}>{item.label}</div>
                  <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: item.tone }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ ...cardStyle(cardBackground), boxShadow: "0 16px 40px rgba(15,23,42,0.08)" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{isCn ? "当前节奏" : "Current rhythm"}</div>
                <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
                  {routeExperienceModel.bars.map((bar) => (
                    <div key={bar.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: shellMuted }}>
                        <span>{bar.label}</span>
                        <span style={{ color: shellText, fontWeight: 700 }}>{bar.value}%</span>
                      </div>
                      <div style={{ height: 12, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(100, Math.max(12, bar.value))}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${bar.color}, ${bar.color}cc)` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ ...cardStyle(cardBackground), boxShadow: "0 16px 40px rgba(15,23,42,0.08)" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{isCn ? "当前对象" : "Current objects"}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {routeExperienceModel.lanes.map((item) => (
                    <div key={item.title} style={{ borderRadius: 18, background: railBackground, padding: 14, border: `1px solid ${shellBorder}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 800, color: shellText }}>{item.title}</div>
                        <div style={{ color: "#7c3aed", fontSize: 12, fontWeight: 700 }}>{item.status}</div>
                      </div>
                      <div style={{ marginTop: 8, color: shellMuted, lineHeight: 1.6 }}>{item.meta}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )
    }

    return (
      <div style={{ borderRadius: 28, overflow: "hidden", border: `1px solid ${shellBorder}`, background: shellBackground, padding: 22 }}>
        <section style={{ display: "grid", gap: 16 }}>
          <div style={{ ...cardStyle(cardBackground), padding: 22, border: `1px solid ${shellBorder}`, boxShadow: routeExperienceModel.darkShell ? "0 20px 48px rgba(15,23,42,0.24)" : "0 20px 48px rgba(15,23,42,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}>
              <div>
                <div style={{ color: shellMuted, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>{routeExperienceModel.eyebrow}</div>
                <h1 style={{ margin: "10px 0 0", color: shellText, fontSize: 34, fontWeight: 900 }}>{routeExperienceModel.headline}</h1>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}`} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 16, padding: "13px 18px", background: primaryCtaBackground, color: "#fff", fontWeight: 800, boxShadow: routeExperienceModel.darkShell ? "0 14px 28px rgba(139,92,246,0.3)" : "0 14px 28px rgba(15,23,42,0.18)" }}>
                  {isCn ? "返回总览" : "Back to overview"}
                </PreviewAnchor>
                <PreviewAnchor href={`/preview/${encodeURIComponent(projectKey)}/${encodeURIComponent(activePage)}`} className={tactileClassName} style={{ textDecoration: "none", borderRadius: 16, padding: "13px 18px", background: railBackground, color: shellText, fontWeight: 800, border: `1px solid ${shellBorder}` }}>
                  {getNavLabel(`/${activePage}`, isCn)}
                </PreviewAnchor>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
            {routeExperienceModel.metrics.map((item) => (
              <div key={item.label} style={{ ...cardStyle(cardBackground), position: "relative", overflow: "hidden", boxShadow: routeExperienceModel.darkShell ? "none" : "0 16px 40px rgba(15,23,42,0.08)" }}>
                <div style={{ position: "absolute", right: -24, bottom: -28, width: 108, height: 108, borderRadius: "50%", background: `${item.tone}18` }} />
                <div style={{ color: shellMuted, fontSize: 12, position: "relative" }}>{item.label}</div>
                <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: item.tone }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 16 }}>
            <div style={{ ...cardStyle(cardBackground), boxShadow: routeExperienceModel.darkShell ? "none" : "0 16px 40px rgba(15,23,42,0.08)" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{isCn ? "当前推进" : "Current progress"}</div>
              <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
                {routeExperienceModel.bars.map((bar) => (
                  <div key={bar.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: shellMuted }}>
                      <span>{bar.label}</span>
                      <span style={{ color: shellText, fontWeight: 700 }}>{bar.value}%</span>
                    </div>
                    <div style={{ height: 12, borderRadius: 999, background: routeExperienceModel.darkShell ? "#1b1f2b" : "#e2e8f0", overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, Math.max(12, bar.value))}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${bar.color}, ${bar.color}cc)` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ ...cardStyle(cardBackground), boxShadow: routeExperienceModel.darkShell ? "none" : "0 16px 40px rgba(15,23,42,0.08)" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: shellText }}>{isCn ? "当前对象" : "Current objects"}</div>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {routeExperienceModel.lanes.map((item) => (
                  <div key={item.title} style={{ borderRadius: 18, background: railBackground, padding: 14, border: `1px solid ${shellBorder}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ fontWeight: 800, color: shellText }}>{item.title}</div>
                      <div style={{ color: routeExperienceModel.darkShell ? "#c4b5fd" : "#7c3aed", fontSize: 12, fontWeight: 700 }}>{item.status}</div>
                    </div>
                    <div style={{ marginTop: 8, color: shellMuted, lineHeight: 1.6 }}>{item.meta}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {renderPreviewTaskSurface({ dark: routeExperienceModel.darkShell })}
        </section>
      </div>
    )
  }

  const renderEditor = () => (
    <div style={{ display: "grid", gridTemplateColumns: "72px 250px minmax(0,1fr) 320px", minHeight: 820, borderRadius: 24, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#14161d" }}>
      <aside style={{ background: "#101119", borderRight: "1px solid rgba(255,255,255,0.06)", padding: "18px 10px", display: "grid", alignContent: "start", gap: 12 }}>
        {[
          { id: "explorer", glyph: "◫" },
          { id: "search", glyph: "⌘" },
          { id: "runs", glyph: "▣" },
          { id: "settings", glyph: "⚙" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActivityView(item.id as typeof activityView)}
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              background: activityView === item.id ? "rgba(124,58,237,0.22)" : "#1b1d28",
              color: "#f8fafc",
              margin: "0 auto",
              border: "none",
              cursor: "pointer",
            }}
          >
            {item.glyph}
          </button>
        ))}
      </aside>
      <aside style={{ background: "#12141d", borderRight: "1px solid rgba(255,255,255,0.06)", padding: 16 }}>
        <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 12 }}>
          {activityView === "explorer"
            ? isCn ? "文件树" : "File tree"
            : activityView === "search"
              ? isCn ? "命令与搜索" : "Command and search"
              : activityView === "runs"
                ? isCn ? "运行状态" : "Runtime state"
                : isCn ? "设置" : "Settings"}
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {activityView === "explorer" ? (
            Array.from(new Set(workbenchFiles.map((item) => item.group))).map((group) => (
              <div key={group}>
                <div style={{ color: "rgba(255,255,255,0.36)", fontSize: 11, textTransform: "uppercase" }}>{group}</div>
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  {workbenchFiles.filter((item) => item.group === group).map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => {
                        setSelectedFileId(file.id)
                        setOpenFileIds((current) => (current.includes(file.id) ? current : [...current, file.id]))
                      }}
                      style={{
                        borderRadius: 12,
                        padding: "10px 12px",
                        background: selectedFile?.id === file.id ? "rgba(124,58,237,0.18)" : "transparent",
                        color: selectedFile?.id === file.id ? "#f8fafc" : "rgba(255,255,255,0.72)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div>{file.label}</div>
                      <div style={{ marginTop: 4, color: "rgba(255,255,255,0.38)", fontSize: 11 }}>{file.path}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : activityView === "search" ? (
            [
              isCn ? "Open editor / 切到编辑器主区" : "Open editor / jump to the editor core",
              isCn ? "Fix preview / 优先修复预览与运行态" : "Fix preview / stabilize preview and runtime",
              isCn ? "Generate templates / 增强模板与交付结构" : "Generate templates / deepen templates and delivery",
            ].map((item) => (
              <div key={item} style={{ borderRadius: 12, background: "#1a1d29", padding: "12px 14px", color: "rgba(255,255,255,0.74)" }}>{item}</div>
            ))
          ) : activityView === "runs" ? (
            runRows.map((item) => (
              <div key={item.id} style={{ borderRadius: 12, background: "#1a1d29", padding: "12px 14px" }}>
                <div style={{ color: "#fff", fontWeight: 700 }}>{item.action}</div>
                <div style={{ marginTop: 4, color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{item.branch} · {item.status}</div>
              </div>
            ))
          ) : (
            [
              isCn ? "可见性：团队内" : "Visibility: workspace",
              isCn ? "预览模式：canonical 优先" : "Preview mode: canonical first",
              isCn ? "增强模式：sandbox 可选" : "Enhancement mode: sandbox optional",
            ].map((item) => (
              <div key={item} style={{ borderRadius: 12, background: "#1a1d29", padding: "12px 14px", color: "rgba(255,255,255,0.74)" }}>{item}</div>
            ))
          )}
        </div>
      </aside>
      <section style={{ display: "grid", gridTemplateRows: "auto 1fr auto", background: "#171923" }}>
        <div style={{ display: "flex", gap: 8, padding: 14, borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
          {openFileIds.map((fileId) => {
            const file = workbenchFiles.find((item) => item.id === fileId)
            if (!file) return null
            const active = file.id === selectedFile?.id
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => setSelectedFileId(file.id)}
                style={{
                  borderRadius: 12,
                  padding: "10px 14px",
                  background: active ? "#232638" : "#191c29",
                  color: active ? "#fff" : "rgba(255,255,255,0.62)",
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {file.label}
              </button>
            )
          })}
        </div>
        <div style={{ padding: 18, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#dbe4ff", fontSize: 13, lineHeight: 1.85, whiteSpace: "pre-wrap" }}>
          {selectedFile?.content}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#11131a" }}>
          <div style={{ display: "flex", gap: 16, padding: "10px 14px", color: "rgba(255,255,255,0.66)", fontSize: 13 }}>
            {[
              { key: "terminal", label: isCn ? "终端" : "Terminal" },
              { key: "problems", label: isCn ? "问题" : "Problems" },
              { key: "output", label: isCn ? "输出" : "Output" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTerminalTab(item.key as typeof terminalTab)}
                style={{ color: terminalTab === item.key ? "#fff" : "rgba(255,255,255,0.66)", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div style={{ padding: "0 14px 16px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, lineHeight: 1.9 }}>
            {activeTerminalOutput.map((line) => (
              <div key={line} style={{ color: line.startsWith("$") ? "#cbd5e1" : line.includes("ok") || line.includes("ready") || line.includes("就绪") ? "#22c55e" : line.includes("Fix") || line.includes("修复") ? "#f59e0b" : "#94a3b8" }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      </section>
      <aside style={{ background: "#161821", borderLeft: "1px solid rgba(255,255,255,0.06)", padding: 16, display: "grid", alignContent: "start", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{isCn ? "AI 助手" : "AI Assistant"}</div>
          <div style={{ borderRadius: 999, padding: "4px 8px", background: "rgba(124,58,237,0.18)", color: "#d8b4fe", fontSize: 12 }}>{isCn ? "文件上下文" : "File context"}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { key: "explain", label: isCn ? "解释" : "Explain" },
            { key: "fix", label: isCn ? "修复" : "Fix" },
            { key: "generate", label: isCn ? "生成" : "Generate" },
            { key: "refactor", label: isCn ? "重构" : "Refactor" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setAiMode(item.key as typeof aiMode)}
              style={{
                borderRadius: 12,
                padding: "12px 14px",
                background: aiMode === item.key ? "rgba(124,58,237,0.22)" : "#1f2230",
                color: aiMode === item.key ? "#fff" : "rgba(255,255,255,0.68)",
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div style={cardStyle("#1b1e2a")}>
          <div style={{ color: "#c4b5fd", fontWeight: 800 }}>{selectedFile?.path ?? presentation.displayName}</div>
          <p style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", lineHeight: 1.7 }}>{aiContextText[aiMode]}</p>
        </div>
        <div style={cardStyle("#1b1e2a")}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.52)" }}>{isCn ? "当前动作结果" : "Current action result"}</div>
          <div style={{ marginTop: 8, fontWeight: 700 }}>{isCn ? "Preview / Dashboard / Code 已联动刷新" : "Preview / Dashboard / Code have been refreshed together"}</div>
        </div>
      </aside>
    </div>
  )

  const renderRuns = () => (
    <div style={{ display: "grid", gap: 18 }}>
      <section style={cardStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{isCn ? "运行链路" : "Runtime flow"}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { key: "all", label: isCn ? "全部" : "All" },
              { key: "running", label: isCn ? "运行中" : "Running" },
              { key: "failed", label: isCn ? "失败" : "Failed" },
              { key: "ready", label: isCn ? "成功" : "Ready" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRunsFilter(item.key as typeof runsFilter)}
                style={{
                  borderRadius: 999,
                  padding: "8px 12px",
                  background: runsFilter === item.key ? "rgba(124,58,237,0.18)" : "#1b1f2c",
                  color: runsFilter === item.key ? "#fff" : "rgba(255,255,255,0.66)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {visibleRuns.map((item) => (
            <div key={item.id} style={{ borderRadius: 16, background: "#171b27", padding: 14, display: "grid", gridTemplateColumns: "1.2fr 1fr 120px 140px", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800 }}>{item.action}</div>
                <div style={{ marginTop: 4, color: "rgba(255,255,255,0.48)", fontSize: 12 }}>{item.branch}</div>
              </div>
              <div style={{ color: "rgba(255,255,255,0.72)" }}>{formatDate(item.updatedAt, locale)}</div>
              <div style={{ color: item.status === "failed" ? "#f87171" : item.status === "running" ? "#38bdf8" : "#22c55e", fontWeight: 800 }}>{item.status}</div>
              <div style={{ color: "rgba(255,255,255,0.72)" }}>{item.duration}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )

  const renderTemplates = () => (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { key: "product", label: isCn ? "产品" : "Product" },
          { key: "ops", label: isCn ? "运营" : "Ops" },
          { key: "data", label: isCn ? "数据" : "Data" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTemplateCategory(item.key as typeof templateCategory)}
            style={{
              borderRadius: 999,
              padding: "8px 12px",
              background: templateCategory === item.key ? "rgba(124,58,237,0.18)" : "#171b27",
              color: templateCategory === item.key ? "#fff" : "rgba(255,255,255,0.66)",
              border: "1px solid rgba(255,255,255,0.08)",
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 16 }}>
        {activeTemplateGroup.map(([title, desc], index) => (
          <div key={title} style={{ ...cardStyle(index === 0 ? "rgba(124,58,237,0.14)" : "#14161f"), minHeight: 180 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
            <p style={{ marginTop: 10, color: "rgba(255,255,255,0.66)", lineHeight: 1.8 }}>{desc}</p>
            <button type="button" style={{ marginTop: 18, borderRadius: 12, padding: "10px 14px", background: "#1f2230", color: "#fff", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
              {isCn ? "使用模板" : "Use template"}
            </button>
          </div>
        ))}
      </div>
    </div>
  )

  const renderPricing = () => (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { key: "free", label: isCn ? "免费版" : "Free" },
          { key: "starter", label: isCn ? "启动版" : "Starter" },
          { key: "builder", label: isCn ? "建造者版" : "Builder" },
          { key: "pro", label: isCn ? "专业版" : "Pro" },
          { key: "elite", label: isCn ? "精英版" : "Elite" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPricingFocus(item.key as typeof pricingFocus)}
            style={{
              borderRadius: 999,
              padding: "8px 12px",
              background: pricingFocus === item.key ? "rgba(124,58,237,0.18)" : "#171b27",
              color: pricingFocus === item.key ? "#fff" : "rgba(255,255,255,0.66)",
              border: "1px solid rgba(255,255,255,0.08)",
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>
        {(isCn
          ? [
              ["free", "免费版", "基础生成与 canonical preview，代码仅在线查看，数据库仅在线试用"],
              ["starter", "启动版", "保留稳定生成和单子域名位，仍然不开放代码导出"],
              ["builder", "建造者版", "开始开放更厚的多页面、manifest 导出和更多业务模块"],
              ["pro", "专业版", "更强多页面结构、正式数据库接入与完整导出"],
              ["elite", "精英版", "更完整工作台、AI 联动、高保真输出与交接能力"],
            ]
          : [
              ["free", "Free", "Core generation and canonical preview, with code kept online and DB online-only"],
              ["starter", "Starter", "Stable generation and one reserved subdomain slot, but still no code export"],
              ["builder", "Builder", "Thicker multi-page apps, manifest export, and more business modules"],
              ["pro", "Pro", "Richer delivery depth with production DB access and full export"],
              ["elite", "Elite", "Deeper workspace, AI loops, showcase output, and handoff-ready delivery"],
            ]).map(([key, title, desc]) => (
          <div
            key={key}
            style={{
              ...cardStyle(pricingFocus === key ? "rgba(124,58,237,0.14)" : "#14161f"),
              boxShadow: pricingFocus === key ? "0 0 0 1px rgba(124,58,237,0.18) inset" : "none",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900 }}>{title}</div>
            <p style={{ marginTop: 10, color: "rgba(255,255,255,0.66)", lineHeight: 1.8 }}>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )

  const renderCurrentPage = () => {
    if (activePage === "editor") return renderEditor()
    if (activePage === "runs") return renderRuns()
    if (activePage === "templates") return renderTemplates()
    if (activePage === "pricing") return renderPricing()
    if (activePage !== "dashboard" && routeExperienceModel) return renderRouteWorkspace()
    return renderDashboard()
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: previewShellBackground,
        color: previewHeaderText,
        padding: previewShellIsLight ? 28 : 24,
        fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth:
            previewLayoutVariant === "story_stack"
              ? 1380
              : previewLayoutVariant === "marketing_split"
                ? 1500
                : previewLayoutVariant === "docs_console"
                  ? 1520
                  : 1460,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <header
          style={{
            ...cardStyle(previewHeaderBackground),
            border: previewHeaderBorder,
            padding: isMarketingPreview ? "18px 22px" : "16px 18px",
            display: "flex",
            justifyContent: previewHeaderJustify,
            flexDirection: previewHeaderDirection,
            alignItems: previewHeaderDirection === "column" ? "stretch" : "center",
            gap: 16,
            boxShadow: previewShellIsLight ? "0 16px 40px rgba(15,23,42,0.08)" : "0 12px 28px rgba(15,23,42,0.18)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, width: previewHeaderDirection === "column" ? "100%" : "auto" }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", fontSize: 20, background: `linear-gradient(135deg, ${presentation.icon.from}, ${presentation.icon.to})`, boxShadow: `0 0 0 1px ${presentation.icon.ring}` }}>
              {presentation.icon.glyph}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: previewHeaderText }}>{presentation.displayName}</div>
              <div style={{ fontSize: 12, color: previewHeaderMuted }}>{presentation.subtitle}</div>
            </div>
          </div>
          <nav
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: previewHeaderNavJustify,
              width: previewHeaderDirection === "column" ? "100%" : "auto",
            }}
          >
            {routes.map((route) => {
              const routeKey = route.replace(/^\//, "")
              const active = routeKey === activePage || (activePage === "" && routeKey === "dashboard")
              return (
                <PreviewAnchor
                  key={route}
                  href={routeKey === "dashboard" ? `/preview/${encodeURIComponent(projectKey)}` : `/preview/${encodeURIComponent(projectKey)}/${routeKey}`}
                  className={tactileClassName}
                  style={{
                    textDecoration: "none",
                    borderRadius: 12,
                    padding: "10px 14px",
                    background: active ? previewNavActiveBackground : "transparent",
                    color: active ? previewNavActiveColor : previewNavIdle,
                    fontSize: 14,
                    fontWeight: 700,
                    border: active ? "1px solid rgba(124,58,237,0.3)" : previewNavBorder,
                  }}
                >
                  {getNavLabel(route, isCn)}
                </PreviewAnchor>
              )
            })}
          </nav>
        </header>
        {renderCurrentPage()}
      </div>
    </main>
  )
}
