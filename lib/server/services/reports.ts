import "server-only";

import { all, get, type SqlValue } from "../db";
import { badRequest } from "../errors";

/**
 * Reporting.
 *
 * Every figure below is a SQL aggregate over the live tables — nothing is
 * pre-computed, cached or estimated. Each report returns its own columns
 * alongside its rows so a single UI component and one CSV exporter can render
 * any of them without knowing which report it is looking at.
 */

export const REPORT_KINDS = [
  "visitors",
  "entry-exit",
  "meetings",
  "guards",
  "vehicles",
  "incidents",
  "emergency",
] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];

export interface ReportFilters {
  from: string;
  to: string;
  department?: string;
  status?: string;
  purpose?: string;
  severity?: string;
  guardId?: string;
  teacherId?: string;
}

export interface ReportColumn {
  key: string;
  header: string;
}

export interface ReportSeries {
  title: string;
  data: { label: string; value: number }[];
}

export interface ReportResult {
  kind: ReportKind;
  title: string;
  description: string;
  generatedAt: string;
  filters: ReportFilters;
  stats: { label: string; value: number }[];
  charts: ReportSeries[];
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
}

const series = (rows: { label: unknown; value: unknown }[]): { label: string; value: number }[] =>
  rows.map((r) => ({ label: String(r.label ?? "—"), value: Number(r.value ?? 0) }));

/** Upper bound for comparing a `yyyy-mm-dd` filter against ISO timestamps. */
const endOfDay = (date: string): string => `${date}T23:59:59.999Z`;

const count = (sql: string, params: SqlValue[]): number =>
  Number(get<{ c: number }>(sql, params)?.c ?? 0);

/* ------------------------------------------------------------------ *
 * Report builders
 * ------------------------------------------------------------------ */

function visitorsReport(f: ReportFilters): ReportResult {
  const where: string[] = ["visit_date BETWEEN ? AND ?"];
  const params: SqlValue[] = [f.from, f.to];
  if (f.status && f.status !== "all") {
    where.push("status = ?");
    params.push(f.status);
  }
  if (f.purpose && f.purpose !== "all") {
    where.push("purpose = ?");
    params.push(f.purpose);
  }
  if (f.department && f.department !== "all") {
    where.push("department = ?");
    params.push(f.department);
  }
  const clause = where.join(" AND ");

  const rows = all<Record<string, string | number>>(
    `SELECT id AS "Booking ID", full_name AS "Visitor", mobile AS "Mobile",
            visitor_type AS "Type", purpose AS "Purpose", host_name AS "Host",
            department AS "Department", visit_date AS "Date", visit_time AS "Time",
            number_of_visitors AS "Party", COALESCE(vehicle_number, '') AS "Vehicle",
            status AS "Status", COALESCE(check_in_at, '') AS "Checked In",
            COALESCE(check_out_at, '') AS "Checked Out"
       FROM visit_requests WHERE ${clause}
      ORDER BY visit_date DESC, visit_time DESC LIMIT 2000`,
    params,
  );

  const total = count(`SELECT COUNT(*) AS c FROM visit_requests WHERE ${clause}`, params);
  const head = Number(
    get<{ c: number }>(
      `SELECT COALESCE(SUM(number_of_visitors), 0) AS c FROM visit_requests WHERE ${clause}`,
      params,
    )?.c ?? 0,
  );

  return {
    kind: "visitors",
    title: "Visitor Report",
    description: "Every booking raised in the selected window, with its outcome.",
    generatedAt: new Date().toISOString(),
    filters: f,
    stats: [
      { label: "Bookings", value: total },
      { label: "Total head count", value: head },
      {
        label: "Approved",
        value: count(
          `SELECT COUNT(*) AS c FROM visit_requests WHERE ${clause} AND status = 'Approved'`,
          params,
        ),
      },
      {
        label: "Completed visits",
        value: count(
          `SELECT COUNT(*) AS c FROM visit_requests WHERE ${clause} AND status = 'Checked Out'`,
          params,
        ),
      },
      {
        label: "Rejected",
        value: count(
          `SELECT COUNT(*) AS c FROM visit_requests WHERE ${clause} AND status = 'Rejected'`,
          params,
        ),
      },
      {
        label: "Still pending",
        value: count(
          `SELECT COUNT(*) AS c FROM visit_requests WHERE ${clause} AND status IN ('Pending','Rescheduled')`,
          params,
        ),
      },
    ],
    charts: [
      {
        title: "Visitors per day",
        data: series(
          all(
            `SELECT visit_date AS label, COUNT(*) AS value FROM visit_requests
              WHERE ${clause} GROUP BY visit_date ORDER BY visit_date`,
            params,
          ),
        ),
      },
      {
        title: "By purpose",
        data: series(
          all(
            `SELECT purpose AS label, COUNT(*) AS value FROM visit_requests
              WHERE ${clause} GROUP BY purpose ORDER BY value DESC`,
            params,
          ),
        ),
      },
      {
        title: "By visitor type",
        data: series(
          all(
            `SELECT visitor_type AS label, COUNT(*) AS value FROM visit_requests
              WHERE ${clause} GROUP BY visitor_type ORDER BY value DESC`,
            params,
          ),
        ),
      },
      {
        title: "By status",
        data: series(
          all(
            `SELECT status AS label, COUNT(*) AS value FROM visit_requests
              WHERE ${clause} GROUP BY status ORDER BY value DESC`,
            params,
          ),
        ),
      },
    ],
    columns: columnsFrom(rows),
    rows,
  };
}

