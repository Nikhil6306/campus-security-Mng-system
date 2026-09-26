import Image from "next/image";
import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface MediaFrameProps {
  /** Path under `/public`. Omit until an official photograph is available. */
  src?: string;
  alt: string;
  /** Shown inside the placeholder so the slot reads as intentional. */
  label?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** Aspect ratio applied when the frame is not sized by its parent. */
  ratio?: "16/9" | "4/3" | "3/2" | "1/1" | "none";
}

const ratioClass: Record<NonNullable<MediaFrameProps["ratio"]>, string> = {
  "16/9": "aspect-[16/9]",
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
  "1/1": "aspect-square",
  none: "",
};

/**
 * An image slot that degrades honestly.
 *
 * Where the university has supplied a photograph it is rendered through
 * `next/image`; where it has not, the slot shows a labelled placeholder rather
 * than borrowing some other campus and captioning it as DSVV.
 */
export function MediaFrame({
  src,
  alt,
  label,
  className,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority,
  ratio = "16/9",
}: MediaFrameProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-muted",
        ratioClass[ratio],
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          className="object-cover object-center"
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center"
          role="img"
          aria-label={`${label ?? alt} — photograph to be added`}
        >
          <ImageIcon className="h-5 w-5 text-muted-foreground/60" aria-hidden />
          <p className="text-xs font-medium text-muted-foreground">{label ?? alt}</p>
          <p className="text-[11px] text-muted-foreground/70">Photograph to be added</p>
        </div>
      )}
    </div>
  );
}
