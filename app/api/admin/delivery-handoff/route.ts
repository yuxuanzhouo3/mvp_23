import { NextResponse } from "next/server"
import { listDeliveryHandoffs, updateDeliveryHandoff } from "@/lib/delivery-handoff-store"
import type { DeliveryStatus } from "@/lib/delivery-readiness"

export const runtime = "nodejs"

export async function GET() {
  const records = await listDeliveryHandoffs()
  return NextResponse.json({ records })
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    id?: "intl" | "cn"
    status?: DeliveryStatus
    phase?: string
    branchName?: string
    productionUrl?: string
    previewUrl?: string
    runtimeGuide?: string
    databaseChoice?: string
    lastBuildNote?: string
    latestVerification?: string
    verifiedAt?: string
    mustCloseItems?: string[]
    deferredItems?: string[]
    notes?: string[]
  }

  if (body.id !== "intl" && body.id !== "cn") {
    return NextResponse.json({ error: "id must be intl or cn" }, { status: 400 })
  }

  try {
    const record = await updateDeliveryHandoff({
      id: body.id,
      status: body.status,
      phase: body.phase,
      branchName: body.branchName,
      productionUrl: body.productionUrl,
      previewUrl: body.previewUrl,
      runtimeGuide: body.runtimeGuide,
      databaseChoice: body.databaseChoice,
      lastBuildNote: body.lastBuildNote,
      latestVerification: body.latestVerification,
      verifiedAt: body.verifiedAt,
      mustCloseItems: body.mustCloseItems,
      deferredItems: body.deferredItems,
      notes: body.notes,
    })
    return NextResponse.json({ record })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update handoff record" }, { status: 400 })
  }
}
