# QR Pass Token Implementation Audit Report
**Project:** Campus Security Management System (CSMS) — Dev Sanskriti Vishwavidyalaya (DSVV)  
**Date of Audit:** November 24, 2026  
**Auditor:** Senior Software Architect / Security QA Specialist  

---

## 1. Executive Summary

This audit report documents the exact, verified code-level implementation of the **Visitor Pass QR Token Generation** and **QR Code Verification** mechanisms in the Campus Security Management System codebase.

### Key Finding on Cryptographic Architecture:
* **HMAC Signing is NOT implemented in this codebase.**
* Instead of self-contained signed HMAC tokens, the system implements an **Opaque High-Entropy Database-Backed Token Pattern** (`randomToken(24)` via Node.js `crypto.randomBytes(24).toString("base64url")`).
* The QR code encodes only this opaque reference string (or its verification URL). It contains **zero Personal Identifiable Information (PII)**.
* Verification is performed **statefully on the server** against the database (`visit_requests.pass_token`), checking real-time lifecycle status, date matching against the campus timezone, visiting hours, and single-entry state.

---

## 2. Pass Token Generation Details

### Exact Source File:
* **File Path:** [`lib/server/services/bookings.ts`](file:///c:/Users/DELL/campus%20security%20mangement%20system/lib/server/services/bookings.ts)
* **Underlying Helper File:** [`lib/server/password.ts`](file:///c:/Users/DELL/campus%20security%20mangement%20system/lib/server/password.ts)

### Generation Function:
```typescript
// In lib/server/password.ts (lines 33-35)
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
```

### Where and How it is Called:
1. **At Pre-booking / Registration Creation:**  
   * **Function:** `createBooking()` in `lib/server/services/bookings.ts` (line 463)
   * **Invocation:** `randomToken(24)`
2. **At Booking Approval (Backfill / Refresh):**  
   * **Function:** `approveBooking()` in `lib/server/services/bookings.ts` (line 718)
   * **Invocation:** `randomToken(24)`

### Token Format and Length:
* **Algorithm:** Node.js native CSPRNG `crypto.randomBytes(24)`
* **Encoding:** URL-safe Base64 (`base64url`)
* **Output Length:** Exactly **32 URL-safe characters** (representing 24 bytes / 192 bits of cryptographic entropy).
* **Sample Token Value:** `v7aB9_kL21mNxOqRsTuVwXyZ01234567`

### Database Storage:
* **Database Tables:** 
  1. Local SQLite: `visit_requests`
  2. Supabase PostgreSQL: `public.visit_requests`
* **Column Name:** `pass_token` (TEXT)
* **Hashing Status:** Stored directly in the database column as plaintext. (Because 192 bits of random entropy makes the token unguessable and collision-free without needing password-style salting/hashing).
* **Database Index:** `CREATE INDEX IF NOT EXISTS idx_visits_pass_token ON visit_requests(pass_token);`

### HMAC Verification Status:
* **HMAC Implemented?** **NO.** There is no `crypto.createHmac()`, secret HMAC key, or signature verification used for pass tokens.

---

## 3. QR Code Verification Details

### Exact Source Files:
1. **Server Gate Verification Service:** [`lib/server/services/gate.ts`](file:///c:/Users/DELL/campus%20security%20mangement%20system/lib/server/services/gate.ts)
2. **Server Public Pass View Service:** [`lib/server/services/pass.ts`](file:///c:/Users/DELL/campus%20security%20mangement%20system/lib/server/services/pass.ts)
3. **Database Repository Lookup:** [`lib/server/repo.ts`](file:///c:/Users/DELL/campus%20security%20mangement%20system/lib/server/repo.ts)
4. **API Route Handler:** [`app/api/gate/verify/route.ts`](file:///c:/Users/DELL/campus%20security%20mangement%20system/app/api/gate/verify/route.ts)
5. **Mobile Scanner App:** [`mobile/src/app/scan.tsx`](file:///c:/Users/DELL/campus%20security%20mangement%20system/mobile/src/app/scan.tsx) & [`mobile/src/app/verification.tsx`](file:///c:/Users/DELL/campus%20security%20mangement%20system/mobile/src/app/verification.tsx)

### QR Verification Workflow:

1. **Extraction:**
   * When scanned by the guard's camera (`CameraView` in Expo mobile app or HTML5 camera on web), the barcode parser captures the string.
   * If a visitor presents a full URL (e.g. `https://campus.dsvv.ac.in/visit/verify/v7aB9_kL...`), `resolveBooking()` in `lib/server/services/gate.ts` strips the URL path and extracts the pure token string:
   ```typescript
   if (rawToken.startsWith("http://") || rawToken.startsWith("https://")) {
     const url = new URL(rawToken);
     const parts = url.pathname.split("/").filter(Boolean);
     const lastPart = parts[parts.length - 1];
     if (lastPart) rawToken = decodeURIComponent(lastPart);
   }
   ```

2. **Database Lookup:**
   * Looked up via `findVisitByToken(rawToken)` in `lib/server/repo.ts`:
   ```sql
   SELECT * FROM visit_requests WHERE pass_token = ?
   ```
   * Also accepts manual reference ID (`DSVV-VIS-2026-XXXXXX`) or visitor phone number as fallback.

3. **Status & Expiry Validation:**
   * **Approved check:** Must be `Approved` (or `Checked In` for check-out). Statuses like `Pending`, `Rejected`, `Cancelled`, `No Show`, `Expired` are immediately rejected with descriptive error codes.
   * **Token Expiry check:** `booking.passExpiresAt && Date.parse(booking.passExpiresAt) < Date.now()` rejects expired passes (`code: "expired"`).
   * **Date validation:** Validated against campus timezone `todayInCampusTz()` (`Asia/Kolkata`):
     * Future date: rejected with `too_early` ("This pass is valid on YYYY-MM-DD, not today").
     * Past date: rejected with `date_passed` ("This pass was valid on YYYY-MM-DD and is no longer current").
   * **Visiting Hours check:** If date is today, current campus time (`campusMinutesNow()`) must be between `visitingHoursFrom` (07:00) and `visitingHoursTo` (20:00). Otherwise, rejected with `outside_hours`.

4. **Duplicate Scans & State Toggle:**
   * **If visitor is outside:** First scan validates pass and prompts for **Check-In**.
   * **If already inside:** If `status === "Checked In"` or `status === "Meeting In Progress"`, the system returns `nextAction: "check-out"`, toggling the state to prompt guard for exit recording.
   * **Preventing Duplicate Check-In:** `checkIn()` in `lib/server/services/gate.ts` enforces that if the visitor is already marked on-campus, a second check-in attempt throws `conflict("This visitor is already inside the campus.")`.

---

## 4. Web vs. Mobile Implementation Comparison

| Attribute | Web Implementation | Mobile Guard App (`/mobile`) |
| :--- | :--- | :--- |
| **Scanner Interface** | In-browser scanner using `jsqr` | Native camera scanner using `expo-camera` (`CameraView`) |
| **Scanner File** | `components/gate/qr-scanner.tsx` | `mobile/src/app/scan.tsx` |
| **Manual Fallback** | Manual booking reference / phone input | Manual input field in `scan.tsx` with routing to `/verification` |
| **Backend Verification API** | Calls `/api/gate/verify` | Calls `/api/gate/verify` via `verifyVisitorPass()` in `services/api.ts` |
| **Verification Logic** | Handled by `verifyPass()` in `lib/server/services/gate.ts` | Shared: calls the identical server-side endpoint |

---

## 5. Architectural & Academic Summary

* **Documented Paradigm:** Database-backed Cryptographic Opaque Bearer Token.
* **Why this design was chosen over Stateless HMAC:**
  1. **Instant Revocability:** An HMAC token cannot be revoked without state or key rotation. An opaque token in `visit_requests` can be revoked instantly if a host or administrator cancels or rejects the visit.
  2. **Zero PII Exposure:** If a visitor or third party decodes the QR code with an ordinary smartphone camera, they obtain only a random 32-character string. No visitor name, Aadhaar number, phone number, or host name is encoded in the QR matrix.
  3. **Replay & Double-Entry Prevention:** Real-time state tracking guarantees that a printed paper pass cannot be scanned by two different gates simultaneously.
