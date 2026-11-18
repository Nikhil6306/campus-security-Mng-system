import assert from "node:assert/strict";

import { getAppOrigin } from "../lib/server/app-origin.ts";

const keys = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "VERCEL_URL",
  "VERCEL",
  "NODE_ENV",
];
const previous = new Map(keys.map((key) => [key, process.env[key]]));

try {
  for (const key of keys) delete process.env[key];
  process.env.NODE_ENV = "development";
  assert.equal(getAppOrigin(), "http://localhost:3000");

  process.env.VERCEL = "1";
  process.env.VERCEL_URL = "campus-security-preview.vercel.app";
  assert.equal(getAppOrigin(), "https://campus-security-preview.vercel.app");

  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  assert.throws(() => getAppOrigin(), /cannot point to localhost on Vercel/);

  console.log("Deployment configuration checks passed.");
} finally {
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
