"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { FormField } from "@/components/shared/form-field";
import { useData } from "@/components/providers/data-provider";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import { GUARD_SHIFTS, GUARD_STATUSES } from "@/lib/types";
import type { SecurityGuard } from "@/lib/types";
import { todayISO } from "@/lib/utils";

/**
 * Add / edit a guard.
 *
 * The form mirrors `guardSchema` on the server but never decides anything: a
 * 422 comes back with per-field messages, which are painted onto the inputs
 * that caused them.
 */

type Draft = {
  fullName: string;
  employeeId: string;
  phone: string;
  email: string;
  shift: string;
  shiftStart: string;
  shiftEnd: string;
  assignedGate: string;
  status: string;
  joiningDate: string;
  emergencyContact: string;
  address: string;
};

const blank = (gate: string): Draft => ({
  fullName: "",
  employeeId: "",
  phone: "",
  email: "",
  shift: "Morning",
  shiftStart: "06:00",
  shiftEnd: "14:00",
  assignedGate: gate,
  status: "On Duty",
  joiningDate: todayISO(),
  emergencyContact: "",
  address: "",
});

const fromGuard = (guard: SecurityGuard): Draft => ({
  fullName: guard.fullName,
  employeeId: guard.employeeId,
  phone: guard.phone,
  email: guard.email,
  shift: guard.shift,
  shiftStart: guard.shiftStart,
  shiftEnd: guard.shiftEnd,
  assignedGate: guard.assignedGate,
  status: guard.status,
  joiningDate: guard.joiningDate,
  emergencyContact: guard.emergencyContact,
  address: guard.address,
});

export function GuardFormDialog({
  open,
  onOpenChange,
  guard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present for an edit, absent for a new guard. */
  guard?: SecurityGuard | null;
}) {
  const { db, run } = useData();

  const gates = React.useMemo(
    () => db.locations.filter((l) => l.kind === "Gate" && l.active).map((l) => l.name),
    [db.locations],
  );

  const [draft, setDraft] = React.useState<Draft>(() => blank(gates[0] ?? "Main Gate"));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  // Reload the draft whenever the dialog opens so a cancelled edit leaves nothing behind.
  React.useEffect(() => {
    if (!open) return;
    setDraft(guard ? fromGuard(guard) : blank(gates[0] ?? "Main Gate"));
    setErrors({});
  }, [open, guard, gates]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    const payload = { ...draft, fullName: draft.fullName.trim() };
    try {
      if (guard) {
        await run(() => api.updateGuard(guard.id, payload));
        toast.success("Guard record updated.", {
          description: `${payload.fullName} · ${payload.assignedGate}`,
        });
      } else {
        await run(() => api.createGuard(payload));
        toast.success("Guard added to the roster.", {
          description: `${payload.fullName} · ${payload.assignedGate}`,
        });
      }
      onOpenChange(false);
    } catch (error) {
      // A 422 paints the offending input; anything else is a single message.
      const details = fieldErrors(error);
      const message = errorMessage(error, "The guard record could not be saved.");
      setErrors(Object.keys(details).length ? details : { form: message });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{guard ? "Edit guard" : "Add security guard"}</DialogTitle>
          <DialogDescription>
            {guard
              ? "Update the roster record. Suspending a guard also ends any session they hold."
              : "Add a guard to the roster and post them to a gate."}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="guard-name" label="Full name" required error={errors.fullName}>
              <Input
                value={draft.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                autoComplete="off"
              />
            </FormField>

            <FormField id="guard-employee" label="Employee ID" required error={errors.employeeId}>
              <Input
                value={draft.employeeId}
                onChange={(e) => set("employeeId", e.target.value.toUpperCase())}
                placeholder="SEC-1042"
                autoComplete="off"
              />
            </FormField>

            <FormField id="guard-phone" label="Mobile number" required error={errors.phone}>
              <Input
                inputMode="numeric"
                value={draft.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="9876543210"
              />
            </FormField>

            <FormField id="guard-email" label="Email" error={errors.email}>
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </FormField>

            <FormField id="guard-shift" label="Shift" required error={errors.shift}>
              <Select value={draft.shift} onValueChange={(v) => set("shift", v)}>
                <SelectTrigger id="guard-shift">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GUARD_SHIFTS.map((shift) => (
                    <SelectItem key={shift} value={shift}>
                      {shift}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField id="guard-status" label="Status" required error={errors.status}>
              <Select value={draft.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger id="guard-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GUARD_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField id="guard-start" label="Shift start" required error={errors.shiftStart}>
              <Input
                type="time"
                value={draft.shiftStart}
                onChange={(e) => set("shiftStart", e.target.value)}
              />
            </FormField>

            <FormField id="guard-end" label="Shift end" required error={errors.shiftEnd}>
              <Input
                type="time"
                value={draft.shiftEnd}
                onChange={(e) => set("shiftEnd", e.target.value)}
              />
            </FormField>

            <FormField id="guard-gate" label="Assigned gate" required error={errors.assignedGate}>
              <Select value={draft.assignedGate} onValueChange={(v) => set("assignedGate", v)}>
                <SelectTrigger id="guard-gate">
                  <SelectValue placeholder="Select a gate" />
                </SelectTrigger>
                <SelectContent>
                  {gates.map((gate) => (
                    <SelectItem key={gate} value={gate}>
                      {gate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField id="guard-joining" label="Joining date" required error={errors.joiningDate}>
              <Input
                type="date"
                value={draft.joiningDate}
                onChange={(e) => set("joiningDate", e.target.value)}
              />
            </FormField>

            <FormField
              id="guard-emergency"
              label="Emergency contact"
              error={errors.emergencyContact}
            >
              <Input
                inputMode="numeric"
                value={draft.emergencyContact}
                onChange={(e) => set("emergencyContact", e.target.value)}
              />
            </FormField>
          </div>

          <FormField id="guard-address" label="Address" error={errors.address}>
            <Textarea
              rows={2}
              value={draft.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {guard ? "Save changes" : "Add guard"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
