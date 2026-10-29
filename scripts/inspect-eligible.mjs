import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envContent = readFileSync(".env.local", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function run() {
  const { data: rows, error } = await sb
    .from("visit_requests")
    .select("id, visit_date, check_in_at, status, visitor_type, number_of_visitors");
  if (error) {
    console.error("Error:", error);
    return;
  }

  const eligible = rows.filter(
    (r) =>
      ["Checked In", "Meeting In Progress", "Checked Out"].includes(r.status) ||
      (r.check_in_at && !["Rejected", "Cancelled", "No Show", "Expired"].includes(r.status))
  );

  console.log(`Total rows: ${rows.length}, Eligible visits: ${eligible.length}`);

  const monthlyCounts = {};
  for (const r of eligible) {
    const ym = (r.visit_date || r.check_in_at || "").slice(0, 7);
    monthlyCounts[ym] = (monthlyCounts[ym] || 0) + (r.number_of_visitors || 1);
  }
  console.log("Eligible monthly headcounts:", monthlyCounts);

  const monthlyVisits = {};
  for (const r of eligible) {
    const ym = (r.visit_date || r.check_in_at || "").slice(0, 7);
    monthlyVisits[ym] = (monthlyVisits[ym] || 0) + 1;
  }
  console.log("Eligible monthly visit records count:", monthlyVisits);
}

run().catch(console.error);
