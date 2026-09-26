"use client";

import * as React from "react";
import { Maximize2, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { visitorPhotoHref } from "@/lib/photo";
import { cn, initials } from "@/lib/utils";

/**
 * Visitor photographs, as campus staff see them.
 *
 * The image is fetched from `/api/visitor-photo/[id]`, which serves it only to
 * a signed-in staff session — the browser sends the session cookie with the
 * request, so an image that renders here is one the viewer was entitled to. A
 * booking with no photograph (anything created before they were required)
 * falls back to the same initials avatar the rest of the console uses, rather
 * than showing a broken frame.
 */

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

export function VisitorPhotoThumb({
  photoUrl,
  name,
  size = "sm",
  className,
}: {
  photoUrl?: string;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const href = visitorPhotoHref(photoUrl);
  return (
    <Avatar className={cn(SIZES[size], "border border-border/60", className)}>
      {href ? (
        <AvatarImage src={href} alt={`Photo of ${name}`} className="object-cover" />
      ) : null}
      <AvatarFallback>{initials(name) || <UserRound className="h-4 w-4" aria-hidden />}</AvatarFallback>
    </Avatar>
  );
}

/**
 * A larger photograph that opens full size when clicked.
 *
 * Used where a member of staff is actually comparing a face to the person in
 * front of them — the gate result panel and the booking detail dialog. It is a
 * real button so it is reachable by keyboard and announces what it opens.
 */
export function VisitorPhotoPanel({
  photoUrl,
  name,
  caption,
  className,
  frameClassName,
}: {
  photoUrl?: string;
  name: string;
  /** Booking reference or similar, shown under the enlarged photograph. */
  caption?: string;
  className?: string;
  frameClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const href = visitorPhotoHref(photoUrl);

  const frame = cn(
    "relative overflow-hidden rounded-md border border-border bg-muted",
    "h-28 w-24 sm:h-32 sm:w-28",
    frameClassName,
  );

  if (!href) {
    return (
      <div className={cn(className)}>
        <div
          className={cn(
            frame,
            "flex flex-col items-center justify-center gap-1.5 text-muted-foreground",
          )}
        >
          <UserRound className="h-8 w-8 opacity-40" aria-hidden />
          <span className="px-2 text-center text-[10px] leading-tight">No photo on record</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(className)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          frame,
          "group cursor-zoom-in transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
        aria-label={`View a larger photo of ${name}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- served from a session-checked API route, not a public asset */}
        <img
          src={href}
          alt={`Photo of ${name}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <span
          className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-sm bg-background/85 text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        >
          <Maximize2 className="h-3 w-3" />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Visitor Photo</DialogTitle>
            <DialogDescription>
              {name}
              {caption ? ` · ${caption}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
            <img
              src={href}
              alt={`Photo of ${name}`}
              className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Compare this photograph with the person at the gate before admitting them.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
