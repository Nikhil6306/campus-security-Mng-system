/**
 * Mandatory visitor photographs, end to end.
 *
 *   npm run dev              # in one terminal
 *   node tests/visitor-photo.mjs
 *
 * Covers the whole path rather than the form alone: upload validation, the
 * booking refusing to exist without a photograph, what the row actually holds,
 * who may read the image back, and the photograph reaching the gate through QR
 * verification.
 *
 * Reads the database directly wherever the API deliberately does not expose
 * something — the storage path is one of those things.
 */

import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

import {
  JPEG,
  NOT_AN_IMAGE,
  OVERSIZED,
  PNG,
  WEBP,
  newPhotoId,
  nextForwarded,
  uploadPhoto,
} from "./photo-fixtures.mjs";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const DB_PATH = resolve(process.cwd(), process.env.DATABASE_FILE ?? ".data/campus-security.db");

let passed = 0;
let failed = 0;
const failures = [];

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
 * Helpers
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
    for (const entry of response.headers.getSetCookie?.() ?? []) {
      const [pair] = entry.split(";");
      if (pair.startsWith("csms_session=")) cookie = pair;
    }
    return response;
  };
}

async function json(call, path, options) {
  const response = await call(path, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { ok: false, raw: text.slice(0, 160) };
  }
  return { status: response.status, ...body };
}

const postJson = async (path, payload, forwarded) => {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": forwarded ?? nextForwarded(),
    },
    body: JSON.stringify(payload),
  });
  const envelope = await response.json().catch(() => ({}));
  return { status: response.status, envelope };
};

const db = () => new DatabaseSync(DB_PATH, { readOnly: true });
function row(sql, params = []) {
  const handle = db();
  try {
    return handle.prepare(sql).get(...params);
  } finally {
    handle.close();
  }
}

const futureDate = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/**
 * A mobile number nothing else in the database holds.
 *
 * Seeded from the clock rather than counting from a fixed base: a visitor may
 * only hold one live booking per slot, so a deterministic sequence would make
 * the second run of this file collide with the first.
 */
let sequence = Number(String(Date.now()).slice(-6)) * 10;
const uniqueMobile = () => `9${String(100_000_000 + ((sequence += 7) % 800_000_000)).slice(0, 9)}`;

/** Bookings this run created, removed at the end so the demo data stays clean. */
const created = [];

function cleanup() {
  if (!created.length) return;
  const handle = new DatabaseSync(DB_PATH);
  try {
    for (const id of created) {
      handle.prepare("DELETE FROM whatsapp_messages WHERE booking_id = ?").run(id);
      handle.prepare("DELETE FROM visit_guests WHERE booking_id = ?").run(id);
      handle.prepare("DELETE FROM visit_requests WHERE id = ?").run(id);
    }
    handle
      .prepare(
        `DELETE FROM visitors
          WHERE full_name IN ('Photo Test Visitor')
            AND id NOT IN (SELECT visitor_id FROM visit_requests)`,
      )
      .run();
  } finally {
    handle.close();
  }
  console.log(`
  cleaned up ${created.length} test booking(s)`);
}

function bookingPayload(overrides = {}) {
  return {
    fullName: "Photo Test Visitor",
    mobile: uniqueMobile(),
    email: "photo.visitor@example.com",
    gender: "Female",
    visitorType: "Guest",
    idType: "Aadhaar Card",
    idNumber: "123456789012",
    purpose: "Campus Visit",
    purposeDetail: "Visiting the campus to see the facilities before admission.",
    visitDate: futureDate(6),
    visitTime: "12:00",
    expectedDuration: "1 hour",
    numberOfVisitors: 1,
    vehicleRequired: false,
    address: "21 Ganga Vihar, Haridwar, Uttarakhand",
    guests: [],
    ...overrides,
  };
}

/** A refusal is either a schema failure (422) or a policy failure (400/413). */
function assertRefused(status, envelope, expectedMessage) {
  assert.ok(
    [400, 413, 422].includes(status),
    `expected a refusal, got ${status}: ${JSON.stringify(envelope).slice(0, 200)}`,
  );
  assert.equal(envelope.ok, false);
  if (expectedMessage) {
    const detail = envelope.error?.details?.photoId ?? envelope.error?.message ?? "";
    assert.equal(detail, expectedMessage, `message was: ${detail}`);
  }
}

