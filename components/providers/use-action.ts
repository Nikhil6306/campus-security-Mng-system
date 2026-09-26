"use client";

import * as React from "react";

import { toast } from "@/components/ui/toaster";
import { useData } from "@/components/providers/data-provider";
import { errorMessage } from "@/lib/api";

/**
 * One-line wrapper for a write.
 *
 * Every mutation in the console shares the same shape: call the API, let the
 * fresh snapshot land, confirm it, and turn any refusal from the server into a
 * sentence an operator can act on. Keeping that here means a page never has to
 * hand-roll try/catch around a fetch, and the failure text stays consistent
 * whether the cause was a lapsed session, a rule violation or a dropped
 * connection.
 */
export interface ActionOptions {
  /** Toast title on success. Omit to stay silent. */
  success?: string;
  /** Secondary line under the success title. */
  description?: string;
  /** Shown when the server gives us nothing more specific. */
  fallback?: string;
}

export function useAction() {
  const { run } = useData();

  return React.useCallback(
    async <T,>(operation: () => Promise<T>, options: ActionOptions = {}): Promise<T | null> => {
      try {
        const result = await run(operation);
        if (options.success) {
          toast.success(options.success, { description: options.description });
        }
        return result;
      } catch (error) {
        toast.error(errorMessage(error, options.fallback ?? "Something went wrong. Please try again."));
        return null;
      }
    },
    [run],
  );
}
