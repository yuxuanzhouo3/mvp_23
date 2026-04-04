import { NextResponse } from "next/server"
import { listDistributionAssets, updateDistributionAsset } from "@/lib/distribution-asset-store"

export const runtime = "nodejs"

export async function GET() {
  const assets = await listDistributionAssets()
  return NextResponse.json({ assets })
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    id?: string
    href?: string
    status?: "ready" | "in_progress" | "planned" | "blocked"
    notes?: string[]
  }

  const id = String(body?.id ?? "").trim()
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  try {
    const asset = await updateDistributionAsset({
      id,
      href: typeof body.href === "string" ? body.href : undefined,
      status: body.status,
      notes: Array.isArray(body.notes) ? body.notes : undefined,
    })
    return NextResponse.json({ asset })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update asset" }, { status: 400 })
  }
}
