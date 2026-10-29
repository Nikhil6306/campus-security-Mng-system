import pg from "pg";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

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
  const db = new DatabaseSync(".data/campus-security.db");
  const sqliteVisitCols = db.prepare("PRAGMA table_info(visit_requests)").all().map(c => c.name);
  const sqliteVisitorCols = db.prepare("PRAGMA table_info(visitors)").all().map(c => c.name);

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const pgVisitCols = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'visit_requests' AND table_schema = 'public'")).rows.map(r => r.column_name);
  const pgVisitorCols = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'visitors' AND table_schema = 'public'")).rows.map(r => r.column_name);

  console.log("visit_requests columns in SQLite but missing in Supabase:", sqliteVisitCols.filter(c => !pgVisitCols.includes(c)));
  console.log("visit_requests columns in Supabase but missing in SQLite:", pgVisitCols.filter(c => !sqliteVisitCols.includes(c)));

  const sqliteGuestCols = db.prepare("PRAGMA table_info(visit_guests)").all().map(c => c.name);
  const pgGuestCols = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'visit_guests' AND table_schema = 'public'")).rows.map(r => r.column_name);

  console.log("visit_guests columns in SQLite but missing in Supabase:", sqliteGuestCols.filter(c => !pgGuestCols.includes(c)));
  console.log("visit_guests columns in Supabase but missing in SQLite:", pgGuestCols.filter(c => !sqliteGuestCols.includes(c)));

  await client.end();
}

main();
