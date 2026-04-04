"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type PaymentResp = {
  payment?: {
    id: string
    status: "pending" | "completed" | "cancelled"
    region: "cn" | "intl"
  }
}

function WechatPaymentPageContent() {
  const searchParams = useSearchParams()
  const paymentId = searchParams.get("paymentId") || ""
  const codeUrl = searchParams.get("codeUrl") || ""
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"pending" | "completed" | "cancelled">("pending")
  const [message, setMessage] = useState("")

  async function refreshStatus() {
    if (!paymentId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/payment/status?paymentId=${encodeURIComponent(paymentId)}`)
      const json = (await res.json().catch(() => ({}))) as PaymentResp
      setStatus(json?.payment?.status ?? "pending")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshStatus()
  }, [paymentId])

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
        setMessage("已查询到支付成功，请进入结果页。")
        return
      }
      setMessage(json?.error === "No successful payment was found yet." ? "未查询到支付成功，请稍后再试。" : String(json?.error ?? "未查询到支付成功，请稍后再试。"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="border-border/80">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>微信支付</CardTitle>
            <Badge variant={status === "completed" ? "secondary" : status === "cancelled" ? "destructive" : "outline"}>
              {status === "completed" ? "已到账" : status === "cancelled" ? "已取消" : "处理中"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            请使用微信完成支付，支付结果会自动同步到当前订单。
          </p>
          <div className="rounded-2xl border border-border p-4 text-sm break-all">
            <div className="font-medium mb-2">二维码链接</div>
            <div className="text-muted-foreground">{codeUrl || "暂无二维码链接"}</div>
          </div>
          <div className="rounded-2xl border border-border p-4 text-sm break-all">
            <div className="font-medium mb-2">订单号</div>
            <div className="text-muted-foreground">{paymentId}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Button onClick={verifyPaid} disabled={loading}>
              {loading ? "查询中..." : "确认已支付并校验到账"}
            </Button>
            <Button onClick={refreshStatus} disabled={loading}>
              {loading ? "刷新中..." : "刷新支付状态"}
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/payment/success?paymentId=${encodeURIComponent(paymentId)}`}>查看当前结果页</Link>
            </Button>
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button variant="ghost" asChild>
            <Link href="/checkout">返回结账页</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function WechatPaymentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading WeChat payment...</div>}>
      <WechatPaymentPageContent />
    </Suspense>
  )
}
