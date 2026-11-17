# DSVV Campus Security Management System
## Android Guard Application — Release APK Build Guide

**Application Name:** Campus Security Guard  
**Package Identifier:** `com.dsvv.campussecurity`  
**Framework:** React Native 0.86 / Expo SDK 57 / Expo Router  
**Target Format:** Standalone Installable APK (No Expo Go or dev server required)

---

## 1. Prerequisites

1. Install EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```
2. Expo account (free at https://expo.dev).
3. Log in to your Expo account via terminal:
   ```bash
   eas login
   ```

---

## 2. One-Command Cloud APK Build

From the root project directory:
```bash
cd mobile
eas build --profile production --platform android
```

### What This Does:
1. Validates `app.json` configuration and Android permissions (`CAMERA`, `INTERNET`, `ACCESS_NETWORK_STATE`).
2. Bundles the JavaScript code with `EXPO_PUBLIC_API_URL=https://campus-security-management.vercel.app`.
3. Compiles the native Android binary in the cloud with Gradle `:app:assembleRelease`.
4. Signs the APK with an auto-generated Expo release keystore.
5. Produces a direct, downloadable `.apk` link.

---

## 3. Alternative: Local APK Generation via Gradle (Android SDK)

If Android Studio and the Android SDK / NDK are installed locally on your machine:
```bash
cd mobile
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```
The resulting release APK will be located at:
`mobile/android/app/build/outputs/apk/release/app-release.apk`

---

## 4. Installation on Physical Android Devices

1. Transfer the `.apk` file to your Android smartphone via USB cable, Google Drive, WhatsApp, or direct download.
2. Tap the `.apk` file in your Android file manager.
3. When prompted, tap **Settings → Allow installation from this source**.
4. Tap **Install**.
5. Launch **Campus Security Guard**.
6. When prompted on first launch or QR scan, tap **Allow** for Camera and Network access.
7. Sign in using security credentials:
   - Email: `security@dsvv.edu.in`
   - Password: `Security@123`

