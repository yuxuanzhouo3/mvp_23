import type { ProviderCreateResult, PaymentCreateContext } from "@/lib/payment/providers/types"

export async function createHostedPayment(context: PaymentCreateContext): Promise<ProviderCreateResult> {
  return {
    provider: context.provider,
    redirectUrl: `/payment/hosted?paymentId=${encodeURIComponent(context.paymentId)}&provider=${context.provider}`,
    fallbackHosted: true,
  }
}
