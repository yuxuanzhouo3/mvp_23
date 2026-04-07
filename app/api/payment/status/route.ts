import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { getPayment, updatePaymentStatus } from "@/lib/payment-store"
import { mapWechatTradeStateToPaymentStatus, queryWechatPayTransactionByOutTradeNo } from "@/lib/payment/providers/wechatpay"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const current = await getCurrentSession()
  if (!current) {
    return NextResponse.json({ error: "Please sign in first" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const paymentId = String(searchParams.get("paymentId") ?? "").trim()
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId is required" }, { status: 400 })
  }

  const payment = await getPayment(paymentId)
  if (!payment || payment.userId !== current.user.id) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  }

  let resolvedPayment = payment
  const shouldRefreshProvider =
    payment.method === "wechatpay" &&
    payment.status === "pending" &&
    String(searchParams.get("refresh") ?? "").trim() !== "0"

  if (shouldRefreshProvider) {
    try {
      const transaction = await queryWechatPayTransactionByOutTradeNo(payment.id)
      const nextStatus = mapWechatTradeStateToPaymentStatus(transaction?.trade_state)
      if (nextStatus !== payment.status) {
        resolvedPayment = (await updatePaymentStatus(payment.id, nextStatus)) ?? payment
      }
    } catch {
      resolvedPayment = payment
    }
  }

  return NextResponse.json({ ok: true, payment: resolvedPayment })
}
