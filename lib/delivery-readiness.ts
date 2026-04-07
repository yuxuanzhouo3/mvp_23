import type { PlanTier } from "@/lib/plan-catalog"
import { siteLinks } from "@/lib/site-links"

export type DeliveryStatus = "ready" | "in_progress" | "planned" | "blocked"

export type DeliveryLink = {
  label: string
  href: string
}

export type DeliveryTrack = {
  id: string
  title: string
  owner: "A" | "B" | "C"
  status: DeliveryStatus
  summary: string
  outputs: string[]
  notes?: string[]
  links?: DeliveryLink[]
}

export type DeliveryCodePack = {
  id: string
  title: string
  region: "cn" | "intl"
  status: DeliveryStatus
  summary: string
  docPath: string
  appEntry: string
  envKeys: string[]
  databaseNotes: string[]
  branchNotes: string[]
}

export type DeliveryDistributionAsset = {
  id: string
  title: string
  status: DeliveryStatus
  href: string
  publicPath: string
  envKey: string
  platform: "android" | "ios" | "desktop" | "harmony" | "mini_program"
  updateSurface: string
  notes: string[]
}

export type DeliveryPermissionRule = {
  plan: PlanTier
  title: string
  summary: string
  status: DeliveryStatus
  generationProfile: "starter" | "builder" | "premium" | "showcase"
  codeExportLevel: "none" | "manifest" | "full"
  databaseAccessMode: "online_only" | "managed_config" | "production_access" | "handoff_ready"
  routeBudget: number
  moduleBudget: number
  projectLimit: number
  collaboratorLimit: number
  subdomainSlots: number
}

export type DeliveryMigrationLane = {
  title: string
  status: DeliveryStatus
  sourceRepo: string
  docPath: string
  summary: string
  phases: string[]
}

export const ANDROID_DELIVERY_SPEC = {
  referenceRepo: "yuxuanzhouo3/mvp_24",
  referenceFolder: "multigptandroid",
  authPaymentSource: "yuxuanzhouo3/mvp_25",
  keystore: "multigpt-key.jks",
  packageRule: "com.{englishname}.android.app",
  packageExamples: {
    cn: "com.mornstack.android.app",
    intl: "com.mornstack.android.global",
  },
  phaseOne: [
    "Wrap the current web product into the Android shell",
    "Apply package naming + JKS signing",
    "Build APK through Android Studio / Gradle",
    "Install on device",
    "Verify Alipay with 0.1 test amount",
  ],
  phaseTwo: [
    "Add WeChat login after credentials are approved",
    "Add WeChat Pay after merchant configuration is ready",
  ],
} as const

