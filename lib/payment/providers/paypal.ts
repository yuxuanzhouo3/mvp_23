import type { ProviderCreateResult, PaymentCreateContext } from "@/lib/payment/providers/types"

export async function createPaypalPayment(_context: PaymentCreateContext): Promise<ProviderCreateResult> {
  throw new Error("PayPal adapter is not wired yet")
}
