"use client"

import { createContext, useContext, useState, useEffect, useMemo } from "react"
import { usePathname } from "next/navigation"

type RightPanelContextValue = {
  collapsed: boolean
  isAutoCollapsed: boolean
  setCollapsed: (value: boolean) => void
  toggleCollapsed: () => void
}

const RightPanelContext = createContext<RightPanelContextValue | null>(null)

export function RightPanelProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAppDetail = pathname?.startsWith("/apps/") ?? false
  const isCheckoutFlow =
    pathname === "/checkout" ||
    pathname?.startsWith("/payment/") ||
    pathname === "/templates" ||
    pathname === "/"
  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null)
  const [autoCollapsed, setAutoCollapsed] = useState(isAppDetail)

  useEffect(() => {
    setManualCollapsed(null)
  }, [pathname])

  useEffect(() => {
    function computeAutoCollapsed() {
      if (typeof window === "undefined") return
      const width = window.innerWidth
      const shouldCollapse =
        isAppDetail ||
        (isCheckoutFlow && width < 1760) ||
        (!isCheckoutFlow && width < 1540)
      setAutoCollapsed(shouldCollapse)
    }

    computeAutoCollapsed()
    window.addEventListener("resize", computeAutoCollapsed)
    return () => window.removeEventListener("resize", computeAutoCollapsed)
  }, [isAppDetail, isCheckoutFlow])

  const collapsed = manualCollapsed ?? autoCollapsed
  const value = useMemo(
    () => ({
      collapsed,
      isAutoCollapsed: autoCollapsed,
      setCollapsed: (next: boolean) => setManualCollapsed(next),
      toggleCollapsed: () => setManualCollapsed((prev) => !(prev ?? autoCollapsed)),
    }),
    [autoCollapsed, collapsed]
  )

  return (
    <RightPanelContext.Provider value={value}>
      {children}
    </RightPanelContext.Provider>
  )
}

export function useRightPanel() {
  const ctx = useContext(RightPanelContext)
  if (!ctx) throw new Error("useRightPanel must be used within RightPanelProvider")
  return ctx
}
