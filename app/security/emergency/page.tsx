"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Info, ShieldAlert, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { EmergencyStatusBadge, SeverityBadge } from "@/components/shared/status-badge";
import { EmergencyPanel } from "@/components/admin/emergency-panel";
import { useData } from "@/components/providers/data-provider";
import { formatDateTime, relativeTime } from "@/lib/utils";

/**
 * Gate-side emergency alerts.
 *
 * Raising an alert writes a record, notifies the console and enters the audit
 * log. It is a software alert only — it places no telephone call and reaches no
 * emergency service.
 */
export default function SecurityEmergencyPage() {
  const { db, ready } = useData();

  const alerts = React.useMemo(
    () => [...db.emergencies].sort((a, b) => (a.triggeredAt < b.triggeredAt ? 1 : -1)),
    [db.emergencies],
  );

  const active = alerts.filter((a) => a.status === "Active");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Emergency</h1>
          <p className="text-sm text-muted-foreground">
            Raise an alert to the security control room immediately.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/security/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Console
          </Link>
        </Button>
      </div>

      {active.length > 0 ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-destructive">
              {active.length} active alert{active.length === 1 ? "" : "s"} on campus
            </p>
            <p className="text-sm text-muted-foreground">
              Follow the control room&rsquo;s instructions and keep the gate clear.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Active alerts"
          value={active.length}
          icon={ShieldAlert}
          tone={active.length > 0 ? "destructive" : "success"}
          loading={!ready}
        />
        <StatCard
          label="Alerts on record"
          value={alerts.length}
          icon={ShieldCheck}
          loading={!ready}
        />
        <StatCard
          label="Resolved"
          value={alerts.filter((a) => a.status === "Resolved").length}
          icon={ShieldCheck}
          tone="success"
          loading={!ready}
        />
      </div>

      <Card>
        <SectionHeader
          title="Raise an emergency alert"
          description="Pick the type, confirm, and the control room is notified"
        />
        <EmergencyPanel size="large" />
      </Card>

      <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        This raises an alert inside the campus security system only. It does not contact police,
        fire or ambulance services — call them directly on their own numbers when needed.
      </p>

      <Card>
        <SectionHeader title="Recent alerts" description="Most recent first" />
        {alerts.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={ShieldCheck}
              title="No emergency alerts"
              description="Nothing has been raised. The campus is clear."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {alerts.slice(0, 20).map((alert) => (
              <li key={alert.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{alert.type}</p>
                  <p className="text-sm text-muted-foreground">
                    {alert.location} · raised by {alert.triggeredBy}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(alert.triggeredAt)} · {relativeTime(alert.triggeredAt)}
                  </p>
                  {alert.note ? (
                    <p className="mt-1 text-sm text-muted-foreground">{alert.note}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <SeverityBadge severity={alert.severity} />
                  <EmergencyStatusBadge status={alert.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
