"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar"
import { TopBar } from "@/components/dashboard/top-bar"
import { RightPanel } from "@/components/dashboard/right-panel"
import { RightPanelProvider, useRightPanel } from "@/components/dashboard/right-panel-context"
import { AiCodePanel } from "@/components/dashboard/ai-code-panel"

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { collapsed } = useRightPanel()
  const isAppDetail = pathname?.startsWith("/apps/") ?? false
  const showAiPanel = collapsed && isAppDetail

  return (
    <div className="flex flex-1">
      <main className="flex-1 min-w-0 p-4 lg:p-6 flex">
        <div className="flex flex-col gap-5 max-w-4xl flex-1 min-w-0">{children}</div>
        {showAiPanel && <AiCodePanel />}
      </main>
      <RightPanel />
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <RightPanelProvider>
      <div className="flex min-h-screen">
        <SidebarNav />
        <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex flex-1 flex-col min-w-0">
          <TopBar onMenuToggle={() => setSidebarOpen(true)} />
          <DashboardContent>{children}</DashboardContent>
        </div>
      </div>
    </RightPanelProvider>
  )
}
