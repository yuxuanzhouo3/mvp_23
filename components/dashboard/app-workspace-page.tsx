"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Square,
  SquareTerminal,
  Undo2,
  Wand2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  getDatabaseEnvGuide,
  getDatabaseOption,
  getDeploymentEnvGuide,
  getDeploymentOption,
  normalizeDatabaseTarget,
  normalizeDeploymentTarget,
} from "@/lib/fullstack-targets"
import { getPlanPriceLabel, PLAN_CATALOG, type PlanTier } from "@/lib/plan-catalog"
import { buildCanonicalPreviewUrl, buildRuntimePreviewUrl, buildSandboxPreviewUrl, getResolvedPreviewUrl } from "@/lib/preview-url"
import {
  PREVIEW_SNAPSHOT_STORAGE_KEY,
  buildPreviewSnapshotAliases,
  type PreviewSnapshot,
} from "@/lib/preview-snapshot"
import { isWorkspaceEditorAiSource } from "@/lib/workspace-editor-link"
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

type RuntimeState = {
  status: "stopped" | "starting" | "running" | "error"
  mode?: "dev" | "prod"
  pid?: number
  port?: number
  url?: string
  lastError?: string
}

type HistoryItem = {
  id: string
  type: "generate" | "iterate"
  prompt: string
  createdAt: string
  status: "done" | "error"
  summary?: string
  changedFiles?: string[]
  buildStatus?: "ok" | "failed" | "skipped"
  error?: string
}

