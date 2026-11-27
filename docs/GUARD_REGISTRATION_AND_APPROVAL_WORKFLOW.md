# DSVV Campus Security Management System (CSMS)
## Guard Registration & Admin Approval Workflow Specification

**Institution:** Dev Sanskriti Vishwavidyalaya (DSVV), Haridwar  
**Document:** Guard Registration, Admin Approval, and Role-Based Guard Authentication  
**Status:** FULLY IMPLEMENTED, TESTED & PRODUCTION READY  

---

## 1. Architectural Overview & Workflow Lifecycle

```
[ Unregistered Guard ]
         │
         ▼
[ 4-Field Registration Form ]
   (Full Name, Mobile Number, Email Address, Password)
         │
         ▼
[ Validation & Duplicate Checks ]
   ├── Email format & uniqueness (app_users + requests)
   ├── Mobile number (+91 Indian regex: ^[6-9]\d{9}$) & uniqueness
   └── Secure password policy (min 6 characters)
         │
         ▼
[ Create PENDING Request in Database ]
   ├── Generates reference ID (e.g. REQ-GRD-0042)
   ├── Passwords hashed with scrypt + unique random salt
   ├── Status set to 'PENDING'
   ├── No active profile or session granted
   └── Confirmation email dispatched to guard
         │
         ▼
[ Admin Dashboard: Guard Registration Requests ]
   ├── Admin reviews applicant details (Name, Mobile, Email, Request Date)
   ├── Search by name, mobile, email & filter by status
   │
   ├── [ ACTION: APPROVE ] ──────────────────────────┐
   │    1. Verifies request is still PENDING         │
   │    2. Creates/updates row in security_guards    │
   │    3. Assigns role 'security' in app_users      │
   │    4. Assigns initial gate post & shift         │
   │    5. Marks status 'APPROVED' + timestamp       │
   │    6. Dispatches approval activation email       │
   │                                                 │
   └── [ ACTION: REJECT ]                            │
        1. Records optional rejection reason         │
        2. Marks status 'REJECTED' + timestamp       │
        3. No active guard profile created           │
        4. Dispatches rejection notice email         │
                                                     ▼
                                      [ Guard Sign-In Workflow ]
                                         ├── PENDING: Denied ("Awaiting Admin Approval")
                                         ├── REJECTED: Denied (Shows rejection reason)
                                         └── APPROVED: Authenticated -> Guard Gate Dashboard
```

---

## 2. Component Breakdown

### 2.1 Starting Authentication Screen (`components/admin/login-form.tsx`)
- **Dual Tab Interface**:
  - `Sign In`: Direct access for approved security guards, gate supervisors, and administrators.
  - `Register New Guard`: Dedicated 4-field onboarding form.
- **Form Fields (Exactly 4)**:
  1. **Full Name**: Requires at least 3 characters.
  2. **Mobile Number**: Indian mobile number format (+91 optional, 10 digits starting with 6-9).
  3. **Email Address**: Validated RFC-compliant email address.
  4. **Password**: With interactive Show/Hide Password button toggle and minimum 6-character policy.
- **Real-Time Validation & Clear Error Messages**: Form checks inputs before submission and highlights invalid fields.
- **Submission Feedback**:
  - Prominent Reference ID card: `REQ-GRD-XXXX`
  - Status badge: `PENDING – Awaiting Admin Approval`
  - Exact prompt message displayed:
    > *"Your guard registration request has been submitted successfully. Your account is currently awaiting Admin approval. You will be able to access the Guard Dashboard after your request is approved."*
  - "Proceed to Sign In" quick-action button.

### 2.2 Guard Sign-In Safeguards (`lib/server/auth.ts`)
- **Strict Approval Enforcement**:
  - Unapproved accounts cannot sign in.
  - When a guard with `PENDING` registration submits login credentials:
    - HTTP 403 returned with clear message:
      > *"Your guard registration request has been submitted successfully. Your account is currently awaiting Admin approval. You will be able to access the Guard Dashboard after your request is approved."*
    - Login screen displays an amber alert banner.
  - When a guard with `REJECTED` registration submits credentials:
    - HTTP 403 returned with administrative rejection remarks.
    - Login screen displays a red alert banner.
  - Unregistered users and incorrect passwords receive secure error messages without revealing user enumeration details.

