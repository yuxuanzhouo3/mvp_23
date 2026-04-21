import type { ProviderCreateResult, PaymentCreateContext } from "@/lib/payment/providers/types"
import { formatAlipayTimestamp, normalizePemKey, signRsaSha256 } from "@/lib/payment/providers/utils"

function buildSignContent(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .filter((key) => key !== "sign" && params[key] !== undefined && params[key] !== "")
    .map((key) => `${key}=${params[key]}`)
    .join("&")
}

export async function createAlipayPayment(context: PaymentCreateContext): Promise<ProviderCreateResult> {
  const appId = String(process.env.ALIPAY_APP_ID ?? "").trim()
  const rawPrivateKey = String(process.env.ALIPAY_PRIVATE_KEY ?? "").trim()
  const sandboxEnabled = ["1", "true", "yes", "on"].includes(String(process.env.ALIPAY_SANDBOX ?? "").trim().toLowerCase())
  const gateway = String(
    process.env.ALIPAY_GATEWAY ??
      (sandboxEnabled ? "https://openapi-sandbox.dl.alipaydev.com/gateway.do" : "https://openapi.alipay.com/gateway.do")
  ).trim()
  if (!appId || !rawPrivateKey) {
    return {
      provider: "alipay",
      redirectUrl: `/payment/alipay?paymentId=${encodeURIComponent(context.paymentId)}&sandbox=1`,
      fallbackHosted: true,
    }
  }

  const privateKey = normalizePemKey(rawPrivateKey)
  const returnUrl = `${context.origin}/payment/success?paymentId=${encodeURIComponent(context.paymentId)}`
  const notifyUrl = `${context.origin}/api/payment/webhook/alipay`
  const params: Record<string, string> = {
    app_id: appId,
    method: "alipay.trade.page.pay",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: formatAlipayTimestamp(),
    version: "1.0",
    return_url: returnUrl,
    notify_url: notifyUrl,
    biz_content: JSON.stringify({
      out_trade_no: context.paymentId,
      product_code: "FAST_INSTANT_TRADE_PAY",
      total_amount: String(context.amountLabel).replace(/[^\d.]/g, ""),
      subject: context.planName,
    }),
  }

  const signContent = buildSignContent(params)
  params.sign = signRsaSha256(signContent, privateKey)

  const redirectUrl = `${gateway.replace(/\/+$/, "")}?${new URLSearchParams(params).toString()}`
  return {
    provider: "alipay",
    redirectUrl,
    fallbackHosted: false,
  }
}
