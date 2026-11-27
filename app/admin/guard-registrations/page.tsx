"use client";

import * as React from "react";
import { Clock, ShieldCheck, Users, XCircle } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { GuardRegistrationsList } from "@/components/admin/guard-approval-dialog";

export default function GuardRegistrationsPage() {
  const [counts, setCounts] = React.useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/guards/registrations", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((env) => {
        if (!cancelled && env.ok) {
          const list = env.data?.registrations ?? [];
          setCounts({
            total: list.length,
            pending: list.filter((r: { status: string }) => r.status.toUpperCase() === "PENDING").length,
            approved: list.filter((r: { status: string }) => r.status.toUpperCase() === "APPROVED").length,
            rejected: list.filter((r: { status: string }) => r.status.toUpperCase() === "REJECTED").length,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guard Registration Requests"
        description="Review security guard applications, approve active duty accounts, and assign initial gate posts."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Applications"
          value={counts.total}
          icon={Users}
          loading={loading}
        />
        <StatCard
          label="Pending Review"
          value={counts.pending}
          icon={Clock}
          tone={counts.pending > 0 ? "warning" : "default"}
          loading={loading}
        />
        <StatCard
          label="Approved Guards"
          value={counts.approved}
          icon={ShieldCheck}
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Rejected Applications"
          value={counts.rejected}
          icon={XCircle}
          tone={counts.rejected > 0 ? "destructive" : "default"}
          loading={loading}
        />
      </div>

      <GuardRegistrationsList
        onRefresh={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
