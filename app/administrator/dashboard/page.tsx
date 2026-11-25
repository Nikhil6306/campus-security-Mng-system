"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock,
  Crown,
  DoorOpen,
  FileBarChart,
  GraduationCap,
  History,
  Lock,
  LogIn,
  Radio,
  ScanLine,
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
import { VisitTable } from "@/components/admin/visit-table";
import { useVisitDialogs } from "@/components/admin/visit-actions";
import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { getDashboardStats, getNotifications, getVisitRequests } from "@/lib/selectors";
import type { ActivityLog, EmergencyAlert } from "@/lib/types";
import { cn, formatDateLong, formatTime, relativeTime, todayISO } from "@/lib/utils";

export default function AdministratorDashboardPage() {
  const { db, ready } = useData();
  const { session } = useAuth();
  const { handlers, dialogs } = useVisitDialogs();

  const stats = React.useMemo(() => getDashboardStats(db), [db]);
  const today = todayISO();

  const recentActivity = React.useMemo(() => getVisitRequests(db).slice(0, 8), [db]);

  const todayMeetings = React.useMemo(
    () =>
      db.visitRequests
        .filter((v) => v.visitDate === today && v.status !== "Cancelled")
        .sort((a, b) => a.visitTime.localeCompare(b.visitTime)),
    [db.visitRequests, today],
  );

  const highPriorityLogs = React.useMemo(() => {
    return (db.activity ?? []).slice(0, 6);
  }, [db.activity]);

  const activeAlerts = React.useMemo(() => {
    return (db.emergencies ?? []).filter((a: EmergencyAlert) => a.status === "Active");
  }, [db.emergencies]);

  const openIncidents = React.useMemo(
    () =>
      db.incidents
        .filter((i) => i.status !== "Resolved")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 4),
    [db.incidents],
  );

  const guardCount = (db.guards ?? []).length;
  const activeGuardCount = (db.guards ?? []).filter(
    (g) => g.status === "Active" || g.status === "On Duty",
  ).length;
  const facultyCount = (db.teachers ?? []).length;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* -------------------- Executive Administrator Welcome Banner -------------------- */}
      <section className="relative overflow-hidden rounded-2xl border border-navy-700/80 bg-gradient-to-br from-navy via-navy/95 to-slate-950 p-6 sm:p-8 text-white shadow-xl">
        <Image
          src="/assets/campus-aerial.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-15"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-saffron-500/20 border border-saffron-400/40 px-3 py-1 text-xs font-semibold text-saffron-300">
              <Crown className="h-3.5 w-3.5 text-saffron-400" />
              Administrator Executive Command · Dev Sanskriti Vishwavidyalaya
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight font-heading">
              {greeting}, {session?.name ?? "Administrator"}
            </h1>
            <p className="max-w-2xl text-sm sm:text-base text-slate-300">
              Master institutional security oversight, campus perimeter control, live gate telemetry,
              and policy administration for Dev Sanskriti Vishwavidyalaya.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs sm:text-sm">
              <Link href="/admin/activity">
                <History className="h-4 w-4 mr-2" />
                Audit Logs
              </Link>
            </Button>
            <Button asChild className="bg-saffron-500 hover:bg-saffron-600 text-white font-semibold shadow-md text-xs sm:text-sm">
              <Link href="/admin/settings">
                <Settings className="h-4 w-4 mr-2" />
                System Settings
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs sm:text-sm">
              <Link href="/admin/dashboard">
                <Shield className="h-4 w-4 mr-2" />
                Admin View
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* -------------------- Executive Key Metrics Hub -------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Campus Visitors Inside"
          value={stats.currentlyInside}
          hint={`${stats.headCountInside} total persons on campus`}
          icon={Users}
          tone="accent"
        />
        <StatCard
          label="Pending Visit Approvals"
          value={stats.pendingRequests}
          hint={stats.pendingRequests === 0 ? "Approval queue clear" : "Awaiting faculty/admin review"}
          icon={BadgeCheck}
          tone={stats.pendingRequests > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Security Alerts & Incidents"
          value={stats.securityAlerts}
          hint={`${stats.openIncidents} open incidents · ${stats.activeEmergencies} emergencies`}
          icon={ShieldAlert}
          tone={stats.securityAlerts > 0 ? "destructive" : "success"}
        />
        <StatCard
          label="Guard Force On Duty"
          value={`${activeGuardCount} / ${guardCount}`}
          hint={`${activeGuardCount} active guards on duty`}
          icon={ShieldCheck}
          tone="success"
        />
      </div>

      {/* -------------------- Quick Administrative Command Hub -------------------- */}
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
        <SectionHeader
          title="Administrator Management Modules"
          description="Direct access to core security, visitor control, staff directories, and reporting."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <Button asChild variant="outline" className="h-auto flex-col items-start gap-1 p-3 text-left">
            <Link href="/admin/visitors">
              <Users className="h-5 w-5 text-primary" />
              <span className="font-semibold text-xs mt-1">Visitor Registry</span>
              <span className="text-[11px] text-muted-foreground">Manage all records</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col items-start gap-1 p-3 text-left">
            <Link href="/admin/bookings">
              <CalendarDays className="h-5 w-5 text-blue-500" />
              <span className="font-semibold text-xs mt-1">Bookings</span>
              <span className="text-[11px] text-muted-foreground">Scheduled visits</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col items-start gap-1 p-3 text-left">
            <Link href="/admin/requests">
              <BadgeCheck className="h-5 w-5 text-amber-500" />
              <span className="font-semibold text-xs mt-1">Visit Requests</span>
              <span className="text-[11px] text-muted-foreground">{stats.pendingRequests} pending</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col items-start gap-1 p-3 text-left">
            <Link href="/admin/checkin">
              <ScanLine className="h-5 w-5 text-emerald-500" />
              <span className="font-semibold text-xs mt-1">Gate Operations</span>
              <span className="text-[11px] text-muted-foreground">Check-in / Check-out</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col items-start gap-1 p-3 text-left">
            <Link href="/admin/guard-duty">
              <ShieldCheck className="h-5 w-5 text-purple-500" />
              <span className="font-semibold text-xs mt-1">Guard Duty</span>
              <span className="text-[11px] text-muted-foreground">Shifts & handovers</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col items-start gap-1 p-3 text-left">
            <Link href="/admin/reports">
              <FileBarChart className="h-5 w-5 text-cyan-500" />
              <span className="font-semibold text-xs mt-1">Audit Reports</span>
              <span className="text-[11px] text-muted-foreground">Export CSV & stats</span>
            </Link>
          </Button>
        </div>
      </section>

      {/* -------------------- Main Dashboard Split: Live Activity & Status -------------------- */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Recent Visitor Activity & Requests (2/3 width) */}
        <section className="space-y-6 lg:col-span-2">
          <Card className="p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Master Visitor Activity & Requests
                </h2>
                <p className="text-xs text-muted-foreground">
                  Live database feed of visit requests, gate movements, and approvals.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/visitors">
                  View Full Registry
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>

            {recentActivity.length === 0 ? (
              <EmptyState
                title="No visitor records found"
                description="New visitor registrations and gate check-ins will appear here in real time."
              />
            ) : (
              <VisitTable
                records={recentActivity}
                onView={handlers.onView}
                onReject={handlers.onReject}
                onGate={handlers.onGate}
                onReschedule={handlers.onReschedule}
              />
            )}
          </Card>

          {/* Audit Logs Telemetry */}
          <Card className="p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Recent System Audit Trail
                </h2>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link href="/admin/activity">View All Logs</Link>
              </Button>
            </div>

            {highPriorityLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No recent activity logs.</p>
            ) : (
              <div className="divide-y divide-border">
                {highPriorityLogs.map((log: ActivityLog) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{log.summary}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Actor: <span className="font-semibold">{log.actorName}</span> · Action: <code>{log.action}</code>
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{relativeTime(log.at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* Right Column: Campus Status, Today's Meetings & Incidents (1/3 width) */}
        <div className="space-y-6">
          {/* Active Emergency Card */}
          {activeAlerts.length > 0 && (
            <Card className="border-destructive/40 bg-destructive/5 p-5 shadow-xs">
              <div className="flex items-center gap-2 text-destructive font-bold text-sm mb-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Active Campus Alerts ({activeAlerts.length})
              </div>
              <div className="space-y-2">
                {activeAlerts.map((a: EmergencyAlert) => (
                  <div key={a.id} className="rounded-md bg-background/80 p-3 border text-xs">
                    <p className="font-semibold text-foreground">{a.type} Emergency</p>
                    <p className="text-muted-foreground mt-0.5">{a.note || a.type}</p>
                    <p className="text-[10px] text-destructive font-mono mt-1">Location: {a.location}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Today's Meetings Schedule */}
          <Card className="p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Today&apos;s Faculty Meetings</h3>
              </div>
              <Badge variant="secondary" className="text-xs">
                {todayMeetings.length}
              </Badge>
            </div>

            {todayMeetings.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No meetings scheduled for today.</p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto scrollbar-slim">
                {todayMeetings.slice(0, 6).map((m) => (
                  <div key={m.id} className="rounded-lg border bg-muted/20 p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{m.fullName}</span>
                      <span className="text-muted-foreground font-mono">{formatTime(m.visitTime)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Host: {m.hostName || "Department Host"} · {m.department}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Open Incidents */}
          <Card className="p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold text-foreground">Open Incidents</h3>
              </div>
              <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                <Link href="/admin/incidents">All</Link>
              </Button>
            </div>

            {openIncidents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No open security incidents.</p>
            ) : (
              <div className="space-y-2">
                {openIncidents.map((inc) => (
                  <div key={inc.id} className="rounded-lg border p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold truncate">{inc.title}</span>
                      <SeverityBadge severity={inc.severity} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">{inc.description}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Render visit action dialogs (approve, reject, reschedule) */}
      {dialogs}
    </div>
  );
}
