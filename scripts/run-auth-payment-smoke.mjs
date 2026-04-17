#!/usr/bin/env node

import path from "path"
import { promises as fs } from "fs"

const [, , baseUrlArg] = process.argv

if (!baseUrlArg) {
  console.error("Usage: node scripts/run-auth-payment-smoke.mjs <baseUrl>")
  process.exit(1)
}

const baseUrl = baseUrlArg.replace(/\/+$/, "")
const workspaceRoot = process.cwd()

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

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8")
  return JSON.parse(raw)
}

async function waitFor(getValue, label, timeoutMs = 3000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = await getValue()
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function getLatestEmailCode(email, purpose) {
  const filePath = path.join(workspaceRoot, ".generated", "workspaces", "_email_verifications.json")
  return waitFor(async () => {
    try {
      const store = await readJson(filePath)
      const record = (Array.isArray(store?.codes) ? store.codes : []).find(
        (item) => item?.email === email && item?.purpose === purpose && !item?.consumedAt
      )
      return record?.code ? String(record.code) : ""
    } catch {
      return ""
    }
  }, `email code for ${email}`)
}

async function getLatestPhoneCode(phone, email) {
  const filePath = path.join(workspaceRoot, ".generated", "workspaces", "_phone_otps.json")
  return waitFor(async () => {
    try {
      const store = await readJson(filePath)
      const record = (Array.isArray(store?.otps) ? store.otps : []).find(
        (item) => item?.phone === phone && item?.email === email && !item?.consumedAt
      )
      return record?.code ? String(record.code) : ""
    } catch {
      return ""
    }
  }, `phone code for ${phone}`)
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
  const tencentSmsConfigured = Boolean(readiness.json?.effectiveReadiness?.cn?.phoneOtp?.configured)

  const send = await fetchJson(`${baseUrl}/api/auth/phone/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ region: "cn", email, phone }),
  })
  if (!send.res.ok) {
    logFail("phone send", JSON.stringify(send.json))
    process.exit(1)
  }

  let phoneCode = ""
  if (tencentSmsConfigured) {
    if (send.json?.sandboxCode) {
      logFail("phone send mode", "Tencent SMS path should not return sandboxCode")
      process.exit(1)
    }
    phoneCode = await getLatestPhoneCode(phone, email)
    logOk("phone send", `provider=${send.json?.provider || "tencent-sms"}`)
  } else {
    if (!send.json?.sandboxCode) {
      logFail("phone send sandbox", JSON.stringify(send.json))
      process.exit(1)
    }
    phoneCode = String(send.json.sandboxCode)
    logOk("phone send", `sandboxCode=${phoneCode}`)
  }

  const verify = await fetchJson(`${baseUrl}/api/auth/phone/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ region: "cn", email, phone, code: phoneCode, name: "CN Smoke User" }),
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

  const emailSend = await fetchJson(`${baseUrl}/api/auth/email/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ region: "cn", email, purpose: "register" }),
  })
  if (!emailSend.res.ok || !emailSend.json?.ok) {
    logFail("email send", JSON.stringify(emailSend.json))
    process.exit(1)
  }
  logOk("email send", `expiresAt=${emailSend.json?.expiresAt || "n/a"}`)

  const emailCode = await getLatestEmailCode(email, "register")
  const emailPassword = "SmokePass123!"
  const emailVerify = await fetchJson(`${baseUrl}/api/auth/email/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      region: "cn",
      email,
      password: emailPassword,
      code: emailCode,
      purpose: "register",
      name: "CN Email Smoke",
    }),
  })
  if (!emailVerify.res.ok || !emailVerify.json?.ok) {
    logFail("email verify", JSON.stringify(emailVerify.json))
    process.exit(1)
  }
  const emailCookie = readSetCookie(emailVerify.res.headers)
  if (!emailCookie) {
    logFail("email verify cookie", "missing set-cookie")
    process.exit(1)
  }
  logOk("email verify", emailVerify.json?.user?.email || "verified")

  const emailSession = await fetchJson(`${baseUrl}/api/auth/session`, {
    headers: {
      Cookie: emailCookie,
      Accept: "application/json",
    },
  })
  if (!emailSession.res.ok || !emailSession.json?.authenticated || emailSession.json?.user?.email !== email) {
    logFail("session after email verify", JSON.stringify(emailSession.json))
    process.exit(1)
  }
  logOk("session after email verify", `${emailSession.json.user.email} / ${emailSession.json.user.region}`)

  const wechatPay = readiness.json?.effectiveReadiness?.cn?.payment || {}
  logOk(
    "wechat pay readiness",
    `configured=${Boolean(wechatPay.wechatPayConfigured)} webhookVerify=${Boolean(wechatPay.wechatPayWebhookVerificationConfigured)}`
  )

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
