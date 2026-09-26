"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Building2,
  LogOut,
  Monitor,
  Moon,
  RotateCcw,
  Save,
  ShieldCheck,
  Sun,
  Undo2,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toaster";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { DetailRow, FormField } from "@/components/shared/form-field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { WhatsAppPanel } from "@/components/admin/whatsapp-panel";
import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { useAction } from "@/components/providers/use-action";
import { api } from "@/lib/api";
import { getGates } from "@/lib/selectors";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { AppSettings } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
import { validateText, type FieldErrors } from "@/lib/validation";

type SettingsField = keyof AppSettings;

const notificationRows: { key: SettingsField; label: string; description: string }[] = [
  {
    key: "notifyRequests",
    label: "New visit requests",
    description: "Raise a notification when a visitor submits a booking.",
  },
  {
    key: "notifyGate",
    label: "Gate movements",
    description: "Notify on visitor check-in and check-out at any gate.",
  },
  {
    key: "notifyIncidents",
    label: "Incidents and emergencies",
    description: "Alert on new incident reports and emergency alerts.",
  },
];

const visitorRows: { key: SettingsField; label: string; description: string }[] = [
  {
    key: "requireIdProof",
    label: "Require photo ID proof",
    description: "Visitors must declare an ID type and number when booking.",
  },
  {
    key: "requireVehicleDetails",
    label: "Require vehicle details",
    description: "A vehicle number is mandatory when a visitor brings a vehicle.",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { session, signOut } = useAuth();
  const { db } = useData();
  const act = useAction();
  const gates = React.useMemo(() => getGates(db), [db]);

  const [saved, setSaved] = React.useState<AppSettings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = React.useState<AppSettings>(DEFAULT_SETTINGS);
  const [errors, setErrors] = React.useState<FieldErrors<string>>({});
  const [mounted, setMounted] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  /**
   * Settings arrive with the snapshot. Re-seeding the draft whenever the saved
   * copy changes keeps a second administrator's save from being silently
   * overwritten, while leaving an in-progress edit alone.
   */
  React.useEffect(() => {
    setSaved(db.settings);
    setDraft((prev) => (JSON.stringify(prev) === JSON.stringify(saved) ? db.settings : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.settings]);

  const dirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  const update = <K extends SettingsField>(key: K, value: AppSettings[K]) => {
    setDraft((prev: AppSettings) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    const next: FieldErrors<string> = {
      campusName: validateText(draft.campusName, "Campus name", 3, 80),
      securityDeskPhone: draft.securityDeskPhone.trim()
        ? undefined
        : "Security desk number is required.",
    };
    if (draft.visitingHoursFrom >= draft.visitingHoursTo)
      next.visitingHoursTo = "Closing time must be after the opening time.";
    if (draft.maxVisitorsPerBooking < 1 || draft.maxVisitorsPerBooking > 100)
      next.maxVisitorsPerBooking = "Enter a value between 1 and 100.";
    if (draft.advanceBookingDays < 1 || draft.advanceBookingDays > 365)
      next.advanceBookingDays = "Enter a value between 1 and 365 days.";

    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      toast.error("Please correct the highlighted settings.");
      return;
    }

    setSaving(true);
    const stored = await act(() => api.saveSettings(draft), {
      success: "Settings saved.",
      description: "Campus policy now applies to new bookings.",
      fallback: "Unable to save these settings. Please try again.",
    });
    setSaving(false);
    if (stored) {
      setSaved(stored);
      setDraft(stored);
    }
  };

  const themeOptions = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <form onSubmit={handleSave} noValidate className="space-y-6">
      <PageHeader
        title="Settings"
        description="Account, campus policy, notifications and the local demonstration dataset."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={!dirty}
              onClick={() => {
                setDraft(saved);
                setErrors({});
                toast.success("Unsaved changes discarded.");
              }}
            >
              <Undo2 className="h-4 w-4" />
              Discard
            </Button>
            <Button type="submit" disabled={!dirty} loading={saving}>
              <Save className="h-4 w-4" />
              Save changes
            </Button>
          </>
        }
      />

      {dirty ? (
        <div
          role="status"
          className="rounded-md border border-warning/35 bg-warning/10 px-4 py-2.5 text-sm"
        >
          You have unsaved changes.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="min-w-0 space-y-6">
          {/* ----------------------------- Profile ----------------------------- */}
          <Card>
            <SectionHeader title="Profile" description="Signed-in demo account" />
            <div className="space-y-5 p-4">
              <div className="flex items-center gap-4">
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
                  aria-hidden
                >
                  <UserRound className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{session?.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{session?.email}</p>
                  <Badge variant="default" className="mt-1.5 capitalize">
                    <ShieldCheck aria-hidden />
                    {session?.role}
                  </Badge>
                </div>
              </div>

              <Separator />

              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailRow label="Signed in at" value={formatDateTime(session?.loginAt)} />
                <DetailRow label="Session storage" value="Browser localStorage" />
                <DetailRow label="Role" value={session?.role} className="capitalize" />
                <DetailRow label="Linked record" value={session?.refId ?? "—"} mono />
              </dl>

              <div className="rounded-md border border-warning/30 bg-warning/10 p-3.5 text-sm text-foreground/80">
                Account details are fixed in this build — they will come from the identity
                provider once a backend is connected.
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  signOut();
                  toast.success("Logged out successfully.");
                  router.push("/login");
                }}
              >
                <LogOut className="h-4 w-4" />
                Log out
              </Button>
            </div>
          </Card>

          {/* ------------------------- Campus settings ------------------------- */}
          <Card>
            <SectionHeader
              title="Campus settings"
              description="Identity and operating hours shown across the system"
            />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <FormField
                id="campus-name"
                label="Campus name"
                required
                error={errors.campusName}
                className="sm:col-span-2"
              >
                <Input
                  value={draft.campusName}
                  onChange={(e) => update("campusName", e.target.value)}
                  invalid={Boolean(errors.campusName)}
                />
              </FormField>

              <FormField
                id="security-phone"
                label="Security desk number"
                required
                error={errors.securityDeskPhone}
              >
                <Input
                  value={draft.securityDeskPhone}
                  onChange={(e) => update("securityDeskPhone", e.target.value)}
                  invalid={Boolean(errors.securityDeskPhone)}
                />
              </FormField>

              <div />

              <FormField id="hours-from" label="Visiting hours from" required>
                <Input
                  type="time"
                  value={draft.visitingHoursFrom}
                  onChange={(e) => update("visitingHoursFrom", e.target.value)}
                />
              </FormField>

              <FormField
                id="hours-to"
                label="Visiting hours to"
                required
                error={errors.visitingHoursTo}
              >
                <Input
                  type="time"
                  value={draft.visitingHoursTo}
                  onChange={(e) => update("visitingHoursTo", e.target.value)}
                  invalid={Boolean(errors.visitingHoursTo)}
                />
              </FormField>
            </div>
          </Card>

          {/* ------------------------- Visitor settings ------------------------ */}
          <Card>
            <SectionHeader
              title="Visitor settings"
              description="Booking policy applied to the visitor portal"
            />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <FormField
                id="max-visitors"
                label="Maximum visitors per booking"
                required
                error={errors.maxVisitorsPerBooking}
              >
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.maxVisitorsPerBooking}
                  onChange={(e) => update("maxVisitorsPerBooking", Number(e.target.value))}
                  invalid={Boolean(errors.maxVisitorsPerBooking)}
                />
              </FormField>

              <FormField
                id="advance-days"
                label="Advance booking window (days)"
                required
                error={errors.advanceBookingDays}
              >
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={draft.advanceBookingDays}
                  onChange={(e) => update("advanceBookingDays", Number(e.target.value))}
                  invalid={Boolean(errors.advanceBookingDays)}
                />
              </FormField>
            </div>

            <ul className="divide-y divide-border border-t border-border">
              {visitorRows.map((row) => (
                <li key={String(row.key)} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <Label htmlFor={`setting-${String(row.key)}`} className="cursor-pointer">
                      {row.label}
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">{row.description}</p>
                  </div>
                  <Switch
                    id={`setting-${String(row.key)}`}
                    checked={Boolean(draft[row.key])}
                    onCheckedChange={(value) => update(row.key, value as never)}
                  />
                </li>
              ))}
            </ul>
          </Card>

          {/* --------------------------- Notifications -------------------------- */}
          <Card>
            <SectionHeader
              title="Notification settings"
              description="Choose which activity raises a notification"
            />
            <ul className="divide-y divide-border">
              {notificationRows.map((row) => (
                <li key={String(row.key)} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <Label htmlFor={`setting-${String(row.key)}`} className="cursor-pointer">
                      {row.label}
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">{row.description}</p>
                  </div>
                  <Switch
                    id={`setting-${String(row.key)}`}
                    checked={Boolean(draft[row.key])}
                    onCheckedChange={(value) => update(row.key, value as never)}
                  />
                </li>
              ))}
            </ul>
          </Card>

          {/* --------------------------- Demo dataset --------------------------- */}
          <Card>
            <SectionHeader
              title="Demonstration data"
              description="Sample records for demonstration and training"
            />
            <div className="space-y-4 p-4">
              <dl className="grid gap-4 sm:grid-cols-3">
                <DetailRow label="Visit records" value={db.visitRequests.length} />
                <DetailRow label="Visitors" value={db.visitors.length} />
                <DetailRow label="Vehicles" value={db.vehicles.length} />
                <DetailRow label="Incidents" value={db.incidents.length} />
                <DetailRow label="Notifications" value={db.notifications.length} />
                <DetailRow label="Snapshot taken" value={formatDateTime(db.syncedAt)} />
              </dl>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setResetOpen(true)}>
                  <RotateCcw className="h-4 w-4" />
                  Reset to demo data
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Resetting deletes every record in the database and restores the original sample
                dataset. Only the super administrator may do this.
              </p>
            </div>
          </Card>
        </div>

        {/* ------------------------------ Side rail ------------------------------ */}
        <div className="min-w-0 space-y-6">
          <Card>
            <SectionHeader title="Appearance" description="Theme is remembered on this device" />
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Colour theme">
                {themeOptions.map((option) => {
                  const active = mounted && theme === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value)}
                      aria-pressed={active}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-md border p-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-primary bg-primary/[0.06] text-primary"
                          : "border-border hover:bg-secondary",
                      )}
                    >
                      <option.icon className="h-4 w-4" aria-hidden />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Gates" description="Configured campus entry points" />
            <div className="space-y-3 p-4">
              {gates.map((gate: string) => (
                <div
                  key={gate}
                  className="flex items-center gap-3 rounded-md border border-border p-3"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary"
                    aria-hidden
                  >
                    <Building2 className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium">{gate}</span>
                  <Badge variant="success">Active</Badge>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Gates are records in the database. Manage them from Campus → Gates.
              </p>
            </div>
          </Card>

          <WhatsAppPanel />

          <Card>
            <SectionHeader title="System" description="About this build" />
            <dl className="divide-y divide-border">
              {[
                { label: "Application", value: "Campus Security Management System" },
                { label: "Build", value: "Full-stack · v1.0" },
                { label: "Data layer", value: "SQL service layer" },
                { label: "Persistence", value: "Server database" },
                { label: "Realtime", value: "Server-sent events" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 p-4">
                  <dt className="text-sm text-muted-foreground">{row.label}</dt>
                  <dd className="text-right text-sm font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset to demo data?"
        description="Every booking, incident and vehicle record in the database will be deleted and replaced with the original sample dataset."
        confirmLabel="Reset data"
        tone="destructive"
        onConfirm={() => {
          void act(() => api.resetDemoData(), {
            success: "Demo data restored.",
            fallback: "Unable to reset the demonstration data.",
          });
          setResetOpen(false);
        }}
      />
    </form>
  );
}
