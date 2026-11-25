import { ADMIN_ROLES, GATE_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { AppError } from "@/lib/server/errors";
import { z } from "zod";
import {
  approveGuardRegistration,
  createGuardRegistrationRequest,
  listGuardRegistrationRequests,
  rejectGuardRegistration,
  suspendGuardAccount,
  reactivateGuardAccount,
} from "@/lib/server/services/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registrationSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().default(""),
  employeeId: z.string().default(""),
  password: z.string().min(6).optional(),
  address: z.string().default(""),
  emergencyContact: z.string().default(""),
  joiningDate: z.string().optional().nullable(),
  shift: z.enum(["Morning", "Evening", "Night", "General"]).default("Morning"),
  assignedGate: z.string().default(""),
  designation: z.string().default("Security Guard"),
  notes: z.string().optional().nullable(),
});

const approvalSchema = z.object({
  id: z.string(),
  action: z.enum(["approve", "reject", "suspend", "reactivate"]),
  adminRemarks: z.string().optional(),
  assignedGate: z.string().optional(),
  shift: z.enum(["Morning", "Evening", "Night", "General"]).optional(),
  shiftStart: z.string().optional(),
  shiftEnd: z.string().optional(),
  designation: z.string().optional(),
});

/**
 * GET /api/guards/registrations
 *
 * Admin: list all guard registration requests.
 * Supports ?status=PENDING | APPROVED | REJECTED | SUSPENDED | all
 */
export async function GET(request: Request) {
  return authedRoute(GATE_ROLES, async (session) => {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status") || "all";

    // 1. Fetch from local SQLite store
    const localRequests = listGuardRegistrationRequests(statusParam);

    // 2. If Supabase is configured and localRequests is empty, check Supabase
    if (isSupabaseConfigured() && localRequests.length === 0) {
      try {
        const admin = getSupabaseAdminClient();
        let query = admin
          .from("guard_registration_requests")
          .select("*")
          .order("created_at", { ascending: false });

        if (statusParam && statusParam !== "all") {
          query = query.eq("status", statusParam.toUpperCase());
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return { registrations: data };
        }
      } catch (err) {
        console.warn("[guards/registrations] Supabase query failed, falling back to local:", err);
      }
    }

    // Format fields consistently for frontend
    const mapped = localRequests.map((r) => ({
      id: r.id,
      user_id: r.id,
      full_name: r.full_name,
      email: r.email,
      phone: r.phone,
      employee_id: r.guard_id,
      designation: r.designation,
      assigned_gate: r.assigned_gate,
      status: r.status,
      rejection_reason: r.rejection_reason,
      admin_remarks: r.rejection_reason,
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
      reviewed_by: r.reviewed_by,
    }));

    return { registrations: mapped };
  });
}

/**
 * POST /api/guards/registrations
 *
 * Guard self-registration endpoint.
 */
export async function POST(request: Request) {
  return authedRoute(
    ["admin", "super_admin", "security", "teacher", "student", "visitor"],
    async (session) => {
      const body = await readBody(request);
      const input = registrationSchema.parse(body);

      const req = createGuardRegistrationRequest({
        fullName: input.fullName || session.name,
        email: input.email || session.email,
        phone: input.phone,
        guardId: input.employeeId,
        password: input.password || "Guard@123",
        designation: input.designation,
        assignedGate: input.assignedGate,
      });

      return {
        registration: req,
        message: "Your registration request has been submitted successfully. Awaiting administrator approval.",
      };
    },
  );
}

/**
 * PATCH /api/guards/registrations
 *
 * Admin approval, rejection, suspension, or reactivation of guard registration.
 */
export async function PATCH(request: Request) {
  return mutationRoute(ADMIN_ROLES, async (session) => {
    const body = await readBody(request);
    const input = approvalSchema.parse(body);

    if (input.action === "approve") {
      const { guard } = approveGuardRegistration(input.id, session, {
        gate: input.assignedGate,
        shift: input.shift,
        shiftStart: input.shiftStart,
        shiftEnd: input.shiftEnd,
        designation: input.designation,
      });

      return {
        status: "Approved",
        guardId: guard.id,
        message: `Guard registration for ${guard.fullName} has been approved. Account activated.`,
      };
    } else if (input.action === "reject") {
      rejectGuardRegistration(input.id, session, input.adminRemarks);
      return {
        status: "Rejected",
        message: "Guard registration request has been rejected.",
      };
    } else if (input.action === "suspend") {
      suspendGuardAccount(input.id, session, input.adminRemarks);
      return {
        status: "Suspended",
        message: "Guard account has been suspended.",
      };
    } else if (input.action === "reactivate") {
      reactivateGuardAccount(input.id, session);
      return {
        status: "Active",
        message: "Guard account has been reactivated.",
      };
    }

    throw new AppError("Invalid action", 400, "bad_request");
  });
}
