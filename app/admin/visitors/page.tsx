"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpDown, CalendarPlus, Download, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { InlineLoader } from "@/components/shared/states";
import { FilterBar } from "@/components/admin/filter-bar";
import { VisitTable } from "@/components/admin/visit-table";
import { useVisitDialogs } from "@/components/admin/visit-actions";
import { useData } from "@/components/providers/data-provider";
import { getDashboardStats } from "@/lib/selectors";
import { VISITOR_TYPES, VISIT_STATUSES } from "@/lib/types";
import { todayISO } from "@/lib/utils";

type SortKey = "recent" | "date-asc" | "date-desc" | "name";
type DateFilter = "all" | "today" | "upcoming" | "past" | "week";

function VisitorsView() {
  const params = useSearchParams();
  const { db, ready } = useData();
  const { handlers, dialogs } = useVisitDialogs();

  const [search, setSearch] = React.useState(params.get("q") ?? "");
  const [status, setStatus] = React.useState("all");
  const [visitorType, setVisitorType] = React.useState("all");
  const [dateFilter, setDateFilter] = React.useState<DateFilter>("all");
  const [sort, setSort] = React.useState<SortKey>("recent");

  const stats = React.useMemo(() => getDashboardStats(db), [db]);
  const today = todayISO();

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const weekAhead = todayISO(7);

    const rows = db.visitRequests.filter((record) => {
      if (query) {
        const haystack = [
          record.id,
          record.visitorId,
          record.fullName,
          record.mobile,
          record.email,
          record.organization,
          record.hostName,
          record.department,
          record.vehicleNumber ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (status !== "all" && record.status !== status) return false;
      if (visitorType !== "all" && record.visitorType !== visitorType) return false;

      if (dateFilter === "today" && record.visitDate !== today) return false;
      if (dateFilter === "upcoming" && record.visitDate <= today) return false;
      if (dateFilter === "past" && record.visitDate >= today) return false;
      if (dateFilter === "week" && (record.visitDate < today || record.visitDate > weekAhead))
        return false;

      return true;
    });

    const sorted = [...rows];
    if (sort === "recent") {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else if (sort === "date-asc") {
      sorted.sort((a, b) => `${a.visitDate}${a.visitTime}`.localeCompare(`${b.visitDate}${b.visitTime}`));
    } else if (sort === "date-desc") {
      sorted.sort((a, b) => `${b.visitDate}${b.visitTime}`.localeCompare(`${a.visitDate}${a.visitTime}`));
    } else {
      sorted.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }
    return sorted;
  }, [db.visitRequests, search, status, visitorType, dateFilter, sort, today]);

  const isFiltered =
    search !== "" || status !== "all" || visitorType !== "all" || dateFilter !== "all";

  const reset = () => {
    setSearch("");
    setStatus("all");
    setVisitorType("all");
    setDateFilter("all");
    setSort("recent");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitors"
        description="Every visitor record on campus — search, filter and act on any booking."
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Download className="h-4 w-4" />
              Print list
            </Button>
            <Button asChild>
              <Link href="/visitor/book" target="_blank">
                <CalendarPlus className="h-4 w-4" />
                New booking
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total records"
          value={db.visitRequests.length}
          icon={Users}
          loading={!ready}
        />
        <StatCard
          label="Today"
          value={stats.todayVisitors}
          icon={CalendarPlus}
          tone="accent"
          loading={!ready}
        />
        <StatCard
          label="Inside now"
          value={stats.currentlyInside}
          icon={Users}
          tone="success"
          loading={!ready}
        />
        <StatCard
          label="Pending"
          value={stats.pendingRequests}
          icon={Users}
          tone="warning"
          href="/admin/requests"
          loading={!ready}
        />
      </div>

      <Card>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, booking ID, mobile, host or vehicle…"
          resultCount={filtered.length}
          totalCount={db.visitRequests.length}
          isFiltered={isFiltered}
          onReset={reset}
          filters={[
            {
              id: "filter-status",
              label: "Status",
              value: status,
              onChange: setStatus,
              options: [
                { value: "all", label: "All statuses" },
                ...VISIT_STATUSES.map((s) => ({ value: s, label: s })),
              ],
            },
            {
              id: "filter-type",
              label: "Visitor type",
              value: visitorType,
              onChange: setVisitorType,
              options: [
                { value: "all", label: "All visitor types" },
                ...VISITOR_TYPES.map((t) => ({ value: t, label: t })),
              ],
              className: "min-w-[160px]",
            },
            {
              id: "filter-date",
              label: "Date",
              value: dateFilter,
              onChange: (value) => setDateFilter(value as DateFilter),
              options: [
                { value: "all", label: "All dates" },
                { value: "today", label: "Today" },
                { value: "week", label: "Next 7 days" },
                { value: "upcoming", label: "Upcoming" },
                { value: "past", label: "Past" },
              ],
            },
          ]}
        >
          <div className="min-w-[150px]">
            <label htmlFor="sort-visitors" className="sr-only">
              Sort records
            </label>
            <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
              <SelectTrigger id="sort-visitors" className="h-9 text-[13px]">
                <ArrowUpDown className="mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recently requested</SelectItem>
                <SelectItem value="date-asc">Visit date ↑</SelectItem>
                <SelectItem value="date-desc">Visit date ↓</SelectItem>
                <SelectItem value="name">Visitor name A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FilterBar>

        <VisitTable
          records={filtered}
          loading={!ready}
          variant="full"
          emptyTitle={isFiltered ? "No visitors match these filters" : "No visitor records yet"}
          emptyDescription={
            isFiltered
              ? "Clear the filters to see all visitor records."
              : "Bookings submitted from the visitor portal will appear here."
          }
          emptyAction={
            isFiltered ? (
              <Button variant="outline" size="sm" onClick={reset}>
                Clear filters
              </Button>
            ) : undefined
          }
          {...handlers}
        />
      </Card>

      {dialogs}
    </div>
  );
}

export default function VisitorsPage() {
  return (
    <Suspense fallback={<InlineLoader label="Loading visitors…" />}>
      <VisitorsView />
    </Suspense>
  );
}
