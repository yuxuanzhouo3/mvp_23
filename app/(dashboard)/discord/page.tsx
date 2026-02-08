import { MessageSquare, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function DiscordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Discord Community</h1>
        <p className="text-muted-foreground mt-1">
          Join our community for support, updates, and discussions.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center py-8">
            <div className="h-16 w-16 rounded-full bg-[#5865F2]/20 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-[#5865F2]" />
            </div>
            <div>
              <h2 className="font-medium text-lg">Join mornFullStack on Discord</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Connect with developers, get help, share your apps, and stay updated.
              </p>
            </div>
            <Button asChild>
              <a href="https://discord.gg/mornfullstack" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Discord
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
