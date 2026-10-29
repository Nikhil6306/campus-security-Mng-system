"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BadgeAlert,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock,
  DoorOpen,
  MapPin,
  RefreshCw,
  Shield,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { EmptyState, InlineLoader } from "@/components/shared/states";
import { useAuth } from "@/components/providers/auth-provider";
import { api, errorMessage } from "@/lib/api";
import type {
  PatrolRoute,
  PatrolCheckpoint,
  PatrolSubmission,
  CheckpointResult,
} from "@/lib/types";
import { formatDateTime, todayISO } from "@/lib/utils";

export default function SecurityPatrolPage() {
  const { session } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [routes, setRoutes] = React.useState<PatrolRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = React.useState<string>("");
  const [checkpoints, setCheckpoints] = React.useState<PatrolCheckpoint[]>([]);
  const [submissions, setSubmissions] = React.useState<PatrolSubmission[]>([]);

  // Form states per checkpoint
  const [results, setResults] = React.useState<Record<string, CheckpointResult>>({});
  const [observations, setObservations] = React.useState<Record<string, string>>({});
  const [photoUrls, setPhotoUrls] = React.useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = React.useState<string | null>(null);

  const loadRoutesAndSubmissions = React.useCallback(async () => {
    try {
      setLoading(true);
      const [allRoutes, allSubmissions] = await Promise.all([
        api.patrolRoutes() as Promise<PatrolRoute[]>,
        api.patrolSubmissions({ date: todayISO() }),
      ]);

      const rList = Array.isArray(allRoutes) ? allRoutes : [];
      setRoutes(rList);
      setSubmissions(allSubmissions);

      if (rList.length > 0 && !selectedRouteId) {
        setSelectedRouteId(rList[0].id);
      }
    } catch (err) {
      toast.error("Failed to load patrol routes", {
        description: errorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }, [selectedRouteId]);

  React.useEffect(() => {
    loadRoutesAndSubmissions();
  }, [loadRoutesAndSubmissions]);

  // Load checkpoints when selected route changes
  React.useEffect(() => {
    if (!selectedRouteId) return;
    api
      .patrolRoutes(selectedRouteId)
      .then((data) => {
        const cpList = Array.isArray(data) ? (data as PatrolCheckpoint[]) : [];
        setCheckpoints(cpList);
      })
      .catch((err) => {
        toast.error("Cannot load route checkpoints", {
          description: errorMessage(err),
        });
      });
  }, [selectedRouteId]);

  // Check which checkpoints have been submitted today
  const submittedCheckpointIds = React.useMemo(() => {
    return new Set(submissions.map((s) => s.checkpointId));
  }, [submissions]);

  const handleSubmitCheckpoint = async (checkpoint: PatrolCheckpoint) => {
    const result = results[checkpoint.id] || "Pass";
    const note = observations[checkpoint.id] || "";
    const photo = photoUrls[checkpoint.id] || "";

    if (checkpoint.photoRequired && !photo.trim()) {
      toast.error("Photo required", {
        description: `Checkpoint "${checkpoint.name || checkpoint.title}" requires photo evidence URL/attachment before submission.`,
      });
      return;
    }

    if (result === "Fail" && !note.trim()) {
      toast.error("Observations required on failure", {
        description: "Please describe the observed defect or safety issue.",
      });
      return;
    }

    try {
      setSubmittingId(checkpoint.id);
      await api.submitPatrolCheck({
        checkpointId: checkpoint.id,
        result,
        observations: note,
        photoUrl: photo,
      });

      if (result === "Fail") {
        toast.error(`Checkpoint ${result}`, {
          description: "Critical checkpoint failure recorded and escalated to duty supervisor.",
        });
      } else {
        toast.success(`Checkpoint ${result}`, {
          description: `Inspection logged for ${checkpoint.name || checkpoint.title}.`,
        });
      }

      // Reload submissions
      const updated = await api.patrolSubmissions({ date: todayISO() });
      setSubmissions(updated);
    } catch (err) {
      toast.error("Submission failed", {
        description: errorMessage(err),
      });
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Digital Patrol Checklist</h1>
          <p className="text-sm text-muted-foreground">
            Complete assigned route inspections with verified timestamps and observation logging.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/security/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Console
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/security/handover">
              <ShieldCheck className="h-4 w-4 mr-1.5" />
              Duty & Handover
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <InlineLoader label="Loading patrol routes and inspection checkpoints..." />
        </div>
      ) : (
        <>
          {/* Route Selector */}
          <Card className="p-4 space-y-3">
            <Label className="text-sm font-semibold">Select Patrol Route</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {routes.map((r) => {
                const isSelected = r.id === selectedRouteId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRouteId(r.id)}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "border-navy bg-navy/5 ring-2 ring-navy/20 dark:bg-navy/20"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-muted-foreground">{r.id}</span>
                      <Badge variant="outline" className="text-[10px]">{r.frequency}</Badge>
                    </div>
                    <div className="font-bold text-sm text-foreground mt-1">{r.name}</div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.description}</p>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Route Checkpoints List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-navy" />
                <span>Checkpoints for Route ({checkpoints.length})</span>
              </h2>
              <span className="text-xs text-muted-foreground">
                {submissions.filter((s) => checkpoints.some((c) => c.id === s.checkpointId)).length} of{" "}
                {checkpoints.length} inspected today
              </span>
            </div>

            {checkpoints.length === 0 ? (
              <Card className="p-6 text-center text-xs text-muted-foreground">
                No checkpoints configured for this route.
              </Card>
            ) : (
              <div className="space-y-4">
                {checkpoints.map((cp) => {
                  const isSubmitted = submittedCheckpointIds.has(cp.id);
                  const subRecord = submissions.find((s) => s.checkpointId === cp.id);
                  const currentResult = results[cp.id] || "Pass";
                  const isSubmitting = submittingId === cp.id;

                  return (
                    <Card
                      key={cp.id}
                      className={`p-5 transition-all ${
                        isSubmitted
                          ? "border-emerald-500/30 bg-emerald-500/5 opacity-85"
                          : "border-border shadow-sm"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-muted-foreground">{cp.id}</span>
                            <h3 className="font-bold text-base text-foreground">{cp.name || cp.title}</h3>
                            {cp.photoRequired && (
                              <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 gap-1">
                                <Camera className="h-3 w-3" /> Photo Required
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>Location: {cp.location}</span>
                          </div>
                        </div>

                        <div>
                          {isSubmitted ? (
                            <Badge variant={subRecord?.result === "Pass" ? "success" : "destructive"} className="gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Inspected: {subRecord?.result}</span>
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pending Check</Badge>
                          )}
                        </div>
                      </div>

                      {/* Instructions & Required Items */}
                      <div className="py-3 space-y-2 text-xs">
                        {cp.instructions && (
                          <p className="text-muted-foreground bg-muted/20 p-2.5 rounded-md italic">
                            <strong>Instructions:</strong> {cp.instructions}
                          </p>
                        )}

                        {cp.inspectionItems && cp.inspectionItems.length > 0 && (
                          <div className="space-y-1">
                            <span className="font-semibold text-foreground text-xs block">Required Verification Points:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {cp.inspectionItems.map((item: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-navy/60 shrink-0" />
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Check Controls */}
                      {isSubmitted ? (
                        <div className="border-t pt-2 flex flex-wrap justify-between text-xs text-muted-foreground">
                          <div>
                            Logged by: <strong>{subRecord?.guardName}</strong> at {subRecord?.submittedAt ? formatDateTime(subRecord.submittedAt) : "—"}
                          </div>
                          {subRecord?.observations && (
                            <div>Note: &quot;{subRecord.observations}&quot;</div>
                          )}
                        </div>
                      ) : (
                        <div className="border-t pt-3 space-y-3">
                          {/* Pass / Fail / NA Toggle Buttons */}
                          <div>
                            <Label className="text-xs">Inspection Result</Label>
                            <div className="grid grid-cols-3 gap-2 mt-1">
                              {(["Pass", "Fail", "N/A"] as CheckpointResult[]).map((res) => {
                                const selected = currentResult === res;
                                return (
                                  <button
                                    key={res}
                                    type="button"
                                    onClick={() => setResults((prev) => ({ ...prev, [cp.id]: res }))}
                                    className={`py-2 px-3 rounded-md font-bold text-xs border transition-colors ${
                                      selected
                                        ? res === "Pass"
                                          ? "bg-emerald-600 text-white border-emerald-600"
                                          : res === "Fail"
                                          ? "bg-red-600 text-white border-red-600"
                                          : "bg-muted text-foreground border-border"
                                        : "bg-background text-muted-foreground hover:bg-muted/30 border-input"
                                    }`}
                                  >
                                    {res === "Pass" ? "✓ Pass" : res === "Fail" ? "✗ Fail / Issue" : "N/A"}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Photo Input (if required or optional) */}
                          <div>
                            <Label className="text-xs flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Camera className="h-3.5 w-3.5" /> Photo Evidence URL
                              </span>
                              {cp.photoRequired && (
                                <span className="text-[10px] text-amber-600 font-semibold">* Mandatory</span>
                              )}
                            </Label>
                            <Input
                              placeholder="https://... or photo filename"
                              value={photoUrls[cp.id] || ""}
                              onChange={(e) => setPhotoUrls((prev) => ({ ...prev, [cp.id]: e.target.value }))}
                              className="text-xs mt-1"
                            />
                          </div>

                          {/* Observations Input */}
                          <div>
                            <Label className="text-xs">Guard Observations</Label>
                            <Input
                              placeholder={currentResult === "Fail" ? "Describe safety defect or issue (Mandatory on Fail)..." : "Notes (Optional)..."}
                              value={observations[cp.id] || ""}
                              onChange={(e) => setObservations((prev) => ({ ...prev, [cp.id]: e.target.value }))}
                              className="text-xs mt-1"
                            />
                          </div>

                          <div className="pt-1 flex justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleSubmitCheckpoint(cp)}
                              disabled={isSubmitting}
                              className="bg-navy hover:bg-navy/90 text-white text-xs gap-1.5"
                            >
                              {isSubmitting ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              <span>Submit Checkpoint Log</span>
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
