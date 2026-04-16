"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Clock3, ReceiptText, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type PaymentData = {
  id: string
  planName: string
  amountLabel: string
  method: string
  region: "cn" | "intl"
  status: "pending" | "completed" | "cancelled"
  createdAt: string
}

function PaymentSuccessPageContent() {
  const searchParams = useSearchParams()
  const paymentId = searchParams.get("paymentId") || ""
  const sessionId = searchParams.get("session_id") || ""
  const [payment, setPayment] = useState<PaymentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!paymentId) {
      setLoading(false)
      setError("missing-payment-id")
      return
    }

    const statusUrl = new URL(`/api/payment/status`, window.location.origin)
    statusUrl.searchParams.set("paymentId", paymentId)
    if (sessionId) {
      statusUrl.searchParams.set("session_id", sessionId)
    }

    fetch(statusUrl.toString())
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(String(json?.error ?? "Payment not found"))
        }
        setPayment(json.payment ?? null)
      })
      .catch((err: any) => setError(err?.message || "Payment not found"))
      .finally(() => setLoading(false))
  }, [paymentId, sessionId])

  const isCn = payment?.region === "cn" || error === "missing-payment-id"

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {isCn ? "正在确认支付状态..." : "Checking payment status..."}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{isCn ? "未找到订单" : "Payment not found"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isCn ? "当前没有可确认的支付订单，请从结账页重新发起支付。" : "There is no payable order to confirm. Start again from checkout."}
            </p>
            <Button asChild>
              <Link href="/checkout">{isCn ? "返回结账页" : "Back to checkout"}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const copy =
    payment.region === "cn"
      ? {
          successTitle: "支付成功",
          pendingTitle: "订单待支付",
          cancelledTitle: "订单已取消",
          successDesc: "订单已确认完成，额度和套餐信息已经写入当前账号。",
          pendingDesc: "订单已经创建，但还没有完成支付。请继续前往支付确认页完成结账。",
          cancelledDesc: "该订单已经取消，如需继续开通请重新创建支付。",
          backCheckout: "返回支付中心",
          continuePay: "继续支付",
          openProjects: "查看项目",
          paymentIdLabel: "订单号",
          summary: "订单摘要",
        }
      : {
          successTitle: "Payment successful",
          pendingTitle: "Payment pending",
          cancelledTitle: "Payment cancelled",
          successDesc: "The order is completed and the plan has been activated for your account.",
          pendingDesc: "The order exists, but payment has not been completed yet. Return to the payment confirmation page to continue.",
          cancelledDesc: "This order was cancelled. Start a new checkout if you want to continue.",
          backCheckout: "Back to checkout",
          continuePay: "Continue payment",
          openProjects: "Open projects",
          paymentIdLabel: "Payment ID",
          summary: "Order summary",
        }

  const statusConfig =
    payment.status === "completed"
      ? {
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
          title: copy.successTitle,
          desc: copy.successDesc,
          badge: <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">{payment.status}</Badge>,
        }
      : payment.status === "cancelled"
        ? {
            icon: <XCircle className="h-5 w-5 text-rose-600" />,
            title: copy.cancelledTitle,
            desc: copy.cancelledDesc,
            badge: <Badge variant="destructive">{payment.status}</Badge>,
          }
        : {
            icon: <Clock3 className="h-5 w-5 text-amber-600" />,
            title: copy.pendingTitle,
            desc: copy.pendingDesc,
            badge: <Badge variant="secondary">{payment.status}</Badge>,
          }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="border-border/80">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {statusConfig.icon}
              <CardTitle>{statusConfig.title}</CardTitle>
            </div>
            {statusConfig.badge}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">{statusConfig.desc}</p>

          <div className="rounded-2xl border border-border p-4">
            <div className="mb-3 flex items-center gap-2 font-medium text-foreground">
              <ReceiptText className="h-4 w-4" />
              {copy.summary}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{payment.planName}</span>
                <strong>{payment.amountLabel}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{payment.method}</span>
                <span>{new Date(payment.createdAt).toLocaleString(payment.region === "cn" ? "zh-CN" : "en-US")}</span>
              </div>
              <div className="pt-2 text-xs text-muted-foreground break-all">
                {copy.paymentIdLabel}: {payment.id}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {payment.status === "pending" ? (
              <Button asChild>
                <Link href={`/payment/hosted?paymentId=${encodeURIComponent(payment.id)}`}>{copy.continuePay}</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/checkout">{copy.backCheckout}</Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href={payment.status === "completed" ? "/projects" : "/checkout"}>
                {payment.status === "completed" ? copy.openProjects : copy.backCheckout}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading payment result...</div>}>
      <PaymentSuccessPageContent />
    </Suspense>
  )
}
