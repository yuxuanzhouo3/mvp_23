export type PaymentProvider = "stripe" | "paypal" | "alipay" | "wechatpay" | "hosted"

export type PaymentAdapterConfig = {
  stripeConfigured: boolean
  paypalConfigured: boolean
  alipayConfigured: boolean
  wechatConfigured: boolean
  wechatWebhookVerificationConfigured: boolean
}

export type PaymentCreateResult = {
  provider: PaymentProvider
  redirectUrl?: string
  qrCodeUrl?: string
  paymentFormHtml?: string
  fallbackHosted: boolean
}

import type { PaymentCreateContext } from "@/lib/payment/providers/types"
import { createHostedPayment } from "@/lib/payment/providers/hosted"
import { createStripePayment } from "@/lib/payment/providers/stripe"
import { createPaypalPayment } from "@/lib/payment/providers/paypal"
import { createAlipayPayment } from "@/lib/payment/providers/alipay"
import { createWechatPayPayment, isWechatPayConfigured, isWechatPayWebhookVerificationConfigured } from "@/lib/payment/providers/wechatpay"

function hasEnv(name: string) {
  return Boolean(String(process.env[name] ?? "").trim())
}

export function resolvePaymentAdapterConfig(): PaymentAdapterConfig {
  return {
    stripeConfigured: hasEnv("STRIPE_SECRET_KEY") && hasEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
    paypalConfigured: hasEnv("PAYPAL_CLIENT_ID") && hasEnv("PAYPAL_CLIENT_SECRET"),
    alipayConfigured:
      hasEnv("ALIPAY_APP_ID") &&
      hasEnv("ALIPAY_PRIVATE_KEY") &&
      hasEnv("ALIPAY_PUBLIC_KEY"),
    wechatConfigured: isWechatPayConfigured(),
    wechatWebhookVerificationConfigured: isWechatPayWebhookVerificationConfigured(),
  }
}

export function pickPaymentProvider(region: "cn" | "intl", requested: string, config: PaymentAdapterConfig): PaymentProvider {
  if (region === "cn") {
    if (requested === "wechatpay" && config.wechatConfigured) return "wechatpay"
    if (requested === "alipay" && config.alipayConfigured) return "alipay"
    return "hosted"
  }

  if (requested === "paypal" && config.paypalConfigured) return "paypal"
  if (requested === "stripe" && config.stripeConfigured) return "stripe"
  return "hosted"
}

export function createHostedFallback(paymentId: string, provider: PaymentProvider): PaymentCreateResult {
  return {
    provider,
    redirectUrl: `/payment/hosted?paymentId=${encodeURIComponent(paymentId)}&provider=${provider}`,
    fallbackHosted: provider === "hosted",
  }
}

export async function createPaymentRedirect(context: PaymentCreateContext): Promise<PaymentCreateResult> {
  try {
    if (context.provider === "stripe") {
      return await createStripePayment(context)
    }
    if (context.provider === "paypal") {
      return await createPaypalPayment(context)
    }
    if (context.provider === "alipay") {
      return await createAlipayPayment(context)
    }
    if (context.provider === "wechatpay") {
      return await createWechatPayPayment(context)
    }
  } catch {
    return createHostedPayment({ ...context, provider: context.provider })
  }

  return createHostedPayment({ ...context, provider: "hosted" })
}
