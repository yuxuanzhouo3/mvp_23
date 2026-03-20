import crypto from "crypto"
import path from "path"
import { promises as fs } from "fs"
import { ensureDir, getWorkspacesDir, writeTextFile } from "@/lib/project-workspace"

export type AuthUser = {
  id: string
  email: string
  password: string
  name: string
  region: "cn" | "intl"
  createdAt: string
}

export type AuthSession = {
  token: string
  userId: string
  createdAt: string
  expiresAt: string
}

type AuthStore = {
  users: AuthUser[]
  sessions: AuthSession[]
}

const AUTH_FILE = path.join(getWorkspacesDir(), "_auth.json")

async function exists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function createSeedUsers(): AuthUser[] {
  const now = new Date().toISOString()
  return [
    {
      id: "user_cn_demo",
      email: "demo-cn@mornscience.ai",
      password: "123456",
      name: "演示账号",
      region: "cn",
      createdAt: now,
    },
    {
      id: "user_intl_demo",
      email: "demo-intl@mornscience.ai",
      password: "123456",
      name: "Demo User",
      region: "intl",
      createdAt: now,
    },
  ]
}

async function readStore(): Promise<AuthStore> {
  await ensureDir(path.dirname(AUTH_FILE))
  if (!(await exists(AUTH_FILE))) {
    const initial: AuthStore = {
      users: createSeedUsers(),
      sessions: [],
    }
    await writeTextFile(AUTH_FILE, JSON.stringify(initial, null, 2))
    return initial
  }
  const raw = await fs.readFile(AUTH_FILE, "utf8")
  const parsed = JSON.parse(raw) as AuthStore
  return {
    users: Array.isArray(parsed?.users) ? parsed.users : createSeedUsers(),
    sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
  }
}

async function writeStore(store: AuthStore) {
  await writeTextFile(AUTH_FILE, JSON.stringify(store, null, 2))
}

export async function findUserByCredentials(email: string, password: string) {
  const store = await readStore()
  return (
    store.users.find(
      (user) => user.email.toLowerCase() === email.trim().toLowerCase() && user.password === password
    ) ?? null
  )
}

export async function upsertExternalUser(input: {
  id: string
  email: string
  name: string
  region: "cn" | "intl"
}) {
  const store = await readStore()
  const existing = store.users.find((user) => user.id === input.id || user.email.toLowerCase() === input.email.toLowerCase())
  if (existing) {
    existing.email = input.email
    existing.name = input.name
    existing.region = input.region
    await writeStore(store)
    return existing
  }

  const next: AuthUser = {
    id: input.id,
    email: input.email,
    name: input.name,
    region: input.region,
    password: "",
    createdAt: new Date().toISOString(),
  }
  store.users.push(next)
  await writeStore(store)
  return next
}

export async function createLocalUser(input: {
  email: string
  password: string
  name?: string
  region: "cn" | "intl"
}) {
  const email = String(input.email ?? "").trim().toLowerCase()
  const password = String(input.password ?? "")
  if (!email || !password) {
    throw new Error("email and password are required")
  }

  const store = await readStore()
  const existing = store.users.find((user) => user.email.toLowerCase() === email)
  if (existing) {
    throw new Error("User already exists")
  }

  const next: AuthUser = {
    id: `local_${crypto.randomUUID()}`,
    email,
    password,
    name: String(input.name ?? email.split("@")[0] ?? "User").trim() || "User",
    region: input.region,
    createdAt: new Date().toISOString(),
  }
  store.users.push(next)
  await writeStore(store)
  return next
}

export async function createSession(userId: string) {
  const store = await readStore()
  const now = new Date()
  const session: AuthSession = {
    token: crypto.randomUUID(),
    userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  }
  store.sessions = store.sessions.filter((item) => item.userId !== userId)
  store.sessions.push(session)
  await writeStore(store)
  return session
}

export async function getSessionWithUser(token: string) {
  const store = await readStore()
  const session = store.sessions.find((item) => item.token === token) ?? null
  if (!session) return null
  if (Date.parse(session.expiresAt) < Date.now()) {
    store.sessions = store.sessions.filter((item) => item.token !== token)
    await writeStore(store)
    return null
  }
  const user = store.users.find((item) => item.id === session.userId) ?? null
  if (!user) return null
  return { session, user }
}

export async function deleteSession(token: string) {
  const store = await readStore()
  const next = store.sessions.filter((item) => item.token !== token)
  if (next.length !== store.sessions.length) {
    store.sessions = next
    await writeStore(store)
  }
}
