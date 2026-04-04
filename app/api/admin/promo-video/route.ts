import { NextResponse } from "next/server"

type PromoVideoRequest = {
  appName?: string
  websiteUrl?: string
  audience?: string
  highlights?: string[]
}

function normalizeHighlights(input: unknown) {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 6)
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as PromoVideoRequest
  const appName = String(body.appName ?? "").trim() || "MornstackIntl"
  const websiteUrl = String(body.websiteUrl ?? "").trim() || "https://www.mornscience.app/"
  const audience = String(body.audience ?? "").trim() || "AI app builders and product teams"
  const highlights = normalizeHighlights(body.highlights)

  const scenes = [
    {
      title: "Opening hook",
      durationSec: 5,
      visual: `Show ${appName} landing page hero with strong headline and instant product value.`,
      voiceover: `${appName} helps teams go from prompt to full-stack product in minutes.`,
    },
    {
      title: "Template and generation",
      durationSec: 7,
      visual: "Demonstrate template selection, prompt input, and one-click generation.",
      voiceover: `Pick a template, describe the app, and generate a polished workspace for ${audience}.`,
    },
    {
      title: "Preview and iteration",
      durationSec: 7,
      visual: "Show live preview panel, editing flow, and iterative improvement screens.",
      voiceover: "Preview the result instantly and keep refining without breaking the overall product language.",
    },
    {
      title: "Multi-surface delivery",
      durationSec: 6,
      visual: "Display official website, admin console, API docs, Android APK, and iOS download cards.",
      voiceover: "Ship one product story across the website, admin backend, docs, and mobile delivery surfaces.",
    },
    {
      title: "Closing CTA",
      durationSec: 5,
      visual: `End on the product URL and QR-style mobile download section: ${websiteUrl}`,
      voiceover: `Open ${websiteUrl} to experience ${appName} live.`,
    },
  ]

  return NextResponse.json({
    status: "ok",
    appName,
    websiteUrl,
    audience,
    highlights,
    totalDurationSec: scenes.reduce((sum, scene) => sum + scene.durationSec, 0),
    posterTitle: `${appName} product promo`,
    output: {
      aspectRatio: "16:9",
      format: "mp4",
      resolution: "1920x1080",
      status: "storyboard_ready",
    },
    scenes,
  })
}
