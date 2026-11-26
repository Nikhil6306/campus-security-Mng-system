import { NextRequest, NextResponse } from "next/server";

import * as route_0 from "@/lib/api-routes/guard-duty/patrols/routes/route";
import * as route_1 from "@/lib/api-routes/guard-duty/patrols/submissions/route";
import * as route_2 from "@/lib/api-routes/guard-duty/patrols/submit/route";
import * as route_3 from "@/lib/api-routes/guard-duty/shift/end/route";
import * as route_4 from "@/lib/api-routes/guard-duty/shift/start/route";
import * as route_5 from "@/lib/api-routes/admin/reset/route";
import * as route_6 from "@/lib/api-routes/admin/visitor-analytics/route";
import * as route_7 from "@/lib/api-routes/auth/forgot-password/route";
import * as route_8 from "@/lib/api-routes/auth/login/route";
import * as route_9 from "@/lib/api-routes/auth/logout/route";
import * as route_10 from "@/lib/api-routes/auth/resend-otp/route";
import * as route_11 from "@/lib/api-routes/auth/reset-password/route";
import * as route_12 from "@/lib/api-routes/auth/session/route";
import * as route_13 from "@/lib/api-routes/auth/signup/route";
import * as route_14 from "@/lib/api-routes/auth/verify-otp/route";
import * as route_15 from "@/lib/api-routes/faculty/decision/route";
import * as route_16 from "@/lib/api-routes/gate/check-in/route";
import * as route_17 from "@/lib/api-routes/gate/check-out/route";
import * as route_18 from "@/lib/api-routes/gate/verify/route";
import * as route_19 from "@/lib/api-routes/guard-duty/assignments/route";
import * as route_20 from "@/lib/api-routes/guard-duty/dashboard/route";
import * as route_21 from "@/lib/api-routes/guard-duty/handovers/route";
import * as route_22 from "@/lib/api-routes/guard-duty/live-handover-data/route";
import * as route_23 from "@/lib/api-routes/guard-duty/reports/route";
import * as route_24 from "@/lib/api-routes/guard-duty/staffing/route";
import * as route_25 from "@/lib/api-routes/guards/my-profile/route";
import * as route_26 from "@/lib/api-routes/guards/my-schedule/route";
import * as route_27 from "@/lib/api-routes/guards/register/route";
import * as route_28 from "@/lib/api-routes/guards/registrations/route";
import * as route_29 from "@/lib/api-routes/guards/schedule/route";
import * as route_30 from "@/lib/api-routes/guards/status/route";
import * as route_31 from "@/lib/api-routes/outpass/scan/route";
import * as route_32 from "@/lib/api-routes/public/bookings/route";
import * as route_33 from "@/lib/api-routes/public/directory/route";
import * as route_34 from "@/lib/api-routes/public/monthly-visitors/route";
import * as route_35 from "@/lib/api-routes/public/pass-delivery/route";
import * as route_36 from "@/lib/api-routes/public/slots/route";
import * as route_37 from "@/lib/api-routes/public/status/route";
import * as route_38 from "@/lib/api-routes/public/visitor-photo/route";
import * as route_39 from "@/lib/api-routes/sos/escalation-check/route";
import * as route_40 from "@/lib/api-routes/whatsapp/test/route";
import * as route_41 from "@/lib/api-routes/whatsapp/webhook/route";
import * as route_42 from "@/lib/api-routes/activity/route";
import * as route_43 from "@/lib/api-routes/analytics/route";
import * as route_44 from "@/lib/api-routes/bookings/route";
import * as route_45 from "@/lib/api-routes/departments/route";
import * as route_46 from "@/lib/api-routes/emergency/route";
import * as route_47 from "@/lib/api-routes/events/route";
import * as route_48 from "@/lib/api-routes/gates/route";
import * as route_49 from "@/lib/api-routes/guards/route";
import * as route_50 from "@/lib/api-routes/incidents/route";
import * as route_51 from "@/lib/api-routes/movements/route";
import * as route_52 from "@/lib/api-routes/notifications/route";
import * as route_53 from "@/lib/api-routes/outings/route";
import * as route_54 from "@/lib/api-routes/outpass/route";
import * as route_55 from "@/lib/api-routes/reports/route";
import * as route_56 from "@/lib/api-routes/safety-issues/route";
import * as route_57 from "@/lib/api-routes/search/route";
import * as route_58 from "@/lib/api-routes/settings/route";
import * as route_59 from "@/lib/api-routes/sos/route";
import * as route_60 from "@/lib/api-routes/state/route";
import * as route_61 from "@/lib/api-routes/teachers/route";
import * as route_62 from "@/lib/api-routes/vehicles/route";
import * as route_63 from "@/lib/api-routes/whatsapp/route";
import * as route_64 from "@/lib/api-routes/faculty/visitor-requests/[id]/accept/route";
import * as route_65 from "@/lib/api-routes/faculty/visitor-requests/[id]/reject/route";
import * as route_66 from "@/lib/api-routes/guard-duty/assignments/[id]/reassign/route";
import * as route_67 from "@/lib/api-routes/guard-duty/handovers/[id]/acknowledge/route";
import * as route_68 from "@/lib/api-routes/guard-duty/handovers/[id]/decision/route";
import * as route_69 from "@/lib/api-routes/bookings/[id]/guests/route";
import * as route_70 from "@/lib/api-routes/guard-duty/handovers/[id]/route";
import * as route_71 from "@/lib/api-routes/teachers/[id]/availability/route";
import * as route_72 from "@/lib/api-routes/whatsapp/[id]/retry/route";
import * as route_73 from "@/lib/api-routes/bookings/[id]/route";
import * as route_74 from "@/lib/api-routes/departments/[id]/route";
import * as route_75 from "@/lib/api-routes/emergency/[id]/route";
import * as route_76 from "@/lib/api-routes/gates/[id]/route";
import * as route_77 from "@/lib/api-routes/guards/[id]/route";
import * as route_78 from "@/lib/api-routes/incidents/[id]/route";
import * as route_79 from "@/lib/api-routes/notifications/[id]/route";
import * as route_80 from "@/lib/api-routes/outings/[id]/route";
import * as route_81 from "@/lib/api-routes/outpass/[id]/route";
import * as route_82 from "@/lib/api-routes/safety-issues/[id]/route";
import * as route_83 from "@/lib/api-routes/sos/[id]/route";
import * as route_84 from "@/lib/api-routes/teachers/[id]/route";
import * as route_85 from "@/lib/api-routes/vehicles/[id]/route";
import * as route_86 from "@/lib/api-routes/visitor-photo/[id]/route";
import * as route_87 from "@/lib/api-routes/visitors/[id]/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Handler = (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response> | Response;
type RouteModule = Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD", Handler>>;

