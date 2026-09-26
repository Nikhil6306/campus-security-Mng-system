"use client";

import * as React from "react";

import { cn, formatDate } from "@/lib/utils";

/**
 * Two small, dependency-free charts.
 *
 * Both encode a single measure, so they use one hue (the primary ramp) rather
 * than a categorical palette — colour carries magnitude here, not identity.
 * Values are labelled directly and an equivalent table is available to screen
 * readers, so nothing depends on colour alone.
 */

export interface Datum {
  label: string;
  value: number;
}

/** Category magnitude — horizontal bars, direct value labels, no legend. */
export function BarList({
  data,
  total,
  emptyLabel = "No data for this selection.",
  className,
  formatLabel,
}: {
  data: Datum[];
  total?: number;
  emptyLabel?: string;
  className?: string;
  formatLabel?: (label: string) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const sum = total ?? data.reduce((acc, d) => acc + d.value, 0);

  if (data.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {data.map((item) => {
        const share = sum > 0 ? Math.round((item.value / sum) * 100) : 0;
        return (
          <li key={item.label} className="group">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm">
                {formatLabel ? formatLabel(item.label) : item.label}
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {item.value}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {share}%
                </span>
              </span>
            </div>
            <div
              className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${item.label}: ${item.value} of ${sum} (${share}%)`}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width,opacity] duration-500 group-hover:opacity-85"
                style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Change over time — one bar per day with a hover readout. */
export function DailyTrend({ data, className }: { data: Datum[]; className?: string }) {
  const [hover, setHover] = React.useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        No visits recorded in this period.
      </p>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.value));
  // Reference lines at a quarter, half and three quarters of the peak.
  const gridLines = [0.25, 0.5, 0.75, 1];

  return (
    <div className={cn("relative", className)}>
      <div className="relative flex h-[180px] items-end gap-[2px]" role="presentation">
        {/* Recessive grid */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {gridLines.map((fraction) => (
            <div
              key={fraction}
              className="absolute inset-x-0 border-t border-border/60"
              style={{ bottom: `${fraction * 100}%` }}
            />
          ))}
        </div>

        {data.map((item, index) => {
          const height = (item.value / max) * 100;
          const active = hover === index;
          return (
            <button
              key={item.label}
              type="button"
              className="group relative flex h-full min-w-0 flex-1 items-end focus-visible:outline-none"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
              aria-label={`${formatDate(item.label)}: ${item.value} visit${item.value === 1 ? "" : "s"}`}
            >
              <span
                className={cn(
                  "w-full rounded-t-[4px] transition-colors",
                  active ? "bg-primary" : "bg-primary/55 group-hover:bg-primary",
                )}
                style={{ height: `${Math.max(item.value > 0 ? 4 : 1.5, height)}%` }}
              />
              {active ? (
                <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-10 w-max -translate-x-1/2 rounded-md bg-navy px-2.5 py-1.5 text-xs text-navy-foreground shadow-md">
                  <span className="block font-semibold">
                    {item.value} visit{item.value === 1 ? "" : "s"}
                  </span>
                  <span className="block text-navy-foreground/70">{formatDate(item.label)}</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{formatDate(data[0].label)}</span>
        {data.length > 2 ? <span>{formatDate(data[data.length - 1].label)}</span> : null}
      </div>

      {/* Equivalent tabular data for assistive technology */}
      <table className="sr-only">
        <caption>Visits per day</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Visits</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.label}>
              <th scope="row">{formatDate(item.label)}</th>
              <td>{item.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
