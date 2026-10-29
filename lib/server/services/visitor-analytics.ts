import "server-only";

import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getDb, all, get } from "../db";

export interface MonthlyVisitorDatum {
  month: number;
  monthName: string;
  monthShort: string;
  count: number; // Headcount (total people)
  visits: number; // Number of distinct visit records
  percentage: number;
}

export interface VisitorCategoryDatum {
  category: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface RequestStatusDatum {
  status: string;
  label: string;
  count: number;
  percentage: number;
  colorClass: string;
}

export interface GrowthPoint {
  label: string; // e.g. "Sep 2026"
  key: string;   // "2026-09"
  count: number;
  visits: number;
}

export interface AdminVisitorAnalyticsResult {
  stats: {
    totalRegisteredVisitors: number;
    currentMonthVisitors: number;
    previousMonthVisitors: number;
    currentMonthVisits: number;
    previousMonthVisits: number;
    monthlyDelta: number;
    monthlyGrowthPercent: number;
    totalEligibleVisits: number;
    totalEligibleHeadcount: number;
    totalRequests: number;
  };
  monthlyTrends: MonthlyVisitorDatum[];
  growthTrend: GrowthPoint[];
  categories: VisitorCategoryDatum[];
  requestStatuses: RequestStatusDatum[];
  availableYears: number[];
  selectedYear: number;
}

export interface PublicMonthlyStatsResult {
  year: number;
  availableYears: number[];
  months: {
    month: number;
    monthName: string;
    monthShort: string;
    count: number;
    visits: number;
    percentage: number;
  }[];
  totalYearVisitors: number;
  totalYearVisits: number;
  peakMonth: {
    name: string;
    count: number;
  } | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_SHORTS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const CATEGORY_COLORS: Record<string, string> = {
  "Parent/Guardian": "#3b82f6", // Blue
  Official: "#8b5cf6",         // Purple
  Vendor: "#f59e0b",           // Amber / Delivery
  Guest: "#10b981",            // Emerald
  Student: "#06b6d4",          // Cyan
  Staff: "#ec4899",            // Pink
  Alumni: "#6366f1",           // Indigo
  Other: "#64748b",            // Slate
};

const STATUS_COLOR_CLASSES: Record<string, string> = {
  Approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "Checked In": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "Meeting In Progress": "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  "Checked Out": "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  Pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  Cancelled: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30",
  "No Show": "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  Expired: "bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/30",
};

interface RawVisitRow {
  id: string;
  visit_date: string;
  check_in_at: string | null;
  status: string;
  visitor_type: string;
  number_of_visitors: number;
  created_at: string;
}

/**
 * Determines whether a visit record represents an actual campus visit.
 * Rejected, cancelled, expired, and unapproved pending visits are excluded.
 */
function isActualVisit(status: string, checkInAt: string | null): boolean {
  if (["Checked In", "Meeting In Progress", "Checked Out"].includes(status)) {
    return true;
  }
  if (checkInAt && !["Rejected", "Cancelled", "No Show", "Expired"].includes(status)) {
    return true;
  }
  return false;
}

/**
 * Extracts the ISO date string (YYYY-MM-DD) for a visit in Indian Standard Time.
 */
function getVisitDateKey(row: RawVisitRow): string {
  if (row.check_in_at) {
    try {
      const d = new Date(row.check_in_at);
      // IST is UTC+5:30
      const istTime = new Date(d.getTime() + 5.5 * 3600_000);
      return istTime.toISOString().slice(0, 10);
    } catch {
      // Fallback to visit_date
    }
  }
  return row.visit_date || row.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
}

/**
 * Loads visit requests and visitors from Supabase (or SQLite fallback if offline).
 */
async function loadAnalyticsSourceData(): Promise<{
  rows: RawVisitRow[];
  totalRegistered: number;
}> {
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();

      // Total registered visitors
      const { count: registeredCount } = await admin
        .from("visitors")
        .select("*", { count: "exact", head: true });

      // All visit requests
      const { data: visits, error } = await admin
        .from("visit_requests")
        .select("id, visit_date, check_in_at, status, visitor_type, number_of_visitors, created_at");

      if (!error && visits) {
        return {
          rows: visits.map((v) => ({
            id: v.id,
            visit_date: v.visit_date,
            check_in_at: v.check_in_at,
            status: v.status || "Pending",
            visitor_type: v.visitor_type || "Guest",
            number_of_visitors: Number(v.number_of_visitors) || 1,
            created_at: v.created_at || v.visit_date,
          })),
          totalRegistered: registeredCount ?? 0,
        };
      }
    } catch (err) {
      console.warn("[analytics] Supabase direct query failed, trying local DB fallback:", err);
    }
  }

