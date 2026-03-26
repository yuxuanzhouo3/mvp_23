import { NextResponse } from "next/server"
import net from "net"
import { buildCanonicalPreviewUrl, buildRuntimePreviewUrl, buildSandboxPreviewUrl } from "@/lib/preview-url"
import { readProjectSpec } from "@/lib/project-spec"
import { buildProjectPresentation } from "@/lib/project-presentation"
import { getProject, isPidAlive, listProjects, resolveProjectPath, safeProjectId } from "@/lib/project-workspace"
import { getDefaultPreviewMode, getSandboxReadiness, supportsSandboxRuntime } from "@/lib/sandbox-preview"

export const runtime = "nodejs"

function buildPreviewUrl(projectId: string) {
  return buildCanonicalPreviewUrl(projectId)
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
  return "ready" as const
}

function normalizeRuntimeUrl(projectId: string, url?: string) {
  const normalized = String(url ?? "").trim()
  if (!normalized) return buildRuntimePreviewUrl(projectId)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(normalized)) {
    return buildRuntimePreviewUrl(projectId)
  }
  if (normalized.startsWith("/api/projects/")) {
    return normalized.endsWith("/preview") ? `${normalized}/` : normalized
  }
  return normalized
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
    const presentation = buildProjectPresentation({
      projectId,
      region: project.region,
      spec,
      latestHistory,
    })
    const activeMode = resolveActivePreviewMode({
      previewMode: project.previewMode ?? getDefaultPreviewMode(),
      sandboxStatus: project.sandboxRuntime?.status,
      runtimeStatus: runtime?.status,
    })
    return NextResponse.json({
      project: {
        ...project,
        spec,
        presentation,
        preview: {
          defaultMode: "static_ssr",
          activeMode,
          status: resolvePreviewStatus({
            activeMode,
            runtimeStatus: runtime?.status,
            sandboxStatus: project.sandboxRuntime?.status,
          }),
          canonicalUrl: buildPreviewUrl(projectId),
          runtimeUrl: normalizeRuntimeUrl(projectId, (runtime as { url?: string } | undefined)?.url),
          sandboxUrl: buildSandboxPreviewUrl(projectId),
          sandboxExternalUrl: project.sandboxRuntime?.url || null,
          sandboxStatus: project.sandboxRuntime?.status ?? "stopped",
          supportsDynamicRuntime: !Boolean(process.env.VERCEL),
          supportsSandboxRuntime: supportsSandboxRuntime(),
          sandboxReadiness: getSandboxReadiness(),
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
      sandboxExternalUrl: string | null
      sandboxStatus: "stopped" | "starting" | "running" | "error"
      supportsDynamicRuntime: boolean
      supportsSandboxRuntime: boolean
      sandboxReadiness: ReturnType<typeof getSandboxReadiness>
    }
  }> = []

  for (const p of projects) {
    const runtime = await normalizeRuntimeStatus(p.runtime)
    const projectDir = await resolveProjectPath(p.projectId)
    const spec = projectDir ? await readProjectSpec(projectDir) : null
    const latestHistory = p.history?.length ? p.history[p.history.length - 1] : null
    const activeMode = resolveActivePreviewMode({
      previewMode: p.previewMode ?? getDefaultPreviewMode(),
      sandboxStatus: p.sandboxRuntime?.status,
      runtimeStatus: runtime?.status,
    })
    normalized.push({
      projectId: p.projectId,
      region: p.region,
      deploymentTarget: p.deploymentTarget,
      databaseTarget: p.databaseTarget,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      workspacePath: p.workspacePath,
      historyCount: p.history.length,
      presentation: buildProjectPresentation({
        projectId: p.projectId,
        region: p.region,
        spec,
        latestHistory,
      }),
      preview: {
        defaultMode: "static_ssr",
        activeMode,
        status: resolvePreviewStatus({
          activeMode,
          runtimeStatus: runtime?.status,
          sandboxStatus: p.sandboxRuntime?.status,
        }),
        canonicalUrl: buildPreviewUrl(p.projectId),
        runtimeUrl: normalizeRuntimeUrl(p.projectId, (runtime as { url?: string } | undefined)?.url),
        sandboxUrl: buildSandboxPreviewUrl(p.projectId),
        sandboxExternalUrl: p.sandboxRuntime?.url || null,
        sandboxStatus: p.sandboxRuntime?.status ?? "stopped",
        supportsDynamicRuntime: !Boolean(process.env.VERCEL),
        supportsSandboxRuntime: supportsSandboxRuntime(),
        sandboxReadiness: getSandboxReadiness(),
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
