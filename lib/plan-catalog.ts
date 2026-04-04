export type PlanTier = "free" | "starter" | "builder" | "pro" | "elite"

export type BillingCycle = "monthly" | "yearly"

export type PlanDefinition = {
  id: PlanTier
  rank: number
  nameCn: string
  nameEn: string
  monthlyPriceCn: string
  monthlyPriceEn: string
  yearlyPriceCn: string
  yearlyPriceEn: string
  badgeCn?: string
  badgeEn?: string
  summaryCn: string
  summaryEn: string
  generationQualityCn: string
  generationQualityEn: string
  deliverablesCn: string[]
  deliverablesEn: string[]
}

export const PLAN_CATALOG: Record<PlanTier, PlanDefinition> = {
  free: {
    id: "free",
    rank: 0,
    nameCn: "探索版",
    nameEn: "Explorer",
    monthlyPriceCn: "¥0",
    monthlyPriceEn: "$0",
    yearlyPriceCn: "¥0",
    yearlyPriceEn: "$0",
    summaryCn: "适合首次体验，仍可生成像样的产品首版",
    summaryEn: "Great for first-time use, still capable of a polished first version",
    generationQualityCn: "可生成完整首版工作台、基础看板与列表、示例数据和清晰视觉层次",
    generationQualityEn: "Generates a polished first workspace with board/list views, sample data, and clear visual hierarchy",
    deliverablesCn: ["可展示首版", "2-4 个页面", "真实数据流", "基础迭代与回滚"],
    deliverablesEn: ["Showcaseable first version", "2-4 pages", "Real data flow", "Basic iteration and rollback"],
  },
  starter: {
    id: "starter",
    rank: 1,
    nameCn: "启动版",
    nameEn: "Starter",
    monthlyPriceCn: "¥99",
    monthlyPriceEn: "$19",
    yearlyPriceCn: "¥948",
    yearlyPriceEn: "$190",
    summaryCn: "适合个人验证产品方向",
    summaryEn: "For solo builders validating a product idea",
    generationQualityCn: "完整首页、基础数据 API、可演示核心流程",
    generationQualityEn: "Complete landing page, baseline data API, demo-ready core flow",
    deliverablesCn: ["2-3 个页面", "标准组件", "基础筛选", "真实数据读写"],
    deliverablesEn: ["2-3 pages", "Standard components", "Basic filtering", "Real CRUD data"],
  },
  builder: {
    id: "builder",
    rank: 2,
    nameCn: "建造者",
    nameEn: "Builder",
    monthlyPriceCn: "¥299",
    monthlyPriceEn: "$49",
    yearlyPriceCn: "¥2868",
    yearlyPriceEn: "$490",
    summaryCn: "适合做成可交付的业务应用",
    summaryEn: "For shipping a richer business-ready app",
    generationQualityCn: "多区块工作台、看板与列表双视图、更多状态与交互",
    generationQualityEn: "Multi-section workspace, board/list views, deeper states and interactions",
    deliverablesCn: ["4-6 个页面", "组件拆分", "多视图", "增强筛选和统计"],
    deliverablesEn: ["4-6 pages", "Split components", "Multiple views", "Advanced filters and metrics"],
  },
  pro: {
    id: "pro",
    rank: 3,
    nameCn: "专业版",
    nameEn: "Pro",
    monthlyPriceCn: "¥599",
    monthlyPriceEn: "$80",
    yearlyPriceCn: "¥5760",
    yearlyPriceEn: "$960",
    badgeCn: "受到推荐",
    badgeEn: "Recommended",
    summaryCn: "适合高质量 MVP 与持续迭代",
    summaryEn: "For higher-quality MVPs and continuous iteration",
    generationQualityCn: "完整仪表盘、模块化代码树、分析页、导出、更多业务细节",
    generationQualityEn: "Full dashboard, modular code tree, analytics, export, and richer business details",
    deliverablesCn: ["6-8 个页面", "分析页", "导出能力", "更强 fallback 改码"],
    deliverablesEn: ["6-8 pages", "Analytics", "Export flows", "Stronger fallback editing"],
  },
  elite: {
    id: "elite",
    rank: 4,
    nameCn: "精英版",
    nameEn: "Elite",
    monthlyPriceCn: "¥1199",
    monthlyPriceEn: "$160",
    yearlyPriceCn: "¥11520",
    yearlyPriceEn: "$1920",
    summaryCn: "适合展示级产品、客户提案与复杂工作区",
    summaryEn: "For showcase-grade products, client demos, and complex workspaces",
    generationQualityCn: "接近正式产品的多页面信息架构、完整工作台、增强视觉层次和更深业务流",
    generationQualityEn: "Near-product multi-page architecture, fuller workspace, stronger visual polish, and deeper business flows",
    deliverablesCn: ["8+ 页面", "展示级 UI", "深度模块", "更完整产物结构"],
    deliverablesEn: ["8+ pages", "Showcase UI", "Deeper modules", "Fuller project structure"],
  },
}

export const PAID_PLAN_IDS: PlanTier[] = ["starter", "builder", "pro", "elite"]

export function getPlanDefinition(planId: string | null | undefined) {
  return PLAN_CATALOG[(planId as PlanTier) || "free"] ?? PLAN_CATALOG.free
}

export function normalizePlanTier(planId: string | null | undefined): PlanTier {
  return getPlanDefinition(planId).id
}

export function findPlanTierByLabel(label: string | null | undefined): PlanTier | null {
  const normalized = String(label ?? "").trim().toLowerCase()
  if (!normalized) return null
  const matched = (Object.keys(PLAN_CATALOG) as PlanTier[]).find((planId) => {
    const plan = PLAN_CATALOG[planId]
    return [
      plan.id,
      plan.nameCn,
      plan.nameEn,
      plan.badgeCn,
      plan.badgeEn,
    ]
      .filter(Boolean)
      .some((item) => String(item).trim().toLowerCase() === normalized)
  })
  return matched ?? null
}

export function getPlanRank(planId: PlanTier | string | null | undefined) {
  return getPlanDefinition(planId).rank
}

export function isPaidPlanTier(planId: PlanTier | string | null | undefined) {
  return PAID_PLAN_IDS.includes(normalizePlanTier(planId))
}

export function getAccessiblePlanTiers(maxPlanId: PlanTier): PlanTier[] {
  const maxRank = getPlanRank(maxPlanId)
  return (Object.keys(PLAN_CATALOG) as PlanTier[]).filter((planId) => getPlanRank(planId) <= maxRank)
}

export function getPlanPriceLabel(planId: PlanTier, locale: "zh" | "en", cycle: BillingCycle = "monthly") {
  const plan = PLAN_CATALOG[planId]
  if (locale === "zh") {
    return cycle === "yearly" ? plan.yearlyPriceCn : plan.monthlyPriceCn
  }
  return cycle === "yearly" ? plan.yearlyPriceEn : plan.monthlyPriceEn
}
