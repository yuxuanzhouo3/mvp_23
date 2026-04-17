import crypto from "crypto"

const SMS_ENDPOINT = "sms.tencentcloudapi.com"
const SMS_SERVICE = "sms"
const SMS_VERSION = "2021-01-11"

function readEnv(name: string) {
  return String(process.env[name] ?? "").trim()
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex")
}

function hmac(key: crypto.BinaryLike, input: string) {
  return crypto.createHmac("sha256", key).update(input, "utf8").digest()
}

function hmacHex(key: crypto.BinaryLike, input: string) {
  return crypto.createHmac("sha256", key).update(input, "utf8").digest("hex")
}

function getDate(timestamp: number) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

function normalizeMainlandPhone(phone: string) {
  const digits = String(phone ?? "").replace(/[^\d]/g, "")
  if (!/^1\d{10}$/.test(digits)) return ""
  return `+86${digits}`
}

export function getTencentSmsConfig() {
  const appId = readEnv("TENCENT_SMS_APP_ID")
  const signName = readEnv("TENCENT_SMS_SIGN_NAME")
  const templateId = readEnv("TENCENT_SMS_TEMPLATE_ID")
  const secretId = readEnv("TENCENT_SMS_SECRET_ID")
  const secretKey = readEnv("TENCENT_SMS_SECRET_KEY")
  const region = readEnv("TENCENT_SMS_REGION") || "ap-guangzhou"
  return {
    appId,
    signName,
    templateId,
    secretId,
    secretKey,
    region,
    configured: Boolean(appId && signName && templateId && secretId && secretKey),
  }
}

export type TencentSmsSendResult = {
  ok: boolean
  requestId?: string
  providerCode?: string
  providerMessage?: string
}

export async function sendTencentSmsOtp(input: { phone: string; code: string }): Promise<TencentSmsSendResult> {
  const config = getTencentSmsConfig()
  if (!config.configured) {
    return { ok: false, providerCode: "NOT_CONFIGURED", providerMessage: "Tencent SMS credentials are not configured." }
  }

  const phoneNumber = normalizeMainlandPhone(input.phone)
  if (!phoneNumber) {
    return { ok: false, providerCode: "INVALID_PHONE", providerMessage: "Invalid mainland China phone number." }
  }

  const payload = JSON.stringify({
    PhoneNumberSet: [phoneNumber],
    SmsSdkAppId: config.appId,
    SignName: config.signName,
    TemplateId: config.templateId,
    TemplateParamSet: [input.code],
  })

  const timestamp = Math.floor(Date.now() / 1000)
  const date = getDate(timestamp)
  const action = "SendSms"
  const contentType = "application/json; charset=utf-8"
  const payloadHash = sha256(payload)
  const canonicalHeaders = `content-type:${contentType}\nhost:${SMS_ENDPOINT}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = "content-type;host;x-tc-action"
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, payloadHash].join("\n")
  const credentialScope = `${date}/${SMS_SERVICE}/tc3_request`
  const stringToSign = ["TC3-HMAC-SHA256", String(timestamp), credentialScope, sha256(canonicalRequest)].join("\n")
  const secretDate = hmac(`TC3${config.secretKey}`, date)
  const secretService = hmac(secretDate, SMS_SERVICE)
  const secretSigning = hmac(secretService, "tc3_request")
  const signature = hmacHex(secretSigning, stringToSign)
  const authorization = `TC3-HMAC-SHA256 Credential=${config.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const res = await fetch(`https://${SMS_ENDPOINT}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": contentType,
      Host: SMS_ENDPOINT,
      "X-TC-Action": action,
      "X-TC-Version": SMS_VERSION,
      "X-TC-Timestamp": String(timestamp),
      "X-TC-Region": config.region,
    },
    body: payload,
  })

  const data = (await res.json().catch(() => ({}))) as {
    Response?: {
      RequestId?: string
      Error?: { Code?: string; Message?: string }
      SendStatusSet?: Array<{ Code?: string; Message?: string }>
    }
  }
  const response = data.Response ?? {}
  const status = response.SendStatusSet?.[0]
  const providerCode = response.Error?.Code ?? status?.Code
  const providerMessage = response.Error?.Message ?? status?.Message
  const ok = res.ok && !response.Error && (!status || status.Code === "Ok")

  return {
    ok,
    requestId: response.RequestId,
    providerCode,
    providerMessage,
  }
}
