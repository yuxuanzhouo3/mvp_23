import type { BillingCycle, PlanTier } from "@/lib/plan-catalog"
import type { ProviderCreateResult, PaymentCreateContext } from "@/lib/payment/providers/types"

type StripeCheckoutSession = {
  id?: string
  url?: string
  mode?: string
  status?: string
  payment_status?: string
  client_reference_id?: string | null
}

const STRIPE_PRICE_ENV_BY_PLAN: Record<PlanTier, Record<BillingCycle, string> | null> = {
  free: null,
  starter: {
    monthly: "STRIPE_PRICE_STARTER_MONTHLY",
    yearly: "STRIPE_PRICE_STARTER_YEARLY",
  },
  builder: {
    monthly: "STRIPE_PRICE_BUILDER_MONTHLY",
    yearly: "STRIPE_PRICE_BUILDER_YEARLY",
  },
  pro: {
    monthly: "STRIPE_PRICE_PRO_MONTHLY",
    yearly: "STRIPE_PRICE_PRO_YEARLY",
  },
  elite: {
    monthly: "STRIPE_PRICE_ELITE_MONTHLY",
    yearly: "STRIPE_PRICE_ELITE_YEARLY",
  },
}

function getStripeSecretKey() {
  const secretKey = String(process.env.STRIPE_SECRET_KEY ?? "").trim()
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY")
  }
  return secretKey
}

function resolveStripePriceId(planId: string, cycle: BillingCycle) {
  const planConfig = STRIPE_PRICE_ENV_BY_PLAN[planId as PlanTier]
  if (!planConfig) {
    throw new Error(`Stripe subscriptions are not supported for plan: ${planId}`)
  }
  const envName = planConfig[cycle]
  const priceId = String(process.env[envName] ?? "").trim()
  if (!priceId) {
    throw new Error(`Missing Stripe price env: ${envName}`)
  }
  return priceId
}

async function fetchStripeCheckoutSession(sessionId: string) {
  const secretKey = getStripeSecretKey()
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  })

  const json = (await res.json().catch(() => ({}))) as StripeCheckoutSession & {
    error?: { message?: string }
  }

  if (!res.ok) {
    throw new Error(String(json?.error?.message ?? "Stripe checkout session lookup failed"))
  }

  return json
}

export async function createStripePayment(context: PaymentCreateContext): Promise<ProviderCreateResult> {
  const secretKey = getStripeSecretKey()
  const priceId = resolveStripePriceId(context.planId, context.cycle)

  const params = new URLSearchParams()
  params.set("mode", "subscription")
  params.set("success_url", `${context.origin}/payment/success?paymentId=${encodeURIComponent(context.paymentId)}&session_id={CHECKOUT_SESSION_ID}`)
  params.set("cancel_url", `${context.origin}/payment/cancel?paymentId=${encodeURIComponent(context.paymentId)}`)
  params.set("client_reference_id", context.paymentId)
  params.set("line_items[0][quantity]", "1")
  params.set("line_items[0][price]", priceId)

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  const json = (await res.json().catch(() => ({}))) as StripeCheckoutSession & {
    error?: { message?: string }
  }
  if (!res.ok) {
    throw new Error(String(json?.error?.message ?? "Stripe checkout session failed"))
  }

  return {
    provider: "stripe",
    redirectUrl: String(json?.url ?? "").trim(),
    fallbackHosted: false,
  }
}

export async function verifyStripeCheckoutSession(sessionId: string, paymentId: string) {
  const session = await fetchStripeCheckoutSession(sessionId)
  return session.client_reference_id === paymentId && session.mode === "subscription" && session.status === "complete" && session.payment_status === "paid"
}
