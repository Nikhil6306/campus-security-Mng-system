# Email & OTP Security Audit
## Project: DSVV Campus Security Management System (CSMS)

This document provides a security assessment and defense architecture review for the EmailJS and OTP subsystems.

---

## 1. Threat Modeling & Defensive Controls

### 1.1 Brute-Force & Guessing Attacks
- **Threat:** An attacker attempts to guess the 6-digit OTP across $1,000,000$ possible values.
- **Mitigation:**
  - Strict limit of **5 incorrect attempts** per OTP record.
  - On the 5th failed attempt, the OTP is invalidated immediately (`429 Too Many Requests`).
  - Strict **5-minute expiration** window.
  - Total chance of guessing a valid OTP within 5 attempts: $\frac{5}{1,000,000} = 0.0005\%$.

### 1.2 Rate Limiting & Resource Exhaustion (SMS/Email Flooding)
- **Threat:** An attacker triggers mass OTP requests to spam user inboxes or exhaust EmailJS quota.
- **Mitigation:**
  - **60-second cooldown** enforced per `(email, purpose)` combination.
  - Previous active OTPs for the same identity and purpose are invalidated before a new one is issued.
  - Client IP hashing and user-agent tracking logged in `account_security_logs`.

### 1.3 Account Enumeration via Forgot Password
- **Threat:** An attacker tests email addresses against the Forgot Password form to discover registered faculty, guard, or student accounts.
- **Mitigation:**
  - Uniform generic response returned regardless of whether the email exists:
    > *"If an account matches this email, password reset instructions and a verification code have been sent."*
  - Timing-safe processing ensures no observable timing side-channels disclose account presence.

### 1.4 Cryptographic Storage of Sensitive Tokens
- **Threat:** Database leakage exposing plaintext OTP codes.
- **Mitigation:**
  - OTPs are **never stored in plaintext**.
  - Passcodes are hashed using `scrypt` with a cryptographically random 16-byte salt:
    $$\text{Hash} = \text{scrypt}(\text{OTP}, \text{Salt}, N=16384, r=8, p=1, \text{len}=64)$$
  - Comparisons are executed using Node's `timingSafeEqual` constant-time buffer comparison to prevent timing attacks.

### 1.5 Account Takeover via Session Hijacking
- **Threat:** An attacker with a compromised session modifies the victim's email address to retain persistent access.
- **Mitigation:**
  - Two-step Change Email flow:
    1. First OTP is sent **exclusively to the existing registered email**.
    2. Second OTP is sent to the new email address to confirm deliverability.
  - Email cannot be updated without passing both validation gates.

---

## 2. Row Level Security (RLS) & Access Controls

- In Supabase, `auth_email_otps` and `pending_email_changes` have RLS enabled with `FOR ALL USING (false)`.
- Client-side anonymous and authenticated tokens have zero read/write access.
- All OTP verification operations are executed strictly server-side using the Supabase Service Role client or secure SQLite queries.
