"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Home, LogOut, Menu, Settings, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { GlobalSearch } from "@/components/admin/global-search";
import { NotificationBell } from "@/components/admin/notification-bell";
import { AdminSidebarContent } from "@/components/layout/admin-sidebar";
import { LogoMark } from "@/components/shared/logo";
import { useAuth } from "@/components/providers/auth-provider";
import { initials } from "@/lib/utils";

export function AdminTopbar() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleSignOut = () => {
    signOut();
    toast.success("Logged out successfully.");
    router.push("/admin");
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6">
      {/* Mobile: sidebar drawer */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon-sm" className="lg:hidden" aria-label="Open navigation">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0" hideClose>
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <AdminSidebarContent onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <span className="lg:hidden">
        <LogoMark size="sm" />
      </span>

      <GlobalSearch className="hidden min-w-0 flex-1 md:block md:max-w-md" />

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          className="hidden sm:inline-flex"
          aria-label="Open public site"
        >
          <Link href="/" target="_blank" rel="noreferrer">
            <Home className="h-4 w-4" />
          </Link>
        </Button>

        <ThemeToggle />
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Account menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback>{initials(session?.name ?? "Admin")}</AvatarFallback>
              </Avatar>
              <span className="hidden min-w-0 text-left lg:block">
                <span className="block max-w-[140px] truncate text-sm font-medium leading-tight">
                  {session?.name ?? "Administrator"}
                </span>
                <span className="block text-[11px] capitalize leading-tight text-muted-foreground">
                  {session?.role ?? "admin"}
                </span>
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground lg:block" aria-hidden />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-semibold">{session?.name ?? "Administrator"}</p>
              <p className="truncate text-xs text-muted-foreground">{session?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/settings">
                <UserRound />
                Profile &amp; preferences
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/settings">
                <Settings />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={handleSignOut}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
