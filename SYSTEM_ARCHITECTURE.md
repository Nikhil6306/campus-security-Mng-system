# Campus Security Management System (CSMS)

## System Architecture & Implementation Blueprint

**Document type:** Project architecture specification\
**Target:** Existing Campus Security Management System website/app\
**Status:** Target architecture --- verify each item against the current
codebase before marking it implemented\
**Primary stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind
CSS, shadcn/ui, Next.js Route Handlers, Supabase
PostgreSQL/Auth/Storage/Realtime, GitHub, Vercel

------------------------------------------------------------------------

## 1. Purpose and scope

CSMS digitizes campus entry and security workflows for visitors,
students, faculty/staff, family members, bookings, guards,
administrators, gate check-in/check-out, QR passes, notifications, duty
schedules, audit trails, and monthly reporting.

The architecture must provide: - One authoritative persistent data store
in Supabase PostgreSQL. - Secure authentication and server-side
role/permission checks. - Request submission, approval, QR issuance,
gate verification, and exit recording. - Hybrid booking approval:
eligible bookings can be auto-approved under explicit server-side rules;
all other bookings require an authorized approver. - Security Supervisor
as a configured backup approver. - WhatsApp delivery to the exact number
submitted for the relevant request, through an approved WhatsApp
Business provider/API. - One-hour QR validity by default, with a
controlled renewal process and a secure gate exception for an expired
pass. - Guard duty location, start/end time, and one-week schedule. -
Faculty notifications for relevant visit requests. - Monthly analytics
sourced from real database records. - Audit logs for privileged and
security-sensitive actions. - Responsive, mobile-first guard workflows
and desktop-friendly admin workflows.

**Important:** This is the target architecture. Do not assume a module
is already implemented just because it is described here. Audit the
current repository and record implementation status, test evidence, and
any blockers.

## 2. Architecture principles

1.  **Supabase PostgreSQL is the system of record.** Do not split active
    production writes between SQLite, local JSON, browser storage, mock
    data, and Supabase.
2.  **Server-side authorization is mandatory.** Hiding a button is not
    access control.
3.  **Default deny.** Every API operation requires an authenticated
    identity and explicit permission unless it is intentionally public.
4.  **Least privilege.** Guards, faculty, students, visitors, approvers,
    and admins only receive the data and actions they need.
5.  **Validate on the server.** Client validation improves UX but never
    replaces API/database validation.
6.  **Atomic state transitions.** Approval, QR issuance, check-in,
    check-out, and booking-conflict prevention must be concurrency-safe.
7.  **QR codes are credentials, not decoration.** Use opaque,
    high-entropy tokens; store only a cryptographic hash where
    practical; never trust client-supplied status.
8.  **Notifications are asynchronous side effects.** Persist the
    business decision first, then deliver messages with retries and
    delivery status tracking.
9.  **Audit important actions.** Logs should identify actor, action,
    target, timestamp, and safe metadata without storing passwords,
    access tokens, or raw QR secrets.
10. **Preserve existing functionality.** Implement incrementally; do not
    remove unrelated pages, styles, routes, or features.
11. **No secrets in browser bundles or Git.** Service-role keys and
    provider secrets remain server-only.
12. **Observable and testable.** Log failures safely and test the actual
    end-to-end flow, not only whether the build succeeds.

## 3. High-level system diagram

