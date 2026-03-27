"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import {
  Bot,
  ChevronDown,
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
import { buildCanonicalPreviewUrl, buildRuntimePreviewUrl, buildSandboxPreviewUrl, getResolvedPreviewUrl } from "@/lib/preview-url"
import {
  PREVIEW_SNAPSHOT_STORAGE_KEY,
  buildPreviewSnapshotAliases,
  type PreviewSnapshot,
} from "@/lib/preview-snapshot"

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
  preview?: {
    defaultMode: "static_ssr"
    activeMode: "static_ssr" | "dynamic_runtime" | "sandbox_runtime"
    status: "idle" | "building" | "ready" | "failed"
    canonicalUrl: string
    runtimeUrl: string
    sandboxUrl: string | null
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
  error?: string
}

type GenerateTaskResp = {
  projectId?: string
  jobId: string
  status: "queued" | "running" | "done" | "error"
  logs?: string[]
  summary?: string
  changedFiles?: string[]
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

function StructuredPreviewFallback({
  projectName,
  projectSubtitle,
  isCn,
}: {
  projectName: string
  projectSubtitle: string
  isCn: boolean
}) {
  const pages = isCn
    ? [
        { key: "dashboard", label: "总览", desc: "项目概览、状态与路径摘要" },
        { key: "editor", label: "编辑器", desc: "文件树、多标签编辑器与 AI 助手" },
        { key: "runs", label: "运行", desc: "构建状态、运行记录与交付流程" },
        { key: "templates", label: "模板库", desc: "场景模板、模块能力与复用入口" },
        { key: "pricing", label: "升级", desc: "免费版、专业版、精英版分层方案" },
      ]
    : [
        { key: "dashboard", label: "Dashboard", desc: "Project overview, state, and path summary" },
        { key: "editor", label: "Editor", desc: "File tree, tabs, and AI assistant" },
        { key: "runs", label: "Runs", desc: "Build state, runtime history, and delivery flow" },
        { key: "templates", label: "Templates", desc: "Scenario templates and reusable modules" },
        { key: "pricing", label: "Pricing", desc: "Free, Pro, and Elite plan structure" },
      ]

  return (
    <div className="rounded-3xl border border-border bg-background/90 p-6 shadow-sm">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {isCn
          ? "动态预览暂时不可用，已自动切换为结构化 fallback preview。"
          : "Dynamic preview is unavailable, so the structured fallback preview is shown."}
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

        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {pages.map((page) => (
            <div key={page.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">{page.label}</div>
              <div className="mt-2 text-sm text-white/60">{page.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AppWorkspacePage({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams()
  const jobId = searchParams.get("jobId") || projectId
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
  const [previewTab, setPreviewTab] = useState<"preview" | "dashboard" | "code">("preview")
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
    setSelectedCodeFile((current) => current || prioritized[0] || "")
    setCodeTabs((current) => (current.length ? current : prioritized.slice(0, 4)))
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
    setIterateStatus("Applying change...")
    setIterateResult(null)
    try {
      const iterateCtrl = new AbortController()
      const iterateTimer = setTimeout(() => iterateCtrl.abort(), 180_000)
      const res = await fetch("/api/iterate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt: text }),
        signal: iterateCtrl.signal,
      })
      clearTimeout(iterateTimer)
      const json = (await res.json()) as IterateResp
      setIterateResult(json)
      if (!res.ok || json.status === "error") {
        setIterateStatus(json.error || "Iteration failed")
      } else {
        setIterateStatus("Iteration completed")
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
      await loadProject()
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
    dashboard: isCn ? "总览" : "Overview",
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
    workspaceSubtitle: isCn ? "左侧查看结果，右侧持续驱动 AI 修改。" : "Review results on the left and keep iterating with AI on the right.",
    projectOverview: isCn ? "项目概览" : "Project Overview",
    aiStudio: isCn ? "AI 共创助手" : "AI Co-Creation",
    taskSummary: isCn ? "当前任务摘要" : "Current task summary",
    conversationHistory: isCn ? "创作记录" : "Creation history",
    quickSuggestions: isCn ? "快捷修改建议" : "Quick suggestions",
    continuePrompt: isCn ? "继续告诉 AI 你要改什么..." : "Tell AI what to change next...",
    queuedChanges: isCn ? "待应用修改" : "Queued change",
    applyHint: isCn ? "右侧输入修改建议后，左侧工作区会继续承接最新结果。" : "Add a change request on the right and the left workspace will keep reflecting the latest result.",
    currentPath: isCn ? "当前路径" : "Current path",
    deploymentTarget: isCn ? "部署环境" : "Deployment target",
    dataTarget: isCn ? "数据 / 文档方案" : "Data / document path",
    latestAiUpdate: isCn ? "最近一次 AI 更新" : "Latest AI update",
    openPreview: isCn ? "打开预览" : "Open Preview",
    refresh: isCn ? "刷新" : "Refresh",
    initialRequest: isCn ? "初始需求" : "Initial prompt",
    noConversation: isCn ? "生成完成后，这里会记录你和 AI 的持续修改过程。" : "Once generation finishes, this rail will capture your ongoing edits with AI.",
  } as const
  const projectSlug = project?.projectId || projectId
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
    getResolvedPreviewUrl({
      projectId: projectSlug,
      mode: project?.preview?.activeMode ?? "static_ssr",
      canonicalUrl: canonicalPreviewUrl,
      runtimeUrl: runtimePreviewUrl,
      sandboxUrl: sandboxPreviewUrl,
    })
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
  const dashboardActions = useMemo(
    () => [
      { label: "Open App", onClick: () => resolvedPreviewUrl && window.open(resolvedPreviewUrl, "_blank", "noopener,noreferrer") },
      { label: "Open Files", onClick: () => window.open(`/api/projects/${encodeURIComponent(projectId)}/files`, "_blank", "noopener,noreferrer") },
      { label: "Open Docs", onClick: () => window.open("/api-docs", "_blank", "noopener,noreferrer") },
      ...(project?.preview?.supportsDynamicRuntime && runtimePreviewUrl ? [{ label: "Open Runtime", onClick: () => window.open(runtimePreviewUrl, "_blank", "noopener,noreferrer") }] : []),
      ...(project?.preview?.supportsSandboxRuntime && sandboxPreviewUrl ? [{ label: "Open Sandbox", onClick: () => window.open(sandboxPreviewUrl, "_blank", "noopener,noreferrer") }] : []),
    ],
    [resolvedPreviewUrl, project?.preview?.supportsDynamicRuntime, project?.preview?.supportsSandboxRuntime, projectId, runtimePreviewUrl, sandboxPreviewUrl]
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

  useEffect(() => {
    if (!project) return

    const previewMode = project.preview?.activeMode ?? "static_ssr"
    const preferredPreviewUrl =
      previewMode === "sandbox_runtime" && project.preview?.sandboxStatus === "running"
        ? sandboxPreviewUrl
        : runtime?.status === "running"
          ? runtimePreviewUrl
          : ""
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 space-y-4">
        <Card className="border-border/70 bg-card/90">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
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
                {runtime?.mode ? <Badge variant="outline">{runtime.mode}</Badge> : null}
                {generateTask?.templateTitle ? <Badge variant="outline">{generateTask.templateTitle}</Badge> : null}
              </div>
              <div className="flex items-start gap-3">
                {projectIcon ? (
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-semibold text-white"
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
              <Button variant="outline" size="sm" onClick={() => runAction("start")} disabled={runBusy} className="h-9 min-w-[104px] justify-center">
                <Play className="mr-1.5 h-4 w-4" />
                Start
              </Button>
              <Button variant="outline" size="sm" onClick={() => runAction("restart")} disabled={runBusy} className="h-9 min-w-[104px] justify-center">
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Restart
              </Button>
              <Button variant="outline" size="sm" onClick={() => runAction("stop")} disabled={runBusy} className="h-9 min-w-[104px] justify-center">
                <Square className="mr-1.5 h-4 w-4" />
                Stop
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/70 bg-card/90">
          <CardHeader className="gap-3 border-b border-border/70 bg-background/50">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-secondary/30 p-1">
                {[
                  { key: "preview", label: copy.preview },
                  { key: "dashboard", label: "Dashboard" },
                  { key: "code", label: copy.code },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPreviewTab(item.key as "preview" | "dashboard" | "code")}
                    className={`rounded-xl px-3 py-2 text-sm transition ${
                      previewTab === item.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
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
            {process.env.NODE_ENV !== "production" && previewTab === "preview" ? (
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
                <div className="grid gap-4 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border bg-background/80 p-4 xl:col-span-1">
                    <div className="text-xs text-muted-foreground">{copy.projectOverview}</div>
                    <div className="mt-2 text-lg font-semibold">{projectName}</div>
                    <div className="mt-2 text-sm text-muted-foreground">{projectSubtitle}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/80 p-4 xl:col-span-1">
                    <div className="text-xs text-muted-foreground">{copy.generationStatus}</div>
                    <div className="mt-2 text-lg font-semibold">{workspaceStatus.label}</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {latestHistoryItem ? new Date(latestHistoryItem.createdAt).toLocaleString() : copy.generationStatusDesc}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/80 p-4 xl:col-span-1">
                    <div className="text-xs text-muted-foreground">{copy.deploymentTarget}</div>
                    <div className="mt-2 text-lg font-semibold">{project.deploymentTarget || "vercel"}</div>
                    <div className="mt-2 text-sm text-muted-foreground">{copy.currentPath}: {workspaceRegion === "cn" ? (isCn ? "国内版" : "China") : isCn ? "国际版" : "International"}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/80 p-4 xl:col-span-1">
                    <div className="text-xs text-muted-foreground">{copy.dataTarget}</div>
                    <div className="mt-2 text-lg font-semibold">{project.databaseTarget || workspaceDatabase}</div>
                    <div className="mt-2 text-sm text-muted-foreground">{copy.generatedFiles}: {codeFiles.length}</div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
                  <div className="rounded-2xl border border-border bg-background/80 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{isCn ? "产品概览" : "Product overview"}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{projectSummary}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{workspaceRegion === "cn" ? (isCn ? "国内" : "China") : isCn ? "海外" : "Global"}</Badge>
                        <Badge variant="outline">{project.deploymentTarget || "vercel"}</Badge>
                        <Badge variant="outline">{project.databaseTarget || workspaceDatabase}</Badge>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-border bg-secondary/20 p-3">
                        <div className="text-xs text-muted-foreground">{copy.previewUrl}</div>
                        <div className="mt-2 break-all text-sm">{resolvedPreviewUrl || "Not running"}</div>
                      </div>
                      <div className="rounded-xl border border-border bg-secondary/20 p-3">
                        <div className="text-xs text-muted-foreground">{copy.latestAiUpdate}</div>
                        <div className="mt-2 text-sm">{latestHistoryItem?.summary || generateTask?.summary || copy.applyHint}</div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
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
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-background/80 p-4">
                    <div className="text-sm font-semibold text-foreground">{isCn ? "运行与交付" : "Runtime and delivery"}</div>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {dashboardActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={action.onClick}
                          className="flex w-full items-center justify-between rounded-xl border border-border bg-secondary/20 px-3 py-2 text-left hover:bg-secondary/30"
                        >
                          <span>{action.label}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 rounded-xl border border-border bg-secondary/20 p-3">
                      <div className="text-xs text-muted-foreground">{isCn ? "预览状态" : "Preview status"}</div>
                      <div className="mt-2 text-sm text-foreground">{workspaceStatus.label}</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {project?.preview?.activeMode === "sandbox_runtime"
                          ? project?.preview?.sandboxStatus === "running"
                            ? (isCn ? "当前正在使用 Sandbox 高级预览。" : "Sandbox preview is active.")
                            : (isCn ? "Sandbox 尚未就绪，已自动回退到 canonical preview。" : "Sandbox is not ready, so canonical preview is active.")
                          : runtime?.lastError || runStatus || (previewStarting ? copy.previewStarting : isCn ? "当前默认使用站内 canonical preview，runtime 仅作为增强模式。" : "Canonical preview is active by default, with runtime only as an enhancement.")}
                      </div>
                    </div>
                    {project?.preview?.supportsSandboxRuntime || project?.preview?.sandboxReadiness ? (
                      <div className="mt-4 rounded-xl border border-border bg-secondary/20 p-3">
                        <div className="text-xs text-muted-foreground">{isCn ? "Sandbox 就绪状态" : "Sandbox readiness"}</div>
                        <div className="mt-2 text-sm text-foreground">
                          {project.preview.sandboxReadiness?.supported
                            ? isCn
                              ? "可用"
                              : "ready"
                            : isCn
                              ? "未配置完成"
                              : "not configured"}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {project.preview.sandboxReadiness?.reason || (isCn ? "等待配置" : "Waiting for configuration")}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4 rounded-xl border border-border bg-secondary/20 p-3">
                      <div className="text-xs text-muted-foreground">{isCn ? "最近任务结果" : "Latest task result"}</div>
                      <div className="mt-2 text-sm text-foreground">{projectSummary}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : previewTab === "code" ? (
            <div className="grid min-h-[78vh] gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="rounded-md border border-border bg-secondary/20 p-3">
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
                <div className="mb-4 max-h-40 space-y-2 overflow-auto">
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
                  <div className="mb-4 rounded-md border border-border bg-background p-3">
                    <div className="mb-2 text-xs font-medium text-muted-foreground">{copy.searchResults}</div>
                    <div className="max-h-48 space-y-2 overflow-auto">
                      {searchResults.slice(0, 8).map((result) => (
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
                ) : null}
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{copy.codeFiles}</span>
                  <span>{filteredCodeFiles.length}</span>
                </div>
                <div className="max-h-[68vh] overflow-auto space-y-1">
                  {renderSelectableFileTree(filteredCodeTree, selectedCodeFile, setSelectedCodeFile)}
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
                <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 text-xs text-white/70 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-white">
                      {selectedCodeFile || copy.noFileSelected}
                      {hasUnsavedChanges ? ` • ${isCn ? "未保存" : "unsaved"}` : ""}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-white/45">
                      {selectedFileSummary || (isCn ? "左侧目录与右侧编辑器已经联动，选中文件后这里会展示真实代码内容。" : "The left explorer and right editor are linked. Selecting a file renders its real code here.")}
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
                <div className="grid min-h-[72vh] xl:grid-cols-[220px_52px_minmax(0,1fr)_260px]">
                  <div className="border-r border-white/10 bg-white/5 p-3">
                    <div className="mb-3 text-xs font-medium text-white/70">{copy.symbols}</div>
                    <div className="space-y-2">
                      {selectedCodeSymbols.map((symbol) => (
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
                      ))}
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
                    className="min-h-[56vh] w-full min-w-0 resize-none bg-black p-4 text-xs leading-6 text-white outline-none xl:min-h-[72vh]"
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
                        <div className="max-h-[48vh] space-y-2 overflow-auto">
                          {searchResults.slice(0, 10).map((result) => (
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
              </div>
            </div>
          ) : previewProbe?.renderStrategy === "structured_fallback" ? (
            <StructuredPreviewFallback projectName={projectName} projectSubtitle={projectSubtitle} isCn={isCn} />
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

      <div className="min-w-0">
        <div className="sticky top-24">
          <Card className="border-border/70 bg-card/95 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <CardHeader className="space-y-4 border-b border-border/70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Bot className="h-4 w-4 text-primary" />
                    {copy.aiStudio}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{copy.applyHint}</p>
                </div>
                <Badge
                  variant={workspaceStatus.tone === "destructive" ? "destructive" : workspaceStatus.tone === "warning" ? "secondary" : "outline"}
                  className={workspaceStatus.tone === "success" ? "bg-emerald-500/15 text-emerald-600" : undefined}
                >
                  {workspaceStatus.label}
                </Badge>
              </div>

              <div className="grid gap-3 rounded-2xl border border-border bg-secondary/20 p-3">
                <div>
                  <div className="text-xs text-muted-foreground">{copy.projectOverview}</div>
                  <div className="mt-1 text-sm font-semibold">{projectName}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{projectSubtitle}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{copy.taskSummary}</div>
                  <div className="mt-1 text-sm text-foreground">{projectSummary}</div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 p-4">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-medium">{copy.conversationHistory}</div>
                  <Button variant="ghost" size="sm" onClick={() => setGeneratePanelOpen((open) => !open)}>
                    {generatePanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="max-h-[42vh] space-y-3 overflow-auto pr-1">
                  <div className="rounded-2xl border border-border bg-background/80 p-3">
                    <div className="mb-2 text-xs font-medium text-muted-foreground">{copy.initialRequest}</div>
                    <div className="text-sm line-clamp-6">{project.history[0]?.prompt || generateTask?.summary || projectName}</div>
                  </div>

                  {generatePanelOpen && generateTask?.logs?.length ? (
                    <div className="rounded-2xl border border-border bg-secondary/20 p-3">
                      <div className="mb-2 text-xs font-medium text-muted-foreground">{copy.runLogs}</div>
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

                  {conversationItems.length ? (
                    conversationItems.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-border bg-background/80 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.type}</div>
                          <Badge variant={item.status === "done" ? "secondary" : "destructive"}>{item.status}</Badge>
                        </div>
                        <div className="text-sm font-medium text-foreground line-clamp-4">{item.prompt}</div>
                        {item.summary ? <div className="mt-2 text-sm text-muted-foreground">{item.summary}</div> : null}
                        <div className="mt-3 text-xs text-muted-foreground">{item.time}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                      {copy.noConversation}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm font-medium">{copy.quickSuggestions}</div>
                <div className="flex flex-wrap gap-2">
                  {quickSuggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPrompt(item)}
                      className="rounded-full border border-border bg-background px-3 py-2 text-xs text-foreground hover:border-primary/30 hover:bg-primary/5"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border bg-background/80 p-3">
                <div className="text-sm font-medium">{copy.queuedChanges}</div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={copy.continuePrompt}
                  className="min-h-[120px] w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none"
                />
                {iterateStatus ? <p className="text-xs text-muted-foreground">{iterateStatus}</p> : null}
                {iterateResult?.summary ? <p className="text-xs text-muted-foreground">{iterateResult.summary}</p> : null}
                {iterateResult?.changedFiles?.length ? (
                  <div className="rounded-xl border border-border bg-secondary/20 p-3">
                    <div className="mb-2 text-xs font-medium">{copy.changedFiles}</div>
                    <div className="max-h-32 overflow-auto">{renderFileTree(iterateTree)}</div>
                  </div>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={iterate} disabled={iterating} className="w-full">
                    <Wand2 className="mr-2 h-4 w-4" />
                    {iterating ? copy.applying : copy.applyChange}
                  </Button>
                  <Button onClick={revertLastChange} disabled={revertBusy} variant="outline" className="w-full">
                    <Undo2 className="mr-2 h-4 w-4" />
                    {revertBusy ? copy.reverting : copy.revert}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
