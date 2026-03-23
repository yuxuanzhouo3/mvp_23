"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar"
import { TopBar } from "@/components/dashboard/top-bar"
import { RightPanel } from "@/components/dashboard/right-panel"
import { RightPanelProvider, useRightPanel } from "@/components/dashboard/right-panel-context"
import { AiCodePanel } from "@/components/dashboard/ai-code-panel"
import { cn } from "@/lib/utils"

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { collapsed } = useRightPanel()
  const isAppDetail = pathname?.startsWith("/apps/") ?? false
  const isWorkspaceRoot = /^\/apps\/[^/]+$/.test(pathname ?? "")
  const isHome = pathname === "/"
  const showAiPanel = collapsed && isAppDetail && !isWorkspaceRoot

  return (
    <div className="flex flex-1">
      <main
        className={cn(
          "flex min-w-0 flex-1 overflow-x-hidden",
          isHome ? "px-0 pb-0 pt-0" : "p-4 lg:p-6"
        )}
      >
        <div className={cn("flex w-full min-w-0 flex-1 flex-col", isHome ? "gap-0" : "gap-5")}>{children}</div>
        {showAiPanel && <AiCodePanel />}
      </main>
      {!isHome && <RightPanel />}
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("mornstack:sidebar-collapsed") : null
    if (stored === "0") {
      setSidebarCollapsed(false)
      return
    }
    setSidebarCollapsed(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("mornstack:sidebar-collapsed", sidebarCollapsed ? "1" : "0")
  }, [sidebarCollapsed])

  return (
    <RightPanelProvider>
      <div className="flex min-h-screen">
        <SidebarNav collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((value) => !value)} />
        <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex flex-1 flex-col min-w-0">
          <TopBar onMenuToggle={() => setSidebarOpen(true)} />
          <DashboardContent>{children}</DashboardContent>
        </div>
      </div>
    </RightPanelProvider>
  )
}
