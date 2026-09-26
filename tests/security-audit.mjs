/**
 * Security and authorisation audit against a running server.
 *
 *   npm run dev              # in one terminal
 *   node tests/security-audit.mjs
 *
 * Everything here is an attack, not a happy path. Each case asserts that the
 * *server* refuses — the interface is not consulted, because hiding a button is
 * not a security control.
 *
 * Run this AFTER `e2e-journey.mjs`. The final section deliberately exhausts the
 * public booking rate limit for this client, and that quota is shared with the
 * journey's booking step. Restarting the dev server clears the counters.
 */

import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

import { newPhotoId } from "./photo-fixtures.mjs";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const DB_PATH = resolve(process.cwd(), process.env.DATABASE_FILE ?? ".data/campus-security.db");

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
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
      json = { ok: false, raw: text.slice(0, 120) };
    }
    return { status: response.status, ...json };
  };
}

const post = (call, path, body) => call(path, { method: "POST", body: JSON.stringify(body ?? {}) });
const patch = (call, path, body) => call(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
const put = (call, path, body) => call(path, { method: "PUT", body: JSON.stringify(body) });
const del = (call, path) => call(path, { method: "DELETE" });

function rows(sql, params = []) {
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    return db.prepare(sql).all(...params);
  } finally {
    db.close();
  }
}

const one = (sql, params = []) => rows(sql, params)[0];

/** Refused means 401 or 403 — never a 200 with data. */
const refused = (r) => !r.ok && (r.status === 401 || r.status === 403);

