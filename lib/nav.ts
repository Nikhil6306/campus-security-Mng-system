import {
  AlertTriangle,
  BadgeCheck,
  BookMarked,
  Bell,
  Building2,
  CalendarDays,
  Car,
  DoorOpen,
  FileBarChart,
  GraduationCap,
  History,
  LayoutDashboard,
  ScanLine,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Key into the dashboard stats used to render a count pill. */
  badgeKey?: "pendingRequests" | "currentlyInside" | "openIncidents" | "unreadNotifications" | "activeEmergencies";
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const adminNav: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Visitor Operations",
    items: [
      { href: "/admin/visitors", label: "Visitors", icon: Users },
      { href: "/admin/bookings", label: "Bookings", icon: BookMarked },
      {
        href: "/admin/requests",
        label: "Visit Requests",
        icon: BadgeCheck,
        badgeKey: "pendingRequests",
      },
      { href: "/admin/meetings", label: "Meetings", icon: CalendarDays },
      {
        href: "/admin/checkin",
        label: "Check-In / Check-Out",
        icon: ScanLine,
        badgeKey: "currentlyInside",
      },
    ],
  },
  {
    label: "Campus",
    items: [
      { href: "/admin/students", label: "Students", icon: GraduationCap },
      { href: "/admin/teachers", label: "Teachers & Staff", icon: Building2 },
      { href: "/admin/guards", label: "Security Guards", icon: ShieldCheck },
      { href: "/admin/gates", label: "Campus Gates", icon: DoorOpen },
      { href: "/admin/vehicles", label: "Vehicles", icon: Car },
    ],
  },
  {
    label: "Safety",
    items: [
      {
        href: "/admin/incidents",
        label: "Incidents",
        icon: AlertTriangle,
        badgeKey: "openIncidents",
      },
      {
        href: "/admin/emergency",
        label: "Emergency",
        icon: ShieldAlert,
        badgeKey: "activeEmergencies",
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        href: "/admin/notifications",
        label: "Notifications",
        icon: Bell,
        badgeKey: "unreadNotifications",
      },
      { href: "/admin/activity", label: "Activity & Audit", icon: History },
      { href: "/admin/reports", label: "Reports", icon: FileBarChart },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const adminNavFlat: NavItem[] = adminNav.flatMap((group) => group.items);

/** Longest-prefix match so nested routes keep the parent item highlighted. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}
