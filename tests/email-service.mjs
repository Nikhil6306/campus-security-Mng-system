import assert from "node:assert/strict";

import { sendCampusEmail } from "../lib/server/services/email.ts";
import { getSupabaseServerClient } from "../lib/supabase.ts";

const environment = [
  "NODE_ENV",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_ENABLE_DEVELOPMENT_DELIVERY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
const originalEnvironment = Object.fromEntries(
  environment.map((name) => [name, process.env[name]]),
);
const originalFetch = globalThis.fetch;
let requests = 0;

function configureDevelopmentDelivery() {
  process.env.NODE_ENV = "development";
  process.env.RESEND_API_KEY = "re_test_not_a_real_key";
  process.env.RESEND_FROM_EMAIL = "security@example.com";
  process.env.RESEND_ENABLE_DEVELOPMENT_DELIVERY = "true";
}

try {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.throws(
    () => getSupabaseServerClient(),
    /NEXT_PUBLIC_SUPABASE_URL must be configured/,
  );
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  assert.throws(
    () => getSupabaseServerClient(),
    /NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured/,
  );

  configureDevelopmentDelivery();
  delete process.env.RESEND_API_KEY;
  globalThis.fetch = async () => {
    requests += 1;
    throw new Error("Test should not perform an HTTP request");
  };
  await assert.rejects(
    sendCampusEmail({
      to: "recipient@example.com",
      subject: "Campus update",
      text: "A test message.",
    }),
    /RESEND_API_KEY must be configured/,
  );
  assert.equal(requests, 0, "missing configuration must not make a request");
  process.env.RESEND_API_KEY = "re_test_not_a_real_key";

  globalThis.fetch = async (url, options) => {
    requests += 1;
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(options.headers.Authorization, "Bearer re_test_not_a_real_key");
    assert.deepEqual(JSON.parse(options.body), {
      from: "security@example.com",
      to: ["recipient@example.com"],
      subject: "Campus update",
      text: "A test message.",
    });
    return Response.json({ id: "email_test_123" });
  };

  const receipt = await sendCampusEmail({
    to: "recipient@example.com",
    subject: "Campus update",
    text: "A test message.",
  });
  assert.deepEqual(receipt, { id: "email_test_123" });
  assert.equal(requests, 1);

  process.env.RESEND_ENABLE_DEVELOPMENT_DELIVERY = "false";
  await assert.rejects(
    sendCampusEmail({
      to: "recipient@example.com",
      subject: "Campus update",
      text: "A test message.",
    }),
    /delivery is disabled outside production/,
  );
  assert.equal(requests, 1, "disabled development delivery must not make a request");

  process.env.RESEND_ENABLE_DEVELOPMENT_DELIVERY = "true";
  await assert.rejects(
    sendCampusEmail({
      to: "not-an-email",
      subject: "Campus update",
      text: "A test message.",
    }),
    /valid email address/,
  );
  assert.equal(requests, 1, "invalid recipients must not make a request");

  globalThis.fetch = async () => new Response(null, { status: 503 });
  await assert.rejects(
    sendCampusEmail({
      to: "recipient@example.com",
      subject: "Campus update",
      text: "A test message.",
    }),
    /Resend rejected the email request \(HTTP 503\)/,
  );

  console.log("PASS  Resend email service safety and provider behavior");
} finally {
  globalThis.fetch = originalFetch;
  for (const name of environment) {
    if (originalEnvironment[name] === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = originalEnvironment[name];
    }
  }
}
