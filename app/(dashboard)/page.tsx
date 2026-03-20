import { ProjectOverview, ProjectOverviewDetails } from "@/components/dashboard/project-overview"
import { RecentGenerations } from "@/components/dashboard/recent-generations"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { TerminalDemo } from "@/components/dashboard/terminal-demo"
import { AiInputPanel } from "@/components/dashboard/ai-input-panel"

export default function DashboardPage() {
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
