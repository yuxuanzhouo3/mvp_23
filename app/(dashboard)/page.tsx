import { Suspense } from "react"
import { ProjectOverview, ProjectOverviewDetails } from "@/components/dashboard/project-overview"
import { RecentGenerations } from "@/components/dashboard/recent-generations"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { TerminalDemo } from "@/components/dashboard/terminal-demo"
import { AiInputPanel } from "@/components/dashboard/ai-input-panel"
import { PlanCapabilityPanel } from "@/components/dashboard/plan-capability-panel"

function DashboardPageContent() {
  return (
    <>
      <div id="tour-project" className="scroll-mt-4">
        <ProjectOverview>
          <div id="tour-actions">
            <QuickActions />
          </div>
        </ProjectOverview>
      </div>
      <div id="tour-generate" className="scroll-mt-4">
        <AiInputPanel />
      </div>
      <PlanCapabilityPanel />
      <div id="tour-terminal" className="scroll-mt-4">
        <TerminalDemo />
      </div>
      <div id="tour-details" className="scroll-mt-4">
        <ProjectOverviewDetails />
      </div>
      <div id="tour-generations" className="scroll-mt-4">
        <RecentGenerations />
      </div>
    </>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading dashboard...</div>}>
      <DashboardPageContent />
    </Suspense>
  )
}
