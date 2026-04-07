import { NextResponse } from "next/server"
import net from "net"
import { buildCanonicalPreviewUrl, buildRuntimePreviewUrl, buildSandboxPreviewUrl } from "@/lib/preview-url"
import { buildAssignedAppUrl } from "@/lib/app-subdomain"
import { findLatestTaskByProject } from "@/lib/generate-tasks"
import { getPlanPolicy } from "@/lib/plan-catalog"
import { readProjectSpec } from "@/lib/project-spec"
import { buildProjectPresentation } from "@/lib/project-presentation"
import { getProject, isPidAlive, listProjects, resolveProjectPath, safeProjectId } from "@/lib/project-workspace"
import { getDefaultPreviewMode, getSandboxReadiness, supportsSandboxRuntime } from "@/lib/sandbox-preview"

export const runtime = "nodejs"

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
  projectId: string
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
  return history
    .slice()
    .reverse()
    .find((item) => item.type === "generate") ?? null
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

async function normalizeRuntimeStatus<T extends { status: "stopped" | "starting" | "running" | "error"; pid?: number; port?: number; lastStartedAt?: string }>(
  runtime: T | undefined
): Promise<T | undefined> {
  if (!runtime) return runtime
  if (runtime.status !== "running") return runtime

  // On Windows detached processes often don't keep a usable pid; use port + grace window.
  const pidDead = Boolean(runtime.pid) && !isPidAlive(runtime.pid)
  const portAlive = await isPortInUse(runtime.port)
  const inGrace = withinStartupGrace(runtime.lastStartedAt)

  if (!portAlive && pidDead && !inGrace) {
    return { ...runtime, status: "stopped", pid: undefined } as T
  }
  if (!portAlive && !runtime.pid && inGrace) {
    return runtime
  }
  if (!portAlive && !runtime.pid && !inGrace) {
    return { ...runtime, status: "stopped", pid: undefined } as T
  }
  return runtime
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const maybeId = searchParams.get("projectId")

  if (maybeId) {
    const projectId = safeProjectId(maybeId)
    const project = await getProject(projectId)
    if (!project) {
      return NextResponse.json({ error: "Project not found", projectId }, { status: 404 })
    }
    const runtime = await normalizeRuntimeStatus(project.runtime)
    const projectDir = await resolveProjectPath(projectId)
    const spec = projectDir ? await readProjectSpec(projectDir) : null
    const latestHistory = project.history?.length ? project.history[project.history.length - 1] : null
    const latestGenerate = getLatestGenerateRecord(project.history)
    const latestTask = await findLatestTaskByProject(projectId)
    const presentation = buildProjectPresentation({
      projectId,
      region: project.region,
      spec,
      latestHistory,
    })
    const planPolicy = getPlanPolicy(spec?.planTier)
    const activeMode = resolveActivePreviewMode({
      previewMode: project.previewMode ?? getDefaultPreviewMode(),
      sandboxStatus: project.sandboxRuntime?.status,
      runtimeStatus: runtime?.status,
    })
    const publicProjectKey = project.projectSlug || projectId
    const canonicalUrl = buildPreviewUrl(publicProjectKey)
    const runtimeUrl = normalizeRuntimeUrl(projectId, (runtime as { url?: string } | undefined)?.url)
    const sandboxUrl = buildSandboxPreviewUrl(projectId)
    return NextResponse.json({
      project: {
        ...project,
        spec,
        presentation,
        generation: {
          jobId: latestTask?.jobId ?? null,
          status: latestGenerate?.status ?? "idle",
          summary: latestGenerate?.summary ?? "",
          buildStatus: latestGenerate?.buildStatus ?? null,
          buildLogs: latestGenerate?.buildLogs ?? [],
          createdAt: latestGenerate?.createdAt ?? null,
        },
        preview: {
          defaultMode: "static_ssr",
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
            projectId,
            activeMode,
            canonicalUrl,
            runtimeUrl,
            sandboxUrl,
          }),
          fallbackReason: resolveFallbackReason({
            requestedMode: project.previewMode ?? getDefaultPreviewMode(),
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
        },
        delivery: {
          planId: planPolicy.planId,
          generationProfile: planPolicy.generationProfile,
          codeExportLevel: planPolicy.codeExportLevel,
          databaseAccessMode: planPolicy.databaseAccessMode,
          projectLimit: planPolicy.projectLimit,
          collaboratorLimit: planPolicy.collaboratorLimit,
          routeBudget: planPolicy.maxGeneratedRoutes,
          moduleBudget: planPolicy.maxGeneratedModules,
          assignedDomain: buildAssignedAppUrl({
            projectSlug: project.projectSlug || projectId,
            projectId,
            region: project.region,
            planTier: spec?.planTier,
          }),
          subdomainSlots: planPolicy.subdomainSlots,
        },
        runtime: runtime
          ? {
              ...runtime,
              url: normalizeRuntimeUrl(projectId, (runtime as { url?: string }).url),
            }
          : runtime,
      },
    })
  }

  const projects = await listProjects()
  const normalized: Array<{
    projectId: string
    region: "cn" | "intl"
    deploymentTarget?: string
    databaseTarget?: string
    createdAt: string
    updatedAt: string
    workspacePath: string
    historyCount: number
    presentation: ReturnType<typeof buildProjectPresentation>
    generation: {
      jobId: string | null
      status: "done" | "error" | "idle"
      summary: string
      buildStatus: "ok" | "failed" | "skipped" | null
      createdAt: string | null
    }
    runtime?: {
      status: "stopped" | "starting" | "running" | "error"
      pid?: number
      port?: number
      url?: string
      lastStartedAt?: string
      lastError?: string
    }
    preview: {
      defaultMode: "static_ssr"
      activeMode: "static_ssr" | "dynamic_runtime" | "sandbox_runtime"
      status: "idle" | "building" | "ready" | "failed"
      canonicalUrl: string
      runtimeUrl: string
      sandboxUrl: string | null
      resolvedUrl: string
      fallbackReason: string
      sandboxExternalUrl: string | null
      sandboxStatus: "stopped" | "starting" | "running" | "error"
      supportsDynamicRuntime: boolean
      supportsSandboxRuntime: boolean
      sandboxReadiness: ReturnType<typeof getSandboxReadiness>
    }
    delivery: {
      planId: "free" | "starter" | "builder" | "pro" | "elite"
      assignedDomain: string
      subdomainSlots: number
      generationProfile: "starter" | "builder" | "premium" | "showcase"
      codeExportLevel: "none" | "manifest" | "full"
      databaseAccessMode: "online_only" | "managed_config" | "production_access" | "handoff_ready"
      projectLimit: number
      collaboratorLimit: number
      routeBudget: number
      moduleBudget: number
    }
  }> = []

  for (const p of projects) {
    const runtime = await normalizeRuntimeStatus(p.runtime)
    const projectDir = await resolveProjectPath(p.projectId)
    const spec = projectDir ? await readProjectSpec(projectDir) : null
    const latestHistory = p.history?.length ? p.history[p.history.length - 1] : null
    const latestGenerate = getLatestGenerateRecord(p.history)
    const latestTask = await findLatestTaskByProject(p.projectId)
    const presentation = buildProjectPresentation({
      projectId: p.projectId,
      region: p.region,
      spec,
      latestHistory,
    })
    const activeMode = resolveActivePreviewMode({
      previewMode: p.previewMode ?? getDefaultPreviewMode(),
      sandboxStatus: p.sandboxRuntime?.status,
      runtimeStatus: runtime?.status,
    })
    const publicProjectKey = p.projectSlug || p.projectId
    const canonicalUrl = buildPreviewUrl(publicProjectKey)
    const runtimeUrl = normalizeRuntimeUrl(p.projectId, (runtime as { url?: string } | undefined)?.url)
    const sandboxUrl = buildSandboxPreviewUrl(p.projectId)
    const planPolicy = getPlanPolicy(spec?.planTier)
    normalized.push({
      projectId: p.projectId,
      region: p.region,
      deploymentTarget: p.deploymentTarget,
      databaseTarget: p.databaseTarget,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      workspacePath: p.workspacePath,
      historyCount: p.history.length,
      presentation,
      generation: {
        jobId: latestTask?.jobId ?? null,
        status: latestGenerate?.status ?? "idle",
        summary: latestGenerate?.summary ?? "",
        buildStatus: latestGenerate?.buildStatus ?? null,
        createdAt: latestGenerate?.createdAt ?? null,
      },
      preview: {
        defaultMode: "static_ssr",
        activeMode,
        status: resolvePreviewStatus({
          activeMode,
          runtimeStatus: runtime?.status,
          sandboxStatus: p.sandboxRuntime?.status,
          latestGenerate,
          spec,
          presentation,
        }),
        canonicalUrl,
        runtimeUrl,
        sandboxUrl,
        resolvedUrl: resolvePreviewUrl({
          projectId: p.projectId,
          activeMode,
          canonicalUrl,
          runtimeUrl,
          sandboxUrl,
        }),
        fallbackReason: resolveFallbackReason({
          requestedMode: p.previewMode ?? getDefaultPreviewMode(),
          activeMode,
          runtimeStatus: runtime?.status,
          runtimeError: runtime?.lastError,
          sandboxStatus: p.sandboxRuntime?.status,
          sandboxError: p.sandboxRuntime?.lastError,
        }),
        sandboxExternalUrl: p.sandboxRuntime?.url || null,
        sandboxStatus: p.sandboxRuntime?.status ?? "stopped",
        supportsDynamicRuntime: !Boolean(process.env.VERCEL),
        supportsSandboxRuntime: supportsSandboxRuntime(),
        sandboxReadiness: getSandboxReadiness(),
      },
      delivery: {
        planId: planPolicy.planId,
        generationProfile: planPolicy.generationProfile,
        codeExportLevel: planPolicy.codeExportLevel,
        databaseAccessMode: planPolicy.databaseAccessMode,
        projectLimit: planPolicy.projectLimit,
        collaboratorLimit: planPolicy.collaboratorLimit,
        routeBudget: planPolicy.maxGeneratedRoutes,
        moduleBudget: planPolicy.maxGeneratedModules,
        assignedDomain: buildAssignedAppUrl({
          projectSlug: p.projectSlug || p.projectId,
          projectId: p.projectId,
          region: p.region,
          planTier: spec?.planTier,
        }),
        subdomainSlots: planPolicy.subdomainSlots,
      },
      runtime: runtime
        ? {
            ...runtime,
            url: normalizeRuntimeUrl(p.projectId, (runtime as { url?: string }).url),
          }
        : runtime,
    })
  }

  return NextResponse.json({
    projects: normalized,
  })
}
