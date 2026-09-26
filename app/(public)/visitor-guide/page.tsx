import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, ArrowRight, Mail, MapPin, Phone, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FaqList } from "@/components/public/faq-list";
import { IconTile } from "@/components/public/cards";
import { PageBanner } from "@/components/public/page-banner";
import { Section, SectionHeading } from "@/components/public/section";
import {
  BOOK_PATH,
  CONTACT,
  FAQS,
  STATUS_GUIDE,
  STATUS_PATH,
  UNIVERSITY,
  VISITOR_GUIDE,
} from "@/lib/dsvv";

export const metadata: Metadata = {
  title: "Visitor Guide",
  description:
    "How to visit Dev Sanskriti Vishwavidyalaya, Haridwar — what to do before you visit, what to bring, arrival and conduct on campus, accessibility support and contact information.",
  alternates: { canonical: "/visitor-guide" },
};

export default function VisitorGuidePage() {
  return (
    <>
      <PageBanner
        eyebrow="Visitor guide"
        title="Visiting the campus"
        description="What to do before you travel, what to bring and what to expect when you arrive."
        breadcrumb={[{ label: "Visitor Guide" }]}
      >
        <Button asChild size="lg">
          <Link href={BOOK_PATH}>
            Pre-Book a Visit
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={STATUS_PATH}>
            <Search className="h-4 w-4" />
            Check Booking Status
          </Link>
        </Button>
      </PageBanner>

      <Section aria-labelledby="guide-title">
        <SectionHeading
          id="guide-title"
          eyebrow="Before, during and after"
          title="Visitor guide"
          description="Practical guidance for a campus visit. Where a detail is set by the university and not published here, it is marked so you can confirm it before travelling."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {VISITOR_GUIDE.map((section) => (
            <article
              key={section.title}
              className="flex h-full flex-col rounded-lg border border-border bg-card p-6 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <IconTile icon={section.icon} />
                <h3 className="text-base font-semibold">{section.title}</h3>
              </div>

              {section.unconfirmed && (
                <p className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-strong" aria-hidden />
                  To be confirmed with the university — this portal does not publish gate timings
                  or entry rules.
                </p>
              )}

              <ul className="mt-4 space-y-2.5">
                {section.points.map((point) => (
                  <li key={point} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section tone="muted" aria-labelledby="status-title">
        <SectionHeading
          id="status-title"
          eyebrow="Booking status"
          title="What each status means"
          description="Your booking moves through these states. Check it with your booking reference before you travel."
        />

        <div className="mt-10 overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">Booking status meanings</caption>
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    What it means
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {STATUS_GUIDE.map((row) => (
                  <tr key={row.status}>
                    <th scope="row" className="whitespace-nowrap px-5 py-3.5 align-top font-medium">
                      {row.status}
                    </th>
                    <td className="px-5 py-3.5 leading-relaxed text-muted-foreground">
                      {row.meaning}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section aria-labelledby="contact-title">
        <SectionHeading
          id="contact-title"
          eyebrow="Contact"
          title="Contacting the university"
          description={`For anything this guide does not answer, contact ${UNIVERSITY.name} directly.`}
        />

        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          <li className="rounded-lg border border-border bg-card p-6 shadow-xs">
            <IconTile icon={MapPin} />
            <h3 className="mt-4 text-sm font-semibold">Address</h3>
            <address className="mt-2 text-sm not-italic leading-relaxed text-muted-foreground">
              {CONTACT.addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </li>
          <li className="rounded-lg border border-border bg-card p-6 shadow-xs">
            <IconTile icon={Phone} />
            <h3 className="mt-4 text-sm font-semibold">Phone</h3>
            <p className="mt-2 space-y-1 text-sm leading-relaxed text-muted-foreground">
              <a
                className="block transition-colors hover:text-foreground"
                href={`tel:${CONTACT.generalPhone.replace(/\s/g, "")}`}
              >
                {CONTACT.generalPhone} — general
              </a>
              <a
                className="block transition-colors hover:text-foreground"
                href={`tel:${CONTACT.admissionsPhone.replace(/\s/g, "")}`}
              >
                {CONTACT.admissionsPhone} — admissions
              </a>
            </p>
          </li>
          <li className="rounded-lg border border-border bg-card p-6 shadow-xs">
            <IconTile icon={Mail} />
            <h3 className="mt-4 text-sm font-semibold">Email</h3>
            <p className="mt-2 space-y-1 text-sm leading-relaxed text-muted-foreground">
              <a
                className="block transition-colors hover:text-foreground"
                href={`mailto:${CONTACT.generalEmail}`}
              >
                {CONTACT.generalEmail}
              </a>
              <a
                className="block transition-colors hover:text-foreground"
                href={`mailto:${CONTACT.admissionsEmail}`}
              >
                {CONTACT.admissionsEmail}
              </a>
            </p>
          </li>
        </ul>

        <p className="mt-8 text-sm text-muted-foreground">
          Office hours:{" "}
          {CONTACT.officeHours.map((slot) => `${slot.days}, ${slot.hours}`).join("; ")}.
        </p>
      </Section>

      <Section tone="muted" flush aria-labelledby="faq-title">
        <SectionHeading
          id="faq-title"
          eyebrow="Questions"
          title="Frequently asked questions"
          description="About visiting the campus and pre-booking a visit."
        />
        <FaqList items={FAQS} />
      </Section>
    </>
  );
}
