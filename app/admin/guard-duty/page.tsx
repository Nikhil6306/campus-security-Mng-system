"use client";

import * as React from "react";
import { Suspense } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BadgeAlert,
  BadgeCheck,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  DoorOpen,
  Download,
  Eye,
  FileCheck,
  FileText,
  Filter,
  Flame,
  KeyRound,
  LogIn,
  LogOut,
  MapPin,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Sunrise,
  UserCheck,
  UserMinus,
  Users,
  X,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { CardsLoadingState, EmptyState, InlineLoader } from "@/components/shared/states";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { api, errorMessage } from "@/lib/api";
import type {
  GuardDutyDashboardStats,
  GuardShiftAssignment,
  ShiftHandover,
  ShiftHandoverItem,
  PatrolRoute,
  PatrolCheckpoint,
  PatrolSubmission,
  GateStaffingRequirement,
  AssignmentStatus,
  HandoverStatus,
  ShiftType,
} from "@/lib/types";
import { formatDateTime, todayISO } from "@/lib/utils";

const assignmentStatusTone: Record<AssignmentStatus, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  Scheduled: "secondary",
  Active: "success",
  Completed: "default",
  Cancelled: "destructive",
  Reassigned: "warning",
};

const handoverStatusTone: Record<HandoverStatus, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  Draft: "secondary",
  Submitted: "warning",
  "Awaiting Incoming Guard": "warning",
  Acknowledged: "secondary",
  "Pending Supervisor Review": "warning",
  Approved: "success",
  Rejected: "destructive",
  Exception: "destructive",
  Escalated: "destructive",
};

export default function AdminGuardDutyPage() {
  return (
    <Suspense fallback={<CardsLoadingState count={4} />}>
      <GuardDutyView />
    </Suspense>
  );
}

