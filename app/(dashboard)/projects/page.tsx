import { FolderKanban, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const projects = [
  { id: "1", name: "mornFullStack MVP v23", status: "Live", apps: 5, updated: "2h ago" },
  { id: "2", name: "Book Club Social", status: "Draft", apps: 2, updated: "1d ago" },
  { id: "3", name: "Invoice Tracker", status: "Building", apps: 1, updated: "30m ago" },
]

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Projects</h1>
        <p className="text-muted-foreground mt-1">
          Manage all your mornFullStack projects and generated apps.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." className="pl-9" />
        </div>
        <Button className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90">
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      <div className="grid gap-4">
        {projects.map((project) => (
          <Card key={project.id} className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{project.name}</span>
              </div>
              <Badge
                variant={
                  project.status === "Live"
                    ? "default"
                    : project.status === "Building"
                    ? "secondary"
                    : "outline"
                }
              >
                {project.status}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>{project.apps} app(s)</span>
                <span>Updated {project.updated}</span>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm">
                  Open
                </Button>
                <Button variant="ghost" size="sm">
                  Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
