"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Chrome, LoaderCircle, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getCurrentDomainRegion } from "@/lib/generation-preferences"
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

function BrandMark() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#ff8a28_0%,#ff6b1b_100%)] shadow-[0_12px_28px_rgba(255,124,32,0.28)]">
      <div className="h-5 w-5 rounded-full bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.98)_0px,rgba(255,255,255,0.98)_2px,transparent_2px,transparent_4px)]" />
    </div>
  )
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/projects"
  const switchAccount = searchParams.get("switch") === "1"
  const registerRequested = searchParams.get("mode") === "register"
  const oauthState = searchParams.get("oauth") || ""
  const oauthError = searchParams.get("error") || ""
  const provider = searchParams.get("provider") || "google"
  const [region, setRegion] = useState<"cn" | "intl">(getCurrentDomainRegion())
  const isCn = region === "cn"
  const [sessionUser, setSessionUser] = useState<SessionResp["user"] | null>(null)
  const [authResolved, setAuthResolved] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [authStep, setAuthStep] = useState<"entry" | "password" | "register" | "authenticated">(
    registerRequested ? "register" : "entry"
  )
  const [runtimeMode, setRuntimeMode] = useState<"demo" | "password" | "supabase" | "wechat">("demo")
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [googleEnabled, setGoogleEnabled] = useState(true)

  useEffect(() => {
    if (typeof window === "undefined") return
    setRegion(getRegionFromHostname(window.location.hostname))
  }, [])

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: SessionResp) => {
        setRuntimeMode((isCn ? json?.authRuntime?.cnMode : json?.authRuntime?.intlMode) ?? "demo")
        setEmailEnabled(Boolean(isCn ? json?.authRuntime?.cnEmailPasswordEnabled : json?.authRuntime?.intlEmailPasswordEnabled))
        setGoogleEnabled(Boolean(json?.authRuntime?.googleEnabled))
        if (json.authenticated && !switchAccount) {
          setSessionUser(json.user ?? null)
          setAuthStep("authenticated")
          if (!email && json.user?.email) setEmail(json.user.email)
          if (!name && json.user?.name) setName(json.user.name)
        } else {
          setSessionUser(switchAccount ? json.user ?? null : null)
          setAuthStep(switchAccount ? "authenticated" : registerRequested ? "register" : "entry")
        }
      })
      .catch(() => null)
      .finally(() => setAuthResolved(true))
  }, [isCn, registerRequested, switchAccount])

  async function handleSwitchAccount() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null)
    setSessionUser(null)
    setPassword("")
    setError("")
    setAuthStep("entry")
  }

  async function handlePasswordLogin() {
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
      setSessionUser(json?.user ?? null)
      setAuthStep("authenticated")
    } catch (err: any) {
      setError(err?.message || (isCn ? "登录失败" : "Login failed"))
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
      setSessionUser(json?.user ?? null)
      setAuthStep("authenticated")
    } catch (err: any) {
      const message = err?.message || (isCn ? "注册失败" : "Register failed")
      setError(message === "User already exists" ? (isCn ? "该邮箱已注册，请直接登录。" : "This email already exists. Sign in instead.") : message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleContinue() {
    setError("")
    if (!email.trim()) {
      setError(isCn ? "请输入邮箱地址。" : "Enter your email address.")
      return
    }
    if (!emailEnabled) {
      setError(isCn ? "当前邮箱登录未开启，请使用可用的登录入口。" : "Email login is unavailable right now. Use an available provider instead.")
      return
    }
    setAuthStep("password")
  }

  const copy = useMemo(
    () =>
      isCn
        ? {
            heading: "欢迎来到 mornstack",
            subheading: "登录后继续进入控制台与工作台。",
            google: "使用 Google 登录",
            lastUsed: "最近使用",
            email: "邮箱",
            password: "密码",
            name: "昵称（可选）",
            emailPlaceholder: "输入你的邮箱地址",
            passwordPlaceholder: "输入你的密码",
            namePlaceholder: "输入昵称",
            or: "或",
            continue: "继续",
            signIn: "登录并继续",
            create: "注册并继续",
            switchAccount: "切换账号",
            continueInto: "继续进入",
            signedIn: "当前已登录账号",
            signOut: "退出登录",
            noAccount: "还没有账号？",
            hasAccount: "已经有账号？",
            signUp: "注册",
            signInLink: "登录",
            changeEmail: "换个邮箱",
            terms: "服务条款",
            privacy: "隐私政策",
            idea: "把你的想法变成应用",
            previewHint: "一句需求，直接进入产品生成与交付流。",
            runtime:
              runtimeMode === "wechat"
                ? "当前模式：微信优先 + 邮箱密码"
                : runtimeMode === "password"
                  ? "当前模式：邮箱密码"
                  : runtimeMode === "supabase"
                    ? "当前模式：Supabase"
                    : "当前模式：演示账号 + 邮箱密码",
            oauthReady: `已从 ${provider} 返回，继续进入下一步。`,
          }
        : {
            heading: "Welcome to mornstack",
            subheading: "Sign in to continue into the control plane and workspace.",
            google: "Log in with Google",
            lastUsed: "Last used",
            email: "Email",
            password: "Password",
            name: "Name (optional)",
            emailPlaceholder: "Enter your email address",
            passwordPlaceholder: "Enter your password",
            namePlaceholder: "Enter your name",
            or: "OR",
            continue: "Continue",
            signIn: "Sign in and continue",
            create: "Create account",
            switchAccount: "Switch account",
            continueInto: "Continue",
            signedIn: "Signed in account",
            signOut: "Sign out",
            noAccount: "Don't have an account?",
            hasAccount: "Already have an account?",
            signUp: "Sign up",
            signInLink: "Sign in",
            changeEmail: "Use another email",
            terms: "Terms of Service",
            privacy: "Privacy Policy",
            idea: "Turn your ideas into apps",
            previewHint: "One prompt, then keep building through generation, preview, and delivery.",
            runtime:
              runtimeMode === "supabase"
                ? "Current mode: Supabase email auth"
                : runtimeMode === "password"
                  ? "Current mode: direct email/password"
                  : runtimeMode === "wechat"
                    ? "Current mode: WeChat auth"
                    : "Current mode: demo social + password auth",
            oauthReady: `Returned from ${provider}. Continue into the next step.`,
          },
    [isCn, provider, runtimeMode]
  )

  const helperMessage = useMemo(() => {
    if (oauthState === "provider_error" && oauthError) {
      return isCn ? `第三方登录错误：${oauthError}` : `Provider error: ${oauthError}`
    }
    if (oauthState) return copy.oauthReady
    if (error) return error
    return copy.runtime
  }, [copy.oauthReady, copy.runtime, error, isCn, oauthError, oauthState])

  const showAuthForm = authStep !== "authenticated"
  const isRegisterMode = authStep === "register"
  const isPasswordMode = authStep === "password"
  const googleRedirect = `/api/auth/google/start?redirect=${encodeURIComponent(redirectTo)}`

  return (
    <div className="min-h-screen bg-[#fcfbf7] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[minmax(420px,0.92fr)_minmax(520px,1.08fr)]">
        <section className="flex min-h-screen flex-col justify-between px-6 py-6 sm:px-10 sm:py-8 lg:px-14 lg:py-10">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <div className="text-[1.75rem] font-semibold tracking-tight">mornstack</div>
          </Link>

          <div className="mx-auto flex w-full max-w-[510px] flex-1 flex-col justify-center py-10">
            <div className="space-y-3">
              <h1 className="text-[3rem] font-semibold leading-[0.96] tracking-[-0.05em] text-slate-950 sm:text-[4.2rem]">
                {copy.heading}
              </h1>
              <p className="max-w-[32rem] text-base leading-7 text-slate-500">{copy.subheading}</p>
            </div>

            <div className="mt-8 space-y-5">
              {authResolved && authStep === "authenticated" && sessionUser ? (
                <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-6 shadow-[0_18px_50px_rgba(16,185,129,0.08)]">
                  <div className="text-sm font-medium text-emerald-900">{copy.signedIn}</div>
                  <div className="mt-3 text-2xl font-semibold text-slate-950">{sessionUser.name || sessionUser.email}</div>
                  <div className="mt-1 text-sm text-emerald-800/80">{sessionUser.email}</div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <Button className="h-12 rounded-2xl bg-[#395ee8] text-base font-medium text-white hover:bg-[#2f53db]" onClick={() => router.push(redirectTo)}>
                      {copy.continueInto}
                    </Button>
                    <Button className="h-12 rounded-2xl border-slate-200 bg-white text-base text-slate-700 hover:bg-slate-50" variant="outline" onClick={handleSwitchAccount}>
                      {copy.switchAccount}
                    </Button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
                  >
                    <LogOut className="h-4 w-4" />
                    {copy.signOut}
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[#ff9b42] px-3 py-1 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(255,155,66,0.32)]">
                      {copy.lastUsed}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-14 w-full rounded-2xl border-[#ffb272] bg-white text-lg font-medium text-slate-900 hover:bg-[#fff8f1]"
                      disabled={!authResolved || submitting || !googleEnabled}
                      onClick={() => {
                        router.push(googleRedirect)
                      }}
                    >
                      <Chrome className="mr-3 h-5 w-5" />
                      {copy.google}
                    </Button>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span>{copy.or}</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-900">{copy.email}</label>
                      <Input
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder={copy.emailPlaceholder}
                        className="h-14 rounded-2xl border-slate-200 bg-white text-base shadow-none placeholder:text-slate-400"
                      />
                    </div>

                    {isPasswordMode || isRegisterMode ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-900">{copy.password}</label>
                        <Input
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          type="password"
                          placeholder={copy.passwordPlaceholder}
                          className="h-14 rounded-2xl border-slate-200 bg-white text-base shadow-none placeholder:text-slate-400"
                        />
                      </div>
                    ) : null}

                    {isRegisterMode ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-900">{copy.name}</label>
                        <Input
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder={copy.namePlaceholder}
                          className="h-14 rounded-2xl border-slate-200 bg-white text-base shadow-none placeholder:text-slate-400"
                        />
                      </div>
                    ) : null}

                    {showAuthForm ? (
                      <Button
                        type="button"
                        className="h-14 w-full rounded-2xl bg-slate-500 text-lg font-medium text-white hover:bg-slate-600 disabled:opacity-80"
                        disabled={submitting || !authResolved}
                        onClick={() => {
                          if (authStep === "entry") {
                            handleContinue()
                            return
                          }
                          if (authStep === "register") {
                            void handleRegister()
                            return
                          }
                          void handlePasswordLogin()
                        }}
                      >
                        {submitting ? (
                          <>
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            {isRegisterMode ? copy.create : copy.signIn}
                          </>
                        ) : authStep === "entry" ? (
                          copy.continue
                        ) : authStep === "register" ? (
                          copy.create
                        ) : (
                          copy.signIn
                        )}
                      </Button>
                    ) : null}
                  </div>

                  <div className="min-h-[24px] text-sm text-slate-500">{helperMessage}</div>

                  <div className="space-y-3 text-center text-sm text-slate-600">
                    {authStep === "entry" ? (
                      <p>
                        {copy.noAccount}{" "}
                        <button type="button" className="font-semibold text-slate-950 underline underline-offset-4" onClick={() => setAuthStep("register")}>
                          {copy.signUp}
                        </button>
                      </p>
                    ) : authStep === "register" ? (
                      <>
                        <p>
                          {copy.hasAccount}{" "}
                          <button type="button" className="font-semibold text-slate-950 underline underline-offset-4" onClick={() => setAuthStep("password")}>
                            {copy.signInLink}
                          </button>
                        </p>
                        <button type="button" className="font-medium text-slate-500 underline underline-offset-4" onClick={() => setAuthStep("entry")}>
                          {copy.changeEmail}
                        </button>
                      </>
                    ) : (
                      <>
                        <p>
                          {copy.noAccount}{" "}
                          <button type="button" className="font-semibold text-slate-950 underline underline-offset-4" onClick={() => setAuthStep("register")}>
                            {copy.signUp}
                          </button>
                        </p>
                        <button type="button" className="font-medium text-slate-500 underline underline-offset-4" onClick={() => setAuthStep("entry")}>
                          {copy.changeEmail}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="underline underline-offset-4">{copy.terms}</span>
            <span>{isCn ? "与" : "and"}</span>
            <span className="underline underline-offset-4">{copy.privacy}</span>
          </div>
        </section>

        <section className="hidden p-6 lg:flex lg:items-center lg:justify-center lg:p-8">
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[36px] border border-white/70 bg-[radial-gradient(circle_at_top,#eef5ff_0%,#e7f0ff_34%,#eaf1fb_56%,#edf2fb_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.95),transparent_28%),radial-gradient(circle_at_76%_24%,rgba(155,205,255,0.55),transparent_26%),radial-gradient(circle_at_60%_62%,rgba(255,255,255,0.75),transparent_32%)]" />
            <div className="relative w-[70%] rounded-[30px] border border-white/65 bg-white/60 px-8 py-8 shadow-[0_24px_70px_rgba(148,163,184,0.18)] backdrop-blur-xl">
              <div className="text-[4.1rem] font-medium leading-[1.05] tracking-[-0.06em] text-[#9bb8df]">
                {copy.idea}
              </div>
              <div className="mt-8 flex items-center justify-between gap-5 rounded-[26px] border border-white/70 bg-white/58 px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="max-w-[28rem] text-2xl leading-10 tracking-[-0.03em] text-[#a9bddb]">{copy.previewHint}</div>
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-[#aebbd0] text-white shadow-[0_16px_30px_rgba(160,174,192,0.28)]">
                  <ArrowRight className="h-7 w-7" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fcfbf7]" />}>
      <LoginPageContent />
    </Suspense>
  )
}