function entryExitReport(f: ReportFilters): ReportResult {
  const params: SqlValue[] = [f.from, endOfDay(f.to)];

  const rows = all<Record<string, string | number>>(
    `SELECT c.at AS "Timestamp", c.visit_request_id AS "Booking ID", c.visitor_name AS "Visitor",
            c.direction AS "Direction", c.gate AS "Gate", c.guard_name AS "Guard"
       FROM check_logs c WHERE c.at BETWEEN ? AND ?
      ORDER BY c.at DESC LIMIT 2000`,
    params,
  );

  const ins = count(
    "SELECT COUNT(*) AS c FROM check_logs WHERE at BETWEEN ? AND ? AND direction = 'In'",
    params,
  );
  const outs = count(
    "SELECT COUNT(*) AS c FROM check_logs WHERE at BETWEEN ? AND ? AND direction = 'Out'",
    params,
  );

  return {
    kind: "entry-exit",
    title: "Daily Entry / Exit Report",
    description: "Gate movements stamped by security, entry against exit.",
    generatedAt: new Date().toISOString(),
    filters: f,
    stats: [
      { label: "Entries", value: ins },
      { label: "Exits", value: outs },
      { label: "Still inside", value: Math.max(0, ins - outs) },
      { label: "Movements logged", value: ins + outs },
    ],
    charts: [
      {
        title: "Entries per day",
        data: series(
          all(
            `SELECT substr(at, 1, 10) AS label, COUNT(*) AS value FROM check_logs
              WHERE at BETWEEN ? AND ? AND direction = 'In'
              GROUP BY substr(at, 1, 10) ORDER BY label`,
            params,
          ),
        ),
      },
      {
        title: "Exits per day",
        data: series(
          all(
            `SELECT substr(at, 1, 10) AS label, COUNT(*) AS value FROM check_logs
              WHERE at BETWEEN ? AND ? AND direction = 'Out'
              GROUP BY substr(at, 1, 10) ORDER BY label`,
            params,
          ),
        ),
      },
      {
        title: "Peak entry hours",
        data: series(
          all(
            `SELECT substr(at, 12, 2) || ':00' AS label, COUNT(*) AS value FROM check_logs
              WHERE at BETWEEN ? AND ? AND direction = 'In'
              GROUP BY substr(at, 12, 2) ORDER BY label`,
            params,
          ),
        ),
      },
      {
        title: "By gate",
        data: series(
          all(
            `SELECT gate AS label, COUNT(*) AS value FROM check_logs
              WHERE at BETWEEN ? AND ? GROUP BY gate ORDER BY value DESC`,
            params,
          ),
        ),
      },
    ],
    columns: columnsFrom(rows),
    rows,
  };
}

