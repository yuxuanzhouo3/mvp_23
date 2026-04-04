"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { User, Bell, Shield, CreditCard, ArrowUpRight, ReceiptText, CheckCircle2, Clock3, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/lib/i18n"

type PaymentRecord = {
  id: string
  planName: string
  amountLabel: string
  method: string
  status: "pending" | "completed" | "cancelled"
  createdAt: string
}

type SessionResp = {
  authenticated?: boolean
  user?: {
    name?: string
    email?: string
    region?: "cn" | "intl"
  }
}

export default function SettingsPage() {
  const { t, locale } = useLocale()
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loadingBilling, setLoadingBilling] = useState(true)
  const [profile, setProfile] = useState({ name: "Developer", email: "dev@mornscience.app" })

  useEffect(() => {
    fetch("/api/payment/list")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setPayments(Array.isArray(json?.payments) ? json.payments : []))
      .catch(() => setPayments([]))
      .finally(() => setLoadingBilling(false))
  }, [])

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: SessionResp | null) => {
        if (json?.authenticated && json.user) {
          setProfile({
            name: String(json.user.name ?? "").trim() || "Developer",
            email: String(json.user.email ?? "").trim() || "dev@mornscience.app",
          })
        }
      })
      .catch(() => null)
  }, [])

  const latestPayment = payments[0] ?? null
  const latestCompleted = payments.find((item) => item.status === "completed") ?? null
  const isCn = locale === "zh"

  const billingCopy = useMemo(
    () =>
      isCn
        ? {
            currentPlanLabel: "当前方案",
            noPlan: "未开通付费方案",
            billingDesc: "这里会显示最近订单、支付状态，以及升级入口。",
            latestOrder: "最近订单",
            orderHistory: "账单记录",
            noOrders: "暂时还没有订单记录，点击升级计划即可进入完整结账流程。",
            managePlan: "升级计划",
            openCheckout: "打开结账页",
            pending: "待支付",
            completed: "已支付",
            cancelled: "已取消",
            viewPending: "继续支付",
          }
        : {
            currentPlanLabel: "Current plan",
            noPlan: "No paid plan yet",
            billingDesc: "Your latest orders, payment status, and upgrade entry are shown here.",
            latestOrder: "Latest order",
            orderHistory: "Billing history",
            noOrders: "No orders yet. Use Upgrade Plan to enter the checkout flow.",
            managePlan: "Upgrade Plan",
            openCheckout: "Open checkout",
            pending: "Pending",
            completed: "Paid",
            cancelled: "Cancelled",
            viewPending: "Continue payment",
          },
    [isCn]
  )

  function renderStatus(status: PaymentRecord["status"]) {
    if (status === "completed") {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
          {billingCopy.completed}
        </Badge>
      )
    }
    if (status === "cancelled") {
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3.5 w-3.5" />
          {billingCopy.cancelled}
        </Badge>
      )
    }
    return (
      <Badge variant="secondary">
        <Clock3 className="mr-1 h-3.5 w-3.5" />
        {billingCopy.pending}
      </Badge>
    )
  }

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
            <Input id="name" value={profile.name} readOnly className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={profile.email} readOnly className="mt-1.5" />
          </div>
          <Button size="sm">{t("saveChanges")}</Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <div className="space-y-6">
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
              <Button variant="outline" size="sm">
                {t("changePassword")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/80">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <h2 className="font-medium">{t("billing")}</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-border bg-secondary/30 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{billingCopy.currentPlanLabel}</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xl font-semibold text-foreground">
                    {latestCompleted?.planName ?? billingCopy.noPlan}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{billingCopy.billingDesc}</p>
                </div>
                {latestCompleted ? renderStatus("completed") : <Badge variant="outline">{t("hobbyPlan")}</Badge>}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/checkout?source=settings&plan=pro">
                    {billingCopy.managePlan}
                    <ArrowUpRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/checkout?source=settings">{billingCopy.openCheckout}</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-foreground">{billingCopy.latestOrder}</div>
                {latestPayment ? renderStatus(latestPayment.status) : null}
              </div>
              {loadingBilling ? (
                <p className="mt-3 text-sm text-muted-foreground">{isCn ? "正在加载账单..." : "Loading billing..."}</p>
              ) : latestPayment ? (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{latestPayment.planName}</span>
                    <strong>{latestPayment.amountLabel}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{latestPayment.method}</span>
                    <span>{new Date(latestPayment.createdAt).toLocaleString(isCn ? "zh-CN" : "en-US")}</span>
                  </div>
                  {latestPayment.status === "pending" ? (
                    <Button variant="outline" size="sm" asChild className="mt-2">
                      <Link href={`/payment/hosted?paymentId=${encodeURIComponent(latestPayment.id)}`}>{billingCopy.viewPending}</Link>
                    </Button>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">{billingCopy.noOrders}</p>
              )}
            </div>

            <div className="rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <ReceiptText className="h-4 w-4" />
                {billingCopy.orderHistory}
              </div>
              <div className="mt-3 space-y-3">
                {payments.slice(0, 5).map((payment) => (
                  <div key={payment.id} className="rounded-xl border border-border/80 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{payment.planName}</div>
                        <div className="mt-1 text-xs text-muted-foreground break-all">{payment.id}</div>
                      </div>
                      {renderStatus(payment.status)}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                      <span>{payment.amountLabel}</span>
                      <span>{payment.method}</span>
                    </div>
                  </div>
                ))}
                {!loadingBilling && payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{billingCopy.noOrders}</p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
