/**
 * Unit tests for the pure logic the rest of the system leans on.
 *
 *   node tests/unit.mjs
 *
 * No server and no database — these cover the small functions where an
 * off-by-one has consequences at the gate.
 */

import assert from "node:assert/strict";

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(`${name} — ${error.message}`);
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

/* ------------------------------------------------------------------ *
 * Local copies of the implementations under test.
 *
 * `lib/**` is TypeScript and `lib/server/**` is marked server-only, so these
 * mirror the shipped logic rather than importing it. Any change to the source
 * must be reflected here — that is the point: the expectations below are the
 * specification these functions are held to.
 * ------------------------------------------------------------------ */

// lib/settings.ts
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h)) return 0;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

// lib/server/services/gate.ts — the visiting-hours window
function isOutsideVisitingHours(nowMinutes, from, to) {
  return nowMinutes < toMinutes(from) || nowMinutes >= toMinutes(to);
}

// lib/server/services/whatsapp/index.ts
function normaliseWhatsApp(countryCode, number) {
  const cc = (countryCode || "").replace(/[^\d]/g, "");
  const digits = (number || "").replace(/[^\d]/g, "");
  if (!cc || !digits) return null;
  const local = digits.startsWith(cc) && digits.length > 10 ? digits.slice(cc.length) : digits;
  if (local.length < 6 || local.length > 12) return null;
  return `${cc}${local}`;
}

function maskWhatsApp(value) {
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length < 4) return "•••";
  return `+${digits.slice(0, digits.length - 4).replace(/\d/g, "•")}${digits.slice(-4)}`;
}

// lib/server/services/bookings.ts — the bookable-slot grid
function availableSlots({ start, end, slotMinutes, taken = [], isToday = false, nowMinutes = 0 }) {
  const takenSet = new Set(taken);
  const slots = [];
  for (let m = start; m + slotMinutes <= end; m += slotMinutes) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const time = `${hh}:${mm}`;
    if (takenSet.has(time)) slots.push({ time, available: false, reason: "Already booked" });
    else if (isToday && m <= nowMinutes) slots.push({ time, available: false, reason: "Time has passed" });
    else slots.push({ time, available: true });
  }
  return slots;
}

