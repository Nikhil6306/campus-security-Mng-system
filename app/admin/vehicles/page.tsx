"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Car,
  CarFront,
  Download,
  Eye,
  LogIn,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrap,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toaster";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState, InlineLoader, TableLoadingState } from "@/components/shared/states";
import { VehicleStatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DetailRow } from "@/components/shared/form-field";
import { FilterBar } from "@/components/admin/filter-bar";
import { AddVehicleDialog } from "@/components/admin/add-vehicle-dialog";
import { useData } from "@/components/providers/data-provider";
import { useAction } from "@/components/providers/use-action";
import { api } from "@/lib/api";
import { downloadCsv, stampedFilename } from "@/lib/export";
import { VEHICLE_TYPES, type Vehicle } from "@/lib/types";
import { durationBetween, formatDateTime } from "@/lib/utils";

function VehiclesView() {
  const params = useSearchParams();
  const { db, ready } = useData();
  const act = useAction();

  const [search, setSearch] = React.useState(params.get("q") ?? "");
  const [status, setStatus] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [addOpen, setAddOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Vehicle | null>(null);
  const [viewTarget, setViewTarget] = React.useState<Vehicle | null>(null);
  const [exitTarget, setExitTarget] = React.useState<Vehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Vehicle | null>(null);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return db.vehicles
      .filter((vehicle) => {
        if (status !== "all" && vehicle.status !== status) return false;
        if (type !== "all" && vehicle.vehicleType !== type) return false;
        if (!query) return true;
        return [vehicle.vehicleNumber, vehicle.visitorName, vehicle.driverName, vehicle.purpose]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => b.entryTime.localeCompare(a.entryTime));
  }, [db.vehicles, search, status, type]);

  const inside = db.vehicles.filter((v) => v.status === "Inside").length;
  const todayEntries = db.vehicles.filter(
    (v) => v.entryTime.slice(0, 10) === new Date().toISOString().slice(0, 10),
  ).length;

  const isFiltered = search !== "" || status !== "all" || type !== "all";

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error("Nothing to export with the current filters.");
      return;
    }
    downloadCsv(stampedFilename("vehicle-register"), filtered, [
      { header: "Vehicle ID", value: (v) => v.id },
      { header: "Vehicle number", value: (v) => v.vehicleNumber },
      { header: "Type", value: (v) => v.vehicleType },
      { header: "Visitor", value: (v) => v.visitorName },
      { header: "Driver", value: (v) => v.driverName },
      { header: "Purpose", value: (v) => v.purpose },
      { header: "Gate", value: (v) => v.gate },
      { header: "Entry time", value: (v) => v.entryTime },
      { header: "Exit time", value: (v) => v.exitTime ?? "" },
      { header: "Status", value: (v) => v.status },
      { header: "Linked booking", value: (v) => v.linkedVisitId ?? "" },
    ]);
    toast.success("Vehicle register exported.", {
      description: `${filtered.length} record${filtered.length === 1 ? "" : "s"} downloaded as CSV.`,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicles"
        description="Vehicle movement across campus gates, including entries linked to visitor bookings."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Record vehicle entry
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Vehicles inside" value={inside} icon={Car} tone="accent" loading={!ready} />
        <StatCard label="Entries today" value={todayEntries} icon={TrendingUp} loading={!ready} />
        <StatCard
          label="Exited"
          value={db.vehicles.filter((v) => v.status === "Exited").length}
          icon={LogOut}
          tone="success"
          loading={!ready}
        />
        <StatCard label="Total records" value={db.vehicles.length} icon={CarFront} loading={!ready} />
      </div>

      <Card>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search vehicle number, visitor or driver…"
          resultCount={filtered.length}
          totalCount={db.vehicles.length}
          isFiltered={isFiltered}
          onReset={() => {
            setSearch("");
            setStatus("all");
            setType("all");
          }}
          filters={[
            {
              id: "vehicle-status-filter",
              label: "Status",
              value: status,
              onChange: setStatus,
              options: [
                { value: "all", label: "All statuses" },
                { value: "Inside", label: "Inside" },
                { value: "Exited", label: "Exited" },
              ],
            },
            {
              id: "vehicle-type-filter",
              label: "Type",
              value: type,
              onChange: setType,
              options: [
                { value: "all", label: "All types" },
                ...VEHICLE_TYPES.map((t) => ({ value: t, label: t })),
              ],
            },
          ]}
        />

        {!ready ? (
          <TableLoadingState rows={5} columns={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Car}
            title={isFiltered ? "No vehicles match these filters" : "No vehicle records"}
            description={
              isFiltered
                ? "Clear the filters to see all vehicle movement."
                : "Record a vehicle entry to start the gate register."
            }
            action={
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                Record vehicle entry
              </Button>
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[140px]">Vehicle</TableHead>
                  <TableHead className="min-w-[160px]">Visitor</TableHead>
                  <TableHead className="min-w-[140px]">Driver</TableHead>
                  <TableHead className="min-w-[180px]">Purpose</TableHead>
                  <TableHead className="min-w-[150px]">Entry</TableHead>
                  <TableHead className="min-w-[150px]">Exit</TableHead>
                  <TableHead className="min-w-[110px]">Status</TableHead>
                  <TableHead className="min-w-[120px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      <p className="font-mono text-sm font-semibold">{vehicle.vehicleNumber}</p>
                      <p className="text-xs text-muted-foreground">{vehicle.vehicleType}</p>
                    </TableCell>
                    <TableCell>
                      <p className="truncate text-sm">{vehicle.visitorName}</p>
                      {vehicle.linkedVisitId ? (
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                          {vehicle.linkedVisitId}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{vehicle.driverName}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                      {vehicle.purpose}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(vehicle.entryTime)}
                      <span className="block text-xs text-muted-foreground">{vehicle.gate}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {vehicle.exitTime ? (
                        <>
                          {formatDateTime(vehicle.exitTime)}
                          <span className="block text-xs text-muted-foreground">
                            {durationBetween(vehicle.entryTime, vehicle.exitTime)} on campus
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          — <span className="block text-xs">{durationBetween(vehicle.entryTime)} so far</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <VehicleStatusBadge status={vehicle.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {vehicle.status === "Inside" ? (
                          <Button
                            size="xs"
                            variant="secondary"
                            onClick={() => setExitTarget(vehicle)}
                          >
                            <LogOut className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Exit</span>
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => {
                              void act(() => api.reEnterVehicle(vehicle.id), {
                                success: "Vehicle re-admitted.",
                                description: vehicle.vehicleNumber,
                                fallback: "Unable to re-admit this vehicle. Please try again.",
                              });
                            }}
                          >
                            <LogIn className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Re-enter</span>
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`More actions for ${vehicle.vehicleNumber}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setViewTarget(vehicle)}>
                              <Eye />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setEditTarget(vehicle)}>
                              <Pencil />
                              Edit record
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              destructive
                              onSelect={() => setDeleteTarget(vehicle)}
                            >
                              <Trash2 />
                              Delete record
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <AddVehicleDialog open={addOpen} onOpenChange={setAddOpen} />

      <AddVehicleDialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => !open && setEditTarget(null)}
        vehicle={editTarget}
      />

      <Dialog open={Boolean(viewTarget)} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono">{viewTarget?.vehicleNumber}</DialogTitle>
            <DialogDescription>
              {viewTarget?.vehicleType} · {viewTarget?.id}
            </DialogDescription>
          </DialogHeader>
          {viewTarget ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Visitor" value={viewTarget.visitorName} />
              <DetailRow label="Driver" value={viewTarget.driverName} />
              <DetailRow label="Purpose" value={viewTarget.purpose} className="sm:col-span-2" />
              <DetailRow label="Gate" value={viewTarget.gate} />
              <DetailRow label="Status" value={viewTarget.status} />
              <DetailRow label="Entry time" value={formatDateTime(viewTarget.entryTime)} />
              <DetailRow
                label="Exit time"
                value={viewTarget.exitTime ? formatDateTime(viewTarget.exitTime) : "Still inside"}
              />
              <DetailRow
                label="Time on campus"
                value={durationBetween(viewTarget.entryTime, viewTarget.exitTime)}
              />
              <DetailRow
                label="Linked booking"
                value={viewTarget.linkedVisitId ?? "—"}
                mono={Boolean(viewTarget.linkedVisitId)}
              />
            </dl>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setEditTarget(viewTarget);
                setViewTarget(null);
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete vehicle record?"
        description={
          deleteTarget
            ? `${deleteTarget.vehicleNumber} will be permanently removed from the gate register.`
            : undefined
        }
        confirmLabel="Delete record"
        tone="destructive"
        onConfirm={() => {
          if (!deleteTarget) return;
          void act(() => api.deleteVehicle(deleteTarget.id), {
            success: "Vehicle record deleted.",
            description: deleteTarget.vehicleNumber,
            fallback: "Unable to delete this record. Please try again.",
          });
          setDeleteTarget(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(exitTarget)}
        onOpenChange={(open) => !open && setExitTarget(null)}
        title="Record vehicle exit"
        description={
          exitTarget
            ? `${exitTarget.vehicleNumber} will be marked as exited and the exit time stamped now.`
            : undefined
        }
        confirmLabel="Record exit"
        onConfirm={() => {
          if (!exitTarget) return;
          void act(() => api.exitVehicle(exitTarget.id), {
            success: "Vehicle exit recorded.",
            description: exitTarget.vehicleNumber,
            fallback: "Unable to record this exit. Please try again.",
          });
          setExitTarget(null);
        }}
      />
    </div>
  );
}

export default function VehiclesPage() {
  return (
    <Suspense fallback={<InlineLoader label="Loading vehicles…" />}>
      <VehiclesView />
    </Suspense>
  );
}
