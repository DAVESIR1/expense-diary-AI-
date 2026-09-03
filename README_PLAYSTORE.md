# Play Store / Signing / Play Protect Guide

This document explains how to prepare the Android app (Capacitor) for Play Store upload, signing, upgradeability, and Play Protect compatibility.

1) Requirements
- Use Android App Bundle (`.aab`) for Play distribution (recommended).
- Target a recent `targetSdkVersion` (33 or above) in the Android project.
- Sign the app with a secure keystore; use Play App Signing if possible.

2) Generate a keystore (local dev)
```
keytool -genkeypair -v -keystore keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```
Place `keystore.jks` at the project root (or a secure path) and create `key.properties` using `key.properties.sample`.

3) Configure Android signing (after `npx @capacitor/cli add android`)
- Add a `key.properties` file at project root with keystore settings (see `key.properties.sample`).
- Update `android/app/build.gradle` signing configs to read `key.properties` and apply to `release` buildType. Example:
```
def keystorePropertiesFile = rootProject.file("../key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
  keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
  defaultConfig {
    applicationId "com.expensediary.ai"
    versionCode 1
    versionName "1.0.0"
    targetSdkVersion 35
  }

  signingConfigs {
    release {
      if (keystorePropertiesFile.exists()) {
        storeFile file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
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

4) Build signed AAB
```
npm run build
npx @capacitor/cli sync android
cd android
./gradlew bundleRelease
```
The resulting `.aab` will be in `android/app/build/outputs/bundle/release/`.

5) Play Protect readiness checklist
- Signed release bundle (`.aab`) uploaded to Play Console.
- Use Play App Signing for key management (recommended).
- Ensure `targetSdkVersion` is current (>=33 recommended).
- Avoid dangerous permissions; request runtime permissions responsibly.
- Provide an `assetlinks.json` (Digital Asset Links) on your hosted site if using TWA/WebAPK to enable trust.

6) Asset Links (for TWA / WebAPK)
- Create the JSON mapping between your website and Android package and host it at `https://yourdomain/.well-known/assetlinks.json`.
- A template is included in `public/.well-known/assetlinks.json.template`.

If you want, I can attempt to add a script that patches the Android `build.gradle` automatically after the Capacitor project is generated. Share the Gradle error logs if any build fails.

7) Adaptive launcher icons & splash
- Adaptive icons help the app look native on Android and are recommended for Play Store presence.
- This repo includes `public/android-adaptive-icon-foreground.svg` and `public/android-adaptive-icon-background.svg` and a template `android-res-templates/ic_launcher.xml.template`.
- After generating the Android project, copy or convert these into `android/app/src/main/res/mipmap-anydpi-v26/` and create `ic_launcher.xml` that references the foreground/background drawables.