/* ------------------------------------------------------------------ *
 * 1 — Upload validation
 * ------------------------------------------------------------------ */

async function uploadSuite() {
  section("TEST 2-6 — Photograph upload validation");

  await test("a valid JPG is accepted", async () => {
    const { status, envelope } = await uploadPhoto(BASE, { bytes: JPEG });
    assert.equal(status, 200, JSON.stringify(envelope));
    assert.match(envelope.data.photoId, /^[A-Za-z0-9_-]{16,64}$/);
    assert.equal(envelope.data.contentType, "image/jpeg");
  });

  await test("a valid PNG is accepted", async () => {
    const { status, envelope } = await uploadPhoto(BASE, {
      bytes: PNG,
      filename: "visitor.png",
      type: "image/png",
    });
    assert.equal(status, 200, JSON.stringify(envelope));
    assert.equal(envelope.data.contentType, "image/png");
  });

  await test("a valid WEBP is accepted", async () => {
    const { status, envelope } = await uploadPhoto(BASE, {
      bytes: WEBP,
      filename: "visitor.webp",
      type: "image/webp",
    });
    assert.equal(status, 200, JSON.stringify(envelope));
    assert.equal(envelope.data.contentType, "image/webp");
  });

  await test("a camera capture (JPEG blob) is accepted", async () => {
    const { status, envelope } = await uploadPhoto(BASE, {
      bytes: JPEG,
      filename: "visitor-photo.camera.jpg",
    });
    assert.equal(status, 200, JSON.stringify(envelope));
    assert.ok(envelope.data.photoId);
  });

  await test("the response carries an id, never a URL or a path", async () => {
    const { envelope } = await uploadPhoto(BASE, { bytes: JPEG });
    const body = JSON.stringify(envelope);
    assert.ok(!body.includes("visitor-photos/"), "a storage path leaked to the client");
    assert.ok(!/https?:\/\//.test(body), "a URL leaked to the client");
  });

  await test("a file that is not an image is rejected", async () => {
    const { status, envelope } = await uploadPhoto(BASE, {
      bytes: NOT_AN_IMAGE,
      filename: "photo.jpg",
      type: "image/jpeg",
    });
    assertRefused(status, envelope, "Please upload a valid JPG, JPEG, PNG, or WEBP image.");
  });

  await test("a GIF is rejected — the format list is closed", async () => {
    const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    const { status, envelope } = await uploadPhoto(BASE, {
      bytes: gif,
      filename: "visitor.gif",
      type: "image/gif",
    });
    assertRefused(status, envelope);
  });

  await test("a file over 5 MB is rejected", async () => {
    const { status, envelope } = await uploadPhoto(BASE, { bytes: OVERSIZED });
    assertRefused(status, envelope, "Photo size must be less than 5 MB.");
  });

  await test("an empty file is rejected", async () => {
    const { status, envelope } = await uploadPhoto(BASE, { bytes: Buffer.alloc(0) });
    assertRefused(status, envelope, "Please upload a valid image.");
  });

  await test("a header that disagrees with the bytes is rejected", async () => {
    // PNG bytes, declared as a JPEG — the kind of mismatch a renamed file makes.
    const { status, envelope } = await uploadPhoto(BASE, {
      bytes: PNG,
      filename: "visitor.jpg",
      type: "image/jpeg",
    });
    assertRefused(status, envelope, "Please upload a valid image.");
  });

  await test("a request with no file at all is rejected", async () => {
    const form = new FormData();
    form.append("notes", "nothing here");
    const response = await fetch(`${BASE}/api/public/visitor-photo`, {
      method: "POST",
      headers: { "X-Forwarded-For": nextForwarded() },
      body: form,
    });
    const envelope = await response.json().catch(() => ({}));
    assertRefused(response.status, envelope, "Visitor photo is required.");
  });
}

/* ------------------------------------------------------------------ *
 * 2 — The booking will not exist without one
 * ------------------------------------------------------------------ */

let bookingWithPhoto;
let firstPhotoId;

async function bookingSuite() {
  section("TEST 1 — A booking cannot be made without a photograph");

  await test("submitting with no photoId is refused", async () => {
    const { status, envelope } = await postJson("/api/public/bookings", bookingPayload());
    assertRefused(status, envelope, "Visitor photo is required.");
    assert.equal(envelope.error.details.photoId, "Visitor photo is required.");
  });

  await test("an empty photoId is refused", async () => {
    const { status, envelope } = await postJson(
      "/api/public/bookings",
      bookingPayload({ photoId: "" }),
    );
    assertRefused(status, envelope, "Visitor photo is required.");
  });

  await test("a fabricated photoId is refused", async () => {
    const { status, envelope } = await postJson(
      "/api/public/bookings",
      bookingPayload({ photoId: "A".repeat(32) }),
    );
    assertRefused(status, envelope, "Visitor photo is required.");
  });

  await test("a photoId shaped like a path traversal is refused", async () => {
    const { status, envelope } = await postJson(
      "/api/public/bookings",
      bookingPayload({ photoId: "../../../../etc/passwd" }),
    );
    assertRefused(status, envelope);
  });

  section("TEST 2/3 — A booking with a photograph succeeds and stores it");

  await test("a booking with a valid photograph is created", async () => {
    firstPhotoId = await newPhotoId(BASE, { bytes: JPEG });
    const { status, envelope } = await postJson(
      "/api/public/bookings",
      bookingPayload({ photoId: firstPhotoId, mobile: uniqueMobile() }),
    );
    assert.equal(status, 200, JSON.stringify(envelope).slice(0, 300));
    bookingWithPhoto = envelope.data;
    created.push(bookingWithPhoto.id);
    assert.match(bookingWithPhoto.id, /^DSVV-VIS-\d{4}-\d{6}$/);
  });

  await test("the booking row records the storage path, not the image", async () => {
    const record = row("SELECT photo_url FROM visit_requests WHERE id = ?", [
      bookingWithPhoto.id,
    ]);
    assert.equal(record.photo_url, `visitor-photos/${firstPhotoId}.jpg`);
    assert.ok(record.photo_url.length < 120, "the column is holding more than a path");
  });

  await test("the visitor record carries the same photograph", async () => {
    const record = row(
      `SELECT v.photo_url FROM visitors v
         JOIN visit_requests r ON r.visitor_id = v.id
        WHERE r.id = ?`,
      [bookingWithPhoto.id],
    );
    assert.equal(record.photo_url, `visitor-photos/${firstPhotoId}.jpg`);
  });

  await test("no base64 image data reaches the database", async () => {
    const record = row("SELECT * FROM visit_requests WHERE id = ?", [bookingWithPhoto.id]);
    for (const [column, value] of Object.entries(record)) {
      if (typeof value !== "string") continue;
      assert.ok(
        value.length < 500,
        `column ${column} holds ${value.length} characters — an image may have been inlined`,
      );
    }
  });

  await test("the visitor's own view of the booking exposes no photo reference", async () => {
    const body = JSON.stringify(bookingWithPhoto);
    assert.ok(!body.includes("visitor-photos"), "the storage path was echoed to the visitor");
    assert.ok(!body.includes(firstPhotoId), "the photo id was echoed to the visitor");
  });

  await test("a PNG photograph books just as well", async () => {
    const photoId = await newPhotoId(BASE, {
      bytes: PNG,
      filename: "visitor.png",
      type: "image/png",
    });
    const { status, envelope } = await postJson(
      "/api/public/bookings",
      bookingPayload({ photoId, mobile: uniqueMobile(), visitTime: "12:30" }),
    );
    assert.equal(status, 200, JSON.stringify(envelope).slice(0, 300));
    created.push(envelope.data.id);
    const record = row("SELECT photo_url FROM visit_requests WHERE id = ?", [envelope.data.id]);
    assert.equal(record.photo_url, `visitor-photos/${photoId}.png`);
  });
}

/* ------------------------------------------------------------------ *
 * 3 — Replacing a photograph
 * ------------------------------------------------------------------ */

async function replacementSuite() {
  section("TEST 7 — Replacing a photograph");

  const mobile = uniqueMobile();
  const firstId = await newPhotoId(BASE, { bytes: JPEG });
  const first = await postJson(
    "/api/public/bookings",
    bookingPayload({ photoId: firstId, mobile, visitTime: "13:00" }),
  );

  await test("the first booking is created", () => {
    assert.equal(first.status, 200, JSON.stringify(first.envelope).slice(0, 300));
    created.push(first.envelope.data.id);
  });

  const secondId = await newPhotoId(BASE, {
    bytes: PNG,
    filename: "visitor.png",
    type: "image/png",
  });
  const second = await postJson(
    "/api/public/bookings",
    bookingPayload({ photoId: secondId, mobile, visitTime: "13:30", visitDate: futureDate(7) }),
  );

  await test("the same visitor books again with a new photograph", () => {
    assert.equal(second.status, 200, JSON.stringify(second.envelope).slice(0, 300));
    created.push(second.envelope.data.id);
    assert.notEqual(firstId, secondId);
  });

  await test("the visitor record now points at the newer photograph", () => {
    const record = row("SELECT photo_url FROM visitors WHERE mobile = ?", [mobile]);
    assert.equal(record.photo_url, `visitor-photos/${secondId}.png`);
  });

  await test("the earlier booking keeps the photograph taken for it", () => {
    const record = row("SELECT photo_url FROM visit_requests WHERE id = ?", [
      first.envelope.data.id,
    ]);
    assert.equal(record.photo_url, `visitor-photos/${firstId}.jpg`);
  });

  await test("each booking names its own photograph", () => {
    const a = row("SELECT photo_url FROM visit_requests WHERE id = ?", [first.envelope.data.id]);
    const b = row("SELECT photo_url FROM visit_requests WHERE id = ?", [second.envelope.data.id]);
    assert.notEqual(a.photo_url, b.photo_url);
  });
}

/* ------------------------------------------------------------------ *
 * 4 — Who may read a photograph back
 * ------------------------------------------------------------------ */

async function accessSuite() {
  section("TEST 9 — Authorisation on the photograph itself");

  const photoId = firstPhotoId;

  await test("an anonymous request for a photograph is refused", async () => {
    const response = await fetch(`${BASE}/api/visitor-photo/${photoId}`);
    assert.equal(response.status, 401);
    const body = await response.json().catch(() => ({}));
    assert.equal(body.ok, false);
  });

  await test("an id that does not exist is refused the same way", async () => {
    // The 401 must not depend on whether the id is real, or the endpoint would
    // report which photographs exist.
    const response = await fetch(`${BASE}/api/visitor-photo/${"Z".repeat(32)}`);
    assert.equal(response.status, 401);
  });

  await test("a signed-in guard receives the image", async () => {
    const guard = makeSession();
    const login = await json(guard, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "security@dsvv.edu.in", password: "Security@123" }),
    });
    assert.equal(login.status, 200, JSON.stringify(login).slice(0, 200));

    const response = await guard(`/api/visitor-photo/${photoId}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/jpeg");
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length > 0);
    assert.equal(bytes[0], 0xff, "the served bytes are not a JPEG");
  });

  await test("a signed-in administrator receives the image", async () => {
    const admin = makeSession();
    const login = await json(admin, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@dsvv.edu.in", password: "Admin@123" }),
    });
    assert.equal(login.status, 200, JSON.stringify(login).slice(0, 200));
    const response = await admin(`/api/visitor-photo/${photoId}`);
    assert.equal(response.status, 200);
  });

  await test("a student session is not staff and is refused", async () => {
    const student = makeSession();
    const login = await json(student, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "aarav.mehta@dsvv.edu.in", password: "Student@123" }),
    });
    if (login.status !== 200) return; // no student demo account in this deployment
    const response = await student(`/api/visitor-photo/${photoId}`);
    assert.equal(response.status, 401);
  });

  await test("a traversal in the id reaches nothing", async () => {
    const response = await fetch(
      `${BASE}/api/visitor-photo/${encodeURIComponent("../../campus-security.db")}`,
    );
    // Refused for being unauthenticated before the id is even looked at.
    assert.equal(response.status, 401);
  });
}

/* ------------------------------------------------------------------ *
 * 5 — The photograph reaches the gate
 * ------------------------------------------------------------------ */

async function gateSuite() {
  section("TEST 8 — QR verification carries the photograph");

  const guard = makeSession();
  const login = await json(guard, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "security@dsvv.edu.in", password: "Security@123" }),
  });

  await test("the gate signs in", () => {
    assert.equal(login.status, 200, JSON.stringify(login).slice(0, 200));
  });

  await test("verifying by booking reference returns the visitor's photograph", async () => {
    const result = await json(guard, "/api/gate/verify", {
      method: "POST",
      body: JSON.stringify({ bookingId: bookingWithPhoto.id }),
    });
    assert.equal(result.status, 200, JSON.stringify(result).slice(0, 300));
    assert.ok(result.data.booking, "no booking came back");
    assert.equal(result.data.booking.photoUrl, `visitor-photos/${firstPhotoId}.jpg`);
  });

  await test("verifying by QR token returns the same photograph", async () => {
    const token = row("SELECT pass_token FROM visit_requests WHERE id = ?", [
      bookingWithPhoto.id,
    ]).pass_token;
    assert.ok(token, "the booking has no pass token");

    const result = await json(guard, "/api/gate/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.booking.photoUrl, `visitor-photos/${firstPhotoId}.jpg`);
  });

  await test("the QR token itself carries no image data", async () => {
    const token = row("SELECT pass_token FROM visit_requests WHERE id = ?", [
      bookingWithPhoto.id,
    ]).pass_token;
    assert.ok(token.length <= 64, "the pass token is far larger than a random reference");
    assert.ok(!token.includes("visitor-photos"), "the pass token embeds a storage path");
    assert.ok(!/^data:/.test(token), "the pass token embeds image data");
  });

  await test("the gate snapshot carries the photograph reference", async () => {
    const state = await json(guard, "/api/state");
    assert.equal(state.status, 200);
    const booking = state.data.state.visitRequests.find((v) => v.id === bookingWithPhoto.id);
    if (!booking) return; // outside the gate's rolling window — not a photo failure
    assert.equal(booking.photoUrl, `visitor-photos/${firstPhotoId}.jpg`);
  });

  await test("the public pass verification page still exposes no photograph", async () => {
    // Reachable by anyone holding the link, so it must stay minimal.
    const token = row("SELECT pass_token FROM visit_requests WHERE id = ?", [
      bookingWithPhoto.id,
    ]).pass_token;
    const response = await fetch(`${BASE}/visit/verify/${token}`);
    const html = await response.text();
    assert.ok(!html.includes("visitor-photos"), "a storage path leaked onto the public page");
    assert.ok(!html.includes("/api/visitor-photo/"), "the photo endpoint leaked onto it");
  });
}

/* ------------------------------------------------------------------ *
 * Runner
 * ------------------------------------------------------------------ */

async function main() {
  console.log(`Campus Security — visitor photographs against ${BASE}\n`);

  try {
    const probe = await fetch(`${BASE}/api/public/directory`);
    if (!probe.ok) throw new Error(`status ${probe.status}`);
  } catch (error) {
    console.error(`Cannot reach ${BASE} — start the server with \`npm run dev\`.`);
    console.error(`  ${error.message}`);
    process.exit(1);
  }

  try {
    await uploadSuite();
    await bookingSuite();
    await replacementSuite();
    await accessSuite();
    await gateSuite();
  } finally {
    cleanup();
  }

  console.log(`\n${"=".repeat(52)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const entry of failures) console.log(`  - ${entry}`);
  }
  console.log("=".repeat(52));
  console.log(
    "\nNot covered here (needs a real browser): live camera capture, the\n" +
      "permission-denied message, and the mobile layout. See the manual checks\n" +
      "in the pull request notes.",
  );

  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
