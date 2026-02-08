import { PenLine, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const posts = [
  { title: "From One Word to Full-Stack", date: "Feb 2025", excerpt: "How mornFullStack turns prompts into production apps." },
  { title: "Building MVPs in 30 Seconds", date: "Jan 2025", excerpt: "A guide to rapid prototyping with AI." },
]

export default function BlogPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Blog</h1>
        <p className="text-muted-foreground mt-1">
          Updates, tutorials, and insights from the mornFullStack team.
        </p>
      </div>

      <div className="grid gap-4">
        {posts.map((post) => (
          <Card key={post.title} className="hover:border-primary/50 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-medium">{post.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{post.date}</p>
                  <p className="text-sm text-muted-foreground mt-2">{post.excerpt}</p>
                </div>
                <Button variant="ghost" size="icon" asChild>
                  <a href="#" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" asChild>
        <a href="https://blog.mornhub.app" target="_blank" rel="noopener noreferrer">
          <PenLine className="h-4 w-4 mr-2" />
          Visit Blog
        </a>
      </Button>
    </div>
  )
}