``` mermaid
flowchart TB
    subgraph Clients["Client / Presentation Layer"]
      PUB["Public website / Request forms"]
      USER["Student / Visitor / Family portal"]
      FAC["Faculty / Staff portal"]
      GUARD["Guard mobile-first dashboard"]
      ADMIN["Admin / Security Supervisor dashboard"]
    end

    subgraph APP["Next.js Application Layer"]
      UI["React 19 + TypeScript UI"]
      AUTH["Authentication session handling"]
      API["Route Handlers / Server Actions"]
      VALID["Zod validation + permission checks"]
      SVC["Domain services / workflow rules"]
      JOB["Notification / retry processing"]
    end

    subgraph DATA["Supabase Platform"]
      SAUTH["Supabase Auth"]
      DB[("PostgreSQL")]
      RLS["Row Level Security + grants"]
      STORE["Supabase Storage"]
      RT["Realtime (only where needed)"]
    end

    subgraph EXT["External integrations"]
      WA["WhatsApp Business provider/API"]
      EMAIL["Email provider (optional)"]
      OBS["Monitoring / error reporting"]
    end

    PUB --> UI
    USER --> UI
    FAC --> UI
    GUARD --> UI
    ADMIN --> UI
    UI --> AUTH
    AUTH <--> SAUTH
    UI --> API
    API --> VALID --> SVC
    SVC --> DB
    DB --- RLS
    SVC --> STORE
    DB --> RT
    SVC --> JOB
    JOB --> WA
    JOB --> EMAIL
    API --> OBS
    JOB --> OBS
```

### Request flow

1.  A client submits a form.
2.  The server authenticates the session (or applies explicit
    public-form abuse controls).
3.  Zod validates the input and normalizes phone numbers, dates, and
    identifiers.
4.  The server checks role, resource ownership, approval authority, and
    business rules.
5.  A database transaction/RPC performs the state change atomically.
6.  The database enforces constraints and RLS as defense in depth.
7.  The server returns a safe result; secrets and internal errors are
    not exposed.
8.  A notification job sends WhatsApp/email and records success/failure.
    A delivery failure must not silently undo a valid approval.
9.  Audit events record sensitive actions.

## 4. Recommended application structure

Adapt this to the existing repository. Do not create duplicate routes or
move files unnecessarily.

``` text
campus-security-management-system/
├── app/
│   ├── (public)/
│   │   ├── page.tsx
│   │   ├── visitor/
│   │   ├── booking/
│   │   └── request-status/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── signup/
│   │   └── reset-password/
│   ├── (portals)/
│   │   ├── admin/
│   │   ├── supervisor/
│   │   ├── guard/
│   │   ├── faculty/
│   │   └── user/
│   ├── api/
│   │   ├── requests/
│   │   ├── approvals/
│   │   ├── bookings/
│   │   ├── qr/
│   │   ├── gate/
│   │   ├── schedules/
│   │   ├── analytics/
│   │   └── webhooks/
│   ├── layout.tsx
│   └── error.tsx
├── components/
│   ├── ui/
│   ├── forms/
│   ├── dashboards/
│   ├── qr/
│   └── charts/
├── lib/
│   ├── supabase/
│   │   ├── browser.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── auth/
│   ├── permissions/
│   ├── validation/
│   ├── security/
│   ├── notifications/
│   ├── qr/
│   ├── audit/
│   └── utils/
├── services/
│   ├── request-service.ts
│   ├── approval-service.ts
│   ├── booking-service.ts
│   ├── qr-service.ts
│   ├── gate-service.ts
│   ├── schedule-service.ts
│   ├── analytics-service.ts
│   └── notification-service.ts
├── types/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── tests/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── SYSTEM_ARCHITECTURE.md
│   └── OPERATIONS_RUNBOOK.md
├── .env.example
└── README.md
```

The names above are recommendations, not a requirement to restructure
the current app. Keep the existing project conventions if they are
sound.

## 5. Roles and authorization model

