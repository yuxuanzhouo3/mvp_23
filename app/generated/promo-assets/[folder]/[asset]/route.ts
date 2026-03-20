import path from "path"
import { promises as fs } from "fs"
import { NextResponse } from "next/server"
import { getPromoAssetsDir } from "@/lib/project-workspace"

export const runtime = "nodejs"

function contentTypeFor(asset: string) {
  if (asset.endsWith(".html")) return "text/html; charset=utf-8"
  if (asset.endsWith(".json")) return "application/json; charset=utf-8"
  if (asset.endsWith(".md")) return "text/markdown; charset=utf-8"
  return "text/plain; charset=utf-8"
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ folder: string; asset: string }> }
) {
  const { folder, asset } = await context.params
  const safeFolder = String(folder ?? "").replace(/[^a-zA-Z0-9_-]/g, "")
  const safeAsset = String(asset ?? "").replace(/[^a-zA-Z0-9._-]/g, "")

  if (!safeFolder || !safeAsset) {
    return new NextResponse("Not found", { status: 404 })
  }

  const filePath = path.join(getPromoAssetsDir(), safeFolder, safeAsset)

  try {
    const content = await fs.readFile(filePath)
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(safeAsset),
        "Cache-Control": safeFolder === "latest" ? "no-store" : "public, max-age=300",
      },
    })
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
}
