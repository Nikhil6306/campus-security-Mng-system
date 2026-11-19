import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
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
    label: "Visitor Management",
    items: [
      { href: "/admin/visitors", label: "Visitors", icon: Users },
      { href: "/admin/bookings", label: "Bookings", icon: BookMarked },
      {
        href: "/admin/requests",
        label: "Visit Requests",
        icon: BadgeCheck,
        badgeKey: "pendingRequests",
      },
      {
        href: "/admin/checkin",
        label: "Check-In / Check-Out",
        icon: ScanLine,
        badgeKey: "currentlyInside",
      },
    ],
  },
  {
    label: "Personnel & Posts",
    items: [
      { href: "/admin/guards", label: "Guard Management", icon: ShieldCheck },
      { href: "/admin/teachers", label: "Faculty Management", icon: Building2 },
      { href: "/admin/guard-duty", label: "Guard Duty & Shifts", icon: ShieldCheck },
      { href: "/admin/vehicles", label: "Vehicle Management", icon: Car },
    ],
  },
  {
    label: "Security & Alerts",
    items: [
      {
        href: "/admin/emergency",
        label: "Emergency & Alerts",
        icon: ShieldAlert,
        badgeKey: "activeEmergencies",
      },
      {
        href: "/admin/incidents",
        label: "Incidents",
        icon: AlertTriangle,
        badgeKey: "openIncidents",
      },
    ],
  },
  {
    label: "Reports & Account",
    items: [
      { href: "/admin/reports", label: "Visitor Reports", icon: FileBarChart },
      {
        href: "/admin/notifications",
        label: "Notifications",
        icon: Bell,
        badgeKey: "unreadNotifications",
      },
      { href: "/admin/settings", label: "Profile & Settings", icon: Settings },
    ],
  },
];

export const administratorNav: NavGroup[] = [
  {
    label: "Executive Oversight",
    items: [
      { href: "/administrator/dashboard", label: "Executive Command", icon: LayoutDashboard },
      { href: "/admin/activity", label: "Audit & Activity Logs", icon: History },
      { href: "/admin/settings", label: "System & Policy Config", icon: Settings },
    ],
  },
  {
    label: "Operations Oversight",
    items: [
      { href: "/admin/dashboard", label: "Admin Operations View", icon: ShieldCheck },
      { href: "/security/dashboard", label: "Gate Terminal View", icon: DoorOpen },
      { href: "/admin/guard-duty", label: "Guard Duty & Staffing", icon: ShieldCheck },
    ],
  },
  {
    label: "Campus & Records",
    items: [
      { href: "/admin/visitors", label: "All Visitors", icon: Users },
      { href: "/admin/bookings", label: "All Bookings", icon: BookMarked },
      { href: "/admin/guards", label: "Security Personnel", icon: ShieldCheck },
      { href: "/admin/teachers", label: "Faculty Directory", icon: Building2 },
      { href: "/admin/students", label: "Student Directory", icon: GraduationCap },
      { href: "/admin/vehicles", label: "Registered Vehicles", icon: Car },
    ],
  },
  {
    label: "Safety & Reports",
    items: [
      { href: "/admin/emergency", label: "Emergency Command", icon: ShieldAlert, badgeKey: "activeEmergencies" },
      { href: "/admin/incidents", label: "Incident Reports", icon: AlertTriangle, badgeKey: "openIncidents" },
      { href: "/admin/analytics", label: "Visitor Analytics", icon: BarChart3 },
      { href: "/admin/reports", label: "Monthly Audit Reports", icon: FileBarChart },
    ],
  },
];

export const adminNavFlat: NavItem[] = adminNav.flatMap((group) => group.items);

/** Longest-prefix match so nested routes keep the parent item highlighted. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}
