import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { createPayment } from "@/lib/payment-store"
import { createPaymentRedirect, pickPaymentProvider, resolvePaymentAdapterConfig } from "@/lib/payment-adapter"
import { getPlanDefinition, type BillingCycle, type PlanTier } from "@/lib/plan-catalog"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const current = await getCurrentSession()
  if (!current) {
    return NextResponse.json({ error: "Please sign in first" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const planId = String(body?.planId ?? "pro") as PlanTier
  const cycle = (body?.cycle === "monthly" ? "monthly" : "yearly") as BillingCycle
  const region = (body?.region === "cn" ? "cn" : "intl") as "cn" | "intl"
  const method = String(body?.method ?? (region === "cn" ? "alipay" : "stripe"))
  const plan = getPlanDefinition(planId)
  const adapterConfig = resolvePaymentAdapterConfig()
  const provider = pickPaymentProvider(region, method, adapterConfig)
  const origin = new URL(req.url).origin
  const planName = region === "cn" ? plan.nameCn : plan.nameEn
  const amountLabel =
    region === "cn"
      ? cycle === "monthly"
        ? plan.monthlyPriceCn
        : plan.yearlyPriceCn
      : cycle === "monthly"
        ? plan.monthlyPriceEn
        : plan.yearlyPriceEn

  const payment = await createPayment({
    userId: current.user.id,
    userEmail: current.user.email,
    region,
    planId,
    planName,
    amountLabel,
    method: provider,
  })

  const result = await createPaymentRedirect({
    origin,
    paymentId: payment.id,
    provider,
    region,
    planId,
    planName,
    amountLabel,
    method,
  })
  return NextResponse.json({
    ok: true,
    paymentId: payment.id,
    provider,
    fallbackHosted: result.fallbackHosted,
    redirectUrl: result.redirectUrl,
  })
}
