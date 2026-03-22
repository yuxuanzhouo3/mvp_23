"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Chrome, MessageCircle, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/lib/i18n"
import { getRegionFromHostname } from "@/lib/region-routing"

type SessionResp = {
  authenticated: boolean
  authRuntime?: {
    intlMode: "demo" | "password" | "supabase" | "wechat"
    cnMode: "demo" | "password" | "supabase" | "wechat"
    intlEmailPasswordEnabled?: boolean
    cnEmailPasswordEnabled?: boolean
    googleEnabled?: boolean
    facebookEnabled?: boolean
  }
  user?: {
    id: string
    email: string
    name: string
    region: "cn" | "intl"
  }
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { locale } = useLocale()
  const redirectTo = searchParams.get("redirect") || "/checkout"
  const provider = searchParams.get("provider") || ""
  const oauthState = searchParams.get("oauth") || ""
  const oauthError = searchParams.get("error") || ""
  const [region, setRegion] = useState<"cn" | "intl">(locale === "zh" ? "cn" : "intl")
  const isCn = region === "cn"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [runtimeMode, setRuntimeMode] = useState<"demo" | "password" | "supabase" | "wechat">("demo")
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [googleEnabled, setGoogleEnabled] = useState(true)
  const [facebookEnabled, setFacebookEnabled] = useState(true)

  useEffect(() => {
    if (typeof window === "undefined") return
    setRegion(getRegionFromHostname(window.location.hostname))
  }, [])

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((json: SessionResp) => {
        setRuntimeMode((isCn ? json?.authRuntime?.cnMode : json?.authRuntime?.intlMode) ?? "demo")
        setEmailEnabled(Boolean(isCn ? json?.authRuntime?.cnEmailPasswordEnabled : json?.authRuntime?.intlEmailPasswordEnabled))
        setGoogleEnabled(Boolean(json?.authRuntime?.googleEnabled))
        setFacebookEnabled(Boolean(json?.authRuntime?.facebookEnabled))
        if (json.authenticated) {
          router.replace(redirectTo)
        }
      })
      .catch(() => null)
  }, [redirectTo, router, isCn])

  async function handleLogin() {
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, region }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(String(json?.error ?? "Login failed"))
      }
      router.push(redirectTo)
    } catch (err: any) {
      setError(err?.message || "Login failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRegister() {
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, region, name }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(String(json?.error ?? "Register failed"))
      }
      router.push(redirectTo)
    } catch (err: any) {
      const message = err?.message || "Register failed"
      setError(message === "User already exists" ? (isCn ? "该邮箱已注册，请直接点击“登录并继续”。" : "This email already exists. Please sign in instead.") : message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{isCn ? "登录后继续支付" : "Sign in to continue"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
            {isCn
              ? runtimeMode === "wechat"
                ? "当前中国区已启用微信登录入口，同时也支持邮箱密码注册/登录。微信密钥接入后可切正式流程。"
                : runtimeMode === "password"
                  ? "当前中国区使用邮箱密码登录与注册，不需要邮箱验证码。"
                  : "当前中国区仍可使用演示账号，也支持本地邮箱密码注册。"
              : runtimeMode === "supabase"
                ? "当前国际版已切到 Supabase 邮箱密码模式，Google 登录接好配置后可一起使用。"
                : runtimeMode === "password"
                  ? "The international site is currently using direct email/password login. You can register with a real email right now, then switch to Supabase later without changing the page flow."
                  : "Use your real email and password to sign in or create an account."}
          </div>
          <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
            {isCn
              ? `当前运行模式：${runtimeMode === "wechat" ? "微信优先 + 邮箱密码" : runtimeMode === "password" ? "邮箱密码" : runtimeMode === "supabase" ? "Supabase" : "演示登录"}`
              : `Current runtime mode: ${runtimeMode === "supabase" ? "Supabase email auth" : runtimeMode === "wechat" ? "WeChat auth" : runtimeMode === "password" ? "Password auth" : "Demo auth"}`}
          </div>
          {provider ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {isCn ? `已从 ${provider} 入口返回，可以继续支付测试。` : `Returned from the ${provider} entry. You can continue the payment test flow.`}
            </div>
          ) : null}
          {oauthState === "callback_received" ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              {isCn
                ? `已收到 ${provider || "第三方"} 回调。当前版本已经把回调入口接好，但 Google/Facebook 的正式令牌交换还要在下一步联调完成。`
                : `The ${provider || "provider"} callback reached the app. The callback URL is live, but the final Google/Facebook token exchange is still the next integration step.`}
            </div>
          ) : null}
          {oauthState === "provider_error" && oauthError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {isCn ? `第三方回调返回错误：${oauthError}` : `Provider callback error: ${oauthError}`}
            </div>
          ) : null}
          {isCn && runtimeMode === "wechat" ? (
            <Button variant="outline" className="w-full" onClick={() => router.push(`/api/auth/wechat/start?redirect=${encodeURIComponent(redirectTo)}`)}>
              <MessageCircle className="mr-2 h-4 w-4" />
              微信登录
            </Button>
          ) : null}
          {!isCn && (googleEnabled || facebookEnabled) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="outline" disabled={!googleEnabled} onClick={() => router.push(`/api/auth/google/start?redirect=${encodeURIComponent(redirectTo)}`)}>
                <Chrome className="mr-2 h-4 w-4" />
                {googleEnabled ? "Google" : "Google Unavailable"}
              </Button>
              <Button variant="outline" disabled={!facebookEnabled} onClick={() => router.push(`/api/auth/facebook/start?redirect=${encodeURIComponent(redirectTo)}`)}>
                <Users className="mr-2 h-4 w-4" />
                {facebookEnabled ? "Facebook" : "Facebook Unavailable"}
              </Button>
            </div>
          ) : null}
          {emailEnabled ? (
            <>
              {isCn ? <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="昵称（可选）" /> : null}
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isCn ? "请输入邮箱" : "Enter your email"} />
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder={isCn ? "请输入密码" : "Enter your password"} />
            </>
          ) : null}
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {emailEnabled ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button className="w-full" onClick={handleLogin} disabled={submitting}>
                {submitting && !registering ? (isCn ? "登录中..." : "Signing in...") : isCn ? "登录并继续" : "Sign in and continue"}
              </Button>
              <Button className="w-full" variant="outline" onClick={() => { setRegistering(true); void handleRegister().finally(() => setRegistering(false)) }} disabled={submitting}>
                {submitting && registering ? (isCn ? "注册中..." : "Creating account...") : isCn ? "注册并登录" : "Create account"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading login...</div>}>
      <LoginPageContent />
    </Suspense>
  )
}