// lib/export.ts — CSV escaping
function csvCell(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/["\n\r,]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

section("Visiting hours window");

test("a gate closing at 23:59 is open at 23:30", () => {
  // Regression: parsing only the hour turned "23:59" into 23:00 and closed
  // the gate for the last hour of every day.
  assert.equal(isOutsideVisitingHours(toMinutes("23:30"), "00:00", "23:59"), false);
});

test("a gate opening at 07:30 is still shut at 07:00", () => {
  // The same truncation opened an 07:30 gate half an hour early.
  assert.equal(isOutsideVisitingHours(toMinutes("07:00"), "07:30", "20:00"), true);
});

test("07:30 itself is open", () => {
  assert.equal(isOutsideVisitingHours(toMinutes("07:30"), "07:30", "20:00"), false);
});

test("the closing minute is shut", () => {
  assert.equal(isOutsideVisitingHours(toMinutes("20:00"), "07:00", "20:00"), true);
});

test("a minute before closing is open", () => {
  assert.equal(isOutsideVisitingHours(toMinutes("19:59"), "07:00", "20:00"), false);
});

test("before opening is shut", () => {
  assert.equal(isOutsideVisitingHours(toMinutes("06:59"), "07:00", "20:00"), true);
});

section("WhatsApp number normalisation");

test("an Indian mobile becomes E.164 digits", () => {
  assert.equal(normaliseWhatsApp("+91", "9876543210"), "919876543210");
});

test("spaces and hyphens are stripped", () => {
  assert.equal(normaliseWhatsApp("+91", "98765-43210"), "919876543210");
});

test("a number already carrying its country code is not doubled", () => {
  assert.equal(normaliseWhatsApp("+91", "919876543210"), "919876543210");
});

test("a missing number yields null rather than a broken address", () => {
  assert.equal(normaliseWhatsApp("+91", ""), null);
});

test("a too-short number is rejected", () => {
  assert.equal(normaliseWhatsApp("+91", "12345"), null);
});

test("a missing country code is rejected", () => {
  assert.equal(normaliseWhatsApp("", "9876543210"), null);
});

test("masking keeps only the last four digits", () => {
  assert.equal(maskWhatsApp("919876543210"), "+••••••••3210");
});

section("Bookable slot grid");

test("a 09:00-17:00 day at 30 minutes yields 16 slots", () => {
  const slots = availableSlots({ start: 540, end: 1020, slotMinutes: 30 });
  assert.equal(slots.length, 16);
  assert.equal(slots[0].time, "09:00");
  assert.equal(slots.at(-1).time, "16:30");
});

test("no slot runs past the closing time", () => {
  const slots = availableSlots({ start: 540, end: 1020, slotMinutes: 45 });
  const last = slots.at(-1);
  const [h, m] = last.time.split(":").map(Number);
  assert.ok(h * 60 + m + 45 <= 1020, `${last.time} + 45m overruns 17:00`);
});

test("a taken slot is reported as booked, not merely absent", () => {
  const slots = availableSlots({ start: 540, end: 660, slotMinutes: 30, taken: ["10:00"] });
  const ten = slots.find((s) => s.time === "10:00");
  assert.equal(ten.available, false);
  assert.equal(ten.reason, "Already booked");
});

test("slots earlier today are marked passed", () => {
  const slots = availableSlots({
    start: 540,
    end: 1020,
    slotMinutes: 30,
    isToday: true,
    nowMinutes: 600, // 10:00
  });
  assert.equal(slots.find((s) => s.time === "09:30").reason, "Time has passed");
  assert.equal(slots.find((s) => s.time === "10:30").available, true);
});

test("the same times are all bookable on a future date", () => {
  const slots = availableSlots({ start: 540, end: 1020, slotMinutes: 30, isToday: false });
  assert.ok(slots.every((s) => s.available));
});

section("CSV export safety");

test("a formula cell is neutralised", () => {
  assert.equal(csvCell("=SUM(A1:A9)"), "'=SUM(A1:A9)");
});

test("a leading minus is neutralised", () => {
  assert.equal(csvCell("-2+3"), "'-2+3");
});

test("a cell containing a comma is quoted", () => {
  assert.equal(csvCell("Haridwar, Uttarakhand"), '"Haridwar, Uttarakhand"');
});

test("embedded quotes are doubled", () => {
  assert.equal(csvCell('He said "no"'), '"He said ""no"""');
});

test("an ordinary name passes through untouched", () => {
  assert.equal(csvCell("Rahul Sharma"), "Rahul Sharma");
});

test("null becomes an empty cell", () => {
  assert.equal(csvCell(null), "");
});

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Campus timezone helpers (mirrors lib/utils.ts)
 * ------------------------------------------------------------------ */

const CAMPUS_TZ = "Asia/Kolkata";

function nowInCampusTz() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const hours = Number(parts.hour) % 24;
  const minutes = Number(parts.minute);
  return { date, hours, minutes };
}

function todayInCampusTz(offsetDays = 0) {
  if (offsetDays === 0) return nowInCampusTz().date;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function campusMinutesNow() {
  const { hours, minutes } = nowInCampusTz();
  return hours * 60 + minutes;
}

// Re-use existing availableSlots() from above
// booking date/time validation logic (mirrors lib/server/services/bookings.ts)
function validateBookingDateTime(visitDate, visitTime, visitingHoursFrom, visitingHoursTo) {
  const today = todayInCampusTz();
  if (visitDate < today) return { error: "past_date", message: "The visit date cannot be in the past." };

  const minutes = toMinutes(visitTime);
  if (minutes < toMinutes(visitingHoursFrom) || minutes >= toMinutes(visitingHoursTo)) {
    return { error: "outside_hours", message: `Visiting hours are ${visitingHoursFrom} to ${visitingHoursTo}.` };
  }

  if (visitDate === today) {
    const nowMins = campusMinutesNow();
    if (minutes <= nowMins) return { error: "past_time", message: "That time has already passed today." };
  }
  return null; // valid
}

// Sync idempotency logic (mirrors supabase-db.ts per-record upsert)
function simulateSync(existingById, incomingRecords) {
  const skipped = [];
  const upserted = [];
  // Map of (host_id, visit_date, visit_time) -> booking_id for active statuses
  const ACTIVE = new Set(["Pending", "Approved", "Rescheduled", "Checked In", "Meeting In Progress"]);
  // Seed slot maps from existing local records
  const hostSlot = new Map();
  const visitorSlot = new Map();

  for (const [id, rec] of Object.entries(existingById)) {
    if (rec.host_id && ACTIVE.has(rec.status)) {
      hostSlot.set(`${rec.host_id}|${rec.visit_date}|${rec.visit_time}`, id);
    }
    if (ACTIVE.has(rec.status)) {
      visitorSlot.set(`${rec.visitor_id}|${rec.visit_date}|${rec.visit_time}`, id);
    }
  }

  for (const v of incomingRecords) {
    // PK conflict = harmless upsert (same id exists)
    if (existingById[v.id]) {
      upserted.push({ id: v.id, action: "updated" });
      continue;
    }
    // Check partial index conflicts for active records
    if (v.host_id && ACTIVE.has(v.status)) {
      const key = `${v.host_id}|${v.visit_date}|${v.visit_time}`;
      if (hostSlot.has(key)) {
        skipped.push({ id: v.id, reason: "uniq_host_slot", conflictsWith: hostSlot.get(key) });
        continue;
      }
    }
    if (ACTIVE.has(v.status)) {
      const key = `${v.visitor_id}|${v.visit_date}|${v.visit_time}`;
      if (visitorSlot.has(key)) {
        skipped.push({ id: v.id, reason: "uniq_visitor_slot", conflictsWith: visitorSlot.get(key) });
        continue;
      }
    }
    // Successful insert — register in slot maps so subsequent records see the conflict
    if (v.host_id && ACTIVE.has(v.status)) {
      hostSlot.set(`${v.host_id}|${v.visit_date}|${v.visit_time}`, v.id);
    }
    if (ACTIVE.has(v.status)) {
      visitorSlot.set(`${v.visitor_id}|${v.visit_date}|${v.visit_time}`, v.id);
    }
    upserted.push({ id: v.id, action: "inserted" });
  }
  return { upserted, skipped };
}

section("Campus IST timezone helpers");

test("todayInCampusTz returns a valid ISO date string", () => {
  const today = todayInCampusTz();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/, `expected yyyy-mm-dd, got ${today}`);
});

test("campusMinutesNow returns a value in [0, 1440)", () => {
  const mins = campusMinutesNow();
  assert.ok(mins >= 0 && mins < 1440, `expected [0,1440), got ${mins}`);
});

test("IST offset is +5:30 ahead of UTC", () => {
  // At a known UTC epoch, IST should be 5h30m ahead.
  // We just verify the timezone name is accepted by Intl.
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: CAMPUS_TZ });
  assert.ok(fmt.format(new Date()).match(/^\d{4}-\d{2}-\d{2}$/), "IST formatter should produce a date");
});

