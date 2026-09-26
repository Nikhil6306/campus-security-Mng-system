"use client";

/**
 * Client-side file export.
 *
 * Everything the reports module offers as a download is generated in the
 * browser from data already held in memory — no server round-trip.
 */

/** Escapes a single CSV cell (quotes, commas, newlines, leading formulas). */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/["\n\r,]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => csvCell(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(","));
  // BOM keeps Excel happy with UTF-8 (names contain accented characters).
  return `﻿${[head, ...body].join("\r\n")}`;
}

/** Triggers a browser download for text content. */
export function downloadFile(
  filename: string,
  content: string,
  mime = "text/csv;charset=utf-8",
): void {
  if (typeof window === "undefined") return;

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Give the browser a tick to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): void {
  downloadFile(filename, toCsv(rows, columns));
}

/** `visitor-report-2026-09-08.csv` */
export function stampedFilename(base: string, extension = "csv"): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
  return `${base}-${stamp}.${extension}`;
}
