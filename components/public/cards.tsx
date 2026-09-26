import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { MediaFrame } from "@/components/public/media-frame";
import { cn } from "@/lib/utils";

/**
 * The two card shapes the public pages repeat: a labelled fact and an
 * icon-led description. Defined once so every grid on the site shares the same
 * border, radius, shadow and hover treatment.
 */

export function IconTile({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
        className,
      )}
      aria-hidden
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /**
   * Photograph for this card. When present the card leads with the image and
   * drops the icon tile; cards without one keep the icon-led layout, so a grid
   * can mix the two without looking broken.
   */
  image?: string;
  imageAlt?: string;
  /** Optional footer, usually a link. */
  children?: React.ReactNode;
  className?: string;
}

export function FeatureCard({
  icon,
  title,
  description,
  image,
  imageAlt,
  children,
  className,
}: FeatureCardProps) {
  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      {image && (
        <MediaFrame
          src={image}
          alt={imageAlt ?? title}
          ratio="16/9"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          // The frame sits flush inside the card, so it keeps the card's own
          // border and corners rather than drawing a second set.
          className="rounded-none border-0 border-b border-border"
        />
      )}

      <div className="flex flex-1 flex-col p-6">
        {!image && <IconTile icon={icon} />}
        <h3 className={cn("text-base font-semibold", !image && "mt-4")}>{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {children && <div className="mt-4 pt-1">{children}</div>}
      </div>
    </article>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  value: string;
  label: string;
  detail?: string;
}

export function StatCard({ icon: Icon, value, label, detail }: StatCardProps) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-border bg-card p-6 shadow-xs transition-[border-color,box-shadow] duration-200 ease-out hover:border-primary/40 hover:shadow-md">
      <Icon className="h-5 w-5 text-accent" aria-hidden />
      <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm font-medium text-primary-strong">{label}</p>
      {detail && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</p>}
    </article>
  );
}
