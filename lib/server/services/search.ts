import "server-only";

import type { AuthSession } from "@/lib/types";
import { isAdminRole } from "@/lib/types";
import { all } from "../db";

/**
 * Global search.
 *
 * Runs as SQL against the tables the caller's role may read, so a guard
 * searching for a name cannot surface a staff record they would not otherwise
 * be shown. Every group is capped so one broad query cannot pull the register.
 */

export type SearchGroup =
  | "Bookings"
  | "Visitors"
  | "Teachers"
  | "Guards"
  | "Students"
  | "Vehicles"
  | "Incidents";

export interface SearchHit {
  id: string;
  label: string;
  sublabel: string;
  group: SearchGroup;
  href: string;
}

const PER_GROUP = 5;

export function search(query: string, session: AuthSession): SearchHit[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${q.toLowerCase()}%`;
  const hits: SearchHit[] = [];
  const admin = isAdminRole(session.role);
  const guard = session.role === "security";

  if (admin || guard) {
    all<{ id: string; full_name: string; status: string; host_name: string; mobile: string }>(
      `SELECT id, full_name, status, host_name, mobile FROM visit_requests
        WHERE lower(id) LIKE ? OR lower(full_name) LIKE ? OR mobile LIKE ? OR lower(host_name) LIKE ?
        ORDER BY created_at DESC LIMIT ?`,
      [like, like, like, like, PER_GROUP],
    ).forEach((r) =>
      hits.push({
        id: r.id,
        label: `${r.id} · ${r.full_name}`,
        sublabel: `${r.status} · Host ${r.host_name}`,
        group: "Bookings",
        href: `/admin/bookings?q=${encodeURIComponent(r.id)}`,
      }),
    );

    all<{ id: string; full_name: string; visitor_type: string; mobile: string }>(
      `SELECT id, full_name, visitor_type, mobile FROM visitors
        WHERE lower(full_name) LIKE ? OR mobile LIKE ? OR lower(organization) LIKE ?
        ORDER BY created_at DESC LIMIT ?`,
      [like, like, like, PER_GROUP],
    ).forEach((r) =>
      hits.push({
        id: r.id,
        label: r.full_name,
        sublabel: `${r.visitor_type} · ${r.mobile}`,
        group: "Visitors",
        href: `/admin/visitors?q=${encodeURIComponent(r.full_name)}`,
      }),
    );

    all<{ id: string; vehicle_number: string; vehicle_type: string; status: string }>(
      `SELECT id, vehicle_number, vehicle_type, status FROM vehicles
        WHERE lower(vehicle_number) LIKE ? OR lower(visitor_name) LIKE ?
        ORDER BY entry_time DESC LIMIT ?`,
      [like, like, PER_GROUP],
    ).forEach((r) =>
      hits.push({
        id: r.id,
        label: r.vehicle_number,
        sublabel: `${r.vehicle_type} · ${r.status}`,
        group: "Vehicles",
        href: `/admin/vehicles?q=${encodeURIComponent(r.vehicle_number)}`,
      }),
    );

    all<{ id: string; type: string; severity: string; location: string }>(
      `SELECT id, type, severity, location FROM incidents
        WHERE lower(id) LIKE ? OR lower(type) LIKE ? OR lower(title) LIKE ? OR lower(location) LIKE ?
        ORDER BY created_at DESC LIMIT ?`,
      [like, like, like, like, PER_GROUP],
    ).forEach((r) =>
      hits.push({
        id: r.id,
        label: `${r.id} · ${r.type}`,
        sublabel: `${r.severity} · ${r.location}`,
        group: "Incidents",
        href: `/admin/incidents?q=${encodeURIComponent(r.id)}`,
      }),
    );

    all<{ id: string; name: string; designation: string; department: string }>(
      `SELECT t.id, t.name, t.designation, COALESCE(d.name, '') AS department
         FROM teachers t LEFT JOIN departments d ON d.id = t.department_id
        WHERE lower(t.name) LIKE ? OR lower(t.designation) LIKE ? OR lower(d.name) LIKE ?
        ORDER BY t.name LIMIT ?`,
      [like, like, like, PER_GROUP],
    ).forEach((r) =>
      hits.push({
        id: r.id,
        label: r.name,
        sublabel: `${r.designation} · ${r.department}`,
        group: "Teachers",
        href: `/admin/teachers?q=${encodeURIComponent(r.name)}`,
      }),
    );
  }

  if (admin) {
    all<{ id: string; full_name: string; employee_id: string; assigned_gate: string }>(
      `SELECT id, full_name, employee_id, assigned_gate FROM security_guards
        WHERE lower(full_name) LIKE ? OR lower(employee_id) LIKE ? OR lower(assigned_gate) LIKE ?
        ORDER BY full_name LIMIT ?`,
      [like, like, like, PER_GROUP],
    ).forEach((r) =>
      hits.push({
        id: r.id,
        label: r.full_name,
        sublabel: `${r.employee_id} · ${r.assigned_gate}`,
        group: "Guards",
        href: `/admin/guards/${r.id}`,
      }),
    );

    all<{ id: string; name: string; roll_no: string; department: string }>(
      `SELECT s.id, s.name, s.roll_no, COALESCE(d.name, '') AS department
         FROM students s LEFT JOIN departments d ON d.id = s.department_id
        WHERE lower(s.name) LIKE ? OR lower(s.roll_no) LIKE ? OR lower(s.hostel) LIKE ?
        ORDER BY s.name LIMIT ?`,
      [like, like, like, PER_GROUP],
    ).forEach((r) =>
      hits.push({
        id: r.id,
        label: r.name,
        sublabel: `${r.roll_no} · ${r.department}`,
        group: "Students",
        href: `/admin/students?q=${encodeURIComponent(r.name)}`,
      }),
    );
  }

  return hits;
}
