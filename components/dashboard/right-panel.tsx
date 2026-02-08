import { BookOpen, MessageSquare, CalendarClock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const steps = [
  { step: 1, label: "Generate your first app" },
  { step: 2, label: "Customize the code" },
  { step: 3, label: "Deploy to production" },
  { step: 4, label: "Share with your team" },
]

const helpLinks = [
  { label: "Documentation", icon: BookOpen },
  { label: "Discord Community", icon: MessageSquare },
  { label: "Schedule a demo", icon: CalendarClock },
]

export function RightPanel() {
  return (
    <aside className="hidden xl:flex flex-col w-72 border-l border-border bg-card/50 h-screen sticky top-0 overflow-y-auto">
      <div className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Getting Started
        </h3>

        <ol className="flex flex-col gap-3">
          {steps.map((item) => (
            <li key={item.step} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] text-xs font-semibold">
                {item.step}
              </span>
              <span className="text-sm text-muted-foreground leading-6">
                {item.label}
              </span>
            </li>
          ))}
        </ol>

        <Button
          size="sm"
          className="w-full mt-5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
        >
          Take Tour
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>

      <Separator />

      <div className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Need Help?
        </h3>

        <ul className="flex flex-col gap-1" role="list">
          {helpLinks.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Separator />

      <div className="p-5">
        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <p className="text-sm font-medium text-foreground mb-1.5">
            Ready to create a template?
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Before you can turn this application into a template, it needs to be live. Click Publish in the top right corner to deploy, then return here to set it up.
          </p>
        </div>
      </div>
    </aside>
  )
}
