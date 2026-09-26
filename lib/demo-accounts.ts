import type { Role } from "./types";

/**
 * Demonstration sign-in accounts.
 *
 * These mirror the accounts created by the server seed so the login screens can
 * offer a one-tap fill while the system is being evaluated. They are labels for
 * a demo, not a credential store: authentication happens entirely server-side
 * against scrypt-hashed passwords, and nothing here grants any access.
 *
 * Remove this file — and re-password the seeded accounts — before the system
 * handles real visitors.
 */

export interface DemoAccount {
  role: Role;
  label: string;
  email: string;
  password: string;
  name: string;
  description: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: "super_admin",
    label: "Super Administrator",
    email: "superadmin@dsvv.edu.in",
    password: "Super@123",
    name: "Campus Security Director",
    description: "Full access, including staff records and demo data reset.",
  },
  {
    role: "admin",
    label: "Administrator",
    email: "admin@dsvv.edu.in",
    password: "Admin@123",
    name: "Security Administrator",
    description: "Visitors, bookings, guards, incidents and reports.",
  },
  {
    role: "security",
    label: "Security Guard",
    email: "security@dsvv.edu.in",
    password: "Security@123",
    name: "Amit Kumar · Main Gate",
    description: "Gate console — verification, check-in, check-out, incidents.",
  },
  {
    role: "teacher",
    label: "Teacher / Staff",
    email: "anupama.sharma@dsvv.edu.in",
    password: "Teacher@123",
    name: "Dr. Anupama Sharma",
    description: "Own meeting requests and availability only.",
  },
  {
    role: "student",
    label: "Student",
    email: "aarav.mehta@dsvv.edu.in",
    password: "Student@123",
    name: "Aarav Mehta",
    description: "Own hostel record and outing requests.",
  },
];

export function demoAccountFor(role: Role): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((account) => account.role === role);
}
