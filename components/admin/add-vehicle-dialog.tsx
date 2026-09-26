"use client";

import * as React from "react";
import { Plus, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { getGates } from "@/lib/selectors";
import { VEHICLE_TYPES, type Vehicle } from "@/lib/types";
import {
  normaliseVehicleNumber,
  validateName,
  validateText,
  validateVehicleNumber,
  type FieldErrors,
} from "@/lib/validation";

type Fields = "vehicleNumber" | "visitorName" | "driverName" | "purpose" | "form";

const emptyForm = {
  vehicleNumber: "",
  vehicleType: "Car" as Vehicle["vehicleType"],
  visitorName: "",
  driverName: "",
  purpose: "",
  gate: "",
};

/**
 * Records a vehicle entering campus, or edits an existing record when a
 * `vehicle` is supplied. Shared by the admin console and the gate desk.
 */
export function AddVehicleDialog({
  open,
  onOpenChange,
  defaultGate,
  vehicle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultGate?: string;
  vehicle?: Vehicle | null;
}) {
  const { run, db } = useData();
  const gates = React.useMemo(() => getGates(db), [db]);
  const [form, setForm] = React.useState(emptyForm);
  const [errors, setErrors] = React.useState<FieldErrors<Fields>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const editing = Boolean(vehicle);

  React.useEffect(() => {
    if (!open) return;
    if (vehicle) {
      setForm({
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.vehicleType,
        visitorName: vehicle.visitorName,
        driverName: vehicle.driverName,
        purpose: vehicle.purpose,
        gate: vehicle.gate,
      });
    } else {
      setForm({ ...emptyForm, gate: defaultGate ?? gates[0] });
    }
    setErrors({});
  }, [open, defaultGate, vehicle, gates]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: FieldErrors<Fields> = {
      vehicleNumber: validateVehicleNumber(form.vehicleNumber),
      visitorName: validateName(form.visitorName),
      driverName: validateName(form.driverName),
      purpose: validateText(form.purpose, "Purpose", 3, 120),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const payload = {
      vehicleNumber: normaliseVehicleNumber(form.vehicleNumber),
      vehicleType: form.vehicleType,
      visitorName: form.visitorName.trim(),
      driverName: form.driverName.trim(),
      purpose: form.purpose.trim(),
      gate: form.gate,
    };

    setSubmitting(true);
    try {
      if (vehicle) {
        await run(() => api.updateVehicle(vehicle.id, payload));
        toast.success("Vehicle record updated.", { description: payload.vehicleNumber });
      } else {
        const created = await run(() => api.createVehicle(payload));
        toast.success("Vehicle entry recorded.", {
          description: `${created.vehicleNumber} at ${created.gate}.`,
        });
      }
      onOpenChange(false);
    } catch (error) {
      // A 422 paints the offending input; anything else is a single message.
      const details = fieldErrors(error) as FieldErrors<Fields>;
      const message = errorMessage(error, "The vehicle record could not be saved.");
      setErrors(Object.keys(details).length ? details : { form: message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit vehicle record" : "Record vehicle entry"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Correct the details captured for this vehicle. Timestamps are left unchanged."
              : "Log a vehicle entering campus. The entry time is stamped automatically."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          {errors.form ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive sm:col-span-2"
            >
              {errors.form}
            </div>
          ) : null}

          <FormField
            id="vehicle-number"
            label="Vehicle Number"
            required
            error={errors.vehicleNumber}
            hint="Format: UK07AB1234"
          >
            <Input
              value={form.vehicleNumber}
              onChange={(e) => {
                setForm((p) => ({ ...p, vehicleNumber: e.target.value.toUpperCase() }));
                setErrors((p) => ({ ...p, vehicleNumber: undefined }));
              }}
              placeholder="UK07AB1234"
              className="font-mono uppercase"
              maxLength={13}
              invalid={Boolean(errors.vehicleNumber)}
              autoFocus
            />
          </FormField>

          <FormField id="vehicle-type" label="Vehicle Type" required>
            <Select
              value={form.vehicleType}
              onValueChange={(value) =>
                setForm((p) => ({ ...p, vehicleType: value as Vehicle["vehicleType"] }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField id="vehicle-visitor" label="Visitor" required error={errors.visitorName}>
            <Input
              value={form.visitorName}
              onChange={(e) => {
                setForm((p) => ({ ...p, visitorName: e.target.value }));
                setErrors((p) => ({ ...p, visitorName: undefined }));
              }}
              placeholder="Name of the visitor"
              invalid={Boolean(errors.visitorName)}
            />
          </FormField>

          <FormField id="vehicle-driver" label="Driver" required error={errors.driverName}>
            <Input
              value={form.driverName}
              onChange={(e) => {
                setForm((p) => ({ ...p, driverName: e.target.value }));
                setErrors((p) => ({ ...p, driverName: undefined }));
              }}
              placeholder="Name of the driver"
              invalid={Boolean(errors.driverName)}
            />
          </FormField>

          <FormField id="vehicle-gate" label="Entry Gate" required>
            <Select
              value={form.gate}
              onValueChange={(value) => setForm((p) => ({ ...p, gate: value }))}
            >
              <SelectTrigger>
                <SelectValue />
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

          <FormField
            id="vehicle-purpose"
            label="Purpose"
            required
            error={errors.purpose}
            className="sm:col-span-2"
          >
            <Input
              value={form.purpose}
              onChange={(e) => {
                setForm((p) => ({ ...p, purpose: e.target.value }));
                setErrors((p) => ({ ...p, purpose: undefined }));
              }}
              placeholder="e.g. Library consignment delivery"
              maxLength={120}
              invalid={Boolean(errors.purpose)}
            />
          </FormField>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {editing ? (
                <>
                  <Save className="h-4 w-4" />
                  Save changes
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Record entry
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
