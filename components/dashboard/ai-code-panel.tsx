"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import { Sparkles, MessageSquare, ArrowRight, FileCode2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/lib/i18n"
import { buildWorkspaceEditorHref, WORKSPACE_EDITOR_SOURCE_AI } from "@/lib/workspace-editor-link"
import {
  buildCodePlatformContextRoutes,
  findCodePlatformRouteById,
  inferCodePlatformElementContext,
  inferCodePlatformModuleContext,
  inferCodePlatformPageContext,
  type WorkspaceElementContext,
  type WorkspaceModuleContext,
  type WorkspacePageContext,
  type WorkspaceSessionContext,
  type WorkspaceSymbolRef,
} from "@/lib/workspace-ai-context"

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

type ProjectSummary = {
  region: "cn" | "intl"
  spec?: {
    title?: string
    kind?: string
    features?: string[]
    deploymentTarget?: string
    databaseTarget?: string
  } | null
  presentation?: {
    displayName?: string
  } | null
  generation?: {
    buildStatus?: "ok" | "failed" | "skipped" | null
  } | null
}

type ProjectFileContentResp = {
  projectId: string
  path: string
  content: string
  symbols?: WorkspaceSymbolRef[]
}

function getSectionFromPathname(pathname: string | null) {
  const parts = String(pathname ?? "").split("/").filter(Boolean)
  if (parts[0] !== "apps") return "dashboard"
  return parts[2] || "dashboard"
}

function getWorkspaceSurface(section: string) {
  if (section === "editor") return "code"
  if (["dashboard", "runs", "templates", "pricing", "settings", "users", "data"].includes(section)) {
    return "dashboard"
  }
  return "preview"
}

