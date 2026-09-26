# Campus Security Management System

**Dev Sanskriti Vishwavidyalaya** — visitor pre-booking, digital passes, gate
verification, incident and emergency handling, with a full audit trail.

A visitor books a meeting online; the request is approved by the host or the
security office; the visitor receives a QR pass; a guard scans it at the gate and
the backend — not the QR code — decides whether they may enter; the teacher runs
the meeting; the guard checks them out. Every step is recorded, and the console
shows it happening live.

---

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The database is created and seeded on the first
request — no migration step, no external service.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Super administrator | `superadmin@dsvv.edu.in` | `Super@123` |
| Administrator | `admin@dsvv.edu.in` | `Admin@123` |
| Security guard | `security@dsvv.edu.in` | `Security@123` |
| Teacher | `anupama.sharma@dsvv.edu.in` | `Teacher@123` |
| Student | `aarav.mehta@dsvv.edu.in` | `Student@123` |

These are demonstration accounts seeded with scrypt-hashed passwords. Re-password
them (and delete `lib/demo-accounts.ts`) before the system handles real visitors.

---

## Architecture

```
Browser ──► lib/api.ts ──► app/api/**/route.ts ──► lib/server/services/** ──► lib/server/repo.ts ──► SQL
   ▲                            │
   └──── SSE /api/events ◄──────┘
```

The browser holds no business rules and no database. It calls typed endpoints;
the server validates, decides, writes, and answers with a fresh **role-scoped
snapshot** that the client installs. What the interface renders is therefore
always what the server was willing to disclose.

| Layer | Location | Responsibility |
| --- | --- | --- |
| Pages | `app/` | App Router routes for the five surfaces |
| Components | `components/` | `ui/` primitives, then `admin/`, `visitor/`, `security/`, `teacher/`, `shared/` |
| HTTP client | `lib/api.ts` | The only place the browser talks to the server |
| API routes | `app/api/` | Auth, validation, one predictable error envelope |
| Services | `lib/server/services/` | Business rules, one transaction per operation |
| Repository | `lib/server/repo.ts` | The only module that knows column names |
| Schema | `lib/server/schema.ts` | Tables, constraints, indexes |

### Database

The bundled driver is **SQLite via Node's built-in `node:sqlite`** — real SQL,
foreign keys and transactions, with no native build step and nothing to install.
The file lives at `.data/campus-security.db`; delete it to start clean.

The equivalent **PostgreSQL / Supabase** schema, including Row Level Security and
Storage policies, is in `supabase/migrations/`. See *Running on Supabase* below.

Correctness that matters is enforced by the database, not by application code:

| Constraint | What it prevents |
| --- | --- |
| `uniq_host_slot` | Two live bookings for the same host, date and time |
| `uniq_visitor_slot` | The same visitor double-booking a slot |
| `uniq_check_direction` | A duplicate check-in from a double-tap or replayed request |
| `uniq_vehicle_inside` | The same number plate recorded inside twice |
| `whatsapp_messages.dedupe_key` | A retry becoming a second message in the visitor's chat |

Each write runs inside `BEGIN IMMEDIATE`, so a booking's status, its gate log and
its audit entry can never drift apart.

---

## The five surfaces

| Surface | Routes |
| --- | --- |
| **Public / visitor** | `/`, `/visitor`, `/visitor/book`, `/visitor/status`, `/visitor/pass/[id]`, `/visitor/help` |
| **Admin console** | `/admin/dashboard`, `visitors`, `bookings`, `requests`, `meetings`, `checkin`, `students`, `teachers`, `guards`, `guards/[id]`, `gates`, `vehicles`, `incidents`, `emergency`, `notifications`, `activity`, `reports`, `settings` |
| **Gate console** | `/security/dashboard`, `scan`, `check-in`, `check-out`, `vehicles`, `incidents`, `emergency` |
| **Teacher portal** | `/teacher/dashboard`, `meetings`, `availability`, `profile` |
| **Student portal** | `/student` |

---

## Authentication and authorisation

Sessions are opaque random tokens in the `sessions` table, handed to the browser
in an **httpOnly, SameSite=Lax** cookie. Nothing about the caller's identity —
id, role, gate — travels in a client-readable value, so a role cannot be forged
by editing storage. Every request re-reads the row, which is what makes sign-out
and account deactivation take effect immediately.

Passwords are **scrypt** hashes with a per-user salt. "No such account" and
"wrong password" return the same message and take comparable time, so staff
emails cannot be enumerated.

Authorisation is enforced **server-side on every route**:

