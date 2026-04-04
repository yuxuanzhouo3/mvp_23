"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, CreditCard, QrCode, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/lib/i18n"
import { PAID_PLAN_IDS, PLAN_CATALOG, getPlanPriceLabel, type BillingCycle, type PlanTier } from "@/lib/plan-catalog"
import { getCurrentDomainRegion } from "@/lib/generation-preferences"
import { getRegionFromHostname } from "@/lib/region-routing"

type Region = "cn" | "intl"

type SessionResp = {
  authenticated?: boolean
  authRuntime?: {
    cnMode?: "demo" | "password" | "wechat"
    intlMode?: "demo" | "password" | "supabase"
    cnEmailPasswordEnabled?: boolean
    intlEmailPasswordEnabled?: boolean
    googleEnabled?: boolean
    facebookEnabled?: boolean
  }
  subscription?: {
    tier?: PlanTier
  }
}

function CheckoutPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { locale } = useLocale()
  const queryRegion = searchParams.get("region")
  const forcedRegion = queryRegion === "cn" || queryRegion === "intl" ? queryRegion : ""
  const [region, setRegion] = useState<Region>(forcedRegion || getCurrentDomainRegion())
  const isCn = region === "cn"
  const [planId, setPlanId] = useState<PlanTier>((searchParams.get("plan") as PlanTier) || "pro")
  const [cycle, setCycle] = useState<BillingCycle>("yearly")
  const [method, setMethod] = useState(isCn ? "alipay" : "stripe")
  const [authLoading, setAuthLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [providerHint, setProviderHint] = useState("")
  const [authMode, setAuthMode] = useState<"demo" | "password" | "supabase" | "wechat">("demo")
  const [subscriptionTier, setSubscriptionTier] = useState<PlanTier>("free")

  useEffect(() => {
    if (typeof window === "undefined") return
    if (forcedRegion) {
      setRegion(forcedRegion)
      return
    }
    setRegion(getRegionFromHostname(window.location.hostname))
  }, [forcedRegion])

  useEffect(() => {
    setMethod(isCn ? "alipay" : "stripe")
  }, [isCn])

  useEffect(() => {
    const incomingPlan = searchParams.get("plan") as PlanTier | null
    if (incomingPlan && PLAN_CATALOG[incomingPlan]) {
      setPlanId(incomingPlan)
    }
  }, [searchParams])

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((json: SessionResp) => {
        setAuthenticated(Boolean(json?.authenticated))
        setAuthMode((region === "cn" ? json?.authRuntime?.cnMode : json?.authRuntime?.intlMode) ?? "demo")
        const tier = json?.subscription?.tier
        if (tier && tier in PLAN_CATALOG) {
          setSubscriptionTier(tier)
        }
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setAuthLoading(false))
  }, [region])

  const paymentMethods = useMemo(
    () =>
      isCn
        ? [
            { id: "alipay", label: "支付宝" },
            { id: "wechatpay", label: "微信支付" },
          ]
        : [
            { id: "stripe", label: "Stripe" },
            { id: "paypal", label: "PayPal" },
          ],
    [isCn]
  )

  const copy = useMemo(
    () =>
      isCn
        ? {
            title: "选择适合您的方案",
            subtitle: "免费版也能生成高质量首版，付费版继续提升模块深度、页面数量与持续改码能力。",
            yearly: "每年",
            monthly: "月度",
            action: "继续结账",
            selected: "当前选择",
            included: "计划要点",
            paymentMethods: "支付方式",
            currentPlan: "当前套餐",
            currentPlanDesc: "这里展示你当前账号的生成档位，以及升级后会带来的生成能力变化。",
            orderInfo: "订单信息",
            secure: "支付安全",
            secureDesc: "订单必须经过明确确认后才会进入成功状态，不会自动跳成功页。",
            signInToPay: "登录后支付",
            redirecting: "跳转中...",
            openHostedHint: "当前会先进入站内支付确认页，接通正式商户后会跳转第三方收银台。",
            openLiveHint: "即将跳转到正式支付页面。",
            authMode: "当前登录模式",
          }
        : {
            title: "Choose the plan that fits your build",
            subtitle: "The free tier still produces a polished first version. Paid plans expand depth, page count, and continuous editing quality.",
            yearly: "Yearly",
            monthly: "Monthly",
            action: "Continue to checkout",
            selected: "Selected",
            included: "Included",
            paymentMethods: "Payment methods",
            currentPlan: "Current subscription",
            currentPlanDesc: "This shows your current generation tier and what improves as you upgrade.",
            orderInfo: "Order details",
            secure: "Secure checkout",
            secureDesc: "An order only becomes successful after explicit confirmation. No automatic success states.",
            signInToPay: "Sign in to pay",
            redirecting: "Redirecting...",
            openHostedHint: "You will enter the in-product confirmation page until live merchant credentials are configured.",
            openLiveHint: "You are about to jump to the live payment page.",
            authMode: "Current auth mode",
          },
    [isCn]
  )

  const checkoutRedirect = `/checkout?region=${region}&plan=${planId}`
  const loginEntry = `/login?region=${region}&redirect=${encodeURIComponent(checkoutRedirect)}`

  async function handlePay() {
    setError("")
    if (!authenticated) {
      router.push(loginEntry)
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, planId, method, cycle }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(String(json?.error ?? "Create payment failed"))
      }
      const redirectUrl = String(json?.redirectUrl ?? "").trim()
      if (!redirectUrl) {
        throw new Error("No payment redirect returned")
      }
      setProviderHint(Boolean(json?.fallbackHosted) ? copy.openHostedHint : copy.openLiveHint)
      router.push(redirectUrl)
    } catch (err: any) {
      setError(err?.message || "Create payment failed")
    } finally {
      setSubmitting(false)
    }
  }

  const currentPlan = PLAN_CATALOG[subscriptionTier]

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] bg-[radial-gradient(circle_at_top,#f5f6ff,transparent_30%),linear-gradient(180deg,#fafaf7_0%,#ffffff_55%,#f8fafc_100%)] p-6 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">{copy.title}</h1>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">{copy.subtitle}</p>
          </div>

          <div className="mt-8 flex justify-center">
            <div className="inline-flex rounded-full border border-border bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setCycle("yearly")}
                className={`rounded-full px-4 py-2 text-sm transition ${cycle === "yearly" ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                {copy.yearly}
              </button>
              <button
                type="button"
                onClick={() => setCycle("monthly")}
                className={`rounded-full px-4 py-2 text-sm transition ${cycle === "monthly" ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                {copy.monthly}
              </button>
            </div>
          </div>

          <div className="mt-10 grid gap-5 xl:grid-cols-4">
            {PAID_PLAN_IDS.map((id) => {
              const plan = PLAN_CATALOG[id]
              const isSelected = planId === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlanId(id)}
                  className={`rounded-[2rem] border p-6 text-left transition ${
                    isSelected ? "border-foreground bg-white shadow-[0_30px_70px_rgba(15,23,42,0.08)]" : "border-border/80 bg-white/80 hover:border-foreground/35"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-semibold text-foreground">{isCn ? plan.nameCn : plan.nameEn}</div>
                      <p className="mt-2 text-sm text-muted-foreground">{isCn ? plan.summaryCn : plan.summaryEn}</p>
                    </div>
                    {plan.badgeCn || plan.badgeEn ? (
                      <span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-medium text-orange-600">
                        {isCn ? plan.badgeCn : plan.badgeEn}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-6 text-4xl font-semibold text-foreground">
                    {getPlanPriceLabel(id, isCn ? "zh" : "en", cycle)}
                    <span className="ml-1 text-lg font-normal text-muted-foreground">{isCn ? (cycle === "yearly" ? "/年" : "/月") : cycle === "yearly" ? "/yr" : "/mo"}</span>
                  </div>

                  {isSelected ? <Badge className="mt-4">{copy.selected}</Badge> : null}

                  <div className="mt-6 text-sm leading-7 text-muted-foreground">
                    {isCn ? plan.generationQualityCn : plan.generationQualityEn}
                  </div>

                  <div className="mt-6 space-y-3">
                    {(isCn ? plan.deliverablesCn : plan.deliverablesEn).map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="border-border/80">
          <CardContent className="space-y-5 p-6">
            <div>
              <div className="text-sm font-medium text-foreground">{copy.currentPlan}</div>
              <p className="mt-1 text-sm text-muted-foreground">{copy.currentPlanDesc}</p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/30 p-4">
              <div className="text-xl font-semibold text-foreground">{isCn ? currentPlan.nameCn : currentPlan.nameEn}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {isCn ? currentPlan.generationQualityCn : currentPlan.generationQualityEn}
              </p>
            </div>

            <div>
              <div className="mb-3 text-sm font-medium text-foreground">{copy.paymentMethods}</div>
              <div className="grid gap-3 md:grid-cols-2">
                {paymentMethods.map((paymentMethod) => (
                  <button
                    key={paymentMethod.id}
                    type="button"
                    onClick={() => setMethod(paymentMethod.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      method === paymentMethod.id ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {paymentMethod.id === "wechatpay" ? <QrCode className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                      <div className="font-medium text-foreground">{paymentMethod.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardContent className="space-y-5 p-6">
            <div>
              <div className="text-sm font-medium text-foreground">{copy.orderInfo}</div>
              <div className="mt-3 rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{isCn ? "套餐" : "Plan"}</span>
                  <strong>{isCn ? PLAN_CATALOG[planId].nameCn : PLAN_CATALOG[planId].nameEn}</strong>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{isCn ? "价格" : "Price"}</span>
                  <strong>{getPlanPriceLabel(planId, isCn ? "zh" : "en", cycle)}</strong>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{isCn ? "周期" : "Cycle"}</span>
                  <span>{cycle === "yearly" ? copy.yearly : copy.monthly}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{isCn ? "支付方式" : "Method"}</span>
                  <span>{method}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-medium text-foreground">{copy.secure}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{copy.secureDesc}</p>
                </div>
              </div>
            </div>

            {!authLoading && !authenticated ? (
              <Button className="w-full" variant="outline" onClick={() => router.push(loginEntry)}>
                {copy.signInToPay}
              </Button>
            ) : (
              <Button className="w-full" onClick={handlePay} disabled={submitting}>
                {submitting ? copy.redirecting : copy.action}
              </Button>
            )}

            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            {providerHint ? <p className="text-sm text-muted-foreground">{providerHint}</p> : null}
            <p className="text-xs text-muted-foreground">
              {copy.authMode}: {isCn ? (authMode === "wechat" ? "微信 + 邮箱密码" : authMode === "password" ? "邮箱密码" : authMode === "supabase" ? "Supabase" : "演示账号") : authMode === "supabase" ? "Supabase + Google/Facebook" : authMode}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading checkout...</div>}>
      <CheckoutPageContent />
    </Suspense>
  )
}
