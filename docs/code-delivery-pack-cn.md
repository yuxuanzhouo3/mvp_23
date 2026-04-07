# China Code Delivery Pack

This handoff pack is for the China-facing Mornstack product surface.

## What the pack includes

- China web codebase
- Domestic deployment notes
- Environment variable checklist
- Database path summary
- Branch and release handoff notes

## Main web entry points

- `app/cn/page.tsx`
- `app/download/page.tsx`
- `app/download/android/page.tsx`
- `app/(dashboard)/market/page.tsx`
- `app/(dashboard)/admin/page.tsx`

## Environment checklist

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_WEBSITE_URL_CN`
- `NEXT_PUBLIC_DOCS_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_ADMIN_URL`
- `NEXT_PUBLIC_MARKET_URL`
- `NEXT_PUBLIC_DOWNLOAD_CENTER_URL`
- `NEXT_PUBLIC_ANDROID_APK_URL`
- `AUTH_MODE_CN`
- `SMS_PROVIDER_NAME`
- `SMS_API_KEY`
- `SMS_API_SECRET`
- `SMS_SIGN_NAME`
- `SMS_TEMPLATE_ID`
- `CLOUDBASE_ENV_ID`
- `CLOUDBASE_MONGODB_URL`
- `CN_DATABASE_URL`
- `ALIPAY_APP_ID`
- `ALIPAY_PRIVATE_KEY`
- `ALIPAY_PUBLIC_KEY`
- `WECHAT_PAY_APP_ID`
- `WECHAT_PAY_MCH_ID`
- `WECHAT_PAY_API_V3_KEY`
- `WECHAT_PAY_SERIAL_NO`
- `WECHAT_PAY_PRIVATE_KEY`
- `WECHAT_APP_SECRET`

## Database path

- Preferred domestic path: CloudBase document or mainland-hosted database
- Keep preview and public product surfaces aligned with the China-region host
- Document the exact domestic data source used in final release notes
- Current target auth shape: `phone verification code + email`
- Current payment target: `WeChat Pay + Alipay`

## Branch and release notes

- Record the China-facing release branch
- Record the Tencent Cloud / CloudBase runtime target
- Record the latest successful build and payment smoke state
- Record whether the current stage is using sandbox phone verification or the real SMS provider

## Acceptance expectations before 2026-04-13

- China website is reachable
- Android shell path is documented and visible
- WeChat Pay and Alipay both stay visible as domestic checkout targets
- Free vs paid limits stay visible in the domestic-facing product surfaces
- Phone verification + email remains visible as the primary domestic login path
