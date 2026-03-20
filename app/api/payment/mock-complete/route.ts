import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { getPayment, updatePaymentStatus } from "@/lib/payment-store"

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

  if (payment.status === "cancelled") {
    return NextResponse.json({ error: "Cancelled payments cannot be completed" }, { status: 409 })
  }

  const updated = await updatePaymentStatus(paymentId, "completed")
  return NextResponse.json({
    ok: true,
    payment: updated,
    mode: "demo-callback",
  })
}
