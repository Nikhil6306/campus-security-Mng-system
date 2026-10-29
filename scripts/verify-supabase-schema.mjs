import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envContent = readFileSync(".env.local", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function run() {
  const tables = [
    "profiles",
    "departments",
    "teachers",
    "teacher_availability",
    "campus_gates",
    "security_guards",
    "students",
    "visitors",
    "visit_requests",
    "visit_guests",
    "check_logs",
    "vehicles",
    "outings",
    "movements",
    "incidents",
    "emergencies",
    "notifications",
    "whatsapp_messages",
    "activity_logs",
    "campus_settings",
  ];

  for (const t of tables) {
    const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`- ${t}: ERROR: ${error.message}`);
    } else {
      console.log(`- ${t}: OK (count: ${count})`);
    }
  }
}

run().catch(console.error);
