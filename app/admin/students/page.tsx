"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  DoorOpen,
  GraduationCap,
  LogIn,
  LogOut,
  MapPin,
  Phone,
  UserCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrap,
} from "@/components/ui/table";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState, InlineLoader, TableLoadingState } from "@/components/shared/states";
import { OutingStatusBadge } from "@/components/shared/status-badge";
import { FilterBar } from "@/components/admin/filter-bar";
import { useData } from "@/components/providers/data-provider";
import { useAction } from "@/components/providers/use-action";
import { api } from "@/lib/api";
import { formatDate, formatDateTime, initials } from "@/lib/utils";

function StudentsView() {
  const params = useSearchParams();
  const { db, ready } = useData();
  const act = useAction();

  const [search, setSearch] = React.useState(params.get("q") ?? "");
  const [presence, setPresence] = React.useState("all");

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return db.students.filter((student) => {
      if (presence === "in" && !student.onCampus) return false;
      if (presence === "out" && student.onCampus) return false;
      if (!query) return true;
      return [student.name, student.rollNo, student.department, student.hostel, student.guardianName]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [db.students, search, presence]);

  const pendingOutings = React.useMemo(
    () => db.outings.filter((o) => o.status === "Pending"),
    [db.outings],
  );

  const recentMovements = React.useMemo(
    () => [...db.movements].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8),
    [db.movements],
  );

  const onCampus = db.students.filter((s) => s.onCampus).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Student directory, hostel outing approvals and campus movement history."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Students" value={db.students.length} icon={GraduationCap} loading={!ready} />
        <StatCard label="On campus" value={onCampus} icon={UserCheck} tone="success" loading={!ready} />
        <StatCard
          label="Outside campus"
          value={db.students.length - onCampus}
          icon={DoorOpen}
          tone="accent"
          loading={!ready}
        />
        <StatCard
          label="Pending outing requests"
          value={pendingOutings.length}
          icon={LogOut}
          tone="warning"
          loading={!ready}
        />
      </div>

      <Card>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, roll number, hostel or guardian…"
          resultCount={filtered.length}
          totalCount={db.students.length}
          isFiltered={search !== "" || presence !== "all"}
          onReset={() => {
            setSearch("");
            setPresence("all");
          }}
          filters={[
            {
              id: "student-presence",
              label: "Presence",
              value: presence,
              onChange: setPresence,
              options: [
                { value: "all", label: "All students" },
                { value: "in", label: "On campus" },
                { value: "out", label: "Outside campus" },
              ],
            },
          ]}
        />

        {!ready ? (
          <TableLoadingState rows={5} columns={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No students match this search"
            description="Clear the filters to see the full student directory."
          />
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[200px]">Student</TableHead>
                  <TableHead className="min-w-[120px]">Roll no.</TableHead>
                  <TableHead className="min-w-[170px]">Department</TableHead>
                  <TableHead className="min-w-[150px]">Hostel</TableHead>
                  <TableHead className="min-w-[180px]">Guardian</TableHead>
                  <TableHead className="min-w-[120px]">Presence</TableHead>
                  <TableHead className="min-w-[150px] text-right">Movement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
                          aria-hidden
                        >
                          {initials(student.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{student.name}</p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            {student.id}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{student.rollNo}</TableCell>
                    <TableCell className="text-sm">
                      {student.department}
                      <span className="block text-xs text-muted-foreground">{student.year}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        {student.hostel}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Room {student.room}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {student.guardianName}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" aria-hidden />
                        {student.guardianPhone}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.onCampus ? "success" : "secondary"}>
                        {student.onCampus ? "On campus" : "Outside"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          void act(
                            () =>
                              api.logMovement({
                                personId: student.id,
                                personName: student.name,
                                personType: "Student",
                                direction: student.onCampus ? "Exit" : "Entry",
                                gate: "Main Gate",
                              }),
                            {
                              success: student.onCampus ? "Exit recorded." : "Entry recorded.",
                              description: `${student.name} at Main Gate.`,
                              fallback: "Unable to record this movement. Please try again.",
                            },
                          );
                        }}
                      >
                        {student.onCampus ? (
                          <>
                            <LogOut className="h-3.5 w-3.5" />
                            Record exit
                          </>
                        ) : (
                          <>
                            <LogIn className="h-3.5 w-3.5" />
                            Record entry
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionHeader
            title="Outing & leave requests"
            description="Guardian-approved requests still need a warden decision"
          />
          {db.outings.length === 0 ? (
            <EmptyState
              icon={DoorOpen}
              title="No outing requests"
              description="Requests raised from the student portal will appear here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {db.outings.map((outing) => (
                <li key={outing.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{outing.studentName}</p>
                      <Badge variant="secondary" size="sm">
                        {outing.type}
                      </Badge>
                      <OutingStatusBadge status={outing.status} />
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {outing.reason}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDate(outing.fromDate)} – {formatDate(outing.toDate)} ·{" "}
                      {outing.guardianApproved ? (
                        <span className="text-success">Guardian approved</span>
                      ) : (
                        <span className="text-warning">Awaiting guardian approval</span>
                      )}
                    </p>
                  </div>

                  {outing.status === "Pending" ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="xs"
                        variant="success"
                        disabled={!outing.guardianApproved}
                        title={
                          outing.guardianApproved
                            ? undefined
                            : "Guardian approval is required first"
                        }
                        onClick={() => {
                          void act(() => api.decideOuting(outing.id, "Approved"), {
                            success: "Outing request approved.",
                            description: outing.studentName,
                            fallback: "Unable to approve this request. Please try again.",
                          });
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          void act(() => api.decideOuting(outing.id, "Rejected"), {
                            success: "Outing request rejected.",
                            description: outing.studentName,
                            fallback: "Unable to reject this request. Please try again.",
                          });
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {outing.decidedBy ? `By ${outing.decidedBy}` : "Closed"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeader title="Recent student movement" description="Gate entry and exit log" />
          {recentMovements.length === 0 ? (
            <EmptyState
              icon={DoorOpen}
              title="No movement recorded"
              description="Student entries and exits will be listed here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentMovements.map((movement) => (
                <li key={movement.id} className="flex items-center gap-3 p-4">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                      movement.direction === "Entry"
                        ? "bg-success/12 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                    aria-hidden
                  >
                    {movement.direction === "Entry" ? (
                      <LogIn className="h-4 w-4" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{movement.personName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {movement.direction} · {movement.gate}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(movement.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={<InlineLoader label="Loading students…" />}>
      <StudentsView />
    </Suspense>
  );
}
