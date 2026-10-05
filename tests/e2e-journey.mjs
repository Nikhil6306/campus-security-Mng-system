/**
 * End-to-end visitor journey against a running server.
 *
 * Walks the exact demonstration path — book, approve, verify, check in, meet,
 * check out — and asserts the database moved with it at every step, including
 * the gate's refusal cases and the WhatsApp delivery log.
 *
 *   npm run dev          # in one terminal
 *   node tests/e2e-journey.mjs
 *
 * Reads the database directly for the assertions the API does not expose, so a
 * pass here means the rows really changed rather than that a response was
 * shaped correctly.
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

/* ------------------------------------------------------------------ *
 * HTTP helpers — one cookie jar per role, as a browser would hold.
 * ------------------------------------------------------------------ */

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
    const setCookie = response.headers.getSetCookie?.() ?? [];
    for (const entry of setCookie) {
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

const post = (call, path, body) =>
  call(path, { method: "POST", body: JSON.stringify(body ?? {}) });
const patch = (call, path, body) =>
  call(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
const put = (call, path, body) => call(path, { method: "PUT", body: JSON.stringify(body) });

const db = () => new DatabaseSync(DB_PATH, { readOnly: true });

function row(sql, params = []) {
  const handle = db();
  try {
    return handle.prepare(sql).get(...params);
  } finally {
    handle.close();
  }
}

function rows(sql, params = []) {
  const handle = db();
  try {
    return handle.prepare(sql).all(...params);
  } finally {
    handle.close();
  }
}

const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ *
 * The journey
 * ------------------------------------------------------------------ */

async function main() {
  console.log(`Campus Security — end-to-end journey against ${BASE}\n`);

  const anon = makeSession();
  const admin = makeSession();
  const guard = makeSession();
  const teacher = makeSession();

  /* --- Sign in ---------------------------------------------------- */
  section("TEST 0 — Authentication and role separation");

  const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD;
  if (!demoPassword) {
    throw new Error("Set DEMO_ACCOUNT_PASSWORD to match the server local demo seed.");
  }

  const adminLogin = await post(admin, "/api/auth/login", {
    email: "admin@dsvv.edu.in",
    password: demoPassword,
  });
  check("admin signs in", adminLogin.ok && adminLogin.data?.role === "admin");

  const guardLogin = await post(guard, "/api/auth/login", {
    email: "security@dsvv.edu.in",
    password: demoPassword,
  });
  check("security guard signs in", guardLogin.ok && guardLogin.data?.role === "security");

  const teacherLogin = await post(teacher, "/api/auth/login", {
    email: "anupama.sharma@dsvv.edu.in",
    password: demoPassword,
  });
  check("teacher signs in", teacherLogin.ok && teacherLogin.data?.role === "teacher");

  const badLogin = await post(anon, "/api/auth/login", {
    email: "admin@dsvv.edu.in",
    password: "wrong-password",
  });
  check("wrong password is refused", !badLogin.ok && badLogin.status === 401);

  const anonAdmin = await anon("/api/activity");
  check("signed-out caller cannot read the audit log", !anonAdmin.ok && anonAdmin.status === 401);

  const teacherGuards = await teacher("/api/guards");
  check(
    "teacher cannot read the guard roster",
    !teacherGuards.ok && teacherGuards.status === 403,
    `got ${teacherGuards.status}`,
  );

  const guardActivity = await guard("/api/activity");
  check(
    "guard cannot read the admin audit log",
    !guardActivity.ok && guardActivity.status === 403,
    `got ${guardActivity.status}`,
  );

  /* --- Test window ------------------------------------------------- */
  // Check-in is only valid on the visit date itself, so the journey has to book
  // for today. Campus visiting hours and the host's working pattern both gate
  // which of today's slots are offered, and this run may happen at any hour —
  // so both windows are opened for the duration and restored at the end.
  const original = (await admin("/api/settings")).data;
  await put(admin, "/api/settings", {
    ...original,
    visitingHoursFrom: "00:00",
    visitingHoursTo: "23:59",
  });

  /* --- TEST 1: visitor books -------------------------------------- */
  section("TEST 1 — Visitor pre-books a campus visit");

  const directory = await anon("/api/public/directory");
  check("public directory lists hosts from the database", (directory.data?.hosts?.length ?? 0) > 0);

  const host = directory.data.hosts[0];
  const slotDay = today();

  const originalAvailability = (await admin(`/api/teachers/${host.id}/availability`)).data;
  // A 10-minute grid across the whole day, so a slot still in the future exists
  // whatever time this runs. (Check-in is only valid on the visit date, so the
  // journey has to book for today.)
  const widened = await put(admin, `/api/teachers/${host.id}/availability`, {
    days: [1, 2, 3, 4, 5, 6, 7],
    startTime: "00:00",
    endTime: "23:59",
    slotMinutes: 10,
    blocked: [],
  });
  check("host availability can be configured", widened.ok, widened.error?.message);

  const slots = await anon(`/api/public/slots?hostId=${host.id}&date=${slotDay}`);
  const free = (slots.data?.slots ?? []).filter((s) => s.available);
  check("slot grid is returned for the host", (slots.data?.slots?.length ?? 0) > 0);
  check(
    "at least one slot is bookable today",
    free.length > 0,
    free.length === 0
      ? "every slot today has passed — the gate journey needs a same-day slot, so run this before 23:45"
      : `${free.length} free`,
  );

  const stamp = Date.now().toString().slice(-6);
  const mobile = `9${stamp}999`.slice(0, 10);
  // The soonest free slot. Taking the last one would work too, but the first
  // keeps the booking close to "now", which is what a real visitor would pick.
  const slotTime = free.length ? free[0].time : "10:00";

  // Every booking now carries a photograph. Stored first, then named by id —
  // the same two steps the booking form takes.
  const photoId = await newPhotoId(BASE);

  const bookingPayload = {
    fullName: "Test Visitor",
    mobile,
    email: "e2e.visitor@example.com",
    gender: "Male",
    whatsappCountryCode: "+91",
    whatsappNumber: mobile,
    visitorType: "Guest",
    idType: "Aadhaar Card",
    idNumber: "9999 8888 7777",
    photoId,
    organization: "E2E Demo Systems",
    address: "1 Test Road, Haridwar",
    emergencyContact: "9876500011",
    purpose: "Teacher Meeting",
    // The public form requires a description of the purpose and a house
    // address, and every additional visitor must be named.
    purposeDetail: "Automated end-to-end journey covering the full visit lifecycle.",
    hostId: host.id,
    departmentId: host.departmentId,
    visitDate: slotDay,
    visitTime: slotTime,
    expectedDuration: "30 minutes",
    numberOfVisitors: 2,
    guests: [
      {
        fullName: "Test Companion",
        mobile: "9876500022",
        // Structurally valid (Verhoeff) and belonging to nobody.
        aadhaar: "234567890124",
        relation: "Colleague",
        address: "1 Test Road, Haridwar, Uttarakhand",
      },
    ],
    vehicleRequired: true,
    vehicleNumber: "UK08AB1234",
    notes: "Automated end-to-end journey.",
  };

  const created = await post(anon, "/api/public/bookings", bookingPayload);
  check("booking is created", created.ok, created.error?.message);
  if (!created.ok) return finish(original, admin, host.id, originalAvailability);

  const bookingId = created.data.id;
  check(
    "booking reference uses the DSVV-VIS-<year>-<serial> format",
    /^DSVV-VIS-\d{4}-\d{6}$/.test(bookingId),
    bookingId,
  );

  const stored = row("SELECT * FROM visit_requests WHERE id = ?", [bookingId]);
  check("booking row exists in the database", Boolean(stored));
  check("booking starts as Pending", stored?.status === "Pending", stored?.status);
  check(
    "the visitor photograph is stored as a path, not as image data",
    stored?.photo_url === `visitor-photos/${photoId}.jpg`,
    stored?.photo_url,
  );
  check("WhatsApp number is stored on the booking", stored?.whatsapp_number === mobile);

  const guests = rows("SELECT * FROM visit_guests WHERE booking_id = ?", [bookingId]);
  check("the accompanying visitor is stored", guests.length === 1);
  check(
    "the guest row keeps only the last four Aadhaar digits",
    guests[0]?.aadhaar_last4 === "0124" &&
      !String(guests[0]?.aadhaar_ciphertext ?? "").includes("234567890124"),
  );

  /* --- Duplicate prevention --------------------------------------- */
  const duplicate = await post(anon, "/api/public/bookings", bookingPayload);
  check(
    "duplicate booking is refused",
    !duplicate.ok && /already exists|just been taken/i.test(duplicate.error?.message ?? ""),
    duplicate.error?.message,
  );

  const pastBooking = await post(anon, "/api/public/bookings", {
    ...bookingPayload,
    mobile: "9000000001",
    whatsappNumber: "9000000001",
    visitDate: "2020-01-01",
  });
  check("a booking in the past is refused", !pastBooking.ok, pastBooking.error?.message);

  /* --- WhatsApp: booking created ---------------------------------- */
  section("TEST 2 — WhatsApp booking confirmation");

  await new Promise((r) => setTimeout(r, 400));
  const createdMsg = row(
    "SELECT * FROM whatsapp_messages WHERE booking_id = ? AND message_type = 'booking_created'",
    [bookingId],
  );
  check("a booking_created WhatsApp row was written", Boolean(createdMsg));
  check(
    "recipient is normalised to E.164 digits",
    createdMsg?.phone_number === `91${mobile}`,
    createdMsg?.phone_number,
  );
  check("message carries the booking reference", createdMsg?.body?.includes(bookingId));
  check("message carries a visitor pass link", createdMsg?.body?.includes("/visitor/pass/"));
  check(
    "delivery status is recorded",
    ["SENT", "QUEUED", "FAILED"].includes(createdMsg?.status),
    createdMsg?.status,
  );
  check(
    "provider is recorded honestly (mock when unconfigured)",
    Boolean(createdMsg?.provider),
    createdMsg?.provider,
  );

  /* --- TEST 3: admin approves ------------------------------------- */
  section("TEST 3 — Admin approves the booking");

  const beforeStats = (await admin("/api/state")).data;
  const pendingBefore = beforeStats.state.visitRequests.filter(
    (v) => v.status === "Pending",
  ).length;
  check("admin snapshot includes the new booking",
    beforeStats.state.visitRequests.some((v) => v.id === bookingId));

  const approved = await patch(admin, `/api/bookings/${bookingId}`, { action: "approve" });
  check("approve succeeds", approved.ok, approved.error?.message);
  check("status becomes Approved", approved.data?.status === "Approved");
  check("a pass token is issued", Boolean(approved.data?.passToken));
  check("a badge number is issued", Boolean(approved.data?.badgeNumber));

  const passToken = approved.data.passToken;
  const afterApprove = row("SELECT status, pass_token FROM visit_requests WHERE id = ?", [bookingId]);
  check("database reflects the approval", afterApprove?.status === "Approved");

  const approvalActivity = row(
    "SELECT * FROM activity_logs WHERE entity_id = ? AND action = 'booking.approved'",
    [bookingId],
  );
  check("approval is written to the audit log", Boolean(approvalActivity));
  check(
    "audit entry names the real visitor",
    approvalActivity?.summary?.includes("Test Visitor"),
    approvalActivity?.summary,
  );

  await new Promise((r) => setTimeout(r, 400));
  const approvedMsg = row(
    "SELECT * FROM whatsapp_messages WHERE booking_id = ? AND message_type = 'booking_approved'",
    [bookingId],
  );
  check("an approval WhatsApp row was written", Boolean(approvedMsg));
  check(
    "approval message links the pass by its secure token",
    approvedMsg?.body?.includes(passToken),
  );

  /* --- TEST 4: visitor tracks status ------------------------------ */
  section("TEST 4 — Visitor tracks the booking and opens the pass");

  const status = await post(anon, "/api/public/status", { bookingId, mobile });
  check("status lookup succeeds with reference + mobile", status.ok, status.error?.message);
  check("status reads APPROVED", status.data?.booking?.statusCode === "APPROVED");

  const wrongMobile = await post(anon, "/api/public/status", {
    bookingId,
    mobile: "9000000009",
  });
  check("status lookup with the wrong mobile is refused", !wrongMobile.ok);

  const statusBody = JSON.stringify(status.data);
  check("status payload does not leak the visitor's ID number", !statusBody.includes("9999 8888 7777"));

  /* --- TEST 5: gate verification and refusals --------------------- */
  section("TEST 5 — Security verifies the QR pass");

  const badToken = await post(guard, "/api/gate/verify", { token: "not-a-real-token" });
  check(
    "an unknown QR token is refused",
    !badToken.ok || badToken.data?.ok === false,
    JSON.stringify(badToken.data?.issues ?? badToken.error),
  );

  const verify = await post(guard, "/api/gate/verify", { token: passToken });
  check("a genuine QR token verifies", verify.data?.ok === true, JSON.stringify(verify.data?.issues));
  check("verification proposes check-in", verify.data?.nextAction === "check-in");
  check("guard sees the visitor's details", verify.data?.booking?.fullName === "Test Visitor");
  check("guard sees the host", verify.data?.booking?.hostName === host.name);

  const anonCheckIn = await post(anon, "/api/gate/check-in", { bookingId, gate: "Main Gate" });
  check(
    "a signed-out caller cannot check anyone in",
    !anonCheckIn.ok && anonCheckIn.status === 401,
  );

  /* --- TEST 6: check-in ------------------------------------------- */
  section("TEST 6 — Guard checks the visitor in");

  const checkIn = await post(guard, "/api/gate/check-in", { bookingId, gate: "Main Gate" });
  check("check-in succeeds", checkIn.ok, checkIn.error?.message);
  check("status becomes Checked In", checkIn.data?.booking?.status === "Checked In");
  check("the acting guard is recorded", Boolean(checkIn.data?.guardName));

  const inLog = row(
    "SELECT * FROM check_logs WHERE visit_request_id = ? AND direction = 'In'",
    [bookingId],
  );
  check("a gate check-in log row exists", Boolean(inLog));
  check("the log records the gate", inLog?.gate === "Main Gate");

  const doubleCheckIn = await post(guard, "/api/gate/check-in", { bookingId, gate: "Main Gate" });
  check("a second check-in is refused", !doubleCheckIn.ok, doubleCheckIn.error?.message);
  check(
    "no duplicate check-in log was written",
    rows("SELECT id FROM check_logs WHERE visit_request_id = ? AND direction = 'In'", [bookingId])
      .length === 1,
  );

  const checkInActivity = row(
    "SELECT * FROM activity_logs WHERE entity_id = ? AND action = 'gate.check_in'",
    [bookingId],
  );
  check("check-in is written to the audit log", Boolean(checkInActivity));

  await new Promise((r) => setTimeout(r, 400));
  const checkInMsg = row(
    "SELECT * FROM whatsapp_messages WHERE booking_id = ? AND message_type = 'visitor_checked_in'",
    [bookingId],
  );
  check("a check-in WhatsApp row was written", Boolean(checkInMsg));

  /* --- TEST 7: admin dashboard reflects it ------------------------ */
  section("TEST 7 — Admin dashboard reflects the arrival");

  const afterCheckIn = (await admin("/api/state")).data;
  const inside = afterCheckIn.state.visitRequests.filter((v) =>
    ["Checked In", "Meeting In Progress"].includes(v.status),
  );
  check("the visitor now counts as inside campus", inside.some((v) => v.id === bookingId));

  const pendingAfter = afterCheckIn.state.visitRequests.filter(
    (v) => v.status === "Pending",
  ).length;
  check("pending approvals decreased", pendingAfter < pendingBefore, `${pendingBefore} → ${pendingAfter}`);

  const feed = await admin("/api/activity?limit=20");
  check(
    "the live activity feed shows the check-in",
    feed.data?.some((entry) => entry.entityId === bookingId && entry.action === "gate.check_in"),
  );

  /* --- TEST 8: teacher meeting ------------------------------------ */
  section("TEST 8 — Teacher runs the meeting");

  const teacherState = (await teacher("/api/state")).data;
  const visible = teacherState.state.visitRequests;
  check("teacher sees their own meeting", visible.some((v) => v.id === bookingId));
  check(
    "teacher sees only their own meetings",
    visible.every((v) => v.hostId === host.id),
    `${visible.length} bookings, host ids: ${[...new Set(visible.map((v) => v.hostId))].join(",")}`,
  );

  const started = await patch(teacher, `/api/bookings/${bookingId}`, { action: "start-meeting" });
  check("teacher starts the meeting", started.ok, started.error?.message);
  check("status becomes Meeting In Progress", started.data?.status === "Meeting In Progress");

  const completed = await patch(teacher, `/api/bookings/${bookingId}`, {
    action: "complete-meeting",
  });
  check("teacher completes the meeting", completed.ok, completed.error?.message);
  check("meeting end time is stamped", Boolean(completed.data?.meetingEndedAt));

  /* --- TEST 9: check-out ------------------------------------------ */
  section("TEST 9 — Guard checks the visitor out");

  const checkOut = await post(guard, "/api/gate/check-out", { bookingId, gate: "Main Gate" });
  check("check-out succeeds", checkOut.ok, checkOut.error?.message);
  check("status becomes Checked Out", checkOut.data?.booking?.status === "Checked Out");

  const outLog = row(
    "SELECT * FROM check_logs WHERE visit_request_id = ? AND direction = 'Out'",
    [bookingId],
  );
  check("a gate check-out log row exists", Boolean(outLog));

  const doubleOut = await post(guard, "/api/gate/check-out", { bookingId, gate: "Main Gate" });
  check("a second check-out is refused", !doubleOut.ok, doubleOut.error?.message);

  await new Promise((r) => setTimeout(r, 400));
  const outMsg = row(
    "SELECT * FROM whatsapp_messages WHERE booking_id = ? AND message_type = 'visitor_checked_out'",
    [bookingId],
  );
  check("a check-out WhatsApp row was written", Boolean(outMsg));

  const finalState = (await admin("/api/state")).data;
  const stillInside = finalState.state.visitRequests.filter(
    (v) => ["Checked In", "Meeting In Progress"].includes(v.status) && v.id === bookingId,
  );
  check("the visitor no longer counts as inside", stillInside.length === 0);

  /* --- TEST 10: no duplicate WhatsApp messages -------------------- */
  section("TEST 10 — WhatsApp delivery log integrity");

  const allMessages = rows(
    "SELECT message_type, COUNT(*) AS c FROM whatsapp_messages WHERE booking_id = ? GROUP BY message_type",
    [bookingId],
  );
  check(
    "no message type was sent twice",
    allMessages.every((m) => m.c === 1),
    JSON.stringify(allMessages),
  );
  check(
    "the full lifecycle was logged",
    allMessages.length >= 4,
    allMessages.map((m) => m.message_type).join(", "),
  );

  const overview = await admin("/api/whatsapp");
  check("admin can read the WhatsApp overview", overview.ok);
  check(
    "provider status is reported",
    typeof overview.data?.status?.live === "boolean",
    JSON.stringify(overview.data?.status),
  );

  const guardWhatsapp = await guard("/api/whatsapp");
  check(
    "a guard cannot read the WhatsApp log",
    !guardWhatsapp.ok && guardWhatsapp.status === 403,
  );

  /* --- TEST 11: incidents ----------------------------------------- */
  section("TEST 11 — Incident lifecycle");

  const incident = await post(guard, "/api/incidents", {
    type: "Suspicious Activity",
    title: "E2E test incident",
    location: "Main Gate",
    date: today(),
    time: "12:00",
    severity: "Medium",
    description: "Raised by the automated end-to-end journey.",
  });
  check("guard reports an incident", incident.ok, incident.error?.message);
  const incidentId = incident.data?.id;

  const assigned = await patch(admin, `/api/incidents/${incidentId}`, {
    status: "Investigating",
  });
  check("admin moves it to Investigating", assigned.ok && assigned.data?.status === "Investigating");

  const resolved = await patch(admin, `/api/incidents/${incidentId}`, {
    status: "Resolved",
    resolutionNote: "Closed by the automated journey.",
  });
  check("admin resolves it", resolved.ok && resolved.data?.status === "Resolved");

  /* --- TEST 12: vehicles ------------------------------------------ */
  section("TEST 12 — Vehicle entry and exit");

  const plate = `UK07AB${String(Math.floor(Math.random() * 9000) + 1000)}`;
  const vehicle = await post(guard, "/api/vehicles", {
    vehicleNumber: plate,
    vehicleType: "Car",
    visitorName: "Test Visitor",
    driverName: "Test Driver",
    gate: "Main Gate",
    purpose: "E2E journey",
  });
  check("vehicle entry is recorded", vehicle.ok, vehicle.error?.message);
  check("vehicle status is Inside", vehicle.data?.status === "Inside");

  const duplicateVehicle = await post(guard, "/api/vehicles", {
    vehicleNumber: plate,
    vehicleType: "Car",
    gate: "Main Gate",
  });
  check("the same plate cannot be inside twice", !duplicateVehicle.ok, duplicateVehicle.error?.message);

  const exited = await patch(guard, `/api/vehicles/${vehicle.data.id}`, { action: "exit" });
  check("vehicle exit is recorded", exited.ok && exited.data?.status === "Exited");

  /* --- TEST 13: emergency ----------------------------------------- */
  section("TEST 13 — Emergency alert");

  const emergency = await post(guard, "/api/emergency", {
    type: "Medical Emergency",
    severity: "Critical",
    location: "Main Gate",
    note: "Raised by the automated end-to-end journey.",
  });
  check("emergency alert is raised", emergency.ok, emergency.error?.message);

  const emergencyActivity = row(
    "SELECT * FROM activity_logs WHERE entity_id = ? AND action LIKE 'emergency%'",
    [emergency.data?.id],
  );
  check("the alert is written to the audit log", Boolean(emergencyActivity));

  const emResolved = await patch(admin, `/api/emergency/${emergency.data.id}`, {
    status: "Resolved",
  });
  check("admin resolves the alert", emResolved.ok && emResolved.data?.status === "Resolved");

  /* --- TEST 14: reports and search -------------------------------- */
  section("TEST 14 — Reports, search and settings");

  const report = await admin("/api/reports?kind=visitors");
  check("visitor report is generated", report.ok, report.error?.message);
  check("report has rows from the database", (report.data?.rows?.length ?? 0) > 0);
  check("report has chart series", (report.data?.charts?.length ?? 0) > 0);

  const gateReport = await admin("/api/reports?kind=guards");
  check("guard activity report is generated", gateReport.ok, gateReport.error?.message);

  const search = await admin(`/api/search?q=${encodeURIComponent(bookingId)}`);
  check("global search finds the booking", (search.data?.length ?? 0) > 0);

  const guardSearch = await admin("/api/search?q=Amit");
  const guardHit = (guardSearch.data ?? []).find((h) => h.href?.startsWith("/admin/guards/"));
  check("global search returns a guard profile link", Boolean(guardHit), guardHit?.href);

  const gates = await admin("/api/gates");
  check("gate roster is returned", gates.ok && Array.isArray(gates.data), gates.error?.message);
  check("gates report their traffic", typeof gates.data?.[0]?.activity?.entriesToday === "number");

  const guardsRoster = await admin("/api/guards");
  check("guard roster is returned with today's counters", guardsRoster.ok &&
    typeof guardsRoster.data?.[0]?.today?.checkIns === "number");

  /* --- Restore ---------------------------------------------------- */
  await finish(original, admin, host.id, originalAvailability);
}

async function finish(original, admin, hostId, availability) {
  if (original) {
    await put(admin, "/api/settings", original);
  }
  if (hostId && availability) {
    await put(admin, `/api/teachers/${hostId}/availability`, {
      days: availability.days,
      startTime: availability.startTime,
      endTime: availability.endTime,
      slotMinutes: availability.slotMinutes,
      blocked: availability.blocked ?? [],
    });
  }
  console.log(`\n${"=".repeat(52)}`);
  console.log(`  PASSED: ${passed}    FAILED: ${failed}`);
  console.log("=".repeat(52));
  if (failures.length) {
    console.log("\nFailures:");
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nThe journey could not complete:", error);
  process.exit(1);
});
