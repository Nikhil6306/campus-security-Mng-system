import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetPasswordScreen } from "@/components/auth/reset-password-screen";
import { InlineLoader } from "@/components/shared/states";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new password for your Campus Security Management System account.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<InlineLoader label="Loading password reset..." />}>
      <ResetPasswordScreen />
    </Suspense>
  );
}
