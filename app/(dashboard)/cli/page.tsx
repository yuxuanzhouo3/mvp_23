import { Terminal, Copy } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const commands = [
  { cmd: "npx mornfullstack init", desc: "Initialize mornFullStack in your project" },
  { cmd: "npx mornfullstack generate \"<prompt>\"", desc: "Generate an app from a prompt" },
  { cmd: "npx mornfullstack deploy", desc: "Deploy the current project" },
  { cmd: "npx mornfullstack login", desc: "Authenticate with your account" },
]

export default function CliReferencePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">CLI Reference</h1>
        <p className="text-muted-foreground mt-1">
          Command-line interface for mornFullStack.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            <h2 className="font-medium">Installation</h2>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto">
            npm install -g mornfullstack-cli
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium">Commands</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {commands.map((item, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm text-muted-foreground">{item.desc}</p>
              <div className="flex items-center gap-2">
                <pre className="flex-1 rounded-lg bg-muted p-3 text-sm font-mono overflow-x-auto">
                  {item.cmd}
                </pre>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
