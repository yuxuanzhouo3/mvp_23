import path from "path"
import { randomUUID } from "crypto"
import { promises as fs } from "fs"
import { ensureDir, getWorkspacesDir, writeAtomicTextFile, type Region } from "@/lib/project-workspace"
import type { PlanTier } from "@/lib/plan-catalog"
import type {
  WorkspaceElementContext,
  WorkspaceModuleContext,
  WorkspacePageContext,
  WorkspaceSessionContext,
} from "@/lib/workspace-ai-context"

export type GenerateRequestContext = {
  currentFilePath?: string
  currentRoute?: string
  currentPage?: WorkspacePageContext
  currentModule?: WorkspaceModuleContext
  currentElement?: WorkspaceElementContext
  sharedSession?: WorkspaceSessionContext
  openTabs?: string[]
  relatedPaths?: string[]
}

export type GenerateWorkflowMode = "act" | "discuss" | "edit_context"

export type GenerateArchetype =
  | "code_platform"
  | "crm"
  | "api_platform"
  | "community"
  | "website_landing_download"
  | "admin_ops_internal_tool"

export type GeneratePlanSnapshot = {
  workflowMode: GenerateWorkflowMode
  productName: string
  productType: string
  archetype: GenerateArchetype
  summary: string
  pages: string[]
  routeMap: string[]
  modules: string[]
  aiTools: string[]
  taskPlan: string[]
  guardrails: string[]
  constraints: string[]
  deploymentTarget: string
  databaseTarget: string
}

export type GenerateAcceptanceReport = {
  workflowMode: GenerateWorkflowMode
  archetype: GenerateArchetype
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
  requestContext?: GenerateRequestContext
  contextSummary?: string
  workflowMode?: GenerateWorkflowMode
  planner?: GeneratePlanSnapshot
  acceptance?: GenerateAcceptanceReport
  error?: string
  retries?: number
}

type TaskStore = {
  tasks: Record<string, GenerateTask>
}

const TASK_FILE = path.join(getWorkspacesDir(), "_generate_tasks.json")
const STORE_READ_RETRY_MS = 25
let storeMutationQueue: Promise<void> = Promise.resolve()

async function exists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function readTaskStoreOnce(): Promise<TaskStore> {
  const raw = await fs.readFile(TASK_FILE, "utf8")
  const parsed = JSON.parse(raw) as TaskStore
  return parsed?.tasks ? parsed : { tasks: {} }
}

function extractLeadingJsonObject(raw: string) {
  const source = String(raw ?? "").trim()
  if (!source.startsWith("{")) return null
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === "\\") {
        escaped = true
        continue
      }
      if (char === "\"") {
        inString = false
      }
      continue
    }

    if (char === "\"") {
      inString = true
      continue
    }
    if (char === "{") {
      depth += 1
      continue
    }
    if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return source.slice(0, index + 1)
      }
    }
  }

  return null
}

async function tryRecoverTaskStore(): Promise<TaskStore | null> {
  const raw = await fs.readFile(TASK_FILE, "utf8").catch(() => "")
  const recovered = extractLeadingJsonObject(raw)
  if (!recovered) return null
  const parsed = JSON.parse(recovered) as TaskStore
  if (!parsed?.tasks) return null
  await writeStore(parsed)
  return parsed
}

async function readStore(): Promise<TaskStore> {
  await ensureDir(path.dirname(TASK_FILE))
  if (!(await exists(TASK_FILE))) {
    return { tasks: {} }
  }
  try {
    return await readTaskStoreOnce()
  } catch (error) {
    await sleep(STORE_READ_RETRY_MS)
    try {
      return await readTaskStoreOnce()
    } catch {
      const recovered = await tryRecoverTaskStore().catch(() => null)
      if (recovered) {
        return recovered
      }
      const message = error instanceof Error ? error.message : String(error)
      if (/Unexpected end of JSON input/i.test(message)) {
        return { tasks: {} }
      }
      throw error
    }
  }
}

async function writeStore(store: TaskStore) {
  const serialized = JSON.stringify(store, null, 2)
  await writeAtomicTextFile(TASK_FILE, serialized)
}

async function mutateStore<T>(mutator: (store: TaskStore) => Promise<T> | T): Promise<T> {
  const run = storeMutationQueue.then(async () => {
    const store = await readStore()
    const result = await mutator(store)
    await writeStore(store)
    return result
  })
  storeMutationQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

export async function createGenerateTask(input: {
  projectId: string
  prompt: string
  rawPrompt?: string
  templateId?: string
  templateTitle?: string
  planTier?: PlanTier
  region: Region
  requestContext?: GenerateRequestContext
  contextSummary?: string
  workflowMode?: GenerateWorkflowMode
}): Promise<GenerateTask> {
  const now = new Date().toISOString()
  const jobId = `gen_${Date.now()}_${randomUUID().slice(0, 8)}`
  const task: GenerateTask = {
    jobId,
    projectId: input.projectId,
    prompt: input.prompt,
    rawPrompt: input.rawPrompt,
    templateId: input.templateId,
    templateTitle: input.templateTitle,
    planTier: input.planTier,
    region: input.region,
    requestContext: input.requestContext,
    contextSummary: input.contextSummary,
    workflowMode: input.workflowMode,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    logs: [],
    changedFiles: [],
    retries: 0,
  }
  return mutateStore(async (store) => {
    store.tasks[jobId] = task
    return task
  })
}

export async function getGenerateTask(jobId: string): Promise<GenerateTask | null> {
  const store = await readStore()
  return store.tasks[jobId] ?? null
}

export async function updateGenerateTask(
  jobId: string,
  updater: (task: GenerateTask) => GenerateTask
): Promise<GenerateTask | null> {
  return mutateStore(async (store) => {
    const current = store.tasks[jobId]
    if (!current) return null
    const next = updater(current)
    store.tasks[jobId] = { ...next, updatedAt: new Date().toISOString() }
    return store.tasks[jobId]
  })
}

export async function upsertGenerateTask(task: GenerateTask): Promise<GenerateTask> {
  return mutateStore(async (store) => {
    store.tasks[task.jobId] = {
      ...task,
      updatedAt: task.updatedAt || new Date().toISOString(),
      createdAt: task.createdAt || new Date().toISOString(),
    }
    return store.tasks[task.jobId]
  })
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
