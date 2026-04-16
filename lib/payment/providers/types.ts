import type { BillingCycle } from "@/lib/plan-catalog"
import type { PaymentProvider } from "@/lib/payment-adapter"

export type PaymentCreateContext = {
  origin: string
  paymentId: string
  provider: PaymentProvider
  region: "cn" | "intl"
  planId: string
  planName: string
  amountLabel: string
  method: string
  cycle: BillingCycle
}

export type ProviderCreateResult = {
  provider: PaymentProvider
  redirectUrl?: string
  qrCodeUrl?: string
  paymentFormHtml?: string
  fallbackHosted: boolean
}
