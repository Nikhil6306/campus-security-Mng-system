import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Load .env.local manually for test script
const envContent = readFileSync(".env.local", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseService = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseService) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseService, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("Checking Supabase connection to:", supabaseUrl);

  // Check auth users
  const { data: users, error: userError } = await adminClient.auth.admin.listUsers();
  if (userError) {
    console.error("Failed to list users:", userError.message);
  } else {
    console.log(`Auth users count: ${users.users.length}`);
    for (const u of users.users) {
      console.log(`- User: ${u.email} (id: ${u.id})`);
    }
  }

  // Check profiles table
  const { data: profiles, error: profileError } = await adminClient
    .from("profiles")
    .select("id, email, full_name, role, active")
    .limit(10);
  if (profileError) {
    console.error("Failed to query profiles:", profileError.message);
  } else {
    console.log(`Profiles table query OK, count: ${profiles.length}`);
    for (const p of profiles) {
      console.log(`- Profile: ${p.email} | ${p.role} | ${p.full_name}`);
    }
  }

  // Check departments
  const { data: depts, error: deptError } = await adminClient
    .from("departments")
    .select("id, name")
    .limit(5);
  if (deptError) {
    console.error("Failed to query departments:", deptError.message);
  } else {
    console.log(`Departments table query OK, count: ${depts.length}`);
  }

  // Check campus gates
  const { data: gates, error: gateError } = await adminClient
    .from("campus_gates")
    .select("id, name")
    .limit(5);
  if (gateError) {
    console.error("Failed to query campus_gates:", gateError.message);
  } else {
    console.log(`Campus gates query OK, count: ${gates.length}`);
  }

  // Check storage buckets
  const { data: buckets, error: bucketError } = await adminClient.storage.listBuckets();
  if (bucketError) {
    console.error("Failed to list storage buckets:", bucketError.message);
  } else {
    console.log(`Storage buckets:`, buckets.map((b) => `${b.id} (public=${b.public})`));
  }
}

main().catch(console.error);
