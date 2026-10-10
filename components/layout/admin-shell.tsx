"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminTopbar } from "@/components/layout/admin-topbar";
import { GlobalSearch } from "@/components/admin/global-search";
import { InlineLoader } from "@/components/shared/states";
import { useAuth } from "@/components/providers/auth-provider";
import type { Role } from "@/lib/types";

const PUBLIC_ADMIN_ROUTES = ["/admin", "/admin/login"];

/** Roles the console is built for. Everyone else is sent to their own portal. */
const ADMIN_ROLES: Role[] = ["admin", "super_admin"];

/** Where a signed-in user belongs when they are not an administrator. */
const HOME_FOR_ROLE: Record<string, string> = {
  security: "/security/dashboard",
  teacher: "/teacher/dashboard",
  student: "/student",
};

/**
 * Console layout and its access gate.
 *
 * This redirect is a usability measure, not the security boundary: every
 * `/api` route re-checks the caller's role server-side, so a teacher who types
 * an admin URL gets an empty console and 403s rather than data. Sending them
 * to their own portal instead is simply the honest response to a wrong turn.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, ready } = useAuth();

  const isPublicRoute = PUBLIC_ADMIN_ROUTES.includes(pathname);
  const permitted = session ? ADMIN_ROLES.includes(session.role) : false;

  React.useEffect(() => {
    if (!ready || isPublicRoute) return;
    if (!session) {
      router.replace(`/admin?next=${encodeURIComponent(pathname)}`);
    } else if (!permitted) {
      router.replace(HOME_FOR_ROLE[session.role] ?? "/");
    }
  }, [ready, session, permitted, isPublicRoute, pathname, router]);

  if (isPublicRoute) return <>{children}</>;

  if (!ready || !session || !permitted) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <InlineLoader label="Checking your session…" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-muted/25">
      <AdminSidebar />
      <div className="lg:pl-[260px]">
        <AdminTopbar />
        {/* Search is hidden in the topbar below md — surface it here instead. */}
        <div className="border-b border-border bg-background px-4 py-3 md:hidden">
          <GlobalSearch />
        </div>
        <main id="main" className="p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[1400px] animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
