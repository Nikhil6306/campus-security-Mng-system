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
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL successfully!");

    // Check supabase migrations table if it exists
    const migCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'supabase_migrations';
    `);
    console.log("Migration tables:", migCheck.rows);

    if (migCheck.rows.length > 0) {
      const migs = await client.query(`SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;`);
      console.log("Applied migrations:", migs.rows.map(r => r.version));
    }

    // Check columns of visit_requests
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'visit_requests'
      ORDER BY ordinal_position;
    `);
    console.log("visit_requests columns in Postgres:", cols.rows.map(r => r.column_name));

    // Check columns of visitors
    const vCols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'visitors'
      ORDER BY ordinal_position;
    `);
    console.log("visitors columns in Postgres:", vCols.rows.map(r => r.column_name));

    // Check RLS policies
    const pols = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);
    console.log("RLS policies count:", pols.rows.length);
    for (const p of pols.rows) {
      console.log(`- ${p.tablename}: ${p.policyname} (${p.cmd})`);
      if (p.qual) console.log(`   USING: ${p.qual}`);
      if (p.with_check) console.log(`   WITH CHECK: ${p.with_check}`);
    }

    await client.end();
  } catch (err) {
    console.error("PG error:", err.message);
  }
}

main();
