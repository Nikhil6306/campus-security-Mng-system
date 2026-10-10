import "server-only";

import { createClient } from "@supabase/supabase-js";

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be configured before using Supabase.`);
  }
  return value;
}

/**
 * Creates an anon-key client. Database access remains subject to Supabase RLS.
 * The active application does not call this until its data migration is approved.
 */
export function getSupabaseServerClient() {
  const url = requiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
