import { Suspense } from "react";
import Image from "next/image";
import { BadgeCheck, ScanLine, ShieldCheck } from "lucide-react";

import { LoginForm } from "@/components/admin/login-form";
import { InlineLoader } from "@/components/shared/states";
import { LogoMark, SYSTEM_NAME, UNIVERSITY_NAME } from "@/components/shared/logo";
import type { Role } from "@/lib/types";

const highlights = [
  {
    icon: BadgeCheck,
    title: "Approve before entry",
    text: "Review pending requests and issue visitor passes.",
  },
  {
    icon: ScanLine,
    title: "Control the gate",
    text: "Record check-ins, check-outs and vehicle movement.",
  },
  {
    icon: ShieldCheck,
    title: "Respond quickly",
    text: "Track incidents and emergency alerts to resolution.",
  },
];

/**
 * Shared sign-in screen used by both `/login` and `/admin/login`.
 *
 * `expectedRole` is passed through to the sign-in call, where the server
 * refuses a valid account that belongs to a different portal.
 */
export function LoginScreen({ expectedRole }: { expectedRole?: Role } = {}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-navy lg:block">
        <Image
          src="/assets/campus-main.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover opacity-25"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy/90 via-navy/85 to-navy" />
        <div className="grid-overlay absolute inset-0 opacity-[0.07]" aria-hidden />

        <div className="relative flex h-full flex-col justify-between p-10">
          <div className="flex items-center gap-3">
            <LogoMark size="lg" priority />
            <div>
              <p className="text-sm font-semibold text-white">{UNIVERSITY_NAME}</p>
              <p className="text-xs text-white/60">{SYSTEM_NAME}</p>
            </div>
          </div>

          <div className="max-w-md space-y-6">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
              One console for every gate, visitor and incident on campus.
            </h2>
            <ul className="space-y-4">
              {highlights.map((item) => (
                <li key={item.title} className="flex gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10 text-cyanx-400"
                    aria-hidden
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="text-sm text-white/60">{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} {UNIVERSITY_NAME} · Campus Security Management System
          </p>
        </div>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark size="lg" priority />
            <div>
              <p className="text-sm font-semibold">{UNIVERSITY_NAME}</p>
              <p className="text-xs text-muted-foreground">{SYSTEM_NAME}</p>
            </div>
          </div>

          <Suspense fallback={<InlineLoader label="Preparing sign-in…" />}>
            <LoginForm expectedRole={expectedRole} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
