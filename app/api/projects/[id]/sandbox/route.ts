import { NextResponse } from "next/server"
import { resolveProjectPath, safeProjectId, getProject, updateProject } from "@/lib/project-workspace"
import { buildSandboxPreviewUrl } from "@/lib/preview-url"
import { startSandboxPreview, stopSandboxPreview, supportsSandboxRuntime } from "@/lib/sandbox-preview"

export const runtime = "nodejs"

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const projectId = safeProjectId(id)
  const project = await getProject(projectId)
  if (!project) {
    return NextResponse.json({ error: "Project not found", projectId }, { status: 404 })
  }
  return NextResponse.json({
    projectId,
    previewMode: project.previewMode ?? "static_ssr",
    sandboxRuntime: {
      status: project.sandboxRuntime?.status ?? "stopped",
      url: project.sandboxRuntime?.url ?? buildSandboxPreviewUrl(projectId),
      lastError: project.sandboxRuntime?.lastError,
      sandboxId: project.sandboxRuntime?.sandboxId,
      supported: supportsSandboxRuntime(),
    },
  })
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const projectId = safeProjectId(id)
  const body = await req.json().catch(() => ({}))
  const action = String(body?.action ?? "status")
  const project = await getProject(projectId)
  if (!project) {
    return NextResponse.json({ error: "Project not found", projectId }, { status: 404 })
  }

  if (action === "stop") {
    await stopSandboxPreview(project.sandboxRuntime?.sandboxId)
    await updateProject(projectId, (record) => ({
      ...record,
      previewMode: "static_ssr",
      sandboxRuntime: {
        status: "stopped",
      },
    }))
    return NextResponse.json({
      projectId,
      previewMode: "static_ssr",
      sandboxRuntime: {
        status: "stopped",
        url: buildSandboxPreviewUrl(projectId),
      },
    })
  }

  if (action !== "start" && action !== "restart") {
    return NextResponse.json({ error: "Invalid action. Use start|stop|restart." }, { status: 400 })
  }

  if (action === "restart") {
    await stopSandboxPreview(project.sandboxRuntime?.sandboxId)
  }

  const workspacePath = await resolveProjectPath(projectId)
  if (!workspacePath) {
    return NextResponse.json({ error: "Workspace path not found", projectId }, { status: 404 })
  }

  await updateProject(projectId, (record) => ({
    ...record,
    previewMode: "sandbox_runtime",
    sandboxRuntime: {
      ...(record.sandboxRuntime ?? {}),
      status: "starting",
      url: buildSandboxPreviewUrl(projectId),
      lastStartedAt: new Date().toISOString(),
      lastError: undefined,
    },
  }))

  try {
    const sandbox = await startSandboxPreview({
      projectId,
      workspacePath,
    })

    await updateProject(projectId, (record) => ({
      ...record,
      previewMode: "sandbox_runtime",
      sandboxRuntime: {
        status: "running",
        sandboxId: sandbox.sandboxId,
        cmdId: sandbox.cmdId,
        url: sandbox.externalUrl,
        lastStartedAt: new Date().toISOString(),
        lastError: undefined,
      },
    }))

    return NextResponse.json({
      projectId,
      previewMode: "sandbox_runtime",
      sandboxRuntime: {
        status: "running",
        sandboxId: sandbox.sandboxId,
        url: sandbox.externalUrl,
        proxyUrl: sandbox.proxyUrl,
      },
    })
  } catch (error: any) {
    const message = error?.message || String(error)
    await updateProject(projectId, (record) => ({
      ...record,
      previewMode: "static_ssr",
      sandboxRuntime: {
        ...(record.sandboxRuntime ?? {}),
        status: "error",
        url: buildSandboxPreviewUrl(projectId),
        lastStartedAt: new Date().toISOString(),
        lastError: message,
      },
    }))
    return NextResponse.json(
      {
        projectId,
        previewMode: "static_ssr",
        sandboxRuntime: {
          status: "error",
          url: buildSandboxPreviewUrl(projectId),
          lastError: message,
        },
      },
      { status: 500 }
    )
  }
}
