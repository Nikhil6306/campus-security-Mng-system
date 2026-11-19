import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdministratorShell } from "@/components/layout/administrator-shell";
import { currentSession } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: "Administrator Command | Dev Sanskriti Vishwavidyalaya",
  description: "Executive Administration & Campus Security Master Console for Dev Sanskriti Vishwavidyalaya.",
};

/**
 * Administrator layout — strict server-side auth guard.
 *
 * Only accounts with role === "super_admin" (Administrator) may access any
 * /administrator/* route (other than /administrator/login, which is public).
 *
 * Any authenticated non-administrator user (Admin, Guard, Faculty, Student)
 * is redirected to their own designated dashboard server-side — no UI flash.
 */
export default async function AdministratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await currentSession();

  if (session) {
    if (session.role !== "super_admin") {
      const roleHome: Record<string, string> = {
        admin: "/admin/dashboard",
        security: "/security/dashboard",
        teacher: "/teacher/dashboard",
        student: "/student",
        visitor: "/visitor",
      };
      redirect(roleHome[session.role] ?? "/admin/dashboard");
    }
  }

  return <AdministratorShell>{children}</AdministratorShell>;
}
