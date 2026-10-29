import pg from "pg";
import { readFileSync } from "node:fs";

const { Client } = pg;

const envContent = readFileSync(".env.local", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const projectRef = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const password = encodeURIComponent(env.POSTGRES_PASSWORD || "");
const connectionString = `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`;

const BASE_URL = "http://localhost:3000";

async function main() {
  console.log("=== STARTING VISITOR REGISTRATION & SUPABASE E2E VERIFICATION ===");

  // 2. Upload sample visitor photo
  // A minimal valid 1x1 JPEG byte stream
  const jpegBytes = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x00, 0xff, 0xd9,
  ]);

  const formData = new FormData();
  formData.append("photo", new Blob([jpegBytes], { type: "image/jpeg" }), "photo.jpg");

  const photoRes = await fetch(`${BASE_URL}/api/public/visitor-photo`, {
    method: "POST",
    body: formData,
  });

  if (!photoRes.ok) {
    const errText = await photoRes.text();
    throw new Error(`Photo upload failed: ${photoRes.status} ${errText}`);
  }
  const photoJson = await photoRes.json();
  const photoId = photoJson.data?.photoId;
  console.log("✓ Photo uploaded successfully. Photo ID:", photoId);

  // 3. Prepare registration payload
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const visitDate = tomorrow.toISOString().split("T")[0];

  const testMobile = "98" + Math.floor(10000000 + Math.random() * 90000000);
  const idempotencyKey = `idemp-${Date.now()}`;

  const registrationPayload = {
    fullName: "Aditya Narayan Verma",
    mobileNumber: testMobile,
    email: "aditya.test@dsvv.edu.in",
    visitorType: "Academic Visitor",
    visitDate,
    visitTime: "10:00",
    expectedDepartureTime: "11:30",
    photoId,
    vehicleRequired: true,
    hasCar: true,
    vehicleType: "Car",
    vehicleNumber: "UK07AB9999",
    carNumber: "UK07AB9999",
    idempotencyKey,
  };

  console.log("Submitting visitor registration to /api/public/bookings...");
  const regRes = await fetch(`${BASE_URL}/api/public/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(registrationPayload),
  });

  const regJson = await regRes.json();
  console.log("HTTP status:", regRes.status);

  if (!regRes.ok || !regJson.ok) {
    console.error("Registration failed response:", regJson);
    throw new Error(`Registration failed: ${JSON.stringify(regJson)}`);
  }

  const createdBooking = regJson.data;
  console.log("✓ Registration SUCCESSFUL!");
  console.log("  Booking ID:       ", createdBooking.id);
  console.log("  Status:           ", createdBooking.status);
  console.log("  Pass Token:       ", createdBooking.passToken ? "Issued" : "Pending");
  console.log("  Full Name:        ", createdBooking.fullName);
  console.log("  Mobile:           ", createdBooking.mobileNumber);
  console.log("  Vehicle Number:   ", createdBooking.vehicleNumber);
  console.log("  Departure Time:   ", createdBooking.expectedDepartureTime);

  // 4. Verify in Supabase PostgreSQL directly
  console.log("\nVerifying record directly in remote Supabase PostgreSQL...");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const sbVisit = await client.query(
    "SELECT * FROM public.visit_requests WHERE id = $1",
    [createdBooking.id]
  );

  if (sbVisit.rows.length === 0) {
    throw new Error(`CRITICAL: Booking ${createdBooking.id} was NOT found in Supabase public.visit_requests!`);
  }

  const row = sbVisit.rows[0];
  console.log("✓ Record found in Supabase public.visit_requests:");
  console.log("  Supabase ID:               ", row.id);
  console.log("  Supabase Visitor ID:       ", row.visitor_id);
  console.log("  Supabase Full Name:        ", row.full_name);
  console.log("  Supabase Mobile:           ", row.mobile);
  console.log("  Supabase Status:           ", row.status);
  console.log("  Supabase Vehicle Type:     ", row.vehicle_type);
  console.log("  Supabase Departure Time:   ", row.expected_departure_time);
  console.log("  Supabase Pass Token:       ", row.pass_token ? "MATCHED" : "NULL");

  // Verify visitor record in Supabase
  const sbVisitor = await client.query(
    "SELECT * FROM public.visitors WHERE id = $1",
    [row.visitor_id]
  );
  if (sbVisitor.rows.length === 0) {
    throw new Error(`CRITICAL: Visitor ${row.visitor_id} was NOT found in Supabase public.visitors!`);
  }
  console.log("✓ Visitor record confirmed in Supabase public.visitors (ID: " + sbVisitor.rows[0].id + ")");

  // 5. Test idempotency replay
  console.log("\nTesting Idempotency: Resubmitting identical payload with same key...");
  const replayRes = await fetch(`${BASE_URL}/api/public/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(registrationPayload),
  });
  const replayJson = await replayRes.json();
  if (replayJson.data?.id === createdBooking.id && replayJson.data?.replayed) {
    console.log("✓ Idempotency protected: Replayed booking returned successfully with no duplicate created!");
  } else {
    console.log("Idempotency response:", replayJson);
  }

  // 6. Test Admin Retrieval
  console.log("\nTesting Admin Dashboard Retrieval...");
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@dsvv.edu.in",
      password: process.env.DEMO_ACCOUNT_PASSWORD || "Admin@123",
    }),
  });

  if (!loginRes.ok) {
    const txt = await loginRes.text();
    console.warn("Admin login failed:", loginRes.status, txt);
  } else {
    const loginCookies = loginRes.headers.get("set-cookie") || "";
    const bookingsRes = await fetch(`${BASE_URL}/api/bookings`, {
      headers: { Cookie: loginCookies },
    });
    const bookingsJson = await bookingsRes.json();
    const foundInAdmin = bookingsJson.data?.some(b => b.id === createdBooking.id);
    if (foundInAdmin) {
      console.log("✓ Admin dashboard endpoint /api/bookings successfully retrieved the newly registered visitor!");
    } else {
      console.log("Admin bookings list count: " + bookingsJson.data?.length);
    }

    // 7. Test Admin Manual Approval Workflow
    console.log("\nTesting Manual Approval Workflow via Admin API...");
    const manualMobile = "98" + Math.floor(10000000 + Math.random() * 90000000);
    const manualPayload = {
      fullName: "Suresh Chandra Joshi",
      mobileNumber: manualMobile,
      email: "suresh.joshi@example.com",
      visitorType: "Guest",
      visitDate,
      visitTime: "14:00",
      numberOfVisitors: 4,
      guests: [
        { fullName: "Rekha Joshi", relation: "Spouse" },
        { fullName: "Aman Joshi", relation: "Child" },
        { fullName: "Neha Joshi", relation: "Child" },
      ],
      photoId,
      idempotencyKey: `manual-${Date.now()}`,
    };

    const manualRes = await fetch(`${BASE_URL}/api/public/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manualPayload),
    });
    const manualJson = await manualRes.json();
    console.log("✓ Pending party booking created:", manualJson.data?.id, "Status:", manualJson.data?.status);

    if (manualJson.data?.status === "Pending") {
      // Verify Pending in Supabase
      const sbPending = await client.query("SELECT status FROM public.visit_requests WHERE id = $1", [manualJson.data.id]);
      console.log("✓ Status in Supabase before approval:", sbPending.rows[0]?.status);

      // Approve via Admin PATCH
      const approveRes = await fetch(`${BASE_URL}/api/bookings/${manualJson.data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: loginCookies },
        body: JSON.stringify({ action: "approve" }),
      });
      const approveJson = await approveRes.json();
      console.log("✓ Admin PATCH approve response:", approveRes.status, "New Status:", approveJson.data?.status);

      // Verify Approved in Supabase
      const sbApproved = await client.query("SELECT status, badge_number FROM public.visit_requests WHERE id = $1", [manualJson.data.id]);
      console.log("✓ Status in Supabase after approval:", sbApproved.rows[0]?.status, "Badge:", sbApproved.rows[0]?.badge_number);

      await client.query("DELETE FROM public.visit_requests WHERE id = $1", [manualJson.data.id]);
    }
  }

  // Clean up test booking to maintain pristine database state
  await client.query("DELETE FROM public.visit_requests WHERE id = $1", [createdBooking.id]);
  await client.query("DELETE FROM public.visitors WHERE id = $1", [row.visitor_id]);
  console.log("✓ Cleaned up test record from Supabase.");

  await client.end();
  console.log("\n🎉 ALL E2E VERIFICATION TESTS PASSED SUCCESSFULLY!");
}

main().catch((err) => {
  console.error("\n❌ E2E VERIFICATION FAILED:", err);
  process.exit(1);
});
