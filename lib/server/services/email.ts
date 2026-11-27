import "server-only";

const RESEND_API_URL = "https://api.resend.com/emails";
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CampusEmail {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export interface CampusEmailReceipt {
  id: string;
}

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be configured before sending email.`);
  }
  return value;
}

function validateAddress(address: string, field: string): void {
  if (!EMAIL_ADDRESS.test(address)) {
    throw new Error(`${field} must contain a valid email address.`);
  }
}

export async function sendCampusEmail(
  message: CampusEmail,
): Promise<CampusEmailReceipt> {
  const apiKey = requiredEnvironmentVariable("RESEND_API_KEY");
  const from = requiredEnvironmentVariable("RESEND_FROM_EMAIL");
  const recipients = Array.isArray(message.to) ? message.to : [message.to];

  validateAddress(from, "RESEND_FROM_EMAIL");
  if (!recipients.length) {
    throw new Error("At least one email recipient is required.");
  }
  recipients.forEach((recipient) => validateAddress(recipient, "Recipient"));
  if (!message.subject.trim() || /[\r\n]/.test(message.subject)) {
    throw new Error("Email subject must be non-empty and contain no line breaks.");
  }
  if (!message.html?.trim() && !message.text?.trim()) {
    throw new Error("Email must include HTML or plain-text content.");
  }
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.RESEND_ENABLE_DEVELOPMENT_DELIVERY !== "true"
  ) {
    throw new Error(
      "Resend delivery is disabled outside production. Set RESEND_ENABLE_DEVELOPMENT_DELIVERY=true only when live delivery is intended.",
    );
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: message.subject,
      ...(message.html ? { html: message.html } : {}),
      ...(message.text ? { text: message.text } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend rejected the email request (HTTP ${response.status}).`);
  }

  const result: unknown = await response.json();
  if (
    typeof result !== "object" ||
    result === null ||
    !("id" in result) ||
    typeof result.id !== "string" ||
    !result.id
  ) {
    throw new Error("Resend returned an invalid email receipt.");
  }

  return { id: result.id };
}

/* ------------------------------------------------------------------ *
 * Guard Account Notifications
 * ------------------------------------------------------------------ */

export interface GuardRegistrationSubmittedNotice {
  email: string;
  fullName: string;
  requestId: string;
}

