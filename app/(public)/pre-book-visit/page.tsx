import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardCheck, IdCard, ShieldCheck } from "lucide-react";

import { BookingWizard } from "@/components/visitor/booking-wizard";
import { PageBanner } from "@/components/public/page-banner";
import { STATUS_PATH, UNIVERSITY } from "@/lib/dsvv";

export const metadata: Metadata = {
  title: "Pre-Book a Visit",
  description:
    "Plan your visit to Dev Sanskriti Vishwavidyalaya, Haridwar. Share your details, choose a date and time, and receive a booking reference immediately.",
  alternates: { canonical: "/pre-book-visit" },
};

const assurances = [
  {
    icon: ClipboardCheck,
    title: "A reference straight away",
    description: "You receive a booking reference as soon as the request is submitted.",
  },
  {
    icon: ShieldCheck,
    title: "Reviewed before entry",
    description: "The university reviews every request. A submitted request is not yet approved.",
  },
  {
    icon: IdCard,
    title: "Bring the same ID",
    description: "Carry the original photo ID whose details you enter here.",
  },
];

export default function PreBookVisitPage() {
  return (
    <>
      <PageBanner
        eyebrow="Pre-booking"
        title={`Plan your visit to ${UNIVERSITY.shortName}`}
        description="Tell us about your visit and choose a convenient date and time."
        breadcrumb={[{ label: "Pre-Book a Visit" }]}
      />

      <div className="border-b border-border bg-background py-10 lg:py-14">
        <div className="container">
          <ul className="mb-10 grid gap-4 sm:grid-cols-3">
            {assurances.map((item) => (
              <li
                key={item.title}
                className="flex gap-3 rounded-lg border border-border bg-card p-4 shadow-xs"
              >
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                <div>
                  <h2 className="text-sm font-semibold">{item.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <BookingWizard />

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already booked?{" "}
            <Link
              href={STATUS_PATH}
              className="font-medium text-primary-strong underline-offset-4 hover:underline"
            >
              Check your booking status
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
