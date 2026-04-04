"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import {
  BarChart3,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code2,
  Database,
  ExternalLink,
  FileText,
  Globe,
  LayoutGrid,
  Megaphone,
  MoreHorizontal,
  PanelLeft,
  Play,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Square,
  SquareTerminal,
  Undo2,
  Users,
  Wand2,
  Zap,
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
import { findPlanTierByLabel, getPlanPriceLabel, isPaidPlanTier, normalizePlanTier, PLAN_CATALOG, type PlanTier } from "@/lib/plan-catalog"
import { buildCanonicalPreviewUrl, buildRuntimePreviewUrl, buildSandboxPreviewUrl, getResolvedPreviewUrl } from "@/lib/preview-url"
import {
  PREVIEW_SNAPSHOT_STORAGE_KEY,
  buildPreviewSnapshotAliases,
  type PreviewSnapshot,
} from "@/lib/preview-snapshot"
import {
  persistWorkspaceSnapshot as persistWorkspaceBootstrapSnapshot,
  readWorkspaceSnapshot,
  type WorkspaceBootstrapSnapshot,
  type WorkspaceCodeEntrySnapshot,
} from "@/lib/workspace-snapshot"
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
    planTier?: PlanTier
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
  edits?: Array<{
    path: string
    operation: "created" | "updated" | "patched" | "deleted"
    reason?: string
    existedBefore: boolean
    linesBefore: number
    linesAfter: number
    lineDelta: number
    bytesBefore: number
    bytesAfter: number
  }>
  workflowMode?: "act" | "discuss" | "edit_context"
  plan?: {
    archetype: "code_platform" | "crm" | "api_platform" | "community" | "website_landing_download" | "admin_ops_internal_tool"
    summary: string
    routeMap: string[]
    modulePlan: string[]
    taskPlan: string[]
    guardrails: string[]
    constraints: string[]
  }
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
  workflowMode?: "act" | "discuss" | "edit_context"
  planner?: {
    workflowMode: "act" | "discuss" | "edit_context"
    productName: string
    productType: string
    archetype: "code_platform" | "crm" | "api_platform" | "community" | "website_landing_download" | "admin_ops_internal_tool"
    summary: string
    pages: string[]
    routeMap?: string[]
    modules: string[]
    aiTools: string[]
    taskPlan?: string[]
    guardrails?: string[]
    constraints?: string[]
    deploymentTarget: string
    databaseTarget: string
  }
  acceptance?: {
    workflowMode: "act" | "discuss" | "edit_context"
    archetype: "code_platform" | "crm" | "api_platform" | "community" | "website_landing_download" | "admin_ops_internal_tool"
    quality: "app_grade" | "demo_grade"
    buildStatus: "ok" | "failed" | "skipped"
    previewReadiness: "ready" | "planning_only" | "limited" | "blocked"
    routeCount: number
    moduleCount: number
    contextAnchored: boolean
    contextSummary?: string
    fallbackReason?: string
    criticalMissingPieces: string[]
  }
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

type AiTimelineEntry = {
  id: string
  headline: string
  action: string
  detail?: string
  fileChips: string[]
  time: string
  tone: "live" | "neutral" | "warning" | "success"
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
type AiWorkflowMode = "act" | "discuss" | "edit_context"

type WorkspaceGateAction = {
  id: string
  title: string
  summary: string
  note: string
  state: string
  available: boolean
  actionLabel: string
  href: string
  external?: boolean
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

function extractSymbolsFromCode(content: string) {
  const lines = content.split(/\r?\n/)
  const symbols: Array<{ kind: string; name: string; line: number }> = []

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    const patterns: Array<{ kind: string; re: RegExp }> = [
      { kind: "function", re: /^(?:export\s+)?function\s+([A-Za-z0-9_]+)/ },
      { kind: "component", re: /^(?:export\s+default\s+)?function\s+([A-Z][A-Za-z0-9_]+)/ },
      { kind: "const", re: /^(?:export\s+)?const\s+([A-Za-z0-9_]+)/ },
      { kind: "type", re: /^(?:export\s+)?type\s+([A-Za-z0-9_]+)/ },
      { kind: "interface", re: /^(?:export\s+)?interface\s+([A-Za-z0-9_]+)/ },
      { kind: "class", re: /^(?:export\s+)?class\s+([A-Za-z0-9_]+)/ },
    ]
    for (const pattern of patterns) {
      const match = trimmed.match(pattern.re)
      if (match?.[1]) {
        symbols.push({ kind: pattern.kind, name: match[1], line: index + 1 })
        break
      }
    }
  })

  return symbols.slice(0, 40)
}

function pickPreferredWorkspaceFile(changedFiles: string[] | undefined, fallback?: string) {
  const normalized = Array.from(
    new Set(
      (changedFiles ?? [])
        .map((item) => String(item || "").replace(/\\/g, "/").replace(/^\/+/, "").trim())
        .filter(Boolean)
    )
  )
  if (!normalized.length) return fallback || ""

  const ranked = normalized
    .map((filePath, index) => {
      let score = 0
      if (filePath === fallback) score += 100
      if (/^app\/.+\.(tsx|ts|jsx|js)$/.test(filePath)) score += 30
      else if (/^(components|lib)\/.+\.(tsx|ts|jsx|js)$/.test(filePath)) score += 24
      else if (/^app\/api\/.+\.(ts|js)$/.test(filePath)) score += 18
      else if (/^data\/.+\.json$/.test(filePath)) score += 8

      if (filePath === ".env") score -= 40
      if (filePath === "spec.json" || filePath === "region.config.json") score -= 24
      if (/\.json$/.test(filePath)) score -= 8

      return { filePath, score, index }
    })
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))

  return ranked[0]?.filePath || fallback || normalized[0] || ""
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

function resolveSectionFromFilePath(filePath?: string | null) {
  const route = inferRouteFromFilePath(normalizeWorkspaceQueryPath(filePath))
  if (!route) return ""
  if (route === "/") return "dashboard"
  return route.replace(/^\/+/, "").split("/")[0] || ""
}

