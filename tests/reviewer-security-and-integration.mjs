/**
 * Reviewer Security, Negative & Integration Test Suite (I3, I5, I6).
 *
 * Always runs standalone unit & static security checks:
 *  - Signed QR pass tokens: HMAC-SHA256 signing & tamper rejection
 *  - Auth hardening: sessionForToken has no 24h unverified JWT grace window
 *  - Outpass scan RBAC: POST /api/outpass/scan enforces requireGateOperator()
 *  - RLS hardening: 0024 removes permissive USING (true) / WITH CHECK (true) policies
 *
 * When a server is reachable at BASE (default http://localhost:3000), also runs
 * full HTTP negative & integration tests:
 *  - Unauthorized visitor insert via /api/bookings rejected (401/403)
 *  - Wrong role (student) cannot scan at /api/gate/verify or /api/outpass/scan (403)
 *  - Spoofed guardUid is ignored on /api/gate/check-in (recorded guard comes from session)
 *  - Tampered and reused QR tokens are rejected
 *  - I3 check: re-scanning Checked In pass returns nextAction:'check-out' (does NOT auto-toggle)
 *  - I5: Incident reported with photo -> saved Open + notification
 *  - I6: Admin assigns and resolves incident (guard blocked 403) -> status Resolved
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { newPhotoId } from "./photo-fixtures.mjs";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const DB_PATH = resolve(process.cwd(), process.env.DATABASE_FILE ?? ".data/campus-security.db");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err instanceof Error ? err.message : String(err)}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

function makeSession() {
  let cookie = "";
  return async function call(path, options = {}) {
    const response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...options.headers,
      },
      redirect: "manual",
    });
    for (const entry of response.headers.getSetCookie?.() ?? []) {
      const [pair] = entry.split(";");
      if (pair.startsWith("csms_session=")) cookie = pair;
    }
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { ok: false, raw: text.slice(0, 200) };
    }
    return { status: response.status, ...json };
  };
}

const post = (call, path, body) => call(path, { method: "POST", body: JSON.stringify(body ?? {}) });
const patch = (call, path, body) => call(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });

function one(sql, params = []) {
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    return db.prepare(sql).get(...params);
  } finally {
    db.close();
  }
}

async function runStaticAndUnitSuite() {
  const { signPassToken, verifyPassTokenSignature } = await import(
    "../lib/server/services/pass-token.ts"
  );
  const { maskIdNumber } = await import("../lib/validation.ts");

  section("1 — Signed QR pass tokens & static security invariants");

  await test("signPassToken generates HMAC-signed token and rejects tampered tokens", () => {
    const token = signPassToken();
    assert.ok(token.includes("."), "signed token must contain signature separator");
    assert.equal(verifyPassTokenSignature(token), true);

    const lastChar = token.slice(-1);
    const tamperedSig = token.slice(0, -1) + (lastChar === "a" ? "b" : "a");
    assert.equal(verifyPassTokenSignature(tamperedSig), false);

    const tamperedNonce = "0".repeat(48) + token.slice(48);
    assert.equal(verifyPassTokenSignature(tamperedNonce), false);
  });

  await test("maskIdNumber exposes at most last 4 characters", () => {
    assert.equal(maskIdNumber("DL0820260124"), "XXXXXXXX0124");
    assert.equal(maskIdNumber(""), "—");
  });

  await test("sessionForToken has no unverified JWT grace window or SQLite bypass in Supabase mode", () => {
    const authSrc = readFileSync(new URL("../lib/server/auth.ts", import.meta.url), "utf8");
    assert.doesNotMatch(authSrc, /gracePeriodMs/);
    assert.doesNotMatch(authSrc, /24 \* 60 \* 60/);
    assert.match(authSrc, /sb\.auth\.getUser\(token\)/);
  });

  await test("POST /api/outpass/scan enforces requireGateOperator() instead of generic requireAuth()", () => {
    const scanSrc = readFileSync(
      new URL("../lib/api-routes/outpass/scan/route.ts", import.meta.url),
      "utf8",
    );
    assert.match(scanSrc, /requireGateOperator/);
    assert.doesNotMatch(scanSrc, /requireAuth/);
  });

  await test("migration 0024 hardens permissive USING (true) / WITH CHECK (true) policies", () => {
    const mig = readFileSync(
      new URL("../supabase/migrations/0024_harden_rls_policies.sql", import.meta.url),
      "utf8",
    );
    assert.match(mig, /public\.is_staff\(\)/);
    assert.match(mig, /status = 'PENDING'/);
    assert.doesNotMatch(mig, /using\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(mig, /with check\s*\(\s*true\s*\)/i);
  });
}

async function runHttpSuite() {
  section("2 — HTTP Negative Security & Integration Suite (I3, I5, I6)");

  const anon = makeSession();
  const admin = makeSession();
  const guard = makeSession();
  const student = makeSession();

  const demoPw = process.env.DEMO_ACCOUNT_PASSWORD ?? "Admin@123";
  await post(admin, "/api/auth/login", { email: "admin@dsvv.edu.in", password: demoPw });
  await post(guard, "/api/auth/login", {
    email: "security@dsvv.edu.in",
    password: process.env.DEMO_ACCOUNT_PASSWORD ?? "Security@123",
  });
  await post(student, "/api/auth/login", {
    email: "aarav.mehta@dsvv.edu.in",
    password: process.env.DEMO_ACCOUNT_PASSWORD ?? "Student@123",
  });

  await test("unauthorized visitor insert on /api/bookings is rejected (401/403)", async () => {
    const rAnon = await post(anon, "/api/bookings", { fullName: "Unauth" });
    assert.ok(rAnon.status === 401 || rAnon.status === 403, `got ${rAnon.status}`);
    const rStud = await post(student, "/api/bookings", { fullName: "Student" });
    assert.equal(rStud.status, 403);
  });

  await test("wrong role (student) cannot scan visitor pass or student outpass (403)", async () => {
    const r1 = await post(student, "/api/gate/verify", { token: "anything" });
    assert.equal(r1.status, 403);
    const r2 = await post(student, "/api/outpass/scan", {
      rawToken: "anything",
      direction: "EXIT",
      gate: "Main Gate",
    });
    assert.equal(r2.status, 403);
  });

  const dir = await anon("/api/public/directory");
  const host = dir.data?.teachers?.[0];
  assert.ok(host, "expected seeded host");
  const photoId = await newPhotoId(BASE);
  const today = new Date().toISOString().slice(0, 10);

  const created = await post(admin, "/api/bookings", {
    fullName: "Reviewer Test Visitor",
    mobileNumber: `99${Date.now().toString().slice(-8)}`,
    photoId,
    idType: "Driving Licence",
    idNumber: "DL-REV-0001",
    purpose: "Teacher Meeting",
    purposeDetail: "Automated negative security verification",
    hostId: host.id,
    departmentId: host.departmentId,
    visitDate: today,
    visitTime: "10:00",
    expectedDuration: "30 minutes",
  });
  assert.equal(created.ok, true, created.error?.message);
  const bookingId = created.data.id;

  const approved = await patch(admin, `/api/bookings/${bookingId}`, { action: "approve" });
  assert.equal(approved.ok, true, approved.error?.message);
  const signedToken = approved.data.passToken;
  assert.ok(signedToken && signedToken.includes("."), "approved booking must carry signed passToken");

  await test("tampered QR token is rejected by /api/gate/verify", async () => {
    const bad = signedToken.slice(0, -1) + (signedToken.endsWith("X") ? "Y" : "X");
    const res = await post(guard, "/api/gate/verify", { token: bad });
    assert.equal(res.data?.ok, false);
  });

  const settingsBefore = one("SELECT visiting_hours_from, visiting_hours_to FROM campus_settings WHERE id = 1");
  await patch(admin, "/api/settings", { visitingHoursFrom: "00:00", visitingHoursTo: "23:59" });

  await test("spoofed guardUid is ignored on /api/gate/check-in", async () => {
    const res = await post(guard, "/api/gate/check-in", {
      bookingId,
      gate: "Main Gate",
      guardUid: "GRD-SPOOFED-999",
    });
    assert.equal(res.ok, true, res.error?.message);
    assert.notEqual(res.data?.guardName, "GRD-SPOOFED-999");
  });

  await test("I3 check: scanning Checked In pass again returns nextAction='check-out' (does NOT auto-toggle exit)", async () => {
    const res = await post(guard, "/api/gate/verify", { token: signedToken });
    assert.equal(res.data?.ok, true);
    assert.equal(res.data?.nextAction, "check-out");
    assert.equal(res.data?.booking?.status, "Checked In");
  });

  await test("reused token after check-out is rejected by /api/gate/verify", async () => {
    const out = await post(guard, "/api/gate/check-out", { bookingId, gate: "Main Gate" });
    assert.equal(out.ok, true, out.error?.message);

    const reused = await post(guard, "/api/gate/verify", { token: signedToken });
    assert.equal(reused.data?.ok, false);
    assert.ok(reused.data?.issues?.some((i) => i.code === "used"));
  });

  if (settingsBefore) {
    await patch(admin, "/api/settings", {
      visitingHoursFrom: settingsBefore.visiting_hours_from,
      visitingHoursTo: settingsBefore.visiting_hours_to,
    });
  }

  section("3 — Integration Tests I5 & I6 (Incident with photo, assignment, resolution)");

  let incidentId = "";

  await test("I5: Guard reports High-priority incident with photo -> saved Open + notification", async () => {
    const incPhotoId = await newPhotoId(BASE);
    const res = await post(guard, "/api/incidents", {
      type: "Unauthorized Entry",
      title: "Perimeter alert near Main Gate",
      location: "Main Gate",
      date: today,
      time: "14:20",
      severity: "High",
      description: "Automated I5 test incident with photo.",
      attachmentUrl: `/api/visitor-photo/${incPhotoId}`,
    });
    assert.equal(res.ok, true, res.error?.message);
    incidentId = res.data.id;
    assert.equal(res.data.status, "Open");
    assert.equal(res.data.attachmentUrl, `/api/visitor-photo/${incPhotoId}`);
  });

  await test("I6: Guard cannot resolve/assign incident (403); Admin assigns & resolves -> Resolved", async () => {
    const guardResolve = await patch(guard, `/api/incidents/${incidentId}`, {
      status: "Resolved",
      resolutionNote: "Unauthorized self-close",
    });
    assert.equal(guardResolve.status, 403);

    const guardRow = one("SELECT id, full_name FROM security_guards LIMIT 1");
    assert.ok(guardRow);

    const adminResolve = await patch(admin, `/api/incidents/${incidentId}`, {
      assignedToId: guardRow.id,
      status: "Resolved",
      resolutionNote: "Verified and resolved by administrator.",
    });
    assert.equal(adminResolve.ok, true, adminResolve.error?.message);
    assert.equal(adminResolve.data.status, "Resolved");
    assert.equal(adminResolve.data.assignedToId, guardRow.id);
    assert.ok(adminResolve.data.resolvedAt);
  });
}

async function main() {
  await runStaticAndUnitSuite();

  const reachable = await fetch(`${BASE}/api/public/directory`)
    .then((r) => r.ok)
    .catch(() => false);

  if (!reachable) {
    console.log(`\n  SKIPPED HTTP suite — no server at ${BASE}.`);
  } else {
    await runHttpSuite();
  }

  console.log(`\n====================================================`);
  console.log(`  PASSED: ${passed}    FAILED: ${failed}`);
  console.log(`====================================================`);
  if (failed > 0) process.exit(1);
}

main();
