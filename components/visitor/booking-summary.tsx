import {
  Building2,
  CalendarDays,
  Car,
  Clock,
  FileText,
  Mail,
  Phone,
  StickyNote,
  User,
  UserCheck,
  Users,
} from "lucide-react";

import { DetailRow } from "@/components/shared/form-field";
import { cn, formatDate, formatTime } from "@/lib/utils";
import type { VisitRequest } from "@/lib/types";

export type BookingDraft = Partial<VisitRequest> &
  Pick<VisitRequest, "fullName" | "mobile" | "visitDate" | "visitTime">;

function Group({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {title}
      </h3>
      <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

/** Read-only summary of a booking — shared by the review step and status page. */
export function BookingSummary({
  data,
  className,
}: {
  data: BookingDraft;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      <Group title="Visitor details" icon={User}>
        <DetailRow label="Full name" value={data.fullName} />
        <DetailRow label="Visitor type" value={data.visitorType} />
        <DetailRow
          label="Mobile number"
          value={
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {data.mobile}
            </span>
          }
        />
        <DetailRow
          label="Email"
          value={
            data.email ? (
              <span className="flex items-center gap-1.5 break-all">
                <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {data.email}
              </span>
            ) : (
              "—"
            )
          }
        />
        <DetailRow label="ID type" value={data.idType} />
        <DetailRow label="ID number" value={data.idNumber} mono />
        <DetailRow label="Organization" value={data.organization} className="sm:col-span-2" />
      </Group>

      <Group title="Visit details" icon={FileText}>
        <DetailRow label="Purpose" value={data.purpose} />
        <DetailRow
          label="Person to meet"
          value={
            <span className="flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {data.hostName}
            </span>
          }
        />
        <DetailRow
          label="Department"
          value={
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {data.department}
            </span>
          }
        />
        <DetailRow label="Expected duration" value={data.expectedDuration} />
        <DetailRow
          label="Visit date"
          value={
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {formatDate(data.visitDate)}
            </span>
          }
        />
        <DetailRow
          label="Visit time"
          value={
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {formatTime(data.visitTime)}
            </span>
          }
        />
        {data.purposeDetail ? (
          <DetailRow
            label="Purpose details"
            value={data.purposeDetail}
            className="sm:col-span-2"
          />
        ) : null}
      </Group>

      <Group title="Additional information" icon={StickyNote}>
        <DetailRow
          label="Number of visitors"
          value={
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {data.numberOfVisitors ?? 1}
            </span>
          }
        />
        <DetailRow
          label="Vehicle"
          value={
            data.vehicleRequired ? (
              <span className="flex items-center gap-1.5 font-mono">
                <Car className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                {data.vehicleNumber}
              </span>
            ) : (
              "Not required"
            )
          }
        />
        <DetailRow
          label="Additional notes"
          value={data.notes || "—"}
          className="sm:col-span-2"
        />
      </Group>
    </div>
  );
}
