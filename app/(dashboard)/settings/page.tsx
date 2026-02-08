"use client"

import { User, Bell, Shield, CreditCard } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useLocale } from "@/lib/i18n"

export default function SettingsPage() {
  const { t } = useLocale()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("settings")}</h1>
        <p className="text-muted-foreground mt-1">{t("settingsDesc")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <h2 className="font-medium">{t("profile")}</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">{t("displayName")}</Label>
            <Input id="name" defaultValue="Developer" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue="dev@mornhub.app" className="mt-1.5" />
          </div>
          <Button size="sm">{t("saveChanges")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <h2 className="font-medium">{t("notificationsTitle")}</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t("buildNotifications")}</p>
              <p className="text-sm text-muted-foreground">{t("buildNotificationsDesc")}</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t("weeklyDigest")}</p>
              <p className="text-sm text-muted-foreground">{t("weeklyDigestDesc")}</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <h2 className="font-medium">{t("security")}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm">{t("changePassword")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <h2 className="font-medium">{t("billing")}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{t("hobbyPlan")}</p>
          <Button variant="outline" size="sm">{t("upgradePlan")}</Button>
        </CardContent>
      </Card>
    </div>
  )
}
