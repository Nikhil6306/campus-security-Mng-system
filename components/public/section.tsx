import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Layout primitives for the public visitor portal.
 *
 * Every public page is built from these two pieces so vertical rhythm, section
 * tone and heading hierarchy stay identical across the site instead of being
 * re-tuned page by page.
 */

type Tone = "default" | "muted" | "brand";

const toneClass: Record<Tone, string> = {
  default: "bg-background",
  /** The alternating band: #F7FAFF against white. */
  muted: "bg-muted",
  /** A light blue panel for the closing call to action. */
  brand: "bg-secondary",
};

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  tone?: Tone;
  /** Drops the bottom hairline — used where two sections share a tone. */
  flush?: boolean;
  /** Tightens the vertical padding for short, supporting sections. */
  compact?: boolean;
}

export function Section({
  tone = "default",
  flush = false,
  compact = false,
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(
        toneClass[tone],
        compact ? "py-12 lg:py-16" : "py-16 lg:py-24",
        !flush && "border-b border-border",
        className,
      )}
      {...props}
    >
      <div className="container">{children}</div>
    </section>
  );
}

interface SectionHeadingProps {
  /** Small label above the heading. */
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Wire this to the parent section's `aria-labelledby`. */
  id?: string;
  align?: "left" | "center";
  className?: string;
  /** Rendered to the right of the heading on wide screens (usually a link). */
  action?: React.ReactNode;
  /** Heading level — `h2` for a section, `h1` only on a page banner. */
  as?: "h1" | "h2";
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  id,
  align = "left",
  className,
  action,
  as: Heading = "h2",
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "sm:flex-col sm:items-center",
        className,
      )}
    >
      <div className={cn("max-w-2xl space-y-3", align === "center" && "mx-auto text-center")}>
        {eyebrow && (
          <p
            className={cn(
              "flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.16em]",
              align === "center" && "justify-center",
              "text-muted-foreground",
            )}
          >
            <span className="h-px w-6 bg-accent" aria-hidden />
            {eyebrow}
          </p>
        )}

        <Heading
          id={id}
          className={cn(
            "text-balance font-semibold tracking-tight",
            Heading === "h1"
              ? "text-3xl leading-[1.15] sm:text-4xl lg:text-5xl"
              : "text-2xl sm:text-3xl",
            "text-foreground",
          )}
        >
          {title}
        </Heading>

        {description && (
          <p
            className={cn(
              "text-pretty leading-relaxed",
              Heading === "h1" ? "text-base sm:text-lg" : "text-base",
              "text-muted-foreground",
            )}
          >
            {description}
          </p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
