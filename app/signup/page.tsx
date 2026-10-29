import type { Metadata } from "next";

import { SignupScreen } from "@/components/auth/signup-screen";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Register for an account on the Campus Security Management System.",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return <SignupScreen />;
}
