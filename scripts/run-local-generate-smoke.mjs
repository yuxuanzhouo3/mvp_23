#!/usr/bin/env node

const [, , baseUrlArg, promptArg, ...extraArgs] = process.argv

if (!baseUrlArg || !promptArg) {
  console.error(
    "Usage: node scripts/run-local-generate-smoke.mjs <baseUrl> <prompt> [--region cn] [--deploymentTarget cloudbase] [--databaseTarget cloudbase_document] [--generationPlanTier free]"
  )
  process.exit(1)
}

const baseUrl = baseUrlArg.replace(/\/+$/, "")
const prompt = promptArg

function parseOptions(args) {
  const body = {}
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!token.startsWith("--")) {
      console.error(`[FAIL] unexpected argument: ${token}`)
      process.exit(1)
    }

    const value = args[index + 1]
    if (!value || value.startsWith("--")) {
      console.error(`[FAIL] missing value for option: ${token}`)
      process.exit(1)
    }

    const key = token.slice(2).trim()
    if (!key) {
      console.error(`[FAIL] invalid option: ${token}`)
      process.exit(1)
    }

    body[key] = value
    index += 1
  }
  return body
}

const requestBody = {
  prompt,
  ...parseOptions(extraArgs),
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
  const createRes = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  })

  const createJson = await createRes.json().catch(() => ({}))
  if (!createRes.ok) {
    console.error("[FAIL] create", createJson)
    process.exit(1)
  }

  const jobId = String(createJson.jobId ?? "").trim()
  const projectId = String(createJson.projectId ?? "").trim()
  if (!jobId || !projectId) {
    console.error("[FAIL] missing ids", createJson)
    process.exit(1)
  }

  console.log(
    `[INFO] created projectId=${projectId} jobId=${jobId} region=${String(createJson.region ?? requestBody.region ?? "default")}`
  )

  for (let attempt = 0; attempt < 90; attempt += 1) {
    await sleep(2000)
    const res = await fetch(`${baseUrl}/api/generate?jobId=${encodeURIComponent(jobId)}`)
    const json = await res.json().catch(() => ({}))
    const status = String(json.status ?? "unknown")
    console.log(
      `[INFO] poll attempt=${attempt + 1} status=${status} buildStatus=${String(json.buildStatus ?? "n/a")} summary=${String(json.summary ?? "").slice(0, 140)}`
    )
    if (status === "done" || status === "error") {
      console.log(JSON.stringify(json, null, 2))
      if (status !== "done") process.exit(1)
      return
    }
  }

  console.error("[FAIL] generation did not finish in time")
  process.exit(1)
}

await run()
