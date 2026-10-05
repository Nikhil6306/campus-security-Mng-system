"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Menu, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { BOOK_PATH, CONTACT, PUBLIC_NAV, STATUS_PATH, UNIVERSITY } from "@/lib/dsvv";
import { cn } from "@/lib/utils";

/**
 * Public header for the visitor portal.
 *
 * A solid brand-blue bar: a slim utility strip carries the university's
 * location and general contact number, and the main row stays limited to
 * navigation and the single primary action the whole site drives towards.
 * Link states follow the brand spec — hover tints the bar with white at 12%,
 * the current page inverts to a white chip with blue text.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      /* Focus rings default to brand blue, invisible on the brand-blue bar —
         every focusable child inside it switches to a white ring. */
      className="sticky top-0 z-40 bg-primary text-white shadow-[0_1px_3px_rgba(23,32,51,0.12),0_4px_16px_-6px_rgba(58,134,255,0.45)] [&_a:focus-visible]:!ring-white [&_a:focus-visible]:!ring-offset-primary [&_button:focus-visible]:!ring-white [&_button:focus-visible]:!ring-offset-primary"
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        <Logo priority tone="onNavy" subtitle={UNIVERSITY.portalName} />

        <nav aria-label="Primary" className="hidden items-center gap-0.5 xl:flex">
          {PUBLIC_NAV.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-[background-color,color] duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary",
                  active
                    ? "bg-white text-primary-strong shadow-xs"
                    : "text-white hover:bg-white/[0.12]",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle tone="onNavy" />
          <Button asChild size="sm" variant="onBrand" className="hidden sm:inline-flex">
            <Link href={BOOK_PATH}>
              <CalendarCheck className="h-4 w-4" />
              Pre-Book a Visit
            </Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="onNavy" size="icon-sm" className="xl:hidden" aria-label="Open menu">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col p-0">
              <div className="border-b border-border p-4">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Logo href={null} subtitle={UNIVERSITY.portalName} />
              </div>

              <nav aria-label="Mobile" className="flex flex-col gap-1 overflow-y-auto p-3">
                {PUBLIC_NAV.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={isActive(link.href) ? "page" : undefined}
                      className={cn(
                        "rounded-md px-3 py-3 text-sm font-medium transition-colors",
                        isActive(link.href)
                          ? "bg-secondary text-secondary-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <Link
                    href={STATUS_PATH}
                    className="rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    Check Booking Status
                  </Link>
                </SheetClose>
              </nav>

              <div className="mt-auto space-y-3 border-t border-border p-4">
                <SheetClose asChild>
                  <Button asChild size="lg" className="w-full">
                    <Link href={BOOK_PATH}>
                      <CalendarCheck className="h-4 w-4" />
                      Pre-Book a Visit
                    </Link>
                  </Button>
                </SheetClose>
                <a
                  href={`tel:${CONTACT.generalPhone.replace(/\s/g, "")}`}
                  className="flex items-center justify-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {CONTACT.generalPhone}
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
