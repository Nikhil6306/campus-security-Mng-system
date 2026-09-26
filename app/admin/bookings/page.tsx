"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BookMarked, Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrap,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toaster";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState, InlineLoader, TableLoadingState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilterBar } from "@/components/admin/filter-bar";
import { VisitDetailDialog } from "@/components/admin/visit-actions";
import { useData } from "@/components/providers/data-provider";
import { downloadCsv, stampedFilename } from "@/lib/export";
import { VISIT_STATUSES, type VisitRequest } from "@/lib/types";
import { durationBetween, formatDate, formatDateTime, formatTime } from "@/lib/utils";

/**
 * The booking register: one auditable row per booking with every lifecycle
 * timestamp. Complements `/admin/requests` (the decision queue) and
 * `/admin/visitors` (the people-centric view).
 */
function BookingsView() {
  const params = useSearchParams();
  const { db, ready } = useData();

  const [search, setSearch] = React.useState(params.get("q") ?? "");
  const [status, setStatus] = React.useState("all");
  const [source, setSource] = React.useState("all");
  const [selected, setSelected] = React.useState<VisitRequest | null>(null);

  const sources = React.useMemo(
    () => [...new Set(db.visitRequests.map((v) => v.source))],
    [db.visitRequests],
  );

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return db.visitRequests
      .filter((record) => {
        if (status !== "all" && record.status !== status) return false;
        if (source !== "all" && record.source !== source) return false;
        if (!query) return true;
        return [record.id, record.fullName, record.mobile, record.hostName, record.department]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db.visitRequests, search, status, source]);

  const isFiltered = search !== "" || status !== "all" || source !== "all";

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error("Nothing to export with the current filters.");
      return;
    }
    downloadCsv(stampedFilename("booking-register"), filtered, [
      { header: "Booking ID", value: (r) => r.id },
      { header: "Visitor ID", value: (r) => r.visitorId },
      { header: "Visitor", value: (r) => r.fullName },
      { header: "Mobile", value: (r) => r.mobile },
      { header: "Email", value: (r) => r.email },
      { header: "Visitor type", value: (r) => r.visitorType },
      { header: "ID type", value: (r) => r.idType },
      { header: "ID number", value: (r) => r.idNumber },
      { header: "Organization", value: (r) => r.organization },
      { header: "Host", value: (r) => r.hostName },
      { header: "Department", value: (r) => r.department },
      { header: "Purpose", value: (r) => r.purpose },
      { header: "Visit date", value: (r) => r.visitDate },
      { header: "Visit time", value: (r) => r.visitTime },
      { header: "Visitors", value: (r) => r.numberOfVisitors },
      { header: "Vehicle", value: (r) => (r.vehicleRequired ? r.vehicleNumber : "") },
      { header: "Status", value: (r) => r.status },
      { header: "Source", value: (r) => r.source },
      { header: "Requested at", value: (r) => r.createdAt },
      { header: "Decided at", value: (r) => r.decidedAt ?? "" },
      { header: "Decided by", value: (r) => r.decidedBy ?? "" },
      { header: "Rejection reason", value: (r) => r.rejectionReason ?? "" },
      { header: "Checked in", value: (r) => r.checkInAt ?? "" },
      { header: "Checked out", value: (r) => r.checkOutAt ?? "" },
      { header: "Gate", value: (r) => r.gate ?? "" },
      { header: "Badge", value: (r) => r.badgeNumber ?? "" },
    ]);
    toast.success("Booking register exported.", {
      description: `${filtered.length} record${filtered.length === 1 ? "" : "s"} downloaded as CSV.`,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="The complete booking register — every request with its decision and gate timestamps."
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total bookings"
          value={db.visitRequests.length}
          icon={BookMarked}
          loading={!ready}
        />
        <StatCard
          label="Completed visits"
          value={db.visitRequests.filter((v) => v.status === "Checked Out").length}
          icon={BookMarked}
          tone="success"
          loading={!ready}
        />
        <StatCard
          label="Open bookings"
          value={
            db.visitRequests.filter((v) =>
              ["Pending", "Approved", "Checked In"].includes(v.status),
            ).length
          }
          icon={BookMarked}
          tone="accent"
          loading={!ready}
        />
        <StatCard
          label="Closed without visit"
          value={
            db.visitRequests.filter((v) => ["Rejected", "Cancelled"].includes(v.status)).length
          }
          icon={BookMarked}
          tone="warning"
          loading={!ready}
        />
      </div>

      <Card>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search booking ID, visitor, host or department…"
          resultCount={filtered.length}
          totalCount={db.visitRequests.length}
          isFiltered={isFiltered}
          onReset={() => {
            setSearch("");
            setStatus("all");
            setSource("all");
          }}
          filters={[
            {
              id: "booking-status",
              label: "Status",
              value: status,
              onChange: setStatus,
              options: [
                { value: "all", label: "All statuses" },
                ...VISIT_STATUSES.map((s) => ({ value: s, label: s })),
              ],
            },
            {
              id: "booking-source",
              label: "Source",
              value: source,
              onChange: setSource,
              options: [
                { value: "all", label: "All sources" },
                ...sources.map((s) => ({ value: s, label: s })),
              ],
              className: "min-w-[160px]",
            },
          ]}
        />

        {!ready ? (
          <TableLoadingState rows={6} columns={7} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={BookMarked}
            title={isFiltered ? "No bookings match these filters" : "No bookings recorded"}
            description={
              isFiltered
                ? "Clear the filters to see the full register."
                : "Bookings created from the visitor portal will be listed here."
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[150px]">Booking</TableHead>
                  <TableHead className="min-w-[170px]">Visitor</TableHead>
                  <TableHead className="min-w-[140px]">Party &amp; purpose</TableHead>
                  <TableHead className="min-w-[150px]">Host</TableHead>
                  <TableHead className="min-w-[130px]">Scheduled</TableHead>
                  <TableHead className="min-w-[150px]">Requested</TableHead>
                  <TableHead className="min-w-[150px]">Decision</TableHead>
                  <TableHead className="min-w-[150px]">On campus</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                  <TableHead className="min-w-[90px] text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <p className="font-mono text-xs font-semibold">{record.id}</p>
                      <p className="text-[11px] text-muted-foreground">{record.source}</p>
                    </TableCell>
                    <TableCell>
                      <p className="truncate text-sm font-medium">{record.fullName}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {record.mobile}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="whitespace-nowrap text-sm font-medium">
                        {record.numberOfVisitors}{" "}
                        {record.numberOfVisitors === 1 ? "visitor" : "visitors"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{record.purpose}</p>
                    </TableCell>
                    <TableCell>
                      <p className="truncate text-sm">{record.hostName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {record.department}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(record.visitDate)}
                      <span className="block text-xs text-muted-foreground">
                        {formatTime(record.visitTime)}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(record.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {record.decidedAt ? (
                        <>
                          {formatDateTime(record.decidedAt)}
                          <span className="block">{record.decidedBy}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {record.checkInAt ? (
                        <>
                          {formatDateTime(record.checkInAt)}
                          <span className="block">
                            {durationBetween(record.checkInAt, record.checkOutAt)}
                            {record.checkOutAt ? " total" : " so far"}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={record.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="xs" onClick={() => setSelected(record)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <VisitDetailDialog
        record={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<InlineLoader label="Loading bookings…" />}>
      <BookingsView />
    </Suspense>
  );
}
