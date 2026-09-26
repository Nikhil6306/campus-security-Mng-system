"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  DoorOpen,
  LogIn,
  LogOut,
  Mail,
  Phone,
  Plus,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { CardsLoadingState, EmptyState, InlineLoader } from "@/components/shared/states";
import { FilterBar } from "@/components/admin/filter-bar";
import { GuardFormDialog } from "@/components/admin/guard-form-dialog";
import { useData } from "@/components/providers/data-provider";
import { api } from "@/lib/api";
import type { GuardRosterRow } from "@/lib/api";
import type { SecurityGuard } from "@/lib/types";
import { GUARD_SHIFTS, GUARD_STATUSES } from "@/lib/types";
import { formatDateTime, initials } from "@/lib/utils";

/**
 * Security guard roster.
 *
 * The per-guard counters come from `/api/guards`, which computes them from the
 * gate logs — the snapshot alone cannot show how many visitors a guard handled
 * today, and storing that on the guard row would let it drift.
 */

const statusTone: Record<string, "success" | "secondary" | "muted" | "warning" | "destructive"> = {
  Active: "success",
  "On Duty": "success",
  "Off Duty": "muted",
  "On Leave": "warning",
  Suspended: "destructive",
};

function GuardsView() {
  const params = useSearchParams();
  const { db, ready } = useData();

  const [rows, setRows] = React.useState<GuardRosterRow[] | null>(null);
  const [search, setSearch] = React.useState(params.get("q") ?? "");
  const [gate, setGate] = React.useState("all");
  const [shift, setShift] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SecurityGuard | null>(null);

  // Re-fetch whenever the shared snapshot moves, so a check-in elsewhere in the
  // building updates these counters without a page reload.
  React.useEffect(() => {
    let cancelled = false;
    api
      .guards()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [db.syncedAt]);

  const gates = React.useMemo(
    () => db.locations.filter((l) => l.kind === "Gate").map((l) => l.name),
    [db.locations],
  );

  const filtered = React.useMemo(() => {
    if (!rows) return [];
    const query = search.trim().toLowerCase();
    return rows.filter(({ guard }) => {
      if (gate !== "all" && guard.assignedGate !== gate) return false;
      if (shift !== "all" && guard.shift !== shift) return false;
      if (status !== "all" && guard.status !== status) return false;
      if (!query) return true;
      return [guard.fullName, guard.employeeId, guard.phone, guard.assignedGate, guard.email]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [rows, search, gate, shift, status]);

  const loading = !ready || rows === null;
  const onDuty = rows?.filter((r) => r.guard.status === "On Duty" || r.guard.status === "Active");
  const checkInsToday = rows?.reduce((sum, r) => sum + r.today.checkIns, 0) ?? 0;
  const incidentsToday = rows?.reduce((sum, r) => sum + r.today.incidentsReported, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Guards"
        description="The gate roster, their posts, and what each guard has handled today."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add guard
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="On roster" value={rows?.length ?? 0} icon={Users} loading={loading} />
        <StatCard
          label="On duty now"
          value={onDuty?.length ?? 0}
          icon={ShieldCheck}
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Check-ins today"
          value={checkInsToday}
          icon={LogIn}
          tone="accent"
          loading={loading}
        />
        <StatCard
          label="Incidents reported"
          value={incidentsToday}
          icon={AlertTriangle}
          tone={incidentsToday > 0 ? "warning" : "default"}
          href="/admin/incidents"
          loading={loading}
        />
      </div>

      <Card>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, employee ID or gate…"
          resultCount={filtered.length}
          totalCount={rows?.length ?? 0}
          isFiltered={search !== "" || gate !== "all" || shift !== "all" || status !== "all"}
          onReset={() => {
            setSearch("");
            setGate("all");
            setShift("all");
            setStatus("all");
          }}
          filters={[
            {
              id: "guard-gate",
              label: "Gate",
              value: gate,
              onChange: setGate,
              options: [
                { value: "all", label: "All gates" },
                ...gates.map((g) => ({ value: g, label: g })),
              ],
              className: "min-w-[170px]",
            },
            {
              id: "guard-shift",
              label: "Shift",
              value: shift,
              onChange: setShift,
              options: [
                { value: "all", label: "All shifts" },
                ...GUARD_SHIFTS.map((s) => ({ value: s, label: s })),
              ],
              className: "min-w-[150px]",
            },
            {
              id: "guard-status",
              label: "Status",
              value: status,
              onChange: setStatus,
              options: [
                { value: "all", label: "All statuses" },
                ...GUARD_STATUSES.map((s) => ({ value: s, label: s })),
              ],
              className: "min-w-[160px]",
            },
          ]}
        />

        <div className="p-4">
          {loading ? (
            <CardsLoadingState count={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No guards match this search"
              description="Clear the filters to see the full roster."
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filtered.map(({ guard, today }) => (
                <li key={guard.id}>
                  <article className="flex h-full flex-col rounded-lg border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-md">
                    <header className="flex items-start gap-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                        aria-hidden
                      >
                        {initials(guard.fullName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold">{guard.fullName}</h3>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {guard.employeeId}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {guard.shift} · {guard.shiftStart}–{guard.shiftEnd}
                        </p>
                      </div>
                      <Badge variant={statusTone[guard.status] ?? "secondary"}>
                        {guard.status}
                      </Badge>
                    </header>

                    <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <DoorOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <dd className="truncate font-medium text-foreground">
                          {guard.assignedGate}
                        </dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <dd className="font-mono">{guard.phone}</dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <dd className="truncate">{guard.email || "—"}</dd>
                      </div>
                    </dl>

                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                      {[
                        { label: "In", value: today.checkIns, icon: LogIn },
                        { label: "Out", value: today.checkOuts, icon: LogOut },
                        { label: "Incidents", value: today.incidentsReported, icon: AlertTriangle },
                      ].map((stat) => (
                        <div key={stat.label}>
                          <p className="text-base font-semibold tabular-nums">{stat.value}</p>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {stat.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    <p className="mt-2 text-center text-[11px] text-muted-foreground">
                      Last activity:{" "}
                      {today.lastActivityAt ? formatDateTime(today.lastActivityAt) : "None today"}
                    </p>

                    <div className="mt-3 flex gap-2">
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link href={`/admin/guards/${guard.id}`}>
                          <UserRound className="h-3.5 w-3.5" />
                          View profile
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(guard);
                          setDialogOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <GuardFormDialog open={dialogOpen} onOpenChange={setDialogOpen} guard={editing} />
    </div>
  );
}

export default function GuardsPage() {
  return (
    <Suspense fallback={<InlineLoader label="Loading the guard roster…" />}>
      <GuardsView />
    </Suspense>
  );
}
