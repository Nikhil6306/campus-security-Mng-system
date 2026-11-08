# Campus Security Guard Mobile Application Guide
## User & Technical Manual for Entrance Security Operations

**Application Name:** Campus Security Guard  
**Package Identifier:** `com.dsvv.campussecurity`  
**Target Platform:** Android (API Level 24+ / Android 7.0 through Android 15), iOS  
**Framework:** React Native 0.86, Expo 57, TypeScript 6  

---

## 1. Purpose & Core Value

The **Campus Security Guard Mobile App** is a purpose-built mobile tool designed specifically for gate guards, security officers, and entrance supervisors at Dev Sanskriti Vishwavidyalaya. It eliminates paper registers, prevents unauthorized entry, accelerates peak-hour verification to under 3 seconds per visitor, and ensures that every campus movement is cryptographically verified and logged in real time.

---

## 2. Screen Hierarchy & Navigation Flow

```
[Login Screen] (/login)
       │
       ▼ (Authenticate as Guard)
[Guard Dashboard] (/dashboard)
       ├───▶ [Scan Visitor QR] (/scan) ──▶ [Visitor Verification] (/verification)
       │                                            │
       │                                            ├───▶ [CHECK IN] ──▶ Success Confirmation
       │                                            └───▶ [CHECK OUT] ──▶ Success Confirmation
       ├───▶ [Walk-in Check-in] (/check-in)
       ├───▶ [Manual Check-out] (/check-out)
       ├───▶ [Gate Movement History] (/history)
       ├───▶ [Emergency SOS] (/emergency)
       └───▶ [Guard Duty & Handover] (/profile)
```

---

## 3. Operational Guide for Gate Security Officers

### 3.1 Officer Authentication
1. Launch the **Campus Security** app on the gate mobile device.
2. Enter your authorized work email (e.g. `security@dsvv.edu.in`) and password.
3. Tap **Sign In as Guard**. The application authenticates via the campus backend, stores an encrypted local session, and loads the active gate duty station.

### 3.2 Scanning a Visitor QR Pass
1. On the dashboard, tap the primary blue **Scan Visitor QR** button.
2. If prompted on first run, tap **Allow Camera** to grant camera permissions.
3. Point the device camera at the QR code displayed on the visitor's smartphone or printed visitor pass.
4. If operating at night or in low light, tap the **Flashlight icon** in the top right corner to illuminate the pass.
5. The hardware camera scanner instantly detects the QR code and navigates to the **Visitor Verification Screen**.

### 3.3 Visitor Verification Screen & Decision Making
The verification screen displays the visitor's live record retrieved from the campus database:
* **Facial Portrait:** Compare the high-resolution photo on screen with the person standing at the gate.
* **Visitor Details:** Full name, phone number, visitor category, number of accompanying guests.
* **Host & Department:** Name of the faculty member or department visited.
* **Status Pill:**
  * **APPROVED (Green):** Pass is valid and authorized for entry today.
  * **INSIDE (Blue):** Visitor has already entered and is currently on campus.
  * **COMPLETED (Gray):** Pass was already used and concluded.
  * **PENDING / REJECTED (Red):** Entry is unauthorized.

### 3.4 Performing Gate Check-In
1. Ensure the visitor status shows **APPROVED**.
2. Tap the large green **CHECK IN** button at the bottom of the screen.
3. A confirmation modal will appear. Confirm the assigned gate and vehicle details.
4. Tap **Confirm Check-In**.
5. The system records the entry timestamp, your Guard ID, and gate name in the database. The visitor pass transitions to **INSIDE**.

### 3.5 Performing Gate Check-Out
1. When a visitor arrives at the gate to leave, scan their pass or look up their record.
2. Ensure the visitor status shows **INSIDE**.
3. Tap the amber **CHECK OUT** button.
4. Confirm departure. The system records the exit timestamp and concludes the visit.

---

## 4. Handling Offline & Weak Connectivity Situations

Gates and perimeter checkpoints frequently experience cellular dips. The app is engineered to handle intermittent connectivity gracefully:
1. **Offline Indicator:** When network connectivity is lost, an offline banner appears at the top of the dashboard.
2. **Read-Only Verification Safeguard:** Unverified offline QR codes **cannot** grant entry. This prevents unauthorized individuals from forging offline passes.
3. **Optimistic Error Prevention:** Check-in or check-out is only marked successful when the server acknowledges the transaction.
4. **Automatic Reconnection:** As soon as 4G/Wi-Fi signal resumes, cached metrics and recent movement history synchronize automatically.

---

## 5. Security & Emergency Capabilities

* **SOS Alerting:** Tapping the red siren on the dashboard brings up the **Emergency Alert** screen. Guards can trigger instant alarms for Medical, Fire, Intrusion, or Unrest, notifying supervisors across the campus network.
* **Shift Handover:** Guards can review gate equipment (radios, barrier gates, flashlights), complete inspection checklists, and submit shift sign-offs directly from the **Profile** screen.
