"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { useData } from "@/components/providers/data-provider";
import { getDashboardStats } from "@/lib/selectors";
import { adminNav, isNavItemActive } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function AdminSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { db, ready } = useData();
  const stats = getDashboardStats(db);

  return (
    <div className="flex h-full flex-col bg-navy text-navy-foreground">
      <div className="flex h-16 shrink-0 items-center border-b border-navy-border px-4">
        <Logo tone="onNavy" href="/admin/dashboard" subtitle="Security Console" />
      </div>

      <nav aria-label="Admin sections" className="flex-1 overflow-y-auto scrollbar-slim px-3 py-4">
        {adminNav.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                const count = ready && item.badgeKey ? stats[item.badgeKey] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-navy",
                        active
                          ? "bg-white/12 text-white"
                          : "text-white/65 hover:bg-white/[0.07] hover:text-white",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          active ? "text-cyanx-400" : "text-white/50 group-hover:text-white/80",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {count > 0 ? (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                            item.badgeKey === "openIncidents" ||
                              item.badgeKey === "activeEmergencies"
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-white/15 text-white",
                          )}
                        >
                          {count}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-navy-border p-3">
        <Link
          href="/security"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md bg-white/[0.06] px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-cyanx-400" aria-hidden />
          <span className="flex-1">Security Desk mode</span>
          <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden />
        </Link>
        <p className="px-3 pt-3 text-[10px] leading-relaxed text-white/35">
          Demonstration build · data stored in this browser
        </p>
      </div>
    </div>
  );
}

export function AdminSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-navy-border lg:block">
      <AdminSidebarContent />
    </aside>
  );
}
