import path from "path"
import { promises as fs } from "fs"
import { NextResponse } from "next/server"
import { requestJsonChatCompletion, resolveAiConfig } from "@/lib/ai-provider"
import { ensureDir, getPromoAssetsDir, writeTextFile } from "@/lib/project-workspace"

type PromoBundleRequest = {
  productName?: string
  websiteUrl?: string
  audience?: string
  highlights?: string[]
  references?: string
}

type PromoBundle = {
  brandLine: string
  campaignTitle: string
  launchNarrative: string
  visualDirection: string
  videoScript: {
    title: string
    totalDurationSec: number
    scenes: Array<{
      title: string
      durationSec: number
      visualCue: string
      visual: string
      voiceover: string
    }>
  }
  pptDeck: {
    title: string
    slides: Array<{
      slideTitle: string
      slideGoal: string
      visualCue: string
      bullets: string[]
      presenterNote: string
    }>
  }
}

function slugify(input: string) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "promo"
}

function parseJsonObject(raw: string) {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response is not valid JSON")
  }
  return JSON.parse(raw.slice(start, end + 1)) as PromoBundle
}

function buildFallbackBundle(input: Required<PromoBundleRequest>): PromoBundle {
  return {
    brandLine: `${input.productName} | Prompt to product in one workflow`,
    campaignTitle: `${input.productName} boss-ready launch story`,
    launchNarrative: `${input.productName} connects prompt-based generation, admin operations, sales delivery, and multi-surface launch assets into one product story that a boss can understand in minutes.`,
    visualDirection: "Warm premium editorial look, cream-to-white gradients, amber highlight color, product-led screenshots, and clean investor-demo pacing.",
    videoScript: {
      title: `${input.productName} promo storyboard`,
      totalDurationSec: 30,
      scenes: [
        {
          title: "Hook",
          durationSec: 5,
          visualCue: "Bold hero headline over polished product UI with premium warm gradient lighting.",
          visual: `Open with ${input.productName} homepage and bold product statement.`,
          voiceover: `${input.productName} turns product ideas into working software fast.`,
        },
        {
          title: "Generation",
          durationSec: 7,
          visualCue: "Prompt box, template cards, progress motion, and first live preview appearing on screen.",
          visual: "Show prompt input, template selection, and generation progress.",
          voiceover: "Choose a template, enter a prompt, and generate a product-ready workspace.",
        },
        {
          title: "Admin and market",
          durationSec: 7,
          visualCue: "Fast cross-cut between admin dashboard, market landing page, docs, and asset export screens.",
          visual: "Cut between admin backend, market backend, and document center.",
          voiceover: "Keep operations in admin, sales and campaign assets in market, and align the whole team around one product story.",
        },
        {
          title: "Mobile and docs",
          durationSec: 6,
          visualCue: "Show doc page, Android APK card, iPhone download, and a QR scan moment in one sequence.",
          visual: "Show Android APK, iOS download, docs, and QR scan moments.",
          voiceover: "Share your official site, docs, and mobile delivery links in one polished flow.",
        },
        {
          title: "CTA",
          durationSec: 5,
          visualCue: "Clean end frame with URL, logo lockup, and clear call to action for demo follow-up.",
          visual: `End on ${input.websiteUrl} and the product logo.`,
          voiceover: `Open ${input.websiteUrl} to explore ${input.productName}.`,
        },
      ],
    },
    pptDeck: {
      title: `${input.productName} boss demo deck`,
      slides: [
        {
          slideTitle: "What it is",
          slideGoal: "Establish product positioning and explain why the platform matters right now.",
          visualCue: "One full-width hero screenshot with three compact value chips underneath.",
          bullets: [
            `${input.productName} is an AI app builder for ${input.audience}.`,
            "Prompt, template, and plan tier drive the output.",
            "Admin and market surfaces support different business roles.",
          ],
          presenterNote: "Lead with the business value before demoing product details.",
        },
        {
          slideTitle: "What is live now",
          slideGoal: "Show that the current product already has enough surface area for a credible live demo.",
          visualCue: "Grid of current live surfaces: generation, preview, admin, market, docs, and mobile.",
          bullets: [
            "Template-driven generation chain",
            "Live preview and iteration",
            "Admin backend and sales backend separation",
          ],
          presenterNote: "Use screenshots from the current MVP for this slide.",
        },
        {
          slideTitle: "How to demo",
          slideGoal: "Give the presenter a fast, low-risk sequence that works in front of leadership or clients.",
          visualCue: "Numbered path with market, login, checkout, payment result, and admin export.",
          bullets: [
            "Open market page for website/docs/mobile links",
            "Open admin page for promo bundle generation",
            "Generate a workspace and show preview",
          ],
          presenterNote: "Keep the flow fast and visual.",
        },
        {
          slideTitle: "Core highlights",
          slideGoal: "Translate the strongest product advantages into memorable talking points.",
          visualCue: "Large statement slide with supporting visual snippets from the product.",
          bullets: input.highlights,
          presenterNote: "Map each highlight to a real screen in the demo.",
        },
        {
          slideTitle: "Next gap to close",
          slideGoal: "Show a realistic roadmap and prove the team knows the remaining production gaps.",
          visualCue: "Three-column roadmap with Now, Next, and Production Ready markers.",
          bullets: [
            "Stronger style lock across repeated generations",
            "Screenshot-grade template asset library",
            "Real payment callback verification and production deployment",
          ],
          presenterNote: "End with a realistic roadmap, not a vague vision statement.",
        },
      ],
    },
  }
}

