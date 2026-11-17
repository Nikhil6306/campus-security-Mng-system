# Campus Security Management System (CSMS)
## Master Implementation Roadmap & Milestones

**Target Demonstration Deadline:** 24 November 2026  
**Total Timeline:** 12 Calendar Days (12 November 2026 – 24 November 2026)  
**Execution Strategy:** Sequential Phased Rollout with Mandatory Approval Gates  

---

### 1. Phased Roadmap Gantt & Timeline Overview

```
+-----------------------------------------------------------------------------------------------------------------+
| PHASE / MILESTONE                                | DATES          | DURATION | PRIORITY    | STATUS             |
+-----------------------------------------------------------------------------------------------------------------+
| Phase 0 & 1: Audit & Enterprise Architecture     | 12 Nov         | 1 Day    | Blocker     | COMPLETED          |
| Phase 2: Vercel Cloud Database Configuration     | 13 Nov         | 1 Day    | CRITICAL    | READY FOR EXEC     |
| Phase 3: Mobile Core Integration & Bug Fixes     | 14 - 15 Nov    | 2 Days   | HIGH        | READY FOR EXEC     |
| Phase 4: Android Release APK Build (EAS)         | 16 - 17 Nov    | 2 Days   | HIGH        | READY FOR EXEC     |
| Phase 5: Multi-Platform E2E Testing (4 Scenarios)| 18 - 19 Nov    | 2 Days   | HIGH        | READY FOR EXEC     |
| Phase 6: Test Suite Modernization & Code Cleanup | 20 - 21 Nov    | 2 Days   | MEDIUM      | READY FOR EXEC     |
| Phase 7: Final Documentation, PPT & Demo Run     | 22 - 24 Nov    | 3 Days   | HIGH        | READY FOR EXEC     |
+-----------------------------------------------------------------------------------------------------------------+
```

---

### 2. Detailed Milestone Specifications

#### Phase 2: Vercel Cloud Database Configuration & Deployment Fix
- **Target Date:** 13 November 2026
- **Objective:** Resolve live HTTP `500`/`400` errors on `https://campus-security-management.vercel.app`.
- **Tasks:**
  1. Retrieve transaction pooler connection string from Supabase Dashboard (Port 6543).
  2. Configure `SUPABASE_DB_URL`, `DATABASE_DRIVER=postgres`, and Supabase keys in Vercel Production Environment Variables.
  3. Redeploy latest build on Vercel without code modifications.
  4. Verify health probe `GET /api/auth/session` returns HTTP `200`.
  5. Verify guard authentication `POST /api/auth/login` returns HTTP `200` with valid session token.
- **Acceptance Criteria:**
  - Live Vercel website successfully logs in administrator and guard accounts.
  - Live `/api/state` endpoint returns complete campus state JSON without database errors.

#### Phase 3: Mobile Core Integration & Bug Fixes
- **Target Dates:** 14 – 15 November 2026
- **Objective:** Fix verified mobile bugs in `mobile/src/services/api.ts` and screen components.
- **Tasks:**
  1. Fix `api.ts:358`: Update `getGuardDashboardData()` to correctly read `stateJson.data?.state`.
  2. Fix `check-in.tsx`: Implement multipart photo upload to `/api/visitor-photo` to obtain a server `photoId` before creating booking.
  3. Fix `check-in.tsx`: Calculate `visitTime` as an eligible upcoming time slot (e.g. +15 mins in IST) to satisfy backend validation.
  4. Fix `dashboard.tsx`: Connect shift clock-in/out to dynamically track active shift session IDs.
  5. Clean up `login.tsx`: Remove hardcoded credentials from default state.
  6. Clean up `scan.tsx`: Remove visible `DEMO-*` shortcuts from camera screen.
  7. Connect `forgot-password.tsx` to `POST /api/auth/forgot-password`.
  8. Connect `notifications.tsx` to live notifications from `/api/state`.
- **Acceptance Criteria:**
  - `cd mobile && node node_modules/typescript/bin/tsc --noEmit` passes with 0 errors.
  - Mobile walk-in check-in successfully creates a real booking and records gate entry.
  - Mobile dashboard displays live visitor and vehicle numbers matching the web admin console.

#### Phase 4: Android Release APK Build & Hardware Testing
- **Target Dates:** 16 – 17 November 2026
- **Objective:** Compile, download, and verify an installable `.apk` on a physical Android smartphone.
- **Tasks:**
  1. Run `eas init` to generate Expo project link in `mobile/app.json`.
  2. Execute `eas build --profile production --platform android` via Expo EAS Cloud.
  3. Download signed release `.apk` artifact.
  4. Sideload onto physical Android smartphone via USB or direct download.
  5. Verify hardware camera permission prompt and physical QR code autofocus scanning.
  6. Verify offline resilience when toggling airplane mode.
- **Acceptance Criteria:**
  - APK installs on Android without signature errors or package conflicts.
  - Guard logs in and scans a physical printed or screen-displayed visitor QR code.

#### Phase 5: Multi-Platform E2E Integration (The 4 Master Scenarios)
- **Target Dates:** 18 – 19 November 2026
- **Objective:** Verify end-to-end multi-device synchronization across Web, Backend, Database, and Mobile.
- **Scenarios Tested:**
  1. **Scenario 1 (Public Booking to Gate):** Visitor books on public website → Faculty approves via WhatsApp/Web → Visitor receives QR pass → Guard scans on mobile APK → Entry recorded → Admin dashboard increments *Currently Inside*.
  2. **Scenario 2 (Mobile Walk-in to Admin):** Guard enters walk-in guest on Android APK → Takes visitor photo → Passes generated → Entry logged → Admin dashboard reflects new guest in real time.
  3. **Scenario 3 (Faculty Approval):** Visitor submits meeting request → Faculty clicks Approve in WhatsApp message → Booking transitions to Approved → Mobile app expected visitor list updates.
  4. **Scenario 4 (Multi-Guard Gate Synchronization):** Guard at Main Gate checks in visitor → Guard at North Gate searches visitor → Status displays as already inside campus.
- **Acceptance Criteria:**
  - All 4 workflows execute flawlessly with verified database state updates.

#### Phase 6: Test Suite Modernization & Code Cleanup
- **Target Dates:** 20 – 21 November 2026
- **Objective:** Achieve 100% green test passes across all automated scripts.
- **Tasks:**
  1. Fix `tests/guard-duty-handover.mjs` to target `.data/campus-security.db` and update Scenario 18 assertion to match `0014` lowercase SQL syntax.
  2. Execute full automated suite: `npm test`, `npm run test:prebooking`, `npm run test:whatsapp`, `node tests/guard-duty-handover.mjs`.
  3. Run live HTTP security audit (`npm run test:security`) and photo upload suite (`npm run test:photo`) against running server.
  4. Archive or clearly document the standalone `backend/` folder in README to eliminate evaluator confusion.
- **Acceptance Criteria:**
  - Zero test failures across all test suites.

#### Phase 7: Final Demonstration PPT, Rehearsal & Delivery
- **Target Dates:** 22 – 24 November 2026
- **Objective:** Complete project readiness for final university evaluation.
- **Tasks:**
  1. Author comprehensive user manuals (`docs/ADMIN_USER_GUIDE.md`, `docs/MOBILE_USER_GUIDE.md`).
  2. Prepare final evaluation PowerPoint presentation (`CSMS_Final_Demonstration.pptx`).
  3. Rehearse live demonstration flow with smartphone screen mirroring.
  4. Verify final milestone deliverables with project stakeholders.
- **Acceptance Criteria:**
  - Complete, polished, and rehearsed demonstration ready for academic review.