function meetingsReport(f: ReportFilters): ReportResult {
  const where: string[] = ["visit_date BETWEEN ? AND ?", "host_id IS NOT NULL"];
  const params: SqlValue[] = [f.from, f.to];
  if (f.teacherId && f.teacherId !== "all") {
    where.push("host_id = ?");
    params.push(f.teacherId);
  }
  if (f.department && f.department !== "all") {
    where.push("department = ?");
    params.push(f.department);
  }
  const clause = where.join(" AND ");

  const rows = all<Record<string, string | number>>(
    `SELECT id AS "Booking ID", host_name AS "Host", department AS "Department",
            full_name AS "Visitor", mobile AS "Visitor Mobile", visit_date AS "Date",
            visit_time AS "Time", expected_duration AS "Duration", purpose AS "Purpose",
            status AS "Status"
       FROM visit_requests WHERE ${clause}
      ORDER BY visit_date DESC, visit_time DESC LIMIT 2000`,
    params,
  );

  return {
    kind: "meetings",
    title: "Teacher Meeting Report",
    description: "Host meetings scheduled through the visitor portal.",
    generatedAt: new Date().toISOString(),
    filters: f,
    stats: [
      { label: "Meetings", value: count(`SELECT COUNT(*) AS c FROM visit_requests WHERE ${clause}`, params) },
      {
        label: "Completed",
        value: count(
          `SELECT COUNT(*) AS c FROM visit_requests WHERE ${clause} AND status = 'Checked Out'`,
          params,
        ),
      },
      {
        label: "Awaiting decision",
        value: count(
          `SELECT COUNT(*) AS c FROM visit_requests WHERE ${clause} AND status IN ('Pending','Rescheduled')`,
          params,
        ),
      },
      {
        label: "Declined",
        value: count(
          `SELECT COUNT(*) AS c FROM visit_requests WHERE ${clause} AND status = 'Rejected'`,
          params,
        ),
      },
    ],
    charts: [
      {
        title: "Meetings by department",
        data: series(
          all(
            `SELECT department AS label, COUNT(*) AS value FROM visit_requests
              WHERE ${clause} GROUP BY department ORDER BY value DESC`,
            params,
          ),
        ),
      },
      {
        title: "Busiest hosts",
        data: series(
          all(
            `SELECT host_name AS label, COUNT(*) AS value FROM visit_requests
              WHERE ${clause} GROUP BY host_name ORDER BY value DESC LIMIT 10`,
            params,
          ),
        ),
      },
      {
        title: "Meetings per day",
        data: series(
          all(
            `SELECT visit_date AS label, COUNT(*) AS value FROM visit_requests
              WHERE ${clause} GROUP BY visit_date ORDER BY label`,
            params,
          ),
        ),
      },
    ],
    columns: columnsFrom(rows),
    rows,
  };
}

