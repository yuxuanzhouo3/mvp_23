import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { getPayment } from "@/lib/payment-store"
import { createWechatPayPayment } from "@/lib/payment/providers/wechatpay"

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

  if (payment.method !== "wechatpay") {
    return NextResponse.json({ error: "Payment is not a WeChat Pay order" }, { status: 409 })
  }

  try {
    const origin = new URL(req.url).origin
    const result = await createWechatPayPayment({
      origin,
      paymentId: payment.id,
      provider: "wechatpay",
      region: payment.region,
      planId: String(payment.planId),
      planName: payment.planName,
      amountLabel: payment.amountLabel,
      method: payment.method,
    })

    return NextResponse.json({
      ok: true,
      payment: {
        id: payment.id,
        status: payment.status,
        method: payment.method,
        amountLabel: payment.amountLabel,
        planName: payment.planName,
      },
      codeUrl: result.qrCodeUrl || "",
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to initialize WeChat Pay session",
      },
      { status: 502 }
    )
  }
}
