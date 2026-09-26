"use client";

import {
  Building2,
  CalendarDays,
  Car,
  Check,
  Clock,
  Eye,
  Mail,
  Phone,
  StickyNote,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { useVisitActions } from "@/components/admin/visit-actions";
import { VisitorPhotoThumb } from "@/components/shared/visitor-photo";
import type { VisitRequest } from "@/lib/types";
import { formatDate, formatDateTime, formatTime, relativeTime } from "@/lib/utils";

export function RequestCard({
  record,
  onView,
  onReject,
}: {
  record: VisitRequest;
  onView: (record: VisitRequest) => void;
  onReject: (record: VisitRequest) => void;
}) {
  const actions = useVisitActions();
  const pending = record.status === "Pending";

  return (
    <article className="flex h-full flex-col rounded-lg border border-border bg-card shadow-xs transition-shadow hover:shadow-md">
      <header className="flex items-start gap-3 p-4">
        <VisitorPhotoThumb
          photoUrl={record.photoUrl}
          name={record.fullName}
          size="md"
          className="h-10 w-10 text-xs"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{record.fullName}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {record.visitorType} · {record.organization}
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{record.id}</p>
        </div>
        <StatusBadge status={record.status} />
      </header>

      <Separator />

      <div className="flex-1 space-y-3 p-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2 flex items-start gap-2">
            <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <dt className="sr-only">Host</dt>
              <dd className="truncate font-medium">{record.hostName}</dd>
              <dd className="truncate text-xs text-muted-foreground">{record.department}</dd>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <dd className="truncate">{formatDate(record.visitDate)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <dd className="truncate">{formatTime(record.visitTime)}</dd>
          </div>

          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <dd className="truncate font-mono text-xs">{record.mobile}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <dd className="truncate">
              {record.numberOfVisitors} visitor{record.numberOfVisitors === 1 ? "" : "s"}
            </dd>
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <dd className="truncate text-xs">{record.email}</dd>
          </div>

          {record.vehicleRequired ? (
            <div className="col-span-2 flex items-center gap-2">
              <Car className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <dd className="truncate font-mono text-xs">{record.vehicleNumber}</dd>
            </div>
          ) : null}
        </dl>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" size="sm">
            {record.purpose}
          </Badge>
          <Badge variant="outline" size="sm">
            {record.expectedDuration}
          </Badge>
          <Badge variant="outline" size="sm">
            {record.source}
          </Badge>
        </div>

        {record.purposeDetail ? (
          <p className="line-clamp-2 rounded-md bg-muted/50 p-2.5 text-xs leading-relaxed text-muted-foreground">
            {record.purposeDetail}
          </p>
        ) : null}

        {record.notes ? (
          <p className="flex gap-2 text-xs text-muted-foreground">
            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">{record.notes}</span>
          </p>
        ) : null}

        {record.rejectionReason ? (
          <p className="rounded-md border border-destructive/25 bg-destructive/8 p-2.5 text-xs text-destructive">
            <span className="font-semibold">Rejected:</span> {record.rejectionReason}
          </p>
        ) : null}
      </div>

      <footer className="flex items-center gap-2 border-t border-border p-3">
        <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          {record.decidedAt
            ? `Decided ${formatDateTime(record.decidedAt)}`
            : `Requested ${relativeTime(record.createdAt)}`}
        </p>

        <Button variant="ghost" size="xs" onClick={() => onView(record)}>
          <Eye className="h-3.5 w-3.5" />
          View
        </Button>

        {pending && (
          <>
            <Button variant="outline" size="xs" onClick={() => onReject(record)}>
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
            <Button variant="success" size="xs" onClick={() => actions.approve(record)}>
              <Check className="h-3.5 w-3.5" />
              Approve
            </Button>
          </>
        )}
      </footer>
    </article>
  );
}
