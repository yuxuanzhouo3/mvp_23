import path from "path"
import { promises as fs } from "fs"
import { NextResponse } from "next/server"
import {
  appendProjectHistory,
  ensureDir,
  getProject,
  resolveProjectPath,
  safeProjectId,
  updateProject,
} from "@/lib/project-workspace"

export const runtime = "nodejs"

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const projectId = safeProjectId(id)
  const project = await getProject(projectId)
  if (!project) {
    return NextResponse.json({ error: "Project not found", projectId }, { status: 404 })
  }

  const workspacePath = await resolveProjectPath(projectId)
  if (!workspacePath) {
    return NextResponse.json({ error: "Workspace path not found", projectId }, { status: 404 })
  }

  const target = project.history
    .slice()
    .reverse()
    .find((item) => item.type === "iterate" && item.status === "done" && !item.revertedAt && item.fileBackups?.length)

  if (!target || !target.fileBackups?.length) {
    return NextResponse.json({ error: "No reversible iterate change found", projectId }, { status: 400 })
  }

  for (const backup of target.fileBackups) {
    const relative = String(backup.path || "").replace(/\\/g, "/").replace(/^\/+/, "")
    if (!relative || relative.includes("..")) continue

    const absolute = path.resolve(workspacePath, relative)
    const root = path.resolve(workspacePath)
    if (!absolute.startsWith(root + path.sep) && absolute !== root) continue

    if (backup.previousContent === null) {
      if (await pathExists(absolute)) {
        await fs.rm(absolute, { force: true })
      }
    } else {
      await ensureDir(path.dirname(absolute))
      await fs.writeFile(absolute, backup.previousContent, "utf8")
    }
  }

  const now = new Date().toISOString()

  await updateProject(projectId, (record) => ({
    ...record,
    history: record.history.map((item) =>
      item.id === target.id ? { ...item, revertedAt: now } : item
    ),
    updatedAt: now,
  }))

  await appendProjectHistory(projectId, {
    id: `evt_${Date.now()}`,
    type: "iterate",
    prompt: "[system] Revert last change",
    createdAt: now,
    status: "done",
    summary: `Reverted change from ${target.id}`,
    changedFiles: target.fileBackups.map((x) => x.path),
    buildStatus: "skipped",
  })

  return NextResponse.json({
    projectId,
    status: "done",
    revertedEventId: target.id,
    changedFiles: target.fileBackups.map((x) => x.path),
  })
}