### 2.3 Admin Dashboard Guard Management
- **Dedicated Route**: `/admin/guard-registrations`
- **Embedded Tab**: `/admin/guards`
- **Core Capabilities**:
  - Metric stat cards: Total Applications, Pending Review, Approved Guards, Rejected Applications.
  - Tab filters: `All Requests`, `Pending`, `Approved`, `Rejected`.
  - Search bar: Real-time search across applicant name, mobile number, email, and reference ID.
  - Review Modal (`GuardApprovalDialog`):
    - View full applicant details.
    - Post / Gate assignment (`Main Gate`, `Gate 1 (North)`, `Gate 2 (South)`, `Hostel Gate`, `Admin Gate`).
    - Shift assignment (`Morning`, `Evening`, `Night`, `General`).
    - Admin remarks / notes.
    - Single-click **Approve & Activate** or **Reject** with recorded reason.

### 2.4 Native Mobile Application (`mobile/`)
- Synchronized across `mobile/src/app/register.tsx`, `mobile/app/register.tsx`, `mobile/src/app/login.tsx`, and `mobile/app/login.tsx`.
- Register screen reflects ONLY the 4 fields (Full Name, Mobile Number, Email Address, Password with Show/Hide toggle).
- Mobile login screen displays the styled status notice banners for `PENDING`, `REJECTED`, and `SUSPENDED` accounts.

---

## 3. Database Schema & Migration

### Schema Definition (`supabase/migrations/0020_guard_registration_requests.sql` & SQLite `schema.ts`)
```sql
CREATE TABLE IF NOT EXISTS guard_registration_requests (
  id               TEXT PRIMARY KEY,
  full_name        TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  phone            TEXT NOT NULL,
  guard_id         TEXT NOT NULL,
  designation      TEXT NOT NULL DEFAULT 'Security Guard',
  assigned_gate    TEXT NOT NULL DEFAULT 'Main Gate',
  password_hash    TEXT NOT NULL,
  password_salt    TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','SUSPENDED')),
  rejection_reason TEXT,
  created_at       TEXT NOT NULL,
  reviewed_at      TEXT,
  reviewed_by      TEXT
);

CREATE INDEX IF NOT EXISTS idx_guard_req_status ON guard_registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_guard_req_email ON guard_registration_requests(email);
```

### Row Level Security (RLS)
- Public / Anonymous users: Can INSERT a registration request.
- Authenticated Guards: Can SELECT their own registration record by matching email in JWT.
- Authenticated Admins (`role IN ('admin', 'super_admin')`): Full SELECT, UPDATE, and DELETE access.

---

## 4. Email Notifications (Resend / EmailJS Integration)

Implemented in `lib/server/services/email.ts`:
1. `sendGuardRegistrationSubmittedEmail`: Dispatched upon successful submission. Notifies the applicant that their request was received and is awaiting Admin approval.
2. `sendGuardApprovalEmail`: Dispatched when Admin clicks Approve. Delivers activation confirmation, assigned gate post, and shift details.
3. `sendGuardRejectionEmail`: Dispatched when Admin clicks Reject. Delivers notification with administrative remarks explaining why the application was declined.

---

## 5. Automated Verification Results

All automated test suites executed cleanly:

```
Starting Guard Authentication & Admin Approval Tests...

  PASS  SQLite schema contains guard_registration_requests table with all required columns and constraints
  PASS  Guard self-registration inserts record with PENDING status and hashed password
  PASS  Duplicate registration with the same email address is prevented
  PASS  Guard login is strictly denied while registration request status is PENDING
  PASS  Admin approval executes atomic transaction: creates security_guards row, creates app_users account with role 'security', and updates status to APPROVED
  PASS  Approved security guard signs in successfully, authenticates password, and receives active session
  PASS  Admin suspension deactivates guard account, flips roster to 'Suspended', and revokes active sessions
  PASS  Admin reactivation restores guard to 'Active' status and enables login
  PASS  Admin rejects registration request with recorded reason and prevents login
  PASS  Four-field registration creates valid PENDING request without requiring employee ID or designation
  PASS  Duplicate registration with an existing active guard mobile number is prevented

====================================================
  PASSED: 11    FAILED: 0
====================================================
```

- **Root TypeScript Check (`tsc --noEmit`)**: 0 errors
- **Mobile TypeScript Check (`tsc --noEmit --skipLibCheck`)**: 0 errors
- **ESLint Validation (`eslint .`)**: 0 errors
- **Full Test Suite (`npm test`)**: 118 / 118 passed
