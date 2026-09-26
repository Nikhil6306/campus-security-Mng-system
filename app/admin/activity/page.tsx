"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  Download,
  History,
  RefreshCw,
  ShieldCheck,
  UserCog,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState, InlineLoader, TableLoadingState } from "@/components/shared/states";
import { FilterBar } from "@/components/admin/filter-bar";
import { useData } from "@/components/providers/data-provider";
import { api } from "@/lib/api";
import type { ActivityLog } from "@/lib/types";
import { downloadCsv, stampedFilename } from "@/lib/export";
import { formatDateTime, relativeTime, todayISO } from "@/lib/utils";

/**
 * The audit trail.
 *
 * Every entry names who acted, in what role, on which record. The list is read
 * from `/api/activity` rather than the snapshot so it can reach further back
 * than the dashboard feed does.
 */

const roleTone: Record<string, "default" | "accent" | "success" | "warning" | "muted"> = {
  super_admin: "warning",
  admin: "default",
  security: "accent",
  teacher: "success",
  student: "muted",
  system: "muted",
};

/** `booking.approved` → `Booking approved` */
function readableAction(action: string): string {
  const [entity, ...rest] = action.split(".");
  const verb = rest.join(" ").replace(/_/g, " ");
  const text = `${entity} ${verb}`.trim().replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ActivityView() {
  const params = useSearchParams();
  const { db, ready } = useData();

  const [logs, setLogs] = React.useState<ActivityLog[] | null>(null);
  const [search, setSearch] = React.useState(params.get("q") ?? "");
  const [role, setRole] = React.useState("all");
  const [entity, setEntity] = React.useState("all");
  const [day, setDay] = React.useState("all");
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      setLogs(await api.activity(500));
    } catch {
      setLogs([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Reload whenever the shared snapshot moves — a check-in elsewhere in the
  // building should appear here without a manual refresh.
  React.useEffect(() => {
    void load();
  }, [load, db.syncedAt]);

  const entities = React.useMemo(
    () => [...new Set((logs ?? []).map((l) => l.entity))].sort(),
    [logs],
  );

  const today = todayISO();
  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return (logs ?? []).filter((log) => {
      if (role !== "all" && log.actorRole !== role) return false;
      if (entity !== "all" && log.entity !== entity) return false;
      if (day === "today" && !log.at.startsWith(today)) return false;
      if (day === "week") {
        const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
        if (log.at < cutoff) return false;
      }
      if (!query) return true;
      return [log.summary, log.actorName, log.action, log.entityId]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [logs, search, role, entity, day, today]);

  const loading = !ready || logs === null;
  const todayCount = (logs ?? []).filter((l) => l.at.startsWith(today)).length;
  const actors = new Set((logs ?? []).map((l) => l.actorName)).size;

  function exportCsv() {
    downloadCsv(stampedFilename("activity-log"), filtered, [
      { header: "Time", value: (l) => formatDateTime(l.at) },
      { header: "Actor", value: (l) => l.actorName },
      { header: "Role", value: (l) => l.actorRole },
      { header: "Action", value: (l) => l.action },
      { header: "Entity", value: (l) => l.entity },
      { header: "Entity ID", value: (l) => l.entityId },
      { header: "Summary", value: (l) => l.summary },
      { header: "Channel", value: (l) => l.channel },
    ]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity & Audit Log"
        description="Every action taken in the system — who did it, in what role, and to which record."
        actions={
          <>
            <Button variant="outline" onClick={() => void load()} loading={refreshing}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Entries on record"
          value={logs?.length ?? 0}
          icon={History}
          loading={loading}
        />
        <StatCard
          label="Actions today"
          value={todayCount}
          icon={Activity}
          tone="accent"
          loading={loading}
        />
        <StatCard label="Distinct actors" value={actors} icon={UserCog} loading={loading} />
        <StatCard
          label="Showing"
          value={filtered.length}
          icon={ShieldCheck}
          tone="success"
          loading={loading}
        />
      </div>

      <Card>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search summary, actor, action or record ID…"
          resultCount={filtered.length}
          totalCount={logs?.length ?? 0}
          isFiltered={search !== "" || role !== "all" || entity !== "all" || day !== "all"}
          onReset={() => {
            setSearch("");
            setRole("all");
            setEntity("all");
            setDay("all");
          }}
          filters={[
            {
              id: "activity-role",
              label: "Role",
              value: role,
              onChange: setRole,
              options: [
                { value: "all", label: "All roles" },
                { value: "super_admin", label: "Super admin" },
                { value: "admin", label: "Admin" },
                { value: "security", label: "Security" },
                { value: "teacher", label: "Teacher" },
                { value: "student", label: "Student" },
                { value: "system", label: "System" },
              ],
              className: "min-w-[160px]",
            },
            {
              id: "activity-entity",
              label: "Record type",
              value: entity,
              onChange: setEntity,
              options: [
                { value: "all", label: "All records" },
                ...entities.map((e) => ({ value: e, label: e })),
              ],
              className: "min-w-[160px]",
            },
            {
              id: "activity-day",
              label: "Period",
              value: day,
              onChange: setDay,
              options: [
                { value: "all", label: "All time" },
                { value: "today", label: "Today" },
                { value: "week", label: "Last 7 days" },
              ],
              className: "min-w-[150px]",
            },
          ]}
        />

        {loading ? (
          <TableLoadingState rows={8} columns={4} />
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={History}
              title="No activity matches these filters"
              description="Clear the filters to see the full audit trail."
            />
          </div>
        ) : (
          <ol className="divide-y divide-border">
            {filtered.map((log) => (
              <li key={log.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start">
                <div className="sm:w-44 sm:shrink-0">
                  <p className="text-sm font-medium tabular-nums">{formatDateTime(log.at)}</p>
                  <p className="text-xs text-muted-foreground">{relativeTime(log.at)}</p>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm">{log.summary}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant={roleTone[log.actorRole] ?? "secondary"} size="sm">
                      {log.actorName}
                    </Badge>
                    <Badge variant="outline" size="sm">
                      {readableAction(log.action)}
                    </Badge>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {log.entity} · {log.entityId}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<InlineLoader label="Loading the audit trail…" />}>
      <ActivityView />
    </Suspense>
  );
}
