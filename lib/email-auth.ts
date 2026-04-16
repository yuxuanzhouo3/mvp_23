import nodemailer from "nodemailer"

function hasEnv(name: string) {
  return Boolean(String(process.env[name] ?? "").trim())
}

export function isEmailSmtpConfigured() {
  return (
    hasEnv("AUTH_EMAIL_SMTP_HOST") &&
    hasEnv("AUTH_EMAIL_SMTP_PORT") &&
    hasEnv("AUTH_EMAIL_SMTP_USER") &&
    hasEnv("AUTH_EMAIL_SMTP_PASS") &&
    hasEnv("AUTH_EMAIL_FROM")
  )
}

function createTransport() {
  const port = Number(process.env.AUTH_EMAIL_SMTP_PORT ?? "465")
  return nodemailer.createTransport({
    host: String(process.env.AUTH_EMAIL_SMTP_HOST ?? "").trim(),
    port,
    secure: port === 465,
    auth: {
      user: String(process.env.AUTH_EMAIL_SMTP_USER ?? "").trim(),
      pass: String(process.env.AUTH_EMAIL_SMTP_PASS ?? "").trim(),
    },
  })
}

export async function sendEmailVerificationCode(args: {
  email: string
  code: string
  region: "cn" | "intl"
  purpose: "register" | "reset"
}) {
  if (!isEmailSmtpConfigured()) {
    throw new Error("Email SMTP is not configured")
  }

  const isCn = args.region === "cn"
  const isReset = args.purpose === "reset"
  const subject = isCn
    ? isReset
      ? "mornstack 找回密码验证码"
      : "mornstack 注册验证码"
    : isReset
      ? "mornstack password reset code"
      : "mornstack sign-up code"

  const text = isCn
    ? isReset
      ? `你的找回密码验证码是 ${args.code}，10 分钟内有效。`
      : `你的注册验证码是 ${args.code}，10 分钟内有效。`
    : isReset
      ? `Your password reset code is ${args.code}. It expires in 10 minutes.`
      : `Your sign-up code is ${args.code}. It expires in 10 minutes.`

  const html = isCn
    ? `<div style="font-family:system-ui,sans-serif;line-height:1.7;color:#111827"><h2>mornstack ${isReset ? "找回密码" : "注册"}验证码</h2><p>你的验证码是：</p><div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0;color:#2563eb">${args.code}</div><p>验证码 10 分钟内有效。</p></div>`
    : `<div style="font-family:system-ui,sans-serif;line-height:1.7;color:#111827"><h2>mornstack ${isReset ? "password reset" : "sign-up"} code</h2><p>Your verification code is:</p><div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0;color:#2563eb">${args.code}</div><p>The code expires in 10 minutes.</p></div>`

  const transport = createTransport()
  await transport.sendMail({
    from: String(process.env.AUTH_EMAIL_FROM ?? "").trim(),
    to: args.email,
    subject,
    text,
    html,
  })
}
