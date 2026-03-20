import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { listPaymentsByUser } from "@/lib/payment-store"

export const runtime = "nodejs"

export async function GET() {
  const current = await getCurrentSession()
  if (!current) {
    return NextResponse.json({ error: "Please sign in first" }, { status: 401 })
  }

  const payments = await listPaymentsByUser(current.user.id)
  return NextResponse.json({ ok: true, payments })
}
