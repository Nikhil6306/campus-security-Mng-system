"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  User,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { InlineLoader, EmptyState } from "@/components/shared/states";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

interface GuardRegistration {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  employee_id: string;
  designation?: string;
  address: string;
  emergency_contact: string;
  joining_date: string | null;
  shift: string;
  assigned_gate: string;
  notes: string | null;
  status: "Pending" | "PENDING" | "Approved" | "APPROVED" | "Rejected" | "REJECTED" | "Suspended" | "SUSPENDED";
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_remarks: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at?: string;
}

interface ApprovalDialogProps {
  registration: GuardRegistration;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

const statusVariant: Record<
  string,
  "success" | "warning" | "destructive" | "secondary"
> = {
  Pending: "warning",
  PENDING: "warning",
  Approved: "success",
  APPROVED: "success",
  Rejected: "destructive",
  REJECTED: "destructive",
  Suspended: "destructive",
  SUSPENDED: "destructive",
};

export function GuardApprovalDialog({
  registration,
  open,
  onOpenChange,
  onDone,
}: ApprovalDialogProps) {
  const [remarks, setRemarks] = React.useState("");
  const [gate, setGate] = React.useState(registration.assigned_gate || "Main Gate");
  const [shift, setShift] = React.useState<"Morning" | "Evening" | "Night" | "General">(
    (registration.shift as "Morning" | "Evening" | "Night" | "General") || "Morning",
  );
  const [action, setAction] = React.useState<"approve" | "reject" | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function submit(act: "approve" | "reject") {
    setSaving(true);
    setAction(act);
    try {
      const response = await fetch("/api/guards/registrations", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: registration.id,
          action: act,
          adminRemarks: remarks || undefined,
          assignedGate: act === "approve" ? gate : undefined,
          shift: act === "approve" ? shift : undefined,
        }),
      });
      const env = await response.json();
      if (!env.ok) throw new Error(env.error?.message ?? "Failed");
      toast.success(act === "approve" ? "Guard registration approved!" : "Registration rejected.");
      onDone();
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
      setAction(null);
    }
  }

  const isPending = registration.status.toUpperCase() === "PENDING";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Guard Registration
            <Badge variant={statusVariant[registration.status] ?? "secondary"}>
              {registration.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Review this guard&apos;s registration request and approve or reject it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Applicant info */}
          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Applicant Details
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{registration.full_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{registration.email}</span>
              </div>
              {registration.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">{registration.phone}</span>
                </div>
              )}
              {registration.employee_id && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {registration.employee_id}
                  </Badge>
                </div>
              )}
              {registration.address && (
                <p className="text-xs text-muted-foreground">{registration.address}</p>
              )}
              {registration.notes && (
                <p className="rounded-md bg-muted/50 p-2 text-xs italic text-muted-foreground">
                  {registration.notes}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Submitted: {formatDateTime(registration.created_at)}
              </p>
            </div>
          </Card>

          {/* Approval config (only if pending) */}
          {isPending && (
            <Card className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Assignment (for approval)
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Assigned Gate / Location
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={gate}
                    onChange={(e) => setGate(e.target.value)}
                    placeholder="e.g. Main Gate"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Shift
                  </label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={shift}
                    onChange={(e) =>
                      setShift(e.target.value as "Morning" | "Evening" | "Night" | "General")
                    }
                  >
                    {["Morning", "Evening", "Night", "General"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Admin Remarks (optional)
                  </label>
                  <textarea
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional notes for the applicant…"
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Decision info (if already decided) */}
          {!isPending && registration.reviewed_at && (
            <Card className="p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Decision
              </p>
              <p className="text-sm">
                <strong>{registration.status}</strong> on{" "}
                {formatDateTime(registration.reviewed_at)}
              </p>
              {registration.admin_remarks && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Remarks: {registration.admin_remarks}
                </p>
              )}
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {isPending && (
            <>
              <Button
                variant="destructive"
                onClick={() => submit("reject")}
                disabled={saving}
                id="reject-registration-btn"
              >
                {saving && action === "reject" ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Reject
              </Button>
              <Button
                onClick={() => submit("approve")}
                disabled={saving}
                id="approve-registration-btn"
              >
                {saving && action === "approve" ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Approve
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Standalone panel that lists all pending guard registrations.
 * Embedded in the admin guard management page.
 */
export function GuardRegistrationsList({
  filterStatus = "all",
  onRefresh,
}: {
  filterStatus?: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" | "all";
  onRefresh?: () => void;
}) {
  const [registrations, setRegistrations] = React.useState<GuardRegistration[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<GuardRegistration | null>(null);

  const fetchRegistrations = React.useCallback(() => {
    setLoading(true);
    fetch("/api/guards/registrations", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((env) => {
        if (env.ok) setRegistrations(env.data.registrations ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const items = React.useMemo(() => {
    if (filterStatus === "all") return registrations;
    return registrations.filter((r) => r.status.toUpperCase() === filterStatus.toUpperCase());
  }, [registrations, filterStatus]);

  if (loading) return <InlineLoader label="Loading registrations…" />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title={
          filterStatus === "PENDING"
            ? "No pending registration requests"
            : filterStatus === "REJECTED"
            ? "No rejected registration requests"
            : filterStatus === "SUSPENDED"
            ? "No suspended guard records"
            : "No guard registrations"
        }
        description={
          filterStatus === "PENDING"
            ? "All submitted guard registration requests have been processed."
            : "Registration requests will appear here once processed."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {items.map((reg) => {
          const isPendingItem = reg.status.toUpperCase() === "PENDING";
          return (
            <li
              key={reg.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 shadow-xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{reg.full_name}</p>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {reg.employee_id}
                  </Badge>
                  {reg.designation && (
                    <span className="text-xs text-muted-foreground">· {reg.designation}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{reg.email} · {reg.phone || "No phone"}</p>
                <p className="text-xs text-muted-foreground">
                  Gate: <span className="font-medium text-foreground">{reg.assigned_gate || "Main Gate"}</span> · Submitted {formatDateTime(reg.created_at)}
                </p>
                {reg.admin_remarks && (
                  <p className="text-xs text-destructive">
                    Reason: {reg.admin_remarks}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant[reg.status] ?? "secondary"}>
                  {reg.status}
                </Badge>
                <Button
                  size="sm"
                  variant={isPendingItem ? "default" : "outline"}
                  onClick={() => setSelected(reg)}
                  id={`review-reg-${reg.id}`}
                >
                  {isPendingItem ? "Review" : "View"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {selected && (
        <GuardApprovalDialog
          registration={selected}
          open
          onOpenChange={(o) => !o && setSelected(null)}
          onDone={() => {
            fetchRegistrations();
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}