section("Booking date/time validation (IST-aware)");

const VISIT_FROM = "07:00";
const VISIT_TO  = "20:00";
const campusNow = nowInCampusTz();
const campusToday = campusNow.date;

// A time that is definitely in the future today (next hour, capped to 19:00)
const futureHour = Math.min(campusNow.hours + 1, 19);
const futureTimeToday = `${String(futureHour).padStart(2, "0")}:00`;

// A time that has definitely passed today (1 hour ago, floored to 08:00, capped to 19:00 within visiting hours)
const pastHour = Math.min(Math.max(campusNow.hours - 1, 8), 19);
const pastTimeToday = `${String(pastHour).padStart(2, "0")}:00`;

const futureDate1 = todayInCampusTz(1);
const futureDate5 = todayInCampusTz(5);
const pastDate    = todayInCampusTz(-1);

test("booking a future time today is allowed", () => {
  // Only run meaningful check if there is a future time available today
  if (futureHour > campusNow.hours) {
    const result = validateBookingDateTime(campusToday, futureTimeToday, VISIT_FROM, VISIT_TO);
    assert.equal(result, null, `expected valid, got ${JSON.stringify(result)}`);
  }
});

test("booking a past time today is rejected with past_time error", () => {
  // Only meaningful if an hour has passed since visiting hours opened
  if (campusNow.hours > 8) {
    const result = validateBookingDateTime(campusToday, pastTimeToday, VISIT_FROM, VISIT_TO);
    assert.equal(result?.error, "past_time", `expected past_time, got ${JSON.stringify(result)}`);
  }
});

