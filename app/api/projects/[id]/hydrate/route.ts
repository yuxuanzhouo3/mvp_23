import path from "path"
import { NextResponse } from "next/server"
import {
  ensureDir,
  getWorkspacePath,
  safeProjectId,
  upsertProject,
  writeTextFile,
} from "@/lib/project-workspace"
import { buildCanonicalPreviewUrl } from "@/lib/preview-url"
import { getDefaultPreviewMode } from "@/lib/sandbox-preview"
import { upsertGenerateTask } from "@/lib/generate-tasks"
import type { WorkspaceBootstrapSnapshot } from "@/lib/workspace-snapshot"

export const runtime = "nodejs"

function normalizeRelativePath(filePath: string) {
  return filePath.replace(/\\/g, "/").replace(/^\/+/, "")
}

function isSafeWorkspacePath(filePath: string) {
  const normalized = normalizeRelativePath(filePath)
  if (!normalized || normalized.includes("..")) return false
  if (normalized.startsWith("node_modules/") || normalized.startsWith(".next/") || normalized.startsWith(".git/")) {
    return false
  }
  return true
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const projectId = safeProjectId(id)
  const body = await req.json().catch(() => ({}))
  const snapshot = body?.snapshot as WorkspaceBootstrapSnapshot | undefined

  if (!projectId || !snapshot || safeProjectId(snapshot.projectId) !== projectId) {
    return NextResponse.json({ error: "A matching workspace snapshot is required.", projectId }, { status: 400 })
  }

  const workspacePath = getWorkspacePath(projectId)
  await ensureDir(workspacePath)

  let restoredFiles = 0
  for (const relativePath of snapshot.codeFiles ?? []) {
    const normalized = normalizeRelativePath(relativePath)
    const entry = snapshot.codeContents?.[normalized]
    if (!entry || !isSafeWorkspacePath(normalized)) continue
    await writeTextFile(path.join(workspacePath, normalized), entry.content)
    restoredFiles += 1
  }

  const project = snapshot.project
  const createdAt = project.createdAt || snapshot.createdAt || new Date().toISOString()
  const updatedAt = snapshot.updatedAt || project.updatedAt || createdAt
  const projectSlug = snapshot.projectSlug || project.projectSlug || projectId

  await upsertProject({
    projectId,
    projectSlug,
    region: snapshot.region,
    deploymentTarget: project.deploymentTarget,
    databaseTarget: project.databaseTarget,
    createdAt,
    updatedAt,
    workspacePath,
    runtime: {
      status: project.runtime?.status ?? "stopped",
      mode: project.runtime?.mode,
      pid: project.runtime?.pid,
      port: project.runtime?.port ?? 3001,
      url: project.runtime?.url ?? buildCanonicalPreviewUrl(projectSlug),
      lastError: project.runtime?.lastError,
    },
    previewMode: project.preview?.activeMode ?? getDefaultPreviewMode(),
    sandboxRuntime: {
      status: project.preview?.sandboxStatus ?? "stopped",
      url: project.preview?.sandboxExternalUrl ?? undefined,
    },
    history: (project.history ?? []).map((item) => ({
      id: item.id,
      type: item.type,
      prompt: item.prompt,
      createdAt: item.createdAt,
      status: item.status,
      summary: item.summary,
      buildStatus: item.buildStatus,
      error: item.error,
    })),
  })

  if (snapshot.generateTask?.jobId) {
    await upsertGenerateTask({
      jobId: snapshot.generateTask.jobId,
      projectId,
      prompt: snapshot.generateTask.summary || project.presentation?.summary || project.presentation?.displayName || projectId,
      rawPrompt: snapshot.generateTask.summary,
      region: snapshot.region,
      status: snapshot.generateTask.status,
      createdAt,
      updatedAt,
      logs: snapshot.generateTask.logs ?? [],
      summary: snapshot.generateTask.summary,
      changedFiles: snapshot.generateTask.changedFiles ?? [],
      buildStatus: snapshot.generateTask.buildStatus,
      buildLogs: snapshot.generateTask.buildLogs,
      templateTitle: snapshot.generateTask.templateTitle,
      contextSummary: snapshot.generateTask.contextSummary,
      workflowMode: snapshot.generateTask.workflowMode,
      planner: snapshot.generateTask.planner,
      acceptance: snapshot.generateTask.acceptance,
      error: snapshot.generateTask.error,
      retries: 0,
    })
  }

  return NextResponse.json({
    projectId,
    hydrated: true,
    restoredFiles,
    workspacePath,
  })
}