function guardsReport(f: ReportFilters): ReportResult {
  const params: SqlValue[] = [f.from, endOfDay(f.to)];
  const guardFilter = f.guardId && f.guardId !== "all" ? " AND g.id = ?" : "";
  const rowParams = guardFilter ? [...params, ...params, ...params, f.guardId as string] : [...params, ...params, ...params];

  const rows = all<Record<string, string | number>>(
    `SELECT g.employee_id AS "Guard ID", g.full_name AS "Guard", g.shift AS "Shift",
            g.assigned_gate AS "Gate", g.status AS "Status",
            (SELECT COUNT(*) FROM check_logs c WHERE c.guard_id = g.id AND c.direction = 'In'
               AND c.at BETWEEN ? AND ?) AS "Check-ins",
            (SELECT COUNT(*) FROM check_logs c WHERE c.guard_id = g.id AND c.direction = 'Out'
               AND c.at BETWEEN ? AND ?) AS "Check-outs",
            (SELECT COUNT(*) FROM incidents i WHERE i.reported_by_id = g.id
               AND i.created_at BETWEEN ? AND ?) AS "Incidents"
       FROM security_guards g WHERE 1 = 1${guardFilter}
      ORDER BY g.full_name`,
    rowParams,
  );

  return {
    kind: "guards",
    title: "Guard Activity Report",
    description: "Gate throughput and incident reporting per guard.",
    generatedAt: new Date().toISOString(),
    filters: f,
    stats: [
      { label: "Guards on roster", value: count("SELECT COUNT(*) AS c FROM security_guards", []) },
      {
        label: "On duty",
        value: count("SELECT COUNT(*) AS c FROM security_guards WHERE status = 'On Duty'", []),
      },
      {
        label: "Check-ins handled",
        value: count(
          "SELECT COUNT(*) AS c FROM check_logs WHERE direction = 'In' AND at BETWEEN ? AND ?",
          params,
        ),
      },
      {
        label: "Check-outs handled",
        value: count(
          "SELECT COUNT(*) AS c FROM check_logs WHERE direction = 'Out' AND at BETWEEN ? AND ?",
          params,
        ),
      },
    ],
    charts: [
      {
        title: "Gate stamps by guard",
        data: series(
          all(
            `SELECT guard_name AS label, COUNT(*) AS value FROM check_logs
              WHERE at BETWEEN ? AND ? AND guard_name <> ''
              GROUP BY guard_name ORDER BY value DESC LIMIT 10`,
            params,
          ),
        ),
      },
      {
        title: "Roster by shift",
        data: series(
          all("SELECT shift AS label, COUNT(*) AS value FROM security_guards GROUP BY shift", []),
        ),
      },
      {
        title: "Roster by status",
        data: series(
          all("SELECT status AS label, COUNT(*) AS value FROM security_guards GROUP BY status", []),
        ),
      },
    ],
    columns: columnsFrom(rows),
    rows,
  };
}

function vehiclesReport(f: ReportFilters): ReportResult {
  const params: SqlValue[] = [f.from, endOfDay(f.to)];

  const rows = all<Record<string, string | number>>(
    `SELECT vehicle_number AS "Vehicle", vehicle_type AS "Type", visitor_name AS "Visitor",
            driver_name AS "Driver", gate AS "Gate", entry_time AS "Entry",
            COALESCE(exit_time, '') AS "Exit", status AS "Status", guard_name AS "Guard"
       FROM vehicles WHERE entry_time BETWEEN ? AND ?
      ORDER BY entry_time DESC LIMIT 2000`,
    params,
  );

  return {
    kind: "vehicles",
    title: "Vehicle Report",
    description: "Vehicles admitted to campus and their current position.",
    generatedAt: new Date().toISOString(),
    filters: f,
    stats: [
      {
        label: "Vehicle entries",
        value: count("SELECT COUNT(*) AS c FROM vehicles WHERE entry_time BETWEEN ? AND ?", params),
      },
      {
        label: "Currently inside",
        value: count("SELECT COUNT(*) AS c FROM vehicles WHERE status = 'Inside'", []),
      },
      {
        label: "Exited",
        value: count(
          "SELECT COUNT(*) AS c FROM vehicles WHERE status = 'Exited' AND entry_time BETWEEN ? AND ?",
          params,
        ),
      },
    ],
    charts: [
      {
        title: "Entries per day",
        data: series(
          all(
            `SELECT substr(entry_time, 1, 10) AS label, COUNT(*) AS value FROM vehicles
              WHERE entry_time BETWEEN ? AND ? GROUP BY substr(entry_time, 1, 10) ORDER BY label`,
            params,
          ),
        ),
      },
      {
        title: "By vehicle type",
        data: series(
          all(
            `SELECT vehicle_type AS label, COUNT(*) AS value FROM vehicles
              WHERE entry_time BETWEEN ? AND ? GROUP BY vehicle_type ORDER BY value DESC`,
            params,
          ),
        ),
      },
      {
        title: "By gate",
        data: series(
          all(
            `SELECT gate AS label, COUNT(*) AS value FROM vehicles
              WHERE entry_time BETWEEN ? AND ? GROUP BY gate ORDER BY value DESC`,
            params,
          ),
        ),
      },
    ],
    columns: columnsFrom(rows),
    rows,
  };
}

