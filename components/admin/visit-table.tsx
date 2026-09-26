"use client";

import * as React from "react";
import { CalendarX2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrap,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState, TableLoadingState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { VisitRowActions } from "@/components/admin/visit-actions";
import { VisitorPhotoThumb } from "@/components/shared/visitor-photo";
import type { VisitRequest } from "@/lib/types";
import { cn, formatClock, formatDate, formatTime } from "@/lib/utils";

interface VisitTableProps {
  records: VisitRequest[];
  loading?: boolean;
  variant?: "compact" | "full";
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onView: (record: VisitRequest) => void;
  onReject: (record: VisitRequest) => void;
  onGate: (record: VisitRequest, mode: "in" | "out") => void;
  onReschedule?: (record: VisitRequest) => void;
}

function VisitorCell({ record, showId }: { record: VisitRequest; showId?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {/* The photograph taken at booking, so a row is recognisable at a glance.
          Falls back to initials for bookings made before photos were required. */}
      <VisitorPhotoThumb photoUrl={record.photoUrl} name={record.fullName} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{record.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {showId ? (
            <span className="font-mono">{record.id}</span>
          ) : (
            record.organization || record.visitorType
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * The console's primary list view. Rendered on the dashboard (compact) and on
 * the visitor / request pages (full), so every row exposes the same actions.
 */
export function VisitTable({
  records,
  loading,
  variant = "compact",
  emptyTitle = "No visitor records found",
  emptyDescription = "Try adjusting the filters, or wait for new visit requests to arrive.",
  emptyAction,
  onView,
  onReject,
  onGate,
  onReschedule,
}: VisitTableProps) {
  const full = variant === "full";

  if (loading) return <TableLoadingState rows={5} columns={full ? 7 : 5} />;

  if (records.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <TableWrap>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[190px]">Visitor</TableHead>
            {full && <TableHead className="min-w-[120px]">Mobile</TableHead>}
            <TableHead className="min-w-[150px]">Host</TableHead>
            <TableHead className="min-w-[110px]">Purpose</TableHead>
            <TableHead className="min-w-[120px]">Visit date</TableHead>
            <TableHead className="min-w-[90px]">Time</TableHead>
            {full && <TableHead className="min-w-[100px]">Check-in</TableHead>}
            {full && <TableHead className="min-w-[100px]">Check-out</TableHead>}
            <TableHead className="min-w-[120px]">Status</TableHead>
            <TableHead className="min-w-[150px] text-right">Action</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id} className="group">
              <TableCell>
                <VisitorCell record={record} showId={full} />
              </TableCell>

              {full && (
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {record.mobile}
                </TableCell>
              )}

              <TableCell>
                <p className="truncate text-sm">{record.hostName}</p>
                <p className="truncate text-xs text-muted-foreground">{record.department}</p>
              </TableCell>

              <TableCell>
                <Badge variant="secondary" size="sm">
                  {record.purpose}
                </Badge>
              </TableCell>

              <TableCell className="whitespace-nowrap text-sm">
                {formatDate(record.visitDate)}
              </TableCell>

              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {formatTime(record.visitTime)}
              </TableCell>

              {full && (
                <TableCell
                  className={cn(
                    "whitespace-nowrap text-sm",
                    record.checkInAt ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {formatClock(record.checkInAt)}
                </TableCell>
              )}

              {full && (
                <TableCell
                  className={cn(
                    "whitespace-nowrap text-sm",
                    record.checkOutAt ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {formatClock(record.checkOutAt)}
                </TableCell>
              )}

              <TableCell>
                <StatusBadge status={record.status} />
              </TableCell>

              <TableCell className="text-right">
                <VisitRowActions
                  record={record}
                  onView={onView}
                  onReject={onReject}
                  onGate={onGate}
                  onReschedule={onReschedule}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableWrap>
  );
}
