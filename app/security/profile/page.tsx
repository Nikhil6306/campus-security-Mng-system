"use client";

import * as React from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Calendar,
  Clock,
  DoorOpen,
  Mail,
  MapPin,
  Phone,
  Shield,
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared/page-header";
import { InlineLoader, EmptyState } from "@/components/shared/states";
import { StatCard } from "@/components/shared/stat-card";
import { useAuth } from "@/components/providers/auth-provider";
import { formatDate, formatDateTime, initials } from "@/lib/utils";

interface GuardData {
  id: string;
  employeeId: string;
  fullName: string;
  phone: string;
  email: string;
  photoUrl?: string;
  shift: string;
  shiftStart: string;
  shiftEnd: string;
  assignedGate: string;
  status: string;
  joiningDate: string;
  emergencyContact: string;
  address: string;
  supervisorName?: string;
  createdAt: string;
}

interface ActivitySummary {
  checkIns: number;
  checkOuts: number;
  vehiclesHandled: number;
  incidentsReported: number;
  emergenciesHandled: number;
  lastActivityAt?: string;
}

interface ProfileData {
  guard: (GuardData & { supervisorName?: string }) | null;
  today: ActivitySummary | null;
  lifetime: ActivitySummary | null;
  message?: string;
}

const statusVariant: Record<string, "success" | "secondary" | "warning" | "destructive" | "muted"> = {
  Active: "success",
  "On Duty": "success",
  "Off Duty": "muted",
  "On Leave": "warning",
  Suspended: "destructive",
};

const shiftColors: Record<string, string> = {
  Morning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  Evening: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  Night: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
  General: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800",
};

function ProfileField({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | undefined | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

export default function GuardProfilePage() {
  const { session } = useAuth();
  const [data, setData] = React.useState<ProfileData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/guards/my-profile", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((envelope) => {
        if (envelope.ok) setData(envelope.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <InlineLoader label="Loading your profile…" />
      </div>
    );
  }

  if (!data?.guard) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
          <p className="text-sm text-muted-foreground">Your guard employment details.</p>
        </div>
        <EmptyState
          icon={User}
          title="Profile not linked"
          description={
            data?.message ??
            "Your account is not yet linked to a guard profile. If your registration is pending, please wait for admin approval."
          }
        />
      </div>
    );
  }

  const { guard, today, lifetime } = data;
  const todayDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary shadow-sm">
          {guard.photoUrl ? (
            <img
              src={guard.photoUrl}
              alt={guard.fullName}
              className="h-16 w-16 rounded-2xl object-cover"
            />
          ) : (
            initials(guard.fullName)
          )}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{guard.fullName}</h1>
            <Badge variant={statusVariant[guard.status] ?? "secondary"}>{guard.status}</Badge>
          </div>
          <p className="font-mono text-sm text-muted-foreground">{guard.employeeId}</p>
          <p className="text-sm text-muted-foreground">
            {guard.shift} Shift · {guard.shiftStart}–{guard.shiftEnd}
          </p>
        </div>
        <span
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${shiftColors[guard.shift] ?? "bg-muted"}`}
        >
          {guard.shift} Shift
        </span>
      </div>

      {/* Today's Activity Stats */}
      {today && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Check-ins today"
            value={today.checkIns}
            icon={UserCheck}
            tone="success"
          />
          <StatCard
            label="Check-outs today"
            value={today.checkOuts}
            icon={DoorOpen}
          />
          <StatCard
            label="Incidents reported"
            value={today.incidentsReported}
            icon={AlertTriangle}
            tone={today.incidentsReported > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Vehicles handled"
            value={today.vehiclesHandled}
            icon={Shield}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal & Contact Info */}
        <Card>
          <SectionHeader title="Personal Information" description="Your contact and identification details" />
          <div className="space-y-4 p-4 pt-0">
            <ProfileField icon={User} label="Full Name" value={guard.fullName} />
            <ProfileField icon={BadgeCheck} label="Employee ID" value={guard.employeeId} mono />
            <ProfileField icon={Phone} label="Phone" value={guard.phone} mono />
            <ProfileField icon={Mail} label="Email" value={guard.email} />
            <ProfileField icon={MapPin} label="Address" value={guard.address} />
            <ProfileField icon={Phone} label="Emergency Contact" value={guard.emergencyContact} mono />
          </div>
        </Card>

        {/* Employment Details */}
        <Card>
          <SectionHeader title="Employment Details" description="Your assignment and shift information" />
          <div className="space-y-4 p-4 pt-0">
            <ProfileField icon={DoorOpen} label="Assigned Gate / Location" value={guard.assignedGate} />
            <ProfileField icon={Clock} label="Shift Hours" value={`${guard.shiftStart} – ${guard.shiftEnd}`} />
            <ProfileField icon={Shield} label="Shift Type" value={guard.shift} />
            <ProfileField icon={Calendar} label="Joining Date" value={guard.joiningDate ? formatDate(guard.joiningDate) : undefined} />
            <ProfileField icon={Building2} label="Employment Status" value={guard.status} />
            {guard.supervisorName && (
              <ProfileField icon={UserCheck} label="Supervisor" value={guard.supervisorName} />
            )}
          </div>
        </Card>
      </div>

      {/* Lifetime Activity */}
      {lifetime && (
        <Card>
          <SectionHeader
            title="Lifetime Activity"
            description="Cumulative statistics for your account"
          />
          <div className="grid gap-4 p-4 pt-0 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Check-ins", value: lifetime.checkIns, icon: UserCheck },
              { label: "Total Check-outs", value: lifetime.checkOuts, icon: DoorOpen },
              { label: "Total Incidents", value: lifetime.incidentsReported, icon: AlertTriangle },
              { label: "Vehicles Handled", value: lifetime.vehiclesHandled, icon: Shield },
            ].map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center rounded-xl border border-border bg-muted/30 p-4 text-center"
              >
                <item.icon className="mb-2 h-5 w-5 text-primary" />
                <p className="text-2xl font-bold tabular-nums">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
          {lifetime.lastActivityAt && (
            <p className="px-4 pb-4 text-xs text-muted-foreground">
              Last activity: {formatDateTime(lifetime.lastActivityAt)}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
