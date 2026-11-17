# Campus Security Management System (CSMS)
## Comprehensive QA & Testing Verification Report

**Date:** November 17, 2026  
**Auditor & QA Lead:** Senior Full-Stack Developer & Security Specialist  
**Execution Environment:** Node.js 24.18.0, Next.js 15.5.25, React Native 0.86.3, Expo 57.0.28, Windows 11  
**Target Backend:** `https://campus-security-management.vercel.app`  

---

## 1. Test Execution Summary

| Test Category | Suite / Command | Total Tests | Passed | Failed | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Unit & Timezone Logic** | `node tests/unit.mjs` | 50 | 50 | 0 | **PASS** |
| **Guard Duty & Handover** | `node tests/guard-duty-handover.mjs` | 21 | 21 | 0 | **PASS** |
| **WhatsApp Faculty Approval**| `node tests/whatsapp-faculty-approval.mjs` | 18 | 18 | 0 | **PASS** |
| **Aadhaar Encryption & At Rest**| `node --conditions=react-server tests/prebooking.mjs` | 15 | 15 | 0 | **PASS** |
| **Gate In/Out Workflow** | `node tests/gate-in-out-workflow.mjs` | 6 | 6 | 0 | **PASS** |
| **Email Service & Safety** | `node tests/email-service.mjs` | 1 | 1 | 0 | **PASS** |
| **Supabase RLS & Migrations**| `node tests/supabase-migration-safety.mjs` | 1 | 1 | 0 | **PASS** |
| **Web TypeScript Verification**| `npm run typecheck` (`tsc --noEmit`) | Full Tree | Full Tree | 0 | **PASS** |
| **Mobile TypeScript Check** | `npm run typecheck --prefix mobile` | Full Tree | Full Tree | 0 | **PASS** |
| **Mobile Lint Check** | `npm run lint --prefix mobile` | Full Tree | Full Tree | 0 | **PASS** |
| **Total Automated Tests** | — | **112** | **112** | **0** | **100% PASS** |

---

## 2. Detailed Test Category Breakdown

### 2.1 Guard Duty & Handover Protocol (`tests/guard-duty-handover.mjs`)
- [x] **Scenario 1:** Admin assigns a guard to a gate.
- [x] **Scenario 2:** Guard sees only permitted assignments.
- [x] **Scenario 3:** Guard starts their own shift successfully.
- [x] **Scenario 4:** A different guard cannot start someone else's shift.
- [x] **Scenario 5:** Duplicate check-in is rejected.
- [x] **Scenario 6:** Overlapping assignments are detected.
- [x] **Scenario 7:** Overnight shifts crossing midnight calculate correctly.
- [x] **Scenario 8:** Guard ends shift and submits a handover report.
- [x] **Scenario 9:** Incoming guard acknowledges the correct handover.
- [x] **Scenario 10:** Unauthorized users cannot acknowledge another guard's handover.
- [x] **Scenario 11:** Pending visitors are fetched from actual visitor system.
- [x] **Scenario 12:** Open incidents remain open after handover (never auto-closed).
- [x] **Scenario 13:** Required patrol checkpoints enforce photo requirement.
- [x] **Scenario 14:** Critical patrol failures trigger configured escalation.
- [x] **Scenario 15:** Supervisor can approve or reject an authorized handover.
- [x] **Scenario 16:** Handover rejection requires a mandatory reason.
- [x] **Scenario 17:** Guards cannot approve their own handovers.
- [x] **Scenario 18:** RLS policies exist in Supabase migration 0014.
- [x] **Scenario 19:** Invalid status transitions are rejected.
- [x] **Scenario 20:** Offline drafts are distinguished from server-confirmed submissions.
- [x] **Scenario 21:** Gate staffing gap calculation correctly flags understaffed posts.

### 2.2 Gate In/Out & QR Security (`tests/gate-in-out-workflow.mjs`)
- [x] **Zero PII Exposure:** Verified that QR code payload contains only the opaque pass token or pass URL. Zero personal information, names, phone numbers, or Aadhaar data are embedded.
- [x] **Deterministic Pass Hashing:** Verified that SHA-256 token hashing is deterministic and non-reversible.
- [x] **Gate Verification Rules:** Confirmed that pending, rejected, or expired passes strictly reject check-in at the gate.
- [x] **Directional Integrity:** Confirmed that a visitor cannot check in twice without checking out, and cannot check out without an active check-in.
- [x] **Header Fix Verification:** Confirmed that FormData submissions do not enforce JSON headers.
- [x] **Scanner URL Extraction:** Confirmed regex parser correctly extracts opaque tokens from full domain URLs.

### 2.3 WhatsApp Faculty Approval Workflow (`tests/whatsapp-faculty-approval.mjs`)
- [x] **Normalization:** Verified standard Indian 10-digit mobile numbers are normalized to E.164.
- [x] **Faculty Inactivity Protection:** Inactive faculty cannot receive new visitor meeting requests.
- [x] **Status Integrity:** Submissions cannot spoof `APPROVED` status from the client.
- [x] **Token Cryptography:** Generates 32-byte cryptographic random tokens with SHA-256 storage.
- [x] **Replay Prevention:** Once a decision token is consumed, repeated submissions are rejected.
- [x] **Webhook Security:** GET verification handshake and POST HMAC-SHA256 signature verification validated.

### 2.4 Aadhaar At-Rest Encryption (`tests/prebooking.mjs`)
- [x] AES-256-GCM encryption round-trip validated under active key.
- [x] Ciphertext envelope contains no plaintext digits.
- [x] Random 12-byte initialization vectors ensure identical numbers yield different ciphertexts.
- [x] Keyed HMAC digests remain stable for duplicate detection without decryption.
- [x] Tampered ciphertexts immediately throw authentication errors upon decryption attempts.

### 2.5 Timezone, Grid & CSV Safety (`tests/unit.mjs`)
- [x] IST time calculation accurately offsets UTC by +5:30 across leap days and year boundaries.
- [x] Booking slot grid accounts for past slots on current date and prospective slots on future dates.
- [x] CSV injection formulas (`=`, `+`, `-`, `@`) safely neutralized.
