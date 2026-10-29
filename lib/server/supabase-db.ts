import "server-only";

import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { run, tx } from "./db";

/**
 * Supabase database persistence & synchronization layer.
 * Ensures the application state is persisted to Supabase as the single source of truth.
 */

let lastSyncTimestamp = 0;
const SYNC_INTERVAL_MS = 10_000; // 10 seconds throttle

export async function persistToSupabase(
  table: string,
  data: Record<string, unknown> | Record<string, unknown>[],
  operation: "upsert" | "insert" | "update" | "delete" = "upsert",
  matchColumn = "id",
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const admin = getSupabaseAdminClient();
    const target = admin.from(table);

    if (operation === "delete") {
      const matchVal = (data as Record<string, unknown>)[matchColumn];
      if (matchVal !== undefined) {
        const { error } = await target.delete().eq(matchColumn, matchVal);
        if (error) throw error;
      }
    } else if (operation === "update") {
      const matchVal = (data as Record<string, unknown>)[matchColumn];
      if (matchVal !== undefined) {
        const { error } = await target.update(data).eq(matchColumn, matchVal);
        if (error) throw error;
      }
    } else if (operation === "insert") {
      const { error } = await target.insert(data);
      if (error) throw error;
    } else {
      const { error } = await target.upsert(data, { onConflict: matchColumn });
      if (error) throw error;
    }
  } catch (error) {
    const errorMsg =
      error && typeof error === "object" && "message" in error
        ? (error as { message: string }).message
        : String(error);
    const errorCode =
      error && typeof error === "object" && "code" in error
        ? (error as { code: string }).code
        : "";
    console.error(`[supabase-db] Persisting to "${table}" failed (${errorCode || "error"}): ${errorMsg}`);
    throw error;
  }
}

/**
 * Safely persists optional/secondary operations (activity logs, notifications, WhatsApp message logs, check logs)
 * to Supabase in the background without throwing unhandled promise rejections or interrupting primary operations.
 */
export function persistSecondaryToSupabase(
  table: string,
  data: Record<string, unknown> | Record<string, unknown>[],
  operation: "upsert" | "insert" | "update" | "delete" = "upsert",
  matchColumn = "id",
): void {
  if (!isSupabaseConfigured()) return;

  persistToSupabase(table, data, operation, matchColumn).catch((error) => {
    const errorMsg =
      error && typeof error === "object" && "message" in error
        ? (error as { message: string }).message
        : String(error);
    console.warn(`[supabase-db:secondary] Background persist to "${table}" failed: ${errorMsg}`);
  });
}

/**
 * Checks Supabase for an existing visitor by mobile to avoid ID and unique constraint collisions.
 */
export async function findSupabaseVisitorByMobile(
  mobile: string,
): Promise<{ id: string; fullName: string; blacklisted?: boolean; photoUrl?: string } | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const admin = getSupabaseAdminClient();
    const cleanMobile = mobile.replace(/[\s-]/g, "");
    if (!cleanMobile) return null;
    const { data, error } = await admin
      .from("visitors")
      .select("id, full_name, mobile, blacklisted, photo_url, photo_path")
      .or(`mobile.eq.${cleanMobile},mobile_number.eq.${cleanMobile}`)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      fullName: data.full_name,
      blacklisted: Boolean(data.blacklisted),
      photoUrl: data.photo_url || data.photo_path || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Synchronizes data from Supabase PostgreSQL tables into the application cache.
 */
