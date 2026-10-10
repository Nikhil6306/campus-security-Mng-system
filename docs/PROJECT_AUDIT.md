# Project Audit: Campus Security Management System

## 1. Scope and purpose

This audit documents the current repository state, the actual implementation in place, the active runtime architecture, the key risks and gaps, and a safe implementation plan for continuing the project without disrupting in-flight work.

The work was audited against the live repository contents and the current git working tree. Nothing was reset, discarded, or overwritten. Existing modified and untracked files were preserved as required.

## 2. Repository state at audit time

### 2.1 Git working tree summary

The repository is currently on `main` and has active local work already in progress. Verified from `git status --short --branch`:

- Modified tracked files include app shell files, admin/login screens, security/auth surfaces, backend controllers, and core config/docs.
- Untracked files include the admin route page, auth role utility, email service, migration safety fixtures, and test scripts.

This confirms the workspace is not clean and must be treated as a live, partially completed project rather than a fresh checkout.

### 2.2 Explicit safety constraints

The project is already under modification and the user has explicitly preserved the following constraints:

- Do not reset or clean the repository.
- Do not discard user changes.
- Do not delete or replace existing routes, visitor booking flow, auth logic, or portal behaviors.
- Do not assume Supabase is the active runtime database.
- Do not run destructive DB operations or production data resets.
- Do not overwrite environment files or operational assumptions without checking the implementation first.

## 3. Verified source-of-truth architecture

### 3.1 Frontend runtime

The root app is a Next.js application with App Router pages and shared layout shells:

- [app/(public)/layout.tsx](../app/(public)/layout.tsx) wraps the public portal with the site header/footer and contact bar.
- [app/admin/layout.tsx](../app/admin/layout.tsx) wraps the admin surface in `AdminShell`.
- [app/security/layout.tsx](../app/security/layout.tsx) wraps the security desk in `SecurityShell`.

The root project package confirms the active frontend runtime:

- [package.json](../package.json) uses Next.js 15, React 19, Tailwind, and TypeScript.
- Node engine is pinned to `24.x`.
- Scripts include `dev`, `build`, `lint`, `typecheck`, and a set of app-specific tests.

The public visitor experience is already substantial and includes a working guest pre-book flow:

- [app/(public)/page.tsx](../app/(public)/page.tsx) is a campus landing page and visitor entry UI.
- [app/(public)/pre-book-visit/page.tsx](../app/(public)/pre-book-visit/page.tsx) routes to the visitor booking experience.
- [components/visitor/booking-wizard.tsx](../components/visitor/booking-wizard.tsx) contains the booking form, validation, upload and success flow.
- [lib/dsvv.ts](../lib/dsvv.ts) centralizes public university branding and facts for the frontend.

### 3.2 Active database implementation

The actual active runtime database is SQLite, not Supabase/PostgreSQL, for the main application code path.

Verified by [lib/server/db.ts](../lib/server/db.ts):

- It imports `node:sqlite` and configures a local database file.
- It creates and migrates `.data/campus-security.db` on demand.
- It explicitly describes the app as using SQLite for the default runtime.
- It documents that the Supabase/PostgreSQL migrations in `supabase/migrations/` are separate and not the active runtime DB for this app.

This is a critical finding: the runtime is dual-architecture in the repo, but the current app behavior is driven by the SQLite path and not by Supabase by default.

### 3.3 Backend runtime

The backend is a separate NestJS app under [backend/package.json](../backend/package.json) and [backend/prisma/schema.prisma](../backend/prisma/schema.prisma).

Verified details:

- Backend uses NestJS 11 and Prisma 6.
- `datasource db` is configured for PostgreSQL with `DATABASE_URL` and `DIRECT_URL`.
- The backend module and services are designed around a PostgreSQL/Prisma architecture with RBAC, permissions, visitor records, audits, and security operations.
- This backend is a separate runtime from the Next.js app and should not be treated as the same database layer as the SQLite app runtime.

### 3.4 Auth and RBAC

The repository implements role-based access and identity enforcement in multiple layers.

Verified files:

- [backend/src/auth/auth.service.ts](../backend/src/auth/auth.service.ts) contains token handling, password verification, and refresh-token logic.
- [backend/src/app.module.ts](../backend/src/app.module.ts) wires the backend modules.
- [lib/supabase.ts](../lib/supabase.ts) sets up the Supabase client with required environment validation and rejects missing env config explicitly.

From the project documentation and source, the app enforces identity and access on the server side rather than trusting browser state alone.

### 3.5 Visitor and security workflow coverage

The application already contains a broad set of features aligned with campus security operations:

- visitor pre-booking and ticket generation
- visitor status and pass flow
- admin authentication and dashboard shell
- gate/security desk scanning and verification flow
- reporting, incidents, vehicles, and guard management
- public and staff-specific access patterns

