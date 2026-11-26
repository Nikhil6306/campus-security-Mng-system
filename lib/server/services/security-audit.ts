/**
 * Security audit service for tracking account security events:
 * - Login (successful and suspicious)
 * - Logout
 * - Password changes and resets
 * - Email changes
 * - Role assignment and activation changes
 *
 * Saves to Supabase `account_security_logs` with SQLite fallback.
 */

import "server-only";

import { createHash } from "node:crypto";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { run } from "../db";

export type SecurityEventType =
  | "login_success"
  | "login_suspicious"
  | "login_failed"
  | "logout"
  | "password_changed"
  | "password_reset_requested"
  | "password_reset_completed"
  | "email_change_requested"
  | "email_change_old_verified"
  | "email_change_completed"
  | "account_registered"
  | "account_verified"
  | "role_changed"
  | "account_activated"
  | "account_deactivated"
  | "account_suspended";

export interface LogSecurityEventParams {
  userId?: string | null;
  eventType: SecurityEventType | string;
  description: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/** Hash IP address with SHA-256 for privacy-preserving audit logging */
function hashIp(ip?: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip.trim()).digest("hex").slice(0, 32);
}

/** Sanitize user-agent string for audit display */
function sanitizeUserAgent(ua?: string | null): string {
  if (!ua) return "Unknown device";
  return ua.slice(0, 200);
}

/**
 * Records a security event to `account_security_logs`.
 * Non-blocking: failures are logged as warnings and never interrupt auth operations.
 */
export async function logSecurityEvent(params: LogSecurityEventParams): Promise<void> {
  const now = new Date().toISOString();
  const id = `sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ipHash = hashIp(params.ipAddress);
  const deviceInfo = sanitizeUserAgent(params.userAgent);
  const metadataJson = JSON.stringify(params.metadata ?? {});

  // 1. Supabase attempt
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();
      await admin.from("account_security_logs").insert({
        user_id: params.userId || null,
        event_type: params.eventType,
        description: params.description,
        ip_address_hash: ipHash,
        device_info: deviceInfo,
        metadata: params.metadata ?? {},
        created_at: now,
      });
      return;
    } catch (err) {
      console.warn("[security-audit] Supabase log insert error:", (err as Error).message);
    }
  }

  // 2. SQLite fallback
  try {
    run(
      `INSERT INTO account_security_logs (id, user_id, event_type, description, ip_address_hash, device_info, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.userId ?? null,
        params.eventType,
        params.description,
        ipHash,
        deviceInfo,
        metadataJson,
        now,
      ],
    );
  } catch (err) {
    console.warn("[security-audit] SQLite log insert error:", (err as Error).message);
  }
}