export async function syncFromSupabase(force = false): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const now = Date.now();
  if (!force && now - lastSyncTimestamp < SYNC_INTERVAL_MS) {
    return;
  }
  lastSyncTimestamp = now;

  try {
    const admin = getSupabaseAdminClient();

    // 1. Campus gates
    const { data: gates } = await admin.from("campus_gates").select("*");
    if (gates && gates.length > 0) {
      tx(() => {
        for (const g of gates) {
          run(
            `INSERT INTO campus_locations(id, name, kind, active)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind, active = excluded.active`,
            [g.id, g.name, g.kind || "Gate", g.active ? 1 : 0],
          );
        }
      });
    }

    // 2. Departments
    const { data: departments } = await admin.from("departments").select("*");
    if (departments && departments.length > 0) {
      tx(() => {
        for (const d of departments) {
          run(
            `INSERT INTO departments(id, name, code, head, location, phone, email, active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, code = excluded.code, head = excluded.head,
               location = excluded.location, phone = excluded.phone, email = excluded.email,
               active = excluded.active, updated_at = excluded.updated_at`,
            [d.id, d.name, d.code, d.head || "", d.location || "", d.phone || "", d.email || "", d.active ? 1 : 0, d.created_at || new Date().toISOString(), d.updated_at || new Date().toISOString()],
          );
        }
      });
    }

    // 3. Teachers & Availability
    const { data: teachers } = await admin.from("teachers").select("*");
    if (teachers && teachers.length > 0) {
      tx(() => {
        for (const t of teachers) {
          run(
            `INSERT INTO teachers(id, employee_id, name, email, phone, whatsapp_number, department_id, designation, photo_url, room, availability_status, active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email, phone = excluded.phone,
               whatsapp_number = excluded.whatsapp_number, department_id = excluded.department_id,
               designation = excluded.designation, photo_url = excluded.photo_url, room = excluded.room,
               availability_status = excluded.availability_status, active = excluded.active, updated_at = excluded.updated_at`,
            [t.id, t.employee_id, t.name, t.email, t.phone, t.whatsapp_number || t.phone, t.department_id, t.designation || "", t.photo_url || null, t.room || "", t.availability_status || "Available", t.active ? 1 : 0, t.created_at || new Date().toISOString(), t.updated_at || new Date().toISOString()],
          );
        }
      });
    }

    const { data: availability } = await admin.from("teacher_availability").select("*");
    if (availability && availability.length > 0) {
      tx(() => {
        for (const a of availability) {
          run(
            `INSERT INTO teacher_availability(teacher_id, days, start_time, end_time, slot_minutes, blocked, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(teacher_id) DO UPDATE SET days = excluded.days, start_time = excluded.start_time,
               end_time = excluded.end_time, slot_minutes = excluded.slot_minutes, blocked = excluded.blocked,
               updated_at = excluded.updated_at`,
            [a.teacher_id, JSON.stringify(a.days || [1, 2, 3, 4, 5]), a.start_time || "09:00", a.end_time || "17:00", a.slot_minutes || 30, JSON.stringify(a.blocked || []), a.updated_at || new Date().toISOString()],
          );
        }
      });
    }

    // 4. Guards
    const { data: guards } = await admin.from("security_guards").select("*");
    if (guards && guards.length > 0) {
      tx(() => {
        for (const g of guards) {
          run(
            `INSERT INTO security_guards(id, employee_id, full_name, phone, email, photo_url, shift, shift_start, shift_end, assigned_gate, status, joining_date, emergency_contact, address, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name, phone = excluded.phone, email = excluded.email,
               photo_url = excluded.photo_url, shift = excluded.shift, shift_start = excluded.shift_start,
               shift_end = excluded.shift_end, assigned_gate = excluded.assigned_gate, status = excluded.status,
               emergency_contact = excluded.emergency_contact, address = excluded.address, updated_at = excluded.updated_at`,
            [g.id, g.employee_id, g.full_name, g.phone, g.email || "", g.photo_url || null, g.shift || "Morning", g.shift_start || "06:00", g.shift_end || "14:00", g.assigned_gate || "Main Gate", g.status || "Active", g.joining_date || new Date().toISOString(), g.emergency_contact || "", g.address || "", g.created_at || new Date().toISOString(), g.updated_at || new Date().toISOString()],
          );
        }
      });
    }

    // 5. Students
    const { data: students } = await admin.from("students").select("*");
    if (students && students.length > 0) {
      tx(() => {
        for (const s of students) {
          run(
            `INSERT INTO students(id, name, roll_no, department_id, year, hostel, room, guardian_name, guardian_phone, on_campus)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, roll_no = excluded.roll_no, department_id = excluded.department_id,
               year = excluded.year, hostel = excluded.hostel, room = excluded.room, guardian_name = excluded.guardian_name,
               guardian_phone = excluded.guardian_phone, on_campus = excluded.on_campus`,
            [s.id, s.name, s.roll_no, s.department_id, s.year || "", s.hostel || "", s.room || "", s.guardian_name || "", s.guardian_phone || "", s.on_campus ? 1 : 0],
          );
        }
      });
    }

    // 6. Visitors
    const { data: visitors } = await admin.from("visitors").select("*");
    if (visitors && visitors.length > 0) {
      tx(() => {
        for (const v of visitors) {
          run(
            `INSERT INTO visitors(id, full_name, mobile, mobile_number, email, gender, id_type, id_number, aadhaar_number, photo_url, photo_path, organization, address, emergency_contact, whatsapp_country_code, whatsapp_number, visitor_type, total_visits, blacklisted, has_car, car_number, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name, mobile = excluded.mobile, mobile_number = excluded.mobile_number,
               email = excluded.email, gender = excluded.gender, id_type = excluded.id_type, id_number = excluded.id_number,
               aadhaar_number = excluded.aadhaar_number, photo_url = excluded.photo_url, photo_path = excluded.photo_path,
               organization = excluded.organization, address = excluded.address, emergency_contact = excluded.emergency_contact,
               total_visits = excluded.total_visits, blacklisted = excluded.blacklisted, has_car = excluded.has_car,
               car_number = excluded.car_number, updated_at = excluded.updated_at`,
            [v.id, v.full_name, v.mobile || v.mobile_number, v.mobile_number || v.mobile, v.email || "", v.gender || "Prefer not to say", v.id_type || "Aadhaar Card", v.id_number || v.aadhaar_number || "", v.aadhaar_number || v.id_number || "", v.photo_url || v.photo_path || null, v.photo_path || v.photo_url || null, v.organization || "", v.address || "", v.emergency_contact || "", v.whatsapp_country_code || "+91", v.whatsapp_number || "", v.visitor_type || "Guest", v.total_visits || 0, v.blacklisted ? 1 : 0, v.has_car ? 1 : 0, v.car_number || null, v.created_at || new Date().toISOString(), v.updated_at || new Date().toISOString()],
          );
        }
      });
    }

    // 7. Visit requests
    //
    // Each record is upserted individually so that one UNIQUE constraint hit
    // (e.g. two Supabase rows with the same host/date/time) does not abort the
    // entire batch.  The ON CONFLICT(id) clause handles repeated sync of the
    // same row; the per-record try/catch handles partial-index collisions.
    const { data: visits } = await admin.from("visit_requests").select("*");
    if (visits && visits.length > 0) {
      for (const v of visits) {
        try {
          tx(() => {
            run(
              `INSERT INTO visit_requests(id, visitor_id, full_name, mobile, mobile_number, email, gender, organization, address, emergency_contact, whatsapp_country_code, whatsapp_number, visitor_type, id_type, id_number, aadhaar_number, photo_url, photo_path, purpose, purpose_detail, purpose_meta, host_id, host_name, department_id, department, visit_date, visit_time, expected_duration, expected_departure_time, number_of_visitors, vehicle_required, vehicle_type, vehicle_number, has_car, car_number, notes, special_requirements, status, source, pass_token, badge_number, decided_at, decided_by, rejection_reason, rescheduled_from, check_in_at, checked_in_by, check_out_at, checked_out_by, meeting_started_at, meeting_ended_at, gate, created_at, updated_at, idempotency_key, pass_expires_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET status = excluded.status, check_in_at = excluded.check_in_at,
                 checked_in_by = excluded.checked_in_by, check_out_at = excluded.check_out_at,
                 checked_out_by = excluded.checked_out_by, meeting_started_at = excluded.meeting_started_at,
                 meeting_ended_at = excluded.meeting_ended_at, decided_at = excluded.decided_at,
                 decided_by = excluded.decided_by, rejection_reason = excluded.rejection_reason,
                 pass_token = excluded.pass_token, badge_number = excluded.badge_number,
                 expected_departure_time = excluded.expected_departure_time, vehicle_type = excluded.vehicle_type,
                 updated_at = excluded.updated_at`,
              [
                v.id, v.visitor_id, v.full_name, v.mobile || v.mobile_number, v.mobile_number || v.mobile,
                v.email || "", v.gender || "Prefer not to say", v.organization || "", v.address || "",
                v.emergency_contact || "", v.whatsapp_country_code || "+91", v.whatsapp_number || "",
                v.visitor_type || "Guest", v.id_type || "Aadhaar Card", v.id_number || v.aadhaar_number || "",
                v.aadhaar_number || v.id_number || "", v.photo_url || v.photo_path || null,
                v.photo_path || v.photo_url || null, v.purpose || "Campus Visit", v.purpose_detail || null,
                JSON.stringify(v.purpose_meta || {}), v.host_id || null, v.host_name || "",
                v.department_id || null, v.department || "", v.visit_date, v.visit_time,
                v.expected_duration || "30 minutes", v.expected_departure_time || null, v.number_of_visitors || 1, v.vehicle_required ? 1 : 0,
                v.vehicle_type || null, v.vehicle_number || null, v.has_car ? 1 : 0, v.car_number || null, v.notes || null,
                v.special_requirements || null, v.status || "Pending", v.source || "Visitor Portal",
                v.pass_token || null, v.badge_number || null, v.decided_at || null, v.decided_by || null,
                v.rejection_reason || null, v.rescheduled_from || null, v.check_in_at || null,
                v.checked_in_by || null, v.check_out_at || null, v.checked_out_by || null,
                v.meeting_started_at || null, v.meeting_ended_at || null, v.gate || null,
                v.created_at || new Date().toISOString(), v.updated_at || new Date().toISOString(),
                v.idempotency_key || null, v.pass_expires_at || null,
              ],
            );
          });
        } catch (syncErr: unknown) {
          const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
          // A UNIQUE constraint on the partial slot index means this Supabase
          // record's (host_id, visit_date, visit_time) slot is already held by
          // a different local booking.  Log the booking IDs for manual review
          // (no visitor name, mobile or Aadhaar here) and continue.
          if (/UNIQUE constraint failed/i.test(msg)) {
            if (msg.includes("uniq_host_slot") || msg.includes("uniq_visitor_slot")) {
              console.warn(
                `[supabase-db] Sync skipped booking id=${v.id} date=${v.visit_date} ` +
                `time=${v.visit_time} host=${v.host_id ?? "none"} — slot already held locally. ` +
                `Review for duplicate data in Supabase.`,
              );
            } else if (msg.includes("visit_requests.id")) {
              // The ON CONFLICT(id) upsert itself should never reach here, but
              // guard against it so the log message is still actionable.
              console.warn(`[supabase-db] Sync skipped booking id=${v.id} — PK conflict (unexpected).`);
            } else {
              console.warn(`[supabase-db] Sync skipped booking id=${v.id} — constraint: ${msg}`);
            }
          } else {
            // Non-constraint errors (disk, schema mismatch, …) are re-thrown so
            // the outer catch still surfaces them without losing context.
            console.warn(`[supabase-db] Sync error for booking id=${v.id}:`, syncErr);
          }
        }
      }
    }


    // 8. Check logs
    const { data: checkLogs } = await admin.from("check_logs").select("*");
    if (checkLogs && checkLogs.length > 0) {
      tx(() => {
        for (const c of checkLogs) {
          run(
            `INSERT INTO check_logs(id, visit_request_id, visitor_id, visitor_name, direction, gate, guard_id, guard_name, note, at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET note = excluded.note`,
            [c.id, c.visit_request_id, c.visitor_id, c.visitor_name, c.direction, c.gate, c.guard_id || null, c.guard_name || "", c.note || null, c.at || new Date().toISOString()],
          );
        }
      });
    }

    // 9. Vehicles
    const { data: vehicles } = await admin.from("vehicles").select("*");
    if (vehicles && vehicles.length > 0) {
      tx(() => {
        for (const v of vehicles) {
          run(
            `INSERT INTO vehicles(id, vehicle_number, vehicle_type, visitor_name, driver_name, purpose, gate, entry_time, exit_time, status, linked_visit_id, guard_id, guard_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET exit_time = excluded.exit_time, status = excluded.status`,
            [v.id, v.vehicle_number, v.vehicle_type || "Car", v.visitor_name || "", v.driver_name || "", v.purpose || "", v.gate, v.entry_time || new Date().toISOString(), v.exit_time || null, v.status || "Inside", v.linked_visit_id || null, v.guard_id || null, v.guard_name || ""],
          );
        }
      });
    }

    // 10. Incidents
    const { data: incidents } = await admin.from("incidents").select("*");
    if (incidents && incidents.length > 0) {
      tx(() => {
        for (const inc of incidents) {
          run(
            `INSERT INTO incidents(id, type, title, location, date, time, severity, description, reported_by, reported_by_id, assigned_to_id, assigned_to_name, attachment_url, status, resolution_note, resolved_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET status = excluded.status, resolution_note = excluded.resolution_note, resolved_at = excluded.resolved_at, updated_at = excluded.updated_at`,
            [inc.id, inc.type, inc.title, inc.location, inc.date, inc.time, inc.severity, inc.description || "", inc.reported_by || "", inc.reported_by_id || null, inc.assigned_to_id || null, inc.assigned_to_name || null, inc.attachment_url || null, inc.status || "Open", inc.resolution_note || null, inc.resolved_at || null, inc.created_at || new Date().toISOString(), inc.updated_at || new Date().toISOString()],
          );
        }
      });
    }

    // 11. Emergencies
    const { data: emergencies } = await admin.from("emergencies").select("*");
    if (emergencies && emergencies.length > 0) {
      tx(() => {
        for (const em of emergencies) {
          run(
            `INSERT INTO emergencies(id, type, severity, location, note, triggered_by, triggered_by_id, triggered_at, status, acknowledged_at, acknowledged_by, resolved_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET status = excluded.status, acknowledged_at = excluded.acknowledged_at, acknowledged_by = excluded.acknowledged_by, resolved_at = excluded.resolved_at`,
            [em.id, em.type, em.severity, em.location, em.note || null, em.triggered_by || "", em.triggered_by_id || null, em.triggered_at || new Date().toISOString(), em.status || "Active", em.acknowledged_at || null, em.acknowledged_by || null, em.resolved_at || null],
          );
        }
      });
    }

    // 12. Notifications
    const { data: notifications } = await admin.from("notifications").select("*").limit(200);
    if (notifications && notifications.length > 0) {
      tx(() => {
        for (const n of notifications) {
          run(
            `INSERT INTO notifications(id, type, title, message, href, audience, read, at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET read = excluded.read`,
            [n.id, n.type, n.title, n.message, n.href || null, n.audience || null, n.read ? 1 : 0, n.at || new Date().toISOString()],
          );
        }
      });
    }

    // 13. Activity logs
    const { data: activity } = await admin.from("activity_logs").select("*").limit(200);
    if (activity && activity.length > 0) {
      tx(() => {
        for (const a of activity) {
          run(
            `INSERT INTO activity_logs(id, actor_id, actor_name, actor_role, action, entity, entity_id, summary, channel, at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO NOTHING`,
            [a.id, a.actor_id || null, a.actor_name, a.actor_role, a.action, a.entity, a.entity_id, a.summary, a.channel || "web", a.at || new Date().toISOString()],
          );
        }
      });
    }

    // 14. Settings
    const { data: settingsRow } = await admin.from("campus_settings").select("*").eq("id", 1).maybeSingle();
    if (settingsRow && settingsRow.data) {
      run(
        `INSERT INTO app_settings(id, data, updated_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        [JSON.stringify(settingsRow.data), settingsRow.updated_at || new Date().toISOString()],
      );
    }
  } catch (error) {
    console.warn("[supabase-db] Sync from Supabase failed:", error);
  }
}
