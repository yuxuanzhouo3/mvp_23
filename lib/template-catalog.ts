export type TemplateCategory =
  | "all"
  | "sales"
  | "operations"
  | "analytics"
  | "content"
  | "hr"
  | "finance"
  | "education"
  | "community"
  | "lifestyle"
  | "gaming"

export type TemplateLanguage = "zh" | "en" | "mixed"

export type TemplatePreviewStyle =
  | "dark-dashboard"
  | "spa-landing"
  | "light-admin"
  | "cosmic-app"
  | "purple-builder"
  | "launch-ui"

export type TemplateItem = {
  id: string
  titleZh: string
  titleEn: string
  subtitleZh: string
  subtitleEn: string
  authorZh: string
  authorEn: string
  usageCount: number
  priceLabel: string
  categories: TemplateCategory[]
  language: TemplateLanguage
  previewStyle: TemplatePreviewStyle
  promptZh: string
  promptEn: string
  expectedPagesZh: string[]
  expectedPagesEn: string[]
}

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, { zh: string; en: string }> = {
  all: { zh: "全部", en: "All" },
  sales: { zh: "市场营销与销售", en: "Sales & Marketing" },
  operations: { zh: "运营", en: "Operations" },
  analytics: { zh: "数据与分析", en: "Data & Analytics" },
  content: { zh: "内容生成", en: "Content" },
  hr: { zh: "人力资源与法律", en: "HR & Legal" },
  finance: { zh: "金融", en: "Finance" },
  education: { zh: "教育", en: "Education" },
  community: { zh: "社区", en: "Community" },
  lifestyle: { zh: "生活方式与爱好", en: "Lifestyle" },
  gaming: { zh: "游戏与娱乐", en: "Gaming" },
}

