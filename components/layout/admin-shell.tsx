"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertOctagon, ArrowRight } from "lucide-react";

import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminTopbar } from "@/components/layout/admin-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/admin/global-search";
import { InlineLoader } from "@/components/shared/states";
import { useAuth } from "@/components/providers/auth-provider";
import { ROLE_LABELS, type Role } from "@/lib/types";

const PUBLIC_ADMIN_ROUTES = ["/admin/login"];

/** Roles the console is built for. Everyone else is sent to their own portal. */
const ADMIN_ROLES: Role[] = ["admin", "super_admin"];

/** Where a signed-in user belongs when they are not an administrator. */
const HOME_FOR_ROLE: Record<string, string> = {
  super_admin: "/super-admin/dashboard",
  admin: "/admin/dashboard",
  security: "/security/dashboard",
  teacher: "/teacher/dashboard",
  student: "/student",
};

/**
 * Console layout and its access gate.
 *
 * This redirect is a usability measure, not the security boundary: every
 * `/api` route re-checks the caller's role server-side, so a non-admin who types
 * an admin URL gets an empty console and 403s rather than data. Sending them
 * to their own portal instead is simply the honest response to a wrong turn.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, ready, signOut } = useAuth();

  const isPublicRoute = PUBLIC_ADMIN_ROUTES.includes(pathname);
  const permitted = session ? ADMIN_ROLES.includes(session.role) : false;

  React.useEffect(() => {
    if (!ready || isPublicRoute) return;
    if (!session) {
      router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    } else if (!permitted) {
      router.replace(HOME_FOR_ROLE[session.role] ?? "/");
    }
  }, [ready, session, permitted, isPublicRoute, pathname, router]);

  if (isPublicRoute) return <>{children}</>;

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <InlineLoader label="Checking your session…" />
      </div>
    );
  }

  // Not signed in
  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <InlineLoader label="Redirecting to Admin login…" />
      </div>
    );
  }

  // Signed in with a non-admin role: STRICT ACCESS DENIAL (403)
  if (!permitted) {
    const permittedHome = HOME_FOR_ROLE[session.role] ?? "/";
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
        <div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-card p-6 sm:p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertOctagon className="h-7 w-7" />
          </div>
          <Badge variant="destructive" className="mb-3">
            Access Denied · 403 Forbidden
          </Badge>
          <h2 className="text-xl font-bold tracking-tight">Administrator Privileges Required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You are signed in as <strong>{session.name}</strong> ({ROLE_LABELS[session.role]}).
            This section is restricted to Campus Administrators and Super Administrators.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button asChild>
              <Link href={permittedHome}>
                Go to Your Permitted Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out & Switch Account
            </Button>
          </div>
        </div>
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
