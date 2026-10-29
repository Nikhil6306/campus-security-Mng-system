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

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query("SELECT id, full_name, mobile FROM public.visitors WHERE mobile = '9876543210' OR mobile_number = '9876543210';");
  console.log("Found in Supabase:", res.rows);

  await client.end();
}

main();
