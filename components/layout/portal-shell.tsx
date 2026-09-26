"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { InlineLoader } from "@/components/shared/states";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import type { Role } from "@/lib/types";
import { initials } from "@/lib/utils";

/**
 * Chrome for the staff and student portals.
 *
 * The role check here decides what to render; it is not what protects the data.
 * Every read and write goes through an API route that re-checks the caller's
 * role and narrows the snapshot to what that role may see.
 */
export function PortalShell({
  title,
  subtitle,
  allow,
  children,
}: {
  title: string;
  subtitle: string;
  allow: Role[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, ready, signOut } = useAuth();

  const permitted = session ? allow.includes(session.role) || session.role === "admin" : false;

  React.useEffect(() => {
    if (!ready) return;
    if (!session) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (!permitted) router.replace("/admin/dashboard");
  }, [ready, session, permitted, pathname, router]);

  if (!ready || !session || !permitted) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <InlineLoader label="Checking your session…" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-muted/25">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Logo subtitle={subtitle} href="/" />

          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="icon-sm" aria-label="Public site">
              <Link href="/">
                <Home className="h-4 w-4" />
              </Link>
            </Button>
            <ThemeToggle />

            <span className="hidden items-center gap-2 rounded-md border border-border px-2.5 py-1.5 sm:flex">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">
                  {initials(session.name)}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[160px] truncate text-sm font-medium">{session.name}</span>
              <Badge variant="secondary" size="sm" className="capitalize">
                {session.role}
              </Badge>
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                signOut();
                toast.success("Logged out successfully.");
                router.push("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1 p-4 sm:p-6">
        <div className="mx-auto w-full max-w-6xl animate-fade-in space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>

      <footer className="border-t border-border bg-card px-4 py-4 text-center text-xs text-muted-foreground">
        Campus Security Management System · Dev Sanskriti Vishwavidyalaya
      </footer>
    </div>
  );
}
