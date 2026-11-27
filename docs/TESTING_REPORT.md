# Testing Report — DSVV CSMS

**Date:** 2026-11-27

## 1. Automated Local Test Suites (Post-Final-Edit)
| Check | Result | Details |
|---|---|---|
| `npm run typecheck` | **PASS** | 0 TypeScript errors |
| `npm run typecheck --prefix mobile` | **PASS** | 0 TypeScript errors |
| `npm run lint` | **PASS** | 0 errors (pre-existing warnings only) |
| `tests/unit.mjs` | **PASS** | 52 / 52 passed |
| `tests/offline-persistence.mjs` | **PASS** | 40 / 40 passed |
| `tests/guard-authentication-and-approval.mjs` | **PASS** | 11 / 11 passed |
| `tests/gate-in-out-workflow.mjs` | **PASS** | 6 / 6 passed |
| `tests/email-service.mjs` | **PASS** | 1 / 1 passed |
| `tests/supabase-migration-safety.mjs` | **PASS** | 1 / 1 passed |
| `tests/deployment-config.mjs` | **PASS** | Passed |

## 2. Live Production API Verification (`https://campus-security-management.vercel.app`)
- `superadmin@dsvv.edu.in` (`super_admin`): **HTTP 200 PASS**
- `admin@dsvv.edu.in` (`admin`): **HTTP 200 PASS**
- `security@dsvv.edu.in`, `sunil.thapa@dsvv.edu.in`, `rajesh.bisht@dsvv.edu.in`, `pooja.rawat@dsvv.edu.in` (`security`): **HTTP 200 PASS**
- `anupama.sharma@dsvv.edu.in`, `rajeshwari.trivedi@dsvv.ac.in` (`teacher`): **HTTP 200 PASS**
- `aarav.mehta@dsvv.edu.in` (`student`): **HTTP 200 PASS**
- `visitor@dsvv.edu.in` (`visitor`): **HTTP 200 PASS**
- `POST /api/guards/register`: **HTTP 200 PASS** (`PENDING` in Supabase), duplicate email **HTTP 409 PASS**, `PENDING` login **HTTP 403 PASS** (test record cleaned up).
- Unauthenticated `GET /api/guards/registrations` & `GET /api/guards/status`: **HTTP 401 PASS**.

## 3. Physical Android Device Verification
- Device: `1A19263210BA09GU` (Realme `RMX3263`, USB debugging `device`)
- APK built (`Security.apk`, 54,872,423 bytes), installed via `adb install -r` (`Success`), launched `com.dsvv.campussecurity/.MainActivity` (`PID: 25139`), 0 crash/JS errors in `logcat`.
- **Blocked / Requires External Env:** Live Resend email delivery requires `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Vercel Production settings.
