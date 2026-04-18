import type { AiUsagePolicy } from "@/lib/admin/types"

const DEFAULT_AI_USAGE_POLICY: AiUsagePolicy = {
  monthly_budget_cny: 10,
  default_user_limit: 100,
  per_user_monthly_fee_cny: 0.1,
  free_trial_uses: 3,
  enabled: true,
}

function normalizeNumber(input: unknown, fallback: number) {
  const parsed = typeof input === "number" ? input : Number.parseFloat(String(input ?? ""))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeInteger(input: unknown, fallback: number) {
  const parsed = typeof input === "number" ? input : Number.parseInt(String(input ?? ""), 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(1, Math.floor(parsed)) : fallback
}

function normalizeBoolean(input: unknown, fallback: boolean) {
  if (typeof input === "boolean") return input
  if (typeof input === "number") return input !== 0
  if (typeof input === "string") {
    const normalized = input.trim().toLowerCase()
    if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true
    if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false
  }
  return fallback
}

export function getDefaultAiUsagePolicy(): AiUsagePolicy {
  return { ...DEFAULT_AI_USAGE_POLICY }
}

export function sanitizeAiUsagePolicy(input: unknown, options?: { allowEmpty?: boolean }): AiUsagePolicy {
  const fallback = getDefaultAiUsagePolicy()
  if (!input || typeof input !== "object") {
    return fallback
  }

  const record = input as Record<string, unknown>
  const monthly_budget_cny = normalizeNumber(record.monthly_budget_cny, fallback.monthly_budget_cny)
  const default_user_limit = normalizeInteger(record.default_user_limit, fallback.default_user_limit)
  const per_user_monthly_fee_cny = normalizeNumber(record.per_user_monthly_fee_cny, fallback.per_user_monthly_fee_cny)
  const free_trial_uses = normalizeInteger(record.free_trial_uses, fallback.free_trial_uses)
  const enabled = normalizeBoolean(record.enabled, fallback.enabled)

  if (!options?.allowEmpty && monthly_budget_cny <= 0 && default_user_limit > 0 && per_user_monthly_fee_cny > 0) {
    return {
      monthly_budget_cny: default_user_limit * per_user_monthly_fee_cny,
      default_user_limit,
      per_user_monthly_fee_cny,
      free_trial_uses,
      enabled,
    }
  }

  return {
    monthly_budget_cny,
    default_user_limit,
    per_user_monthly_fee_cny,
    free_trial_uses,
    enabled,
  }
}

export function summarizeAiUsagePolicy(policy: AiUsagePolicy) {
  return `¥${policy.monthly_budget_cny}/月 · ${policy.default_user_limit} 用户 · ¥${policy.per_user_monthly_fee_cny}/用户/月 · 免费试用 ${policy.free_trial_uses} 次`
}
