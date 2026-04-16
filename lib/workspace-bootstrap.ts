import net from "net"
import path from "path"
import { promises as fs } from "fs"
import { buildCanonicalPreviewUrl, buildRuntimePreviewUrl, buildSandboxPreviewUrl } from "@/lib/preview-url"
import { buildAssignedAppUrl } from "@/lib/app-subdomain"
import { getPlanPolicy } from "@/lib/plan-catalog"
import { readProjectSpec } from "@/lib/project-spec"
import { buildProjectPresentation } from "@/lib/project-presentation"
import {
  getProject,
  getWorkspacePath,
  isPidAlive,
  resolveProjectPath,
  safeProjectId,
} from "@/lib/project-workspace"
import { getDefaultPreviewMode, getSandboxReadiness, supportsSandboxRuntime } from "@/lib/sandbox-preview"
import type { GenerateTask } from "@/lib/generate-tasks"
import type {
  WorkspaceBootstrapSnapshot,
  WorkspaceCodeEntrySnapshot,
  WorkspaceGenerateTaskSnapshot,
  WorkspacePreviewState,
  WorkspaceProjectDetailSnapshot,
  WorkspaceRuntimeState,
} from "@/lib/workspace-snapshot"

const IGNORED_DIRS = new Set(["node_modules", ".next", ".git"])
const MAX_BOOTSTRAP_FILE_SIZE = 160 * 1024
const MAX_BOOTSTRAP_FILE_COUNT = 180
const MAX_BOOTSTRAP_TOTAL_BYTES = 1_800_000
const STORE_PRIORITY_RE = /^(app|components|lib|hooks|pages|src|public|styles|spec\.json|package\.json|tsconfig\.json|next\.config|tailwind\.config|postcss\.config)/i
const SKIPPED_BOOTSTRAP_RE = /(^|\/)(\.env(?:\..+)?)$|\.db$|package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$/i

type GenerateHistoryRecord = {
  type: "generate" | "iterate"
  status: "done" | "error"
  summary?: string
  buildStatus?: "ok" | "failed" | "skipped"
  buildLogs?: string[]
  createdAt: string
}

function buildPreviewUrl(projectKey: string) {
  return buildCanonicalPreviewUrl(projectKey)
}

function resolvePreviewUrl(args: {
  activeMode: "static_ssr" | "dynamic_runtime" | "sandbox_runtime"
  canonicalUrl: string
  runtimeUrl: string
  sandboxUrl: string
}) {
  if (args.activeMode === "sandbox_runtime") return args.sandboxUrl
  if (args.activeMode === "dynamic_runtime") return args.runtimeUrl
  return args.canonicalUrl
}

function resolveActivePreviewMode(args: {
  previewMode?: "static_ssr" | "dynamic_runtime" | "sandbox_runtime"
  sandboxStatus?: "stopped" | "starting" | "running" | "error"
  runtimeStatus?: "stopped" | "starting" | "running" | "error"
}) {
  if (args.previewMode === "sandbox_runtime" && args.sandboxStatus === "running") {
    return "sandbox_runtime" as const
  }
  if (args.previewMode === "dynamic_runtime" && args.runtimeStatus === "running") {
    return "dynamic_runtime" as const
  }
  return "static_ssr" as const
}

