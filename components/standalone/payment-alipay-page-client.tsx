"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Copy, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type PaymentResp = {
  payment?: {
    id: string
    status: "pending" | "completed" | "cancelled"
    region: "cn" | "intl"
    method: string
    planName?: string
    amountLabel?: string
  }
}

function PaymentAlipayPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentId = searchParams.get("paymentId") || ""
  const sandbox = searchParams.get("sandbox") === "1"
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"pending" | "completed" | "cancelled">("pending")
  const [message, setMessage] = useState("")
  const [copied, setCopied] = useState(false)

  async function refreshStatus() {
    if (!paymentId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/payment/status?paymentId=${encodeURIComponent(paymentId)}&refresh=1`)
      const json = (await res.json().catch(() => ({}))) as PaymentResp
      setStatus(json?.payment?.status ?? "pending")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshStatus()
  }, [paymentId])

  useEffect(() => {
    if (!paymentId || status !== "pending") return
    const timer = window.setInterval(() => {
      void refreshStatus()
    }, 3000)
    return () => window.clearInterval(timer)
  }, [paymentId, status])

  useEffect(() => {
    if (!paymentId || status !== "completed") return
    router.push(`/payment/success?paymentId=${encodeURIComponent(paymentId)}`)
  }, [paymentId, router, status])

  const isCn = true
  const copy = useMemo(
    () =>
      isCn
        ? {
            title: "支付宝支付",
            subtitle: sandbox
              ? "当前处于沙盒模式，后续补齐密钥后会自动切换到真实支付宝收银台。"
              : "请使用支付宝完成支付，订单状态会自动同步。",
            sandboxBadge: "沙盒模式",
            orderId: "订单号",
            refresh: "刷新支付状态",
            verify: "确认已支付并校验到账",
            demoCallback: "模拟沙盒支付完成",
            back: "返回结账页",
            checking: "查询中...",
            pending: "处理中",
            paid: "已到账",
            cancelled: "已取消",
            verified: "已查询到支付成功，请进入结果页。",
            demoDone: "沙盒支付状态已更新，正在进入结果页。",
            notPaidYet: "未查询到支付成功，请稍后再试。",
            copyDone: "已复制订单号",
            copyHint: "复制订单号",
          }
        : {
            title: "Alipay",
            subtitle: sandbox
              ? "Sandbox mode is active. Once keys are added, this flow will switch to the live Alipay checkout."
              : "Complete the payment with Alipay and the order status will sync automatically.",
            sandboxBadge: "Sandbox",
            orderId: "Order ID",
            refresh: "Refresh status",
            verify: "I paid, verify status",
            demoCallback: "Simulate sandbox completion",
            back: "Back to checkout",
            checking: "Checking...",
            pending: "Processing",
            paid: "Paid",
            cancelled: "Cancelled",
            verified: "Payment verified. Opening the result page.",
            demoDone: "Sandbox payment state updated. Opening the result page.",
            notPaidYet: "No successful payment was found yet. Try again after completing the payment.",
            copyDone: "Order ID copied",
            copyHint: "Copy order ID",
          },
    [isCn, sandbox]
  )

  async function verifyPaid() {
    if (!paymentId) return
    setLoading(true)
    try {
      setMessage("")
      const res = await fetch("/api/payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      })
      const json = await res.json().catch(() => ({}))
      await refreshStatus()
      if (res.ok && json?.ok) {
        setMessage(copy.verified)
        router.push(`/payment/success?paymentId=${encodeURIComponent(paymentId)}`)
        return
      }
      setMessage(String(json?.error ?? copy.notPaidYet))
    } finally {
      setLoading(false)
    }
  }

  async function simulateCallback() {
    if (!paymentId) return
    setLoading(true)
    try {
      setMessage("")
      const res = await fetch("/api/payment/mock-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      })
      const json = await res.json().catch(() => ({}))
      await refreshStatus()
      if (!res.ok) {
        setMessage(String(json?.error ?? copy.notPaidYet))
        return
      }
      setMessage(copy.demoDone)
      router.push(`/payment/success?paymentId=${encodeURIComponent(paymentId)}`)
    } finally {
      setLoading(false)
    }
  }

  async function copyOrderId() {
    if (!paymentId) return
    try {
      await navigator.clipboard.writeText(paymentId)
      setMessage(copy.copyDone)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setMessage(copy.copyHint)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="border-border/80">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{copy.title}</CardTitle>
            <div className="flex items-center gap-2">
              {sandbox ? <Badge variant="outline">{copy.sandboxBadge}</Badge> : null}
              <Badge variant={status === "completed" ? "secondary" : status === "cancelled" ? "destructive" : "outline"}>
                {status === "completed" ? copy.paid : status === "cancelled" ? copy.cancelled : copy.pending}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>

          <div className="rounded-2xl border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">
            {sandbox
              ? isCn
                ? "当前订单未配置真实支付宝密钥，已自动进入沙盒页。后续补齐 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY 后会切换到真实收银台。"
                : "This order is using the sandbox checkout because the Alipay credentials are not configured yet."
              : isCn
                ? "这是一条真实支付宝支付链路。"
                : "This is a live Alipay payment flow."}
          </div>

          <div className="rounded-2xl border border-border p-4 text-sm break-all">
            <div className="mb-2 font-medium">{copy.orderId}</div>
            <div className="text-muted-foreground">{paymentId || "-"}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {status !== "completed" ? (
              <Button onClick={verifyPaid} disabled={loading}>
                {loading ? copy.checking : copy.verify}
              </Button>
            ) : (
              <Button asChild>
                <Link href={`/payment/success?paymentId=${encodeURIComponent(paymentId)}`}>进入支付成功页</Link>
              </Button>
            )}
            <Button variant="outline" onClick={refreshStatus} disabled={loading}>
              {loading ? copy.checking : copy.refresh}
            </Button>
            <Button variant="secondary" onClick={simulateCallback} disabled={loading}>
              {copy.demoCallback}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="ghost" onClick={copyOrderId} disabled={!paymentId}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? copy.copyDone : copy.copyHint}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/checkout">{copy.back}</Link>
            </Button>
          </div>

          {message ? (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              <span>{message}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

export default function PaymentAlipayPageClient() {
  return <PaymentAlipayPageContent />
}
