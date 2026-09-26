"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Eye,
  Flame,
  MapPin,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState, InlineLoader, CardsLoadingState } from "@/components/shared/states";
import { IncidentStatusBadge, SeverityBadge } from "@/components/shared/status-badge";
import { DetailRow, FormField } from "@/components/shared/form-field";
import { FilterBar } from "@/components/admin/filter-bar";
import { ReportIncidentDialog } from "@/components/admin/report-incident-dialog";
import { useData } from "@/components/providers/data-provider";
import { useAction } from "@/components/providers/use-action";
import { api } from "@/lib/api";
import {
  type Incident,
  type IncidentSeverity,
  type IncidentStatus,
} from "@/lib/types";
import { cn, formatDate, formatDateTime, formatTime, relativeTime } from "@/lib/utils";
import { validateText } from "@/lib/validation";

const SEVERITIES: IncidentSeverity[] = ["Low", "Medium", "High", "Critical"];

const STATUSES: IncidentStatus[] = ["Open", "Investigating", "Resolved"];

/** Adjusts the workflow status and priority of an existing incident. */
function UpdateIncidentDialog({
  incident,
  open,
  onOpenChange,
}: {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const act = useAction();
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<IncidentStatus>("Open");
  const [severity, setSeverity] = React.useState<IncidentSeverity>("Medium");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    if (open && incident) {
      setStatus(incident.status);
      setSeverity(incident.severity);
      setNote(incident.resolutionNote ?? "");
      setError(undefined);
    }
  }, [open, incident]);

  if (!incident) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Closing an incident must record what was done about it.
    if (status === "Resolved") {
      const noteError = validateText(note, "Resolution note", 10, 400);
      if (noteError) {
        setError(noteError);
        return;
      }
    }

    setBusy(true);
    const updated = await act(
      () =>
        api.updateIncident(incident.id, {
          status,
          severity,
          resolutionNote: status === "Resolved" ? note.trim() : undefined,
        }),
      {
        success: "Incident updated.",
        description: `${incident.id} · ${severity} · ${status}`,
        fallback: "Unable to update this incident. Please try again.",
      },
    );
    setBusy(false);
    if (updated) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update incident</DialogTitle>
          <DialogDescription>
            {incident.id} · {incident.type} at {incident.location}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="update-status" label="Status" required>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as IncidentStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField id="update-severity" label="Priority" required>
              <Select
                value={severity}
                onValueChange={(value) => setSeverity(value as IncidentSeverity)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {status === "Resolved" ? (
            <FormField
              id="update-note"
              label="Resolution note"
              required
              error={error}
              hint="Required when closing an incident."
            >
              <Textarea
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setError(undefined);
                }}
                rows={3}
                maxLength={400}
                invalid={Boolean(error)}
              />
            </FormField>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              <Pencil className="h-4 w-4" />
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResolveDialog({
  incident,
  open,
  onOpenChange,
}: {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const act = useAction();
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    if (open) {
      setNote("");
      setError(undefined);
    }
  }, [open]);

  if (!incident) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateText(note, "Resolution note", 10, 400);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    const resolved = await act(
      () => api.updateIncident(incident.id, { status: "Resolved", resolutionNote: note.trim() }),
      {
        success: "Incident resolved.",
        description: incident.id,
        fallback: "Unable to resolve this incident. Please try again.",
      },
    );
    setBusy(false);
    if (resolved) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve incident</DialogTitle>
          <DialogDescription>
            {incident.id} · {incident.type} at {incident.location}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField
            id="resolution-note"
            label="Resolution note"
            required
            error={error}
            hint="Recorded against the incident for future review."
          >
            <Textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setError(undefined);
              }}
              rows={4}
              maxLength={400}
              placeholder="e.g. Boundary gap repaired by the maintenance team and patrol schedule updated."
              invalid={Boolean(error)}
              autoFocus
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" loading={busy}>
              <CheckCircle2 className="h-4 w-4" />
              Mark resolved
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IncidentDetailDialog({
  incident,
  open,
  onOpenChange,
}: {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!incident) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {incident.type}
            <SeverityBadge severity={incident.severity} />
            <IncidentStatusBadge status={incident.status} />
          </DialogTitle>
          <DialogDescription className="font-mono">{incident.id}</DialogDescription>
        </DialogHeader>

        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailRow label="Location" value={incident.location} />
          <DetailRow label="Reported by" value={incident.reportedBy} />
          <DetailRow label="Date" value={formatDate(incident.date)} />
          <DetailRow label="Time" value={formatTime(incident.time)} />
          <DetailRow label="Logged at" value={formatDateTime(incident.createdAt)} />
          <DetailRow label="Resolved at" value={formatDateTime(incident.resolvedAt)} />
        </dl>

        <Separator />

        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Description
          </p>
          <p className="text-sm leading-relaxed">{incident.description}</p>
        </div>

        {incident.resolutionNote ? (
          <div className="rounded-md border border-success/30 bg-success/8 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-success">
              Resolution
            </p>
            <p className="mt-1 text-sm">{incident.resolutionNote}</p>
          </div>
        ) : null}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IncidentsView() {
  const params = useSearchParams();
  const { db, ready } = useData();
  const act = useAction();

  const [search, setSearch] = React.useState(params.get("q") ?? "");
  const [status, setStatus] = React.useState("all");
  const [severity, setSeverity] = React.useState("all");
  const [reportOpen, setReportOpen] = React.useState(false);
  const [resolveTarget, setResolveTarget] = React.useState<Incident | null>(null);
  const [detailTarget, setDetailTarget] = React.useState<Incident | null>(null);
  const [updateTarget, setUpdateTarget] = React.useState<Incident | null>(null);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return db.incidents
      .filter((incident) => {
        if (status !== "all" && incident.status !== status) return false;
        if (severity !== "all" && incident.severity !== severity) return false;
        if (!query) return true;
        return [incident.id, incident.type, incident.location, incident.description, incident.reportedBy]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db.incidents, search, status, severity]);

  const open = db.incidents.filter((i) => i.status === "Open").length;
  const review = db.incidents.filter((i) => i.status === "Investigating").length;
  const critical = db.incidents.filter(
    (i) => i.severity === "Critical" && i.status !== "Resolved",
  ).length;
  const resolved = db.incidents.filter((i) => i.status === "Resolved").length;

  const isFiltered = search !== "" || status !== "all" || severity !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        description="Log, track and resolve security incidents reported across the campus."
        actions={
          <Button onClick={() => setReportOpen(true)}>
            <Plus className="h-4 w-4" />
            Report incident
          </Button>
        }
      />

      {critical > 0 ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
        >
          <Flame className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-destructive">
              {critical} critical incident{critical === 1 ? "" : "s"} require attention
            </p>
            <p className="mt-0.5 text-sm text-foreground/75">
              Critical reports stay at the top of the list until they are resolved.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open" value={open} icon={ShieldAlert} tone="warning" loading={!ready} />
        <StatCard label="Under review" value={review} icon={Eye} tone="accent" loading={!ready} />
        <StatCard
          label="Critical"
          value={critical}
          icon={AlertTriangle}
          tone="destructive"
          loading={!ready}
        />
        <StatCard label="Resolved" value={resolved} icon={ShieldCheck} tone="success" loading={!ready} />
      </div>

      <Card>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search incident ID, type, location or description…"
          resultCount={filtered.length}
          totalCount={db.incidents.length}
          isFiltered={isFiltered}
          onReset={() => {
            setSearch("");
            setStatus("all");
            setSeverity("all");
          }}
          filters={[
            {
              id: "incident-status-filter",
              label: "Status",
              value: status,
              onChange: setStatus,
              options: [
                { value: "all", label: "All statuses" },
                { value: "Open", label: "Open" },
                { value: "Investigating", label: "Investigating" },
                { value: "Resolved", label: "Resolved" },
              ],
            },
            {
              id: "incident-severity-filter",
              label: "Severity",
              value: severity,
              onChange: setSeverity,
              options: [
                { value: "all", label: "All severities" },
                ...SEVERITIES.map((s) => ({ value: s, label: s })),
              ],
            },
          ]}
        />

        <div className="p-4">
          {!ready ? (
            <CardsLoadingState count={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title={isFiltered ? "No incidents match these filters" : "No incidents reported"}
              description={
                isFiltered
                  ? "Clear the filters to see the full incident log."
                  : "The campus incident log is empty. Reported incidents will appear here."
              }
              action={
                <Button size="sm" onClick={() => setReportOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Report incident
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {filtered.map((incident) => (
                <li key={incident.id}>
                  <article
                    className={cn(
                      "flex h-full flex-col rounded-lg border bg-card p-4 shadow-xs transition-shadow hover:shadow-md",
                      incident.severity === "Critical" && incident.status !== "Resolved"
                        ? "border-destructive/40"
                        : "border-border",
                    )}
                  >
                    <header className="flex items-start gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                          incident.status === "Resolved"
                            ? "bg-success/12 text-success"
                            : incident.severity === "Critical" || incident.severity === "High"
                              ? "bg-destructive/12 text-destructive"
                              : "bg-warning/15 text-warning",
                        )}
                        aria-hidden
                      >
                        {incident.status === "Resolved" ? (
                          <ShieldCheck className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold">{incident.type}</h3>
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                          {incident.location}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {incident.id}
                      </span>
                    </header>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <SeverityBadge severity={incident.severity} />
                      <IncidentStatusBadge status={incident.status} />
                    </div>

                    <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {incident.description}
                    </p>

                    <p className="mt-3 text-[11px] text-muted-foreground">
                      {formatDate(incident.date)} · {formatTime(incident.time)} · reported by{" "}
                      {incident.reportedBy} ({relativeTime(incident.createdAt)})
                    </p>

                    <footer className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <Button variant="ghost" size="xs" onClick={() => setDetailTarget(incident)}>
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>

                      <Button variant="ghost" size="xs" onClick={() => setUpdateTarget(incident)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Update
                      </Button>

                      {incident.status !== "Resolved" && (
                        <>
                          {incident.severity !== "Critical" && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => {
                                void act(
                                  () =>
                                    api.updateIncident(incident.id, {
                                      severity: "Critical",
                                      status: "Investigating",
                                    }),
                                  {
                                    success: "Incident marked critical.",
                                    description: incident.id,
                                    fallback: "Unable to update this incident. Please try again.",
                                  },
                                );
                              }}
                            >
                              <Flame className="h-3.5 w-3.5" />
                              Mark critical
                            </Button>
                          )}
                          <Button
                            variant="success"
                            size="xs"
                            className="ml-auto"
                            onClick={() => setResolveTarget(incident)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Resolve
                          </Button>
                        </>
                      )}

                      {incident.status === "Resolved" ? (
                        <span className="ml-auto flex items-center gap-1 text-[11px] text-success">
                          <ClipboardList className="h-3 w-3" aria-hidden />
                          Closed {relativeTime(incident.resolvedAt)}
                        </span>
                      ) : null}
                    </footer>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <ReportIncidentDialog open={reportOpen} onOpenChange={setReportOpen} />
      <ResolveDialog
        incident={resolveTarget}
        open={Boolean(resolveTarget)}
        onOpenChange={(value) => !value && setResolveTarget(null)}
      />
      <UpdateIncidentDialog
        incident={updateTarget}
        open={Boolean(updateTarget)}
        onOpenChange={(value) => !value && setUpdateTarget(null)}
      />
      <IncidentDetailDialog
        incident={detailTarget}
        open={Boolean(detailTarget)}
        onOpenChange={(value) => !value && setDetailTarget(null)}
      />
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense fallback={<InlineLoader label="Loading incidents…" />}>
      <IncidentsView />
    </Suspense>
  );
}
