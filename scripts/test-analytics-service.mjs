import { readFileSync } from "node:fs";

// Load .env.local
const envContent = readFileSync(".env.local", "utf8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

import { getPublicMonthlyVisitorStats, getAdminVisitorAnalytics } from "../lib/server/services/visitor-analytics.ts";

async function test() {
  console.log("Testing getPublicMonthlyVisitorStats()...");
  const pub = await getPublicMonthlyVisitorStats(2026);
  console.log("Public stats for 2026:", JSON.stringify(pub, null, 2));

  console.log("\nTesting getAdminVisitorAnalytics()...");
  const admin = await getAdminVisitorAnalytics(2026);
  console.log("Admin stats:", {
    stats: admin.stats,
    availableYears: admin.availableYears,
    selectedYear: admin.selectedYear,
    categoriesCount: admin.categories.length,
    requestStatusesCount: admin.requestStatuses.length,
    monthlyTrendsCount: admin.monthlyTrends.length,
    growthTrendCount: admin.growthTrend.length,
  });
}

test().catch(console.error);