| Role | Reach |
| --- | --- |
| `super_admin` | Everything, including staff accounts and the demo-data reset |
| `admin` | Visitors, bookings, meetings, staff, guards, gates, vehicles, safety, reports, audit |
| `security` | Their gate: verification, check-in/out, vehicles, incident reports, emergency alerts |
| `teacher` | Their own meetings, their availability, their profile |
| `student` | Their own record and outing requests |
| visitor (anonymous) | Their own booking, pass and status — via reference + mobile |

`lib/server/services/snapshot.ts` narrows the snapshot per role a second time,
so a teacher's browser never receives another teacher's meetings at all.

The client-side redirects in `AdminShell`, `PortalShell` and `SecurityShell`
choose *what to render*. They are not the security boundary — the API is.

---

## Realtime

Mutations publish to an in-process bus (`lib/server/events.ts`), relayed to
connected dashboards over **server-sent events** at `/api/events`. A check-in at
the gate reaches the admin console without a refresh.

For a multi-instance deployment, that one file is the seam: swap it for Postgres
`LISTEN/NOTIFY` or Supabase Realtime without touching any service. The Supabase
migration already adds the relevant tables to the `supabase_realtime`
publication.

---

## WhatsApp notifications

**Status: CONFIGURATION REQUIRED.** No credentials are set in development, so
the system uses a development adapter: every message is rendered and written to
`whatsapp_messages` with the row marked *simulated*, and **nothing is
transmitted**. The admin settings screen reports this state plainly; a simulated
message is never presented as a delivered one.

```
lib/server/services/whatsapp/
  provider.ts    Transport adapters — Meta Cloud API, development mock, factory
  templates.ts   Every outbound message body, in one file
  index.ts       Queueing, delivery log, idempotency, retry, receipts
```

Messages are sent for: `booking_created`, `booking_approved`, `booking_rejected`,
`booking_rescheduled`, `visitor_checked_in`, `meeting_started`,
`meeting_completed`, `visitor_checked_out`.

Two rules shape the module:

1. **A notification never fails a booking.** Every send is attempted after the
   booking transaction has already committed, and a transport failure is
   recorded as a `FAILED` row rather than thrown at the visitor. The booking
   still succeeds and the pass is still available on the website.
2. **A retry never sends twice.** The row is written first, keyed on
   `dedupe_key`; a replay collides on the unique index and is skipped before the
   provider is contacted.

To enable real delivery, set the WhatsApp variables in `.env.local` (see
`.env.example`) and use the official **WhatsApp Business Platform**. Browser
automation and unofficial libraries are not supported and violate the terms of
service.

Delivery receipts arrive at `/api/whatsapp/webhook`. That route has no session to
authenticate, so it refuses everything until `WHATSAPP_VERIFY_TOKEN` is set.

---

## Visitor photographs

Every booking carries a photograph of the visitor. It is mandatory: the booking
schema requires it, so a request without one is refused by the server whatever
the browser did.

The flow is two steps. `POST /api/public/visitor-photo` stores the image and
returns an opaque id; the booking then names that id, and the service confirms
it resolves to a stored file before writing the row. The image itself never
travels in the booking request, and never reaches the database — the
`photo_url` column holds `visitor-photos/<id>.jpg` and nothing more.

What keeps it private:

- Files are written under `.data/visitor-photos` (see `VISITOR_PHOTO_DIR`),
  outside the web root. Nothing in `public/` ever holds a visitor's face.
- The only way to read one back is `GET /api/visitor-photo/[id]`, which requires
  a staff session. An unauthenticated caller gets 401 whether or not the id
  exists, so the endpoint cannot be used to discover which photographs are real.
- The filename is 24 random bytes generated by the server. Nothing a visitor
  typed reaches a storage path.
- The format is decided by sniffing the leading bytes, not by trusting the
  upload's content type, so a renamed script is refused as an invalid image.
- Uploads are capped at 5 MB, limited to JPEG/PNG/WebP, and rate limited.

The browser re-encodes a photograph to at most 1280px on its longest edge before
uploading, which keeps a phone photo to a few hundred kilobytes without making
the face harder to read at the gate.

Staff see the photograph wherever identity matters: the gate scan result, the
check-in and check-out dialogs, the booking detail dialog, the visitor and
request lists, and a host's own meetings. The public pass-verification page at
`/visit/verify/[token]` deliberately does **not** show it — that page is
reachable by anyone holding the link.

---

## The QR pass

The QR code carries an opaque `pass_token` — **never** personal data, and never
the decision itself. On a scan the backend re-reads the booking and checks that
it exists, is approved, falls on today's date, is inside visiting hours, is not
cancelled or expired, and has not already been checked in. Only then does the
gate console offer a CHECK IN button.

