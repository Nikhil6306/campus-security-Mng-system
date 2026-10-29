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
  id = "pass-qr-container",
}: {
  value: string;
  size?: number;
  className?: string;
  label?: string;
  id?: string;
}) {
  return (
    <figure id={id} className={cn("flex flex-col items-center gap-1.5", className)}>
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

/**
 * Converts the rendered QR SVG element into a high-resolution PNG image and triggers download.
 */
export async function downloadQrAsImage(elementId: string, filename = "visitor-pass-qr.png"): Promise<void> {
  const container = document.getElementById(elementId);
  const svg = container?.querySelector("svg") ?? (container as unknown as SVGElement);
  if (!svg) {
    throw new Error("QR code element could not be found.");
  }
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize canvas context.");

  const img = new Image();
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise<void>((resolve, reject) => {
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, 32, 32, 448, 448);
      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      resolve();
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
