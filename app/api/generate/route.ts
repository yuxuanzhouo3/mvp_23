import path from "path"
import { promises as fs } from "fs"
import { NextResponse } from "next/server"
import {
  appendProjectHistory,
  createProjectId,
  ensureDir,
  getProject,
  getWorkspacePath,
  resolveProjectPath,
  safeProjectId,
  upsertProject,
  writeTextFile,
  type Region,
} from "@/lib/project-workspace"
import { requestJsonChatCompletion, resolveAiConfig } from "@/lib/ai-provider"
import { buildCanonicalPreviewUrl } from "@/lib/preview-url"
import {
  appendGenerateTaskLog,
  createGenerateTask,
  findLatestTaskByProject,
  getGenerateTask,
  updateGenerateTask,
  type GenerateTask,
} from "@/lib/generate-tasks"
import {
  buildSpecDrivenWorkspaceFiles,
  createAppSpec,
  readProjectSpec,
  writeProjectSpec,
  type AppKind,
  type AppSpec,
  type SpecFeature,
} from "@/lib/project-spec"
import { getCurrentSession } from "@/lib/auth"
import { getLatestCompletedPayment } from "@/lib/payment-store"
import { getPlanRank, type PlanTier } from "@/lib/plan-catalog"
import { getTemplateById, type TemplatePreviewStyle } from "@/lib/template-catalog"
import {
  getDatabaseEnvGuide,
  getDatabaseOption,
  getDefaultDatabaseTarget,
  getDefaultDeploymentTarget,
  getDeploymentEnvGuide,
  getDeploymentOption,
  normalizeDatabaseTarget,
  normalizeDeploymentTarget,
  type DatabaseTarget,
  type DeploymentTarget,
} from "@/lib/fullstack-targets"
import { getDefaultPreviewMode } from "@/lib/sandbox-preview"

export const runtime = "nodejs"
const STALE_TASK_MS = 8 * 60 * 1000

function buildProjectPreviewPath(projectId: string) {
  return buildCanonicalPreviewUrl(projectId)
}

type GeneratedFile = {
  path: string
  content: string
}

type GeneratorModelOutput = {
  summary: string
  files: GeneratedFile[]
}

type GenerateTaskRecord = GenerateTask & {
  rawPrompt?: string
  templateId?: string
  templateTitle?: string
}

type PlannerProductType =
  | "ai_code_platform"
  | "crm_workspace"
  | "api_platform"
  | "community_hub"
  | "content_site"
  | "task_workspace"

type PlannerSpec = {
  productName: string
  productType: PlannerProductType
  targetLocale: "zh-CN" | "en-US"
  style: {
    theme: "dark" | "light"
    tone: string
    market: "china" | "global"
  }
  pages: string[]
  layout: {
    editor?: string[]
  }
  aiTools: string[]
  templates: string[]
  plans: string[]
  deploymentDefaults: {
    cn: [string, string]
    global: [string, string]
  }
  preferredScaffold: string
  summary: string
}

type RegionDefaults = {
  language: "zh-CN" | "en-US"
  timezone: string
  dateFormat: string
  currency: "CNY" | "USD"
  labels: {
    title: string
    subtitle: string
    taskTitle: string
    assignee: string
    create: string
    creating: string
    filter: string
    todo: string
    inProgress: string
    done: string
    priority: string
    localeInfo: string
    monthlyTarget: string
  }
  seedTasks: Array<{
    title: string
    description: string
    assignee: string
    priority: "low" | "medium" | "high"
    status: "todo" | "in_progress" | "done"
  }>
}

function getRegionDefaults(region: Region): RegionDefaults {
  if (region === "cn") {
    return {
      language: "zh-CN",
      timezone: "Asia/Shanghai",
      dateFormat: "YYYY/MM/DD",
      currency: "CNY",
      labels: {
        title: "生成任务工作台",
        subtitle: "多地区默认配置演示：语言/时区/日期/货币/种子数据",
        taskTitle: "任务标题",
        assignee: "负责人",
        create: "创建",
        creating: "创建中...",
        filter: "按负责人筛选",
        todo: "待办",
        inProgress: "进行中",
        done: "完成",
        priority: "优先级",
        localeInfo: "区域配置",
        monthlyTarget: "月度目标",
      },
      seedTasks: [
        { title: "联系潜在客户", description: "首轮电话沟通", assignee: "张伟", priority: "high", status: "todo" },
        { title: "准备产品演示", description: "整理案例与报价", assignee: "王芳", priority: "medium", status: "in_progress" },
        { title: "签约回访", description: "确认合同归档", assignee: "李雷", priority: "low", status: "done" },
      ],
    }
  }
  return {
    language: "en-US",
    timezone: "America/Los_Angeles",
    dateFormat: "MM/DD/YYYY",
    currency: "USD",
    labels: {
      title: "Generated Task Workspace",
      subtitle: "Region-aware defaults: language/timezone/date/currency/seed data",
      taskTitle: "Task title",
      assignee: "Assignee",
      create: "Create",
      creating: "Creating...",
      filter: "Filter by assignee",
      todo: "Todo",
      inProgress: "In Progress",
      done: "Done",
      priority: "Priority",
      localeInfo: "Region Config",
      monthlyTarget: "Monthly target",
    },
    seedTasks: [
      { title: "Reach out to inbound lead", description: "Intro call and qualification", assignee: "Liam", priority: "high", status: "todo" },
      { title: "Prepare demo deck", description: "Add ROI section for prospect", assignee: "Emma", priority: "medium", status: "in_progress" },
      { title: "Contract handoff", description: "Sync with legal and finance", assignee: "Noah", priority: "low", status: "done" },
    ],
  }
}

