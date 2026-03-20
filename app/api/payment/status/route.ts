import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { getPayment } from "@/lib/payment-store"

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

  return NextResponse.json({ ok: true, payment })
}
