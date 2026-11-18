import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SecurityShell } from "@/components/security/security-shell";
import { currentSession } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: "Security Desk",
  description: "Gate operations console — verify visitor passes, record entry and exit.",
  robots: { index: false, follow: false },
};

/**
 * Security layout — server-side auth guard.
 *
 * Gate operators (security guards, admins, super admins) may access
 * /security/* routes. Visitors, teachers, and students are redirected
 * server-side before any page content renders.
 */
export default async function SecurityLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();

  if (session) {
    const role = session.role;
    // Gate operators: security guards, admins, and super admins
    if (role !== "security" && role !== "admin" && role !== "super_admin") {
      const roleHome: Record<string, string> = {
        teacher: "/teacher/dashboard",
        student: "/student",
        visitor: "/visitor",
      };
      redirect(roleHome[role] ?? "/");
    }
  }
  // If no session: SecurityShell client guard redirects to /security/login.

  return <SecurityShell>{children}</SecurityShell>;
}
