"use client"

import { MessageSquare, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/lib/i18n"

export default function DiscordPage() {
  const { t } = useLocale()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("discordCommunity")}</h1>
        <p className="text-muted-foreground mt-1">{t("discordDesc")}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center py-8">
            <div className="h-16 w-16 rounded-full bg-[#5865F2]/20 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-[#5865F2]" />
            </div>
            <div>
              <h2 className="font-medium text-lg">{t("joinDiscord")}</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {t("discordCardDesc")}
              </p>
            </div>
            <Button asChild>
              <a href="https://discord.gg/mornfullstack" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                {t("openDiscord")}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
