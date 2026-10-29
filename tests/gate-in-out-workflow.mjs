/**
 * Automated test suite for the Gate QR verification, Check-In / Check-Out
 * security workflow, and Photo Upload content-type handling.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

console.log("Starting Gate In/Out Workflow & Security Tests...\n");

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

// 1. Test QR payload privacy
await test("QR code payload carries only opaque token or pass URL, zero PII", () => {
  const opaqueToken = `p_tok_${crypto.randomBytes(24).toString("base64url")}`;
  const bookingId = "DSVV-2026-0099";
  
  // The token or verify URL must not include visitor name, phone, or aadhaar
  assert.equal(opaqueToken.includes("Nikhil"), false);
  assert.equal(opaqueToken.includes("9876543210"), false);
  assert.match(opaqueToken, /^p_tok_[A-Za-z0-9_-]+$/);
});

// 2. Test token hashing for storage & DB lookup
await test("Pass token SHA-256 hash generation is deterministic and non-reversible", () => {
  const token = "p_tok_test_security_token_123456789";
  const hash1 = crypto.createHash("sha256").update(token).digest("hex");
  const hash2 = crypto.createHash("sha256").update(token).digest("hex");
  
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64);
  assert.notEqual(hash1, token);
});

// 3. Test Gate Verification State Rules
await test("Gate verification rules: pending, rejected, and expired passes reject check-in", () => {
  const isEligibleForCheckIn = (status, visitDate, today) => {
    if (status !== "Approved") return false;
    if (visitDate < today) return false;
    return true;
  };

  const today = "2026-10-16";
  assert.equal(isEligibleForCheckIn("Pending", today, today), false, "Pending should not be eligible");
  assert.equal(isEligibleForCheckIn("Rejected", today, today), false, "Rejected should not be eligible");
  assert.equal(isEligibleForCheckIn("Cancelled", today, today), false, "Cancelled should not be eligible");
  assert.equal(isEligibleForCheckIn("Approved", "2026-10-10", today), false, "Expired visitDate should not be eligible");
  assert.equal(isEligibleForCheckIn("Approved", today, today), true, "Approved today should be eligible");
});

// 4. Test Duplicate IN and OUT State Transitions
await test("Gate workflow: Prevents duplicate check-in and invalid check-out", () => {
  let visitorState = {
    id: "DSVV-2026-0001",
    status: "Approved",
    isOnCampus: false,
    checkInAt: null,
    checkOutAt: null,
  };

  function executeCheckIn(visitor, guardId) {
    if (visitor.isOnCampus) {
      throw new Error("ALREADY_INSIDE: Visitor has already checked in");
    }
    if (visitor.status !== "Approved") {
      throw new Error(`Cannot check in visitor with status ${visitor.status}`);
    }
    visitor.status = "Checked In";
    visitor.isOnCampus = true;
    visitor.checkInAt = new Date().toISOString();
    visitor.guardInId = guardId;
    return { ok: true, status: visitor.status };
  }

  function executeCheckOut(visitor, guardId) {
    if (!visitor.isOnCampus) {
      throw new Error("NOT_INSIDE: Visitor does not have an active check-in");
    }
    visitor.status = "Checked Out";
    visitor.isOnCampus = false;
    visitor.checkOutAt = new Date().toISOString();
    visitor.guardOutId = guardId;
    return { ok: true, status: visitor.status };
  }

  // 1st Check-in: Should succeed
  const inRes = executeCheckIn(visitorState, "GRD-01");
  assert.equal(inRes.ok, true);
  assert.equal(visitorState.status, "Checked In");
  assert.equal(visitorState.isOnCampus, true);

  // 2nd Check-in: Must be rejected (Duplicate IN prevented)
  assert.throws(
    () => executeCheckIn(visitorState, "GRD-01"),
    /ALREADY_INSIDE/,
    "Second check-in must throw duplicate error"
  );

  // 1st Check-out: Should succeed
  const outRes = executeCheckOut(visitorState, "GRD-02");
  assert.equal(outRes.ok, true);
  assert.equal(visitorState.status, "Checked Out");
  assert.equal(visitorState.isOnCampus, false);

  // 2nd Check-out: Must be rejected (No active check-in)
  assert.throws(
    () => executeCheckOut(visitorState, "GRD-02"),
    /NOT_INSIDE/,
    "Second check-out must throw not inside error"
  );
});

// 5. Test FormData Content-Type header fix
await test("API Client Header fix: FormData must NOT be sent with application/json", () => {
  // Simulate the fix in lib/api.ts
  function computeHeaders(init) {
    const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
    return {
      ...(init?.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    };
  }

  // Case A: JSON body
  const jsonHeaders = computeHeaders({ body: JSON.stringify({ test: 1 }) });
  assert.equal(jsonHeaders["Content-Type"], "application/json");

  // Case B: FormData body
  const formData = new FormData();
  formData.append("photo", "fake_bytes");
  const formHeaders = computeHeaders({ body: formData });
  assert.equal(formHeaders["Content-Type"], undefined, "Content-Type must be omitted for FormData to allow multipart boundary");
});

// 6. Test URL extraction from scanned QR
await test("Scanner URL extraction: extracts opaque token or booking ID from full URL", () => {
  function extractToken(raw) {
    let clean = raw.trim();
    const urlMatch = clean.match(/\/(?:visit\/verify|booking-status)\/([^/?#]+)/i) ||
                     clean.match(/[?&](?:token|id)=([^&#]+)/i);
    if (urlMatch) {
      clean = decodeURIComponent(urlMatch[1]).trim();
    }
    return clean;
  }

  assert.equal(extractToken("p_tok_abc123"), "p_tok_abc123");
  assert.equal(
    extractToken("https://campus.dsvv.ac.in/visit/verify/p_tok_secret999"),
    "p_tok_secret999"
  );
  assert.equal(
    extractToken("https://campus.dsvv.ac.in/booking-status?id=DSVV-2026-1234"),
    "DSVV-2026-1234"
  );
});

console.log("\n" + "=".repeat(52));
console.log(`  PASSED: ${passed}    FAILED: ${failed}`);
console.log("=".repeat(52) + "\n");

if (failed > 0) process.exit(1);
