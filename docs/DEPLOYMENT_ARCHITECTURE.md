# Campus Security Management System (CSMS)
## Enterprise Deployment & Infrastructure Architecture

**Production Web URL:** `https://campus-security-management.vercel.app`  
**Cloud Hosting Provider:** Vercel Global Edge Network (Next.js 15 Serverless)  
**Database Host:** Supabase Cloud PostgreSQL 15 (`aws-0-ap-south-1.pooler.supabase.com`)  
**Mobile Build Pipeline:** Expo Application Services (EAS Build)  

---

### 1. Infrastructure Deployment Topology

```mermaid
graph TD
    subgraph VercelEdge ["Vercel Production Platform"]
        Domain["https://campus-security-management.vercel.app"]
        EdgeCDN["Vercel Global CDN (Static Assets & Pages)"]
        Serverless["Serverless Function Compute (Node.js 24)"]
        EdgeEnv["Production Environment Variables"]
    end

    subgraph SupabasePlatform ["Supabase Cloud Platform (AWS ap-south-1 Mumbai)"]
        Pooler["Supavisor Connection Pooler (Port 6543 - Transaction Mode)"]
        DirectDB["PostgreSQL 15 Database (Port 5432 - Direct)"]
        StorageEngine["Supabase Storage Service (Private S3 Bucket)"]
        AuthService["Supabase GoTrue Auth Service"]
        RealtimeEngine["Supabase Realtime Engine (Elixir WebSockets)"]
    end

    subgraph EASCloud ["Expo Application Services (EAS)"]
        EASCLI["EAS CLI Build Runner"]
        LinuxWorker["EAS Linux Build Worker (NDK r26b, OpenJDK 17)"]
        APKArtifact["Production Signed APK (com.dsvv.campussecurity.apk)"]
    end

    subgraph TargetDevices ["Physical Hardware Deployment"]
        DeskPC["Gate Security Desk PC (Chrome/Edge Browser)"]
        AdminLaptop["Admin Office Laptop"]
        GuardPhone["Physical Android Smartphone (Sideloaded APK)"]
    end

    Domain --> EdgeCDN
    Domain --> Serverless
    Serverless --> EdgeEnv

    Serverless -->|Transaction Pooling| Pooler
    Pooler --> DirectDB
    Serverless --> StorageEngine
    Serverless --> AuthService

    DirectDB --> RealtimeEngine
    RealtimeEngine -.->|WSS| GuardPhone
    RealtimeEngine -.->|WSS| DeskPC

    DeskPC --> Domain
    AdminLaptop --> Domain
    GuardPhone -->|HTTPS REST| Domain

    EASCLI --> LinuxWorker
    LinuxWorker --> APKArtifact
    APKArtifact -->|Sideload / adb install| GuardPhone
```

---

### 2. Environment Configuration Matrix

#### 2.1 Vercel Production Environment Variables (Mandatory)

| Variable Name | Environment | Sample / Description | Confidentiality |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Production | `https://campus-security-management.vercel.app` | Public |
| `DATABASE_DRIVER` | Production | `postgres` | Server-Only |
| `SUPABASE_DB_URL` | Production | `postgresql://postgres.qpamgfhggxwctoibmsbl:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres` | **Secret** (Contains DB Password) |
| `NEXT_PUBLIC_SUPABASE_URL` | Production | `https://qpamgfhggxwctoibmsbl.supabase.co` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | **Secret** (Bypasses RLS) |
| `AADHAAR_ENCRYPTION_KEY` | Production | 32-byte Base64 String (`openssl rand -base64 32`) | **Critical Secret** |
| `WHATSAPP_PROVIDER` | Production | `meta` | Server-Only |
| `WHATSAPP_ACCESS_TOKEN` | Production | System User Permanent Token | **Secret** |
| `WHATSAPP_PHONE_NUMBER_ID` | Production | Meta WhatsApp Phone Number ID | Server-Only |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Production | Alphanumeric secret matching webhook configuration | **Secret** |
| `RESEND_API_KEY` | Production | `re_xxxxxxxxxxxx` | **Secret** |

> [!IMPORTANT]
> **Why port 6543 (Pooler) is required on Vercel:**  
> Next.js route handlers run as ephemeral serverless instances. Direct connections (port 5432) will quickly exceed Supabase's connection limit during concurrent visitor traffic. Connecting via Supavisor pooler (port 6543 in transaction mode) allows thousands of serverless requests to share a stable pool of 10-15 PostgreSQL connections.

#### 2.2 Mobile Environment Variables (`mobile/.env` & `eas.json`)

| Variable Name | Scope | Production Value | Description |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | Client / Bundled | `https://campus-security-management.vercel.app` | Pointed to production Vercel gateway. Never uses `localhost` in release builds. |

---

### 3. Mobile APK Build Pipeline (Expo EAS Build)

Because local Windows Gradle builds fail due to native socket permissions in virtualized terminals, CSMS utilizes **Expo Application Services (EAS Build)**:

#### Build Profile (`mobile/eas.json`)
```json
{
  "cli": {
    "version": ">= 15.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "production": {
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://campus-security-management.vercel.app"
      }
    }
  }
}
```

#### Exact Cloud Build Sequence:
```powershell
# 1. Install EAS CLI globally (once)
npm install -g eas-cli

# 2. Authenticate with Expo account
eas login

# 3. Navigate to mobile workspace
cd "c:\Users\DELL\campus security mangement system\mobile"

# 4. Initialize cloud project link (generates projectId in app.json)
eas init

# 5. Trigger cloud release APK build
eas build --profile production --platform android
```

#### Physical Device Installation:
- Once complete, EAS CLI outputs a direct artifact download URL (e.g. `https://expo.dev/artifacts/eas/xxxx.apk`).
- Download the `.apk` file and install on an Android smartphone:
  ```powershell
  adb install -r campus-security-guard.apk
  ```
- Or copy to phone storage and install directly (enable *Allow unknown apps* in Android settings).

---

### 4. Health Checks, Monitoring & Rollback Strategy

1. **Vercel Instant Rollback:** If a deployment introduces a regression, Vercel allows one-click instant rollback to any prior immutable deployment without recompilation.
2. **Database Schema Reversibility:** All 19 migrations contain corresponding down-migration commands or additive schema changes (`ADD COLUMN IF NOT EXISTS`) preventing data loss.
3. **Health Check Endpoint:** `GET /api/auth/session` serves as the primary health probe. HTTP `200` confirms server, environment, and database connectivity are operational.

