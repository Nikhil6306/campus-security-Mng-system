"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "accent" | "warning" | "destructive";

const toneStyles: Record<Tone, { icon: string; border: string }> = {
  default: { icon: "bg-primary/10 text-primary", border: "hover:border-primary/50" },
  success: { icon: "bg-success/12 text-success", border: "hover:border-success/50" },
  accent: { icon: "bg-accent/12 text-accent", border: "hover:border-accent/50" },
  warning: { icon: "bg-warning/15 text-warning", border: "hover:border-warning/50" },
  destructive: {
    icon: "bg-destructive/12 text-destructive",
    border: "hover:border-destructive/60",
  },
};

interface ActionTileProps {
  label: string;
  description: string;
  icon: LucideIcon;
  tone?: Tone;
  count?: number;
  href?: string;
  onClick?: () => void;
}

/**
 * Large touch target for the gate desk. Renders as a link or a button
 * depending on whether it navigates or opens something in place.
 */
export function ActionTile({
  label,
  description,
  icon: Icon,
  tone = "default",
  count,
  href,
  onClick,
}: ActionTileProps) {
  const styles = toneStyles[tone];

  const inner = (
    <>
      <span
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-lg",
          styles.icon,
        )}
        aria-hidden
      >
        <Icon className="h-7 w-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-lg font-semibold tracking-tight">{label}</span>
          {typeof count === "number" && count > 0 ? (
            <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-semibold tabular-nums">
              {count}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
      </span>
    </>
  );

  const className = cn(
    "flex w-full items-center gap-4 rounded-lg border border-border bg-card p-5 text-left shadow-xs transition-all",
    "min-h-[104px] hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    styles.border,
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}
