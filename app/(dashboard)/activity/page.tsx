import { Activity, Zap, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const activities = [
  { id: "1", type: "generate", msg: "Generated kanban-ai", time: "2h ago", icon: Zap },
  { id: "2", type: "deploy", msg: "Deployed social-bookclub to production", time: "3h ago", icon: CheckCircle },
  { id: "3", type: "build", msg: "Building invoice-tracker", time: "30m ago", icon: Loader2 },
  { id: "4", type: "error", msg: "recipe-finder build failed", time: "1d ago", icon: AlertCircle },
  { id: "5", type: "generate", msg: "Generated fitness-log", time: "1d ago", icon: Zap },
]

export default function ActivityLogPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Activity Log</h1>
        <p className="text-muted-foreground mt-1">
          Recent activity across your workspace.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {activities.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors"
              >
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.msg}</p>
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