function incidentsReport(f: ReportFilters): ReportResult {
  const where: string[] = ["date BETWEEN ? AND ?"];
  const params: SqlValue[] = [f.from, f.to];
  if (f.severity && f.severity !== "all") {
    where.push("severity = ?");
    params.push(f.severity);
  }
  if (f.status && f.status !== "all") {
    where.push("status = ?");
    params.push(f.status);
  }
  const clause = where.join(" AND ");

  const rows = all<Record<string, string | number>>(
    `SELECT id AS "Incident ID", type AS "Type", title AS "Title", location AS "Location",
            date AS "Date", time AS "Time", severity AS "Severity", status AS "Status",
            reported_by AS "Reported By", COALESCE(assigned_to_name, '') AS "Assigned To",
            COALESCE(resolved_at, '') AS "Resolved At"
       FROM incidents WHERE ${clause} ORDER BY date DESC, time DESC LIMIT 2000`,
    params,
  );

  return {
    kind: "incidents",
    title: "Incident Report",
    description: "Safety incidents raised on campus and their resolution state.",
    generatedAt: new Date().toISOString(),
    filters: f,
    stats: [
      { label: "Incidents", value: count(`SELECT COUNT(*) AS c FROM incidents WHERE ${clause}`, params) },
      {
        label: "Open",
        value: count(`SELECT COUNT(*) AS c FROM incidents WHERE ${clause} AND status = 'Open'`, params),
      },
      {
        label: "Investigating",
        value: count(
          `SELECT COUNT(*) AS c FROM incidents WHERE ${clause} AND status = 'Investigating'`,
          params,
        ),
      },
      {
        label: "Resolved",
        value: count(
          `SELECT COUNT(*) AS c FROM incidents WHERE ${clause} AND status IN ('Resolved','Closed')`,
          params,
        ),
      },
      {
        label: "Critical",
        value: count(
          `SELECT COUNT(*) AS c FROM incidents WHERE ${clause} AND severity = 'Critical'`,
          params,
        ),
      },
    ],
    charts: [
      {
        title: "By severity",
        data: series(
          all(
            `SELECT severity AS label, COUNT(*) AS value FROM incidents WHERE ${clause}
              GROUP BY severity ORDER BY value DESC`,
            params,
          ),
        ),
      },
      {
        title: "By type",
        data: series(
          all(
            `SELECT type AS label, COUNT(*) AS value FROM incidents WHERE ${clause}
              GROUP BY type ORDER BY value DESC`,
            params,
          ),
        ),
      },
      {
        title: "Incidents per day",
        data: series(
          all(
            `SELECT date AS label, COUNT(*) AS value FROM incidents WHERE ${clause}
              GROUP BY date ORDER BY label`,
            params,
          ),
        ),
      },
    ],
    columns: columnsFrom(rows),
    rows,
  };
}

function emergencyReport(f: ReportFilters): ReportResult {
  const params: SqlValue[] = [f.from, endOfDay(f.to)];

  const rows = all<Record<string, string | number>>(
    `SELECT id AS "Alert ID", type AS "Type", severity AS "Severity", location AS "Location",
            triggered_by AS "Raised By", triggered_at AS "Raised At", status AS "Status",
            COALESCE(acknowledged_by, '') AS "Acknowledged By",
            COALESCE(resolved_at, '') AS "Resolved At"
       FROM emergencies WHERE triggered_at BETWEEN ? AND ?
      ORDER BY triggered_at DESC LIMIT 2000`,
    params,
  );

  return {
    kind: "emergency",
    title: "Emergency Report",
    description: "Emergency alerts raised inside the campus security system.",
    generatedAt: new Date().toISOString(),
    filters: f,
    stats: [
      {
        label: "Alerts raised",
        value: count("SELECT COUNT(*) AS c FROM emergencies WHERE triggered_at BETWEEN ? AND ?", params),
      },
      {
        label: "Active now",
        value: count("SELECT COUNT(*) AS c FROM emergencies WHERE status = 'Active'", []),
      },
      {
        label: "Resolved",
        value: count(
          "SELECT COUNT(*) AS c FROM emergencies WHERE status = 'Resolved' AND triggered_at BETWEEN ? AND ?",
          params,
        ),
      },
    ],
    charts: [
      {
        title: "By type",
        data: series(
          all(
            `SELECT type AS label, COUNT(*) AS value FROM emergencies
              WHERE triggered_at BETWEEN ? AND ? GROUP BY type ORDER BY value DESC`,
            params,
          ),
        ),
      },
      {
        title: "By status",
        data: series(
          all(
            `SELECT status AS label, COUNT(*) AS value FROM emergencies
              WHERE triggered_at BETWEEN ? AND ? GROUP BY status`,
            params,
          ),
        ),
      },
    ],
    columns: columnsFrom(rows),
    rows,
  };
}

