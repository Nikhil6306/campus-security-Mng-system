# Campus Security Management System (CSMS)
## Backend API Specification & Route Reference

**Base URL:** `/api`  
**Protocol:** HTTPS / REST  
**Data Format:** JSON (`application/json`) / Multipart Form Data (`multipart/form-data` for photos)  
**Standard Error Envelope:**
```json
{
  "ok": false,
  "error": "Human readable error description",
  "code": "ERROR_CODE",
  "details": {}
}
```

---

## 1. Authentication & Session Endpoints (`/api/auth/*`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticates user with `email`, `password`, and optional `expectedRole`. Returns session snapshot and sets HTTP-only `csms_session` and `csms_role` cookies. |
| `POST` | `/api/auth/logout` | Authenticated | Clears `csms_session` and `csms_role` cookies, invalidating the session in the database. |
| `GET` | `/api/auth/session` | Public | Returns current authenticated user session snapshot (or `{ "session": null }`). |
| `POST` | `/api/auth/signup` | Public | Registers a new account. Restricted strictly to `visitor` and `student` roles (admin/guard self-assignment blocked). |
| `POST` | `/api/auth/forgot-password` | Public | Initiates password recovery. Generates a secure 6-digit OTP, stores hashed code, and dispatches email via Resend. |
| `POST` | `/api/auth/verify-otp` | Public | Validates 6-digit OTP within 10 minutes. Returns a single-use recovery token upon success. |
| `POST` | `/api/auth/resend-otp` | Public | Re-dispatches a fresh OTP. Enforces a 60-second cooldown period between requests. |
| `POST` | `/api/auth/reset-password` | Public | Consumes recovery token + OTP to update the user's password with new scrypt hash. |

---

## 2. Public Visitor Endpoints (`/api/public/*`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/public/bookings` | Public | Submits a new visitor pre-booking with personal details, additional guests count, category, schedule, and photo reference. |
| `GET` | `/api/public/slots` | Public | Returns available 30-minute booking time-slots for a specified date and host. |
| `GET` | `/api/public/status` | Public | Checks visit request status using booking reference ID and visitor phone number. |
| `POST` | `/api/public/visitor-photo` | Public | Uploads a visitor's live webcam photograph (`multipart/form-data`). Returns opaque `photoId`. |
| `GET` | `/api/public/directory` | Public | Retrieves public listing of active faculty departments and hosts for meeting scheduling. |
| `GET` | `/api/public/monthly-visitors` | Public | Aggregated monthly visitor statistics for public transparency boards. |
| `POST` | `/api/public/pass-delivery` | Public | Triggers resending of digital QR pass via WhatsApp or Email. |

---

## 3. Gate Security & QR Operations (`/api/gate/*`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/gate/verify` | `security`, `admin`, `super_admin` | Scans and verifies an opaque QR pass token or booking ID. Returns visitor details, approval status, and facial photo. |
| `POST` | `/api/gate/check-in` | `security`, `admin`, `super_admin` | Records visitor entry (IN). Enforces single active entry (duplicate IN scans blocked). Assigns physical visitor badge. |
| `POST` | `/api/gate/check-out` | `security`, `admin`, `super_admin` | Records visitor exit (OUT). Validates that visitor has an active entry. Updates status to `CHECKED_OUT`. |

---

## 4. Faculty & Meeting Approval Endpoints (`/api/faculty/*`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/faculty/decision` | Token-Based (Public) | Handles single-use cryptographic token link clicked by faculty in WhatsApp/Email. Executes `ACCEPT` or `REJECT`. |
| `POST` | `/api/faculty/visitor-requests/[id]/accept` | `teacher`, `admin`, `super_admin` | Authenticated faculty approves a pending visitor meeting request, issuing an instant QR pass. |
| `POST` | `/api/faculty/visitor-requests/[id]/reject` | `teacher`, `admin`, `super_admin` | Authenticated faculty rejects a pending visit request with an optional reason note. |

---

