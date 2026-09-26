"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Car,
  DoorClosed,
  DoorOpen,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  ShieldCheck,
  Users,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { FormField } from "@/components/shared/form-field";
import { CardsLoadingState, EmptyState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useData } from "@/components/providers/data-provider";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import type { GateRosterRow } from "@/lib/api";
import type { CampusLocation } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

/**
 * Campus gate management.
 *
 * Each card shows the gate, who is posted to it and the traffic it has handled
 * today. Those counts are computed by the server from `check_logs`, not stored
 * on the gate, so they always agree with the movement history.
 */

function GateDialog({
  open,
  onOpenChange,
  gate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gate?: CampusLocation | null;
}) {
  const { run } = useData();
  const [name, setName] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(gate?.name ?? "");
    setActive(gate?.active ?? true);
    setErrors({});
  }, [open, gate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    const payload = { name: name.trim(), active };
    try {
      if (gate) {
        await run(() => api.updateGate(gate.id, payload));
        toast.success("Gate updated.", { description: payload.name });
      } else {
        await run(() => api.createGate(payload));
        toast.success("Gate added.", { description: payload.name });
      }
      onOpenChange(false);
    } catch (error) {
      const details = fieldErrors(error);
      const message = errorMessage(error, "The gate could not be saved.");
      setErrors(Object.keys(details).length ? details : { form: message });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{gate ? "Edit gate" : "Add campus gate"}</DialogTitle>
          <DialogDescription>
            {gate
              ? "Renaming a gate moves the guards posted to it and keeps their history attached."
              : "Add an entry point that guards can be posted to."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {errors.form ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {errors.form}
            </div>
          ) : null}

          <FormField id="gate-name" label="Gate name" required error={errors.name}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Main Gate"
              autoComplete="off"
            />
          </FormField>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="gate-active">Gate open</Label>
              <p className="text-xs text-muted-foreground">
                A closed gate cannot have guards posted to it.
              </p>
            </div>
            <Switch id="gate-active" checked={active} onCheckedChange={setActive} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {gate ? "Save changes" : "Add gate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({
  open,
  onOpenChange,
  row,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: GateRosterRow | null;
}) {
  const { db, run } = useData();
  const [guardId, setGuardId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Guards already posted here have nothing to change.
  const candidates = React.useMemo(
    () => db.guards.filter((g) => g.assignedGate !== row?.location.name),
    [db.guards, row],
  );

  React.useEffect(() => {
    if (open) setGuardId("");
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!row || !guardId) return;
    setSaving(true);
    try {
      await run(() => api.assignGuardToGate(row.location.id, guardId));
      const guard = db.guards.find((g) => g.id === guardId);
      toast.success("Guard posted.", {
        description: `${guard?.fullName ?? "Guard"} → ${row.location.name}`,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, "The guard could not be posted to this gate."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post a guard to {row?.location.name}</DialogTitle>
          <DialogDescription>
            The guard&apos;s sign-in account moves with them, so their gate console opens on this
            gate.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <FormField id="assign-guard" label="Guard" required>
            <Select value={guardId} onValueChange={setGuardId}>
              <SelectTrigger id="assign-guard">
                <SelectValue placeholder="Select a guard" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((guard) => (
                  <SelectItem key={guard.id} value={guard.id}>
                    {guard.fullName} — currently {guard.assignedGate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Every guard on the roster is already posted to this gate.
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={!guardId}>
              Post guard
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function GatesPage() {
  const { db, ready, run } = useData();

  const [rows, setRows] = React.useState<GateRosterRow[] | null>(null);
  const [editing, setEditing] = React.useState<CampusLocation | null>(null);
  const [gateDialog, setGateDialog] = React.useState(false);
  const [assigning, setAssigning] = React.useState<GateRosterRow | null>(null);
  const [deleting, setDeleting] = React.useState<CampusLocation | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    api
      .gates()
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

  const loading = !ready || rows === null;
  const openGates = rows?.filter((r) => r.location.active).length ?? 0;
  const insideNow = rows?.reduce((sum, r) => sum + r.activity.currentlyInside, 0) ?? 0;
  const entriesToday = rows?.reduce((sum, r) => sum + r.activity.entriesToday, 0) ?? 0;
  const postedGuards = rows?.reduce((sum, r) => sum + r.guards.length, 0) ?? 0;

  async function confirmDelete() {
    if (!deleting) return;
    const gate = deleting;
    setDeleting(null);
    try {
      await run(() => api.deleteGate(gate.id));
      toast.success("Gate deleted.", { description: gate.name });
    } catch (error) {
      toast.error(errorMessage(error, "That gate could not be deleted."));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Gates"
        description="Entry points, the guards posted to them, and today's traffic through each."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setGateDialog(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add gate
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gates open" value={openGates} icon={DoorOpen} loading={loading} />
        <StatCard
          label="Guards posted"
          value={postedGuards}
          icon={ShieldCheck}
          tone="accent"
          href="/admin/guards"
          loading={loading}
        />
        <StatCard
          label="Entries today"
          value={entriesToday}
          icon={LogIn}
          tone="success"
          loading={loading}
        />
        <StatCard label="Inside campus" value={insideNow} icon={Users} loading={loading} />
      </div>

      {loading ? (
        <CardsLoadingState count={4} />
      ) : rows.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            icon={DoorOpen}
            title="No gates configured"
            description="Add a campus gate so guards can be posted and movements recorded."
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setGateDialog(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add gate
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {rows.map((row) => (
            <Card key={row.location.id}>
              <SectionHeader
                title={row.location.name}
                description={
                  row.activity.lastActivityAt
                    ? `Last movement ${formatDateTime(row.activity.lastActivityAt)}`
                    : "No movements recorded yet"
                }
                actions={
                  <>
                    <Badge variant={row.location.active ? "success" : "muted"}>
                      {row.location.active ? (
                        <>
                          <DoorOpen aria-hidden /> Open
                        </>
                      ) : (
                        <>
                          <DoorClosed aria-hidden /> Closed
                        </>
                      )}
                    </Badge>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Edit ${row.location.name}`}
                      onClick={() => {
                        setEditing(row.location);
                        setGateDialog(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </>
                }
              />

              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
                {[
                  { label: "Entries", value: row.activity.entriesToday, icon: LogIn },
                  { label: "Exits", value: row.activity.exitsToday, icon: LogOut },
                  { label: "Inside", value: row.activity.currentlyInside, icon: Users },
                  { label: "Vehicles", value: row.activity.vehiclesInside, icon: Car },
                  { label: "Incidents", value: row.activity.openIncidents, icon: AlertTriangle },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-md border border-border p-3 text-center"
                  >
                    <stat.icon
                      className="mx-auto h-4 w-4 text-muted-foreground"
                      aria-hidden
                    />
                    <p className="mt-1 text-lg font-semibold tabular-nums">{stat.value}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Guards posted ({row.guards.length})
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => setAssigning(row)}>
                    <UserPlus className="h-3.5 w-3.5" />
                    Post guard
                  </Button>
                </div>

                {row.guards.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No guard is posted to this gate.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {row.guards.map((guard) => (
                      <li
                        key={guard.id}
                        className="flex items-center gap-3 rounded-md border border-border p-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/admin/guards/${guard.id}`}
                            className="block truncate text-sm font-medium hover:underline"
                          >
                            {guard.fullName}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {guard.shift} · {guard.shiftStart}–{guard.shiftEnd}
                          </p>
                        </div>
                        <Badge
                          variant={
                            guard.status === "On Duty" || guard.status === "Active"
                              ? "success"
                              : "muted"
                          }
                          size="sm"
                        >
                          {guard.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end border-t border-border p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleting(row.location)}
                >
                  Delete gate
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <GateDialog open={gateDialog} onOpenChange={setGateDialog} gate={editing} />
      <AssignDialog
        open={assigning !== null}
        onOpenChange={(open) => !open && setAssigning(null)}
        row={assigning}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "this gate"}?`}
        description="A gate with movement history on record cannot be deleted — close it instead so the audit trail stays intact."
        confirmLabel="Delete gate"
        tone="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
