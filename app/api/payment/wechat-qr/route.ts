import { NextResponse } from "next/server"
import QRCode from "qrcode"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const data = String(searchParams.get("data") ?? "").trim()
  if (!data) {
    return NextResponse.json({ error: "data is required" }, { status: 400 })
  }

  try {
    const svg = await QRCode.toString(data, {
      type: "svg",
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
    })
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to render QR code",
      },
      { status: 502 }
    )
  }
}
