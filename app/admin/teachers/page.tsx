"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Building2, CalendarDays, DoorClosed, Mail, Phone, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { CardsLoadingState, EmptyState, InlineLoader } from "@/components/shared/states";
import { FilterBar } from "@/components/admin/filter-bar";
import { useData } from "@/components/providers/data-provider";
import { initials, todayISO } from "@/lib/utils";

function TeachersView() {
  const params = useSearchParams();
  const { db, ready } = useData();

  const [search, setSearch] = React.useState(params.get("q") ?? "");
  const [department, setDepartment] = React.useState("all");

  const today = todayISO();

  const departments = React.useMemo(
    () => [...new Set(db.teachers.map((t) => t.department))].sort(),
    [db.teachers],
  );

  const meetingCounts = React.useMemo(() => {
    const map = new Map<string, { today: number; upcoming: number; pending: number }>();
    db.visitRequests.forEach((visit) => {
      if (!visit.hostId) return;
      const entry = map.get(visit.hostId) ?? { today: 0, upcoming: 0, pending: 0 };
      if (visit.visitDate === today && visit.status !== "Cancelled") entry.today += 1;
      if (visit.visitDate > today && visit.status !== "Cancelled") entry.upcoming += 1;
      if (visit.status === "Pending") entry.pending += 1;
      map.set(visit.hostId, entry);
    });
    return map;
  }, [db.visitRequests, today]);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return db.teachers.filter((teacher) => {
      if (department !== "all" && teacher.department !== department) return false;
      if (!query) return true;
      return [teacher.name, teacher.email, teacher.department, teacher.designation]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [db.teachers, search, department]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teachers & Staff"
        description="Campus hosts who can receive visitor meeting requests."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Staff members" value={db.teachers.length} icon={Users} loading={!ready} />
        <StatCard label="Departments" value={departments.length} icon={Building2} loading={!ready} />
        <StatCard
          label="Available today"
          value={db.teachers.filter((t) => t.available).length}
          icon={CalendarDays}
          tone="success"
          loading={!ready}
        />
        <StatCard
          label="Meetings today"
          value={db.visitRequests.filter((v) => v.visitDate === today && v.hostId).length}
          icon={CalendarDays}
          tone="accent"
          href="/admin/meetings"
          loading={!ready}
        />
      </div>

      <Card>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, department or designation…"
          resultCount={filtered.length}
          totalCount={db.teachers.length}
          isFiltered={search !== "" || department !== "all"}
          onReset={() => {
            setSearch("");
            setDepartment("all");
          }}
          filters={[
            {
              id: "teacher-department",
              label: "Department",
              value: department,
              onChange: setDepartment,
              options: [
                { value: "all", label: "All departments" },
                ...departments.map((d) => ({ value: d, label: d })),
              ],
              className: "min-w-[190px]",
            },
          ]}
        />

        <div className="p-4">
          {!ready ? (
            <CardsLoadingState count={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No staff match this search"
              description="Clear the filters to see the full staff directory."
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((teacher) => {
                const counts = meetingCounts.get(teacher.id) ?? {
                  today: 0,
                  upcoming: 0,
                  pending: 0,
                };
                return (
                  <li key={teacher.id}>
                    <article className="flex h-full flex-col rounded-lg border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-md">
                      <header className="flex items-start gap-3">
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                          aria-hidden
                        >
                          {initials(teacher.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold">{teacher.name}</h3>
                          <p className="truncate text-xs text-muted-foreground">
                            {teacher.designation}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {teacher.department}
                          </p>
                        </div>
                        <Badge variant={teacher.available ? "success" : "muted"}>
                          {teacher.available ? "Available" : "Unavailable"}
                        </Badge>
                      </header>

                      <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <dd className="truncate">{teacher.email}</dd>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <dd className="font-mono">{teacher.phone}</dd>
                        </div>
                        <div className="flex items-center gap-2">
                          <DoorClosed className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <dd className="truncate">{teacher.room}</dd>
                        </div>
                      </dl>

                      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                        {[
                          { label: "Today", value: counts.today },
                          { label: "Upcoming", value: counts.upcoming },
                          { label: "Pending", value: counts.pending },
                        ].map((stat) => (
                          <div key={stat.label}>
                            <p className="text-base font-semibold tabular-nums">{stat.value}</p>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              {stat.label}
                            </p>
                          </div>
                        ))}
                      </div>

                      <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                        <Link href={`/admin/meetings`}>
                          <CalendarDays className="h-3.5 w-3.5" />
                          View meetings
                        </Link>
                      </Button>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function TeachersPage() {
  return (
    <Suspense fallback={<InlineLoader label="Loading staff directory…" />}>
      <TeachersView />
    </Suspense>
  );
}
