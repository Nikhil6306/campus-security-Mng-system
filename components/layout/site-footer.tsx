import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { CONTACT, UNIVERSITY } from "@/lib/dsvv";

const quickLinks = [
  { href: "/#hero", label: "Home" },
  { href: "/#visitor-registration", label: "Visitor Registration" },
  { href: "/#campus-360", label: "Campus 360°" },
  { href: "/#about", label: "About" },
];

const securityLinks = [
  { href: "/#smart-security", label: "Visitor Management" },
  { href: "/#security-info", label: "Security Guidelines" },
  { href: "/#emergency-assistance", label: "Emergency Assistance" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo size="lg" subtitle={UNIVERSITY.portalName} />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground font-medium">
            {UNIVERSITY.name}
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            Campus Security Management System — A secure digital platform for campus entry, visitor records, and emergency assistance.
          </p>
        </div>

        <nav aria-labelledby="footer-quick-links" className="space-y-3">
          <h2 id="footer-quick-links" className="section-label text-foreground font-semibold">
            Quick Links
          </h2>
          <ul className="space-y-2">
            {quickLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-primary font-medium"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-security-links" className="space-y-3">
          <h2 id="footer-security-links" className="section-label text-foreground font-semibold">
            Security
          </h2>
          <ul className="space-y-2">
            {securityLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-primary font-medium"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="footer-contact" className="space-y-3">
          <h2 id="footer-contact" className="section-label text-foreground font-semibold">
            Campus Contact
          </h2>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <address className="not-italic text-xs leading-relaxed">
                {CONTACT.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </li>
            <li className="flex items-start gap-2.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <a
                href={`tel:${CONTACT.generalPhone.replace(/\s/g, "")}`}
                className="text-xs transition-colors hover:text-foreground font-medium"
              >
                {CONTACT.generalPhone}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <a
                href={`mailto:${CONTACT.generalEmail}`}
                className="text-xs transition-colors hover:text-foreground font-medium"
              >
                {CONTACT.generalEmail}
              </a>
            </li>
          </ul>
        </section>
      </div>

      <div className="border-t border-border bg-muted/20">
        <div className="container flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {UNIVERSITY.name}, {UNIVERSITY.city}. Campus Security Management System.
          </p>
          <p className="font-medium text-foreground">
            Smart • Secure • Digital Campus Management
          </p>
        </div>
      </div>
    </footer>
  );
}
