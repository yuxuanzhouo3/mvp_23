"use client"

import { useEffect, useState } from "react"
import { Puzzle, Github, Cloud, Bell, MessageCircle, CreditCard, Database, Globe2, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/lib/i18n"

const baseIntegrations = [
  { name: "GitHub", icon: Github, descKey: "connectRepos" as const, connected: true },
  { name: "Vercel", icon: Cloud, descKey: "deployApps" as const, connected: true },
  { name: "Slack", icon: Bell, descKey: "buildNotifications" as const, connected: false },
]

const cnIntegrations = [
  { nameKey: "wechatLogin" as const, icon: MessageCircle, descKey: "wechatLoginDesc" as const, connected: true },
  { nameKey: "weiboShare" as const, icon: MessageCircle, descKey: "weiboShareDesc" as const, connected: false },
]

type ReadinessResp = {
  auth?: {
    intlMode: "demo" | "password" | "supabase" | "wechat"
    cnMode: "demo" | "password" | "supabase" | "wechat"
    supabaseConfigured: boolean
    wechatConfigured: boolean
    googleEnabled: boolean
    facebookEnabled: boolean
    googleConfigured: boolean
    facebookConfigured: boolean
  }
  payment?: {
    stripeConfigured: boolean
    paypalConfigured: boolean
    alipayConfigured: boolean
    wechatConfigured: boolean
  }
  deployment?: {
    intl: {
      hosting: string
      runtime: string
      dockerRequired: boolean
      database: string
      databaseConfigured: boolean
    }
    cn: {
      hosting: string
      runtime: string
      dockerRequired: boolean
      database: string
      databaseConfigured: boolean
    }
  }
  envGuide?: {
    intlAuth: string[]
    intlPayment: string[]
    cnAuth: string[]
    cnPayment: string[]
    cnInfra: string[]
    deploymentTargets?: string[]
    databaseTargets?: string[]
  }
  mcp?: {
    supabaseDb?: { key: string; configured: boolean; requiredEnv: string[] }
    cloudbase?: { key: string; configured: boolean; requiredEnv: string[] }
    exampleConfigPath?: string
  }
  site?: {
    origin: string
    home: string
    intl: string
    cn: string
    admin: string
    market: string
    loginDemo: string
    checkoutDemo: string
    demo: string
    promoLatestIndex: string
    promoLatestVideo: string
    promoLatestPpt: string
    authCallbacks: {
      google: string
      facebook: string
      wechat: string
    }
    paymentWebhooks: {
      stripe: string
      paypal: string
      alipay: string
      wechatpay: string
    }
  }
  providers?: Array<{
    key: string
    label: string
    region: "cn" | "intl"
    category: "auth" | "payment"
    enabled: boolean
    configured: boolean
    realFlowImplemented: boolean
    status: "disabled" | "demo" | "credential_ready" | "live"
    startPath?: string
    callbackUrl?: string
    webhookUrl?: string
    fallbackLabel?: string
  }>
}

function getStatusLabel(status: "disabled" | "demo" | "credential_ready" | "live", isZh: boolean) {
  if (status === "live") return isZh ? "已可实接" : "Live-ready"
  if (status === "credential_ready") return isZh ? "密钥已备" : "Credentials ready"
  if (status === "disabled") return isZh ? "已关闭" : "Disabled"
  return isZh ? "演示兜底" : "Demo fallback"
}

function getStatusVariant(status: "disabled" | "demo" | "credential_ready" | "live") {
  if (status === "live") return "secondary" as const
  if (status === "credential_ready") return "outline" as const
  if (status === "disabled") return "outline" as const
  return "outline" as const
}

export default function IntegrationsPage() {
  const { t, locale } = useLocale()
  const isZh = locale === "zh"
  const [readiness, setReadiness] = useState<ReadinessResp | null>(null)

  useEffect(() => {
    fetch("/api/integrations/readiness")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setReadiness(json))
      .catch(() => setReadiness(null))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("integrationsTitle")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("integrationsDesc")}
        </p>
      </div>

      {isZh && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">中国本土集成</h2>
          <div className="grid gap-4">
            {cnIntegrations.map((int) => (
              <Card key={int.nameKey} className="hover:border-primary/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      <int.icon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">{t(int.nameKey)}</h3>
                      <p className="text-sm text-muted-foreground">{t(int.descKey)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {int.connected ? (
                      <Badge variant="secondary">{t("connected")}</Badge>
                    ) : (
                      <Badge variant="outline">{t("notConnected")}</Badge>
                    )}
                    <Button variant={int.connected ? "outline" : "default"} size="sm">
                      {int.connected ? t("configure") : t("connect")}
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{isZh ? "国际集成" : "Integrations"}</h2>
        <div className="grid gap-4">
          {baseIntegrations.map((int) => (
            <Card key={int.name} className="hover:border-primary/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                    <int.icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium">{int.name}</h3>
                    <p className="text-sm text-muted-foreground">{t(int.descKey)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {int.connected ? (
                    <Badge variant="secondary">{t("connected")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("notConnected")}</Badge>
                  )}
                  <Button variant={int.connected ? "outline" : "default"} size="sm">
                    {int.connected ? t("configure") : t("connect")}
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      {readiness ? (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">{isZh ? "双版本接入就绪面板" : "Dual-region readiness panel"}</h2>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                    <Globe2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium">{isZh ? "国际版" : "International"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isZh
                        ? `登录模式：${readiness.auth?.intlMode ?? "demo"}，部署：${readiness.deployment?.intl.hosting ?? "vercel"}`
                        : `Auth mode: ${readiness.auth?.intlMode ?? "demo"}, hosting: ${readiness.deployment?.intl.hosting ?? "vercel"}`}
                    </p>
                  </div>
                </div>
                <Badge variant={readiness.deployment?.intl.databaseConfigured ? "secondary" : "outline"}>
                  {readiness.deployment?.intl.databaseConfigured ? (isZh ? "基础已接好" : "Baseline ready") : (isZh ? "待配置" : "Needs config")}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-xl border border-border p-3">
                  <div className="font-medium">{isZh ? "登录" : "Auth"}</div>
                  <div className="mt-1 text-muted-foreground">
                    {isZh
                      ? `Supabase: ${readiness.auth?.supabaseConfigured ? "已配置" : "未配置"} · Google: ${readiness.auth?.googleConfigured ? "已配置" : "待配置"} · Facebook: ${readiness.auth?.facebookConfigured ? "已配置" : "待配置"}`
                      : `Supabase: ${readiness.auth?.supabaseConfigured ? "configured" : "missing"} · Google: ${readiness.auth?.googleConfigured ? "configured" : "missing"} · Facebook: ${readiness.auth?.facebookConfigured ? "configured" : "missing"}`}
                  </div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="font-medium">{isZh ? "支付" : "Payments"}</div>
                  <div className="mt-1 text-muted-foreground">
                    {isZh
                      ? `Stripe: ${readiness.payment?.stripeConfigured ? "已配置" : "未配置"} · PayPal: ${readiness.payment?.paypalConfigured ? "已配置" : "未配置"}`
                      : `Stripe: ${readiness.payment?.stripeConfigured ? "configured" : "missing"} · PayPal: ${readiness.payment?.paypalConfigured ? "configured" : "missing"}`}
                  </div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="font-medium">{isZh ? "数据库与部署" : "Database and hosting"}</div>
                  <div className="mt-1 text-muted-foreground">
                    {isZh
                      ? `${readiness.deployment?.intl.database ?? "supabase"} / ${readiness.deployment?.intl.runtime ?? "node"} / ${readiness.deployment?.intl.dockerRequired ? "Docker" : "无 Docker"}`
                      : `${readiness.deployment?.intl.database ?? "supabase"} / ${readiness.deployment?.intl.runtime ?? "node"} / ${readiness.deployment?.intl.dockerRequired ? "Docker" : "No Docker"}`}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                    <ShieldCheck className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium">{isZh ? "国内版" : "China region"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isZh
                        ? `登录模式：${readiness.auth?.cnMode ?? "password"}，部署：${readiness.deployment?.cn.hosting ?? "cloudbase"}`
                        : `Auth mode: ${readiness.auth?.cnMode ?? "password"}, hosting: ${readiness.deployment?.cn.hosting ?? "cloudbase"}`}
                    </p>
                  </div>
                </div>
                <Badge variant={readiness.auth?.wechatConfigured || readiness.payment?.alipayConfigured ? "secondary" : "outline"}>
                  {readiness.auth?.wechatConfigured || readiness.payment?.alipayConfigured ? (isZh ? "部分已接好" : "Partially ready") : (isZh ? "待配置" : "Needs config")}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-xl border border-border p-3">
                  <div className="font-medium">{isZh ? "登录" : "Auth"}</div>
                  <div className="mt-1 text-muted-foreground">
                    {isZh
                      ? `邮箱密码: 已支持 · 微信: ${readiness.auth?.wechatConfigured ? "已配置" : "待配置"}`
                      : `Email/password: supported · WeChat: ${readiness.auth?.wechatConfigured ? "configured" : "missing"}`}
                  </div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="font-medium">{isZh ? "支付" : "Payments"}</div>
                  <div className="mt-1 text-muted-foreground">
                    {isZh
                      ? `支付宝: ${readiness.payment?.alipayConfigured ? "已配置" : "待配置"} · 微信支付: ${readiness.payment?.wechatConfigured ? "已配置" : "待配置"}`
                      : `Alipay: ${readiness.payment?.alipayConfigured ? "configured" : "missing"} · WeChat Pay: ${readiness.payment?.wechatConfigured ? "configured" : "missing"}`}
                  </div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="font-medium">{isZh ? "数据库与部署" : "Database and hosting"}</div>
                  <div className="mt-1 text-muted-foreground">
                    {isZh
                      ? `${readiness.deployment?.cn.database ?? "document-db"} / ${readiness.deployment?.cn.runtime ?? "docker"} / ${readiness.deployment?.cn.dockerRequired ? "Docker 部署" : "无 Docker"}`
                      : `${readiness.deployment?.cn.database ?? "document-db"} / ${readiness.deployment?.cn.runtime ?? "docker"} / ${readiness.deployment?.cn.dockerRequired ? "Docker" : "No Docker"}`}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {[
              { title: isZh ? "国际登录变量" : "Intl auth env", icon: Puzzle, values: readiness.envGuide?.intlAuth ?? [] },
              { title: isZh ? "支付变量" : "Payment env", icon: CreditCard, values: [...(readiness.envGuide?.intlPayment ?? []), ...(readiness.envGuide?.cnPayment ?? [])] },
              { title: isZh ? "国内基础设施变量" : "China infra env", icon: Database, values: readiness.envGuide?.cnInfra ?? [] },
            ].map((group) => (
              <Card key={group.title}>
                <CardHeader className="flex flex-row items-center gap-3">
                  <group.icon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">{group.title}</h3>
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.values.map((item) => (
                    <div key={item} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
                      {item}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {readiness.providers?.length ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">{isZh ? "登录与支付提供方状态" : "Provider readiness"}</h3>
              <div className="grid gap-4 xl:grid-cols-2">
                {readiness.providers.map((provider) => (
                  <Card key={provider.key}>
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div>
                        <h4 className="font-medium text-foreground">{provider.label}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {provider.region === "cn" ? (isZh ? "国内版" : "China region") : isZh ? "国际版" : "International"}
                          {" · "}
                          {provider.category === "auth" ? (isZh ? "登录" : "Auth") : isZh ? "支付" : "Payment"}
                        </p>
                      </div>
                      <Badge variant={getStatusVariant(provider.status)}>{getStatusLabel(provider.status, isZh)}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="rounded-xl border border-border p-3 text-muted-foreground">
                        {provider.realFlowImplemented
                          ? isZh
                            ? "当前代码里已经有正式接入骨架，补齐对应平台参数后可继续联调。"
                            : "The production integration skeleton already exists in code. Add platform credentials to continue live testing."
                          : isZh
                            ? `当前仍以 ${provider.fallbackLabel ?? "演示模式"} 兜底，后续还要补真实 OAuth 或支付联调。`
                            : `This still falls back to ${provider.fallbackLabel ?? "demo mode"} and needs the real OAuth or payment exchange next.`}
                      </div>
                      {provider.startPath ? (
                        <div className="rounded-xl border border-border p-3">
                          <div className="font-medium text-foreground">{isZh ? "启动入口" : "Start route"}</div>
                          <div className="mt-1 break-all text-xs text-muted-foreground">{provider.startPath}</div>
                        </div>
                      ) : null}
                      {provider.callbackUrl ? (
                        <div className="rounded-xl border border-border p-3">
                          <div className="font-medium text-foreground">{isZh ? "回调地址" : "Callback URL"}</div>
                          <div className="mt-1 break-all text-xs text-muted-foreground">{provider.callbackUrl}</div>
                        </div>
                      ) : null}
                      {provider.webhookUrl ? (
                        <div className="rounded-xl border border-border p-3">
                          <div className="font-medium text-foreground">{isZh ? "Webhook 地址" : "Webhook URL"}</div>
                          <div className="mt-1 break-all text-xs text-muted-foreground">{provider.webhookUrl}</div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}

          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                  <Database className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium">{isZh ? "数据库 MCP 就绪" : "Database MCP readiness"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {isZh ? "让 AI 能直接读取 Supabase 与 CloudBase 数据结构，减少盲猜。" : "Let the AI inspect Supabase and CloudBase structures instead of guessing."}
                  </p>
                </div>
              </div>
              <Badge variant={readiness.mcp?.supabaseDb?.configured && readiness.mcp?.cloudbase?.configured ? "secondary" : "outline"}>
                {readiness.mcp?.supabaseDb?.configured && readiness.mcp?.cloudbase?.configured ? (isZh ? "已就绪" : "Ready") : (isZh ? "待补齐" : "Incomplete")}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-xl border border-border p-3">
                <div className="font-medium">supabase-db</div>
                <div className="mt-1 text-muted-foreground">
                  {readiness.mcp?.supabaseDb?.configured ? (isZh ? "已检测到数据库连接变量" : "Database connection env detected") : (isZh ? "缺少 SUPABASE_DB_URL" : "Missing SUPABASE_DB_URL")}
                </div>
              </div>
              <div className="rounded-xl border border-border p-3">
                <div className="font-medium">cloudbase</div>
                <div className="mt-1 text-muted-foreground">
                  {readiness.mcp?.cloudbase?.configured ? (isZh ? "已检测到 CloudBase Mongo 连接" : "CloudBase Mongo connection env detected") : (isZh ? "缺少 CLOUDBASE_MONGODB_URL" : "Missing CLOUDBASE_MONGODB_URL")}
                </div>
              </div>
              <div className="rounded-xl border border-border p-3 md:col-span-2">
                <div className="font-medium">{isZh ? "示例配置文件" : "Example config file"}</div>
                <div className="mt-1 text-muted-foreground">{readiness.mcp?.exampleConfigPath ?? ".cursor/mcp.json.example"}</div>
              </div>
            </CardContent>
          </Card>

          {readiness.site ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">{isZh ? "稳定演示与联调地址" : "Stable demo and wiring URLs"}</h3>
              <div className="grid gap-4 xl:grid-cols-2">
                {[
                  { title: isZh ? "老板演示" : "Boss demo", values: [readiness.site.home, readiness.site.demo, readiness.site.market, readiness.site.admin] },
                  { title: isZh ? "宣传成品页" : "Promo deliverables", values: [readiness.site.promoLatestIndex, readiness.site.promoLatestVideo, readiness.site.promoLatestPpt] },
                  { title: isZh ? "登录回调" : "Auth callbacks", values: [readiness.site.authCallbacks.google, readiness.site.authCallbacks.facebook, readiness.site.authCallbacks.wechat] },
                  { title: isZh ? "支付回调" : "Payment webhooks", values: [readiness.site.paymentWebhooks.stripe, readiness.site.paymentWebhooks.paypal, readiness.site.paymentWebhooks.alipay, readiness.site.paymentWebhooks.wechatpay] },
                ].map((group) => (
                  <Card key={group.title}>
                    <CardHeader>
                      <h4 className="font-medium text-foreground">{group.title}</h4>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {group.values.map((value) => (
                        <div key={value} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
                          {value}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