export async function sendGuardRegistrationSubmittedEmail(
  notice: GuardRegistrationSubmittedNotice,
): Promise<CampusEmailReceipt | null> {
  const subject = `DSVV Campus Security - Guard Registration Submitted (${notice.requestId})`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
    .header { background-color: #0A192F; padding: 28px 24px; text-align: center; border-bottom: 3px solid #F59E0B; }
    .header h1 { color: #ffffff; font-size: 20px; margin: 0; letter-spacing: 0.5px; text-transform: uppercase; }
    .header p { color: #94A3B8; font-size: 13px; margin: 6px 0 0 0; }
    .body { padding: 28px 24px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .badge { display: inline-block; background-color: #FEF3C7; color: #92400E; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 700; margin-bottom: 16px; }
    .details { background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #EDF2F7; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #64748B; font-weight: 500; }
    .detail-val { color: #0F172A; font-weight: 600; text-align: right; }
    .message-box { background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 14px 16px; border-radius: 4px; font-size: 13px; color: #1E40AF; margin-top: 20px; line-height: 1.5; }
    .footer { background-color: #F8FAFC; padding: 20px 24px; text-align: center; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>DSVV Campus Security</h1>
      <p>Dev Sanskriti Vishwavidyalaya · Security Administration</p>
    </div>
    <div class="body">
      <div class="badge">⏳ Registration Awaiting Admin Approval</div>
      <div class="greeting">Dear ${notice.fullName},</div>
      <p>Your guard registration request has been submitted successfully. Your account is currently awaiting Admin approval. You will be able to access the Guard Dashboard after your request is approved.</p>
      
      <div class="details">
        <div class="detail-row"><span class="detail-label">Applicant Name:</span><span class="detail-val">${notice.fullName}</span></div>
        <div class="detail-row"><span class="detail-label">Reference ID:</span><span class="detail-val">${notice.requestId}</span></div>
        <div class="detail-row"><span class="detail-label">Registered Email:</span><span class="detail-val">${notice.email}</span></div>
        <div class="detail-row"><span class="detail-label">Current Status:</span><span class="detail-val" style="color: #D97706;">PENDING</span></div>
      </div>

      <div class="message-box">
        <strong>What happens next?</strong><br>
        The Chief Security Administrator will review your application and assign your duty post and shift. Once approved, you will receive an activation email and will be able to log in to the Guard Dashboard.
      </div>
    </div>
    <div class="footer">
      Dev Sanskriti Vishwavidyalaya, Shantikunj, Haridwar, Uttarakhand - 249411<br>
      Automated System Message · Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
`;

  try {
    return await sendCampusEmail({
      to: notice.email,
      subject,
      html,
      text: `Hello ${notice.fullName}, your guard registration request (ID: ${notice.requestId}) has been submitted successfully. Your account is currently awaiting Admin approval. You will be able to access the Guard Dashboard after your request is approved.`,
    });
  } catch (err) {
    console.warn(`[email] Guard registration submission email to ${notice.email} not dispatched (Resend not configured or dev mode):`, (err as Error).message);
    return null;
  }
}

export interface GuardApprovalNotice {
  email: string;
  fullName: string;
  guardId: string;
  assignedGate: string;
  designation: string;
}

export async function sendGuardApprovalEmail(
  notice: GuardApprovalNotice,
): Promise<CampusEmailReceipt | null> {
  const subject = "DSVV Campus Security - Account Approved & Activated";
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
    .header { background-color: #0A192F; padding: 28px 24px; text-align: center; border-bottom: 3px solid #F59E0B; }
    .header h1 { color: #ffffff; font-size: 20px; margin: 0; letter-spacing: 0.5px; text-transform: uppercase; }
    .header p { color: #94A3B8; font-size: 13px; margin: 6px 0 0 0; }
    .body { padding: 28px 24px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .badge { display: inline-block; background-color: #DCFCE7; color: #166534; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 700; margin-bottom: 16px; }
    .details { background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #EDF2F7; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #64748B; font-weight: 500; }
    .detail-val { color: #0F172A; font-weight: 600; text-align: right; }
    .instructions { background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 14px 16px; border-radius: 4px; font-size: 13px; color: #1E40AF; margin-top: 20px; line-height: 1.5; }
    .footer { background-color: #F8FAFC; padding: 20px 24px; text-align: center; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>DSVV Campus Security</h1>
      <p>Dev Sanskriti Vishwavidyalaya · Security Administration</p>
    </div>
    <div class="body">
      <div class="badge">✓ Account Approved & Active</div>
      <div class="greeting">Welcome Officer ${notice.fullName},</div>
      <p>Your security personnel registration request has been reviewed and <strong>approved</strong> by the Chief Security Administrator. Your account is now fully active.</p>
      
      <div class="details">
        <div class="detail-row"><span class="detail-label">Guard Name:</span><span class="detail-val">${notice.fullName}</span></div>
        <div class="detail-row"><span class="detail-label">Guard ID:</span><span class="detail-val">${notice.guardId}</span></div>
        <div class="detail-row"><span class="detail-label">Designation:</span><span class="detail-val">${notice.designation}</span></div>
        <div class="detail-row"><span class="detail-label">Assigned Post:</span><span class="detail-val">${notice.assignedGate}</span></div>
        <div class="detail-row"><span class="detail-label">Login Email:</span><span class="detail-val">${notice.email}</span></div>
      </div>

      <div class="instructions">
        <strong>Mobile App Sign In Instructions:</strong><br>
        1. Open the <strong>Security</strong> mobile app on your Android device.<br>
        2. Enter your registered email (<strong>${notice.email}</strong>) and password.<br>
        3. You will gain immediate access to the Guard Gate Dashboard, Visitor QR Scanner, and Check-In/Out controls.
      </div>
      
      <p style="font-size: 13px; color: #64748B; margin-top: 20px;">
        For duty assistance, shift adjustments, or technical support, contact the Security Control Room at <strong>security@dsvv.ac.in</strong> or extension <strong>01334-261367</strong>.
      </p>
    </div>
    <div class="footer">
      Dev Sanskriti Vishwavidyalaya, Shantikunj, Haridwar, Uttarakhand - 249411<br>
      Automated System Message · Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
`;

  try {
    return await sendCampusEmail({
      to: notice.email,
      subject,
      html,
      text: `Hello ${notice.fullName}, your DSVV Campus Security guard account has been approved. Guard ID: ${notice.guardId}, Gate: ${notice.assignedGate}. You may now log in to the Security app using your registered email (${notice.email}) and password.`,
    });
  } catch (err) {
    console.warn(`[email] Guard approval email to ${notice.email} not dispatched (Resend not configured or dev mode):`, (err as Error).message);
    return null;
  }
}

export interface GuardRejectionNotice {
  email: string;
  fullName: string;
  reason?: string;
}

export async function sendGuardRejectionEmail(
  notice: GuardRejectionNotice,
): Promise<CampusEmailReceipt | null> {
  const subject = "DSVV Campus Security - Registration Request Update";
  const reasonText = notice.reason?.trim() ? notice.reason.trim() : "Application criteria could not be verified.";
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
    .header { background-color: #0A192F; padding: 28px 24px; text-align: center; border-bottom: 3px solid #EF4444; }
    .header h1 { color: #ffffff; font-size: 20px; margin: 0; letter-spacing: 0.5px; text-transform: uppercase; }
    .header p { color: #94A3B8; font-size: 13px; margin: 6px 0 0 0; }
    .body { padding: 28px 24px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .badge { display: inline-block; background-color: #FEE2E2; color: #991B1B; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 700; margin-bottom: 16px; }
    .reason-box { background-color: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; color: #7F1D1D; }
    .footer { background-color: #F8FAFC; padding: 20px 24px; text-align: center; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>DSVV Campus Security</h1>
      <p>Dev Sanskriti Vishwavidyalaya · Security Administration</p>
    </div>
    <div class="body">
      <div class="badge">Registration Request Not Approved</div>
      <div class="greeting">Dear ${notice.fullName},</div>
      <p>Thank you for submitting a guard registration request for the DSVV Campus Security Management System.</p>
      <p>After administrative review, your registration request was not approved at this time.</p>
      
      <div class="reason-box">
        <strong>Administrative Remarks:</strong><br>
        ${reasonText}
      </div>

      <p style="font-size: 13px; color: #64748B;">
        If you believe this is in error or require further clarification, please contact the Security Office in person or email <strong>security@dsvv.ac.in</strong>.
      </p>
    </div>
    <div class="footer">
      Dev Sanskriti Vishwavidyalaya, Shantikunj, Haridwar, Uttarakhand - 249411<br>
      Automated System Message · Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
`;

  try {
    return await sendCampusEmail({
      to: notice.email,
      subject,
      html,
      text: `Hello ${notice.fullName}, your DSVV Campus Security registration request was not approved. Remarks: ${reasonText}. For questions, contact security@dsvv.ac.in.`,
    });
  } catch (err) {
    console.warn(`[email] Guard rejection email to ${notice.email} not dispatched (Resend not configured or dev mode):`, (err as Error).message);
    return null;
  }
}
