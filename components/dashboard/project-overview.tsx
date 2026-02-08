import { Globe, BarChart3, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function ProjectOverview() {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-card-foreground">
              mornFullStack MVP v23
            </h2>
            <Badge className="bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30 hover:bg-[hsl(var(--success))]/15">
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))] inline-block" />
              Live
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              mornhub.app
            </span>
            <span>Last updated 2h ago</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90">
            Generate New App
          </Button>
          <Button variant="outline" size="sm" className="text-foreground border-border bg-transparent">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Analytics
          </Button>
          <Button variant="outline" size="sm" className="text-foreground border-border bg-transparent">
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit
          </Button>
        </div>
      </div>
    </section>
  )
}
