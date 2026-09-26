import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CalendarCheck, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeatureCard } from "@/components/public/cards";
import { MediaFrame } from "@/components/public/media-frame";
import { PageBanner } from "@/components/public/page-banner";
import { Section, SectionHeading } from "@/components/public/section";
import { BOOK_PATH, FACILITIES, UNIVERSITY } from "@/lib/dsvv";

export const metadata: Metadata = {
  title: "Facilities",
  description:
    "Campus facilities at Dev Sanskriti Vishwavidyalaya, Haridwar — library, laboratories, hostels, sports and gymnasium, health facilities, Wi-Fi, herbal gardens, yagyashala and cafeteria.",
  alternates: { canonical: "/facilities" },
};

export default function FacilitiesPage() {
  return (
    <>
      <PageBanner
        eyebrow="Facilities"
        title="Campus facilities"
        description="The facilities documented across the university campus. Photographs are added as the university supplies them."
        breadcrumb={[{ label: "Facilities" }]}
      >
        <Button asChild size="lg">
          <Link href={BOOK_PATH}>
            <CalendarCheck className="h-4 w-4" />
            Pre-Book a Visit
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/campus">See the campus</Link>
        </Button>
      </PageBanner>

      <Section aria-labelledby="facilities-title">
        <SectionHeading
          id="facilities-title"
          eyebrow="On campus"
          title="What the campus provides"
          description="Academic, residential, health, digital and cultural facilities."
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FACILITIES.map((facility) => (
            <li key={facility.title}>
              <FeatureCard
                icon={facility.icon}
                title={facility.title}
                description={facility.description}
                image={facility.image}
                imageAlt={`${facility.title} at ${UNIVERSITY.name}, ${UNIVERSITY.city}`}
              />
            </li>
          ))}
        </ul>

        <div className="mt-10 flex items-start gap-3 rounded-lg border border-border bg-secondary p-5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Which facilities a visitor may enter depends on the purpose of the visit and on
            university permission. Access to residential, laboratory and restricted areas is not
            granted automatically with a visit booking.
          </p>
        </div>
      </Section>

      <Section tone="muted" flush compact aria-labelledby="see-title">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <MediaFrame
            src="/assets/dsvv/dsvv-baltic-centre.webp"
            alt={`The Centre for Baltic Culture and Studies at ${UNIVERSITY.name}, ${UNIVERSITY.city}`}
            ratio="16/9"
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="shadow-panel"
          />
          <div className="space-y-6">
            <SectionHeading
              id="see-title"
              eyebrow="Visit"
              title="See the facilities for yourself"
              description="Pre-book a visit and tell us what you would like to see. Your request is reviewed by the university before entry is permitted."
            />
            <Button asChild size="lg">
              <Link href={BOOK_PATH}>
                Pre-Book a Visit
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
