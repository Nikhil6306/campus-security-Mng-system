"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ClipboardList, MapPin, Plus, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { CardsLoadingState, EmptyState } from "@/components/shared/states";
import { IncidentStatusBadge, SeverityBadge } from "@/components/shared/status-badge";
import { ReportIncidentDialog } from "@/components/admin/report-incident-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { formatDateTime, relativeTime, todayISO } from "@/lib/utils";

/**
 * Incident reporting for the gate.
 *
 * A guard files here and an administrator triages in `/admin/incidents` — the
 * same record, through the same form. Guards see the reports rather than the
 * triage controls, which are an administrator's decision.
 */
export default function SecurityIncidentsPage() {
  const { db, ready } = useData();
  const { session } = useAuth();
  const [reporting, setReporting] = React.useState(false);

  const today = todayISO();

  const incidents = React.useMemo(
    () =>
      [...db.incidents].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [db.incidents],
  );

  const mine = incidents.filter((i) => i.reportedById === session?.refId);
  const openCount = incidents.filter((i) => i.status === "Open" || i.status === "Investigating")
    .length;
  const todayCount = incidents.filter((i) => i.date === today).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
          <p className="text-sm text-muted-foreground">
            Report anything unusual. An administrator picks it up from here.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/security/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Console
            </Link>
          </Button>
          <Button size="lg" onClick={() => setReporting(true)}>
            <Plus className="h-5 w-5" />
            Report incident
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Open incidents"
          value={openCount}
          icon={AlertTriangle}
          tone={openCount > 0 ? "warning" : "success"}
          loading={!ready}
        />
        <StatCard label="Reported today" value={todayCount} icon={ClipboardList} loading={!ready} />
        <StatCard
          label="Filed by you"
          value={mine.length}
          icon={ShieldCheck}
          tone="accent"
          loading={!ready}
        />
      </div>

      <Card>
        <SectionHeader
          title="Recent incidents"
          description="Most recent first, across all gates"
        />
        {!ready ? (
          <div className="p-4">
            <CardsLoadingState count={4} />
          </div>
        ) : incidents.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={ShieldCheck}
              title="No incidents on record"
              description="Nothing has been reported. Use the button above if something needs attention."
              action={
                <Button onClick={() => setReporting(true)}>
                  <Plus className="h-4 w-4" />
                  Report incident
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {incidents.slice(0, 40).map((incident) => (
              <li key={incident.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{incident.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {incident.description}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono">{incident.id}</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" aria-hidden />
                      {incident.location}
                    </span>
                    <span>{formatDateTime(incident.createdAt)}</span>
                    <span>· {relativeTime(incident.createdAt)}</span>
                    <span>· by {incident.reportedBy}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <SeverityBadge severity={incident.severity} />
                  <IncidentStatusBadge status={incident.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ReportIncidentDialog open={reporting} onOpenChange={setReporting} />
    </div>
  );
}