Use a trusted server-side role mapping. Never accept a role, `isAdmin`,
approval result, or guard identity from a client request body as proof
of authorization.

  -----------------------------------------------------------------------
  Role                                Intended permissions
  ----------------------------------- -----------------------------------
  Super Admin                         Manage system configuration and
                                      privileged administrators, subject
                                      to explicit policy

  Security Admin                      Manage requests, approvals,
                                      security operations, analytics,
                                      guard assignments, and audit review

  Security Supervisor                 Handle configured backup approvals
                                      and assigned security operations

  Guard                               View assigned duty/shift and
                                      gate-relevant requests; verify
                                      passes; check visitors in/out;
                                      request/perform explicitly
                                      permitted expired-pass exception

  Faculty / HOD / Staff               View relevant visit requests and
                                      respond to requests assigned to
                                      them, according to policy

  Student / Registered User           Create and view own requests, view
                                      status, receive own pass, and
                                      manage permitted profile fields

  Visitor / Family Guest              Submit a limited request and access
                                      only the status/pass workflow
                                      permitted by the product
  -----------------------------------------------------------------------

### Admin email restriction

The requested initial admin allowlist is `nikhilshukla1200@gmail.com`.

-   Enforce the allowlist on the server and in database-backed
    authorization where applicable.
-   Do not grant admin rights because a signup form contains that email
    or a client sends `role: "admin"`.
-   Prefer a controlled provisioning process for assigning the
    privileged role.
-   Other email addresses must not gain admin privileges. They may use
    ordinary user flows if permitted.
-   If the system has a Super Admin role in addition to Security Admin,
    document which account is allowed to hold each role.
-   Add automated tests for allowed and denied admin access.

## 6. Core modules

### 6.1 Identity and profiles

-   Supabase Auth handles supported sign-in methods and session
    lifecycle.
-   Store application profile and role assignment separately from
    user-editable profile fields.
-   Apply server-side session checks on protected routes and APIs.
-   Implement signup, login, logout, and reset-password flows with clear
    error states.
-   Never store plaintext passwords.
-   Avoid leaking whether a particular account exists in password-reset
    responses.

### 6.2 Visitor, family, and general requests

-   Capture the minimum required name, phone/WhatsApp number, visit
    type, purpose, host/faculty if applicable, date/time, and relevant
    supporting details.
-   Normalize and validate phone numbers; preserve the exact submitted
    destination in a normalized international format where possible.
-   Create a server-generated request ID and timestamp.
-   New manual-approval requests start as `pending`.
-   Prevent unauthorized users from reading another user's private
    request.
-   Maintain status history rather than overwriting history without
    trace.

### 6.3 Booking and approval

-   Approval mode: **Hybrid**.
-   Auto-approval only occurs when explicit server-side eligibility
    rules pass.
-   All other bookings remain pending for an authorized approver.
-   Security Supervisor is the configured backup approver.
-   Faculty-specific visits notify the relevant faculty member; the
    request remains visible to authorized security staff.
-   Prevent overlapping/double bookings using database constraints or an
    atomic transaction/RPC, not a client-only check.
-   Re-check eligibility and authority at the moment of approval.
-   Record the approver, decision, timestamp, and reason.
-   Rejected/cancelled requests cannot receive a valid pass.

### 6.4 QR pass lifecycle

Suggested lifecycle:

`not_issued → active → used`\
`active → expired`\
`active/expired → revoked`\
`expired → renewed_active` only through authorized renewal policy

Rules: - Issue a pass only after valid approval (including a recorded
auto-approval decision). - Default validity: 1 hour from issuance,
unless the approved visit window has a separately defined policy. - Use
a cryptographically secure random token. Encode only an opaque token or
signed minimal claims; do not embed private visitor details in the QR. -
Store a hash of the token where practical; never log the raw token. -
Bind the pass to the request, allowed entry window, status, and
applicable gate/purpose policy. - Verify expiry, revocation, approval,
request identity, and prior use on the server. - Make check-in atomic so
two simultaneous scans cannot both succeed. - Downloadable QR must be
generated from the same active pass record, not a separate untracked
token. - Renewal revokes the previous pass and creates a new auditable
pass. Rate-limit renewal and notify the recipient. - Gate exception for
an expired pass must require an authenticated, authorized guard, a
recorded reason, and a server-side decision. If policy requires
supervisor approval, enforce it. Never let the visitor self-bypass
expiry. - Never expose a permanent QR or reusable bearer token in a
public URL.

