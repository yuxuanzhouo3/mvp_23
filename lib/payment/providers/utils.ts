import crypto from "crypto"

export function normalizePemKey(raw: string) {
  const value = String(raw ?? "").trim()
  if (!value) return ""
  if (value.includes("BEGIN")) return value
  const normalized = value.replace(/\\n/g, "\n")
  if (normalized.includes("BEGIN")) return normalized
  return `-----BEGIN PRIVATE KEY-----\n${normalized}\n-----END PRIVATE KEY-----`
}

export function formatAlipayTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function signRsaSha256(content: string, privateKey: string) {
  const signer = crypto.createSign("RSA-SHA256")
  signer.update(content, "utf8")
  signer.end()
  return signer.sign(privateKey, "base64")
}

export function randomNonce(length = 32) {
  return crypto.randomBytes(length).toString("hex").slice(0, length)
}