export const DELIVERY_TRACKS: DeliveryTrack[] = [
  {
    id: "intl_codepack",
    title: "International code delivery pack",
    owner: "C",
    status: "in_progress",
    summary: "Keep the international Vercel deployment shippable with a clear runtime guide, env matrix, callback URLs, and branch handoff notes.",
    outputs: [
      "International web code",
      "Runtime + deployment guide",
      "Environment variable checklist",
      "Database path summary",
      "Branch / release notes",
    ],
    links: [
      { label: "Docs", href: "/api-docs" },
      { label: "Market center", href: siteLinks.marketCenter },
    ],
  },
  {
    id: "cn_codepack",
    title: "China code delivery pack",
    owner: "C",
    status: "in_progress",
    summary: "Preserve the China-region Tencent Cloud deployment choices, auth/payment differences, and domestic env matrix in one handoff pack.",
    outputs: [
      "China web code",
      "Cloudbase / domestic runtime notes",
      "Environment variable checklist",
      "Database path summary",
      "Branch / release notes",
    ],
    links: [
      { label: "China site", href: siteLinks.websiteCn },
      { label: "Checkout", href: siteLinks.checkoutEntry },
    ],
  },
  {
    id: "cn_android_phase1",
    title: "China Android phase 1",
    owner: "C",
    status: "in_progress",
    summary: "Prioritize shell conversion, package naming, JKS signing, real APK output, and Alipay verification before WeChat login is ready.",
    outputs: [
      "Android shell based on multigptandroid",
      "Package name rule + examples",
      "Signed APK build path",
      "Device install checklist",
      "Alipay 0.1 payment validation path",
    ],
    notes: [
      `Reference repo: ${ANDROID_DELIVERY_SPEC.referenceRepo}/${ANDROID_DELIVERY_SPEC.referenceFolder}`,
      `Keystore: ${ANDROID_DELIVERY_SPEC.keystore}`,
      `Package rule: ${ANDROID_DELIVERY_SPEC.packageRule}`,
    ],
    links: [
      { label: "Android download", href: siteLinks.androidApk },
      { label: "Delivery roadmap", href: "/market" },
    ],
  },
  {
    id: "intl_android",
    title: "International Android app",
    owner: "C",
    status: "planned",
    summary: "Mirror the Android shell process for international packaging and release an installable APK.",
    outputs: [
      "International Android package naming",
      "Signed APK output",
      "Install / smoke checklist",
    ],
    links: [
      { label: "Android channel", href: siteLinks.androidApk },
    ],
  },
  {
    id: "harmony_shell",
    title: "Harmony app path",
    owner: "C",
    status: "planned",
    summary: "Create a Harmony conversion path, signing notes, and a minimal shell delivery checklist.",
    outputs: [
      "Harmony conversion notes",
      "Signing path",
      "Run / release checklist",
    ],
    links: [
      { label: "Harmony entry", href: siteLinks.harmonyDownload },
    ],
  },
  {
    id: "mini_program",
    title: "Mini program skeleton",
    owner: "C",
    status: "planned",
    summary: "Prepare the mini-program project shell, publishing path, and WeChat login reserved points.",
    outputs: [
      "Mini-program skeleton",
      "WeChat login reserved hooks",
      "Run / publish notes",
    ],
    links: [
      { label: "Mini-program entry", href: siteLinks.miniProgramGuide },
    ],
  },
  {
    id: "desktop_ios_distribution",
    title: "Desktop + iOS distribution",
    owner: "C",
    status: "in_progress",
    summary: "Expose download center links, desktop/iOS placeholders, and a backend-friendly place to manage distribution assets.",
    outputs: [
      "Download center page",
      "Desktop distribution entry",
      "iOS App Store / TestFlight links",
      "Admin-side distribution visibility",
    ],
    links: [
      { label: "Download center", href: siteLinks.downloadCenter },
      { label: "Desktop channel", href: siteLinks.desktopDownload },
      { label: "iOS channel", href: siteLinks.iosDownload },
    ],
  },
  {
    id: "tier_permissions",
    title: "Plan and resource restrictions",
    owner: "C",
    status: "in_progress",
    summary: "Keep free vs paid rules visible and progressively enforce export, online-only database, subdomain, and delivery differences.",
    outputs: [
      "Free plan export restrictions",
      "Database online-only rule for free users",
      "Plan comparison and gating copy",
      "Permission toggle inventory",
    ],
    links: [
      { label: "Pricing", href: "/templates" },
      { label: "Checkout", href: siteLinks.checkoutEntry },
    ],
  },
]

export const DELIVERY_CODEPACKS: DeliveryCodePack[] = [
  {
    id: "intl",
    title: "International code delivery pack",
    region: "intl",
    status: "in_progress",
    summary: "Keep the global-facing Vercel deployment, runtime notes, and environment matrix ready for handoff.",
    docPath: "docs/code-delivery-pack-intl.md",
    appEntry: siteLinks.websiteIntl,
    envKeys: [
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_WEBSITE_URL_INTL",
      "NEXT_PUBLIC_DOCS_URL",
      "NEXT_PUBLIC_API_BASE_URL",
      "NEXT_PUBLIC_ADMIN_URL",
      "NEXT_PUBLIC_MARKET_URL",
      "NEXT_PUBLIC_DOWNLOAD_CENTER_URL",
      "NEXT_PUBLIC_LOGIN_URL",
      "NEXT_PUBLIC_CHECKOUT_URL",
      "NEXT_PUBLIC_IOS_URL",
      "NEXT_PUBLIC_DESKTOP_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_DB_URL",
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      "STRIPE_SECRET_KEY",
      "PAYPAL_CLIENT_ID",
      "PAYPAL_CLIENT_SECRET",
    ],
    databaseNotes: [
      "Default global database path: Supabase / Neon / hosted Postgres",
      "Target login path is Google + email, with sandbox-first payment during staging",
      "Keep auth, preview, payment callback, and assigned-subdomain behavior on the same Vercel-origin family",
    ],
    branchNotes: [
      "Keep the preview-ready branch aligned with the main demo workspace and Vercel project",
      "Document the latest release branch name during final handoff and 4/13 acceptance prep",
    ],
  },
  {
    id: "cn",
    title: "China code delivery pack",
    region: "cn",
    status: "in_progress",
    summary: "Preserve the domestic-facing Tencent Cloud deployment notes and China-specific auth/payment paths.",
    docPath: "docs/code-delivery-pack-cn.md",
    appEntry: siteLinks.websiteCn,
    envKeys: [
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_WEBSITE_URL_CN",
      "NEXT_PUBLIC_DOCS_URL",
      "NEXT_PUBLIC_API_BASE_URL",
      "NEXT_PUBLIC_ADMIN_URL",
      "NEXT_PUBLIC_MARKET_URL",
      "NEXT_PUBLIC_DOWNLOAD_CENTER_URL",
      "AUTH_MODE_CN",
      "SMS_PROVIDER_NAME",
      "SMS_API_KEY",
      "SMS_API_SECRET",
      "SMS_SIGN_NAME",
      "SMS_TEMPLATE_ID",
      "CLOUDBASE_ENV_ID",
      "CLOUDBASE_MONGODB_URL",
      "CN_DATABASE_URL",
      "ALIPAY_APP_ID",
      "ALIPAY_PRIVATE_KEY",
      "ALIPAY_PUBLIC_KEY",
      "WECHAT_PAY_APP_ID",
      "WECHAT_PAY_MCH_ID",
      "WECHAT_PAY_API_V3_KEY",
      "WECHAT_PAY_SERIAL_NO",
      "WECHAT_PAY_PRIVATE_KEY",
      "WECHAT_APP_SECRET",
    ],
    databaseNotes: [
      "Default China database path: CloudBase document or domestic-hosted Mongo/Postgres",
      "Target login path is phone verification code + email, with WeChat Pay + Alipay as domestic payment targets",
      "Keep Tencent Cloud / CloudBase routing, preview loading, and payment callbacks aligned with the China-region host",
    ],
    branchNotes: [
      "Keep domestic deploy notes with Tencent Cloud / CloudBase and mainland routing assumptions",
      "Document the latest China-facing release branch during final handoff and 4/13 acceptance prep",
    ],
  },
]

