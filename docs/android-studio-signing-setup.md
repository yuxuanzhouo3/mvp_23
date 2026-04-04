# Android Studio Signing Setup

Use this checklist when converting the Mornstack web product into an Android shell and signing the APK with `multigpt-key.jks`.

Current intl delivery defaults:

- App name: `MornstackIntl`
- Initial URL: `https://www.mornscience.app/`
- Package / application ID: `com.mornstack.android.global`

## 1. What to prepare before opening Android Studio

Keep these items ready:

- Android project source
  - For now, the reference path is `yuxuanzhouo3/mvp_24/multigptandroid`.
- Signing key
  - `multigpt-key.jks`
- Signing values
  - `storePassword`
  - `keyAlias`
  - `keyPassword`
- Package name
  - Rule: `com.{englishname}.android.app`
  - Example: `com.mornstack.android.app`
  - International example: `com.mornstack.android.global`
- App metadata
  - App name
  - Launcher icon
  - Version name
  - Version code
- Runtime endpoints
  - API base URL
  - Website URL
  - Download center URL
  - INTL final public URL: `https://www.mornscience.app/`
- Payment configuration
  - `ALIPAY_APP_ID`
  - `ALIPAY_PRIVATE_KEY`
  - `ALIPAY_PUBLIC_KEY`
  - Test amount `0.1`
- Future login configuration
  - WeChat login stays phase 2 until credentials are approved

## 2. Files you usually need inside the Android project

When the Android project exists, the common layout should look like this:

```text
android-project/
  app/
    build.gradle
    src/main/AndroidManifest.xml
    src/main/res/...
  gradle.properties
  key.properties
  multigpt-key.jks
```

Recommended handling:

- Put `multigpt-key.jks` at the Android project root, next to `key.properties`
- Do not commit `multigpt-key.jks`
- Do not commit real passwords inside `key.properties`

This repo already ignores `*.jks` and `key.properties`.

## 3. Create `key.properties`

Create a file named `key.properties` in the Android project root.

You can start from [`docs/android-key.properties.example`](/mnt/d/William/projects/mornscience/Mornstack/mornstack/docs/android-key.properties.example).

Example:

```properties
storeFile=../multigpt-key.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=YOUR_KEY_ALIAS
keyPassword=YOUR_KEY_PASSWORD
```

If the JKS is in the same directory as `key.properties`, you can also use:

```properties
storeFile=multigpt-key.jks
```

## 4. Put signing config into `app/build.gradle`

For a standard Groovy Gradle project, add this pattern:

```groovy
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    namespace "com.mornstack.android.app"
    defaultConfig {
        applicationId "com.mornstack.android.app"
        minSdkVersion 24
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }

    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties["storeFile"])
                storePassword keystoreProperties["storePassword"]
                keyAlias keystoreProperties["keyAlias"]
                keyPassword keystoreProperties["keyPassword"]
            }
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

If the reference project uses Kotlin DSL, move the same values into `build.gradle.kts` with the Kotlin syntax variant.

## 5. Change package name correctly

You need to update all three places together:

1. `namespace`
2. `applicationId`
3. Source package folder if native code exists

Example target:

```text
com.mornstack.android.app
```

In Android Studio:

1. Open the `Project` view
2. Find `app/src/main/java/...`
3. Right-click package
4. Refactor
5. Rename
6. Apply the new package name

Then verify `AndroidManifest.xml` and Gradle still match.

## 6. What app-level values should be filled in

At minimum, each Android app should fill these values:

- `applicationId`
- `namespace`
- `app_name`
- icon assets
- `versionCode`
- `versionName`
- base API URL
- website URL
- payment mode
- build flavor if China and international versions are separated

Recommended split:

- China package: `com.mornstack.android.app`
- International package: `com.mornstack.android.global`

## 7. Where to put runtime and payment config

Use one of these patterns:

- `local.properties` for machine-local non-secret paths
- `gradle.properties` for shared Gradle-level flags
- `BuildConfig` fields for app runtime constants
- remote server config for secrets that should not live inside the APK

For the current phase, keep this distinction:

- Can be baked into app
  - base URL
  - package name
  - app name
- Should be handled carefully
  - private signing passwords
  - Alipay private key
  - WeChat secrets

If a payment provider requires server-side signing, keep the real secret on the server and let the app call your backend.

## 8. Android Studio steps

When you are ready to build:

1. Install Android Studio
2. Open the Android shell project
3. Copy `multigpt-key.jks` into the Android project root or another safe local path
4. Create `key.properties`
5. Confirm `build.gradle` reads `key.properties`
6. Set `applicationId` to the final package name
7. Sync Gradle
8. Connect a device or open an emulator
9. Run `debug` once
10. Build `release` APK
11. Install the APK on a real device
12. Verify login shell, page loading, and Alipay `0.1` flow

## 9. What to test first

For the current delivery phase, test in this order:

1. App opens without crash
2. Web shell or embedded pages load correctly
3. Domain and API calls are reachable
4. Login entry works or is properly hidden
5. Alipay test amount `0.1` works
6. Release APK installs over clean device state

WeChat login and WeChat Pay stay in phase 2 for now.

## 10. Common mistakes to avoid

- Only changing `applicationId` but forgetting `namespace`
- Committing `multigpt-key.jks`
- Committing real passwords in `key.properties`
- Hardcoding server secrets into the app
- Building release APK before debug shell is verified
- Forgetting to align package name, manifest, and native source folders
