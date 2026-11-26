# Email Notification System Documentation
## Project: DSVV Campus Security Management System (CSMS)

This document describes the notification triggers, recipient targeting, and audit storage architecture for the DSVV CSMS email notification system.

---

## 1. Notification Principles

1. **Targeted Delivery:** Notifications are dispatched directly to the **affected user's email address**. They are not broadcasted indiscriminately to all administrators unless an administrative escalation is explicitly required.
2. **Branding & Authenticity:** All communications adhere to DSVV institutional visual identity guidelines (Burgundy `#800000`, slate typography, 24/7 Security Desk signature).
3. **Indian Standard Time (IST):** All event timestamps are explicitly localized to Indian Standard Time (IST) with seconds precision for forensic clarity.
4. **Audit Trails:** Every outbound notification is recorded in the `email_notifications` table with status (`pending`, `delivered`, `failed`, `simulated`), provider ID, and timestamp.

---

## 2. Notification Triggers Matrix

| Event Category | Trigger Event | Template Used | Recipient | Content Summary |
| :--- | :--- | :--- | :--- | :--- |
| **Account Lifecycle** | New account created | `template_welcome` | Registered user | Welcome message, assigned role, portal access link. |
| **Account Lifecycle** | Account verified via OTP | `template_general_notification` | Registered user | Notice that account verification succeeded. |
| **Session & Auth** | Successful login | `template_security_alert` | Authenticated user | Device/browser string, IP hash, IST login time. |
| **Account Security** | Password changed | `template_security_alert` | Account owner | Immediate alert with device details and contact guidance. |
| **Account Security** | Password reset completed | `template_security_alert` | Account owner | Notice that password was reset via OTP verification. |
| **Account Security** | Email change requested | `template_otp_verify` | Current (old) email | 6-digit authorization OTP. |
| **Account Security** | Email change confirmed | `template_general_notification` | Old & New emails | Dual-dispatch confirmation of email update. |
| **Account Security** | Role / Permissions updated | `template_security_alert` | Affected user | Notification of modified campus clearance / role. |
| **Account Security** | Account suspended / deactivated | `template_security_alert` | Affected user | Security alert notifying account access suspension. |

---

## 3. Storage Schema (`email_notifications`)

```sql
CREATE TABLE email_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    recipient_email TEXT NOT NULL,
    template_type TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'failed', 'simulated')),
    provider TEXT NOT NULL DEFAULT 'emailjs',
    provider_message_id TEXT,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