### 6.5 Gate check-in / check-out

-   Guard submits QR token to a server endpoint.
-   Server validates the pass and associated request.
-   Atomic operation records `checked_in_at`, guard, gate/location, and
    result.
-   A second check-in for the same one-time pass is rejected unless a
    documented re-entry policy allows it.
-   Check-out records `checked_out_at` and the actor/gate.
-   Provide clear outcomes: valid, expired, revoked, already used, not
    approved, outside visit window, or system unavailable.
-   If verification cannot reach the server, do not silently treat the
    QR as valid. Provide a documented fallback/manual verification
    process with audit logging.
-   The 5-second target applies to normal online verification after
    submission. Measure p50/p95 latency and investigate slow cases; do
    not guarantee five seconds when the network/provider is unavailable.

### 6.6 WhatsApp and notifications

-   Use an approved WhatsApp Business Platform integration/provider. A
    QR image cannot be sent merely by knowing a phone number; provider
    credentials, templates/permissions where applicable, and production
    configuration are required.
-   Destination: the exact request's submitted WhatsApp number, not an
    unrelated profile number.
-   For faculty notifications, use the configured faculty contact and
    approved notification rules.
-   Send only after the transaction has committed.
-   Use an outbox/job pattern or durable queue so temporary provider
    failures can be retried safely.
-   Track message type, destination (mask in logs), provider message ID,
    status, attempts, timestamps, and safe error summary.
-   Use idempotency keys to avoid duplicate sends.
-   Never log API secrets or full QR tokens.
-   `RESEND_ENABLE_DEVELOPMENT_DELIVERY=false` is appropriate for
    avoiding Resend's development-only delivery mode in production, but
    this setting alone does not configure WhatsApp delivery. Verify the
    actual email provider and WhatsApp integration separately.
-   Do not report "sent" until the provider confirms acceptance;
    distinguish queued, accepted, delivered, and failed where the
    provider exposes these states.

### 6.7 Guard duty and weekly schedule

-   Store guard profiles, duty assignments, locations, shift start/end,
    and effective dates.
-   Dashboard shows today's assignment and a seven-day schedule.
-   Restrict guards to their own schedule and the operational records
    permitted for their assigned gate/shift.
-   Handle time zones consistently; store timestamps in UTC and display
    campus-local time.
-   Prevent conflicting shift assignments with server-side validation.
-   Keep schedule changes auditable.

### 6.8 Analytics and reporting

-   Monthly visitor counts, request counts by status, approved/rejected
    counts, check-ins/check-outs, and QR outcomes.
-   Use database-backed aggregate queries/views or secure server-side
    queries.
-   Filter by date range, campus/gate, request type, and status only
    where authorized.
-   Define metric meaning precisely (for example, "visitors" means
    distinct approved visits or completed check-ins, not a mixture).
-   Do not expose personal visitor details in aggregate analytics.
-   Charts must not use hardcoded demonstration data in production.

### 6.9 Audit trail

Capture security-relevant actions such as: - Request creation and
changes. - Approval/rejection and reason. - Auto-approval decision and
rule identifier. - QR issue, renewal, revocation, failed verification,
check-in and check-out. - Role and guard-schedule changes. -
Notification attempts and provider results. - Privileged configuration
changes.

Audit rows should include actor ID/role, action, target type/ID,
timestamp, result, correlation/request ID, and minimal safe metadata.
Restrict update/delete privileges. Never include passwords, session
cookies, provider secrets, or raw QR tokens.

## 7. Data model (logical design)

The exact schema must be reconciled with existing migrations
`0001_schema.sql` through `0008_restrict_visitor_access.sql`. Extend
through new migrations; do not edit already-applied migrations in a way
that breaks deployed databases.

