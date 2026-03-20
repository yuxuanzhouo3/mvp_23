export type ProviderStatus = "disabled" | "demo" | "credential_ready" | "live"

export type PublicProviderDescriptor = {
  key: string
  label: string
  region: "cn" | "intl"
  category: "auth" | "payment"
  enabled: boolean
  configured: boolean
  realFlowImplemented: boolean
  status: ProviderStatus
  startPath?: string
  callbackUrl?: string
  webhookUrl?: string
  fallbackLabel?: string
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}

export function getConfiguredSiteOrigin(fallbackOrigin?: string) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
  if (configured) {
    return trimTrailingSlash(configured)
  }
  if (fallbackOrigin) {
    return trimTrailingSlash(fallbackOrigin)
  }
  return "https://mornstack.vercel.app"
}

export function getPublicSiteMap(fallbackOrigin?: string) {
  const origin = getConfiguredSiteOrigin(fallbackOrigin)
  return {
    origin,
    home: `${origin}`,
    intl: `${origin}/intl`,
    cn: `${origin}/cn`,
    admin: `${origin}/admin`,
    market: `${origin}/market`,
    loginDemo: `${origin}/login?redirect=/checkout?plan=pro`,
    checkoutDemo: `${origin}/checkout?plan=pro`,
    demo: `${origin}/demo`,
    promoLatestIndex: `${origin}/generated/promo-assets/latest/index.html`,
    promoLatestVideo: `${origin}/generated/promo-assets/latest/promo-video-storyboard.html`,
    promoLatestPpt: `${origin}/generated/promo-assets/latest/promo-ppt-copy.html`,
    authCallbacks: {
      google: `${origin}/api/auth/google/callback`,
      facebook: `${origin}/api/auth/facebook/callback`,
      wechat: `${origin}/api/auth/wechat/callback`,
    },
    paymentWebhooks: {
      stripe: `${origin}/api/payment/webhook/stripe`,
      paypal: `${origin}/api/payment/webhook/paypal`,
      alipay: `${origin}/api/payment/webhook/alipay`,
      wechatpay: `${origin}/api/payment/webhook/wechat`,
    },
  }
}