function sanitizeUiText(input: string) {
  return input.replace(/[<>`{}]/g, "").replace(/\s+/g, " ").trim()
}

function normalizePath(p: string) {
  return p.replace(/\\/g, "/").replace(/^\/+/, "")
}

function isAllowedFile(relativePath: string) {
  const normalized = normalizePath(relativePath)
  if (!normalized || normalized.includes("..")) return false
  if (normalized.startsWith("node_modules/") || normalized.startsWith(".next/") || normalized.startsWith(".git/")) {
    return false
  }
  return true
}

function extractJsonObject(raw: string) {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)
  const payload = fenced?.[1] ?? raw
  const start = payload.indexOf("{")
  const end = payload.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response is not valid JSON")
  }
  return payload.slice(start, end + 1)
}

function sanitizeJsonText(input: string) {
  return input
    .replace(/\u201c|\u201d/g, "\"")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
}

function parseGeneratorOutput(rawContent: string): GeneratorModelOutput {
  const candidate = extractJsonObject(rawContent)
  try {
    return JSON.parse(candidate) as GeneratorModelOutput
  } catch {
    return JSON.parse(sanitizeJsonText(candidate)) as GeneratorModelOutput
  }
}

function uniqueLowerStrings(input: string[], fallback: string[]) {
  const values = Array.from(new Set(input.map((item) => sanitizeUiText(String(item))).filter(Boolean)))
  return values.length ? values : fallback
}

function inferPlannerProductType(prompt: string): PlannerProductType {
  const kind = inferAppKind(prompt)
  if (kind === "code_platform") return "ai_code_platform"
  if (kind === "crm") return "crm_workspace"
  if (/api|analytics|monitoring|dashboard|接口|分析平台|监控|趋势/i.test(prompt)) return "api_platform"
  if (kind === "community") return "community_hub"
  if (kind === "blog" || /website|landing|homepage|download|官网|下载站|落地页|文档/i.test(prompt)) return "content_site"
  return "task_workspace"
}

function fallbackPlannerSpec(
  prompt: string,
  region: Region,
  deploymentTarget: DeploymentTarget,
  databaseTarget: DatabaseTarget
): PlannerSpec {
  const productType = inferPlannerProductType(prompt)
  const targetLocale = region === "cn" ? "zh-CN" : "en-US"
  const productName = deriveProjectHeadline(prompt) || (region === "cn" ? "Mornstack 应用" : "Mornstack App")
  const cnDefaults: [string, string] = ["cloudbase", "cloud_docs"]
  const globalDefaults: [string, string] = ["vercel", "supabase"]

  if (productType === "ai_code_platform") {
    return {
      productName,
      productType,
      targetLocale,
      style: {
        theme: "dark",
        tone: "production-ready",
        market: region === "cn" ? "china" : "global",
      },
      pages: ["dashboard", "editor", "runs", "templates", "pricing"],
      layout: {
        editor: ["activity_bar", "file_tree", "tab_editor", "terminal_panel", "ai_assistant_panel"],
      },
      aiTools: ["explain", "fix", "generate", "refactor"],
      templates:
        region === "cn"
          ? ["官网与下载站", "销售后台", "API 数据平台", "社区反馈中心"]
          : ["Website and downloads", "Sales admin", "API platform", "Community hub"],
      plans: region === "cn" ? ["免费版", "专业版", "精英版"] : ["Free", "Pro", "Elite"],
      deploymentDefaults: {
        cn: cnDefaults,
        global: globalDefaults,
      },
      preferredScaffold: "ai_code_platform_scaffold",
      summary:
        region === "cn"
          ? `规划为 AI 代码编辑平台，输出 dashboard、editor、runs、templates、pricing 五页骨架，并默认接入 ${deploymentTarget} + ${databaseTarget}。`
          : `Planned as an AI coding platform with dashboard, editor, runs, templates, and pricing routes on ${deploymentTarget} + ${databaseTarget}.`,
    }
  }

  const fallbackPages =
    productType === "crm_workspace"
      ? ["dashboard", "leads", "tasks", "pricing"]
      : productType === "api_platform"
        ? ["dashboard", "runs", "docs", "pricing"]
        : productType === "community_hub"
          ? ["home", "events", "feedback", "pricing"]
          : productType === "content_site"
            ? ["home", "downloads", "docs", "pricing"]
            : ["home", "dashboard", "tasks", "pricing"]

  return {
    productName,
    productType,
    targetLocale,
    style: {
      theme: productType === "content_site" ? "light" : "dark",
      tone: "production-ready",
      market: region === "cn" ? "china" : "global",
    },
    pages: fallbackPages,
    layout: {},
    aiTools: ["generate"],
    templates: [],
    plans: region === "cn" ? ["免费版", "专业版", "精英版"] : ["Free", "Pro", "Elite"],
    deploymentDefaults: { cn: cnDefaults, global: globalDefaults },
    preferredScaffold: `${productType}_scaffold`,
    summary:
      region === "cn"
        ? `已规划为 ${productType}，优先输出可运行的多页面产品骨架。`
        : `Planned as ${productType} with a runnable multi-page scaffold.`,
  }
}

function normalizePlannerSpec(
  parsed: Partial<PlannerSpec> | null | undefined,
  prompt: string,
  region: Region,
  deploymentTarget: DeploymentTarget,
  databaseTarget: DatabaseTarget
) {
  const fallback = fallbackPlannerSpec(prompt, region, deploymentTarget, databaseTarget)
  const productType = (parsed?.productType as PlannerProductType | undefined) ?? fallback.productType
  return {
    ...fallback,
    ...parsed,
    productName: sanitizeUiText(parsed?.productName || "") || fallback.productName,
    productType,
    targetLocale: parsed?.targetLocale === "zh-CN" || parsed?.targetLocale === "en-US" ? parsed.targetLocale : fallback.targetLocale,
    style: {
      theme: parsed?.style?.theme === "light" ? "light" : fallback.style.theme,
      tone: sanitizeUiText(parsed?.style?.tone || "") || fallback.style.tone,
      market: parsed?.style?.market === "global" ? "global" : fallback.style.market,
    },
    pages: uniqueLowerStrings(parsed?.pages ?? [], fallback.pages),
    layout: {
      editor: uniqueLowerStrings(parsed?.layout?.editor ?? [], fallback.layout.editor ?? []),
    },
    aiTools: uniqueLowerStrings(parsed?.aiTools ?? [], fallback.aiTools),
    templates: uniqueLowerStrings(parsed?.templates ?? [], fallback.templates),
    plans: uniqueLowerStrings(parsed?.plans ?? [], fallback.plans),
    deploymentDefaults: fallback.deploymentDefaults,
    preferredScaffold: sanitizeUiText(parsed?.preferredScaffold || "") || fallback.preferredScaffold,
    summary: sanitizeUiText(parsed?.summary || "") || fallback.summary,
  } satisfies PlannerSpec
}

function getPlanGenerationDirective(planTier: PlanTier, region: Region) {
  if (planTier === "elite") {
    return region === "cn"
      ? "面向精英套餐：输出要接近展示级成品，至少体现更强的视觉统一性、多页面结构、更多可复用模块和更完整的信息架构。"
      : "Target the elite tier: make the output feel showcase-grade with stronger visual consistency, more pages, deeper reusable modules, and fuller information architecture."
  }
  if (planTier === "pro") {
    return region === "cn"
      ? "面向专业套餐：输出应明显强于基础版，包含分析页、更多业务区块、更完整组件拆分和更清晰的数据表达。"
      : "Target the pro tier: make it clearly richer than the basic tier with analytics, more business sections, better component splitting, and clearer data expression."
  }
  if (planTier === "builder") {
    return region === "cn"
      ? "面向建造者套餐：输出应包含双视图、增强筛选、统计模块和更成熟的工作台观感。"
      : "Target the builder tier: include dual views, enhanced filtering, metric modules, and a more mature workspace feel."
  }
  return region === "cn"
    ? "面向免费或入门套餐：保持结构完整，但控制在首版可用、可迭代、不过度展开。"
    : "Target the free or starter tier: keep it complete and usable, but scoped to a solid first version without over-expanding."
}

async function callPlannerModel(args: {
  prompt: string
  region: Region
  planTier: PlanTier
  deploymentTarget: DeploymentTarget
  databaseTarget: DatabaseTarget
}): Promise<PlannerSpec> {
  const { prompt, region, planTier, deploymentTarget, databaseTarget } = args
  const config = resolveAiConfig({ mode: "planner" })
  const system = [
    "You are the planning layer for a Next.js application generator.",
    "Return strict JSON only.",
    "Do not write UI copy from the raw prompt. Convert the prompt into structured product intent.",
    "Prefer product language and reusable structure over literal prompt echoing.",
    "For AI code platform or Cursor-like prompts, always include dashboard, editor, runs, templates, and pricing.",
    "For code-platform products, the editor layout must include activity_bar, file_tree, tab_editor, terminal_panel, and ai_assistant_panel.",
    "For code-platform products, AI tools must include explain, fix, generate, and refactor.",
  ].join("\n")

  const user = [
    `Prompt: ${prompt}`,
    `Region: ${region}`,
    `Plan tier: ${planTier}`,
    `Deployment target: ${deploymentTarget}`,
    `Database target: ${databaseTarget}`,
    'Return JSON with this schema: {"productName":"","productType":"","targetLocale":"zh-CN|en-US","style":{"theme":"dark|light","tone":"","market":"china|global"},"pages":[],"layout":{"editor":[]},"aiTools":[],"templates":[],"plans":[],"deploymentDefaults":{"cn":["cloudbase","cloud_docs"],"global":["vercel","supabase"]},"preferredScaffold":"","summary":""}',
  ].join("\n\n")

  try {
    const { content } = await requestJsonChatCompletion({
      config,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      timeoutMs: 90_000,
      mode: "planner",
    })
    if (!content) {
      return fallbackPlannerSpec(prompt, region, deploymentTarget, databaseTarget)
    }
    const parsed = JSON.parse(sanitizeJsonText(extractJsonObject(content))) as Partial<PlannerSpec>
    return normalizePlannerSpec(parsed, prompt, region, deploymentTarget, databaseTarget)
  } catch {
    return fallbackPlannerSpec(prompt, region, deploymentTarget, databaseTarget)
  }
}

function plannerProductTypeToAppKind(productType: PlannerProductType): AppKind {
  if (productType === "ai_code_platform") return "code_platform"
  if (productType === "crm_workspace") return "crm"
  if (productType === "community_hub") return "community"
  if (productType === "content_site") return "blog"
  return "task"
}

function createPlannedAppSpec(args: {
  prompt: string
  region: Region
  planTier: PlanTier
  planner: PlannerSpec
  deploymentTarget: DeploymentTarget
  databaseTarget: DatabaseTarget
}): AppSpec {
  const { prompt, region, planTier, planner, deploymentTarget, databaseTarget } = args
  const kind = plannerProductTypeToAppKind(planner.productType)
  const modules = [
    ...planner.pages.map((page) => `${page} page`),
    ...planner.aiTools.map((tool) => `ai:${tool}`),
    ...planner.templates,
  ]
  const features: SpecFeature[] =
    kind === "code_platform"
      ? (["description_field", "assignee_filter", ...(planTier === "pro" || planTier === "elite" ? ["analytics_page", "about_page", "blocked_status"] : [])] as SpecFeature[])
      : (["description_field", "assignee_filter"] as SpecFeature[])

  return createAppSpec(prompt, region, {
    title: planner.productName,
    kind,
    planTier,
    templateId: kind === "code_platform" ? "" : inferTemplateIdFromPrompt(prompt),
    deploymentTarget,
    databaseTarget,
    modules,
    features,
  })
}

async function callGeneratorModel(
  prompt: string,
  planner: PlannerSpec,
  region: Region,
  projectId: string,
  planTier: PlanTier,
  deploymentTarget?: DeploymentTarget,
  databaseTarget?: DatabaseTarget
): Promise<GeneratorModelOutput> {
  const config = resolveAiConfig({ mode: "builder" })
  const brief = buildGenerationBrief(prompt, region, planTier)
  const deployment = getDeploymentOption(deploymentTarget ?? getDefaultDeploymentTarget(region))
  const database = getDatabaseOption(databaseTarget ?? getDefaultDatabaseTarget(region))

  const system = [
    "You are a fullstack Next.js app generator.",
    "Return strict JSON only with this schema:",
    '{"summary":"...", "files":[{"path":"relative/path","content":"full file content"}]}',
    "Rules:",
    "- Use Next.js app router with TypeScript.",
    "- Generate practical multi-feature UI, not placeholder text.",
    "- Keep output runnable and minimal-dependency.",
    "- Keep visual language consistent across hero, cards, controls, spacing, and secondary pages.",
    "- If a template baseline is provided, preserve its layout mood, color system, typography feel, and component density.",
    "- Do not echo the user's raw prompt into the product UI.",
    "- Do not turn every app into the same admin/task board shell.",
    "- Match the product archetype implied by the prompt: code platform, CRM, marketing site, API platform, community hub, etc.",
    "- For high-end prompts, make the result feel showcase-grade and directly demoable to stakeholders.",
    "- Prefer shipping a coherent product surface over exposing generation steps, prompt text, or scaffolding internals.",
    "- Prefer production-like multi-section pages and reusable components over a single simplistic screen.",
    "- Think in two phases: first infer the product archetype and interaction model, then generate implementation files.",
    "- Infer missing but necessary product structure instead of literally mirroring the prompt as headings.",
    "- Avoid static mock screens with dead buttons. Important controls should navigate, switch state, or reveal behavior.",
    "- A complete app must include real user flows, not just a few presentational pages.",
    "- Prefer stateful CRUD patterns, auth-aware surfaces, settings/state transitions, and actionable controls over decorative cards.",
    "- When generating dashboards, editors, admin panels, CRM, or platforms, include the operational flows those products need in order to feel usable.",
    "- When a product needs data, settings, search, runs, or editor behavior, generate simple local API routes and in-memory or file-backed state so the flows can actually be exercised.",
    "- Generated pages should share stateful navigation, not behave like isolated static posters.",
    "- Include settings, share/distribution, permissions, or publish surfaces when they are naturally expected for the product type.",
    "- Treat auth, billing, data mutation, visibility, and delivery controls as product capabilities, not optional polish.",
    "- Search bars, editors, command inputs, tabs, and action buttons must do something observable in the UI instead of acting as dead placeholders.",
    "- For code platforms or IDE-like products, include real file navigation, tab switching, editable code surfaces, runtime status, logs, and command or global search behavior.",
    "- For generated workspaces, include enough local state and API routes so demo flows can be exercised immediately after generation.",
    "- Make the first generated version feel like a usable product: include a strong primary surface, at least 2 supporting routes or views when the product type needs them, and clear navigation between them.",
    "- Prefer a small set of well-connected modules over many shallow placeholder sections. Each major surface should have a reason to exist.",
    "- Keep dependencies conservative. Do not import packages that are not already declared in package.json unless they are truly necessary.",
    "- Avoid fragile code patterns that often break preview startup: missing default exports, invalid hooks usage, browser-only APIs during server render, or references to undefined config.",
    "- Keep admin and market as separate standalone surfaces rather than embedding them into the end-user workspace navigation.",
    "- Prefer modifying these files: app/page.tsx, app/layout.tsx, app/api/items/route.ts, prisma/schema.prisma, README.md.",
    "- Never return markdown, only JSON.",
  ].join("\n")

  const user = [
    `Project ID: ${projectId}`,
    `Region: ${region}`,
    `Plan tier: ${planTier}`,
    `Deployment target: ${deployment.id} (${deployment.runtime}, dockerRequired=${deployment.dockerRequired})`,
    `Database target: ${database.id} (${database.engine})`,
    `Raw user prompt: ${prompt}`,
    `Planner spec: ${JSON.stringify(planner)}`,
    `Generation brief: ${JSON.stringify(brief)}`,
    getPlanGenerationDirective(planTier, region),
    region === "cn"
      ? "如果需求是中国团队使用的产品，请优先使用中文工作流、项目交付语义、客户转化或团队协作语境。"
      : "If the product is for international users, prefer globally legible workflow, collaboration, and product language.",
    "Do not expose internal notes, prompt text, generation explanation panels, or 'AI result understanding' copy in the final UI unless explicitly requested.",
    "Make different prompt categories produce visibly different products rather than one reused layout.",
    "Generate a production-like MVP app with meaningful structure and interactions.",
    "Respect the selected deployment and database targets when deciding auth, data flow, runtime assumptions, and infrastructure copy.",
    region === "cn"
      ? "默认按“完整应用”理解，不要只生成几个页面。要优先补齐数据流、操作按钮、状态切换、分享/交付/设置等真实能力。"
      : "Default to a complete application, not a few isolated pages. Prioritize data flow, actions, state transitions, sharing, delivery, and settings.",
    region === "cn"
      ? "如果是平台、后台、编辑器、CRM、数据面板，默认需要有设置、权限、分享、可见性、发布或交付控制之一。"
      : "For platforms, admin tools, editors, CRM, or data panels, include at least some combination of settings, permissions, sharing, visibility, publishing, or delivery controls.",
    region === "cn"
      ? "如果是代码平台或中国版 Cursor 类产品，必须体现：文件树、标签页、可编辑代码、命令/全局搜索、运行日志、模板入口、发布与交付状态。"
      : "For code platforms or Cursor-like products, include: file tree, tabs, editable code, command/global search, runtime logs, template entry, and publish/delivery state.",
    region === "cn"
      ? "产出目标参考成熟 AI SaaS / Base44 风格：不是静态海报页，而是具备导航、主工作区、可操作面板、设置或发布链路的可演示产品。"
      : "Aim closer to a mature AI SaaS / Base44-style MVP: not a poster page, but a demoable product with navigation, a main workspace, actionable panels, and settings or publish flows.",
  ].join("\n\n")

  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ]
  const { content: raw } = await requestJsonChatCompletion({
    config,
    messages,
    temperature: 0.3,
    timeoutMs: 90_000,
    mode: "builder",
  })
  if (!raw) {
    throw new Error("Empty model response")
  }
  const parsed = parseGeneratorOutput(raw)
  if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
    throw new Error("Model returned no files")
  }
  return parsed
}

async function applyGeneratedFiles(
  outDir: string,
  files: GeneratedFile[]
) {
  const changed: string[] = []
  for (const item of files) {
    const relative = normalizePath(String(item.path ?? ""))
    if (!isAllowedFile(relative)) continue
    const absolute = path.resolve(outDir, relative)
    const root = path.resolve(outDir)
    if (!absolute.startsWith(root + path.sep) && absolute !== root) continue
    await writeTextFile(absolute, String(item.content ?? ""))
    changed.push(relative)
  }
  return changed
}

async function writeGeneratedProjectFiles(
  outDir: string,
  projectId: string,
  region: Region,
  prompt: string,
  options?: {
    titleOverride?: string
    templateId?: string
    templateStyle?: TemplatePreviewStyle
    planTier?: PlanTier
    deploymentTarget?: DeploymentTarget
    databaseTarget?: DatabaseTarget
  }
) {
  const dbFile = region === "cn" ? "cn.db" : "intl.db"
  const defaults = getRegionDefaults(region)
  const deploymentTarget = options?.deploymentTarget ?? getDefaultDeploymentTarget(region)
  const databaseTarget = options?.databaseTarget ?? getDefaultDatabaseTarget(region)
  const deployment = getDeploymentOption(deploymentTarget)
  const database = getDatabaseOption(databaseTarget)

  await writeTextFile(
    path.join(outDir, "README.md"),
    `# Generated Fullstack App (${projectId})

Region: ${region}
Preview DB: ${dbFile}
Deploy target: ${deployment.nameEn}
Deploy runtime: ${deployment.runtime}
Production database: ${database.nameEn}

Prompt:
${prompt}

## Install
\`\`\`bash
npm install
\`\`\`

## DB migrate (SQLite)
\`\`\`bash
npx prisma migrate dev --name init
\`\`\`

## Run
\`\`\`bash
npx next dev --webpack -p 3001
\`\`\`

## Deployment target
- ${deployment.nameEn}: ${deployment.descriptionEn}
- ${database.nameEn}: ${database.descriptionEn}

## Deployment env
${[...getDeploymentEnvGuide(deploymentTarget), ...getDatabaseEnvGuide(databaseTarget)].map((item) => `- ${item}`).join("\n")}
`
  )

  await writeTextFile(
    path.join(outDir, "package.json"),
    JSON.stringify(
      {
        name: projectId,
        private: true,
        scripts: {
          dev: "next dev --webpack -p 3001",
          build: "next build",
          start: "next start -p 3001",
          prisma: "prisma",
        },
        dependencies: {
          next: "16.1.6",
          react: "^19",
          "react-dom": "^19",
          "@prisma/client": "^6.0.0",
        },
        devDependencies: {
          prisma: "^6.0.0",
          typescript: "^5.0.0",
          "@types/node": "^20.0.0",
          "@types/react": "^19.0.0",
          "@types/react-dom": "^19.0.0",
        },
      },
      null,
      2
    )
  )

  await writeTextFile(
    path.join(outDir, "next.config.ts"),
    `import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' http://localhost:3000 http://127.0.0.1:3000",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
`
  )

  await writeTextFile(
    path.join(outDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: false,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
        exclude: ["node_modules"],
      },
      null,
      2
    )
  )

  await writeTextFile(
    path.join(outDir, "next-env.d.ts"),
    "/// <reference types=\"next\" />\n/// <reference types=\"next/image-types/global\" />\n"
  )

  await writeTextFile(
    path.join(outDir, ".env"),
    `DATABASE_URL="file:./${dbFile}"\nAPP_REGION="${region}"\nAPP_PLAN_TIER="${options?.planTier ?? "free"}"\nAPP_LOCALE="${defaults.language}"\nAPP_TIMEZONE="${defaults.timezone}"\nAPP_CURRENCY="${defaults.currency}"\nAPP_DEPLOY_TARGET="${deploymentTarget}"\nAPP_DEPLOY_RUNTIME="${deployment.runtime}"\nAPP_DEPLOY_DOCKER_REQUIRED="${deployment.dockerRequired ? "true" : "false"}"\nAPP_DATABASE_TARGET="${databaseTarget}"\nAPP_DATABASE_ENGINE="${database.engine}"\n`
  )

  await writeTextFile(
    path.join(outDir, ".env.example"),
    `DATABASE_URL="file:./${dbFile}"\nAPP_REGION="${region}"\nAPP_PLAN_TIER="${options?.planTier ?? "free"}"\nAPP_LOCALE="${defaults.language}"\nAPP_TIMEZONE="${defaults.timezone}"\nAPP_CURRENCY="${defaults.currency}"\nAPP_DEPLOY_TARGET="${deploymentTarget}"\nAPP_DEPLOY_RUNTIME="${deployment.runtime}"\nAPP_DEPLOY_DOCKER_REQUIRED="${deployment.dockerRequired ? "true" : "false"}"\nAPP_DATABASE_TARGET="${databaseTarget}"\nAPP_DATABASE_ENGINE="${database.engine}"\n${[...getDeploymentEnvGuide(deploymentTarget), ...getDatabaseEnvGuide(databaseTarget)].map((key) => `${key}=`).join("\n")}\n`
  )

  await writeTextFile(
    path.join(outDir, "region.config.json"),
    JSON.stringify(
      {
        region,
        language: defaults.language,
        timezone: defaults.timezone,
        dateFormat: defaults.dateFormat,
        currency: defaults.currency,
        deploymentTarget,
        deploymentRuntime: deployment.runtime,
        databaseTarget,
        databaseEngine: database.engine,
        seedTasks: defaults.seedTasks,
      },
      null,
      2
    )
  )

  const current = await getCurrentSession()
  const latestCompletedPayment = current ? await getLatestCompletedPayment(current.user.id) : null
  const template = options?.templateId ? getTemplateById(options.templateId) : null
  await writeProjectSpec(
    outDir,
    createAppSpec(
      prompt,
      region,
      {
        title: options?.titleOverride,
        planTier: options?.planTier ?? ((latestCompletedPayment?.planId as PlanTier | undefined) ?? "free"),
        templateId: options?.templateId,
        templateStyle: options?.templateStyle,
        deploymentTarget,
        databaseTarget,
      } as Parameters<typeof createAppSpec>[2]
    )
  )

  await writeTextFile(
    path.join(outDir, "prisma", "schema.prisma"),
    `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Task {
  id          String   @id @default(cuid())
  title       String
  description String?
  status      String   @default("todo")
  priority    String   @default("medium")
  assignee    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
`
  )

  await writeTextFile(
    path.join(outDir, "lib", "prisma.ts"),
    `import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
`
  )

  await writeTextFile(
    path.join(outDir, "app", "api", "items", "route.ts"),
    `import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const tasks = await prisma.task.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const task = await prisma.task.create({
    data: {
      title,
      description: String(body?.description ?? "").trim() || null,
      status: String(body?.status ?? "todo"),
      priority: String(body?.priority ?? "medium"),
      assignee: String(body?.assignee ?? "").trim() || null,
    },
  });
  return NextResponse.json(task);
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(typeof body?.title === "string" ? { title: String(body.title).trim() || undefined } : {}),
      ...(typeof body?.description === "string" ? { description: String(body.description).trim() || null } : {}),
      ...(typeof body?.status === "string" ? { status: String(body.status).trim() || undefined } : {}),
      ...(typeof body?.priority === "string" ? { priority: String(body.priority).trim() || undefined } : {}),
      ...(typeof body?.assignee === "string" ? { assignee: String(body.assignee).trim() || null } : {}),
    },
  });
  return NextResponse.json(task);
}
`
  )

  await writeTextFile(
    path.join(outDir, "app", "page.tsx"),
    `"use client";

import { useEffect, useState } from "react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  assignee: string | null;
  createdAt: string;
};

export default function Page() {
  const REGION = {
    region: "${region}",
    language: "${defaults.language}",
    timezone: "${defaults.timezone}",
    dateFormat: "${defaults.dateFormat}",
    currency: "${defaults.currency}",
    labels: ${JSON.stringify(defaults.labels)},
    seedTasks: ${JSON.stringify(defaults.seedTasks)},
  } as const;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [loading, setLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);

  async function load() {
    const res = await fetch("/api/items");
    const data = (await res.json()) as Task[];
    setTasks(data);
  }

  async function add() {
    const t = title.trim();
    if (!t) return;
    setLoading(true);
    try {
      await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          assignee: assignee.trim(),
          priority,
          status: "todo",
        }),
      });
      setTitle("");
      setAssignee("");
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(id: string, status: Task["status"]) {
    await fetch("/api/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (seeded) return;
    if (tasks.length > 0) {
      setSeeded(true);
      return;
    }
    const run = async () => {
      for (const item of REGION.seedTasks) {
        await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
      }
      setSeeded(true);
      await load();
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, seeded]);

  const groups: Array<{ key: Task["status"]; label: string }> = [
    { key: "todo", label: REGION.labels.todo },
    { key: "in_progress", label: REGION.labels.inProgress },
    { key: "done", label: REGION.labels.done },
  ];

  const visibleTasks = tasks.filter((t) => {
    const f = assigneeFilter.trim().toLowerCase();
    if (!f) return true;
    return String(t.assignee || "").toLowerCase().includes(f);
  });

  const currencyFmt = new Intl.NumberFormat(REGION.language, {
    style: "currency",
    currency: REGION.currency,
    maximumFractionDigits: 0,
  });
  const dateFmt = new Intl.DateTimeFormat(REGION.language, {
    dateStyle: "medium",
    timeZone: REGION.timezone,
  });

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1200 }}>
      <h1>{REGION.labels.title}</h1>
      <p style={{ color: "#666" }}>
        {REGION.labels.subtitle}
      </p>
      <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
        {REGION.labels.localeInfo}: {REGION.region} | {REGION.language} | {REGION.timezone} | {REGION.dateFormat} | {REGION.currency}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: "#666" }}>
        {REGION.labels.monthlyTarget}: {currencyFmt.format(120000)}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={REGION.labels.taskTitle}
          style={{ flex: 1, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <input
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder={REGION.labels.assignee}
          style={{ width: 160, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <input
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          placeholder={REGION.labels.filter}
          style={{ width: 180, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
          style={{ width: 120, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button
          onClick={add}
          disabled={loading}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
        >
          {loading ? REGION.labels.creating : REGION.labels.create}
        </button>
      </div>

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(3,minmax(0,1fr))",
          gap: 12,
          alignItems: "start",
        }}
      >
        {groups.map((group) => (
          <section
            key={group.key}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 10,
              minHeight: 220,
              background: "#fafafa",
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 8 }}>{group.label}</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {visibleTasks
                .filter((t) => t.status === group.key)
                .map((task) => (
                  <article
                    key={task.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      background: "#fff",
                      padding: 10,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{task.title}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                      {REGION.labels.priority}: {task.priority} | {REGION.labels.assignee}: {task.assignee || "-"} | {dateFmt.format(new Date(task.createdAt))}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      {group.key !== "todo" ? (
                        <button
                          onClick={() => setStatus(task.id, "todo")}
                          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 8px" }}
                        >
                          Todo
                        </button>
                      ) : null}
                      {group.key !== "in_progress" ? (
                        <button
                          onClick={() => setStatus(task.id, "in_progress")}
                          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 8px" }}
                        >
                          Doing
                        </button>
                      ) : null}
                      {group.key !== "done" ? (
                        <button
                          onClick={() => setStatus(task.id, "done")}
                          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 8px" }}
                        >
                          Done
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
`
  )

  await writeTextFile(
    path.join(outDir, "app", "layout.tsx"),
    `import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="${defaults.language}">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
`
  )

  return dbFile
}

