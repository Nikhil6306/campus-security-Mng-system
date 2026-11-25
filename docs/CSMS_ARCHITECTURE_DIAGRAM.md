# Campus Security Management System (CSMS) - System Architecture Diagram
**Dev Sanskriti Vishwavidyalaya (DSVV), Haridwar**

---

## 1. High-Level Enterprise 4-Tier Architecture

```mermaid
flowchart TD
    subgraph ClientTier["1. CLIENT TIER (User Interfaces)"]
        WebPublic["Public Visitor Portal\n(Next.js React 19)"]
        WebAdmin["Admin & Super-Admin Consoles\n(/admin, /administrator)"]
        WebTeacher["Faculty Dashboard\n(/teacher)"]
        WebStudent["Student Portal\n(/student)"]
        MobileGuard["Mobile Security Guard App\n(React Native / Expo SDK 57)"]
    end

    subgraph EdgeSecurity["2. EDGE SECURITY & MIDDLEWARE"]
        EdgeMiddleware["Next.js Edge Middleware\n(middleware.ts)\nRBAC Route Protection & Session Cookie Check"]
        SessionStore["HTTP-Only Cookie Manager\n(csms_session & csms_role)"]
    end

    subgraph ServerDomain["3. APPLICATION & DOMAIN SERVICE LAYER"]
        APIRoutes["Next.js App Router API Routes\n(/api/gate, /api/public, /api/auth)"]
        AuthService["Auth & RBAC Service\n(lib/server/auth.ts)"]
        GateService["Gate In/Out Engine\n(lib/server/services/gate.ts)"]
        BookingService["Booking & Slot Engine\n(lib/server/services/bookings.ts)"]
        OutpassService["Outpass & Student Gate\n(lib/server/services/outpass.ts)"]
        SOSService["SOS & Incident Engine\n(lib/server/services/sos.ts)"]
        EventBus["SSE Real-Time Event Hub\n(/api/events)"]
    end

    subgraph PersistenceTier["4. DUAL PERSISTENCE TIER"]
        LocalDB[("Primary Local SQLite\n(.data/campus-security.db)\nNode.js DatabaseSync (WAL Mode)")]
        CloudDB[("Cloud Supabase PostgreSQL 15\n(Row Level Security Enabled)")]
        PhotoStore[("Photo Storage\n(.data/visitor-photos & Supabase Bucket)")]
        SyncLayer["Database Sync Service\n(lib/server/supabase-db.ts)"]
    end

    subgraph ExternalGateways["5. EXTERNAL INTEGRATION GATEWAYS"]
        WhatsAppAPI["Meta WhatsApp Cloud API\n(Templates & Pass Delivery)"]
        ResendEmail["Resend Email API\n(Transactional Pass & OTP)"]
    end

    %% Client to Edge
    WebPublic --> EdgeMiddleware
    WebAdmin --> EdgeMiddleware
    WebTeacher --> EdgeMiddleware
    WebStudent --> EdgeMiddleware
    MobileGuard -->|REST Bearer JWT| APIRoutes

    EdgeMiddleware --> SessionStore
    EdgeMiddleware --> APIRoutes

    %% API to Services
    APIRoutes --> AuthService
    APIRoutes --> GateService
    APIRoutes --> BookingService
    APIRoutes --> OutpassService
    APIRoutes --> SOSService

    %% Services to Events & Real-time
    GateService --> EventBus
    SOSService --> EventBus
    EventBus -.->|Server-Sent Events| WebAdmin
    EventBus -.->|Server-Sent Events| WebTeacher

    %% Services to Persistence
    GateService --> LocalDB
    BookingService --> LocalDB
    OutpassService --> LocalDB
    SOSService --> LocalDB
    AuthService --> LocalDB

    %% Dual-Persistence Sync
    LocalDB <--> SyncLayer
    SyncLayer <--> CloudDB

    %% External Notifications
    BookingService --> WhatsAppAPI
    GateService --> WhatsAppAPI
    AuthService --> ResendEmail
    BookingService --> ResendEmail
    BookingService --> PhotoStore
```

---

## 2. Component Responsibility Matrix

| Component | Technology | Primary Function | Failure Mode / Resilience |
|---|---|---|---|
| **Public Portal** | Next.js 15, Tailwind, Radix UI | Pre-registration, visitor photo capture, pass download | Client-side validation; optimistic fallback |
| **Mobile Guard App** | React Native, Expo 57, Expo-Camera | Barcode scanner, manual reference search, Check-In/Out, SOS | Camera permission fallback to keyboard search |
| **Edge Middleware** | Next.js Edge Runtime (`middleware.ts`) | Route prefix checks, cross-role prevention | Strict 403 / redirect to dedicated login |
| **Local SQLite Engine** | Node.js `node:sqlite` (`DatabaseSync`) | Single-millisecond local reads/writes, zero gate latency | Write-Ahead Logging (WAL) mode |
| **Supabase Cloud DB** | PostgreSQL 15, PostgREST | Cloud backup, analytics, remote sync | Non-blocking secondary operations |
| **Communication Gateway** | Meta Cloud API & Resend | Pass delivery, meeting requests, OTP emails | Failsafe mock provider in development |
