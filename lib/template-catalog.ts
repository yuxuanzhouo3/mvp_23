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
    titleZh: "任务管理 / Admin Ops",
    titleEn: "Admin Ops Workspace",
    subtitleZh: "面向中国团队的运营任务管理后台，支持任务推进、负责人筛选、优先级筛选与进度图表",
    subtitleEn: "An internal operations workspace with task progression, assignee and priority filters, and dashboard charts",
    authorZh: "Base44 应用",
    authorEn: "Base44 App",
    usageCount: 25317,
    priceLabel: "免费",
    categories: ["operations", "analytics"],
    language: "mixed",
    previewStyle: "dark-dashboard",
    promptZh:
      "生成一个面向中国团队的运营任务管理后台，要支持任务新增、推进状态、标记完成、负责人筛选、优先级筛选，并在首页展示任务进度图和负责人负载图。整体视觉要求精致、深色、玻璃感卡片、蓝青紫点缀、像成熟 SaaS 产品。",
    promptEn:
      "Build an internal operations task management workspace for teams with task creation, status progression, completion actions, owner and priority filters, plus dashboard charts for progress and owner workload. Make it feel like a refined SaaS product with dark UI and blue/cyan/violet accents.",
    expectedPagesZh: ["任务总览", "任务看板", "任务列表", "分析页"],
    expectedPagesEn: ["Overview", "Task board", "Task list", "Analytics"],
  },
  {
    id: "serenity",
    titleZh: "社区反馈中心",
    titleEn: "Community Feedback Hub",
    subtitleZh: "面向成员、路线图、公告与审核的社区运营工作区",
    subtitleEn: "A community operations workspace for feedback, roadmap, announcements, members, and moderation",
    authorZh: "数字医生",
    authorEn: "Digital Doctor",
    usageCount: 2770,
    priceLabel: "9.99美元",
    categories: ["community", "analytics"],
    language: "mixed",
    previewStyle: "spa-landing",
    promptZh:
      "生成一个社区反馈平台，包含反馈收集、路线图、公告、成员和审核页面，并让首页展示反馈优先级、处理中事项和活动安排。整体视觉要求有社区温度、信息层次清晰、适合真实团队日常运营。",
    promptEn:
      "Build a community feedback hub with feedback intake, roadmap, announcements, members, and moderation pages, and make the home view show priority signals, active work, and upcoming events.",
    expectedPagesZh: ["反馈总览", "路线图", "公告", "成员"],
    expectedPagesEn: ["Feedback", "Roadmap", "Announcements", "Members"],
  },
  {
    id: "opsdesk",
    titleZh: "CRM / 销售流程",
    titleEn: "Sales CRM",
    subtitleZh: "线索、商机 pipeline、报价审批、续约跟进和成交交接",
    subtitleEn: "Lead management, pipeline tracking, quote approvals, renewal follow-up, and close handoff",
    authorZh: "Base44 应用",
    authorEn: "Base44 App",
    usageCount: 14773,
    priceLabel: "免费",
    categories: ["sales", "analytics"],
    language: "mixed",
    previewStyle: "light-admin",
    promptZh:
      "生成一个销售 CRM，重点包含线索列表、商机 pipeline、报价审批、客户续约跟进和成交交接，并让不同页面看起来像真实销售团队每天在用的系统。整体视觉要求清爽、留白充足、多色卡片但不杂乱，像成熟销售后台。",
    promptEn:
      "Create a sales CRM focused on leads, pipeline tracking, quote approvals, renewal follow-up, and close handoff, with pages that feel like a real daily workflow for a revenue team. Keep it airy, clean, and product-grade.",
    expectedPagesZh: ["线索", "商机", "客户", "报表"],
    expectedPagesEn: ["Leads", "Pipeline", "Customers", "Reports"],
  },
  {
    id: "orbital",
    titleZh: "API Platform / 开发者平台",
    titleEn: "API Platform",
    subtitleZh: "接口管理、日志、鉴权、环境配置与 webhook 投递恢复",
    subtitleEn: "Endpoint management, logs, auth, environment controls, and webhook recovery",
    authorZh: "Orbital",
    authorEn: "Orbital",
    usageCount: 6102,
    priceLabel: "免费",
    categories: ["analytics", "operations"],
    language: "mixed",
    previewStyle: "cosmic-app",
    promptZh:
      "生成一个 API 平台，包含接口管理、日志、鉴权、环境配置和 webhook 投递恢复视图，要突出运行态和事件恢复流程。要求有霓虹蓝紫色发光效果和未来感布局。",
    promptEn:
      "Generate an API platform with endpoint management, logs, auth, environment controls, and a webhook delivery recovery view that emphasizes runtime health and event replay workflows.",
    expectedPagesZh: ["接口", "日志", "鉴权", "环境"],
    expectedPagesEn: ["Endpoints", "Logs", "Auth", "Environments"],
  },
  {
    id: "siteforge",
    titleZh: "AI Code Platform / 类 Cursor 工作台",
    titleEn: "AI Coding Workspace",
    subtitleZh: "Dashboard、editor、runs、templates、pricing 与四类 AI 动作",
    subtitleEn: "Dashboard, editor, runs, templates, pricing, and four AI actions",
    authorZh: "Morn Studio",
    authorEn: "Morn Studio",
    usageCount: 8920,
    priceLabel: "免费",
    categories: ["content", "analytics"],
    language: "mixed",
    previewStyle: "purple-builder",
    promptZh:
      "生成一个 AI 代码平台，包含 dashboard、editor、runs、templates、pricing 页面，编辑器里要体现 explain、fix、generate、refactor 四类 AI 动作和文件轨道变化。视觉方向要求偏创作平台风格、紫色渐变、玻璃卡片、现代感强。",
    promptEn:
      "Create an AI coding workspace with dashboard, editor, runs, templates, and pricing pages, where the editor clearly shows explain, fix, generate, and refactor actions with visible file-rail changes.",
    expectedPagesZh: ["Dashboard", "Editor", "Runs", "Templates"],
    expectedPagesEn: ["Dashboard", "Editor", "Runs", "Templates"],
  },
  {
    id: "launchpad",
    titleZh: "Marketing / 下载站 / 内容站",
    titleEn: "Marketing Download Hub",
    subtitleZh: "首页、下载、文档、更新日志和定价页面，偏产品营销与版本发布",
    subtitleEn: "Home, downloads, docs, changelog, and pricing pages oriented around launches and releases",
    authorZh: "Morn Studio",
    authorEn: "Morn Studio",
    usageCount: 4311,
    priceLabel: "免费",
    categories: ["content", "sales", "operations"],
    language: "mixed",
    previewStyle: "launch-ui",
    promptZh:
      "生成一个软件产品官网与下载站，包含首页、下载、文档、更新日志和定价页面，要明显偏产品营销与版本发布场景。整体设计要克制、黑白主色、强对比、转化导向。",
    promptEn:
      "Generate a product marketing site and download hub with home, downloads, docs, changelog, and pricing pages, clearly oriented around software launches and release distribution.",
    expectedPagesZh: ["首页", "下载", "文档", "更新日志"],
    expectedPagesEn: ["Home", "Downloads", "Docs", "Changelog"],
  },
]

export function getTemplateById(templateId: string | null | undefined) {
  if (!templateId) return null
  return TEMPLATE_CATALOG.find((item) => item.id === templateId) ?? null
}
