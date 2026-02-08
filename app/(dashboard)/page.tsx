import { ProjectOverview } from "@/components/dashboard/project-overview"
import { RecentGenerations } from "@/components/dashboard/recent-generations"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { TerminalDemo } from "@/components/dashboard/terminal-demo"
import { AiInputPanel } from "@/components/dashboard/ai-input-panel"

export default function DashboardPage() {
  return (
    <>
      <div id="tour-project" className="scroll-mt-4">
        <ProjectOverview />
      </div>
      <div id="tour-generations" className="scroll-mt-4">
        <RecentGenerations />
      </div>
      <div id="tour-actions" className="scroll-mt-4">
        <QuickActions />
      </div>
      <div id="tour-terminal" className="scroll-mt-4">
        <TerminalDemo />
      </div>
      <div id="tour-generate" className="scroll-mt-4">
        <AiInputPanel />
      </div>
    </>
  )
}
