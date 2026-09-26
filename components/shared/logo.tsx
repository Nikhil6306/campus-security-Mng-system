import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

export const UNIVERSITY_NAME = "Dev Sanskriti Vishwavidyalaya";
export const SYSTEM_NAME = "Campus Security Management System";

const sizeMap = {
  sm: 28,
  md: 36,
  lg: 44,
  xl: 64,
} as const;

interface LogoProps {
  size?: keyof typeof sizeMap;
  className?: string;
  priority?: boolean;
}

/**
 * The university emblem. Rendered inside a fixed square with `object-contain`
 * so the mark is never cropped or stretched.
 */
export function LogoMark({ size = "md", className, priority }: LogoProps) {
  const px = sizeMap[size];
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-black/5",
        className,
      )}
      style={{ width: px, height: px }}
    >
      <Image
        src="/assets/university-logo.jpg"
        alt={`${UNIVERSITY_NAME} emblem`}
        width={px * 2}
        height={px * 2}
        priority={priority}
        className="h-full w-full object-contain p-0.5"
      />
    </span>
  );
}

interface LogoLockupProps extends LogoProps {
  /** `onNavy` inverts the text colours for dark chrome. */
  tone?: "default" | "onNavy";
  href?: string | null;
  subtitle?: string;
  compact?: boolean;
}

export function Logo({
  size = "md",
  tone = "default",
  href = "/",
  subtitle = SYSTEM_NAME,
  compact = false,
  className,
  priority,
}: LogoLockupProps) {
  const content = (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} priority={priority} />
      {!compact && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span
            className={cn(
              "truncate text-[13px] font-semibold tracking-tight",
              tone === "onNavy" ? "text-white" : "text-foreground",
            )}
          >
            {UNIVERSITY_NAME}
          </span>
          <span
            className={cn(
              "truncate text-[11px]",
              tone === "onNavy" ? "text-white/80" : "text-muted-foreground",
            )}
          >
            {subtitle}
          </span>
        </span>
      )}
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`${UNIVERSITY_NAME} — ${subtitle}`}
    >
      {content}
    </Link>
  );
}
