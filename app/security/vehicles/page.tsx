"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Car, LogOut, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { CardsLoadingState, EmptyState } from "@/components/shared/states";
import { VehicleStatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AddVehicleDialog } from "@/components/admin/add-vehicle-dialog";
import { useData } from "@/components/providers/data-provider";
import { useAction } from "@/components/providers/use-action";
import { api } from "@/lib/api";
import type { Vehicle } from "@/lib/types";
import { formatDateTime, todayISO } from "@/lib/utils";

/**
 * Gate vehicle register.
 *
 * Optimised for the barrier: a big search box for the number plate, and one
 * button to stamp a vehicle out. The uniqueness rule that stops the same plate
 * being recorded inside twice lives in the database, not here.
 */
export default function SecurityVehiclesPage() {
  const { db, ready } = useData();
  const act = useAction();

  const [search, setSearch] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [exiting, setExiting] = React.useState<Vehicle | null>(null);

  const today = todayISO();
  const inside = React.useMemo(
    () => db.vehicles.filter((v) => v.status === "Inside"),
    [db.vehicles],
  );

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase().replace(/[\s-]/g, "");
    const pool = [...db.vehicles].sort((a, b) => (a.entryTime < b.entryTime ? 1 : -1));
    if (!query) return pool.filter((v) => v.status === "Inside");
    return pool.filter((v) =>
      [v.vehicleNumber, v.visitorName, v.driverName, v.gate]
        .join(" ")
        .toLowerCase()
        .replace(/[\s-]/g, "")
        .includes(query),
    );
  }, [db.vehicles, search]);

  const entriesToday = db.vehicles.filter((v) => v.entryTime.slice(0, 10) === today).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Vehicles</h1>
          <p className="text-sm text-muted-foreground">
            Record a vehicle entering, or stamp one out as it leaves.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/security/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Console
            </Link>
          </Button>
          <Button size="lg" onClick={() => setAdding(true)}>
            <Plus className="h-5 w-5" />
            Vehicle entry
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Inside campus" value={inside.length} icon={Car} tone="accent" loading={!ready} />
        <StatCard label="Entries today" value={entriesToday} icon={Car} loading={!ready} />
        <StatCard
          label="Exited today"
          value={db.vehicles.filter((v) => (v.exitTime ?? "").slice(0, 10) === today).length}
          icon={LogOut}
          tone="success"
          loading={!ready}
        />
      </div>

      <Card>
        <SectionHeader
          title={search ? "Search results" : "Vehicles currently inside"}
          description={
            search ? "Matching any vehicle on record" : "Search to include vehicles that have left"
          }
        />

        <div className="border-b border-border p-4">
          <label htmlFor="vehicle-search" className="sr-only">
            Search by number plate
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="vehicle-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="UK08 AB 1234"
              autoComplete="off"
              spellCheck={false}
              className="h-14 pl-11 text-lg font-mono uppercase placeholder:font-sans placeholder:normal-case"
            />
          </div>
        </div>

        {!ready ? (
          <div className="p-4">
            <CardsLoadingState count={4} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Car}
              title={search ? "No vehicle matches that search" : "No vehicles inside campus"}
              description={
                search
                  ? "Check the number plate and try again."
                  : "Record a vehicle as it arrives at the barrier."
              }
              action={
                <Button onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" />
                  Vehicle entry
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.slice(0, 50).map((vehicle) => (
              <li key={vehicle.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-lg font-semibold tracking-wide">
                    {vehicle.vehicleNumber}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {vehicle.vehicleType}
                    {vehicle.visitorName ? ` · ${vehicle.visitorName}` : ""}
                    {vehicle.driverName ? ` · driver ${vehicle.driverName}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    In {formatDateTime(vehicle.entryTime)} at {vehicle.gate}
                    {vehicle.exitTime ? ` · out ${formatDateTime(vehicle.exitTime)}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <VehicleStatusBadge status={vehicle.status} />
                  {vehicle.status === "Inside" ? (
                    <Button size="lg" variant="secondary" onClick={() => setExiting(vehicle)}>
                      <LogOut className="h-4 w-4" />
                      Exit
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AddVehicleDialog open={adding} onOpenChange={setAdding} />

      <ConfirmDialog
        open={exiting !== null}
        onOpenChange={(open) => !open && setExiting(null)}
        title={`Record ${exiting?.vehicleNumber ?? "this vehicle"} leaving?`}
        description="The exit time is stamped now and the vehicle is removed from the inside count."
        confirmLabel="Record exit"
        onConfirm={() => {
          const vehicle = exiting;
          setExiting(null);
          if (!vehicle) return;
          void act(() => api.exitVehicle(vehicle.id), {
            success: "Vehicle exit recorded.",
            description: vehicle.vehicleNumber,
            fallback: "That vehicle could not be stamped out.",
          });
        }}
      />
    </div>
  );
}