function formatWorkspaceSessionLabel(value?: string | null, isCn?: boolean) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return isCn ? "未同步" : "Not synced"
  return normalized
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part, index) => {
      if (index === 0 && /^[A-Z]/.test(part)) return part
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(" ")
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

function cleanTimelineLine(line: string) {
  return String(line ?? "")
    .replace(/^\[[^\]]+\]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function detectTimelineAction(line: string) {
  const normalized = cleanTimelineLine(line)
  const lower = normalized.toLowerCase()
  if (!normalized) return { action: "Read", tone: "neutral" as const }
  if (lower.includes("warn") || lower.includes("failed") || lower.includes("error") || /失败|异常|报错/.test(normalized)) {
    return { action: "Warning", tone: "warning" as const }
  }
  if (lower.includes("plan") || lower.includes("planner") || /规划|计划|spec|archetype/.test(normalized)) {
    return { action: "Planning", tone: "live" as const }
  }
  if (lower.includes("build") || /验收|验证|校验/.test(normalized)) {
    return { action: "Validate", tone: "success" as const }
  }
  if (lower.includes("refactor") || /重构/.test(normalized)) {
    return { action: "Refactor", tone: "success" as const }
  }
  if (lower.includes("fix") || /修复/.test(normalized)) {
    return { action: "Fix", tone: "success" as const }
  }
  if (lower.includes("generate") || lower.includes("scaffold") || /生成|骨架|写入/.test(normalized)) {
    return { action: "Generate", tone: "success" as const }
  }
  if (lower.includes("read") || lower.includes("inspect") || lower.includes("context") || /读取|检查|上下文/.test(normalized)) {
    return { action: "Read", tone: "neutral" as const }
  }
  if (lower.includes("edit") || lower.includes("apply") || lower.includes("change") || /修改|改写|应用/.test(normalized)) {
    return { action: "Edited", tone: "success" as const }
  }
  return { action: "Read", tone: "neutral" as const }
}

function extractTimelineFiles(line: string, changedFiles: string[], fallbackFile: string, index = 0) {
  const explicitMatches = Array.from(
    new Set(
      (line.match(/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+\.(?:tsx|ts|jsx|js|json|md|css)/g) ?? []).map((item) =>
        item.replace(/^\/+/, "")
      )
    )
  )
  if (explicitMatches.length) return explicitMatches.slice(0, 4)

  const normalized = cleanTimelineLine(line).toLowerCase()
  if (
    normalized.includes("plan") ||
    normalized.includes("planner") ||
    normalized.includes("build") ||
    normalized.includes("validate") ||
    /规划|计划|验收|验证|等待|启动|ready|runtime/.test(normalized)
  ) {
    return fallbackFile ? [fallbackFile] : []
  }

  if (!changedFiles.length) {
    return fallbackFile ? [fallbackFile] : []
  }

  const start = Math.min(index * 2, Math.max(changedFiles.length - 3, 0))
  return changedFiles.slice(start, start + 3)
}

function StructuredPreviewFallback({
  projectName,
  projectSubtitle,
  fallbackReason,
  buildStatus,
  isCn,
  iconGlyph,
  iconFrom,
  iconTo,
}: {
  projectName: string
  projectSubtitle: string
  fallbackReason: string
  buildStatus: "ok" | "failed" | "skipped" | null
  isCn: boolean
  iconGlyph?: string
  iconFrom?: string
  iconTo?: string
}) {
  return (
    <div className="flex h-full items-center justify-center rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef3f8_100%)] p-6">
      <div className="w-full max-w-[720px] rounded-[30px] border border-slate-200 bg-white px-8 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="relative mx-auto h-24 w-24">
          <div className="absolute inset-0 rounded-[32px] bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.26),transparent_68%)] blur-xl" />
          <div className="absolute inset-[2px] animate-spin rounded-[32px] border border-dashed border-violet-300/80" style={{ animationDuration: "7s" }} />
          <div className="absolute inset-[10px] rounded-[26px] border border-violet-200/80 bg-white/60" />
          <div
            className="absolute inset-[14px] flex animate-pulse items-center justify-center rounded-[22px] text-2xl font-semibold text-white shadow-[0_18px_42px_rgba(124,58,237,0.28)]"
            style={{ background: `linear-gradient(135deg, ${iconFrom || "#7c3aed"}, ${iconTo || "#a855f7"})` }}
          >
            {iconGlyph || projectName.charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="mt-6 text-2xl font-semibold tracking-tight text-slate-950">{projectName}</div>
        <div className="mt-2 text-sm text-slate-500">{projectSubtitle}</div>
        <div className="mt-4 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-slate-500">
          {buildStatus === "ok"
            ? (isCn ? "预览准备中" : "Preparing preview")
            : isCn
              ? "AI 正在生成"
              : "AI is generating"}
        </div>
        <div className="mt-8 space-y-3">
          <div className="h-3 rounded-full bg-slate-100">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#7c3aed,#c084fc)]" />
          </div>
          <div className="mx-auto h-3 w-5/6 rounded-full bg-slate-100" />
          <div className="mx-auto h-3 w-3/4 rounded-full bg-slate-100" />
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            isCn ? "解析应用结构" : "Resolving app structure",
            isCn ? "准备真实预览" : "Preparing real preview",
            isCn ? "等待页面就绪" : "Waiting for the page to be ready",
          ].map((item, index) => (
            <div key={item} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="mx-auto mb-3 h-2.5 w-2.5 rounded-full bg-[linear-gradient(135deg,#7c3aed,#a855f7)] animate-pulse" style={{ animationDelay: `${index * 140}ms` }} />
              <div className="text-sm font-medium text-slate-900">{item}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 text-sm leading-6 text-slate-500">
          {fallbackReason || (isCn ? "当前只展示品牌化 loading，等真实 preview ready 后再切入页面。" : "Only the branded loading state is shown until the real preview is ready.")}
        </div>
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
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<WorkspaceBootstrapSnapshot | null>(() => readWorkspaceSnapshot(projectId))
  const [workspaceRecoveredFromCache, setWorkspaceRecoveredFromCache] = useState(false)
  const [workspaceCodeCache, setWorkspaceCodeCache] = useState<Record<string, WorkspaceCodeEntrySnapshot>>(
    () => readWorkspaceSnapshot(projectId)?.codeContents ?? {}
  )
  const hydrationAttemptRef = useRef(0)
  const hydrationPromiseRef = useRef<Promise<boolean> | null>(null)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [projectMissing, setProjectMissing] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [iterating, setIterating] = useState(false)
  const [iterateResult, setIterateResult] = useState<IterateResp | null>(null)
  const [sharedSessionSnapshot, setSharedSessionSnapshot] = useState<WorkspaceSessionContext | null>(null)
  const [iterateStatus, setIterateStatus] = useState("")
  const [runBusy, setRunBusy] = useState(false)
  const [runStatus, setRunStatus] = useState("")
  const [revertBusy, setRevertBusy] = useState(false)
  const [generateTask, setGenerateTask] = useState<GenerateTaskResp | null>(null)
  const [generatePanelOpen, setGeneratePanelOpen] = useState(true)
  const [previewBooting, setPreviewBooting] = useState(false)
  const [sandboxBusy, setSandboxBusy] = useState(false)
  const [copilotCollapsed, setCopilotCollapsed] = useState(false)
  const [workspaceSection, setWorkspaceSection] = useState(String(initialSection ?? "").trim().toLowerCase())
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
  const [aiWorkflowMode, setAiWorkflowMode] = useState<AiWorkflowMode>("edit_context")
  const [aiMode, setAiMode] = useState<AiMode>("generate")
  const [aiTargetSymbol, setAiTargetSymbol] = useState("")
  const [aiTargetElement, setAiTargetElement] = useState("")
  const [editorRail, setEditorRail] = useState<"explorer" | "search" | "routes" | "runtime">("explorer")
  const [editorBottomTab, setEditorBottomTab] = useState<"terminal" | "problems" | "output">("terminal")
  const [expandedCodeFolders, setExpandedCodeFolders] = useState<string[]>(["app", "components", "lib"])
  const [templateLibraryQuery, setTemplateLibraryQuery] = useState("")

  function persistWorkspaceSnapshotDraft(
    updater: (current: WorkspaceBootstrapSnapshot | null) => WorkspaceBootstrapSnapshot | null
  ) {
    setWorkspaceSnapshot((current) => {
      const next = updater(current)
      if (next) {
        persistWorkspaceBootstrapSnapshot(next)
      }
      return next
    })
  }

  function applyWorkspaceSnapshot(snapshot: WorkspaceBootstrapSnapshot, options?: { recovered?: boolean }) {
    setWorkspaceSnapshot(snapshot)
    setWorkspaceCodeCache(snapshot.codeContents ?? {})
    setProject(snapshot.project as ProjectDetail)
    setGenerateTask((current) => current ?? (snapshot.generateTask as GenerateTaskResp | null) ?? null)
    const prioritized = prioritizeCodeFiles(snapshot.codeFiles ?? Object.keys(snapshot.codeContents ?? {}))
    setCodeFiles(prioritized)
    setSelectedCodeFile((current) => (current && prioritized.includes(current) ? current : prioritized[0] || ""))
    setCodeTabs((current) => {
      const filtered = current.filter((item) => prioritized.includes(item))
      return filtered.length ? filtered : prioritized.slice(0, 4)
    })
    setExpandedCodeFolders((current) =>
      Array.from(new Set([...current, ...prioritized.slice(0, 18).flatMap((item) => buildParentPaths(item).slice(0, 2))]))
    )
    setProjectMissing(false)
    setLoading(false)
    setWorkspaceRecoveredFromCache(Boolean(options?.recovered))
  }

  async function hydrateWorkspaceFromSnapshot(snapshot: WorkspaceBootstrapSnapshot) {
    const now = Date.now()
    if (hydrationPromiseRef.current) {
      return hydrationPromiseRef.current
    }
    if (now - hydrationAttemptRef.current < 8_000) {
      return false
    }
    hydrationAttemptRef.current = now
    hydrationPromiseRef.current = fetch(`/api/projects/${encodeURIComponent(projectId)}/hydrate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot }),
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        hydrationPromiseRef.current = null
      })

    return hydrationPromiseRef.current
  }

  async function ensureWorkspaceHydrated() {
    if (!workspaceRecoveredFromCache || !workspaceSnapshot) return false
    return hydrateWorkspaceFromSnapshot(workspaceSnapshot)
  }

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
      const cached = workspaceSnapshot ?? readWorkspaceSnapshot(projectId)
      if (cached) {
        const restored = await hydrateWorkspaceFromSnapshot(cached)
        if (restored) {
          const retried = await fetch(`/api/projects?projectId=${encodeURIComponent(projectId)}`)
          if (retried.ok) {
            const json = await retried.json()
            const nextProject = json.project as ProjectDetail
            setProject(nextProject)
            setProjectMissing(false)
            setWorkspaceRecoveredFromCache(false)
            setLoading(false)
            persistWorkspaceSnapshotDraft((current) => ({
              projectId: nextProject.projectId,
              projectSlug: nextProject.projectSlug || current?.projectSlug || nextProject.projectId,
              region: nextProject.region,
              createdAt: nextProject.createdAt,
              updatedAt: nextProject.updatedAt,
              project: nextProject as WorkspaceBootstrapSnapshot["project"],
              generateTask: current?.generateTask ?? null,
              codeFiles: current?.codeFiles ?? [],
              codeContents: current?.codeContents ?? {},
              source: "workspace",
            }))
            return
          }
        }
        applyWorkspaceSnapshot(cached, { recovered: true })
        return
      }
      setProjectMissing(true)
      setWorkspaceRecoveredFromCache(false)
      setLoading(false)
      return
    }
    const json = await res.json()
    const nextProject = json.project as ProjectDetail
    setProject(nextProject)
    setProjectMissing(false)
    setWorkspaceRecoveredFromCache(false)
    setLoading(false)
    persistWorkspaceSnapshotDraft((current) => ({
      projectId: nextProject.projectId,
      projectSlug: nextProject.projectSlug || current?.projectSlug || nextProject.projectId,
      region: nextProject.region,
      createdAt: nextProject.createdAt,
      updatedAt: nextProject.updatedAt,
      project: nextProject as WorkspaceBootstrapSnapshot["project"],
      generateTask: current?.generateTask ?? null,
      codeFiles: current?.codeFiles ?? [],
      codeContents: current?.codeContents ?? {},
      source: "workspace",
    }))
  }

  async function loadGenerateTask() {
    if (!jobId) return
    const res = await fetch(
      `/api/generate?jobId=${encodeURIComponent(jobId)}${workspaceSnapshot ? "" : "&snapshot=1"}`
    )
    if (!res.ok) return
    const json = (await res.json()) as GenerateTaskResp & { workspaceSnapshot?: WorkspaceBootstrapSnapshot | null }
    setGenerateTask(json)
    if (json.workspaceSnapshot) {
      applyWorkspaceSnapshot(json.workspaceSnapshot, { recovered: false })
    } else {
      persistWorkspaceSnapshotDraft((current) => {
        if (!current?.project) return current
        return {
          ...current,
          updatedAt: current.project.updatedAt || new Date().toISOString(),
          generateTask: json as WorkspaceBootstrapSnapshot["generateTask"],
        }
      })
    }
    if (json.status === "done" || json.status === "error") {
      setGeneratePanelOpen(false)
    } else {
      setGeneratePanelOpen(true)
    }
  }

  async function loadCodeFiles() {
    await ensureWorkspaceHydrated()
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`)
    if (!res.ok) {
      const cached = workspaceSnapshot ?? readWorkspaceSnapshot(projectId)
      if (!cached) return
      const prioritized = prioritizeCodeFiles(cached.codeFiles ?? Object.keys(cached.codeContents ?? {}))
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
            ...prioritized.slice(0, 18).flatMap((item) => buildParentPaths(item).slice(0, 2)),
          ])
        )
      )
      return
    }
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
    persistWorkspaceSnapshotDraft((current) => {
      const baseProject = current?.project ?? (project as WorkspaceBootstrapSnapshot["project"] | null)
      if (!baseProject) return current
      return {
        projectId: current?.projectId || baseProject.projectId,
        projectSlug: current?.projectSlug || baseProject.projectSlug || baseProject.projectId,
        region: baseProject.region,
        createdAt: current?.createdAt || baseProject.createdAt,
        updatedAt: baseProject.updatedAt || new Date().toISOString(),
        project: baseProject,
        generateTask: current?.generateTask ?? (generateTask as WorkspaceBootstrapSnapshot["generateTask"]),
        codeFiles: prioritized,
        codeContents: current?.codeContents ?? {},
        source: "workspace",
      }
    })
  }

  async function loadCodeFile(filePath: string) {
    if (!filePath) return
    await ensureWorkspaceHydrated()
    setCodeLoading(true)
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files?path=${encodeURIComponent(filePath)}`)
      if (!res.ok) {
        const cachedEntry = workspaceCodeCache[filePath] ?? (workspaceSnapshot?.codeContents ?? {})[filePath]
        if (cachedEntry) {
          setSelectedCodeContent(cachedEntry.content)
          setDraftCodeContent(cachedEntry.content)
          setSelectedCodeSymbols(cachedEntry.symbols ?? [])
          setFocusedLine((current) => current ?? cachedEntry.symbols?.[0]?.line ?? null)
          return
        }
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
      setWorkspaceCodeCache((current) => ({
        ...current,
        [filePath]: {
          content: json.content,
          symbols: json.symbols ?? [],
        },
      }))
      persistWorkspaceSnapshotDraft((current) => {
        const baseProject = current?.project ?? (project as WorkspaceBootstrapSnapshot["project"] | null)
        if (!baseProject) return current
        return {
          projectId: current?.projectId || baseProject.projectId,
          projectSlug: current?.projectSlug || baseProject.projectSlug || baseProject.projectId,
          region: baseProject.region,
          createdAt: current?.createdAt || baseProject.createdAt,
          updatedAt: baseProject.updatedAt || new Date().toISOString(),
          project: baseProject,
          generateTask: current?.generateTask ?? (generateTask as WorkspaceBootstrapSnapshot["generateTask"]),
          codeFiles: current?.codeFiles ?? codeFiles,
          codeContents: {
            ...(current?.codeContents ?? {}),
            [filePath]: {
              content: json.content,
              symbols: json.symbols ?? [],
            },
          },
          source: "workspace",
        }
      })
    } finally {
      setCodeLoading(false)
    }
  }

  function focusWorkspaceCodeFile(filePath: string, line?: number | null, options?: { forceCode?: boolean }) {
    const normalized = normalizeWorkspaceQueryPath(filePath)
    if (!normalized) return
    const nextSection = resolveSectionFromFilePath(normalized)
    if (nextSection) {
      setWorkspaceSection(nextSection)
    }
    setSelectedCodeFile(normalized)
    setExpandedCodeFolders((current) => Array.from(new Set([...current, ...buildParentPaths(normalized)])))
    setCodeTabs((current) => Array.from(new Set([normalized, ...current])).slice(0, 6))
    if (options?.forceCode) {
      setPreviewTab("code")
      setEditorRail("explorer")
    }
    if (typeof line === "number" && line > 0) {
      setFocusedLine(line)
    } else {
      setFocusedLine(null)
    }
  }

  async function saveCodeFile() {
    if (!selectedCodeFile) return
    await ensureWorkspaceHydrated()
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
      setWorkspaceCodeCache((current) => ({
        ...current,
        [selectedCodeFile]: {
          content: draftCodeContent,
          symbols: extractSymbolsFromCode(draftCodeContent),
        },
      }))
      persistWorkspaceSnapshotDraft((current) => {
        const baseProject = current?.project ?? (project as WorkspaceBootstrapSnapshot["project"] | null)
        if (!baseProject) return current
        return {
          projectId: current?.projectId || baseProject.projectId,
          projectSlug: current?.projectSlug || baseProject.projectSlug || baseProject.projectId,
          region: baseProject.region,
          createdAt: current?.createdAt || baseProject.createdAt,
          updatedAt: new Date().toISOString(),
          project: {
            ...baseProject,
            updatedAt: new Date().toISOString(),
          },
          generateTask: current?.generateTask ?? (generateTask as WorkspaceBootstrapSnapshot["generateTask"]),
          codeFiles: current?.codeFiles ?? codeFiles,
          codeContents: {
            ...(current?.codeContents ?? {}),
            [selectedCodeFile]: {
              content: draftCodeContent,
              symbols: extractSymbolsFromCode(draftCodeContent),
            },
          },
          source: "workspace",
        }
      })
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
    await ensureWorkspaceHydrated()
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
    await ensureWorkspaceHydrated()
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
    await ensureWorkspaceHydrated()
    setIterating(true)
    setIterateStatus(
      aiWorkflowMode === "discuss"
        ? (isCn ? "正在整理讨论规划..." : "Preparing the discussion plan...")
        : aiWorkflowMode === "act"
          ? (isCn ? "正在直接执行改动..." : "Applying the change directly...")
          : aiMode === "explain"
            ? (isCn ? "正在检查当前上下文..." : "Inspecting current context...")
            : (isCn ? "正在应用定点改动..." : "Applying the scoped change...")
    )
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
          workflowMode: aiWorkflowMode,
          currentFilePath: selectedCodeFile || undefined,
          currentFileContent: selectedCodeFile ? draftCodeContent : undefined,
          currentFileSymbols: selectedCodeSymbols,
          focusedLine,
          currentRoute: aiPageContext.route || currentCodeRoute || undefined,
          currentPage: aiPageContext,
          currentModule: aiModuleContext,
          currentElement: aiElementContext,
          sharedSession: requestSharedSession,
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
      if (json.context?.sharedSession) {
        setSharedSessionSnapshot(json.context.sharedSession)
      }
      if (!res.ok || json.status === "error") {
        setIterateStatus(json.error || "Iteration failed")
      } else {
        setIterateStatus(
          aiWorkflowMode === "discuss"
            ? (isCn ? "讨论规划已准备好" : "Discussion plan is ready")
            : aiWorkflowMode === "act"
              ? (isCn ? "直接执行已完成" : "Act mode finished")
              : aiMode === "explain"
                ? (isCn ? "上下文解释已准备好" : "Context explanation ready")
                : (isCn ? "定点改写已完成" : "Scoped iteration completed")
        )
        if (aiMode !== "explain" && aiWorkflowMode !== "discuss") {
          if (json.changedFiles?.length) {
            setCodeFiles((current) =>
              prioritizeCodeFiles(Array.from(new Set([...json.changedFiles!, ...current])))
            )
            setExpandedCodeFolders((current) =>
              Array.from(new Set([...current, ...json.changedFiles!.flatMap((item) => buildParentPaths(item))]))
            )
          }
          const firstChangedFile = json.context?.currentFilePath || pickPreferredWorkspaceFile(json.changedFiles, selectedCodeFile || aiPageContext.filePath)
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
    await ensureWorkspaceHydrated()
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
    const cached = readWorkspaceSnapshot(projectId)
    setWorkspaceSnapshot(cached)
    setWorkspaceCodeCache(cached?.codeContents ?? {})
    if (cached) {
      applyWorkspaceSnapshot(cached, { recovered: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    if (!initialSection) return
    setWorkspaceSection(String(initialSection).trim().toLowerCase())
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
    const workspaceReady = Boolean(
      project?.presentation?.displayName ||
      project?.spec?.title ||
      project?.presentation?.routes?.length ||
      codeFiles.length
    )
    const previewLive =
      (previewProbe?.renderStrategy === "iframe" && previewProbe?.responseStatus === 200) ||
      project?.preview?.status === "ready"

    loadGenerateTask()
    if (workspaceReady || previewLive) {
      setGeneratePanelOpen(false)
      return
    }
    const timer = setInterval(async () => {
      const res = await fetch(`/api/generate?jobId=${encodeURIComponent(jobId)}`)
      if (!res.ok) return
      const json = (await res.json()) as GenerateTaskResp
      setGenerateTask(json)
      if (json.status === "done" || json.status === "error" || workspaceReady || previewLive) {
        setGeneratePanelOpen(false)
        clearInterval(timer)
      }
    }, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFiles.length, jobId, previewProbe?.renderStrategy, previewProbe?.responseStatus, project?.presentation?.displayName, project?.presentation?.routes?.length, project?.preview?.status, project?.spec?.title])

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
    workflowMode: isCn ? "工作模式" : "Workflow Mode",
    modelOutput: isCn ? "AI 输出" : "AI Output",
    buildPassed: isCn ? "已通过" : "passed",
    buildFailed: isCn ? "失败" : "failed",
    buildPending: isCn ? "未完成" : "pending",
    actMode: isCn ? "直接执行" : "Act",
    discussMode: isCn ? "讨论规划" : "Discuss",
    editContextMode: isCn ? "定点改写" : "Edit Context",
    actHint: isCn ? "直接把需求改进当前应用，优先交付可运行结果。" : "Apply the change directly and prioritize a runnable result.",
    discussHint: isCn ? "只出 plan/spec，不改代码，先把路线和约束讲清楚。" : "Return a plan/spec only without editing code.",
    editContextHint: isCn ? "围绕当前文件、页面、模块和元素定点改写。" : "Anchor the change to the current file, page, module, and element.",
    explainMode: isCn ? "解释" : "Explain",
    fixMode: isCn ? "修复" : "Fix",
    generateMode: isCn ? "生成" : "Generate",
    refactorMode: isCn ? "重构" : "Refactor",
    openPreview: isCn ? "打开预览" : "Open Preview",
    refresh: isCn ? "刷新" : "Refresh",
    initialRequest: isCn ? "初始需求" : "Initial prompt",
    noConversation: isCn ? "这里会继续记录你和 AI 的修改过程。" : "This rail will capture your ongoing edits with AI.",
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
  const rawPreviewReady =
    Boolean(resolvedPreviewUrl) &&
    (
      (previewProbe?.renderStrategy === "iframe" && previewProbe?.responseStatus === 200) ||
      (!previewProbe?.renderStrategy && project?.preview?.status === "ready")
    )
  const previewStarting = runtime?.status === "starting" || previewBooting
  const previewGenerating = generateTask?.status === "running" || generateTask?.status === "queued" || iterating
  const previewBuilding =
    previewStarting ||
    project?.preview?.status === "building" ||
    previewProbe?.previewStatus === "building"
  const previewShouldStayLoading = previewGenerating || previewBuilding || !rawPreviewReady
  const previewReady = rawPreviewReady && !previewGenerating && !previewBuilding
  const previewLoadingReason = previewGenerating
    ? cleanTimelineLine(generateTask?.logs?.slice(-1)[0] || "") ||
      iterateStatus ||
      (isCn ? "Codex 正在生成应用并整理真实预览入口。" : "Codex is generating the app and preparing the real preview.")
    : previewBuilding
      ? (isCn ? "真实预览正在启动，完成后会自动切到页面。" : "The real preview is starting and will switch in automatically.")
      : fallbackReason
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
  const activeSectionKey = workspaceSection
  const focusedSectionLabel = activeSectionKey ? activeSectionKey.replace(/[-_]+/g, " ") : ""
  useEffect(() => {
    const inferredSection = resolveSectionFromFilePath(selectedCodeFile)
    if (!inferredSection || inferredSection === workspaceSection) return
    setWorkspaceSection(inferredSection)
  }, [selectedCodeFile, workspaceSection])
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
      { label: isCn ? "打开编辑器" : "Open Editor", onClick: () => window.location.assign(`/apps/${encodeURIComponent(projectId)}/editor`) },
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
    if (generateTask?.status === "running" || generateTask?.status === "queued") {
      return {
        key: generateTask.status,
        label: generateTask.status === "running" ? (isCn ? "生成中" : "Generating") : (isCn ? "排队中" : "Queued"),
        tone: "outline" as const,
      }
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
  const generationPlanner = generateTask?.planner ?? null
  const generationAcceptance = generateTask?.acceptance ?? null
  const generationWorkflowLabel =
    generateTask?.workflowMode === "discuss"
      ? copy.discussMode
      : generateTask?.workflowMode === "edit_context"
        ? copy.editContextMode
        : copy.actMode
  const generationQualityLabel =
    generationAcceptance?.quality === "app_grade"
      ? isCn
        ? "完整应用"
        : "App grade"
      : generationAcceptance?.quality === "demo_grade"
        ? isCn
          ? "演示骨架"
          : "Demo grade"
        : isCn
          ? "待评估"
          : "Pending"
  const generationPreviewLabel =
    generationAcceptance?.previewReadiness === "ready"
      ? isCn
        ? "可直接预览"
        : "Preview ready"
      : generationAcceptance?.previewReadiness === "planning_only"
        ? isCn
          ? "仅规划"
          : "Planning only"
        : generationAcceptance?.previewReadiness === "limited"
          ? isCn
            ? "部分可预览"
            : "Limited preview"
          : generationAcceptance?.previewReadiness === "blocked"
            ? isCn
              ? "预览受阻"
              : "Preview blocked"
            : isCn
              ? "待评估"
              : "Pending"
  const generationMetrics = [
    {
      label: isCn ? "工作模式" : "Workflow mode",
      value: generationWorkflowLabel,
    },
    {
      label: isCn ? "质量等级" : "Quality",
      value: generationQualityLabel,
    },
    {
      label: isCn ? "预览状态" : "Preview readiness",
      value: generationPreviewLabel,
    },
    {
      label: isCn ? "Build 验收" : "Build acceptance",
      value:
        generationAcceptance?.buildStatus === "ok"
          ? copy.buildPassed
          : generationAcceptance?.buildStatus === "failed"
            ? copy.buildFailed
            : generateTask?.buildStatus === "ok"
              ? copy.buildPassed
              : generateTask?.buildStatus === "failed"
                ? copy.buildFailed
                : copy.buildPending,
    },
  ]
  const generationBriefMissingPieces = generationAcceptance?.criticalMissingPieces ?? []
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
  const sessionSelectedPlanTier = useMemo<PlanTier | null>(() => {
    if (sharedSessionSnapshot?.selectedPlanId) {
      return normalizePlanTier(sharedSessionSnapshot.selectedPlanId)
    }
    return findPlanTierByLabel(sharedSessionSnapshot?.selectedPlanName)
  }, [sharedSessionSnapshot?.selectedPlanId, sharedSessionSnapshot?.selectedPlanName])
  const currentPlanTier = useMemo<PlanTier>(
    () => project?.spec?.planTier || sessionSelectedPlanTier || "free",
    [project?.spec?.planTier, sessionSelectedPlanTier]
  )
  const currentPlanDefinition = PLAN_CATALOG[currentPlanTier]
  const currentPlanLabel = isCn ? currentPlanDefinition.nameCn : currentPlanDefinition.nameEn
  const codeExportAllowed = isPaidPlanTier(currentPlanTier)
  const databaseAccessMode =
    currentPlanTier === "free"
      ? (isCn ? "仅在线使用" : "Online only")
      : currentPlanTier === "elite"
        ? (isCn ? "可配置 + 可交付" : "Managed + handoff")
        : (isCn ? "可配置" : "Managed config")
  const nextUpgradePlan = currentPlanTier === "free" ? "pro" : currentPlanTier === "starter" ? "builder" : currentPlanTier === "builder" ? "pro" : "elite"
  const upgradeHref = `/checkout?plan=${nextUpgradePlan}`
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
        value: `${currentPlanLabel} · ${databaseAccessMode}`,
        note: codeExportAllowed
          ? isCn
            ? "当前套餐已开放导出与更完整的数据交付路径。"
            : "The current plan unlocks export and a fuller data handoff path."
          : isCn
            ? "免费用户代码不可导出，数据库保持在线使用。"
            : "Free users keep code export locked while database usage stays online-first.",
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
      currentPlanLabel,
      codeExportAllowed,
      databaseAccessMode,
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
  const gatedWorkspaceActions = useMemo<WorkspaceGateAction[]>(
    () => [
      {
        id: "code-export",
        title: isCn ? "代码导出包" : "Code export pack",
        summary: codeExportAllowed
          ? isCn
            ? "当前套餐已开放代码清单导出，可以继续做交付打包。"
            : "The current plan unlocks code manifest export for delivery handoff."
          : isCn
            ? "免费版先保留在线编辑，代码导出在升级后开放。"
            : "The free tier keeps editing online while code export unlocks after upgrade.",
        note: codeExportAllowed
          ? isCn
            ? "导出入口先走文件清单与工作区交接，后续可继续补 zip/package。"
            : "The export path currently uses the file manifest and workspace handoff, with room for a later zip/package flow."
          : isCn
            ? "这样不会影响在线工作区，但会明确挡住免费导出。"
            : "This keeps the hosted editor usable while clearly blocking free export.",
        state: codeExportAllowed ? (isCn ? "已开放" : "Unlocked") : (isCn ? "免费锁定" : "Locked on free"),
        available: codeExportAllowed,
        actionLabel: codeExportAllowed ? (isCn ? "导出代码清单" : "Export manifest") : (isCn ? "升级后导出" : "Upgrade to export"),
        href: codeExportAllowed ? `/api/projects/${encodeURIComponent(projectId)}/files` : upgradeHref,
        external: codeExportAllowed,
      },
      {
        id: "database-mode",
        title: isCn ? "数据库交付模式" : "Database handoff mode",
        summary:
          currentPlanTier === "free"
            ? isCn
              ? "免费层保持在线使用，不直接承诺离线迁移和外部交付。"
              : "The free layer stays online-only instead of promising offline migration and external handoff."
            : isCn
              ? "付费层已经开放更完整的数据配置与迁移准备路径。"
              : "Paid tiers open a fuller data configuration and migration-ready path.",
        note:
          currentPlanTier === "elite"
            ? isCn
              ? "Elite 更适合交付前的数据接线、文档整理和客户 handoff。"
              : "Elite is the best fit for pre-handoff data wiring, docs, and client delivery."
            : currentPlanTier === "free"
              ? isCn
                ? "先把数据库维持在托管工作区里，避免今晚引入不稳定离线流。"
                : "Keep the database inside the hosted workspace first to avoid unstable offline flows tonight."
              : isCn
                ? "从 Data / Settings 路径继续补连接变量、迁移说明和资源策略。"
                : "Continue from the Data / Settings lanes for env wiring, migration notes, and resource policy.",
        state: databaseAccessMode,
        available: currentPlanTier !== "free",
        actionLabel: currentPlanTier !== "free" ? (isCn ? "打开 Data 轨道" : "Open data lane") : (isCn ? "升级后扩展数据交付" : "Upgrade for data handoff"),
        href: currentPlanTier !== "free" ? `${workspaceRootHref}/data` : upgradeHref,
      },
      {
        id: "team-delivery",
        title: isCn ? "团队与交付协作" : "Team delivery access",
        summary:
          currentPlanTier === "free"
            ? isCn
              ? "免费层先保留只读分享和老板演示，不把深协作默认打开。"
              : "The free layer keeps read-only sharing and boss demos without opening deeper collaboration by default."
            : isCn
              ? "付费层开始承接成员、权限和更完整的交付流程。"
              : "Paid tiers start carrying members, permissions, and a fuller delivery flow.",
        note:
          currentPlanTier === "free"
            ? isCn
              ? "Users 面板继续保留，但升级后才真正承接协作深度。"
              : "The Users lane remains visible, but deeper collaboration only unlocks after upgrade."
            : isCn
              ? "可以从 Users / Settings 路径继续接权限和审批。"
              : "Continue from the Users / Settings lanes to wire permissions and approvals.",
        state: currentPlanTier === "free" ? (isCn ? "只读分享" : "Read-only") : (isCn ? "团队协作" : "Collaborative"),
        available: currentPlanTier !== "free",
        actionLabel: currentPlanTier !== "free" ? (isCn ? "打开 Users 轨道" : "Open users lane") : (isCn ? "升级后开放协作" : "Upgrade for collaboration"),
        href: currentPlanTier !== "free" ? `${workspaceRootHref}/users` : upgradeHref,
      },
      {
        id: "delivery-center",
        title: isCn ? "终验交付中心" : "Delivery center",
        summary: isCn ? "下载中心、分发资产和 4.14 终验路线已经收口到统一入口。" : "The download center, distribution assets, and 4.14 delivery lane now converge in one place.",
        note: isCn ? "这条线始终可见，方便今晚继续补多端路径和后续上传入口。" : "Keep this lane always visible so the multi-platform path and later upload slots can keep moving tonight.",
        state: isCn ? "始终可见" : "Always visible",
        available: true,
        actionLabel: isCn ? "打开交付中心" : "Open delivery center",
        href: "/download",
      },
    ],
    [codeExportAllowed, currentPlanTier, databaseAccessMode, isCn, projectId, upgradeHref, workspaceRootHref]
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
    const fromFile = selectedCodeSymbols.map((item) => item.name).filter((item): item is string => Boolean(item))
    return Array.from(
      new Set((fromFile.length ? fromFile : aiPageContext.symbols).filter((item): item is string => Boolean(item)))
    )
  }, [aiPageContext.symbols, selectedCodeSymbols])
  const availableAiElements = useMemo(
    () => Array.from(new Set(aiPageContext.elements.filter((item): item is string => Boolean(item)))),
    [aiPageContext.elements]
  )
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
  const requestSharedSession = useMemo<WorkspaceSessionContext>(
    () => ({
      ...(sharedSessionSnapshot ?? {}),
      projectName,
      specKind: project?.spec?.kind || "workspace",
      workspaceSurface: previewTab,
      activeSection: activeSectionKey || aiPageContext.id,
      routeId: aiPageContext.id,
      routeLabel: aiPageContext.label,
      filePath: selectedCodeFile || aiPageContext.filePath,
      symbolName: aiModuleContext.name,
      elementName: aiElementContext.name,
      deploymentTarget: normalizedDeploymentTarget,
      databaseTarget: normalizedDatabaseTarget,
      region: workspaceRegion,
      selectedPlanId: currentPlanTier,
      selectedPlanName: currentPlanLabel,
      selectedTemplate: generateTask?.templateTitle || sharedSessionSnapshot?.selectedTemplate || undefined,
      codeExportAllowed,
      databaseAccessMode,
      workspaceStatus: workspaceStatus.label,
      lastIntent: prompt.trim() || sharedSessionSnapshot?.lastIntent || undefined,
      lastChangedFile: sharedSessionSnapshot?.lastChangedFile || selectedCodeFile || aiPageContext.filePath,
      lastChangedAt: sharedSessionSnapshot?.lastChangedAt,
      readiness: sharedSessionSnapshot?.readiness || "context_ready",
    }),
    [
      activeSectionKey,
      aiElementContext.name,
      aiModuleContext.name,
      aiPageContext.filePath,
      aiPageContext.id,
      aiPageContext.label,
      codeExportAllowed,
      codeTabs.length,
      currentPlanLabel,
      currentPlanTier,
      databaseAccessMode,
      generateTask?.templateTitle,
      sharedSessionSnapshot,
      normalizedDatabaseTarget,
      normalizedDeploymentTarget,
      previewTab,
      project?.spec?.kind,
      projectName,
      prompt,
      selectedCodeFile,
      workspaceRegion,
      workspaceStatus.label,
    ]
  )
  const latestResolvedContext = iterateResult?.context
  const contextPage = latestResolvedContext?.currentPage ?? aiPageContext
  const contextModule = latestResolvedContext?.currentModule ?? aiModuleContext
  const contextElement = latestResolvedContext?.currentElement ?? aiElementContext
  const contextSession = latestResolvedContext?.sharedSession ?? sharedSessionSnapshot ?? requestSharedSession
  const contextFile = latestResolvedContext?.currentFilePath || selectedCodeFile
  const contextRoute = latestResolvedContext?.currentRoute || currentCodeRoute || aiPageContext.route
  const contextLastChangedFile = normalizeWorkspaceQueryPath(contextSession?.lastChangedFile) || contextFile || ""
  const contextLastAction = contextSession?.lastAction || iterateResult?.summary || ""
  const contextReadiness = formatWorkspaceSessionLabel(contextSession?.readiness || contextSession?.workspaceStatus, isCn)
  const contextSurface = formatWorkspaceSessionLabel(contextSession?.workspaceSurface || previewTab, isCn)
  const contextSymbols = latestResolvedContext?.currentFileSymbols?.length
    ? latestResolvedContext.currentFileSymbols
    : selectedCodeSymbols
  useEffect(() => {
    if (!latestResolvedContext) return
    const resolvedSurface = latestResolvedContext.sharedSession?.workspaceSurface
    const nextFile =
      latestResolvedContext.currentFilePath ||
      normalizeWorkspaceQueryPath(latestResolvedContext.sharedSession?.lastChangedFile)
    const nextSection =
      latestResolvedContext.currentPage?.id ||
      latestResolvedContext.sharedSession?.activeSection ||
      latestResolvedContext.sharedSession?.routeId ||
      resolveSectionFromFilePath(nextFile)
    if (nextSection) {
      setWorkspaceSection(String(nextSection).trim().toLowerCase())
    }
    const shouldOpenCode =
      Boolean(nextFile) &&
      (
        resolvedSurface === "code" ||
        Boolean(iterateResult?.changedFiles?.length) ||
        activeSectionKey === "editor"
      )

    if (nextFile) {
      focusWorkspaceCodeFile(nextFile, latestResolvedContext.focusedLine, { forceCode: shouldOpenCode })
    } else if (resolvedSurface === "dashboard" || resolvedSurface === "preview") {
      setPreviewTab(resolvedSurface)
    }
    if (!nextFile && typeof latestResolvedContext.focusedLine === "number" && latestResolvedContext.focusedLine > 0) {
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
  }, [activeSectionKey, iterateResult?.changedFiles?.length, latestResolvedContext])
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
  const workspaceRailItems = useMemo(
    () => [
      { key: "preview", label: copy.preview, icon: Play, active: previewTab === "preview", action: () => setPreviewTab("preview") },
      { key: "dashboard", label: "Dashboard", icon: LayoutGrid, active: previewTab === "dashboard", action: () => setPreviewTab("dashboard") },
      { key: "code", label: copy.code, icon: Code2, active: previewTab === "code", action: () => setPreviewTab("code") },
      { key: "runs", label: isCn ? "运行" : "Runs", icon: SquareTerminal, active: activeSectionKey === "runs", action: () => window.location.assign(`${workspaceRootHref}/runs`) },
      { key: "settings", label: isCn ? "设置" : "Settings", icon: Settings, active: activeSectionKey === "settings", action: () => window.location.assign(`${workspaceRootHref}/settings`) },
    ],
    [activeSectionKey, copy.code, copy.preview, isCn, previewTab, workspaceRootHref]
  )
  const dashboardNavItems = useMemo(
    () => [
      { key: "overview", group: isCn ? "Workspace" : "Workspace", label: isCn ? "Overview" : "Overview", icon: LayoutGrid, href: workspaceRootHref, active: activeDashboardSection === "dashboard" || activeDashboardSection === "overview" },
      { key: "users", group: isCn ? "Workspace" : "Workspace", label: isCn ? "Users" : "Users", icon: Users, href: `${workspaceRootHref}/users`, active: activeDashboardSection === "users" },
      { key: "data", group: isCn ? "Workspace" : "Workspace", label: isCn ? "Data" : "Data", icon: Database, href: `${workspaceRootHref}/data`, active: activeDashboardSection === "data" },
      { key: "analytics", group: isCn ? "Growth" : "Growth", label: isCn ? "Analytics" : "Analytics", icon: BarChart3, href: `${workspaceRootHref}/analytics`, badge: "Beta", active: activeDashboardSection === "analytics" },
      { key: "social", group: isCn ? "Growth" : "Growth", label: isCn ? "Social / Content" : "Social / Content", icon: Megaphone, href: "/market", badge: isCn ? "新" : "New", active: false },
      { key: "domains", group: isCn ? "Growth" : "Growth", label: isCn ? "Domains" : "Domains", icon: Globe, href: `${workspaceRootHref}/domains`, active: activeDashboardSection === "domains" },
      { key: "integrations", group: isCn ? "Operate" : "Operate", label: isCn ? "Integrations" : "Integrations", icon: Puzzle, href: `${workspaceRootHref}/integrations`, active: activeDashboardSection === "integrations" },
      { key: "security", group: isCn ? "Operate" : "Operate", label: isCn ? "Security" : "Security", icon: Shield, href: `${workspaceRootHref}/security`, active: activeDashboardSection === "security" },
      { key: "agents", group: isCn ? "Operate" : "Operate", label: isCn ? "Agents" : "Agents", icon: Bot, href: `${workspaceRootHref}/agents`, active: activeDashboardSection === "agents" },
      { key: "automations", group: isCn ? "Operate" : "Operate", label: isCn ? "Automations" : "Automations", icon: Zap, href: `${workspaceRootHref}/automations`, active: activeDashboardSection === "automations" },
      { key: "logs", group: isCn ? "Operate" : "Operate", label: isCn ? "Logs" : "Logs", icon: FileText, href: `${workspaceRootHref}/logs`, active: activeDashboardSection === "logs" },
      { key: "api", group: isCn ? "Ship" : "Ship", label: "API", icon: Code2, href: `${workspaceRootHref}/api`, active: activeDashboardSection === "api" },
      { key: "settings", group: isCn ? "Ship" : "Ship", label: isCn ? "Settings" : "Settings", icon: Settings, href: `${workspaceRootHref}/settings`, active: activeDashboardSection === "settings" },
    ],
    [activeDashboardSection, isCn, workspaceRootHref]
  )
  const dashboardNavGroups = useMemo(
    () =>
      Array.from(new Set(dashboardNavItems.map((item) => item.group))).map((group) => ({
        group,
        items: dashboardNavItems.filter((item) => item.group === group),
      })),
    [dashboardNavItems]
  )
  const aiTimelineItems = useMemo(() => {
    const fallbackFile = sharedSessionSnapshot?.lastChangedFile || contextFile || "app/page.tsx"
    const items: AiTimelineEntry[] = []

    if (iterating) {
      items.push({
        id: "iterate-live",
        headline: iterateStatus || (isCn ? "Codex 正在围绕当前上下文应用修改。" : "Codex is applying the scoped change."),
        action: aiWorkflowMode === "discuss" ? "Planning" : aiMode === "fix" ? "Fix" : aiMode === "refactor" ? "Refactor" : aiMode === "explain" ? "Read" : "Edited",
        detail: contextFile || contextRoute || undefined,
        fileChips: [fallbackFile],
        time: isCn ? "实时" : "Live",
        tone: "live",
      })
    }

    if (generateTask?.planner) {
      items.push({
        id: "generate-plan",
        headline: generateTask.planner.productName || projectName || "MornCursor",
        action: "Planning",
        detail: generateTask.planner.summary || generationAcceptance?.contextSummary || undefined,
        fileChips: extractTimelineFiles(generateTask.planner.summary || "", generateTask.changedFiles ?? [], fallbackFile, 0),
        time: previewGenerating ? (isCn ? "实时" : "Live") : (isCn ? "最新" : "Latest"),
        tone: previewGenerating ? "live" : "neutral",
      })
    }

    if (generateTask?.logs?.length) {
      generateTask.logs
        .slice(-6)
        .reverse()
        .forEach((line, index) => {
          const normalized = cleanTimelineLine(line)
          if (!normalized) return
          const detected = detectTimelineAction(normalized)
          items.push({
            id: `generate-log-${index}-${normalized}`,
            headline: normalized,
            action: detected.action,
            detail:
              detected.action === "Generate" && generateTask.acceptance?.previewReadiness
                ? `${generationQualityLabel} · ${generationPreviewLabel}`
                : undefined,
            fileChips: extractTimelineFiles(normalized, generateTask.changedFiles ?? [], fallbackFile, index),
            time: index === 0 && previewGenerating ? (isCn ? "实时" : "Live") : (isCn ? "生成链路" : "Generate"),
            tone: detected.tone,
          })
        })
    }

    if (generateTask?.changedFiles?.length) {
      items.push({
        id: "generate-files",
        headline:
          generateTask.status === "done"
            ? (isCn ? `已生成 ${generateTask.changedFiles.length} 个工作区文件` : `${generateTask.changedFiles.length} workspace files generated`)
            : (isCn ? `正在写入 ${generateTask.changedFiles.length} 个文件` : `Writing ${generateTask.changedFiles.length} files`),
        action: generateTask.status === "done" ? "Generated" : "Edited",
        detail: generateTask.summary || generationAcceptance?.fallbackReason || undefined,
        fileChips: generateTask.changedFiles.slice(0, 5),
        time: generateTask.status === "done" ? (isCn ? "完成" : "Done") : (isCn ? "进行中" : "In progress"),
        tone: generateTask.status === "done" ? "success" : "live",
      })
    }

    if (iterateResult?.summary || iterateResult?.thinking || iterateResult?.changedFiles?.length) {
      const iterateAction =
        aiWorkflowMode === "discuss"
          ? "Planning"
          : aiMode === "fix"
            ? "Fix"
            : aiMode === "refactor"
              ? "Refactor"
              : aiMode === "explain"
                ? "Read"
                : "Edited"
      items.push({
        id: "iterate-result",
        headline: iterateResult.summary || iterateResult.thinking || (isCn ? "最近一次上下文改写已完成。" : "The latest contextual edit is complete."),
        action: iterateAction,
        detail:
          iterateResult.plan?.summary ||
          iterateResult.warning ||
          (iterateResult.build?.status === "failed" ? iterateResult.build.logs?.[0] : iterateResult.thinking) ||
          undefined,
        fileChips: (iterateResult.changedFiles?.length ? iterateResult.changedFiles : [fallbackFile]).slice(0, 5),
        time: isCn ? "刚刚" : "Just now",
        tone: iterateResult.build?.status === "failed" ? "warning" : "success",
      })
    }

    ;(project?.history ?? [])
      .slice()
      .reverse()
      .slice(0, 5)
      .forEach((item, index) => {
        items.push({
          id: item.id,
          headline: index === 0 ? item.prompt : item.summary || item.prompt,
          action: item.type === "generate" ? "Generated" : item.changedFiles?.length ? "Edited" : "Read",
          detail: item.summary || undefined,
          fileChips: (item.changedFiles?.length ? item.changedFiles : [fallbackFile]).slice(0, 3),
          time: new Date(item.createdAt).toLocaleString(),
          tone: item.status === "error" ? "warning" : "neutral",
        })
      })

    const seen = new Set<string>()
    return items
      .filter((item) => {
        const key = `${item.action}:${item.headline}:${item.detail || ""}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 9)
  }, [
    aiMode,
    aiWorkflowMode,
    contextFile,
    contextRoute,
    generateTask,
    generationAcceptance?.contextSummary,
    generationAcceptance?.fallbackReason,
    generationPreviewLabel,
    generationQualityLabel,
    isCn,
    iterating,
    iterateResult,
    iterateStatus,
    previewGenerating,
    project?.history,
    projectName,
    sharedSessionSnapshot?.lastChangedFile,
  ])
  const compactFallbackNote = fallbackReason || runtime?.lastError || runStatus
  useEffect(() => {
    if (!project) return
    const projectRecord = project

    const previewMode = projectRecord.preview?.activeMode ?? "static_ssr"
    const preferredPreviewUrl =
      projectRecord.preview?.resolvedUrl ||
      (previewMode === "sandbox_runtime" && projectRecord.preview?.sandboxStatus === "running"
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
        previewStatus: projectRecord.preview?.status ?? "idle",
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
            previewStatus: response.ok ? "ready" : projectRecord.preview?.status ?? "failed",
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
            previewStatus: projectRecord.preview?.status ?? "failed",
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
    return (
      <div className="min-h-[calc(100vh-6rem)] rounded-[30px] border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_32%),linear-gradient(180deg,#fcfcfd_0%,#f3f5f8_100%)] p-3 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="grid min-h-[calc(100vh-7.5rem)] gap-3 xl:grid-cols-[64px_360px_minmax(0,1fr)] 2xl:grid-cols-[64px_388px_minmax(0,1fr)]">
          <aside className="flex min-h-full flex-col justify-between rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#111827_0%,#0f172a_100%)] p-2.5">
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className={`h-11 w-11 rounded-2xl ${index === 0 ? "bg-white" : "bg-white/10"}`} />
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-11 w-11 rounded-2xl bg-white/10" />
              ))}
            </div>
          </aside>

          <aside className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white/92 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200/80 px-5 pb-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-slate-200" />
                  <div className="space-y-2">
                    <div className="h-4 w-28 rounded-full bg-slate-200" />
                    <div className="h-3 w-20 rounded-full bg-slate-100" />
                    <div className="flex gap-2">
                      <div className="h-6 w-16 rounded-full bg-slate-100" />
                      <div className="h-6 w-20 rounded-full bg-slate-100" />
                    </div>
                  </div>
                </div>
                <div className="h-9 w-9 rounded-2xl bg-slate-100" />
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-auto px-4 py-4">
              <div className="h-28 rounded-[24px] bg-slate-100" />
              <div className="h-36 rounded-[24px] bg-slate-950" />
              <div className="h-28 rounded-[24px] bg-slate-100" />
            </div>
            <div className="border-t border-slate-200/80 px-4 py-4">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="h-8 w-24 rounded-full bg-slate-100" />
                  <div className="h-8 w-24 rounded-full bg-slate-100" />
                  <div className="h-8 w-28 rounded-full bg-slate-100" />
                </div>
                <div className="h-36 rounded-[24px] bg-slate-100" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-11 rounded-2xl bg-slate-950" />
                  <div className="h-11 rounded-2xl bg-slate-100" />
                </div>
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white/94 shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
              <div className="border-b border-slate-200/80 px-5 py-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="hidden min-w-0 items-center gap-3 xl:flex">
                      <div className="h-11 w-11 rounded-2xl bg-slate-200" />
                      <div className="space-y-2">
                        <div className="h-4 w-28 rounded-full bg-slate-200" />
                        <div className="h-3 w-40 rounded-full bg-slate-100" />
                      </div>
                    </div>
                    <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 p-1">
                      {([
                        { key: "preview", label: "Preview" },
                        { key: "dashboard", label: "Dashboard" },
                        { key: "code", label: "Code" },
                      ] as const).map((item) => (
                        <div
                          key={item.key}
                          className={`rounded-[14px] px-5 py-2 text-sm font-medium ${
                            previewTab === item.key ? "bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-slate-400"
                          }`}
                        >
                          {item.label}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-10 w-24 rounded-2xl bg-slate-100" />
                    <div className="h-10 w-24 rounded-2xl bg-slate-100" />
                    <div className="h-10 w-32 rounded-2xl bg-slate-950" />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.8),rgba(255,255,255,0.96))] p-4">
                {previewTab === "preview" ? (
                  <div className="flex min-h-[72vh] flex-col gap-4">
                    <div className="h-9 w-72 rounded-2xl bg-amber-100/70" />
                    <div className="flex flex-1 flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-[#e9edf3]">
                      <div className="flex items-center justify-between border-b border-slate-200 bg-white/85 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" />
                            <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
                            <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
                          </div>
                          <div className="h-7 w-56 rounded-full bg-slate-100" />
                        </div>
                        <div className="flex gap-2">
                          <div className="h-9 w-28 rounded-2xl bg-slate-100" />
                          <div className="h-9 w-24 rounded-2xl bg-slate-100" />
                        </div>
                      </div>
                      <div className="flex-1 p-4">
                        <div className="h-full rounded-[26px] bg-white" />
                      </div>
                    </div>
                  </div>
                ) : previewTab === "dashboard" ? (
                  <div className="grid min-h-[72vh] gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-4">
                      <div className="h-11 rounded-2xl bg-slate-100" />
                      <div className="mt-4 space-y-2">
                        {Array.from({ length: 12 }).map((_, index) => (
                          <div key={index} className={`h-11 rounded-2xl ${index === 1 ? "bg-slate-950" : "bg-slate-100"}`} />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-[30px] border border-slate-200 bg-white p-6">
                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_320px]">
                          <div className="flex gap-4">
                            <div className="h-16 w-16 rounded-[22px] bg-slate-200" />
                            <div className="flex-1 space-y-3">
                              <div className="h-3 w-24 rounded-full bg-slate-100" />
                              <div className="h-9 w-48 rounded-full bg-slate-200" />
                              <div className="h-4 w-full rounded-full bg-slate-100" />
                              <div className="h-4 w-4/5 rounded-full bg-slate-100" />
                              <div className="flex gap-2">
                                <div className="h-7 w-20 rounded-full bg-slate-100" />
                                <div className="h-7 w-20 rounded-full bg-slate-100" />
                                <div className="h-7 w-24 rounded-full bg-slate-100" />
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3 rounded-[26px] border border-slate-200 bg-slate-50/80 p-4">
                            <div className="h-4 w-28 rounded-full bg-slate-200" />
                            <div className="h-11 rounded-2xl bg-slate-950" />
                            <div className="h-11 rounded-2xl bg-white" />
                            <div className="h-11 rounded-2xl bg-white" />
                            <div className="h-24 rounded-2xl bg-white" />
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-4 xl:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div key={index} className="h-52 rounded-[26px] border border-slate-200 bg-white" />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid min-h-[72vh] gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="h-4 w-20 rounded-full bg-slate-200" />
                          <div className="h-3 w-16 rounded-full bg-slate-100" />
                        </div>
                        <div className="h-6 w-12 rounded-full bg-slate-100" />
                      </div>
                      <div className="mt-4 h-11 rounded-2xl bg-slate-100" />
                      <div className="mt-4 flex gap-2">
                        <div className="h-8 w-16 rounded-full bg-slate-950" />
                        <div className="h-8 w-16 rounded-full bg-slate-100" />
                        <div className="h-8 w-16 rounded-full bg-slate-100" />
                        <div className="h-8 w-16 rounded-full bg-slate-100" />
                      </div>
                      <div className="mt-4 space-y-3">
                        <div className="h-28 rounded-[22px] bg-slate-100" />
                        <div className="h-72 rounded-[22px] bg-slate-100" />
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-[#0b1020]">
                      <div className="border-b border-white/10 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex gap-2">
                            <div className="h-8 w-24 rounded-2xl bg-white" />
                            <div className="h-8 w-24 rounded-2xl bg-white/10" />
                          </div>
                          <div className="flex gap-2">
                            <div className="h-9 w-16 rounded-2xl bg-white/10" />
                            <div className="h-9 w-24 rounded-2xl bg-white/10" />
                          </div>
                        </div>
                        <div className="mt-3 h-6 w-64 rounded-full bg-white/10" />
                      </div>
                      <div className="grid min-h-[48vh] xl:grid-cols-[56px_minmax(0,1fr)_280px]">
                        <div className="border-r border-white/10 bg-black/25" />
                        <div className="bg-[#0b1020] p-4">
                          <div className="h-full rounded-[22px] bg-white/5" />
                        </div>
                        <div className="border-l border-white/10 bg-white/5 p-4">
                          <div className="h-4 w-20 rounded-full bg-white/10" />
                          <div className="mt-3 space-y-2">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <div key={index} className="h-14 rounded-2xl bg-white/10" />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-white/10 bg-[#0d1324] p-4">
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                          <div className="h-36 rounded-[22px] bg-white/5" />
                          <div className="h-36 rounded-[22px] bg-white/5" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    )
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
    <div className="min-h-[calc(100vh-6rem)] rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.06),transparent_28%),linear-gradient(180deg,#fbfcfe_0%,#f1f5f9_100%)] p-4 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
      <div className={`grid min-h-[calc(100vh-7.5rem)] items-start gap-4 ${copilotCollapsed ? "xl:grid-cols-[56px_88px_minmax(0,1fr)]" : "xl:grid-cols-[56px_320px_minmax(0,1fr)]"}`}>
        <aside className="flex h-[calc(100vh-7.5rem)] min-h-0 flex-col justify-between rounded-[24px] border border-slate-200 bg-[#10151f] p-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] xl:sticky xl:top-4">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setCopilotCollapsed((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-white/8 bg-white/5 text-white/70 transition hover:bg-white/10"
              aria-label={copilotCollapsed ? (isCn ? "展开 AI 栏" : "Expand AI rail") : (isCn ? "收起 AI 栏" : "Collapse AI rail")}
            >
              {copilotCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            {workspaceRailItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.action}
                  title={item.label}
                  className={`flex h-10 w-10 items-center justify-center rounded-[18px] border transition ${
                    item.active
                      ? "border-white/15 bg-white text-slate-950 shadow-sm"
                      : "border-transparent bg-white/[0.06] text-white/55 hover:border-white/10 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </button>
              )
            })}
          </div>
        </aside>

        <aside className="h-[calc(100vh-7.5rem)] min-h-0 overflow-hidden xl:sticky xl:top-4">
          {copilotCollapsed ? (
            <div className="flex h-full flex-col justify-between rounded-[28px] border border-slate-200 bg-white/90 p-3 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold text-white"
                    style={projectIcon ? { background: `linear-gradient(135deg, ${projectIcon.from}, ${projectIcon.to})`, boxShadow: `0 0 0 1px ${projectIcon.ring}` } : { background: "linear-gradient(135deg,#111827,#334155)" }}
                  >
                    {projectIcon?.glyph || projectName.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "AI", value: aiWorkflowMode === "discuss" ? copy.discussMode : aiWorkflowMode === "act" ? copy.actMode : aiModeLabel },
                    { label: "Tab", value: previewTab === "dashboard" ? "Dashboard" : previewTab === "code" ? copy.code : copy.preview },
                    { label: "File", value: contextFile ? contextFile.split("/").slice(-1)[0] : (isCn ? "未选中" : "none") },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2 text-center">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{item.label}</div>
                      <div className="mt-1 break-words text-[11px] font-medium text-slate-900">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-2 py-3 text-center">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{copy.aiStudio}</div>
                <div className="mt-2 text-[11px] leading-5 text-slate-700">
                  {isCn ? "展开后继续对话和修改。" : "Expand to continue the thread."}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white/96 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div className="border-b border-slate-200/80 px-4 pb-3 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-white"
                      style={projectIcon ? { background: `linear-gradient(135deg, ${projectIcon.from}, ${projectIcon.to})`, boxShadow: `0 0 0 1px ${projectIcon.ring}` } : { background: "linear-gradient(135deg,#111827,#334155)" }}
                    >
                      {projectIcon?.glyph || projectName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-950">{projectName || "MornCursor"}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{copy.workspaceTitle}</div>
                      <div className="mt-2 truncate text-[11px] text-slate-400">{workspaceStatus.label}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCopilotCollapsed(true)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
                <div className="h-full overflow-y-auto pr-1">
                  <div className="space-y-4">
                  {aiTimelineItems.length ? (
                    aiTimelineItems.map((item, index) => (
                      <div key={item.id} className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
                        <div className="text-[11px] leading-6 text-slate-800">{item.headline}</div>
                        {item.detail ? <div className="mt-1 text-[11px] leading-5 text-slate-500">{item.detail}</div> : null}
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${
                                item.tone === "warning"
                                  ? "bg-amber-100 text-amber-700"
                                  : item.tone === "success"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : item.tone === "live" || index === 0
                                      ? "bg-slate-950 text-white"
                                      : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {item.action}
                            </span>
                            {item.fileChips.map((fileChip) => (
                              <button
                                key={fileChip}
                                type="button"
                                onClick={() => focusWorkspaceCodeFile(fileChip, null, { forceCode: true })}
                                className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-600 transition hover:bg-slate-200"
                              >
                                {fileChip.split("/").slice(-1)[0]}
                              </button>
                            ))}
                          </div>
                          <span className="shrink-0 text-[10px] text-slate-400">{item.time}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      {workspaceStatus.key === "ready" || workspaceStatus.key === "workspace" || workspaceStatus.key === "fallback" || workspaceStatus.key === "sandbox"
                        ? (isCn ? "工作区已经打开，这里会继续记录你和 AI 的修改过程。" : "The workspace is already live. This rail will capture your next AI edits.")
                        : copy.noConversation}
                    </div>
                  )}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200/80 px-3 py-3">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{copy.quickSuggestions}</div>
                    <div className="flex flex-wrap gap-2">
                      {quickSuggestions.slice(0, 3).map((item) => (
                        <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-600">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-[18px] border border-slate-200 bg-white px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{isCn ? "Target file" : "Target file"}</div>
                      <div className="mt-1 truncate text-xs font-medium text-slate-900">{contextFile || copy.noFileSelected}</div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-400">{contextRoute || contextPage.label}</div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-3">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={copy.continuePrompt}
                      className="min-h-[156px] w-full resize-none bg-transparent px-1 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />
                    {iterateStatus ? <div className="mt-2 text-xs text-slate-500">{iterateStatus}</div> : null}
                    {iterateResult?.summary ? <div className="mt-1 text-xs text-slate-500">{iterateResult.summary}</div> : null}
                    {iterateResult?.warning ? <div className="mt-1 text-xs text-amber-600">{iterateResult.warning}</div> : null}
                  </div>

                  <Button onClick={iterate} disabled={iterating} className="h-11 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
                    <Wand2 className="mr-2 h-4 w-4" />
                    {iterating ? copy.applying : copy.applyChange}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </aside>

        <main className="min-w-0">
          <div className="flex min-h-[calc(100vh-7.5rem)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white/94 shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200/80 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid w-full max-w-[408px] grid-cols-3 gap-2 rounded-[20px] border border-slate-200 bg-slate-50 p-1">
                  {([
                    { key: "preview", label: copy.preview },
                    { key: "dashboard", label: "Dashboard" },
                    { key: "code", label: copy.code },
                  ] as const).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setPreviewTab(item.key)}
                      className={`h-11 rounded-[16px] px-4 text-sm font-medium transition ${
                        previewTab === item.key
                          ? "bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {previewTab === "preview" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={refreshPreview} disabled={runBusy && !canRenderPreview} className="h-10 rounded-2xl bg-white">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {copy.refresh}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void navigator.clipboard?.writeText(resolvedPreviewUrl || "")} className="h-10 rounded-2xl bg-white">
                      {copy.copyLink}
                    </Button>
                    <a
                      href={resolvedPreviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      {copy.openPreview}
                      <ExternalLink className="ml-2 h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.8),rgba(255,255,255,0.96))] p-4">
              {previewTab === "preview" ? (
                <div className="flex min-h-[76vh] flex-col">
                  <div className="flex flex-1 flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-[#e9edf3] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                    <div className="flex items-center justify-between border-b border-slate-200 bg-white/85 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" />
                          <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
                          <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
                        </div>
                        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-500">{resolvedPreviewUrl || "/"}</div>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-500">
                        {previewReady ? (isCn ? "Ready" : "Ready") : previewGenerating ? "Generating" : workspaceStatus.label}
                      </span>
                    </div>

                    <div className="flex-1 p-3 xl:p-4">
                      {showPreviewDebug ? (
                        <div className="mb-4 rounded-2xl border border-dashed border-slate-200 bg-white/85 px-4 py-3 text-[11px] text-slate-500">
                          <div>projectSlug: {previewProbe?.projectSlug ?? projectSlug}</div>
                          <div>routeProjectId: {projectId}</div>
                          <div>projectId: {project.projectId}</div>
                          <div>previewMode: {previewProbe?.previewMode ?? (project.preview?.activeMode || "static_ssr")}</div>
                          <div>previewStatus: {previewProbe?.previewStatus ?? (project.preview?.status || "idle")}</div>
                          <div>resolvedPreviewUrl: {previewProbe?.resolvedPreviewUrl ?? resolvedPreviewUrl}</div>
                          <div>responseStatus: {String(previewProbe?.responseStatus ?? "pending")}</div>
                        </div>
                      ) : null}

                      {previewShouldStayLoading ? (
                        <div className="h-full overflow-auto rounded-[26px] border border-slate-200 bg-white p-3">
                          <StructuredPreviewFallback
                            projectName={projectName}
                            projectSubtitle={projectSubtitle}
                            fallbackReason={previewLoadingReason}
                            buildStatus={project?.generation?.buildStatus ?? null}
                            isCn={isCn}
                            iconGlyph={projectIcon?.glyph}
                            iconFrom={projectIcon?.from}
                            iconTo={projectIcon?.to}
                          />
                        </div>
                      ) : canRenderPreview ? (
                        <iframe
                          key={`${resolvedPreviewUrl}:${previewRefreshKey}`}
                          title="app-preview"
                          src={resolvedPreviewUrl}
                          className="h-full min-h-[66vh] w-full rounded-[26px] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
                        />
                      ) : (
                        <div className="h-full overflow-auto rounded-[26px] border border-slate-200 bg-white p-3">
                          <StructuredPreviewFallback
                            projectName={projectName}
                            projectSubtitle={projectSubtitle}
                            fallbackReason={previewStarting ? copy.previewStarting : copy.previewNotRunning}
                            buildStatus={project?.generation?.buildStatus ?? null}
                            isCn={isCn}
                            iconGlyph={projectIcon?.glyph}
                            iconFrom={projectIcon?.from}
                            iconTo={projectIcon?.to}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : previewTab === "dashboard" ? (
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-4 text-lg font-semibold text-slate-950 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                    Dashboard
                  </div>
                  <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.05)] xl:grid xl:min-h-[72vh] xl:grid-cols-[280px_minmax(0,1fr)]">
                    <div className="border-b border-slate-200 bg-[#fbfcfe] p-5 xl:border-b-0 xl:border-r xl:sticky xl:top-0 xl:h-full">
                      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <Search className="h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder={copy.dashboardSearchPlaceholder}
                          className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                        />
                      </div>
                      <div className="mt-4 space-y-1">
                        {dashboardNavItems.map((item) => {
                          const Icon = item.icon
                          return (
                            <Link
                              key={item.key}
                              href={item.href}
                              className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-[13px] transition ${
                                item.active
                                  ? "bg-slate-950 text-white"
                                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                              }`}
                            >
                              <span className="flex items-center gap-3">
                                <Icon className="h-4 w-4" />
                                {item.label}
                              </span>
                              {item.badge ? (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] ${item.active ? "bg-white/10 text-white/80" : "bg-slate-100 text-slate-500"}`}>
                                  {item.badge}
                                </span>
                              ) : null}
                            </Link>
                          )
                        })}
                      </div>
                    </div>

                    <div className="bg-white p-6">
                      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="flex min-w-0 items-start gap-4">
                          <div
                            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] text-xl font-semibold text-white"
                            style={projectIcon ? { background: `linear-gradient(135deg, ${projectIcon.from}, ${projectIcon.to})`, boxShadow: `0 0 0 1px ${projectIcon.ring}` } : { background: "linear-gradient(135deg,#0f172a,#334155)" }}
                          >
                            {projectIcon?.glyph || projectName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-[2.15rem] font-semibold tracking-tight text-slate-950">{projectName || "MornCursor"}</h2>
                            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">{projectSummary}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                              <span>{isCn ? "创建于" : "Created"} {new Date(project.createdAt).toLocaleDateString(workspaceRegion === "cn" ? "zh-CN" : "en-US")}</span>
                              <span>•</span>
                              <span>{workspaceRegion === "cn" ? (isCn ? "国内版" : "China") : isCn ? "国际版" : "Global"}</span>
                            </div>
                            <div className="mt-5 flex flex-wrap gap-3">
                              <Button onClick={() => resolvedPreviewUrl && window.open(resolvedPreviewUrl, "_blank", "noopener,noreferrer")} className="h-11 rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-800">
                                {isCn ? "打开应用" : "Open App"}
                              </Button>
                              <Button variant="outline" onClick={() => void navigator.clipboard?.writeText(resolvedPreviewUrl || "")} className="h-11 rounded-2xl bg-white px-5">
                                {isCn ? "分享应用" : "Share App"}
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3 rounded-[26px] border border-slate-200 bg-slate-50/80 p-4">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{copy.appVisibility}</div>
                            <div className="mt-2 text-sm font-semibold text-slate-950">{copy.public}</div>
                            <div className="mt-1 text-sm text-slate-500">{copy.appVisibilityDesc}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{copy.inviteUsers}</div>
                            <div className="mt-2 text-sm font-semibold text-slate-950">Team</div>
                            <div className="mt-1 text-sm text-slate-500">{copy.inviteUsersDesc}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{copy.moveToWorkspace}</div>
                            <div className="mt-2 text-sm font-semibold text-slate-950">{copy.workspaceTitle}</div>
                            <div className="mt-1 text-sm text-slate-500">{copy.moveToWorkspaceDesc}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{isCn ? "平台标识" : "Platform Badge"}</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">{isCn ? deploymentOption.nameCn : deploymentOption.nameEn}</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">{isCn ? databaseOption.nameCn : databaseOption.nameEn}</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">{currentPlanLabel}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="min-h-[72vh]">
                  <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.08)] xl:grid xl:grid-cols-[280px_minmax(0,1fr)]">
                    <div className="border-b border-slate-200 bg-[#f8fafc] p-5 xl:border-b-0 xl:border-r">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{copy.codeFiles}</div>
                        <div className="mt-1 text-xs text-slate-400">{filteredCodeFiles.length} {isCn ? "个文件" : "files"}</div>
                      </div>
                      <button type="button" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100">
                        <Search className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <Search className="h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={codeQuery}
                        onChange={(e) => setCodeQuery(e.target.value)}
                        placeholder={isCn ? "过滤文件..." : "Filter files..."}
                        className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                      />
                    </div>

                    {recentCodeFiles.length ? (
                      <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-slate-400">{isCn ? "最近打开" : "Recent Files"}</div>
                        <div className="space-y-2">
                          {recentCodeFiles.slice(0, 4).map((filePath) => (
                            <button
                              key={filePath}
                              type="button"
                              onClick={() => setSelectedCodeFile(filePath)}
                              className={`w-full rounded-2xl border px-3 py-2.5 text-left text-xs transition ${
                                selectedCodeFile === filePath
                                  ? "border-slate-900 bg-slate-950 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              <div className="font-medium">{filePath.split("/").slice(-1)[0]}</div>
                              <div className={`mt-1 truncate ${selectedCodeFile === filePath ? "text-white/60" : "text-slate-400"}`}>{filePath}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 max-h-[56vh] overflow-auto pr-1">
                      {renderInteractiveFileTree(
                        filteredCodeTree,
                        selectedCodeFile,
                        expandedCodeFolders,
                        setSelectedCodeFile,
                        toggleCodeFolder
                      )}
                    </div>
                    </div>

                    <div className="overflow-hidden bg-[#0b1020]">
                    <div className="border-b border-white/10 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          {(codeTabs.length ? codeTabs : [selectedCodeFile || "app/page.tsx"]).map((tab) => (
                            <div key={tab} className={`flex items-center gap-2 rounded-2xl px-3 py-1.5 text-xs ${
                              selectedCodeFile === tab ? "bg-white text-slate-950" : "bg-white/5 text-white/70"
                            }`}>
                              <button type="button" onClick={() => setSelectedCodeFile(tab)}>
                                {tab.split("/").slice(-1)[0]}
                              </button>
                              {codeTabs.includes(tab) ? (
                                <button type="button" onClick={() => closeCodeTab(tab)} className="opacity-60 transition hover:opacity-100">
                                  x
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={saveCodeFile} disabled={!selectedCodeFile || codeSaving} className="h-9 rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                            {codeSaving ? copy.saving : copy.save}
                          </Button>
                          <a
                            href={resolvedPreviewUrl || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-9 items-center justify-center rounded-2xl border border-white/15 px-3 text-sm text-white/80 transition hover:bg-white/10"
                          >
                            {copy.openRaw}
                          </a>
                          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                        {editorBreadcrumbs.map((item, index) => (
                          <div key={`${item}-${index}`} className="flex items-center gap-2">
                            <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/75">{item}</span>
                            {index < editorBreadcrumbs.length - 1 ? <span>/</span> : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    {!codeExportAllowed ? (
                      <div className="border-b border-amber-400/15 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
                        {isCn ? "免费层保持在线代码工作区；导出与更完整交付包在升级后开放。" : "The free tier keeps the hosted code workspace active while export and fuller delivery unlock after upgrade."}
                      </div>
                    ) : null}

                    {openedFromAi ? (
                      <div className="border-b border-violet-400/15 bg-violet-400/10 px-4 py-3 text-xs text-violet-100">
                        <div className="flex flex-wrap gap-2">
                          {aiEntrySummary.map((item) => (
                            <span key={item} className="rounded-full border border-violet-300/20 bg-black/20 px-2.5 py-1">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="border-b border-white/10 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-white">
                            {selectedCodeFile || copy.noFileSelected}
                            {hasUnsavedChanges ? ` • ${isCn ? "未保存" : "unsaved"}` : ""}
                          </div>
                          <div className="mt-1 text-xs text-white/45">
                            {selectedFileSummary || (isCn ? "保持当前文件、路径和 AI 焦点都落在同一块编辑器里。" : "Keep the active file, route, and AI focus inside one editor surface.")}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{focusedLine ? (isCn ? `第 ${focusedLine} 行` : `Line ${focusedLine}`) : copy.noLineSelected}</span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{currentCodeRoute || (isCn ? "未命中路由" : "No route inferred")}</span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{selectedCodeSymbols.length} {isCn ? "symbols" : "symbols"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid min-h-[58vh] xl:grid-cols-[56px_minmax(0,1fr)]">
                      <div className="border-r border-white/10 bg-black/25 px-2 py-4 text-right text-xs text-white/30">
                        {codeLineNumbers.map((line) => (
                          <div key={line} className={`leading-6 ${focusedLine === line ? "text-amber-300" : ""}`}>
                            {line}
                          </div>
                        ))}
                      </div>
                      <textarea
                        value={codeLoading ? copy.loadingFile : draftCodeContent}
                        onChange={(e) => setDraftCodeContent(e.target.value)}
                        disabled={codeLoading || !selectedCodeFile}
                        spellCheck={false}
                        className="min-h-[52vh] w-full resize-none bg-transparent px-4 py-4 font-mono text-xs leading-6 text-white outline-none"
                      />
                    </div>

                    <div className="border-t border-white/10 bg-[#0d1324]">
                      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2 text-[11px]">
                        {([
                          { key: "terminal", label: isCn ? "Terminal" : "Terminal", count: editorTerminalLines.length },
                          { key: "problems", label: isCn ? "Problems" : "Problems", count: editorProblemItems.length },
                          { key: "output", label: isCn ? "Output" : "Output", count: editorOutputItems.length },
                        ] as const).map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setEditorBottomTab(item.key)}
                            className={`rounded-full px-3 py-1.5 transition ${
                              editorBottomTab === item.key ? "bg-white text-slate-950" : "bg-white/5 text-white/65"
                            }`}
                          >
                            {item.label}
                            <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${editorBottomTab === item.key ? "bg-slate-100 text-slate-500" : "bg-white/10 text-white/60"}`}>
                              {item.count}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="px-4 py-4">
                        <div className="max-h-[24vh] overflow-auto rounded-[22px] border border-white/10 bg-black/20 p-4">
                          {editorBottomTab === "terminal" ? (
                            <div className="space-y-2 font-mono text-[11px] text-emerald-200">
                              {editorTerminalLines.map((line, index) => (
                                <div key={`${index}-${line}`}>{line}</div>
                              ))}
                            </div>
                          ) : editorBottomTab === "problems" ? (
                            <div className="space-y-2">
                              {editorProblemItems.length ? editorProblemItems.map((item) => (
                                <div key={item.id} className={`rounded-2xl px-3 py-2 text-xs ${item.level === "warn" ? "bg-amber-500/15 text-amber-100" : "bg-white/5 text-white/75"}`}>
                                  {item.text}
                                </div>
                              )) : (
                                <div className="text-xs text-white/50">{isCn ? "当前没有新的问题。" : "No new problems right now."}</div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {editorOutputItems.map((item) => (
                                <div key={item} className="rounded-2xl bg-white/5 px-3 py-2 text-xs text-white/75">
                                  {item}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
