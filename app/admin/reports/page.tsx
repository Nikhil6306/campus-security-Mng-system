"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  CalendarDays,
  Car,
  Download,
  FileBarChart,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrap,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toaster";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState, InlineLoader } from "@/components/shared/states";
import { FormField } from "@/components/shared/form-field";
import { LogoMark, UNIVERSITY_NAME } from "@/components/shared/logo";
import { BarList } from "@/components/admin/charts";
import { useData } from "@/components/providers/data-provider";
import { api, errorMessage, type ReportResult } from "@/lib/api";
import { downloadCsv, stampedFilename } from "@/lib/export";
import {
  INCIDENT_SEVERITIES,
  VISIT_PURPOSES,
  VISIT_STATUSES,
} from "@/lib/types";
import { formatDateLong, formatDateTime, todayISO } from "@/lib/utils";

/**
 * Reporting console.
 *
 * Every report is produced by the server against the database and arrives
 * fully formed — title, headline figures, chart series, columns and rows — so
 * this page stays a generic renderer. Adding a report server-side needs no
 * change here, and no figure on screen was computed from a partial snapshot.
 */

type ReportKind =
  | "visitors"
  | "entry-exit"
  | "meetings"
  | "guards"
  | "vehicles"
  | "incidents"
  | "emergency";

interface ReportDef {
  kind: ReportKind;
  label: string;
  icon: LucideIcon;
  /** Filters this report actually honours. */
  filters: ("status" | "purpose" | "department" | "severity" | "guard" | "teacher")[];
}

const REPORTS: ReportDef[] = [
  { kind: "visitors", label: "Visitor Report", icon: Users, filters: ["status", "purpose", "department"] },
  { kind: "entry-exit", label: "Daily Entry / Exit", icon: ArrowLeftRight, filters: [] },
  { kind: "meetings", label: "Teacher Meetings", icon: CalendarDays, filters: ["department", "teacher"] },
  { kind: "guards", label: "Guard Activity", icon: ShieldCheck, filters: ["guard"] },
  { kind: "vehicles", label: "Vehicle Report", icon: Car, filters: [] },
  { kind: "incidents", label: "Incident Report", icon: AlertTriangle, filters: ["severity"] },
  { kind: "emergency", label: "Emergency Report", icon: ShieldAlert, filters: [] },
];

const PRESETS = [
  { id: "7", label: "Last 7 days", from: () => todayISO(-6), to: () => todayISO() },
  { id: "30", label: "Last 30 days", from: () => todayISO(-29), to: () => todayISO() },
  { id: "upcoming", label: "Next 30 days", from: () => todayISO(), to: () => todayISO(30) },
  { id: "90", label: "Last 90 days", from: () => todayISO(-89), to: () => todayISO(30) },
];