function resolvePreviewStatus(args: {
  activeMode: "static_ssr" | "dynamic_runtime" | "sandbox_runtime"
  runtimeStatus?: "stopped" | "starting" | "running" | "error"
  sandboxStatus?: "stopped" | "starting" | "running" | "error"
  latestGenerate?: GenerateHistoryRecord | null
  spec?: { modules?: unknown[] } | null
  presentation?: ReturnType<typeof buildProjectPresentation> | null
}) {
  if (args.activeMode === "sandbox_runtime") {
    if (args.sandboxStatus === "running") return "ready" as const
    if (args.sandboxStatus === "starting") return "building" as const
    if (args.sandboxStatus === "error") return "failed" as const
    return "idle" as const
  }
  if (args.activeMode === "dynamic_runtime") {
    if (args.runtimeStatus === "running") return "ready" as const
    if (args.runtimeStatus === "starting") return "building" as const
    if (args.runtimeStatus === "error") return "failed" as const
    return "idle" as const
  }
  if (args.latestGenerate?.status === "error" || args.latestGenerate?.buildStatus === "failed") {
    return "failed" as const
  }
  if (args.latestGenerate?.status !== "done") {
    return "idle" as const
  }

  const routes = Array.isArray(args.presentation?.routes) ? args.presentation.routes.filter(Boolean) : []
  const modules = Array.isArray(args.spec?.modules) ? args.spec.modules.filter(Boolean) : []
  return routes.length > 0 || modules.length > 0 ? ("ready" as const) : ("building" as const)
}

function normalizeRuntimeUrl(projectId: string, url?: string) {
  const normalized = String(url ?? "").trim()
  if (!normalized) return buildRuntimePreviewUrl(projectId)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(normalized)) {
    return buildRuntimePreviewUrl(projectId)
  }
  if (normalized.startsWith("/api/projects/")) {
    if (/\/preview\/?$/.test(normalized)) {
      return buildRuntimePreviewUrl(projectId)
    }
    return normalized
  }
  return normalized
}

function getLatestGenerateRecord(history: GenerateHistoryRecord[] = []) {
  return (
    history
      .slice()
      .reverse()
      .find((item) => item.type === "generate") ?? null
  )
}

function resolveFallbackReason(args: {
  requestedMode?: "static_ssr" | "dynamic_runtime" | "sandbox_runtime"
  activeMode: "static_ssr" | "dynamic_runtime" | "sandbox_runtime"
  runtimeStatus?: "stopped" | "starting" | "running" | "error"
  runtimeError?: string
  sandboxStatus?: "stopped" | "starting" | "running" | "error"
  sandboxError?: string
}) {
  if (args.activeMode !== "static_ssr") return ""
  if (args.requestedMode === "sandbox_runtime") {
    if (args.sandboxStatus === "error") return args.sandboxError || "Sandbox preview failed. Falling back to the project canonical preview."
    if (args.sandboxStatus === "starting") return "Sandbox preview is still booting. Using the current project canonical preview for now."
    return "Sandbox preview is unavailable. Using the current project canonical preview."
  }
  if (args.requestedMode === "dynamic_runtime") {
    if (args.runtimeStatus === "error") return args.runtimeError || "Runtime preview failed. Falling back to the current project canonical preview."
    if (args.runtimeStatus === "starting") return "Runtime preview is still starting. Using the current project canonical preview for now."
    return "Runtime preview is unavailable. Using the current project canonical preview."
  }
  return ""
}

async function isPortInUse(port?: number) {
  if (!port) return false
  return new Promise<boolean>((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(500)
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("timeout", () => {
      socket.destroy()
      resolve(false)
    })
    socket.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ECONNREFUSED" || err.code === "EHOSTUNREACH") {
        resolve(false)
        return
      }
      resolve(true)
    })
    socket.connect(port, "127.0.0.1")
  })
}

function withinStartupGrace(lastStartedAt?: string, graceMs = 25_000) {
  if (!lastStartedAt) return false
  const started = Date.parse(lastStartedAt)
  if (Number.isNaN(started)) return false
  return Date.now() - started < graceMs
}

export async function normalizeRuntimeStatus<T extends WorkspaceRuntimeState & { lastStartedAt?: string }>(
  runtime: T | undefined
): Promise<T | undefined> {
  if (!runtime) return runtime
  if (runtime.status !== "running") return runtime

  const pidDead = Boolean(runtime.pid) && !isPidAlive(runtime.pid)
  const portAlive = await isPortInUse(runtime.port)
  const inGrace = withinStartupGrace(runtime.lastStartedAt)

  if (!portAlive && pidDead && !inGrace) {
    return { ...runtime, status: "stopped", pid: undefined } as T
  }
  if (!portAlive && !runtime.pid && !inGrace) {
    return { ...runtime, status: "stopped", pid: undefined } as T
  }
  return runtime
}

