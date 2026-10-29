import { NextRequest, NextResponse } from "next/server";
import { ADMIN_ROLES, authedRoute } from "@/lib/server/http";
import { getShiftAndPatrolReports } from "@/lib/server/services/guard-duty";
import { todayISO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || todayISO(-30);
  const to = searchParams.get("to") || todayISO(1);
  const gate = searchParams.get("gate") || undefined;
  const guardId = searchParams.get("guardId") || undefined;
  const format = searchParams.get("format");

  if (format === "csv") {
    // Generate CSV export
    return authedRoute(ADMIN_ROLES, async () => {
      const data = getShiftAndPatrolReports({ fromDate: from, toDate: to, gate });
      
      const csvLines = [
        ["Report Type", "Shift & Patrol Compliance Audit Report"],
        ["Period", `${data.period.from} to ${data.period.to}`],
        ["Total Scheduled Shifts", String(data.metrics.totalAssigned)],
        ["Completed Shifts", String(data.metrics.completedShifts)],
        ["Late Check-ins", String(data.metrics.lateCheckins)],
        ["Total Patrols Conducted", String(data.metrics.totalPatrols)],
        ["Failed Patrols", String(data.metrics.failedPatrols)],
        ["Patrol Pass Rate", `${data.metrics.patrolPassRate}%`],
        ["Approved Handovers", String(data.metrics.approvedHandovers)],
        ["Rejected Handovers", String(data.metrics.rejectedHandovers)],
      ].map((line) => line.join(",")).join("\n");

      return new NextResponse(csvLines, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="guard_duty_report_${from}_${to}.csv"`,
        },
      });
    });
  }

  return authedRoute(ADMIN_ROLES, async () => {
    return getShiftAndPatrolReports({ fromDate: from, toDate: to, gate });
  });
}
