import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  ClipboardCheck,
  Leaf,
  Mail,
  MapPin,
  Phone,
  Search,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CampusGallery } from "@/components/public/campus-gallery";
import { FaqList } from "@/components/public/faq-list";
import { FeatureCard, IconTile, StatCard } from "@/components/public/cards";
import { MediaFrame } from "@/components/public/media-frame";
import { Section, SectionHeading } from "@/components/public/section";
import {
  ABOUT_PARAGRAPHS,
  BOOK_PATH,
  CONTACT,
  FACILITIES,
  FAQS,
  GALLERY,
  HIGHLIGHTS,
  HOW_IT_WORKS,
  SCHOOLS,
  STATUS_PATH,
  UNIVERSITY,
  VISITOR_AUDIENCES,
  VISIT_REASONS,
} from "@/lib/dsvv";

export const metadata: Metadata = {
  // Absolute: the home page is already the full site name, so the layout
  // template would otherwise repeat it.
  title: { absolute: `${UNIVERSITY.name} | Visitor & Campus Visit Portal` },
  description:
    "Plan a visit to Dev Sanskriti Vishwavidyalaya, Haridwar. Explore the campus, academic schools and facilities, read the visitor guide, and pre-book your campus visit online.",
  alternates: { canonical: "/" },
  openGraph: {
    title: `${UNIVERSITY.name} | Visitor & Campus Visit Portal`,
    description:
      "Explore Dev Sanskriti Vishwavidyalaya, Haridwar and pre-book your campus visit.",
    url: "/",
    images: [{ url: "/assets/dsvv/dsvv-campus-entrance.webp", width: 1920, height: 1280 }],
  },
};

/** Facilities shown on the home page; the rest live on /facilities. */
const FACILITY_PREVIEW = FACILITIES.slice(0, 6);

