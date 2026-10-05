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
import { formatDate } from "@/lib/utils";
import { maskAadhaar } from "@/lib/validation";

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

function VisitorCell({ record }: { record: VisitRequest }) {
  const photoUrl = record.photoPath || record.photoUrl;
  return (
    <div className="flex items-center gap-3">
      <VisitorPhotoThumb photoUrl={photoUrl} name={record.fullName} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{record.fullName}</p>
        <p className="truncate text-xs font-mono text-muted-foreground">{record.id}</p>
      </div>
    </div>
  );
}

/**
 * Simplified Admin/Security Visitor Table.
 */
export function VisitTable({
  records,
  loading,
  variant: _variant = "compact",
  emptyTitle = "No visitor records found",
  emptyDescription = "Try adjusting the search criteria or wait for new visitor entries.",
  emptyAction,
  onView,
  onReject,
  onGate,
  onReschedule,
}: VisitTableProps) {
  if (loading) return <TableLoadingState rows={5} columns={8} />;

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
            <TableHead className="min-w-[180px]">Visitor</TableHead>
            <TableHead className="min-w-[130px]">Masked Aadhaar</TableHead>
            <TableHead className="min-w-[120px]">Mobile</TableHead>
            <TableHead className="min-w-[70px]">Car</TableHead>
            <TableHead className="min-w-[120px]">Car Number</TableHead>
            <TableHead className="min-w-[130px]">Registration Date</TableHead>
            <TableHead className="min-w-[110px]">Status</TableHead>
            <TableHead className="min-w-[130px] text-right">Action</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {records.map((record) => {
            const aadhaar = record.aadhaarNumber || record.idNumber || "";
            const mobile = record.mobileNumber || record.mobile || "";
            const hasCar = record.hasCar || Boolean(record.vehicleRequired);
            const carNumber = record.carNumber || record.vehicleNumber || "";

            return (
              <TableRow key={record.id} className="group">
                <TableCell>
                  <VisitorCell record={record} />
                </TableCell>

                <TableCell className="font-mono text-xs text-muted-foreground">
                  {maskAadhaar(aadhaar)}
                </TableCell>

                <TableCell className="font-mono text-xs text-muted-foreground">
                  {mobile}
                </TableCell>

                <TableCell>
                  <Badge variant={hasCar ? "default" : "outline"} size="sm">
                    {hasCar ? "Yes" : "No"}
                  </Badge>
                </TableCell>

                <TableCell className="font-mono text-xs uppercase">
                  {hasCar && carNumber ? carNumber : "—"}
                </TableCell>

                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDate(record.createdAt || record.visitDate || "")}
                </TableCell>

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
            );
          })}
        </TableBody>
      </Table>
    </TableWrap>
  );
}
