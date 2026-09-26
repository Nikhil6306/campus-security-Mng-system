"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarCheck, Clock, LogIn, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { GateLookupPanel, ScanPanel } from "@/components/admin/gate-console";
import { useData } from "@/components/providers/data-provider";
import { getDashboardStats } from "@/lib/selectors";
import { formatTime, todayISO } from "@/lib/utils";

export default function SecurityCheckInPage() {
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

  const checkedInToday = React.useMemo(
    () => db.visitRequests.filter((v) => (v.checkInAt ?? "").slice(0, 10) === today).length,
    [db.visitRequests, today],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Visitor Check-In</h1>
          <p className="text-sm text-muted-foreground">
            Verify the pass, confirm the visitor&rsquo;s details, then admit them.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/security/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Back to console
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Expected today"
          value={expectedToday.length}
          hint="Approved, awaiting arrival"
          icon={CalendarCheck}
          loading={!ready}
        />
        <StatCard
          label="Checked in today"
          value={checkedInToday}
          icon={LogIn}
          tone="success"
          loading={!ready}
        />
        <StatCard
          label="Inside now"
          value={stats.currentlyInside}
          hint={`${stats.headCountInside} people`}
          icon={Users}
          tone="accent"
          loading={!ready}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div className="min-w-0 space-y-6">
          <Card ref={lookupRef}>
            <SectionHeader
              title="Verify and admit"
              description="Only approved bookings can be checked in"
            />
            <GateLookupPanel size="large" />
          </Card>

          <Card>
            <SectionHeader
              title="Expected today"
              description="Tap a booking ID to copy it into the lookup"
            />
            {expectedToday.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No approved visits pending arrival"
                description="Approved bookings scheduled for today will be listed here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {expectedToday.map((record) => (
                  <li key={record.id} className="flex items-center gap-4 p-4">
                    <span className="w-[72px] shrink-0 text-base font-semibold tabular-nums">
                      {formatTime(record.visitTime)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{record.fullName}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {record.hostName} · {record.numberOfVisitors} visitor
                        {record.numberOfVisitors === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        const input = document.getElementById(
                          "gate-booking-id",
                        ) as HTMLInputElement | null;
                        if (!input) return;
                        // Drive the controlled input through its React setter.
                        const setter = Object.getOwnPropertyDescriptor(
                          window.HTMLInputElement.prototype,
                          "value",
                        )?.set;
                        setter?.call(input, record.id);
                        input.dispatchEvent(new Event("input", { bubbles: true }));
                        lookupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                        input.focus();
                      }}
                    >
                      Use ID
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <SectionHeader title="Scan Visitor Pass" />
          <ScanPanel
            onUseManual={() => {
              lookupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              document.getElementById("gate-booking-id")?.focus();
            }}
          />
        </Card>
      </div>
    </div>
  );
}
