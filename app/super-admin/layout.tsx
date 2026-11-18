import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SuperAdminShell } from "@/components/layout/super-admin-shell";
import { currentSession } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: "Super Admin Portal | Dev Sanskriti Vishwavidyalaya",
  description: "Executive and System Administration console for Dev Sanskriti Vishwavidyalaya CSMS.",
};

/**
 * Super Admin layout — strict server-side auth guard.
 *
 * Only accounts with role === "super_admin" may access any /super-admin/* route
 * (other than /super-admin/login, which is a public page within this layout).
 *
 * Any authenticated non-super_admin user landing here is redirected to their
 * correct dashboard server-side — no content flash.
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await currentSession();

  if (session) {
    if (session.role !== "super_admin") {
      // Redirect non-super-admin users to their own portal immediately.
      const roleHome: Record<string, string> = {
        admin: "/admin/dashboard",
        security: "/security/dashboard",
        teacher: "/teacher/dashboard",
        student: "/student",
        visitor: "/visitor",
      };
      redirect(roleHome[session.role] ?? "/");
    }
  }
  // If no session: SuperAdminShell client guard handles redirect to /super-admin/login.

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
