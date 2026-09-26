import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, Quote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeatureCard, StatCard } from "@/components/public/cards";
import { MediaFrame } from "@/components/public/media-frame";
import { PageBanner } from "@/components/public/page-banner";
import { Section, SectionHeading } from "@/components/public/section";
import {
  ABOUT_PARAGRAPHS,
  ABOUT_PILLARS,
  BOOK_PATH,
  DEPARTMENT_EXAMPLES,
  HIGHLIGHTS,
  UNIVERSITY,
} from "@/lib/dsvv";

export const metadata: Metadata = {
  title: "About DSVV",
  description:
    "Dev Sanskriti Vishwavidyalaya, established in 2002 at Haridwar, Uttarakhand — a university for the global, cultural and spiritual renaissance. Read about its vision, approach and academic schools.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageBanner
        eyebrow="About the university"
        title={`About ${UNIVERSITY.name}`}
        description={UNIVERSITY.vision}
        breadcrumb={[{ label: "About DSVV" }]}
      >
        <Button asChild size="lg">
          <Link href={BOOK_PATH}>
            Pre-Book a Visit
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/campus">Explore the Campus</Link>
        </Button>
      </PageBanner>

      <Section aria-labelledby="intro-title">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div className="space-y-6">
            <SectionHeading
              id="intro-title"
              eyebrow="Introduction"
              title="A university where education and values are taught together"
            />
            {ABOUT_PARAGRAPHS.map((paragraph) => (
              <p key={paragraph} className="text-[15px] leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}

            <blockquote className="relative rounded-lg border border-border bg-secondary p-6">
              <Quote className="h-5 w-5 text-accent" aria-hidden />
              <p className="mt-3 text-pretty text-lg font-medium leading-relaxed">
                {UNIVERSITY.tagline}.
              </p>
              <footer className="mt-3 text-sm text-muted-foreground">
                As published by {UNIVERSITY.name}
              </footer>
            </blockquote>
          </div>

          <div className="space-y-4">
            <MediaFrame
              src="/assets/dsvv/dsvv-campus-entrance.webp"
              alt={`Shriram Bhawan, the administrative block at ${UNIVERSITY.name}`}
              ratio="4/3"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
            <MediaFrame
              src="/assets/dsvv/dsvv-handloom.webp"
              alt={`The campus handloom unit at ${UNIVERSITY.name}, one of its self-sustenance models`}
              ratio="4/3"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
          </div>
        </div>
      </Section>

      <Section tone="muted" compact aria-labelledby="facts-title">
        <SectionHeading
          id="facts-title"
          eyebrow="At a glance"
          title="Key information"
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

      <Section aria-labelledby="pillars-title">
        <SectionHeading
          id="pillars-title"
          eyebrow="Approach"
          title="What shapes education at DSVV"
          description="The themes the university states for its academic approach."
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ABOUT_PILLARS.map((pillar) => (
            <li key={pillar.title}>
              <FeatureCard
                icon={pillar.icon}
                title={pillar.title}
                description={pillar.description}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="muted" flush aria-labelledby="departments-title">
        <SectionHeading
          id="departments-title"
          eyebrow="Academics"
          title="Departments listed by the university"
          description="Teaching spans four schools. Programme details are maintained on the university's own website."
          action={
            <Button asChild variant="outline">
              <Link href="/academics">
                Academics overview
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
        <ul className="mt-8 flex flex-wrap gap-2">
          {DEPARTMENT_EXAMPLES.map((department) => (
            <li
              key={department}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground"
            >
              {department}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          For the full list of schools, departments and programmes, see the{" "}
          <a
            href={UNIVERSITY.website}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 font-medium text-primary-strong underline-offset-4 hover:underline"
          >
            official DSVV website
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          .
        </p>
      </Section>
    </>
  );
}
