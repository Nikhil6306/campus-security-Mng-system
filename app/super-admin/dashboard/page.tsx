"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Crown,
  DoorOpen,
  History,
  KeyRound,
  Lock,
  Radio,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/shared/stat-card";
import { SectionHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SeverityBadge, StatusBadge } from "@/components/shared/status-badge";
import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { getDashboardStats } from "@/lib/selectors";
import type { ActivityLog, EmergencyAlert } from "@/lib/types";
import { cn, relativeTime, todayISO } from "@/lib/utils";

export default function SuperAdminDashboardPage() {
  const { db, ready } = useData();
  const { session } = useAuth();

  const stats = React.useMemo(() => getDashboardStats(db), [db]);

  const highPriorityLogs = React.useMemo(() => {
    return (db.activity ?? []).slice(0, 8);
  }, [db.activity]);

  const activeAlerts = React.useMemo(() => {
    return (db.emergencies ?? []).filter((a: EmergencyAlert) => a.status === "Active");
  }, [db.emergencies]);

  const guardCount = (db.guards ?? []).length;
  const activeGuardCount = (db.guards ?? []).filter(
    (g) => g.status === "Active" || g.status === "On Duty"
  ).length;
  const facultyCount = (db.teachers ?? []).length;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Executive Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-navy-700/60 bg-gradient-to-br from-navy-900 via-navy-950 to-slate-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-saffron-500/20 border border-saffron-400/40 px-3 py-1 text-xs font-semibold text-saffron-300">
              <Crown className="h-3.5 w-3.5 text-saffron-400" />
              Super Administrator Command
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight font-heading">
              Welcome back, {session?.name ?? "Super Admin"}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl">
              High-level institutional oversight, system policies, security telemetry, and Role-Based Access Control (RBAC) management for Dev Sanskriti Vishwavidyalaya.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
              <Link href="/admin/activity">
                <History className="h-4 w-4 mr-2" />
                Audit Logs
              </Link>
            </Button>
            <Button asChild className="bg-saffron-500 hover:bg-saffron-600 text-white font-semibold shadow-md">
              <Link href="/admin/settings">
                <Settings className="h-4 w-4 mr-2" />
                System Settings
              </Link>
            </Button>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-saffron-500/10 blur-3xl" />
        <div className="pointer-events-none absolute right-1/3 -bottom-12 h-48 w-48 rounded-full bg-primary/20 blur-2xl" />
      </div>

      {/* RBAC Quick Control Hub */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 border-l-4 border-l-purple-500 bg-card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">RBAC Role</p>
              <h3 className="mt-1 text-lg font-bold text-foreground">Super Admin</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Highest System Authority</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Crown className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Portal URL:</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-foreground">/super-admin/login</code>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-primary bg-card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">RBAC Role</p>
              <h3 className="mt-1 text-lg font-bold text-foreground">Admin Console</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Operational Management</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Shield className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Portal URL:</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-foreground">/admin/login</code>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-emerald-500 bg-card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">RBAC Role</p>
              <h3 className="mt-1 text-lg font-bold text-foreground">Security Guard</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{activeGuardCount} Active Guards</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Portal URL:</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-foreground">/security/login</code>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-amber-500 bg-card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Panic Alerts</p>
              <h3 className="mt-1 text-lg font-bold text-foreground">{activeAlerts.length} Active</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Campus Gateways</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Security Broadcast:</span>
            <span className={cn("font-medium", activeAlerts.length > 0 ? "text-amber-600 font-semibold" : "text-emerald-600")}>
              {activeAlerts.length > 0 ? "Alert Raised" : "Normal Status"}
            </span>
          </div>
        </Card>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Visits Today"
          value={stats.todayVisitors}
          icon={Activity}
          hint="DSVV Main Campus"
          tone="default"
        />
        <StatCard
          label="Currently On Campus"
          value={stats.currentlyInside}
          icon={Users}
          hint="Active visitors inside"
          tone="accent"
        />
        <StatCard
          label="Pending Approvals"
          value={stats.pendingRequests}
          icon={BadgeCheck}
          hint="Awaiting faculty/host action"
          tone={stats.pendingRequests > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Open Incidents"
          value={stats.openIncidents}
          icon={AlertTriangle}
          hint="Campus security issues"
          tone={stats.openIncidents > 0 ? "destructive" : "default"}
        />
      </div>

      {/* Main Grid: Audit Telemetry and System Quick Access */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Audit Log Stream */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeader
              title="Recent Security & Audit Logs"
              description="Real-time audit trail of approvals, check-ins, pass issues, and authentication events"
            />
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/activity" className="text-xs">
                View All <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <Card className="divide-y overflow-hidden">
            {highPriorityLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No audit logs recorded yet.
              </div>
            ) : (
              highPriorityLogs.map((log: ActivityLog) => (
                <div key={log.id} className="flex items-start justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{log.action}</span>
                      {log.entity && (
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {log.entity}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {log.summary || "System action"}
                    </p>
                    <p className="text-[11px] text-muted-foreground/80">
                      Actor: <span className="font-medium text-foreground">{log.actorName || log.actorRole || "System"}</span> • {relativeTime(log.at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        {/* System Administration Shortcuts */}
        <div className="space-y-4">
          <SectionHeader
            title="Executive Management"
            description="Deep system modules & authority links"
          />

          <Card className="p-5 space-y-4">
            <div className="space-y-3">
              <Link
                href="/admin/settings"
                className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Settings className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">System Configuration</p>
                    <p className="text-xs text-muted-foreground">Allowed types, pass validity, gates</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/admin/guards"
                className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">Guard Directory & RBAC</p>
                    <p className="text-xs text-muted-foreground">{guardCount} total guard profiles</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/admin/teachers"
                className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">Faculty & Host Directory</p>
                    <p className="text-xs text-muted-foreground">{facultyCount} faculty members</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/admin/dashboard"
                className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">Admin Operational View</p>
                    <p className="text-xs text-muted-foreground">Approval table & visitor passes</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/security/dashboard"
                className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300">
                    <DoorOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">Guard Terminal View</p>
                    <p className="text-xs text-muted-foreground">QR scanner & gate check-in</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>

            <Separator />

            <div className="rounded-xl bg-muted/60 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Server className="h-4 w-4 text-primary" />
                <span>Security Engine Status</span>
              </div>
              <div className="text-[12px] space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>RBAC Enforcement:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Strict (Tier 1)</span>
                </div>
                <div className="flex justify-between">
                  <span>Token Signature:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">HMAC-SHA256</span>
                </div>
                <div className="flex justify-between">
                  <span>Session Cookie:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">HttpOnly / SameSite</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
