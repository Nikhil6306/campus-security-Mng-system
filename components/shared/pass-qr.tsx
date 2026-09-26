"use client";

import { QRCodeSVG } from "qrcode.react";

import { cn } from "@/lib/utils";

/**
 * Encodes the booking reference so a gate operator can scan instead of typing.
 *
 * This is a plain, unsigned payload — it identifies a booking, it does not
 * authenticate it. Verification still happens against the booking record at
 * the gate.
 */
export function PassQR({
  value,
  size = 132,
  className,
  label,
}: {
  value: string;
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <figure className={cn("flex flex-col items-center gap-1.5", className)}>
      <div className="rounded-md border border-border bg-white p-2">
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          marginSize={0}
          bgColor="#ffffff"
          fgColor="#0e2a47"
          aria-label={`QR code for ${value}`}
        />
      </div>
      {label ? (
        <figcaption className="text-center font-mono text-[11px] tracking-tight text-muted-foreground">
          {label}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * Builds the string carried by the pass QR code.
 *
 * Prefers the opaque pass token the server issued on approval; a booking that
 * has no token yet (a preview of a pending request) falls back to the plain
 * reference, which the gate also accepts. Either way the scan only names a
 * booking — the gate re-reads that record before it decides anything, so this
 * payload carries no personal detail and grants nothing on its own.
 */
export function buildPassPayload(bookingId: string, passToken?: string) {
  return passToken?.trim() || bookingId;
}
