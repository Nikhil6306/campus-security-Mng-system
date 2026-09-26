"use client";

import * as React from "react";
import { BadgeCheck, Inbox, LayoutGrid, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, CardsLoadingState } from "@/components/shared/states";
import { FilterBar } from "@/components/admin/filter-bar";
import { RequestCard } from "@/components/admin/request-card";
import { VisitTable } from "@/components/admin/visit-table";
import { useVisitDialogs } from "@/components/admin/visit-actions";
import { useData } from "@/components/providers/data-provider";
import type { VisitRequest } from "@/lib/types";

type TabValue = "all" | "Pending" | "Approved" | "Rejected";

const tabs: { value: TabValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

export default function VisitRequestsPage() {
  const { db, ready } = useData();
  const { handlers, dialogs } = useVisitDialogs();

  const [tab, setTab] = React.useState<TabValue>("Pending");
  const [search, setSearch] = React.useState("");
  const [view, setView] = React.useState<"grid" | "table">("grid");

  const requests = React.useMemo(
    () =>
      [...db.visitRequests].sort((a, b) => {
        // Oldest pending first — the queue should be worked front to back.
        if (a.status === "Pending" && b.status === "Pending")
          return a.createdAt.localeCompare(b.createdAt);
        return b.createdAt.localeCompare(a.createdAt);
      }),
    [db.visitRequests],
  );

  const counts = React.useMemo(
    () => ({
      all: requests.length,
      Pending: requests.filter((r) => r.status === "Pending").length,
      Approved: requests.filter((r) => r.status === "Approved").length,
      Rejected: requests.filter((r) => r.status === "Rejected").length,
    }),
    [requests],
  );

  const filterFor = React.useCallback(
    (value: TabValue): VisitRequest[] => {
      const query = search.trim().toLowerCase();
      return requests.filter((record) => {
        if (value !== "all" && record.status !== value) return false;
        if (!query) return true;
        return [record.id, record.fullName, record.mobile, record.hostName, record.department]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
    },
    [requests, search],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visit Requests"
        description="Review pre-booking requests and decide whether a visitor pass should be issued."
        actions={
          <div className="flex rounded-md border border-border p-0.5">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
            </Button>
            <Button
              variant={view === "table" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
            >
              <List className="h-3.5 w-3.5" />
              Table
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)}>
        <TabsList className="w-full sm:w-auto">
          {tabs.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
              <span className="rounded-full bg-muted-foreground/15 px-1.5 text-[10px] font-semibold tabular-nums">
                {counts[item.value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((item) => {
          const records = filterFor(item.value);
          return (
            <TabsContent key={item.value} value={item.value} className="space-y-4">
              <Card>
                <FilterBar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search by booking ID, visitor, host or department…"
                  resultCount={records.length}
                  totalCount={counts[item.value]}
                  isFiltered={search !== ""}
                  onReset={() => setSearch("")}
                />

                {view === "table" ? (
                  <VisitTable
                    records={records}
                    loading={!ready}
                    emptyTitle={`No ${item.value === "all" ? "" : item.label.toLowerCase()} requests found`.replace(
                      /\s+/g,
                      " ",
                    )}
                    emptyDescription="Requests submitted from the visitor portal appear here for review."
                    {...handlers}
                  />
                ) : (
                  <div className="p-4">
                    {!ready ? (
                      <CardsLoadingState count={3} />
                    ) : records.length === 0 ? (
                      <EmptyState
                        icon={item.value === "Pending" ? BadgeCheck : Inbox}
                        title={
                          item.value === "Pending"
                            ? "Approval queue is clear"
                            : `No ${item.label.toLowerCase()} requests`
                        }
                        description={
                          item.value === "Pending"
                            ? "Every visit request has been decided. New requests will appear here."
                            : "Requests submitted from the visitor portal appear here for review."
                        }
                      />
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {records.map((record) => (
                          <RequestCard
                            key={record.id}
                            record={record}
                            onView={handlers.onView}
                            onReject={handlers.onReject}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {dialogs}
    </div>
  );
}
