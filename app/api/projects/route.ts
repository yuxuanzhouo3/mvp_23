import { NextResponse } from "next/server"
import net from "net"
import { getProject, isPidAlive, listProjects, safeProjectId } from "@/lib/project-workspace"

export const runtime = "nodejs"

function buildPreviewUrl(projectId: string) {
  return `/api/projects/${encodeURIComponent(projectId)}/preview/`
}

function normalizeRuntimeUrl(projectId: string, url?: string) {
  const normalized = String(url ?? "").trim()
  if (!normalized) return buildPreviewUrl(projectId)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(normalized)) {
    return buildPreviewUrl(projectId)
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
    return NextResponse.json({
      project: {
        ...project,
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
    runtime?: {
      status: "stopped" | "starting" | "running" | "error"
      pid?: number
      port?: number
      url?: string
      lastStartedAt?: string
      lastError?: string
    }
  }> = []

  for (const p of projects) {
    const runtime = await normalizeRuntimeStatus(p.runtime)
    normalized.push({
      projectId: p.projectId,
      region: p.region,
      deploymentTarget: p.deploymentTarget,
      databaseTarget: p.databaseTarget,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      workspacePath: p.workspacePath,
      historyCount: p.history.length,
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
