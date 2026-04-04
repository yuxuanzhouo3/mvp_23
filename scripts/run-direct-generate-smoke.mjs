#!/usr/bin/env node

import { createRequire } from "module"

const [, , caseName = "crm"] = process.argv

const CASES = {
  crm: {
    prompt:
      "Generate a CRM workspace called CRM Pilot with dashboard, leads, pipeline, customers, automations, settings, and analytics so a sales team can demo real workflow instead of static cards.",
    region: "intl",
    deploymentTarget: "vercel",
    databaseTarget: "supabase_postgres",
    generationPlanTier: "builder",
  },
  api_platform: {
    prompt:
      "Generate an API platform called API Forge with dashboard, endpoints, logs, auth, environments, docs, and admin controls. It should feel like a usable developer product, not a poster page.",
    region: "intl",
    deploymentTarget: "vercel",
    databaseTarget: "supabase_postgres",
    generationPlanTier: "builder",
  },
  website_download: {
    prompt:
      "Generate a launch website called Launch Nexus with dashboard, website, downloads, docs, admin, and pricing-style conversion structure so it feels like a full website plus control plane, not just a landing page.",
    region: "intl",
    deploymentTarget: "vercel",
    databaseTarget: "supabase_postgres",
    generationPlanTier: "builder",
  },
}

const payload = CASES[caseName]

if (!payload) {
  console.error(`[FAIL] unknown case: ${caseName}`)
  process.exit(1)
}

const require = createRequire(import.meta.url)
const userland = require("../.next/server/app/api/generate/route.js").routeModule.userland

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callPost(body) {
  const res = await userland.POST(
    new Request("http://local.test/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  )
  return res.json()
}

async function callGet(jobId) {
  const res = await userland.GET(
    new Request(`http://local.test/api/generate?jobId=${encodeURIComponent(jobId)}`)
  )
  return res.json()
}

async function run() {
  const created = await callPost(payload)
  if (!created?.jobId || !created?.projectId) {
    console.error("[FAIL] create", JSON.stringify(created, null, 2))
    process.exit(1)
  }

  console.log(
    JSON.stringify(
      {
        case: caseName,
        projectId: created.projectId,
        jobId: created.jobId,
        status: created.status,
      },
      null,
      2
    )
  )

  for (let attempt = 0; attempt < 90; attempt += 1) {
    await sleep(2000)
    const polled = await callGet(created.jobId)
    console.log(
      JSON.stringify(
        {
          case: caseName,
          poll: attempt + 1,
          status: polled.status,
          buildStatus: polled.buildStatus ?? null,
          summary: polled.summary ?? null,
        },
        null,
        2
      )
    )
    if (polled.status === "done" || polled.status === "error") {
      console.log(
        JSON.stringify(
          {
            case: caseName,
            finalStatus: polled.status,
            buildStatus: polled.buildStatus ?? null,
            summary: polled.summary ?? null,
            acceptance: polled.acceptance ?? null,
            changedFiles: polled.changedFiles?.length ?? 0,
            plannerPages: polled.planner?.pages ?? [],
          },
          null,
          2
        )
      )
      if (polled.status !== "done") {
        process.exit(1)
      }
      return
    }
  }

  console.error("[FAIL] generation did not finish in time")
  process.exit(1)
}

await run()
