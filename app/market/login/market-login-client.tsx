"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type MarketLoginLocale = "zh" | "en"

function getCopy(locale: MarketLoginLocale) {
  if (locale === "zh") {
    return {
      title: "营销系统后台登录",
      description: "登录后可进入用户分析、获客、通知、裂变四个子系统",
      username: "用户名",
      password: "密码",
      submit: "登录",
      submitting: "登录中...",
      loginFailed: "登录失败",
      invalidCredentials: "账号或密码错误",
    } as const
  }

  return {
    title: "Market admin login",
    description: "Sign in to access user analytics, acquisition, notifications, and referral tools",
    username: "Username",
    password: "Password",
    submit: "Sign in",
    submitting: "Signing in...",
    loginFailed: "Login failed",
    invalidCredentials: "Invalid credentials",
  } as const
}

export default function MarketLoginClient({ locale }: { locale: MarketLoginLocale }) {
  const router = useRouter()
  const copy = getCopy(locale)
  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const run = async () => {
      const response = await fetch("/api/market-admin/auth/session", { cache: "no-store" })
      if (response.ok) {
        router.replace("/market")
      }
    }

    run()
  }, [router])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/market-admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result?.success) {
        throw new Error(locale === "zh" ? copy.invalidCredentials : result?.error || copy.loginFailed)
      }

      router.replace("/market")
    } catch (err: any) {
      const rawMessage = String(err?.message || "")
      if (locale === "zh") {
        setError(rawMessage.includes("Invalid credentials") ? copy.invalidCredentials : rawMessage || copy.loginFailed)
      } else {
        setError(rawMessage || copy.loginFailed)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
        </div>

        <div className="space-y-2">
          <Label>{copy.username}</Label>
          <Input value={username} onChange={(event) => setUsername(event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>{copy.password}</Label>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? copy.submitting : copy.submit}
        </Button>
      </form>
    </div>
  )
}
