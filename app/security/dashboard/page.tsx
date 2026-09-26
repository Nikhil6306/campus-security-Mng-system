"use client";

import * as React from "react";
import {
  AlertTriangle,
  Car,
  CarFront,
  Clock,
  LogIn,
  LogOut,
  ScanLine,
  ShieldAlert,
  Users,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { ActionTile } from "@/components/security/action-tile";
import { GateLookupPanel, InsideCampusTable, ScanPanel } from "@/components/admin/gate-console";
import { AddVehicleDialog } from "@/components/admin/add-vehicle-dialog";
import { EmergencyPanel } from "@/components/admin/emergency-panel";
import { useData } from "@/components/providers/data-provider";
import { getDashboardStats } from "@/lib/selectors";
import { formatTime, todayISO } from "@/lib/utils";

export default function SecurityDashboardPage() {
  const { db, ready } = useData();
  const stats = React.useMemo(() => getDashboardStats(db), [db]);
  const today = todayISO();

  const [scanOpen, setScanOpen] = React.useState(false);
  const [vehicleOpen, setVehicleOpen] = React.useState(false);
  const [emergencyOpen, setEmergencyOpen] = React.useState(false);
  const lookupRef = React.useRef<HTMLDivElement>(null);

  const expectedToday = React.useMemo(
    () =>
      db.visitRequests
        .filter((v) => v.visitDate === today && v.status === "Approved")
        .sort((a, b) => a.visitTime.localeCompare(b.visitTime)),
    [db.visitRequests, today],
  );

  const focusLookup = () => {
    lookupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      document.getElementById("gate-booking-id")?.focus();
    }, 320);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Gate Console</h1>
        <p className="text-sm text-muted-foreground">
          Verify a pass, record movement and raise an alert — all from this screen.
        </p>
      </div>

      {/* --------------------------- Live figures --------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Inside campus"
          value={stats.currentlyInside}
          hint={`${stats.headCountInside} people`}
          icon={Users}
          tone="accent"
          loading={!ready}
        />
        <StatCard
          label="Expected today"
          value={expectedToday.length}
          hint="Approved, not yet arrived"
          icon={Clock}
          loading={!ready}
        />
        <StatCard
          label="Vehicles inside"
          value={stats.vehiclesInside}
          icon={Car}
          tone="accent"
          loading={!ready}
        />
        <StatCard
          label="Active alerts"
          value={stats.securityAlerts}
          icon={AlertTriangle}
          tone={stats.securityAlerts > 0 ? "destructive" : "success"}
          loading={!ready}
        />
      </div>

      {/* ----------------------------- Big tiles ---------------------------- */}
      <section aria-label="Gate actions" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ActionTile
          label="SCAN PASS"
          description="Open the pass scanner"
          icon={ScanLine}
          onClick={() => setScanOpen(true)}
        />
        <ActionTile
          label="CHECK-IN"
          description="Admit an approved visitor"
          icon={LogIn}
          tone="success"
          href="/security/check-in"
          count={expectedToday.length}
        />
        <ActionTile
          label="CHECK-OUT"
          description="Close a visit on exit"
          icon={LogOut}
          tone="accent"
          href="/security/check-out"
          count={stats.currentlyInside}
        />
        <ActionTile
          label="VISITORS INSIDE"
          description="Who is on campus right now"
          icon={Users}
          count={stats.currentlyInside}
          onClick={() =>
            document
              .getElementById("inside-campus")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />
        <ActionTile
          label="VEHICLE ENTRY"
          description="Record a vehicle at the gate"
          icon={CarFront}
          tone="warning"
          onClick={() => setVehicleOpen(true)}
        />
        <ActionTile
          label="EMERGENCY"
          description="Raise a demo emergency alert"
          icon={ShieldAlert}
          tone="destructive"
          onClick={() => setEmergencyOpen(true)}
        />
      </section>

      {/* --------------------------- Quick verify --------------------------- */}
      <Card ref={lookupRef}>
        <SectionHeader
          title="Quick pass verification"
          description="Enter the booking ID from the visitor pass"
        />
        <GateLookupPanel size="large" />
      </Card>

      {/* ---------------------------- Inside now ---------------------------- */}
      <Card id="inside-campus">
        <SectionHeader
          title="Currently inside campus"
          description={`${stats.currentlyInside} active visit${stats.currentlyInside === 1 ? "" : "s"}`}
        />
        <InsideCampusTable />
      </Card>

      {/* -------------------------- Expected today -------------------------- */}
      <Card>
        <SectionHeader title="Expected today" description="Approved visits awaiting arrival" />
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
                    {record.hostName} · {record.department}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {record.id}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ------------------------------ Dialogs ----------------------------- */}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Scan visitor pass</DialogTitle>
            <DialogDescription>
              Point the scanner at the QR code printed on the visitor pass.
            </DialogDescription>
          </DialogHeader>
          <ScanPanel
            onUseManual={() => {
              setScanOpen(false);
              focusLookup();
            }}
          />
        </DialogContent>
      </Dialog>

      <AddVehicleDialog open={vehicleOpen} onOpenChange={setVehicleOpen} />

      <Dialog open={emergencyOpen} onOpenChange={setEmergencyOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Raise an emergency alert</DialogTitle>
            <DialogDescription>
              Demonstration only — no emergency service is contacted. You will be asked to confirm
              the location before the alert is recorded.
            </DialogDescription>
          </DialogHeader>
          <EmergencyPanel size="large" onTriggered={() => setEmergencyOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
