import path from "path"
import { promises as fs } from "fs"
import { ensureDir, getWorkspacesDir, writeTextFile, type Region } from "@/lib/project-workspace"
import type { PlanTier } from "@/lib/plan-catalog"

export type GenerateTaskStatus = "queued" | "running" | "done" | "error"

export type GenerateTask = {
  jobId: string
  projectId: string
  prompt: string
  rawPrompt?: string
  templateId?: string
  planTier?: PlanTier
  region: Region
  status: GenerateTaskStatus
  createdAt: string
  updatedAt: string
  logs?: string[]
  summary?: string
  changedFiles?: string[]
  buildStatus?: "ok" | "failed" | "skipped"
  buildLogs?: string[]
  templateTitle?: string
  error?: string
  retries?: number
}

type TaskStore = {
  tasks: Record<string, GenerateTask>
}

const TASK_FILE = path.join(getWorkspacesDir(), "_generate_tasks.json")

async function exists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function readStore(): Promise<TaskStore> {
  await ensureDir(path.dirname(TASK_FILE))
  if (!(await exists(TASK_FILE))) {
    return { tasks: {} }
  }
  const raw = await fs.readFile(TASK_FILE, "utf8")
  const parsed = JSON.parse(raw) as TaskStore
  return parsed?.tasks ? parsed : { tasks: {} }
}

async function writeStore(store: TaskStore) {
  await writeTextFile(TASK_FILE, JSON.stringify(store, null, 2))
}

export async function createGenerateTask(input: {
  projectId: string
  prompt: string
  rawPrompt?: string
  templateId?: string
  templateTitle?: string
  planTier?: PlanTier
  region: Region
}): Promise<GenerateTask> {
  const now = new Date().toISOString()
  const jobId = `gen_${Date.now()}`
  const task: GenerateTask = {
    jobId,
    projectId: input.projectId,
    prompt: input.prompt,
    rawPrompt: input.rawPrompt,
    templateId: input.templateId,
    templateTitle: input.templateTitle,
    planTier: input.planTier,
    region: input.region,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    logs: [],
    changedFiles: [],
    retries: 0,
  }
  const store = await readStore()
  store.tasks[jobId] = task
  await writeStore(store)
  return task
}

export async function getGenerateTask(jobId: string): Promise<GenerateTask | null> {
  const store = await readStore()
  return store.tasks[jobId] ?? null
}

export async function updateGenerateTask(
  jobId: string,
  updater: (task: GenerateTask) => GenerateTask
): Promise<GenerateTask | null> {
  const store = await readStore()
  const current = store.tasks[jobId]
  if (!current) return null
  const next = updater(current)
  store.tasks[jobId] = { ...next, updatedAt: new Date().toISOString() }
  await writeStore(store)
  return store.tasks[jobId]
}

export async function findLatestTaskByProject(projectId: string): Promise<GenerateTask | null> {
  const store = await readStore()
  const items = Object.values(store.tasks).filter((t) => t.projectId === projectId)
  if (!items.length) return null
  items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return items[0]
}

export async function appendGenerateTaskLog(jobId: string, line: string): Promise<GenerateTask | null> {
  return updateGenerateTask(jobId, (task) => ({
    ...task,
    logs: [...(task.logs ?? []), line],
  }))
}
