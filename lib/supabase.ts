import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getEnv(name: string): string | undefined {
  return process.env[name]?.trim();
}

function requiredEnvironmentVariable(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`${name} must be configured before using Supabase.`);
  }
  return value;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getEnv("NEXT_PUBLIC_SUPABASE_URL") && (getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")));
}

/**
 * Creates an anon-key client. Database access remains subject to Supabase RLS.
 * If an access token is provided, requests run in the context of that authenticated user.
 */
export function getSupabaseServerClient(token?: string): SupabaseClient {
  const url = requiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
  });
}

/**
 * Creates a privileged service-role client.
 * Bypasses RLS for secure, server-side-only mutations, audits, and admin auth operations.
 * Never expose this client or its credentials to the browser.
 */
let adminClientInstance: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClientInstance) return adminClientInstance;

  const url = requiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requiredEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY");

  adminClientInstance = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClientInstance;
}
