import { ADMIN_ROLES, GATE_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { AppError } from "@/lib/server/errors";
import { z } from "zod";
import { findGuard } from "@/lib/server/repo";
import { run, get, nextId } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registrationSchema = z.object({
  phone: z.string().default(""),
  employeeId: z.string().default(""),
  address: z.string().default(""),
  emergencyContact: z.string().default(""),
  joiningDate: z.string().optional().nullable(),
  shift: z.enum(["Morning", "Evening", "Night", "General"]).default("Morning"),
  assignedGate: z.string().default(""),
  notes: z.string().optional().nullable(),
});

const approvalSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  adminRemarks: z.string().optional(),
  // For approval: optional guard record fields to set
  assignedGate: z.string().optional(),
  shift: z.enum(["Morning", "Evening", "Night", "General"]).optional(),
  shiftStart: z.string().optional(),
  shiftEnd: z.string().optional(),
});

/**
 * GET /api/guards/registrations
 *
 * Admin: list all guard registration requests.
 * Guard (security role): see their own registration status.
 */
export async function GET(request: Request) {
  return authedRoute(GATE_ROLES, async (session) => {
    if (!isSupabaseConfigured()) {
      return { registrations: [] };
    }

    const admin = getSupabaseAdminClient();
    let query = admin
      .from("guard_registrations")
      .select("*")
      .order("created_at", { ascending: false });

    // Non-admins only see their own
    if (session.role !== "admin" && session.role !== "super_admin") {
      query = query.eq("user_id", session.userId);
    }

    const { data, error } = await query;
    if (error) throw new AppError("Failed to load registrations.", 500, "db_error");

    return { registrations: data ?? [] };
  });
}

/**
 * POST /api/guards/registrations
 *
 * Any signed-in user (of any role, including security) submits a guard
 * registration request. The profile row is NOT activated until admin approves.
 */
export async function POST(request: Request) {
  return authedRoute(
    ["admin", "super_admin", "security", "teacher", "student", "visitor"],
    async (session) => {
      const body = await readBody(request);
      const input = registrationSchema.parse(body);

      if (!isSupabaseConfigured()) {
        throw new AppError("Supabase is not configured.", 503, "not_configured");
      }

      const admin = getSupabaseAdminClient();

      // Check for existing pending/approved registration for this user
      const { data: existing } = await admin
        .from("guard_registrations")
        .select("id, status")
        .eq("user_id", session.userId)
        .in("status", ["Pending", "Approved"])
        .maybeSingle();

      if (existing) {
        throw new AppError(
          existing.status === "Approved"
            ? "Your guard registration has already been approved."
            : "You already have a pending guard registration request.",
          409,
          "conflict",
        );
      }

      const { data, error } = await admin
        .from("guard_registrations")
        .insert({
          user_id: session.userId,
          full_name: session.name,
          email: session.email,
          phone: input.phone,
          employee_id: input.employeeId,
          address: input.address,
          emergency_contact: input.emergencyContact,
          joining_date: input.joiningDate ?? null,
          shift: input.shift,
          assigned_gate: input.assignedGate,
          notes: input.notes ?? null,
          status: "Pending",
        })
        .select()
        .single();

      if (error) throw new AppError("Failed to submit registration.", 500, "db_error");

      return { registration: data, message: "Registration submitted. Awaiting admin approval." };
    },
  );
}

/**
 * PATCH /api/guards/registrations
 *
 * Admin: approve or reject a guard registration.
 */
export async function PATCH(request: Request) {
  return mutationRoute(ADMIN_ROLES, async (session) => {
    const body = await readBody(request);
    const input = approvalSchema.parse(body);

    if (!isSupabaseConfigured()) {
      throw new AppError("Supabase is not configured.", 503, "not_configured");
    }

    const admin = getSupabaseAdminClient();

    // Fetch the registration
    const { data: reg, error: regErr } = await admin
      .from("guard_registrations")
      .select("*")
      .eq("id", input.id)
      .single();

    if (regErr || !reg) {
      throw new AppError("Registration not found.", 404, "not_found");
    }

    if (reg.status !== "Pending") {
      throw new AppError(`This registration has already been ${reg.status.toLowerCase()}.`, 409, "conflict");
    }

    const now = new Date().toISOString();

    if (input.action === "approve") {
      // 1. Create a security_guard record if not already linked
      const guardId = nextId("GRD", { pad: 3 });
      const gate = input.assignedGate ?? reg.assigned_gate ?? "Main Gate";
      const shift = input.shift ?? reg.shift ?? "Morning";
      const shiftStart = input.shiftStart ?? (shift === "Morning" ? "06:00" : shift === "Evening" ? "14:00" : "22:00");
      const shiftEnd = input.shiftEnd ?? (shift === "Morning" ? "14:00" : shift === "Evening" ? "22:00" : "06:00");

      run(
        `INSERT INTO security_guards
           (id, employee_id, full_name, phone, email, shift, shift_start, shift_end,
            assigned_gate, status, joining_date, emergency_contact, address, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO NOTHING`,
        [
          guardId,
          (reg.employee_id || guardId).toUpperCase(),
          reg.full_name,
          reg.phone || "",
          reg.email,
          shift,
          shiftStart,
          shiftEnd,
          gate,
          "Active",
          reg.joining_date || now.slice(0, 10),
          reg.emergency_contact || "",
          reg.address || "",
          now,
          now,
        ],
      );

      // 2. Link the profile to the guard record and activate it
      await admin
        .from("profiles")
        .update({
          role: "security",
          ref_id: guardId,
          gate,
          active: true,
          updated_at: now,
        })
        .eq("id", reg.user_id);

      // 3. Update the registration
      await admin
        .from("guard_registrations")
        .update({
          status: "Approved",
          reviewed_by: session.userId,
          reviewed_at: now,
          admin_remarks: input.adminRemarks ?? null,
          updated_at: now,
        })
        .eq("id", input.id);

      // Persist guard to Supabase
      const { persistToSupabase } = await import("@/lib/server/supabase-db");
      await persistToSupabase("security_guards", {
        id: guardId,
        employee_id: (reg.employee_id || guardId).toUpperCase(),
        full_name: reg.full_name,
        phone: reg.phone || "",
        email: reg.email,
        shift,
        shift_start: shiftStart,
        shift_end: shiftEnd,
        assigned_gate: gate,
        status: "Active",
        joining_date: reg.joining_date || now.slice(0, 10),
        emergency_contact: reg.emergency_contact || "",
        address: reg.address || "",
        created_at: now,
        updated_at: now,
      });

      audit(session, {
        action: "guard.registration.approved",
        entity: "guard_registration",
        entityId: input.id,
        summary: `${session.name} approved guard registration for ${reg.full_name}. Guard ID: ${guardId}.`,
      });

      return { status: "Approved", guardId, message: `Guard registration for ${reg.full_name} has been approved.` };
    } else {
      // Reject
      await admin
        .from("guard_registrations")
        .update({
          status: "Rejected",
          reviewed_by: session.userId,
          reviewed_at: now,
          admin_remarks: input.adminRemarks ?? null,
          updated_at: now,
        })
        .eq("id", input.id);

      audit(session, {
        action: "guard.registration.rejected",
        entity: "guard_registration",
        entityId: input.id,
        summary: `${session.name} rejected guard registration for ${reg.full_name}.`,
      });

      return { status: "Rejected", message: `Guard registration for ${reg.full_name} has been rejected.` };
    }
  });
}
