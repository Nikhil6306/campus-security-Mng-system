/**
 * Pre-booking end-to-end: the party, the pass, and what must never leak.
 *
 *   npm run dev            # in one terminal
 *   node tests/prebooking.mjs
 *
 * Two halves. The first exercises the Aadhaar helpers directly — Node strips
 * the TypeScript, so these are the shipped functions and not a copy. The
 * second drives the public API against a running server and then reads the
 * database to confirm the rows really match what the API claimed.
 */

import assert from "node:assert/strict";
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

async function test(label, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${label}`);
  } catch (error) {
    failed += 1;
    failures.push(`${label} — ${error.message}`);
    console.log(`  FAIL  ${label}`);
    console.log(`        ${error.message}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

/* ------------------------------------------------------------------ *
 * Fixtures
 *
 * Aadhaar numbers that satisfy the Verhoeff check digit. They are structurally
 * valid and belong to nobody — the system never claims otherwise.
 * ------------------------------------------------------------------ */

const AADHAAR = {
  a: "234567890124",
  b: "987654321012",
  c: "567890123458",
  d: "345678901238",
};

const futureDate = (days) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

let sequence = 0;
const uniqueMobile = () => `98${String(70_000_000 + (sequence += 1)).slice(0, 8)}`;

const GUEST_NAMES = ["Asha Verma", "Rohit Nair", "Meera Iyer", "Vikram Rao", "Nita Bose"];

function guest(index, aadhaar) {
  return {
    // Names carry no digits — the name rule rejects them, as it should.
    fullName: GUEST_NAMES[(index - 2) % GUEST_NAMES.length],
    mobile: uniqueMobile(),
    aadhaar,
    relation: "Relative",
    address: "12 Station Road, Haridwar, Uttarakhand",
  };
}

/**
 * One stored photograph, reused by every payload in this suite.
 *
 * Photographs are mandatory, but they are not what this file is testing — the
 * dedicated cases live in `tests/visitor-photo.mjs`. Uploading once keeps the
 * party, pass and disclosure assertions readable.
 */
let sharedPhotoId;

function bookingPayload(overrides = {}) {
  return {
    photoId: sharedPhotoId,
    fullName: "Primary Visitor",
    mobile: uniqueMobile(),
    email: "visitor@example.com",
    gender: "Female",
    visitorType: "Prospective Student",
    idType: "Aadhaar Card",
    idNumber: "123456789012",
    purpose: "Campus Visit",
    purposeDetail: "Visiting the campus before applying for admission.",
    visitDate: futureDate(5),
    visitTime: "11:00",
    expectedDuration: "1 hour",
    numberOfVisitors: 1,
    vehicleRequired: false,
    address: "44 Ganga Vihar, Haridwar, Uttarakhand",
    guests: [],
    ...overrides,
  };
}

/**
 * Each call presents a distinct forwarded address.
 *
 * The public endpoints are rate limited per client, which is exactly what
 * production needs and what a suite of dozens of submissions would otherwise
 * trip. Varying the address exercises the real limiter rather than disabling
 * it; `sameClient` opts back in where a test is *about* the limit.
 */
let client = 0;
async function postJson(path, body, { sameClient } = {}) {
  const forwarded = sameClient ?? `203.0.113.${(client += 1) % 254}.${client}`;
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": forwarded },
    body: JSON.stringify(body),
  });
  const envelope = await response.json().catch(() => ({}));
  return { status: response.status, envelope };
}

/** A refusal is either a schema failure (422) or a policy failure (400). */
function assertRefused(status, envelope) {
  assert.ok(
    status === 400 || status === 422,
    `expected 400 or 422, got ${status}: ${JSON.stringify(envelope)}`,
  );
  assert.equal(envelope.ok, false);
}

/* ------------------------------------------------------------------ *
 * 1 — Aadhaar handling, exercised directly
 * ------------------------------------------------------------------ */

