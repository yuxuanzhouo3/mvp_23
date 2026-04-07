#!/usr/bin/env node

const [, , baseUrlArg] = process.argv

if (!baseUrlArg) {
  console.error("Usage: node scripts/run-auth-payment-smoke.mjs <baseUrl>")
  process.exit(1)
}

const baseUrl = baseUrlArg.replace(/\/+$/, "")

function getHeader(headers, key) {
  if (!headers) return ""
  if (typeof headers.get === "function") {
    return headers.get(key) || ""
  }
  return ""
}

function readSetCookie(headers) {
  if (!headers) return ""
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie().join("; ")
  }
  const direct = headers.get?.("set-cookie")
  return direct || ""
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init)
  const json = await res.json().catch(() => ({}))
  return { res, json }
}

function logOk(label, detail = "") {
  console.log(`[OK] ${label}${detail ? ` :: ${detail}` : ""}`)
}

function logFail(label, detail = "") {
  console.error(`[FAIL] ${label}${detail ? ` :: ${detail}` : ""}`)
}

async function run() {
  const readiness = await fetchJson(`${baseUrl}/api/integrations/readiness`)
  if (!readiness.res.ok) {
    logFail("readiness", JSON.stringify(readiness.json))
    process.exit(1)
  }
  logOk(
    "readiness",
    `intlAuth=${readiness.json?.rolloutPlan?.currentTarget?.intlAuth?.join?.(" + ") || "n/a"} cnAuth=${readiness.json?.rolloutPlan?.currentTarget?.cnAuth?.join?.(" + ") || "n/a"}`
  )

  const email = `cn-smoke-${Date.now()}@mornscience.ai`
  const phone = "13800138000"

  const send = await fetchJson(`${baseUrl}/api/auth/phone/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ region: "cn", email, phone }),
  })
  if (!send.res.ok || !send.json?.sandboxCode) {
    logFail("phone send", JSON.stringify(send.json))
    process.exit(1)
  }
  const sandboxCode = String(send.json.sandboxCode)
  logOk("phone send", `sandboxCode=${sandboxCode}`)

  const verify = await fetchJson(`${baseUrl}/api/auth/phone/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ region: "cn", email, phone, code: sandboxCode, name: "CN Smoke User" }),
  })
  if (!verify.res.ok || !verify.json?.ok) {
    logFail("phone verify", JSON.stringify(verify.json))
    process.exit(1)
  }
  const cookie = readSetCookie(verify.res.headers)
  if (!cookie) {
    logFail("phone verify cookie", "missing set-cookie")
    process.exit(1)
  }
  logOk("phone verify", verify.json?.user?.email || "verified")

  const session = await fetchJson(`${baseUrl}/api/auth/session`, {
    headers: {
      Cookie: cookie,
      Accept: "application/json",
    },
  })
  if (!session.res.ok || !session.json?.authenticated || session.json?.user?.region !== "cn") {
    logFail("session after phone verify", JSON.stringify(session.json))
    process.exit(1)
  }
  logOk("session after phone verify", `${session.json.user.email} / ${session.json.user.region}`)

  const googleStart = await fetch(`${baseUrl}/api/auth/google/start?redirect=${encodeURIComponent("/checkout?region=intl&plan=pro")}`, {
    method: "GET",
    redirect: "manual",
  })
  const googleLocation = getHeader(googleStart.headers, "location")
  if (!(googleStart.status >= 300 && googleStart.status < 400) || !googleLocation.includes("/checkout")) {
    logFail("google start redirect", `status=${googleStart.status} location=${googleLocation}`)
    process.exit(1)
  }
  logOk("google start redirect", googleLocation)
}

await run()