const ROUTES: { segments: string[]; mod: RouteModule }[] = [
  { segments: ["guard-duty","patrols","routes"], mod: route_0 as unknown as RouteModule },
  { segments: ["guard-duty","patrols","submissions"], mod: route_1 as unknown as RouteModule },
  { segments: ["guard-duty","patrols","submit"], mod: route_2 as unknown as RouteModule },
  { segments: ["guard-duty","shift","end"], mod: route_3 as unknown as RouteModule },
  { segments: ["guard-duty","shift","start"], mod: route_4 as unknown as RouteModule },
  { segments: ["admin","reset"], mod: route_5 as unknown as RouteModule },
  { segments: ["admin","visitor-analytics"], mod: route_6 as unknown as RouteModule },
  { segments: ["auth","forgot-password"], mod: route_7 as unknown as RouteModule },
  { segments: ["auth","login"], mod: route_8 as unknown as RouteModule },
  { segments: ["auth","logout"], mod: route_9 as unknown as RouteModule },
  { segments: ["auth","resend-otp"], mod: route_10 as unknown as RouteModule },
  { segments: ["auth","reset-password"], mod: route_11 as unknown as RouteModule },
  { segments: ["auth","session"], mod: route_12 as unknown as RouteModule },
  { segments: ["auth","signup"], mod: route_13 as unknown as RouteModule },
  { segments: ["auth","verify-otp"], mod: route_14 as unknown as RouteModule },
  { segments: ["faculty","decision"], mod: route_15 as unknown as RouteModule },
  { segments: ["gate","check-in"], mod: route_16 as unknown as RouteModule },
  { segments: ["gate","check-out"], mod: route_17 as unknown as RouteModule },
  { segments: ["gate","verify"], mod: route_18 as unknown as RouteModule },
  { segments: ["guard-duty","assignments"], mod: route_19 as unknown as RouteModule },
  { segments: ["guard-duty","dashboard"], mod: route_20 as unknown as RouteModule },
  { segments: ["guard-duty","handovers"], mod: route_21 as unknown as RouteModule },
  { segments: ["guard-duty","live-handover-data"], mod: route_22 as unknown as RouteModule },
  { segments: ["guard-duty","reports"], mod: route_23 as unknown as RouteModule },
  { segments: ["guard-duty","staffing"], mod: route_24 as unknown as RouteModule },
  { segments: ["guards","my-profile"], mod: route_25 as unknown as RouteModule },
  { segments: ["guards","my-schedule"], mod: route_26 as unknown as RouteModule },
  { segments: ["guards","register"], mod: route_27 as unknown as RouteModule },
  { segments: ["guards","registrations"], mod: route_28 as unknown as RouteModule },
  { segments: ["guards","schedule"], mod: route_29 as unknown as RouteModule },
  { segments: ["guards","status"], mod: route_30 as unknown as RouteModule },
  { segments: ["outpass","scan"], mod: route_31 as unknown as RouteModule },
  { segments: ["public","bookings"], mod: route_32 as unknown as RouteModule },
  { segments: ["public","directory"], mod: route_33 as unknown as RouteModule },
  { segments: ["public","monthly-visitors"], mod: route_34 as unknown as RouteModule },
  { segments: ["public","pass-delivery"], mod: route_35 as unknown as RouteModule },
  { segments: ["public","slots"], mod: route_36 as unknown as RouteModule },
  { segments: ["public","status"], mod: route_37 as unknown as RouteModule },
  { segments: ["public","visitor-photo"], mod: route_38 as unknown as RouteModule },
  { segments: ["sos","escalation-check"], mod: route_39 as unknown as RouteModule },
  { segments: ["whatsapp","test"], mod: route_40 as unknown as RouteModule },
  { segments: ["whatsapp","webhook"], mod: route_41 as unknown as RouteModule },
  { segments: ["activity"], mod: route_42 as unknown as RouteModule },
  { segments: ["analytics"], mod: route_43 as unknown as RouteModule },
  { segments: ["bookings"], mod: route_44 as unknown as RouteModule },
  { segments: ["departments"], mod: route_45 as unknown as RouteModule },
  { segments: ["emergency"], mod: route_46 as unknown as RouteModule },
  { segments: ["events"], mod: route_47 as unknown as RouteModule },
  { segments: ["gates"], mod: route_48 as unknown as RouteModule },
  { segments: ["guards"], mod: route_49 as unknown as RouteModule },
  { segments: ["incidents"], mod: route_50 as unknown as RouteModule },
  { segments: ["movements"], mod: route_51 as unknown as RouteModule },
  { segments: ["notifications"], mod: route_52 as unknown as RouteModule },
  { segments: ["outings"], mod: route_53 as unknown as RouteModule },
  { segments: ["outpass"], mod: route_54 as unknown as RouteModule },
  { segments: ["reports"], mod: route_55 as unknown as RouteModule },
  { segments: ["safety-issues"], mod: route_56 as unknown as RouteModule },
  { segments: ["search"], mod: route_57 as unknown as RouteModule },
  { segments: ["settings"], mod: route_58 as unknown as RouteModule },
  { segments: ["sos"], mod: route_59 as unknown as RouteModule },
  { segments: ["state"], mod: route_60 as unknown as RouteModule },
  { segments: ["teachers"], mod: route_61 as unknown as RouteModule },
  { segments: ["vehicles"], mod: route_62 as unknown as RouteModule },
  { segments: ["whatsapp"], mod: route_63 as unknown as RouteModule },
  { segments: ["faculty","visitor-requests","[id]","accept"], mod: route_64 as unknown as RouteModule },
  { segments: ["faculty","visitor-requests","[id]","reject"], mod: route_65 as unknown as RouteModule },
  { segments: ["guard-duty","assignments","[id]","reassign"], mod: route_66 as unknown as RouteModule },
  { segments: ["guard-duty","handovers","[id]","acknowledge"], mod: route_67 as unknown as RouteModule },
  { segments: ["guard-duty","handovers","[id]","decision"], mod: route_68 as unknown as RouteModule },
  { segments: ["bookings","[id]","guests"], mod: route_69 as unknown as RouteModule },
  { segments: ["guard-duty","handovers","[id]"], mod: route_70 as unknown as RouteModule },
  { segments: ["teachers","[id]","availability"], mod: route_71 as unknown as RouteModule },
  { segments: ["whatsapp","[id]","retry"], mod: route_72 as unknown as RouteModule },
  { segments: ["bookings","[id]"], mod: route_73 as unknown as RouteModule },
  { segments: ["departments","[id]"], mod: route_74 as unknown as RouteModule },
  { segments: ["emergency","[id]"], mod: route_75 as unknown as RouteModule },
  { segments: ["gates","[id]"], mod: route_76 as unknown as RouteModule },
  { segments: ["guards","[id]"], mod: route_77 as unknown as RouteModule },
  { segments: ["incidents","[id]"], mod: route_78 as unknown as RouteModule },
  { segments: ["notifications","[id]"], mod: route_79 as unknown as RouteModule },
  { segments: ["outings","[id]"], mod: route_80 as unknown as RouteModule },
  { segments: ["outpass","[id]"], mod: route_81 as unknown as RouteModule },
  { segments: ["safety-issues","[id]"], mod: route_82 as unknown as RouteModule },
  { segments: ["sos","[id]"], mod: route_83 as unknown as RouteModule },
  { segments: ["teachers","[id]"], mod: route_84 as unknown as RouteModule },
  { segments: ["vehicles","[id]"], mod: route_85 as unknown as RouteModule },
  { segments: ["visitor-photo","[id]"], mod: route_86 as unknown as RouteModule },
  { segments: ["visitors","[id]"], mod: route_87 as unknown as RouteModule }
];

