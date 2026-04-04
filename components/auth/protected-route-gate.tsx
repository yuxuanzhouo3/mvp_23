"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

type SessionResp = {
  authenticated?: boolean
}

type ProtectedRouteGateProps = {
  enabled: boolean
  children: React.ReactNode
}

export function ProtectedRouteGate({ enabled, children }: ProtectedRouteGateProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [state, setState] = useState<"checking" | "allowed" | "redirecting">(enabled ? "checking" : "allowed")
  const search = searchParams?.toString() ?? ""

  const redirectTarget = useMemo(() => {
    return `${pathname || "/"}${search ? `?${search}` : ""}`
  }, [pathname, search])

  useEffect(() => {
    if (!enabled) {
      setState("allowed")
      return
    }

    let active = true
    setState("checking")

    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: SessionResp) => {
        if (!active) return
        if (json?.authenticated) {
          setState("allowed")
          return
        }
        setState("redirecting")
        router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`)
      })
      .catch(() => {
        if (!active) return
        setState("redirecting")
        router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`)
      })

    return () => {
      active = false
    }
  }, [enabled, redirectTarget, router])

  if (!enabled) {
    return <>{children}</>
  }

  if (state !== "allowed") {
    return <div className="min-h-screen bg-[#fcfbf7]" />
  }

  return <>{children}</>
}
