import { Suspense } from "react"
import PaymentSuccessPageClient from "@/components/standalone/payment-success-page-client"

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading payment result...</div>}>
      <PaymentSuccessPageClient />
    </Suspense>
  )
}