## 5. Security Guard Duty, Shifts & Patrols (`/api/guard-duty/*`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/guard-duty/dashboard` | `security`, `admin`, `super_admin` | Real-time guard station metrics: active shifts, visitors currently on campus, open alerts, and gate staffing status. |
| `POST` | `/api/guard-duty/shift/start` | `security`, `admin`, `super_admin` | Guard begins active duty at an assigned gate post. Validates against duplicate active shifts. |
| `POST` | `/api/guard-duty/shift/end` | `security`, `admin`, `super_admin` | Guard concludes duty session, generating draft metrics for handover. |
| `POST` | `/api/guard-duty/handovers` | `security`, `admin`, `super_admin` | Submits shift handover report containing visitor count, unresolved incidents, and physical equipment condition checklists. |
| `POST` | `/api/guard-duty/handovers/[id]/acknowledge` | `security`, `admin`, `super_admin` | Incoming guard confirms receipt of handover duties and equipment items. |
| `POST` | `/api/guard-duty/handovers/[id]/decision` | `admin`, `super_admin` | Security Supervisor / Admin formally approves or rejects a shift handover. |
| `GET` | `/api/guard-duty/patrols/routes` | `security`, `admin`, `super_admin` | Lists configured perimeter patrol routes and sequential checkpoints. |
| `POST` | `/api/guard-duty/patrols/submit` | `security`, `admin`, `super_admin` | Submits completed checkpoint scan with GPS verification and mandatory checkpoint photo. |
| `GET` | `/api/guard-duty/staffing` | `admin`, `super_admin` | Evaluates gate post coverage against `gate_staffing_requirements` to highlight staffing gaps. |

---

## 6. Campus Emergencies, Hazards & Incidents

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/emergency` | `security`, `admin`, `super_admin` | Lists active and historical campus emergency broadcasts. |
| `POST` | `/api/emergency` | `security`, `admin`, `super_admin` | Broadcasts high-priority campus emergency alert (Fire, Medical, Security Lockdown). |
| `POST` | `/api/sos` | `security`, `admin`, `super_admin` | Triggers guard panic alert or student distress beacon. |
| `GET` | `/api/incidents` | `security`, `admin`, `super_admin` | Retrieves incident reports log with filtering by severity, category, and date. |
| `POST` | `/api/incidents` | `security`, `admin`, `super_admin` | Files a new security incident report with details and witness information. |
| `GET` | `/api/safety-issues` | `security`, `admin`, `super_admin` | Tracks physical hazard tickets (broken fences, lighting failures, hazards). |
| `POST` | `/api/safety-issues` | `security`, `admin`, `super_admin` | Reports a new hazard ticket with photo and location tagging. |

---

## 7. WhatsApp Integration & Webhooks (`/api/whatsapp/*`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/whatsapp/webhook` | Public (Meta Webhook) | Hub verification handshake (`hub.challenge` & `hub.verify_token`). |
| `POST` | `/api/whatsapp/webhook` | Public (Meta Webhook) | Inbound WhatsApp webhook receiver. Validates `X-Hub-Signature-256` HMAC-SHA256 signature and processes message receipts. |
| `POST` | `/api/whatsapp/test` | `admin`, `super_admin` | Triggers test WhatsApp message dispatch to verify API credentials and templates. |
| `POST` | `/api/whatsapp/[id]/retry` | `admin`, `super_admin` | Retries failed WhatsApp notification message. |

---

## 8. Student Hostel Outpass Endpoints (`/api/outpass/*`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/outpass` | `student`, `admin`, `super_admin` | Retrieves outpass requests for student or hostel warden review queue. |
| `POST` | `/api/outpass` | `student` | Submits a new hostel outing or leave pass request. |
| `POST` | `/api/outpass/[id]` | `admin`, `super_admin` | Hostel warden approves or denies student outpass request. |
| `POST` | `/api/outpass/scan` | `security`, `admin`, `super_admin` | Security guard scans student digital outpass QR at campus hostel gates. |

---

## 9. Administrative Analytics & Reports (`/api/admin/*`, `/api/reports`, `/api/analytics`)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/analytics` | `admin`, `super_admin` | Returns system-wide KPI summary (daily visitors, peak arrival hours, gate loads). |
| `GET` | `/api/admin/visitor-analytics` | `admin`, `super_admin` | In-depth visitor trends categorized by department, purpose, and visitor type. |
| `GET` | `/api/reports` | `admin`, `super_admin` | Generates exportable CSV/JSON audit reports for campus security management. |
| `POST` | `/api/admin/reset` | `super_admin` | Emergency maintenance: resets demonstration data to initial seed state. |