function normalizeRelativePath(filePath: string) {
  return filePath.replace(/\\/g, "/").replace(/^\/+/, "")
}

async function walkFiles(root: string, current = ""): Promise<string[]> {
  const dirPath = path.join(root, current)
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue
    const relative = current ? path.join(current, entry.name) : entry.name
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(root, relative)))
      continue
    }
    if (entry.isFile()) {
      files.push(normalizeRelativePath(relative))
    }
  }

  return files
}

function extractSymbols(content: string) {
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

function shouldCacheWorkspaceFile(relativePath: string) {
  const normalized = normalizeRelativePath(relativePath)
  if (!normalized || SKIPPED_BOOTSTRAP_RE.test(normalized)) return false
  return STORE_PRIORITY_RE.test(normalized) || normalized.endsWith(".md") || normalized.endsWith(".json")
}

function toGenerateTaskSnapshot(task?: GenerateTask | null): WorkspaceGenerateTaskSnapshot | null {
  if (!task) return null
  return {
    projectId: task.projectId,
    jobId: task.jobId,
    status: task.status,
    logs: task.logs ?? [],
    summary: task.summary,
    contextSummary: task.contextSummary,
    workflowMode: task.workflowMode,
    planner: task.planner,
    acceptance: task.acceptance,
    changedFiles: task.changedFiles ?? [],
    buildStatus: task.buildStatus,
    buildLogs: task.buildLogs ?? [],
    templateTitle: task.templateTitle,
    error: task.error,
  }
}

async function buildProjectDetailSnapshot(projectId: string): Promise<WorkspaceProjectDetailSnapshot | null> {
  const safeId = safeProjectId(projectId)
  const project = await getProject(safeId)
  if (!project) return null

  const runtime = await normalizeRuntimeStatus(project.runtime as (WorkspaceRuntimeState & { lastStartedAt?: string }) | undefined)
  const projectDir = await resolveProjectPath(safeId)
  const spec = projectDir ? await readProjectSpec(projectDir) : null
  const latestHistory = project.history?.length ? project.history[project.history.length - 1] : null
  const latestGenerate = getLatestGenerateRecord(project.history)
  const presentation = buildProjectPresentation({
    projectId: safeId,
    region: project.region,
    spec,
    latestHistory,
  })
  const requestedPreviewMode = project.previewMode ?? getDefaultPreviewMode()
  const activeMode = resolveActivePreviewMode({
    previewMode: requestedPreviewMode,
    sandboxStatus: project.sandboxRuntime?.status,
    runtimeStatus: runtime?.status,
  })
  const publicProjectKey = project.projectSlug || safeId
  const canonicalUrl = buildPreviewUrl(publicProjectKey)
  const runtimeUrl = normalizeRuntimeUrl(safeId, runtime?.url)
  const sandboxUrl = buildSandboxPreviewUrl(safeId)
  const preview: WorkspacePreviewState = {
    defaultMode: requestedPreviewMode,
    activeMode,
    status: resolvePreviewStatus({
      activeMode,
      runtimeStatus: runtime?.status,
      sandboxStatus: project.sandboxRuntime?.status,
      latestGenerate,
      spec,
      presentation,
    }),
    canonicalUrl,
    runtimeUrl,
    sandboxUrl,
    resolvedUrl: resolvePreviewUrl({
      activeMode,
      canonicalUrl,
      runtimeUrl,
      sandboxUrl,
    }),
    fallbackReason: resolveFallbackReason({
      requestedMode: requestedPreviewMode,
      activeMode,
      runtimeStatus: runtime?.status,
      runtimeError: runtime?.lastError,
      sandboxStatus: project.sandboxRuntime?.status,
      sandboxError: project.sandboxRuntime?.lastError,
    }),
    sandboxExternalUrl: project.sandboxRuntime?.url || null,
    sandboxStatus: project.sandboxRuntime?.status ?? "stopped",
    supportsDynamicRuntime: !Boolean(process.env.VERCEL),
    supportsSandboxRuntime: supportsSandboxRuntime(),
    sandboxReadiness: getSandboxReadiness(),
  }

  return {
    ...project,
    spec,
    presentation,
    delivery: (() => {
      const planPolicy = getPlanPolicy(spec?.planTier)
      return {
        generationProfile: planPolicy.generationProfile,
        codeExportLevel: planPolicy.codeExportLevel,
        databaseAccessMode: planPolicy.databaseAccessMode,
        projectLimit: planPolicy.projectLimit,
        collaboratorLimit: planPolicy.collaboratorLimit,
        routeBudget: planPolicy.maxGeneratedRoutes,
        moduleBudget: planPolicy.maxGeneratedModules,
        subdomainSlots: planPolicy.subdomainSlots,
        assignedDomain: buildAssignedAppUrl({
          projectSlug: project.projectSlug || safeId,
          projectId: safeId,
          region: project.region,
          planTier: spec?.planTier,
        }),
      }
    })(),
    generation: {
      status: latestGenerate?.status ?? "idle",
      summary: latestGenerate?.summary ?? "",
      buildStatus: latestGenerate?.buildStatus ?? null,
      buildLogs: latestGenerate?.buildLogs ?? [],
      createdAt: latestGenerate?.createdAt ?? null,
    },
    preview,
    runtime: runtime
      ? {
          ...runtime,
          url: normalizeRuntimeUrl(safeId, runtime.url),
        }
      : runtime,
  }
}

async function collectWorkspaceCodeSnapshot(workspacePath: string) {
  const allFiles = await walkFiles(workspacePath)
  const prioritized = allFiles.filter((item) => shouldCacheWorkspaceFile(item))
  const orderedFiles = [...prioritized, ...allFiles.filter((item) => !prioritized.includes(item))].slice(0, MAX_BOOTSTRAP_FILE_COUNT)
  const codeContents: Record<string, WorkspaceCodeEntrySnapshot> = {}
  let totalBytes = 0

  for (const relativePath of orderedFiles) {
    const absolutePath = path.resolve(workspacePath, relativePath)
    const stat = await fs.stat(absolutePath).catch(() => null)
    if (!stat || !stat.isFile()) continue
    if (stat.size > MAX_BOOTSTRAP_FILE_SIZE) continue
    if (totalBytes + stat.size > MAX_BOOTSTRAP_TOTAL_BYTES) continue
    const content = await fs.readFile(absolutePath, "utf8").catch(() => "")
    if (!content) continue
    totalBytes += Buffer.byteLength(content, "utf8")
    codeContents[relativePath] = {
      content,
      symbols: extractSymbols(content),
    }
  }

  const codeFiles = Array.from(new Set([...orderedFiles, ...Object.keys(codeContents)]))
  return { codeFiles, codeContents }
}

export async function buildWorkspaceBootstrap(args: {
  projectId: string
  task?: GenerateTask | null
}): Promise<WorkspaceBootstrapSnapshot | null> {
  const projectId = safeProjectId(args.projectId)
  if (!projectId) return null

  const project = await buildProjectDetailSnapshot(projectId)
  if (!project) return null

  const workspacePath = (await resolveProjectPath(projectId)) ?? getWorkspacePath(projectId)
  const { codeFiles, codeContents } = await collectWorkspaceCodeSnapshot(workspacePath).catch(() => ({
    codeFiles: [] as string[],
    codeContents: {} as Record<string, WorkspaceCodeEntrySnapshot>,
  }))

  return {
    projectId,
    projectSlug: project.projectSlug || projectId,
    region: project.region,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    project,
    generateTask: toGenerateTaskSnapshot(args.task),
    codeFiles,
    codeContents,
    source: "server",
  }
}
