import { Suspense } from "react"
import LoginPageClient from "@/components/standalone/login-page-client"

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fcfbf7]" />}>
      <LoginPageClient />
    </Suspense>
  )
}
