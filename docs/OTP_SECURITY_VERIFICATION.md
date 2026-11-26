# OTP Security Verification
## DSVV Campus Security Management System (CSMS)

---

## 1. Cryptographic Security Standards

1. **Generation:**
   - Generated with Node.js `crypto.randomInt(100000, 999999)`.
   - Entropy: 6 decimal digits ($1,000,000$ combinations).
   - Uniform distribution without modulo bias.

2. **Storage:**
   - **Never stored in plain text.**
   - Hashed using `scrypt` ($N=16384, r=8, p=1, \text{keyLen}=64$).
   - Cryptographically random 16-byte hex salt generated per OTP record.

3. **Comparison:**
   - Constant-time verification using `crypto.timingSafeEqual` over buffers.
   - Eliminates timing side-channel attacks.

4. **Lifecycle Constraints:**
   - **TTL:** 5 minutes ($300$ seconds).
   - **Max Attempts:** 5 incorrect attempts before lockout.
   - **Cooldown:** 60 seconds per `(email, purpose)` combination.
   - **Single Use:** Atomic transition to `consumed_at = now`.
   - **Superseeded OTPs:** Any previous unconsumed OTP for the same email and purpose is invalidated immediately upon new request.

---

## 2. Multi-Role Verification Matrix

The OTP verification system was tested and confirmed operational across all 6 application roles:

| Role | Password Reset | Email Change | Login Alerts | Welcome Notification |
| :--- | :--- | :--- | :--- | :--- |
| `super_admin` | Verified | Verified | Verified | Verified |
| `admin` | Verified | Verified | Verified | Verified |
| `security` | Verified | Verified | Verified | Verified |
| `teacher` | Verified | Verified | Verified | Verified |
| `student` | Verified | Verified | Verified | Verified |
| `visitor` | Verified | Verified | Verified | Verified |
