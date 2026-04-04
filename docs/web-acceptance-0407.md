# 4/07 Web Acceptance Gap Sheet

This sheet tracks the compressed Web acceptance target before `2026-04-07`.

## Current readiness snapshot

- Snapshot date: `2026-04-03`
- Web product / demo surface: high readiness
- AI workspace depth: the live iterate smoke suite on `3103` now covers `explain + generate + fix + refactor`, confirming current-file/current-page/current-module priority online
- Delivery / distribution admin: operational from `/admin` and now used as the single Web handoff control plane
- Android line: Android Studio sync, emulator boot, debug install, and app launch are already complete; the next step is business validation rather than environment setup
- Intl public delivery default: `https://www.mornscience.app/`
- `www.mornscience.app` and the older `mornhub` public alias live on the same Vercel project; delivery defaults should still use `www.mornscience.app`

## International web status

### Already in place

- Workspace generation path is demo-ready for the main code-platform flow
- `Preview / Dashboard / Code` workspace surfaces are already present
- Download center and `/admin` distribution management are online
- International code handoff fields can now be tracked from `/admin`
- `/admin` now tracks phase, latest verification, must-close items, deferred items, and distribution-slot readiness together
- Intl Android handoff naming is locked to `MornstackIntl` + `com.mornstack.android.global`
- Live `/api/iterate` smoke now covers `explain + generate + fix + refactor` on `3103`, and every verified step stayed anchored to `app/editor/page.tsx` on `/editor`
- The smoke workspace still reports pre-existing build failures, so the context-priority verification is passing while sample-workspace build cleanup remains separate

### Still missing before handoff is considered complete

- Final preview URL confirmation
- Latest release branch confirmation
- Final database choice confirmation
- Latest successful build note kept up to date in the handoff card
- Keep the recorded iterate smoke result aligned between `/admin` and the handoff docs if the B-line prompt/context strategy changes again

## China web status

### Already in place

- China-facing website path is represented in the same workspace and delivery system
- Download center, admin registry, and code delivery pack structure are aligned with the CN track
- Payment/auth differences are already represented in docs and delivery notes
- `/admin` now tracks phase, latest verification, must-close items, deferred items, and distribution-slot readiness together

### Still missing before handoff is considered complete

- Final China production URL confirmation
- Final preview URL confirmation
- Domestic runtime / database choice confirmation
- Latest China-facing release branch confirmation
- Latest successful build and payment smoke note
- WeChat login and WeChat Pay remain phase-2 items until credentials are ready

## 4/07 Web acceptance must-close items

1. Keep `/admin` as the single control plane for delivery handoff fields, phase, recent verification, and distribution slots.
2. Keep international and China code pack records filled with branch, prod URL, preview URL, DB choice, build note, and open must-close items.
3. Keep `/download`, `/download/android`, `/download/ios`, `/download/desktop`, `/download/harmony`, and `/download/miniprogram` aligned with the runtime distribution registry.
4. Keep plan restrictions visible across workspace surfaces, especially free export lock and free DB online-only behavior.
5. Keep the recorded `/api/iterate` smoke result visible in `/admin` and the handoff docs so the B-line context-priority behavior stays auditable.
6. Keep the smoke note explicit that online context anchoring passed even though the sample editor workspace still has pre-existing build failures.

## Explicit must-close gap list before `2026-04-07`

### International

- Final international preview URL confirmation
- Locked release branch name for the handoff package
- Final database choice confirmation
- Latest build note refreshed after the expanded live iterate smoke, with the existing sample-workspace build failure called out separately

### China

- Final China production URL confirmation
- Final China preview URL confirmation
- Locked China-facing release branch name
- Domestic runtime / database choice confirmation
- Latest successful build and payment-smoke note recorded in the handoff card

### Shared

- Keep the passed iterate smoke note synced between `/admin` and the handoff docs after any further B-line prompt/context changes
- Keep `/admin` and `/download` reading the same registry without divergence

## Full final acceptance items that still extend beyond 4/07

- Android emulator and debug install are already done; the remaining Android work is business validation
- Android real-device APK verification
- Alipay device payment verification with `0.1`
- International Android packaging
- Harmony conversion closure
- Mini-program engineering closure
- WeChat login / WeChat Pay closure
- iOS / desktop real package delivery beyond placeholder links

## Shortest close path from now

1. Maintain `/admin` delivery handoff completeness every time a Web-facing URL, phase, verification note, or build note changes.
2. Keep the passed live iterate smoke note recorded in `/admin` and update it whenever the B-line context strategy changes.
3. Treat the sample-workspace build failure observed during `generate / fix / refactor` smoke as a separate cleanup item instead of blocking the verified context-priority result.
4. Treat Android as a tracked follow-up lane: environment setup is done, and the next step is interaction + Logcat + Alipay validation rather than Gradle work.
5. Use this sheet together with `docs/code-delivery-pack-intl.md`, `docs/code-delivery-pack-cn.md`, and `docs/auth-payment-acceptance.md` during final handoff prep.