export function AiCodePanel() {
  const [mode, setMode] = useState<"explain" | "fix" | "generate" | "refactor">("generate")
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [result, setResult] = useState<IterateResp | null>(null)
  const [project, setProject] = useState<ProjectSummary | null>(null)
  const [currentFileSymbols, setCurrentFileSymbols] = useState<WorkspaceSymbolRef[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState("")
  const [selectedElement, setSelectedElement] = useState("")
  const { t, locale } = useLocale()
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const projectId = String(params?.id ?? "")
  const activeSection = useMemo(() => getSectionFromPathname(pathname), [pathname])
  const workspaceSurface = useMemo(() => getWorkspaceSurface(activeSection), [activeSection])
  const workspaceRegion = project?.region === "cn" ? "cn" : "intl"
  const workspaceRoutes = useMemo(
    () =>
      buildCodePlatformContextRoutes({
        region: workspaceRegion,
        features: project?.spec?.features ?? [],
      }),
    [project?.spec?.features, workspaceRegion]
  )
  const routeDefinition = useMemo(
    () => findCodePlatformRouteById(workspaceRoutes, activeSection) ?? findCodePlatformRouteById(workspaceRoutes, "dashboard"),
    [activeSection, workspaceRoutes]
  )
  const pageContext = useMemo(
    () =>
      inferCodePlatformPageContext({
        routes: workspaceRoutes,
        region: workspaceRegion,
        currentFilePath: routeDefinition?.filePath,
        currentRoute: routeDefinition?.href ?? `/${activeSection}`,
        activeSection,
        previewTab: workspaceSurface,
      }),
    [activeSection, routeDefinition?.filePath, routeDefinition?.href, workspaceRoutes, workspaceRegion, workspaceSurface]
  )
  const availableSymbols = useMemo(() => {
    const realSymbols = currentFileSymbols.map((item) => item.name).filter(Boolean)
    return Array.from(new Set((realSymbols.length ? realSymbols : pageContext.symbols).filter(Boolean)))
  }, [currentFileSymbols, pageContext.symbols])
  const moduleContext = useMemo(
    () =>
      inferCodePlatformModuleContext({
        currentFilePath: pageContext.filePath,
        currentFileSymbols,
        currentPage: pageContext,
        activeSymbolName: selectedSymbol,
      }),
    [currentFileSymbols, pageContext, selectedSymbol]
  )
  const elementContext = useMemo(
    () =>
      inferCodePlatformElementContext({
        currentPage: pageContext,
        activeElementName: selectedElement,
        previewTab: workspaceSurface,
      }),
    [pageContext, selectedElement, workspaceSurface]
  )
  const sharedSession = useMemo<WorkspaceSessionContext>(
    () => ({
      projectName: project?.presentation?.displayName || project?.spec?.title || undefined,
      specKind: project?.spec?.kind || "workspace",
      workspaceSurface,
      activeSection,
      deploymentTarget: project?.spec?.deploymentTarget || undefined,
      databaseTarget: project?.spec?.databaseTarget || undefined,
      region: workspaceRegion,
      workspaceStatus: project?.generation?.buildStatus || undefined,
    }),
    [
      activeSection,
      project?.generation?.buildStatus,
      project?.presentation?.displayName,
      project?.spec?.databaseTarget,
      project?.spec?.deploymentTarget,
      project?.spec?.kind,
      project?.spec?.title,
      workspaceRegion,
      workspaceSurface,
    ]
  )
  const resolvedContext = result?.context
  const contextPage = resolvedContext?.currentPage ?? pageContext
  const contextModule = resolvedContext?.currentModule ?? moduleContext
  const contextElement = resolvedContext?.currentElement ?? elementContext
  const contextSession = resolvedContext?.sharedSession ?? sharedSession
  const contextSymbols = resolvedContext?.currentFileSymbols?.length ? resolvedContext.currentFileSymbols : currentFileSymbols
  const targetFilePath = resolvedContext?.currentFilePath || pageContext.filePath

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    fetch(`/api/projects?projectId=${encodeURIComponent(projectId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.project) return
        setProject(json.project as ProjectSummary)
      })
      .catch(() => {
        if (!cancelled) setProject(null)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  useEffect(() => {
    setSelectedSymbol((current) => (current && availableSymbols.includes(current) ? current : availableSymbols[0] || ""))
    setSelectedElement((current) => (current && pageContext.elements.includes(current) ? current : pageContext.elements[0] || ""))
  }, [availableSymbols, pageContext])

  useEffect(() => {
    if (!projectId || !pageContext.filePath) {
      setCurrentFileSymbols([])
      return
    }
    let cancelled = false
    fetch(`/api/projects/${encodeURIComponent(projectId)}/files?path=${encodeURIComponent(pageContext.filePath)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return
        setCurrentFileSymbols((json as ProjectFileContentResp | null)?.symbols ?? [])
      })
      .catch(() => {
        if (!cancelled) setCurrentFileSymbols([])
      })
    return () => {
      cancelled = true
    }
  }, [pageContext.filePath, projectId])

  function openTargetInEditor(filePath: string) {
    const resolvedFocusFile = targetFilePath || pageContext.filePath
    const keepFocusContext = filePath === resolvedFocusFile
    const symbolLine =
      keepFocusContext
        ? contextSymbols.find((item) => item.name === contextModule.name)?.line || resolvedContext?.focusedLine
        : undefined
    router.push(
      buildWorkspaceEditorHref({
        projectId,
        filePath,
        symbol: keepFocusContext ? contextModule.name : undefined,
        element: keepFocusContext ? contextElement.name : undefined,
        line: symbolLine,
        source: WORKSPACE_EDITOR_SOURCE_AI,
        pageId: contextPage.id,
        route: contextPage.route,
      })
    )
  }

  async function handleIterate() {
    const prompt = value.trim()
    if (!prompt || !projectId) {
      return
    }
    try {
      setLoading(true)
      setStatus(mode === "explain" ? "Inspecting current app context..." : "Applying changes...")
      setResult(null)

      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 180_000)
      const res = await fetch("/api/iterate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          prompt,
          mode,
          currentFilePath: pageContext.filePath,
          currentRoute: pageContext.route,
          currentFileSymbols,
          currentPage: pageContext,
          currentModule: moduleContext,
          currentElement: elementContext,
          sharedSession,
          openTabs: [pageContext.filePath],
          relatedPaths: [pageContext.filePath],
        }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const json = (await res.json()) as IterateResp
      setResult(json)
      if (!res.ok || json.status === "error") {
        setStatus(json.error || "Iteration failed")
        return
      }
      setStatus(mode === "explain" ? "Context explanation ready" : "Iteration done")
      if (mode !== "explain") {
        setValue("")
      }
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "Apply 超时（180秒），请重试" : e?.message || "Iteration failed"
      setStatus(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <aside className="hidden xl:flex flex-col w-80 shrink-0 border-l border-border bg-card/80 h-full min-h-0">
      <div className="p-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" />
          {t("aiCodePanelTitle")}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("aiCodePanelDesc")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline">{contextPage.label}</Badge>
          <Badge variant="outline">{contextSession.workspaceSurface || workspaceSurface}</Badge>
          <Badge variant="outline">{contextSession.activeSection || activeSection}</Badge>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <div className="rounded-lg border border-border bg-secondary/20 p-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {locale === "zh" ? "当前作用对象" : "Current target"}
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">{contextPage.route}</div>
          <div className="mt-1 text-xs text-muted-foreground">{contextPage.filePath}</div>
          <div className="mt-3 grid gap-2">
            <div className="rounded-md border border-border bg-background/80 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">{locale === "zh" ? "模块" : "Module"}</div>
              <div className="mt-1 text-xs font-medium text-foreground">{contextModule.name}</div>
            </div>
            <div className="rounded-md border border-border bg-background/80 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">{locale === "zh" ? "元素" : "Element"}</div>
              <div className="mt-1 text-xs font-medium text-foreground">{contextElement.name}</div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/80 p-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {locale === "zh" ? "模块锚点" : "Module anchors"}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableSymbols.map((symbol) => (
              <button
                key={symbol}
                type="button"
                onClick={() => setSelectedSymbol(symbol)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  selectedSymbol === symbol
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-secondary/20 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                }`}
              >
                {symbol}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/80 p-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {locale === "zh" ? "元素锚点" : "Element anchors"}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {pageContext.elements.map((element) => (
              <button
                key={element}
                type="button"
                onClick={() => setSelectedElement(element)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  selectedElement === element
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-secondary/20 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                }`}
              >
                {element}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="p-4 pt-3 pb-8 shrink-0 border-t border-border">
        <div className="mb-3 grid grid-cols-2 gap-2">
          {([
            { key: "explain", label: "Explain" },
            { key: "fix", label: "Fix" },
            { key: "generate", label: "Generate" },
            { key: "refactor", label: "Refactor" },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setMode(item.key)}
              className={`rounded-lg border px-3 py-2 text-xs ${
                mode === item.key
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Input
          placeholder={mode === "explain" ? "Explain the current app area..." : t("aiPlaceholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-[5.5rem] min-h-[5.5rem] mb-3 bg-secondary border-border text-sm placeholder:text-muted-foreground"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 h-10 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
            disabled={loading}
            onClick={handleIterate}
          >
            <MessageSquare className="h-4 w-4 mr-1.5" />
            {loading ? "Applying..." : t("discussWithAI")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 text-foreground border-border bg-transparent"
          >
            {t("viewSuggestions")}
          </Button>
        </div>
        {status ? <p className="mt-2 text-xs text-muted-foreground">{status}</p> : null}
        {result?.summary ? <p className="mt-2 text-xs text-muted-foreground">{result.summary}</p> : null}
        {result?.warning ? <p className="mt-2 text-xs text-amber-600">{result.warning}</p> : null}
        {result?.changedFiles?.length ? (
          <div className="mt-2 rounded-md bg-secondary p-2 border border-border">
            <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {locale === "zh" ? "已变更文件" : "Changed files"}
            </div>
            <div className="space-y-1">
              {result.changedFiles.map((filePath) => (
                <button
                  key={filePath}
                  type="button"
                  onClick={() => openTargetInEditor(filePath)}
                  className="flex w-full items-center justify-between rounded-md bg-background/80 px-2 py-1.5 text-left text-xs text-foreground hover:bg-background"
                >
                  <span className="truncate">{filePath}</span>
                  <ArrowRight className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {result?.thinking ? (
          <pre className="mt-2 max-h-32 overflow-auto text-xs whitespace-pre-wrap rounded-md bg-secondary p-2 border border-border">
{result.thinking}
          </pre>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-8 w-full justify-between text-xs text-muted-foreground"
          onClick={() => openTargetInEditor(targetFilePath)}
        >
          <span>{locale === "zh" ? "打开编辑器工作区" : "Open editor workspace"}</span>
          <FileCode2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </aside>
  )
}