async function aadhaarSuite() {
  section("Aadhaar format validation");

  const { validateAadhaar, normaliseAadhaar, maskAadhaar } = await import(
    "../lib/validation.ts"
  );

  await test("a well-formed number is accepted", () => {
    assert.equal(validateAadhaar(AADHAAR.a), undefined);
    assert.equal(validateAadhaar("2345 6789 0124"), undefined);
  });

  await test("a wrong check digit is rejected", () => {
    assert.ok(validateAadhaar("234567890123"));
  });

  await test("a transposition is rejected", () => {
    assert.ok(validateAadhaar("324567890124"));
  });

  await test("fewer than twelve digits is rejected", () => {
    assert.ok(validateAadhaar("23456789012"));
  });

  await test("a number starting 0 or 1 is rejected", () => {
    assert.ok(validateAadhaar("012345678901"));
    assert.ok(validateAadhaar("112345678901"));
  });

  await test("an empty value is rejected", () => {
    assert.ok(validateAadhaar(""));
  });

  await test("grouping characters are stripped", () => {
    assert.equal(normaliseAadhaar("2345 6789-0124"), "234567890124");
  });

  await test("masking shows only the last four digits", () => {
    assert.equal(maskAadhaar("0124"), "XXXXXXXX0124");
    assert.ok(!maskAadhaar("0124").includes("2345"));
  });

  section("Aadhaar at rest");

  process.env.AADHAAR_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  const sealed = await import("../lib/server/aadhaar.ts");

  await test("encryption round-trips under a configured key", () => {
    const record = sealed.sealAadhaar(AADHAAR.a);
    assert.ok(record.ciphertext, "expected ciphertext");
    assert.equal(record.last4, "0124");
    assert.equal(sealed.openAadhaar(record.ciphertext), AADHAAR.a);
  });

  await test("the stored envelope contains no plaintext", () => {
    const record = sealed.sealAadhaar(AADHAAR.b);
    assert.ok(!record.ciphertext.includes(AADHAAR.b));
    assert.ok(!record.ciphertext.includes(AADHAAR.b.slice(0, 8)));
  });

  await test("two seals of the same number differ (random IV)", () => {
    const first = sealed.sealAadhaar(AADHAAR.c).ciphertext;
    const second = sealed.sealAadhaar(AADHAAR.c).ciphertext;
    assert.notEqual(first, second);
  });

  await test("the duplicate digest is stable for the same number", () => {
    assert.equal(
      sealed.sealAadhaar(AADHAAR.c).hash,
      sealed.sealAadhaar(AADHAAR.c).hash,
    );
    assert.notEqual(sealed.sealAadhaar(AADHAAR.c).hash, sealed.sealAadhaar(AADHAAR.d).hash);
  });

  await test("a tampered envelope does not decrypt", () => {
    const record = sealed.sealAadhaar(AADHAAR.a);
    const parts = record.ciphertext.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("A") ? "BB" : "AA");
    assert.equal(sealed.openAadhaar(parts.join(".")), null);
  });

  await test("a wrong key does not decrypt", () => {
    const record = sealed.sealAadhaar(AADHAAR.a);
    process.env.AADHAAR_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    assert.equal(sealed.openAadhaar(record.ciphertext), null);
  });

  await test("without a key only the last four digits are retained", () => {
    delete process.env.AADHAAR_ENCRYPTION_KEY;
    const record = sealed.sealAadhaar(AADHAAR.a);
    assert.equal(record.ciphertext, null);
    assert.equal(record.hash, null);
    assert.equal(record.last4, "0124");
  });
}

/* ------------------------------------------------------------------ *
 * 2 — The public booking API
 * ------------------------------------------------------------------ */

const created = [];

