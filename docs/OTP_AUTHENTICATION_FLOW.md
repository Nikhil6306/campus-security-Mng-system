# OTP Authentication Flow & Lifecycle Guide
## Project: DSVV Campus Security Management System (CSMS)

This document details the end-to-end lifecycle, security controls, and step-by-step state transitions for all One-Time Password (OTP) workflows in DSVV CSMS.

---

## 1. Workflows Covered

1. **Forgot Password with OTP Verification** (Applicable to all roles: `super_admin`, `admin`, `security`, `teacher`, `student`, `visitor`).
2. **Two-Step Email Change with Old & New Email Verification**.
3. **Signup Email Verification & Account Activation**.

---

## 2. Forgot Password Flowchart

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Any Role)
    participant UI as DSVV CSMS Client (Web/Mobile)
    participant API as /api/auth/send-otp
    participant OTP_Svc as OTP Service (lib/server/services/otp.ts)
    participant DB as Supabase / SQLite (auth_email_otps)
    participant EmailJS as EmailJS REST API
    participant VerifyAPI as /api/auth/reset-password

    User->>UI: Enters registered email and clicks "Send OTP"
    UI->>API: POST { email, purpose: "password_reset" }
    API->>OTP_Svc: createPasswordResetOtp(email)
    OTP_Svc->>DB: Check active OTP cooldown (< 60s)
    alt In Cooldown
        OTP_Svc-->>API: 429 Error (Please wait X seconds)
        API-->>UI: Displays cooldown message
    else Cooldown Cleared
        OTP_Svc->>DB: Invalidate previous active OTPs
        OTP_Svc->>OTP_Svc: Generate 6-digit cryptographic OTP & scrypt hash
        OTP_Svc->>DB: Store record (otp_hash, salt, expires_at: +5m, attempts: 0, max_attempts: 5)
        OTP_Svc->>EmailJS: POST /api/v1.0/email/send (template_otp_verify)
        API-->>UI: 200 OK (Generic success message)
        UI->>User: Displays 6-digit OTP input dialog with 5-minute countdown
    end

    User->>UI: Enters OTP and new password
    UI->>VerifyAPI: POST { email, otp, newPassword, confirmPassword }
    VerifyAPI->>OTP_Svc: verifyOtpCode(email, otp, "password_reset")
    alt OTP Expired (> 5 mins) or Attempts Exceeded (>= 5)
        VerifyAPI-->>UI: 401 / 429 Error
    else Invalid OTP
        OTP_Svc->>DB: Increment attempts (attempts + 1)
        VerifyAPI-->>UI: 401 Error (Remaining attempts shown)
    else Valid OTP
        OTP_Svc->>DB: Mark consumed (consumed_at = now)
        VerifyAPI->>DB: Update password in Supabase Auth & app_users
        VerifyAPI->>DB: Invalidate all existing user sessions
        VerifyAPI->>DB: Log security audit event
        VerifyAPI->>EmailJS: Send password reset confirmation email
        VerifyAPI-->>UI: 200 OK (Password reset successful)
        UI->>User: Redirects to Login screen
    end
```

---

## 3. Two-Step Email Change Flow

To ensure maximum security and avoid account takeover via hijacked sessions, email change requires **two sequential OTP verifications**:

```mermaid
sequenceDiagram
    autonumber
    actor User as Authenticated User
    participant UI as Settings / Profile Screen
    participant Step1 as /api/auth/change-email/request
    participant Step2 as /api/auth/change-email/verify-old
    participant Step3 as /api/auth/change-email/verify-new
    participant DB as pending_email_changes & auth_email_otps
    participant EmailJS as EmailJS REST API

    User->>UI: Inputs new email address
    UI->>Step1: POST { newEmail } (With session cookie/token)
    Step1->>DB: Verify user identity & check newEmail availability
    Step1->>DB: Create pending_email_changes record (expires in 15 mins)
    Step1->>EmailJS: Dispatch OTP to CURRENT (OLD) email address
    Step1-->>UI: 200 OK { requestId, oldEmailMasked }

    User->>UI: Enters OTP received on OLD email
    UI->>Step2: POST { requestId, otp }
    Step2->>DB: Verify OTP against old email
    Step2->>DB: Mark old_email_verified = TRUE
    Step2->>EmailJS: Dispatch confirmation OTP to NEW email address
    Step2-->>UI: 200 OK (Proceed to Step 2)

    User->>UI: Enters OTP received on NEW email
    UI->>Step3: POST { requestId, otp }
    Step3->>DB: Verify OTP against new email
    Step3->>DB: Mark new_email_verified = TRUE & status = "completed"
    Step3->>DB: Update email in Supabase Auth (admin.updateUserById) and profiles
    Step3->>DB: Log security audit event (email_change_completed)
    Step3->>EmailJS: Send notifications to BOTH old and new email addresses
    Step3-->>UI: 200 OK { success: true }
    UI->>User: Displays success confirmation
```

---

## 4. Key Security Rules & Boundaries

| Parameter | Specification | Purpose |
| :--- | :--- | :--- |
| **Length** | 6 numeric digits (`000000` to `999999`) | Optimal usability vs. entropy |
| **Expiry** | Exactly 5 minutes (`300 seconds`) | Minimizes exposure window |
| **Maximum Attempts** | 5 incorrect attempts | Thwarts brute-force attacks |
| **Resend Cooldown** | 60 seconds | Throttles abuse & flooding |
| **Storage** | `scrypt` hash with unique 16-byte salt | Plaintext never saved or logged |
| **Consumption** | Single-use (`consumed_at` timestamp) | Prevents replay attacks |
| **Enumeration Defense** | Uniform response on Forgot Password | Does not leak user existence |