Scanning happens on the device: `components/security/qr-scanner.tsx` decodes
frames locally with jsQR. No image is uploaded anywhere.

---

## Running on Supabase

The application currently runs on the bundled SQLite driver. To move it to
Supabase:

1. Create a project and apply the migrations:

   ```bash
   psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_schema.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_rls.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/0003_visit_guests.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/0004_faculty_notifications.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/0005_visitor_photos.sql
   ```

   `0005` creates the private `campus-security` bucket if it is missing and
   restricts the `visitor-photos/` prefix: staff may read, and nothing but the
   service role may write. Port `lib/server/photo-store.ts` to Supabase Storage
   under that prefix — it is the only module that touches photograph files.

2. Fill in the Supabase variables in `.env.local` (see `.env.example`).
3. Port `lib/server/repo.ts` and `lib/server/db.ts` to the Postgres client, and
   move authentication to Supabase Auth against the `profiles` table. Because
   `repo.ts` is the only module that writes SQL for the application, the
   services above it do not change.

`0002_rls.sql` enables RLS on **every** table — a table with RLS on and no policy
denies all access, so reach is granted deliberately rather than inherited by
omission. Gate movements and the audit trail have no update or delete policy at
all: they are append-only, so history cannot be rewritten from the application.
`SUPABASE_SERVICE_ROLE_KEY` bypasses every policy and must stay server-side.

---

## Testing

```bash
npm test                       # unit tests — no server needed
```

Covers the visiting-hours window, WhatsApp number normalisation and masking, the
bookable-slot grid, and CSV formula-injection escaping.

```bash
npm run dev                    # in one terminal
npm run test:all               # in another — journey, then security audit
```

`npm run test:photo` runs the visitor-photograph suite on its own: upload
validation, the booking refusing to exist without one, what the row actually
holds, who may read the image back, and the photograph reaching the gate through
QR verification. Live camera capture, the permission-denied message and the
mobile layout need a real browser and are not covered there.

`test:all` runs the suites in the required order. The security audit finishes by
deliberately exhausting the public booking rate limit, which is shared with the
journey's booking step; restarting the dev server clears those counters.

**`npm run test:security`** is an attack suite, not a happy path — 109 checks
covering the role/endpoint authorisation matrix, invalid booking state
transitions, IDOR and cross-tenant reads, privilege escalation, public-endpoint
data exposure, pass-token strength, server-side validation, SQL/XSS injection,
session handling, error-message hygiene and rate limiting.

The journey walks the full demonstration path — sign in as four roles, book,
approve, verify the QR, check in, run the meeting, check out — and asserts the
**database** moved at every step, reading it directly rather than trusting the
API responses. It also exercises the refusal cases: wrong password, cross-role
access, duplicate booking, past date, unknown QR token, double check-in, double
check-out, duplicate vehicle, and WhatsApp de-duplication.

It restores the campus visiting hours and host availability it widens for the
run.

```bash
npm run lint
npm run typecheck
npm run build
```

---

## Project layout

```
app/            App Router routes and API endpoints
components/     ui/ primitives, then admin/ visitor/ security/ teacher/ shared/
lib/            api client, types, validation, utils
  server/       schema, db, auth, services — never reaches the browser
supabase/       PostgreSQL schema and Row Level Security policies
tests/          end-to-end journey
public/assets/  university logo and campus photography
.data/          SQLite database and visitor photographs — gitignored, never served
```

`lib/server/**` is marked `server-only`: importing it from a client component is
a build error, not a runtime leak.

---

## Security notes

- No secrets in the client bundle. Only `NEXT_PUBLIC_`-prefixed variables reach
  the browser, and no key is among them.
- Passwords are scrypt-hashed with per-user salts; none is ever logged.
- Raw database errors never reach a user. Constraint violations are translated
  into sentences a receptionist could act on; anything unrecognised is logged
  server-side and replaced with a generic message.
- Visitor ID numbers and phone numbers are excluded from public payloads and
  masked in the interface outside authorised roles.
- CSV export escapes cells that begin with `=`, `+`, `-` or `@`, so an exported
  file cannot execute as a spreadsheet formula. Photograph paths are not among
  the exported columns.
- Visitor photographs are stored outside the web root and served only to a staff
  session. They are never attached to a WhatsApp message and never linked from
  one: the faculty notice says a photograph is on the request and points at the
  review screen, which is behind the host's own session.
- The emergency centre is a **software alert system**. It records an alert,
  notifies the console and writes to the audit log. It places no telephone call
  and contacts no emergency service.
