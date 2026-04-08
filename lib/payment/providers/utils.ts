import crypto from "crypto"

function tryDecodeBase64Pem(value: string) {
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8").trim()
    if (/-----BEGIN [A-Z ]+-----/.test(decoded)) {
      return decoded
    }
  } catch {}
  return ""
}

export function normalizePemKey(raw: string) {
  const originalValue = String(raw ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .trim()
  if (!originalValue) return ""

  const value = /-----BEGIN [A-Z ]+-----/.test(originalValue) ? originalValue : tryDecodeBase64Pem(originalValue) || originalValue
  const headerMatch = value.match(/-----BEGIN ([A-Z ]+)-----/)
  const keyType = headerMatch?.[1]?.trim() || "PRIVATE KEY"

  const normalizedBody = value
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "")
    .trim()

  if (!normalizedBody) return value

  const wrappedBody = normalizedBody.match(/.{1,64}/g)?.join("\n") || normalizedBody
  return `-----BEGIN ${keyType}-----\n${wrappedBody}\n-----END ${keyType}-----`
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
