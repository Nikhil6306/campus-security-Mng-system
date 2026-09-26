"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  Car,
  ClipboardList,
  Clock,
  DoorOpen,
  LogIn,
  ScanLine,
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
import { cn, formatDateLong, formatTime, relativeTime, todayISO } from "@/lib/utils";

export default function AdminDashboardPage() {
  const { db, ready } = useData();
  const { session } = useAuth();
  const { handlers, dialogs } = useVisitDialogs();

  const stats = React.useMemo(() => getDashboardStats(db), [db]);
  const today = todayISO();

  const recentActivity = React.useMemo(() => getVisitRequests(db).slice(0, 6), [db]);

  const todayMeetings = React.useMemo(
    () =>
      db.visitRequests
        .filter((v) => v.visitDate === today && v.status !== "Cancelled")
        .sort((a, b) => a.visitTime.localeCompare(b.visitTime)),
    [db.visitRequests, today],
  );

  const openIncidents = React.useMemo(
    () =>
      db.incidents
        .filter((i) => i.status !== "Resolved")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 4),
    [db.incidents],
  );

  const recentNotifications = React.useMemo(() => getNotifications(db).slice(0, 5), [db]);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  const securityRows = [
    {
      label: "Campus entry status",
      value: stats.activeEmergencies > 0 ? "Restricted" : "Open — normal operations",
      tone: stats.activeEmergencies > 0 ? "destructive" : "success",
      icon: DoorOpen,
    },
    {
      label: "Visitors inside",
      value: `${stats.currentlyInside} bookings · ${stats.headCountInside} people`,
      tone: "accent",
      icon: Users,
    },
    {
      label: "Pending approvals",
      value: stats.pendingRequests === 0 ? "Queue clear" : `${stats.pendingRequests} awaiting review`,
      tone: stats.pendingRequests > 0 ? "warning" : "success",
      icon: BadgeCheck,
    },
    {
      label: "Active alerts",
      value:
        stats.securityAlerts === 0
          ? "No open alerts"
          : `${stats.openIncidents} incidents · ${stats.activeEmergencies} emergencies`,
      tone: stats.securityAlerts > 0 ? "destructive" : "success",
      icon: ShieldAlert,
    },
  ] as const;

  const toneClass = {
    success: "bg-success/12 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/12 text-destructive",
    accent: "bg-accent/12 text-accent",
  } as const;

  return (
    <div className="space-y-6">
      {/* --------------------------- Welcome band --------------------------- */}
      <section className="relative overflow-hidden rounded-lg border border-border bg-navy">
        <Image
          src="/assets/campus-aerial.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-20"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/92 to-navy/60" />

        <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-cyanx-400">
              {formatDateLong(today)}
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {greeting}, {session?.name?.split(" ").slice(-1)[0] ?? "Administrator"}
            </h1>
            <p className="max-w-xl text-sm text-white/70">
              {stats.pendingRequests > 0
                ? `${stats.pendingRequests} visit request${stats.pendingRequests === 1 ? "" : "s"} need your review, and ${stats.currentlyInside} visitor${stats.currentlyInside === 1 ? " is" : "s are"} currently inside campus.`
                : `The approval queue is clear. ${stats.currentlyInside} visitor${stats.currentlyInside === 1 ? " is" : "s are"} currently inside campus.`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="bg-white text-navy hover:bg-white/90">
              <Link href="/admin/checkin">
                <ScanLine className="h-4 w-4" />
                Check-in desk
              </Link>
            </Button>
            <Button asChild size="sm" variant="onNavy">
              <Link href="/admin/requests">
                <BadgeCheck className="h-4 w-4" />
                Approval queue
              </Link>
            </Button>
            <Button asChild size="sm" variant="onNavy">
              <Link href="/admin/emergency">
                <ShieldAlert className="h-4 w-4" />
                Emergency
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ------------------------------- KPIs ------------------------------- */}
      <section aria-label="Key figures">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <StatCard
            label="Today's Visitors"
            value={stats.todayVisitors}
            hint="Visits scheduled for today"
            icon={Users}
            href="/admin/visitors"
            loading={!ready}
          />
          <StatCard
            label="Pending Requests"
            value={stats.pendingRequests}
            hint="Awaiting host approval"
            icon={Clock}
            tone="warning"
            href="/admin/requests"
            loading={!ready}
          />
          <StatCard
            label="Currently Inside"
            value={stats.currentlyInside}
            hint={`${stats.headCountInside} people on campus`}
            icon={LogIn}
            tone="accent"
            href="/admin/checkin"
            loading={!ready}
          />
          <StatCard
            label="Today's Meetings"
            value={stats.todayMeetings}
            hint="Approved for today"
            icon={CalendarDays}
            href="/admin/meetings"
            loading={!ready}
          />
          <StatCard
            label="Vehicles Inside"
            value={stats.vehiclesInside}
            hint="Currently on campus"
            icon={Car}
            tone="accent"
            href="/admin/vehicles"
            loading={!ready}
          />
          <StatCard
            label="Security Alerts"
            value={stats.securityAlerts}
            hint="Open incidents and alerts"
            icon={ShieldAlert}
            tone={stats.securityAlerts > 0 ? "destructive" : "success"}
            href="/admin/incidents"
            loading={!ready}
          />
        </div>
      </section>

      {/* ---------------------------- Main grid ---------------------------- */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="min-w-0 space-y-6">
          <Card>
            <SectionHeader
              title="Visitor Activity"
              description="Most recent bookings and gate movements"
              actions={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/visitors">
                    View all
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              }
            />
            <VisitTable
              records={recentActivity}
              loading={!ready}
              emptyTitle="No visitor activity yet"
              emptyDescription="Bookings made from the visitor portal will appear here."
              {...handlers}
            />
          </Card>

          <Card>
            <SectionHeader
              title="Recent Incidents"
              description="Open and under-review reports"
              actions={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/incidents">
                    All incidents
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              }
            />
            {openIncidents.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No incidents reported"
                description="Every logged incident has been resolved."
              />
            ) : (
              <ul className="divide-y divide-border">
                {openIncidents.map((incident) => (
                  <li key={incident.id} className="flex gap-3 p-4">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                        incident.severity === "Critical" || incident.severity === "High"
                          ? "bg-destructive/12 text-destructive"
                          : "bg-warning/15 text-warning",
                      )}
                      aria-hidden
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{incident.type}</p>
                        <SeverityBadge severity={incident.severity} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {incident.location} · reported by {incident.reportedBy}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                        {relativeTime(incident.createdAt)}
                      </p>
                    </div>
                    <Button asChild variant="ghost" size="xs" className="shrink-0 self-start">
                      <Link href={`/admin/incidents?q=${incident.id}`}>Open</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ------------------------- Side column ------------------------- */}
        <div className="min-w-0 space-y-6">
          <Card>
            <SectionHeader title="Security Overview" description="Live campus posture" />
            <ul className="divide-y divide-border">
              {securityRows.map((row) => (
                <li key={row.label} className="flex items-center gap-3 p-4">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                      toneClass[row.tone],
                    )}
                    aria-hidden
                  >
                    <row.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {row.label}
                    </p>
                    <p className="truncate text-sm font-medium">{row.value}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionHeader
              title="Today's Meetings"
              description={formatDateLong(today)}
              actions={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/meetings">All</Link>
                </Button>
              }
            />
            {todayMeetings.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No meetings scheduled today"
                description="Approved visits for today will be listed here."
                className="py-10"
              />
            ) : (
              <ul className="divide-y divide-border">
                {todayMeetings.slice(0, 6).map((meeting) => (
                  <li key={meeting.id} className="flex items-start gap-3 p-4">
                    <span className="w-[62px] shrink-0 text-sm font-semibold tabular-nums">
                      {formatTime(meeting.visitTime)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{meeting.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {meeting.hostName} · {meeting.department}
                      </p>
                    </div>
                    <StatusBadge status={meeting.status} showIcon={false} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHeader
              title="Recent Notifications"
              actions={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/notifications">All</Link>
                </Button>
              }
            />
            <ul className="divide-y divide-border">
              {recentNotifications.map((notification) => (
                <li key={notification.id} className="flex items-start gap-3 p-4">
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      notification.read ? "bg-border" : "bg-primary",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{notification.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {notification.message}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                      {relativeTime(notification.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <p className="section-label mb-3">Quick actions</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/admin/checkin", label: "Check-In", icon: LogIn },
                { href: "/admin/vehicles", label: "Vehicle Entry", icon: Car },
                { href: "/admin/incidents", label: "Report Incident", icon: ClipboardList },
                { href: "/admin/notifications", label: "Notifications", icon: Bell },
              ].map((action) => (
                <Button key={action.href} asChild variant="outline" size="sm" className="justify-start">
                  <Link href={action.href}>
                    <action.icon className="h-4 w-4" />
                    {action.label}
                  </Link>
                </Button>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Gate operations view</p>
              <Badge variant="outline">
                <ShieldCheck aria-hidden />
                <Link href="/security" className="hover:underline">
                  Security Desk
                </Link>
              </Badge>
            </div>
          </Card>
        </div>
      </div>

      {dialogs}
    </div>
  );
}
