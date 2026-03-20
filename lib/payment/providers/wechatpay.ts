import type { ProviderCreateResult, PaymentCreateContext } from "@/lib/payment/providers/types"
import { normalizePemKey, randomNonce, signRsaSha256 } from "@/lib/payment/providers/utils"

function buildWechatAuthorization(args: {
  mchid: string
  serialNo: string
  privateKey: string
  nonce: string
  timestamp: string
  method: string
  path: string
  body: string
}) {
  const message = [args.method, args.path, args.timestamp, args.nonce, args.body, ""].join("\n")
  const signature = signRsaSha256(message, args.privateKey)
  return `WECHATPAY2-SHA256-RSA2048 mchid="${args.mchid}",nonce_str="${args.nonce}",signature="${signature}",timestamp="${args.timestamp}",serial_no="${args.serialNo}"`
}

export async function createWechatPayPayment(context: PaymentCreateContext): Promise<ProviderCreateResult> {
  const mchid = String(process.env.WECHAT_PAY_MCH_ID ?? "").trim()
  const serialNo = String(process.env.WECHAT_PAY_SERIAL_NO ?? "").trim()
  const apiV3Key = String(process.env.WECHAT_PAY_API_V3_KEY ?? "").trim()
  const appId = String(process.env.WECHAT_PAY_APP_ID ?? "").trim()
  const rawPrivateKey = String(process.env.WECHAT_PAY_PRIVATE_KEY ?? "").trim()
  if (!mchid || !serialNo || !apiV3Key || !appId || !rawPrivateKey) {
    throw new Error("Missing WeChat Pay config")
  }

  const privateKey = normalizePemKey(rawPrivateKey)
  const body = JSON.stringify({
    appid: appId,
    mchid,
    description: context.planName,
    out_trade_no: context.paymentId,
    notify_url: `${context.origin}/api/payment/webhook/wechat`,
    amount: {
      total: Math.round(Number(String(context.amountLabel).replace(/[^\d.]/g, "")) * 100),
      currency: "CNY",
    },
  })

  const path = "/v3/pay/transactions/native"
  const nonce = randomNonce(24)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const authorization = buildWechatAuthorization({
    mchid,
    serialNo,
    privateKey,
    nonce,
    timestamp,
    method: "POST",
    path,
    body,
  })

  const res = await fetch(`https://api.mch.weixin.qq.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authorization,
      "Wechatpay-Serial": serialNo,
      "User-Agent": "mornscience-wechatpay/1.0",
    },
    body,
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(String(json?.message ?? json?.detail ?? "WeChat Pay native order failed"))
  }

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