Recommended logical entities:

  -----------------------------------------------------------------------
  Entity                              Purpose / important fields
  ----------------------------------- -----------------------------------
  `profiles`                          `id` (Auth user ID), display name,
                                      phone, status, created/updated
                                      timestamps

  `user_roles`                        user ID, role, assigned by,
                                      timestamps; protected from
                                      self-escalation

  `visitor_requests`                  request ID, requester/visitor
                                      details, normalized WhatsApp
                                      number, type, purpose,
                                      host/faculty, visit window, status,
                                      timestamps

  `request_status_history`            request ID, previous/new status,
                                      actor, reason, timestamp

  `bookings`                          request ID or booking ID,
                                      resource/host, start/end, status,
                                      approval metadata

  `approval_rules`                    eligibility configuration, active
                                      flag, version, updated by

  `guard_profiles`                    guard identity, active status,
                                      contact details as required

  `guard_duty_assignments`            guard, location/gate, shift
                                      start/end, effective dates,
                                      assignment actor

  `qr_passes`                         request ID, token hash, status,
                                      issued/expiry times, used/revoked
                                      times, renewal parent

  `gate_events`                       request/pass, event type, guard,
                                      gate/location, timestamp, result,
                                      correlation ID

  `notification_outbox`               event, channel, destination,
                                      template, payload reference,
                                      status, attempts, next retry,
                                      provider ID

  `notification_attempts`             outbox ID, attempt time, outcome,
                                      safe error metadata

  `audit_logs`                        actor, action, target, timestamp,
                                      result, safe metadata

  `campus_locations`                  named gates/locations and active
                                      state

  `faculty_contacts`                  faculty/profile relation and
                                      approved notification destination

  `system_settings`                   tightly controlled operational
                                      settings, including policy values
  -----------------------------------------------------------------------

These are logical recommendations, not a mandate to duplicate existing
tables. Reuse existing tables when they already serve the purpose.
Define foreign keys, indexes, `NOT NULL`, `CHECK` constraints,
uniqueness rules, and deletion policies intentionally.

### Important database constraints and indexes

-   Foreign keys from requests, passes, approvals, and gate events to
    their parent records.
-   Valid status values enforced with check constraints or enums.
-   `expires_at > issued_at` for QR passes.
-   Unique token hash per pass.
-   Index request status + creation time; visit window; host/faculty ID;
    guard + shift dates; pass/request lookup; gate event time;
    notification status + retry time.
-   Prevent duplicate active passes where policy requires a single
    active pass per request.
-   Prevent booking overlaps using an appropriate exclusion constraint
    where supported or an atomic transaction/RPC with locking.
-   Use transactions for state changes that span multiple rows.

## 8. API boundary (illustrative)

Use the existing route conventions. These are conceptual endpoint
responsibilities, not a requirement to create every route exactly as
written.

  ----------------------------------------------------------------------------------
  Method / endpoint                  Purpose                 Authorization
  ---------------------------------- ----------------------- -----------------------
  `POST /api/requests`               Submit a visitor/family Public flow with abuse
                                     request                 controls or
                                                             authenticated user

  `GET /api/requests/:id`            Read request            Owner or authorized
                                     status/details          staff

  `POST /api/requests/:id/approve`   Approve a request       Authorized approver

  `POST /api/requests/:id/reject`    Reject a request        Authorized approver

  `POST /api/bookings`               Create booking          Allowed requester

  `POST /api/qr/verify`              Verify QR for gate use  Authenticated
                                                             authorized guard

  `POST /api/qr/:id/renew`           Renew expired pass      Authorized
                                                             guard/approver per
                                                             policy

  `POST /api/gate/check-in`          Record entry            Authorized guard

  `POST /api/gate/check-out`         Record exit             Authorized guard

  `GET /api/guard/schedule`          Fetch seven-day         Guard or authorized
                                     schedule                admin

  `GET /api/analytics/monthly`       Monthly aggregates      Authorized
                                                             admin/security role

  `POST /api/webhooks/whatsapp`      Process provider        Verified provider
                                     delivery status         signature
  ----------------------------------------------------------------------------------

