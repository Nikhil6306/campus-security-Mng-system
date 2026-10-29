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
  console.log("Connected to Supabase PostgreSQL.");

  const migrationSql = readFileSync("supabase/migrations/0013_visitor_registration_fields.sql", "utf8");
  
  await client.query("BEGIN;");
  try {
    console.log("Applying 0013_visitor_registration_fields.sql...");
    await client.query(migrationSql);

    // Record migration in schema_migrations
    await client.query(`
      INSERT INTO supabase_migrations.schema_migrations(version)
      VALUES ('0013')
      ON CONFLICT (version) DO NOTHING;
    `);

    await client.query("COMMIT;");
    console.log("Migration 0013 applied successfully!");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Migration failed:", err);
    process.exit(1);
  }

  // Verify columns now exist
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'visit_requests' AND table_schema = 'public' AND column_name IN ('expected_departure_time', 'vehicle_type');
  `);
  console.log("Verified columns in visit_requests:", res.rows);

  await client.end();
}

main().catch(console.error);