function renderVideoMarkdown(bundle: PromoBundle) {
  return `# ${bundle.videoScript.title}

Brand line: ${bundle.brandLine}
Campaign title: ${bundle.campaignTitle}
Launch narrative: ${bundle.launchNarrative}
Visual direction: ${bundle.visualDirection}
Total duration: ${bundle.videoScript.totalDurationSec}s

${bundle.videoScript.scenes
  .map(
    (scene, index) => `## Scene ${index + 1} - ${scene.title}

- Duration: ${scene.durationSec}s
- Visual cue: ${scene.visualCue}
- Visual: ${scene.visual}
- Voiceover: ${scene.voiceover}
`
  )
  .join("\n")}`
}

function renderPptMarkdown(bundle: PromoBundle) {
  return `# ${bundle.pptDeck.title}

Campaign title: ${bundle.campaignTitle}
Launch narrative: ${bundle.launchNarrative}
Visual direction: ${bundle.visualDirection}

${bundle.pptDeck.slides
  .map(
    (slide, index) => `## Slide ${index + 1} - ${slide.slideTitle}

- Slide goal: ${slide.slideGoal}
- Visual cue: ${slide.visualCue}
${slide.bullets.map((item) => `- ${item}`).join("\n")}

Presenter note: ${slide.presenterNote}
`
  )
  .join("\n")}`
}

