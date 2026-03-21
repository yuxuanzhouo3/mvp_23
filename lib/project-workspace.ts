import path from "path"
import { promises as fs } from "fs"
import type { DatabaseTarget, DeploymentTarget } from "@/lib/fullstack-targets"

export type Region = "cn" | "intl"

export type ProjectHistoryItem = {
  id: string
  type: "generate" | "iterate"
  prompt: string
  createdAt: string
  status: "done" | "error"
  summary?: string
  changedFiles?: string[]
  fileBackups?: Array<{
    path: string
    previousContent: string | null
  }>
  revertedAt?: string
  buildStatus?: "ok" | "failed" | "skipped"
  buildLogs?: string[]
  error?: string
}

export type ProjectRecord = {
  projectId: string
  region: Region
  deploymentTarget?: DeploymentTarget
  databaseTarget?: DatabaseTarget
  createdAt: string
  updatedAt: string
  workspacePath: string
  history: ProjectHistoryItem[]
  runtime?: {
    status: "stopped" | "starting" | "running" | "error"
    mode?: "dev" | "prod"
    pid?: number
    port?: number
    url?: string
    lastStartedAt?: string
    lastError?: string
  }
}

type ProjectsStore = {
  projects: Record<string, ProjectRecord>
}

export function getRuntimeStorageRoot() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "mornstack-runtime")
  }
  return process.cwd()
}

export function getWorkspacesDir() {
  return path.join(getRuntimeStorageRoot(), "workspaces")
}

export function getPromoAssetsDir() {
  return path.join(getRuntimeStorageRoot(), "promo-assets")
}

const WORKSPACES_DIR = getWorkspacesDir()
const STORE_FILE = path.join(WORKSPACES_DIR, "_projects.json")

export function safeProjectId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "")
}

export function createProjectId() {
  return safeProjectId(`project_${Date.now()}`)
}

export function getWorkspacePath(projectId: string) {
  return path.join(WORKSPACES_DIR, safeProjectId(projectId))
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

export async function writeTextFile(filePath: string, content: string) {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, content, "utf8")
}

async function readStore(): Promise<ProjectsStore> {
  await ensureDir(WORKSPACES_DIR)
  if (!(await exists(STORE_FILE))) {
    return { projects: {} }
  }
  const raw = await fs.readFile(STORE_FILE, "utf8")
  const parsed = JSON.parse(raw) as ProjectsStore
  return parsed?.projects ? parsed : { projects: {} }
}

async function writeStore(store: ProjectsStore) {
  await writeTextFile(STORE_FILE, JSON.stringify(store, null, 2))
}

export async function upsertProject(record: ProjectRecord) {
  const store = await readStore()
  store.projects[record.projectId] = record
  await writeStore(store)
}

export async function updateProject(
  projectId: string,
  updater: (record: ProjectRecord) => ProjectRecord
) {
  const safeId = safeProjectId(projectId)
  const store = await readStore()
  const current = store.projects[safeId]
  if (!current) {
    return null
  }
  const next = updater(current)
  store.projects[safeId] = next
  await writeStore(store)
  return next
}

export async function getProject(projectId: string) {
  const safeId = safeProjectId(projectId)
  const store = await readStore()
  return store.projects[safeId] ?? null
}

export async function listProjects() {
  const store = await readStore()
  return Object.values(store.projects).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export async function appendProjectHistory(
  projectId: string,
  item: ProjectHistoryItem
) {
  const safeId = safeProjectId(projectId)
  const current = await getProject(safeId)
  if (!current) {
    return
  }
  current.history.push(item)
  current.updatedAt = item.createdAt
  await upsertProject(current)
}

export async function resolveProjectPath(projectId: string) {
  const safeId = safeProjectId(projectId)
  const preferred = getWorkspacePath(safeId)
  if (await exists(preferred)) {
    return preferred
  }
  const runtimeLegacy = path.join(getRuntimeStorageRoot(), "generated", safeId)
  if (await exists(runtimeLegacy)) {
    return runtimeLegacy
  }
  const legacy = path.join(process.cwd(), "generated", safeId)
  if (await exists(legacy)) {
    return legacy
  }
  return null
}

export function isPidAlive(pid?: number) {
  if (!pid || pid <= 0) {
    return false
  }
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
