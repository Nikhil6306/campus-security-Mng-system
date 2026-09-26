"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Car, LogOut, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { VehicleStatusBadge } from "@/components/shared/status-badge";
import { GateLookupPanel, InsideCampusTable } from "@/components/admin/gate-console";
import { useData } from "@/components/providers/data-provider";
import { useAction } from "@/components/providers/use-action";
import { api } from "@/lib/api";
import { getDashboardStats } from "@/lib/selectors";
import { durationBetween, formatClock, todayISO } from "@/lib/utils";

export default function SecurityCheckOutPage() {
  const { db, ready } = useData();
  const act = useAction();
  const stats = React.useMemo(() => getDashboardStats(db), [db]);
  const today = todayISO();

  const checkedOutToday = React.useMemo(
    () => db.visitRequests.filter((v) => (v.checkOutAt ?? "").slice(0, 10) === today).length,
    [db.visitRequests, today],
  );

  const vehiclesInside = React.useMemo(
    () =>
      db.vehicles
        .filter((v) => v.status === "Inside")
        .sort((a, b) => b.entryTime.localeCompare(a.entryTime)),
    [db.vehicles],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Visitor Check-Out</h1>
          <p className="text-sm text-muted-foreground">
            Close the visit on exit so the campus head count stays accurate.
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
          label="Inside now"
          value={stats.currentlyInside}
          hint={`${stats.headCountInside} people`}
          icon={Users}
          tone="accent"
          loading={!ready}
        />
        <StatCard
          label="Checked out today"
          value={checkedOutToday}
          icon={LogOut}
          tone="success"
          loading={!ready}
        />
        <StatCard
          label="Vehicles inside"
          value={vehiclesInside.length}
          icon={Car}
          tone="warning"
          loading={!ready}
        />
      </div>

      <Card>
        <SectionHeader
          title="Check a visitor out"
          description="Enter the booking ID printed on the pass"
        />
        <GateLookupPanel size="large" />
      </Card>

      <Card>
        <SectionHeader
          title="Currently inside campus"
          description="Check any visitor out directly from this list"
        />
        <InsideCampusTable />
      </Card>

      <Card>
        <SectionHeader
          title="Vehicles on campus"
          description="Record the exit when a vehicle leaves"
        />
        {vehiclesInside.length === 0 ? (
          <EmptyState
            icon={Car}
            title="No vehicles inside campus"
            description="Vehicles appear here once an entry is recorded at a gate."
          />
        ) : (
          <ul className="divide-y divide-border">
            {vehiclesInside.map((vehicle) => (
              <li key={vehicle.id} className="flex flex-wrap items-center gap-3 p-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/12 text-accent"
                  aria-hidden
                >
                  <Car className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm font-semibold">
                    {vehicle.vehicleNumber}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {vehicle.vehicleType} · {vehicle.visitorName} · entered{" "}
                    {formatClock(vehicle.entryTime)} ({durationBetween(vehicle.entryTime)} ago)
                  </p>
                </div>
                <VehicleStatusBadge status={vehicle.status} />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    void act(() => api.exitVehicle(vehicle.id), {
                      success: "Vehicle exit recorded.",
                      description: vehicle.vehicleNumber,
                      fallback: "Unable to record this exit. Please try again.",
                    });
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Record exit
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
