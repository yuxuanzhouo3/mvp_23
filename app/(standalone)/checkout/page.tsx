import { Suspense } from "react"
import CheckoutPageClient from "@/components/standalone/checkout-page-client"

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading checkout...</div>}>
      <CheckoutPageClient />
    </Suspense>
  )
}
