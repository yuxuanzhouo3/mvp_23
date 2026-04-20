import { Suspense } from "react"
import PaymentAlipayPageClient from "@/components/standalone/payment-alipay-page-client"

export default function AlipayPaymentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading Alipay payment...</div>}>
      <PaymentAlipayPageClient />
    </Suspense>
  )
}
