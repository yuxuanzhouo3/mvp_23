"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Check, Copy, CreditCard, LockKeyhole, QrCode, ReceiptText, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type PaymentResp = {
  ok?: boolean
  payment?: {
    id: string
    planName: string
    amountLabel: string
    method: string
    region: "cn" | "intl"
    status: "pending" | "completed" | "cancelled"
    createdAt?: string
  }
}

function HostedPaymentPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentId = searchParams.get("paymentId") || ""
  const provider = searchParams.get("provider") || ""
  const debug = searchParams.get("debug") === "1"
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [payment, setPayment] = useState<PaymentResp["payment"] | null>(null)
  const [email, setEmail] = useState("")
  const [cardholder, setCardholder] = useState("")
  const [country, setCountry] = useState("")
  const [verifyMessage, setVerifyMessage] = useState("")
  const [wechatCodeUrl, setWechatCodeUrl] = useState("")
  const [wechatQrError, setWechatQrError] = useState("")
  const [copied, setCopied] = useState(false)

  async function loadStatus() {
    if (!paymentId) {
      setLoading(false)
      return
    }
    const res = await fetch(`/api/payment/status?paymentId=${encodeURIComponent(paymentId)}`)
    const json = (await res.json().catch(() => ({}))) as PaymentResp
    setPayment(json.payment ?? null)
    setLoading(false)
  }

  useEffect(() => {
    void loadStatus()
  }, [paymentId])

  useEffect(() => {
    if (!payment) return
    setCountry(payment.region === "cn" ? "中国" : "United States")
  }, [payment])

  useEffect(() => {
    if (!paymentId || payment?.status !== "completed") return
    router.push(`/payment/success?paymentId=${encodeURIComponent(paymentId)}`)
  }, [payment?.status, paymentId, router])

  const isWechatHosted = (payment?.method || provider) === "wechatpay"

  useEffect(() => {
    if (!paymentId || !isWechatHosted) return
    let cancelled = false

    async function bootstrapWechatSession() {
      try {
        setWechatQrError("")
        const res = await fetch(`/api/payment/wechat-session?paymentId=${encodeURIComponent(paymentId)}`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!cancelled) {
            setWechatQrError(String(json?.error ?? "微信支付二维码初始化失败"))
          }
          return
        }
        if (!cancelled) {
          setWechatCodeUrl(String(json?.codeUrl ?? "").trim())
        }
      } catch (error) {
        if (!cancelled) {
          setWechatQrError(error instanceof Error ? error.message : "微信支付二维码初始化失败")
        }
      }
    }

    void bootstrapWechatSession()
    return () => {
      cancelled = true
    }
  }, [isWechatHosted, paymentId])

  useEffect(() => {
    if (!paymentId || !isWechatHosted || payment?.status !== "pending") return
    const timer = window.setInterval(async () => {
      const res = await fetch(`/api/payment/status?paymentId=${encodeURIComponent(paymentId)}&refresh=1`)
      const json = (await res.json().catch(() => ({}))) as PaymentResp
      const nextPayment = json.payment ?? null
      if (nextPayment) {
        setPayment(nextPayment)
        if (nextPayment.status === "completed") {
          router.push(`/payment/success?paymentId=${encodeURIComponent(paymentId)}`)
        }
      }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [isWechatHosted, payment?.status, paymentId, router])

  const showDebugActions =
    debug ||
    (typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"))

  const isCn = payment?.region === "cn"
  const copy = useMemo(
    () =>
      isCn
        ? {
            title: "安全支付确认",
            subtitle: "请确认订单信息并完成支付，系统会自动同步最新状态。",
            orderSummary: "订单摘要",
            paymentInfo: "支付状态",
            contact: "联系信息",
            payMethod: "当前通道",
            orderId: "订单号",
            plan: "套餐",
            method: "支付渠道",
            secure: "支付结果会安全同步到当前订单，请在完成支付后刷新查看。",
            refresh: "刷新支付状态",
            verify: "确认已支付并校验到账",
            demoCallback: "写入测试支付状态",
            cancel: "取消支付",
            checking: "查询中...",
            back: "返回结账页",
            notFound: "未找到待支付订单。",
            hostedInfo: "你可以在这里查看订单、支付方式和当前支付进度。",
            pending: "处理中",
            paid: "已到账",
            cancelled: "已取消",
            gotoResult: "查看当前结果页",
            notPaidYet: "未查询到支付成功，请完成实际支付后再重试。",
            verified: "已查询到支付成功，正在进入结果页。",
            demoDone: "测试支付状态已更新，正在进入结果页。",
          }
        : {
            title: "Secure payment confirmation",
            subtitle: "Review the order details and complete payment. The latest status will sync automatically.",
            orderSummary: "Order summary",
            paymentInfo: "Payment status",
            contact: "Contact details",
            payMethod: "Current channel",
            orderId: "Payment ID",
            plan: "Plan",
            method: "Method",
            secure: "Payment results are securely synced to this order. Refresh after completing payment to see the latest status.",
            refresh: "Refresh payment status",
            verify: "I paid, verify status",
            demoCallback: "Write test payment status",
            cancel: "Cancel payment",
            checking: "Checking...",
            back: "Back to checkout",
            notFound: "No pending payment was found.",
            hostedInfo: "You can review the order, selected payment method, and current payment progress here.",
            pending: "Processing",
            paid: "Paid",
            cancelled: "Cancelled",
            gotoResult: "Open current result page",
            notPaidYet: "No successful payment was found yet. Complete the actual payment and try again.",
            verified: "Payment verified. Opening the result page.",
            demoDone: "Test payment state updated. Opening the result page.",
          },
    [isCn]
  )

  async function refreshStatus() {
    setChecking(true)
    try {
      setVerifyMessage("")
      await loadStatus()
      if (payment?.status === "completed") {
        router.push(`/payment/success?paymentId=${encodeURIComponent(paymentId)}`)
      }
    } finally {
      setChecking(false)
    }
  }

  async function verifyPaid() {
    setChecking(true)
    try {
      setVerifyMessage("")
      const res = await fetch("/api/payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      })
      const json = await res.json().catch(() => ({}))
      await loadStatus()
      if (res.ok && json?.ok) {
        setVerifyMessage(copy.verified)
        router.push(`/payment/success?paymentId=${encodeURIComponent(paymentId)}`)
        return
      }
      setVerifyMessage(isCn ? String(json?.error ?? copy.notPaidYet).replace("No successful payment was found yet.", copy.notPaidYet) : String(json?.error ?? copy.notPaidYet))
    } finally {
      setChecking(false)
    }
  }

  async function cancel() {
    setChecking(true)
    try {
      await fetch("/api/payment/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      })
      router.push(`/payment/cancel?paymentId=${encodeURIComponent(paymentId)}`)
    } finally {
      setChecking(false)
    }
  }

  async function simulateCallback() {
    setChecking(true)
    try {
      setVerifyMessage("")
      const res = await fetch("/api/payment/mock-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      })
      const json = await res.json().catch(() => ({}))
      await loadStatus()
      if (!res.ok) {
        setVerifyMessage(String(json?.error ?? copy.notPaidYet))
        return
      }
      setVerifyMessage(copy.demoDone)
      router.push(`/payment/success?paymentId=${encodeURIComponent(paymentId)}`)
    } finally {
      setChecking(false)
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl text-sm text-muted-foreground">{isCn ? "加载订单中..." : "Loading payment..."}</div>
  }

  if (!payment) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="space-y-4 py-10">
            <div className="text-lg font-semibold">{copy.notFound}</div>
            <Button asChild>
              <a href="/checkout">{copy.back}</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const badgeText = payment.status === "completed" ? copy.paid : payment.status === "cancelled" ? copy.cancelled : copy.pending
  const wechatQrPreviewUrl = wechatCodeUrl ? `/api/payment/wechat-qr?data=${encodeURIComponent(wechatCodeUrl)}` : ""

  async function copyWechatCodeUrl() {
    if (!wechatCodeUrl) return
    try {
      await navigator.clipboard.writeText(wechatCodeUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setVerifyMessage(isCn ? "复制二维码链接失败，请手动复制。" : "Failed to copy the QR code link.")
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] rounded-[2rem] bg-[radial-gradient(circle_at_top,#f5f6ff,transparent_38%),linear-gradient(180deg,#fafaf7_0%,#ffffff_48%,#f8fafc_100%)] p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.push("/checkout")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {copy.back}
        </button>

        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <section className="rounded-[2rem] bg-slate-700 px-6 py-8 text-white shadow-[0_28px_80px_rgba(51,65,85,0.35)] md:px-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-white/70">{copy.orderSummary}</p>
                <h1 className="mt-3 text-3xl font-semibold">{payment.amountLabel}</h1>
                <p className="mt-2 text-sm text-white/70">{payment.planName}</p>
              </div>
              <Badge className="bg-white/12 text-white hover:bg-white/12">{badgeText}</Badge>
            </div>

            <div className="mt-8 space-y-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-white/70">{copy.plan}</span>
                <strong>{payment.planName}</strong>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-white/70">{copy.method}</span>
                <strong>{payment.method}</strong>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-white/70">{copy.orderId}</span>
                <span className="max-w-[14rem] truncate text-right text-white/80">{payment.id}</span>
              </div>
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-emerald-300/25 bg-emerald-400/10 p-4 text-sm text-emerald-50">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
                <div>
                  <div className="font-medium text-white">{copy.paymentInfo}</div>
                  <p className="mt-1 text-emerald-50/90">{copy.secure}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-border/70 bg-white/95 p-6 shadow-[0_28px_70px_rgba(15,23,42,0.08)] md:p-8">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">{copy.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.subtitle}</p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {isWechatHosted ? (
                <>
                  <div className="rounded-[1.25rem] border border-border p-4">
                    <div className="mb-3 flex items-center gap-2 font-medium text-foreground">
                      <QrCode className="h-4 w-4" />
                      {isCn ? "微信扫码支付" : "WeChat QR payment"}
                    </div>
                    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 p-4">
                      {wechatQrPreviewUrl && !wechatQrError ? (
                        <img
                          src={wechatQrPreviewUrl}
                          alt="WeChat Pay QR"
                          className="aspect-square w-full max-w-[320px] rounded-2xl border border-border bg-white object-contain"
                          onError={() => setWechatQrError(isCn ? "二维码渲染失败，请复制链接后手动扫码。" : "QR rendering failed. Copy the link and scan manually.")}
                        />
                      ) : (
                        <div className="px-6 text-center text-sm text-muted-foreground">
                          {wechatQrError || (isCn ? "正在生成微信支付二维码..." : "Generating the WeChat Pay QR code...")}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] border border-border p-4">
                    <div className="mb-3 flex items-center gap-2 font-medium text-foreground">
                      <CreditCard className="h-4 w-4" />
                      {copy.payMethod}
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-xl border border-border bg-secondary/40 p-3 text-sm">
                        <div className="font-medium text-foreground">{payment.method}</div>
                        <div className="mt-1 text-muted-foreground">
                          {isCn ? "请直接使用微信扫码支付，系统会自动刷新支付状态并在到账后跳转。" : "Scan with WeChat Pay and the page will auto-refresh the status before redirecting."}
                        </div>
                      </div>
                      <div className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground break-all">
                        {wechatCodeUrl || (isCn ? "正在等待二维码链接..." : "Waiting for the QR code link...")}
                      </div>
                      <Button variant="outline" onClick={copyWechatCodeUrl} disabled={!wechatCodeUrl}>
                        {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                        {copied ? (isCn ? "已复制二维码链接" : "QR link copied") : (isCn ? "复制二维码链接" : "Copy QR link")}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-[1.25rem] border border-border p-4">
                    <div className="mb-3 flex items-center gap-2 font-medium text-foreground">
                      <ReceiptText className="h-4 w-4" />
                      {copy.contact}
                    </div>
                    <div className="space-y-3">
                      <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder={isCn ? "邮箱" : "Email"} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary" />
                      <input value={cardholder} onChange={(event) => setCardholder(event.target.value)} placeholder={isCn ? "姓名" : "Name"} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary" />
                      <input value={country} onChange={(event) => setCountry(event.target.value)} placeholder={isCn ? "国家或地区" : "Country or region"} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary" />
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] border border-border p-4">
                    <div className="mb-3 flex items-center gap-2 font-medium text-foreground">
                      <CreditCard className="h-4 w-4" />
                      {copy.payMethod}
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-xl border border-border bg-secondary/40 p-3 text-sm">
                        <div className="font-medium text-foreground">{payment.method}</div>
                        <div className="mt-1 text-muted-foreground">{copy.hostedInfo}</div>
                      </div>
                      <div className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                        {copy.secure}
                      </div>
                      {showDebugActions ? (
                        <div className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                          {isCn ? "测试模式已开启，可使用调试动作辅助验证支付流程。" : "Test mode is enabled. Debug actions are available for payment-flow verification."}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 rounded-[1.25rem] border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                <p>{copy.hostedInfo}</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={cancel} disabled={checking}>
                {copy.cancel}
              </Button>
              <Button variant="outline" onClick={refreshStatus} disabled={checking} className="min-w-40">
                {checking ? copy.checking : copy.refresh}
              </Button>
              {!isWechatHosted ? (
                <Button onClick={verifyPaid} disabled={checking} className="min-w-48">
                  {checking ? copy.checking : copy.verify}
                </Button>
              ) : null}
              {showDebugActions ? (
                <Button variant="secondary" onClick={simulateCallback} disabled={checking} className="min-w-48">
                  {checking ? copy.checking : copy.demoCallback}
                </Button>
              ) : null}
              <Button variant="ghost" asChild>
                <a href={`/payment/success?paymentId=${encodeURIComponent(payment.id)}`}>{copy.gotoResult}</a>
              </Button>
            </div>
            {verifyMessage ? <p className="mt-4 text-sm text-muted-foreground">{verifyMessage}</p> : null}
          </section>
        </div>
      </div>
    </div>
  )
}

export default function HostedPaymentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading payment...</div>}>
      <HostedPaymentPageContent />
    </Suspense>
  )
}
