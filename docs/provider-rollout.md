# Formal Auth + Payment Rollout

## Current state
- INTL auth prefers `Supabase` when configured, otherwise falls back to demo auth.
- CN auth prefers `WeChat` when configured, otherwise falls back to demo auth.
- Payment routes select region-aware providers:
  - INTL: `Stripe`, `PayPal`
  - CN: `Alipay`, `WeChat Pay`
- If provider credentials are missing, payment falls back to the internal hosted confirmation flow so the product remains usable.

## Required production config

### INTL auth
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### CN auth
- `NEXT_PUBLIC_WECHAT_APP_ID`
- `WECHAT_APP_SECRET`

Flow:
- `/api/auth/wechat/start`
- `/api/auth/wechat/callback`

### INTL payments
- Stripe:
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_SECRET_KEY`
- PayPal:
  - `PAYPAL_CLIENT_ID`
  - `PAYPAL_CLIENT_SECRET`

### CN payments
- Alipay:
  - `ALIPAY_APP_ID`
  - `ALIPAY_PRIVATE_KEY`
  - `ALIPAY_PUBLIC_KEY`
  - optional `ALIPAY_GATEWAY`
- WeChat Pay:
  - `WECHAT_PAY_MCH_ID`
  - `WECHAT_PAY_API_V3_KEY`
  - `WECHAT_PAY_SERIAL_NO`
  - `WECHAT_PAY_PRIVATE_KEY`
  - `WECHAT_PAY_APP_ID`

## Acceptance output before production keys
- Login page shows current runtime mode.
- Checkout page shows current auth mode and provider hint.
- Payment still redirects directly into the hosted payment screen.

## Acceptance output after production keys
- INTL sign-in goes through Supabase.
- CN sign-in goes through WeChat login.
- Stripe opens the real hosted Stripe checkout page.
- Alipay opens the real Alipay payment page.
- WeChat Pay returns a live QR payload / payment redirect from provider API.
