# 2026-04-14 Terminal Delivery Roadmap

This document tracks the A/B/C delivery focus for the 2026-04-14 acceptance deadline.

## A line

- Keep the web workspace product-grade across `Preview / Dashboard / Code`.
- Continue deepening `dashboard`, `editor`, `runs`, `templates`, `pricing`, and `settings`.
- Preserve separate international and China-facing web entry points.

## B line

- Maintain file-aware, page-aware, module-aware, and element-aware AI context.
- Keep `explain / fix / generate / refactor` scoped to the current workspace target.
- Ensure AI changes sync back into the workspace focus and session state.

## C line

### 1. International code delivery pack

- International web code.
- Runtime guide.
- Environment variable checklist.
- Database path summary.
- Branch / release handoff notes.

### 2. China code delivery pack

- China web code.
- Domestic deployment guide.
- Environment variable checklist.
- Database path summary.
- Branch / release handoff notes.

### 3. China Android phase 1

- Reference repo: `yuxuanzhouo3/mvp_24`
- Reference folder: `multigptandroid`
- Signing key: `multigpt-key.jks`
- Android Studio setup guide: `docs/android-studio-signing-setup.md`
- Package naming rule: `com.{englishname}.android.app`
- Example package name: `com.mornstack.android.app`
- Build through Android Studio / Gradle.
- Install on a real device.
- Verify Alipay with a `0.1` test amount.

### 4. China Android phase 2

- Add WeChat login after credentials are approved.
- Add WeChat Pay after merchant configuration is ready.

### 5. International Android

- Build a separate signed APK.
- Apply international package naming.
- Keep a clean install / smoke path.

### 6. Harmony shell

- Prepare conversion notes.
- Record signing path.
- Keep a minimal release checklist.

### 7. Mini-program shell

- Prepare project skeleton.
- Reserve WeChat login hooks.
- Add run / publish notes.

### 8. Desktop + iOS distribution

- Keep a public download center.
- Keep desktop entry, App Store entry, and TestFlight entry visible.
- Keep backend/admin visibility for distribution assets.

### 9. Resource restrictions

- Free users cannot export code.
- Free users can use the database online only.
- Paid users unlock richer export, depth, and delivery abilities.

## Auth and payment migration source

- Reuse and adapt login/payment logic from `yuxuanzhouo3/mvp_25`.
- Prioritize Alipay for the China Android phase 1 path.
- Keep WeChat login / WeChat Pay as phase 2 work.

## Environment variables to keep in the delivery pack

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_WEBSITE_URL_INTL`
- `NEXT_PUBLIC_WEBSITE_URL_CN`
- `NEXT_PUBLIC_DOWNLOAD_CENTER_URL`
- `NEXT_PUBLIC_ANDROID_APK_URL`
- `NEXT_PUBLIC_IOS_URL`
- `NEXT_PUBLIC_IOS_TESTFLIGHT_URL`
- `NEXT_PUBLIC_DESKTOP_URL`
- `NEXT_PUBLIC_HARMONY_URL`
- `NEXT_PUBLIC_MINIPROGRAM_URL`
- `ALIPAY_APP_ID`
- `ALIPAY_PRIVATE_KEY`
- `ALIPAY_PUBLIC_KEY`
- `WECHAT_APP_SECRET`
- `WECHAT_PAY_MCH_ID`
- `WECHAT_PAY_API_V3_KEY`
- `ANDROID_PACKAGE_NAME_CN`
- `ANDROID_PACKAGE_NAME_INTL`
- `ANDROID_KEYSTORE_PATH`
- `ALIPAY_TEST_AMOUNT`
