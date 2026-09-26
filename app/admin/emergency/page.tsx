"use client";

import * as React from "react";
import { BellRing, Check, Info, Phone, ShieldCheck, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { EmergencyStatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmergencyPanel } from "@/components/admin/emergency-panel";
import { useData } from "@/components/providers/data-provider";
import { useAction } from "@/components/providers/use-action";
import { api } from "@/lib/api";
import type { EmergencyAlert } from "@/lib/types";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";

const CONTACTS = [
  { label: "Campus Security Control Room", value: "1800-000-000" },
  { label: "Campus Health Centre", value: "1800-000-111" },
  { label: "Fire Safety Officer", value: "1800-000-222" },
  { label: "Hostel Warden (on duty)", value: "1800-000-333" },
];

export default function EmergencyPage() {
  const { db, ready } = useData();
  const act = useAction();
  const [resolveTarget, setResolveTarget] = React.useState<EmergencyAlert | null>(null);

  const alerts = React.useMemo(
    () => [...db.emergencies].sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt)),
    [db.emergencies],
  );

  const active = alerts.filter((a) => a.status === "Active");
  const acknowledged = alerts.filter((a) => a.status === "Acknowledged");
  const resolved = alerts.filter((a) => a.status === "Resolved");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emergency"
        description="Raise and track campus emergency alerts. Alerts stay open until a responder resolves them."
      />

      <div
        role="note"
        className="flex gap-3 rounded-lg border border-warning/35 bg-warning/10 p-4"
      >
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-warning-strong" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Demonstration alerts only</p>
          <p className="text-sm leading-relaxed text-foreground/75">
            Triggering an alert here records it inside this application so the response workflow
            can be shown. No emergency service, SMS or call is dispatched. For a real emergency,
            contact the campus control room directly.
          </p>
        </div>
      </div>

      {active.length > 0 ? (
        <div
          role="alert"
          className="animate-pulse-ring rounded-lg border border-destructive bg-destructive/10 p-4"
        >
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-destructive">
                {active.length} active alert{active.length === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-sm text-foreground/75">
                {active[0].type} at {active[0].location} · raised {relativeTime(active[0].triggeredAt)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active"
          value={active.length}
          icon={TriangleAlert}
          tone={active.length > 0 ? "destructive" : "success"}
          loading={!ready}
        />
        <StatCard
          label="Acknowledged"
          value={acknowledged.length}
          icon={BellRing}
          tone="warning"
          loading={!ready}
        />
        <StatCard label="Resolved" value={resolved.length} icon={ShieldCheck} tone="success" loading={!ready} />
        <StatCard label="Total logged" value={alerts.length} icon={Phone} loading={!ready} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <div className="min-w-0 space-y-6">
          <Card>
            <SectionHeader
              title="Raise an emergency alert"
              description="Select the type of emergency, then confirm the location"
            />
            <div className="p-4">
              <EmergencyPanel />
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="Emergency log"
              description={`${alerts.length} alert${alerts.length === 1 ? "" : "s"} recorded`}
            />
            {alerts.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No emergency alerts"
                description="Alerts raised from this page or the security desk will be listed here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {alerts.map((alert) => (
                  <li key={alert.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                        alert.status === "Resolved"
                          ? "bg-success/12 text-success"
                          : "bg-destructive/12 text-destructive",
                      )}
                      aria-hidden
                    >
                      {alert.status === "Resolved" ? (
                        <ShieldCheck className="h-5 w-5" />
                      ) : (
                        <TriangleAlert className="h-5 w-5" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{alert.type}</p>
                        <EmergencyStatusBadge status={alert.status} />
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {alert.id}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {alert.location} · raised by {alert.triggeredBy}
                      </p>
                      {alert.note ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {alert.note}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                        {formatDateTime(alert.triggeredAt)}
                        {alert.resolvedAt ? ` · resolved ${formatDateTime(alert.resolvedAt)}` : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {alert.status === "Active" && (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            void act(() => api.updateEmergency(alert.id, "Acknowledged"), {
                              success: "Alert acknowledged.",
                              description: alert.id,
                              fallback: "Unable to acknowledge this alert. Please try again.",
                            });
                          }}
                        >
                          <BellRing className="h-3.5 w-3.5" />
                          Acknowledge
                        </Button>
                      )}
                      {alert.status !== "Resolved" && (
                        <Button size="xs" variant="success" onClick={() => setResolveTarget(alert)}>
                          <Check className="h-3.5 w-3.5" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <SectionHeader title="Emergency contacts" description="Campus response numbers (demo)" />
          <ul className="divide-y divide-border">
            {CONTACTS.map((contact) => (
              <li key={contact.label} className="flex items-center gap-3 p-4">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
                  aria-hidden
                >
                  <Phone className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{contact.label}</p>
                  <p className="font-mono text-xs text-muted-foreground">{contact.value}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-border p-4 text-xs text-muted-foreground">
            Numbers shown are placeholders for the demonstration build.
          </p>
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(resolveTarget)}
        onOpenChange={(open) => !open && setResolveTarget(null)}
        title="Resolve emergency alert"
        description={
          resolveTarget
            ? `${resolveTarget.type} at ${resolveTarget.location} will be marked resolved and time-stamped.`
            : undefined
        }
        confirmLabel="Mark resolved"
        tone="success"
        onConfirm={() => {
          if (!resolveTarget) return;
          void act(() => api.updateEmergency(resolveTarget.id, "Resolved"), {
            success: "Emergency alert resolved.",
            description: resolveTarget.id,
            fallback: "Unable to resolve this alert. Please try again.",
          });
          setResolveTarget(null);
        }}
      />
    </div>
  );
}
