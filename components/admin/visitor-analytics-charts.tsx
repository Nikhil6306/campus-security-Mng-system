"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MonthlyVisitorDatum,
  VisitorCategoryDatum,
  GrowthPoint,
} from "@/lib/api";

/* ------------------------------------------------------------------ *
 * 1. MONTHLY VISITOR BAR CHART
 * ------------------------------------------------------------------ */

export function MonthlyBarChart({
  data,
  year,
  className,
}: {
  data: MonthlyVisitorDatum[];
  year: number;
  className?: string;
}) {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  const maxValue = Math.max(1, ...data.map((d) => d.count));
  const totalVisitors = data.reduce((acc, d) => acc + d.count, 0);

  if (!data || data.length === 0 || totalVisitors === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 p-6 text-center">
        <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm font-medium text-foreground">No visitor records for {year}</p>
        <p className="text-xs text-muted-foreground mt-1">
          No campus visits were recorded for the selected year.
        </p>
      </div>
    );
  }

  const gridSteps = [1, 0.75, 0.5, 0.25];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative h-64 w-full pt-6 pb-2">
        {/* Horizontal grid lines */}
        <div className="pointer-events-none absolute inset-x-0 top-6 bottom-8 flex flex-col justify-between" aria-hidden>
          {gridSteps.map((step) => (
            <div key={step} className="relative w-full border-t border-border/50">
              <span className="absolute -top-2.5 right-0 text-[10px] text-muted-foreground/70 font-mono">
                {Math.round(maxValue * step)}
              </span>
            </div>
          ))}
        </div>

        {/* Bars Container */}
        <div className="relative flex h-[calc(100%-2rem)] items-end gap-1.5 sm:gap-2.5 px-2">
          {data.map((item, index) => {
            const heightPct = Math.max(item.count > 0 ? 5 : 2, (item.count / maxValue) * 100);
            const isHovered = hoverIndex === index;

            return (
              <div
                key={item.month}
                className="group relative flex h-full flex-1 flex-col items-center justify-end"
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
                tabIndex={0}
                role="button"
                aria-label={`${item.monthName} ${year}: ${item.count} visitors, ${item.visits} visits`}
                onFocus={() => setHoverIndex(index)}
                onBlur={() => setHoverIndex(null)}
              >
                {/* Floating Tooltip */}
                {isHovered && (
                  <div className="pointer-events-none absolute bottom-[calc(100%+8px)] z-30 min-w-[140px] rounded-lg bg-slate-900 dark:bg-slate-800 p-2.5 text-white shadow-xl border border-white/10 animate-in fade-in-0 zoom-in-95">
                    <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-1 mb-1">
                      <span className="text-xs font-bold text-white">
                        {item.monthName} {year}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary text-white">
                        {item.percentage}%
                      </span>
                    </div>
                    <div className="space-y-0.5 text-[11px]">
                      <div className="flex justify-between text-slate-300">
                        <span>Total Visitors:</span>
                        <span className="font-bold text-white">{item.count}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Distinct Visits:</span>
                        <span className="font-medium text-slate-200">{item.visits}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bar */}
                <div
                  className={cn(
                    "w-full rounded-t-md transition-all duration-300",
                    isHovered
                      ? "bg-primary shadow-lg shadow-primary/30"
                      : item.count > 0
                      ? "bg-primary/80 hover:bg-primary"
                      : "bg-muted-foreground/20",
                  )}
                  style={{ height: `${heightPct}%` }}
                />

                {/* Count label above bar (visible on desktop if non-zero) */}
                {item.count > 0 && (
                  <span
                    className={cn(
                      "absolute -top-5 text-[10px] font-bold tabular-nums transition-opacity hidden sm:block",
                      isHovered ? "text-primary scale-110" : "text-muted-foreground",
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between px-2 pt-2 border-t border-border">
          {data.map((item, idx) => (
            <span
              key={item.month}
              className={cn(
                "flex-1 text-center text-[10px] sm:text-xs transition-colors truncate",
                hoverIndex === idx
                  ? "font-bold text-primary"
                  : "text-muted-foreground",
              )}
            >
              <span className="hidden sm:inline">{item.monthShort}</span>
              <span className="sm:hidden">{item.monthShort.slice(0, 1)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Screen reader table */}
      <table className="sr-only">
        <caption>Monthly visitor footfall for {year}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Visitors</th>
            <th scope="col">Visits</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <td>{d.monthName}</td>
              <td>{d.count}</td>
              <td>{d.visits}</td>
              <td>{d.percentage}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 2. VISITOR GROWTH LINE / AREA CHART
 * ------------------------------------------------------------------ */

export function VisitorGrowthLineChart({
  data,
  className,
}: {
  data: GrowthPoint[];
  className?: string;
}) {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
        No growth trend data available yet.
      </div>
    );
  }

  const maxValue = Math.max(1, ...data.map((d) => d.count));
  const svgWidth = 600;
  const svgHeight = 220;
  const paddingX = 35;
  const paddingY = 25;

  const width = svgWidth - paddingX * 2;
  const height = svgHeight - paddingY * 2;

  const points = data.map((d, i) => {
    const x = paddingX + (data.length > 1 ? (i / (data.length - 1)) * width : width / 2);
    const y = paddingY + height - (d.count / maxValue) * height;
    return { x, y, ...d };
  });

  // Build SVG path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    pathD += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  // Area path closing down to bottom
  const areaD = `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`;

  return (
    <div className={cn("relative space-y-2", className)}>
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-56 sm:h-64 overflow-visible"
        >
          <defs>
            <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = paddingY + height * (1 - fraction);
            return (
              <g key={fraction}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={svgWidth - paddingX}
                  y2={y}
                  stroke="currentColor"
                  className="text-border/60"
                  strokeDasharray="3 3"
                />
                <text
                  x={svgWidth - paddingX + 5}
                  y={y + 3}
                  className="fill-muted-foreground text-[9px] font-mono"
                >
                  {Math.round(maxValue * fraction)}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaD} fill="url(#growthGradient)" />

          {/* Line stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive points */}
          {points.map((pt, idx) => {
            const isHovered = hoverIndex === idx;
            return (
              <g
                key={pt.key}
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
                className="cursor-pointer group"
              >
                {/* Invisible larger hit target */}
                <circle cx={pt.x} cy={pt.y} r={14} fill="transparent" />

                {/* Outer halo on hover */}
                {isHovered && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={8}
                    fill="var(--primary)"
                    opacity="0.3"
                    className="animate-pulse"
                  />
                )}

                {/* Visible dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5 : 3.5}
                  fill="var(--primary)"
                  stroke="white"
                  strokeWidth="2"
                  className="transition-all duration-200"
                />
              </g>
            );
          })}
        </svg>

        {/* Hover readout card */}
        {hoverIndex !== null && points[hoverIndex] && (
          <div
            className="absolute z-20 pointer-events-none -translate-x-1/2 rounded-lg bg-slate-900 dark:bg-slate-800 p-2.5 text-white shadow-xl border border-white/10"
            style={{
              left: `${(points[hoverIndex].x / svgWidth) * 100}%`,
              top: `${Math.max(10, (points[hoverIndex].y / svgHeight) * 100 - 32)}%`,
            }}
          >
            <p className="text-xs font-bold text-white mb-0.5">{points[hoverIndex].label}</p>
            <p className="text-[11px] text-primary font-semibold">
              {points[hoverIndex].count} visitors
            </p>
            <p className="text-[10px] text-slate-400">
              {points[hoverIndex].visits} visits recorded
            </p>
          </div>
        )}
      </div>

      {/* Bottom Range Labels */}
      <div className="flex justify-between text-xs text-muted-foreground px-2">
        <span>{data[0]?.label}</span>
        {data.length > 2 && (
          <span>{data[Math.floor(data.length / 2)]?.label}</span>
        )}
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 3. VISITOR CATEGORIES DOUGHNUT CHART
 * ------------------------------------------------------------------ */

export function VisitorCategoriesChart({
  categories,
  className,
}: {
  categories: VisitorCategoryDatum[];
  className?: string;
}) {
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);

  const total = categories.reduce((acc, c) => acc + c.count, 0);

  if (!categories || categories.length === 0 || total === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
        No visitor category data available.
      </div>
    );
  }

  // Calculate slice angles for SVG doughnut
  let cumulativeAngle = 0;
  const radius = 68;
  const innerRadius = 45;
  const cx = 100;
  const cy = 100;

  const slices = categories.map((cat) => {
    const fraction = cat.count / total;
    const angle = fraction * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    // SVG arc coordinates
    const x1 = cx + radius * Math.cos(startAngle - Math.PI / 2);
    const y1 = cy + radius * Math.sin(startAngle - Math.PI / 2);
    const x2 = cx + radius * Math.cos(endAngle - Math.PI / 2);
    const y2 = cy + radius * Math.sin(endAngle - Math.PI / 2);

    const x3 = cx + innerRadius * Math.cos(endAngle - Math.PI / 2);
    const y3 = cy + innerRadius * Math.sin(endAngle - Math.PI / 2);
    const x4 = cx + innerRadius * Math.cos(startAngle - Math.PI / 2);
    const y4 = cy + innerRadius * Math.sin(startAngle - Math.PI / 2);

    const largeArcFlag = angle > Math.PI ? 1 : 0;

    const pathData = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
      "Z",
    ].join(" ");

    return {
      ...cat,
      pathData,
      fraction,
    };
  });

  const highlighted = activeCategory
    ? categories.find((c) => c.category === activeCategory)
    : null;

  return (
    <div className={cn("grid gap-6 sm:grid-cols-12 items-center", className)}>
      {/* Visual Doughnut */}
      <div className="sm:col-span-5 flex justify-center relative">
        <svg viewBox="0 0 200 200" className="w-48 h-48 sm:w-52 sm:h-52">
          {slices.map((slice) => {
            const isHovered = activeCategory === slice.category;
            return (
              <path
                key={slice.category}
                d={slice.pathData}
                fill={slice.color}
                className={cn(
                  "cursor-pointer transition-all duration-200 stroke-card stroke-2",
                  isHovered ? "opacity-100 scale-105" : "opacity-90 hover:opacity-100",
                )}
                style={{ transformOrigin: "100px 100px" }}
                onMouseEnter={() => setActiveCategory(slice.category)}
                onMouseLeave={() => setActiveCategory(null)}
              />
            );
          })}
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          {highlighted ? (
            <>
              <span className="text-xl font-bold text-foreground tabular-nums">
                {highlighted.count}
              </span>
              <span className="text-[11px] font-semibold text-primary truncate max-w-[85px]">
                {highlighted.label}
              </span>
              <span className="text-[10px] text-muted-foreground">{highlighted.percentage}%</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold text-foreground tabular-nums">{total}</span>
              <span className="text-[11px] font-medium text-muted-foreground">Total Visitors</span>
            </>
          )}
        </div>
      </div>

      {/* Legend & Details */}
      <div className="sm:col-span-7 space-y-2.5">
        {categories.map((cat) => {
          const isHovered = activeCategory === cat.category;
          return (
            <div
              key={cat.category}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer text-sm",
                isHovered ? "bg-muted font-medium" : "hover:bg-muted/50",
              )}
              onMouseEnter={() => setActiveCategory(cat.category)}
              onMouseLeave={() => setActiveCategory(null)}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="truncate text-foreground text-xs sm:text-sm">{cat.label}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 tabular-nums">
                <span className="text-xs font-bold text-foreground">{cat.count}</span>
                <span className="text-[11px] text-muted-foreground w-9 text-right font-medium">
                  {cat.percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 4. MONTHLY COMPARISON CARD
 * ------------------------------------------------------------------ */

export function MonthlyComparisonCard({
  currentMonthVisitors,
  previousMonthVisitors,
  currentMonthName,
  previousMonthName,
  delta,
  growthPercent,
}: {
  currentMonthVisitors: number;
  previousMonthVisitors: number;
  currentMonthName: string;
  previousMonthName: string;
  delta: number;
  growthPercent: number;
}) {
  const isPositive = delta > 0;
  const isZero = delta === 0;

  const maxVal = Math.max(1, currentMonthVisitors, previousMonthVisitors);
  const currentPct = Math.round((currentMonthVisitors / maxVal) * 100);
  const prevPct = Math.round((previousMonthVisitors / maxVal) * 100);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Monthly Footfall Comparison</h4>
        <div
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums",
            isPositive
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : isZero
              ? "bg-muted text-muted-foreground"
              : "bg-rose-500/15 text-rose-700 dark:text-rose-400",
          )}
        >
          {isPositive ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : isZero ? (
            <Minus className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          <span>
            {isPositive ? `+${growthPercent}%` : `${growthPercent}%`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-1">
        {/* Previous Month */}
        <div className="space-y-1.5 p-3 rounded-lg bg-muted/40 border border-border/40">
          <p className="text-xs text-muted-foreground font-medium truncate">{previousMonthName}</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {previousMonthVisitors}
          </p>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-muted-foreground/60 rounded-full transition-all duration-500"
              style={{ width: `${prevPct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">Previous month footfall</p>
        </div>

        {/* Current Month */}
        <div className="space-y-1.5 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-xs text-primary font-medium truncate">{currentMonthName}</p>
          <p className="text-2xl font-bold text-primary tabular-nums">
            {currentMonthVisitors}
          </p>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${currentPct}%` }}
            />
          </div>
          <p className="text-[10px] text-primary/80 font-medium">
            {delta >= 0 ? `+${delta} vs last month` : `${delta} vs last month`}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed pt-1">
        {isPositive ? (
          <>
            Campus footfall increased by <strong>{growthPercent}%</strong> compared to {previousMonthName}.
          </>
        ) : isZero ? (
          <>Footfall remained steady compared to {previousMonthName}.</>
        ) : (
          <>
            Campus footfall is down by <strong>{Math.abs(growthPercent)}%</strong> compared to {previousMonthName}.
          </>
        )}
      </p>
    </div>
  );
}
