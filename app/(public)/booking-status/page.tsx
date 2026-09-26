import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Lock } from "lucide-react";

import { BookingStatusLookup } from "@/components/visitor/booking-status-lookup";
import { InlineLoader } from "@/components/shared/states";
import { PageBanner } from "@/components/public/page-banner";
import { BOOK_PATH } from "@/lib/dsvv";

export const metadata: Metadata = {
  title: "Check Booking Status",
  description:
    "Check the status of your campus visit request to Dev Sanskriti Vishwavidyalaya using your booking reference and the mobile number you booked with.",
  alternates: { canonical: "/booking-status" },
  robots: { index: true, follow: true },
};

export default function BookingStatusPage() {
  return (
    <>
      <PageBanner
        eyebrow="Booking status"
        title="Check your visit status"
        description="Enter your booking reference and the mobile number you booked with."
        breadcrumb={[{ label: "Booking Status" }]}
      />

      <div className="border-b border-border py-10 lg:py-14">
        <div className="container">
          <p className="mb-8 flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            Both the reference and the matching mobile number are required, so nobody else can
            look up your visit. Visitor details are never listed publicly.
          </p>

          <Suspense fallback={<InlineLoader label="Loading booking lookup…" />}>
            <BookingStatusLookup />
          </Suspense>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            No booking yet?{" "}
            <Link
              href={BOOK_PATH}
              className="font-medium text-primary-strong underline-offset-4 hover:underline"
            >
              Pre-book a visit
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
