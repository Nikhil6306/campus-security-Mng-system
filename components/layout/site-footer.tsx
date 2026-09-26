import Link from "next/link";
import { ArrowUpRight, Clock, Mail, MapPin, Phone } from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { BOOK_PATH, CONTACT, PUBLIC_NAV, STATUS_PATH, UNIVERSITY } from "@/lib/dsvv";

const quickLinks = [
  ...PUBLIC_NAV,
  { href: BOOK_PATH, label: "Pre-Book a Visit" },
  { href: STATUS_PATH, label: "Booking Status" },
];

/** External links point at the university's own site — no invented pages. */
const usefulLinks = [
  { href: UNIVERSITY.website, label: "Official DSVV Website" },
  { href: "https://www.dsvv.ac.in/admission/", label: "Admissions" },
  { href: "https://www.dsvv.ac.in/contact-us/", label: "Contact the University" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo size="lg" subtitle={UNIVERSITY.portalName} />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {UNIVERSITY.vision}.
          </p>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Plan and pre-book your visit to the {UNIVERSITY.city} campus.
          </p>
        </div>

        <nav aria-labelledby="footer-quick-links" className="space-y-3">
          <h2 id="footer-quick-links" className="section-label">
            Quick Links
          </h2>
          <ul className="space-y-2">
            {quickLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-useful-links" className="space-y-3">
          <h2 id="footer-useful-links" className="section-label">
            Useful Links
          </h2>
          <ul className="space-y-2">
            {usefulLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="footer-contact" className="space-y-3">
          <h2 id="footer-contact" className="section-label">
            Contact
          </h2>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <address className="not-italic">
                {CONTACT.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </li>
            <li className="flex items-start gap-2.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <a
                href={`tel:${CONTACT.generalPhone.replace(/\s/g, "")}`}
                className="transition-colors hover:text-foreground"
              >
                {CONTACT.generalPhone}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <a
                href={`mailto:${CONTACT.generalEmail}`}
                className="transition-colors hover:text-foreground"
              >
                {CONTACT.generalEmail}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span>
                {CONTACT.officeHours.map((slot) => (
                  <span key={slot.days} className="block">
                    {slot.days}: {slot.hours}
                  </span>
                ))}
              </span>
            </li>
          </ul>
        </section>
      </div>

      <div className="border-t border-border">
        <div className="container flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {UNIVERSITY.name}, {UNIVERSITY.city}.
          </p>
          <p>
            Visitor portal — visit requests are reviewed by the university before entry is
            permitted.
          </p>
        </div>
      </div>
    </footer>
  );
}
