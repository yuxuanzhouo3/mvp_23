import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { getPayment, updatePaymentStatus } from "@/lib/payment-store"
import { mapWechatTradeStateToPaymentStatus, queryWechatPayTransactionByOutTradeNo } from "@/lib/payment/providers/wechatpay"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const current = await getCurrentSession()
  if (!current) {
    return NextResponse.json({ error: "Please sign in first" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const paymentId = String(body?.paymentId ?? "").trim()
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId is required" }, { status: 400 })
  }

  const payment = await getPayment(paymentId)
  if (!payment || payment.userId !== current.user.id) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  }

  if (payment.status === "pending" && payment.method === "wechatpay") {
    try {
      const transaction = await queryWechatPayTransactionByOutTradeNo(payment.id)
      const nextStatus = mapWechatTradeStateToPaymentStatus(transaction?.trade_state)
      if (nextStatus !== payment.status) {
        const updated = await updatePaymentStatus(payment.id, nextStatus)
        if (updated) {
          if (updated.status === "completed") {
            return NextResponse.json({
              ok: true,
              payment: updated,
              message: "WeChat Pay verified successfully.",
            })
          }
          if (updated.status === "cancelled") {
            return NextResponse.json(
              {
                ok: false,
                payment: updated,
                error: "Payment has been cancelled.",
              },
              { status: 409 }
            )
          }
        }
      }
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          payment,
          error: error instanceof Error ? error.message : "WeChat Pay verification failed.",
        },
        { status: 502 }
      )
    }
  }

  if (payment.status === "completed") {
    return NextResponse.json({
      ok: true,
      payment,
      message: "Payment verified successfully.",
    })
  }

  if (payment.status === "cancelled") {
    return NextResponse.json(
      {
        ok: false,
        payment,
        error: "Payment has been cancelled.",
      },
      { status: 409 }
    )
  }

  return NextResponse.json(
    {
      ok: false,
      payment,
      error: "No successful payment was found yet.",
    },
    { status: 409 }
  )
}
