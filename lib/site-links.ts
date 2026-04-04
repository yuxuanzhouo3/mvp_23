const currentOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mornscience.app"

export const siteLinks = {
  bossDemo: process.env.NEXT_PUBLIC_BOSS_DEMO_URL || `${currentOrigin}/demo`,
  websiteIntl: process.env.NEXT_PUBLIC_WEBSITE_URL_INTL || "https://www.mornscience.app",
  websiteCn: process.env.NEXT_PUBLIC_WEBSITE_URL_CN || "https://mornstack.mornscience.top",
  docs: process.env.NEXT_PUBLIC_DOCS_URL || `${currentOrigin}/api-docs`,
  apiBase: process.env.NEXT_PUBLIC_API_BASE_URL || `${currentOrigin}/api`,
  loginEntry: process.env.NEXT_PUBLIC_LOGIN_URL || `${currentOrigin}/login`,
  checkoutEntry: process.env.NEXT_PUBLIC_CHECKOUT_URL || `${currentOrigin}/checkout`,
  adminConsole: process.env.NEXT_PUBLIC_ADMIN_URL || `${currentOrigin}/admin`,
  marketCenter: process.env.NEXT_PUBLIC_MARKET_URL || `${currentOrigin}/market`,
  downloadCenter: process.env.NEXT_PUBLIC_DOWNLOAD_CENTER_URL || `${currentOrigin}/download`,
  androidApk: process.env.NEXT_PUBLIC_ANDROID_APK_URL || `${currentOrigin}/download/android`,
  iosDownload: process.env.NEXT_PUBLIC_IOS_URL || `${currentOrigin}/download/ios`,
  iosTestFlight: process.env.NEXT_PUBLIC_IOS_TESTFLIGHT_URL || `${currentOrigin}/download/ios?channel=testflight`,
  desktopDownload: process.env.NEXT_PUBLIC_DESKTOP_URL || `${currentOrigin}/download/desktop`,
  harmonyDownload: process.env.NEXT_PUBLIC_HARMONY_URL || `${currentOrigin}/download/harmony`,
  miniProgramGuide: process.env.NEXT_PUBLIC_MINIPROGRAM_URL || `${currentOrigin}/download/miniprogram`,
} as const

export function getRegionalWebsite(region: "cn" | "intl") {
  return region === "cn" ? siteLinks.websiteCn : siteLinks.websiteIntl
}
