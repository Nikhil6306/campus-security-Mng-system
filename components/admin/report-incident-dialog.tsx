"use client";

import * as React from "react";
import { Plus } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { FormField } from "@/components/shared/form-field";
import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { useAction } from "@/components/providers/use-action";
import { api } from "@/lib/api";
import { getLocationNames } from "@/lib/selectors";
import { INCIDENT_TYPES, type IncidentSeverity } from "@/lib/types";
import { todayISO } from "@/lib/utils";
import { validateDate, validateText, type FieldErrors } from "@/lib/validation";

/**
 * Report a safety incident.
 *
 * Shared by the admin console and the gate console so a guard files the same
 * record an administrator sees, through the same validation, rather than each
 * surface growing its own form.
 */

const SEVERITIES: IncidentSeverity[] = ["Low", "Medium", "High", "Critical"];

type ReportFields = "type" | "location" | "date" | "time" | "severity" | "description";

export function ReportIncidentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { db } = useData();
  const act = useAction();
  const { session } = useAuth();
  const locations = React.useMemo(() => getLocationNames(db), [db]);
  const [busy, setBusy] = React.useState(false);

  const emptyForm = React.useMemo(
    () => ({
      type: "" as string,
      location: "",
      date: todayISO(),
      time: new Date().toTimeString().slice(0, 5),
      severity: "Medium" as IncidentSeverity,
      description: "",
    }),
    [],
  );

  const [form, setForm] = React.useState(emptyForm);
  const [errors, setErrors] = React.useState<FieldErrors<ReportFields>>({});

  React.useEffect(() => {
    if (open) {
      setForm({ ...emptyForm, time: new Date().toTimeString().slice(0, 5) });
      setErrors({});
    }
  }, [open, emptyForm]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: FieldErrors<ReportFields> = {
      type: form.type ? undefined : "Select an incident type.",
      location: validateText(form.location, "Location", 3, 120),
      date: validateDate(form.date, "Date"),
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(form.time) ? undefined : "Enter a valid time.",
      description: validateText(form.description, "Description", 15, 800),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setBusy(true);
    const incident = await act(
      () =>
        api.reportIncident({
          type: form.type,
          location: form.location.trim(),
          date: form.date,
          time: form.time,
          severity: form.severity,
          description: form.description.trim(),
          reportedBy: session?.name ?? "Security Administrator",
        }),
      { fallback: "Unable to log this incident. Please try again." },
    );
    setBusy(false);
    if (!incident) return;
    toast.success("Incident reported.", {
      description: `${incident.id} · ${incident.severity} severity.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Report an incident</DialogTitle>
          <DialogDescription>
            Logged incidents are tracked until resolved and appear in the security overview.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <FormField id="incident-type" label="Incident Type" required error={errors.type}>
            <Select
              value={form.type}
              onValueChange={(value) => {
                setForm((p) => ({ ...p, type: value }));
                setErrors((p) => ({ ...p, type: undefined }));
              }}
            >
              <SelectTrigger invalid={Boolean(errors.type)}>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField id="incident-severity" label="Severity" required>
            <Select
              value={form.severity}
              onValueChange={(value) =>
                setForm((p) => ({ ...p, severity: value as IncidentSeverity }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((severity) => (
                  <SelectItem key={severity} value={severity}>
                    {severity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            id="incident-location"
            label="Location"
            required
            error={errors.location}
            hint="Building, gate or area"
            className="sm:col-span-2"
          >
            <Input
              list="campus-locations"
              value={form.location}
              onChange={(e) => {
                setForm((p) => ({ ...p, location: e.target.value }));
                setErrors((p) => ({ ...p, location: undefined }));
              }}
              placeholder="e.g. Main Gate — Visitor Queue"
              invalid={Boolean(errors.location)}
            />
          </FormField>
          <datalist id="campus-locations">
            {locations.map((location) => (
              <option key={location} value={location} />
            ))}
          </datalist>

          <FormField id="incident-date" label="Date" required error={errors.date}>
            <Input
              type="date"
              value={form.date}
              max={todayISO()}
              onChange={(e) => {
                setForm((p) => ({ ...p, date: e.target.value }));
                setErrors((p) => ({ ...p, date: undefined }));
              }}
              invalid={Boolean(errors.date)}
            />
          </FormField>

          <FormField id="incident-time" label="Time" required error={errors.time}>
            <Input
              type="time"
              value={form.time}
              onChange={(e) => {
                setForm((p) => ({ ...p, time: e.target.value }));
                setErrors((p) => ({ ...p, time: undefined }));
              }}
              invalid={Boolean(errors.time)}
            />
          </FormField>

          <FormField
            id="incident-description"
            label="Description"
            required
            error={errors.description}
            hint="What happened, who was involved and what action was taken."
            className="sm:col-span-2"
          >
            <Textarea
              value={form.description}
              onChange={(e) => {
                setForm((p) => ({ ...p, description: e.target.value }));
                setErrors((p) => ({ ...p, description: undefined }));
              }}
              rows={5}
              maxLength={800}
              placeholder="Describe the incident in detail…"
              invalid={Boolean(errors.description)}
            />
          </FormField>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              <Plus className="h-4 w-4" />
              Report incident
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
