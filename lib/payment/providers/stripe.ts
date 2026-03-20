import type { ProviderCreateResult, PaymentCreateContext } from "@/lib/payment/providers/types"

function parseAmountLabel(amountLabel: string) {
  const numeric = Number(String(amountLabel).replace(/[^0-9.]/g, ""))
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("Invalid Stripe amount")
  }
  return Math.round(numeric * 100)
}

export async function createStripePayment(context: PaymentCreateContext): Promise<ProviderCreateResult> {
  const secretKey = String(process.env.STRIPE_SECRET_KEY ?? "").trim()
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY")
  }

  const params = new URLSearchParams()
  params.set("mode", "payment")
  params.set("success_url", `${context.origin}/payment/success?paymentId=${encodeURIComponent(context.paymentId)}`)
  params.set("cancel_url", `${context.origin}/payment/cancel?paymentId=${encodeURIComponent(context.paymentId)}`)
  params.set("client_reference_id", context.paymentId)
  params.set("line_items[0][quantity]", "1")
  params.set("line_items[0][price_data][currency]", "usd")
  params.set("line_items[0][price_data][unit_amount]", String(parseAmountLabel(context.amountLabel)))
  params.set("line_items[0][price_data][product_data][name]", context.planName)

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(String(json?.error?.message ?? "Stripe checkout session failed"))
  }

  return {
    provider: "stripe",
    redirectUrl: String(json?.url ?? "").trim(),
    fallbackHosted: false,
  }
}
