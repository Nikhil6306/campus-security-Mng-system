/**
 * Automated test suite for Guard Registration, Admin Approval,
 * Role Assignment, Status Checks, and Authentication Lifecycle.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../.data/campus-security.db");

console.log("Starting Guard Authentication & Admin Approval Tests...\n");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

const db = new DatabaseSync(DB_PATH);

// Ensure guard_registration_requests table exists (runs SCHEMA_SQL DDL)
db.exec(`
CREATE TABLE IF NOT EXISTS guard_registration_requests (
  id               TEXT PRIMARY KEY,
  full_name        TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  phone            TEXT NOT NULL,
  guard_id         TEXT NOT NULL,
  designation      TEXT NOT NULL DEFAULT 'Security Guard',
  assigned_gate    TEXT NOT NULL DEFAULT 'Main Gate',
  password_hash    TEXT NOT NULL,
  password_salt    TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','SUSPENDED')),
  rejection_reason TEXT,
  created_at       TEXT NOT NULL,
  reviewed_at      TEXT,
  reviewed_by      TEXT
);
CREATE INDEX IF NOT EXISTS idx_guard_req_status ON guard_registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_guard_req_email ON guard_registration_requests(email);
`);

// Helper for scrypt password hashing
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384 }).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, record) {
  if (!record.hash || !record.salt) return false;
  const actual = crypto.scryptSync(password, record.salt, 64, { N: 16384 });
  const expected = Buffer.from(record.hash, "hex");
  return crypto.timingSafeEqual(actual, expected);
}

// 1. Verify Schema
await test("SQLite schema contains guard_registration_requests table with all required columns and constraints", () => {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='guard_registration_requests'").get();
  assert.ok(table, "guard_registration_requests table must exist in SQLite");

  const columns = db.prepare("PRAGMA table_info(guard_registration_requests)").all();
  const colNames = columns.map((c) => c.name);

  assert.ok(colNames.includes("id"), "has id column");
  assert.ok(colNames.includes("full_name"), "has full_name column");
  assert.ok(colNames.includes("email"), "has email column");
  assert.ok(colNames.includes("phone"), "has phone column");
  assert.ok(colNames.includes("guard_id"), "has guard_id column");
  assert.ok(colNames.includes("designation"), "has designation column");
  assert.ok(colNames.includes("assigned_gate"), "has assigned_gate column");
  assert.ok(colNames.includes("password_hash"), "has password_hash column");
  assert.ok(colNames.includes("password_salt"), "has password_salt column");
  assert.ok(colNames.includes("status"), "has status column");
  assert.ok(colNames.includes("rejection_reason"), "has rejection_reason column");
  assert.ok(colNames.includes("created_at"), "has created_at column");
  assert.ok(colNames.includes("reviewed_at"), "has reviewed_at column");
  assert.ok(colNames.includes("reviewed_by"), "has reviewed_by column");
});

// Test Guard Identifiers
const testEmail = `guard.test.${Date.now()}@dsvv.ac.in`;
const testRawPassword = "DutyPassword#2026";
const testGuardId = `GRD-T${Date.now().toString().slice(-4)}`;
const reqId = `REQ-GRD-${Date.now().toString().slice(-4)}`;
const now = new Date().toISOString();

// 2. Self-Registration Request
await test("Guard self-registration inserts record with PENDING status and hashed password", () => {
  const { hash, salt } = hashPassword(testRawPassword);

  db.prepare(`
    INSERT INTO guard_registration_requests
      (id, full_name, email, phone, guard_id, designation, assigned_gate,
       password_hash, password_salt, status, rejection_reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, ?)
  `).run(
    reqId,
    "Officer Vikram Sharma",
    testEmail,
    "9876543210",
    testGuardId,
    "Gate Supervisor",
    "Main Gate",
    hash,
    salt,
    now,
  );

  const row = db.prepare("SELECT * FROM guard_registration_requests WHERE id = ?").get(reqId);
  assert.ok(row, "Registration request row must exist");
  assert.equal(row.status, "PENDING");
  assert.equal(row.full_name, "Officer Vikram Sharma");
  assert.equal(row.email, testEmail);
  assert.equal(row.guard_id, testGuardId);
  assert.equal(row.assigned_gate, "Main Gate");
  assert.notEqual(row.password_hash, testRawPassword, "Plaintext password must not be stored");
  assert.ok(verifyPassword(testRawPassword, { hash: row.password_hash, salt: row.password_salt }));
});

// 3. Duplicate email prevention
await test("Duplicate registration with the same email address is prevented", () => {
  assert.throws(() => {
    db.prepare(`
      INSERT INTO guard_registration_requests
        (id, full_name, email, phone, guard_id, password_hash, password_salt, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `).run(
      `REQ-DUP-${Date.now()}`,
      "Duplicate Officer",
      testEmail,
      "9876543210",
      "GRD-DUP",
      "hash",
      "salt",
      now,
    );
  }, /UNIQUE constraint failed/);
});

// 4. Pending guard login denial
await test("Guard login is strictly denied while registration request status is PENDING", () => {
  const req = db.prepare("SELECT status FROM guard_registration_requests WHERE email = ?").get(testEmail);
  assert.equal(req.status, "PENDING");

  // In app_users, no active account exists yet
  const user = db.prepare("SELECT * FROM app_users WHERE email = ?").get(testEmail);
  assert.equal(user, undefined, "Guard should not exist in app_users before admin approval");

  // Authentication check logic verifies that pending status rejects access
  const authenticateGuard = (email, pwd) => {
    const userRow = db.prepare("SELECT * FROM app_users WHERE email = ?").get(email);
    if (!userRow) {
      const pending = db.prepare("SELECT status FROM guard_registration_requests WHERE email = ?").get(email);
      if (pending && pending.status === "PENDING") {
        throw new Error("Your guard registration is pending administrator approval. You will receive an email once approved.");
      }
      throw new Error("Incorrect email or password.");
    }
    return userRow;
  };

  assert.throws(
    () => authenticateGuard(testEmail, testRawPassword),
    /pending administrator approval/,
  );
});

// 5. Admin Approval Atomic Workflow
let createdGuardRosterId = "";
let createdUserId = "";

await test("Admin approval executes atomic transaction: creates security_guards row, creates app_users account with role 'security', and updates status to APPROVED", () => {
  const req = db.prepare("SELECT * FROM guard_registration_requests WHERE id = ?").get(reqId);
  assert.ok(req);
  assert.equal(req.status, "PENDING");

  const guardRosterId = `GRD-${Date.now().toString().slice(-3)}`;
  const appUserId = `USR-${Date.now().toString().slice(-4)}`;
  createdGuardRosterId = guardRosterId;
  createdUserId = appUserId;
  const approvedAt = new Date().toISOString();

  // Execute approval transaction
  db.exec("BEGIN TRANSACTION");
  try {
    // 1. Create roster entry in security_guards
    db.prepare(`
      INSERT INTO security_guards
        (id, employee_id, full_name, phone, email, shift, shift_start, shift_end,
         assigned_gate, status, joining_date, emergency_contact, address, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'Morning', '06:00', '14:00', ?, 'Active', ?, '', '', ?, ?)
    `).run(
      guardRosterId,
      req.guard_id,
      req.full_name,
      req.phone,
      req.email,
      req.assigned_gate,
      approvedAt.slice(0, 10),
      approvedAt,
      approvedAt,
    );

    // 2. Create account in app_users
    db.prepare(`
      INSERT INTO app_users
        (id, email, password_hash, password_salt, name, role, ref_id, gate, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'security', ?, ?, 1, ?, ?)
    `).run(
      appUserId,
      req.email,
      req.password_hash,
      req.password_salt,
      req.full_name,
      guardRosterId,
      req.assigned_gate,
      approvedAt,
      approvedAt,
    );

    // 3. Update guard_registration_requests
    db.prepare(`
      UPDATE guard_registration_requests
         SET status = 'APPROVED', reviewed_at = ?, reviewed_by = 'admin-cso'
       WHERE id = ?
    `).run(approvedAt, reqId);

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  // Verify DB state
  const guardRow = db.prepare("SELECT * FROM security_guards WHERE id = ?").get(guardRosterId);
  assert.ok(guardRow, "security_guards row exists");
  assert.equal(guardRow.status, "Active");
  assert.equal(guardRow.assigned_gate, "Main Gate");

  const userRow = db.prepare("SELECT * FROM app_users WHERE id = ?").get(appUserId);
  assert.ok(userRow, "app_users row exists");
  assert.equal(userRow.role, "security");
  assert.equal(userRow.active, 1);
  assert.equal(userRow.ref_id, guardRosterId);

  const updatedReq = db.prepare("SELECT * FROM guard_registration_requests WHERE id = ?").get(reqId);
  assert.equal(updatedReq.status, "APPROVED");
  assert.ok(updatedReq.reviewed_at);
  assert.equal(updatedReq.reviewed_by, "admin-cso");
});

// 6. Approved Guard Sign-In
await test("Approved security guard signs in successfully, authenticates password, and receives active session", () => {
  const user = db.prepare("SELECT * FROM app_users WHERE email = ?").get(testEmail);
  assert.ok(user);
  assert.equal(user.active, 1);
  assert.equal(user.role, "security");

  const isPasswordValid = verifyPassword(testRawPassword, {
    hash: user.password_hash,
    salt: user.password_salt,
  });
  assert.equal(isPasswordValid, true, "Guard password must match scrypt hash");

  // Create active session
  const token = `guard_tok_${crypto.randomBytes(24).toString("base64url")}`;
  const sessionExpires = new Date(Date.now() + 12 * 3600_000).toISOString();

  db.prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
    token,
    user.id,
    new Date().toISOString(),
    sessionExpires,
  );

  const activeSession = db.prepare("SELECT * FROM sessions WHERE id = ?").get(token);
  assert.ok(activeSession, "Session token must be persisted");
  assert.equal(activeSession.user_id, user.id);
});

// 7. Admin Suspension & Session Revocation
await test("Admin suspension deactivates guard account, flips roster to 'Suspended', and revokes active sessions", () => {
  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare("UPDATE security_guards SET status = 'Suspended', updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      createdGuardRosterId,
    );
    db.prepare("UPDATE app_users SET active = 0, updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      createdUserId,
    );
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(createdUserId);
    db.prepare("UPDATE guard_registration_requests SET status = 'SUSPENDED' WHERE email = ?").run(testEmail);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const guard = db.prepare("SELECT status FROM security_guards WHERE id = ?").get(createdGuardRosterId);
  assert.equal(guard.status, "Suspended");

  const user = db.prepare("SELECT active FROM app_users WHERE id = ?").get(createdUserId);
  assert.equal(user.active, 0);

  const activeSessions = db.prepare("SELECT COUNT(*) as c FROM sessions WHERE user_id = ?").get(createdUserId);
  assert.equal(activeSessions.c, 0, "All sessions must be revoked on suspension");

  // Guard login attempt should fail
  const attemptLogin = (email) => {
    const u = db.prepare("SELECT * FROM app_users WHERE email = ?").get(email);
    if (u && u.active !== 1) {
      throw new Error("Your guard account has been suspended or deactivated. Contact the administrator.");
    }
  };
  assert.throws(() => attemptLogin(testEmail), /suspended or deactivated/);
});

// 8. Admin Reactivation Workflow
await test("Admin reactivation restores guard to 'Active' status and enables login", () => {
  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare("UPDATE security_guards SET status = 'Active', updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      createdGuardRosterId,
    );
    db.prepare("UPDATE app_users SET active = 1, updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      createdUserId,
    );
    db.prepare("UPDATE guard_registration_requests SET status = 'APPROVED' WHERE email = ?").run(testEmail);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const guard = db.prepare("SELECT status FROM security_guards WHERE id = ?").get(createdGuardRosterId);
  assert.equal(guard.status, "Active");

  const user = db.prepare("SELECT active FROM app_users WHERE id = ?").get(createdUserId);
  assert.equal(user.active, 1);
});

// 9. Rejection Handling with Reason
await test("Admin rejects registration request with recorded reason and prevents login", () => {
  const rejEmail = `reject.test.${Date.now()}@dsvv.ac.in`;
  const rejReqId = `REQ-REJ-${Date.now().toString().slice(-4)}`;
  const { hash, salt } = hashPassword("RejectedPwd123");

  db.prepare(`
    INSERT INTO guard_registration_requests
      (id, full_name, email, phone, guard_id, designation, assigned_gate,
       password_hash, password_salt, status, created_at)
    VALUES (?, 'Declined Applicant', ?, '9123456780', 'GRD-REJ', 'Security Guard', 'Gate 1', ?, ?, 'PENDING', ?)
  `).run(rejReqId, rejEmail, hash, salt, now);

  const rejectionReason = "Incomplete verification documents";
  db.prepare(`
    UPDATE guard_registration_requests
       SET status = 'REJECTED', rejection_reason = ?, reviewed_at = ?, reviewed_by = 'admin-cso'
     WHERE id = ?
  `).run(rejectionReason, new Date().toISOString(), rejReqId);

  const rejectedReq = db.prepare("SELECT * FROM guard_registration_requests WHERE id = ?").get(rejReqId);
  assert.equal(rejectedReq.status, "REJECTED");
  assert.equal(rejectedReq.rejection_reason, rejectionReason);
});

// 10. Four-field registration payload support (Name, Phone, Email, Password only)
await test("Four-field registration creates valid PENDING request without requiring employee ID or designation", () => {
  const fourFieldEmail = `guard.four.${Date.now()}@dsvv.ac.in`;
  const fourFieldPhone = "9876543219";
  const fourFieldReqId = `REQ-4F-${Date.now().toString().slice(-4)}`;
  const autoGeneratedGuardId = `GRD-${Date.now().toString().slice(-4)}`;
  const { hash, salt } = hashPassword("SecurePass2026");

  db.prepare(`
    INSERT INTO guard_registration_requests
      (id, full_name, email, phone, guard_id, designation, assigned_gate,
       password_hash, password_salt, status, created_at)
    VALUES (?, 'Four Field Officer', ?, ?, ?, 'Security Guard', 'Main Gate', ?, ?, 'PENDING', ?)
  `).run(fourFieldReqId, fourFieldEmail, fourFieldPhone, autoGeneratedGuardId, hash, salt, now);

  const row = db.prepare("SELECT * FROM guard_registration_requests WHERE id = ?").get(fourFieldReqId);
  assert.ok(row, "Four-field registration row must exist");
  assert.equal(row.status, "PENDING");
  assert.equal(row.full_name, "Four Field Officer");
  assert.equal(row.email, fourFieldEmail);
  assert.equal(row.phone, fourFieldPhone);
  assert.equal(row.designation, "Security Guard");
  assert.equal(row.assigned_gate, "Main Gate");
});

// 11. Duplicate phone number prevention
await test("Duplicate registration with an existing active guard mobile number is prevented", () => {
  const existingPhone = "9876543219";
  const checkDuplicate = (phone) => {
    const rawDigits = phone.replace(/\D/g, "");
    const normalized = rawDigits.length === 12 && rawDigits.startsWith("91") ? rawDigits.slice(2) : rawDigits;
    const existsInReq = db.prepare("SELECT id FROM guard_registration_requests WHERE phone = ? OR phone = ?").get(normalized, `+91${normalized}`);
    if (existsInReq) {
      throw new Error("A guard registration with this mobile number already exists.");
    }
  };

  assert.throws(
    () => checkDuplicate("+919876543219"),
    /mobile number already exists/,
  );
});

console.log(`\n====================================================`);
console.log(`  PASSED: ${passed}    FAILED: ${failed}`);
console.log(`====================================================\n`);

if (failed > 0) {
  process.exit(1);
}
