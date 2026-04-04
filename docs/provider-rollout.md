# Formal Auth + Payment Rollout

## Current state
- `mvp_25` has been cloned and reviewed as a reference repo, but it does not contain production-ready `Supabase / Stripe / Alipay / OAuth` provider code that can be transplanted directly.
- This repo already contains the real phase-1 implementation base, so rollout should stay focused on those paths instead of waiting on social login.
- If provider credentials are missing, payment falls back to the internal hosted confirmation flow so checkout still works end to end.

## Phase 1 target
- INTL auth: `Supabase password`
- CN auth: `password`
- INTL payment: `Stripe`
- CN payment: `Alipay`

## Phase 1 required production config

### INTL auth
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### CN auth
- No extra provider credentials are required.
- Use the built-in email/password flow.

### INTL payment
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`

### CN payment
- `ALIPAY_APP_ID`
- `ALIPAY_PRIVATE_KEY`
- `ALIPAY_PUBLIC_KEY`
- optional `ALIPAY_GATEWAY`

## Phase 2 follow-up

### INTL social login
- `Google OAuth`
- `Facebook OAuth`

Required env:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`

### CN social login
- `WeChat Login`

Required env:
- `NEXT_PUBLIC_WECHAT_APP_ID`
- `WECHAT_APP_SECRET`

Flow:
- `/api/auth/wechat/start`
- `/api/auth/wechat/callback`

### Extra payment providers
- INTL: `PayPal`
- CN: `WeChat Pay`

Required env for WeChat Pay:
- `WECHAT_PAY_MCH_ID`
- `WECHAT_PAY_API_V3_KEY`
- `WECHAT_PAY_SERIAL_NO`
- `WECHAT_PAY_PRIVATE_KEY`
- `WECHAT_PAY_APP_ID`

## Acceptance output before production keys
- Login page shows current runtime mode.
- Checkout page shows current auth mode and provider hint.
- Payment redirects into the hosted in-product confirmation flow.

## Acceptance output after phase-1 production keys
- INTL sign-in goes through Supabase password auth.
- CN sign-in goes through email/password auth.
- Stripe opens the real hosted Stripe checkout page.
- Alipay opens the real Alipay payment page.

## Acceptance output after phase-2 keys
- Google/Facebook can be enabled for INTL social sign-in.
- WeChat login can replace CN password auth when desired.
- WeChat Pay returns a live QR payload or provider redirect.
