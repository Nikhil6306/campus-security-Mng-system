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

console.log(`\n${"=".repeat(52)}`);
console.log(`  PASSED: ${passed}    FAILED: ${failed}`);
console.log("=".repeat(52));
if (failures.length) {
  console.log("\nFailures:");
  for (const failure of failures) console.log(`  - ${failure}`);
}
process.exit(failed === 0 ? 0 : 1);