For every endpoint: - Validate HTTP method, body, query, and path
parameters. - Authenticate and authorize on the server. - Apply rate
limits to public submissions, login-sensitive flows, QR verification,
and renewal. - Return consistent safe errors and appropriate HTTP status
codes. - Avoid leaking internal SQL errors or secrets. - Use idempotency
protection for approval, QR issuance, check-in, and outbound
notification events. - Validate webhook signatures before processing
provider events.

## 9. Supabase security and RLS

-   Enable RLS on every table accessible through client-facing Supabase
    APIs.
-   Create explicit policies for each role and operation; do not use
    blanket `USING (true)` for private tables.
-   Use `auth.uid()` and trusted role mappings for row ownership and
    authorization.
-   Users should only read their own private requests unless a
    documented public tracking-token design is used.
-   Faculty should see only requests assigned to them or explicitly
    within their authorized scope.
-   Guards should see gate-relevant data for their assigned duty; do not
    grant unrestricted access to all visitor records by default.
-   Admin privileges must be explicitly granted and checked on the
    server.
-   Prevent users from editing their own role or approval fields.
-   Keep service-role keys server-only; never prefix them with
    `NEXT_PUBLIC_`.
-   Do not rely on RLS alone for multi-step business rules; combine RLS
    with server-side authorization and database constraints.
-   Test RLS using separate identities for visitor, faculty, guard,
    supervisor, authorized admin, and unauthorized email.
-   Keep migration SQL under version control and review each policy
    change.

## 10. Environment and deployment

Maintain `.env.example` with variable names and safe placeholders only.
Typical variables may include:

``` env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_ENABLE_DEVELOPMENT_DELIVERY=false
WHATSAPP_PROVIDER=
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
APP_BASE_URL=
```

Only include variables for integrations actually implemented. Use the
current Supabase publishable/anon key format supported by the project;
keep privileged keys server-only. Never commit real values.

Deployment checklist: - Configure environment variables separately for
local, preview, and production. - Apply reviewed Supabase migrations to
the intended project. - Run production build and tests. - Verify auth
redirect URLs, allowed origins, provider webhooks, and HTTPS. - Confirm
logs do not contain secrets or raw QR tokens. - Test one complete
request-to-gate workflow against the production-like environment. -
Verify backups and a recovery procedure for the database. - Keep GitHub
branch protections and review migrations before production push.

## 11. Testing strategy and acceptance criteria

### Unit tests

-   Role/permission helpers.
-   Request validation and phone normalization.
-   Hybrid auto-approval eligibility rules.
-   QR expiry and renewal rules.
-   Time-window and booking-conflict calculations.
-   Analytics metric definitions.

### Integration tests

-   Request insert/read/update against a test Supabase project.
-   RLS denies cross-user access and self-role escalation.
-   Approval is atomic and recorded once.
-   Concurrent booking requests cannot double-book a resource.
-   QR issue, expiry, revocation, renewal, and duplicate scan behavior.
-   Notification outbox retry and idempotency.
-   Check-in/check-out persistence.

### End-to-end tests

1.  Visitor submits a request.
2.  Request appears in the authorized dashboard and persists after
    refresh.
3.  Pending request cannot be used to enter.
4.  Authorized approver approves it.
5.  QR is issued and sent to the submitted WhatsApp number.
6.  QR download matches the active pass.
7.  Guard verifies it and checks the visitor in.
8.  Duplicate scan is rejected.
9.  Guard checks the visitor out.
10. Expired QR follows the controlled renewal/exception workflow.
11. Monthly analytics reflects the recorded events.
12. Unauthorized admin email cannot access admin APIs or data.

### Release acceptance

