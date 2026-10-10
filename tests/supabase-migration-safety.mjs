import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/0008_restrict_visitor_access.sql", import.meta.url),
  "utf8",
);

for (const policy of [
  '"Allow public visitor registration"',
  '"Allow public visit request creation"',
  '"Allow staff manage visitors"',
  '"Allow staff manage visit requests"',
  '"Allow visitor photos upload"',
  '"Allow staff read visitor photos"',
]) {
  assert.ok(migration.includes(`drop policy if exists ${policy}`), `${policy} is removed`);
}

assert.match(migration, /values \('visitor-photos', 'visitor-photos', false\)/);
assert.match(migration, /create policy visitor_photos_staff_read[\s\S]*public\.is_staff\(\)/);
assert.doesNotMatch(migration, /create policy[\s\S]*for insert[\s\S]*with check\s*\(true\)/i);

console.log("PASS  Supabase visitor migration removes permissive policies");
