"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Menu, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { CONTACT, PUBLIC_NAV, UNIVERSITY } from "@/lib/dsvv";
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

  const isActive = (href: string) => {
    if (href === "/#hero" || href === "/") return pathname === "/";
    if (href.startsWith("/#")) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="sticky top-0 z-40 bg-primary text-white shadow-md border-b border-white/10">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Logo priority tone="onNavy" subtitle={UNIVERSITY.portalName} />

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {PUBLIC_NAV.map((link) => {
            const active = isActive(link.href);
            const isAdmin = link.href === "/login";
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200",
                  isAdmin
                    ? "ml-2 bg-white/15 hover:bg-white text-white hover:text-primary border border-white/20 shadow-xs font-semibold"
                    : active
                    ? "bg-white text-primary-strong shadow-xs font-semibold"
                    : "text-white/90 hover:bg-white/10 hover:text-white",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle tone="onNavy" />
          <Button asChild size="sm" variant="onBrand" className="hidden xl:inline-flex">
            <Link href="/#visitor-registration">
              <CalendarCheck className="h-4 w-4" />
              Register Visitor
            </Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="onNavy" size="icon-sm" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col p-0">
              <div className="border-b border-border p-4 bg-primary text-white">
                <SheetTitle className="sr-only">Campus Security Navigation</SheetTitle>
                <Logo tone="onNavy" href={null} subtitle={UNIVERSITY.portalName} />
              </div>

              <nav aria-label="Mobile" className="flex flex-col gap-1 overflow-y-auto p-4">
                {PUBLIC_NAV.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={isActive(link.href) ? "page" : undefined}
                      className={cn(
                        "rounded-md px-4 py-3 text-sm font-medium transition-colors flex items-center justify-between",
                        link.href === "/login"
                          ? "mt-2 bg-primary/10 text-primary font-semibold border border-primary/20"
                          : isActive(link.href)
                          ? "bg-primary text-white font-semibold"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>

              <div className="mt-auto space-y-3 border-t border-border p-4 bg-muted/30">
                <SheetClose asChild>
                  <Button asChild size="lg" className="w-full">
                    <Link href="/#visitor-registration">
                      <CalendarCheck className="h-4 w-4" />
                      Register Visitor
                    </Link>
                  </Button>
                </SheetClose>
                <a
                  href={`tel:${CONTACT.generalPhone.replace(/\s/g, "")}`}
                  className="flex items-center justify-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground pt-1"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  Emergency Contact: {CONTACT.generalPhone}
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