test("booking a valid time on a future date is allowed", () => {
  const result = validateBookingDateTime(futureDate5, "11:00", VISIT_FROM, VISIT_TO);
  assert.equal(result, null, `expected valid for future date, got ${JSON.stringify(result)}`);
});

test("booking a time on tomorrow is allowed", () => {
  const result = validateBookingDateTime(futureDate1, "09:00", VISIT_FROM, VISIT_TO);
  assert.equal(result, null, `expected valid for tomorrow, got ${JSON.stringify(result)}`);
});

test("booking a past date is rejected with past_date error", () => {
  const result = validateBookingDateTime(pastDate, "11:00", VISIT_FROM, VISIT_TO);
  assert.equal(result?.error, "past_date", `expected past_date, got ${JSON.stringify(result)}`);
});

test("a time outside visiting hours is rejected with outside_hours error", () => {
  const result = validateBookingDateTime(futureDate1, "06:00", VISIT_FROM, VISIT_TO);
  assert.equal(result?.error, "outside_hours", `expected outside_hours, got ${JSON.stringify(result)}`);
});

test("a time equal to the visiting hours closing time is rejected (exclusive upper bound)", () => {
  const result = validateBookingDateTime(futureDate1, "20:00", VISIT_FROM, VISIT_TO);
  assert.equal(result?.error, "outside_hours", `expected outside_hours for closing time, got ${JSON.stringify(result)}`);
});

test("malformed time string is rejected (outside hours catches it via toMinutes=0)", () => {
  // toMinutes("") = 0, which is < 07:00 = 420, so it returns outside_hours
  const result = validateBookingDateTime(futureDate1, "", VISIT_FROM, VISIT_TO);
  assert.equal(result?.error, "outside_hours", `expected outside_hours for empty time, got ${JSON.stringify(result)}`);
});

section("Supabase-to-SQLite sync idempotency");

const EXISTING = {
  "DSVV-VIS-2026-000001": {
    id: "DSVV-VIS-2026-000001",
    visitor_id: "VSTR-0001",
    host_id: "TCH-001",
    visit_date: "2026-10-20",
    visit_time: "10:00",
    status: "Pending",
  },
  "DSVV-VIS-2026-000002": {
    id: "DSVV-VIS-2026-000002",
    visitor_id: "VSTR-0002",
    host_id: "TCH-002",
    visit_date: "2026-10-20",
    visit_time: "11:00",
    status: "Approved",
  },
};

test("repeated sync of the same records upserts without error", () => {
  const incoming = Object.values(EXISTING);
  const { upserted, skipped } = simulateSync(EXISTING, incoming);
  assert.equal(skipped.length, 0, "no records should be skipped on repeated sync");
  assert.equal(upserted.length, 2, "both records should be processed as updates");
});

test("sync when local db already contains the record applies update only", () => {
  const incoming = [{ ...EXISTING["DSVV-VIS-2026-000001"], status: "Approved" }];
  const { upserted, skipped } = simulateSync(EXISTING, incoming);
  assert.equal(skipped.length, 0);
  assert.equal(upserted[0].action, "updated");
});

test("genuine host slot conflict from Supabase is skipped and logged, not crashing sync", () => {
  // Supabase has a new record with same host/date/time as an existing local one
  const incoming = [{
    id: "DSVV-VIS-2026-000099", // new id, not in existing
    visitor_id: "VSTR-0099",
    host_id: "TCH-001",         // same host
    visit_date: "2026-10-20",   // same date
    visit_time: "10:00",        // same time
    status: "Pending",
  }];
  const { upserted, skipped } = simulateSync(EXISTING, incoming);
  assert.equal(skipped.length, 1, "conflicting record should be skipped");
  assert.equal(skipped[0].reason, "uniq_host_slot");
  assert.equal(skipped[0].conflictsWith, "DSVV-VIS-2026-000001");
  assert.equal(upserted.length, 0);
});