  // SQLite fallback
  const db = getDb();
  const regCount = (get<{ c: number }>("SELECT COUNT(*) AS c FROM visitors")?.c) ?? 0;
  const visits = all<RawVisitRow>(
    "SELECT id, visit_date, check_in_at, status, visitor_type, number_of_visitors, created_at FROM visit_requests"
  );

  return {
    rows: visits.map((v) => ({
      ...v,
      number_of_visitors: Number(v.number_of_visitors) || 1,
    })),
    totalRegistered: regCount,
  };
}

/**
 * Produces the complete monthly visitor analytics for the Admin Panel.
 */
export async function getAdminVisitorAnalytics(
  targetYear?: number
): Promise<AdminVisitorAnalyticsResult> {
  const { rows, totalRegistered } = await loadAnalyticsSourceData();

  // All eligible visits
  const eligibleVisits = rows.filter((r) => isActualVisit(r.status, r.check_in_at));

  // Determine available years
  const yearSet = new Set<number>();
  for (const r of eligibleVisits) {
    const key = getVisitDateKey(r);
    const yr = parseInt(key.slice(0, 4), 10);
    if (!isNaN(yr)) yearSet.add(yr);
  }
  // Also include current year
  const currentYear = new Date().getFullYear();
  yearSet.add(currentYear);
  const availableYears = Array.from(yearSet).sort((a, b) => b - a);

  // Selected year defaults to targetYear if valid, otherwise latest available year
  const selectedYear = targetYear && availableYears.includes(targetYear)
    ? targetYear
    : availableYears[0] ?? currentYear;

  // Monthly trends for selected year (12 months: Jan to Dec)
  const monthlyCounts = new Array(12).fill(0);
  const monthlyVisits = new Array(12).fill(0);

  for (const r of eligibleVisits) {
    const key = getVisitDateKey(r);
    const yr = parseInt(key.slice(0, 4), 10);
    const mo = parseInt(key.slice(5, 7), 10) - 1; // 0-indexed
    if (yr === selectedYear && mo >= 0 && mo < 12) {
      monthlyCounts[mo] += r.number_of_visitors;
      monthlyVisits[mo] += 1;
    }
  }

  const selectedYearTotalHeadcount = monthlyCounts.reduce((a, b) => a + b, 0);

  const monthlyTrends: MonthlyVisitorDatum[] = monthlyCounts.map((count, idx) => ({
    month: idx + 1,
    monthName: MONTH_NAMES[idx],
    monthShort: MONTH_SHORTS[idx],
    count,
    visits: monthlyVisits[idx],
    percentage: selectedYearTotalHeadcount > 0
      ? Math.round((count / selectedYearTotalHeadcount) * 100)
      : 0,
  }));

  // Historical growth trend over all months across all data
  const growthMap = new Map<string, { count: number; visits: number }>();
  for (const r of eligibleVisits) {
    const key = getVisitDateKey(r).slice(0, 7); // YYYY-MM
    const current = growthMap.get(key) || { count: 0, visits: 0 };
    current.count += r.number_of_visitors;
    current.visits += 1;
    growthMap.set(key, current);
  }

  const sortedMonthKeys = Array.from(growthMap.keys()).sort();
  const growthTrend: GrowthPoint[] = sortedMonthKeys.map((key) => {
    const [y, m] = key.split("-").map(Number);
    const label = `${MONTH_SHORTS[m - 1]} ${y}`;
    const val = growthMap.get(key)!;
    return {
      label,
      key,
      count: val.count,
      visits: val.visits,
    };
  });

  // Current month vs Previous month comparison
  // Use current local date to determine current and previous month keys
  const now = new Date();
  const currYear = now.getFullYear();
  const currMonth = now.getMonth() + 1; // 1-12
  const currentMonthKey = `${currYear}-${String(currMonth).padStart(2, "0")}`;

  const prevDate = new Date(currYear, currMonth - 2, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;
  const previousMonthKey = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

  const currentMonthData = growthMap.get(currentMonthKey) || { count: 0, visits: 0 };
  const previousMonthData = growthMap.get(previousMonthKey) || { count: 0, visits: 0 };

  const currentMonthVisitors = currentMonthData.count;
  const previousMonthVisitors = previousMonthData.count;
  const monthlyDelta = currentMonthVisitors - previousMonthVisitors;
  const monthlyGrowthPercent = previousMonthVisitors > 0
    ? Math.round(((currentMonthVisitors - previousMonthVisitors) / previousMonthVisitors) * 1000) / 10
    : currentMonthVisitors > 0 ? 100 : 0;

  // Visitor category breakdown
  // Category distribution for selected year (or all if year has no visits)
  const categoryMap = new Map<string, number>();
  let totalCategoryHeadcount = 0;

  for (const r of rows) {
    const key = getVisitDateKey(r);
    const yr = parseInt(key.slice(0, 4), 10);
    // Consider rows for the selected year
    if (yr === selectedYear || selectedYearTotalHeadcount === 0) {
      const cat = r.visitor_type || "Guest";
      const add = r.number_of_visitors || 1;
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + add);
      totalCategoryHeadcount += add;
    }
  }

  const categories: VisitorCategoryDatum[] = Array.from(categoryMap.entries())
    .map(([cat, count]) => ({
      category: cat,
      label: cat === "Vendor" ? "Vendors / Delivery" : cat,
      count,
      percentage: totalCategoryHeadcount > 0 ? Math.round((count / totalCategoryHeadcount) * 100) : 0,
      color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other,
    }))
    .sort((a, b) => b.count - a.count);

  // Request status breakdown
  const statusMap = new Map<string, number>();
  for (const r of rows) {
    const st = r.status || "Pending";
    statusMap.set(st, (statusMap.get(st) || 0) + 1);
  }

  const totalRequests = rows.length;
  const requestStatuses: RequestStatusDatum[] = Array.from(statusMap.entries())
    .map(([status, count]) => ({
      status,
      label: status,
      count,
      percentage: totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0,
      colorClass: STATUS_COLOR_CLASSES[status] || STATUS_COLOR_CLASSES.Pending,
    }))
    .sort((a, b) => b.count - a.count);

  const totalEligibleHeadcount = eligibleVisits.reduce((acc, r) => acc + r.number_of_visitors, 0);

  return {
    stats: {
      totalRegisteredVisitors: totalRegistered,
      currentMonthVisitors,
      previousMonthVisitors,
      currentMonthVisits: currentMonthData.visits,
      previousMonthVisits: previousMonthData.visits,
      monthlyDelta,
      monthlyGrowthPercent,
      totalEligibleVisits: eligibleVisits.length,
      totalEligibleHeadcount,
      totalRequests,
    },
    monthlyTrends,
    growthTrend,
    categories,
    requestStatuses,
    availableYears,
    selectedYear,
  };
}

