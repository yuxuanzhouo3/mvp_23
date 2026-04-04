import { Suspense } from "react"
import PaymentWechatPageClient from "@/components/standalone/payment-wechat-page-client"

export default function WechatPaymentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading WeChat payment...</div>}>
      <PaymentWechatPageClient />
    </Suspense>
  )
}
