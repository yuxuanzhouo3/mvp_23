# Distribution Asset Registry

This registry keeps the externally visible download and release slots in one place.

## Active slots

- Android APK
- iOS App Store
- iOS TestFlight
- Desktop installer
- Harmony shell guide
- Mini-program release guide

## Admin visibility

- `/admin` should surface the current public link for each slot
- `/market` should keep the product-facing summary visible
- `/download` should remain the public hub

## Update rule

- Replace links through environment variables first
- If a real upload pipeline is added later, keep the same public routes so bosses, customers, and testers do not need a new path
- Runtime-managed overrides now persist in `workspaces/_distribution_assets.json`

## Environment mapping

- `NEXT_PUBLIC_ANDROID_APK_URL` -> `/download/android`
- `NEXT_PUBLIC_IOS_URL` -> `/download/ios`
- `NEXT_PUBLIC_IOS_TESTFLIGHT_URL` -> `/download/ios?channel=testflight`
- `NEXT_PUBLIC_DESKTOP_URL` -> `/download/desktop`
- `NEXT_PUBLIC_HARMONY_URL` -> `/download/harmony`
- `NEXT_PUBLIC_MINIPROGRAM_URL` -> `/download/miniprogram`

## Current manual steps

- Android signing and final APK build still require local Android Studio + device or emulator
- iOS, Harmony, and mini-program channels can point to docs or placeholder entries until packaged assets exist
