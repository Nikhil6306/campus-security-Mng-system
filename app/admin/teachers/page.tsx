"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  DoorClosed,
  Edit,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { CardsLoadingState, EmptyState, InlineLoader } from "@/components/shared/states";
import { FilterBar } from "@/components/admin/filter-bar";
import { toast } from "@/components/ui/toaster";
import { useData } from "@/components/providers/data-provider";
import { api, errorMessage } from "@/lib/api";
import type { Teacher } from "@/lib/types";
import { initials, todayISO } from "@/lib/utils";
import { normaliseWhatsApp } from "@/lib/server/services/whatsapp";

interface FacultyFormData {
  id?: string;
  name: string;
  employeeId: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  departmentId: string;
  designation: string;
  room: string;
  active: boolean;
  userId: string;
}

const initialFormState: FacultyFormData = {
  name: "",
  employeeId: "",
  email: "",
  phone: "",
  whatsappNumber: "",
  departmentId: "",
  designation: "Assistant Professor",
  room: "",
  active: true,
  userId: "",
};

function TeachersView() {
  const params = useSearchParams();
  const { db, ready, refresh } = useData();

  const [search, setSearch] = React.useState(params.get("q") ?? "");
  const [department, setDepartment] = React.useState("all");

  // Dialog states
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingTeacher, setEditingTeacher] = React.useState<Teacher | null>(null);
  const [formData, setFormData] = React.useState<FacultyFormData>(initialFormState);
  const [submitting, setSubmitting] = React.useState(false);

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
      return [
        teacher.name,
        teacher.email,
        teacher.department,
        teacher.designation,
        teacher.phone,
        teacher.whatsappNumber,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [db.teachers, search, department]);

  const handleOpenCreate = () => {
    setEditingTeacher(null);
    setFormData({
      ...initialFormState,
      departmentId: db.departments[0]?.id || "",
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      id: teacher.id,
      name: teacher.name,
      employeeId: teacher.employeeId || "",
      email: teacher.email,
      phone: teacher.phone,
      whatsappNumber: teacher.whatsappNumber || teacher.phone,
      departmentId: teacher.departmentId,
      designation: teacher.designation,
      room: teacher.room || "",
      active: teacher.active,
      userId: teacher.userId || "",
    });
    setDialogOpen(true);
  };

  const handleToggleStatus = async (teacher: Teacher) => {
    try {
      const updatedActive = !teacher.active;
      await api.updateTeacher(teacher.id, {
        name: teacher.name,
        employeeId: teacher.employeeId || teacher.id,
        email: teacher.email,
        phone: teacher.phone,
        whatsappNumber: teacher.whatsappNumber || teacher.phone,
        departmentId: teacher.departmentId,
        designation: teacher.designation,
        room: teacher.room || "",
        availabilityStatus: teacher.availabilityStatus || "Available",
        active: updatedActive,
      });
      await refresh();
      toast.success(
        updatedActive
          ? `${teacher.name} activated for visitor requests.`
          : `${teacher.name} deactivated (cannot receive new requests).`,
      );
    } catch (err) {
      toast.error("Failed to update status", { description: errorMessage(err) });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!formData.phone.trim()) {
      toast.error("Mobile phone number is required");
      return;
    }
    if (!formData.departmentId) {
      toast.error("Please select a department");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        employeeId: formData.employeeId.trim() || `EMP-${Date.now().toString().slice(-4)}`,
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        whatsappNumber: formData.whatsappNumber.trim() || formData.phone.trim(),
        departmentId: formData.departmentId,
        designation: formData.designation.trim() || "Faculty",
        room: formData.room.trim(),
        active: formData.active,
        availabilityStatus: "Available",
      };

      if (editingTeacher) {
        await api.updateTeacher(editingTeacher.id, payload);
        toast.success(`Faculty member ${formData.name} updated successfully.`);
      } else {
        await api.createTeacher(payload);
        toast.success(`Faculty member ${formData.name} added with WhatsApp routing enabled.`);
      }

      setDialogOpen(false);
      await refresh();
    } catch (err) {
      toast.error("Operation failed", { description: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teachers & Faculty Management"
        description="Official campus hosts who can receive visitor requests and review approvals via WhatsApp Business."
        actions={
          <Button onClick={handleOpenCreate} className="bg-navy hover:bg-navy/90 text-white gap-1.5">
            <Plus className="h-4 w-4" />
            <span>Add Faculty Member</span>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Staff members" value={db.teachers.length} icon={Users} loading={!ready} />
        <StatCard label="Departments" value={departments.length} icon={Building2} loading={!ready} />
        <StatCard
          label="Active for Requests"
          value={db.teachers.filter((t) => t.active).length}
          icon={CheckCircle2}
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
          searchPlaceholder="Search name, WhatsApp, department or designation…"
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
                    <article className="flex h-full flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-md">
                      <div>
                        <header className="flex items-start gap-3">
                          <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                            aria-hidden
                          >
                            {initials(teacher.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h3 className="truncate text-sm font-semibold">{teacher.name}</h3>
                              {teacher.active ? (
                                <span title="Active for WhatsApp approvals" className="h-2 w-2 rounded-full bg-emerald-500" />
                              ) : (
                                <span title="Deactivated" className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {teacher.designation}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {teacher.department}
                            </p>
                          </div>
                          <Badge variant={teacher.active ? "success" : "muted"}>
                            {teacher.active ? "Active" : "Inactive"}
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
                            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[#25D366]" aria-hidden />
                            <dd className="font-mono text-foreground font-medium">
                              WhatsApp: {teacher.whatsappNumber || teacher.phone}
                            </dd>
                          </div>
                          <div className="flex items-center gap-2">
                            <DoorClosed className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <dd className="truncate">{teacher.room || "Campus Office"}</dd>
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
                      </div>

                      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(teacher)}
                          className="flex-1 text-xs gap-1"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(teacher)}
                          className={`text-xs gap-1 ${
                            teacher.active ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"
                          }`}
                        >
                          {teacher.active ? (
                            <>
                              <UserX className="h-3.5 w-3.5" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5" />
                              Activate
                            </>
                          )}
                        </Button>
                        <Button asChild variant="outline" size="sm" className="text-xs">
                          <Link href={`/admin/meetings?hostId=${teacher.id}`}>
                            <CalendarDays className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      {/* Add / Edit Faculty Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTeacher ? `Edit Faculty: ${editingTeacher.name}` : "Add Faculty Member"}
            </DialogTitle>
            <DialogDescription>
              Configure faculty credentials and official WhatsApp number for visit approval routing.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label required>Full Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Dr. Anand Sharma"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Employee ID</Label>
                <Input
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  placeholder="EMP-102"
                />
              </div>
              <div className="space-y-1.5">
                <Label required>Department</Label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  <option value="">Select Department</option>
                  {db.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label required>Official Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="anand.sharma@dsvv.edu.in"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label required>Desk / Mobile Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="9876543210"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label required className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  WhatsApp Number
                </Label>
                <Input
                  value={formData.whatsappNumber}
                  onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                  placeholder="9876543210"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              WhatsApp number will be normalized to international E.164 format for Cloud API notifications.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Designation</Label>
                <Input
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="Associate Professor"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Office / Room</Label>
                <Input
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  placeholder="Block B, Room 204"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="activeToggle"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="activeToggle" className="cursor-pointer">
                Active for incoming visitor requests
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingTeacher ? "Update Faculty" : "Add Faculty"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