export const DELIVERY_DISTRIBUTION_ASSETS: DeliveryDistributionAsset[] = [
  {
    id: "android_apk",
    title: "Android APK distribution slot",
    status: "in_progress",
    href: siteLinks.androidApk,
    publicPath: "/download/android",
    envKey: "NEXT_PUBLIC_ANDROID_APK_URL",
    platform: "android",
    updateSurface: "/admin + /download/android",
    notes: [
      "Replace with signed APK or enterprise distribution link",
      "Primary boss-demo mobile install path",
    ],
  },
  {
    id: "ios_store",
    title: "iOS App Store / TestFlight slot",
    status: "in_progress",
    href: siteLinks.iosDownload,
    publicPath: "/download/ios",
    envKey: "NEXT_PUBLIC_IOS_URL / NEXT_PUBLIC_IOS_TESTFLIGHT_URL",
    platform: "ios",
    updateSurface: "/admin + /download/ios",
    notes: [
      "App Store and TestFlight stay visible as separate channels",
      "No front-end restructuring needed when real links are ready",
    ],
  },
  {
    id: "desktop",
    title: "Desktop installer slot",
    status: "planned",
    href: siteLinks.desktopDownload,
    publicPath: "/download/desktop",
    envKey: "NEXT_PUBLIC_DESKTOP_URL",
    platform: "desktop",
    updateSurface: "/admin + /download/desktop",
    notes: [
      "Use for desktop installer, packaged Electron shell, or platform landing page",
      "Keep download-center and admin visibility aligned",
    ],
  },
  {
    id: "harmony",
    title: "Harmony shell slot",
    status: "planned",
    href: siteLinks.harmonyDownload,
    publicPath: "/download/harmony",
    envKey: "NEXT_PUBLIC_HARMONY_URL",
    platform: "harmony",
    updateSurface: "/admin + /download/harmony",
    notes: [
      "Reserve for Harmony conversion checklist and signing notes",
      "Can point to a guide before a real package exists",
    ],
  },
  {
    id: "mini_program",
    title: "Mini-program release slot",
    status: "planned",
    href: siteLinks.miniProgramGuide,
    publicPath: "/download/miniprogram",
    envKey: "NEXT_PUBLIC_MINIPROGRAM_URL",
    platform: "mini_program",
    updateSurface: "/admin + /download/miniprogram",
    notes: [
      "Keep publish notes and QR/release guidance in one place",
      "WeChat login remains reserved until credentials are ready",
    ],
  },
]

