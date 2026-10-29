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
  const { data: reqs, error: rErr } = await sb
    .from("visit_requests")
    .select("id, visit_date, status, visitor_type, purpose, check_in_at, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log("Sample visit_requests:", reqs);

  const { data: statuses } = await sb.from("visit_requests").select("status");
  const statusCounts = {};
  for (const s of statuses || []) {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  }
  console.log("Visit request status counts:", statusCounts);

  const { data: vTypes } = await sb.from("visit_requests").select("visitor_type");
  const typeCounts = {};
  for (const t of vTypes || []) {
    typeCounts[t.visitor_type] = (typeCounts[t.visitor_type] || 0) + 1;
  }
  console.log("Visitor type counts in visit_requests:", typeCounts);

  const { data: visTypes } = await sb.from("visitors").select("visitor_type");
  const visTypeCounts = {};
  for (const t of visTypes || []) {
    visTypeCounts[t.visitor_type] = (visTypeCounts[t.visitor_type] || 0) + 1;
  }
  console.log("Visitor type counts in visitors table:", visTypeCounts);

  const { data: dates } = await sb.from("visit_requests").select("visit_date, created_at, status");
  console.log("Distinct dates count:", dates?.length);
  const monthCounts = {};
  for (const d of dates || []) {
    const ym = (d.visit_date || d.created_at || "").slice(0, 7);
    monthCounts[ym] = (monthCounts[ym] || 0) + 1;
  }
  console.log("Month distribution of visit_requests:", monthCounts);
}

run().catch(console.error);