export default function ReportsPage() {
  const { db } = useData();

  const [kind, setKind] = React.useState<ReportKind>("visitors");
  const [from, setFrom] = React.useState(() => todayISO(-29));
  const [to, setTo] = React.useState(() => todayISO(7));
  const [status, setStatus] = React.useState("all");
  const [purpose, setPurpose] = React.useState("all");
  const [department, setDepartment] = React.useState("all");
  const [severity, setSeverity] = React.useState("all");
  const [guardId, setGuardId] = React.useState("all");
  const [teacherId, setTeacherId] = React.useState("all");

  const [report, setReport] = React.useState<ReportResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();

  const definition = REPORTS.find((r) => r.kind === kind) ?? REPORTS[0];
  const rangeInvalid = from > to;

  /* --------------------------- Fetch the report --------------------------- */

  React.useEffect(() => {
    if (rangeInvalid) return;
    let alive = true;
    setLoading(true);
    setError(undefined);

    const params: Record<string, string | undefined> = { kind, from, to };
    if (definition.filters.includes("status")) params.status = status;
    if (definition.filters.includes("purpose")) params.purpose = purpose;
    if (definition.filters.includes("department")) params.department = department;
    if (definition.filters.includes("severity")) params.severity = severity;
    if (definition.filters.includes("guard")) params.guardId = guardId;
    if (definition.filters.includes("teacher")) params.teacherId = teacherId;

    api
      .report(params)
      .then((result) => {
        if (alive) setReport(result);
      })
      .catch((err) => {
        if (!alive) return;
        setReport(null);
        setError(errorMessage(err, "Unable to build this report. Please try again."));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [
    kind,
    from,
    to,
    status,
    purpose,
    department,
    severity,
    guardId,
    teacherId,
    definition,
    rangeInvalid,
  ]);

  /* -------------------------------- Actions ------------------------------- */

  const exportCsv = () => {
    if (!report || report.rows.length === 0) {
      toast.error("There are no records to export for this selection.");
      return;
    }
    downloadCsv(
      stampedFilename(report.kind),
      report.rows,
      report.columns.map((column) => ({
        header: column.header,
        value: (row: Record<string, string | number>) => row[column.key],
      })),
    );
    toast.success(`${report.title} exported.`, {
      description: `${report.rows.length} record${report.rows.length === 1 ? "" : "s"} downloaded as CSV.`,
    });
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setFrom(preset.from());
    setTo(preset.to());
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Visitor, gate, meeting, guard, vehicle and safety reporting drawn from campus records."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!report?.rows.length}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </>
        }
      />

      {/* ------------------------------ Report picker ----------------------- */}
      <nav aria-label="Report type" className="no-print">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {REPORTS.map((item) => {
            const active = item.kind === kind;
            return (
              <li key={item.kind}>
                <button
                  type="button"
                  onClick={() => setKind(item.kind)}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-2.5 rounded-md border px-3.5 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "border-primary bg-primary/[0.06] text-primary"
                      : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* -------------------------------- Filters --------------------------- */}
      <Card className="no-print">
        <SectionHeader title="Filters" description="Narrow the report before exporting" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            id="report-from"
            label="From"
            error={rangeInvalid ? "Start date must be before the end date." : undefined}
          >
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              invalid={rangeInvalid}
            />
          </FormField>

          <FormField id="report-to" label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </FormField>

          {definition.filters.includes("status") && (
            <FormField id="report-status" label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="report-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {VISIT_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          {definition.filters.includes("purpose") && (
            <FormField id="report-purpose" label="Purpose">
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger id="report-purpose">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All purposes</SelectItem>
                  {VISIT_PURPOSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          {definition.filters.includes("department") && (
            <FormField id="report-department" label="Department">
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger id="report-department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {db.departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          {definition.filters.includes("severity") && (
            <FormField id="report-severity" label="Severity">
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger id="report-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  {INCIDENT_SEVERITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          {definition.filters.includes("guard") && (
            <FormField id="report-guard" label="Guard">
              <Select value={guardId} onValueChange={setGuardId}>
                <SelectTrigger id="report-guard">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All guards</SelectItem>
                  {db.guards.map((guard) => (
                    <SelectItem key={guard.id} value={guard.id}>
                      {guard.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          {definition.filters.includes("teacher") && (
            <FormField id="report-teacher" label="Teacher">
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger id="report-teacher">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teachers</SelectItem>
                  {db.teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
            {PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* ------------------------------ Print header ------------------------ */}
      <div className="hidden print:block">
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
          <LogoMark size="lg" />
          <div>
            <p className="text-sm font-semibold">{UNIVERSITY_NAME}</p>
            <p className="text-xs text-muted-foreground">
              {report?.title} · {formatDateLong(from)} to {formatDateLong(to)}
            </p>
          </div>
        </div>
      </div>

      {/* -------------------------------- Report ---------------------------- */}
      {error ? (
        <Card>
          <EmptyState icon={AlertTriangle} title="Report unavailable" description={error} />
        </Card>
      ) : loading && !report ? (
        <Card>
          <InlineLoader label="Building report…" />
        </Card>
      ) : report ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{report.title}</h2>
            <p className="text-sm text-muted-foreground">{report.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Generated {formatDateTime(report.generatedAt)} · {formatDateLong(from)} –{" "}
              {formatDateLong(to)}
            </p>
          </div>

          {report.stats.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {report.stats.map((stat) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  icon={FileBarChart}
                />
              ))}
            </div>
          )}

          {report.charts.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {report.charts.map((chart) => (
                <Card key={chart.title}>
                  <SectionHeader title={chart.title} />
                  <div className="p-4">
                    <BarList data={chart.data} />
                  </div>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <SectionHeader
              title="Records"
              description={`${report.rows.length} row${report.rows.length === 1 ? "" : "s"}`}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportCsv}
                  disabled={!report.rows.length}
                  className="no-print"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              }
            />
            {report.rows.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No records in this range"
                description="Widen the date range or clear a filter to see results."
              />
            ) : (
              <TableWrap>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {report.columns.map((column) => (
                        <TableHead key={column.key}>{column.header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.map((row, index) => (
                      <TableRow key={`${String(row[report.columns[0]?.key ?? ""])}-${index}`}>
                        {report.columns.map((column) => (
                          <TableCell key={column.key}>{row[column.key] ?? "—"}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