async function main() {
  console.log(`Campus Security — security & authorisation audit against ${BASE}\n`);

  const anon = makeSession();
  const admin = makeSession();
  const guard = makeSession();
  const teacher = makeSession();
  const student = makeSession();

  await post(admin, "/api/auth/login", { email: "admin@dsvv.edu.in", password: "Admin@123" });
  await post(guard, "/api/auth/login", { email: "security@dsvv.edu.in", password: "Security@123" });
  await post(teacher, "/api/auth/login", {
    email: "anupama.sharma@dsvv.edu.in",
    password: "Teacher@123",
  });
  await post(student, "/api/auth/login", {
    email: "aarav.mehta@dsvv.edu.in",
    password: "Student@123",
  });

  /* ---------------------------------------------------------------- *
   * 1. Authorisation matrix
   * ---------------------------------------------------------------- */
  section("1 — Role / endpoint authorisation matrix");

  // [endpoint, anon, student, teacher, guard, admin] — true means "must be
  // allowed to read". Staff-readable entries are deliberate: campus settings
  // and the staff directory are what a guard needs to do the job at the gate,
  // and each is write-restricted separately below.
  const matrix = [
    ["/api/activity", false, false, false, false, true],
    ["/api/guards", false, false, false, false, true],
    ["/api/whatsapp", false, false, false, false, true],
    ["/api/reports?kind=visitors", false, false, false, false, true],
    ["/api/departments", false, false, false, false, true],
    ["/api/settings", false, false, true, true, true],
    ["/api/teachers", false, false, true, true, true],
    ["/api/search?q=ra", false, false, true, true, true],
    ["/api/gates", false, false, false, true, true],
    ["/api/incidents", false, false, false, true, true],
  ];

  const actors = [
    ["anonymous", anon],
    ["student", student],
    ["teacher", teacher],
    ["guard", guard],
    ["admin", admin],
  ];

  for (const [endpoint, ...allowed] of matrix) {
    for (let i = 0; i < actors.length; i += 1) {
      const [name, session] = actors[i];
      const mayAccess = allowed[i];
      const response = await session(endpoint);
      if (mayAccess) {
        check(`${name} may read ${endpoint}`, response.ok === true, `status ${response.status}`);
      } else {
        check(
          `${name} is refused ${endpoint}`,
          refused(response),
          `status ${response.status}`,
        );
      }
    }
  }

  /* ---------------------------------------------------------------- *
   * 1b. Read-vs-write separation on the staff-readable endpoints
   * ---------------------------------------------------------------- */
  section("1b — Staff may read campus config; only admins may change it");

  const currentSettings = (await admin("/api/settings")).data;

  const guardWritesSettings = await put(guard, "/api/settings", {
    ...currentSettings,
    campusName: "Compromised Campus",
  });
  check("guard cannot change campus settings", refused(guardWritesSettings), `status ${guardWritesSettings.status}`);

  const teacherWritesSettings = await put(teacher, "/api/settings", {
    ...currentSettings,
    campusName: "Compromised Campus",
  });
  check("teacher cannot change campus settings", refused(teacherWritesSettings), `status ${teacherWritesSettings.status}`);

  const settingsIntact = (await admin("/api/settings")).data;
  check(
    "campus settings were not modified",
    settingsIntact.campusName === currentSettings.campusName,
    settingsIntact.campusName,
  );

  const guardCreatesTeacher = await post(guard, "/api/teachers", {
    name: "Injected Teacher",
    employeeId: "HACK-1",
    email: "hack@dsvv.edu.in",
    phone: "9876500000",
    departmentId: "DEPT-001",
    designation: "Professor",
  });
  check("guard cannot create a staff record", refused(guardCreatesTeacher), `status ${guardCreatesTeacher.status}`);

  const guardDeletesTeacher = await del(guard, "/api/teachers/TCH-001");
  check("guard cannot delete a staff record", refused(guardDeletesTeacher), `status ${guardDeletesTeacher.status}`);

  const guardCreatesGuard = await post(guard, "/api/guards", {
    fullName: "Injected Guard",
    employeeId: "HACK-2",
    phone: "9876500000",
    shift: "Morning",
    shiftStart: "06:00",
    shiftEnd: "14:00",
    assignedGate: "Main Gate",
    status: "On Duty",
    joiningDate: "2026-01-01",
  });
  check("guard cannot add themselves to the roster", refused(guardCreatesGuard), `status ${guardCreatesGuard.status}`);

  const guardCreatesGate = await post(guard, "/api/gates", { name: "Back Door", active: true });
  check("guard cannot create a gate", refused(guardCreatesGate), `status ${guardCreatesGate.status}`);

  /* Global search is callable by staff but scoped inside the service, which is
     the control that actually matters — a teacher sees nothing at all, and a
     guard never sees the guard roster or student records. */
  const teacherSearch = await teacher("/api/search?q=ra");
  check(
    "teacher search returns no records",
    (teacherSearch.data?.length ?? 0) === 0,
    `${teacherSearch.data?.length} hits`,
  );

  const guardSearch = await guard("/api/search?q=ra");
  const guardGroups = new Set((guardSearch.data ?? []).map((h) => h.group));
  check("guard search excludes the guard roster", !guardGroups.has("Guards"), [...guardGroups].join(","));
  check("guard search excludes student records", !guardGroups.has("Students"), [...guardGroups].join(","));

  /* ---------------------------------------------------------------- *
   * 2. Invalid booking state transitions
   * ---------------------------------------------------------------- */
  section("2 — Invalid state transitions are refused at the gate");

  const closedStates = ["Rejected", "Cancelled", "Checked Out", "No Show", "Expired"];
  for (const state of closedStates) {
    const booking = one("SELECT id, status FROM visit_requests WHERE status = ? LIMIT 1", [state]);
    if (!booking) {
      console.log(`  SKIP  no booking in state ${state} to test`);
      continue;
    }
    const attempt = await post(guard, "/api/gate/check-in", {
      bookingId: booking.id,
      gate: "Main Gate",
    });
    check(`${state} booking cannot be checked in`, !attempt.ok, attempt.error?.message);

    const after = one("SELECT status FROM visit_requests WHERE id = ?", [booking.id]);
    check(`${state} booking was not mutated`, after.status === state, `now ${after.status}`);
  }

  const approved = one("SELECT id FROM visit_requests WHERE status = 'Approved' LIMIT 1");
  if (approved) {
    const out = await post(guard, "/api/gate/check-out", {
      bookingId: approved.id,
      gate: "Main Gate",
    });
    check("an approved (not arrived) visitor cannot be checked out", !out.ok, out.error?.message);
  }

  /* ---------------------------------------------------------------- *
   * 3. IDOR — cross-tenant access
   * ---------------------------------------------------------------- */
  section("3 — IDOR and cross-tenant access");

  // A booking hosted by a teacher other than the signed-in one.
  const me = one("SELECT ref_id FROM app_users WHERE email = 'anupama.sharma@dsvv.edu.in'");
  const foreign = one(
    "SELECT id, host_id, status FROM visit_requests WHERE host_id IS NOT NULL AND host_id <> ? AND status = 'Pending' LIMIT 1",
    [me.ref_id],
  );

  if (foreign) {
    const read = await teacher(`/api/bookings/${foreign.id}`);
    check(
      "teacher cannot read another teacher's booking",
      !read.ok,
      `status ${read.status}`,
    );

    const write = await patch(teacher, `/api/bookings/${foreign.id}`, { action: "approve" });
    check(
      "teacher cannot approve another teacher's booking",
      !write.ok,
      `status ${write.status} ${write.error?.message ?? ""}`,
    );

    const after = one("SELECT status FROM visit_requests WHERE id = ?", [foreign.id]);
    check(
      "the other teacher's booking is unchanged",
      after.status === foreign.status,
      `now ${after.status}`,
    );
  }

  // The teacher snapshot must not carry other hosts' bookings.
  const teacherState = await teacher("/api/state");
  const leaked = (teacherState.data?.state?.visitRequests ?? []).filter(
    (v) => v.hostId && v.hostId !== me.ref_id,
  );
  check("teacher snapshot contains no other host's bookings", leaked.length === 0, `${leaked.length} leaked`);

  // A student must not receive the visitor book.
  const studentState = await student("/api/state");
  const studentVisitors = studentState.data?.state?.visitors ?? [];
  check(
    "student snapshot does not carry the visitor directory",
    studentVisitors.length === 0,
    `${studentVisitors.length} visitor records`,
  );

  /* ---------------------------------------------------------------- *
   * 4. Privilege escalation attempts
   * ---------------------------------------------------------------- */
  section("4 — Privilege escalation");

  const escalate = await post(student, "/api/auth/login", {
    email: "aarav.mehta@dsvv.edu.in",
    password: "Student@123",
    expectedRole: "admin",
  });
  check("a student cannot sign in claiming the admin role", !escalate.ok, `status ${escalate.status}`);

  const session = await student("/api/auth/session");
  check(
    "the session reports the real role, not a requested one",
    session.data?.role === "student",
    String(session.data?.role),
  );

  // A client-supplied role in a mutation body must be ignored.
  const guardSelfPromote = await patch(guard, "/api/notifications", { role: "admin" });
  check(
    "a role field in a request body grants nothing",
    guardSelfPromote.ok || refused(guardSelfPromote),
    `status ${guardSelfPromote.status}`,
  );
  const stillGuard = await guard("/api/activity");
  check("guard is still refused the audit log afterwards", refused(stillGuard));

  /* ---------------------------------------------------------------- *
   * 5. Public endpoints must not leak
   * ---------------------------------------------------------------- */
  section("5 — Public endpoint data exposure");

  const directory = await anon("/api/public/directory");
  const directoryText = JSON.stringify(directory.data ?? {});
  check("public directory exposes no phone numbers", !/"phone"/.test(directoryText));
  check("public directory exposes no email addresses", !/"email":"[^"]+@/.test(directoryText));

  const target = one(
    "SELECT id, mobile, id_number, whatsapp_number FROM visit_requests WHERE id_number <> '' LIMIT 1",
  );
  const status = await post(anon, "/api/public/status", {
    bookingId: target.id,
    mobile: target.mobile,
  });
  check("a visitor can track their own booking", status.ok, status.error?.message);
  const statusText = JSON.stringify(status.data ?? {});
  check("status response hides the ID number", !statusText.includes(target.id_number));
  check(
    "status response hides the WhatsApp number",
    !target.whatsapp_number || !statusText.includes(target.whatsapp_number),
  );

  const wrongMobile = await post(anon, "/api/public/status", {
    bookingId: target.id,
    mobile: "9000000000",
  });
  check("tracking with the wrong mobile is refused", !wrongMobile.ok);

  /* ---------------------------------------------------------------- *
   * 6. Pass tokens
   * ---------------------------------------------------------------- */
  section("6 — Pass token strength and verification");

  const tokens = rows(
    "SELECT pass_token FROM visit_requests WHERE pass_token IS NOT NULL",
  ).map((r) => r.pass_token);

  check("issued passes carry a token", tokens.length > 0, `${tokens.length} tokens`);
  if (tokens.length) {
    const shortest = Math.min(...tokens.map((t) => t.length));
    check("pass tokens are long enough to resist guessing", shortest >= 24, `shortest ${shortest}`);
    check("pass tokens are unique", new Set(tokens).size === tokens.length);
    check(
      "pass tokens are not derived from the booking reference",
      !tokens.some((t) => t.includes("DSVV")),
    );
  }

  const forged = await post(guard, "/api/gate/verify", { token: "a".repeat(32) });
  check(
    "a forged token verifies to nothing",
    forged.ok ? forged.data?.ok === false : true,
    JSON.stringify(forged.data?.issues ?? forged.error),
  );

  const anonVerify = await post(anon, "/api/gate/verify", { token: tokens[0] ?? "x" });
  check("an anonymous caller cannot run gate verification", refused(anonVerify), `status ${anonVerify.status}`);

  /* ---------------------------------------------------------------- *
   * 7. Server-side input validation
   * ---------------------------------------------------------------- */
  section("7 — Server-side validation");

  const badVehicle = await post(guard, "/api/vehicles", {
    vehicleNumber: "!!!not-a-plate!!!",
    vehicleType: "Car",
    gate: "Main Gate",
  });
  check("an invalid number plate is rejected", !badVehicle.ok, badVehicle.error?.message);

  const badBooking = await post(anon, "/api/public/bookings", {
    fullName: "X",
    mobile: "123",
    gender: "Male",
    visitorType: "Guest",
    idType: "Aadhaar Card",
    idNumber: "1",
    purpose: "Teacher Meeting",
    visitDate: "not-a-date",
    visitTime: "99:99",
    numberOfVisitors: -5,
  });
  check("a malformed booking is rejected with field errors", !badBooking.ok);
  check(
    "field-level errors are returned",
    Object.keys(badBooking.error?.details ?? {}).length > 0,
    JSON.stringify(badBooking.error?.details ?? {}),
  );

  // Carries a real photograph, so the refusal is genuinely about the party
  // size rather than about the missing photo the schema would catch first.
  const hugeParty = await post(anon, "/api/public/bookings", {
    fullName: "Test Visitor",
    mobile: "9876500099",
    gender: "Male",
    visitorType: "Guest",
    idType: "Aadhaar Card",
    idNumber: "1234 5678 9012",
    photoId: await newPhotoId(BASE),
    purpose: "Delivery",
    visitDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    visitTime: "11:00",
    numberOfVisitors: 9999,
  });
  check("an absurd party size is rejected", !hugeParty.ok, hugeParty.error?.message);

  /* ---------------------------------------------------------------- *
   * 8. Injection attempts
   * ---------------------------------------------------------------- */
  section("8 — Injection resistance");

  const before = one("SELECT COUNT(*) AS c FROM visit_requests").c;
  const injection = await anon(
    `/api/public/status`,
  );
  const sqlAttempt = await post(anon, "/api/public/status", {
    bookingId: "' OR 1=1; DROP TABLE visit_requests;--",
    mobile: "9876500001",
  });
  check("an SQL injection string is treated as data", !sqlAttempt.ok, sqlAttempt.error?.message);
  const after = one("SELECT COUNT(*) AS c FROM visit_requests").c;
  check("the bookings table survives the injection attempt", after === before, `${before} → ${after}`);

  const searchInjection = await admin(
    `/api/search?q=${encodeURIComponent("%' OR '1'='1")}`,
  );
  check("a wildcard injection in search returns a normal result set", searchInjection.ok);

  const xss = await post(guard, "/api/incidents", {
    type: "Other",
    title: "<script>alert(1)</script>",
    location: "Main Gate",
    date: new Date().toISOString().slice(0, 10),
    time: "12:00",
    severity: "Low",
    description: "Injection probe from the security audit — safe to delete.",
  });
  if (xss.ok) {
    const stored = one("SELECT title FROM incidents WHERE id = ?", [xss.data.id]);
    // React escapes on render; the point is that it is stored verbatim as text
    // and never interpreted, rather than being silently rewritten.
    check(
      "script content is stored as inert text",
      stored.title === "<script>alert(1)</script>",
      stored.title,
    );
  }

  /* ---------------------------------------------------------------- *
   * 9. Session handling
   * ---------------------------------------------------------------- */
  section("9 — Session handling");

  const probe = makeSession();
  const login = await post(probe, "/api/auth/login", {
    email: "admin@dsvv.edu.in",
    password: "Admin@123",
  });
  check("sign-in succeeds", login.ok);
  const loginText = JSON.stringify(login.data ?? {});
  check("the session payload carries no password material", !/hash|salt|password/i.test(loginText));

  const beforeLogout = await probe("/api/activity");
  check("session is usable before sign-out", beforeLogout.ok);

  await post(probe, "/api/auth/logout");
  const afterLogout = await probe("/api/activity");
  check("the session is dead immediately after sign-out", refused(afterLogout), `status ${afterLogout.status}`);

  const forgedCookie = await fetch(`${BASE}/api/activity`, {
    headers: { Cookie: "csms_session=forged-token-value-123456" },
  });
  check("a forged session cookie is refused", forgedCookie.status === 401, `status ${forgedCookie.status}`);

  /* ---------------------------------------------------------------- *
   * 10. Error hygiene
   * ---------------------------------------------------------------- */
  section("10 — Error message hygiene");

  const missing = await admin("/api/bookings/DOES-NOT-EXIST");
  check("a missing record returns a clean 404", missing.status === 404, `status ${missing.status}`);
  const missingText = JSON.stringify(missing.error ?? {});
  check(
    "the error exposes no SQL or stack trace",
    !/SELECT|FROM|sqlite|at Object|node:/i.test(missingText),
    missingText,
  );

  const badLogin = await post(anon, "/api/auth/login", {
    email: "nobody@dsvv.edu.in",
    password: "whatever",
  });
  const knownBadPassword = await post(anon, "/api/auth/login", {
    email: "admin@dsvv.edu.in",
    password: "whatever",
  });
  check(
    "unknown account and wrong password give the same message",
    badLogin.error?.message === knownBadPassword.error?.message,
    `${badLogin.error?.message} vs ${knownBadPassword.error?.message}`,
  );

  /* ---------------------------------------------------------------- *
   * 10b. Visitor photographs
   *
   * A visitor's face is identity data: it must be impossible to create a
   * booking without one, and impossible to read one without a staff session.
   * ---------------------------------------------------------------- */
  section("10b — Visitor photographs");

  const auditPhotoId = await newPhotoId(BASE);
  const photoDay = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  /**
   * Books from a client of its own.
   *
   * `anon` has already spent part of the public booking quota by this point,
   * and section 11 spends the rest deliberately. Presenting a distinct
   * forwarded address keeps these cases testing the photograph rule rather
   * than the rate limiter.
   */
  const bookAs = async (address, payload) => {
    const response = await fetch(`${BASE}/api/public/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": address },
      body: JSON.stringify(payload),
    });
    const envelope = await response.json().catch(() => ({}));
    return { status: response.status, ...envelope };
  };

  const noPhoto = await bookAs("198.19.10.1", {
    fullName: "No Photo Visitor",
    mobile: "9876500077",
    gender: "Male",
    visitorType: "Guest",
    idType: "Aadhaar Card",
    idNumber: "1234 5678 9012",
    purpose: "Delivery",
    purposeDetail: "Delivering documents to the administration block.",
    address: "9 Test Road, Haridwar, Uttarakhand",
    visitDate: photoDay,
    visitTime: "11:30",
    numberOfVisitors: 1,
    guests: [],
  });
  check(
    "a booking without a photograph is refused by the server",
    !noPhoto.ok && noPhoto.error?.details?.photoId === "Visitor photo is required.",
    `status ${noPhoto.status} ${JSON.stringify(noPhoto.error ?? {})}`,
  );

  const forgedPhoto = await bookAs("198.19.10.2", {
    fullName: "Forged Photo Visitor",
    mobile: "9876500078",
    gender: "Male",
    visitorType: "Guest",
    idType: "Aadhaar Card",
    idNumber: "1234 5678 9012",
    photoId: "f".repeat(40),
    purpose: "Delivery",
    purposeDetail: "Delivering documents to the administration block.",
    address: "9 Test Road, Haridwar, Uttarakhand",
    visitDate: photoDay,
    visitTime: "11:45",
    numberOfVisitors: 1,
    guests: [],
  });
  check(
    "a photo id that resolves to no stored file is refused",
    !forgedPhoto.ok,
    forgedPhoto.error?.message,
  );

  const anonPhoto = await anon(`/api/visitor-photo/${auditPhotoId}`);
  check(
    "an unauthenticated caller cannot read a visitor photograph",
    anonPhoto.status === 401,
    `status ${anonPhoto.status}`,
  );

  const studentPhoto = await student(`/api/visitor-photo/${auditPhotoId}`);
  check(
    "a student session cannot read a visitor photograph",
    studentPhoto.status === 401,
    `status ${studentPhoto.status}`,
  );

  const guardPhoto = await guard(`/api/visitor-photo/${auditPhotoId}`);
  check(
    "the gate can read a visitor photograph",
    guardPhoto.status === 200,
    `status ${guardPhoto.status}`,
  );

  // A renamed script must not become a stored "photograph": the server decides
  // the format from the bytes, never from the name or the declared type.
  const scriptForm = new FormData();
  scriptForm.append(
    "photo",
    new Blob([Buffer.from("<script>alert(1)</script>")], { type: "image/jpeg" }),
    "payload.jpg",
  );
  const scriptUpload = await fetch(`${BASE}/api/public/visitor-photo`, {
    method: "POST",
    headers: { "X-Forwarded-For": "198.19.44.44" },
    body: scriptForm,
  });
  const scriptBody = await scriptUpload.json().catch(() => ({}));
  check(
    "a script renamed as a .jpg is refused by content sniffing",
    scriptUpload.status >= 400 && scriptBody.ok === false,
    `status ${scriptUpload.status}`,
  );

  /* ---------------------------------------------------------------- *
   * 11. Rate limiting
   *
   * Runs last on purpose: it deliberately exhausts the public booking quota
   * for this client, which would otherwise make later cases fail for the
   * wrong reason.
   * ---------------------------------------------------------------- */
  section("11 — Rate limiting on unauthenticated endpoints");

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const attempt = (n) =>
    post(anon, "/api/public/bookings", {
      fullName: "Rate Limit Probe",
      mobile: `98765${String(10000 + n).slice(-5)}`,
      gender: "Male",
      visitorType: "Guest",
      idType: "Aadhaar Card",
      idNumber: "1111 2222 3333",
      purpose: "Delivery",
      visitDate: tomorrow,
      visitTime: "11:00",
      numberOfVisitors: 1,
    });

  let limited = false;
  let attempts = 0;
  for (let n = 0; n < 14 && !limited; n += 1) {
    const response = await attempt(n);
    attempts += 1;
    if (response.status === 429) limited = true;
  }
  check(
    "the public booking endpoint is rate limited",
    limited,
    `no 429 after ${attempts} attempts`,
  );

  let statusLimited = false;
  for (let n = 0; n < 20 && !statusLimited; n += 1) {
    const response = await post(anon, "/api/public/status", {
      bookingId: "DSVV-VIS-2026-000001",
      mobile: "9000000000",
    });
    if (response.status === 429) statusLimited = true;
  }
  check("the status lookup is rate limited against guessing", statusLimited);

  // An authenticated staff caller must not be caught by the public quota.
  const staffStillWorks = await admin("/api/state");
  check("rate limiting does not affect signed-in staff", staffStillWorks.ok);

  console.log(`\n${"=".repeat(52)}`);
  console.log(`  PASSED: ${passed}    FAILED: ${failed}`);
  console.log("=".repeat(52));
  if (failures.length) {
    console.log("\nFindings:");
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nThe audit could not complete:", error);
  process.exit(1);
});
