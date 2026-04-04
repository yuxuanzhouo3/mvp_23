import { Suspense } from "react"

import { ProtectedRouteGate } from "@/components/auth/protected-route-gate"

export default function PaymentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fcfbf7]" />}>
      <ProtectedRouteGate enabled>{children}</ProtectedRouteGate>
    </Suspense>
  )
}
