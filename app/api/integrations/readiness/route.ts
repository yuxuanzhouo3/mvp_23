import { NextResponse } from "next/server"
import { resolveAuthRuntimeConfig } from "@/lib/auth-runtime"
import { resolvePaymentAdapterConfig } from "@/lib/payment-adapter"
import { getPublicSiteMap, type PublicProviderDescriptor } from "@/lib/public-site"

export const runtime = "nodejs"

function hasEnv(name: string) {
  return Boolean(String(process.env[name] ?? "").trim())
}

export async function GET() {
  const auth = resolveAuthRuntimeConfig()
  const payment = resolvePaymentAdapterConfig()
  const site = getPublicSiteMap()

  const providers: PublicProviderDescriptor[] = [
    {
      key: "google",
      label: "Google",
      region: "intl",
      category: "auth",
      enabled: auth.googleEnabled,
      configured: auth.supabaseConfigured && auth.googleConfigured,
      realFlowImplemented: false,
      status: !auth.googleEnabled ? "disabled" : auth.supabaseConfigured && auth.googleConfigured ? "credential_ready" : "demo",
      startPath: "/api/auth/google/start",
      callbackUrl: site.authCallbacks.google,
      fallbackLabel: "demo social session",
    },
    {
      key: "facebook",
      label: "Facebook",
      region: "intl",
      category: "auth",
      enabled: auth.facebookEnabled,
      configured: auth.supabaseConfigured && auth.facebookConfigured,
      realFlowImplemented: false,
      status: !auth.facebookEnabled ? "disabled" : auth.supabaseConfigured && auth.facebookConfigured ? "credential_ready" : "demo",
      startPath: "/api/auth/facebook/start",
      callbackUrl: site.authCallbacks.facebook,
      fallbackLabel: "demo social session",
    },
    {
      key: "wechat-login",
      label: "WeChat Login",
      region: "cn",
      category: "auth",
      enabled: true,
      configured: auth.wechatConfigured,
      realFlowImplemented: true,
      status: auth.wechatConfigured ? "live" : "demo",
      startPath: "/api/auth/wechat/start",
      callbackUrl: site.authCallbacks.wechat,
      fallbackLabel: "email/password login",
    },
    {
      key: "stripe",
      label: "Stripe",
      region: "intl",
      category: "payment",
      enabled: true,
      configured: payment.stripeConfigured,
      realFlowImplemented: true,
      status: payment.stripeConfigured ? "live" : "demo",
      webhookUrl: site.paymentWebhooks.stripe,
      fallbackLabel: "hosted in-product confirmation",
    },
    {
      key: "paypal",
      label: "PayPal",
      region: "intl",
      category: "payment",
      enabled: true,
      configured: payment.paypalConfigured,
      realFlowImplemented: false,
      status: payment.paypalConfigured ? "credential_ready" : "demo",
      webhookUrl: site.paymentWebhooks.paypal,
      fallbackLabel: "hosted in-product confirmation",
    },
    {
      key: "alipay",
      label: "Alipay",
      region: "cn",
      category: "payment",
      enabled: true,
      configured: payment.alipayConfigured,
      realFlowImplemented: true,
      status: payment.alipayConfigured ? "live" : "demo",
      webhookUrl: site.paymentWebhooks.alipay,
      fallbackLabel: "hosted in-product confirmation",
    },
    {
      key: "wechatpay",
      label: "WeChat Pay",
      region: "cn",
      category: "payment",
      enabled: true,
      configured: payment.wechatConfigured,
      realFlowImplemented: true,
      status: payment.wechatConfigured ? "live" : "demo",
      webhookUrl: site.paymentWebhooks.wechatpay,
      fallbackLabel: "hosted in-product confirmation",
    },
  ]

  return NextResponse.json({
    auth,
    payment,
    site,
    providers,
    deployment: {
      intl: {
        hosting: "vercel",
        runtime: "node",
        dockerRequired: false,
        database: "supabase",
        databaseConfigured:
          hasEnv("NEXT_PUBLIC_SUPABASE_URL") &&
          hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
          hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
      },
      cn: {
        hosting: "cloudbase",
        runtime: "docker",
        dockerRequired: true,
        database: "document-db",
        databaseConfigured:
          hasEnv("CLOUDBASE_ENV_ID") ||
          hasEnv("CN_DATABASE_URL") ||
          hasEnv("CLOUDBASE_MONGODB_URL"),
      },
    },
    envGuide: {
      intlAuth: [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "GOOGLE_OAUTH_CLIENT_ID",
        "GOOGLE_OAUTH_CLIENT_SECRET",
        "FACEBOOK_APP_ID",
        "FACEBOOK_APP_SECRET",
      ],
      intlPayment: [
        "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
        "STRIPE_SECRET_KEY",
        "PAYPAL_CLIENT_ID",
        "PAYPAL_CLIENT_SECRET",
      ],
      cnAuth: [
        "NEXT_PUBLIC_WECHAT_APP_ID",
        "WECHAT_APP_SECRET",
      ],
      cnPayment: [
        "ALIPAY_APP_ID",
        "ALIPAY_PRIVATE_KEY",
        "ALIPAY_PUBLIC_KEY",
        "WECHAT_PAY_MCH_ID",
        "WECHAT_PAY_API_V3_KEY",
        "WECHAT_PAY_SERIAL_NO",
        "WECHAT_PAY_PRIVATE_KEY",
        "WECHAT_PAY_APP_ID",
      ],
      cnInfra: [
        "CLOUDBASE_ENV_ID",
        "CLOUDBASE_MONGODB_URL",
        "CN_DATABASE_URL",
      ],
    },
  })
}