-   No critical build, type, lint, or test failures.
-   All core workflows use real persisted data; no production mock data.
-   Every privileged API checks authorization server-side.
-   RLS and database constraints are tested.
-   QR verification latency is measured; normal online verification
    target is under 5 seconds.
-   Notification failure is visible and retryable.
-   All critical actions have audit records.
-   Existing unrelated functionality remains intact.
-   Any unimplemented integration or blocked test is clearly reported
    rather than claimed as complete.

## 12. Observability and incident handling

-   Use structured server logs with request/correlation IDs.
-   Track API error rates and QR verification latency.
-   Track notification queue depth, retry count, and provider failures.
-   Redact personal data and secrets from logs.
-   Provide an operational fallback for network/provider outages that
    does not bypass security checks.
-   Document how to revoke a compromised pass, disable a user, rotate
    provider credentials, and restore service.
-   Avoid logging raw QR tokens, access tokens, passwords, or full
    payment/identity details.

## 13. Implementation plan

### Phase 1 --- Audit current code

-   Map existing routes, tables, migrations, auth, roles, environment
    variables, and integrations.
-   Identify SQLite/mock/demo paths and determine whether they are still
    active.
-   Produce a feature-by-feature status report with evidence.

### Phase 2 --- Secure data foundation

-   Confirm Supabase is the single production source of truth.
-   Review migrations, RLS, indexes, constraints, role provisioning, and
    ownership policies.
-   Add new migrations only for missing pieces.

### Phase 3 --- Core workflows

-   Complete request submission, hybrid approval, faculty notifications,
    supervisor fallback, booking conflict protection, and audit history.

### Phase 4 --- QR and gate operations

-   Implement secure pass issuance, one-hour expiry, renewal, guard
    verification, check-in/out, and duplicate prevention.

### Phase 5 --- Communications and guard scheduling

-   Complete WhatsApp provider integration, delivery retries, faculty
    notification, guard assignments, and seven-day schedule.

### Phase 6 --- Analytics and release

-   Implement real monthly metrics, add integration/E2E tests, fix all
    verified defects, run production build, and complete deployment
    checks.

## 14. Required developer/AI-agent rules

When an AI coding agent works in this repository, it must: 1. Inspect
the existing repository before editing. 2. Read `package.json`, routes,
services, Supabase client setup, all migrations, RLS policies, and
`.env.example`. 3. Make a concise audit plan and identify high-risk
changes first. 4. Preserve unrelated features, existing UI styling, and
working routes unless a change is necessary and authorized. 5. Never
fabricate credentials, production delivery, test results, or successful
external messages. 6. Never expose secrets or weaken RLS to make a
feature "work." 7. Prefer small, reviewable changes and additive
migrations. 8. Run the relevant tests, type checks, lint, and production
build. 9. Report changed files, migration status, tests actually run,
test results, unresolved issues, and required manual provider setup. 10.
Do not mark a workflow complete without evidence from a real test or
clearly label it as unverified.

## 15. Architecture decisions to confirm during implementation

-   Exact WhatsApp Business provider and production credentials.
-   Which request categories are eligible for auto-approval and their
    precise rules.
-   Whether expired-pass gate exception requires supervisor approval or
    guard + reason is sufficient.
-   Campus-local time zone and permitted visit windows.
-   Whether a pass is strictly one-time entry or supports re-entry.
-   Which roles can view visitor phone numbers and personal details.
-   Data retention and deletion policy for visitor details, photos,
    audit logs, and gate events.
-   Exact current table names and whether existing migrations already
    implement these entities.

These decisions must be explicit, documented, and enforced server-side.

------------------------------------------------------------------------

## Definition of done

CSMS is ready only when the existing application has been audited, the
required features are implemented without damaging unrelated
functionality, Supabase persistence and RLS are verified, critical
workflows pass automated/manual end-to-end tests, provider integrations
are configured, security checks pass, and the final report clearly
distinguishes verified functionality from anything still blocked or
unverified.
