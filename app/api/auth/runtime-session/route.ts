import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getCurrentSession, setCurrentSession } from "@/lib/auth"
import { resolveAuthRuntimeConfig } from "@/lib/auth-runtime"
import { getLatestCompletedPayment } from "@/lib/payment-store"
import { getPlanDefinition } from "@/lib/plan-catalog"

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
