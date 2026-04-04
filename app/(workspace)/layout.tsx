import { ProtectedRouteGate } from "@/components/auth/protected-route-gate"

export default function WorkspaceRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ProtectedRouteGate enabled>{children}</ProtectedRouteGate>
}
