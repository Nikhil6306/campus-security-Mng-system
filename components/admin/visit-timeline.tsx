"use client";

import { Check, Circle, Dot } from "lucide-react";

import { getVisitTimeline } from "@/lib/selectors";
import type { CheckLog, VisitRequest } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * The life of one visit, drawn from the booking's own timestamps.
 *
 * Nothing here is stored separately — each step reads a field on the record, so
 * the timeline cannot drift out of step with the booking it describes.
 */
export function VisitTimeline({
  booking,
  logs = [],
  className,
}: {
  booking: VisitRequest;
  logs?: CheckLog[];
  className?: string;
}) {
  const steps = getVisitTimeline(booking);

  const gateNote = (label: string): string | undefined => {
    if (label.startsWith("Checked in")) {
      const log = logs.find((l) => l.direction === "In");
      return log ? `${log.gate} · ${log.guardName}` : undefined;
    }
    if (label.startsWith("Checked out")) {
      const log = logs.find((l) => l.direction === "Out");
      return log ? `${log.gate} · ${log.guardName}` : undefined;
    }
    return undefined;
  };

  return (
    <ol className={cn("space-y-0", className)}>
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const note = gateNote(step.label);

        return (
          <li key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                  step.done
                    ? "border-success bg-success text-success-foreground"
                    : step.current
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                {step.done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : step.current ? (
                  <Dot className="h-5 w-5" />
                ) : (
                  <Circle className="h-2.5 w-2.5" />
                )}
              </span>
              {!last ? (
                <span
                  className={cn(
                    "w-px flex-1 bg-border",
                    step.done && "bg-success/40",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>

            <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-5")}>
              <p
                className={cn(
                  "text-sm font-medium leading-6",
                  !step.done && !step.current && "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
              {step.at ? (
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(step.at)}
                  {step.by ? ` · ${step.by}` : ""}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {step.current ? "In progress" : "Not yet reached"}
                </p>
              )}
              {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
