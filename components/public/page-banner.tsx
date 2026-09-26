import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { SectionHeading } from "@/components/public/section";

interface PageBannerProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Trail after Home; the last entry is rendered as the current page. */
  breadcrumb?: { href?: string; label: string }[];
  children?: React.ReactNode;
}

/**
 * The banner at the head of every interior public page: breadcrumb, `h1` and
 * an optional row of actions. Keeps one `h1` per page and a consistent
 * entry point into the visitor journey.
 */
export function PageBanner({
  eyebrow,
  title,
  description,
  breadcrumb = [],
  children,
}: PageBannerProps) {
  return (
    <div className="border-b border-border bg-muted">
      <div className="container py-10 lg:py-14">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                Home
              </Link>
            </li>
            {breadcrumb.map((crumb, index) => {
              const last = index === breadcrumb.length - 1;
              return (
                <React.Fragment key={crumb.label}>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <li
                    className={last ? "font-medium text-foreground" : undefined}
                    aria-current={last ? "page" : undefined}
                  >
                    {crumb.href && !last ? (
                      <Link href={crumb.href} className="transition-colors hover:text-foreground">
                        {crumb.label}
                      </Link>
                    ) : (
                      crumb.label
                    )}
                  </li>
                </React.Fragment>
              );
            })}
          </ol>
        </nav>

        <SectionHeading as="h1" eyebrow={eyebrow} title={title} description={description} />

        {children && <div className="mt-7 flex flex-col gap-3 sm:flex-row">{children}</div>}
      </div>
    </div>
  );
}
