# Campus Security Management System — Architecture & Audit Document

## 1. Executive Summary
This document provides an architectural audit of the existing Campus Security Management System for Dev Sanskriti Vishwavidyalaya (DSVV), Haridwar, and details the enterprise NestJS backend migration architecture.

---

## 2. Audit of Existing System

### 2.1 Technology Stack & Structure
- **Frontend Framework**: Next.js 15 (React 19, TypeScript, App Router).
- **Styling**: Tailwind CSS, Radix UI primitives, Lucide icons, Sonner toast system.
- **Visual Identity**: DSVV branding (Deep Navy `#002147`, Saffron `#e65100`, crisp white backgrounds).
- **Current Data Layer**: Dual mode — SQLite (`.data/campus-security.db` via `node:sqlite`) and Supabase PostgreSQL schema (`supabase/migrations/`).
- **Existing Services**: WhatsApp notification service (Meta Cloud API / mock), Aadhaar AES-256-GCM encryption at rest, local visitor photo store.

### 2.2 Core Workflows Audited
1. **Visitor Booking Flow (`/visit`)**:
   - Step 1: Visitor Identity & Basic Information (Name, Mobile, Email, ID Type/Number, Org).
   - Step 2: Visit Details (Department selection, Faculty/Host dropdown, Date/Time, Duration, Purpose, Visitor count, Vehicle details).
   - Step 3: Photo Capture (Live webcam / file upload).
   - Step 4: Verification & Pass Generation (Digital QR Pass + WhatsApp confirmation).
2. **Admin Dashboard (`/admin`)**:
   - Overview metrics: Today's visits, Active on campus, Pending approvals, Security incidents.
   - Tabbed management: Visitors, Approvals, Gates, Security Guards, Incidents, Vehicles, Outings, Reports, Audit Logs, Settings.
3. **Security Gate Flow (`/security`)**:
   - Scanner tab: Real-time QR pass scanning & verification.
   - Check-in / Check-out execution with guard & gate tracking.
   - Vehicle log monitoring & manual gate check-in/check-out.
4. **Faculty Portal (`/teacher`)**:
   - Visit request approvals/rejections, meeting scheduling, host availability controls.
5. **Student Outing Portal (`/student`)**:
   - Outing request submission and status tracking.

---

## 3. Target NestJS Enterprise Backend Architecture

### 3.1 Stack Specification
- **Framework**: NestJS 10+ (Modular, SOLID, Dependency Injection).
- **Database**: PostgreSQL 15+.
- **ORM**: Prisma 6+.
- **Cache**: Redis (`ioredis` / NestJS CacheModule).
- **Queues / Background Jobs**: BullMQ + Redis.
- **Realtime Communication**: Socket.IO WebSockets (`@nestjs/platform-socket.io`).
- **Authentication**: JWT Access Token (15 min) + Refresh Token (7 days, Argon2 hashed in DB, rotation on use).
- **Authorization**: RBAC (Roles: `SUPER_ADMIN`, `ADMIN`, `SECURITY_ADMIN`, `SECURITY_OFFICER`, `GATE_GUARD`, `RECEPTION`, `FACULTY`, `STAFF`, `STUDENT`, `VISITOR`) + Fine-grained Permissions.
- **File Storage**: S3-compatible Object Storage Abstraction (`StorageService` supporting AWS S3, MinIO, Cloudflare R2).
- **API Documentation**: Swagger / OpenAPI (`/api/docs`).
- **Security Middleware**: Helmet, Strict CORS, Throttler / Rate limiting, Class Validator DTOs, Audit Logging interceptor.

### 3.2 Database Schema Entity Relationship
- `User` ↔ `Role` ↔ `Permission` (RBAC)
- `RefreshToken` & `Session`
- `Visitor` ↔ `VisitorRequest` ↔ `Appointment` ↔ `QrPass`
- `Department` ↔ `Faculty` ↔ `VisitorRequest`
- `Campus` ↔ `Building` ↔ `Gate` ↔ `GateEntry` / `GateExit`
- `Vehicle` ↔ `VehicleEntry`
- `SecurityGuard` ↔ `GuardShift`
- `SecurityIncident` ↔ `IncidentComment`
- `Notification`, `AuditLog`, `SystemSetting`

---

## 4. API Specification Endpoint Prefix
All REST APIs follow `/api/v1/...` naming standards with consistent JSON responses:
```json
{
  "success": true,
  "data": { ... }
}
```
Error format:
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Detailed safe error message"
  }
}
```
