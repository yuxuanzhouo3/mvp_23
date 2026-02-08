import { BookOpen, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const examples = [
  { name: "Kanban Board", prompt: "Task manager with kanban", link: "#" },
  { name: "Social Feed", prompt: "Instagram for pet owners", link: "#" },
  { name: "API Dashboard", prompt: "API analytics platform", link: "#" },
  { name: "Feedback Widget", prompt: "Customer feedback widget", link: "#" },
]

export default function ExamplesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Examples</h1>
        <p className="text-muted-foreground mt-1">
          Example projects and prompts to get you started.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {examples.map((ex) => (
          <Card key={ex.name} className="hover:border-primary/50 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium">{ex.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    &ldquo;{ex.prompt}&rdquo;
                  </p>
                </div>
                <Button variant="ghost" size="icon">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" className="mt-4 w-full">
                <BookOpen className="h-4 w-4 mr-2" />
                Try Example
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