type ProjectDetail = {
  projectId: string
  projectSlug?: string
  createdAt: string
  updatedAt: string
  region: "cn" | "intl"
  deploymentTarget?: string
  databaseTarget?: string
  workspacePath: string
  spec?: {
    title?: string
    kind?: string
    modules?: string[]
    features?: string[]
    deploymentTarget?: string
    databaseTarget?: string
  } | null
  presentation?: {
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
  generation?: {
    status: "done" | "error" | "idle"
    summary: string
    buildStatus: "ok" | "failed" | "skipped" | null
    buildLogs?: string[]
    createdAt?: string | null
  }
  preview?: {
    defaultMode: "static_ssr"
    activeMode: "static_ssr" | "dynamic_runtime" | "sandbox_runtime"
    status: "idle" | "building" | "ready" | "failed"
    canonicalUrl: string
    runtimeUrl: string
    sandboxUrl: string | null
    resolvedUrl?: string
    fallbackReason?: string
    sandboxExternalUrl?: string | null
    sandboxStatus: "stopped" | "starting" | "running" | "error"
    supportsDynamicRuntime: boolean
    supportsSandboxRuntime: boolean
    sandboxReadiness?: {
      supported: boolean
      reason: string
      authMode: "oidc" | "token" | "missing"
    }
  }
  runtime?: RuntimeState
  history: HistoryItem[]
}

type IterateResp = {
  projectId: string
  status: "done" | "error"
  summary?: string
  thinking?: string
  changedFiles?: string[]
  build?: { status: "ok" | "failed" | "skipped"; logs?: string[] }
  warning?: string
  context?: {
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
  error?: string
}

type GenerateTaskResp = {
  projectId?: string
  jobId: string
  status: "queued" | "running" | "done" | "error"
  logs?: string[]
  summary?: string
  changedFiles?: string[]
  buildStatus?: "ok" | "failed" | "skipped"
  buildLogs?: string[]
  templateTitle?: string
  error?: string
}

type ProjectFilesResp = {
  projectId: string
  files: string[]
}

type ProjectFileContentResp = {
  projectId: string
  path: string
  content: string
  symbols?: Array<{ kind: string; name: string; line: number }>
}

type ProjectFileSaveResp = {
  projectId: string
  path: string
  saved: boolean
}

type WorkspaceCommand = {
  id: string
  label: string
  description: string
  action: "open-file" | "switch-tab" | "restart-preview" | "open-preview"
  target?: string
  line?: number
}

type WorkspaceSearchResp = {
  projectId: string
  query: string
  results: Array<{
    path: string
    matches: Array<{ line: number; preview: string }>
    symbols: Array<{ kind: string; name: string; line: number }>
  }>
}

type FileTreeNode = {
  name: string
  path: string
  children: Map<string, FileTreeNode>
  isFile: boolean
}

type PreviewProbeState = {
  projectSlug: string
  previewMode: "static_ssr" | "dynamic_runtime" | "sandbox_runtime"
  previewStatus: "idle" | "building" | "ready" | "failed"
  canonicalPreviewUrl: string
  runtimePreviewUrl: string
  sandboxPreviewUrl: string
  resolvedPreviewUrl: string
  fallbackUsed: boolean
  responseStatus: number | null
  renderStrategy: "iframe" | "structured_fallback"
  responseUrl?: string
}

type AiMode = "explain" | "fix" | "generate" | "refactor"

function normalizePreviewUrl(projectId: string, url?: string) {
  const fallback = buildCanonicalPreviewUrl(projectId)
  const normalized = String(url ?? "").trim()
  if (!normalized) return fallback
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(normalized)) return fallback
  if (normalized.startsWith("/api/projects/")) return fallback
  if (!normalized.startsWith("/") && !/^https?:\/\//i.test(normalized)) return fallback
  return normalized
}

function looksLikeInternalProjectId(input?: string | null) {
  return /^project_[a-zA-Z0-9_-]+$/.test(String(input ?? "").trim())
}

function inferDisplayNameFromPrompt(prompt?: string | null, isCn?: boolean) {
  const text = String(prompt ?? "").trim()
  if (!text) return isCn ? "AI App Studio" : "AI App Studio"
  const explicit =
    text.match(/名字叫\s*([A-Za-z][A-Za-z0-9_-]{1,40})/i)?.[1] ||
    text.match(/叫\s*([A-Za-z][A-Za-z0-9_-]{1,40})/i)?.[1] ||
    text.match(/named\s+([A-Za-z][A-Za-z0-9_-]{1,40})/i)?.[1]
  if (explicit) return /morncursor/i.test(explicit) ? "MornCursor" : explicit.charAt(0).toUpperCase() + explicit.slice(1)
  if (/cursor|代码编辑|ide|coding/i.test(text)) return "MornCursor"
  if (/api|接口|数据平台/i.test(text)) return "API Studio"
  if (/crm|销售|客户/i.test(text)) return "CRM Pilot"
  if (/site|website|官网|landing/i.test(text)) return "AI Site Generator"
  if (/task|任务|流程/i.test(text)) return "TaskFlow"
  return isCn ? "AI App Studio" : "AI App Studio"
}

function prioritizeCodeFiles(files: string[]) {
  const priorities = [
    "app/page.tsx",
    "app/dashboard/page.tsx",
    "app/editor/page.tsx",
    "app/runs/page.tsx",
    "app/templates/page.tsx",
    "app/settings/page.tsx",
    "components/dashboard/app-workspace-page.tsx",
    "lib/project-spec.ts",
    "app/api/generate/route.ts",
    "README.md",
  ]

  const score = (filePath: string) => {
    const priorityIndex = priorities.indexOf(filePath)
    if (priorityIndex >= 0) return priorityIndex
    if (/^app\/.+page\.(tsx|jsx)$/.test(filePath)) return 20
    if (/^app\/api\/.+route\.(ts|js)$/.test(filePath)) return 30
    if (/^components\//.test(filePath)) return 40
    if (/^lib\//.test(filePath)) return 50
    return 100
  }

  return [...files].sort((a, b) => {
    const diff = score(a) - score(b)
    if (diff !== 0) return diff
    return a.localeCompare(b)
  })
}

function inferRouteFromFilePath(filePath: string) {
  if (!filePath) return ""
  if (filePath === "app/page.tsx") return "/"
  const match = filePath.match(/^app\/(.+)\/page\.(tsx|jsx)$/)
  if (!match?.[1]) return ""
  return `/${match[1]}`
}

function normalizeWorkspaceQueryPath(filePath?: string | null) {
  return String(filePath ?? "").replace(/\\/g, "/").replace(/^\/+/, "").trim()
}

function resolveInitialWorkspaceTab(section?: string | null) {
  const normalized = String(section ?? "").trim().toLowerCase()
  if (["code", "editor", "logs", "api"].includes(normalized)) return "code" as const
  if (["dashboard", "runs", "templates", "pricing", "users", "data", "analytics", "domains", "integrations", "security", "agents", "automations", "settings"].includes(normalized)) {
    return "dashboard" as const
  }
  return "preview" as const
}

function resolveSectionPreferredFile(section?: string | null) {
  const normalized = String(section ?? "").trim().toLowerCase()
  if (normalized === "api") return "app/api/items/route.ts"
  if (normalized === "logs") return "app/runs/page.tsx"
  if (normalized === "code") return "app/editor/page.tsx"
  if (normalized === "editor") return "app/editor/page.tsx"
  if (normalized === "dashboard") return "app/dashboard/page.tsx"
  if (normalized === "runs") return "app/runs/page.tsx"
  if (normalized === "templates") return "app/templates/page.tsx"
  if (normalized === "pricing") return "app/pricing/page.tsx"
  if (normalized === "users") return "app/dashboard/page.tsx"
  if (normalized === "data") return "app/dashboard/page.tsx"
  if (normalized === "settings") return "app/settings/page.tsx"
  if (normalized === "analytics") return "app/analytics/page.tsx"
  if (normalized === "integrations") return "app/templates/page.tsx"
  if (normalized === "security") return "app/settings/page.tsx"
  return ""
}

function buildFileTree(paths: string[]) {
  const root: FileTreeNode = { name: "", path: "", children: new Map(), isFile: false }
  for (const rawPath of paths) {
    const parts = String(rawPath).split("/").filter(Boolean)
    let current = root
    let currentPath = ""
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const existing = current.children.get(part)
      if (existing) {
        current = existing
        continue
      }
      const next: FileTreeNode = {
        name: part,
        path: currentPath,
        children: new Map(),
        isFile: i === parts.length - 1,
      }
      current.children.set(part, next)
      current = next
    }
  }
  return root
}

function renderFileTree(node: FileTreeNode, depth = 0): ReactNode {
  const children = Array.from(node.children.values()).sort((a, b) => {
    if (a.isFile === b.isFile) return a.name.localeCompare(b.name)
    return a.isFile ? 1 : -1
  })

  return children.map((child) => (
    <div key={child.path}>
      <div
        className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary/60"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <span className={child.isFile ? "text-foreground/80" : "font-medium text-foreground"}>{child.isFile ? "•" : "▾"} {child.name}</span>
      </div>
      {!child.isFile ? renderFileTree(child, depth + 1) : null}
    </div>
  ))
}

function renderSelectableFileTree(
  node: FileTreeNode,
  selectedPath: string,
  onSelect: (path: string) => void,
  depth = 0
): ReactNode {
  const children = Array.from(node.children.values()).sort((a, b) => {
    if (a.isFile === b.isFile) return a.name.localeCompare(b.name)
    return a.isFile ? 1 : -1
  })

  return children.map((child) => (
    <div key={child.path}>
      <button
        type="button"
        onClick={() => child.isFile && onSelect(child.path)}
        className={`w-full rounded-md px-2 py-1 text-left text-xs hover:bg-secondary/60 ${
          child.path === selectedPath ? "bg-background text-foreground" : "text-muted-foreground"
        } ${child.isFile ? "" : "cursor-default"}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <span className={child.isFile ? "text-foreground/80" : "font-medium text-foreground"}>
          {child.isFile ? "•" : "▾"} {child.name}
        </span>
      </button>
      {!child.isFile ? renderSelectableFileTree(child, selectedPath, onSelect, depth + 1) : null}
    </div>
  ))
}

function buildParentPaths(filePath: string) {
  const parts = String(filePath).split("/").filter(Boolean)
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join("/"))
}

function renderInteractiveFileTree(
  node: FileTreeNode,
  selectedPath: string,
  expandedPaths: string[],
  onSelect: (path: string) => void,
  onToggleFolder: (path: string) => void,
  depth = 0
): ReactNode {
  const children = Array.from(node.children.values()).sort((a, b) => {
    if (a.isFile === b.isFile) return a.name.localeCompare(b.name)
    return a.isFile ? 1 : -1
  })

  return children.map((child) => {
    const expanded = child.isFile ? false : expandedPaths.includes(child.path)
    return (
      <div key={child.path}>
        <button
          type="button"
          onClick={() => (child.isFile ? onSelect(child.path) : onToggleFolder(child.path))}
          className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-secondary/60 ${
            child.path === selectedPath ? "bg-background text-foreground" : "text-muted-foreground"
          }`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          <span className={child.isFile ? "text-foreground/80" : "font-medium text-foreground"}>
            {child.isFile ? "•" : expanded ? "▾" : "▸"} {child.name}
          </span>
          {!child.isFile ? (
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
              {Array.from(child.children.values()).length}
            </span>
          ) : null}
        </button>
        {!child.isFile && expanded ? renderInteractiveFileTree(child, selectedPath, expandedPaths, onSelect, onToggleFolder, depth + 1) : null}
      </div>
    )
  })
}

function StructuredPreviewFallback({
  projectName,
  projectSubtitle,
  routes,
  modules,
  features,
  fallbackReason,
  buildStatus,
  isCn,
}: {
  projectName: string
  projectSubtitle: string
  routes: string[]
  modules: string[]
  features: string[]
  fallbackReason: string
  buildStatus: "ok" | "failed" | "skipped" | null
  isCn: boolean
}) {
  const pages = (routes.length ? routes : ["/dashboard", "/editor", "/runs", "/templates", "/pricing"]).map((route) => {
    const key = route.replace(/^\//, "") || "dashboard"
    const labelMap = isCn
      ? {
          dashboard: "总览",
          editor: "编辑器",
          runs: "运行",
          templates: "模板库",
          pricing: "升级",
          settings: "设置",
        }
      : {
          dashboard: "Dashboard",
          editor: "Editor",
          runs: "Runs",
          templates: "Templates",
          pricing: "Pricing",
          settings: "Settings",
        }
    const fallbackMap = isCn
      ? {
          dashboard: "项目概览、状态与路径摘要",
          editor: "文件树、多标签编辑器与 AI 助手",
          runs: "构建状态、运行记录与交付流程",
          templates: "场景模板、模块能力与复用入口",
          pricing: "免费版、专业版、精英版分层方案",
          settings: "部署、数据库、权限与分享设置",
        }
      : {
          dashboard: "Project overview, state, and path summary",
          editor: "File tree, tabs, and AI assistant",
          runs: "Build state, runtime history, and delivery flow",
          templates: "Scenario templates and reusable modules",
          pricing: "Free, Pro, and Elite plan structure",
          settings: "Deployment, data, access, and sharing settings",
        }
    return {
      key,
      label: labelMap[key as keyof typeof labelMap] ?? (key.charAt(0).toUpperCase() + key.slice(1)),
      desc: fallbackMap[key as keyof typeof fallbackMap] ?? (isCn ? "当前项目的可演示入口" : "A demoable route in the current project"),
    }
  })

  return (
    <div className="rounded-3xl border border-border bg-background/90 p-6 shadow-sm">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {isCn
          ? "动态预览暂时不可用，已自动切换为结构化 fallback preview。"
          : "Dynamic preview is unavailable, so the structured fallback preview is shown."}
      </div>
      <div className="mt-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
        {fallbackReason || (isCn ? "当前项目正在使用自身 fallback，而不是通用壳。" : "This project is using its own fallback instead of a generic shell.")}
      </div>
      <div className="mt-4 rounded-3xl border border-border bg-[linear-gradient(180deg,#0d0f15_0%,#151927_100%)] p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">{projectName}</div>
            <div className="mt-1 text-sm text-white/60">{projectSubtitle}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {pages.map((page, index) => (
              <span
                key={page.key}
                className={`rounded-full border px-3 py-1 text-xs ${
                  index === 0
                    ? "border-violet-400/40 bg-violet-500/20 text-violet-100"
                    : "border-white/10 bg-white/5 text-white/70"
                }`}
              >
                {page.label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white">{isCn ? "Build 验收" : "Build acceptance"}</div>
            <div className="mt-2 text-sm text-white/70">
              {buildStatus === "ok"
                ? isCn
                  ? "已通过"
                  : "passed"
                : buildStatus === "failed"
                  ? isCn
                    ? "失败"
                    : "failed"
                  : isCn
                    ? "未完成"
                    : "pending"}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white">{isCn ? "模块" : "Modules"}</div>
            <div className="mt-2 text-sm text-white/70">{modules.length || 0}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white">{isCn ? "能力" : "Features"}</div>
            <div className="mt-2 text-sm text-white/70">{features.length || 0}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white">{isCn ? "可回退页面" : "Fallback routes"}</div>
            <div className="mt-2 text-sm text-white/70">{pages.length}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {pages.map((page) => (
            <div key={page.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">{page.label}</div>
              <div className="mt-2 text-sm text-white/60">{page.desc}</div>
            </div>
          ))}
        </div>
        {modules.length ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white">{isCn ? "当前项目模块" : "Current project modules"}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {modules.slice(0, 10).map((item) => (
                <span key={item} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function AppWorkspacePage({ projectId, initialSection }: { projectId: string; initialSection?: string }) {
  const searchParams = useSearchParams()
  const jobId = searchParams.get("jobId") || projectId
  const requestedCodeFile = normalizeWorkspaceQueryPath(searchParams.get("file"))
  const requestedAiSymbol = String(searchParams.get("symbol") ?? "").trim()
  const requestedAiElement = String(searchParams.get("element") ?? "").trim()
  const requestedEditorSource = String(searchParams.get("from") ?? "").trim()
  const requestedContextPageId = String(searchParams.get("page") ?? "").trim()
  const requestedContextRoute = String(searchParams.get("route") ?? "").trim()
  const requestedCodeLine = Number(searchParams.get("line") ?? "")
  const hasRequestedCodeLine = Number.isFinite(requestedCodeLine) && requestedCodeLine > 0
  const openedFromAi = isWorkspaceEditorAiSource(requestedEditorSource)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [projectMissing, setProjectMissing] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [iterating, setIterating] = useState(false)
  const [iterateResult, setIterateResult] = useState<IterateResp | null>(null)
  const [iterateStatus, setIterateStatus] = useState("")
  const [runBusy, setRunBusy] = useState(false)
  const [runStatus, setRunStatus] = useState("")
  const [revertBusy, setRevertBusy] = useState(false)
  const [generateTask, setGenerateTask] = useState<GenerateTaskResp | null>(null)
  const [generatePanelOpen, setGeneratePanelOpen] = useState(true)
  const [previewBooting, setPreviewBooting] = useState(false)
  const [sandboxBusy, setSandboxBusy] = useState(false)
  const [copilotCollapsed, setCopilotCollapsed] = useState(false)
  const [previewTab, setPreviewTab] = useState<"preview" | "dashboard" | "code">(resolveInitialWorkspaceTab(initialSection))
  const [codeFiles, setCodeFiles] = useState<string[]>([])
  const [codeQuery, setCodeQuery] = useState("")
  const [selectedCodeFile, setSelectedCodeFile] = useState("")
  const [selectedCodeContent, setSelectedCodeContent] = useState("")
  const [draftCodeContent, setDraftCodeContent] = useState("")
  const [selectedCodeSymbols, setSelectedCodeSymbols] = useState<Array<{ kind: string; name: string; line: number }>>([])
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeSaving, setCodeSaving] = useState(false)
  const [codeTabs, setCodeTabs] = useState<string[]>([])
  const [commandQuery, setCommandQuery] = useState("")
  const [searchResults, setSearchResults] = useState<WorkspaceSearchResp["results"]>([])
  const [focusedLine, setFocusedLine] = useState<number | null>(null)
  const [workspaceRegion, setWorkspaceRegion] = useState<"cn" | "intl">("intl")
  const [workspaceDatabase, setWorkspaceDatabase] = useState<"supabase_postgres" | "cloudbase_document" | "mysql">("supabase_postgres")
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)
  const [previewProbe, setPreviewProbe] = useState<PreviewProbeState | null>(null)
  const [aiMode, setAiMode] = useState<AiMode>("generate")
  const [aiTargetSymbol, setAiTargetSymbol] = useState("")
  const [aiTargetElement, setAiTargetElement] = useState("")
  const [editorRail, setEditorRail] = useState<"explorer" | "search" | "routes" | "runtime">("explorer")
  const [editorBottomTab, setEditorBottomTab] = useState<"terminal" | "problems" | "output">("terminal")
  const [expandedCodeFolders, setExpandedCodeFolders] = useState<string[]>(["app", "components", "lib"])
  const [templateLibraryQuery, setTemplateLibraryQuery] = useState("")

  function persistPreviewSnapshot(snapshot: PreviewSnapshot) {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(PREVIEW_SNAPSHOT_STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as PreviewSnapshot[]) : []
      const list = Array.isArray(parsed) ? parsed : []
      const aliases = buildPreviewSnapshotAliases(snapshot)
      const filtered = list.filter((item) => {
        const itemAliases = buildPreviewSnapshotAliases(item)
        return !itemAliases.some((alias) => aliases.includes(alias))
      })
      window.localStorage.setItem(
        PREVIEW_SNAPSHOT_STORAGE_KEY,
        JSON.stringify([snapshot, ...filtered].slice(0, 24))
      )
    } catch {
      // local preview cache is best-effort only
    }
  }

  async function loadProject() {
    const res = await fetch(`/api/projects?projectId=${encodeURIComponent(projectId)}`)
    if (!res.ok) {
      setProjectMissing(true)
      setLoading(false)
      return
    }
    const json = await res.json()
    setProject(json.project as ProjectDetail)
    setProjectMissing(false)
    setLoading(false)
  }

  async function loadGenerateTask() {
    if (!jobId) return
    const res = await fetch(`/api/generate?jobId=${encodeURIComponent(jobId)}`)
    if (!res.ok) return
    const json = (await res.json()) as GenerateTaskResp
    setGenerateTask(json)
    if (json.status === "done" || json.status === "error") {
      setGeneratePanelOpen(false)
    } else {
      setGeneratePanelOpen(true)
    }
  }

  async function loadCodeFiles() {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`)
    if (!res.ok) return
    const json = (await res.json()) as ProjectFilesResp
    const prioritized = prioritizeCodeFiles(json.files)
    setCodeFiles(prioritized)
    setSelectedCodeFile((current) => (current && prioritized.includes(current) ? current : prioritized[0] || ""))
    setCodeTabs((current) => {
      const nextTabs = current.filter((item) => prioritized.includes(item))
      return nextTabs.length ? nextTabs : prioritized.slice(0, 4)
    })
    setExpandedCodeFolders((current) =>
      Array.from(
        new Set([
          ...current,
          ...prioritized
            .slice(0, 18)
            .flatMap((item) => buildParentPaths(item).slice(0, 2)),
        ])
      )
    )
  }

  async function loadCodeFile(filePath: string) {
    if (!filePath) return
    setCodeLoading(true)
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files?path=${encodeURIComponent(filePath)}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setSelectedCodeContent(String(json?.error ?? "Failed to load file"))
        return
      }
      const json = (await res.json()) as ProjectFileContentResp
      setSelectedCodeContent(json.content)
      setDraftCodeContent(json.content)
      setSelectedCodeSymbols(json.symbols ?? [])
      setFocusedLine((current) => current ?? json.symbols?.[0]?.line ?? null)
      setCodeTabs((current) => (current.includes(filePath) ? current : [...current, filePath].slice(-6)))
    } finally {
      setCodeLoading(false)
    }
  }

  async function saveCodeFile() {
    if (!selectedCodeFile) return
    setCodeSaving(true)
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: selectedCodeFile,
          content: draftCodeContent,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as Partial<ProjectFileSaveResp> & { error?: string }
      if (!res.ok) {
        setRunStatus(String(json?.error ?? "Failed to save file"))
        return
      }
      setSelectedCodeContent(draftCodeContent)
      setRunStatus(`Saved ${selectedCodeFile}`)
    } finally {
      setCodeSaving(false)
    }
  }

  function closeCodeTab(filePath: string) {
    setCodeTabs((current) => {
      const nextTabs = current.filter((item) => item !== filePath)
      if (selectedCodeFile === filePath) {
        setSelectedCodeFile(nextTabs[0] || "")
      }
      return nextTabs
    })
  }

  function toggleCodeFolder(path: string) {
    setExpandedCodeFolders((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path]
    )
  }

  async function loadWorkspaceSearch(query: string) {
    const trimmed = query.trim()
    if (!trimmed) {
      setSearchResults([])
      return
    }
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files?q=${encodeURIComponent(trimmed)}`)
    if (!res.ok) return
    const json = (await res.json()) as WorkspaceSearchResp
    setSearchResults(json.results)
  }

  async function runAction(action: "start" | "stop" | "restart") {
    setRunBusy(true)
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRunStatus(String(json?.error ?? "Run action failed"))
        await loadProject()
      } else {
        setRunStatus("")
        await loadProject()
      }
    } finally {
      setRunBusy(false)
    }
  }

  async function sandboxAction(action: "start" | "stop" | "restart") {
    setSandboxBusy(true)
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/sandbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRunStatus(String(json?.sandboxRuntime?.lastError ?? json?.error ?? "Sandbox action failed"))
      } else {
        setRunStatus("")
      }
      await loadProject()
    } finally {
      setSandboxBusy(false)
    }
  }

  async function iterate() {
    const text = prompt.trim()
    if (!text) return
    setIterating(true)
    setIterateStatus(aiMode === "explain" ? "Inspecting current context..." : "Applying change...")
    setIterateResult(null)
    try {
      const iterateCtrl = new AbortController()
      const iterateTimer = setTimeout(() => iterateCtrl.abort(), 180_000)
      const res = await fetch("/api/iterate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          prompt: text,
          mode: aiMode,
          currentFilePath: selectedCodeFile || undefined,
          currentFileContent: selectedCodeFile ? draftCodeContent : undefined,
          currentFileSymbols: selectedCodeSymbols,
          focusedLine,
          currentRoute: aiPageContext.route || currentCodeRoute || undefined,
          currentPage: aiPageContext,
          currentModule: aiModuleContext,
          currentElement: aiElementContext,
          sharedSession: {
            projectName,
            specKind: project?.spec?.kind || "workspace",
            workspaceSurface: previewTab,
            activeSection: activeSectionKey || aiPageContext.id,
            deploymentTarget: normalizedDeploymentTarget,
            databaseTarget: normalizedDatabaseTarget,
            region: workspaceRegion,
            selectedTemplate: generateTask?.templateTitle || undefined,
            workspaceStatus: workspaceStatus.label,
          },
          openTabs: codeTabs.slice(0, 8),
          relatedPaths: Array.from(
            new Set([
              selectedCodeFile,
              aiPageContext.filePath,
              ...codeTabs,
              ...routeFileEntries.slice(0, 6).map((entry) => entry.filePath),
            ].filter(Boolean))
          ).slice(0, 12),
        }),
        signal: iterateCtrl.signal,
      })
      clearTimeout(iterateTimer)
      const json = (await res.json()) as IterateResp
      setIterateResult(json)
      if (!res.ok || json.status === "error") {
        setIterateStatus(json.error || "Iteration failed")
      } else {
        setIterateStatus(aiMode === "explain" ? "Context explanation ready" : "Iteration completed")
        if (aiMode !== "explain") {
          if (json.changedFiles?.length) {
            setCodeFiles((current) =>
              prioritizeCodeFiles(Array.from(new Set([...json.changedFiles!, ...current])))
            )
            setExpandedCodeFolders((current) =>
              Array.from(new Set([...current, ...json.changedFiles!.flatMap((item) => buildParentPaths(item))]))
            )
          }
          const firstChangedFile = json.changedFiles?.[0] || json.context?.currentFilePath
          if (firstChangedFile) {
            setSelectedCodeFile(firstChangedFile)
            setCodeTabs((current) => (current.includes(firstChangedFile) ? current : [firstChangedFile, ...current].slice(0, 6)))
            setPreviewTab("code")
            setFocusedLine(null)
            setEditorRail("explorer")
          }
          setEditorBottomTab(json.build?.status === "failed" ? "problems" : "output")
          setPrompt("")
          // Do not block UI on restart: trigger in background with timeout.
          const restartCtrl = new AbortController()
          const restartTimer = setTimeout(() => restartCtrl.abort(), 12_000)
          fetch(`/api/projects/${encodeURIComponent(projectId)}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "restart" }),
            signal: restartCtrl.signal,
          })
            .catch(() => {
              // ignore restart errors, user can click Restart manually
            })
            .finally(() => clearTimeout(restartTimer))
        }
      }
      await loadProject()
      if (json.changedFiles?.length) {
        await loadCodeFiles()
      }
    } catch (e: any) {
      setIterateStatus(e?.message || "Iteration failed")
    } finally {
      setIterating(false)
    }
  }

  async function revertLastChange() {
    setRevertBusy(true)
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/revert`, {
        method: "POST",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setIterateStatus(String(json?.error ?? "Revert failed"))
      } else {
        setIterateStatus("Reverted last iterate change")
        await fetch(`/api/projects/${encodeURIComponent(projectId)}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "restart" }),
        }).catch(() => {
          // ignore
        })
      }
      await loadProject()
      await loadCodeFiles()
    } finally {
      setRevertBusy(false)
    }
  }

  useEffect(() => {
    loadProject()
    const timer = setInterval(loadProject, 5000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    if (!initialSection) return
    setPreviewTab(resolveInitialWorkspaceTab(initialSection))
  }, [initialSection])

  useEffect(() => {
    if (!codeFiles.length) return
    const requestedMatch = requestedCodeFile
      ? codeFiles.find((item) => item === requestedCodeFile) ||
        codeFiles.find((item) => item.endsWith(requestedCodeFile.split("/").slice(-1)[0]))
      : ""
    const preferredFile = resolveSectionPreferredFile(initialSection)
    const preferredMatch = preferredFile
      ? codeFiles.find((item) => item === preferredFile) || codeFiles.find((item) => item.endsWith(preferredFile.split("/").slice(-1)[0]))
      : ""
    const match = requestedMatch || preferredMatch
    if (!match) return
    setSelectedCodeFile(match)
    if (requestedMatch || resolveInitialWorkspaceTab(initialSection) === "code") {
      setPreviewTab("code")
    }
  }, [codeFiles, initialSection, requestedCodeFile])

  useEffect(() => {
    if (!project) return
    setWorkspaceRegion(project.region)
    setWorkspaceDatabase(
      project.databaseTarget === "mysql"
        ? "mysql"
        : project.databaseTarget === "cloudbase_document"
          ? "cloudbase_document"
          : "supabase_postgres"
    )
  }, [project])

  useEffect(() => {
    if (!project?.presentation) return
    persistPreviewSnapshot({
      projectId: project.projectId,
      projectSlug: project.projectSlug || project.projectId,
      region: project.region,
      spec: project.spec ?? null,
      presentation: project.presentation,
      history: [...(project.history ?? [])].reverse().slice(0, 5).map((item) => ({
        createdAt: item.createdAt,
        summary: item.summary,
        status: item.status,
        type: item.type,
      })),
      updatedAt: project.updatedAt,
      source: "workspace",
    })
  }, [project])

  useEffect(() => {
    loadGenerateTask()
    const timer = setInterval(async () => {
      const res = await fetch(`/api/generate?jobId=${encodeURIComponent(jobId)}`)
      if (!res.ok) return
      const json = (await res.json()) as GenerateTaskResp
      setGenerateTask(json)
      if (json.status === "done" || json.status === "error") {
        setGeneratePanelOpen(false)
        clearInterval(timer)
      }
    }, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  useEffect(() => {
    void loadCodeFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    if (previewTab !== "code" || !selectedCodeFile) return
    void loadCodeFile(selectedCodeFile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewTab, selectedCodeFile])

  useEffect(() => {
    if (!requestedCodeFile || requestedCodeFile !== selectedCodeFile || !hasRequestedCodeLine) return
    setFocusedLine(requestedCodeLine)
  }, [hasRequestedCodeLine, requestedCodeFile, requestedCodeLine, selectedCodeFile])

  useEffect(() => {
    if (!requestedAiSymbol || hasRequestedCodeLine || requestedCodeFile !== selectedCodeFile) return
    const matchedSymbol = selectedCodeSymbols.find((item) => item.name === requestedAiSymbol)
    if (!matchedSymbol) return
    setFocusedLine(matchedSymbol.line)
    setEditorRail("explorer")
    setPreviewTab("code")
  }, [hasRequestedCodeLine, requestedAiSymbol, requestedCodeFile, selectedCodeFile, selectedCodeSymbols])

  useEffect(() => {
    if (!selectedCodeFile) return
    setExpandedCodeFolders((current) => Array.from(new Set([...current, ...buildParentPaths(selectedCodeFile)])))
  }, [selectedCodeFile])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadWorkspaceSearch(commandQuery)
    }, 220)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandQuery, projectId])

  const runtime = project?.runtime
  const isCn = project?.region === "cn"

  useEffect(() => {
    const shouldAutoStart =
      generateTask?.status === "done" &&
      !previewBooting &&
      Boolean(project?.preview?.supportsDynamicRuntime) &&
      (project?.runtime?.status === "stopped" || project?.runtime?.status === "error")

    if (!shouldAutoStart) return

    setPreviewBooting(true)
    setRunStatus("")
    fetch(`/api/projects/${encodeURIComponent(projectId)}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(String(json?.error ?? "Preview start failed"))
        }
        setRunStatus("")
        await loadProject()
      })
      .catch((error: any) => {
        setRunStatus(error?.message || (isCn ? "预览启动失败，请查看上方启动日志并尝试 Restart。" : "Preview failed to start. Check the startup diagnostics above and try Restart."))
        void loadProject()
      })
      .finally(() => {
        setPreviewBooting(false)
      })
  }, [generateTask?.status, previewBooting, project?.preview?.supportsDynamicRuntime, project?.runtime?.status, projectId, isCn])

  const copy = {
    preview: isCn ? "预览" : "Preview",
    dashboard: "Dashboard",
    code: isCn ? "代码" : "Code",
    previewUrl: isCn ? "预览地址" : "Preview URL",
    generatedFiles: isCn ? "生成文件数" : "Generated Files",
    workspace: isCn ? "工作区路径" : "Workspace",
    commandSearch: isCn ? "命令搜索" : "Command Search",
    commandSearchPlaceholder: isCn ? "搜索命令、文件、符号..." : "Search commands, files, symbols...",
    searchResults: isCn ? "搜索结果" : "Search Results",
    codeFiles: isCn ? "代码文件" : "Code Files",
    symbols: isCn ? "符号" : "Symbols",
    diagnostics: isCn ? "诊断" : "Diagnostics",
    globalResults: isCn ? "全局结果" : "Global Results",
    workspaceFiles: isCn ? "工作区文件" : "Workspace Files",
    noFileSelected: isCn ? "未选择文件" : "No file selected",
    noLineSelected: isCn ? "未定位行" : "No line selected",
    loadingFile: isCn ? "文件加载中..." : "Loading file...",
    save: isCn ? "保存" : "Save",
    saving: isCn ? "保存中..." : "Saving...",
    refreshPreview: isCn ? "刷新预览" : "Refresh Preview",
    openRaw: isCn ? "打开预览入口" : "Open Preview Route",
    routeEntryFile: isCn ? "路由入口文件" : "Route entry file",
    backendApiHandler: isCn ? "后端 API 处理器" : "Backend API handler",
    noSymbols: isCn ? "当前文件未检测到符号" : "No symbols detected in current file",
    unsavedChanges: isCn ? "当前文件存在未保存修改" : "Unsaved changes in active file",
    historySummary: isCn ? "历史总结" : "History Summary",
    noHistory: isCn ? "暂无项目历史。" : "No project history yet.",
    fileUnit: isCn ? "个文件" : "files",
    generationStatus: isCn ? "生成状态" : "Generation Status",
    generationStatusDesc: isCn ? "展示本次生成状态、结果摘要和可继续迭代的文件范围。" : "Show generation progress, summary, and the file scope available for further iteration.",
    runLogs: isCn ? "运行日志" : "Run logs",
    generationSummary: isCn ? "生成结果摘要" : "Generation summary",
    artifactState: isCn ? "当前产物状态" : "Current artifact state",
    changedFiles: isCn ? "本次变更文件" : "Changed files",
    iterateProject: isCn ? "继续迭代项目" : "Iterate Project",
    iteratePlaceholder: isCn ? "描述你要继续调整的内容..." : "Describe the next change...",
    applying: isCn ? "应用中..." : "Applying...",
    applyChange: isCn ? "应用修改" : "Apply Change",
    reverting: isCn ? "回退中..." : "Reverting...",
    revert: isCn ? "回退上一次修改" : "Revert Last Change",
    previewStarting: isCn ? "预览正在启动..." : "Preview is starting...",
    previewNotRunning: isCn ? "预览尚未运行，生成完成后会自动启动，你也可以手动点击 Start。" : "Preview is not running yet. It will auto-start after generation, or you can click Start.",
    workspaceSearch: isCn ? "工作区搜索" : "Workspace Search",
    dashboardSearchTitle: isCn ? "总览搜索" : "Overview Search",
    dashboardSearchPlaceholder: isCn ? "搜索可见性、邀请、发布、运行..." : "Search visibility, invites, publish, runtime...",
    appVisibility: isCn ? "应用可见性" : "App Visibility",
    appVisibilityDesc: isCn ? "控制谁可以访问当前生成应用。" : "Control who can access the generated application.",
    public: isCn ? "公开" : "Public",
    private: isCn ? "私有" : "Private",
    requireLogin: isCn ? "访问前需要登录" : "Require login to access",
    inviteUsers: isCn ? "邀请成员" : "Invite Users",
    inviteUsersDesc: isCn ? "把当前应用分享给团队成员和汇报对象。" : "Share the current application with teammates and stakeholders.",
    copyLink: isCn ? "复制链接" : "Copy Link",
    sendInvites: isCn ? "发送邀请" : "Send Invites",
    moveToWorkspace: isCn ? "移动到工作区" : "Move To Workspace",
    moveToWorkspaceDesc: isCn ? "交付后可把当前应用转移到其他工作区。" : "Move this app into another workspace after handoff.",
    moveApp: isCn ? "移动应用" : "Move App",
    publishStatusTitle: isCn ? "发布状态" : "Publish Status",
    publishStatusDesc: isCn ? "跟踪预览、代码和分享链路是否已达到交付标准。" : "Track whether preview, code, and sharing are ready for delivery.",
    integrationsTitle: isCn ? "集成状态" : "Integrations",
    integrationsDesc: isCn ? "配置登录、文档、运行链路和独立后台入口。" : "Configure auth, docs, runtime flows, and standalone back-office entry points.",
    securityTitle: isCn ? "安全设置" : "Security",
    securityDesc: isCn ? "在老板或客户查看前，控制访问、密钥和发布安全。" : "Control access, credentials, and publish safety before stakeholder review.",
    recentActivityTitle: isCn ? "最近活动" : "Recent Activity",
    distributionTitle: isCn ? "分发入口" : "Distribution",
    distributionDesc: isCn ? "汇总预览、代码清单、文档和演示资产入口。" : "Collect preview, code manifest, docs, and demo-asset entry points.",
    openAndDelivery: isCn ? "打开与交付" : "Open And Delivery",
    workspaceProfile: isCn ? "工作区档案" : "Workspace Profile",
    workspaceProfileDesc: isCn
      ? "这里承接应用可见性、分享入口、交付状态和分发操作，不再映射成应用内的业务页面。"
      : "This panel owns visibility, sharing, delivery status, and distribution operations instead of turning them into in-app business pages.",
    loginProviders: isCn ? "邮箱 / 微信 / Google / Facebook" : "Email / Google / Facebook / WeChat",
    standaloneSurfaces: isCn ? "admin、market、文档与演示资产均作为独立入口维护" : "admin, market, docs, and demo assets are maintained as standalone entry surfaces",
    workspaceTitle: isCn ? "AI 产品工作台" : "AI Product Workspace",
    workspaceSubtitle: isCn ? "左侧 AI 共创面板承接连续修改，右侧主工作区只在 Preview、Dashboard、Code 之间切换。" : "Keep the AI copilot on the left and let the main workspace switch only between Preview, Dashboard, and Code.",
    projectOverview: isCn ? "项目概览" : "Project Overview",
    aiStudio: isCn ? "AI 共创助手" : "AI Co-Creation",
    taskSummary: isCn ? "当前任务摘要" : "Current task summary",
    conversationHistory: isCn ? "创作记录" : "Creation history",
    quickSuggestions: isCn ? "快捷修改建议" : "Quick suggestions",
    continuePrompt: isCn ? "继续告诉 AI 你要改什么..." : "Tell AI what to change next...",
    queuedChanges: isCn ? "待应用修改" : "Queued change",
    applyHint: isCn ? "在左侧输入修改需求后，右侧主工作区会直接切到对应的预览、控制台或代码视图。" : "Use the left copilot to request changes, then let the main workspace switch directly into preview, dashboard, or code.",
    currentPath: isCn ? "当前路径" : "Current path",
    deploymentTarget: isCn ? "部署环境" : "Deployment target",
    dataTarget: isCn ? "数据 / 文档方案" : "Data / document path",
    latestAiUpdate: isCn ? "最近一次 AI 更新" : "Latest AI update",
    buildAcceptance: isCn ? "Build 验收" : "Build Acceptance",
    fallbackReason: isCn ? "Fallback 原因" : "Fallback Reason",
    currentContext: isCn ? "当前上下文" : "Current Context",
    currentRoute: isCn ? "当前路由" : "Current Route",
    assistantMode: isCn ? "助手模式" : "Assistant Mode",
    modelOutput: isCn ? "AI 输出" : "AI Output",
    buildPassed: isCn ? "已通过" : "passed",
    buildFailed: isCn ? "失败" : "failed",
    buildPending: isCn ? "未完成" : "pending",
    explainMode: isCn ? "解释" : "Explain",
    fixMode: isCn ? "修复" : "Fix",
    generateMode: isCn ? "生成" : "Generate",
    refactorMode: isCn ? "重构" : "Refactor",
    openPreview: isCn ? "打开预览" : "Open Preview",
    refresh: isCn ? "刷新" : "Refresh",
    initialRequest: isCn ? "初始需求" : "Initial prompt",
    noConversation: isCn ? "生成完成后，这里会记录你和 AI 的持续修改过程。" : "Once generation finishes, this rail will capture your ongoing edits with AI.",
  } as const
  const projectSlug = project?.projectSlug || project?.projectId || projectId
  const canonicalPreviewUrl = normalizePreviewUrl(
    projectSlug,
    project?.preview?.canonicalUrl || buildCanonicalPreviewUrl(projectSlug)
  )
  const runtimePreviewUrl = normalizePreviewUrl(
    projectSlug,
    project?.preview?.runtimeUrl || runtime?.url || buildRuntimePreviewUrl(projectSlug)
  )
  const sandboxPreviewUrl = normalizePreviewUrl(
    projectSlug,
    project?.preview?.sandboxUrl || buildSandboxPreviewUrl(projectSlug)
  )
  const refreshPreview = () => {
    setPreviewRefreshKey((current) => current + 1)
  }
  const resolvedPreviewUrl =
    previewProbe?.resolvedPreviewUrl ||
    project?.preview?.resolvedUrl ||
    getResolvedPreviewUrl({
      projectId: projectSlug,
      mode: project?.preview?.activeMode ?? "static_ssr",
      canonicalUrl: canonicalPreviewUrl,
      runtimeUrl: runtimePreviewUrl,
      sandboxUrl: sandboxPreviewUrl,
    })
  const fallbackReason =
    project?.preview?.fallbackReason ||
    (previewProbe?.renderStrategy === "structured_fallback"
      ? (isCn ? "动态预览不可用，已回退到当前项目自己的结构化 fallback。" : "Dynamic preview is unavailable, so the current project fallback is active.")
      : "")
  const canRenderPreview = Boolean(resolvedPreviewUrl)
  const previewStarting = runtime?.status === "starting" || previewBooting
  const recoveringGenerateTask =
    generateTask?.status !== "error" &&
    Boolean(generateTask?.logs?.some((line) => line.includes("自动尝试恢复一次")))
  const generatedTree = useMemo(
    () => buildFileTree(generateTask?.changedFiles ?? []),
    [generateTask?.changedFiles]
  )
  const iterateTree = useMemo(
    () => buildFileTree(iterateResult?.changedFiles ?? []),
    [iterateResult?.changedFiles]
  )
  const allCodeTree = useMemo(() => buildFileTree(codeFiles), [codeFiles])
  const pageManifest = useMemo(() => {
    return codeFiles
      .filter((filePath) => /^app\/.+\/page\.(tsx|jsx)$/.test(filePath) || filePath === "app/page.tsx")
      .map((filePath) => {
        if (filePath === "app/page.tsx") return { filePath, route: "/" }
        const route = filePath.replace(/^app\//, "/").replace(/\/page\.(tsx|jsx)$/, "")
        return { filePath, route }
      })
  }, [codeFiles])
  const filteredCodeFiles = useMemo(() => {
    const query = codeQuery.trim().toLowerCase()
    if (!query) return codeFiles
    return codeFiles.filter((item) => item.toLowerCase().includes(query))
  }, [codeFiles, codeQuery])
  const filteredCodeTree = useMemo(() => buildFileTree(filteredCodeFiles), [filteredCodeFiles])
  const recentCodeFiles = useMemo(() => codeTabs.slice().reverse(), [codeTabs])
  const routeFileEntries = useMemo(
    () =>
      pageManifest.map((item) => ({
        route: item.route,
        filePath: item.filePath,
      })),
    [pageManifest]
  )
  const editorRailItems = useMemo(
    () => [
      { key: "explorer" as const, label: isCn ? "文件" : "Files", short: "F" },
      { key: "search" as const, label: isCn ? "搜索" : "Search", short: "S" },
      { key: "routes" as const, label: isCn ? "页面" : "Pages", short: "P" },
      { key: "runtime" as const, label: isCn ? "输出" : "Output", short: "O" },
    ],
    [isCn]
  )
  const hasUnsavedChanges = selectedCodeFile && draftCodeContent !== selectedCodeContent
  const codeLineNumbers = useMemo(() => {
    const lineCount = Math.max(1, draftCodeContent.split(/\r?\n/).length)
    return Array.from({ length: lineCount }, (_, index) => index + 1)
  }, [draftCodeContent])
  const workspaceCommands = useMemo<WorkspaceCommand[]>(() => {
    const fileCommands = codeFiles.slice(0, 80).map((filePath) => ({
      id: `file:${filePath}`,
      label: filePath.split("/").slice(-1)[0],
      description: filePath,
      action: "open-file" as const,
      target: filePath,
    }))
    const actionCommands: WorkspaceCommand[] = [
      {
        id: "tab:preview",
        label: "Open Preview",
        description: "Switch to the resolved preview",
        action: "switch-tab",
        target: "preview",
      },
      {
        id: "tab:dashboard",
        label: "Open Delivery Dashboard",
        description: "Switch to download and delivery panel",
        action: "switch-tab",
        target: "dashboard",
      },
      {
        id: "action:restart",
        label: "Restart Preview",
        description: "Restart generated app runtime",
        action: "restart-preview",
      },
      {
        id: "action:open-preview",
        label: "Open Preview In New Tab",
        description: resolvedPreviewUrl || "Preview URL unavailable",
        action: "open-preview",
      },
    ]
    const searchCommands = searchResults.flatMap((item) => [
      ...item.symbols.map((symbol) => ({
        id: `symbol:${item.path}:${symbol.name}:${symbol.line}`,
        label: `${symbol.name}()`,
        description: `${item.path}:${symbol.line} · ${symbol.kind}`,
        action: "open-file" as const,
        target: item.path,
      })),
      ...item.matches.slice(0, 2).map((match) => ({
        id: `match:${item.path}:${match.line}`,
        label: `${item.path.split("/").slice(-1)[0]}:${match.line}`,
        description: `${item.path} · ${match.preview}`,
        action: "open-file" as const,
        target: item.path,
        line: match.line,
      })),
    ])
    const query = commandQuery.trim().toLowerCase()
    return [...actionCommands, ...searchCommands, ...fileCommands].filter((item) => {
      if (!query) return true
      return `${item.label} ${item.description}`.toLowerCase().includes(query)
    }).slice(0, 24)
  }, [codeFiles, commandQuery, resolvedPreviewUrl, searchResults])
  const handleWorkspaceCommand = async (command: WorkspaceCommand) => {
    if (command.action === "open-file" && command.target) {
      setSelectedCodeFile(command.target)
      setFocusedLine(command.line ?? null)
      setPreviewTab("code")
      return
    }
    if (command.action === "switch-tab" && command.target) {
      setPreviewTab(command.target as "preview" | "dashboard" | "code")
      return
    }
    if (command.action === "restart-preview") {
      await runAction("restart")
      return
    }
    if (command.action === "open-preview" && resolvedPreviewUrl) {
      window.open(resolvedPreviewUrl, "_blank", "noopener,noreferrer")
    }
  }
  const aiInterpretation = useMemo(() => {
    if (!generateTask?.summary && !generateTask?.changedFiles?.length) return ""
    const fileCount = generateTask.changedFiles?.length ?? 0
    if (generateTask.summary && fileCount) {
      return `已完成生成与稳定化处理，当前产物包含 ${fileCount} 个页面或模块文件，可继续预览与迭代。`
    }
    return generateTask.summary || ""
  }, [generateTask])
  const runtimeBadge = useMemo(() => {
    if (!runtime) return <Badge variant="outline">stopped</Badge>
    const map = {
      running: <Badge className="bg-emerald-500/15 text-emerald-600">running</Badge>,
      starting: <Badge variant="secondary">starting</Badge>,
      error: <Badge variant="destructive">error</Badge>,
      stopped: <Badge variant="outline">stopped</Badge>,
    } as const
    return map[runtime.status]
  }, [runtime])
  const codeDiagnostics = useMemo(() => {
    if (!selectedCodeFile) return []
    const diagnostics: Array<{ level: "info" | "warn"; text: string }> = []
    if (hasUnsavedChanges) {
      diagnostics.push({ level: "warn", text: copy.unsavedChanges })
    }
    if (/page\.tsx$|page\.jsx$/.test(selectedCodeFile)) {
      diagnostics.push({ level: "info", text: copy.routeEntryFile })
    }
    if (/api\/.+route\.(ts|js)$/.test(selectedCodeFile)) {
      diagnostics.push({ level: "info", text: copy.backendApiHandler })
    }
    if (selectedCodeSymbols.length === 0) {
      diagnostics.push({ level: "warn", text: copy.noSymbols })
    }
    return diagnostics
  }, [selectedCodeFile, hasUnsavedChanges, selectedCodeSymbols.length, copy.unsavedChanges, copy.routeEntryFile, copy.backendApiHandler, copy.noSymbols])
  const editorProblemItems = useMemo(() => {
    const items = codeDiagnostics.map((diagnostic, index) => ({
      id: `diagnostic-${index}`,
      level: diagnostic.level,
      text: diagnostic.text,
    }))
    if (runStatus) {
      items.unshift({ id: "runtime-status", level: "warn" as const, text: runStatus })
    }
    if (runtime?.lastError) {
      items.unshift({ id: "runtime-error", level: "warn" as const, text: runtime.lastError })
    }
    if (iterateResult?.build?.status === "failed") {
      items.unshift({
        id: "iterate-build",
        level: "warn" as const,
        text: iterateResult.build.logs?.[0] || (isCn ? "最近一次修改的 build 未通过" : "The latest iteration build did not pass"),
      })
    }
    return items
  }, [codeDiagnostics, iterateResult?.build?.logs, iterateResult?.build?.status, isCn, runStatus, runtime?.lastError])
  const selectedFileSummary = useMemo(() => {
    if (!selectedCodeFile) return ""
    const typeLabel =
      /^app\/.+page\.(tsx|jsx)$/.test(selectedCodeFile)
        ? copy.routeEntryFile
        : /^app\/api\/.+route\.(ts|js)$/.test(selectedCodeFile)
          ? copy.backendApiHandler
          : /^components\//.test(selectedCodeFile)
            ? (isCn ? "界面组件" : "UI component")
            : /^lib\//.test(selectedCodeFile)
              ? (isCn ? "逻辑模块" : "Logic module")
              : isCn
                ? "工程文件"
                : "Project file"
    return `${typeLabel} · ${selectedCodeSymbols.length} ${isCn ? "个符号" : "symbols"} · ${draftCodeContent.split(/\r?\n/).length} ${isCn ? "行" : "lines"}`
  }, [copy.backendApiHandler, copy.routeEntryFile, draftCodeContent, isCn, selectedCodeFile, selectedCodeSymbols.length])
  const currentCodeRoute = useMemo(() => inferRouteFromFilePath(selectedCodeFile), [selectedCodeFile])
  const activeSectionKey = String(initialSection ?? "").trim().toLowerCase()
  const focusedSectionLabel = initialSection ? initialSection.replace(/[-_]+/g, " ") : ""
  const aiModeLabel =
    aiMode === "explain"
      ? copy.explainMode
      : aiMode === "fix"
        ? copy.fixMode
        : aiMode === "refactor"
          ? copy.refactorMode
          : copy.generateMode
  const buildAcceptanceLabel =
    project?.generation?.buildStatus === "ok"
      ? copy.buildPassed
      : project?.generation?.buildStatus === "failed"
        ? copy.buildFailed
        : copy.buildPending
  const dashboardActions = useMemo(
    () => [
      { label: isCn ? "打开应用" : "Open App", onClick: () => resolvedPreviewUrl && window.open(resolvedPreviewUrl, "_blank", "noopener,noreferrer") },
      { label: isCn ? "打开文件" : "Open Files", onClick: () => window.open(`/api/projects/${encodeURIComponent(projectId)}/files`, "_blank", "noopener,noreferrer") },
      { label: isCn ? "打开文档" : "Open Docs", onClick: () => window.open("/api-docs", "_blank", "noopener,noreferrer") },
      ...(project?.preview?.supportsDynamicRuntime && runtimePreviewUrl ? [{ label: isCn ? "打开运行态" : "Open Runtime", onClick: () => window.open(runtimePreviewUrl, "_blank", "noopener,noreferrer") }] : []),
      ...(project?.preview?.supportsSandboxRuntime && sandboxPreviewUrl ? [{ label: isCn ? "打开沙箱预览" : "Open Sandbox", onClick: () => window.open(sandboxPreviewUrl, "_blank", "noopener,noreferrer") }] : []),
    ],
    [isCn, resolvedPreviewUrl, project?.preview?.supportsDynamicRuntime, project?.preview?.supportsSandboxRuntime, projectId, runtimePreviewUrl, sandboxPreviewUrl]
  )
  const latestHistoryItem = project?.history?.length ? project.history[project.history.length - 1] : null
  const projectName =
    (project?.presentation?.displayName && !looksLikeInternalProjectId(project.presentation.displayName) ? project.presentation.displayName : "") ||
    (project?.spec?.title && !looksLikeInternalProjectId(project.spec.title) ? project.spec.title : "") ||
    inferDisplayNameFromPrompt(latestHistoryItem?.prompt || generateTask?.summary, isCn)
  const projectSubtitle = project?.presentation?.subtitle || (isCn ? "AI 生成应用工作区" : "AI generated app workspace")
  const projectSummary =
    project?.presentation?.summary ||
    (latestHistoryItem?.status === "done" ? latestHistoryItem.summary : "") ||
    (generateTask?.status === "done" ? generateTask.summary : "") ||
    aiInterpretation ||
    copy.applyHint
  const projectIcon = project?.presentation?.icon
  const hasUsableProjectSurface = Boolean(project?.presentation?.displayName || project?.spec?.title || codeFiles.length || pageManifest.length)
  const workspaceStatus = useMemo(() => {
    if (iterating) return { key: "applying", label: isCn ? "修改中" : "Applying", tone: "outline" as const }
    if (generateTask?.status === "running" || generateTask?.status === "queued") {
      return {
        key: generateTask.status,
        label: generateTask.status === "running" ? (isCn ? "生成中" : "Generating") : (isCn ? "排队中" : "Queued"),
        tone: "outline" as const,
      }
    }
    if (project?.preview?.status === "building" || previewStarting || runtime?.status === "starting") {
      return { key: "building", label: isCn ? "预览启动中" : "Preview starting", tone: "outline" as const }
    }
    if (hasUsableProjectSurface) {
      if (project?.preview?.activeMode === "sandbox_runtime" && project?.preview?.sandboxStatus === "running") {
        return { key: "sandbox", label: isCn ? "高级预览就绪" : "Sandbox ready", tone: "success" as const }
      }
      if (previewProbe?.renderStrategy === "structured_fallback") {
        return { key: "fallback", label: isCn ? "Fallback 预览" : "Fallback preview", tone: "warning" as const }
      }
      if (project?.preview?.status === "ready" || previewProbe?.responseStatus === 200 || resolvedPreviewUrl) {
        return { key: "ready", label: isCn ? "可预览" : "Preview ready", tone: "success" as const }
      }
      return { key: "workspace", label: isCn ? "工作区就绪" : "Workspace ready", tone: "success" as const }
    }
    if (generateTask?.status === "error") {
      return { key: "error", label: isCn ? "任务异常" : "Task error", tone: "destructive" as const }
    }
    return { key: "idle", label: isCn ? "等待生成" : "Waiting", tone: "outline" as const }
  }, [
    codeFiles.length,
    generateTask?.status,
    hasUsableProjectSurface,
    isCn,
    iterating,
    pageManifest.length,
    previewProbe?.renderStrategy,
    previewProbe?.responseStatus,
    previewStarting,
    project?.preview?.activeMode,
    project?.preview?.sandboxStatus,
    project?.preview?.status,
    resolvedPreviewUrl,
    runtime?.status,
  ])
  const buildBadgeLabel =
    workspaceStatus.key === "error"
      ? isCn
        ? "任务异常"
        : "Task error"
      : workspaceStatus.key === "building"
        ? isCn
          ? "预览准备中"
          : "Preview building"
        : workspaceStatus.key === "sandbox"
          ? isCn
            ? "高级预览"
            : "Sandbox preview"
          : workspaceStatus.key === "fallback"
            ? isCn
              ? "结构化预览"
              : "Structured preview"
            : isCn
              ? "工作区就绪"
              : "Workspace ready"
  const overviewPoints = useMemo(() => {
    const rows: string[] = []
    const kindLabel =
      project?.spec?.kind === "code_platform"
        ? isCn ? "AI 代码编辑平台" : "AI coding platform"
        : project?.spec?.kind === "crm"
          ? isCn ? "销售与客户管理工作区" : "Sales and CRM workspace"
          : projectSubtitle
    rows.push(`${isCn ? "产品类型" : "Product type"}：${kindLabel}`)
    rows.push(`${isCn ? "已生成页面" : "Generated pages"}：${(project?.presentation?.routes ?? pageManifest.map((item) => item.route)).join(" / ")}`)
    if (project?.spec?.kind === "code_platform") {
      rows.push(`${isCn ? "AI 工具" : "AI tools"}：explain / fix / generate / refactor`)
    }
    rows.push(`${isCn ? "默认部署" : "Deployment"}：${project?.deploymentTarget || "vercel"}`)
    rows.push(`${isCn ? "数据方案" : "Data path"}：${project?.databaseTarget || workspaceDatabase}`)
    return rows
  }, [isCn, pageManifest, project?.databaseTarget, project?.deploymentTarget, project?.presentation?.routes, project?.spec?.kind, projectSubtitle, workspaceDatabase])
  const currentPathLabel = `${workspaceRegion === "cn" ? (isCn ? "国内版" : "China") : isCn ? "国际版" : "International"} · ${
    project?.deploymentTarget || (workspaceRegion === "cn" ? "cloudbase" : "vercel")
  } · ${
    workspaceDatabase === "mysql"
      ? "MySQL"
      : workspaceDatabase === "cloudbase_document"
        ? isCn
          ? "Cloud 数据集"
          : "Cloud Dataset"
        : "Supabase"
  }`
  const editorTerminalLines = useMemo(() => {
    const lines = [
      `${isCn ? "工作区" : "workspace"}> ${selectedCodeFile || "app/editor/page.tsx"}`,
      `${isCn ? "预览状态" : "preview"}: ${workspaceStatus.label}`,
      `${isCn ? "运行态" : "runtime"}: ${runtime?.status || (isCn ? "未启动" : "stopped")}`,
      runStatus || "",
      ...(generateTask?.logs?.slice(-3) ?? []),
      ...(iterateResult?.build?.logs?.slice(-3) ?? []),
    ].filter(Boolean)
    return lines.slice(-8)
  }, [generateTask?.logs, isCn, iterateResult?.build?.logs, runStatus, runtime?.status, selectedCodeFile, workspaceStatus.label])
  const quickSuggestions = isCn
    ? [
        "把首页改成深色科技风",
        "增加登录页和账号切换入口",
        "把按钮层级变得更简洁",
        "增加支付入口与状态说明",
        "补充数据库配置切换",
        "切换为国内版默认方案",
      ]
    : [
        "Turn the homepage into a darker AI SaaS style",
        "Add a login page and account switcher",
        "Simplify button hierarchy",
        "Add a payment entry and status flow",
        "Expose database configuration choices",
        "Switch to the China-default setup",
      ]
  const conversationItems = useMemo(
    () =>
      (project?.history ?? [])
        .slice()
        .reverse()
        .map((item) => ({
          id: item.id,
          prompt: item.prompt,
          summary: item.summary,
          status: item.status,
          time: new Date(item.createdAt).toLocaleString(),
          type: item.type,
        })),
    [project?.history]
  )
  const showPreviewDebug = searchParams.get("debug") === "1" && previewTab === "preview"
  const overviewContextItems = [
    { label: copy.currentPath, value: currentPathLabel },
    { label: copy.buildAcceptance, value: buildAcceptanceLabel },
    { label: copy.currentContext, value: selectedCodeFile || (isCn ? "当前未选择文件" : "No active file selected") },
    { label: copy.currentRoute, value: currentCodeRoute || (focusedSectionLabel || (isCn ? "当前工作区根页" : "Workspace root")) },
  ]
  const workspaceRootHref = `/apps/${encodeURIComponent(projectId)}`
  const normalizedDeploymentTarget = normalizeDeploymentTarget(
    project?.deploymentTarget || (workspaceRegion === "cn" ? "cloudbase" : "vercel"),
    workspaceRegion
  )
  const normalizedDatabaseTarget = normalizeDatabaseTarget(project?.databaseTarget || workspaceDatabase, workspaceRegion)
  const deploymentOption = getDeploymentOption(normalizedDeploymentTarget)
  const databaseOption = getDatabaseOption(normalizedDatabaseTarget)
  const deploymentEnvGuide = getDeploymentEnvGuide(normalizedDeploymentTarget)
  const databaseEnvGuide = getDatabaseEnvGuide(normalizedDatabaseTarget)
  const generatedRouteCount = project?.presentation?.routes?.length ?? pageManifest.length
  const moduleCount = project?.spec?.modules?.length ?? 0
  const featureCount = project?.spec?.features?.length ?? 0
  const recentRunItems = useMemo(
    () =>
      (project?.history ?? [])
        .slice(-4)
        .reverse()
        .map((item) => ({
          id: item.id,
          status: item.status,
          type: item.type,
          prompt: item.prompt,
          summary: item.summary || (item.type === "generate" ? (isCn ? "生成工作区" : "Workspace generation") : (isCn ? "应用修改" : "Workspace iteration")),
          time: new Date(item.createdAt).toLocaleString(),
        })),
    [isCn, project?.history]
  )
  const editorOutputItems = useMemo(
    () => [
      `${isCn ? "当前预览" : "Preview"}: ${resolvedPreviewUrl || (isCn ? "未就绪" : "pending")}`,
      `${isCn ? "部署" : "Deployment"}: ${isCn ? deploymentOption.nameCn : deploymentOption.nameEn}`,
      `${isCn ? "数据库" : "Database"}: ${isCn ? databaseOption.nameCn : databaseOption.nameEn}`,
      `${isCn ? "最近更新" : "Latest update"}: ${latestHistoryItem?.summary || generateTask?.summary || copy.applyHint}`,
    ],
    [
      copy.applyHint,
      databaseOption.nameCn,
      databaseOption.nameEn,
      deploymentOption.nameCn,
      deploymentOption.nameEn,
      generateTask?.summary,
      isCn,
      latestHistoryItem?.summary,
      resolvedPreviewUrl,
    ]
  )
  const planShowcase = useMemo(
    () =>
      (["free", "pro", "elite"] as PlanTier[]).map((planId) => {
        const plan = PLAN_CATALOG[planId]
        const policy =
          planId === "free"
            ? isCn
              ? "代码不可导出，数据库仅限在线使用"
              : "Code export locked, database stays online-only"
            : planId === "pro"
              ? isCn
                ? "开放导出、更多生成质量与更强交付能力"
                : "Unlock export, stronger generation quality, and fuller delivery"
              : isCn
                ? "更适合复杂工作区、客户提案和展示级交付"
                : "Best for complex workspaces, client demos, and showcase delivery"
        return {
          id: planId,
          name: isCn ? plan.nameCn : plan.nameEn,
          price: getPlanPriceLabel(planId, isCn ? "zh" : "en"),
          summary: isCn ? plan.summaryCn : plan.summaryEn,
          policy,
          deliverables: isCn ? plan.deliverablesCn : plan.deliverablesEn,
          badge: isCn ? plan.badgeCn : plan.badgeEn,
        }
      }),
    [isCn]
  )
  const activeDashboardSection = activeSectionKey || "dashboard"
  const sectionPageHeader = useMemo(() => {
    switch (activeDashboardSection) {
      case "runs":
        return {
          eyebrow: isCn ? "Runs workspace" : "Runs workspace",
          title: isCn ? "构建、预览和 runtime 的运行控制台" : "An operating console for build, preview, and runtime",
          summary: isCn ? "这一页应该像流水线和交付后台，而不是几张摘要卡。" : "This page should feel like a pipeline and delivery console, not a few summary cards.",
        }
      case "templates":
        return {
          eyebrow: isCn ? "Template library" : "Template library",
          title: isCn ? "把模板、模块和页面结构拉成可复用资产" : "Turn templates, modules, and routes into reusable assets",
          summary: isCn ? "这里应该像模板库入口，支持搜索、分类和直接复用。" : "This should feel like a template library entry with search, categories, and direct reuse.",
        }
      case "pricing":
        return {
          eyebrow: isCn ? "Pricing workspace" : "Pricing workspace",
          title: isCn ? "让免费与付费差异一眼就能讲清楚" : "Make the free-vs-paid differences legible at a glance",
          summary: isCn ? "这里不只是价格，而是资源、导出和交付能力的差异说明。" : "This is not only pricing. It explains resource, export, and delivery differences.",
        }
      case "settings":
        return {
          eyebrow: isCn ? "Settings workspace" : "Settings workspace",
          title: isCn ? "把环境、权限、发布和资源控制放进同一页" : "Keep environment, access, publish, and resource control on one page",
          summary: isCn ? "这里应该像交付配置台，便于上线前统一检查。" : "This should feel like a delivery configuration console before launch.",
        }
      default:
        return {
          eyebrow: isCn ? "Dashboard workspace" : "Dashboard workspace",
          title: isCn ? "当前应用的控制平面总览" : "The current app control-plane overview",
          summary: isCn ? "工作区的主状态、主要入口和交付检查都集中在这里。" : "The workspace’s main state, entrypoints, and delivery checks stay concentrated here.",
        }
    }
  }, [activeDashboardSection, isCn])
  const runHistoryRows = useMemo(
    () =>
      recentRunItems.map((item, index) => ({
        id: item.id,
        branch: item.type === "generate" ? "main" : isCn ? "workspace-change" : "workspace-change",
        action: item.type === "generate" ? (isCn ? "生成工作区" : "Generate workspace") : isCn ? "应用修改" : "Apply change",
        status: item.status,
        duration: item.type === "generate" ? `${2 + index}m ${12 + index * 7}s` : `${38 + index * 9}s`,
        time: item.time,
        summary: item.summary,
      })),
    [isCn, recentRunItems]
  )
  const dashboardPriorityCards = useMemo(
    () => [
      {
        id: "delivery",
        label: isCn ? "交付状态" : "Delivery state",
        value: workspaceStatus.label,
        note:
          buildAcceptanceLabel === (isCn ? "已通过" : "Passed")
            ? isCn
              ? "Build 已过，可以继续讲预览和交付。"
              : "Build is clear, so preview and delivery can stay in focus."
            : isCn
              ? "先把 build、preview 和 runtime 的状态讲清楚。"
              : "Clarify build, preview, and runtime before going wider.",
        href: `${workspaceRootHref}/runs`,
      },
      {
        id: "workspace-depth",
        label: isCn ? "工作区厚度" : "Workspace depth",
        value: `${generatedRouteCount} / ${moduleCount} / ${featureCount}`,
        note: isCn ? "页面、模块和能力已经能支撑一套像样的产品工作区。" : "Routes, modules, and features now support a more product-like workspace shell.",
        href: `${workspaceRootHref}/dashboard`,
      },
      {
        id: "editor-lane",
        label: isCn ? "当前编辑焦点" : "Editor focus",
        value: selectedCodeFile || (isCn ? "等待选择文件" : "Waiting for file selection"),
        note: currentCodeRoute || (isCn ? "把当前文件继续拉近真实 IDE 使用节奏。" : "Keep pulling the active file into a more real IDE rhythm."),
        href: `${workspaceRootHref}/editor`,
      },
      {
        id: "resource-policy",
        label: isCn ? "资源策略" : "Resource policy",
        value: isCn ? "免费 / Pro / Elite" : "Free / Pro / Elite",
        note: isCn ? "免费用户代码不可导出，数据库保持在线使用。" : "Free users keep code export locked while database usage stays online-first.",
        href: `${workspaceRootHref}/pricing`,
      },
    ],
    [
      buildAcceptanceLabel,
      currentCodeRoute,
      featureCount,
      generatedRouteCount,
      isCn,
      moduleCount,
      selectedCodeFile,
      workspaceRootHref,
      workspaceStatus.label,
    ]
  )
  const dashboardOperatorQueue = useMemo(
    () => [
      {
        id: "preview-story",
        title: isCn ? "预览叙事" : "Preview narrative",
        summary: resolvedPreviewUrl || (isCn ? "当前等待预览地址解析" : "Waiting for the preview address to resolve"),
        href: workspaceRootHref,
        actionLabel: copy.preview,
      },
      {
        id: "code-lane",
        title: isCn ? "代码工作区" : "Code lane",
        summary: selectedFileSummary || (isCn ? "继续从 Editor 路由讲当前文件、页面映射和终端输出。" : "Use the Editor route to narrate the active file, route map, and terminal output."),
        href: `${workspaceRootHref}/editor`,
        actionLabel: copy.code,
      },
      {
        id: "runtime-lane",
        title: isCn ? "运行与交付" : "Runtime and delivery",
        summary:
          recentRunItems[0]?.summary ||
          (isCn ? "继续从 Runs 路由讲 build、preview 和 runtime 的最新状态。" : "Use the Runs route to narrate the latest build, preview, and runtime state."),
        href: `${workspaceRootHref}/runs`,
        actionLabel: isCn ? "查看 Runs" : "Open runs",
      },
      {
        id: "settings-lane",
        title: isCn ? "环境与数据" : "Environment and data",
        summary: `${isCn ? deploymentOption.nameCn : deploymentOption.nameEn} / ${isCn ? databaseOption.nameCn : databaseOption.nameEn}`,
        href: `${workspaceRootHref}/settings`,
        actionLabel: isCn ? "查看 Settings" : "Open settings",
      },
    ],
    [
      copy.code,
      copy.preview,
      databaseOption.nameCn,
      databaseOption.nameEn,
      deploymentOption.nameCn,
      deploymentOption.nameEn,
      isCn,
      recentRunItems,
      resolvedPreviewUrl,
      selectedFileSummary,
      workspaceRootHref,
    ]
  )
  const runPipelineStages = useMemo(
    () => [
      {
        id: "spec",
        label: isCn ? "Spec" : "Spec",
        state: recentRunItems.length ? (isCn ? "已同步" : "synced") : (isCn ? "待生成" : "pending"),
        note: isCn ? "最近一次生成或修改已经进入工作区记录。" : "The latest generation or iteration is already recorded in the workspace.",
        tone: recentRunItems.length ? "ready" : "pending",
      },
      {
        id: "build",
        label: "Build",
        state: buildAcceptanceLabel,
        note: project?.generation?.summary || (isCn ? "继续把 build 结果作为交付准入门槛。" : "Keep build acceptance as the delivery gate."),
        tone: project?.generation?.buildStatus === "ok" ? "ready" : project?.generation?.buildStatus === "failed" ? "warning" : "pending",
      },
      {
        id: "preview",
        label: isCn ? "Preview" : "Preview",
        state: workspaceStatus.label,
        note: fallbackReason || (isCn ? "当前优先使用已解析的 preview 地址。" : "The resolved preview address stays in focus right now."),
        tone: workspaceStatus.key === "ready" || workspaceStatus.key === "sandbox" ? "ready" : workspaceStatus.key === "fallback" ? "warning" : "pending",
      },
      {
        id: "runtime",
        label: isCn ? "Runtime" : "Runtime",
        state: runtime?.status || (isCn ? "未启动" : "stopped"),
        note: runtime?.lastError || (isCn ? "运行态状态继续作为交付链最后一跳。" : "Runtime remains the final hop in the delivery chain."),
        tone: runtime?.status === "running" ? "ready" : runtime?.status === "error" ? "warning" : "pending",
      },
    ],
    [
      buildAcceptanceLabel,
      fallbackReason,
      isCn,
      project?.generation?.buildStatus,
      project?.generation?.summary,
      recentRunItems.length,
      runtime?.lastError,
      runtime?.status,
      workspaceStatus.key,
      workspaceStatus.label,
    ]
  )
  const runControlNotes = useMemo(
    () => [
      `${isCn ? "预览模式" : "Preview mode"}: ${project?.preview?.activeMode || "static_ssr"}`,
      `${isCn ? "最近任务" : "Latest task"}: ${latestHistoryItem?.type || (isCn ? "暂无" : "none")}`,
      `${isCn ? "数据 / 部署" : "Data / deployment"}: ${isCn ? deploymentOption.nameCn : deploymentOption.nameEn} / ${isCn ? databaseOption.nameCn : databaseOption.nameEn}`,
    ],
    [
      databaseOption.nameCn,
      databaseOption.nameEn,
      deploymentOption.nameCn,
      deploymentOption.nameEn,
      isCn,
      latestHistoryItem?.type,
      project?.preview?.activeMode,
    ]
  )
  const editorBreadcrumbs = useMemo(
    () => [isCn ? "工作区" : "Workspace", ...(selectedCodeFile || "app/editor/page.tsx").split("/")],
    [isCn, selectedCodeFile]
  )
  const editorStatusItems = useMemo(
    () => [
      { label: isCn ? "状态" : "State", value: workspaceStatus.label },
      { label: isCn ? "Build" : "Build", value: buildAcceptanceLabel },
      { label: isCn ? "Route" : "Route", value: currentCodeRoute || (isCn ? "未命中" : "not inferred") },
      { label: isCn ? "行数" : "Lines", value: `${codeLineNumbers.length}` },
      { label: isCn ? "标签" : "Tabs", value: `${codeTabs.length}` },
      { label: isCn ? "未保存" : "Unsaved", value: hasUnsavedChanges ? (isCn ? "是" : "yes") : (isCn ? "否" : "no") },
    ],
    [
      buildAcceptanceLabel,
      codeLineNumbers.length,
      codeTabs.length,
      currentCodeRoute,
      hasUnsavedChanges,
      isCn,
      workspaceStatus.label,
    ]
  )
  const templateLibraryCards = useMemo(() => {
    const cards = [
      {
        id: "current-workspace",
        title: generateTask?.templateTitle || (isCn ? "当前工作区模板" : "Current workspace template"),
        category: isCn ? "生成中模板" : "Generated template",
        note: projectSummary,
        tags: [project?.spec?.kind || "workspace", ...(project?.spec?.modules ?? []).slice(0, 3)],
      },
      {
        id: "ops-control",
        title: isCn ? "Control Plane" : "Control Plane",
        category: isCn ? "后台工作台" : "Back office",
        note: isCn ? "适合继续延展 dashboard、runs、settings 这些管理型页面。" : "Useful for extending dashboard, runs, and settings surfaces.",
        tags: ["dashboard", "runs", "settings"],
      },
      {
        id: "product-launch",
        title: isCn ? "Launch Surface" : "Launch Surface",
        category: isCn ? "对外展示" : "Go-to-market",
        note: isCn ? "适合首页、定价页、下载页和模板展示入口。" : "Useful for landing, pricing, download, and showcase entrypoints.",
        tags: ["landing", "pricing", "templates"],
      },
    ]
    const query = templateLibraryQuery.trim().toLowerCase()
    if (!query) return cards
    return cards.filter((card) =>
      `${card.title} ${card.category} ${card.note} ${card.tags.join(" ")}`.toLowerCase().includes(query)
    )
  }, [generateTask?.templateTitle, isCn, project?.spec?.kind, project?.spec?.modules, projectSummary, templateLibraryQuery])
  const pricingComparisonRows = useMemo(
    () => [
      {
        label: isCn ? "代码导出" : "Code export",
        explorer: isCn ? "不可导出" : "Locked",
        pro: isCn ? "可导出" : "Included",
        elite: isCn ? "可导出 + 更完整交付" : "Included + fuller delivery",
      },
      {
        label: isCn ? "数据库使用" : "Database usage",
        explorer: isCn ? "仅在线使用" : "Online only",
        pro: isCn ? "在线 + 更完整配置" : "Online + fuller configuration",
        elite: isCn ? "在线 + 更强资源能力" : "Online + stronger resource room",
      },
      {
        label: isCn ? "工作区厚度" : "Workspace depth",
        explorer: isCn ? "演示级首版" : "Demo-ready first version",
        pro: isCn ? "MVP 级控制台" : "MVP-grade control plane",
        elite: isCn ? "展示级多模块工作区" : "Showcase-grade multi-module workspace",
      },
    ],
    [isCn]
  )
  const settingsSurfaceCards = useMemo(
    () => [
      {
        title: isCn ? "权限与分享" : "Access and sharing",
        summary: isCn ? "控制公开/私有、邀请对象和老板查看入口。" : "Control public/private state, invite targets, and stakeholder access.",
        items: [isCn ? "公开 / 私有" : "Public / Private", isCn ? "成员邀请" : "Member invites", isCn ? "查看权限" : "View access"],
      },
      {
        title: isCn ? "发布与预览" : "Publish and preview",
        summary: isCn ? "统一处理 canonical preview、runtime 和后续独立访问入口。" : "Handle canonical preview, runtime, and future standalone access in one place.",
        items: [resolvedPreviewUrl || (isCn ? "预览待解析" : "Preview pending"), isCn ? deploymentOption.nameCn : deploymentOption.nameEn, workspaceStatus.label],
      },
      {
        title: isCn ? "环境与数据" : "Environment and data",
        summary: isCn ? "部署变量、数据库接入和资源路径都收口到这一组。" : "Deployment env, database wiring, and resource paths converge here.",
        items: [...deploymentEnvGuide.slice(0, 2), ...databaseEnvGuide.slice(0, 2)],
      },
      {
        title: isCn ? "资源控制" : "Resource control",
        summary: isCn ? "把免费/付费策略、导出规则和交付能力放到同一面板。" : "Keep tier policy, export rules, and delivery capability in one surface.",
        items: [isCn ? "免费用户代码不可导出" : "Free users cannot export code", isCn ? "免费 DB 仅限在线使用" : "Free DB stays online-only", isCn ? "付费层开放更多资源" : "Paid tiers unlock more resources"],
      },
    ],
    [
      databaseEnvGuide,
      deploymentEnvGuide,
      deploymentOption.nameCn,
      deploymentOption.nameEn,
      isCn,
      resolvedPreviewUrl,
      workspaceStatus.label,
    ]
  )
  const showDefaultDashboardPanels = activeDashboardSection === "dashboard"
  const editorBottomTabLabel = useMemo(
    () =>
      editorBottomTab === "terminal"
        ? isCn
          ? "终端"
          : "Terminal"
        : editorBottomTab === "problems"
          ? isCn
            ? "问题"
            : "Problems"
          : isCn
            ? "输出"
            : "Output",
    [editorBottomTab, isCn]
  )
  const editorRailLabel = useMemo(
    () => editorRailItems.find((item) => item.key === editorRail)?.label || editorRail,
    [editorRail, editorRailItems]
  )
  const editorSummaryCards = useMemo(
    () => [
      {
        label: isCn ? "当前文件" : "Active file",
        value: selectedCodeFile || copy.noFileSelected,
      },
      {
        label: isCn ? "页面映射" : "Route map",
        value: currentCodeRoute || (isCn ? "未命中页面路由" : "No route inferred"),
      },
      {
        label: isCn ? "打开标签" : "Open tabs",
        value: `${codeTabs.length}`,
      },
      {
        label: isCn ? "活动侧栏" : "Active rail",
        value: editorRailLabel,
      },
      {
        label: isCn ? "当前输出面板" : "Active output",
        value: editorBottomTabLabel,
      },
    ],
    [codeTabs.length, copy.noFileSelected, currentCodeRoute, editorBottomTabLabel, editorRailLabel, isCn, selectedCodeFile]
  )
  const workspaceAiRoutes = useMemo(
    () =>
      buildCodePlatformContextRoutes({
        region: workspaceRegion,
        features: project?.spec?.features ?? [],
      }),
    [project?.spec?.features, workspaceRegion]
  )
  const focusedSymbolName = useMemo(() => {
    const focusedSymbol = focusedLine ? selectedCodeSymbols.find((item) => item.line === focusedLine)?.name : ""
    return focusedSymbol || selectedCodeSymbols[0]?.name || ""
  }, [focusedLine, selectedCodeSymbols])
  const aiPageContext = useMemo(
    () =>
      inferCodePlatformPageContext({
        routes: workspaceAiRoutes,
        region: workspaceRegion,
        currentFilePath: selectedCodeFile,
        currentRoute: currentCodeRoute,
        activeSection: activeSectionKey || undefined,
        previewTab,
      }),
    [activeSectionKey, currentCodeRoute, previewTab, selectedCodeFile, workspaceAiRoutes, workspaceRegion]
  )
  const availableAiSymbols = useMemo(() => {
    const fromFile = selectedCodeSymbols.map((item) => item.name).filter(Boolean)
    return Array.from(new Set((fromFile.length ? fromFile : aiPageContext.symbols).filter(Boolean)))
  }, [aiPageContext.symbols, selectedCodeSymbols])
  const availableAiElements = useMemo(() => Array.from(new Set(aiPageContext.elements.filter(Boolean))), [aiPageContext.elements])
  useEffect(() => {
    setAiTargetSymbol((current) => (current && availableAiSymbols.includes(current) ? current : focusedSymbolName || availableAiSymbols[0] || ""))
  }, [availableAiSymbols, focusedSymbolName])
  useEffect(() => {
    setAiTargetElement((current) => (current && availableAiElements.includes(current) ? current : availableAiElements[0] || ""))
  }, [availableAiElements])
  useEffect(() => {
    if (!requestedAiSymbol || !availableAiSymbols.includes(requestedAiSymbol)) return
    setAiTargetSymbol(requestedAiSymbol)
  }, [availableAiSymbols, requestedAiSymbol])
  useEffect(() => {
    if (!requestedAiElement || !availableAiElements.includes(requestedAiElement)) return
    setAiTargetElement(requestedAiElement)
  }, [availableAiElements, requestedAiElement])
  const aiModuleContext = useMemo(
    () =>
      inferCodePlatformModuleContext({
        currentFilePath: selectedCodeFile,
        currentFileSymbols: selectedCodeSymbols,
        currentPage: aiPageContext,
        activeSymbolName: aiTargetSymbol || focusedSymbolName,
      }),
    [aiPageContext, aiTargetSymbol, focusedSymbolName, selectedCodeFile, selectedCodeSymbols]
  )
  const aiElementContext = useMemo(
    () =>
      inferCodePlatformElementContext({
        currentPage: aiPageContext,
        activeElementName: aiTargetElement,
        previewTab,
        editorRailLabel,
        editorBottomTabLabel,
      }),
    [aiPageContext, aiTargetElement, editorBottomTabLabel, editorRailLabel, previewTab]
  )
  const latestResolvedContext = iterateResult?.context
  const contextPage = latestResolvedContext?.currentPage ?? aiPageContext
  const contextModule = latestResolvedContext?.currentModule ?? aiModuleContext
  const contextElement = latestResolvedContext?.currentElement ?? aiElementContext
  const contextSession = latestResolvedContext?.sharedSession
  const contextFile = latestResolvedContext?.currentFilePath || selectedCodeFile
  const contextRoute = latestResolvedContext?.currentRoute || currentCodeRoute || aiPageContext.route
  const contextSymbols = latestResolvedContext?.currentFileSymbols?.length
    ? latestResolvedContext.currentFileSymbols
    : selectedCodeSymbols
  useEffect(() => {
    if (!latestResolvedContext) return
    if (latestResolvedContext.currentFilePath) {
      setSelectedCodeFile(latestResolvedContext.currentFilePath)
      setPreviewTab("code")
      setEditorRail("explorer")
      setExpandedCodeFolders((current) =>
        Array.from(new Set([...current, ...buildParentPaths(latestResolvedContext.currentFilePath!)]))
      )
    }
    if (typeof latestResolvedContext.focusedLine === "number" && latestResolvedContext.focusedLine > 0) {
      setFocusedLine(latestResolvedContext.focusedLine)
    }
    if (latestResolvedContext.currentFileSymbols?.length) {
      setSelectedCodeSymbols(latestResolvedContext.currentFileSymbols)
    }
    if (latestResolvedContext.currentModule?.name) {
      setAiTargetSymbol(latestResolvedContext.currentModule.name)
    }
    if (latestResolvedContext.currentElement?.name) {
      setAiTargetElement(latestResolvedContext.currentElement.name)
    }
    if (latestResolvedContext.openTabs?.length || latestResolvedContext.currentFilePath) {
      setCodeTabs((current) =>
        Array.from(
          new Set([
            latestResolvedContext.currentFilePath,
            ...(latestResolvedContext.openTabs ?? []),
            ...current,
          ].filter(Boolean) as string[])
        ).slice(0, 6)
      )
    }
  }, [latestResolvedContext])
  useEffect(() => {
    const resolvedSymbol = latestResolvedContext?.currentModule?.name
    if (!resolvedSymbol || typeof latestResolvedContext?.focusedLine === "number") return
    const matchedSymbol = selectedCodeSymbols.find((item) => item.name === resolvedSymbol)
    if (!matchedSymbol) return
    setFocusedLine(matchedSymbol.line)
  }, [latestResolvedContext?.currentModule?.name, latestResolvedContext?.focusedLine, selectedCodeSymbols])
  const aiEntrySummary = useMemo(() => {
    if (!openedFromAi) return []
    return [
      requestedContextPageId || contextPage.id,
      requestedContextRoute || contextRoute,
      requestedAiSymbol || contextModule.name,
      requestedAiElement || contextElement.name,
      hasRequestedCodeLine ? (isCn ? `第 ${requestedCodeLine} 行` : `Line ${requestedCodeLine}`) : "",
    ].filter(Boolean)
  }, [
    contextElement.name,
    contextModule.name,
    contextPage.id,
    contextRoute,
    hasRequestedCodeLine,
    isCn,
    openedFromAi,
    requestedAiElement,
    requestedAiSymbol,
    requestedCodeLine,
    requestedContextPageId,
    requestedContextRoute,
  ])
  const deliveryChecklist = useMemo(
    () => [
      {
        label: isCn ? "Build 验收" : "Build acceptance",
        value: buildAcceptanceLabel,
        ready: project?.generation?.buildStatus === "ok",
      },
      {
        label: isCn ? "Preview" : "Preview",
        value: workspaceStatus.label,
        ready: workspaceStatus.key === "ready" || workspaceStatus.key === "sandbox",
      },
      {
        label: isCn ? "Runtime" : "Runtime",
        value:
          runtime?.status === "running"
            ? isCn
              ? "已启动"
              : "running"
            : runtime?.status === "starting"
              ? isCn
                ? "启动中"
                : "starting"
              : isCn
                ? "未启动"
                : "stopped",
        ready: runtime?.status === "running",
      },
      {
        label: isCn ? "部署路径" : "Deployment path",
        value: isCn ? deploymentOption.nameCn : deploymentOption.nameEn,
        ready: Boolean(normalizedDeploymentTarget),
      },
      {
        label: isCn ? "数据方案" : "Data path",
        value: isCn ? databaseOption.nameCn : databaseOption.nameEn,
        ready: Boolean(normalizedDatabaseTarget),
      },
    ],
    [
      buildAcceptanceLabel,
      databaseOption.nameCn,
      databaseOption.nameEn,
      deploymentOption.nameCn,
      deploymentOption.nameEn,
      isCn,
      normalizedDatabaseTarget,
      normalizedDeploymentTarget,
      project?.generation?.buildStatus,
      runtime?.status,
      workspaceStatus.key,
      workspaceStatus.label,
    ]
  )
  const focusedWorkspacePanel = useMemo(() => {
    if (activeSectionKey === "editor") {
      return {
        eyebrow: isCn ? "Editor 控制区" : "Editor control plane",
        title: isCn ? "把文件、页面和底部输出都收进真实 IDE 节奏" : "Bring files, routes, and bottom output into a more real IDE rhythm",
        summary: isCn ? "这里不再只是代码文本区，而是当前文件、最近文件、页面映射和输出面板一起工作。" : "This is no longer only a code textarea. The active file, recent files, route mapping, and bottom output now work together.",
        chips: [selectedCodeFile || (isCn ? "未选中文件" : "No active file"), `${codeTabs.length} ${isCn ? "个标签" : "tabs"}`, `${editorProblemItems.length} ${isCn ? "个问题" : "problems"}`],
        points: [
          `${isCn ? "当前文件" : "Active file"}: ${selectedCodeFile || (isCn ? "等待选择" : "Waiting for selection")}`,
          `${isCn ? "页面映射" : "Route mapping"}: ${currentCodeRoute || (isCn ? "未命中页面路由" : "No route inferred yet")}`,
          `${isCn ? "活动侧栏" : "Active rail"}: ${editorRailLabel}`,
          `${isCn ? "底部输出" : "Bottom output"}: ${editorBottomTabLabel}`,
        ],
      }
    }
    if (activeSectionKey === "runs") {
      return {
        eyebrow: isCn ? "Runs 控制区" : "Runs control plane",
        title: isCn ? "把 build、preview 和 runtime 放进一条交付线" : "Keep build, preview, and runtime on one delivery thread",
        summary:
          latestHistoryItem?.summary ||
          (isCn ? "这里应该解释最近一次生成、预览回退和运行态状态，而不是只堆日志。" : "This area should explain the last generation, preview fallback, and runtime state instead of only dumping logs."),
        chips: [buildAcceptanceLabel, workspaceStatus.label, runtime?.status || (isCn ? "未启动" : "stopped")],
        points: [
          `${isCn ? "最近任务" : "Latest task"}: ${latestHistoryItem?.type || (isCn ? "暂无" : "none")}`,
          `${isCn ? "预览模式" : "Preview mode"}: ${project?.preview?.activeMode || "static_ssr"}`,
          `${isCn ? "最近变更" : "Recent change"}: ${recentRunItems[0]?.summary || (isCn ? "等待新的操作记录" : "Waiting for the next operation")}`,
        ],
      }
    }
    if (activeSectionKey === "templates") {
      return {
        eyebrow: isCn ? "Templates 控制区" : "Templates control plane",
        title: isCn ? "让模板、模块和页面结构看起来像可复用资产" : "Make templates, modules, and routes feel like reusable assets",
        summary: isCn ? "这里不再只是模板名称，而是当前模板能带出哪些模块、功能和可演示页面。" : "This is no longer only a template name. It explains which modules, features, and demoable routes are already present.",
        chips: [`${moduleCount} ${isCn ? "模块" : "modules"}`, `${featureCount} ${isCn ? "能力" : "features"}`, `${generatedRouteCount} ${isCn ? "页面" : "routes"}`],
        points: [
          `${isCn ? "模板标题" : "Template title"}: ${generateTask?.templateTitle || (isCn ? "当前由 prompt 推断" : "Currently inferred from the prompt")}`,
          `${isCn ? "优先模块" : "Priority modules"}: ${(project?.spec?.modules ?? []).slice(0, 3).join(", ") || (isCn ? "等待模块填充" : "Waiting for module inventory")}`,
          `${isCn ? "下一步" : "Next"}: ${isCn ? "继续把模块变成真正可点击的工作区入口" : "Keep turning modules into clickable workspace surfaces"}`,
        ],
      }
    }
    if (activeSectionKey === "pricing") {
      return {
        eyebrow: isCn ? "Pricing 控制区" : "Pricing control plane",
        title: isCn ? "把免费与付费差异直接讲清楚" : "Make the free-vs-paid policy immediately clear",
        summary: isCn ? "这里先用展示层把资源权限讲明白，为后面的真实权限系统留接口。" : "Use the product shell to make resource policy explicit now, while leaving room for the real permission system later.",
        chips: [isCn ? "免费" : "Free", isCn ? "可升级" : "Upgradeable", isCn ? "资源策略" : "Resource policy"],
        points: [
          isCn ? "免费版代码不能导出" : "Free plan cannot export code",
          isCn ? "免费版 DB 仅限在线使用" : "Free plan keeps DB usage online-only",
          isCn ? "付费版逐步开放导出、更多资源与更强交付能力" : "Paid tiers progressively unlock export, more resources, and stronger delivery",
        ],
      }
    }
    if (activeSectionKey === "settings") {
      return {
        eyebrow: isCn ? "Settings 控制区" : "Settings control plane",
        title: isCn ? "把部署、数据和发布入口收进同一块" : "Converge deployment, data, and release entrypoints in one place",
        summary: isCn ? "这里应该像交付后台，而不是一堆没有顺序的开关。" : "This should feel like a delivery console, not a pile of unordered toggles.",
        chips: [isCn ? deploymentOption.nameCn : deploymentOption.nameEn, isCn ? databaseOption.nameCn : databaseOption.nameEn, workspaceRegion === "cn" ? (isCn ? "国内版" : "China") : isCn ? "国际版" : "Global"],
        points: [
          `${isCn ? "部署说明" : "Deployment"}: ${isCn ? deploymentOption.descriptionCn : deploymentOption.descriptionEn}`,
          `${isCn ? "数据说明" : "Data"}: ${isCn ? databaseOption.descriptionCn : databaseOption.descriptionEn}`,
          `${isCn ? "环境变量" : "Env guide"}: ${[...deploymentEnvGuide, ...databaseEnvGuide].slice(0, 3).join(", ")}`,
        ],
      }
    }
    if (activeSectionKey === "users") {
      return {
        eyebrow: isCn ? "Users 控制区" : "Users control plane",
        title: isCn ? "把成员、分享和审批路径讲清楚" : "Clarify members, sharing, and approval paths",
        summary: isCn ? "这一层先作为真实团队协作的前端骨架，方便后续接权限和计费。" : "This layer acts as the frontend skeleton for team collaboration before deeper permissions and billing arrive.",
        chips: [isCn ? "成员" : "Members", isCn ? "分享" : "Sharing", isCn ? "审批" : "Approvals"],
        points: [
          isCn ? "老板看预览，交付成员看工作区，开发继续在代码区修改" : "Founders review preview, operators review workspace state, and builders keep editing in code",
          isCn ? "免费用户默认只读分享，付费后逐步开放更深协作" : "Free users start with read-only sharing while paid plans unlock deeper collaboration",
          isCn ? "后续权限、导出和资源额度都可以从这里继续接" : "Permissions, exports, and resource quotas can continue from here later",
        ],
      }
    }
    if (activeSectionKey === "data") {
      return {
        eyebrow: isCn ? "Data 控制区" : "Data control plane",
        title: isCn ? "把数据库、资源限制和后续数据层留好位置" : "Reserve a real place for database state, resource policy, and the next data layer",
        summary: isCn ? "这里现在先展示当前数据路径、连接变量和资源限制，不急着假装后端已经全部完成。" : "For now this explains the active data path, connection guide, and resource policy instead of pretending the backend is already complete.",
        chips: [isCn ? databaseOption.nameCn : databaseOption.nameEn, `${databaseOption.engine}`, isCn ? "在线优先" : "Online first"],
        points: [
          `${isCn ? "当前数据库" : "Current database"}: ${isCn ? databaseOption.descriptionCn : databaseOption.descriptionEn}`,
          `${isCn ? "连接指引" : "Connection guide"}: ${databaseEnvGuide.slice(0, 3).join(", ")}`,
          isCn ? "免费层优先在线使用，后续再开放更多导出与迁移能力" : "The free layer stays online-first before more export and migration options arrive",
        ],
      }
    }
    return {
      eyebrow: isCn ? "Dashboard 控制区" : "Dashboard control plane",
      title: isCn ? "让老板第一眼看到的不是 demo 卡片，而是可交付工作台" : "Make the first glance feel like a deliverable control plane instead of a demo card grid",
      summary: projectSummary,
      chips: [workspaceStatus.label, `${generatedRouteCount} ${isCn ? "页面" : "routes"}`, `${moduleCount} ${isCn ? "模块" : "modules"}`],
      points: [
        isCn ? "左侧 AI 共创区持续承接修改需求" : "The left AI copilot keeps ongoing change requests visible",
        isCn ? "中间主区承接 Preview、Dashboard 和 Code 三个一级入口" : "The middle surface keeps Preview, Dashboard, and Code as the top-level entrypoints",
        isCn ? "右侧不再拆出 Overview rail，而是直接切换纯预览、控制台和代码工作区" : "The right side no longer splits into an Overview rail and instead switches directly between preview, dashboard, and code.",
      ],
    }
  }, [
    activeSectionKey,
    buildAcceptanceLabel,
    codeTabs.length,
    currentCodeRoute,
    databaseEnvGuide,
    databaseOption.descriptionCn,
    databaseOption.descriptionEn,
    databaseOption.engine,
    databaseOption.nameCn,
    databaseOption.nameEn,
    deploymentEnvGuide,
    deploymentOption.descriptionCn,
    deploymentOption.descriptionEn,
    deploymentOption.nameCn,
    deploymentOption.nameEn,
    featureCount,
    generateTask?.templateTitle,
    generatedRouteCount,
    isCn,
    latestHistoryItem?.summary,
    latestHistoryItem?.type,
    moduleCount,
    editorBottomTabLabel,
    editorProblemItems.length,
    editorRailLabel,
    project?.preview?.activeMode,
    project?.spec?.modules,
    projectSummary,
    recentRunItems,
    runtime?.status,
    selectedCodeFile,
    workspaceRegion,
    workspaceStatus.label,
  ])
  const controlPlaneSections = useMemo(
    () => [
      {
        key: "dashboard",
        label: "Dashboard",
        href: workspaceRootHref,
        active: !activeSectionKey || activeSectionKey === "dashboard",
        state: workspaceStatus.label,
        summary: isCn ? "控制台、交付状态和工作区摘要" : "Control plane, delivery state, and workspace summary",
        detail: projectSummary,
        countLabel: `${generatedRouteCount} ${isCn ? "页面" : "routes"}`,
      },
      {
        key: "editor",
        label: isCn ? "Editor" : "Editor",
        href: `${workspaceRootHref}/editor`,
        active: activeSectionKey === "editor",
        state: selectedCodeFile ? selectedCodeFile.split("/").slice(-1)[0] : (isCn ? "等待打开文件" : "Open a file"),
        summary: isCn ? "多标签编辑器、文件树、页面映射和底部输出" : "Multi-tab editor, file tree, route map, and bottom output",
        detail: selectedFileSummary || (isCn ? "继续把当前工作区拉近真实 IDE 使用节奏" : "Keep pulling the workspace closer to a real IDE flow"),
        countLabel: `${codeTabs.length} ${isCn ? "个标签" : "tabs"}`,
      },
      {
        key: "runs",
        label: isCn ? "Runs" : "Runs",
        href: `${workspaceRootHref}/runs`,
        active: activeSectionKey === "runs",
        state:
          runtime?.status === "running"
            ? isCn
              ? "Runtime live"
              : "Runtime live"
            : buildAcceptanceLabel,
        summary: isCn ? "生成记录、预览状态和 runtime 交付线" : "Generation history, preview state, and runtime delivery lane",
        detail: recentRunItems[0]?.summary || (isCn ? "等待下一次运行记录" : "Waiting for the next runtime event"),
        countLabel: `${recentRunItems.length} ${isCn ? "条记录" : "events"}`,
      },
      {
        key: "templates",
        label: isCn ? "Templates" : "Templates",
        href: `${workspaceRootHref}/templates`,
        active: activeSectionKey === "templates",
        state: `${moduleCount} ${isCn ? "模块" : "modules"}`,
        summary: isCn ? "模板基线、模块能力和复用入口" : "Template baselines, module inventory, and reuse entrypoints",
        detail: (project?.spec?.modules ?? []).slice(0, 3).join(", ") || (isCn ? "等待模块 inventory" : "Waiting for module inventory"),
        countLabel: `${featureCount} ${isCn ? "能力" : "features"}`,
      },
      {
        key: "pricing",
        label: isCn ? "Pricing" : "Pricing",
        href: `${workspaceRootHref}/pricing`,
        active: activeSectionKey === "pricing",
        state: isCn ? "资源策略" : "Resource policy",
        summary: isCn ? "免费/付费差异、导出策略和资源额度" : "Free vs paid tiers, export policy, and resource limits",
        detail: isCn ? "免费层代码不可导出，DB 仅限在线使用" : "Free tier keeps code export locked and DB online-only",
        countLabel: isCn ? "3 个核心档位" : "3 visible tiers",
      },
      {
        key: "settings",
        label: isCn ? "Settings" : "Settings",
        href: `${workspaceRootHref}/settings`,
        active: activeSectionKey === "settings",
        state: `${isCn ? deploymentOption.nameCn : deploymentOption.nameEn} / ${isCn ? databaseOption.nameCn : databaseOption.nameEn}`,
        summary: isCn ? "部署、数据库、发布和分享入口" : "Deployment, database, publish, and sharing controls",
        detail: isCn ? deploymentOption.descriptionCn : deploymentOption.descriptionEn,
        countLabel: `${deploymentEnvGuide.length + databaseEnvGuide.length} env`,
      },
    ],
    [
      activeSectionKey,
      buildAcceptanceLabel,
      codeTabs.length,
      databaseEnvGuide.length,
      selectedCodeFile,
      selectedFileSummary,
      databaseOption.nameCn,
      databaseOption.nameEn,
      deploymentEnvGuide.length,
      deploymentOption.descriptionCn,
      deploymentOption.descriptionEn,
      deploymentOption.nameCn,
      deploymentOption.nameEn,
      featureCount,
      generatedRouteCount,
      isCn,
      moduleCount,
      project?.spec?.modules,
      projectSummary,
      recentRunItems,
      runtime?.status,
      workspaceRootHref,
      workspaceStatus.label,
      databaseOption.descriptionCn,
    ]
  )
  const overviewPrimaryControls = [
    {
      key: "dashboard",
      label: "Dashboard",
      note: isCn ? "把控制台、交付状态和工作区摘要放在一个主入口" : "Keep the control plane, delivery state, and workspace summary together",
      active: previewTab === "dashboard",
      action: () => setPreviewTab("dashboard"),
    },
    {
      key: "preview",
      label: copy.preview,
      note: isCn ? "优先看当前应用结果，不让杂项入口打散注意力" : "Keep the live app result in focus before secondary controls",
      active: previewTab === "preview",
      action: () => setPreviewTab("preview"),
    },
    {
      key: "code",
      label: copy.code,
      note: isCn ? "打开文件、标签和终端，让修改路径更接近真实 IDE" : "Open files, tabs, and terminal in a more IDE-like flow",
      active: previewTab === "code",
      action: () => setPreviewTab("code"),
    },
    {
      key: "runs",
      label: isCn ? "Runs" : "Runs",
      note: isCn ? "构建、preview 和 runtime 都收进同一块运行控制区" : "Keep build, preview, and runtime in one operating lane",
      active: activeSectionKey === "runs",
      action: () => window.location.assign(`${workspaceRootHref}/runs`),
    },
    {
      key: "templates",
      label: isCn ? "Templates" : "Templates",
      note: isCn ? "把模板、模块和可复用入口拉成一条资产线" : "Turn templates, modules, and reuse entrypoints into one asset lane",
      active: activeSectionKey === "templates",
      action: () => window.location.assign(`${workspaceRootHref}/templates`),
    },
    {
      key: "pricing",
      label: isCn ? "Pricing" : "Pricing",
      note: isCn ? "免费与付费差异先在展示层讲清楚" : "Make free-vs-paid differences obvious in the shell first",
      active: activeSectionKey === "pricing",
      action: () => window.location.assign(`${workspaceRootHref}/pricing`),
    },
    {
      key: "users",
      label: isCn ? "Users" : "Users",
      note: isCn ? "成员、权限和访问入口统一看，不再散落在主区" : "Keep members, access, and sharing in one place instead of scattering the main surface",
      active: activeSectionKey === "users",
      action: () => window.location.assign(`${workspaceRootHref}/users`),
    },
    {
      key: "data",
      label: isCn ? "Data" : "Data",
      note: isCn ? "把数据、部署和资源限制作为后续产品能力入口" : "Keep data, deployment, and resource policy ready for the next product layer",
      active: activeSectionKey === "data",
      action: () => window.location.assign(`${workspaceRootHref}/data`),
    },
    {
      key: "settings",
      label: isCn ? "Settings" : "Settings",
      note: isCn ? "环境、发布和交付策略在这里收口" : "Converge environment, publish, and delivery policy here",
      active: activeSectionKey === "settings",
      action: () => window.location.assign(`${workspaceRootHref}/settings`),
    },
  ] as const
  const overviewLaterControls = isCn
    ? ["Analytics", "Domains", "Integrations", "Security", "Agents", "Automations", "Logs", "API"]
    : ["Analytics", "Domains", "Integrations", "Security", "Agents", "Automations", "Logs", "API"]
  const overviewPinnedControls = overviewPrimaryControls.slice(0, 4)
  const overviewSecondaryControls = overviewPrimaryControls.slice(4)
  const copilotThreadItems = conversationItems.slice(0, 8)
  const copilotIntroPrompt = project?.history?.[0]?.prompt || generateTask?.summary || projectName

  useEffect(() => {
    if (!project) return

    const previewMode = project.preview?.activeMode ?? "static_ssr"
    const preferredPreviewUrl =
      project.preview?.resolvedUrl ||
      (previewMode === "sandbox_runtime" && project.preview?.sandboxStatus === "running"
        ? sandboxPreviewUrl
        : runtime?.status === "running"
          ? runtimePreviewUrl
          : canonicalPreviewUrl)
    const candidates = Array.from(new Set([preferredPreviewUrl, canonicalPreviewUrl].filter(Boolean)))
    let cancelled = false

    async function resolvePreviewTarget() {
      let nextState: PreviewProbeState = {
        projectSlug,
        previewMode,
        previewStatus: project.preview?.status ?? "idle",
        canonicalPreviewUrl,
        runtimePreviewUrl,
        sandboxPreviewUrl,
        resolvedPreviewUrl: getResolvedPreviewUrl({
          projectId: projectSlug,
          mode: previewMode,
          canonicalUrl: canonicalPreviewUrl,
          runtimeUrl: runtimePreviewUrl,
          sandboxUrl: sandboxPreviewUrl,
        }),
        fallbackUsed: true,
        responseStatus: null,
        renderStrategy: "structured_fallback",
      }

      for (const candidate of candidates) {
        try {
          const response = await fetch(candidate, {
            method: "GET",
            cache: "no-store",
            headers: {
              accept: "text/html",
              "x-mornstack-preview-probe": "1",
            },
          })

          const responsePath = response.url
            ? (() => {
                try {
                  const parsed = new URL(response.url)
                  return `${parsed.pathname}${parsed.search}`
                } catch {
                  return candidate
                }
              })()
            : candidate

          nextState = {
            projectSlug,
            previewMode,
            previewStatus: response.ok ? "ready" : project.preview?.status ?? "failed",
            canonicalPreviewUrl,
            runtimePreviewUrl,
            sandboxPreviewUrl,
            resolvedPreviewUrl: response.ok ? responsePath : canonicalPreviewUrl,
            fallbackUsed: candidate !== responsePath || responsePath === canonicalPreviewUrl,
            responseStatus: response.status,
            renderStrategy: response.ok ? "iframe" : "structured_fallback",
            responseUrl: response.url,
          }

          if (response.ok) {
            break
          }
        } catch {
          nextState = {
            projectSlug,
            previewMode,
            previewStatus: project.preview?.status ?? "failed",
            canonicalPreviewUrl,
            runtimePreviewUrl,
            sandboxPreviewUrl,
            resolvedPreviewUrl: canonicalPreviewUrl,
            fallbackUsed: true,
            responseStatus: 0,
            renderStrategy: "structured_fallback",
          }
        }
      }

      if (!cancelled) {
        setPreviewProbe(nextState)
        if (process.env.NODE_ENV !== "production") {
          console.info("[preview]", nextState)
        }
      }
    }

    void resolvePreviewTarget()
    return () => {
      cancelled = true
    }
  }, [
    canonicalPreviewUrl,
    previewRefreshKey,
    project,
    projectSlug,
    project?.preview?.status,
    runtime?.status,
    runtimePreviewUrl,
    sandboxPreviewUrl,
  ])

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading project...</div>
  }

  if (!project) {
    return (
      <div className={`rounded-md border p-4 text-sm ${projectMissing ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-600"}`}>
        {projectMissing
          ? "项目记录暂时还没同步完成，系统会继续自动重试加载。 Project record is still syncing and will retry automatically."
          : "Project not found."}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {isCn ? "返回 Dashboard" : "Back to Dashboard"}
      </Link>

      <div
        className={`grid gap-5 ${
          copilotCollapsed
            ? "xl:grid-cols-[88px_minmax(0,1fr)]"
            : "xl:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]"
        }`}
      >
      <div className="order-2 min-w-0 space-y-5 xl:order-2">
        <Card className="overflow-hidden rounded-[24px] border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.96))] shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{buildBadgeLabel}</Badge>
                <Badge
                  variant={workspaceStatus.tone === "destructive" ? "destructive" : workspaceStatus.tone === "warning" ? "secondary" : "outline"}
                  className={workspaceStatus.tone === "success" ? "bg-emerald-500/15 text-emerald-600" : undefined}
                >
                  {workspaceStatus.label}
                </Badge>
                {runtimeBadge}
                <Badge variant="outline">{copy.buildAcceptance}: {buildAcceptanceLabel}</Badge>
                {project?.preview?.activeMode ? <Badge variant="outline">{project.preview.activeMode}</Badge> : null}
                {runtime?.mode ? <Badge variant="outline">{runtime.mode}</Badge> : null}
                {generateTask?.templateTitle ? <Badge variant="outline">{generateTask.templateTitle}</Badge> : null}
              </div>
              <div className="flex items-start gap-3">
                {projectIcon ? (
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
                    style={{ background: `linear-gradient(135deg, ${projectIcon.from}, ${projectIcon.to})`, boxShadow: `0 0 0 1px ${projectIcon.ring}` }}
                  >
                    {projectIcon.glyph}
                  </div>
                ) : null}
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-foreground">{projectName}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{projectSubtitle}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border bg-secondary/30 px-3 py-1">{copy.workspaceTitle}</span>
                <span className="rounded-full border border-border bg-secondary/30 px-3 py-1">{copy.currentPath}: {currentPathLabel}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-2 lg:w-[352px] lg:justify-end">
              <Button variant="outline" size="sm" onClick={() => runAction("start")} disabled={runBusy} className="h-8 min-w-[96px] justify-center">
                <Play className="mr-1.5 h-4 w-4" />
                Start
              </Button>
              <Button variant="outline" size="sm" onClick={() => runAction("restart")} disabled={runBusy} className="h-8 min-w-[96px] justify-center">
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Restart
              </Button>
              <Button variant="outline" size="sm" onClick={() => runAction("stop")} disabled={runBusy} className="h-8 min-w-[96px] justify-center">
                <Square className="mr-1.5 h-4 w-4" />
                Stop
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[28px] border-border/70 bg-card/95 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <CardHeader className="gap-4 border-b border-border/70 bg-background/80">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-secondary/40 p-1.5">
                {[
                  { key: "preview", label: copy.preview },
                  { key: "dashboard", label: "Dashboard" },
                  { key: "code", label: copy.code },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPreviewTab(item.key as "preview" | "dashboard" | "code")}
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      previewTab === item.key
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={refreshPreview} disabled={runBusy && !canRenderPreview}>
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  {copy.refresh}
                </Button>
                {project?.preview?.supportsSandboxRuntime ? (
                  project?.preview?.activeMode === "sandbox_runtime" && project?.preview?.sandboxStatus === "running" ? (
                    <Button variant="outline" size="sm" onClick={() => sandboxAction("stop")} disabled={sandboxBusy}>
                      <SquareTerminal className="mr-1.5 h-4 w-4" />
                      {isCn ? "关闭高级预览" : "Stop Sandbox"}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => sandboxAction("start")} disabled={sandboxBusy}>
                      <SquareTerminal className="mr-1.5 h-4 w-4" />
                      {isCn ? "启动高级预览" : "Start Sandbox"}
                    </Button>
                  )
                ) : null}
                <a
                  href={resolvedPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-sm font-medium"
                >
                  {copy.openPreview}
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            {runtime?.lastError ? (
              <pre className="mb-3 max-h-56 overflow-auto rounded-md border border-amber-200 bg-amber-50 p-3 text-xs whitespace-pre-wrap text-amber-700">{runtime.lastError}</pre>
            ) : null}
            {runStatus ? (
              <pre className="mb-3 max-h-56 overflow-auto rounded-md border border-red-200 bg-red-50 p-3 text-xs whitespace-pre-wrap text-red-600">{runStatus}</pre>
            ) : null}
            {previewStarting && !runtime?.lastError && !runStatus ? (
              <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
                {copy.previewStarting}
              </div>
            ) : null}
            {fallbackReason ? (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {copy.fallbackReason}: {fallbackReason}
              </div>
            ) : null}
            {showPreviewDebug ? (
              <div className="mb-3 rounded-md border border-dashed border-border bg-secondary/20 px-3 py-2 text-[11px] text-muted-foreground">
                <div>projectSlug: {previewProbe?.projectSlug ?? projectSlug}</div>
                <div>storedProjectSlug: {project.projectSlug ?? "n/a"}</div>
                <div>routeProjectId: {projectId}</div>
                <div>projectId: {project.projectId}</div>
                <div>projectName: {projectName}</div>
                <div>projectFound: {String(Boolean(project?.projectId))}</div>
                <div>previewMode: {previewProbe?.previewMode ?? (project.preview?.activeMode || "static_ssr")}</div>
                <div>previewStatus: {previewProbe?.previewStatus ?? (project.preview?.status || "idle")}</div>
                <div>canonicalPreviewUrl: {previewProbe?.canonicalPreviewUrl ?? canonicalPreviewUrl}</div>
                <div>runtimePreviewUrl: {previewProbe?.runtimePreviewUrl ?? runtimePreviewUrl}</div>
                <div>sandboxPreviewUrl: {previewProbe?.sandboxPreviewUrl ?? sandboxPreviewUrl}</div>
                <div>sandboxExternalUrl: {project.preview?.sandboxExternalUrl ?? "n/a"}</div>
                <div>resolvedPreviewUrl: {previewProbe?.resolvedPreviewUrl ?? resolvedPreviewUrl}</div>
                <div>fallbackUsed: {String(previewProbe?.fallbackUsed ?? true)}</div>
                <div>responseStatus: {String(previewProbe?.responseStatus ?? "pending")}</div>
              </div>
            ) : null}

            {previewTab === "dashboard" ? (
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-5">
                  <div className="rounded-2xl border border-border bg-background/80 p-4">
                    <div className="text-xs text-muted-foreground">{copy.projectOverview}</div>
                    <div className="mt-2 text-lg font-semibold">{projectName}</div>
                    <div className="mt-2 text-sm text-muted-foreground">{projectSubtitle}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/80 p-4">
                    <div className="text-xs text-muted-foreground">{copy.generationStatus}</div>
                    <div className="mt-2 text-lg font-semibold">{workspaceStatus.label}</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {project.generation?.createdAt
                        ? new Date(project.generation.createdAt).toLocaleString()
                        : latestHistoryItem
                          ? new Date(latestHistoryItem.createdAt).toLocaleString()
                          : copy.generationStatusDesc}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/80 p-4">
                    <div className="text-xs text-muted-foreground">{copy.buildAcceptance}</div>
                    <div className="mt-2 text-lg font-semibold">{buildAcceptanceLabel}</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {project.generation?.summary || fallbackReason || copy.generationStatusDesc}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/80 p-4">
                    <div className="text-xs text-muted-foreground">{copy.deploymentTarget}</div>
                    <div className="mt-2 text-lg font-semibold">{isCn ? deploymentOption.nameCn : deploymentOption.nameEn}</div>
                    <div className="mt-2 text-sm text-muted-foreground">{workspaceRegion === "cn" ? (isCn ? "国内版" : "China") : isCn ? "国际版" : "Global"}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/80 p-4">
                    <div className="text-xs text-muted-foreground">{copy.dataTarget}</div>
                    <div className="mt-2 text-lg font-semibold">{isCn ? databaseOption.nameCn : databaseOption.nameEn}</div>
                    <div className="mt-2 text-sm text-muted-foreground">{codeFiles.length} {isCn ? "个文件已同步到工作区" : "files synced into the workspace"}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/80 p-5">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{sectionPageHeader.eyebrow}</div>
                  <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="text-xl font-semibold text-foreground">{sectionPageHeader.title}</div>
                      <div className="mt-2 max-w-3xl text-sm text-muted-foreground">{sectionPageHeader.summary}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{workspaceStatus.label}</Badge>
                      <Badge variant="outline">{generatedRouteCount} {isCn ? "页面" : "routes"}</Badge>
                      <Badge variant="outline">{moduleCount} {isCn ? "模块" : "modules"}</Badge>
                    </div>
                  </div>
                </div>

                {activeDashboardSection === "runs" ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {runPipelineStages.map((stage) => (
                        <div
                          key={stage.id}
                          className={`rounded-2xl border p-4 ${
                            stage.tone === "ready"
                              ? "border-emerald-500/25 bg-emerald-500/5"
                              : stage.tone === "warning"
                                ? "border-amber-500/25 bg-amber-500/5"
                                : "border-border bg-background/80"
                          }`}
                        >
                          <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{stage.label}</div>
                          <div className="mt-2 text-lg font-semibold text-foreground">{stage.state}</div>
                          <div className="mt-2 text-sm text-muted-foreground">{stage.note}</div>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                      <div className="rounded-2xl border border-border bg-background/80 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">{isCn ? "运行历史" : "Run history"}</div>
                            <div className="mt-1 text-sm text-muted-foreground">{isCn ? "按 branch / action / duration / time 展示最近的工作区运行记录。" : "Show the latest workspace runs by branch, action, duration, and time."}</div>
                          </div>
                          <Badge variant="outline">{runHistoryRows.length} {isCn ? "次运行" : "runs"}</Badge>
                        </div>
                        <div className="mt-4 overflow-hidden rounded-xl border border-border">
                          <div className="grid grid-cols-[100px_minmax(0,1.2fr)_100px_100px_150px] gap-3 border-b border-border bg-secondary/30 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            <span>Branch</span>
                            <span>{isCn ? "Action" : "Action"}</span>
                            <span>Status</span>
                            <span>{isCn ? "Duration" : "Duration"}</span>
                            <span>{isCn ? "Time" : "Time"}</span>
                          </div>
                          <div className="divide-y divide-border">
                            {runHistoryRows.length ? runHistoryRows.map((item) => (
                              <div key={item.id} className="grid grid-cols-[100px_minmax(0,1.2fr)_100px_100px_150px] gap-3 px-4 py-3 text-sm">
                                <div className="font-medium text-foreground">{item.branch}</div>
                                <div className="min-w-0">
                                  <div className="truncate text-foreground">{item.action}</div>
                                  <div className="mt-1 truncate text-xs text-muted-foreground">{item.summary}</div>
                                </div>
                                <div className="text-foreground">{item.status}</div>
                                <div className="text-muted-foreground">{item.duration}</div>
                                <div className="text-muted-foreground">{item.time}</div>
                              </div>
                            )) : (
                              <div className="px-4 py-6 text-sm text-muted-foreground">
                                {isCn ? "等待第一条运行记录写入。" : "Waiting for the first run to be recorded."}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-background/80 p-5">
                        <div className="text-sm font-semibold text-foreground">{isCn ? "运行流水线" : "Pipeline lanes"}</div>
                        <div className="mt-4 space-y-3">
                          {deliveryChecklist.map((item) => (
                            <div key={item.label} className="rounded-xl border border-border bg-secondary/20 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-medium text-foreground">{item.label}</div>
                                <Badge variant={item.ready ? "secondary" : "outline"}>{item.ready ? (isCn ? "已就绪" : "ready") : (isCn ? "待补" : "pending")}</Badge>
                              </div>
                              <div className="mt-2 text-sm text-muted-foreground">{item.value}</div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 rounded-xl border border-border bg-secondary/20 p-4">
                          <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{isCn ? "控制台注记" : "Control notes"}</div>
                          <div className="mt-3 space-y-2">
                            {runControlNotes.map((item) => (
                              <div key={item} className="rounded-lg border border-border bg-background/70 px-3 py-2 text-sm text-foreground">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeDashboardSection === "templates" ? (
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <div className="rounded-2xl border border-border bg-background/80 p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{isCn ? "模板库" : "Template library"}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{isCn ? "把当前工作区模板、复用模板和场景模板放进一个可搜索区域。" : "Put current, reusable, and scenario templates into one searchable area."}</div>
                        </div>
                        <Input
                          value={templateLibraryQuery}
                          onChange={(e) => setTemplateLibraryQuery(e.target.value)}
                          placeholder={isCn ? "搜索模板、分类、标签..." : "Search templates, categories, tags..."}
                          className="w-full lg:max-w-xs"
                        />
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {templateLibraryCards.map((card) => (
                          <div key={card.id} className="rounded-xl border border-border bg-secondary/20 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-foreground">{card.title}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{card.category}</div>
                              </div>
                              <Badge variant="outline">{card.tags[0]}</Badge>
                            </div>
                            <div className="mt-3 text-sm text-foreground">{card.note}</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {card.tags.map((tag) => (
                                <Badge key={tag} variant="secondary">{tag}</Badge>
                              ))}
                            </div>
                            <div className="mt-4 flex justify-end">
                              <Button variant="outline" size="sm">
                                {isCn ? "使用模板" : "Use template"}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-background/80 p-5">
                      <div className="text-sm font-semibold text-foreground">{isCn ? "模板分类与标签" : "Categories and tags"}</div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {Array.from(new Set(templateLibraryCards.flatMap((item) => [item.category, ...item.tags]))).map((tag) => (
                          <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                      <div className="mt-4 space-y-3">
                        <div className="rounded-xl border border-border bg-secondary/20 p-4">
                          <div className="text-xs text-muted-foreground">{isCn ? "当前生成模板" : "Current generated template"}</div>
                          <div className="mt-2 text-sm text-foreground">{generateTask?.templateTitle || (isCn ? "由 prompt 与 archetype 推断" : "Inferred from prompt and archetype")}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-secondary/20 p-4">
                          <div className="text-xs text-muted-foreground">{isCn ? "模块来源" : "Module inventory"}</div>
                          <div className="mt-2 text-sm text-foreground">{(project?.spec?.modules ?? []).join(", ") || (isCn ? "等待模块填充" : "Waiting for modules")}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeDashboardSection === "pricing" ? (
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                    <div className="rounded-2xl border border-border bg-background/80 p-5">
                      <div className="text-sm font-semibold text-foreground">{isCn ? "方案对比" : "Plan comparison"}</div>
                      <div className="mt-4 overflow-hidden rounded-xl border border-border">
                        <div className="grid grid-cols-[160px_repeat(3,minmax(0,1fr))] gap-3 border-b border-border bg-secondary/30 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          <span>{isCn ? "权益" : "Capability"}</span>
                          <span>{isCn ? "免费版" : "Explorer"}</span>
                          <span>Pro</span>
                          <span>Elite</span>
                        </div>
                        <div className="divide-y divide-border">
                          {pricingComparisonRows.map((row) => (
                            <div key={row.label} className="grid grid-cols-[160px_repeat(3,minmax(0,1fr))] gap-3 px-4 py-3 text-sm">
                              <div className="font-medium text-foreground">{row.label}</div>
                              <div className="text-muted-foreground">{row.explorer}</div>
                              <div className="text-foreground">{row.pro}</div>
                              <div className="text-foreground">{row.elite}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-background/80 p-5">
                      <div className="text-sm font-semibold text-foreground">{isCn ? "当前资源策略" : "Current resource policy"}</div>
                      <div className="mt-4 space-y-3">
                        {planShowcase.map((plan) => (
                          <div key={plan.id} className={`rounded-xl border p-4 ${plan.id === "pro" ? "border-primary/35 bg-primary/5" : "border-border bg-secondary/20"}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-foreground">{plan.name}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{plan.summary}</div>
                              </div>
                              <div className="text-sm font-semibold text-foreground">{plan.price}</div>
                            </div>
                            <div className="mt-3 text-xs text-muted-foreground">{plan.policy}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeDashboardSection === "settings" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {settingsSurfaceCards.map((card) => (
                      <div key={card.title} className="rounded-2xl border border-border bg-background/80 p-5">
                        <div className="text-sm font-semibold text-foreground">{card.title}</div>
                        <div className="mt-2 text-sm text-muted-foreground">{card.summary}</div>
                        <div className="mt-4 space-y-2">
                          {card.items.map((item) => (
                            <div key={item} className="rounded-xl border border-border bg-secondary/20 px-3 py-2 text-sm text-foreground">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {showDefaultDashboardPanels ? (
                  <>
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                      <div className="rounded-2xl border border-border bg-background/80 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">{isCn ? "优先事项看板" : "Priority board"}</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {isCn
                                ? "先把老板最关心的交付、编辑器和资源策略集中到一排。"
                                : "Keep the delivery, editor, and resource priorities in one visible row first."}
                            </div>
                          </div>
                          <Badge variant="outline">{dashboardPriorityCards.length} {isCn ? "个重点" : "priorities"}</Badge>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {dashboardPriorityCards.map((item) => (
                            <div key={item.id} className="rounded-xl border border-border bg-secondary/20 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.label}</div>
                                  <div className="mt-2 text-lg font-semibold text-foreground">{item.value}</div>
                                </div>
                                <Link
                                  href={item.href}
                                  className="inline-flex items-center rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                                >
                                  {isCn ? "进入" : "Open"}
                                </Link>
                              </div>
                              <div className="mt-3 text-sm text-muted-foreground">{item.note}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-background/80 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">{isCn ? "演示与交付队列" : "Demo and delivery queue"}</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {isCn
                                ? "把讲 Preview、讲 Code、讲 Runs、讲 Settings 的顺序排成一条线。"
                                : "Lay out the order for preview, code, runs, and settings as one clear narrative."}
                            </div>
                          </div>
                          <Badge variant="outline">{workspaceStatus.label}</Badge>
                        </div>

                        <div className="mt-4 space-y-3">
                          {dashboardOperatorQueue.map((item) => (
                            <div key={item.id} className="rounded-xl border border-border bg-secondary/20 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-foreground">{item.title}</div>
                                  <div className="mt-2 text-sm text-muted-foreground">{item.summary}</div>
                                </div>
                                <Link
                                  href={item.href}
                                  className="inline-flex shrink-0 items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                                >
                                  {item.actionLabel}
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                      <div className="rounded-2xl border border-border bg-background/80 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">{isCn ? "Control plane" : "Control plane"}</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {isCn
                                ? "把 Dashboard、Runs、Templates、Pricing、Settings 串成一条真正可解释的工作区线。"
                                : "Keep Dashboard, Runs, Templates, Pricing, and Settings on one explainable workspace thread."}
                            </div>
                          </div>
                          <Badge variant="outline">{generatedRouteCount} {isCn ? "页面" : "routes"}</Badge>
                        </div>

                        <div className="mt-4 grid gap-3">
                          {controlPlaneSections.map((section) => (
                            <div
                              key={section.key}
                              className={`rounded-2xl border p-4 transition ${
                                section.active ? "border-primary/35 bg-primary/5" : "border-border bg-secondary/20"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-foreground">{section.label}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">{section.summary}</div>
                                </div>
                                <Badge variant={section.active ? "default" : "outline"}>{section.state}</Badge>
                              </div>
                              <div className="mt-3 text-sm text-foreground">{section.detail}</div>
                              <div className="mt-3 flex items-center justify-between gap-3">
                                <span className="text-xs text-muted-foreground">{section.countLabel}</span>
                                <Link
                                  href={section.href}
                                  className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                                >
                                  {isCn ? "进入" : "Open"}
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-border bg-background/80 p-5">
                          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{focusedWorkspacePanel.eyebrow}</div>
                          <div className="mt-2 text-lg font-semibold text-foreground">{focusedWorkspacePanel.title}</div>
                          <div className="mt-2 text-sm text-muted-foreground">{focusedWorkspacePanel.summary}</div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {focusedWorkspacePanel.chips.map((chip) => (
                              <Badge key={chip} variant="outline">
                                {chip}
                              </Badge>
                            ))}
                          </div>
                          <div className="mt-4 space-y-2">
                            {focusedWorkspacePanel.points.map((point) => (
                              <div key={point} className="rounded-xl border border-border bg-secondary/20 px-3 py-2 text-sm text-foreground">
                                {point}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-background/80 p-5">
                          <div className="text-sm font-semibold text-foreground">{isCn ? "交付检查清单" : "Delivery checklist"}</div>
                          <div className="mt-4 space-y-3">
                            {deliveryChecklist.map((item) => (
                              <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/20 px-3 py-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-foreground">{item.label}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">{item.value}</div>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${item.ready ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-700"}`}>
                                  {item.ready ? (isCn ? "就绪" : "ready") : (isCn ? "待补" : "pending")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-2xl border border-border bg-background/80 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">{isCn ? "运行与交付" : "Runtime and delivery"}</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {isCn ? "最近的生成、修改和预览状态不再只藏在日志里。" : "The latest generation, iteration, and preview state are no longer buried in logs."}
                            </div>
                          </div>
                          <Badge variant="outline">{runtime?.status || (isCn ? "未启动" : "stopped")}</Badge>
                        </div>

                        <div className="mt-4 space-y-3">
                          {recentRunItems.length ? recentRunItems.map((item) => (
                            <div key={item.id} className="rounded-xl border border-border bg-secondary/20 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-medium text-foreground">{item.type === "generate" ? (isCn ? "生成" : "Generate") : (isCn ? "修改" : "Iterate")}</div>
                                <Badge variant={item.status === "done" ? "secondary" : "destructive"}>{item.status}</Badge>
                              </div>
                              <div className="mt-2 text-sm text-foreground">{item.summary}</div>
                              <div className="mt-2 text-xs text-muted-foreground">{item.time}</div>
                            </div>
                          )) : (
                            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                              {isCn ? "等待第一条运行记录进入控制区。" : "Waiting for the first runtime event to land in the control plane."}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {dashboardActions.slice(0, 4).map((action) => (
                            <button
                              key={action.label}
                              type="button"
                              onClick={action.onClick}
                              className="flex items-center justify-between rounded-xl border border-border bg-secondary/20 px-3 py-2 text-left text-sm text-foreground transition hover:border-primary/20 hover:bg-primary/5"
                            >
                              <span>{action.label}</span>
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-background/80 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">{isCn ? "模板与模块资产" : "Template and module inventory"}</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {isCn ? "模块、能力和页面结构一起描述模板厚度。" : "Modules, features, and routes now describe template depth together."}
                            </div>
                          </div>
                          <Badge variant="outline">{generateTask?.templateTitle || (isCn ? "Prompt 推断" : "Prompt inferred")}</Badge>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-xl border border-border bg-secondary/20 p-3">
                            <div className="text-xs text-muted-foreground">{isCn ? "模块" : "Modules"}</div>
                            <div className="mt-2 text-lg font-semibold text-foreground">{moduleCount}</div>
                            <div className="mt-2 text-xs text-muted-foreground">{(project?.spec?.modules ?? []).slice(0, 3).join(", ") || (isCn ? "等待模块填充" : "Waiting for modules")}</div>
                          </div>
                          <div className="rounded-xl border border-border bg-secondary/20 p-3">
                            <div className="text-xs text-muted-foreground">{isCn ? "能力" : "Features"}</div>
                            <div className="mt-2 text-lg font-semibold text-foreground">{featureCount}</div>
                            <div className="mt-2 text-xs text-muted-foreground">{(project?.spec?.features ?? []).slice(0, 3).join(", ") || (isCn ? "等待能力填充" : "Waiting for features")}</div>
                          </div>
                          <div className="rounded-xl border border-border bg-secondary/20 p-3">
                            <div className="text-xs text-muted-foreground">{isCn ? "页面" : "Routes"}</div>
                            <div className="mt-2 text-lg font-semibold text-foreground">{generatedRouteCount}</div>
                            <div className="mt-2 text-xs text-muted-foreground">{copy.generatedFiles}: {codeFiles.length}</div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-xl border border-border bg-secondary/20 p-4">
                            <div className="text-xs text-muted-foreground">{isCn ? "结构化摘要" : "Structured summary"}</div>
                            <div className="mt-3 space-y-2">
                              {overviewPoints.map((item) => (
                                <div key={item} className="text-sm text-foreground">
                                  {item}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border bg-secondary/20 p-4">
                            <div className="text-xs text-muted-foreground">{isCn ? "页面结构" : "Generated pages"}</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {pageManifest.length ? pageManifest.map((item) => (
                                <Badge key={item.filePath} variant="outline">
                                  {item.route}
                                </Badge>
                              )) : <span className="text-sm text-muted-foreground">{isCn ? "等待脚手架生成页面" : "Waiting for scaffold pages"}</span>}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-background/80 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">{isCn ? "Pricing 与资源权限" : "Pricing and resource policy"}</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {isCn ? "先把免费与付费的能力边界在工作台里说清楚。" : "Make the free-vs-paid capability boundary explicit inside the workspace first."}
                            </div>
                          </div>
                          <Badge variant="outline">{isCn ? "3 个展示档位" : "3 visible tiers"}</Badge>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-3">
                          {planShowcase.map((plan) => (
                            <div key={plan.id} className={`rounded-xl border p-4 ${plan.id === "pro" ? "border-primary/35 bg-primary/5" : "border-border bg-secondary/20"}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-foreground">{plan.name}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">{plan.summary}</div>
                                </div>
                                {plan.badge ? <Badge variant="secondary">{plan.badge}</Badge> : null}
                              </div>
                              <div className="mt-3 text-xl font-semibold text-foreground">{plan.price}</div>
                              <div className="mt-3 text-xs text-muted-foreground">{plan.policy}</div>
                              <div className="mt-3 space-y-2">
                                {plan.deliverables.slice(0, 3).map((item) => (
                                  <div key={item} className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs text-foreground">
                                    {item}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-background/80 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">{isCn ? "环境、预览与数据" : "Environment, preview, and data"}</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {isCn ? "把部署说明、数据库说明和连接指引直接收口到设置层。" : "Converge deployment notes, database guidance, and connection hints into the settings layer."}
                            </div>
                          </div>
                          <Badge variant="outline">{resolvedPreviewUrl ? (isCn ? "预览已解析" : "Preview resolved") : (isCn ? "等待预览" : "Preview pending")}</Badge>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-xl border border-border bg-secondary/20 p-4">
                            <div className="text-xs text-muted-foreground">{copy.deploymentTarget}</div>
                            <div className="mt-2 text-sm font-semibold text-foreground">{isCn ? deploymentOption.nameCn : deploymentOption.nameEn}</div>
                            <div className="mt-2 text-sm text-muted-foreground">{isCn ? deploymentOption.descriptionCn : deploymentOption.descriptionEn}</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {deploymentEnvGuide.map((item) => (
                                <Badge key={item} variant="outline">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border bg-secondary/20 p-4">
                            <div className="text-xs text-muted-foreground">{copy.dataTarget}</div>
                            <div className="mt-2 text-sm font-semibold text-foreground">{isCn ? databaseOption.nameCn : databaseOption.nameEn}</div>
                            <div className="mt-2 text-sm text-muted-foreground">{isCn ? databaseOption.descriptionCn : databaseOption.descriptionEn}</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {databaseEnvGuide.map((item) => (
                                <Badge key={item} variant="outline">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border bg-secondary/20 p-4">
                            <div className="text-xs text-muted-foreground">{copy.previewUrl}</div>
                            <div className="mt-2 break-all text-sm text-foreground">{resolvedPreviewUrl || (isCn ? "当前未就绪" : "Not ready yet")}</div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              {fallbackReason || (isCn ? "当前没有触发 fallback，优先使用当前解析到的预览地址。" : "No fallback is active right now, so the resolved preview address stays in focus.")}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border bg-secondary/20 p-4">
                            <div className="text-xs text-muted-foreground">{copy.latestAiUpdate}</div>
                            <div className="mt-2 text-sm text-foreground">{latestHistoryItem?.summary || generateTask?.summary || copy.applyHint}</div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              {project?.preview?.sandboxReadiness?.reason || (isCn ? "后续子域名、数据库和权限都可以继续从这里接上。" : "Domains, database, and permissions can continue from here next.")}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                    <div className="rounded-2xl border border-border bg-background/80 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{isCn ? "相关工作区" : "Related workspace surfaces"}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {isCn
                              ? "当前聚焦页保留自己的主内容，其余工作区入口收敛成辅助导航。"
                              : "Let the focused page keep the main stage while the rest of the workspace becomes supporting navigation."}
                          </div>
                        </div>
                        <Badge variant="outline">{controlPlaneSections.filter((section) => !section.active).length} {isCn ? "个关联页" : "linked views"}</Badge>
                      </div>

                      <div className="mt-4 grid gap-3">
                        {controlPlaneSections
                          .filter((section) => !section.active)
                          .slice(0, 4)
                          .map((section) => (
                            <div key={section.key} className="rounded-2xl border border-border bg-secondary/20 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-foreground">{section.label}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">{section.summary}</div>
                                </div>
                                <Badge variant="outline">{section.state}</Badge>
                              </div>
                              <div className="mt-3 text-sm text-foreground">{section.detail}</div>
                              <div className="mt-3 flex items-center justify-between gap-3">
                                <span className="text-xs text-muted-foreground">{section.countLabel}</span>
                                <Link
                                  href={section.href}
                                  className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                                >
                                  {isCn ? "进入" : "Open"}
                                </Link>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border bg-background/80 p-5">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{focusedWorkspacePanel.eyebrow}</div>
                        <div className="mt-2 text-lg font-semibold text-foreground">{focusedWorkspacePanel.title}</div>
                        <div className="mt-2 text-sm text-muted-foreground">{focusedWorkspacePanel.summary}</div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {focusedWorkspacePanel.chips.map((chip) => (
                            <Badge key={chip} variant="outline">
                              {chip}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-4 space-y-2">
                          {focusedWorkspacePanel.points.map((point) => (
                            <div key={point} className="rounded-xl border border-border bg-secondary/20 px-3 py-2 text-sm text-foreground">
                              {point}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-background/80 p-5">
                        <div className="text-sm font-semibold text-foreground">{isCn ? "当前页检查点" : "Current page checkpoints"}</div>
                        <div className="mt-4 space-y-3">
                          {deliveryChecklist.slice(0, 4).map((item) => (
                            <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/20 px-3 py-2">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-foreground">{item.label}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{item.value}</div>
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${item.ready ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-700"}`}>
                                {item.ready ? (isCn ? "就绪" : "ready") : (isCn ? "待补" : "pending")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-background/80 p-5">
                        <div className="text-sm font-semibold text-foreground">{isCn ? "继续操作" : "Continue from here"}</div>
                        <div className="mt-4 grid gap-2">
                          {dashboardActions.slice(0, 3).map((action) => (
                            <button
                              key={action.label}
                              type="button"
                              onClick={action.onClick}
                              className="flex items-center justify-between rounded-xl border border-border bg-secondary/20 px-3 py-2 text-left text-sm text-foreground transition hover:border-primary/20 hover:bg-primary/5"
                            >
                              <span>{action.label}</span>
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : previewTab === "code" ? (
            <div className="grid min-h-[78vh] gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="grid gap-3 xl:grid-cols-[56px_minmax(0,1fr)]">
                <div className="rounded-md border border-border bg-secondary/20 p-2">
                  <div className="space-y-2">
                    {editorRailItems.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setEditorRail(item.key)}
                        className={`flex h-10 w-full items-center justify-center rounded-xl border text-[11px] font-medium transition ${
                          editorRail === item.key
                            ? "border-primary/35 bg-primary/10 text-foreground"
                            : "border-transparent bg-background/70 text-muted-foreground hover:border-border hover:text-foreground"
                        }`}
                        title={item.label}
                      >
                        {item.short}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border border-border bg-secondary/20 p-3">
                  {editorRail === "explorer" ? (
                    <>
                      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                        <Search className="h-4 w-4" />
                        {isCn ? "Explorer" : "Explorer"}
                      </div>
                      <Input
                        value={codeQuery}
                        onChange={(e) => setCodeQuery(e.target.value)}
                        placeholder={isCn ? "过滤文件..." : "Filter files..."}
                        className="mb-3"
                      />
                      <div className="mb-3 rounded-xl border border-border bg-background p-3">
                        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{isCn ? "最近打开" : "Recent files"}</span>
                          <span>{recentCodeFiles.length}</span>
                        </div>
                        <div className="space-y-2">
                          {recentCodeFiles.length ? recentCodeFiles.slice(0, 5).map((filePath) => (
                            <button
                              key={filePath}
                              type="button"
                              onClick={() => {
                                setSelectedCodeFile(filePath)
                                setPreviewTab("code")
                              }}
                              className={`w-full rounded-md border px-3 py-2 text-left text-xs transition ${
                                selectedCodeFile === filePath
                                  ? "border-primary/30 bg-primary/5 text-foreground"
                                  : "border-border bg-background text-muted-foreground hover:border-primary/20 hover:text-foreground"
                              }`}
                            >
                              <div className="font-medium text-foreground">{filePath.split("/").slice(-1)[0]}</div>
                              <div className="mt-1 truncate">{filePath}</div>
                            </button>
                          )) : (
                            <div className="text-xs text-muted-foreground">
                              {isCn ? "等待你打开第一个文件。" : "Open a file to build your recent stack."}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mb-3 rounded-xl border border-border bg-background p-3">
                        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{isCn ? "页面映射" : "Page map"}</span>
                          <span>{routeFileEntries.length}</span>
                        </div>
                        <div className="space-y-2">
                          {routeFileEntries.slice(0, 6).map((entry) => (
                            <button
                              key={entry.filePath}
                              type="button"
                              onClick={() => {
                                setSelectedCodeFile(entry.filePath)
                                setPreviewTab("code")
                              }}
                              className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left text-xs text-foreground transition hover:border-primary/20 hover:bg-primary/5"
                            >
                              <span>{entry.route}</span>
                              <span className="truncate pl-3 text-muted-foreground">{entry.filePath.split("/").slice(-1)[0]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{copy.codeFiles}</span>
                        <span>{filteredCodeFiles.length}</span>
                      </div>
                      <div className="max-h-[45vh] overflow-auto space-y-1">
                        {renderInteractiveFileTree(
                          filteredCodeTree,
                          selectedCodeFile,
                          expandedCodeFolders,
                          setSelectedCodeFile,
                          toggleCodeFolder
                        )}
                      </div>
                    </>
                  ) : editorRail === "search" ? (
                    <>
                      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                        <Search className="h-4 w-4" />
                        {copy.commandSearch}
                      </div>
                      <Input
                        value={commandQuery}
                        onChange={(e) => setCommandQuery(e.target.value)}
                        placeholder={copy.commandSearchPlaceholder}
                        className="mb-3"
                      />
                      <div className="mb-4 max-h-48 space-y-2 overflow-auto">
                        {workspaceCommands.map((command) => (
                          <button
                            key={command.id}
                            type="button"
                            onClick={() => void handleWorkspaceCommand(command)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-left"
                          >
                            <div className="text-xs font-medium text-foreground">{command.label}</div>
                            <div className="mt-1 text-[11px] text-muted-foreground">{command.description}</div>
                          </button>
                        ))}
                      </div>
                      {searchResults.length ? (
                        <div className="rounded-md border border-border bg-background p-3">
                          <div className="mb-2 text-xs font-medium text-muted-foreground">{copy.searchResults}</div>
                          <div className="max-h-[46vh] space-y-2 overflow-auto">
                            {searchResults.slice(0, 10).map((result) => (
                              <button
                                key={result.path}
                                type="button"
                                onClick={() => setSelectedCodeFile(result.path)}
                                className="w-full rounded-md border border-border px-3 py-2 text-left"
                              >
                                <div className="text-xs font-medium text-foreground">{result.path}</div>
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  {result.symbols[0]?.name ? `symbol: ${result.symbols[0].name}` : result.matches[0]?.preview || "Open file"}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
                          {isCn ? "输入命令、文件名或符号后，这里会显示命中的工作区结果。" : "Search for a command, file, or symbol to surface workspace hits here."}
                        </div>
                      )}
                    </>
                  ) : editorRail === "routes" ? (
                    <>
                      <div className="mb-3 text-sm font-medium">{isCn ? "Route navigator" : "Route navigator"}</div>
                      <div className="space-y-2">
                        {routeFileEntries.map((entry) => (
                          <button
                            key={entry.filePath}
                            type="button"
                            onClick={() => {
                              setSelectedCodeFile(entry.filePath)
                              setPreviewTab("code")
                            }}
                            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-left transition hover:border-primary/20 hover:bg-primary/5"
                          >
                            <div className="text-sm font-medium text-foreground">{entry.route}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{entry.filePath}</div>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-3 text-sm font-medium">{isCn ? "Runtime output" : "Runtime output"}</div>
                      <div className="space-y-2">
                        {editorOutputItems.map((item) => (
                          <div key={item} className="rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground">
                            {item}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 rounded-xl border border-border bg-background p-3">
                        <div className="mb-2 text-xs font-medium text-muted-foreground">{isCn ? "快速动作" : "Quick actions"}</div>
                        <div className="grid gap-2">
                          {dashboardActions.slice(0, 3).map((action) => (
                            <button
                              key={action.label}
                              type="button"
                              onClick={action.onClick}
                              className="flex items-center justify-between rounded-md border border-border bg-secondary/20 px-3 py-2 text-left text-xs text-foreground transition hover:border-primary/20 hover:bg-primary/5"
                            >
                              <span>{action.label}</span>
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-border bg-black text-white">
                <div className="flex gap-2 overflow-auto border-b border-white/10 px-4 py-2 text-xs">
                  {codeTabs.map((tab) => (
                    <div key={tab} className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 ${
                      selectedCodeFile === tab ? "bg-white text-black" : "bg-white/5 text-white/70"
                    }`}>
                      <button type="button" onClick={() => setSelectedCodeFile(tab)}>
                        {tab.split("/").slice(-1)[0]}
                      </button>
                      <button type="button" onClick={() => closeCodeTab(tab)} className="text-[10px] opacity-70">
                        x
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2 text-[11px] text-white/55">
                  {editorBreadcrumbs.map((item, index) => (
                    <div key={`${index}-${item}`} className="flex items-center gap-2">
                      <span className="rounded-full bg-white/5 px-2 py-1 text-white/75">{item}</span>
                      {index < editorBreadcrumbs.length - 1 ? <span className="text-white/25">/</span> : null}
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 text-xs text-white/70 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-white">
                      {selectedCodeFile || copy.noFileSelected}
                      {hasUnsavedChanges ? ` • ${isCn ? "未保存" : "unsaved"}` : ""}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-white/45">
                      {selectedFileSummary || (isCn ? "左侧资源导航、页面映射和底部输出已经接进当前编辑器。" : "The left explorer, route map, and bottom output are all connected to the active editor now.")}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <span>{focusedLine ? (isCn ? `第 ${focusedLine} 行` : `Line ${focusedLine}`) : copy.noLineSelected}</span>
                    <button
                      type="button"
                      onClick={saveCodeFile}
                      disabled={!selectedCodeFile || codeSaving}
                      className="rounded-md border border-white/15 px-3 py-1.5 text-white disabled:opacity-50"
                    >
                      {codeSaving ? copy.saving : copy.save}
                    </button>
                    <button
                      type="button"
                      onClick={refreshPreview}
                      disabled={runBusy}
                      className="rounded-md border border-white/15 px-3 py-1.5 text-white disabled:opacity-50"
                    >
                      {copy.refreshPreview}
                    </button>
                    <a
                      href={resolvedPreviewUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {copy.openRaw}
                    </a>
                  </div>
                </div>
                {openedFromAi ? (
                  <div className="border-b border-violet-400/20 bg-violet-500/10 px-4 py-3 text-xs text-violet-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-violet-300/30 bg-violet-400/15 px-2.5 py-1 font-medium">
                        {isCn ? "来自 AI 上下文" : "Opened from AI context"}
                      </span>
                      <span className="text-violet-100/80">
                        {isCn
                          ? "编辑器已根据 AI 当前页面、模块和元素焦点自动对位。"
                          : "The editor aligned itself to the page, module, and element focus coming from AI."}
                      </span>
                    </div>
                    {aiEntrySummary.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {aiEntrySummary.map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-violet-300/20 bg-black/20 px-2.5 py-1 text-[11px] text-violet-50"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="grid min-h-[58vh] xl:grid-cols-[220px_52px_minmax(0,1fr)_260px]">
                  <div className="border-r border-white/10 bg-white/5 p-3">
                    <div className="mb-3 text-xs font-medium text-white/70">{copy.symbols}</div>
                    <div className="space-y-2">
                      {selectedCodeSymbols.length ? selectedCodeSymbols.map((symbol) => (
                        <button
                          key={`${symbol.kind}:${symbol.name}:${symbol.line}`}
                          type="button"
                          onClick={() => setFocusedLine(symbol.line)}
                          className={`w-full rounded-md px-2 py-1.5 text-left text-xs ${
                            focusedLine === symbol.line ? "bg-white text-black" : "bg-white/5 text-white/75"
                          }`}
                        >
                          <div>{symbol.name}</div>
                          <div className="mt-1 text-[10px] opacity-70">{symbol.kind} · {isCn ? `第 ${symbol.line} 行` : `line ${symbol.line}`}</div>
                        </button>
                      )) : (
                        <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55">
                          {copy.noSymbols}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border-r border-white/10 bg-black px-2 py-4 text-right text-xs text-white/35">
                    {codeLineNumbers.map((line) => (
                      <div key={line} className={focusedLine === line ? "text-amber-300" : ""}>
                        {line}
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={codeLoading ? copy.loadingFile : draftCodeContent}
                    onChange={(e) => setDraftCodeContent(e.target.value)}
                    disabled={codeLoading || !selectedCodeFile}
                    spellCheck={false}
                    className="min-h-[46vh] w-full min-w-0 resize-none bg-black p-4 text-xs leading-6 text-white outline-none xl:min-h-[58vh]"
                  />
                  <div className="border-l border-white/10 bg-white/5 p-3">
                    <div className="mb-3 text-xs font-medium text-white/70">{copy.diagnostics}</div>
                    <div className="space-y-2">
                      {codeDiagnostics.map((diagnostic) => (
                        <div
                          key={diagnostic.text}
                          className={`rounded-md px-3 py-2 text-xs ${
                            diagnostic.level === "warn" ? "bg-amber-500/15 text-amber-200" : "bg-white/5 text-white/75"
                          }`}
                        >
                          {diagnostic.text}
                        </div>
                      ))}
                    </div>
                    {searchResults.length ? (
                      <div className="mt-4">
                        <div className="mb-2 text-xs font-medium text-white/70">{copy.globalResults}</div>
                        <div className="max-h-[36vh] space-y-2 overflow-auto">
                          {searchResults.slice(0, 8).map((result) => (
                            <button
                              key={result.path}
                              type="button"
                              onClick={() => {
                                setSelectedCodeFile(result.path)
                                setFocusedLine(result.matches[0]?.line ?? result.symbols[0]?.line ?? null)
                              }}
                              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/80"
                            >
                              <div className="font-medium">{result.path}</div>
                              <div className="mt-1 text-[11px] text-white/50">
                                {result.matches[0]?.preview || result.symbols[0]?.name || "Open result"}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="border-t border-white/10 bg-[#0d1117]">
                  <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2 text-[11px] text-white/65">
                    {([
                      { key: "terminal", label: isCn ? "Terminal" : "Terminal" },
                      { key: "problems", label: isCn ? "Problems" : "Problems" },
                      { key: "output", label: isCn ? "Output" : "Output" },
                    ] as const).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setEditorBottomTab(item.key)}
                        className={`rounded-md px-3 py-1.5 transition ${
                          editorBottomTab === item.key ? "bg-white text-black" : "bg-white/5 text-white/70"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="max-h-[22vh] overflow-auto rounded-xl border border-white/10 bg-black/40 p-3">
                      {editorBottomTab === "terminal" ? (
                        <div className="space-y-2 font-mono text-[11px] text-emerald-200">
                          {editorTerminalLines.map((line, index) => (
                            <div key={`${index}-${line}`}>{line}</div>
                          ))}
                        </div>
                      ) : editorBottomTab === "problems" ? (
                        <div className="space-y-2">
                          {editorProblemItems.length ? editorProblemItems.map((item) => (
                            <div
                              key={item.id}
                              className={`rounded-md px-3 py-2 text-xs ${
                                item.level === "warn" ? "bg-amber-500/15 text-amber-200" : "bg-white/5 text-white/75"
                              }`}
                            >
                              {item.text}
                            </div>
                          )) : (
                            <div className="text-xs text-white/55">{isCn ? "当前没有新的问题。" : "No new problems right now."}</div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {editorOutputItems.map((item) => (
                            <div key={item} className="rounded-md bg-white/5 px-3 py-2 text-xs text-white/80">
                              {item}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="mb-2 text-xs font-medium text-white/70">{isCn ? "编辑器焦点" : "Editor focus"}</div>
                      <div className="space-y-2 text-xs text-white/70">
                        <div className="rounded-md bg-white/5 px-3 py-2">
                          {isCn ? "当前文件：" : "Current file: "} {selectedCodeFile || copy.noFileSelected}
                        </div>
                        <div className="rounded-md bg-white/5 px-3 py-2">
                          {isCn ? "活动 rail：" : "Active rail: "} {editorRailLabel}
                        </div>
                        <div className="rounded-md bg-white/5 px-3 py-2">
                          {isCn ? "输出面板：" : "Output panel: "} {editorBottomTabLabel}
                        </div>
                        <div className="rounded-md bg-white/5 px-3 py-2">
                          {isCn ? "页面路由：" : "Route: "} {currentCodeRoute || (isCn ? "未命中" : "not inferred")}
                        </div>
                        <div className="rounded-md bg-white/5 px-3 py-2">
                          {isCn ? "标签数量：" : "Open tabs: "} {codeTabs.length}
                        </div>
                      </div>
                    </div>
                  </div>
	                  <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3 text-[11px] text-white/60">
	                    {editorStatusItems.map((item) => (
	                      <div key={item.label} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
	                        {item.label}: {item.value}
	                      </div>
	                    ))}
	                  </div>
	                </div>
	              </div>
	            </div>
	            ) : previewProbe?.renderStrategy === "structured_fallback" ? (
            <StructuredPreviewFallback
              projectName={projectName}
              projectSubtitle={projectSubtitle}
              routes={project?.presentation?.routes ?? pageManifest.map((item) => item.route)}
              modules={project?.spec?.modules ?? []}
              features={project?.spec?.features ?? []}
              fallbackReason={fallbackReason}
              buildStatus={project?.generation?.buildStatus ?? null}
              isCn={isCn}
            />
          ) : canRenderPreview ? (
            <div className="space-y-2">
              <iframe
                key={`${resolvedPreviewUrl}:${previewRefreshKey}`}
                title="app-preview"
                src={resolvedPreviewUrl}
                className="w-full min-h-[65vh] rounded-md border border-border bg-white md:min-h-[78vh]"
              />
            </div>
          ) : previewStarting ? (
            <div className="min-h-[78vh] flex items-center justify-center text-sm text-muted-foreground">
              {copy.previewStarting}
            </div>
          ) : (
            <div className="min-h-[78vh] flex items-center justify-center text-sm text-muted-foreground">
              {copy.previewNotRunning}
            </div>
          )}
          </CardContent>
        </Card>
      </div>

      <div className="order-1 min-w-0 xl:order-1">
        <div className="sticky top-24">
          {copilotCollapsed ? (
            <Card className="overflow-hidden border-border/70 bg-card/95 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
              <CardContent className="flex min-h-[calc(100vh-8.5rem)] max-h-[calc(100vh-8.5rem)] flex-col items-center justify-between gap-4 p-3">
                <div className="flex w-full flex-col items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCopilotCollapsed(false)}
                    className="h-10 w-10 rounded-2xl border border-border bg-background/80"
                    aria-label={isCn ? "展开 AI 面板" : "Expand AI panel"}
                    title={isCn ? "展开 AI 面板" : "Expand AI panel"}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Bot className="h-5 w-5" />
                  </div>
                  <Badge
                    variant={workspaceStatus.tone === "destructive" ? "destructive" : workspaceStatus.tone === "warning" ? "secondary" : "outline"}
                    className={workspaceStatus.tone === "success" ? "bg-emerald-500/15 text-emerald-600" : undefined}
                  >
                    {workspaceStatus.label}
                  </Badge>
                  <div className="grid w-full gap-2">
                    {[
                      { label: "AI", value: aiModeLabel },
                      { label: "Tab", value: previewTab === "dashboard" ? "Dashboard" : previewTab === "code" ? copy.code : copy.preview },
                      { label: "File", value: contextFile ? contextFile.split("/").slice(-1)[0] : (isCn ? "未选中" : "none") },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-border bg-background/80 px-2.5 py-2 text-center">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{item.label}</div>
                        <div className="mt-1 break-words text-[11px] font-medium text-foreground">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-full rounded-2xl border border-dashed border-border bg-background/70 px-2.5 py-3 text-center">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{copy.aiStudio}</div>
                  <div className="mt-2 text-[11px] leading-5 text-foreground">
                    {isCn ? "展开后继续查看对话、上下文与待应用修改。" : "Expand to resume the live copilot thread, context, and queued changes."}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden border-border/70 bg-card/95 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
              <CardHeader className="space-y-4 border-b border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Bot className="h-4 w-4 text-primary" />
                      {copy.aiStudio}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{copy.workspaceSubtitle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={workspaceStatus.tone === "destructive" ? "destructive" : workspaceStatus.tone === "warning" ? "secondary" : "outline"}
                      className={workspaceStatus.tone === "success" ? "bg-emerald-500/15 text-emerald-600" : undefined}
                    >
                      {workspaceStatus.label}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCopilotCollapsed(true)}
                      className="h-9 w-9 rounded-2xl border border-border bg-background/80"
                      aria-label={isCn ? "收起 AI 面板" : "Collapse AI panel"}
                      title={isCn ? "收起 AI 面板" : "Collapse AI panel"}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 rounded-3xl border border-border bg-background/80 p-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{copy.taskSummary}</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">{projectName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{projectSubtitle}</div>
                    <div className="mt-3 text-sm text-foreground">{projectSummary}</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex min-h-[calc(100vh-8.5rem)] max-h-[calc(100vh-8.5rem)] flex-col gap-0 p-0">
                <div className="flex-1 space-y-4 overflow-auto p-4">
                  <div className="rounded-3xl border border-primary/15 bg-primary/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-[0.16em] text-primary">{copy.conversationHistory}</div>
                        <div className="mt-2 text-sm text-foreground">{copy.applyHint}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setGeneratePanelOpen((open) => !open)}>
                        {generatePanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border bg-background/80 p-4">
                    <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{copy.initialRequest}</div>
                    <div className="text-sm leading-7 text-foreground">{copilotIntroPrompt}</div>
                  </div>

                  {generatePanelOpen && generateTask?.logs?.length ? (
                    <div className="rounded-3xl border border-border bg-secondary/20 p-4">
                      <div className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{copy.runLogs}</div>
                      <div className="space-y-2">
                        {generateTask.logs.slice(-6).map((line, index) => (
                          <div key={`${index}-${line}`} className="flex gap-2 text-xs">
                            <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                            <span className="text-muted-foreground">{line}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {copilotThreadItems.length ? (
                    copilotThreadItems.map((item, index) => (
                      <div
                        key={item.id}
                        className={`rounded-3xl border p-4 ${
                          index === 0 ? "border-primary/20 bg-primary/5" : "border-border bg-background/85"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.type}</div>
                          <Badge variant={item.status === "done" ? "secondary" : "destructive"}>{item.status}</Badge>
                        </div>
                        <div className="text-sm font-medium leading-6 text-foreground">{item.prompt}</div>
                        {item.summary ? <div className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</div> : null}
                        <div className="mt-3 text-xs text-muted-foreground">{item.time}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                      {copy.noConversation}
                    </div>
                  )}
                </div>

                <div className="border-t border-border/70 bg-background/95 p-4">
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-border bg-background/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-foreground">{copy.assistantMode}</div>
                        <Badge variant="outline">{aiModeLabel}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {([
                          { key: "explain", label: copy.explainMode },
                          { key: "fix", label: copy.fixMode },
                          { key: "generate", label: copy.generateMode },
                          { key: "refactor", label: copy.refactorMode },
                        ] as Array<{ key: AiMode; label: string }>).map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setAiMode(item.key)}
                            className={`rounded-2xl border px-3 py-2 text-sm transition ${
                              aiMode === item.key
                                ? "border-primary/40 bg-primary/10 text-foreground"
                                : "border-border bg-background text-muted-foreground hover:border-primary/20 hover:text-foreground"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-border bg-background/80 p-4">
                      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{copy.currentContext}</div>
                      <div className="mt-2 text-sm font-semibold text-foreground">{contextFile || (isCn ? "当前未选择文件" : "No active file selected")}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {copy.currentRoute}: {contextRoute || (isCn ? "未命中页面路由" : "No page route inferred")}
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border bg-secondary/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{isCn ? "页面" : "Page"}</div>
                          <div className="mt-1 text-xs font-medium text-foreground">{contextPage.label}</div>
                        </div>
                        <div className="rounded-2xl border border-border bg-secondary/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{isCn ? "模块" : "Module"}</div>
                          <div className="mt-1 text-xs font-medium text-foreground">{contextModule.name}</div>
                        </div>
                        <div className="rounded-2xl border border-border bg-secondary/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{isCn ? "元素" : "Element"}</div>
                          <div className="mt-1 text-xs font-medium text-foreground">{contextElement.name}</div>
                        </div>
                        <div className="rounded-2xl border border-border bg-secondary/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{isCn ? "会话" : "Session"}</div>
                          <div className="mt-1 text-xs font-medium text-foreground">{contextSession?.activeSection || activeSectionKey || contextPage.id}</div>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{isCn ? "模块锚点" : "Module anchors"}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {availableAiSymbols.map((symbol) => (
                              <button
                                key={symbol}
                                type="button"
                                onClick={() => setAiTargetSymbol(symbol)}
                                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                                  aiTargetSymbol === symbol
                                    ? "border-primary/40 bg-primary/10 text-foreground"
                                    : "border-border bg-background text-muted-foreground hover:border-primary/20 hover:text-foreground"
                                }`}
                              >
                                {symbol}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{isCn ? "元素锚点" : "Element anchors"}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {availableAiElements.map((element) => (
                              <button
                                key={element}
                                type="button"
                                onClick={() => setAiTargetElement(element)}
                                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                                  aiTargetElement === element
                                    ? "border-primary/40 bg-primary/10 text-foreground"
                                    : "border-border bg-background text-muted-foreground hover:border-primary/20 hover:text-foreground"
                                }`}
                              >
                                {element}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-3 text-sm font-medium text-foreground">{copy.quickSuggestions}</div>
                      <div className="flex flex-wrap gap-2">
                        {quickSuggestions.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setPrompt(item)}
                            className="rounded-full border border-border bg-background px-3 py-2 text-xs text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-border bg-background/80 p-4">
                      <div className="text-sm font-medium text-foreground">{copy.queuedChanges}</div>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={copy.continuePrompt}
                        className="mt-3 min-h-[120px] w-full resize-none rounded-2xl border border-border bg-background px-3 py-3 text-sm outline-none"
                      />
                      {iterateStatus ? <p className="mt-3 text-xs text-muted-foreground">{iterateStatus}</p> : null}
                      {iterateResult?.summary ? <p className="mt-2 text-xs text-muted-foreground">{iterateResult.summary}</p> : null}
                      {iterateResult?.warning ? <p className="mt-2 text-xs text-amber-600">{iterateResult.warning}</p> : null}
                      {iterateResult?.thinking ? (
                        <div className="mt-3 rounded-2xl border border-border bg-secondary/20 p-3">
                          <div className="mb-2 text-xs font-medium">{copy.modelOutput}</div>
                          <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{iterateResult.thinking}</pre>
                        </div>
                      ) : null}
                      {iterateResult?.changedFiles?.length ? (
                        <div className="mt-3 rounded-2xl border border-border bg-secondary/20 p-3">
                          <div className="mb-2 text-xs font-medium">{copy.changedFiles}</div>
                          <div className="max-h-28 overflow-auto">
                            {renderSelectableFileTree(iterateTree, selectedCodeFile, (filePath) => {
                              setSelectedCodeFile(filePath)
                              setPreviewTab("code")
                              setEditorRail("explorer")
                              setFocusedLine(null)
                            })}
                          </div>
                        </div>
                      ) : null}
                      {iterateResult?.build?.logs?.length ? (
                        <div className="mt-3 rounded-2xl border border-border bg-secondary/20 p-3">
                          <div className="mb-2 text-xs font-medium">{copy.buildAcceptance}</div>
                          <div className="mb-2 text-xs text-muted-foreground">
                            {iterateResult.build.status === "ok"
                              ? copy.buildPassed
                              : iterateResult.build.status === "failed"
                                ? copy.buildFailed
                                : copy.buildPending}
                          </div>
                          <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                            {iterateResult.build.logs.join("\n")}
                          </pre>
                        </div>
                      ) : null}
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <Button onClick={iterate} disabled={iterating} className="w-full">
                          <Wand2 className="mr-2 h-4 w-4" />
                          {iterating ? copy.applying : aiMode === "explain" ? copy.explainMode : copy.applyChange}
                        </Button>
                        <Button onClick={revertLastChange} disabled={revertBusy} variant="outline" className="w-full">
                          <Undo2 className="mr-2 h-4 w-4" />
                          {revertBusy ? copy.reverting : copy.revert}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

    </div>
    </div>
  )
}
