import crypto from "crypto"
import path from "path"
import { promises as fs } from "fs"
import { ensureDir, getWorkspacesDir, writeAtomicTextFile, writeTextFile } from "@/lib/project-workspace"
import type { PlanTier } from "@/lib/plan-catalog"

export type PaymentRecord = {
  id: string
  userId: string
  userEmail: string
  region: "cn" | "intl"
  planId: PlanTier | string
  planName: string
  amountLabel: string
  method: string
  status: "pending" | "completed" | "cancelled"
  createdAt: string
  updatedAt: string
}

type PaymentStore = {
  payments: PaymentRecord[]
}

const PAYMENT_FILE = path.join(getWorkspacesDir(), "_payments.json")
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

async function readPaymentStoreOnce(): Promise<PaymentStore> {
  const raw = await fs.readFile(PAYMENT_FILE, "utf8")
  const parsed = JSON.parse(raw) as PaymentStore
  return { payments: Array.isArray(parsed?.payments) ? parsed.payments : [] }
}

async function readStore(): Promise<PaymentStore> {
  await ensureDir(path.dirname(PAYMENT_FILE))
  if (!(await exists(PAYMENT_FILE))) {
    const initial: PaymentStore = { payments: [] }
    await writeTextFile(PAYMENT_FILE, JSON.stringify(initial, null, 2))
    return initial
  }
  try {
    return await readPaymentStoreOnce()
  } catch (error) {
    await sleep(STORE_READ_RETRY_MS)
    try {
      return await readPaymentStoreOnce()
    } catch {
      const message = error instanceof Error ? error.message : String(error)
      if (/Unexpected end of JSON input/i.test(message)) {
        return { payments: [] }
      }
      throw error
    }
  }
}

async function writeStore(store: PaymentStore) {
  const serialized = JSON.stringify(store, null, 2)
  await writeAtomicTextFile(PAYMENT_FILE, serialized)
}

export async function createPayment(input: Omit<PaymentRecord, "id" | "status" | "createdAt" | "updatedAt">) {
  const store = await readStore()
  const now = new Date().toISOString()
  const payment: PaymentRecord = {
    id: crypto.randomUUID(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
    ...input,
  }
  store.payments.unshift(payment)
  await writeStore(store)
  return payment
}

export async function getPayment(paymentId: string) {
  const store = await readStore()
  return store.payments.find((item) => item.id === paymentId) ?? null
}

export async function updatePaymentStatus(paymentId: string, status: PaymentRecord["status"]) {
  const store = await readStore()
  const index = store.payments.findIndex((item) => item.id === paymentId)
  if (index === -1) return null
  const current = store.payments[index]
  const next = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
  }
  store.payments[index] = next
  await writeStore(store)
  return next
}

export async function listPaymentsByUser(userId: string) {
  const store = await readStore()
  return store.payments.filter((item) => item.userId === userId)
}

export async function getLatestCompletedPayment(userId: string) {
  const payments = await listPaymentsByUser(userId)
  return payments.find((item) => item.status === "completed") ?? null
}