function matchRoute(pathSegments: string[]): { mod: RouteModule; params: Record<string, string> } | null {
  for (const entry of ROUTES) {
    if (entry.segments.length !== pathSegments.length) continue;
    const params: Record<string, string> = {};
    let matched = true;
    for (let i = 0; i < entry.segments.length; i++) {
      const pat = entry.segments[i];
      const actual = pathSegments[i];
      if (pat.startsWith("[") && pat.endsWith("]")) {
        params[pat.slice(1, -1)] = decodeURIComponent(actual);
      } else if (pat !== actual) {
        matched = false;
        break;
      }
    }
    if (matched) return { mod: entry.mod, params };
  }
  return null;
}

async function dispatch(request: NextRequest, context: { params: Promise<{ route: string[] }> }): Promise<Response> {
  const { route } = await context.params;
  const match = matchRoute(route || []);
  if (!match) {
    return NextResponse.json({ ok: false, error: { message: "API route not found.", code: "not_found" } }, { status: 404 });
  }
  const method = request.method.toUpperCase() as keyof RouteModule;
  const handler = match.mod[method];
  if (!handler) {
    return NextResponse.json({ ok: false, error: { message: "Method not allowed.", code: "method_not_allowed" } }, { status: 405 });
  }
  return handler(request, { params: Promise.resolve(match.params) });
}

export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const PATCH = dispatch;
export const DELETE = dispatch;
export const OPTIONS = dispatch;
export const HEAD = dispatch;
