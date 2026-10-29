"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  DoorOpen,
  FileCheck,
  FileText,
  KeyRound,
  LogIn,
  LogOut,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { EmptyState, InlineLoader } from "@/components/shared/states";
import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { api, errorMessage } from "@/lib/api";
import type {
  GuardShiftAssignment,
  GuardShiftSession,
  ShiftHandover,
  ShiftHandoverItem,
} from "@/lib/types";
import { formatDateTime, todayISO } from "@/lib/utils";

export default function SecurityHandoverPage() {
  const { session } = useAuth();
  const { db } = useData();

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [assignments, setAssignments] = React.useState<GuardShiftAssignment[]>([]);
  const [handovers, setHandovers] = React.useState<ShiftHandover[]>([]);
  const [liveData, setLiveData] = React.useState<{
    visitorsInside: Array<any>;
    openIncidents: Array<any>;
    pendingCheckpoints: Array<any>;
  }>({ visitorsInside: [], openIncidents: [], pendingCheckpoints: [] });

  // Dialogs
  const [startShiftOpen, setStartShiftOpen] = React.useState(false);
  const [selectedAssignmentToStart, setSelectedAssignmentToStart] = React.useState<GuardShiftAssignment | null>(null);
  const [startShiftNotes, setStartShiftNotes] = React.useState("");

  const [endShiftOpen, setEndShiftOpen] = React.useState(false);
  const [activeSessionToEnd, setActiveSessionToEnd] = React.useState<GuardShiftAssignment | null>(null);
  const [shiftSummary, setShiftSummary] = React.useState("");
  const [equipmentNotes, setEquipmentNotes] = React.useState("Gate keys, patrol torch, radio #1 & #2 handed over in working order.");
  const [incomingGuardId, setIncomingGuardId] = React.useState("");
  const [incomingGuardName, setIncomingGuardName] = React.useState("");

  const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = React.useState(false);
  const [handoverToAcknowledge, setHandoverToAcknowledge] = React.useState<ShiftHandover | null>(null);
  const [handoverDetails, setHandoverDetails] = React.useState<(ShiftHandover & { items: ShiftHandoverItem[] }) | null>(null);
  const [discrepancies, setDiscrepancies] = React.useState("");

  const guardId = session?.refId || "";
  const guardName = session?.name || "Security Guard";

  const loadData = React.useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [myAssignments, allHandovers, live] = await Promise.all([
        api.listGuardAssignments({ date: todayISO() }),
        api.listHandovers({ date: todayISO() }),
        api.liveHandoverData(session?.gate || undefined),
      ]);

      setAssignments(myAssignments);
      setHandovers(allHandovers);
      setLiveData(live);
    } catch (err) {
      toast.error(errorMessage(err) || "Failed to load duty data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.gate]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Find guard's current assignment
  const myCurrentAssignments = React.useMemo(() => {
    return assignments.filter((a) => a.guardId === guardId || a.guardName.toLowerCase() === guardName.toLowerCase());
  }, [assignments, guardId, guardName]);

  const activeAssignment = myCurrentAssignments.find((a) => a.status === "Active");
  const upcomingAssignment = myCurrentAssignments.find((a) => a.status === "Scheduled");

  // Handovers where this guard is the incoming guard and acknowledgment is pending
  const pendingHandoversForMe = React.useMemo(() => {
    return handovers.filter((h) => {
      const isTarget = !h.incomingGuardId || h.incomingGuardId === guardId || h.incomingGuardName?.toLowerCase() === guardName.toLowerCase();
      const needsAck = h.status === "Awaiting Incoming Guard" || h.status === "Submitted";
      return isTarget && needsAck && h.outgoingGuardId !== guardId;
    });
  }, [handovers, guardId, guardName]);

  // Handle Start Shift
  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignmentToStart) return;

    try {
      await api.startGuardShift({
        assignmentId: selectedAssignmentToStart.id,
        notes: startShiftNotes,
      });
      toast.success(`Shift Started: Check-in recorded for ${selectedAssignmentToStart.gate}.`);
      setStartShiftOpen(false);
      setSelectedAssignmentToStart(null);
      setStartShiftNotes("");
      loadData(true);
    } catch (err) {
      toast.error(errorMessage(err) || "Cannot start shift");
    }
  };

  // Handle End Shift
  const handleEndShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignment) return;
    if (!shiftSummary.trim()) {
      toast.error("Summary required: Please enter brief shift summary notes.");
      return;
    }

    try {
      await api.endGuardShift({
        sessionId: activeAssignment.id,
        shiftSummary,
        equipmentHandoverNotes: equipmentNotes,
        incomingGuardId: incomingGuardId || undefined,
        incomingGuardName: incomingGuardName || undefined,
      });
      toast.success("Shift Completed & Handover Created", {
        description: "Duty checked out. Handover generated with active visitors and incidents attached.",
      });
      setEndShiftOpen(false);
      setShiftSummary("");
      loadData(true);
    } catch (err) {
      toast.error("Cannot complete shift", {
        description: errorMessage(err),
      });
    }
  };

  // Open Acknowledge Handover Modal
  const openAcknowledge = async (h: ShiftHandover) => {
    try {
      setHandoverToAcknowledge(h);
      const details = await api.getHandoverDetails(h.id);
      setHandoverDetails(details);
      setDiscrepancies("");
      setAcknowledgeDialogOpen(true);
    } catch (err) {
      toast.error("Cannot load handover", { description: errorMessage(err) });
    }
  };

  // Submit Handover Acknowledgment
  const handleAcknowledge = async () => {
    if (!handoverToAcknowledge) return;
    try {
      await api.acknowledgeHandover(handoverToAcknowledge.id, {
        discrepancies: discrepancies.trim() || undefined,
      });
      toast.success("Handover Acknowledged", {
        description: "You have formally accepted duty responsibility for this post.",
      });
      setAcknowledgeDialogOpen(false);
      setHandoverToAcknowledge(null);
      setHandoverDetails(null);
      loadData(true);
    } catch (err) {
      toast.error("Acknowledgment failed", {
        description: errorMessage(err),
      });
    }
  };

  // Available replacement guards from active directory
  const guardOptions = (db.guards || []).filter((g) => g.id !== guardId && g.status !== "Suspended");

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Duty & Shift Handover Console</h1>
          <p className="text-sm text-muted-foreground">
            Official check-in, check-out, live visitor handover, incident transfer, and equipment verification.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/security/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Gate Desk
            </Link>
          </Button>
          <Button variant="outline" onClick={() => loadData(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <InlineLoader label="Retrieving duty assignments and handover records..." />
        </div>
      ) : (
        <>
          {/* SECTION 1: ACTIVE / SCHEDULED SHIFT CARD */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-navy" />
              <span>My Shift Status</span>
            </h2>

            {activeAssignment ? (
              <Card className="border-emerald-500/40 bg-emerald-500/5 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                      <h3 className="text-xl font-bold">Currently On Duty</h3>
                      <Badge variant="success">Active Shift</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Gate Post: <strong className="text-foreground">{activeAssignment.gate}</strong> · Shift: {activeAssignment.shiftType} ({activeAssignment.scheduledStartTime} – {activeAssignment.scheduledEndTime})
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={() => {
                      setActiveSessionToEnd(activeAssignment);
                      setEndShiftOpen(true);
                    }}
                    className="bg-navy hover:bg-navy/90 text-white gap-2"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>End Shift & Initiate Handover</span>
                  </Button>
                </div>

                {/* Live Post Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-3 text-xs">
                  <div className="rounded-md border bg-background/50 p-3 space-y-0.5">
                    <span className="text-muted-foreground">Visitors Inside Campus</span>
                    <div className="text-lg font-bold text-foreground">{liveData.visitorsInside.length}</div>
                    <span className="text-[11px] text-muted-foreground">
                      {liveData.visitorsInside.filter((v) => v.isOverdue).length} overdue for exit
                    </span>
                  </div>
                  <div className="rounded-md border bg-background/50 p-3 space-y-0.5">
                    <span className="text-muted-foreground">Open Incidents on File</span>
                    <div className="text-lg font-bold text-amber-600">{liveData.openIncidents.length}</div>
                    <span className="text-[11px] text-muted-foreground">Will be carried forward in handover</span>
                  </div>
                  <div className="rounded-md border bg-background/50 p-3 space-y-0.5">
                    <span className="text-muted-foreground">Patrol Checkpoints Available</span>
                    <div className="text-lg font-bold text-foreground">{liveData.pendingCheckpoints.length}</div>
                    <Link href="/security/patrol" className="text-[11px] text-blue-600 hover:underline">
                      Open Patrol Checklist &rarr;
                    </Link>
                  </div>
                </div>
              </Card>
            ) : upcomingAssignment ? (
              <Card className="p-6 space-y-4 border-amber-300 bg-amber-500/5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-600" />
                      <h3 className="text-xl font-bold">Upcoming Shift Scheduled</h3>
                      <Badge variant="warning">Not Checked In</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Gate Post: <strong className="text-foreground">{upcomingAssignment.gate}</strong> · Date: {upcomingAssignment.dutyDate} · Hours: {upcomingAssignment.scheduledStartTime} to {upcomingAssignment.scheduledEndTime}
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={() => {
                      setSelectedAssignmentToStart(upcomingAssignment);
                      setStartShiftOpen(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  >
                    <LogIn className="h-5 w-5" />
                    <span>Check-In & Start Duty Shift</span>
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="p-6 text-center text-muted-foreground">
                <p className="text-sm">You have no active or scheduled shifts for today ({todayISO()}).</p>
                <p className="text-xs mt-1">Contact your security administrator if you are assigned to a post.</p>
              </Card>
            )}
          </div>

          {/* SECTION 2: HANDOVERS AWAITING MY ACKNOWLEDGMENT */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-navy" />
                <span>Shift Handovers Awaiting Acceptance ({pendingHandoversForMe.length})</span>
              </h2>
            </div>

            {pendingHandoversForMe.length === 0 ? (
              <Card className="p-4 text-xs text-muted-foreground text-center">
                No shift handovers are currently awaiting your acceptance.
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingHandoversForMe.map((h) => (
                  <Card key={h.id} className="p-5 space-y-3 border-amber-300 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-muted-foreground">{h.id}</span>
                      <Badge variant="warning">Incoming Acceptance Due</Badge>
                    </div>

                    <div className="space-y-1 text-sm">
                      <h4 className="font-bold text-base">{h.gate}</h4>
                      <p className="text-xs text-muted-foreground">
                        Outgoing Guard: <strong>{h.outgoingGuardName}</strong> ({h.outgoingGuardId})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Checkout Timestamp: {h.checkOutTime ? formatDateTime(h.checkOutTime) : "Just now"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Visitors Handed Over</span>
                        <strong>{h.pendingVisitorsCount} on campus</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Open Incidents</span>
                        <strong className="text-amber-600">{h.unresolvedIncidentsCount} active</strong>
                      </div>
                    </div>

                    {h.outgoingNotes && (
                      <p className="text-xs text-muted-foreground italic bg-muted/10 p-2 rounded">
                        &quot;{h.outgoingNotes}&quot;
                      </p>
                    )}

                    <Button
                      size="sm"
                      onClick={() => openAcknowledge(h)}
                      className="w-full bg-navy hover:bg-navy/90 text-white gap-2 text-xs"
                    >
                      <UserCheck className="h-4 w-4" />
                      <span>Review Details & Accept Responsibility</span>
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 3: LIVE POST INCIDENTS & VISITORS REFERENCE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            {/* Live Visitors Card */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>Visitors Currently Inside Campus ({liveData.visitorsInside.length})</span>
                </h3>
              </div>

              {liveData.visitorsInside.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Zero active visitors inside campus.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {liveData.visitorsInside.map((v) => (
                    <div key={v.id} className="p-2.5 rounded-md border text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-foreground">{v.fullName}</strong>
                        {v.isOverdue ? (
                          <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Inside</Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground text-[11px]">
                        Entry Gate: {v.gate} · Host: {v.hostName} ({v.department})
                      </div>
                      <div className="text-muted-foreground text-[11px] font-mono">
                        Arrived: {formatDateTime(v.checkInTime)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Live Incidents Card */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>Open Security Incidents ({liveData.openIncidents.length})</span>
                </h3>
              </div>

              {liveData.openIncidents.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Zero open incidents currently reported.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {liveData.openIncidents.map((inc) => (
                    <div key={inc.id} className="p-2.5 rounded-md border text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-red-600 dark:text-red-400">{inc.title}</strong>
                        <Badge variant="destructive" className="text-[10px]">{inc.severity}</Badge>
                      </div>
                      <div className="text-muted-foreground text-[11px]">
                        Location: {inc.location} · Category: {inc.type}
                      </div>
                      <div className="text-muted-foreground text-[11px]">
                        Reported By: {inc.reportedBy} · Status: {inc.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* MODAL: START SHIFT */}
      <Dialog open={startShiftOpen} onOpenChange={setStartShiftOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Duty Shift Check-In</DialogTitle>
            <DialogDescription>
              Record your actual check-in timestamp at {selectedAssignmentToStart?.gate}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleStartShift} className="space-y-4 py-2 text-sm">
            <div className="rounded-md border bg-muted/20 p-3 space-y-1 text-xs">
              <div><strong>Gate:</strong> {selectedAssignmentToStart?.gate}</div>
              <div><strong>Scheduled Shift:</strong> {selectedAssignmentToStart?.shiftType} ({selectedAssignmentToStart?.scheduledStartTime} – {selectedAssignmentToStart?.scheduledEndTime})</div>
              <div><strong>Guard:</strong> {selectedAssignmentToStart?.guardName} ({selectedAssignmentToStart?.guardId})</div>
            </div>

            <div>
              <Label>Shift Start Notes (Optional)</Label>
              <Input
                placeholder="e.g. Relieving previous post officer, gate barrier tested..."
                value={startShiftNotes}
                onChange={(e) => setStartShiftNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setStartShiftOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Confirm Check-In
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: END SHIFT & GENERATE HANDOVER */}
      <Dialog open={endShiftOpen} onOpenChange={setEndShiftOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>End Shift & Initiate Digital Handover</DialogTitle>
            <DialogDescription>
              Complete duty at {activeAssignment?.gate} and transfer responsibility.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEndShift} className="space-y-4 py-2 text-xs">
            <div>
              <Label className="text-xs">Shift Duty Summary Notes (Mandatory)</Label>
              <textarea
                rows={3}
                required
                placeholder="State occurrences, gate operations, visitor traffic, or unusual events..."
                value={shiftSummary}
                onChange={(e) => setShiftSummary(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <Label className="text-xs">Keys, Radios & Equipment Handover</Label>
              <textarea
                rows={2}
                placeholder="List keys, handheld transceivers, inspection torches handed over..."
                value={equipmentNotes}
                onChange={(e) => setEquipmentNotes(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <Label className="text-xs">Designated Incoming Guard (Optional)</Label>
              <select
                value={incomingGuardId}
                onChange={(e) => {
                  const g = guardOptions.find((x) => x.id === e.target.value);
                  setIncomingGuardId(e.target.value);
                  setIncomingGuardName(g ? g.fullName : "");
                }}
                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs shadow-sm"
              >
                <option value="">Awaiting Incoming Guard Check-In...</option>
                {guardOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.fullName} ({g.id} · {g.shift})
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-md border bg-muted/20 p-3 space-y-1 text-muted-foreground">
              <strong className="text-foreground block">Automatic Attachment Summary:</strong>
              <div>• {liveData.visitorsInside.length} visitors currently inside campus will be itemized.</div>
              <div>• {liveData.openIncidents.length} open security incidents will be attached.</div>
              <div>• Patrol checkpoint log will be locked to this session.</div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEndShiftOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-navy hover:bg-navy/90 text-white">
                Submit Handover
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: ACKNOWLEDGE HANDOVER */}
      <Dialog open={acknowledgeDialogOpen} onOpenChange={setAcknowledgeDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          {handoverDetails && (
            <>
              <DialogHeader>
                <DialogTitle>Accept Responsibility for Handover {handoverDetails.id}</DialogTitle>
                <DialogDescription>
                  Review attached records from {handoverDetails.outgoingGuardName} at {handoverDetails.gate}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 text-xs">
                <div className="rounded-md border bg-muted/20 p-2.5 space-y-1">
                  <div><strong>Outgoing Guard Summary:</strong> {handoverDetails.outgoingNotes || "Normal operations."}</div>
                  <div><strong>Equipment Handed Over:</strong> {handoverDetails.equipmentNotes || "Standard keys and radios."}</div>
                </div>

                {/* Handover Items */}
                <div className="space-y-1">
                  <strong className="block text-xs">Transferred Visitors & Incidents ({handoverDetails.items.length})</strong>
                  <div className="divide-y rounded-md border max-h-48 overflow-y-auto">
                    {handoverDetails.items.map((item) => (
                      <div key={item.id} className="p-2 flex items-center justify-between">
                        <div>
                          <strong>{item.title}</strong>
                          <p className="text-muted-foreground text-[10px]">{item.details}</p>
                        </div>
                        <Badge variant={item.itemType === "incident" ? "destructive" : "outline"} className="text-[10px]">
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Discrepancies / Disputed Items (Leave blank if all verified)</Label>
                  <Input
                    placeholder="e.g. Key 104 missing from cabinet, radio charger cord damaged..."
                    value={discrepancies}
                    onChange={(e) => setDiscrepancies(e.target.value)}
                    className="text-xs mt-1"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setAcknowledgeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAcknowledge} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Accept Responsibility
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
