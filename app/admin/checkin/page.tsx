"use client";

import * as React from "react";
import { CalendarCheck, Clock, LogIn, LogOut, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  GateLookupPanel,
  InsideCampusTable,
  ScanPanel,
} from "@/components/admin/gate-console";
import { useData } from "@/components/providers/data-provider";
import { getDashboardStats } from "@/lib/selectors";
import { formatClock, formatTime, todayISO } from "@/lib/utils";

export default function CheckInPage() {
  const { db, ready } = useData();
  const stats = React.useMemo(() => getDashboardStats(db), [db]);
  const today = todayISO();
  const lookupRef = React.useRef<HTMLDivElement>(null);

  const expectedToday = React.useMemo(
    () =>
      db.visitRequests
        .filter((v) => v.visitDate === today && v.status === "Approved")
        .sort((a, b) => a.visitTime.localeCompare(b.visitTime)),
    [db.visitRequests, today],
  );

  const recentMovements = React.useMemo(
    () =>
      db.visitRequests
        .filter((v) => v.checkInAt || v.checkOutAt)
        .sort((a, b) =>
          (b.checkOutAt ?? b.checkInAt ?? "").localeCompare(a.checkOutAt ?? a.checkInAt ?? ""),
        )
        .slice(0, 6),
    [db.visitRequests],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check-In / Check-Out"
        description="Verify a visitor pass at the gate, record entry and close the visit on exit."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Currently inside"
          value={stats.currentlyInside}
          hint={`${stats.headCountInside} people`}
          icon={Users}
          tone="accent"
          loading={!ready}
        />
        <StatCard
          label="Expected today"
          value={expectedToday.length}
          hint="Approved, awaiting arrival"
          icon={CalendarCheck}
          loading={!ready}
        />
        <StatCard
          label="Checked out today"
          value={stats.checkedOutToday}
          icon={LogOut}
          tone="success"
          loading={!ready}
        />
        <StatCard
          label="Pending approvals"
          value={stats.pendingRequests}
          hint="Not permitted at the gate"
          icon={Clock}
          tone="warning"
          href="/admin/requests"
          loading={!ready}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="min-w-0 space-y-6">
          <Card ref={lookupRef}>
            <SectionHeader
              title="Verify a visitor pass"
              description="Look the booking up, confirm the details, then record the movement."
            />
            <GateLookupPanel />
          </Card>

          <Card>
            <SectionHeader
              title="Currently Inside Campus"
              description={`${stats.currentlyInside} active visit${stats.currentlyInside === 1 ? "" : "s"}`}
            />
            <InsideCampusTable />
          </Card>

          <Card>
            <SectionHeader title="Recent gate movements" description="Latest entries and exits" />
            {recentMovements.length === 0 ? (
              <EmptyState
                icon={LogIn}
                title="No gate movements recorded"
                description="Check-ins and check-outs will be listed here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {recentMovements.map((record) => (
                  <li key={record.id} className="flex items-center gap-3 p-4">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                        record.checkOutAt
                          ? "bg-muted text-muted-foreground"
                          : "bg-accent/12 text-accent"
                      }`}
                      aria-hidden
                    >
                      {record.checkOutAt ? (
                        <LogOut className="h-4 w-4" />
                      ) : (
                        <LogIn className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{record.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {record.checkOutAt
                          ? `Checked out ${formatClock(record.checkOutAt)}`
                          : `Checked in ${formatClock(record.checkInAt)}`}{" "}
                        · {record.gate ?? "Main Gate"}
                      </p>
                    </div>
                    <StatusBadge status={record.status} showIcon={false} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <SectionHeader title="Scan Visitor Pass" />
            <ScanPanel
              onUseManual={() =>
                lookupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            />
          </Card>

          <Card>
            <SectionHeader
              title="Expected today"
              description="Approved visits awaiting arrival"
            />
            {expectedToday.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No approved visits pending arrival"
                description="Approved bookings for today will be listed here."
                className="py-10"
              />
            ) : (
              <ul className="divide-y divide-border">
                {expectedToday.map((record) => (
                  <li key={record.id} className="flex items-center gap-3 p-4">
                    <span className="w-[62px] shrink-0 text-sm font-semibold tabular-nums">
                      {formatTime(record.visitTime)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{record.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{record.hostName}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {record.id.split("-").pop()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
