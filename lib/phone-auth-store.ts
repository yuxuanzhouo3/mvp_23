import path from "path"
import { promises as fs } from "fs"
import { ensureDir, getWorkspacesDir, writeAtomicTextFile, writeTextFile } from "@/lib/project-workspace"

export type PhoneOtpRecord = {
  phone: string
  email: string
  code: string
  region: "cn"
  createdAt: string
  expiresAt: string
  consumedAt?: string
}

type PhoneOtpStore = {
  otps: PhoneOtpRecord[]
}

const OTP_FILE = path.join(getWorkspacesDir(), "_phone_otps.json")
const OTP_EXPIRY_MS = 1000 * 60 * 5
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

function normalizePhone(input: string) {
  const raw = String(input ?? "").trim()
  const normalized = raw.replace(/[^\d+]/g, "")
  if (!normalized) return ""
  if (normalized.startsWith("+")) return normalized
  return normalized
}

function createCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function readStoreOnce(): Promise<PhoneOtpStore> {
  const raw = await fs.readFile(OTP_FILE, "utf8")
  const parsed = JSON.parse(raw) as PhoneOtpStore
  return { otps: Array.isArray(parsed?.otps) ? parsed.otps : [] }
}

async function readStore(): Promise<PhoneOtpStore> {
  await ensureDir(path.dirname(OTP_FILE))
  if (!(await exists(OTP_FILE))) {
    const initial: PhoneOtpStore = { otps: [] }
    await writeTextFile(OTP_FILE, JSON.stringify(initial, null, 2))
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
        return { otps: [] }
      }
      throw error
    }
  }
}

async function writeStore(store: PhoneOtpStore) {
  await writeAtomicTextFile(OTP_FILE, JSON.stringify(store, null, 2))
}

function pruneOtps(records: PhoneOtpRecord[]) {
  const now = Date.now()
  return records.filter((item) => {
    if (item.consumedAt) return false
    return Date.parse(item.expiresAt) > now - 1000 * 60
  })
}

export async function createPhoneOtp(input: { phone: string; email: string }) {
  const phone = normalizePhone(input.phone)
  const email = String(input.email ?? "").trim().toLowerCase()
  if (!phone || !email) {
    throw new Error("phone and email are required")
  }

  const store = await readStore()
  const now = new Date()
  const record: PhoneOtpRecord = {
    phone,
    email,
    code: createCode(),
    region: "cn",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS).toISOString(),
  }

  store.otps = pruneOtps(store.otps).filter((item) => item.phone !== phone)
  store.otps.unshift(record)
  await writeStore(store)
  return record
}

export async function verifyPhoneOtp(input: { phone: string; email: string; code: string }) {
  const phone = normalizePhone(input.phone)
  const email = String(input.email ?? "").trim().toLowerCase()
  const code = String(input.code ?? "").trim()
  if (!phone || !email || !code) {
    throw new Error("phone, email, and code are required")
  }

  const store = await readStore()
  store.otps = pruneOtps(store.otps)
  const record = store.otps.find((item) => item.phone === phone && item.email === email) ?? null
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
