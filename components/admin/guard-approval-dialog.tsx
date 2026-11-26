"use client";

import * as React from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Filter,
  Mail,
  Phone,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export interface GuardRegistration {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  employee_id: string;
  designation?: string;
  address?: string;
  emergency_contact?: string;
  joining_date?: string | null;
  shift?: string;
  assigned_gate?: string;
  notes?: string | null;
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
      if (!env.ok) throw new Error(env.error?.message ?? "Failed to process guard registration.");
      toast.success(act === "approve" ? `Guard account approved! Account activated for ${registration.full_name}.` : "Registration request marked as rejected.");
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
            Guard Registration Request
            <Badge variant={statusVariant[registration.status] ?? "secondary"}>
              {registration.status.toUpperCase()}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Review the submitted guard application details and approve or reject the request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Applicant info */}
          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Applicant Details
            </p>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <User className="h-4 w-4" /> Full Name:
                </span>
                <span className="font-semibold">{registration.full_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-4 w-4" /> Mobile Number:
                </span>
                <span className="font-mono font-medium">{registration.phone || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-4 w-4" /> Email Address:
                </span>
                <span className="font-medium">{registration.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Request Date:
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(registration.created_at)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-4 w-4" /> Reference ID:
                </span>
                <span className="font-mono text-xs font-bold text-primary">{registration.id}</span>
              </div>
            </div>
          </Card>

          {/* Admin Assignment options when Pending */}
          {isPending && (
            <Card className="p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Duty Assignment & Approval Settings
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Assigned Gate / Post
                  </label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium"
                    value={gate}
                    onChange={(e) => setGate(e.target.value)}
                  >
                    <option value="Main Gate">Main Gate</option>
                    <option value="Gate 1 (North)">Gate 1 (North)</option>
                    <option value="Gate 2 (South)">Gate 2 (South)</option>
                    <option value="Hostel Gate">Hostel Gate</option>
                    <option value="Admin Gate">Admin Gate</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Initial Shift
                  </label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium"
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
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Admin Remarks / Rejection Reason
                </label>
                <textarea
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional note for approved guard, or reason if rejecting…"
                />
              </div>
            </Card>
          )}

          {/* Decision info (if already decided) */}
          {!isPending && (
            <Card className="p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Review Decision
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={statusVariant[registration.status] ?? "secondary"}>
                  {registration.status.toUpperCase()}
                </Badge>
              </div>
              {registration.reviewed_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Decided on:</span>
                  <span className="text-xs">{formatDateTime(registration.reviewed_at)}</span>
                </div>
              )}
              {(registration.admin_remarks || registration.rejection_reason) && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive">
                  <strong>Remarks:</strong> {registration.admin_remarks || registration.rejection_reason}
                </div>
              )}
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {isPending && (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => submit("reject")}
                disabled={saving}
                id="reject-registration-btn"
              >
                {saving && action === "reject" ? (
                  <span className="h-4 w-4 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <XCircle className="h-4 w-4 mr-1" />
                )}
                Reject
              </Button>
              <Button
                onClick={() => submit("approve")}
                disabled={saving}
                id="approve-registration-btn"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving && action === "approve" ? (
                  <span className="h-4 w-4 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                )}
                Approve & Activate
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Complete Guard Registration Requests Management Component.
 * Supports:
 * - Search by guard name, mobile number, or email
 * - Status filter tabs (All, Pending, Approved, Rejected)
 * - Detailed dialog with full review, approval, and rejection features
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
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<string>(filterStatus.toUpperCase());

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

  // Compute counts
  const counts = React.useMemo(() => {
    return {
      ALL: registrations.length,
      PENDING: registrations.filter((r) => r.status.toUpperCase() === "PENDING").length,
      APPROVED: registrations.filter((r) => r.status.toUpperCase() === "APPROVED").length,
      REJECTED: registrations.filter((r) => r.status.toUpperCase() === "REJECTED").length,
    };
  }, [registrations]);

  // Filter items by status and search query
  const filteredItems = React.useMemo(() => {
    let result = registrations;

    // Filter by tab
    if (activeTab !== "ALL") {
      result = result.filter((r) => r.status.toUpperCase() === activeTab);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((r) =>
        [r.full_name, r.email, r.phone, r.employee_id, r.id]
          .filter(Boolean)
          .some((val) => val.toLowerCase().includes(q))
      );
    }

    return result;
  }, [registrations, activeTab, searchQuery]);

  if (loading) return <InlineLoader label="Loading guard registration requests…" />;

  return (
    <div className="space-y-4">
      {/* Controls: Search & Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-1 text-xs font-semibold">
          {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((tab) => {
            const count = counts[tab];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all ${
                  isActive
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab === "ALL" ? "All Requests" : tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    isActive
                      ? "bg-primary/10 text-primary font-bold"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, mobile, email…"
            className="pl-8 text-xs h-9"
          />
        </div>
      </div>

      {/* List or Empty State */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={
            searchQuery
              ? "No matching requests found"
              : activeTab === "PENDING"
              ? "No pending registration requests"
              : activeTab === "APPROVED"
              ? "No approved guard requests"
              : activeTab === "REJECTED"
              ? "No rejected guard requests"
              : "No guard registrations"
          }
          description={
            searchQuery
              ? `No guard registration requests match "${searchQuery}".`
              : activeTab === "PENDING"
              ? "All submitted guard registration requests have been reviewed."
              : "Registration requests will appear here once submitted."
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {filteredItems.map((reg) => {
            const isPendingItem = reg.status.toUpperCase() === "PENDING";
            return (
              <li
                key={reg.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-primary/40"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-foreground">{reg.full_name}</p>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {reg.id}
                    </Badge>
                    <Badge variant={statusVariant[reg.status] ?? "secondary"}>
                      {reg.status.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" /> {reg.email}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="h-3.5 w-3.5" /> {reg.phone || "No phone"}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" /> {formatDateTime(reg.created_at)}
                    </span>
                  </div>

                  {reg.rejection_reason && (
                    <p className="text-xs text-destructive">
                      Rejection Reason: {reg.rejection_reason}
                    </p>
                  )}
                  {reg.admin_remarks && !reg.rejection_reason && (
                    <p className="text-xs text-muted-foreground">
                      Admin Remarks: {reg.admin_remarks}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    size="sm"
                    variant={isPendingItem ? "default" : "outline"}
                    onClick={() => setSelected(reg)}
                    id={`review-reg-${reg.id}`}
                  >
                    {isPendingItem ? "Review & Decide" : "View Details"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Review & Decision Dialog */}
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