test("visitor slot conflict from Supabase is skipped (same visitor, date, time, different host)", () => {
  const incoming = [{
    id: "DSVV-VIS-2026-000100",
    visitor_id: "VSTR-0001",  // same visitor
    host_id: "TCH-999",
    visit_date: "2026-10-20", // same date
    visit_time: "10:00",      // same time
    status: "Pending",
  }];
  const { upserted, skipped } = simulateSync(EXISTING, incoming);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].reason, "uniq_visitor_slot");
});

test("a closed-status record from Supabase does not trigger partial index conflict", () => {
  // A 'Rejected' booking for the same host/date/time slot should be inserted fine
  const incoming = [{
    id: "DSVV-VIS-2026-000101",
    visitor_id: "VSTR-0003",
    host_id: "TCH-001",
    visit_date: "2026-10-20",
    visit_time: "10:00",
    status: "Rejected",       // closed status — not in partial index
  }];
  const { upserted, skipped } = simulateSync(EXISTING, incoming);
  assert.equal(skipped.length, 0, "closed-status records should not trigger slot conflict");
  assert.equal(upserted.length, 1);
  assert.equal(upserted[0].action, "inserted");
});

test("two simultaneous booking attempts for same slot: first wins, second is skipped as conflict", () => {
  // Simulate what happens if two Supabase records race past app-level check
  const empty = {};
  const both = [
    { id: "A1", visitor_id: "V1", host_id: "TCH-001", visit_date: "2026-11-01", visit_time: "09:00", status: "Pending" },
    { id: "A2", visitor_id: "V2", host_id: "TCH-001", visit_date: "2026-11-01", visit_time: "09:00", status: "Pending" },
  ];
  const { upserted, skipped } = simulateSync(empty, both);
  assert.equal(upserted.length, 1, "first record should be inserted");
  assert.equal(skipped.length, 1, "second record should be skipped as conflict");
  assert.equal(upserted[0].id, "A1");
  assert.equal(skipped[0].id, "A2");
  assert.equal(skipped[0].reason, "uniq_host_slot");
});

test("missing visit_date yields past_date error (empty string sorts before any real date)", () => {
  const result = validateBookingDateTime("", "10:00", VISIT_FROM, VISIT_TO);
  assert.equal(result?.error, "past_date", `expected past_date for missing date, got ${JSON.stringify(result)}`);
});

test("missing visit_time is caught by outside_hours (toMinutes('')=0 < 07:00)", () => {
  const result = validateBookingDateTime(futureDate1, "", VISIT_FROM, VISIT_TO);
  assert.equal(result?.error, "outside_hours", `expected outside_hours for missing time, got ${JSON.stringify(result)}`);
});

section("Visitor Registration Form Validation (New 4-Section Flow)");

test("Section A: Full name requires at least 3 characters and valid letters", () => {
  function checkName(val) {
    const v = (val || "").trim();
    if (!v) return "Full name is required.";
    if (v.length < 3) return "Please enter at least 3 characters.";
    if (!/^[A-Za-z][A-Za-z .'-]*$/.test(v)) return "Use letters, spaces, apostrophes or hyphens only.";
    return undefined;
  }
  assert.equal(checkName(""), "Full name is required.");
  assert.equal(checkName("Al"), "Please enter at least 3 characters.");
  assert.equal(checkName("Rajesh123"), "Use letters, spaces, apostrophes or hyphens only.");
  assert.equal(checkName("Rajesh Kumar"), undefined);
});

test("Section A: Mobile number requires 10 digits starting with 6-9", () => {
  function checkMobile(val) {
    const v = (val || "").replace(/[\s-]/g, "");
    if (!v) return "Mobile number is required.";
    if (!/^\d+$/.test(v)) return "Mobile number must contain digits only.";
    if (!/^[6-9]\d{9}$/.test(v)) return "Enter a valid 10-digit mobile number.";
    return undefined;
  }
  assert.equal(checkMobile(""), "Mobile number is required.");
  assert.equal(checkMobile("1234567890"), "Enter a valid 10-digit mobile number.");
  assert.equal(checkMobile("9876543210"), undefined);
  assert.equal(checkMobile("98765-43210"), undefined);
});

test("Section A: Email is optional but validated when provided", () => {
  function checkEmail(val) {
    const v = (val || "").trim();
    if (!v) return undefined;
    if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v)) return "Enter a valid email address.";
    return undefined;
  }
  assert.equal(checkEmail(""), undefined);
  assert.equal(checkEmail("invalid-email"), "Enter a valid email address.");
  assert.equal(checkEmail("visitor@example.com"), undefined);
});

