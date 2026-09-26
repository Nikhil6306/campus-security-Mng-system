import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CalendarCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CampusGallery } from "@/components/public/campus-gallery";
import { FeatureCard } from "@/components/public/cards";
import { PageBanner } from "@/components/public/page-banner";
import { Section, SectionHeading } from "@/components/public/section";
import { BOOK_PATH, FACILITIES, GALLERY, UNIVERSITY, VISIT_REASONS } from "@/lib/dsvv";

export const metadata: Metadata = {
  title: "Campus",
  description:
    "Explore the Dev Sanskriti Vishwavidyalaya campus at Haridwar — academic buildings, library, laboratories, hostels, gardens and cultural spaces set in the Himalayan foothills.",
  alternates: { canonical: "/campus" },
};

/** The campus page leads with the spaces a visitor actually walks through. */
const CAMPUS_SPACES = FACILITIES.slice(0, 8);

export default function CampusPage() {
  return (
    <>
      <PageBanner
        eyebrow="Campus"
        title="A campus designed for learning, growth and reflection"
        description={`Academic, residential, cultural and recreational spaces within one green campus at ${UNIVERSITY.city}, ${UNIVERSITY.state}.`}
        breadcrumb={[{ label: "Campus" }]}
      >
        <Button asChild size="lg">
          <Link href={BOOK_PATH}>
            <CalendarCheck className="h-4 w-4" />
            Pre-Book a Visit
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/facilities">All facilities</Link>
        </Button>
      </PageBanner>

      <Section aria-labelledby="gallery-title">
        <SectionHeading
          id="gallery-title"
          eyebrow="Gallery"
          title={`Explore the ${UNIVERSITY.shortName} campus`}
          description="Photographs of the campus. Slots awaiting an official photograph are marked, so nothing here is presented as DSVV unless it is."
        />
        <CampusGallery items={GALLERY} />
      </Section>

      <Section tone="muted" aria-labelledby="spaces-title">
        <SectionHeading
          id="spaces-title"
          eyebrow="Campus spaces"
          title="What you will find on campus"
          description="The facilities the university documents across its grounds."
          action={
            <Button asChild variant="outline">
              <Link href="/facilities">
                Full list
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAMPUS_SPACES.map((facility) => (
            <li key={facility.title}>
              <FeatureCard
                icon={facility.icon}
                title={facility.title}
                description={facility.description}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section flush aria-labelledby="why-title">
        <SectionHeading
          id="why-title"
          eyebrow="Why visit"
          title="What a campus visit shows you"
          description="Reasons visitors come to the campus."
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VISIT_REASONS.map((reason) => (
            <li key={reason.title}>
              <FeatureCard
                icon={reason.icon}
                title={reason.title}
                description={reason.description}
              />
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-col items-start gap-4 rounded-lg border border-border bg-secondary p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Plan your visit to the campus</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pre-book in four short steps and receive your booking reference immediately.
            </p>
          </div>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={BOOK_PATH}>
              Pre-Book a Visit
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Section>
    </>
  );
}
