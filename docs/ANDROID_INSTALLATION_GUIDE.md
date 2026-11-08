# Campus Security Guard Mobile App — Android Installation Guide

**App Name:** Campus Security Guard  
**Package:** `com.dsvv.campussecurity`  
**Target OS:** Android 7.0 (Nougat / API 24) up to Android 15 (API 35)  
**Distribution File:** `app-release.apk` (Release APK)  

---

## 1. System Requirements

* **Supported Devices:** Any smartphone or rugged tablet running Android 7.0 or higher.
* **Hardware:**
  * Minimum 2 GB RAM (3 GB+ recommended for gate devices).
  * Rear-facing camera with autofocus and flash/torch support.
  * Active 4G/5G mobile data or Campus Wi-Fi connection.
  * Minimum 100 MB free internal storage on the phone.
  * *Note on Local Compilation:* Building release APKs from source on a local development workstation requires 8–10 GB free disk space on drive `C:\` for Android NDK extraction. Alternatively, cloud EAS build (`eas build -p android`) requires zero local disk storage.

---

## 2. Step-by-Step Installation Instructions

### Step 1: Copy or Download the APK
1. Download the release APK file (`app-release.apk`) directly to your device via:
   - USB file transfer from computer to phone storage.
   - Downloading from the campus secure intranet repository.
   - Direct download via WhatsApp or secure email sent to the guard device.

### Step 2: Enable "Install Unknown Apps"
Because this is an in-house enterprise security application for Dev Sanskriti Vishwavidyalaya:
1. Open **Settings** on your Android device.
2. Go to **Apps & Notifications** (or **Security & Privacy**).
3. Tap **Special App Access** ➔ **Install Unknown Apps**.
4. Select your file manager or browser (e.g. Chrome, Files by Google).
5. Toggle **Allow from this source** to **ON**.

### Step 3: Install the Application
1. Open **Files** or your download manager and locate `app-release.apk`.
2. Tap the APK file.
3. Tap **Install** when prompted.
4. *Note on Google Play Protect:* If Google Play Protect shows a dialog stating "Unrecognized app", tap **More Details** and select **Install Anyway**. This appears because the enterprise app is signed for internal campus operations rather than distributed through the public Play Store.

### Step 4: Grant Permissions on First Launch
1. Open the newly installed **Campus Security** app.
2. When prompted:
   * **Camera Permission:** Tap **While using the app** (mandatory for scanning visitor QR passes).
   * **Network / Notifications:** Allow notifications if prompted for emergency alerts.

---

## 3. First-Time Configuration & Guard Login

1. On the **Guard Sign In** screen, enter your duty credentials:
   - **Work Email:** e.g. `security@dsvv.edu.in`
   - **Password:** As provided by the Security Administrator (e.g. `Security@123` for demo stations).
2. Tap **Sign In as Guard**.
3. Verify that your designated gate appears on the top banner (e.g., "Main Gate - Shift A").
4. The application is now fully configured and ready for gate operations.

---

## 4. Troubleshooting & FAQ

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| **"App not installed" / "Parse Error"** | Outdated Android version (< 7.0) or corrupted download. | Verify Android OS version. Re-download the complete APK file without interruption. |
| **Camera screen is black** | Camera permission was rejected or another app is holding the camera. | Go to Settings ➔ Apps ➔ Campus Security ➔ Permissions ➔ Camera ➔ Allow while using app. Restart device. |
| **"Could not connect to campus server"** | Device is on a guest network that blocks the campus API, or server is offline. | Switch device to Campus Staff Wi-Fi or ensure cellular mobile data is enabled. |
| **QR code does not scan** | Insufficient lighting or glare on visitor's phone screen. | Tap the **Flashlight button** in the top right corner of the scanner screen, or ask visitor to increase phone screen brightness. |
