import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envContent = readFileSync(".env.local", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
}

async function testSql() {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/`;
  console.log("Checking RPC availability...");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Test if an RPC function exists or can be called
  const { data, error } = await sb.rpc("is_admin");
  console.log("is_admin call:", { data, error });
}

testSql().catch(console.error);
