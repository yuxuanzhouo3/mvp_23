import { Suspense } from "react"
import PaymentHostedPageClient from "@/components/standalone/payment-hosted-page-client"

export default function HostedPaymentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading payment...</div>}>
      <PaymentHostedPageClient />
    </Suspense>
  )
}
