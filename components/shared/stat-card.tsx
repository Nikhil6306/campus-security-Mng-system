"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type Tone = "default" | "accent" | "success" | "warning" | "destructive";

const toneStyles: Record<Tone, { icon: string; ring: string }> = {
  default: { icon: "bg-primary/10 text-primary", ring: "group-hover:border-primary/40" },
  accent: { icon: "bg-accent/12 text-accent", ring: "group-hover:border-accent/40" },
  success: { icon: "bg-success/12 text-success", ring: "group-hover:border-success/40" },
  warning: { icon: "bg-warning/15 text-warning", ring: "group-hover:border-warning/40" },
  destructive: {
    icon: "bg-destructive/12 text-destructive",
    ring: "group-hover:border-destructive/40",
  },
};

export interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
  href?: string;
  loading?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
  loading,
  className,
}: StatCardProps) {
  const styles = toneStyles[tone];

  const body = (
    <div
      className={cn(
        "group relative flex h-full items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-xs transition-all",
        href && "hover:-translate-y-0.5 hover:shadow-md",
        styles.ring,
        className,
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
          styles.icon,
        )}
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </p>
        {loading ? (
          <Skeleton className="mt-1.5 h-7 w-12" />
        ) : (
          <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        )}
        {hint ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );

  if (!href) return body;

  return (
    <Link
      href={href}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`${label}: ${value}`}
    >
      {body}
    </Link>
  );
}
