import crypto from "crypto"
import type { ProviderCreateResult, PaymentCreateContext } from "@/lib/payment/providers/types"
import { normalizePemKey, randomNonce, signRsaSha256 } from "@/lib/payment/providers/utils"

type WechatPayConfig = {
  mchid: string
  serialNo: string
  apiV3Key: string
  appId: string
  privateKey: string
  platformPublicKey: string
  platformSerialNo: string
  apiBaseUrl: string
}

type WechatTransaction = {
  transaction_id?: string
  out_trade_no?: string
  trade_state?: string
  trade_state_desc?: string
  success_time?: string
  amount?: {
    total?: number
    payer_total?: number
    currency?: string
    payer_currency?: string
  }
}

type WechatNotificationResource = {
  algorithm?: string
  ciphertext?: string
  associated_data?: string
  nonce?: string
  original_type?: string
}

function normalizeWechatPublicKey(raw: string) {
  const value = String(raw ?? "").trim()
  if (!value) return ""
  const normalized = value.replace(/\\n/g, "\n")
  if (normalized.includes("BEGIN PUBLIC KEY") || normalized.includes("BEGIN CERTIFICATE")) {
    return normalized
  }
  return `-----BEGIN PUBLIC KEY-----\n${normalized}\n-----END PUBLIC KEY-----`
}

export function resolveWechatPayConfig(): WechatPayConfig {
  const mchid = String(process.env.WECHAT_PAY_MCH_ID ?? "").trim()
  const serialNo = String(process.env.WECHAT_PAY_SERIAL_NO ?? "").trim()
  const apiV3Key = String(process.env.WECHAT_PAY_API_V3_KEY ?? "").trim()
  const appId = String(process.env.WECHAT_PAY_APP_ID ?? "").trim()
  const rawPrivateKey = String(process.env.WECHAT_PAY_PRIVATE_KEY ?? "").trim()
  const rawPlatformPublicKey = String(process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY ?? process.env.WECHAT_PAY_PLATFORM_CERT ?? "").trim()
  const platformSerialNo = String(process.env.WECHAT_PAY_PLATFORM_SERIAL_NO ?? "").trim()
  const apiBaseUrl = String(process.env.WECHAT_PAY_API_BASE_URL ?? "https://api.mch.weixin.qq.com").trim().replace(/\/+$/, "")

  return {
    mchid,
    serialNo,
    apiV3Key,
    appId,
    privateKey: normalizePemKey(rawPrivateKey),
    platformPublicKey: normalizeWechatPublicKey(rawPlatformPublicKey),
    platformSerialNo,
    apiBaseUrl,
  }
}

export function isWechatPayConfigured() {
  const config = resolveWechatPayConfig()
  return Boolean(config.mchid && config.serialNo && config.apiV3Key && config.appId && config.privateKey)
}

export function isWechatPayWebhookVerificationConfigured() {
  const config = resolveWechatPayConfig()
  return Boolean(config.platformPublicKey)
}

function buildWechatAuthorization(args: {
  mchid: string
  serialNo: string
  privateKey: string
  nonce: string
  timestamp: string
  method: string
  canonicalPath: string
  body: string
}) {
  const message = [args.method.toUpperCase(), args.canonicalPath, args.timestamp, args.nonce, args.body, ""].join("\n")
  const signature = signRsaSha256(message, args.privateKey)
  return `WECHATPAY2-SHA256-RSA2048 mchid="${args.mchid}",nonce_str="${args.nonce}",signature="${signature}",timestamp="${args.timestamp}",serial_no="${args.serialNo}"`
}

async function requestWechatPay<T>(args: {
  method: "GET" | "POST"
  canonicalPath: string
  body?: Record<string, unknown> | null
}) {
  const config = resolveWechatPayConfig()
  if (!config.mchid || !config.serialNo || !config.apiV3Key || !config.appId || !config.privateKey) {
    throw new Error("Missing WeChat Pay config")
  }

  const body = args.body ? JSON.stringify(args.body) : ""
  const nonce = randomNonce(24)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const authorization = buildWechatAuthorization({
    mchid: config.mchid,
    serialNo: config.serialNo,
    privateKey: config.privateKey,
    nonce,
    timestamp,
    method: args.method,
    canonicalPath: args.canonicalPath,
    body,
  })

  const res = await fetch(`${config.apiBaseUrl}${args.canonicalPath}`, {
    method: args.method,
    headers: {
      Accept: "application/json",
      Authorization: authorization,
      "Content-Type": "application/json",
      "Wechatpay-Serial": config.serialNo,
      "User-Agent": "mornscience-wechatpay/1.0",
    },
    body: body || undefined,
  })

  const json = (await res.json().catch(() => ({}))) as T & { message?: string; detail?: string }
  if (!res.ok) {
    throw new Error(String(json?.message ?? json?.detail ?? "WeChat Pay request failed"))
  }
  return json
}