function renderBaseHtml({
  title,
  eyebrow,
  heroTitle,
  heroBody,
  heroMeta,
  sections,
}: {
  title: string
  eyebrow: string
  heroTitle: string
  heroBody: string
  heroMeta: string[]
  sections: Array<{ title: string; body: string }>
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        --panel: rgba(255,255,255,0.9);
        --ink: #0f172a;
        --muted: #475569;
        --line: rgba(15,23,42,0.1);
        --accent: #d97706;
        --accent-soft: rgba(217,119,6,0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "PingFang SC", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top, rgba(251,191,36,0.18), transparent 30%),
          linear-gradient(180deg, #faf7ef 0%, #ffffff 48%, #f8fafc 100%);
      }
      main { max-width: 1240px; margin: 0 auto; padding: 40px 20px 72px; }
      .hero, .card {
        border: 1px solid var(--line);
        background: var(--panel);
        backdrop-filter: blur(12px);
        border-radius: 30px;
        box-shadow: 0 24px 70px rgba(15,23,42,0.08);
      }
      .hero { padding: 32px; }
      .eyebrow {
        display: inline-flex;
        border-radius: 999px;
        padding: 6px 12px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 { margin: 16px 0 12px; font-size: clamp(36px, 6vw, 66px); line-height: 0.96; }
      h2 { margin: 0 0 18px; font-size: 28px; }
      h3 { margin: 0 0 10px; font-size: 20px; }
      p, li { color: var(--muted); line-height: 1.7; }
      .meta { display: grid; gap: 14px; margin-top: 24px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
      .meta div, .card {
        border: 1px solid var(--line);
        border-radius: 24px;
        background: rgba(255,255,255,0.8);
      }
      .meta div { padding: 14px 16px; }
      .section { margin-top: 34px; }
      .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
      .card { padding: 22px; }
      .note { font-style: italic; }
      .label { color: var(--ink); font-weight: 600; }
      ul { padding-left: 20px; margin: 12px 0 0; }
      .stack { display: grid; gap: 12px; }
      a { color: inherit; }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="eyebrow">${eyebrow}</div>
        <h1>${heroTitle}</h1>
        <p>${heroBody}</p>
        <div class="meta">
          ${heroMeta.map((item) => `<div>${item}</div>`).join("")}
        </div>
      </section>
      ${sections
        .map(
          (section) => `
            <section class="section">
              <h2>${section.title}</h2>
              ${section.body}
            </section>
          `
        )
        .join("")}
    </main>
  </body>
</html>`
}

function renderBundleHtml(bundle: PromoBundle, input: Required<PromoBundleRequest>, generator: string) {
  const sceneCards = bundle.videoScript.scenes
    .map(
      (scene, index) => `
        <section class="card">
          <div class="eyebrow">Scene ${index + 1}</div>
          <h3>${scene.title}</h3>
          <p><span class="label">Visual cue:</span> ${scene.visualCue}</p>
          <p><strong>Duration:</strong> ${scene.durationSec}s</p>
          <p><strong>Visual:</strong> ${scene.visual}</p>
          <p><strong>Voiceover:</strong> ${scene.voiceover}</p>
        </section>
      `
    )
    .join("")

  const slideCards = bundle.pptDeck.slides
    .map(
      (slide, index) => `
        <section class="card">
          <div class="eyebrow">Slide ${index + 1}</div>
          <h3>${slide.slideTitle}</h3>
          <p><span class="label">Goal:</span> ${slide.slideGoal}</p>
          <p><span class="label">Visual cue:</span> ${slide.visualCue}</p>
          <ul>${slide.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}</ul>
          <p class="note">${slide.presenterNote}</p>
        </section>
      `
    )
    .join("")

  return renderBaseHtml({
    title: `${input.productName} Promo Bundle`,
    eyebrow: "Boss Demo Bundle",
    heroTitle: bundle.campaignTitle,
    heroBody: bundle.launchNarrative,
    heroMeta: [
      `<strong>Brand line</strong><br />${bundle.brandLine}`,
      `<strong>Visual direction</strong><br />${bundle.visualDirection}`,
      `<strong>Website</strong><br />${input.websiteUrl}`,
      `<strong>Generator</strong><br />${generator}`,
      `<strong>Total storyboard</strong><br />${bundle.videoScript.totalDurationSec}s`,
      `<strong>Audience</strong><br />${input.audience}`,
    ],
    sections: [
      {
        title: "Quick Files",
        body: `<div class="grid">
          <a class="card" href="./promo-video-storyboard.html"><h3>Video storyboard page</h3><p>Open the standalone scene-by-scene storyboard.</p></a>
          <a class="card" href="./promo-ppt-copy.html"><h3>PPT copy page</h3><p>Open the standalone boss deck presentation page.</p></a>
          <a class="card" href="./promo-video-script.md"><h3>Video script markdown</h3><p>Raw copy for editing and export.</p></a>
          <a class="card" href="./promo-ppt-demo.md"><h3>PPT deck markdown</h3><p>Raw deck outline for design handoff.</p></a>
          <a class="card" href="./promo-bundle.json"><h3>Bundle JSON</h3><p>Structured data with campaign fields and slide cues.</p></a>
          <a class="card" href="./promo-brief.json"><h3>Brief JSON</h3><p>Input and generation manifest.</p></a>
        </div>`,
      },
      { title: "Storyboard", body: `<div class="grid">${sceneCards}</div>` },
      { title: "Deck Outline", body: `<div class="grid">${slideCards}</div>` },
    ],
  })
}

function renderVideoStoryboardHtml(bundle: PromoBundle, input: Required<PromoBundleRequest>) {
  const sceneCards = bundle.videoScript.scenes
    .map(
      (scene, index) => `
        <section class="card">
          <div class="eyebrow">Scene ${index + 1}</div>
          <h3>${scene.title}</h3>
          <div class="stack">
            <p><span class="label">Duration</span><br />${scene.durationSec}s</p>
            <p><span class="label">Visual cue</span><br />${scene.visualCue}</p>
            <p><span class="label">Visual direction</span><br />${scene.visual}</p>
            <p><span class="label">Voiceover</span><br />${scene.voiceover}</p>
          </div>
        </section>
      `
    )
    .join("")

  return renderBaseHtml({
    title: `${input.productName} Video Storyboard`,
    eyebrow: "Promo Storyboard",
    heroTitle: bundle.videoScript.title,
    heroBody: `${bundle.launchNarrative} This page is optimized for quick review by founders, video editors, or demo presenters.`,
    heroMeta: [
      `<strong>Campaign title</strong><br />${bundle.campaignTitle}`,
      `<strong>Brand line</strong><br />${bundle.brandLine}`,
      `<strong>Visual direction</strong><br />${bundle.visualDirection}`,
      `<strong>Total duration</strong><br />${bundle.videoScript.totalDurationSec}s`,
    ],
    sections: [{ title: "Scene Breakdown", body: `<div class="grid">${sceneCards}</div>` }],
  })
}

function renderPptCopyHtml(bundle: PromoBundle, input: Required<PromoBundleRequest>) {
  const slideCards = bundle.pptDeck.slides
    .map(
      (slide, index) => `
        <section class="card">
          <div class="eyebrow">Slide ${index + 1}</div>
          <h3>${slide.slideTitle}</h3>
          <p><span class="label">Slide goal</span><br />${slide.slideGoal}</p>
          <p><span class="label">Visual cue</span><br />${slide.visualCue}</p>
          <ul>${slide.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}</ul>
          <p class="note">${slide.presenterNote}</p>
        </section>
      `
    )
    .join("")

  return renderBaseHtml({
    title: `${input.productName} PPT Copy`,
    eyebrow: "Boss Deck",
    heroTitle: bundle.pptDeck.title,
    heroBody: `${bundle.launchNarrative} This page is optimized for boss-facing presentation prep and design handoff.`,
    heroMeta: [
      `<strong>Campaign title</strong><br />${bundle.campaignTitle}`,
      `<strong>Audience</strong><br />${input.audience}`,
      `<strong>Brand line</strong><br />${bundle.brandLine}`,
      `<strong>Visual direction</strong><br />${bundle.visualDirection}`,
    ],
    sections: [{ title: "Slide Copy", body: `<div class="grid">${slideCards}</div>` }],
  })
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as PromoBundleRequest
  const normalized: Required<PromoBundleRequest> = {
    productName: String(body.productName ?? "").trim() || "MornstackIntl",
    websiteUrl: String(body.websiteUrl ?? "").trim() || "https://www.mornscience.app/",
    audience: String(body.audience ?? "").trim() || "product teams and AI app builders",
    highlights: Array.isArray(body.highlights) && body.highlights.length
      ? body.highlights.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 8)
      : [
          "Prompt to full-stack app generation",
          "Template-driven polish and preview",
          "Admin backend and market backend split",
          "Website, docs, APK, and iOS delivery surfaces",
        ],
    references: String(body.references ?? "").trim(),
  }

  let bundle = buildFallbackBundle(normalized)
  let generator = "fallback"

  try {
    const config = resolveAiConfig()
    const system = [
      "You generate structured launch assets for product demos.",
      "Return strict JSON only.",
      'Schema: {"brandLine":"...","campaignTitle":"...","launchNarrative":"...","visualDirection":"...","videoScript":{"title":"...","totalDurationSec":30,"scenes":[{"title":"...","durationSec":5,"visualCue":"...","visual":"...","voiceover":"..."}]},"pptDeck":{"title":"...","slides":[{"slideTitle":"...","slideGoal":"...","visualCue":"...","bullets":["..."],"presenterNote":"..."}]}}',
      "Keep it concise, demo-friendly, and investor/boss presentation ready.",
    ].join("\n")
    const user = [
      `Product: ${normalized.productName}`,
      `Website: ${normalized.websiteUrl}`,
      `Audience: ${normalized.audience}`,
      `Highlights: ${normalized.highlights.join(" | ")}`,
      `References: ${normalized.references || "Current MVP with /admin and /market split."}`,
      "Create one promo video storyboard and one PPT demo deck outline.",
    ].join("\n\n")
    const { content } = await requestJsonChatCompletion({
      config,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      timeoutMs: 90_000,
    })
    bundle = parseJsonObject(content)
    generator = "ai"
  } catch {
    // Keep deterministic fallback bundle when AI is unavailable.
  }

  const folderName = `${new Date().toISOString().slice(0, 10)}-${slugify(normalized.productName)}`
  const runtimePromoRoot = getPromoAssetsDir()
  const outDir = path.join(runtimePromoRoot, folderName)
  const latestDir = path.join(runtimePromoRoot, "latest")
  await ensureDir(outDir)
  await ensureDir(latestDir)

  const brief = {
    generatedAt: new Date().toISOString(),
    generator,
    input: normalized,
    outputs: {
      videoScript: "promo-video-script.md",
      pptDeck: "promo-ppt-demo.md",
      videoStoryboardHtml: "promo-video-storyboard.html",
      pptCopyHtml: "promo-ppt-copy.html",
      previewHtml: "index.html",
      bundleJson: "promo-bundle.json",
    },
  }

  await writeTextFile(path.join(outDir, "README.md"), `# Promo Bundle - ${normalized.productName}

This folder was generated for boss/demo presentation use.

- Generator: ${generator}
- Website: ${normalized.websiteUrl}
- Audience: ${normalized.audience}
- Files:
  - promo-video-script.md
  - promo-ppt-demo.md
  - promo-video-storyboard.html
  - promo-ppt-copy.html
  - index.html
  - promo-bundle.json
`)
  await writeTextFile(path.join(outDir, "promo-video-script.md"), renderVideoMarkdown(bundle))
  await writeTextFile(path.join(outDir, "promo-ppt-demo.md"), renderPptMarkdown(bundle))
  await writeTextFile(path.join(outDir, "promo-video-storyboard.html"), renderVideoStoryboardHtml(bundle, normalized))
  await writeTextFile(path.join(outDir, "promo-ppt-copy.html"), renderPptCopyHtml(bundle, normalized))
  await writeTextFile(path.join(outDir, "promo-bundle.json"), JSON.stringify(bundle, null, 2))
  await writeTextFile(path.join(outDir, "promo-brief.json"), JSON.stringify(brief, null, 2))
  await writeTextFile(path.join(outDir, "index.html"), renderBundleHtml(bundle, normalized, generator))

  await writeTextFile(path.join(latestDir, "README.md"), `# Promo Bundle - ${normalized.productName}

Latest public mirror for boss/demo review.
`)
  await writeTextFile(path.join(latestDir, "promo-video-script.md"), renderVideoMarkdown(bundle))
  await writeTextFile(path.join(latestDir, "promo-ppt-demo.md"), renderPptMarkdown(bundle))
  await writeTextFile(path.join(latestDir, "promo-video-storyboard.html"), renderVideoStoryboardHtml(bundle, normalized))
  await writeTextFile(path.join(latestDir, "promo-ppt-copy.html"), renderPptCopyHtml(bundle, normalized))
  await writeTextFile(path.join(latestDir, "promo-bundle.json"), JSON.stringify(bundle, null, 2))
  await writeTextFile(path.join(latestDir, "promo-brief.json"), JSON.stringify(brief, null, 2))
  await writeTextFile(path.join(latestDir, "index.html"), renderBundleHtml(bundle, normalized, generator))

  const files = await fs.readdir(outDir)
  const publicBase = `/generated/promo-assets/${folderName}`

  return NextResponse.json({
    status: "ok",
    generator,
    folderPath: outDir,
    files,
    bundle,
    publicUrls: {
      preview: `${publicBase}/index.html`,
      readme: `${publicBase}/README.md`,
      videoScript: `${publicBase}/promo-video-script.md`,
      videoStoryboard: `${publicBase}/promo-video-storyboard.html`,
      pptDeck: `${publicBase}/promo-ppt-demo.md`,
      pptCopy: `${publicBase}/promo-ppt-copy.html`,
      bundleJson: `${publicBase}/promo-bundle.json`,
      briefJson: `${publicBase}/promo-brief.json`,
      latestPreview: `/generated/promo-assets/latest/index.html`,
      latestVideoStoryboard: `/generated/promo-assets/latest/promo-video-storyboard.html`,
      latestPptCopy: `/generated/promo-assets/latest/promo-ppt-copy.html`,
    },
  })
}
