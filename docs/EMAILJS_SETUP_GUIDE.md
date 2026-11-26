# EmailJS Setup Guide for DSVV Campus Security Management System (CSMS)

This guide provides complete instructions for configuring [EmailJS](https://www.emailjs.com/) as the primary transactional email delivery service for the DSVV Campus Security Management System.

---

## 1. Overview & Architecture

DSVV CSMS utilizes EmailJS via secure **server-side REST API requests** (`https://api.emailjs.com/api/v1.0/email/send`).
- **Zero Client Exposure:** Neither the `EMAILJS_PRIVATE_KEY` nor internal template IDs are exposed to browser bundles or mobile clients.
- **Dual Fallback:** If EmailJS credentials are not populated or the service is temporarily degraded, the system gracefully falls back to Resend or the development simulator.

---

## 2. EmailJS Dashboard Setup

### Step 1: Create an EmailJS Account
1. Visit [EmailJS Sign Up](https://dashboard.emailjs.com/sign-up) and register.
2. Navigate to **Account > API Keys**.
3. Note your:
   - **Public Key** (Account ID)
   - **Private Key** (Access Token) — *Critical for server-side authorization*.

### Step 2: Add an Email Service
1. Navigate to **Email Services** in the EmailJS dashboard.
2. Click **Add New Service** and select your provider (e.g., **Gmail**, **Outlook 365**, or **Custom SMTP** with DSVV campus mail server `smtp.dsvv.ac.in`).
3. Connect the email account:
   - Service ID: `service_dsvv_csms` (or name of your choice).
   - Display Name: `DSVV Campus Security Desk`.
4. Click **Create Service**.

---

## 3. EmailJS Templates Configuration

Create the following 4 templates in the EmailJS dashboard.

### Template 1: OTP Verification (`template_otp_verify`)
- **Subject:** `{{subject}}` (or `[{{app_name}}] Verification Code: {{passcode}}`)
- **To Email:** `{{to_email}}`
- **From Name:** `DSVV Security Administration`
- **HTML Content:**
```html
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
  <div style="text-align: center; border-bottom: 2px solid #800000; padding-bottom: 16px; margin-bottom: 24px;">
    <h2 style="color: #800000; margin: 0; font-size: 22px;">Dev Sanskriti Vishwavidyalaya</h2>
    <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Campus Security Management System (CSMS)</p>
  </div>

  <p style="color: #1e293b; font-size: 16px; margin-bottom: 8px;">Respected <strong>{{to_name}}</strong>,</p>
  <p style="color: #475569; font-size: 14px; line-height: 1.6;">
    You have initiated a request for <strong>{{purpose_description}}</strong>. Please use the verification passcode below to complete this action:
  </p>

  <div style="text-align: center; margin: 28px 0; background: #fff5f5; border: 2px dashed #800000; border-radius: 8px; padding: 18px;">
    <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #800000;">{{passcode}}</span>
    <p style="color: #991b1b; font-size: 12px; margin: 8px 0 0 0;">Valid for <strong>{{expiry_minutes}} minutes</strong>. Single-use only.</p>
  </div>

  <div style="background-color: #f8fafc; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
    <div><strong>Requested At:</strong> {{timestamp_ist}}</div>
    <div><strong>Security Notice:</strong> If you did not make this request, please contact the DSVV Security IT Desk immediately. Never share this code with anyone.</div>
  </div>

  <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
    © Dev Sanskriti Vishwavidyalaya • Shantikunj, Haridwar • 24/7 Security Operations
  </div>
</div>
```

---

### Template 2: Security Alert (`template_security_alert`)
- **Subject:** `[DSVV CSMS Security Alert] {{alert_title}}`
- **To Email:** `{{to_email}}`
- **Variables Used:** `to_name`, `alert_title`, `alert_details`, `device_info`, `timestamp_ist`, `app_name`, `action_required`

---

### Template 3: Account Welcome (`template_welcome`)
- **Subject:** `Welcome to DSVV Campus Security Management System`
- **To Email:** `{{to_email}}`
- **Variables Used:** `to_name`, `role_name`, `action_url`, `timestamp_ist`, `app_name`

---

### Template 4: General Notification (`template_notification`)
- **Subject:** `{{subject}}`
- **To Email:** `{{to_email}}`
- **Variables Used:** `to_name`, `message_body`, `timestamp_ist`, `app_name`

---

## 4. Parameter Mapping Matrix

| Variable Name | Description | Example |
| :--- | :--- | :--- |
| `to_email` | Recipient email address | `guard@dsvv.ac.in` |
| `to_name` | Recipient full name | `Ramesh Chandra Sharma` |
| `passcode` | 6-digit numeric OTP | `582914` |
| `purpose_description` | Action description | `Password Recovery Verification` |
| `expiry_minutes` | Validity period | `5` |
| `timestamp_ist` | Event timestamp in Indian Standard Time | `26 Mar 2026, 03:30:15 pm IST` |
| `app_name` | Official portal name | `DSVV Campus Security Management System` |
| `alert_title` | Security event header | `Password Reset Completed` |
| `alert_details` | Contextual alert information | `Your password was successfully updated.` |
| `device_info` | Client browser & platform | `Chrome 122 on Windows 11` |

---

## 5. Environment Variables Configuration

Add the following variables to `.env.local` (and your production hosting environment, e.g., Vercel / Railway / Docker):

```env
# ==============================================================================
# EMAILJS TRANSACTIONAL EMAIL SERVICE CONFIGURATION
# ==============================================================================
EMAILJS_SERVICE_ID=service_dsvv_csms
EMAILJS_PUBLIC_KEY=your_emailjs_public_key
EMAILJS_PRIVATE_KEY=your_emailjs_private_key_secret

# EmailJS Template IDs
EMAILJS_OTP_TEMPLATE_ID=template_otp_verify
EMAILJS_WELCOME_TEMPLATE_ID=template_welcome
EMAILJS_SECURITY_ALERT_TEMPLATE_ID=template_security_alert
EMAILJS_NOTIFICATION_TEMPLATE_ID=template_notification

# OTP Security Parameters (Default: 5 mins, 5 attempts, 60s cooldown)
OTP_EXPIRY_MINUTES=5
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60
```
