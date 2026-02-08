"use client"

import { PenLine, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/lib/i18n"

const posts = [
  { titleKey: "blogPost1" as const, excerptKey: "blogPost1Excerpt" as const, date: "Feb 2025" },
  { titleKey: "blogPost2" as const, excerptKey: "blogPost2Excerpt" as const, date: "Jan 2025" },
]

export default function BlogPage() {
  const { t } = useLocale()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("blog")}</h1>
        <p className="text-muted-foreground mt-1">{t("blogDesc")}</p>
      </div>

      <div className="grid gap-4">
        {posts.map((post) => (
          <Card key={post.titleKey} className="hover:border-primary/50 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-medium">{t(post.titleKey)}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{post.date}</p>
                  <p className="text-sm text-muted-foreground mt-2">{t(post.excerptKey)}</p>
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
          {t("visitBlog")}
        </a>
      </Button>
    </div>
  )
}
