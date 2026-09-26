import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeatureCard } from "@/components/public/cards";
import { PageBanner } from "@/components/public/page-banner";
import { Section, SectionHeading } from "@/components/public/section";
import { BOOK_PATH, CONTACT, DEPARTMENT_EXAMPLES, SCHOOLS, UNIVERSITY } from "@/lib/dsvv";

export const metadata: Metadata = {
  title: "Academics",
  description:
    "The academic schools of Dev Sanskriti Vishwavidyalaya — humanities and human values, technology, communication and management, biological sciences and sustainability, and Indology.",
  alternates: { canonical: "/academics" },
};

export default function AcademicsPage() {
  return (
    <>
      <PageBanner
        eyebrow="Academics"
        title="Explore academic opportunities"
        description="Teaching at the university is organised into four schools. Programme details, eligibility and admissions are maintained by the university on its own website."
        breadcrumb={[{ label: "Academics" }]}
      >
        <Button asChild size="lg" variant="outline">
          <a href={UNIVERSITY.website} target="_blank" rel="noreferrer noopener">
            Official DSVV website
            <ArrowUpRight className="h-4 w-4" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </Button>
      </PageBanner>

      <Section aria-labelledby="schools-title">
        <SectionHeading
          id="schools-title"
          eyebrow="Schools"
          title="Four schools"
          description="As listed by the university."
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

      <Section tone="muted" aria-labelledby="departments-title">
        <SectionHeading
          id="departments-title"
          eyebrow="Departments"
          title="Departments listed by the university"
          description="Shown as a single list because the university's public pages do not state which school each department sits under."
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

        <div className="mt-8 flex items-start gap-3 rounded-lg border border-border bg-secondary p-5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          <p className="text-sm leading-relaxed text-muted-foreground">
            This portal handles campus visits only. It does not accept applications and does not
            publish programme, fee or admission details. For those, use the{" "}
            <a
              href="https://www.dsvv.ac.in/admission/"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-primary-strong underline-offset-4 hover:underline"
            >
              university&apos;s admissions pages
            </a>{" "}
            or contact admissions on{" "}
            <a
              href={`tel:${CONTACT.admissionsPhone.replace(/\s/g, "")}`}
              className="font-medium text-primary-strong underline-offset-4 hover:underline"
            >
              {CONTACT.admissionsPhone}
            </a>{" "}
            /{" "}
            <a
              href={`mailto:${CONTACT.admissionsEmail}`}
              className="font-medium text-primary-strong underline-offset-4 hover:underline"
            >
              {CONTACT.admissionsEmail}
            </a>
            .
          </p>
        </div>
      </Section>

      <Section flush compact aria-labelledby="visit-title">
        <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-secondary p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="visit-title" className="text-lg font-semibold">
              Want to see the academic facilities in person?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pre-book a campus visit and name the department you would like to meet.
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
