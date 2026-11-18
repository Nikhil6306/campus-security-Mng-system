import { redirect } from "next/navigation";

import { AdminShell } from "@/components/layout/admin-shell";
import { currentSession } from "@/lib/server/auth";

/**
 * Admin layout — server-side auth guard.
 *
 * This layout covers all /admin/* routes. The public login page
 * (/admin/login) is excluded from this layout via the Next.js route
 * group model — but to keep compatibility, we detect the login page
 * by checking if no session is present and simply rendering the shell
 * which handles that case internally (the AdminShell shows the login
 * form for unauthenticated visitors on the /admin/login route).
 *
 * Server-side: if a session IS present but belongs to a non-admin role,
 * we redirect immediately before any content renders — no flash.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();

  if (session) {
    const role = session.role;
    // super_admin and admin are permitted on all /admin/* routes.
    // All other roles are denied — redirect them to their own portal.
    if (role !== "admin" && role !== "super_admin") {
      const roleHome: Record<string, string> = {
        security: "/security/dashboard",
        teacher: "/teacher/dashboard",
        student: "/student",
        visitor: "/visitor",
      };
      redirect(roleHome[role] ?? "/");
    }
  }
  // If no session: the AdminShell client guard handles the redirect to /admin/login.
  // We don't redirect here because the login page itself lives under /admin/login
  // and uses this same layout.

  return <AdminShell>{children}</AdminShell>;
}
