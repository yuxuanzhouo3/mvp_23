import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getCurrentSession, setCurrentSession } from "@/lib/auth"
import { resolveAuthRuntimeConfig } from "@/lib/auth-runtime"
import { isEmailSmtpConfigured } from "@/lib/email-auth"
import { getLatestCompletedPayment } from "@/lib/payment-store"
import { resolvePaymentAdapterConfig } from "@/lib/payment-adapter"
import { getPlanDefinition } from "@/lib/plan-catalog"
import { getTencentSmsConfig } from "@/lib/tencent-sms"

export const runtime = "nodejs"

async function resolveRuntimeSession() {
  const current = await getCurrentSession()
  if (current) {
    return current
  }

  const nextAuthSession = await auth()
  const user = nextAuthSession?.user
  if (!user?.email) {
    return null
  }

  const bridgedUser = {
    id: String(user.id ?? user.email),
    email: user.email,
    name: String(user.name ?? user.email),
    region: "intl" as const,
  }

  await setCurrentSession(bridgedUser)

  return {
    session: {
      token: "bridged-nextauth-session",
      userId: bridgedUser.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    },
    user: bridgedUser,
  }
}

export async function GET() {
  const authRuntime = resolveAuthRuntimeConfig()
  const current = await resolveRuntimeSession()
  const payment = resolvePaymentAdapterConfig()
  const tencentSms = getTencentSmsConfig()
  const effectiveReadiness = {
    cn: {
      authMode: authRuntime.cnMode,
      phoneOtp: {
        configured: authRuntime.phoneOtpConfigured,
        path: authRuntime.phoneOtpConfigured ? "tencent_sms" : "sandbox",
        provider: authRuntime.phoneOtpConfigured ? "tencent-sms" : "sandbox",
        region: tencentSms.region,
      },
      emailVerification: {
        enabled: authRuntime.cnEmailPasswordEnabled,
        smtpConfigured: isEmailSmtpConfigured(),
        sendPath: isEmailSmtpConfigured() ? "smtp" : "not_configured",
      },
      wechatLogin: {
        configured: authRuntime.wechatConfigured,
        modeLive: authRuntime.cnMode === "wechat" && authRuntime.wechatConfigured,
      },
      payment: {
        wechatPayConfigured: payment.wechatConfigured,
        wechatPayWebhookVerificationConfigured: payment.wechatWebhookVerificationConfigured,
        alipayConfigured: payment.alipayConfigured,
      },
    },
  }

  if (!current) {
    return NextResponse.json({
      authenticated: false,
      authRuntime,
      effectiveReadiness,
      subscription: {
        tier: "free",
        plan: getPlanDefinition("free"),
      },
    })
  }

  const latestCompletedPayment = await getLatestCompletedPayment(current.user.id)
  const tier = latestCompletedPayment?.planId ?? "free"
  const plan = getPlanDefinition(tier)

  return NextResponse.json({
    authenticated: true,
    authRuntime,
    effectiveReadiness,
    user: {
      id: current.user.id,
      email: current.user.email,
      name: current.user.name,
      region: current.user.region,
    },
    subscription: {
      tier: plan.id,
      plan,
      latestPaymentId: latestCompletedPayment?.id ?? null,
    },
  })
}
