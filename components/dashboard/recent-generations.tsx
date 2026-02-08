import { Eye, Rocket, Share2, MoreHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const generations = [
  {
    name: "kanban-ai",
    prompt: "Kanban board with AI suggestions",
    status: "ready" as const,
    generatedAt: "2h ago",
  },
  {
    name: "social-bookclub",
    prompt: "Social network for book clubs",
    status: "ready" as const,
    generatedAt: "5h ago",
  },
  {
    name: "invoice-tracker",
    prompt: "Invoice management dashboard",
    status: "building" as const,
    generatedAt: "12h ago",
  },
  {
    name: "fitness-log",
    prompt: "Workout tracker with progress charts",
    status: "ready" as const,
    generatedAt: "1d ago",
  },
  {
    name: "recipe-finder",
    prompt: "Recipe search with dietary filters",
    status: "error" as const,
    generatedAt: "2d ago",
  },
]

const statusConfig = {
  ready: {
    label: "Ready",
    className: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30",
  },
  building: {
    label: "Building",
    className: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30",
  },
  error: {
    label: "Error",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
}

export function RecentGenerations() {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-5 pb-4">
        <h3 className="text-sm font-semibold text-card-foreground">
          Recent App Generations
        </h3>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs">
          View all
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground text-xs font-medium">App Name</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium hidden sm:table-cell">Prompt Used</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">Status</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium hidden md:table-cell">Generated</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {generations.map((gen) => {
              const status = statusConfig[gen.status]
              return (
                <TableRow key={gen.name} className="border-border hover:bg-accent/50">
                  <TableCell className="font-medium text-sm text-card-foreground">
                    {gen.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden sm:table-cell max-w-[200px] truncate">
                    {gen.prompt}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${status.className} hover:${status.className} text-xs`}
                    >
                      {gen.status === "building" && (
                        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning))] inline-block animate-pulse-dot" />
                      )}
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                    {gen.generatedAt}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        aria-label={`View ${gen.name}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                        aria-label={`Deploy ${gen.name}`}
                      >
                        <Rocket className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                        aria-label={`Share ${gen.name}`}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground sm:hidden"
                        aria-label={`More actions for ${gen.name}`}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