function deriveProjectHeadline(prompt: string) {
  const explicitName = extractProductNameFromPrompt(prompt)
  if (explicitName) return explicitName
  const clean = sanitizeUiText(prompt)
  if (!clean) return "Generated Task Workspace"
  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean
}

function extractProductNameFromPrompt(prompt: string) {
  const patterns = [
    /(?:名字叫|名字是|项目名(?:字)?(?:叫|是)?|产品名(?:字)?(?:叫|是)?|叫做|名为)\s*["“'`]?([A-Za-z0-9][A-Za-z0-9 _-]{1,40})["”'`]?/i,
    /(?:name\s+it|call(?:ed)?|named)\s*["“'`]?([A-Za-z0-9][A-Za-z0-9 _-]{1,40})["”'`]?/i,
  ]
  for (const re of patterns) {
    const match = prompt.match(re)
    if (match?.[1]) return sanitizeUiText(match[1])
  }
  return ""
}

function inferAppKind(prompt: string) {
  const text = prompt.toLowerCase()
  if (
    /cursor|code editor|ide|developer platform|coding workspace|ai coding|\u4ee3\u7801\u7f16\u8f91\u5668|\u7f16\u7a0b\u5e73\u53f0|\u5f00\u53d1\u8005\u5e73\u53f0|\u4ee3\u7801\u5e73\u53f0|\u4ee3\u7801\u5de5\u4f5c\u53f0/.test(text)
  ) {
    return "code_platform"
  }
  if (
    /crm|customer|sales|pipeline|lead|\u5ba2\u6237|\u9500\u552e|\u8ddf\u8fdb/.test(text)
  ) {
    return "crm"
  }
  if (
    /blog|article|post|\u535a\u5ba2|\u6587\u7ae0|\u5185\u5bb9/.test(text)
  ) {
    return "blog"
  }
  if (
    /community|club|social|group|\u793e\u533a|\u793e\u56e2|\u793e\u4ea4/.test(text)
  ) {
    return "community"
  }
  return "task"
}

function inferTemplateIdFromPrompt(prompt: string) {
  const text = String(prompt ?? "").toLowerCase()
  if (
    /cursor|code editor|ide|developer platform|coding workspace|ai coding|\u4ee3\u7801\u7f16\u8f91\u5668|\u7f16\u7a0b\u5e73\u53f0|\u5f00\u53d1\u8005\u5e73\u53f0|\u4ee3\u7801\u5e73\u53f0|\u4ee3\u7801\u5de5\u4f5c\u53f0/.test(text)
  ) {
    return "siteforge"
  }
  if (/crm|customer|sales|pipeline|lead|\u5ba2\u6237|\u9500\u552e|\u8ddf\u8fdb/.test(text)) {
    return "opsdesk"
  }
  if (/website|landing|homepage|download|docs|documentation|\u5b98\u7f51|\u843d\u5730\u9875|\u4e0b\u8f7d\u9875|\u6587\u6863/.test(text)) {
    return "launchpad"
  }
  if (/api|analytics|dashboard|monitoring|usage trend|error alert|\u63a5\u53e3|\u5206\u6790\u5e73\u53f0|\u4eea\u8868\u76d8|\u76d1\u63a7|\u8d8b\u52bf/.test(text)) {
    return "taskflow"
  }
  if (/community|club|social|group|announcement|event|feedback|\u793e\u533a|\u793e\u56e2|\u793e\u4ea4|\u516c\u544a|\u6d3b\u52a8|\u53cd\u9988/.test(text)) {
    return "orbital"
  }
  return undefined
}

function buildGenerationBrief(prompt: string, region: Region, planTier: PlanTier) {
  const kind = inferAppKind(prompt)
  const templateId = inferTemplateIdFromPrompt(prompt)
  const isCn = region === "cn"

  const productArchetype =
    kind === "code_platform"
      ? isCn
        ? "AI 代码编辑平台"
        : "AI coding platform"
      : kind === "crm"
        ? isCn
          ? "销售与客户管理平台"
          : "sales and CRM workspace"
        : kind === "community"
          ? isCn
            ? "社区与反馈平台"
            : "community and feedback platform"
          : kind === "blog"
            ? isCn
              ? "内容与官网平台"
              : "content and marketing platform"
            : isCn
              ? "任务与运营平台"
              : "task and operations workspace"

  const mandatorySurfaces =
    kind === "code_platform"
      ? isCn
        ? ["dashboard 总览", "editor 编辑器", "runs 运行面板", "templates 模板库", "settings 设置页", "pricing 套餐页"]
        : ["dashboard overview", "editor workspace", "runs panel", "template gallery", "settings page", "pricing page"]
      : templateId === "opsdesk"
        ? isCn
          ? ["总览页", "线索页", "任务页", "分析页"]
          : ["overview", "leads", "tasks", "analytics"]
        : templateId === "taskflow"
          ? isCn
            ? ["总览页", "接口或事件页", "分析页", "文档或下载页"]
            : ["overview", "API or incidents page", "analytics", "docs or downloads"]
          : isCn
            ? ["首页", "二级页", "业务板块", "转化入口"]
            : ["home", "secondary page", "business section", "conversion entry"]

  const interactionRules =
    kind === "code_platform"
      ? isCn
        ? [
            "文件树、标签页、AI 模式、模板入口、运行入口必须可点击切换或跳转",
            "左侧文件树、上方标签和中间代码区要联动，不能彼此断开",
            "搜索要能命中文件、符号或命令，终端和运行状态也要能变化",
            "不要只堆卡片，要有 IDE 主壳和页面之间的导航连续性",
            "不要把用户原始要求、Prompt、AI 理解过程显示在产品页面里",
          ]
        : [
            "File tree, tabs, AI modes, template entry, and runtime entry must be clickable or switchable",
            "The explorer, top tabs, and central code surface must stay linked instead of acting like separate mock panels",
            "Search should hit files, symbols, or commands, and terminal/runtime state must visibly change",
            "Do not only stack cards; keep a coherent IDE shell and cross-page navigation",
            "Do not expose the raw user prompt or AI reasoning in the product UI",
          ]
      : isCn
        ? [
            "核心按钮至少要能进行真实跳转，而不是纯展示",
            "生成结果要符合产品类型，不能退化成同一套任务后台",
            "不要显示内部生成流程、Prompt、AI 理解说明",
          ]
        : [
            "Primary actions must navigate somewhere real instead of being decorative",
            "The output must match the product archetype instead of collapsing into one admin shell",
            "Do not show internal generation flow, prompt text, or AI explanation panels",
          ]

  const tierDepth =
    planTier === "elite"
      ? isCn
        ? "精英档：展示级成品感，更多页面、更强层级、更多真实交互。"
        : "Elite tier: showcase-grade surface with more pages, stronger hierarchy, and more real interactions."
      : planTier === "pro"
        ? isCn
          ? "专业档：产品感明显高于免费版，不能只是更换配色或增加几张卡片。"
          : "Pro tier: clearly more product-grade than free, not just recolored cards."
        : isCn
          ? "免费档：允许范围更小，但仍然要像可用产品骨架。"
          : "Free tier: narrower scope is acceptable, but it must still feel like a usable product skeleton."

  const requiredOperationalFlows =
    kind === "code_platform"
      ? isCn
        ? ["代码编辑", "运行预览", "模板切换", "命令或全局搜索", "保存与回写", "分享/发布", "设置与权限"]
        : ["code editing", "runtime preview", "template switching", "command or global search", "save and write-back", "share/publish", "settings and permissions"]
      : kind === "crm"
        ? isCn
          ? ["线索流转", "负责人分配", "权限设置", "分享与交付"]
          : ["lead flow", "owner assignment", "permission settings", "sharing and delivery"]
        : templateId === "taskflow"
          ? isCn
            ? ["数据查看", "接口或事件处理", "告警或状态流", "发布与权限"]
            : ["data views", "API or incident handling", "alert or state flows", "publishing and permissions"]
          : isCn
            ? ["内容浏览", "操作入口", "设置或可见性", "交付或分享"]
            : ["content browsing", "action entry", "settings or visibility", "delivery or sharing"]

  return {
    kind,
    templateId,
    productArchetype,
    mandatorySurfaces,
    interactionRules,
    tierDepth,
    requiredOperationalFlows,
  }
}

async function enforcePromptIdentity(outDir: string, prompt: string) {
  const title = deriveProjectHeadline(prompt)
  const pagePath = path.join(outDir, "app", "page.tsx")
  const changed: string[] = []
  try {
    const raw = await fs.readFile(pagePath, "utf8")
    let next = raw
    if (!next.includes(title)) {
      if (/<h1[^>]*>[\s\S]*?<\/h1>/.test(next)) {
        next = next.replace(/<h1([^>]*)>[\s\S]*?<\/h1>/, `<h1$1>${title}</h1>`)
      } else {
        next = next.replace("Generated Task Workspace", title)
      }
    }
    if (next !== raw) {
      await fs.writeFile(pagePath, next, "utf8")
      changed.push("app/page.tsx")
    }
  } catch {
    // noop
  }
  return changed
}

async function isAiOutputTooGeneric(outDir: string, prompt: string) {
  const kind = inferAppKind(prompt)
  const inferredTemplateId = inferTemplateIdFromPrompt(prompt)
  const pagePath = path.join(outDir, "app", "page.tsx")
  try {
    const page = await fs.readFile(pagePath, "utf8")
    if (/生成流程|Prompt|AI 结果理解|AI understanding|模板与结果预览|当前工作区说明|Generated Files/i.test(page)) return true
    if (kind === "code_platform" && !/MornCursor|代码编辑平台|AI 助手|编辑器|模板库|运行面板/i.test(page)) return true
    if (kind === "code_platform" && !/settings|share|publish|visibility|权限|分享|发布|可见性/i.test(page)) return true
    if (kind === "crm" && !/Lead|pipeline|Qualified|owner/i.test(page)) return true
    if (kind === "crm" && !/settings|invite|share|权限|分享|邀请|设置/i.test(page)) return true
    if (kind === "community" && !/Event|community|member|announcement/i.test(page)) return true
    if (kind === "blog" && !/Post|category|article|editorial/i.test(page)) return true
    if (inferredTemplateId === "launchpad" && !/pricing|download|docs|cta|pricing|文档|下载|转化|定价/i.test(page)) return true
    if (inferredTemplateId === "taskflow" && !/analytics|api|trend|dashboard|usage|接口|分析|趋势|监控/i.test(page)) return true
    if (inferredTemplateId === "taskflow" && !/settings|share|publish|权限|分享|发布|设置/i.test(page)) return true
    if (inferredTemplateId === "opsdesk" && !/sales|lead|owner|pipeline|成交|线索|负责人|阶段/i.test(page)) return true
    if (inferredTemplateId === "orbital" && !/community|event|announcement|feedback|社区|活动|公告|反馈/i.test(page)) return true
    if (page.includes("Generated Task Workspace") && kind !== "task") return true
  } catch {
    return true
  }

  if (kind === "code_platform" || inferredTemplateId === "siteforge") {
    const codePlatformChecks: Array<{ relative: string; pattern: RegExp }> = [
      {
        relative: "app/dashboard/page.tsx",
        pattern: /MornCursor|AI coding|代码编辑|执行轨道|editor|templates|runs/i,
      },
      {
        relative: "app/editor/page.tsx",
        pattern: /AI Assistant|AI 助手|Terminal|终端|Explorer|资源管理器|Generate code|生成代码/i,
      },
      {
        relative: "app/runs/page.tsx",
        pattern: /Runs|运行面板|build|deploy|preview|workspace|demo/i,
      },
      {
        relative: "app/templates/page.tsx",
        pattern: /Templates|模板库|API platform|销售后台|社区反馈|China-ready Cursor|中国版 Cursor/i,
      },
      {
        relative: "app/settings/page.tsx",
        pattern: /Settings|设置|database|deployment|权限|visibility|publish/i,
      },
      {
        relative: "app/pricing/page.tsx",
        pattern: /Free|Pro|Elite|免费版|专业版|精英版/i,
      },
    ]

    for (const item of codePlatformChecks) {
      try {
        const content = await fs.readFile(path.join(outDir, item.relative), "utf8")
        if (!item.pattern.test(content)) return true
      } catch {
        return true
      }
    }
  }

  const requiredByTemplate: Record<string, string[]> = {
    siteforge: ["app/dashboard/page.tsx", "app/editor/page.tsx", "app/runs/page.tsx", "app/templates/page.tsx", "app/settings/page.tsx", "app/pricing/page.tsx"],
    opsdesk: ["app/leads/page.tsx"],
    taskflow: ["app/incidents/page.tsx"],
    orbital: ["app/events/page.tsx"],
    launchpad: ["app/downloads/page.tsx"],
  }

  const requiredFiles = inferredTemplateId ? requiredByTemplate[inferredTemplateId] ?? [] : []
  for (const relative of requiredFiles) {
    try {
      await fs.access(path.join(outDir, relative))
    } catch {
      return true
    }
  }

  return false
}

async function applyPromptDrivenFallback(outDir: string, prompt: string, region: Region) {
  const previousSpec = await readProjectSpec(outDir)
  const spec = createAppSpec(prompt, region, previousSpec ?? undefined)
  const files = await buildSpecDrivenWorkspaceFiles(outDir, spec)
  const changed = new Set<string>()

  for (const file of files) {
    const relative = normalizePath(file.path)
    if (!isAllowedFile(relative)) continue
    const absolute = path.resolve(outDir, relative)
    const root = path.resolve(outDir)
    if (!absolute.startsWith(root + path.sep) && absolute !== root) continue
    await writeTextFile(absolute, file.content)
    changed.add(relative)
  }

  const identityChanged = await enforcePromptIdentity(outDir, prompt)
  for (const item of identityChanged) {
    changed.add(item)
  }

  return Array.from(changed)
}

async function stabilizeGeneratedWorkspace(
  outDir: string,
  prompt: string,
  region: Region
) {
  const stabilized = await applyPromptDrivenFallback(outDir, prompt, region)
  return stabilized
}

async function runGenerateTaskWorker(jobId: string) {
  const current = (await getGenerateTask(jobId)) as GenerateTaskRecord | null
  if (!current) return

  const outDir = getWorkspacePath(current.projectId)
  const rawPrompt = current.rawPrompt || current.prompt
  const projectRecord = (await getProject(current.projectId)) as
    | ({
        deploymentTarget?: DeploymentTarget
        databaseTarget?: DatabaseTarget
      } & Awaited<ReturnType<typeof getProject>>)
    | null
  const deploymentTarget = projectRecord?.deploymentTarget ?? getDefaultDeploymentTarget(current.region)
  const databaseTarget = projectRecord?.databaseTarget ?? getDefaultDatabaseTarget(current.region)
  const currentTemplate = current.templateId ? getTemplateById(current.templateId) : null
  const logs: string[] = []
  let summary = "Initial project generated"
  let changedFiles: string[] = []

  await updateGenerateTask(jobId, (t) => ({ ...t, status: "running", error: undefined }))
  await appendGenerateTaskLog(jobId, "[1/6] 任务开始：准备工作区")
  if (current.templateTitle) {
    await appendGenerateTaskLog(jobId, `[1.5/6] 已加载模板基线：${current.templateTitle}`)
  }

  try {
    await ensureDir(outDir)
    await appendGenerateTaskLog(jobId, "[2/6] 正在规划产品蓝图")
    const planner = await callPlannerModel({
      prompt: rawPrompt,
      region: current.region,
      planTier: current.planTier ?? "free",
      deploymentTarget,
      databaseTarget,
    })
    await appendGenerateTaskLog(
      jobId,
      `[2.5/6] 规划完成：${planner.productName} · ${planner.productType} · scaffold=${planner.preferredScaffold}`
    )

    await writeGeneratedProjectFiles(outDir, current.projectId, current.region, rawPrompt, {
      titleOverride: planner.productName,
      templateId: current.templateId,
      templateStyle: currentTemplate?.previewStyle,
      planTier: current.planTier,
      deploymentTarget,
      databaseTarget,
    })
    logs.push("[OK] Base scaffold generated")
    await appendGenerateTaskLog(jobId, "[3/6] 基础脚手架已生成")

    const plannedSpec = createPlannedAppSpec({
      prompt: rawPrompt,
      region: current.region,
      planTier: current.planTier ?? "free",
      planner,
      deploymentTarget,
      databaseTarget,
    })
    await writeProjectSpec(outDir, plannedSpec)
    const scaffoldFiles = await buildSpecDrivenWorkspaceFiles(outDir, plannedSpec)
    const scaffoldChanged = await applyGeneratedFiles(
      outDir,
      scaffoldFiles.map((file) => ({ path: file.path, content: file.content }))
    )
    changedFiles = Array.from(new Set([...changedFiles, ...scaffoldChanged]))
    await appendGenerateTaskLog(jobId, `[3.5/6] 已按规划落地 ${scaffoldChanged.length} 个 scaffold 文件`)

    if (plannedSpec.kind === "code_platform") {
      summary =
        current.region === "cn"
          ? `已生成 ${planner.productName} 的 AI 代码平台骨架，包含 dashboard、editor、runs、templates、pricing 五页与可演示工作台。`
          : `Generated the ${planner.productName} AI code platform scaffold with dashboard, editor, runs, templates, and pricing.`
      await appendGenerateTaskLog(jobId, "[4/6] 命中 ai_code_platform_scaffold，跳过自由生成并保留稳定骨架")
    } else {
      try {
        await appendGenerateTaskLog(jobId, "[4/6] 正在调用 AI Builder 生成业务页面和代码")
        const modelOutput = await callGeneratorModel(
          rawPrompt,
          planner,
          current.region,
          current.projectId,
          current.planTier ?? "free",
          deploymentTarget,
          databaseTarget
        )
        const aiChanged = await applyGeneratedFiles(outDir, modelOutput.files)
        changedFiles = Array.from(new Set([...changedFiles, ...aiChanged]))

        const stabilized = await stabilizeGeneratedWorkspace(outDir, current.prompt, current.region)
        changedFiles = Array.from(new Set([...changedFiles, ...stabilized]))

        if (aiChanged.length > 0) {
          summary =
            current.region === "cn"
              ? `已生成并稳定化 ${aiChanged.length} 个核心文件，工作区可继续预览与迭代`
              : `Generated and stabilized ${aiChanged.length} core files for further preview and iteration`
          logs.push(`[OK] AI generation applied: ${aiChanged.length} files`)
          await appendGenerateTaskLog(jobId, `[4/6] AI 输出已应用：${aiChanged.length} 个文件`)
          await appendGenerateTaskLog(jobId, "[4.5/6] 已对核心页面执行稳定化与模板锁定")
        } else {
          summary = "Structured workspace generated from the built-in product scaffold"
          logs.push("[WARN] AI response had no applicable files; fallback applied")
          await appendGenerateTaskLog(jobId, "[4/6] AI 未返回可用文件，已切换到本地业务模板")
        }
      } catch (e: any) {
        const fallbackChanged = await stabilizeGeneratedWorkspace(outDir, current.prompt, current.region)
        changedFiles = Array.from(new Set([...changedFiles, ...fallbackChanged]))
        summary = "Structured workspace generated from the built-in product scaffold"
        logs.push(`[WARN] AI generation skipped: ${e?.message || String(e)}`)
        logs.push(`[OK] Fallback generation applied: ${fallbackChanged.length} files`)
        await appendGenerateTaskLog(jobId, `[4/6] AI 调用失败，已使用本地业务模板。原因：${e?.message || String(e)}`)
      }
    }

    const identityChanged = await enforcePromptIdentity(outDir, current.prompt)
    if (identityChanged.length) {
      changedFiles = Array.from(new Set([...changedFiles, ...identityChanged]))
      logs.push("[OK] Prompt identity enforced in generated page")
      await appendGenerateTaskLog(jobId, "[5/6] 已强制应用 Prompt 标题与业务身份")
    }

    await appendProjectHistory(current.projectId, {
      id: `evt_${Date.now()}`,
      type: "generate",
      prompt: current.rawPrompt || current.prompt,
      createdAt: new Date().toISOString(),
      status: "done",
      summary,
      buildStatus: "skipped",
      changedFiles,
    })

    await updateGenerateTask(jobId, (t) => ({
      ...t,
      status: "done",
      logs: [...(t.logs ?? []), ...logs],
      summary,
      changedFiles,
      error: undefined,
    }))
    await appendGenerateTaskLog(jobId, "[6/6] 生成完成")
  } catch (e: any) {
    const err = e?.message || String(e)
    await appendProjectHistory(current.projectId, {
      id: `evt_${Date.now()}`,
      type: "generate",
      prompt: current.rawPrompt || current.prompt,
      createdAt: new Date().toISOString(),
      status: "error",
      summary: "Generate task failed",
      buildStatus: "skipped",
      error: err,
    })
    await updateGenerateTask(jobId, (t) => ({
      ...t,
      status: "error",
      error: err,
      logs: [...(t.logs ?? []), ...logs],
    }))
    await appendGenerateTaskLog(jobId, `[ERROR] 生成中止：${err}`)
  }
}

function scheduleGenerateTaskWorker(jobId: string) {
  setTimeout(() => {
    void runGenerateTaskWorker(jobId)
  }, 0)
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawPrompt = String(body?.prompt ?? "").trim()
    const requestedTemplateId = String(body?.templateId ?? "").trim()
    const inferredKind = inferAppKind(rawPrompt)
    const templateId =
      inferredKind === "code_platform"
        ? ""
        : requestedTemplateId || inferTemplateIdFromPrompt(rawPrompt) || ""
    const template = getTemplateById(templateId)
    const templatePrompt = String(body?.templatePrompt ?? "").trim()
    const current = await getCurrentSession()
    const latestCompletedPayment = current ? await getLatestCompletedPayment(current.user.id) : null
    const maxPlanTier = (latestCompletedPayment?.planId as PlanTier | undefined) ?? "free"
    const requestedPlanTier = String(body?.generationPlanTier ?? "").trim() as PlanTier | ""
    const planTierForGeneration =
      requestedPlanTier &&
      getPlanRank(requestedPlanTier) <= getPlanRank(maxPlanTier)
        ? requestedPlanTier
        : maxPlanTier
    const region = (body?.region === "cn" ? "cn" : "intl") as Region
    const shouldInjectTemplateBaseline = Boolean(template && requestedTemplateId && inferredKind !== "code_platform")
    const resolvedTemplateBaseline =
      template && shouldInjectTemplateBaseline ? templatePrompt || (region === "cn" ? template.promptZh : template.promptEn) : ""
    const prompt = shouldInjectTemplateBaseline
      ? `${rawPrompt}\n\nTemplate baseline:\n${resolvedTemplateBaseline}\n\nKeep the generated result stylistically close to the selected template while fulfilling the user's request.\n\nGeneration tier: ${planTierForGeneration}.`
      : rawPrompt
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 })
    }

    const deploymentTarget = normalizeDeploymentTarget(String(body?.deploymentTarget ?? ""), region)
    const databaseTarget = normalizeDatabaseTarget(String(body?.databaseTarget ?? ""), region)
    const projectId = createProjectId()
    const createdAt = new Date().toISOString()

    await upsertProject({
      projectId,
      region,
      deploymentTarget,
      databaseTarget,
      createdAt,
      updatedAt: createdAt,
      workspacePath: getWorkspacePath(projectId),
      runtime: {
        status: "stopped",
        port: 3001,
        url: buildProjectPreviewPath(projectId),
      },
      previewMode: getDefaultPreviewMode(),
      sandboxRuntime: {
        status: "stopped",
      },
      history: [],
    } as Parameters<typeof upsertProject>[0])

    const task = await createGenerateTask({
      projectId,
      prompt,
      rawPrompt,
      templateId: template?.id,
      templateTitle: template ? (region === "cn" ? template.titleZh : template.titleEn) : undefined,
      planTier: planTierForGeneration,
      region,
    })
    scheduleGenerateTaskWorker(task.jobId)

    return NextResponse.json({
      projectId,
      jobId: task.jobId,
      status: "queued",
      prompt,
      rawPrompt,
      templateId: template?.id,
      planTier: planTierForGeneration,
      region,
      deploymentTarget,
      databaseTarget,
    })
  } catch (e: any) {
    return NextResponse.json({ status: "error", error: e?.message || String(e) }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const maybeJobId = String(searchParams.get("jobId") ?? "").replace(/[^a-zA-Z0-9_-]/g, "")
  const maybeProjectId = safeProjectId(String(searchParams.get("projectId") ?? ""))

  if (!maybeJobId && !maybeProjectId) {
    return NextResponse.json({ status: "error", error: "jobId or projectId is required" }, { status: 400 })
  }

  const task: GenerateTask | null = maybeJobId
    ? await getGenerateTask(maybeJobId)
    : await findLatestTaskByProject(maybeProjectId)

  if (task) {
    if ((task.status === "queued" || task.status === "running") && Date.now() - Date.parse(task.updatedAt) > STALE_TASK_MS) {
      if ((task.retries ?? 0) < 1) {
        await updateGenerateTask(task.jobId, (t) => ({
          ...t,
          status: "queued",
          error: undefined,
          retries: (t.retries ?? 0) + 1,
          logs: [
            ...(t.logs ?? []),
            "[WARN] 任务在生成中被中断，系统已自动尝试恢复一次",
          ],
        }))
        scheduleGenerateTaskWorker(task.jobId)
      } else {
        await updateGenerateTask(task.jobId, (t) => ({
          ...t,
          status: "error",
          error: "Generate worker was interrupted twice. Please retry generation.",
          logs: [...(t.logs ?? []), "[ERROR] 任务长时间无进展，自动恢复失败，请重新生成"],
        }))
      }
    }
    const latest = (await getGenerateTask(task.jobId)) as GenerateTaskRecord | null
    const currentTask = (latest ?? task) as GenerateTaskRecord
    const outDir = await resolveProjectPath(task.projectId)
    return NextResponse.json({
      projectId: currentTask.projectId,
      jobId: currentTask.jobId,
      status: currentTask.status,
      logs: currentTask.logs ?? [],
      summary: currentTask.summary,
      changedFiles: currentTask.changedFiles ?? [],
      templateTitle: currentTask.templateTitle,
      error: currentTask.error,
      appUrl: buildProjectPreviewPath(currentTask.projectId),
      repoUrl: `local://workspaces/${currentTask.projectId}`,
      localPath: outDir ?? getWorkspacePath(currentTask.projectId),
      runCommands: [
        `cd ${outDir ?? getWorkspacePath(currentTask.projectId)}`,
        "npm install",
        "npx prisma migrate dev --name init",
        "npx next dev -p 3001",
      ],
    })
  }

  const projectId = maybeProjectId
  if (!projectId) {
    return NextResponse.json({ status: "error", error: "Task not found" }, { status: 404 })
  }
  const outDir = await resolveProjectPath(projectId)
  if (!outDir) {
    return NextResponse.json({ projectId, status: "error", error: "Project not found" }, { status: 404 })
  }

  let region: Region = "intl"
  let dbFile = "intl.db"
  try {
    const envText = await fs.readFile(path.join(outDir, ".env"), "utf8")
    if (envText.includes("cn.db")) {
      region = "cn"
      dbFile = "cn.db"
    }
  } catch {
    // noop
  }

  const project = await getProject(projectId)
  const latestGenerate = project?.history
    ?.slice()
    .reverse()
    .find((item) => item.type === "generate")

  return NextResponse.json({
    projectId,
    jobId: projectId,
    status: "done",
    region,
    dbFile,
    logs: latestGenerate?.summary
      ? [`[OK] ${latestGenerate.summary}`]
      : [
          "[OK] Generated Next.js app",
          "[OK] Generated API route: /api/items",
          "[OK] Generated Prisma + SQLite setup",
        ],
    summary: latestGenerate?.summary,
    changedFiles: latestGenerate?.changedFiles ?? [],
    templateTitle: undefined,
    appUrl: buildProjectPreviewPath(projectId),
    repoUrl: `local://workspaces/${projectId}`,
    localPath: outDir,
    runCommands: [
      `cd ${outDir}`,
      "npm install",
      "npx prisma migrate dev --name init",
      "npx next dev -p 3001",
    ],
  })
}
