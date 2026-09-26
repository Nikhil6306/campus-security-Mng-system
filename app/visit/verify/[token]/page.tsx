import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, ShieldOff } from "lucide-react";

import { LogoMark } from "@/components/shared/logo";
import { verifyPassToken } from "@/lib/server/services/pass";
import { bootstrap } from "@/lib/server/http";
import { formatDate, formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Visit pass verification",
  description: "Verification of a campus visit pass.",
  // A page reachable with a token must never be indexed or previewed.
  robots: { index: false, follow: false, nocache: true },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

/**
 * QR verification, for the officer holding the scanner.
 *
 * Reached by scanning the QR on a visitor pass. The token is 24 random bytes,
 * so possession of the link is the only thing this page treats as meaningful —
 * and because that is a weak claim, the page shows only what somebody at the
 * gate needs to decide whether to admit the party: reference, name, slot,
 * headcount and status.
 *
 * It deliberately shows no address, no contact number, no email, no ID number
 * and no Aadhaar fragment, and it grants nothing: recording an entry is a
 * separate, authenticated action at /security.
 */
export default async function VerifyPassPage({ params }: PageProps) {
  bootstrap();
  const { token } = await params;
  const result = verifyPassToken(decodeURIComponent(token));

  const tone = !result.found
    ? "unknown"
    : result.valid
      ? "valid"
      : result.status === "Pending" || result.status === "Rescheduled"
        ? "pending"
        : "revoked";

  const banner = {
    valid: {
      icon: CheckCircle2,
      title: "Valid visit pass",
      className: "border-success/30 bg-success/10 text-success-strong",
    },
    pending: {
      icon: Clock3,
      title: "Not yet approved",
      className: "border-warning/30 bg-warning/10 text-warning-strong",
    },
    revoked: {
      icon: ShieldOff,
      title: "Pass not valid",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    },
    unknown: {
      icon: AlertTriangle,
      title: "Pass not recognised",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    },
  }[tone];

  const Icon = banner.icon;

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-muted px-4 py-12">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center justify-center gap-3">
          <LogoMark size="lg" />
          <p className="text-sm font-semibold tracking-tight">{result.campusName}</p>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-panel">
          <div className={cn("flex items-center gap-3 border-b px-5 py-4", banner.className)}>
            <Icon className="h-6 w-6 shrink-0" aria-hidden />
            <div>
              <h1 className="text-base font-semibold">{banner.title}</h1>
              {result.reason && <p className="mt-0.5 text-sm opacity-90">{result.reason}</p>}
            </div>
          </div>

          {result.found ? (
            <dl className="divide-y divide-border">
              <Row label="Booking ID" value={result.bookingId} mono />
              <Row label="Primary visitor" value={result.primaryVisitor} />
              <Row
                label="Visit date"
                value={result.visitDate ? formatDate(result.visitDate) : undefined}
              />
              <Row
                label="Visit time"
                value={result.visitTime ? formatTime(result.visitTime) : undefined}
              />
              <Row label="Total visitors" value={String(result.totalVisitors ?? 1)} />
              <Row label="Host" value={result.hostName || undefined} />
              <Row label="Status" value={result.status} />
              {result.partyNames && result.partyNames.length > 0 ? (
                <div className="px-5 py-3.5">
                  <dt className="text-xs text-muted-foreground">Accompanying visitors</dt>
                  <dd className="mt-1 text-sm">
                    <ul className="space-y-0.5">
                      {result.partyNames.map((name, index) => (
                        <li key={`${name}-${index}`} className="font-medium">
                          {name}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <div className="px-5 py-6 text-sm text-muted-foreground">
              This code does not match any booking on record. Ask the visitor for their booking
              reference and check it at the security desk.
            </div>
          )}

          <p className="border-t border-border bg-muted px-5 py-3 text-xs leading-relaxed text-muted-foreground">
            Verification only. Recording an entry is a separate, signed-in action at the security
            desk — this page admits nobody on its own.
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/" className="underline-offset-4 hover:underline">
            {result.campusName} visitor portal
          </Link>
        </p>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm font-medium", mono && "font-mono tracking-tight")}>{value}</dd>
    </div>
  );
}
