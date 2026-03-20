import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { resolveAuthRuntimeConfig } from "@/lib/auth-runtime"
import { getLatestCompletedPayment } from "@/lib/payment-store"
import { getPlanDefinition } from "@/lib/plan-catalog"

export const runtime = "nodejs"

export async function GET() {
  const authRuntime = resolveAuthRuntimeConfig()
  const current = await getCurrentSession()
  if (!current) {
    return NextResponse.json({
      authenticated: false,
      authRuntime,
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
