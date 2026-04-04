"use client"

import { ProtectedRouteGate } from "@/components/auth/protected-route-gate"

export default function PaymentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ProtectedRouteGate enabled>{children}</ProtectedRouteGate>
}
