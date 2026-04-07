# Formal Auth + Payment Rollout

## Current state
- `mvp_25` has been cloned and reviewed as a reference repo, but it does not contain production-ready `Supabase / Stripe / Alipay / OAuth` provider code that can be transplanted directly.
- This repo already contains the real phase-1 implementation base, so rollout should stay focused on those paths instead of waiting on social login.
- If provider credentials are missing, payment falls back to the internal hosted confirmation flow so checkout still works end to end.

## Current target
- INTL auth: `Google OAuth + email`
- CN auth: `phone verification code + email`
- INTL payment: `sandbox checkout first`
- CN payment: `WeChat Pay + Alipay`

## Phase 1 required production config

### INTL auth
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

### CN auth
- `SMS_PROVIDER_NAME`
- `SMS_API_KEY`
- `SMS_API_SECRET`
- `SMS_SIGN_NAME`
- `SMS_TEMPLATE_ID`
- Optional fallback / follow-up:
  - `NEXT_PUBLIC_WECHAT_APP_ID`
  - `WECHAT_APP_SECRET`

### INTL payment
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- optional `PAYPAL_CLIENT_ID`
- optional `PAYPAL_CLIENT_SECRET`

### CN payment
- `WECHAT_PAY_MCH_ID`
- `WECHAT_PAY_API_V3_KEY`
- `WECHAT_PAY_SERIAL_NO`
- `WECHAT_PAY_PRIVATE_KEY`
- `WECHAT_PAY_APP_ID`
- recommended webhook verification extras:
  - `WECHAT_PAY_PLATFORM_PUBLIC_KEY`
  - `WECHAT_PAY_PLATFORM_SERIAL_NO`
- `ALIPAY_APP_ID`
- `ALIPAY_PRIVATE_KEY`
- `ALIPAY_PUBLIC_KEY`
- optional `ALIPAY_GATEWAY`

## Current implementation notes

### INTL social login
- `Google OAuth` still needs the real OAuth exchange.
- Current code path is a demo callback shell, not a production token exchange.

### CN phone login
- Phone OTP is not implemented yet.
- The UI and readiness layer can now show the required SMS provider variables, but the actual send/verify APIs still need to be added next.

### CN WeChat Pay
- Native QR order creation is implemented.
- Pending orders can now query WeChat Pay directly for status confirmation.
- Webhook payload decryption is implemented with `WECHAT_PAY_API_V3_KEY`.
- Signature verification can be enabled by adding `WECHAT_PAY_PLATFORM_PUBLIC_KEY` and `WECHAT_PAY_PLATFORM_SERIAL_NO`.

### CN WeChat login
- `/api/auth/wechat/start`
- `/api/auth/wechat/callback`
- This remains optional if CN auth moves to `phone verification code + email`.

## Acceptance output after keys
- WeChat Pay creates a live QR payment order.
- Pending WeChat orders can be rechecked from the app without manual state edits.
- Webhook notifications can mark orders as completed or cancelled.
- Google login becomes unblocked once the real OAuth exchange is wired.
- CN phone OTP becomes unblocked once the SMS provider is chosen and the send/verify routes are implemented.