export const TEMPLATE_CATALOG: TemplateItem[] = [
  {
    id: "taskflow",
    titleZh: "任务管理流程",
    titleEn: "TaskFlow Workspace",
    subtitleZh: "营销团队任务看板、统计、最近活动与优先级分布",
    subtitleEn: "Marketing task board with stats, activity, and priority distribution",
    authorZh: "Base44 应用",
    authorEn: "Base44 App",
    usageCount: 25317,
    priceLabel: "免费",
    categories: ["sales", "operations", "analytics"],
    language: "mixed",
    previewStyle: "dark-dashboard",
    promptZh:
      "生成一个高质量任务管理应用，风格参考深色营销看板。包含：顶部统计卡片、最近活动列表、任务状态分布图、任务优先级概览、任务看板与列表双视图、搜索、负责人筛选、优先级筛选、最近任务、编辑删除、带 6 条示例数据。整体视觉要求精致、深色、玻璃感卡片、蓝青紫点缀、像成熟 SaaS 产品。",
    promptEn:
      "Build a polished task management app inspired by a dark marketing dashboard. Include metric cards, recent activity, task status chart, priority overview, board/list views, search, assignee filter, priority filter, recent tasks, edit/delete, and 6 seeded records. Make it feel like a refined SaaS product with dark UI and blue/cyan/violet accents.",
    expectedPagesZh: ["仪表盘", "任务看板", "任务列表", "分析页"],
    expectedPagesEn: ["Dashboard", "Task board", "Task list", "Analytics"],
  },
  {
    id: "serenity",
    titleZh: "宁静水疗沙龙",
    titleEn: "Serenity Spa",
    subtitleZh: "高端门店官网，预约入口、服务卡片与门店介绍",
    subtitleEn: "Luxury spa landing page with booking flow and service sections",
    authorZh: "数字医生",
    authorEn: "Digital Doctor",
    usageCount: 2770,
    priceLabel: "9.99美元",
    categories: ["sales", "lifestyle"],
    language: "en",
    previewStyle: "spa-landing",
    promptZh:
      "生成一个高端水疗沙龙官网，首页要有沉浸式 hero、大图背景、预约 CTA、服务介绍、客户评价、门店位置、团队介绍和联系表单。整体视觉要求高级、温暖、米色与棕金色调，像精品门店品牌官网。",
    promptEn:
      "Generate a luxury spa and salon website with an immersive hero section, large photography, booking CTA, service cards, testimonials, location, team section, and contact form. The visual direction should feel premium, warm, and boutique.",
    expectedPagesZh: ["首页", "服务项目", "团队介绍", "预约联系"],
    expectedPagesEn: ["Home", "Services", "Team", "Booking"],
  },
  {
    id: "opsdesk",
    titleZh: "任务管理",
    titleEn: "Ops Desk",
    subtitleZh: "浅色后台、快捷操作、项目列表与多彩统计卡",
    subtitleEn: "Light admin dashboard with quick actions and colorful metric cards",
    authorZh: "Base44 应用",
    authorEn: "Base44 App",
    usageCount: 14773,
    priceLabel: "免费",
    categories: ["sales", "operations", "analytics"],
    language: "mixed",
    previewStyle: "light-admin",
    promptZh:
      "生成一个浅色风格的任务与运营后台。包含：欢迎区、快捷操作面板、统计卡片、最近项目列表、看板与列表切换、搜索、任务编辑删除。整体视觉要求清爽、留白充足、多色卡片但不杂乱，像成熟运营后台。",
    promptEn:
      "Build a light operations dashboard with a welcome banner, quick actions, colorful metric cards, recent project list, board/list toggle, search, and edit/delete interactions. Keep it airy, clean, and product-grade.",
    expectedPagesZh: ["概览", "任务", "项目列表", "快捷操作"],
    expectedPagesEn: ["Overview", "Tasks", "Projects", "Quick actions"],
  },
  {
    id: "orbital",
    titleZh: "Orbital 宇宙平台",
    titleEn: "Orbital Platform",
    subtitleZh: "深色科技官网，带沉浸式英雄区与功能模块",
    subtitleEn: "Dark futuristic landing page with immersive hero section",
    authorZh: "Orbital",
    authorEn: "Orbital",
    usageCount: 6102,
    priceLabel: "免费",
    categories: ["community", "content", "gaming"],
    language: "en",
    previewStyle: "cosmic-app",
    promptZh:
      "生成一个深色科技感官网，带强烈视觉冲击的英雄区、功能区块、产品亮点、价格区、用户评价和 CTA。要求有霓虹蓝紫色发光效果和未来感布局。",
    promptEn:
      "Create a futuristic dark tech landing page with a strong hero section, feature blocks, product highlights, pricing, testimonials, and CTA. Use glowing blue/violet accents and a cinematic layout.",
    expectedPagesZh: ["首页", "功能亮点", "价格方案", "用户评价"],
    expectedPagesEn: ["Home", "Features", "Pricing", "Testimonials"],
  },
  {
    id: "siteforge",
    titleZh: "AI 网站生成器",
    titleEn: "AI Site Generator",
    subtitleZh: "紫色构建器面板，适合做 Base44 风格创作工具",
    subtitleEn: "Purple creator panel for an AI website builder experience",
    authorZh: "Morn Studio",
    authorEn: "Morn Studio",
    usageCount: 8920,
    priceLabel: "免费",
    categories: ["content", "community"],
    language: "mixed",
    previewStyle: "purple-builder",
    promptZh:
      "生成一个 AI 建站工具首页或工作台，包含输入区、步骤流程、生成结果预览、功能卖点、模板入口和 CTA。视觉方向要求偏创作平台风格、紫色渐变、玻璃卡片、现代感强。",
    promptEn:
      "Build an AI website builder landing page or workspace with prompt input, workflow steps, result preview, feature highlights, template entry, and CTA. Use a modern creator-platform look with purple gradients and glassmorphism.",
    expectedPagesZh: ["首页", "模板广场", "生成工作台", "结果预览"],
    expectedPagesEn: ["Home", "Template gallery", "Generation workspace", "Result preview"],
  },
  {
    id: "launchpad",
    titleZh: "LaunchPad SaaS 首页",
    titleEn: "LaunchPad SaaS",
    subtitleZh: "黑白产品发布页，强调转化、价格与 CTA",
    subtitleEn: "High-conversion SaaS landing page with pricing and CTA",
    authorZh: "Morn Studio",
    authorEn: "Morn Studio",
    usageCount: 4311,
    priceLabel: "免费",
    categories: ["sales", "finance", "education"],
    language: "en",
    previewStyle: "launch-ui",
    promptZh:
      "生成一个高转化 SaaS 产品首页，包含：简洁 hero、功能对比、客户 logo、价格区、FAQ、CTA。整体设计要克制、黑白主色、强对比、转化导向。",
    promptEn:
      "Create a high-conversion SaaS landing page with a clean hero, feature comparison, customer logos, pricing, FAQ, and CTA. Keep it minimal, black-and-white, contrast-heavy, and conversion-focused.",
    expectedPagesZh: ["首页", "功能", "价格", "FAQ"],
    expectedPagesEn: ["Home", "Features", "Pricing", "FAQ"],
  },
]

export function getTemplateById(templateId: string | null | undefined) {
  if (!templateId) return null
  return TEMPLATE_CATALOG.find((item) => item.id === templateId) ?? null
}
