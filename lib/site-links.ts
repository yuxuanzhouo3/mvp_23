export const siteLinks = {
  bossDemo: process.env.NEXT_PUBLIC_BOSS_DEMO_URL || "https://mornstack.vercel.app/demo",
  websiteIntl: process.env.NEXT_PUBLIC_WEBSITE_URL_INTL || "https://mornstack.vercel.app/intl",
  websiteCn: process.env.NEXT_PUBLIC_WEBSITE_URL_CN || "https://mornstack.vercel.app/cn",
  docs: process.env.NEXT_PUBLIC_DOCS_URL || "https://mornstack.vercel.app/api-docs",
  apiBase: process.env.NEXT_PUBLIC_API_BASE_URL || "https://mornstack.vercel.app/api",
  adminConsole: process.env.NEXT_PUBLIC_ADMIN_URL || "https://mornstack.vercel.app/admin",
  marketCenter: process.env.NEXT_PUBLIC_MARKET_URL || "https://mornstack.vercel.app/market",
  androidApk: process.env.NEXT_PUBLIC_ANDROID_APK_URL || "https://mornstack.vercel.app/download/android",
  iosDownload: process.env.NEXT_PUBLIC_IOS_URL || "https://mornstack.vercel.app/download/ios",
  iosTestFlight: process.env.NEXT_PUBLIC_IOS_TESTFLIGHT_URL || "https://mornstack.vercel.app/download/ios?channel=testflight",
} as const

export function getRegionalWebsite(region: "cn" | "intl") {
  return region === "cn" ? siteLinks.websiteCn : siteLinks.websiteIntl
}
