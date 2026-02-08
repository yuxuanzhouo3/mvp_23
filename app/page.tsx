"use client"

import { useState } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar"
import { TopBar } from "@/components/dashboard/top-bar"
import { ProjectOverview } from "@/components/dashboard/project-overview"
import { RecentGenerations } from "@/components/dashboard/recent-generations"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { TerminalDemo } from "@/components/dashboard/terminal-demo"
import { AiInputPanel } from "@/components/dashboard/ai-input-panel"
import { RightPanel } from "@/components/dashboard/right-panel"

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <SidebarNav />

      {/* Mobile sidebar */}
      <MobileSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar onMenuToggle={() => setSidebarOpen(true)} />

        <div className="flex flex-1">
          {/* Center content */}
          <main className="flex-1 min-w-0 p-4 lg:p-6">
            <div className="flex flex-col gap-5 max-w-4xl">
              <ProjectOverview />
              <RecentGenerations />
              <QuickActions />
              <TerminalDemo />
              <AiInputPanel />
            </div>
          </main>

          {/* Right panel */}
          <RightPanel />
        </div>
      </div>
    </div>
  )
}
