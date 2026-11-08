# Campus Security Management System (CSMS)
## Known Issues, Security Guardrails & Operational Constraints

**Date:** November 8, 2026  
**Document Status:** Production Operational Guidance  

---

## 1. Security Guardrails & Intentional Constraints

### 1.1 Offline Pass Verification Policy
* **Behavior:** When the mobile device loses network connectivity at a remote gate, the QR scanner will display an offline connectivity alert and decline to issue a valid check-in approval.
* **Security Rationale:** Allowing offline token decoding without cryptographic server validation would allow an attacker to generate fabricated QR codes or reuse revoked passes. Verification must always validate against the authoritative database.

### 1.2 Facial Capture Browser Constraints
* **Behavior:** The live camera capture on the public booking portal requires an HTTPS origin (or `http://localhost`).
* **Root Cause:** Modern browser security policies (`navigator.mediaDevices.getUserMedia`) strictly disable camera and microphone streams over unencrypted HTTP. Production deployments must be secured with TLS (HTTPS).

### 1.3 WhatsApp Cloud API Mock Mode
* **Behavior:** In local development or staging environments without Meta credentials, `WHATSAPP_PROVIDER=mock` captures simulated messages in the `whatsapp_messages` table without dispatching over the cellular network.
* **Production Requirement:** For real message delivery to visitors and faculty, configure `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` in production.

---

## 2. Technical Dependencies & Environment Requirements

### 2.1 Node.js 24 Runtime
* The project requires Node.js 24.x for its built-in `node:sqlite` native database engine when operating in SQLite mode. Running on Node.js 18 or 20 without the driver flag will trigger a module not found error.

### 2.2 Android Camera Permissions
* Android 11 through 15 enforce runtime permission prompts. When installing the APK on a new guard smartphone, security supervisors must ensure the officer selects **"While using the app"** during the first scan attempt.

### 2.3 Local Machine Disk Space for Native Android Builds
* Compiling a standalone release APK locally on Windows requires at least 8–10 GB of free storage on drive `C:\` due to Android NDK 27.1 requiring ~4 GB uncompressed. On workstations with low free disk capacity (<5 GB free), developers and administrators should use cloud-based EAS Build (`eas build --platform android`) or run the application directly via Expo Go (`npx expo start`), which has zero native compilation overhead.
