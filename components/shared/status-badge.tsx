import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Hourglass,
  LogIn,
  LogOut,
  MessagesSquare,
  ShieldAlert,
  ShieldCheck,
  UserX,
  XCircle,
} from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  EmergencyStatus,
  IncidentSeverity,
  IncidentStatus,
  MeetingStatus,
  OutingStatus,
  VehicleStatus,
  VisitStatus,
} from "@/lib/types";

type Config = { variant: BadgeProps["variant"]; icon: React.ElementType; label?: string };

const visitConfig: Record<VisitStatus, Config> = {
  Pending: { variant: "warning", icon: Clock3 },
  Approved: { variant: "success", icon: CheckCircle2 },
  Rejected: { variant: "destructive", icon: XCircle },
  Rescheduled: { variant: "warning", icon: CalendarClock },
  Cancelled: { variant: "muted", icon: Ban },
  // A checked-in visitor is on campus, which is what the gate and the
  // dashboards actually care about — so the badge says so.
  "Checked In": { variant: "accent", icon: LogIn, label: "Inside Campus" },
  "Meeting In Progress": { variant: "accent", icon: MessagesSquare, label: "In Meeting" },
  "Checked Out": { variant: "secondary", icon: LogOut },
  "No Show": { variant: "muted", icon: UserX },
  Expired: { variant: "muted", icon: Hourglass },
};

export function StatusBadge({
  status,
  className,
  showIcon = true,
}: {
  status: VisitStatus;
  className?: string;
  showIcon?: boolean;
}) {
  const config = visitConfig[status] ?? visitConfig.Pending;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className={cn("whitespace-nowrap", className)}>
      {showIcon && <Icon aria-hidden />}
      {config.label ?? status}
    </Badge>
  );
}

const meetingConfig: Record<MeetingStatus, Config> = {
  Requested: { variant: "warning", icon: Clock3 },
  Approved: { variant: "success", icon: CheckCircle2 },
  Rejected: { variant: "destructive", icon: XCircle },
  "In Progress": { variant: "accent", icon: MessagesSquare },
  Completed: { variant: "secondary", icon: CalendarCheck },
  Cancelled: { variant: "muted", icon: Ban },
};

export function MeetingStatusBadge({
  status,
  className,
}: {
  status: MeetingStatus;
  className?: string;
}) {
  const config = meetingConfig[status] ?? meetingConfig.Requested;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className={cn("whitespace-nowrap", className)}>
      <Icon aria-hidden />
      {status}
    </Badge>
  );
}

const severityConfig: Record<IncidentSeverity, BadgeProps["variant"]> = {
  Low: "secondary",
  Medium: "warning",
  High: "destructive",
  Critical: "destructive",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: IncidentSeverity;
  className?: string;
}) {
  return (
    <Badge
      variant={severityConfig[severity]}
      className={cn(
        severity === "Critical" && "bg-destructive text-destructive-foreground",
        className,
      )}
    >
      {(severity === "High" || severity === "Critical") && <AlertTriangle aria-hidden />}
      {severity}
    </Badge>
  );
}

const incidentStatusConfig: Record<IncidentStatus, Config> = {
  Open: { variant: "warning", icon: ShieldAlert },
  Investigating: { variant: "accent", icon: ShieldAlert },
  Resolved: { variant: "success", icon: ShieldCheck },
  Closed: { variant: "secondary", icon: ShieldCheck },
};

export function IncidentStatusBadge({
  status,
  className,
}: {
  status: IncidentStatus;
  className?: string;
}) {
  const config = incidentStatusConfig[status] ?? incidentStatusConfig.Open;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className={className}>
      <Icon aria-hidden />
      {status}
    </Badge>
  );
}

export function VehicleStatusBadge({
  status,
  className,
}: {
  status: VehicleStatus;
  className?: string;
}) {
  return (
    <Badge variant={status === "Inside" ? "accent" : "secondary"} className={className}>
      {status === "Inside" ? <LogIn aria-hidden /> : <LogOut aria-hidden />}
      {status}
    </Badge>
  );
}

export function EmergencyStatusBadge({
  status,
  className,
}: {
  status: EmergencyStatus;
  className?: string;
}) {
  const variant: BadgeProps["variant"] =
    status === "Active" ? "destructive" : status === "Acknowledged" ? "warning" : "success";
  return (
    <Badge variant={variant} className={className}>
      {status === "Resolved" ? <ShieldCheck aria-hidden /> : <ShieldAlert aria-hidden />}
      {status}
    </Badge>
  );
}

export function OutingStatusBadge({
  status,
  className,
}: {
  status: OutingStatus;
  className?: string;
}) {
  const variant: BadgeProps["variant"] =
    status === "Approved"
      ? "success"
      : status === "Rejected"
        ? "destructive"
        : status === "Completed"
          ? "secondary"
          : "warning";
  return (
    <Badge variant={variant} className={className}>
      {status}
    </Badge>
  );
}