function GuardDutyView() {
  const { session } = useAuth();
  const { db } = useData();

  // Filters
  const [selectedDate, setSelectedDate] = React.useState<string>(todayISO());
  const [selectedGate, setSelectedGate] = React.useState<string>("All");
  const [selectedShift, setSelectedShift] = React.useState<string>("All");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Data states
  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [stats, setStats] = React.useState<GuardDutyDashboardStats | null>(null);
  const [assignments, setAssignments] = React.useState<GuardShiftAssignment[]>([]);
  const [handovers, setHandovers] = React.useState<ShiftHandover[]>([]);
  const [routes, setRoutes] = React.useState<PatrolRoute[]>([]);
  const [submissions, setSubmissions] = React.useState<PatrolSubmission[]>([]);
  const [staffing, setStaffing] = React.useState<GateStaffingRequirement[]>([]);

  // Dialog states
  const [createAssignmentOpen, setCreateAssignmentOpen] = React.useState(false);
  const [reassignOpen, setReassignOpen] = React.useState(false);
  const [activeAssignmentForReassign, setActiveAssignmentForReassign] = React.useState<GuardShiftAssignment | null>(null);
  const [staffingRulesOpen, setStaffingRulesOpen] = React.useState(false);
  const [inspectHandoverOpen, setInspectHandoverOpen] = React.useState(false);
  const [selectedHandoverDetails, setSelectedHandoverDetails] = React.useState<(ShiftHandover & { items: ShiftHandoverItem[] }) | null>(null);
  const [rejectHandoverOpen, setRejectHandoverOpen] = React.useState(false);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [decisionNotes, setDecisionNotes] = React.useState("");

  // Form states for new assignment
  const [newAssignment, setNewAssignment] = React.useState({
    guardId: "",
    guardName: "",
    gate: "Main Gate",
    dutyDate: todayISO(),
    shiftType: "Morning" as ShiftType,
    scheduledStartTime: "06:00",
    scheduledEndTime: "14:00",
    notes: "",
  });

  // Reassignment form state
  const [reassignmentForm, setReassignmentForm] = React.useState({
    newGuardId: "",
    newGuardName: "",
    reason: "",
  });

  const loadAllData = React.useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const filterParams = {
        date: selectedDate || undefined,
        gate: selectedGate !== "All" ? selectedGate : undefined,
        shift: selectedShift !== "All" ? selectedShift : undefined,
      };

      const [statsData, assignmentsData, handoversData, routesData, submissionsData, staffingData] = await Promise.all([
        api.guardDutyDashboard(filterParams),
        api.listGuardAssignments(filterParams),
        api.listHandovers(filterParams),
        api.patrolRoutes() as Promise<PatrolRoute[]>,
        api.patrolSubmissions({ date: selectedDate || undefined }),
        api.staffingRequirements(),
      ]);

      setStats(statsData);
      setAssignments(assignmentsData);
      setHandovers(handoversData);
      setRoutes(Array.isArray(routesData) ? routesData : []);
      setSubmissions(submissionsData);
      setStaffing(staffingData);
    } catch (err) {
      toast.error("Failed to load guard duty records", {
        description: errorMessage(err),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, selectedGate, selectedShift]);

  React.useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Available guards from active db roster
  const availableGuards = React.useMemo(() => {
    return (db.guards || []).filter((g) => g.status !== "Suspended");
  }, [db.guards]);

  // Campus gates
  const availableGates = React.useMemo(() => {
    return (db.locations || []).filter((loc) => loc.kind === "Gate" && loc.active);
  }, [db.locations]);

  // Handle Create Assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignment.guardId) {
      toast.error("Guard required", { description: "Please select a security guard." });
      return;
    }
    try {
      await api.createGuardAssignment(newAssignment);
      toast.success("Duty Assigned", { description: `Assigned ${newAssignment.guardName} to ${newAssignment.gate}` });
      setCreateAssignmentOpen(false);
      loadAllData(true);
    } catch (err) {
      toast.error("Assignment failed", { description: errorMessage(err) });
    }
  };

  // Handle Reassign
  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignmentForReassign) return;
    if (!reassignmentForm.newGuardId) {
      toast.error("Guard required", { description: "Please select replacement guard." });
      return;
    }
    if (!reassignmentForm.reason.trim()) {
      toast.error("Reason required", { description: "Mandatory justification is required for duty reassignment." });
      return;
    }
    try {
      await api.reassignGuardAssignment(activeAssignmentForReassign.id, reassignmentForm);
      toast.success("Guard Reassigned", { description: `Reassigned assignment to ${reassignmentForm.newGuardName}` });
      setReassignOpen(false);
      setActiveAssignmentForReassign(null);
      setReassignmentForm({ newGuardId: "", newGuardName: "", reason: "" });
      loadAllData(true);
    } catch (err) {
      toast.error("Reassignment failed", { description: errorMessage(err) });
    }
  };

  // Open Handover Detail
  const handleInspectHandover = async (handoverId: string) => {
    try {
      const details = await api.getHandoverDetails(handoverId);
      setSelectedHandoverDetails(details);
      setInspectHandoverOpen(true);
    } catch (err) {
      toast.error("Cannot load handover details", { description: errorMessage(err) });
    }
  };

  // Handle Supervisor Decision
  const handleSupervisorDecision = async (decision: "Approved" | "Rejected" | "Escalation") => {
    if (!selectedHandoverDetails) return;
    if (decision === "Rejected" && !rejectionReason.trim()) {
      toast.error("Rejection reason mandatory", { description: "Please state why this shift handover is rejected." });
      return;
    }
    try {
      await api.decideHandover(selectedHandoverDetails.id, {
        decision,
        notes: decisionNotes,
        rejectionReason: decision === "Rejected" ? rejectionReason : undefined,
      });
      if (decision === "Rejected") {
        toast.error(`Handover ${decision}`, { description: `Shift handover marked as ${decision}.` });
      } else {
        toast.success(`Handover ${decision}`, { description: `Shift handover marked as ${decision}.` });
      }
      setInspectHandoverOpen(false);
      setRejectHandoverOpen(false);
      setSelectedHandoverDetails(null);
      setRejectionReason("");
      setDecisionNotes("");
      loadAllData(true);
    } catch (err) {
      toast.error("Decision failed", { description: errorMessage(err) });
    }
  };

  // Filtered assignments
  const filteredAssignments = React.useMemo(() => {
    return assignments.filter((a) => {
      const matchSearch =
        !searchQuery ||
        a.guardName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.gate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [assignments, searchQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guard Duty & Shift Handover Management"
        description="Oversee gate staffing, duty assignments, shift handovers, digital patrols, and supervisor approvals."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = `/api/guard-duty/reports?format=csv&from=${selectedDate}&to=${selectedDate}`;
                window.open(url, "_blank");
              }}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStaffingRulesOpen(true)}
              className="gap-1.5"
            >
              <DoorOpen className="h-4 w-4" />
              <span>Staffing Rules</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAllData(true)}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateAssignmentOpen(true)}
              className="bg-navy hover:bg-navy/90 text-white gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>New Duty Assignment</span>
            </Button>
          </div>
        }
      />

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard
          label="Total Guards"
          value={stats?.totalGuards ?? 0}
          hint="On Roster"
          icon={Users}
        />
        <StatCard
          label="On Duty Now"
          value={stats?.guardsOnDuty ?? 0}
          hint="Active Shifts"
          icon={ShieldCheck}
          tone="success"
        />
        <StatCard
          label="Not Checked In"
          value={stats?.guardsNotCheckedIn ?? 0}
          hint={stats?.lateCheckIns ? `${stats.lateCheckIns} late` : "Scheduled"}
          icon={Clock}
          tone={stats?.lateCheckIns ? "destructive" : "default"}
        />
        <StatCard
          label="Active Gates"
          value={stats?.activeGateAssignments ?? 0}
          hint="Covered Posts"
          icon={DoorOpen}
        />
        <StatCard
          label="Staffing Gaps"
          value={(stats as any)?.understaffedGates?.length ?? 0}
          hint={(stats as any)?.understaffedGates?.length ? "Immediate Action" : "All Met"}
          icon={AlertTriangle}
          tone={(stats as any)?.understaffedGates?.length ? "destructive" : "success"}
        />
        <StatCard
          label="Handovers Pending"
          value={stats?.pendingShiftHandovers ?? 0}
          hint="Awaiting In-Guard"
          icon={FileText}
          tone={stats?.pendingShiftHandovers ? "warning" : "default"}
        />
        <StatCard
          label="Supervisor Review"
          value={stats?.handoversAwaitingApproval ?? 0}
          hint="Approvals Due"
          icon={FileCheck}
          tone={stats?.handoversAwaitingApproval ? "warning" : "default"}
        />
        <StatCard
          label="Open Incidents"
          value={stats?.unresolvedIncidentsRequiringHandover ?? 0}
          hint="Requiring Duty Track"
          icon={ShieldAlert}
          tone={stats?.unresolvedIncidentsRequiringHandover ? "destructive" : "default"}
        />
      </div>

      {/* Understaffed Warning Banner */}
      {stats && Array.isArray((stats as any).understaffedGates) && (stats as any).understaffedGates.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-red-900 dark:text-red-200">
                Staffing Requirement Gaps Detected ({(stats as any).understaffedGates.length} Gate Posts Understaffed)
              </h4>
              <p className="text-xs text-red-700 dark:text-red-300">
                The following security posts do not meet minimum guard coverage for {selectedDate}:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {((stats as any).understaffedGates as any[]).map((gap: any, idx: number) => (
                  <Badge key={idx} variant="destructive" className="font-mono text-xs">
                    {gap.gate} ({gap.shiftType}): {gap.assignedGuards} / {gap.requiredGuards} Assigned (Short {gap.shortfall})
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label className="text-xs text-muted-foreground">Duty Date</Label>
            <div className="relative mt-1">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Campus Gate</Label>
            <select
              value={selectedGate}
              onChange={(e) => setSelectedGate(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="All">All Campus Gates</option>
              {availableGates.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Shift Type</Label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="All">All Shifts</option>
              <option value="Morning">Morning (06:00 - 14:00)</option>
              <option value="Evening">Evening (14:00 - 22:00)</option>
              <option value="Night">Night (22:00 - 06:00)</option>
              <option value="Custom">Custom Shift</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <Label className="text-xs text-muted-foreground">Search Guard / Gate / Assignment ID</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assignments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Main Feature Tabs */}
      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
          <TabsTrigger value="assignments" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span>Duty Assignments ({filteredAssignments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="handovers" className="gap-2">
            <FileText className="h-4 w-4" />
            <span>Shift Handovers ({handovers.length})</span>
          </TabsTrigger>
          <TabsTrigger value="patrols" className="gap-2">
            <BadgeCheck className="h-4 w-4" />
            <span>Patrol Checkpoints ({submissions.length})</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <FileCheck className="h-4 w-4" />
            <span>Reports & Compliance</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: DUTY ASSIGNMENTS */}
        <TabsContent value="assignments" className="space-y-4">
          {loading ? (
            <CardsLoadingState count={3} />
          ) : filteredAssignments.length === 0 ? (
            <EmptyState
              title="No duty assignments found"
              description="No guard duty assignments match the selected date and filters."
              action={
                <Button onClick={() => setCreateAssignmentOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Create Assignment
                </Button>
              }
            />
          ) : (
            <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Assignment</th>
                      <th className="px-4 py-3">Guard Name & ID</th>
                      <th className="px-4 py-3">Gate Post</th>
                      <th className="px-4 py-3">Shift & Timings</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Supervisor</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredAssignments.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-medium">
                          {a.id}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{a.guardName}</div>
                          <div className="font-mono text-xs text-muted-foreground">{a.guardId}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-medium">
                            <DoorOpen className="h-4 w-4 text-muted-foreground" />
                            {a.gate}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {a.shiftType}
                            </Badge>
                            <span className="font-mono text-xs text-muted-foreground">
                              {a.scheduledStartTime} – {a.scheduledEndTime}
                            </span>
                          </div>
                          {a.notes && (
                            <p className="mt-0.5 text-xs text-muted-foreground italic truncate max-w-xs">
                              {a.notes}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={assignmentStatusTone[a.status] || "default"}>
                            {a.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {a.supervisorName || "System Assigned"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {a.status === "Scheduled" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setActiveAssignmentForReassign(a);
                                setReassignmentForm({ newGuardId: "", newGuardName: "", reason: "" });
                                setReassignOpen(true);
                              }}
                              className="text-xs"
                            >
                              Reassign
                            </Button>
                          )}
                          {a.status === "Active" && (
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              On Duty
                            </span>
                          )}
                          {a.status === "Completed" && (
                            <span className="text-xs text-muted-foreground">Done</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 2: SHIFT HANDOVERS */}
        <TabsContent value="handovers" className="space-y-4">
          {handovers.length === 0 ? (
            <EmptyState
              title="No shift handovers yet"
              description="Shift handovers will automatically be generated when active security guards complete duty at their gates."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {handovers.map((h) => (
                <Card key={h.id} className="p-4 space-y-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-muted-foreground">{h.id}</span>
                    <Badge variant={handoverStatusTone[h.status] || "default"}>
                      {h.status}
                    </Badge>
                  </div>

                  <div className="border-t border-b py-2 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gate Post:</span>
                      <span className="font-semibold">{h.gate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Outgoing Guard:</span>
                      <span className="font-medium">{h.outgoingGuardName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Incoming Guard:</span>
                      <span className="font-medium text-foreground">
                        {h.incomingGuardName || (
                          <span className="text-amber-600 font-normal italic">Pending Assignment</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duty Check-In / Out:</span>
                      <span className="font-mono">
                        {h.checkInTime ? formatDateTime(h.checkInTime) : "—"} / {h.checkOutTime ? formatDateTime(h.checkOutTime) : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded bg-muted/40 p-1.5">
                      <div className="font-bold">{h.pendingVisitorsCount}</div>
                      <div className="text-[10px] text-muted-foreground">Visitors</div>
                    </div>
                    <div className="rounded bg-muted/40 p-1.5">
                      <div className="font-bold text-amber-600">{h.unresolvedIncidentsCount}</div>
                      <div className="text-[10px] text-muted-foreground">Incidents</div>
                    </div>
                    <div className="rounded bg-muted/40 p-1.5">
                      <div className="font-bold">{h.patrolCheckpointsCount}</div>
                      <div className="text-[10px] text-muted-foreground">Patrols</div>
                    </div>
                  </div>

                  {h.outgoingNotes && (
                    <p className="text-xs text-muted-foreground italic line-clamp-2 bg-muted/20 p-2 rounded">
                      &quot;{h.outgoingNotes}&quot;
                    </p>
                  )}

                  {h.discrepancies && (
                    <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                      <strong>Discrepancies Noted:</strong> {h.discrepancies}
                    </div>
                  )}

                  <div className="pt-1 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleInspectHandover(h.id)}
                      className="w-full text-xs gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Review Details & Approve</span>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 3: PATROL MONITORING */}
        <TabsContent value="patrols" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {routes.map((r) => (
              <Card key={r.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
                  <Badge variant="outline" className="text-xs">{r.frequency}</Badge>
                </div>
                <h4 className="font-semibold text-sm">{r.name}</h4>
                <p className="text-xs text-muted-foreground">{r.description}</p>
                <div className="text-xs text-muted-foreground pt-1">
                  <strong>Covered Zones:</strong> {(r.zones || [r.zone || "All Zones"]).join(", ")}
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-4 space-y-3">
            <h4 className="font-semibold text-sm">Live Patrol Submissions Log ({submissions.length})</h4>
            {submissions.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No patrol checkpoints have been submitted for {selectedDate}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Route</th>
                      <th className="px-3 py-2">Checkpoint & Location</th>
                      <th className="px-3 py-2">Guard</th>
                      <th className="px-3 py-2">Submitted Time</th>
                      <th className="px-3 py-2">Result</th>
                      <th className="px-3 py-2">Observations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {submissions.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono">{s.id}</td>
                        <td className="px-3 py-2">{s.routeName}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{s.checkpointName}</div>
                          <div className="text-muted-foreground text-[10px]">{s.location}</div>
                        </td>
                        <td className="px-3 py-2">{s.guardName}</td>
                        <td className="px-3 py-2 font-mono">{formatDateTime(s.submittedAt)}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={s.result === "Pass" ? "success" : s.result === "Fail" ? "destructive" : "secondary"}
                          >
                            {s.result}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 max-w-xs truncate text-muted-foreground">
                          {s.observations || "All checks normal."}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TAB 4: REPORTS & COMPLIANCE */}
        <TabsContent value="reports" className="space-y-4">
          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div>
                <h3 className="text-base font-bold">Duty & Patrol Compliance Audit Summary</h3>
                <p className="text-xs text-muted-foreground">
                  Audit compliance metrics for active gate operations and shift handovers.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = `/api/guard-duty/reports?format=csv&from=${selectedDate}&to=${selectedDate}`;
                  window.open(url, "_blank");
                }}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                <span>Export Audit CSV</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-lg border p-4 bg-muted/10 space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Shift Completion Rate</span>
                <div className="text-2xl font-bold">
                  {assignments.length > 0
                    ? `${Math.round(
                        (assignments.filter((a) => a.status === "Completed").length / assignments.length) * 100,
                      )}%`
                    : "100%"}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {assignments.filter((a) => a.status === "Completed").length} of {assignments.length} completed
                </p>
              </div>

              <div className="rounded-lg border p-4 bg-muted/10 space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Late Check-Ins</span>
                <div className="text-2xl font-bold text-amber-600">
                  {stats?.lateCheckIns ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground">Flagged arrival delays</p>
              </div>

              <div className="rounded-lg border p-4 bg-muted/10 space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Supervisor Approved Handovers</span>
                <div className="text-2xl font-bold text-emerald-600">
                  {handovers.filter((h) => h.status === "Approved").length}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Out of {handovers.length} submitted
                </p>
              </div>

              <div className="rounded-lg border p-4 bg-muted/10 space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Patrol Checkpoint Success</span>
                <div className="text-2xl font-bold">
                  {submissions.length > 0
                    ? `${Math.round(
                        (submissions.filter((s) => s.result === "Pass").length / submissions.length) * 100,
                      )}%`
                    : "100%"}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {submissions.filter((s) => s.result === "Fail").length} critical failures recorded
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: CREATE DUTY ASSIGNMENT */}
      <Dialog open={createAssignmentOpen} onOpenChange={setCreateAssignmentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Guard to Campus Gate</DialogTitle>
            <DialogDescription>
              Schedule a security guard to an assigned gate post and shift.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAssignment} className="space-y-3 py-2 text-sm">
            <div>
              <Label>Select Security Guard</Label>
              <select
                value={newAssignment.guardId}
                onChange={(e) => {
                  const g = availableGuards.find((x) => x.id === e.target.value);
                  setNewAssignment((prev) => ({
                    ...prev,
                    guardId: e.target.value,
                    guardName: g ? g.fullName : "",
                  }));
                }}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                required
              >
                <option value="">Select Guard...</option>
                {availableGuards.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.fullName} ({g.id} · {g.shift})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Campus Gate / Post</Label>
              <select
                value={newAssignment.gate}
                onChange={(e) => setNewAssignment((prev) => ({ ...prev, gate: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                required
              >
                {availableGates.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Duty Date</Label>
                <Input
                  type="date"
                  value={newAssignment.dutyDate}
                  onChange={(e) => setNewAssignment((prev) => ({ ...prev, dutyDate: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>Shift Type</Label>
                <select
                  value={newAssignment.shiftType}
                  onChange={(e) => {
                    const st = e.target.value as ShiftType;
                    let startTime = "06:00";
                    let endTime = "14:00";
                    if (st === "Evening") {
                      startTime = "14:00";
                      endTime = "22:00";
                    } else if (st === "Night") {
                      startTime = "22:00";
                      endTime = "06:00";
                    }
                    setNewAssignment((prev) => ({
                      ...prev,
                      shiftType: st,
                      scheduledStartTime: startTime,
                      scheduledEndTime: endTime,
                    }));
                  }}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                >
                  <option value="Morning">Morning</option>
                  <option value="Evening">Evening</option>
                  <option value="Night">Night (Overnight)</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={newAssignment.scheduledStartTime}
                  onChange={(e) => setNewAssignment((prev) => ({ ...prev, scheduledStartTime: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={newAssignment.scheduledEndTime}
                  onChange={(e) => setNewAssignment((prev) => ({ ...prev, scheduledEndTime: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div>
              <Label>Duty Notes (Optional)</Label>
              <Input
                placeholder="Specific instructions or briefing..."
                value={newAssignment.notes}
                onChange={(e) => setNewAssignment((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateAssignmentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-navy hover:bg-navy/90 text-white">
                Confirm Duty Assignment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: REASSIGN GUARD */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Guard Assignment</DialogTitle>
            <DialogDescription>
              Transfer duty for {activeAssignmentForReassign?.gate} on {activeAssignmentForReassign?.dutyDate}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReassign} className="space-y-3 py-2 text-sm">
            <div>
              <Label>Replacement Security Guard</Label>
              <select
                value={reassignmentForm.newGuardId}
                onChange={(e) => {
                  const g = availableGuards.find((x) => x.id === e.target.value);
                  setReassignmentForm((prev) => ({
                    ...prev,
                    newGuardId: e.target.value,
                    newGuardName: g ? g.fullName : "",
                  }));
                }}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                required
              >
                <option value="">Select Replacement Guard...</option>
                {availableGuards
                  .filter((g) => g.id !== activeAssignmentForReassign?.guardId)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.fullName} ({g.id} · {g.shift})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <Label>Mandatory Reason for Reassignment</Label>
              <Input
                placeholder="e.g. Guard emergency sick leave, post reinforcement..."
                value={reassignmentForm.reason}
                onChange={(e) => setReassignmentForm((prev) => ({ ...prev, reason: e.target.value }))}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setReassignOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-navy hover:bg-navy/90 text-white">
                Reassign Duty
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: INSPECT HANDOVER DETAILS & SUPERVISOR VERIFICATION */}
      <Dialog open={inspectHandoverOpen} onOpenChange={setInspectHandoverOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedHandoverDetails && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    <span>Shift Handover {selectedHandoverDetails.id}</span>
                    <Badge variant={handoverStatusTone[selectedHandoverDetails.status] || "default"}>
                      {selectedHandoverDetails.status}
                    </Badge>
                  </DialogTitle>
                </div>
                <DialogDescription>
                  {selectedHandoverDetails.gate} · Duty handover review and supervisor verification.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Guards & Times Header */}
                <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 bg-muted/20">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Outgoing Guard</span>
                    <strong className="text-sm">{selectedHandoverDetails.outgoingGuardName}</strong>
                    <div className="text-muted-foreground font-mono">{selectedHandoverDetails.outgoingGuardId}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Incoming Guard</span>
                    <strong className="text-sm">
                      {selectedHandoverDetails.incomingGuardName || "Awaiting Incoming Guard"}
                    </strong>
                    <div className="text-muted-foreground font-mono">
                      {selectedHandoverDetails.incomingGuardId || "—"}
                    </div>
                  </div>
                </div>

                {/* Equipment & Keys */}
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Keys & Equipment Handover</span>
                  </div>
                  <p className="text-muted-foreground">
                    {selectedHandoverDetails.equipmentNotes || "All standard gate keys and walkie-talkies handed over."}
                  </p>
                </div>

                {/* Handover Items: Visitors */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-xs flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    <span>Visitors on Campus at Handover ({selectedHandoverDetails.items.filter((i) => i.itemType === "visitor").length})</span>
                  </h4>
                  {selectedHandoverDetails.items.filter((i) => i.itemType === "visitor").length === 0 ? (
                    <p className="text-muted-foreground italic pl-2">No visitors inside at shift change.</p>
                  ) : (
                    <div className="divide-y rounded-md border text-[11px]">
                      {selectedHandoverDetails.items
                        .filter((i) => i.itemType === "visitor")
                        .map((item) => (
                          <div key={item.id} className="p-2 flex items-center justify-between">
                            <div>
                              <strong className="text-foreground">{item.title}</strong>
                              <p className="text-muted-foreground">{item.details}</p>
                            </div>
                            <Badge variant="outline">{item.status}</Badge>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Handover Items: Incidents */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-xs flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    <span>Open / Active Security Incidents ({selectedHandoverDetails.items.filter((i) => i.itemType === "incident").length})</span>
                  </h4>
                  {selectedHandoverDetails.items.filter((i) => i.itemType === "incident").length === 0 ? (
                    <p className="text-muted-foreground italic pl-2">No open incidents carried over.</p>
                  ) : (
                    <div className="divide-y rounded-md border text-[11px]">
                      {selectedHandoverDetails.items
                        .filter((i) => i.itemType === "incident")
                        .map((item) => (
                          <div key={item.id} className="p-2 flex items-center justify-between">
                            <div>
                              <strong className="text-red-600 dark:text-red-400">{item.title}</strong>
                              <p className="text-muted-foreground">{item.details}</p>
                            </div>
                            <Badge variant="destructive">{item.status}</Badge>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Supervisor Notes Input */}
                <div>
                  <Label className="text-xs">Supervisor Notes (Optional)</Label>
                  <Input
                    placeholder="Enter review remarks or instructions..."
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    className="text-xs mt-1"
                  />
                </div>
              </div>

              <DialogFooter className="flex flex-wrap gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setInspectHandoverOpen(false)}>
                  Close
                </Button>
                {selectedHandoverDetails.status !== "Approved" && (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setRejectHandoverOpen(true)}
                    >
                      Reject Handover
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSupervisorDecision("Escalation")}
                      className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                    >
                      Escalate Exception
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSupervisorDecision("Approved")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Approve Handover
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: REJECT HANDOVER MANDATORY REASON */}
      <Dialog open={rejectHandoverOpen} onOpenChange={setRejectHandoverOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Shift Handover</DialogTitle>
            <DialogDescription>
              State mandatory reasons why this shift handover cannot be verified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <Label>Rejection Justification</Label>
            <Input
              placeholder="e.g. Missing radio equipment, unverified perimeter log..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setRejectHandoverOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleSupervisorDecision("Rejected")}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: STAFFING RULES CONFIGURATION */}
      <Dialog open={staffingRulesOpen} onOpenChange={setStaffingRulesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Campus Gate Staffing Requirements</DialogTitle>
            <DialogDescription>
              Configure mandatory guard headcounts per post and shift.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs max-h-96 overflow-y-auto">
            {staffing.map((rule, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded border bg-muted/10">
                <div>
                  <div className="font-semibold text-sm">{rule.gate}</div>
                  <div className="text-muted-foreground">{rule.shiftType} Shift</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Required Guards:</span>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    defaultValue={rule.requiredGuards}
                    onBlur={async (e) => {
                      const count = parseInt(e.target.value, 10);
                      if (!isNaN(count) && count !== rule.requiredGuards) {
                        try {
                          await api.saveStaffingRequirement({
                            gate: rule.gate,
                            shiftType: rule.shiftType,
                            requiredGuards: count,
                          });
                          toast.success("Updated", { description: `Set ${rule.gate} (${rule.shiftType}) requirement to ${count}` });
                          loadAllData(true);
                        } catch (err) {
                          toast.error("Failed to update", { description: errorMessage(err) });
                        }
                      }
                    }}
                    className="w-16 h-8 text-center text-xs"
                  />
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="pt-2">
            <Button onClick={() => setStaffingRulesOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
