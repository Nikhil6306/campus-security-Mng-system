"use client";

import * as React from "react";
import {
  Ambulance,
  AlertOctagon,
  CircleAlert,
  Flame,
  ShieldAlert,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
import { useData } from "@/components/providers/data-provider";
import { api, errorMessage } from "@/lib/api";
import { getLocationNames } from "@/lib/selectors";
import { INCIDENT_SEVERITIES, type EmergencyType, type IncidentSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { validateText } from "@/lib/validation";

export const EMERGENCY_OPTIONS: {
  type: EmergencyType;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    type: "Security Emergency",
    icon: ShieldAlert,
    description: "Intrusion, violence or an active threat",
  },
  {
    type: "Medical Emergency",
    icon: Ambulance,
    description: "Injury, collapse or medical assistance",
  },
  { type: "Fire Emergency", icon: Flame, description: "Fire, smoke or gas" },
  { type: "Evacuation", icon: Users, description: "Clear a building or the campus" },
  {
    type: "Suspicious Activity",
    icon: TriangleAlert,
    description: "Something that needs a patrol now",
  },
];

/**
 * Emergency trigger grid.
 *
 * Raising an alert here notifies the campus security dashboards and creates the
 * record the response is coordinated around. It contacts no emergency service —
 * the dialog says so plainly, because a responder must never believe help has
 * been summoned when it has not.
 */
export function EmergencyPanel({
  size = "default",
  onTriggered,
}: {
  size?: "default" | "large";
  onTriggered?: () => void;
}) {
  const { run, db } = useData();
  const locations = React.useMemo(() => getLocationNames(db), [db]);

  const [selected, setSelected] = React.useState<EmergencyType | null>(null);
  const [location, setLocation] = React.useState("");
  const [severity, setSeverity] = React.useState<IncidentSeverity>("Critical");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [confirmed, setConfirmed] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const large = size === "large";

  const openFor = (type: EmergencyType) => {
    setSelected(type);
    setLocation("");
    setSeverity(type === "Suspicious Activity" ? "Medium" : "Critical");
    setNote("");
    setError(undefined);
    setConfirmed(false);
  };

  const close = () => {
    setSelected(null);
    setConfirmed(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;

    const validationError = validateText(location, "Location", 3, 120);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await run(() =>
        api.triggerEmergency({
          type: selected,
          severity,
          location: location.trim(),
          note: note.trim() || undefined,
        }),
      );
      setConfirmed(true);
      toast.warning("Emergency alert raised.", {
        description: `${selected} · ${location.trim()}`,
      });
      onTriggered?.();
    } catch (err) {
      const message = errorMessage(err, "The alert could not be raised. Please try again.");
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "grid gap-3",
          large ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {EMERGENCY_OPTIONS.map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => openFor(item.type)}
            className={cn(
              "group flex items-center gap-3 rounded-lg border border-destructive/25 bg-destructive/[0.06] text-left transition-all",
              "hover:border-destructive/60 hover:bg-destructive/10 hover:shadow-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2",
              large ? "p-5" : "p-4",
            )}
          >
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-md bg-destructive/12 text-destructive transition-colors group-hover:bg-destructive group-hover:text-destructive-foreground",
                large ? "h-12 w-12" : "h-10 w-10",
              )}
              aria-hidden
            >
              <item.icon className={large ? "h-6 w-6" : "h-5 w-5"} />
            </span>
            <span className="min-w-0">
              <span className={cn("block font-semibold", large ? "text-base" : "text-sm")}>
                {item.type}
              </span>
              <span className="block text-xs text-muted-foreground">{item.description}</span>
            </span>
          </button>
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          {confirmed ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CircleAlert className="h-5 w-5 text-warning" aria-hidden />
                  Alert raised
                </DialogTitle>
                <DialogDescription>
                  A {selected} alert was recorded at {location} and is now active in the emergency
                  log. Every signed-in dashboard has been notified.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-md border border-warning/30 bg-warning/10 p-3.5 text-sm">
                No emergency service has been contacted. Call the emergency number directly if
                anyone needs help.
              </div>

              <DialogFooter>
                <Button onClick={close}>Close</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertOctagon className="h-5 w-5 text-destructive" aria-hidden />
                  Raise {selected}
                </DialogTitle>
                <DialogDescription>
                  This alerts campus security inside this system. It does not contact any external
                  emergency service.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={submit} noValidate className="space-y-4">
                <FormField id="emergency-location" label="Location" required error={error}>
                  <Input
                    list="emergency-locations"
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      setError(undefined);
                    }}
                    placeholder="e.g. Ganga Hostel — Block B"
                    invalid={Boolean(error)}
                    autoFocus
                  />
                </FormField>
                <datalist id="emergency-locations">
                  {locations.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>

                <FormField id="emergency-severity" label="Severity" required>
                  <Select
                    value={severity}
                    onValueChange={(value) => setSeverity(value as IncidentSeverity)}
                  >
                    <SelectTrigger id="emergency-severity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCIDENT_SEVERITIES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField id="emergency-note" label="Details" hint="Optional">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Anything the responding team should know."
                  />
                </FormField>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={close}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="destructive" loading={submitting}>
                    <AlertOctagon className="h-4 w-4" />
                    Raise alert
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
