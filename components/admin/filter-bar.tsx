"use client";

import * as React from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterConfig {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
}

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  onReset?: () => void;
  isFiltered?: boolean;
  resultCount?: number;
  totalCount?: number;
  children?: React.ReactNode;
  className?: string;
}

/** Search + select filters shared by every list page in the console. */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters = [],
  onReset,
  isFiltered,
  resultCount,
  totalCount,
  children,
  className,
}: FilterBarProps) {
  return (
    <div className={cn("border-b border-border p-4", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <label htmlFor="filter-search" className="sr-only">
            {searchPlaceholder}
          </label>
          <Input
            id="filter-search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            icon={<Search />}
            className="h-9 pr-8"
            autoComplete="off"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filters.map((filter) => (
            <div key={filter.id} className={cn("min-w-[140px]", filter.className)}>
              <label htmlFor={filter.id} className="sr-only">
                {filter.label}
              </label>
              <Select value={filter.value} onValueChange={filter.onChange}>
                <SelectTrigger id={filter.id} className="h-9 text-[13px]">
                  <SlidersHorizontal className="mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          {children}

          {isFiltered && onReset ? (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <X className="h-3.5 w-3.5" />
              Reset
            </Button>
          ) : null}
        </div>

        {typeof resultCount === "number" ? (
          <p className="text-xs text-muted-foreground lg:ml-auto" aria-live="polite">
            Showing <span className="font-medium text-foreground">{resultCount}</span>
            {typeof totalCount === "number" ? ` of ${totalCount}` : ""} records
          </p>
        ) : null}
      </div>
    </div>
  );
}
