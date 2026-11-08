# Campus Security Administrator User Manual
## System Administration & Operational Oversight Guide

**University:** Dev Sanskriti Vishwavidyalaya (DSVV), Haridwar  
**Portal URL:** `https://your-domain.edu/admin` (or `http://localhost:3000/admin` locally)  
**Authorized Roles:** `super_admin`, `admin`  

---

## 1. Access & Authentication

### 1.1 Secure Login
1. Navigate to `/admin` or `/admin/login`.
2. Enter your authorized administrator email (e.g. `nikhilshukla1200@gmail.com` or `admin@dsvv.edu.in`).
3. Enter your password and submit.
4. The system validates your session via Supabase Auth / Secure Session Tokens and redirects you to `/admin/dashboard`.

### 1.2 Password Reset
- If credentials need resetting, visit `/forgot-password`, enter the authorized administrator email, and follow the secure link sent via email.

---

## 2. Dashboard Overview & Key Performance Indicators (KPIs)

Upon signing in, the Administrator Dashboard provides real-time visibility into campus movements:
* **Total Visitors Today:** Aggregate count of all visitor passes scheduled or entered for the current date.
* **Currently on Campus (Inside):** Live occupancy metric showing visitors whose check-in is recorded without an exit timestamp.
* **Checked-Out Visitors:** Total departures processed through campus gates today.
* **Pending Approvals:** Real-time count of visitor requests awaiting faculty or department consent.
* **Live Activity Feed:** Chronological stream of gate check-ins, exits, and security alerts.

---

## 3. Visitor Management & Audit Logs

### 3.1 Searching and Filtering Records
1. Navigate to **Visitors** (`/admin/visitors`) or **Bookings** (`/admin/bookings`).
2. Filter records using:
   - **Date Range Picker:** Select single-day or multi-day audit windows.
   - **Status Filter:** All, Approved, Pending, Inside, Completed, Rejected, Expired.
   - **Department Filter:** Specific academic or administrative wings.
   - **Quick Search:** Instant lookup by Visitor Name, Mobile Number, or Pass ID (`B-xxx`).

### 3.2 Inspecting Visitor Profiles
Clicking any visitor entry opens their complete audit modal:
* High-resolution facial capture photograph.
* Contact number and masked Aadhaar reference.
* Vehicle registration plate and vehicle category.
* Purpose of visit and faculty host details.
* Gate movement timestamps: exact entry time, entry gate, processing guard, exit time, exit gate.

### 3.3 Exporting Official Reports (CSV & PDF)
1. In the top-right corner of the visitor registry, click **Export CSV** or **Print PDF Report**.
2. **Security Feature:** All CSV exports are automatically sanitized with formula neutralization (preventing spreadsheet injection via leading `=`, `+`, `-`, or `@`).
3. Printable PDF layouts format the data cleanly for administrative filing and compliance archiving.

---

## 4. Security Guard & Gate Management

### 4.1 Approving Guard Registrations
1. Navigate to **Guards** (`/admin/guards`).
2. Switch to the **Pending Registrations** tab.
3. Review applicants who registered via the mobile app or web portal.
4. Click **Approve**. The system:
   - Assigns a permanent guard identifier (`GRD-xxx`).
   - Upgrades their user role to `security`.
   - Activates their credentials for gate operation.

### 4.2 Shift Scheduling & Gate Assignment
1. Open the **Duty Schedules** tab or navigate to `/admin/guard-duty`.
2. Click **Assign Shift**.
3. Select the guard, duty station (Main Gate, Hostel Gate, VIP Gate), shift slot (Morning, Evening, Night), and date.
4. The assignment immediately reflects on the guard's mobile dashboard upon login.

---

## 5. Emergency Incident Management

When an emergency or SOS alert is triggered:
1. An audible alert sounds and an urgent red notification banner appears across the dashboard.
2. Navigate to **Incidents** (`/admin/incidents`).
3. Click on the active incident to inspect:
   - Originating gate or campus GPS coordinates.
   - Reporting officer details.
   - Incident type (Fire, Medical, Intrusion, Disturbance).
4. Assign quick response teams (QRT) and mark incident as **In Progress**.
5. Once resolved, enter resolution notes and mark as **Resolved**. All timestamps are immutably archived in the security audit trail.
