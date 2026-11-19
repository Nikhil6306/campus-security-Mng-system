"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertOctagon,
  ArrowRight,
  ChevronRight,
  Crown,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { InlineLoader } from "@/components/shared/states";
import { Logo, LogoMark, UNIVERSITY_NAME } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { administratorNav, isNavItemActive } from "@/lib/nav";
import { getDashboardStats } from "@/lib/selectors";
import { ROLE_LABELS, ROLE_HOME } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

const PUBLIC_ADMINISTRATOR_ROUTES = ["/administrator/login"];

export function AdministratorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, ready, signOut } = useAuth();
  const { db } = useData();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const stats = getDashboardStats(db);
  const isPublicRoute = PUBLIC_ADMINISTRATOR_ROUTES.includes(pathname);
  const isAdministrator = session?.role === "super_admin";

  React.useEffect(() => {
    if (!ready || isPublicRoute) return;
    if (!session) {
      if (typeof document !== "undefined") {
        document.cookie = "csms_role=; path=/; max-age=0;";
      }
      const target = `/administrator/login?next=${encodeURIComponent(pathname)}`;
      if (typeof window !== "undefined") {
        window.location.replace(target);
      } else {
        router.replace(target);
      }
    } else if (!isAdministrator) {
      router.replace(ROLE_HOME[session.role] ?? "/admin/dashboard");
    }
  }, [ready, session, isAdministrator, isPublicRoute, pathname, router]);

  if (isPublicRoute) return <>{children}</>;

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy text-white">
        <InlineLoader label="Verifying Administrator credentials…" />
      </div>
    );
  }

  // Not signed in
  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-navy p-4 text-white">
        <InlineLoader label="Redirecting to Administrator login…" />
        <p className="text-xs text-white/70">
          If you are not redirected automatically,{" "}
          <a
            href={`/administrator/login?next=${encodeURIComponent(pathname)}`}
            className="font-medium text-amber-300 underline underline-offset-4 hover:text-amber-200"
          >
            click here to log in
          </a>.
        </p>
      </div>
    );
  }

  // Signed in with a role other than super_admin: STRICT ACCESS DENIAL (403)
  if (!isAdministrator) {
    const permittedHome = ROLE_HOME[session.role] ?? "/admin/dashboard";
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
        <div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-card p-6 sm:p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertOctagon className="h-7 w-7" />
          </div>
          <Badge variant="destructive" className="mb-3">
            Access Denied · 403 Forbidden
          </Badge>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Administrator Clearance Required
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are signed in as <strong>{session.name}</strong> ({ROLE_LABELS[session.role]}).
            This portal is restricted to Campus Security Directors and Super Administrators.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button asChild>
              <Link href={permittedHome}>
                Go to Your Permitted Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await signOut();
                router.replace("/administrator/login");
              }}
            >
              Sign Out & Switch Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      {/* ---------------- Top Banner for Administrator ---------------- */}
      <header className="sticky top-0 z-40 border-b border-navy-700/80 bg-navy text-white shadow-md">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Mobile Sheet Trigger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10 lg:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 bg-navy p-0 text-white border-navy-800">
                <SheetTitle className="sr-only">Administrator Navigation</SheetTitle>
                <div className="flex h-16 items-center border-b border-white/10 px-6">
                  <Logo tone="onNavy" href="/administrator/dashboard" subtitle="Administrator Command" />
                </div>
                <nav className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
                  {administratorNav.map((group) => (
                    <div key={group.label} className="space-y-1">
                      <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                        {group.label}
                      </p>
                      {group.items.map((item) => {
                        const active = isNavItemActive(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                              active
                                ? "bg-saffron-500 text-white font-semibold shadow-sm"
                                : "text-white/70 hover:bg-white/10 hover:text-white",
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1 truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            <Logo tone="onNavy" href="/administrator/dashboard" subtitle="Administrator Command" />

            <div className="hidden items-center gap-2 rounded-full bg-saffron-500/20 border border-saffron-400/30 px-3 py-1 text-xs font-semibold text-saffron-300 md:inline-flex">
              <Crown className="h-3.5 w-3.5 text-saffron-400" />
              Executive Level
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Switch to Admin Operations View */}
            <Button
              asChild
              size="sm"
              variant="outline"
              className="hidden sm:inline-flex border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs font-medium"
            >
              <Link href="/admin/dashboard">
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                Operations Console
              </Link>
            </Button>

            <ThemeToggle />

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-saffron-400/50 hover:ring-saffron-400">
                  <Avatar className="h-9 w-9 bg-saffron-600 text-white font-semibold">
                    <AvatarFallback>{initials(session.name)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold">{session.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{session.email}</p>
                    <Badge variant="outline" className="w-fit text-[10px] font-semibold text-saffron-600 border-saffron-300 mt-1">
                      Administrator
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/administrator/dashboard" className="cursor-pointer">
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Administrator Command
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/dashboard" className="cursor-pointer">
                    <Shield className="h-4 w-4 mr-2" />
                    Admin Operations Console
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/activity" className="cursor-pointer">
                    <History className="h-4 w-4 mr-2" />
                    Audit & Activity Logs
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings" className="cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />
                    System Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={async () => {
                    await signOut();
                    toast.success("Signed out successfully");
                    router.replace("/administrator/login");
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ---------------- Layout with Sidebar + Main Content ---------------- */}
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-72 shrink-0 border-r border-navy-800 bg-navy text-white min-h-[calc(100vh-4rem)]">
          <nav className="p-4 space-y-6 sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-slim">
            {administratorNav.map((group) => (
              <div key={group.label} className="space-y-1">
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const active = isNavItemActive(pathname, item.href);
                  const count = item.badgeKey ? stats[item.badgeKey] : 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                        active
                          ? "bg-saffron-500 text-white font-semibold shadow-sm"
                          : "text-white/70 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          active ? "text-white" : "text-white/60 group-hover:text-white",
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white">
                          {count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
