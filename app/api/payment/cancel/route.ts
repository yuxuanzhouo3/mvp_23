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

  const updated = await updatePaymentStatus(paymentId, "cancelled")
  return NextResponse.json({ ok: true, payment: updated })
}