function columnsFrom(rows: Record<string, string | number>[]): ReportColumn[] {
  if (!rows.length) return [];
  return Object.keys(rows[0]).map((key) => ({ key, header: key }));
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export function buildReport(kind: ReportKind, filters: ReportFilters): ReportResult {
  if (!filters.from || !filters.to) throw badRequest("Choose a date range for the report.");
  if (filters.from > filters.to) throw badRequest("The start date must fall before the end date.");

  switch (kind) {
    case "visitors":
      return visitorsReport(filters);
    case "entry-exit":
      return entryExitReport(filters);
    case "meetings":
      return meetingsReport(filters);
    case "guards":
      return guardsReport(filters);
    case "vehicles":
      return vehiclesReport(filters);
    case "incidents":
      return incidentsReport(filters);
    case "emergency":
      return emergencyReport(filters);
    default:
      throw badRequest("Unknown report type.");
  }
}

/**
 * Dashboard analytics — the chart set on `/admin/dashboard`, aggregated in SQL
 * over the last `days` days.
 */
export function dashboardAnalytics(days = 14): ReportSeries[] {
  const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  return [
    {
      title: "Visitors per day",
      data: series(
        all(
          `SELECT visit_date AS label, COUNT(*) AS value FROM visit_requests
            WHERE visit_date >= ? GROUP BY visit_date ORDER BY label`,
          [from],
        ),
      ),
    },
    {
      title: "Entry vs exit",
      data: series(
        all(
          `SELECT direction AS label, COUNT(*) AS value FROM check_logs
            WHERE at >= ? GROUP BY direction`,
          [from],
        ),
      ),
    },
    {
      title: "Visitor purpose",
      data: series(
        all(
          `SELECT purpose AS label, COUNT(*) AS value FROM visit_requests
            WHERE visit_date >= ? GROUP BY purpose ORDER BY value DESC`,
          [from],
        ),
      ),
    },
    {
      title: "Department meetings",
      data: series(
        all(
          `SELECT department AS label, COUNT(*) AS value FROM visit_requests
            WHERE visit_date >= ? AND department <> '' GROUP BY department ORDER BY value DESC LIMIT 8`,
          [from],
        ),
      ),
    },
    {
      title: "Peak visitor hours",
      data: series(
        all(
          `SELECT substr(visit_time, 1, 2) || ':00' AS label, COUNT(*) AS value FROM visit_requests
            WHERE visit_date >= ? GROUP BY substr(visit_time, 1, 2) ORDER BY label`,
          [from],
        ),
      ),
    },
    {
      title: "Incidents by severity",
      data: series(
        all(
          `SELECT severity AS label, COUNT(*) AS value FROM incidents
            WHERE date >= ? GROUP BY severity ORDER BY value DESC`,
          [from],
        ),
      ),
    },
    {
      title: "Guard activity",
      data: series(
        all(
          `SELECT guard_name AS label, COUNT(*) AS value FROM check_logs
            WHERE at >= ? AND guard_name <> '' GROUP BY guard_name ORDER BY value DESC LIMIT 8`,
          [from],
        ),
      ),
    },
    {
      title: "Vehicle activity",
      data: series(
        all(
          `SELECT substr(entry_time, 1, 10) AS label, COUNT(*) AS value FROM vehicles
            WHERE entry_time >= ? GROUP BY substr(entry_time, 1, 10) ORDER BY label`,
          [from],
        ),
      ),
    },
  ];
}