function decodeAmountToFen(label: string) {
  return Math.max(1, Math.round(Number(String(label).replace(/[^\d.]/g, "")) * 100))
}

export async function createWechatPayPayment(context: PaymentCreateContext): Promise<ProviderCreateResult> {
  const config = resolveWechatPayConfig()
  if (!config.mchid || !config.serialNo || !config.apiV3Key || !config.appId || !config.privateKey) {
    throw new Error("Missing WeChat Pay config")
  }

  const json = await requestWechatPay<{ code_url?: string }>({
    method: "POST",
    canonicalPath: "/v3/pay/transactions/native",
    body: {
      appid: config.appId,
      mchid: config.mchid,
      description: context.planName,
      out_trade_no: context.paymentId,
      notify_url: `${context.origin}/api/payment/webhook/wechat`,
      amount: {
        total: decodeAmountToFen(context.amountLabel),
        currency: "CNY",
      },
    },
  })

  const codeUrl = String(json?.code_url ?? "").trim()
  if (!codeUrl) {
    throw new Error("WeChat Pay did not return a code_url")
  }

  return {
    provider: "wechatpay",
    redirectUrl: `/payment/wechat?paymentId=${encodeURIComponent(context.paymentId)}&codeUrl=${encodeURIComponent(codeUrl)}`,
    qrCodeUrl: codeUrl,
    fallbackHosted: false,
  }
}

export async function queryWechatPayTransactionByOutTradeNo(paymentId: string) {
  const config = resolveWechatPayConfig()
  if (!config.mchid) {
    throw new Error("Missing WeChat Pay merchant id")
  }

  const canonicalPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(paymentId)}?mchid=${encodeURIComponent(config.mchid)}`
  const json = await requestWechatPay<WechatTransaction>({
    method: "GET",
    canonicalPath,
  })
  return json
}

export function mapWechatTradeStateToPaymentStatus(tradeState: string | undefined) {
  switch (String(tradeState ?? "").trim().toUpperCase()) {
    case "SUCCESS":
      return "completed" as const
    case "CLOSED":
    case "REVOKED":
    case "PAYERROR":
      return "cancelled" as const
    default:
      return "pending" as const
  }
}

export function verifyWechatPayNotificationSignature(args: {
  body: string
  timestamp: string
  nonce: string
  signature: string
  serial?: string
}) {
  const config = resolveWechatPayConfig()
  if (!config.platformPublicKey) {
    return { verified: false, skipped: true }
  }

  if (config.platformSerialNo && args.serial && config.platformSerialNo !== args.serial) {
    return { verified: false, skipped: false }
  }

  const message = `${args.timestamp}\n${args.nonce}\n${args.body}\n`
  const verifier = crypto.createVerify("RSA-SHA256")
  verifier.update(message, "utf8")
  verifier.end()
  const verified = verifier.verify(config.platformPublicKey, args.signature, "base64")
  return { verified, skipped: false }
}

export function decryptWechatPayNotificationResource(resource: WechatNotificationResource) {
  const config = resolveWechatPayConfig()
  const ciphertext = String(resource?.ciphertext ?? "").trim()
  const nonce = String(resource?.nonce ?? "").trim()
  const associatedData = String(resource?.associated_data ?? "")
  if (!config.apiV3Key || !ciphertext || !nonce) {
    throw new Error("Invalid WeChat Pay notification resource")
  }

  const key = Buffer.from(config.apiV3Key, "utf8")
  if (key.length !== 32) {
    throw new Error("WECHAT_PAY_API_V3_KEY must be 32 bytes")
  }

  const buffer = Buffer.from(ciphertext, "base64")
  const authTag = buffer.subarray(buffer.length - 16)
  const data = buffer.subarray(0, buffer.length - 16)
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "utf8"))
  if (associatedData) {
    decipher.setAAD(Buffer.from(associatedData, "utf8"))
  }
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")
  return JSON.parse(decrypted) as WechatTransaction
}
