import { ArrowRight, Bot, CheckCircle2, Database, Globe2, Layers3, PlayCircle, ShieldCheck, Sparkles } from "lucide-react"

const ICP_NUMBER = "粤ICP备2024281756号-3"

const previewCards = [
  {
    icon: Sparkles,
    title: "一句话生成全栈应用",
    text: "输入产品想法后，生成官网、后台、数据模型、接口与交付入口。",
  },
  {
    icon: Layers3,
    title: "工作区持续迭代",
    text: "在同一个工作区里查看预览、继续修改、管理代码和交付状态。",
  },
  {
    icon: Database,
    title: "部署与数据配置",
    text: "按国内链路选择腾讯云、云文档、MySQL 或 MongoDB 等方案。",
  },
]

const demoSteps = ["描述应用需求", "选择国内部署路径", "生成页面和后台", "预览并继续调整"]

const sampleApps = [
  "CRM 销售线索管理",
  "预约服务小程序",
  "企业知识库",
  "数据看板后台",
]

export default function MiniProgramPreviewPage() {
  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white">M</div>
            <div>
              <div className="text-base font-semibold">mornstack</div>
              <div className="text-xs text-slate-500">AI 全栈生成平台</div>
            </div>
          </div>
          <a
            href="#preview"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            查看预览
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section id="preview" className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[1fr_420px] lg:items-start">
        <div className="pt-4">
          <div className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
            <Bot className="h-4 w-4" />
            AI 全栈生成平台
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
            一句话生成全栈应用
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
            从官网、后台到文档和交付入口，先给你一个能看懂、能继续改、能拿去演示的产品工作区。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#demo" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white">
              预览生成流程
              <PlayCircle className="h-4 w-4" />
            </a>
            <a href="#examples" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
              查看示例
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-700">比如：</div>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              生成一个中国版 AI 代码平台，包含官网、编辑器、运行面板和销售后台。
            </div>
            <div className="mt-4 text-sm text-slate-500">当前路径：国内 · 腾讯云 · 云文档</div>
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Database className="h-4 w-4 text-blue-600" />
                部署与数据配置
              </div>
              <span className="rounded-lg bg-blue-50 px-3 py-1 text-xs text-blue-700">国内路径</span>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                腾讯云部署环境
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                云文档数据方案
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                小程序预览与审核入口
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-10 md:grid-cols-3">
        {previewCards.map((card) => {
          const Icon = card.icon
          return (
            <article key={card.title} className="rounded-lg border border-slate-200 bg-white p-5">
              <Icon className="h-5 w-5 text-blue-600" />
              <h2 className="mt-4 text-lg font-semibold">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.text}</p>
            </article>
          )
        })}
      </section>

      <section id="demo" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            小程序审核可预览流程
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {demoSteps.map((step, index) => (
              <div key={step} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-blue-600">STEP {index + 1}</div>
                <div className="mt-3 text-sm font-medium text-slate-800">{step}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="examples" className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Globe2 className="h-4 w-4 text-blue-600" />
          可生成的应用示例
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sampleApps.map((item) => (
            <div key={item} className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-6 text-center text-xs text-slate-500">
        <span>MornChat 触览页 · 为企业沟通而生</span>
        <span className="mx-2">·</span>
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer" className="hover:text-slate-800">
          {ICP_NUMBER}
        </a>
      </footer>
    </main>
  )
}
