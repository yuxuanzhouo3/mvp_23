"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import { ChevronDown, ChevronUp, ExternalLink, Play, RotateCcw, Search, Sparkles, Square, SquareTerminal, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

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
  createdAt: string
  updatedAt: string
  region: "cn" | "intl"
  deploymentTarget?: string
  databaseTarget?: string
  workspacePath: string
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

export function AppWorkspacePage({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams()
  const jobId = searchParams.get("jobId") || projectId
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
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
  const [appVisibility, setAppVisibility] = useState<"public" | "private">("public")
  const [requireLogin, setRequireLogin] = useState(true)
  const [inviteStatus, setInviteStatus] = useState("Ready to invite")
  const [publishStatus, setPublishStatus] = useState<"draft" | "ready" | "published">("draft")
  const [publishChannel, setPublishChannel] = useState<"preview" | "staging" | "production">("preview")
  const [dashboardSearch, setDashboardSearch] = useState("")

  async function loadProject() {
    const res = await fetch(`/api/projects?projectId=${encodeURIComponent(projectId)}`)
    if (!res.ok) {
      setLoading(false)
      return
    }
    const json = await res.json()
    setProject(json.project as ProjectDetail)
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
      setInviteStatus("Latest code saved")
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
  }, [generateTask?.status, previewBooting, project?.runtime?.status, projectId, isCn])

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
    openRaw: isCn ? "打开原始内容" : "Open Raw",
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
  } as const
  const previewUrl = runtime?.url
  const previewTabUrl = previewUrl || ""
  const canRenderPreview = Boolean(previewUrl) && runtime?.status === "running"
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
        description: "Switch to live app preview",
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
        description: previewUrl || "Preview URL unavailable",
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
  }, [codeFiles, commandQuery, previewUrl, searchResults])
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
    if (command.action === "open-preview" && previewUrl) {
      window.open(previewUrl, "_blank", "noopener,noreferrer")
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
  const recentDashboardEvents = useMemo(
    () => [
      { title: "Publish configuration updated", meta: `channel · ${publishChannel}` },
      { title: "Invite workflow ready", meta: inviteStatus },
      { title: "Workspace visibility synced", meta: `${appVisibility}${requireLogin ? " · login required" : ""}` },
      { title: "Latest generation status", meta: generateTask?.status ?? "unknown" },
    ],
    [publishChannel, inviteStatus, appVisibility, requireLogin, generateTask?.status]
  )
  const dashboardActions = useMemo(
    () => [
      { label: "Open App", onClick: () => previewUrl && window.open(previewUrl, "_blank", "noopener,noreferrer") },
      { label: "Share App", onClick: () => setInviteStatus("Share link prepared for stakeholders") },
      { label: "Publish", onClick: () => setPublishStatus("published") },
    ],
    [previewUrl]
  )

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading project...</div>
  }

  if (!project) {
    return <div className="text-sm text-red-500">Project not found.</div>
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {copy.generationStatus}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {copy.generationStatusDesc}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setGeneratePanelOpen((open) => !open)}>
            {generatePanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">job: {jobId}</Badge>
            {generateTask?.templateTitle ? <Badge variant="outline">template: {generateTask.templateTitle}</Badge> : null}
            <Badge
              variant={
                generateTask?.status === "done"
                  ? "secondary"
                  : generateTask?.status === "error" && !recoveringGenerateTask
                    ? "destructive"
                    : "outline"
              }
            >
              {recoveringGenerateTask ? "recovering" : generateTask?.status ?? "loading"}
            </Badge>
          </div>

          {generatePanelOpen && generateTask?.logs?.length ? (
            <div className="rounded-md border border-border bg-secondary/40 p-3">
              <div className="text-xs font-medium mb-2">{copy.runLogs}</div>
              <div className="space-y-2">
                {generateTask.logs.map((line, index) => (
                  <div key={`${index}-${line}`} className="flex gap-2 text-xs">
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="text-muted-foreground">{line}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {recoveringGenerateTask ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              生成过程曾被热更新打断，系统正在自动恢复，本次不会直接判定失败。
            </div>
          ) : null}

          {generateTask?.summary ? (
            <div className="rounded-md border border-border p-3">
              <div className="text-xs font-medium mb-1">{copy.generationSummary}</div>
              <p className="text-sm">{generateTask.summary}</p>
            </div>
          ) : null}

          {aiInterpretation ? (
            <div className="rounded-md border border-border p-3 bg-secondary/20">
              <div className="text-xs font-medium mb-1">{copy.artifactState}</div>
              <p className="text-sm text-muted-foreground">{aiInterpretation}</p>
            </div>
          ) : null}

          {generateTask?.changedFiles?.length ? (
            <div className="rounded-md border border-border bg-secondary/40 p-3">
              <div className="mb-2 text-xs font-medium">{copy.changedFiles}</div>
              <div className="max-h-48 overflow-auto">{renderFileTree(generatedTree)}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.iterateProject}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={copy.iteratePlaceholder}
            className="min-w-0"
          />
          <Button onClick={iterate} disabled={iterating} className="w-full">
            <SquareTerminal className="h-4 w-4 mr-2" />
            {iterating ? copy.applying : copy.applyChange}
          </Button>
          <Button onClick={revertLastChange} disabled={revertBusy} variant="outline" className="w-full">
            <Undo2 className="h-4 w-4 mr-2" />
            {revertBusy ? copy.reverting : copy.revert}
          </Button>
          {iterateStatus ? <p className="text-xs text-muted-foreground">{iterateStatus}</p> : null}
          {iterateResult?.summary ? <p className="text-xs">{iterateResult.summary}</p> : null}
          {iterateResult?.changedFiles?.length ? (
            <div className="rounded-md border border-border bg-secondary/40 p-3">
              <div className="mb-2 text-xs font-medium">Changed Files</div>
              <div className="max-h-48 overflow-auto">{renderFileTree(iterateTree)}</div>
            </div>
          ) : null}
          {iterateResult?.thinking ? (
            <pre className="text-xs whitespace-pre-wrap rounded-md bg-secondary p-2 border border-border max-h-48 overflow-auto">
{iterateResult.thinking}
            </pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{project.projectId}</CardTitle>
          <div className="flex items-center gap-2">
            {runtimeBadge}
            {runtime?.mode ? <Badge variant="outline">{runtime.mode}</Badge> : null}
            <Button variant="outline" size="sm" onClick={() => runAction("start")} disabled={runBusy}>
              <Play className="h-4 w-4 mr-1.5" />
              Start
            </Button>
            <Button variant="outline" size="sm" onClick={() => runAction("restart")} disabled={runBusy}>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Restart
            </Button>
            <Button variant="outline" size="sm" onClick={() => runAction("stop")} disabled={runBusy}>
              <Square className="h-4 w-4 mr-1.5" />
              Stop
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {runtime?.lastError ? (
            <pre className="text-xs text-amber-700 mb-3 whitespace-pre-wrap rounded-md border border-amber-200 bg-amber-50 p-3 overflow-auto max-h-56">{runtime.lastError}</pre>
          ) : null}
          {previewStarting && !runtime?.lastError && !runStatus ? (
            <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
              {isCn
                ? "预览正在启动，通常是在安装依赖、修复生成文件或拉起本地 Next 预览。若超过 45 秒仍未就绪，再看下方诊断。"
                : "Preview is starting. It may be installing dependencies, repairing generated files, or launching the local Next preview. If it is still not ready after 45 seconds, inspect the diagnostics below."}
            </div>
          ) : null}
          {runStatus ? (
            <pre className="text-xs text-red-600 mb-3 whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 p-3 overflow-auto max-h-56">{runStatus}</pre>
          ) : null}
          <div className="mb-3 flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/30 p-1">
              {[
                { key: "preview", label: copy.preview },
                { key: "dashboard", label: copy.dashboard },
                { key: "code", label: copy.code },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPreviewTab(item.key as "preview" | "dashboard" | "code")}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    previewTab === item.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {previewTab === "preview" ? (
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <span className="hidden min-w-0 truncate md:inline">{previewTabUrl}</span>
                <a href={previewTabUrl} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">
                  Open
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ) : null}
          </div>
          {previewTab === "dashboard" ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-border/70">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">{copy.previewUrl}</div>
                    <div className="mt-2 break-all text-sm">{previewUrl || "Not running"}</div>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">{copy.generatedFiles}</div>
                    <div className="mt-2 text-2xl font-semibold">{codeFiles.length}</div>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">{copy.workspace}</div>
                    <div className="mt-2 break-all text-sm">{project.workspacePath}</div>
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-border/70">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">{isCn ? "部署目标" : "Deployment target"}</div>
                    <div className="mt-2 text-sm font-medium">{project.deploymentTarget || (isCn ? "未指定" : "Not set")}</div>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">{isCn ? "数据库目标" : "Database target"}</div>
                    <div className="mt-2 text-sm font-medium">{project.databaseTarget || (isCn ? "未指定" : "Not set")}</div>
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-md border border-border bg-secondary/20 p-4">
                    <div className="text-sm font-medium">{copy.openAndDelivery}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={previewUrl || "#"} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm">
                      Open App Preview
                    </a>
                    <a href={`/api/projects/${encodeURIComponent(projectId)}/files`} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm">
                      Open File Manifest
                    </a>
                    <a href="/api-docs" className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm">
                      Open Docs
                    </a>
                  </div>
                </div>
                  <div className="rounded-md border border-border bg-secondary/20 p-4">
                    <div className="text-sm font-medium">{copy.workspaceProfile}</div>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <p className="text-base font-semibold text-foreground">morncursor</p>
                    <p>{isCn ? "面向中国研发团队的 AI 代码编辑平台，深度集成业务交付、销售资产管理和团队协作。" : "An AI coding workspace for delivery-focused teams, combining execution visibility, collaboration, and launch readiness."}</p>
                    <p>{copy.workspaceProfileDesc}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {dashboardActions.map((action) => (
                        <Button key={action.label} size="sm" variant={action.label === "Publish" ? "default" : "outline"} onClick={action.onClick}>
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                <div className="rounded-md border border-border bg-background p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Search className="h-4 w-4" />
                    {copy.workspaceSearch}
                  </div>
                  <Input value={commandQuery} onChange={(e) => setCommandQuery(e.target.value)} placeholder={copy.commandSearchPlaceholder} />
                  <div className="mt-3 max-h-[52vh] space-y-2 overflow-auto">
                    {workspaceCommands.map((command) => (
                      <button
                        key={command.id}
                        type="button"
                        onClick={() => void handleWorkspaceCommand(command)}
                        className="w-full rounded-md border border-border bg-secondary/20 px-3 py-2 text-left"
                      >
                        <div className="text-sm font-medium">{command.label}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{command.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-md border border-border bg-background p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                      <Search className="h-4 w-4" />
                      {copy.dashboardSearchTitle}
                    </div>
                    <Input
                      value={dashboardSearch}
                      onChange={(e) => setDashboardSearch(e.target.value)}
                      placeholder={copy.dashboardSearchPlaceholder}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        "visibility",
                        "invite users",
                        "publish status",
                        "runtime",
                        "integrations",
                        "distribution",
                      ]
                        .filter((item) => !dashboardSearch || item.toLowerCase().includes(dashboardSearch.toLowerCase()))
                        .map((item) => (
                          <div key={item} className="rounded-md border border-border bg-secondary/20 px-3 py-2 text-xs">
                            {item}
                          </div>
                        ))}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border border-border bg-background p-4">
                      <div className="text-lg font-semibold">{copy.appVisibility}</div>
                      <div className="mt-2 text-sm text-muted-foreground">{copy.appVisibilityDesc}</div>
                      <div className="mt-4 space-y-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setAppVisibility("public")}
                            className={`rounded-md border px-3 py-2 text-sm ${appVisibility === "public" ? "border-foreground bg-foreground text-background" : "border-border bg-secondary/20"}`}
                          >
                            {copy.public}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAppVisibility("private")}
                            className={`rounded-md border px-3 py-2 text-sm ${appVisibility === "private" ? "border-foreground bg-foreground text-background" : "border-border bg-secondary/20"}`}
                          >
                            {copy.private}
                          </button>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={requireLogin} onChange={(e) => setRequireLogin(e.target.checked)} />
                          {copy.requireLogin}
                        </label>
                      </div>
                    </div>
                    <div className="rounded-md border border-border bg-background p-4">
                      <div className="text-lg font-semibold">{copy.inviteUsers}</div>
                      <div className="mt-2 text-sm text-muted-foreground">{copy.inviteUsersDesc}</div>
                      <div className="mt-4 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setInviteStatus(isCn ? "链接已复制" : "Link copied to clipboard")}>{copy.copyLink}</Button>
                        <Button size="sm" onClick={() => setInviteStatus(isCn ? "邀请流程已排队" : "Invite flow queued")}>{copy.sendInvites}</Button>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">{inviteStatus}</div>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border border-border bg-background p-4">
                      <div className="text-lg font-semibold">{copy.moveToWorkspace}</div>
                      <div className="mt-2 text-sm text-muted-foreground">{copy.moveToWorkspaceDesc}</div>
                      <div className="mt-4 flex justify-end">
                        <Button variant="outline" size="sm">{copy.moveApp}</Button>
                      </div>
                    </div>
                    <div className="rounded-md border border-border bg-background p-4">
                      <div className="text-lg font-semibold">{copy.publishStatusTitle}</div>
                      <div className="mt-2 text-sm text-muted-foreground">{copy.publishStatusDesc}</div>
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex gap-2">
                          {(["draft", "ready", "published"] as const).map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => setPublishStatus(status)}
                              className={`rounded-md border px-3 py-1.5 text-xs ${
                                publishStatus === status ? "border-foreground bg-foreground text-background" : "border-border bg-secondary/20"
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          {(["preview", "staging", "production"] as const).map((channel) => (
                            <button
                              key={channel}
                              type="button"
                              onClick={() => setPublishChannel(channel)}
                              className={`rounded-md border px-3 py-1.5 text-xs ${
                                publishChannel === channel ? "border-foreground bg-foreground text-background" : "border-border bg-secondary/20"
                              }`}
                            >
                              {channel}
                            </button>
                          ))}
                        </div>
                        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">Preview: {runtime?.status ?? "stopped"}</div>
                        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">Code files: {codeFiles.length}</div>
                        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">Latest task: {generateTask?.status ?? "unknown"}</div>
                        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">Publish state: {publishStatus}</div>
                        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">Channel: {publishChannel}</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border border-border bg-background p-4">
                      <div className="text-lg font-semibold">{copy.integrationsTitle}</div>
                      <div className="mt-2 text-sm text-muted-foreground">{copy.integrationsDesc}</div>
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">{copy.loginProviders}</div>
                        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">Preview runtime / API docs / Generated assets</div>
                        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">
                          {copy.standaloneSurfaces}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-md border border-border bg-background p-4">
                      <div className="text-lg font-semibold">{copy.securityTitle}</div>
                      <div className="mt-2 text-sm text-muted-foreground">{copy.securityDesc}</div>
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">Require login before app access</div>
                        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">Preview token protection</div>
                        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">Preview runtime readiness checklist</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border border-border bg-background p-4">
                      <div className="text-lg font-semibold">{copy.recentActivityTitle}</div>
                      <div className="mt-3 space-y-2">
                        {recentDashboardEvents.map((event) => (
                          <div key={event.title + event.meta} className="rounded-md border border-border bg-secondary/20 px-3 py-2">
                            <div className="text-sm font-medium">{event.title}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{event.meta}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-md border border-border bg-background p-4">
                      <div className="text-lg font-semibold">{copy.distributionTitle}</div>
                      <div className="mt-2 text-sm text-muted-foreground">{copy.distributionDesc}</div>
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">Web preview: {previewUrl || "pending"}</div>
                        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">{isCn ? "文档与演示资产：/api-docs /generated/promo-assets/latest" : "Docs and demo assets: /api-docs /generated/promo-assets/latest"}</div>
                        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">{isCn ? "独立后台：/admin /market" : "Standalone back-office: /admin /market"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-border bg-secondary/20 p-4">
                <div className="mb-2 text-sm font-medium">{copy.workspaceFiles}</div>
                <div className="max-h-[48vh] overflow-auto">{renderFileTree(allCodeTree)}</div>
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
                      onClick={() => runAction("restart")}
                      disabled={runBusy}
                      className="rounded-md border border-white/15 px-3 py-1.5 text-white disabled:opacity-50"
                    >
                      {copy.refreshPreview}
                    </button>
                    <a
                      href={selectedCodeFile ? `/api/projects/${encodeURIComponent(projectId)}/files?path=${encodeURIComponent(selectedCodeFile)}` : "#"}
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
          ) : canRenderPreview ? (
            <div className="space-y-2">
              <iframe
                title="app-preview"
                src={previewTabUrl}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.historySummary}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {project.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{copy.noHistory}</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {project.history
                .slice()
                .reverse()
                .map((item) => (
                  <div key={item.id} className="rounded-xl border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.type}</span>
                      <Badge variant={item.status === "done" ? "secondary" : "destructive"}>{item.status}</Badge>
                    </div>
                    <p className="line-clamp-4 text-sm text-muted-foreground whitespace-pre-wrap">{item.prompt}</p>
                    {item.summary ? <p className="mt-2 text-sm">{item.summary}</p> : null}
                    {item.error ? <p className="mt-2 text-xs text-red-500">{item.error}</p> : null}
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                      <span>{item.changedFiles?.length ?? 0} {copy.fileUnit}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