export const DELIVERY_PERMISSION_RULES: DeliveryPermissionRule[] = [
  {
    plan: "free",
    title: "Free users stay online-first",
    summary: "Code export remains unavailable and database usage stays online-only in the hosted workspace.",
    status: "in_progress",
    generationProfile: "starter",
    codeExportLevel: "none",
    databaseAccessMode: "online_only",
    routeBudget: 4,
    moduleBudget: 10,
    projectLimit: 3,
    collaboratorLimit: 1,
    subdomainSlots: 1,
  },
  {
    plan: "starter",
    title: "Starter keeps delivery lightweight",
    summary: "Starter improves project allowance and managed DB setup, but still keeps code export locked while the app stays hosted-first.",
    status: "in_progress",
    generationProfile: "starter",
    codeExportLevel: "none",
    databaseAccessMode: "managed_config",
    routeBudget: 5,
    moduleBudget: 14,
    projectLimit: 5,
    collaboratorLimit: 1,
    subdomainSlots: 1,
  },
  {
    plan: "builder",
    title: "Builder unlocks AI builder and manifest export",
    summary: "Builder opens the richer AI builder lane, deeper route/module budgets, and manifest-level code export for delivery prep.",
    status: "in_progress",
    generationProfile: "builder",
    codeExportLevel: "manifest",
    databaseAccessMode: "managed_config",
    routeBudget: 6,
    moduleBudget: 18,
    projectLimit: 12,
    collaboratorLimit: 3,
    subdomainSlots: 3,
  },
  {
    plan: "pro",
    title: "Pro unlocks delivery depth",
    summary: "Code export, richer delivery artifacts, and production-grade database access begin at the Pro layer.",
    status: "in_progress",
    generationProfile: "premium",
    codeExportLevel: "full",
    databaseAccessMode: "production_access",
    routeBudget: 8,
    moduleBudget: 24,
    projectLimit: 30,
    collaboratorLimit: 10,
    subdomainSlots: 10,
  },
  {
    plan: "elite",
    title: "Elite unlocks handoff and team delivery",
    summary: "Elite adds collaboration, fuller reporting, and the most complete delivery closure for clients and internal teams.",
    status: "in_progress",
    generationProfile: "showcase",
    codeExportLevel: "full",
    databaseAccessMode: "handoff_ready",
    routeBudget: 10,
    moduleBudget: 32,
    projectLimit: 100,
    collaboratorLimit: 25,
    subdomainSlots: 50,
  },
]

export const DELIVERY_AUTH_PAYMENT_MIGRATION: DeliveryMigrationLane = {
  title: "Auth and payment migration lane",
  status: "in_progress",
  sourceRepo: ANDROID_DELIVERY_SPEC.authPaymentSource,
  docPath: "docs/auth-payment-acceptance.md",
  summary: "Keep Web auth/payment aligned with the current target: international Google + email, China phone verification + email, China WeChat Pay + Alipay, and sandbox-first intl checkout until final credentials are approved.",
  phases: [
    "Stage now: keep intl Google visible through sandbox flow and preserve email auth continuity",
    "Stage now: keep China phone verification + email runnable through sandbox OTP until the real SMS provider is approved",
    "Stage now: keep WeChat Pay and Alipay wired as the domestic checkout targets, then swap in the final merchant credentials",
  ],
}

export function getDeliveryStatusLabel(status: DeliveryStatus, locale: "zh" | "en" = "en") {
  if (locale === "zh") {
    if (status === "ready") return "已就绪"
    if (status === "in_progress") return "进行中"
    if (status === "blocked") return "阻塞中"
    return "待推进"
  }
  if (status === "ready") return "Ready"
  if (status === "in_progress") return "In progress"
  if (status === "blocked") return "Blocked"
  return "Planned"
}

export function getDeliveryStatusTone(status: DeliveryStatus) {
  if (status === "ready") return "success"
  if (status === "in_progress") return "warning"
  if (status === "blocked") return "destructive"
  return "secondary"
}

export const DELIVERY_DOWNLOAD_CHANNELS = [
  {
    title: "Android APK",
    href: siteLinks.androidApk,
    note: "Signed APK path for boss demos and device installs",
  },
  {
    title: "iOS App Entry",
    href: siteLinks.iosDownload,
    note: "App Store or enterprise iOS distribution entry",
  },
  {
    title: "Desktop Entry",
    href: siteLinks.desktopDownload,
    note: "Desktop installer or web-to-desktop release path",
  },
  {
    title: "Harmony Entry",
    href: siteLinks.harmonyDownload,
    note: "Harmony shell readiness and signing path",
  },
  {
    title: "Mini-program Entry",
    href: siteLinks.miniProgramGuide,
    note: "Mini-program skeleton and release guide",
  },
] as const