/**
 * Produces aggregated, privacy-safe monthly visitor stats for the public website.
 * Contains ZERO PII (no names, phones, IDs, photos, addresses, hosts, or notes).
 */
export async function getPublicMonthlyVisitorStats(
  targetYear?: number
): Promise<PublicMonthlyStatsResult> {
  const { rows } = await loadAnalyticsSourceData();

  // Filter only actual campus visits
  const eligibleVisits = rows.filter((r) => isActualVisit(r.status, r.check_in_at));

  // Collect available years
  const yearSet = new Set<number>();
  for (const r of eligibleVisits) {
    const key = getVisitDateKey(r);
    const yr = parseInt(key.slice(0, 4), 10);
    if (!isNaN(yr)) yearSet.add(yr);
  }
  const currentYear = new Date().getFullYear();
  yearSet.add(currentYear);
  const availableYears = Array.from(yearSet).sort((a, b) => b - a);

  const selectedYear = targetYear && availableYears.includes(targetYear)
    ? targetYear
    : availableYears[0] ?? currentYear;

  const monthlyCounts = new Array(12).fill(0);
  const monthlyVisits = new Array(12).fill(0);

  for (const r of eligibleVisits) {
    const key = getVisitDateKey(r);
    const yr = parseInt(key.slice(0, 4), 10);
    const mo = parseInt(key.slice(5, 7), 10) - 1;
    if (yr === selectedYear && mo >= 0 && mo < 12) {
      monthlyCounts[mo] += r.number_of_visitors;
      monthlyVisits[mo] += 1;
    }
  }

  const totalYearVisitors = monthlyCounts.reduce((a, b) => a + b, 0);
  const totalYearVisits = monthlyVisits.reduce((a, b) => a + b, 0);

  let peakMonthIndex = -1;
  let peakMonthCount = 0;
  monthlyCounts.forEach((c, idx) => {
    if (c > peakMonthCount) {
      peakMonthCount = c;
      peakMonthIndex = idx;
    }
  });

  const months = monthlyCounts.map((count, idx) => ({
    month: idx + 1,
    monthName: MONTH_NAMES[idx],
    monthShort: MONTH_SHORTS[idx],
    count,
    visits: monthlyVisits[idx],
    percentage: totalYearVisitors > 0
      ? Math.round((count / totalYearVisitors) * 100)
      : 0,
  }));

  return {
    year: selectedYear,
    availableYears,
    months,
    totalYearVisitors,
    totalYearVisits,
    peakMonth: peakMonthIndex >= 0 ? {
      name: MONTH_NAMES[peakMonthIndex],
      count: peakMonthCount,
    } : null,
  };
}
