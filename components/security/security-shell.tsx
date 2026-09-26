"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Car,
  LayoutGrid,
  LogIn,
  LogOut,
  ScanLine,
  ShieldAlert,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { InlineLoader } from "@/components/shared/states";
import { LogoMark, UNIVERSITY_NAME } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { getDashboardStats } from "@/lib/selectors";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/security/dashboard", label: "Console", icon: LayoutGrid },
  { href: "/security/scan", label: "Scan", icon: ScanLine },
  { href: "/security/check-in", label: "Check-In", icon: LogIn },
  { href: "/security/check-out", label: "Check-Out", icon: LogOut },
  { href: "/security/vehicles", label: "Vehicles", icon: Car },
  { href: "/security/incidents", label: "Incidents", icon: AlertTriangle },
];

/** Live clock for the gate desk — rendered only after mount to stay hydration-safe. */
function GateClock() {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!now) return <span className="text-sm text-white/50">--:--:--</span>;

  return (
    <time
      dateTime={now.toISOString()}
      className="font-mono text-sm tabular-nums text-white"
      suppressHydrationWarning
    >
      {now.toLocaleTimeString("en-IN", { hour12: false })}
    </time>
  );
}

/**
 * Gate-desk chrome.
 *
 * Deliberately larger and higher-contrast than the admin console: this view is
 * used standing up, on a touch screen, often in daylight.
 */
export function SecurityShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, ready, signOut } = useAuth();
  const { db } = useData();

  const stats = getDashboardStats(db);
  const allowed = session?.role === "security" || session?.role === "admin";

  React.useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (!allowed) {
      router.replace("/admin/dashboard");
    }
  }, [ready, session, allowed, pathname, router]);

  if (!ready || !session || !allowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy">
        <InlineLoader label="Opening the gate console…" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="sticky top-0 z-30 bg-navy">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/security/dashboard"
            className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <LogoMark size="lg" priority />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">
                Security Desk
              </span>
              <span className="block truncate text-[11px] text-white/60">
                {UNIVERSITY_NAME}
              </span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 sm:flex">
              <Users className="h-4 w-4 text-cyanx-400" aria-hidden />
              <span className="text-sm font-semibold text-white tabular-nums">
                {stats.currentlyInside}
              </span>
              <span className="text-xs text-white/60">inside</span>
            </span>

            <span className="hidden rounded-md bg-white/10 px-3 py-1.5 sm:block">
              <GateClock />
            </span>

            <ThemeToggle tone="onNavy" />

            <Button
              variant="onNavy"
              size="sm"
              onClick={() => {
                signOut();
                toast.success("Logged out successfully.");
                router.push("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>

        <nav
          aria-label="Gate desk"
          className="flex gap-1 overflow-x-auto border-t border-navy-border px-2 sm:px-4"
        >
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center justify-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors sm:px-5",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70",
                  active
                    ? "border-cyanx-400 text-white"
                    : "border-transparent text-white/60 hover:text-white",
                )}
              >
                <tab.icon className="h-4 w-4" aria-hidden />
                {tab.label}
              </Link>
            );
          })}

          <Link
            href="/security/emergency"
            className="ml-auto hidden items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-destructive-foreground/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 sm:flex"
          >
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Emergency
          </Link>
        </nav>
      </header>

      <main id="main" className="flex-1 p-4 sm:p-6">
        <div className="mx-auto w-full max-w-6xl animate-fade-in">{children}</div>
      </main>

      <footer className="border-t border-border bg-card px-4 py-3 text-center text-xs text-muted-foreground">
        Gate console · signed in as{" "}
        <span className="font-medium text-foreground">{session.name}</span>
      </footer>
    </div>
  );
}
