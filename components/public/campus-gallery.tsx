"use client";

import * as React from "react";
import Image from "next/image";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MediaFrame } from "@/components/public/media-frame";
import type { GalleryItem } from "@/lib/dsvv";
import { cn } from "@/lib/utils";

/**
 * Campus gallery.
 *
 * A featured image above a uniform grid; on narrow screens the grid becomes a
 * snap-scrolling row. Only tiles that actually carry a photograph open the
 * lightbox — placeholders stay inert so a visitor is never given an empty
 * dialog to dismiss.
 */
export function CampusGallery({ items }: { items: GalleryItem[] }) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const active = items.find((item) => item.id === openId) ?? null;

  const featured = items.find((item) => item.featured) ?? items[0];
  const rest = items.filter((item) => item.id !== featured?.id);

  return (
    <>
      {featured && (
        <figure className="mt-10">
          <GalleryTile
            item={featured}
            onOpen={setOpenId}
            ratio="16/9"
            sizes="(max-width: 1280px) 100vw, 1200px"
            priority
            className="shadow-panel"
          />
          <figcaption className="mt-3 text-sm text-muted-foreground">
            {featured.caption}
          </figcaption>
        </figure>
      )}

      <ul
        className={cn(
          "mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 scrollbar-slim",
          "sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3",
        )}
      >
        {rest.map((item) => (
          <li key={item.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
            <GalleryTile
              item={item}
              onOpen={setOpenId}
              ratio="4/3"
              sizes="(max-width: 640px) 78vw, (max-width: 1024px) 50vw, 33vw"
            />
            <p className="mt-2 text-sm font-medium">{item.title}</p>
          </li>
        ))}
      </ul>

      <Dialog open={Boolean(active)} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent className="max-w-4xl p-3 sm:p-4">
          {active && (
            <>
              <DialogTitle className="px-1 text-base">{active.title}</DialogTitle>
              <DialogDescription className="sr-only">
                Enlarged photograph of {active.title} at Dev Sanskriti Vishwavidyalaya.
              </DialogDescription>
              {active.image && (
                <div className="relative aspect-[3/2] w-full overflow-hidden rounded-md bg-muted">
                  <Image
                    src={active.image}
                    alt={active.caption}
                    fill
                    sizes="(max-width: 896px) 100vw, 896px"
                    className="object-contain"
                  />
                </div>
              )}
              <p className="px-1 text-sm text-muted-foreground">{active.caption}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface TileProps {
  item: GalleryItem;
  onOpen: (id: string) => void;
  ratio: "16/9" | "4/3";
  sizes: string;
  priority?: boolean;
  className?: string;
}

function GalleryTile({ item, onOpen, ratio, sizes, priority, className }: TileProps) {
  const frame = (
    <MediaFrame
      src={item.image}
      alt={item.image ? item.caption : item.title}
      label={item.title}
      ratio={ratio}
      sizes={sizes}
      priority={priority}
      className={cn("h-full w-full", className)}
    />
  );

  if (!item.image) return frame;

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      aria-label={`View a larger photograph: ${item.title}`}
      className="group block w-full rounded-lg transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="block overflow-hidden rounded-lg ring-1 ring-transparent transition-all group-hover:ring-primary/30">
        {frame}
      </span>
    </button>
  );
}
