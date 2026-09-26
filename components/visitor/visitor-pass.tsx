"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Download, MapPin, Printer, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { EmptyState, InlineLoader } from "@/components/shared/states";
import { FormField } from "@/components/shared/form-field";
import { LogoMark, UNIVERSITY_NAME } from "@/components/shared/logo";
import { StatusBadge } from "@/components/shared/status-badge";
import { PassQR, buildPassPayload } from "@/components/shared/pass-qr";
import { toast } from "@/components/ui/toaster";
import { api, errorMessage, type PublicBookingView } from "@/lib/api";
import { downloadFile } from "@/lib/export";
import { type VisitStatus } from "@/lib/types";
import { formatClock, formatDate, formatDateTime, formatTime } from "@/lib/utils";
import { STATUS_PATH } from "@/lib/dsvv";
import { validateMobile } from "@/lib/validation";

function PassField({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 break-words text-[13px] font-medium leading-snug ${mono ? "font-mono" : ""}`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

const escapeHtml = (value: unknown) =>
  String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Builds a self-contained HTML copy of the pass so the visitor has a file they
 * can keep or open offline. The QR is lifted straight from the rendered SVG,
 * so the downloaded copy carries the same code as the screen.
 */
function buildPassDocument(record: PublicBookingView, qrMarkup: string): string {
  const row = (label: string, value: unknown) =>
    `<div class="field"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Campus Visitor Pass ${escapeHtml(record.id)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: #f4f6f9; font-family: ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif; color: #14213a; }
  .pass { max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #d5dce6; border-radius: 10px; overflow: hidden; }
  header { display: flex; align-items: center; gap: 12px; background: #0e2a47; color: #fff; padding: 16px 20px; }
  header h1 { margin: 0; font-size: 13px; letter-spacing: .14em; text-transform: uppercase; }
  header p { margin: 0; font-size: 11px; opacity: .7; }
  .status { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; border-bottom: 1px solid #e3e8ef; background: #f7fafc; font-size: 12px; }
  .status strong { font-size: 12px; }
  .body { display: flex; gap: 20px; padding: 20px; flex-wrap: wrap; }
  .details { flex: 1 1 260px; min-width: 240px; }
  .name { font-size: 20px; font-weight: 600; margin: 0 0 2px; }
  .type { margin: 0 0 16px; font-size: 12px; color: #5b6880; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .label { display: block; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: #6b7890; }
  .value { display: block; font-size: 13px; font-weight: 500; word-break: break-word; }
  .qr { text-align: center; flex: 0 0 150px; }
  .qr svg { width: 132px; height: 132px; }
  .qr p { font-size: 10px; color: #5b6880; margin: 8px 0 0; }
  footer { border-top: 1px solid #e3e8ef; background: #f7fafc; padding: 14px 20px; font-size: 10px; color: #5b6880; line-height: 1.6; }
  @media print { body { background: #fff; padding: 0; } .pass { border: none; } }
</style>
</head>
<body>
  <div class="pass">
    <header>
      <div>
        <p>${escapeHtml(record.campusName)}</p>
        <h1>Campus Visitor Pass</h1>
      </div>
    </header>
    <div class="status"><span>Pass status</span><strong>${escapeHtml(record.status)}</strong></div>
    <div class="body">
      <div class="details">
        <p class="name">${escapeHtml(record.fullName)}</p>
        <p class="type">${escapeHtml(record.purpose)}</p>
        <div class="grid">
          ${row("Booking ID", record.id)}
          ${row("Host", record.hostName)}
          ${row("Department", record.department)}
          ${row("Visit date", formatDate(record.visitDate))}
          ${row("Visit time", formatTime(record.visitTime))}
          ${row("Duration", record.expectedDuration)}
          ${row("No. of visitors", record.numberOfVisitors)}
          ${row("Vehicle number", record.vehicleNumber ?? "Not declared")}
          ${row("Badge", record.badgeNumber ?? "Issued at gate")}
          ${record.checkInAt ? row("Checked in", formatDateTime(record.checkInAt)) : ""}
          ${record.checkOutAt ? row("Checked out", formatDateTime(record.checkOutAt)) : ""}
        </div>
      </div>
      <div class="qr">
        ${qrMarkup}
        <p>${escapeHtml(record.id)}</p>
      </div>
    </div>
    <footer>
      Carry a government photo ID along with this pass. It is valid only for the date and time
      shown and must be surrendered at check-out. Entry is subject to campus security policy.<br />
      ${escapeHtml(record.campusName)} · Campus Security Management System
    </footer>
  </div>
</body>
</html>`;
}

/**
 * The digital visitor pass.
 *
 * A pass is personal, so it is not served from a reference alone: the visitor
 * confirms the mobile number the booking was made with and the server returns a
 * redacted view of that one booking. No ID number or address ever reaches this
 * page, and the QR carries only an opaque lookup token.
 */
export function VisitorPassView({ bookingId }: { bookingId: string }) {
  const params = useSearchParams();
  const initialMobile = params.get("mobile") ?? "";

  const [mobile, setMobile] = React.useState(initialMobile);
  const [record, setRecord] = React.useState<PublicBookingView | null>(null);
  const [error, setError] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  const [attempted, setAttempted] = React.useState(false);
  const autoRan = React.useRef(false);

  const load = React.useCallback(
    async (phone: string) => {
      setBusy(true);
      setError(undefined);
      try {
        const result = await api.bookingStatus(bookingId, phone.replace(/[\s-]/g, ""));
        setRecord(result.booking);
      } catch (err) {
        setRecord(null);
        setError(errorMessage(err, "We could not open that pass. Please try again."));
      } finally {
        setBusy(false);
        setAttempted(true);
      }
    },
    [bookingId],
  );

  React.useEffect(() => {
    if (autoRan.current || !initialMobile) return;
    autoRan.current = true;
    void load(initialMobile);
  }, [initialMobile, load]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const invalid = validateMobile(mobile);
    if (invalid) {
      setError(invalid);
      return;
    }
    void load(mobile);
  };

  /* ---------------------------- Gate: identify ---------------------------- */

  if (!record) {
    if (busy) return <InlineLoader label="Opening visitor pass…" />;

    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="space-y-5 p-6">
          {attempted && error ? (
            <EmptyState
              icon={AlertTriangle}
              title="Visitor pass not available"
              description={error}
            />
          ) : (
            <div className="space-y-1.5 text-center">
              <h2 className="text-base font-semibold">Confirm it is you</h2>
              <p className="text-sm text-muted-foreground">
                Enter the mobile number used for booking{" "}
                <span className="font-mono text-foreground">{bookingId}</span> to open the pass.
              </p>
            </div>
          )}

          <form onSubmit={submit} noValidate className="space-y-4">
            <FormField
              id="pass-mobile"
              label="Mobile number"
              required
              error={attempted ? undefined : error}
            >
              <Input
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value.replace(/[^\d\s-]/g, ""));
                  setError(undefined);
                }}
                placeholder="9876500011"
                inputMode="numeric"
                maxLength={13}
                autoComplete="tel"
                invalid={Boolean(error)}
              />
            </FormField>
            <Button type="submit" className="w-full" loading={busy}>
              Open my pass
            </Button>
          </form>

          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={STATUS_PATH}>Check booking status</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ------------------------------- The pass ------------------------------- */

  const handleDownload = () => {
    const qrMarkup = document.getElementById("visitor-pass-qr")?.innerHTML ?? "";
    downloadFile(
      `visitor-pass-${record.id}.html`,
      buildPassDocument(record, qrMarkup),
      "text/html;charset=utf-8",
    );
    toast.success("Visitor pass downloaded.", {
      description: "Open the saved file to view or print your pass.",
    });
  };

  const valid = ["Approved", "Checked In", "Meeting In Progress", "Checked Out"].includes(
    record.status,
  );

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {!valid && (
        <div
          role="status"
          className="no-print flex gap-3 rounded-md border border-warning/30 bg-warning/10 p-3.5 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" aria-hidden />
          <p className="text-foreground/80">
            This pass is a preview only. It is not valid for entry while the booking is{" "}
            <strong className="font-semibold">{record.status.toLowerCase()}</strong>.
          </p>
        </div>
      )}

      <Card className="print-sheet overflow-hidden shadow-panel">
        <header className="flex items-center gap-3 bg-primary px-5 py-4">
          <LogoMark size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-white/70">{UNIVERSITY_NAME}</p>
            <h2 className="truncate text-sm font-semibold uppercase tracking-[0.14em] text-white">
              Campus Visitor Pass
            </h2>
          </div>
          <ShieldCheck className="h-6 w-6 shrink-0 text-white/80" aria-hidden />
        </header>

        <div
          className={`flex items-center justify-between gap-2 border-b border-border px-5 py-2.5 ${
            valid ? "bg-success/10" : "bg-warning/10"
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Pass status
          </span>
          <StatusBadge status={record.status as VisitStatus} />
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto]">
          <div className="min-w-0 space-y-4">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Visitor name
              </p>
              <p className="mt-0.5 text-lg font-semibold leading-tight tracking-tight">
                {record.fullName}
              </p>
              <p className="text-xs text-muted-foreground">{record.purpose}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <PassField label="Booking ID" value={record.id} mono className="col-span-2" />
              <PassField label="Host" value={record.hostName} />
              <PassField label="Department" value={record.department} />
              <PassField label="Visit date" value={formatDate(record.visitDate)} />
              <PassField label="Visit time" value={formatTime(record.visitTime)} />
              <PassField label="Duration" value={record.expectedDuration} />
              <PassField label="No. of visitors" value={record.numberOfVisitors} />
              <PassField
                label="Vehicle number"
                value={record.vehicleNumber ?? "Not declared"}
                mono={Boolean(record.vehicleNumber)}
              />
              <PassField label="Badge" value={record.badgeNumber ?? "Issued at gate"} mono />
            </div>
          </div>

          <div id="visitor-pass-qr" className="flex flex-col items-center gap-3 sm:w-[150px]">
            <PassQR
              value={buildPassPayload(record.id, record.passToken)}
              size={124}
              label={record.id}
            />
            <p className="text-center text-[10px] leading-snug text-muted-foreground">
              Present this code at the gate. Verification is performed against the booking record.
            </p>
          </div>
        </div>

        {(record.checkInAt || record.checkOutAt) && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-4 px-5 py-3.5">
              <PassField label="Checked in" value={formatClock(record.checkInAt)} />
              <PassField label="Checked out" value={formatClock(record.checkOutAt)} />
            </div>
          </>
        )}

        <footer className="space-y-1.5 border-t border-border bg-muted/40 px-5 py-3.5">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Carry a government photo ID along with this pass. The pass is valid only for the date
            and time shown and must be surrendered at check-out. Entry is subject to campus
            security policy.
          </p>
          <p className="text-[10px] font-medium text-muted-foreground">
            {record.campusName} · Campus Security Management System
          </p>
        </footer>
      </Card>

      <div className="no-print grid gap-2 sm:grid-cols-3">
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print Pass
        </Button>
        <Button variant="outline" onClick={handleDownload}>
          <Download className="h-4 w-4" />
          Download Pass
        </Button>
        <Button asChild variant="outline">
          <Link
            href={`${STATUS_PATH}?id=${record.id}&mobile=${encodeURIComponent(
              mobile.replace(/[\s-]/g, ""),
            )}`}
          >
            <MapPin className="h-4 w-4" />
            Track Visit
          </Link>
        </Button>
      </div>
    </div>
  );
}
