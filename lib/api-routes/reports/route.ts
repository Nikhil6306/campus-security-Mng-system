import { ADMIN_ROLES, authedRoute } from "@/lib/server/http";
import { badRequest } from "@/lib/server/errors";
import { REPORT_KINDS, buildReport, type ReportKind } from "@/lib/server/services/reports";
import { todayISO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return authedRoute(ADMIN_ROLES, () => {
    const url = new URL(request.url);
    const kind = (url.searchParams.get("kind") ?? "visitors") as ReportKind;
    if (!REPORT_KINDS.includes(kind)) throw badRequest("Unknown report type.");

    return buildReport(kind, {
      from: url.searchParams.get("from") ?? todayISO(-30),
      to: url.searchParams.get("to") ?? todayISO(30),
      department: url.searchParams.get("department") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      purpose: url.searchParams.get("purpose") ?? undefined,
      severity: url.searchParams.get("severity") ?? undefined,
      guardId: url.searchParams.get("guardId") ?? undefined,
      teacherId: url.searchParams.get("teacherId") ?? undefined,
    });
  });
}
