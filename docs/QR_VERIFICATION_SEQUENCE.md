# Visitor QR Pass Generation & Gate Verification Sequence
**Dev Sanskriti Vishwavidyalaya (DSVV), Haridwar**

---

## 1. End-to-End Sequence Diagram

The following sequence diagram details the full lifecycle: from visitor pre-registration and host approval to QR token generation, gate scanning, validation, and physical check-in/check-out.

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as Visitor
    actor Host as Faculty / Host
    actor Guard as Security Guard
    participant Web as Web / Mobile Frontend
    participant API as Next.js API Routes
    participant BookingSvc as Booking Service
    participant GateSvc as Gate Operations Service
    participant DB as SQLite Local Database
    participant Cloud as Supabase PostgreSQL
    participant Gateway as WhatsApp / Email Gateway

    %% Phase 1: Pre-Registration
    rect rgb(240, 248, 255)
        Note over Visitor, Gateway: PHASE 1: VISITOR PRE-REGISTRATION & PASS ISSUANCE
        Visitor->>Web: Submits Visit Request (Details, Photo, Time Slot)
        Web->>API: POST /api/public/bookings
        API->>BookingSvc: createBooking(payload)
        BookingSvc->>DB: INSERT INTO visit_requests (status = 'Pending', pass_token = randomToken(24))
        BookingSvc->>Cloud: persistToSupabase('visit_requests')
        BookingSvc->>Gateway: Notify Host via WhatsApp (Action link)
        API-->>Web: Booking Reference (e.g. DSVV-VIS-2026-000124)
    end

    %% Phase 2: Host Approval
    rect rgb(245, 255, 250)
        Note over Host, Gateway: PHASE 2: HOST APPROVAL & DIGITAL PASS DISPATCH
        Host->>Web: Clicks "Approve" on Teacher Dashboard
        Web->>API: POST /api/faculty/decision
        API->>BookingSvc: approveBooking(bookingId)
        BookingSvc->>DB: UPDATE visit_requests SET status = 'Approved', decided_at = NOW()
        BookingSvc->>Cloud: persistToSupabase('visit_requests', status = 'Approved')
        BookingSvc->>Gateway: Send WhatsApp Pass link with embedded QR code
        Gateway-->>Visitor: Digital Pass delivered to WhatsApp
    end

    %% Phase 3: Gate Arrival & QR Scan
    rect rgb(255, 250, 240)
        Note over Guard, GateSvc: PHASE 3: GATE SCAN & VERIFICATION
        Visitor->>Guard: Presents QR Pass on Smartphone
        Guard->>Web: Scans QR code using Expo Camera / Scanner
        Web->>API: POST /api/gate/verify { token: "..." }
        API->>GateSvc: verifyPass(input)
        GateSvc->>DB: SELECT * FROM visit_requests WHERE pass_token = ?
        DB-->>GateSvc: Returns Booking Row

        critical Rule Checks
            GateSvc->>GateSvc: 1. Status is 'Approved'?
            GateSvc->>GateSvc: 2. Current Time within 07:00 - 20:00?
            GateSvc->>GateSvc: 3. Visit Date matches todayInCampusTz()?
            GateSvc->>GateSvc: 4. Pass has not expired?
        end

        GateSvc-->>API: Result { ok: true, nextAction: 'check-in', booking }
        API-->>Web: Displays Visitor Card, Photo, and "Check In" Button
    end

    %% Phase 4: Gate Check-In Execution
    rect rgb(240, 255, 240)
        Note over Guard, Gateway: PHASE 4: CHECK-IN EXECUTION & SURVEILLANCE LOGGING
        Guard->>Web: Clicks "Admit / Check In"
        Web->>API: POST /api/gate/check-in { bookingId, gate }
        API->>GateSvc: checkIn(bookingId, gate, actor)

        critical Atomic SQLite Transaction
            GateSvc->>DB: UPDATE visit_requests SET status = 'Checked In', check_in_at = NOW()
            GateSvc->>DB: INSERT INTO check_logs (direction = 'In', gate, guard_name)
            GateSvc->>DB: INSERT INTO movements (person_type = 'Visitor', direction = 'Entry')
            opt Vehicle Declared
                GateSvc->>DB: INSERT INTO vehicles (status = 'Inside', entry_time = NOW())
            end
        end

        GateSvc->>Cloud: persistToSupabase('visit_requests', status = 'Checked In')
        GateSvc->>Gateway: Send WhatsApp Check-In Confirmation
        GateSvc-->>API: GateResult { booking, guardName, gate }
        API-->>Web: Shows "Visitor Successfully Admitted"
    end

    %% Phase 5: Check-Out Execution
    rect rgb(255, 245, 245)
        Note over Guard, DB: PHASE 5: CAMPUS EXIT & PASS CLOSURE
        Visitor->>Guard: Exits Gate at departure time
        Guard->>Web: Scans QR Pass again
        Web->>API: POST /api/gate/verify
        GateSvc->>DB: Detects status is 'Checked In' -> Returns nextAction: 'check-out'
        Guard->>Web: Clicks "Check Out"
        Web->>API: POST /api/gate/check-out
        GateSvc->>DB: UPDATE visit_requests SET status = 'Checked Out', check_out_at = NOW()
        GateSvc->>DB: INSERT INTO check_logs (direction = 'Out')
        opt Vehicle Linked
            GateSvc->>DB: UPDATE vehicles SET status = 'Exited', exit_time = NOW()
        end
        GateSvc->>Cloud: persistToSupabase('visit_requests', status = 'Checked Out')
        API-->>Web: Confirmation: Pass closed
    end
```

---

## 2. Gate Verification Rules Engine (State Decision Logic)

| Input State | Condition | Evaluated Result | Action Prompted |
|---|---|---|---|
| Status = `Pending` | Awaiting faculty approval | `ok: false, code: "not_approved"` | Reject Entry |
| Status = `Approved` | Date is today, within 07:00–20:00 | `ok: true, issues: []` | **Check-In (`nextAction: 'check-in'`)** |
| Status = `Approved` | Date > today (Future) | `ok: false, code: "too_early"` | Reject Entry |
| Status = `Approved` | Date < today (Past) | `ok: false, code: "date_passed"` | Reject Entry |
| Status = `Approved` | Time outside 07:00–20:00 | `ok: false, code: "outside_hours"` | Reject Entry |
| Status = `Checked In` | Visitor currently on campus | `ok: true, issues: []` | **Check-Out (`nextAction: 'check-out'`)** |
| Status = `Checked Out` | Pass already closed | `ok: false, code: "used"` | Reject Entry |
| Status = `Rejected` | Cancelled or Denied | `ok: false, code: "rejected"` | Reject Entry |
