"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  BarChart3,
  ChevronRight,
  Crown,
  DoorOpen,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
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
import { ROLE_LABELS, ROLE_HOME } from "@/lib/types";
import { initials } from "@/lib/utils";

const PUBLIC_SUPER_ADMIN_ROUTES = ["/super-admin/login"];

const superAdminNav = [
  { href: "/super-admin/dashboard", label: "Executive Oversight", icon: LayoutDashboard },
  { href: "/admin/activity", label: "Audit & Activity Logs", icon: History },
  { href: "/admin/settings", label: "System & Policy Config", icon: Settings },
  { href: "/admin/guards", label: "Guard Personnel & RBAC", icon: ShieldCheck },
  { href: "/admin/teachers", label: "Faculty Directory", icon: Users },
  { href: "/admin/dashboard", label: "Admin Console View", icon: Shield },
  { href: "/security/dashboard", label: "Gate Terminal View", icon: DoorOpen },
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, ready, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const isPublicRoute = PUBLIC_SUPER_ADMIN_ROUTES.includes(pathname);
  const isSuperAdmin = session?.role === "super_admin";

  React.useEffect(() => {
    if (!ready || isPublicRoute) return;
    if (!session) {
      if (typeof document !== "undefined") {
        document.cookie = "csms_role=; path=/; max-age=0;";
      }
      const target = `/super-admin/login?next=${encodeURIComponent(pathname)}`;
      router.replace(target);
    }
  }, [ready, session, isPublicRoute, pathname, router]);

  if (isPublicRoute) return <>{children}</>;

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy text-white">
        <InlineLoader label="Verifying Super Admin credentials…" />
      </div>
    );
  }

  // Not signed in
  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-navy p-4 text-white">
        <InlineLoader label="Redirecting to Super Admin login…" />
        <p className="text-xs text-white/70">
          If you are not redirected automatically,{" "}
          <a
            href={`/super-admin/login?next=${encodeURIComponent(pathname)}`}
            className="font-medium text-amber-300 underline underline-offset-4 hover:text-amber-200"
          >
            click here to log in
          </a>.
        </p>
      </div>
    );
  }

  // Signed in with a role other than super_admin: STRICT ACCESS DENIAL (403)
  if (!isSuperAdmin) {
    const permittedHome = ROLE_HOME[session.role] ?? "/";
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
            Super Admin Privileges Required
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            You are authenticated as <strong>{session.name}</strong> ({ROLE_LABELS[session.role]}).
            This section is restricted strictly to Super Administrators.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button
              className="w-full gap-2"
              onClick={() => router.replace(permittedHome)}
            >
              Go to Your Permitted Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                void signOut().then(() => {
                  toast.success("Signed out successfully.");
                  router.replace("/super-admin/login");
                });
              }}
            >
              Sign In with Super Admin Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSignOut = () => {
    void signOut().then(() => {
      toast.success("Signed out of Super Admin console.");
      router.replace("/super-admin/login");
    });
  };

  const navContent = (
    <div className="flex h-full flex-col bg-navy text-navy-foreground">
      <div className="flex h-16 shrink-0 items-center border-b border-navy-border px-4">
        <Logo tone="onNavy" href="/super-admin/dashboard" subtitle="Super Admin Console" />
      </div>

      <div className="px-4 py-3 border-b border-navy-border/60 bg-amber-500/10">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
            Super Administrator
          </span>
        </div>
      </div>

      <nav aria-label="Super Admin sections" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {superAdminNav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white/15 text-white shadow-xs"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 text-cyanx-400" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-navy-border p-3 text-xs text-white/50 space-y-1">
        <p className="font-semibold text-white/80">{UNIVERSITY_NAME}</p>
        <p className="text-[11px] text-white/40">DSVV Security Oversight Console</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-muted/20">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-navy-border lg:block">
        {navContent}
      </aside>

      {/* Main Area */}
      <div className="lg:pl-[260px]">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-sm" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0" hideClose>
              <SheetTitle className="sr-only">Super Admin Navigation</SheetTitle>
              {navContent}
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <span className="lg:hidden">
              <LogoMark size="sm" />
            </span>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span>Dev Sanskriti Vishwavidyalaya</span>
              <ChevronRight className="h-3 w-3" />
              <span className="font-medium text-foreground">Super Admin</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <Crown className="h-3 w-3" />
              Super Admin Mode
            </Badge>

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 pl-2">
                  <Avatar className="h-7 w-7 border border-border">
                    <AvatarFallback className="bg-amber-600 text-white text-xs font-bold">
                      {initials(session.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline font-medium text-sm">{session.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold">{session.name}</p>
                  <p className="text-xs text-muted-foreground font-normal">{session.email}</p>
                  <Badge variant="secondary" className="mt-1 text-[10px] uppercase font-bold">
                    Super Administrator
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/super-admin/dashboard" className="gap-2 cursor-pointer">
                    <LayoutDashboard className="h-4 w-4" /> Super Admin Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/dashboard" className="gap-2 cursor-pointer">
                    <Shield className="h-4 w-4" /> Admin Console
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/security/dashboard" className="gap-2 cursor-pointer">
                    <DoorOpen className="h-4 w-4" /> Security Desk
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content Body */}
        <main id="super-admin-main" className="p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1400px] animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
