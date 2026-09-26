"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Car,
  DoorOpen,
  LogIn,
  LogOut,
  Pencil,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DetailRow } from "@/components/shared/form-field";
import { EmptyState, ErrorState, InlineLoader } from "@/components/shared/states";
import { IncidentStatusBadge, SeverityBadge } from "@/components/shared/status-badge";
import { GuardFormDialog } from "@/components/admin/guard-form-dialog";
import { useData } from "@/components/providers/data-provider";
import { api, errorMessage } from "@/lib/api";
import type { GuardProfile } from "@/lib/api";
import { formatDate, formatDateTime, initials } from "@/lib/utils";

/**
 * One guard's record.
 *
 * Everything below the personal details is derived server-side from the gate
 * logs and the incident table, so the figures here and the figures on the
 * roster are the same numbers read the same way.
 */

const statusTone: Record<string, "success" | "muted" | "warning" | "destructive" | "secondary"> = {
  Active: "success",
  "On Duty": "success",
  "Off Duty": "muted",
  "On Leave": "warning",
  Suspended: "destructive",
};

export default function GuardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { db, ready } = useData();

  const id = params?.id;
  const [profile, setProfile] = React.useState<GuardProfile | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);

  const load = React.useCallback(() => {
    if (!id) return;
    setError(null);
    api
      .guard(id)
      .then(setProfile)
      .catch((err: unknown) => setError(errorMessage(err, "That guard record could not be loaded.")));
  }, [id]);

  // Reload on every snapshot change so an edit made in the dialog lands here too.
  React.useEffect(() => {
    load();
  }, [load, db.syncedAt]);

  if (error) {
    return (
      <ErrorState
        title="Guard not found"
        description={error}
        onRetry={load}
      />
    );
  }

  if (!ready || !profile) return <InlineLoader label="Loading the guard record…" />;

  const { guard, today, lifetime, recentLogs, incidents, shiftHistory } = profile;

  return (
    <div className="space-y-6">
      <PageHeader
        title={guard.fullName}
        description={`${guard.employeeId} · ${guard.shift} shift · ${guard.assignedGate}`}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push("/admin/guards")}>
              <ArrowLeft className="h-4 w-4" />
              Roster
            </Button>
            <Button onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
              Edit guard
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Check-ins today" value={today.checkIns} icon={LogIn} tone="success" />
        <StatCard label="Check-outs today" value={today.checkOuts} icon={LogOut} tone="accent" />
        <StatCard label="Vehicles handled" value={today.vehiclesHandled} icon={Car} />
        <StatCard
          label="Incidents reported"
          value={today.incidentsReported}
          icon={AlertTriangle}
          tone={today.incidentsReported > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <SectionHeader title="Personal information" />
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary"
                aria-hidden
              >
                {initials(guard.fullName)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{guard.fullName}</p>
                <Badge variant={statusTone[guard.status] ?? "secondary"} className="mt-1">
                  {guard.status}
                </Badge>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-4">
              <DetailRow label="Employee ID" value={guard.employeeId} mono />
              <DetailRow label="Phone" value={guard.phone} mono />
              <DetailRow label="Email" value={guard.email} className="col-span-2" />
              <DetailRow label="Emergency contact" value={guard.emergencyContact} mono />
              <DetailRow label="Joined" value={formatDate(guard.joiningDate)} />
              <DetailRow label="Address" value={guard.address} className="col-span-2" />
            </dl>
          </div>

          <SectionHeader title="Employment & posting" />
          <dl className="grid grid-cols-2 gap-4 p-4">
            <DetailRow label="Shift" value={guard.shift} />
            <DetailRow
              label="Shift hours"
              value={`${guard.shiftStart} – ${guard.shiftEnd}`}
              mono
            />
            <DetailRow
              label="Assigned gate"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <DoorOpen className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  {guard.assignedGate}
                </span>
              }
            />
            <DetailRow
              label="Last activity"
              value={lifetime.lastActivityAt ? formatDateTime(lifetime.lastActivityAt) : "—"}
            />
          </dl>

          <SectionHeader title="Lifetime totals" />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-2">
            {[
              { label: "Check-ins", value: lifetime.checkIns },
              { label: "Check-outs", value: lifetime.checkOuts },
              { label: "Vehicles", value: lifetime.vehiclesHandled },
              { label: "Incidents", value: lifetime.incidentsReported },
            ].map((stat) => (
              <div key={stat.label} className="rounded-md border border-border p-3 text-center">
                <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <SectionHeader
              title="Recent gate activity"
              description="The last 50 movements this guard stamped."
            />
            {recentLogs.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={ShieldCheck}
                  title="No gate movements yet"
                  description="Check-ins and check-outs this guard records will appear here."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Visitor</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Gate</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.visitorName}</TableCell>
                        <TableCell>
                          <Badge variant={log.direction === "In" ? "success" : "muted"}>
                            {log.direction === "In" ? "Checked in" : "Checked out"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{log.gate}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                          {formatDateTime(log.at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader
              title="Shift history"
              description="Movements stamped per day, most recent first."
            />
            {shiftHistory.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={CalendarDays}
                  title="No shift history yet"
                  description="A day appears here once this guard stamps their first movement."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">In</TableHead>
                      <TableHead className="text-right">Out</TableHead>
                      <TableHead>First</TableHead>
                      <TableHead>Last</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shiftHistory.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell className="font-medium">{formatDate(day.date)}</TableCell>
                        <TableCell className="text-right tabular-nums">{day.checkIns}</TableCell>
                        <TableCell className="text-right tabular-nums">{day.checkOuts}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                          {formatDateTime(day.firstAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                          {formatDateTime(day.lastAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader
              title="Incidents reported"
              description="Safety reports raised by this guard."
              actions={
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/incidents">All incidents</Link>
                </Button>
              }
            />
            {incidents.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={ShieldAlert}
                  title="No incidents reported"
                  description="This guard has not filed a safety report."
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {incidents.map((incident) => (
                  <li key={incident.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{incident.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {incident.id} · {incident.location} · {formatDateTime(incident.createdAt)}
                      </p>
                    </div>
                    <SeverityBadge severity={incident.severity} />
                    <IncidentStatusBadge status={incident.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <GuardFormDialog open={editing} onOpenChange={setEditing} guard={guard} />
    </div>
  );
}
