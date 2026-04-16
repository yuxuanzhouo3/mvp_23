import crypto from "crypto"
import path from "path"
import { promises as fs } from "fs"
import { ensureDir, getWorkspacesDir, writeAtomicTextFile, writeTextFile } from "@/lib/project-workspace"

type EmailVerificationPurpose = "register" | "reset"

export type EmailVerificationRecord = {
  email: string
  code: string
  region: "cn" | "intl"
  purpose: EmailVerificationPurpose
  createdAt: string
  expiresAt: string
  consumedAt?: string
}

type EmailVerificationStore = {
  codes: EmailVerificationRecord[]
}

const STORE_FILE = path.join(getWorkspacesDir(), "_email_verifications.json")
const CODE_EXPIRY_MS = 1000 * 60 * 10
const STORE_READ_RETRY_MS = 25

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

function createCode() {
  return String(crypto.randomInt(100000, 1000000))
}

async function readStoreOnce(): Promise<EmailVerificationStore> {
  const raw = await fs.readFile(STORE_FILE, "utf8")
  const parsed = JSON.parse(raw) as EmailVerificationStore
  return { codes: Array.isArray(parsed?.codes) ? parsed.codes : [] }
}

async function readStore(): Promise<EmailVerificationStore> {
  await ensureDir(path.dirname(STORE_FILE))
  if (!(await exists(STORE_FILE))) {
    const initial: EmailVerificationStore = { codes: [] }
    await writeTextFile(STORE_FILE, JSON.stringify(initial, null, 2))
    return initial
  }
  try {
    return await readStoreOnce()
  } catch (error) {
    await sleep(STORE_READ_RETRY_MS)
    try {
      return await readStoreOnce()
    } catch {
      const message = error instanceof Error ? error.message : String(error)
      if (/Unexpected end of JSON input/i.test(message)) {
        return { codes: [] }
      }
      throw error
    }
  }
}

async function writeStore(store: EmailVerificationStore) {
  await writeAtomicTextFile(STORE_FILE, JSON.stringify(store, null, 2))
}

function pruneCodes(records: EmailVerificationRecord[]) {
  const now = Date.now()
  return records.filter((item) => {
    if (item.consumedAt) return false
    return Date.parse(item.expiresAt) > now - 1000 * 60
  })
}

export async function createEmailVerificationCode(input: {
  email: string
  region: "cn" | "intl"
  purpose: EmailVerificationPurpose
}) {
  const email = String(input.email ?? "").trim().toLowerCase()
  if (!email) {
    throw new Error("email is required")
  }

  const store = await readStore()
  const now = new Date()
  const record: EmailVerificationRecord = {
    email,
    code: createCode(),
    region: input.region,
    purpose: input.purpose,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CODE_EXPIRY_MS).toISOString(),
  }

  store.codes = pruneCodes(store.codes).filter((item) => !(item.email === email && item.purpose === input.purpose))
  store.codes.unshift(record)
  await writeStore(store)
  return record
}

export async function verifyEmailVerificationCode(input: {
  email: string
  code: string
  purpose: EmailVerificationPurpose
}) {
  const email = String(input.email ?? "").trim().toLowerCase()
  const code = String(input.code ?? "").trim()
  if (!email || !code) {
    throw new Error("email and code are required")
  }

  const store = await readStore()
  store.codes = pruneCodes(store.codes)
  const record = store.codes.find((item) => item.email === email && item.purpose === input.purpose) ?? null
  if (!record) {
    await writeStore(store)
    return null
  }
  if (record.code !== code) {
    await writeStore(store)
    return null
  }
  record.consumedAt = new Date().toISOString()
  await writeStore(store)
  return record
}
