import { ProjectOverview } from "@/components/dashboard/project-overview"
import { RecentGenerations } from "@/components/dashboard/recent-generations"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { TerminalDemo } from "@/components/dashboard/terminal-demo"
import { AiInputPanel } from "@/components/dashboard/ai-input-panel"

export default function DashboardPage() {
  return (
    <>
      <ProjectOverview />
      <RecentGenerations />
      <QuickActions />
      <TerminalDemo />
      <AiInputPanel />
    </>
  )
}