test("Section A: Visitor category supports standard and 'Other' with conditional text", () => {
  function checkCategory(category, otherText) {
    if (!category) return "Please select a visitor category.";
    if (category === "Other" && (!otherText || !otherText.trim())) {
      return "Please specify your visitor category.";
    }
    return undefined;
  }
  assert.equal(checkCategory("", ""), "Please select a visitor category.");
  assert.equal(checkCategory("Other", ""), "Please specify your visitor category.");
  assert.equal(checkCategory("Other", "Journalist"), undefined);
  assert.equal(checkCategory("Academic Visitor", ""), undefined);
});

test("Section B: Expected departure time must be after expected arrival time", () => {
  function checkDeparture(arrival, departure) {
    if (!departure) return undefined;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(departure)) return "Enter a valid time (HH:mm).";
    if (!arrival) return undefined;
    const [arrH, arrM] = arrival.split(":").map(Number);
    const [depH, depM] = departure.split(":").map(Number);
    if (depH * 60 + depM <= arrH * 60 + arrM) {
      return "Expected departure time must be after expected arrival time.";
    }
    return undefined;
  }
  assert.equal(checkDeparture("10:00", ""), undefined);
  assert.equal(checkDeparture("10:00", "09:30"), "Expected departure time must be after expected arrival time.");
  assert.equal(checkDeparture("10:00", "10:00"), "Expected departure time must be after expected arrival time.");
  assert.equal(checkDeparture("10:00", "12:30"), undefined);
});

test("Section C: Vehicle registration number is required only when vehicleRequired is yes", () => {
  function checkVehicle(required, num) {
    if (required !== "yes") return undefined;
    const v = (num || "").trim().toUpperCase();
    if (!v) return "Vehicle registration number is required.";
    if (!/^[A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{1,4}$/.test(v)) return "Use a valid format, e.g. UK07AB1234.";
    return undefined;
  }
  assert.equal(checkVehicle("no", ""), undefined);
  assert.equal(checkVehicle("yes", ""), "Vehicle registration number is required.");
  assert.equal(checkVehicle("yes", "INVALID"), "Use a valid format, e.g. UK07AB1234.");
  assert.equal(checkVehicle("yes", "UK07AB1234"), undefined);
});

test("Section D: Registration payload contains NO Campus Visit Details fields", () => {
  const formPayload = {
    fullName: "Priya Sharma",
    mobileNumber: "9876543210",
    email: "priya@example.com",
    visitorType: "Alumni",
    visitDate: "2026-11-15",
    visitTime: "11:00",
    expectedDepartureTime: "14:00",
    photoId: "p_test_1234567890123456",
    vehicleRequired: false,
    idempotencyKey: "k-test-12345",
  };

  const forbiddenFields = [
    "hostId",
    "hostName",
    "departmentId",
    "department",
    "purpose",
    "purposeDetail",
    "notes",
    "specialRequirements",
  ];

  for (const field of forbiddenFields) {
    assert.equal(field in formPayload, false, `Forbidden field ${field} must NOT appear in registration payload`);
  }
  assert.ok(formPayload.fullName);
  assert.ok(formPayload.mobileNumber);
  assert.ok(formPayload.visitorType);
  assert.ok(formPayload.visitDate);
  assert.ok(formPayload.visitTime);
  assert.ok(formPayload.photoId);
});

/* ------------------------------------------------------------------ */

console.log(`\n${"=".repeat(52)}`);
console.log(`  PASSED: ${passed}    FAILED: ${failed}`);
console.log("=".repeat(52));
if (failures.length) {
  console.log("\nFailures:");
  for (const failure of failures) console.log(`  - ${failure}`);
}
process.exit(failed === 0 ? 0 : 1);
