import Link from "next/link"

type PreviewSpec = {
  title?: string
  kind?: string
  planTier?: string
  modules?: string[]
  features?: string[]
  deploymentTarget?: string
  databaseTarget?: string
} | null

type PreviewPresentation = {
  displayName: string
  subtitle: string
  summary: string
  routes: string[]
  icon: {
    glyph: string
    from: string
    to: string
    ring: string
  }
}

type PreviewHistoryItem = {
  createdAt: string
  summary?: string
  status: "done" | "error"
  type: "generate" | "iterate"
}

type CanonicalPreviewPageProps = {
  projectId: string
  region: "cn" | "intl"
  page: string
  spec: PreviewSpec
  presentation: PreviewPresentation
  history: PreviewHistoryItem[]
}

function titleCase(input: string) {
  return input.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function getNavLabel(route: string, isCn: boolean) {
  const key = route.replace(/^\//, "")
  const labels: Record<string, { cn: string; en: string }> = {
    dashboard: { cn: "总览", en: "Dashboard" },
    editor: { cn: "编辑器", en: "Editor" },
    runs: { cn: "运行", en: "Runs" },
    templates: { cn: "模板库", en: "Templates" },
    pricing: { cn: "升级", en: "Pricing" },
    settings: { cn: "设置", en: "Settings" },
    home: { cn: "首页", en: "Home" },
  }
  return isCn ? labels[key]?.cn ?? titleCase(key) : labels[key]?.en ?? titleCase(key)
}

function formatDate(value: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function cardStyle(background = "#13151d") {
  return {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background,
    padding: 18,
  } as const
}

export function CanonicalPreviewPage({
  projectId,
  region,
  page,
  spec,
  presentation,
  history,
}: CanonicalPreviewPageProps) {
  const isCn = region === "cn"
  const activePage = page || (presentation.routes[0] ? presentation.routes[0].replace(/^\//, "") : "dashboard")
  const routes = presentation.routes.length ? presentation.routes : ["/dashboard", "/editor", "/runs", "/templates", "/pricing"]
  const locale = isCn ? "zh-CN" : "en-US"
  const latestHistory = history[0]
  const basePageSummary =
    latestHistory?.summary ||
    presentation.summary ||
    (isCn ? "已生成可演示的产品骨架。" : "A demo-ready product scaffold has been generated.")

  const renderDashboard = () => (
    <div style={{ display: "grid", gap: 18 }}>
      <section style={{ ...cardStyle("radial-gradient(circle at top left, rgba(124,58,237,0.22), transparent 32%), #171922") }}>
        <div style={{ display: "grid", gridTemplateColumns: "88px 1fr auto", gap: 18, alignItems: "center" }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 24,
              display: "grid",
              placeItems: "center",
              fontSize: 36,
              color: "#fff",
              background: `linear-gradient(135deg, ${presentation.icon.from}, ${presentation.icon.to})`,
              boxShadow: `0 0 0 1px ${presentation.icon.ring}`,
            }}
          >
            {presentation.icon.glyph}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>{presentation.displayName}</h1>
            <p style={{ margin: "10px 0 0", maxWidth: 860, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>{presentation.subtitle} · {basePageSummary}</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href={`/preview/${encodeURIComponent(projectId)}/editor`} style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", background: "#8b5cf6", color: "#fff", fontWeight: 800 }}>
              {isCn ? "进入编辑器" : "Open editor"}
            </Link>
            <Link href={`/preview/${encodeURIComponent(projectId)}/runs`} style={{ textDecoration: "none", borderRadius: 14, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.08)", color: "#f8fafc", fontWeight: 700 }}>
              {isCn ? "查看运行" : "View runs"}
            </Link>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
        {[
          { label: isCn ? "产品类型" : "Product type", value: spec?.kind ?? "workspace", color: "#8b5cf6" },
          { label: isCn ? "部署环境" : "Deployment", value: spec?.deploymentTarget ?? "cloudbase", color: "#22c55e" },
          { label: isCn ? "数据方案" : "Data path", value: spec?.databaseTarget ?? "cloudbase_document", color: "#38bdf8" },
          { label: isCn ? "已生成页面" : "Pages", value: String(routes.length), color: "#f59e0b" },
        ].map((item) => (
          <div key={item.label} style={cardStyle()}>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{item.label}</div>
            <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 16 }}>
        <div style={cardStyle()}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "页面结构与能力" : "Structure and capabilities"}</div>
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            <div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{isCn ? "页面清单" : "Pages"}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {routes.map((route) => (
                  <span key={route} style={{ borderRadius: 999, padding: "8px 12px", background: "rgba(124,58,237,0.18)", color: "#e9d5ff", fontSize: 12 }}>
                    {route.replace(/^\//, "")}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{isCn ? "模块与工具" : "Modules and tools"}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[...(spec?.modules ?? []).slice(0, 8), ...(spec?.features ?? []).slice(0, 6)].map((item) => (
                  <span key={item} style={{ borderRadius: 999, padding: "8px 12px", background: "#1c2030", color: "rgba(255,255,255,0.78)", fontSize: 12 }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div style={cardStyle()}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "最近变更" : "Recent changes"}</div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {history.length ? history.slice(0, 3).map((item) => (
              <div key={`${item.type}-${item.createdAt}`} style={{ borderRadius: 16, background: "#1b1f2b", padding: 12 }}>
                <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 12 }}>{item.type} · {formatDate(item.createdAt, locale)}</div>
                <div style={{ marginTop: 6, fontWeight: 700 }}>{item.summary || basePageSummary}</div>
              </div>
            )) : (
              <div style={{ color: "rgba(255,255,255,0.6)" }}>{isCn ? "暂无变更记录" : "No history yet"}</div>
            )}
          </div>
        </div>
      </section>
    </div>
  )

  const renderEditor = () => (
    <div style={{ display: "grid", gridTemplateColumns: "72px 240px minmax(0,1fr) 320px", minHeight: 780, borderRadius: 24, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#14161d" }}>
      <aside style={{ background: "#101119", borderRight: "1px solid rgba(255,255,255,0.06)", padding: "18px 10px", display: "grid", alignContent: "start", gap: 12 }}>
        {["◫", "⌘", "▣", "⚙", "⚡"].map((item) => (
          <div key={item} style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", background: item === "◫" ? "rgba(124,58,237,0.22)" : "#1b1d28", color: "#f8fafc", margin: "0 auto" }}>{item}</div>
        ))}
      </aside>
      <aside style={{ background: "#12141d", borderRight: "1px solid rgba(255,255,255,0.06)", padding: 16 }}>
        <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 12 }}>{isCn ? "文件树" : "File tree"}</div>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {["app/dashboard/page.tsx", "app/editor/page.tsx", "app/runs/page.tsx", "components/assistant-panel.tsx", "lib/runtime.ts"].map((item, index) => (
            <div key={item} style={{ borderRadius: 12, padding: "10px 12px", background: index === 1 ? "rgba(124,58,237,0.18)" : "transparent", color: index === 1 ? "#f8fafc" : "rgba(255,255,255,0.72)" }}>
              {item}
            </div>
          ))}
        </div>
      </aside>
      <section style={{ display: "grid", gridTemplateRows: "auto 1fr auto", background: "#171923" }}>
        <div style={{ display: "flex", gap: 8, padding: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {["editor.tsx", "routes.ts", "runtime.ts"].map((item, index) => (
            <div key={item} style={{ borderRadius: 12, padding: "10px 14px", background: index === 0 ? "#232638" : "#191c29", color: index === 0 ? "#fff" : "rgba(255,255,255,0.62)", fontSize: 13 }}>{item}</div>
          ))}
        </div>
        <div style={{ padding: 18, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#dbe4ff", fontSize: 13, lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{`export function EditorWorkspace() {
  return {
    brand: "${presentation.displayName}",
    locale: "${region}",
    tools: ["explain", "fix", "generate", "refactor"],
    delivery: ["admin assets", "market handoff", "team review"],
  }
}`}</div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#11131a" }}>
          <div style={{ display: "flex", gap: 16, padding: "10px 14px", color: "rgba(255,255,255,0.66)", fontSize: 13 }}>
            <span style={{ color: "#fff" }}>{isCn ? "终端" : "Terminal"}</span>
            <span>{isCn ? "问题" : "Problems"}</span>
            <span>{isCn ? "输出" : "Output"}</span>
          </div>
          <div style={{ padding: "0 14px 16px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, lineHeight: 1.9 }}>
            <div style={{ color: "#cbd5e1" }}>$ pnpm build</div>
            <div style={{ color: "#22c55e" }}>lint ok</div>
            <div style={{ color: "#22c55e" }}>types ok</div>
            <div style={{ color: "#38bdf8" }}>{isCn ? "热更新已就绪" : "hot reload ready"}</div>
          </div>
        </div>
      </section>
      <aside style={{ background: "#161821", borderLeft: "1px solid rgba(255,255,255,0.06)", padding: 16, display: "grid", alignContent: "start", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{isCn ? "AI 助手" : "AI Assistant"}</div>
          <div style={{ borderRadius: 999, padding: "4px 8px", background: "rgba(124,58,237,0.18)", color: "#d8b4fe", fontSize: 12 }}>Planner</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {(isCn ? ["解释", "修复", "生成", "重构"] : ["Explain", "Fix", "Generate", "Refactor"]).map((item, index) => (
            <div key={item} style={{ borderRadius: 12, padding: "12px 14px", background: index === 2 ? "rgba(124,58,237,0.22)" : "#1f2230", color: index === 2 ? "#fff" : "rgba(255,255,255,0.68)", fontSize: 13, fontWeight: 700 }}>{item}</div>
          ))}
        </div>
        <div style={cardStyle("#1b1e2a")}>
          <div style={{ color: "#c4b5fd", fontWeight: 800 }}>{presentation.displayName} AI</div>
          <p style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", lineHeight: 1.7 }}>{isCn ? "继续增强编辑器、模板、运行链路和交付面板。" : "Continue improving the editor, templates, runtime, and delivery flows."}</p>
        </div>
      </aside>
    </div>
  )

  const renderRuns = () => (
    <div style={{ display: "grid", gap: 18 }}>
      <section style={cardStyle()}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>{isCn ? "运行链路" : "Runtime flow"}</div>
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
          {(isCn
            ? ["生成完成", "构建通过", "Preview Ready", "待部署到 CloudBase"]
            : ["Generated", "Build passed", "Preview ready", "Deploy pending"]
          ).map((item, index) => (
            <div key={item} style={{ borderRadius: 16, padding: 14, background: index < 3 ? "rgba(34,197,94,0.12)" : "rgba(124,58,237,0.16)", color: "#f8fafc" }}>{item}</div>
          ))}
        </div>
      </section>
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={cardStyle()}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "最近构建日志" : "Latest build logs"}</div>
          <div style={{ marginTop: 14, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, lineHeight: 1.9 }}>
            <div>$ planner --product {presentation.displayName.toLowerCase()}</div>
            <div style={{ color: "#22c55e" }}>planner spec ready</div>
            <div style={{ color: "#22c55e" }}>builder scaffold ready</div>
            <div style={{ color: "#38bdf8" }}>canonical preview synced</div>
          </div>
        </div>
        <div style={cardStyle()}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{isCn ? "交付与分发" : "Delivery and distribution"}</div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {(isCn
              ? ["老板演示链接", "admin 宣传资产", "market 销售闭环", "部署环境映射"]
              : ["Stakeholder link", "Admin assets", "Market handoff", "Deployment mapping"]
            ).map((item) => (
              <div key={item} style={{ borderRadius: 14, background: "#1b1f2c", padding: "12px 14px" }}>{item}</div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )

  const renderTemplates = () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 16 }}>
      {(isCn
        ? [
            ["官网与下载站", "首页 / 下载页 / 文档 / 定价"],
            ["销售后台", "客户 / 商机 / 合同 / 交付"],
            ["API 数据平台", "接口 / 趋势 / 监控 / 告警"],
            ["社区反馈中心", "工单 / 反馈 / 公告 / 知识库"],
          ]
        : [
            ["Website and downloads", "Home / downloads / docs / pricing"],
            ["Sales admin", "Leads / deals / contracts / delivery"],
            ["API data platform", "APIs / trends / monitors / alerts"],
            ["Community hub", "Tickets / feedback / notice / knowledge base"],
          ]).map(([title, desc], index) => (
        <div key={title} style={{ ...cardStyle(index === 0 ? "rgba(124,58,237,0.14)" : "#14161f"), minHeight: 180 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
          <p style={{ marginTop: 10, color: "rgba(255,255,255,0.66)", lineHeight: 1.8 }}>{desc}</p>
        </div>
      ))}
    </div>
  )

  const renderPricing = () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
      {(isCn
        ? [
            ["免费版", "基础生成与 canonical preview", "#1b1d27"],
            ["专业版", "更强多页面结构与交付模块", "rgba(124,58,237,0.12)"],
            ["精英版", "更完整工作台、AI 联动与高保真输出", "rgba(14,165,233,0.12)"],
          ]
        : [
            ["Free", "Core generation and canonical preview", "#1b1d27"],
            ["Pro", "Richer multi-page and delivery modules", "rgba(124,58,237,0.12)"],
            ["Elite", "Deeper workspace, AI loops, and showcase output", "rgba(14,165,233,0.12)"],
          ]).map(([title, desc, background]) => (
        <div key={title} style={cardStyle(background)}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{title}</div>
          <p style={{ marginTop: 10, color: "rgba(255,255,255,0.66)", lineHeight: 1.8 }}>{desc}</p>
        </div>
      ))}
    </div>
  )

  const renderCurrentPage = () => {
    if (activePage === "editor") return renderEditor()
    if (activePage === "runs") return renderRuns()
    if (activePage === "templates") return renderTemplates()
    if (activePage === "pricing") return renderPricing()
    return renderDashboard()
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#0d0f15 0%,#131722 100%)", color: "#f8fafc", padding: 24, fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
      <div style={{ maxWidth: 1460, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ ...cardStyle("#141722"), padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", fontSize: 20, background: `linear-gradient(135deg, ${presentation.icon.from}, ${presentation.icon.to})`, boxShadow: `0 0 0 1px ${presentation.icon.ring}` }}>
              {presentation.icon.glyph}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>{presentation.displayName}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{presentation.subtitle}</div>
            </div>
          </div>
          <nav style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {routes.map((route) => {
              const routeKey = route.replace(/^\//, "")
              const active = routeKey === activePage || (activePage === "" && routeKey === "dashboard")
              return (
                <Link
                  key={route}
                  href={routeKey === "dashboard" ? `/preview/${encodeURIComponent(projectId)}` : `/preview/${encodeURIComponent(projectId)}/${routeKey}`}
                  style={{
                    textDecoration: "none",
                    borderRadius: 12,
                    padding: "10px 14px",
                    background: active ? "rgba(124,58,237,0.22)" : "transparent",
                    color: active ? "#fff" : "rgba(255,255,255,0.62)",
                    fontSize: 14,
                    fontWeight: 700,
                    border: active ? "1px solid rgba(124,58,237,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {getNavLabel(route, isCn)}
                </Link>
              )
            })}
          </nav>
        </header>
        {renderCurrentPage()}
      </div>
    </main>
  )
}
