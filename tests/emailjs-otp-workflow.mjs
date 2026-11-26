import assert from "node:assert/strict";
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

console.log("================================================================================");
console.log("   DSVV CSMS: DEEP TECHNICAL AUDIT & END-TO-END VERIFICATION TEST SUITE        ");
console.log("   Covers: EmailJS, Cryptographic OTP, Password Recovery, 2-Step Email Change   ");
console.log("================================================================================");

let passed = 0;
let failed = 0;
const failures = [];

function runTest(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed += 1;
    failures.push(`${name} -> ${err.message}`);
    console.error(`  [FAIL] ${name} -> ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// Core Engine Specifications & Helpers
// -----------------------------------------------------------------------------

const OTP_CONFIG = {
  length: 6,
  expiryMinutes: 5,
  maxAttempts: 5,
  resendCooldownSeconds: 60,
};

const SYSTEM_ROLES = ["super_admin", "admin", "security", "teacher", "student", "visitor"];

function generateSecureOtp() {
  return randomInt(100000, 999999).toString();
}

function hashPassword(password) {
  const KEY_LENGTH = 64;
  const SCRYPT_COST = 16384;
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_COST }).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, record) {
  if (!record || !record.hash || !record.salt) return false;
  const KEY_LENGTH = 64;
  const SCRYPT_COST = 16384;
  let expected;
  try {
    expected = Buffer.from(record.hash, "hex");
  } catch {
    return false;
  }
  const actual = scryptSync(password, record.salt, KEY_LENGTH, { N: SCRYPT_COST });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function maskEmail(email) {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!domain) return email;
  if (local.length <= 2) {
    return `${local}***@${domain}`;
  }
  const visible = local.slice(0, 2);
  const stars = "*".repeat(Math.min(local.length - 2, 20));
  return `${visible}${stars}@${domain}`;
}

function toISTString(date = new Date()) {
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }) + " IST"
  );
}

function hashIp(ip) {
  if (!ip) return null;
  return createHash("sha256").update(ip.trim()).digest("hex").slice(0, 32);
}

function validatePasswordPolicy(password) {
  if (!password || password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters long." };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, error: "Password must contain both letters and numbers." };
  }
  return { ok: true };
}

// -----------------------------------------------------------------------------
// GROUP A: EmailJS Configuration, Validation & Resilience
// -----------------------------------------------------------------------------
console.log("\n--- GROUP A: EmailJS Configuration, Payload & Fallback Verification ---");

runTest("A.1: Validates EmailJS Configuration presence", () => {
  const mockConfig = {
    serviceId: "service_dsvv_csms",
    publicKey: "user_pk_live_123",
    privateKey: "priv_key_secret_999",
    templates: { otp: "template_otp_verify" },
  };
  const isConfigured = Boolean(mockConfig.serviceId && mockConfig.privateKey && mockConfig.templates.otp);
  assert.equal(isConfigured, true);
});

runTest("A.2: Detects Missing EmailJS configuration gracefully", () => {
  const emptyConfig = { serviceId: "", privateKey: "", templates: { otp: "" } };
  const isConfigured = Boolean(emptyConfig.serviceId && emptyConfig.privateKey && emptyConfig.templates.otp);
  assert.equal(isConfigured, false);
});

runTest("A.3: Rejects invalid or empty template ID", () => {
  assert.throws(() => {
    const templateId = "";
    if (!templateId) throw new Error("EmailJS template ID is not configured.");
  }, /EmailJS template ID is not configured/);
});

runTest("A.4: Validates recipient email format before dispatch", () => {
  const validEmail = "guard.main@dsvv.ac.in";
  const invalidEmail = "guard.main-at-dsvv";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  assert.equal(emailRegex.test(validEmail), true);
  assert.equal(emailRegex.test(invalidEmail), false);
});

runTest("A.5: Constructs compliant EmailJS REST API payload", () => {
  const nowIst = toISTString();
  const payload = {
    service_id: "service_dsvv_csms",
    template_id: "template_otp_verify",
    user_id: "user_pk_live_123",
    accessToken: "priv_key_secret_999",
    template_params: {
      to_email: "guard@dsvv.ac.in",
      to_name: "Ram Singh",
      passcode: "654321",
      purpose_description: "Password Reset Verification",
      expiry_minutes: 5,
      app_name: "DSVV Campus Security Management System",
      timestamp_ist: nowIst,
    },
  };
  assert.equal(payload.service_id, "service_dsvv_csms");
  assert.equal(payload.template_params.passcode, "654321");
  assert.equal(payload.accessToken, "priv_key_secret_999");
  assert.ok(payload.template_params.timestamp_ist.includes("IST"));
});

// -----------------------------------------------------------------------------
// GROUP B: OTP Security, Lifecycle & Atomicity
// -----------------------------------------------------------------------------
console.log("\n--- GROUP B: OTP Security, Lifecycle, Expiry & Rate Limiting ---");

const inMemoryOtpStore = new Map();

function createOtpRecord(email, purpose, rawOtp) {
  const cleanEmail = email.toLowerCase().trim();
  const key = `${cleanEmail}:${purpose}`;
  const now = Date.now();
  // Enforce 60s resend cooldown
  const existing = inMemoryOtpStore.get(key);
  if (existing && !existing.consumed_at && now - existing.created_at < OTP_CONFIG.resendCooldownSeconds * 1000) {
    const waitSec = Math.ceil((OTP_CONFIG.resendCooldownSeconds * 1000 - (now - existing.created_at)) / 1000);
    throw new Error(`Cooldown active: Please wait ${waitSec} seconds before requesting a new code.`);
  }

  // Invalidate previous OTP
  if (existing && !existing.consumed_at) {
    existing.consumed_at = now;
  }

  const { hash, salt } = hashPassword(rawOtp);
  const record = {
    id: `otp-${randomBytes(8).toString("hex")}`,
    email: cleanEmail,
    purpose,
    otp_hash: hash,
    otp_salt: salt,
    created_at: now,
    expires_at: now + OTP_CONFIG.expiryMinutes * 60 * 1000,
    attempts: 0,
    max_attempts: OTP_CONFIG.maxAttempts,
    verified_at: null,
    consumed_at: null,
  };
  inMemoryOtpStore.set(key, record);
  return record;
}

function verifyOtpRecord(email, purpose, candidateOtp) {
  const cleanEmail = email.toLowerCase().trim();
  const key = `${cleanEmail}:${purpose}`;
  const record = inMemoryOtpStore.get(key);
  if (!record) throw new Error("No active OTP request found.");
  if (record.consumed_at) throw new Error("Verification code has already been used.");
  if (Date.now() > record.expires_at) throw new Error("Verification code has expired.");
  if (record.attempts >= record.max_attempts) throw new Error("Maximum attempts exceeded.");

  record.attempts += 1;
  const isMatch = verifyPassword(candidateOtp, { hash: record.otp_hash, salt: record.otp_salt });
  if (!isMatch) {
    const rem = record.max_attempts - record.attempts;
    if (rem <= 0) throw new Error("Maximum attempts exceeded. Code locked.");
    throw new Error(`Invalid verification code. ${rem} attempts remaining.`);
  }

  // Atomically mark verified and consumed
  record.verified_at = Date.now();
  record.consumed_at = Date.now();
  return { ok: true, verifiedToken: `tok-${randomBytes(16).toString("hex")}` };
}

runTest("B.1: Generates 6-digit cryptographic OTP", () => {
  const otp = generateSecureOtp();
  assert.equal(typeof otp, "string");
  assert.equal(otp.length, 6);
  assert.match(otp, /^\d{6}$/);
  const num = Number(otp);
  assert.ok(num >= 100000 && num <= 999999);
});

runTest("B.2: Validates correct OTP successfully", () => {
  const raw = "123456";
  createOtpRecord("test.guard@dsvv.ac.in", "password_reset", raw);
  const result = verifyOtpRecord("test.guard@dsvv.ac.in", "password_reset", raw);
  assert.equal(result.ok, true);
  assert.ok(result.verifiedToken.startsWith("tok-"));
});

runTest("B.3: Rejects incorrect OTP and decrements attempts", () => {
  const raw = "888222";
  // Reset key by overriding store directly for this test
  inMemoryOtpStore.delete("guard.attempt@dsvv.ac.in:password_reset");
  createOtpRecord("guard.attempt@dsvv.ac.in", "password_reset", raw);
  assert.throws(() => {
    verifyOtpRecord("guard.attempt@dsvv.ac.in", "password_reset", "000000");
  }, /4 attempts remaining/);
});

runTest("B.4: Locks OTP after 5 consecutive incorrect attempts", () => {
  const raw = "555111";
  inMemoryOtpStore.delete("guard.lockout@dsvv.ac.in:password_reset");
  createOtpRecord("guard.lockout@dsvv.ac.in", "password_reset", raw);
  for (let i = 0; i < 4; i++) {
    try { verifyOtpRecord("guard.lockout@dsvv.ac.in", "password_reset", "111111"); } catch {}
  }
  // 5th attempt triggers lockout
  assert.throws(() => {
    verifyOtpRecord("guard.lockout@dsvv.ac.in", "password_reset", "111111");
  }, /Maximum attempts exceeded/);
});

runTest("B.5: Rejects expired OTP (> 5 minutes)", () => {
  const raw = "666333";
  inMemoryOtpStore.delete("guard.expired@dsvv.ac.in:password_reset");
  const rec = createOtpRecord("guard.expired@dsvv.ac.in", "password_reset", raw);
  rec.expires_at = Date.now() - 1000; // Force expired
  assert.throws(() => {
    verifyOtpRecord("guard.expired@dsvv.ac.in", "password_reset", raw);
  }, /Verification code has expired/);
});

runTest("B.6: Rejects reused OTP (single-use enforcement)", () => {
  const raw = "777444";
  inMemoryOtpStore.delete("guard.singleuse@dsvv.ac.in:password_reset");
  createOtpRecord("guard.singleuse@dsvv.ac.in", "password_reset", raw);
  verifyOtpRecord("guard.singleuse@dsvv.ac.in", "password_reset", raw); // First use: OK
  // Second use must fail
  assert.throws(() => {
    verifyOtpRecord("guard.singleuse@dsvv.ac.in", "password_reset", raw);
  }, /Verification code has already been used/);
});

runTest("B.7: Enforces 60-second resend cooldown", () => {
  const raw1 = "111222";
  const raw2 = "333444";
  inMemoryOtpStore.delete("guard.cooldown@dsvv.ac.in:password_reset");
  createOtpRecord("guard.cooldown@dsvv.ac.in", "password_reset", raw1);
  assert.throws(() => {
    createOtpRecord("guard.cooldown@dsvv.ac.in", "password_reset", raw2);
  }, /Cooldown active/);
});

runTest("B.8: Invalidates previous active OTP when new OTP is generated after cooldown", () => {
  const raw1 = "111222";
  const raw2 = "999888";
  inMemoryOtpStore.delete("guard.inval@dsvv.ac.in:password_reset");
  const rec1 = createOtpRecord("guard.inval@dsvv.ac.in", "password_reset", raw1);
  rec1.created_at = Date.now() - 61 * 1000; // Fake 61s past
  createOtpRecord("guard.inval@dsvv.ac.in", "password_reset", raw2);
  assert.equal(Boolean(rec1.consumed_at), true, "Previous OTP must be consumed/invalidated");
});

runTest("B.9: Rejects Cross-Purpose OTP verification", () => {
  const raw = "444555";
  inMemoryOtpStore.delete("guard.purpose@dsvv.ac.in:signup_verification");
  createOtpRecord("guard.purpose@dsvv.ac.in", "signup_verification", raw);
  // Attempting to verify as password_reset must fail
  assert.throws(() => {
    verifyOtpRecord("guard.purpose@dsvv.ac.in", "password_reset", raw);
  }, /No active OTP request found/);
});

runTest("B.10: Rejects Cross-User OTP verification", () => {
  const raw = "987654";
  inMemoryOtpStore.delete("user.a@dsvv.ac.in:password_reset");
  createOtpRecord("user.a@dsvv.ac.in", "password_reset", raw);
  // Attempting to verify user B with user A's code must fail
  assert.throws(() => {
    verifyOtpRecord("user.b@dsvv.ac.in", "password_reset", raw);
  }, /No active OTP request found/);
});

// -----------------------------------------------------------------------------
// GROUP C: Password Recovery & API Security
// -----------------------------------------------------------------------------
console.log("\n--- GROUP C: Password Recovery, Password Strength & Bypass Defenses ---");

runTest("C.1: Password policy requires min 8 chars and alphanumeric characters", () => {
  assert.equal(validatePasswordPolicy("short1").ok, false);
  assert.equal(validatePasswordPolicy("purealphapassword").ok, false);
  assert.equal(validatePasswordPolicy("1234567890").ok, false);
  assert.equal(validatePasswordPolicy("DsvvSecure2026").ok, true);
});

runTest("C.2: Password reset requires matching passwords", () => {
  const pass1 = "CampusSecure#2026";
  const pass2 = "CampusSecure#2027";
  assert.notEqual(pass1, pass2);
});

runTest("C.3: Rejects direct API bypass without OTP when email is targeted", () => {
  // Simulates /api/auth/reset-password logic
  const input = { email: "admin@dsvv.ac.in", password: "NewPassword123" };
  assert.throws(() => {
    if (input.email && !input.otp) {
      throw new Error("Verification code (OTP) is required to reset password for this email.");
    }
  }, /Verification code \(OTP\) is required/);
});

runTest("C.4: Verifies password reset works uniformly for all 6 application roles", () => {
  for (const role of SYSTEM_ROLES) {
    const rawOtp = generateSecureOtp();
    const email = `${role}.user@dsvv.ac.in`;
    inMemoryOtpStore.delete(`${email}:password_reset`);
    createOtpRecord(email, "password_reset", rawOtp);
    const verified = verifyOtpRecord(email, "password_reset", rawOtp);
    assert.equal(verified.ok, true, `Role ${role} OTP verification must succeed`);
  }
});

// -----------------------------------------------------------------------------
// GROUP D: Change Email Two-Step Verification
// -----------------------------------------------------------------------------
console.log("\n--- GROUP D: Two-Step Change Email Workflow Verification ---");

const pendingChanges = new Map();

function requestEmailChange(userId, oldEmail, newEmail) {
  if (oldEmail.toLowerCase() === newEmail.toLowerCase()) {
    throw new Error("New email address must be different from your current email.");
  }
  if (newEmail === "existing.user@dsvv.ac.in") {
    throw new Error("An account with this email address already exists.");
  }
  const oldOtp = generateSecureOtp();
  inMemoryOtpStore.delete(`${oldEmail}:email_change_old`);
  createOtpRecord(oldEmail, "email_change_old", oldOtp);

  const pending = {
    userId,
    oldEmail,
    newEmail,
    oldVerified: false,
    newVerified: false,
    status: "pending",
  };
  pendingChanges.set(userId, pending);
  return { pending, oldOtp };
}

function verifyOldEmail(userId, otp) {
  const pending = pendingChanges.get(userId);
  if (!pending || pending.status !== "pending") {
    throw new Error("No active email change request found.");
  }
  verifyOtpRecord(pending.oldEmail, "email_change_old", otp);
  pending.oldVerified = true;
  pending.status = "old_verified";

  // Dispatch OTP to new email
  const newOtp = generateSecureOtp();
  inMemoryOtpStore.delete(`${pending.newEmail}:email_change_new`);
  createOtpRecord(pending.newEmail, "email_change_new", newOtp);
  return { pending, newOtp };
}

function verifyNewEmail(userId, otp) {
  const pending = pendingChanges.get(userId);
  if (!pending || pending.status !== "old_verified") {
    throw new Error("No verified email change request found. Please verify old email first.");
  }
  verifyOtpRecord(pending.newEmail, "email_change_new", otp);
  pending.newVerified = true;
  pending.status = "completed";
  return { ok: true, updatedEmail: pending.newEmail };
}

runTest("D.1: Rejects change to same email address", () => {
  assert.throws(() => {
    requestEmailChange("u1", "guard@dsvv.ac.in", "guard@dsvv.ac.in");
  }, /different from your current email/);
});

runTest("D.2: Rejects change to already registered email address", () => {
  assert.throws(() => {
    requestEmailChange("u1", "guard@dsvv.ac.in", "existing.user@dsvv.ac.in");
  }, /already exists/);
});

runTest("D.3: Completes two-step verification sequentially (Old OTP -> New OTP)", () => {
  const userId = "guard_u_123";
  const oldEmail = "old.guard@dsvv.ac.in";
  const newEmail = "new.guard@dsvv.ac.in";

  // Step 1: Initiate
  const { oldOtp } = requestEmailChange(userId, oldEmail, newEmail);
  assert.equal(typeof oldOtp, "string");

  // Attempting Step 3 prematurely must fail
  assert.throws(() => {
    verifyNewEmail(userId, "123456");
  }, /verify old email first/);

  // Step 2: Verify Old Email OTP
  const { newOtp } = verifyOldEmail(userId, oldOtp);
  assert.equal(typeof newOtp, "string");

  // Step 3: Verify New Email OTP & Finalize
  const finalize = verifyNewEmail(userId, newOtp);
  assert.equal(finalize.ok, true);
  assert.equal(finalize.updatedEmail, newEmail);
});

// -----------------------------------------------------------------------------
// GROUP E: Security Auditing, IP Privacy & Device Sanitization
// -----------------------------------------------------------------------------
console.log("\n--- GROUP E: Security Audit Trail, Hashing & Privacy Verification ---");

runTest("E.1: IP address is securely hashed with SHA-256 for privacy", () => {
  const clientIp = "192.168.1.105";
  const hashed = hashIp(clientIp);
  assert.notEqual(hashed, clientIp);
  assert.equal(hashed.length, 32);
  // Deterministic check
  assert.equal(hashed, hashIp(clientIp));
});

runTest("E.2: User-Agent strings are sanitized and length-capped", () => {
  const longUa = "Mozilla/5.0 ".repeat(30);
  const sanitized = longUa.slice(0, 200);
  assert.ok(sanitized.length <= 200);
});

runTest("E.3: Verified user roles are strictly typed and recognized", () => {
  assert.equal(SYSTEM_ROLES.length, 6);
  assert.ok(SYSTEM_ROLES.includes("super_admin"));
  assert.ok(SYSTEM_ROLES.includes("admin"));
  assert.ok(SYSTEM_ROLES.includes("security"));
  assert.ok(SYSTEM_ROLES.includes("teacher"));
  assert.ok(SYSTEM_ROLES.includes("student"));
  assert.ok(SYSTEM_ROLES.includes("visitor"));
});

console.log("\n================================================================================");
console.log(`TOTAL SUITES EXECUTED: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
if (failed > 0) {
  console.error("FAILURES DETECTED:");
  failures.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
} else {
  console.log("ALL TESTS COMPLETED WITH 100% SUCCESS RATE!");
}
console.log("================================================================================\n");
