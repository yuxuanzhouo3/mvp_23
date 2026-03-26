"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

type PreviewSpec = {
  title?: string
  kind?: string
  planTier?: string
  modules?: string[]
  features?: string[]
  deploymentTarget?: string
  databaseTarget?: string
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
  region: "cn" | "intl"
  page: string
  spec: PreviewSpec
  presentation: PreviewPresentation
  history: PreviewHistoryItem[]
}

type PreviewFile = {
  id: string
  group: string
  label: string
  path: string
  content: string
}

function titleCase(input: string) {
  return input.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function getNavLabel(route: string, isCn: boolean) {
  const key = route.replace(/^\//, "")
  const labels: Record<string, { cn: string; en: string }> = {
    dashboard: { cn: "总览", en: "Dashboard" },
    editor: { cn: "编辑器", en: "Editor" },
    runs: { cn: "运行", en: "Runs" },
    templates: { cn: "模板库", en: "Templates" },
    pricing: { cn: "升级", en: "Pricing" },
    settings: { cn: "设置", en: "Settings" },
    home: { cn: "首页", en: "Home" },
  }
  return isCn ? labels[key]?.cn ?? titleCase(key) : labels[key]?.en ?? titleCase(key)
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

function cardStyle(background = "#13151d") {
  return {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background,
    padding: 18,
  } as const
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
  region,
  page,
  spec,
  presentation,
  history,
}: CanonicalPreviewPageProps) {
  const isCn = region === "cn"
  const locale = isCn ? "zh-CN" : "en-US"
  const activePage = page || (presentation.routes[0] ? presentation.routes[0].replace(/^\//, "") : "dashboard")
  const routes = presentation.routes.length ? presentation.routes : ["/dashboard", "/editor", "/runs", "/templates", "/pricing"]
  const latestHistory = history[0]
  const basePageSummary =
    latestHistory?.summary ||
    presentation.summary ||
    (isCn ? "已生成可演示的产品骨架。" : "A demo-ready product scaffold has been generated.")

  const dashboardSections = useMemo(() => {
    if (spec?.kind === "crm") {
      return isCn
        ? ["概览", "线索", "自动化", "分析", "权限", "设置"]
        : ["Overview", "Leads", "Automations", "Analytics", "Access", "Settings"]
    }
    if (spec?.kind === "api_platform") {
      return isCn
        ? ["概览", "Endpoints", "日志", "鉴权", "环境", "设置"]
        : ["Overview", "Endpoints", "Logs", "Auth", "Environments", "Settings"]
    }
    if (spec?.kind === "community") {
      return isCn
        ? ["概览", "反馈", "公告", "成员", "自动化", "设置"]
        : ["Overview", "Feedback", "Announcements", "Members", "Automations", "Settings"]
    }
    if (spec?.kind === "blog") {
      return isCn
        ? ["概览", "内容", "下载", "文档", "定价", "设置"]
        : ["Overview", "Content", "Downloads", "Docs", "Pricing", "Settings"]
    }
    return isCn
      ? ["概览", "用户", "数据", "集成", "安全", "设置"]
      : ["Overview", "Users", "Data", "Integrations", "Security", "Settings"]
  }, [isCn, spec?.kind])
  const [dashboardSection, setDashboardSection] = useState(dashboardSections[0] || "Overview")

  const workbenchFiles = useMemo(
    () =>
      buildWorkbenchFiles({
        kind: spec?.kind,
        brand: presentation.displayName,
        region,
        isCn,
      }),
    [isCn, presentation.displayName, region, spec?.kind]
  )
  const [selectedFileId, setSelectedFileId] = useState(workbenchFiles[0]?.id ?? "")
  const [openFileIds, setOpenFileIds] = useState(workbenchFiles.slice(0, 3).map((item) => item.id))
  const [activityView, setActivityView] = useState<"explorer" | "search" | "runs" | "settings">("explorer")
  const [terminalTab, setTerminalTab] = useState<"terminal" | "problems" | "output">("terminal")
  const [aiMode, setAiMode] = useState<"explain" | "fix" | "generate" | "refactor">("generate")
  const [runsFilter, setRunsFilter] = useState<"all" | "running" | "failed" | "ready">("all")
  const [templateCategory, setTemplateCategory] = useState<"product" | "ops" | "data">("product")
  const [pricingFocus, setPricingFocus] = useState<"free" | "pro" | "elite">("pro")

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

  const runRows = [
    { id: "run-1", status: "ready", branch: "main", action: isCn ? "生成应用骨架" : "Generate scaffold", duration: "1m 24s", updatedAt: "2026-03-26T12:00:00.000Z" },
    { id: "run-2", status: "running", branch: "workspace-preview", action: isCn ? "启动 sandbox preview" : "Start sandbox preview", duration: "32s", updatedAt: "2026-03-26T12:06:00.000Z" },
    { id: "run-3", status: "failed", branch: "hotfix/preview", action: isCn ? "修复预览路由" : "Fix preview routing", duration: "54s", updatedAt: "2026-03-26T12:09:00.000Z" },
  ]
  const visibleRuns = runRows.filter((item) => runsFilter === "all" || item.status === runsFilter)

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

  const renderDashboard = () => (
    <div style={{ display: "grid", gridTemplateColumns: "250px minmax(0,1fr)", gap: 18 }}>
      <aside style={cardStyle("#12151d")}>
        <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 12 }}>{isCn ? "控制台导航" : "Console navigation"}</div>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {dashboardSections.map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => setDashboardSection(section)}
              style={{
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.08)",
                background: dashboardSection === section ? "rgba(124,58,237,0.18)" : "#181b25",
                color: dashboardSection === section ? "#fff" : "rgba(255,255,255,0.72)",
                padding: "12px 14px",
                textAlign: "left",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {section}
            </button>
          ))}
        </div>
      </aside>
      <section style={{ display: "grid", gap: 16 }}>
        <div style={{ ...cardStyle("radial-gradient(circle at top left, rgba(124,58,237,0.22), transparent 32%), #171922)"), padding: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "88px 1fr auto", gap: 18, alignItems: "center" }}>
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 24,
                display: "grid",
                placeItems: "center",
                fontSize: 36,
                color: "#fff",
                background: `linear-gradient(135deg, ${presentation.icon.from}, ${presentation.icon.to})`,
                boxShadow: `0 0 0 1px ${presentation.icon.ring}`,
              }}
            >
              {presentation.icon.glyph}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>{presentation.displayName}</h1>
              <p style={{ margin: "10px 0 0", maxWidth: 860, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
                {presentation.subtitle} · {basePageSummary}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Link href={`/preview/${encodeURIComponent(projectId)}/editor`} style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", background: "#8b5cf6", color: "#fff", fontWeight: 800 }}>
                {isCn ? "Open App" : "Open App"}
              </Link>
              <button type="button" onClick={() => setDashboardSection(isCn ? "设置" : "Settings")} style={{ borderRadius: 14, padding: "12px 16px", background: "#1d2130", color: "#f8fafc", fontWeight: 700, border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
                {isCn ? "Share / Settings" : "Share / Settings"}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
          {[
            { label: isCn ? "产品类型" : "Product type", value: spec?.kind ?? "workspace", color: "#8b5cf6" },
            { label: isCn ? "部署环境" : "Deployment", value: spec?.deploymentTarget ?? "cloudbase", color: "#22c55e" },
            { label: isCn ? "数据方案" : "Data path", value: spec?.databaseTarget ?? "cloudbase_document", color: "#38bdf8" },
            { label: isCn ? "当前控制块" : "Active block", value: dashboardSection, color: "#f59e0b" },
          ].map((item) => (
            <div key={item.label} style={cardStyle()}>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{item.label}</div>
              <div style={{ marginTop: 10, fontSize: 24, fontWeight: 900, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
          <div style={cardStyle()}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "项目控制台" : "Workspace controls"}</div>
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {[
              isCn ? `当前展示 ${dashboardSection} 控制块，适合演示给老板或客户。` : `Showing the ${dashboardSection} control block for stakeholder demos.`,
              spec?.kind === "crm"
                ? isCn ? "当前控制台偏向线索、自动化和团队交付，不再伪装成代码平台。" : "This console leans into leads, automations, and team handoff instead of pretending to be a coding platform."
                : spec?.kind === "community"
                  ? isCn ? "当前控制台偏向反馈、公告与成员运营，更像社区工作台。" : "This console leans into feedback, announcements, and member ops like a community workspace."
                  : spec?.kind === "blog"
                    ? isCn ? "当前控制台偏向内容、下载与文档分发，更像营销与内容后台。" : "This console leans into content, downloads, and docs distribution like a marketing workspace."
                    : isCn ? "主站、文档、admin 宣传资产和 market 分发路径已收口到工作台里。" : "Site, docs, admin assets, and market delivery routes are unified in this workspace.",
              isCn ? "不同 app 类型会切换不同控制重心，不再只是同壳换标题。" : "Different app types now shift their control center instead of just renaming the same shell.",
            ].map((item) => (
              <div key={item} style={{ borderRadius: 16, background: "#1b1f2b", padding: "14px 16px", color: "rgba(255,255,255,0.78)", lineHeight: 1.7 }}>
                {item}
                </div>
              ))}
            </div>
          </div>
          <div style={cardStyle()}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "最近变更" : "Recent changes"}</div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {history.length ? history.slice(0, 3).map((item) => (
                <div key={`${item.type}-${item.createdAt}`} style={{ borderRadius: 16, background: "#1b1f2b", padding: 12 }}>
                  <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 12 }}>{item.type} · {formatDate(item.createdAt, locale)}</div>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>{item.summary || basePageSummary}</div>
                </div>
              )) : (
                <div style={{ color: "rgba(255,255,255,0.6)" }}>{isCn ? "暂无变更记录" : "No history yet"}</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )

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
            {terminalOutput[terminalTab].map((line) => (
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
        {templateGroups[templateCategory].map(([title, desc], index) => (
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
        {(isCn
          ? [
              ["free", "免费版", "基础生成与 canonical preview"],
              ["pro", "专业版", "更强多页面结构、模板深度与交付块"],
              ["elite", "精英版", "更完整工作台、AI 联动与高保真输出"],
            ]
          : [
              ["free", "Free", "Core generation and canonical preview"],
              ["pro", "Pro", "Richer multi-page, templates, and delivery"],
              ["elite", "Elite", "Deeper workspace, AI loops, and showcase output"],
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
    return renderDashboard()
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#0d0f15 0%,#131722 100%)", color: "#f8fafc", padding: 24, fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
      <div style={{ maxWidth: 1460, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ ...cardStyle("#141722"), padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", fontSize: 20, background: `linear-gradient(135deg, ${presentation.icon.from}, ${presentation.icon.to})`, boxShadow: `0 0 0 1px ${presentation.icon.ring}` }}>
              {presentation.icon.glyph}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>{presentation.displayName}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{presentation.subtitle}</div>
            </div>
          </div>
          <nav style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {routes.map((route) => {
              const routeKey = route.replace(/^\//, "")
              const active = routeKey === activePage || (activePage === "" && routeKey === "dashboard")
              return (
                <Link
                  key={route}
                  href={routeKey === "dashboard" ? `/preview/${encodeURIComponent(projectId)}` : `/preview/${encodeURIComponent(projectId)}/${routeKey}`}
                  style={{
                    textDecoration: "none",
                    borderRadius: 12,
                    padding: "10px 14px",
                    background: active ? "rgba(124,58,237,0.22)" : "transparent",
                    color: active ? "#fff" : "rgba(255,255,255,0.62)",
                    fontSize: 14,
                    fontWeight: 700,
                    border: active ? "1px solid rgba(124,58,237,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {getNavLabel(route, isCn)}
                </Link>
              )
            })}
          </nav>
        </header>
        {renderCurrentPage()}
      </div>
    </main>
  )
}
