# CSMS Android Mobile Application: Hardware Verification & Manual Testing Guide
**Dev Sanskriti Vishwavidyalaya (DSVV) — Campus Security Management System**

- **Target Binary:** `mobile/android/app/build/outputs/apk/debug/Security.apk`
- **Application Label / Launcher Name:** `Security`
- **Application ID:** `com.dsvv.campussecurity`
- **Tested Physical Device:** Realme RMX3263 (`1A19263210BA09GU`), Android 11
- **Cloud Backend:** `https://campus-security-management.vercel.app`
- **Build Status:** Verified Standalone Embedded Hermes Bytecode (5.2 MB `assets/index.android.bundle`)

---

## 1. Physical Device Installation

1. Connect your Android smartphone to the workstation with USB debugging enabled:
   ```powershell
   & "D:\Android\Sdk\platform-tools\adb.exe" devices
   ```
2. Stream install the verified standalone APK:
   ```powershell
   & "D:\Android\Sdk\platform-tools\adb.exe" install -r "mobile\android\app\build\outputs\apk\debug\Security.apk"
   ```
3. Launch the application:
   ```powershell
   & "D:\Android\Sdk\platform-tools\adb.exe" shell am start -n com.dsvv.campussecurity/.MainActivity
   ```

---

## 2. Guard Authentication Credentials

The security gate application authenticates duty officers against the CSMS authentication service with persistent local session caching on device storage (`csms_guard_store.json`):

| Role | Username / Work Email | Password Policy | Assigned Gate |
|---|---|---|---|
| **Security Guard (Main Gate)** | `guard@campus.edu` | Admin Approved Credential | Main Gate (Gate 1) |
| **Security Supervisor** | `security.admin@campus.edu` | Admin Approved Credential | Central Control Room |
| **Academic Gate Guard** | `guard.academic@campus.edu` | Admin Approved Credential | Academic Block Gate |

---

## 3. Core Gate Workflows & Hardware Verification

### Workflow 1: Officer Sign-In & Dashboard Inspection
1. From the Welcome screen, tap **"Sign In with Guard Credentials"** or **"Register New Guard"** to request approval.
2. Enter Work Email and Password.
3. Tap **"Sign In as Guard"**.
4. **Expected Result:**
   - App transitions immediately to Guard Dashboard (`dashboard.tsx`).
   - Guard profile and active shift timer are displayed.
   - Real-time gate counters are rendered:
     - **Active Visitors On Campus**
     - **Expected Arrivals Today**
     - **Completed Gate Check-ins**
     - **Pending Outing Approvals**

### Workflow 2: Live Camera QR Pass Scanning
1. On the Guard Dashboard, tap the primary action button **"Scan QR Pass"** (`scan.tsx`).
2. When prompted by Android OS: *"Allow Campus Security to take pictures and record video?"*, select **"While using the app"**.
3. Point the phone's camera at a visitor's generated QR pass or student outing QR pass.
4. **Fallback Flow (Manual Reference Lookup):**
   - If the visitor's phone screen is cracked or camera cannot focus in low-light conditions, tap **"Enter Pass Code Manually"**.
   - Input the 24-character hex reference token or 8-character booking reference code (e.g. `DSVV-2026-XXXX`).
   - Tap **"Verify Pass"**.

### Workflow 3: Visitor Verification & Gate Entry (`verification.tsx`)
1. Upon scanning or entering reference code:
   - Screen displays Visitor Photo, Full Name, Contact Number, Host Faculty Name, Department, Purpose, Approved Time Window, and Vehicle Number.
   - Status badge shows green: **"APPROVED & VALID"**.
2. Guard taps **"Mark IN (Gate Check-In)"**:
   - Audio beep or haptic confirmation triggers.
   - Check-in timestamp is recorded locally.
   - Notification appears: *"Visitor successfully checked in at Main Gate"*.
3. When the visitor departs the campus:
   - Guard re-scans pass or enters reference code.
   - Guard taps **"Mark OUT (Gate Check-Out)"**:
   - Status transitions to **"COMPLETED"**.
   - Check-out timestamp is recorded.

### Workflow 4: Offline-First Gate Durability (Zero Internet Resilience)
1. Turn on **Airplane Mode** on the device:
   ```powershell
   & "D:\Android\Sdk\platform-tools\adb.exe" shell cmd connectivity airplane-mode enable
   ```
2. Scan a visitor pass and tap **"Mark IN"**:
   - System records the check-in immediately to local persistent disk storage (`csms_guard_store.json`).
   - UI status indicates: *"Queued for Cloud Sync (Offline Mode)"*.
   - Zero blocking, freezing, or data loss.
3. Turn off **Airplane Mode**:
   ```powershell
   & "D:\Android\Sdk\platform-tools\adb.exe" shell cmd connectivity airplane-mode disable
   ```
4. On Dashboard, tap **"Sync Offline Records"** (or wait for the automatic 30-second background sync loop):
   - Local records are uploaded to `https://campus-security-management.vercel.app/api/gate/check-in`.
   - Outbox sync queue is cleared.
   - Cloud database confirms synchronization with zero duplicate records.

---

## 4. Emergency SOS & Incident Reporting

1. **Gate Emergency Alert:**
   - Tap **"Emergency SOS"** floating button or bottom tab.
   - Select Emergency Type: *Medical*, *Fire*, *Security Breach*, or *Unauthorized Intrusion*.
   - Tap **"Broadcast Campus Alert"**:
   - Broadcast triggers high-priority alert to the Central Security Command Room.
2. **Incident Log:**
   - Tap **"Report Incident"**.
   - Fill in Incident Title, Location (e.g. *Gate 1 Perimeter*), Severity (*Low / Medium / High / Critical*), and Brief Description.
   - Tap **"Submit Incident Report"**.