These behaviors are reflected in the existing app routes, shared layouts, and service layer design. The repository is not a blank slate; it is already a partially implemented enterprise application.

## 4. Verified integrations, environment concerns, and risk areas

### 4.1 Supabase

Supabase is present in the repo, but the repository documentation and runtime code indicate it is not the default operational database for the main app.

Confirmed by:

- [README.md](../README.md) explicitly states the active runtime is SQLite, and that Supabase migration files are a separate preparation layer.
- [lib/server/db.ts](../lib/server/db.ts) confirms the main app uses SQLite via `node:sqlite`.
- [supabase/migrations/0001_schema.sql](../supabase/migrations/0001_schema.sql) exists as migration SQL and not as the app’s active DB layer.

Risk: a team member could mistakenly assume Supabase is the active source of truth because it is present, but the actual runtime in the app is the SQLite database.

### 4.2 WhatsApp and notifications

The README notes the WhatsApp flow is configuration-dependent and intentionally fail-safe. The system is designed to simulate outbound messages unless explicit credentials and opt-in delivery flags are enabled.

This is valid as a development-safe pattern, but it should remain clearly documented so that production claims are not made prematurely.

### 4.3 Visitor photos and privacy

The project includes photo capture and storage patterns in the documentation, and the design is intended to protect visitor identity by storing files outside the public web root and exposing them only through a staff-authenticated route.

This is a positive design feature, but it should be validated in runtime behavior with tests before any major change that touches the photo flow.

### 4.4 Active work in progress

The repo currently contains modified tracked files and untracked additions already in progress. This is a high-signal clue that the project has active hypotheses and code under development. Safe continuation requires preserving the current changes and making only additive or minimal corrective changes.

## 5. Current project status

### 5.1 What is present and working

The repository already contains a meaningful campus security system:

- public visitor portal with home and booking entry points
- structured DSVV branding content
- admin login and role-based app shell
- defined backend module structure and Prisma schema
- SQLite-backed runtime for primary app data
- app-specific safety and notification concepts
- tests for email flow, migration safety, and visitor experience scenarios

### 5.2 What still needs to be done carefully

The repository is not yet in a clean, fully audited state for broad-scale rewrite or destructive consolidation. The largest remaining tasks are:

- write a complete project-level audit artifact
- reconcile frontend runtime, backend runtime, and database story across the repo
- validate the actual app behavior before changing business logic
- continue enhancements incrementally and without replacing current working flows
- preserve user-modified files and untracked work

## 6. Prioritized implementation plan

### Priority 1 — Protection and audit completion

1. Preserve current git work and avoid destructive commands.
2. Finalize this audit and keep a clear record of active runtime assumptions.
3. Confirm which database path is active for each feature before DB changes.

### Priority 2 — Runtime verification

1. Run the available project tests and validation scripts.
2. Verify the main app starts and public/visitor/admin flows continue to render.
3. Confirm that the SQLite path and Supabase-related files do not create false assumptions during development.

### Priority 3 — Safe incremental enhancement

1. Improve the public portal and visitor booking experience only where the existing flow already supports the feature.
2. Strengthen admin/security flows without replacing their current shell or core logic.
3. Add or correct validation and error-handling only in existing paths, not by re-architecting the app.

### Priority 4 — Backend alignment

1. Make backend changes only after confirming whether the feature belongs to the Next.js SQLite service or to the NestJS/PostgreSQL backend.
2. Keep Prisma migrations additive and safe.
3. Avoid broad DB refactors or destructive schema rewrites.

### Priority 5 — Hardening and documentation

1. Record environment requirements and runtime expectations explicitly.
2. Keep audit and security notes aligned with the actual app state.
3. Verify any new feature against the real route and database layer it uses.

## 7. Verified result status

### Verified

- Repository is active and already contains substantial work.
- The main app is a Next.js project with role-based surfaces and flows.
- The default runtime data layer is SQLite via `node:sqlite`, not Supabase.
- The backend is a distinct PostgreSQL/Prisma project.
- The user’s working tree contains active modifications and untracked files that must be preserved.

### Remaining blockers / honesty check

- There is still a dual-runtime model in the repo that can be confusing without careful source verification.
- The audit artifact is now being created to reduce that ambiguity.
- Broad-scale modernization or database convergence should not happen until the actual runtime boundaries are clearly understood.
- The repo has not yet been fully validated end-to-end in this checkpoint; validation must continue with the actual project scripts and route behavior.

## 8. Conclusion

The project is a substantial, partially implemented campus security management system rather than a blank app. The active runtime is SQLite for the main app, while the NestJS backend is a separate Prisma/PostgreSQL architecture. The app already contains meaningful visitor, admin, and security workflows. The correct path forward is controlled, incremental enhancement built on top of the existing system, with the audit and DB/runtime guardrails kept explicit to prevent destructive changes.
