"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CalendarRange, LayoutDashboard, UserRound } from "lucide-react";

import { PortalShell } from "@/components/layout/portal-shell";
import { cn } from "@/lib/utils";

/**
 * Teacher portal chrome.
 *
 * The tabs below only choose a view. What a teacher can actually see is decided
 * server-side: `/api/state` narrows the snapshot to bookings hosted by their own
 * teacher record, so another teacher's meetings never reach the browser.
 */

const tabs = [
  { href: "/teacher/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/teacher/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/teacher/availability", label: "Availability", icon: CalendarRange },
  { href: "/teacher/profile", label: "Profile", icon: UserRound },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <PortalShell
      title="Teacher & Staff Portal"
      subtitle="Meeting requests, approvals and your availability"
      allow={["teacher"]}
    >
      <nav
        aria-label="Teacher portal"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon className="h-4 w-4" aria-hidden />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-6">{children}</div>
    </PortalShell>
  );
}
