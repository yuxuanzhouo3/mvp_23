"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"

type RightPanelContextValue = {
  collapsed: boolean
  setCollapsed: (value: boolean) => void
}

const RightPanelContext = createContext<RightPanelContextValue | null>(null)

export function RightPanelProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAppDetail = pathname?.startsWith("/apps/") ?? false
  const [collapsed, setCollapsed] = useState(isAppDetail)

  useEffect(() => {
    setCollapsed(pathname?.startsWith("/apps/") ?? false)
  }, [pathname])

  return (
    <RightPanelContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </RightPanelContext.Provider>
  )
}

export function useRightPanel() {
  const ctx = useContext(RightPanelContext)
  if (!ctx) throw new Error("useRightPanel must be used within RightPanelProvider")
  return ctx
}
