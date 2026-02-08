"use client"

import { useState } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar"
import { TopBar } from "@/components/dashboard/top-bar"
import { RightPanel } from "@/components/dashboard/right-panel"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      <SidebarNav />
      <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col min-w-0">
        <TopBar onMenuToggle={() => setSidebarOpen(true)} />

        <div className="flex flex-1">
          <main className="flex-1 min-w-0 p-4 lg:p-6">
            <div className="flex flex-col gap-5 max-w-4xl">{children}</div>
          </main>
          <RightPanel />
        </div>
      </div>
    </div>
  )
}
