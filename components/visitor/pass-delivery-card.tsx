"use client";

import * as React from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Printer,
  RefreshCw,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { api, errorMessage, type PassDeliveryReport } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * The visitor's pass: QR code, downloads, and WhatsApp delivery.
 *
 * WHAT THE QR CARRIES: the absolute URL of the verification page plus the
 * booking's pass token, and nothing else. No name, no contact number, no
 * address, no ID number and no Aadhaar fragment is encoded — a scan resolves
 * to a server-rendered page that decides for itself what a gate officer may
 * see.
 */

interface PassDeliveryCardProps {
  bookingId: string;
  /** The number the booking was made with — used to authorise delivery. */
  mobile: string;
  /** Opaque pass token issued by the server. */
  passToken?: string;
  campusName: string;
  /** Rendered under the code so the reference can be read without scanning. */
  caption?: string;
  /** Delivery state already known to the caller, to avoid a first round-trip. */
  initialDelivery?: PassDeliveryReport;
  className?: string;
}

/** Off-screen render size — large enough that the saved PNG scans reliably. */
const DOWNLOAD_SIZE = 1024;

export function PassDeliveryCard({
  bookingId,
  mobile,
  passToken,
  campusName,
  caption,
  initialDelivery,
  className,
}: PassDeliveryCardProps) {
  const [origin, setOrigin] = React.useState("");
  const [delivery, setDelivery] = React.useState<PassDeliveryReport | undefined>(initialDelivery);
  const [sending, setSending] = React.useState(false);
  const downloadRef = React.useRef<HTMLDivElement>(null);

  // The verification URL has to be absolute to be scannable, and the origin is
  // only knowable in the browser.
  React.useEffect(() => setOrigin(window.location.origin), []);

  const verifyUrl = React.useMemo(() => {
    if (!origin) return "";
    return passToken
      ? `${origin}/visit/verify/${encodeURIComponent(passToken)}`
      : `${origin}/booking-status?id=${encodeURIComponent(bookingId)}`;
  }, [origin, passToken, bookingId]);

  React.useEffect(() => {
    if (initialDelivery) return;
    let alive = true;
    api
      .passDelivery(bookingId, mobile)
      .then((result) => {
        if (alive) setDelivery(result.delivery);
      })
      .catch(() => {
        // A status read is a convenience; the pass and its downloads work
        // whether or not we can report on WhatsApp right now.
      });
    return () => {
      alive = false;
    };
  }, [bookingId, mobile, initialDelivery]);

  /* ------------------------------ Downloads ------------------------------ */

  const downloadQr = () => {
    const canvas = downloadRef.current?.querySelector("canvas");
    if (!canvas) {
      toast.error("The QR code is still being prepared. Please try again in a moment.");
      return;
    }
    try {
      const url = canvas.toDataURL("image/png");
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${bookingId}-visit-qr.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      toast.error("Your browser blocked the download. Try again, or use the printable pass.");
    }
  };

  /* --------------------------- WhatsApp delivery -------------------------- */

  const send = async () => {
    setSending(true);
    try {
      const result = await api.sendPass(bookingId, mobile);
      setDelivery(result.delivery);
      // Report exactly what the provider said — a recorded-but-not-transmitted
      // message is never announced as delivered.
      if (result.delivery.state === "sent") toast.success("Your visit pass was sent to WhatsApp.");
      else if (result.delivery.state === "simulated") toast.info(result.delivery.detail);
      else toast.error(result.delivery.detail);
    } catch (error) {
      toast.error(errorMessage(error, "We could not reach the delivery service. Please retry."));
    } finally {
      setSending(false);
    }
  };

  const tone = deliveryTone(delivery);

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-5">
        <div className="rounded-md border border-border bg-white p-3">
          {verifyUrl ? (
            <QRCodeCanvas
              value={verifyUrl}
              size={168}
              level="M"
              marginSize={0}
              bgColor="#ffffff"
              fgColor="#172033"
              aria-label={`QR code for booking ${bookingId}`}
            />
          ) : (
            <div className="h-[168px] w-[168px] animate-pulse rounded bg-muted" aria-hidden />
          )}
        </div>
        <p className="text-center font-mono text-xs tracking-tight text-muted-foreground">
          {caption ?? bookingId}
        </p>
        <p className="max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
          Show this code at the gate. It identifies your booking — it carries no personal details.
        </p>
      </div>

      {/* Rendered off-screen at high resolution purely as the download source. */}
      <div ref={downloadRef} className="sr-only" aria-hidden>
        {verifyUrl ? (
          <QRCodeCanvas
            value={verifyUrl}
            size={DOWNLOAD_SIZE}
            level="M"
            marginSize={2}
            bgColor="#ffffff"
            fgColor="#000000"
          />
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Button type="button" variant="outline" onClick={downloadQr} disabled={!verifyUrl}>
          <Download className="h-4 w-4" />
          Download QR Code
        </Button>
        <Button asChild variant="outline">
          <Link href={`/visitor/pass/${encodeURIComponent(bookingId)}?mobile=${encodeURIComponent(mobile)}`}>
            <Printer className="h-4 w-4" />
            Download Visit Pass
          </Link>
        </Button>
        <Button type="button" onClick={send} loading={sending} disabled={sending}>
          {delivery?.state === "failed" ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {delivery?.state === "failed" ? "Retry WhatsApp" : "Send to WhatsApp"}
        </Button>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-start gap-3 rounded-md border p-3.5 text-sm",
          tone.className,
        )}
      >
        <tone.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="font-medium">WhatsApp: {tone.label}</p>
          <p className="mt-0.5 text-foreground/80">
            {delivery?.detail ?? "Checking delivery status…"}
          </p>
          {delivery?.to ? (
            <p className="mt-0.5 text-xs text-muted-foreground">Sent to {delivery.to}</p>
          ) : null}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {campusName} reviews every request before entry is permitted. Keep your booking reference —
        you will need it, with your mobile number, to check the status of this visit.
      </p>
    </div>
  );
}

function deliveryTone(delivery?: PassDeliveryReport) {
  switch (delivery?.state) {
    case "sent":
      return {
        label: "Sent",
        icon: CheckCircle2,
        className: "border-success/30 bg-success/10 text-success-strong",
      };
    case "queued":
      return {
        label: "Queued",
        icon: Clock3,
        className: "border-border bg-muted text-foreground",
      };
    case "failed":
      return {
        label: "Failed",
        icon: AlertTriangle,
        className: "border-destructive/30 bg-destructive/10 text-destructive",
      };
    case "simulated":
    case "none":
      return {
        label: "Pending configuration",
        icon: AlertTriangle,
        className: "border-warning/30 bg-warning/10 text-warning-strong",
      };
    default:
      return {
        label: "Checking…",
        icon: Clock3,
        className: "border-border bg-muted text-foreground",
      };
  }
}