export default function HomePage() {
  return (
    <>
      {/* ------------------------------ Hero ------------------------------ */}
      <section
        className="relative overflow-hidden border-b border-border bg-background"
        aria-labelledby="hero-title"
      >
        {/* A pale blue wash and one soft glow — no dark backdrop, no pattern. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-secondary via-background to-background"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-primary/[0.08] blur-3xl"
        />

        <div className="container relative grid gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-20">
          <div className="space-y-7">
            <Badge
              variant="outline"
              className="border-border bg-secondary px-3 py-1 text-primary-strong"
            >
              <Sparkles className="text-primary" aria-hidden />
              Welcome to {UNIVERSITY.name}
            </Badge>

            <div className="space-y-5">
              <h1
                id="hero-title"
                className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
              >
                Experience the campus.
                <span className="block text-primary">Discover DSVV.</span>
              </h1>
              <p className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                Plan your visit to {UNIVERSITY.name} and experience its academic environment,
                peaceful campus, cultural values and learning spaces.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={BOOK_PATH}>
                  Pre-Book a Visit
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="brandOutline">
                <Link href="/campus">Explore the Campus</Link>
              </Button>
            </div>

            <dl className="grid max-w-xl gap-x-6 gap-y-3 border-t border-border pt-6 sm:grid-cols-3">
              {[
                { label: "Established 2002", value: "Haridwar, Uttarakhand" },
                { label: "UGC recognised", value: "NAAC accredited" },
                { label: "Visits by pre-booking", value: "Reviewed before entry" },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-sm font-medium text-foreground">{item.label}</dt>
                  <dd className="text-sm text-muted-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* The campus photograph keeps its place in the hero, now as a
              framed panel on a white page rather than a dark full-bleed wash. */}
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-3 -z-10 rounded-2xl bg-primary/[0.06] blur-2xl"
            />
            <MediaFrame
              src="/assets/dsvv/dsvv-campus-entrance.webp"
              alt={`Shriram Bhawan, the administrative block of ${UNIVERSITY.name} in ${UNIVERSITY.city}`}
              ratio="4/3"
              priority
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="shadow-[0_18px_40px_-18px_rgba(23,32,51,0.28)]"
            />
          </div>
        </div>
      </section>

      {/* ------------------------------ About ----------------------------- */}
      <Section aria-labelledby="about-title">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-6">
            <SectionHeading
              id="about-title"
              eyebrow="About the university"
              title={`About ${UNIVERSITY.name}`}
              description={UNIVERSITY.vision}
            />
            {ABOUT_PARAGRAPHS.slice(0, 2).map((paragraph) => (
              <p key={paragraph} className="text-[15px] leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
            <Button asChild variant="outline" size="lg">
              <Link href="/about">
                Discover DSVV
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <MediaFrame
            src="/assets/dsvv/dsvv-temple.webp"
            alt={`Pragyeshwar Mahadev Temple at the centre of the ${UNIVERSITY.name} campus`}
            ratio="4/3"
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="shadow-panel"
          />
        </div>
      </Section>

      {/* ---------------------------- Highlights -------------------------- */}
      <Section tone="muted" compact aria-labelledby="highlights-title">
        <SectionHeading
          id="highlights-title"
          eyebrow="At a glance"
          title="The university in brief"
          description="Information published by the university."
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {HIGHLIGHTS.map((item) => (
            <li key={item.label}>
              <StatCard
                icon={item.icon}
                value={item.value}
                label={item.label}
                detail={item.detail}
              />
            </li>
          ))}
        </ul>
      </Section>

      {/* ---------------------------- Why visit --------------------------- */}
      <Section aria-labelledby="why-title">
        <SectionHeading
          id="why-title"
          eyebrow="Why visit"
          title="Why visit DSVV?"
          description="A campus visit is the clearest way to understand how the university teaches, what it values and where its students live and learn."
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
      </Section>

      {/* ------------------------- Campus experience ---------------------- */}
      <Section tone="muted" aria-labelledby="campus-title">
        <SectionHeading
          id="campus-title"
          eyebrow="Campus"
          title="A campus designed for learning, growth and reflection"
          description="Academic, residential, cultural and recreational spaces sit within one green campus in the Himalayan foothills."
          action={
            <Button asChild variant="outline">
              <Link href="/facilities">
                All facilities
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FACILITY_PREVIEW.map((facility) => (
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

      {/* ----------------------------- Gallery ---------------------------- */}
      <Section aria-labelledby="gallery-title">
        <SectionHeading
          id="gallery-title"
          eyebrow="Gallery"
          title={`Explore the ${UNIVERSITY.shortName} campus`}
          description="Photographs of the campus. Slots awaiting an official photograph are marked."
        />
        <CampusGallery items={GALLERY} />
      </Section>

      {/* ---------------------------- Academics --------------------------- */}
      <Section tone="muted" aria-labelledby="academics-title">
        <SectionHeading
          id="academics-title"
          eyebrow="Academics"
          title="Explore academic opportunities"
          description="Teaching is organised into four schools spanning the humanities, technology, the life sciences and Indology."
          action={
            <Button asChild variant="outline">
              <Link href="/academics">
                Academics overview
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {SCHOOLS.map((school) => (
            <li key={school.name}>
              <FeatureCard icon={school.icon} title={school.name} description={school.description}>
                <a
                  href={UNIVERSITY.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-strong underline-offset-4 hover:underline"
                >
                  Explore programs
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">on the official DSVV website (opens in a new tab)</span>
                </a>
              </FeatureCard>
            </li>
          ))}
        </ul>
      </Section>

      {/* --------------------------- Who can visit ------------------------ */}
      <Section aria-labelledby="audience-title">
        <SectionHeading
          id="audience-title"
          eyebrow="Visitors"
          title="Who can visit?"
          description="Pre-booking is open to anyone with a legitimate reason to come to the campus. Choose the description that fits you when you book."
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VISITOR_AUDIENCES.map((audience) => (
            <li key={audience.title}>
              <FeatureCard
                icon={audience.icon}
                title={audience.title}
                description={audience.description}
              />
            </li>
          ))}
        </ul>
      </Section>

      {/* --------------------------- How it works ------------------------- */}
      <Section tone="muted" aria-labelledby="how-title">
        <SectionHeading
          id="how-title"
          eyebrow="How it works"
          title="Four steps from planning to arrival"
          description="Every visit follows the same short sequence."
        />
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.title} className="relative flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold text-primary-strong shadow-xs">
                  {index + 1}
                </span>
                <span
                  aria-hidden
                  className="hidden h-px flex-1 bg-border lg:block [li:last-child_&]:hidden"
                />
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <step.icon className="h-4 w-4 text-accent" aria-hidden />
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* ------------------------------- CTA ------------------------------ */}
      <Section tone="brand" compact aria-labelledby="cta-title" className="text-center">
        <div className="mx-auto max-w-2xl space-y-6">
          <h2
            id="cta-title"
            className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          >
            Ready to plan your visit?
          </h2>
          <p className="text-muted-foreground">
            Submit your request in four short steps and receive a booking reference immediately.
            Please check your status before travelling — a submitted request is not yet an approved
            visit.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={BOOK_PATH}>
                <CalendarCheck className="h-4 w-4" />
                Pre-Book a Visit
              </Link>
            </Button>
            <Button asChild size="lg" variant="brandOutline">
              <Link href={STATUS_PATH}>
                <Search className="h-4 w-4" />
                Check Booking Status
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* ----------------------------- Location --------------------------- */}
      <Section aria-labelledby="location-title">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-6">
            <SectionHeading
              id="location-title"
              eyebrow="Find us"
              title="Location and contact"
              description={`The campus is at Gayatrikunj – Shantikunj, ${UNIVERSITY.city}, ${UNIVERSITY.state}.`}
            />

            <ul className="space-y-5">
              <li className="flex gap-4">
                <IconTile icon={MapPin} />
                <div>
                  <h3 className="text-sm font-semibold">Address</h3>
                  <address className="mt-1 text-sm not-italic leading-relaxed text-muted-foreground">
                    {CONTACT.addressLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                </div>
              </li>
              <li className="flex gap-4">
                <IconTile icon={Phone} />
                <div>
                  <h3 className="text-sm font-semibold">Phone</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    <a
                      className="transition-colors hover:text-foreground"
                      href={`tel:${CONTACT.generalPhone.replace(/\s/g, "")}`}
                    >
                      {CONTACT.generalPhone}
                    </a>{" "}
                    (general enquiry)
                    <br />
                    <a
                      className="transition-colors hover:text-foreground"
                      href={`tel:${CONTACT.admissionsPhone.replace(/\s/g, "")}`}
                    >
                      {CONTACT.admissionsPhone}
                    </a>{" "}
                    (admissions)
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <IconTile icon={Mail} />
                <div>
                  <h3 className="text-sm font-semibold">Email</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    <a
                      className="transition-colors hover:text-foreground"
                      href={`mailto:${CONTACT.generalEmail}`}
                    >
                      {CONTACT.generalEmail}
                    </a>
                    <br />
                    <a
                      className="transition-colors hover:text-foreground"
                      href={`mailto:${CONTACT.admissionsEmail}`}
                    >
                      {CONTACT.admissionsEmail}
                    </a>
                  </p>
                </div>
              </li>
            </ul>

            <Button asChild variant="outline">
              <a href={CONTACT.directionsUrl} target="_blank" rel="noreferrer noopener">
                Get Directions
                <ArrowUpRight className="h-4 w-4" />
                <span className="sr-only">(opens Google Maps in a new tab)</span>
              </a>
            </Button>
          </div>

          <div className="space-y-4">
            <MediaFrame
              src="/assets/dsvv/dsvv-upvan-gardens.webp"
              alt={`Shriram Smriti Upvan, the health park and gardens at ${UNIVERSITY.name}`}
              ratio="4/3"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary p-4">
              <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <p className="text-sm leading-relaxed text-muted-foreground">
                Office hours:{" "}
                {CONTACT.officeHours.map((slot) => `${slot.days}, ${slot.hours}`).join("; ")}.
                Campus gate timings and entry requirements are set by the university — please
                confirm before travelling.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ------------------------------- FAQ ------------------------------ */}
      <Section tone="muted" flush aria-labelledby="faq-title">
        <SectionHeading
          id="faq-title"
          eyebrow="Questions"
          title="Frequently asked questions"
          description="About visiting the campus and pre-booking a visit."
        />
        <FaqList items={FAQS} />
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          More detail is in the{" "}
          <Link href="/visitor-guide" className="font-medium text-primary-strong underline-offset-4 hover:underline">
            Visitor Guide
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
