import { NextResponse } from "next/server"
import { resolveAuthRuntimeConfig } from "@/lib/auth-runtime"
import { resolvePaymentAdapterConfig } from "@/lib/payment-adapter"
import { getPublicSiteMap, type PublicProviderDescriptor } from "@/lib/public-site"
import {
  DATABASE_OPTIONS,
  DEPLOYMENT_OPTIONS,
  getDefaultDatabaseTarget,
  getDefaultDeploymentTarget,
} from "@/lib/fullstack-targets"

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
      key: "supabase-password",
      label: "Supabase Password",
      region: "intl",
      category: "auth",
      enabled: true,
      configured: auth.supabaseConfigured,
      realFlowImplemented: true,
      status: auth.intlMode === "supabase" && auth.supabaseConfigured ? "live" : auth.supabaseConfigured ? "credential_ready" : "demo",
      startPath: "/login",
      callbackUrl: "",
      fallbackLabel: "local email/password sign-in",
    },
    {
      key: "phone-otp",
      label: "Phone OTP",
      region: "cn",
      category: "auth",
      enabled: true,
      configured: auth.phoneOtpConfigured,
      realFlowImplemented: true,
      status: auth.cnMode === "phone" ? "live" : auth.phoneOtpConfigured ? "credential_ready" : "demo",
      startPath: "/login",
      callbackUrl: "",
      fallbackLabel: "sandbox phone verification",
    },
    {
      key: "password",
      label: "Email Password",
      region: "cn",
      category: "auth",
      enabled: true,
      configured: true,
      realFlowImplemented: true,
      status: auth.cnMode === "password" ? "live" : "credential_ready",
      startPath: "/login",
      callbackUrl: "",
      fallbackLabel: "primary phase-1 auth path",
    },
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
      fallbackLabel: "needs real OAuth exchange",
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
      fallbackLabel: "phase-2 social login",
    },
    {
      key: "wechat-login",
      label: "WeChat Login",
      region: "cn",
      category: "auth",
      enabled: true,
      configured: auth.wechatConfigured,
      realFlowImplemented: true,
      status: auth.cnMode === "wechat" && auth.wechatConfigured ? "live" : auth.wechatConfigured ? "credential_ready" : "demo",
      startPath: "/api/auth/wechat/start",
      callbackUrl: site.authCallbacks.wechat,
      fallbackLabel: "phase-2 login after password launch",
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
      fallbackLabel: "phase-1 intl checkout target",
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
      fallbackLabel: "phase-2 intl payment option",
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
      fallbackLabel: "phase-1 cn checkout target",
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
      fallbackLabel: "CN production QR checkout",
    },
  ]

  return NextResponse.json({
    auth,
    payment,
    site,
    providers,
    deployment: {
      intl: {
        hosting: getDefaultDeploymentTarget("intl"),
        runtime: "node",
        dockerRequired: false,
        database: getDefaultDatabaseTarget("intl"),
        databaseConfigured:
          hasEnv("NEXT_PUBLIC_SUPABASE_URL") &&
          hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
          hasEnv("SUPABASE_SERVICE_ROLE_KEY") &&
          hasEnv("SUPABASE_DB_URL"),
      },
      cn: {
        hosting: getDefaultDeploymentTarget("cn"),
        runtime: "docker",
        dockerRequired: true,
        database: getDefaultDatabaseTarget("cn"),
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
      ],
      intlPayment: [
        "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
        "STRIPE_SECRET_KEY",
        "PAYPAL_CLIENT_ID",
        "PAYPAL_CLIENT_SECRET",
      ],
      cnAuth: [
        "SMS_PROVIDER_NAME",
        "SMS_API_KEY",
        "SMS_API_SECRET",
        "SMS_SIGN_NAME",
        "SMS_TEMPLATE_ID",
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
        "WECHAT_PAY_PLATFORM_PUBLIC_KEY",
        "WECHAT_PAY_PLATFORM_SERIAL_NO",
      ],
      cnAuthOptional: [
        "NEXT_PUBLIC_WECHAT_APP_ID",
        "WECHAT_APP_SECRET",
      ],
      cnInfra: [
        "CLOUDBASE_ENV_ID",
        "CLOUDBASE_MONGODB_URL",
        "CN_DATABASE_URL",
      ],
      deploymentTargets: DEPLOYMENT_OPTIONS.map((item) => item.id),
      databaseTargets: DATABASE_OPTIONS.map((item) => item.id),
    },
    rolloutPlan: {
      currentTarget: {
        intlAuth: ["Google OAuth", "Email"],
        cnAuth: ["Phone OTP", "Email"],
        intlPayment: ["Stripe sandbox", "PayPal sandbox"],
        cnPayment: ["WeChat Pay", "Alipay"],
      },
      optionalFollowUps: {
        intlAuth: ["Facebook OAuth"],
        cnAuth: ["WeChat Login"],
        payment: ["provider webhook signature hardening with platform certificate rotation"],
      },
    },
    mcp: {
      supabaseDb: {
        key: "supabase-db",
        configured: hasEnv("SUPABASE_DB_URL"),
        requiredEnv: ["SUPABASE_DB_URL"],
      },
      cloudbase: {
        key: "cloudbase",
        configured: hasEnv("CLOUDBASE_MONGODB_URL"),
        requiredEnv: ["CLOUDBASE_MONGODB_URL"],
      },
      exampleConfigPath: ".cursor/mcp.json.example",
    },
  })
}