async function bookingSuite() {
  section("Booking creation");

  let single;
  await test("one visitor books with no accompanying party", async () => {
    const { status, envelope } = await postJson("/api/public/bookings", bookingPayload());
    assert.equal(status, 200, JSON.stringify(envelope));
    assert.ok(envelope.ok);
    single = envelope.data;
    created.push(single.id);
    assert.match(single.id, /^DSVV-VIS-\d{4}-\d{6}$/);
    assert.equal(single.numberOfVisitors, 1);
    assert.ok(single.passToken, "a pass token is issued at submission");
  });

  await test("two visitors: one guest is stored", async () => {
    const mobile = uniqueMobile();
    const { status, envelope } = await postJson(
      "/api/public/bookings",
      bookingPayload({
        mobile,
        visitTime: "11:30",
        numberOfVisitors: 2,
        guests: [guest(2, AADHAAR.a)],
      }),
    );
    assert.equal(status, 200, JSON.stringify(envelope));
    created.push(envelope.data.id);

    const db = new DatabaseSync(DB_PATH);
    const rows = db
      .prepare("SELECT * FROM visit_guests WHERE booking_id = ? ORDER BY position")
      .all(envelope.data.id);
    db.close();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].position, 2);
    assert.equal(rows[0].aadhaar_last4, AADHAAR.a.slice(-4));
  });

  await test("five visitors: four guests are stored in order", async () => {
    const { status, envelope } = await postJson(
      "/api/public/bookings",
      bookingPayload({
        visitTime: "12:00",
        numberOfVisitors: 5,
        guests: [
          guest(2, AADHAAR.a),
          guest(3, AADHAAR.b),
          guest(4, AADHAAR.c),
          guest(5, AADHAAR.d),
        ],
      }),
    );
    assert.equal(status, 200, JSON.stringify(envelope));
    created.push(envelope.data.id);

    const db = new DatabaseSync(DB_PATH);
    const rows = db
      .prepare("SELECT * FROM visit_guests WHERE booking_id = ? ORDER BY position")
      .all(envelope.data.id);
    db.close();
    assert.equal(rows.length, 4);
    assert.deepEqual(
      rows.map((r) => r.position),
      [2, 3, 4, 5],
    );
  });

  section("Server-side rejection");

  const rejects = [
    ["an invalid WhatsApp number", { mobile: "12345" }],
    ["an invalid email", { email: "not-an-email" }],
    ["a missing name", { fullName: "" }],
    ["a past visit date", { visitDate: futureDate(-3) }],
    ["an invalid time", { visitTime: "99:99" }],
    ["a zero visitor count", { numberOfVisitors: 0 }],
    ["an empty house address", { address: "" }],
    ["an empty purpose detail", { purposeDetail: "" }],
    ["a missing visitor photograph", { photoId: undefined }],
    ["a photo id that matches no stored file", { photoId: "z".repeat(40) }],
  ];

  for (const [label, override] of rejects) {
    await test(`${label} is refused`, async () => {
      const { status, envelope } = await postJson(
        "/api/public/bookings",
        bookingPayload(override),
      );
      assertRefused(status, envelope);
    });
  }

  await test("a malformed Aadhaar is refused", async () => {
    const { status, envelope } = await postJson(
      "/api/public/bookings",
      bookingPayload({
        numberOfVisitors: 2,
        guests: [guest(2, "234567890123")],
      }),
    );
    assertRefused(status, envelope);
    assert.ok(JSON.stringify(envelope).toLowerCase().includes("aadhaar"));
  });

  await test("a guest list that disagrees with the headcount is refused", async () => {
    const { status, envelope } = await postJson(
      "/api/public/bookings",
      bookingPayload({ numberOfVisitors: 3, guests: [guest(2, AADHAAR.a)] }),
    );
    assertRefused(status, envelope);
  });

  await test("the same Aadhaar twice on one booking is refused", async () => {
    const { status, envelope } = await postJson(
      "/api/public/bookings",
      bookingPayload({
        numberOfVisitors: 3,
        guests: [guest(2, AADHAAR.a), guest(3, AADHAAR.a)],
      }),
    );
    assertRefused(status, envelope);
  });

  section("Duplicate submission");

  await test("the same idempotency key yields one booking", async () => {
    const payload = bookingPayload({
      visitTime: "13:00",
      idempotencyKey: `test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    });

    const first = await postJson("/api/public/bookings", payload, { sameClient: "198.51.100.7" });
    const second = await postJson("/api/public/bookings", payload, { sameClient: "198.51.100.7" });

    assert.equal(first.status, 200, JSON.stringify(first.envelope));
    assert.equal(second.status, 200, JSON.stringify(second.envelope));
    assert.equal(first.envelope.data.id, second.envelope.data.id);
    assert.equal(second.envelope.data.replayed, true);
    created.push(first.envelope.data.id);

    const db = new DatabaseSync(DB_PATH);
    const { c } = db
      .prepare("SELECT COUNT(*) AS c FROM visit_requests WHERE idempotency_key = ?")
      .get(payload.idempotencyKey);
    db.close();
    assert.equal(c, 1);
  });

  await test("repeated submissions from one client are rate limited", async () => {
    const address = "198.51.100.9";
    let limited = false;
    for (let attempt = 0; attempt < 12 && !limited; attempt += 1) {
      const { status, envelope } = await postJson(
        "/api/public/bookings",
        bookingPayload({ visitTime: "15:00" }),
        { sameClient: address },
      );
      if (status === 429) limited = true;
      else if (status === 200) created.push(envelope.data.id);
    }
    assert.ok(limited, "the public booking endpoint must rate limit a repeating client");
  });

  await test("concurrent identical submissions yield one booking", async () => {
    const payload = bookingPayload({
      visitTime: "13:30",
      idempotencyKey: `race-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    });

    const results = await Promise.all([
      postJson("/api/public/bookings", payload, { sameClient: "198.51.100.8" }),
      postJson("/api/public/bookings", payload, { sameClient: "198.51.100.8" }),
      postJson("/api/public/bookings", payload, { sameClient: "198.51.100.8" }),
    ]);

    const db = new DatabaseSync(DB_PATH);
    const { c } = db
      .prepare("SELECT COUNT(*) AS c FROM visit_requests WHERE idempotency_key = ?")
      .get(payload.idempotencyKey);
    db.close();

    const accepted = results.filter((r) => r.status === 200);
    assert.ok(accepted.length >= 1, "at least one submission must succeed");
    assert.equal(c, 1, `expected exactly one row, found ${c}`);
    if (accepted[0]) created.push(accepted[0].envelope.data.id);
  });
}

