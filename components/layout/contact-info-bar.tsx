import Link from "next/link";
import { MapPin, Phone, Search } from "lucide-react";

import { CONTACT, STATUS_PATH, UNIVERSITY } from "@/lib/dsvv";

/**
 * Contact / utility info bar — brand-blue strip that shows the university's
 * location, general phone number, and a link to check booking status.
 *
 * Extracted from the site header and placed below the footer so it becomes
 * the very last visible section of every public page.
 *
 * Markup and styling are intentionally kept identical to the original
 * header utility strip — only the position in the page layout changed.
 */
export function ContactInfoBar() {
  return (
    <div className="hidden border-t border-white/15 bg-primary text-white lg:block">
      <div className="container flex h-9 items-center justify-between text-xs">
        <p className="flex items-center gap-2 text-white/85">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-white/70" aria-hidden />
          {UNIVERSITY.city}, {UNIVERSITY.state}, {UNIVERSITY.country}
        </p>
        <div className="flex items-center gap-5">
          <a
            href={`tel:${CONTACT.generalPhone.replace(/\s/g, "")}`}
            className="flex items-center gap-2 rounded-sm text-white/85 transition-colors hover:text-white"
          >
            <Phone className="h-3.5 w-3.5 shrink-0 text-white/70" aria-hidden />
            {CONTACT.generalPhone}
          </a>
          <Link
            href={STATUS_PATH}
            className="flex items-center gap-2 rounded-sm text-white/85 transition-colors hover:text-white"
          >
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Check Booking Status
          </Link>
        </div>
      </div>
    </div>
  );
}
