"use client"

import { useParams } from "next/navigation"
import { Globe, Pencil, ExternalLink, Share2, Copy, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const appNames: Record<string, string> = {
  "kanban-ai": "Kanban AI",
  "social-bookclub": "Social Bookclub",
  "invoice-tracker": "Invoice Tracker",
  "fitness-log": "Fitness Log",
  "recipe-finder": "Recipe Finder",
}

export function AppOverviewPage() {
  const params = useParams()
  const appId = params.id as string
  const appName = appNames[appId] || appId

  return (
    <div className="space-y-6">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <div className="rounded-lg border border-border bg-card p-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-xl font-semibold">{appName}</h1>
                  <Badge className="bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]">
                    Live
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your personal app. Created from a prompt.
                </p>
                <p className="text-xs text-muted-foreground mt-1">Created 3 hours ago</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Open App
                </Button>
                <Button size="sm">
                  <Share2 className="h-4 w-4 mr-1.5" />
                  Share App
                </Button>
              </div>
            </div>

            <div className="space-y-5 pt-4 border-t border-border">
              <div>
                <h3 className="text-sm font-medium mb-1">App Visibility</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Control who can access your application
                </p>
                <div className="space-y-3">
                  <Select defaultValue="public">
                    <SelectTrigger className="max-w-[200px]">
                      <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="unlisted">Unlisted</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center space-x-2">
                    <Switch id="require-login" defaultChecked />
                    <Label htmlFor="require-login" className="text-sm">Require login to access</Label>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-1">Invite Users</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Grow your user base by inviting others
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Copy className="h-4 w-4 mr-1.5" />
                    Copy Link
                  </Button>
                  <Button size="sm">Send Invites</Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-1">Platform Badge</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  The &ldquo;Edit with mornFullStack&rdquo; badge is currently visible on your app.
                </p>
                <Button variant="outline" size="sm">
                  <EyeOff className="h-4 w-4 mr-1.5" />
                  Hide Badge
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-0">
          <div className="rounded-lg border border-border bg-card p-8 min-h-[400px] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">App preview will load here</p>
              <Button variant="outline" size="sm" className="mt-4">
                Open in new tab
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