/* ------------------------------------------------------------------ *
 * 3 — The pass, its QR, and what the responses disclose
 * ------------------------------------------------------------------ */

async function passSuite() {
  section("Pass and QR verification");

  const mobile = uniqueMobile();
  const payload = bookingPayload({
    mobile,
    visitTime: "14:00",
    numberOfVisitors: 2,
    guests: [guest(2, AADHAAR.b)],
  });
  const { status, envelope } = await postJson("/api/public/bookings", payload);
  if (status !== 200) {
    check("pass suite prerequisite booking", false, JSON.stringify(envelope));
    return;
  }
  const booking = envelope.data;
  created.push(booking.id);

  await test("no Aadhaar fragment appears in the booking response", () => {
    const text = JSON.stringify(envelope);
    assert.ok(!text.includes(AADHAAR.b), "full number leaked");
    assert.ok(!text.includes("aadhaar"), "an Aadhaar field was echoed back");
  });

  await test("the QR verification page resolves the token", async () => {
    const response = await fetch(`${BASE}/visit/verify/${encodeURIComponent(booking.passToken)}`);
    const html = await response.text();
    check("  verification page responds 200", response.status === 200, String(response.status));
    assert.ok(html.includes(booking.id), "booking reference is shown");
    assert.ok(html.includes("Not yet approved"), "a pending booking is not presented as valid");
  });

  await test("the verification page discloses no sensitive detail", async () => {
    const response = await fetch(`${BASE}/visit/verify/${encodeURIComponent(booking.passToken)}`);
    const html = await response.text();
    assert.ok(!html.includes(AADHAAR.b), "Aadhaar leaked to the public page");
    assert.ok(!html.includes(AADHAAR.b.slice(-4)), "an Aadhaar fragment leaked");
    assert.ok(!html.includes(payload.address), "the house address leaked");
    assert.ok(!html.includes(mobile), "a contact number leaked");
    assert.ok(!html.includes(payload.email), "an email address leaked");
  });

  await test("an unknown token is reported, not resolved", async () => {
    const response = await fetch(`${BASE}/visit/verify/not-a-real-token-abcdefghij`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.ok(html.includes("not recognised"));
  });

  section("WhatsApp delivery");

  await test("delivery status is reported honestly", async () => {
    const { status, envelope: result } = await postJson("/api/public/pass-delivery", {
      bookingId: booking.id,
      mobile,
    });
    assert.equal(status, 200, JSON.stringify(result));
    const delivery = result.data.delivery;
    // Without credentials the adapter records but does not transmit, and the
    // API must say so rather than claiming delivery.
    assert.ok(["sent", "simulated", "queued", "failed", "none"].includes(delivery.state));
    if (!delivery.live) {
      assert.equal(delivery.state, "simulated");
      assert.ok(/pending configuration/i.test(delivery.detail));
    }
  });

  await test("delivery cannot be triggered with the wrong mobile", async () => {
    const { status } = await postJson("/api/public/pass-delivery", {
      bookingId: booking.id,
      mobile: "9000000001",
    });
    assert.equal(status, 404);
  });

  await test("no Aadhaar reaches the WhatsApp message body", () => {
    const db = new DatabaseSync(DB_PATH);
    const rows = db
      .prepare("SELECT body FROM whatsapp_messages WHERE booking_id = ?")
      .all(booking.id);
    db.close();
    for (const row of rows) {
      assert.ok(!row.body.includes(AADHAAR.b));
      assert.ok(!row.body.includes(AADHAAR.b.slice(-4)));
    }
  });

  section("Authorisation");

  await test("the guest list rejects an unauthenticated caller", async () => {
    const response = await fetch(`${BASE}/api/bookings/${booking.id}/guests`);
    assert.ok(
      response.status === 401 || response.status === 403,
      `expected 401/403, got ${response.status}`,
    );
    const text = await response.text();
    assert.ok(!text.includes(AADHAAR.b.slice(-4)));
  });

  await test("status lookup requires the matching mobile", async () => {
    const wrong = await postJson("/api/public/status", {
      bookingId: booking.id,
      mobile: "9000000002",
    });
    assert.equal(wrong.status, 404);

    const right = await postJson("/api/public/status", { bookingId: booking.id, mobile });
    assert.equal(right.status, 200);
    assert.ok(!JSON.stringify(right.envelope).includes(AADHAAR.b));
  });

  section("Revocation");

  await test("a cancelled booking stops verifying", async () => {
    const db = new DatabaseSync(DB_PATH);
    db.prepare("UPDATE visit_requests SET status = 'Cancelled' WHERE id = ?").run(booking.id);
    db.close();

    const response = await fetch(`${BASE}/visit/verify/${encodeURIComponent(booking.passToken)}`);
    const html = await response.text();
    assert.ok(html.includes("Pass not valid"), "a cancelled pass must not read as valid");
  });

  section("Faculty notification");

  await test("the host is messaged on their own number, not the visitor's", async () => {
    const directory = await fetch(`${BASE}/api/public/directory`).then((r) => r.json());
    const host = directory.data.hosts.find((h) => h.available) ?? directory.data.hosts[0];
    assert.ok(host, "the directory must list at least one host");

    const visitorMobile = uniqueMobile();
    const { status, envelope: result } = await postJson("/api/public/bookings", {
      ...bookingPayload({
        mobile: visitorMobile,
        purpose: "Teacher Meeting",
        purposeDetail: "Academic discussion with the department.",
        visitTime: "15:30",
      }),
      hostId: host.id,
      departmentId: host.departmentId,
    });
    assert.equal(status, 200, JSON.stringify(result));
    const id = result.data.id;
    created.push(id);

    // The dispatch is detached from the request, so give it a moment to land.
    await new Promise((resolve) => setTimeout(resolve, 600));

    const db = new DatabaseSync(DB_PATH);
    const messages = db
      .prepare("SELECT * FROM whatsapp_messages WHERE booking_id = ?")
      .all(id);
    const teacher = db.prepare("SELECT * FROM teachers WHERE id = ?").get(host.id);
    db.close();

    const facultyMessage = messages.find((m) => m.message_type === "faculty_visit_request");
    assert.ok(facultyMessage, "a faculty notification must be queued");

    const expected = (teacher.whatsapp_number || teacher.phone).replace(/[^0-9]/g, "");
    assert.ok(
      facultyMessage.phone_number.endsWith(expected),
      `expected the host's number, got ${facultyMessage.phone_number}`,
    );
    assert.ok(
      !facultyMessage.phone_number.endsWith(visitorMobile),
      "the faculty notice must not go to the visitor",
    );

    // The visitor's own confirmation still goes to the visitor.
    const visitorMessage = messages.find((m) => m.message_type === "booking_created");
    assert.ok(visitorMessage, "the visitor confirmation must still be queued");
    assert.ok(visitorMessage.phone_number.endsWith(visitorMobile));
  });

  await test("the faculty notice carries no Aadhaar and names the review link", async () => {
    const db = new DatabaseSync(DB_PATH);
    const rows = db
      .prepare("SELECT body FROM whatsapp_messages WHERE message_type = 'faculty_visit_request'")
      .all();
    db.close();
    assert.ok(rows.length > 0);
    for (const row of rows) {
      for (const value of Object.values(AADHAAR)) {
        assert.ok(!row.body.includes(value), "Aadhaar leaked into a faculty message");
      }
      assert.ok(row.body.includes("/teacher/meetings"), "the review link is missing");
    }
  });

  section("Pass expiry");

  await test("a pass is issued with an expiry", async () => {
    const { status, envelope: result } = await postJson(
      "/api/public/bookings",
      bookingPayload({ visitTime: "16:30" }),
    );
    assert.equal(status, 200, JSON.stringify(result));
    created.push(result.data.id);

    const db = new DatabaseSync(DB_PATH);
    const row = db
      .prepare("SELECT pass_expires_at FROM visit_requests WHERE id = ?")
      .get(result.data.id);
    db.close();
    assert.ok(row.pass_expires_at, "every pass must carry a validity cut-off");
    assert.ok(Date.parse(row.pass_expires_at) > Date.now(), "a new pass must not start expired");
  });

  await test("an expired pass stops verifying", async () => {
    const { status, envelope: result } = await postJson(
      "/api/public/bookings",
      bookingPayload({ visitTime: "17:00" }),
    );
    assert.equal(status, 200, JSON.stringify(result));
    const id = result.data.id;
    created.push(id);

    const db = new DatabaseSync(DB_PATH);
    // Approve it and wind the window back — an admissible status must not be
    // enough on its own.
    db.prepare(
      "UPDATE visit_requests SET status = 'Approved', pass_expires_at = ? WHERE id = ?",
    ).run(new Date(Date.now() - 3_600_000).toISOString(), id);
    db.close();

    const response = await fetch(
      `${BASE}/visit/verify/${encodeURIComponent(result.data.passToken)}`,
    );
    const html = await response.text();
    assert.ok(html.includes("Pass not valid"), "an expired pass must not read as valid");
    assert.ok(html.includes("expired"), "the reason must say the pass expired");
  });

  section("Storage");

  await test("the database holds no plaintext Aadhaar", () => {
    const db = new DatabaseSync(DB_PATH);
    const rows = db.prepare("SELECT * FROM visit_guests").all();
    db.close();
    assert.ok(rows.length > 0, "expected guest rows from this run");
    for (const row of rows) {
      assert.equal(String(row.aadhaar_last4).length, 4);
      for (const value of Object.values(AADHAAR)) {
        assert.ok(!String(row.aadhaar_ciphertext ?? "").includes(value));
        assert.ok(!String(row.address).includes(value));
        assert.ok(!String(row.full_name).includes(value));
      }
    }
  });
}

/* ------------------------------------------------------------------ *
 * Cleanup — this suite writes real bookings, so it removes its own.
 * ------------------------------------------------------------------ */

function cleanup() {
  if (!created.length) return;
  const db = new DatabaseSync(DB_PATH);
  for (const id of created) {
    db.prepare("DELETE FROM whatsapp_messages WHERE booking_id = ?").run(id);
    db.prepare("DELETE FROM visit_guests WHERE booking_id = ?").run(id);
    db.prepare("DELETE FROM visit_requests WHERE id = ?").run(id);
  }
  db.prepare(
    "DELETE FROM visitors WHERE full_name IN ('Primary Visitor') AND total_visits <= 2",
  ).run();
  db.close();
  console.log(`\n  cleaned up ${created.length} test booking(s)`);
}

/* ------------------------------------------------------------------ */

async function main() {
  await aadhaarSuite();

  const reachable = await fetch(`${BASE}/api/public/directory`)
    .then((r) => r.ok)
    .catch(() => false);

  if (!reachable) {
    console.log(`\n  SKIPPED the HTTP suite — no server at ${BASE}.`);
    console.log("  Start one with `npm run dev`, then re-run this file.");
  } else {
    try {
      sharedPhotoId = await newPhotoId(BASE);
      await bookingSuite();
      await passSuite();
    } finally {
      cleanup();
    }
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

await main();
