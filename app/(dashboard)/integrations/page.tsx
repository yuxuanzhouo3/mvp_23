import { Puzzle, Github, Vercel, Slack } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const integrations = [
  { name: "GitHub", icon: Github, desc: "Connect repos, auto-deploy on push", connected: true },
  { name: "Vercel", icon: Vercel, desc: "Deploy generated apps", connected: true },
  { name: "Slack", icon: Slack, desc: "Build notifications", connected: false },
]

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Connect mornFullStack with your favorite tools.
        </p>
      </div>

      <div className="grid gap-4">
        {integrations.map((int) => (
          <Card key={int.name} className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                  <int.icon className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium">{int.name}</h3>
                  <p className="text-sm text-muted-foreground">{int.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {int.connected ? (
                  <Badge variant="secondary">Connected</Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
                <Button variant={int.connected ? "outline" : "default"} size="sm">
                  {int.connected ? "Configure" : "Connect"}
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}
