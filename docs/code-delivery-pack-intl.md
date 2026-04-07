# International Code Delivery Pack

This handoff pack is for the global-facing Mornstack product surface.

## Canonical intl public entry

- `https://www.mornscience.app/`
- The older `mornhub` public alias may still point to the same Vercel project, but intl delivery defaults should use `www.mornscience.app`.

## What the pack includes

- International web codebase
- Runtime and deployment notes
- Environment variable checklist
- Database path summary
- Branch and release handoff notes

## Main web entry points

- `app/intl/page.tsx`
- `app/download/page.tsx`
- `app/download/ios/page.tsx`
- `app/download/android/page.tsx`
- `app/(dashboard)/market/page.tsx`
- `app/(dashboard)/admin/page.tsx`

## Environment checklist

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_WEBSITE_URL_INTL`
- `NEXT_PUBLIC_DOCS_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_ADMIN_URL`
- `NEXT_PUBLIC_MARKET_URL`
- `NEXT_PUBLIC_DOWNLOAD_CENTER_URL`
- `NEXT_PUBLIC_ANDROID_APK_URL`
- `NEXT_PUBLIC_IOS_URL`
- `NEXT_PUBLIC_IOS_TESTFLIGHT_URL`
- `NEXT_PUBLIC_DESKTOP_URL`
- `NEXT_PUBLIC_HARMONY_URL`
- `NEXT_PUBLIC_MINIPROGRAM_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`

## Database path

- Preferred hosted path: Supabase / Neon / managed Postgres
- Keep auth, preview, and payment callbacks on the same public site origin
- Current target auth shape: `Google + email`
- Current staging payment shape: sandbox-first checkout flow until the final merchant keys are approved

## Branch and release notes

- Treat the current intl site aliases as the same Vercel deployment project, not separate products
- Keep the latest preview-ready branch name in the final handoff sheet
- Record the deployed production URL and preview URL
- Record the last known successful `pnpm build`
- Record the latest generate + iterate smoke note before `2026-04-13`

## Android intl metadata

- App name: `MornstackIntl`
- Initial URL: `https://www.mornscience.app/`
- Android package name: `com.mornstack.android.global`
- Application ID: `com.mornstack.android.global`

## Acceptance expectations before 2026-04-13

- International website is reachable
- Market/download/admin surfaces are reachable
- iOS / desktop / docs links are visible
- Plan and export restrictions remain visible in the product surface
- Google login entry remains visible even before final OAuth keys are approved
- Assigned subdomain, preview loading, and workspace export differences remain visible during boss-demo review
