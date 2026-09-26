"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  CalendarClock,
  Car,
  CircleAlert,
  Info,
  LogIn,
  LogOut,
  ShieldAlert,
  UserPlus,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn, formatDateTime, relativeTime } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/lib/types";

const typeConfig: Record<NotificationType, { icon: LucideIcon; className: string }> = {
  request: { icon: UserPlus, className: "bg-primary/10 text-primary" },
  approval: { icon: BadgeCheck, className: "bg-success/12 text-success" },
  rejection: { icon: XCircle, className: "bg-destructive/12 text-destructive" },
  checkin: { icon: LogIn, className: "bg-accent/12 text-accent" },
  checkout: { icon: LogOut, className: "bg-muted text-muted-foreground" },
  security: { icon: ShieldAlert, className: "bg-warning/15 text-warning" },
  incident: { icon: AlertTriangle, className: "bg-destructive/12 text-destructive" },
  emergency: { icon: CircleAlert, className: "bg-destructive text-destructive-foreground" },
  vehicle: { icon: Car, className: "bg-accent/12 text-accent" },
  meeting: { icon: CalendarClock, className: "bg-primary/10 text-primary" },
  system: { icon: Info, className: "bg-muted text-muted-foreground" },
};

/**
 * A single notification row.
 *
 * When `actions` are supplied the row is not wrapped in a link — the title
 * becomes the link instead, so buttons are never nested inside an anchor.
 */
export function NotificationItem({
  notification,
  compact = false,
  onOpen,
  actions,
}: {
  notification: AppNotification;
  compact?: boolean;
  onOpen?: () => void;
  actions?: React.ReactNode;
}) {
  const config = typeConfig[notification.type] ?? { icon: Bell, className: "bg-muted" };
  const Icon = config.icon;
  const linkWrapped = Boolean(notification.href) && !actions;

  // Only the un-wrapped variant renders its own link — nesting an anchor inside
  // the outer anchor would be invalid HTML.
  const title =
    notification.href && !linkWrapped ? (
      <Link
        href={notification.href}
        onClick={onOpen}
        className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {notification.title}
      </Link>
    ) : (
      notification.title
    );

  const content = (
    <div
      className={cn(
        "flex w-full gap-3 text-left",
        compact ? "p-3" : "p-4",
        !notification.read && "bg-primary/[0.03]",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          config.className,
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm leading-snug",
              notification.read ? "font-medium" : "font-semibold",
            )}
          >
            {title}
          </p>
          {!notification.read ? (
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              aria-label="Unread"
            />
          ) : null}
        </div>

        <p className={cn("mt-0.5 text-xs text-muted-foreground", compact && "line-clamp-2")}>
          {notification.message}
        </p>

        <p className="mt-1 text-[11px] text-muted-foreground/80">
          <time dateTime={notification.at} title={formatDateTime(notification.at)}>
            {relativeTime(notification.at)}
          </time>
        </p>

        {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );

  if (linkWrapped && notification.href) {
    return (
      <Link
        href={notification.href}
        onClick={onOpen}
        className="block transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {content}
      </Link>
    );
  }

  return <div className="transition-colors hover:bg-muted/40">{content}</div>;
}
