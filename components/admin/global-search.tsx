"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { api, type SearchHit } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Admin-wide search across bookings, visitors, staff, students, vehicles and
 * incidents. Selecting a result navigates to the page that owns that record,
 * pre-filtered to it.
 */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setActiveIndex(0), [query]);

  /**
   * Search runs on the server so results respect the caller's role. Typing is
   * debounced, and a stale response is discarded rather than shown.
   */
  React.useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(() => {
      api
        .search(term)
        .then((hits) => {
          if (!cancelled) setResults(hits);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  React.useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Ctrl/Cmd + K focuses search from anywhere in the console.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (hit: SearchHit) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(hit.href);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <label htmlFor="admin-search" className="sr-only">
        Search visitors, bookings, staff, students, vehicles and incidents
      </label>
      <Input
        id="admin-search"
        ref={inputRef}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="admin-search-results"
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        icon={<Search />}
        placeholder="Search bookings, visitors, vehicles…"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="h-9 pr-8"
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {showPanel ? (
        <div
          id="admin-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[70vh] overflow-y-auto rounded-md border border-border bg-popover p-1.5 shadow-lg scrollbar-slim animate-fade-in-fast"
        >
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {searching ? "Searching…" : `No records match “${query}”.`}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {results.map((hit, index) => (
                <li key={`${hit.group}-${hit.id}-${index}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(hit)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-sm px-2.5 py-2 text-left transition-colors",
                      index === activeIndex ? "bg-secondary" : "hover:bg-secondary/60",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{hit.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {hit.sublabel}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {hit.group}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
