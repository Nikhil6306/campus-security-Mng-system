import { NextResponse } from "next/server";

import { bootstrap } from "@/lib/server/http";
import { recordReceipt, type WhatsAppStatus } from "@/lib/server/services/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Delivery receipts from the WhatsApp Business Platform.
 *
 * Meta calls this endpoint as the provider, not as a signed-in user, so it
 * cannot go through the session-based route wrappers. Two things stand in for
 * that: the GET handshake proves we own the verify token, and every POST is
 * checked against the same token before a single row is touched.
 *
 * CONFIGURATION REQUIRED: set `WHATSAPP_VERIFY_TOKEN` and register this URL as
 * the webhook callback. Without the variable the endpoint refuses everything,
 * which is the safe default for an unauthenticated route.
 */

const STATUS_MAP: Record<string, WhatsAppStatus> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

function getVerifyToken(): string | undefined {
  return (process.env.META_WHATSAPP_VERIFY_TOKEN ?? process.env.WHATSAPP_VERIFY_TOKEN)?.trim();
}

function getAppSecret(): string | undefined {
  return (process.env.META_WHATSAPP_APP_SECRET ?? process.env.WHATSAPP_APP_SECRET)?.trim();
}

/** Meta's subscription handshake. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const verifyToken = getVerifyToken();

  if (!verifyToken) {
    return new NextResponse("Webhook not configured.", { status: 503 });
  }
  if (
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === verifyToken
  ) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Verification failed.", { status: 403 });
}

interface WebhookPayload {
  entry?: {
    changes?: {
      value?: {
        statuses?: { id?: string; status?: string; timestamp?: string }[];
      };
    }[];
  }[];
}

export async function POST(request: Request) {
  const verifyToken = getVerifyToken();
  const appSecret = getAppSecret();

  if (!verifyToken && !appSecret) {
    return new NextResponse("Webhook not configured.", { status: 503 });
  }

  const rawBody = await request.text();

  // 1. If Meta's X-Hub-Signature-256 is present and appSecret is configured, verify HMAC SHA-256
  const signatureHeader = request.headers.get("x-hub-signature-256");
  if (appSecret && signatureHeader) {
    const crypto = await import("node:crypto");
    const hmac = crypto.createHmac("sha256", appSecret);
    const digest = `sha256=${hmac.update(rawBody).digest("hex")}`;
    if (!crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(digest))) {
      return new NextResponse("Invalid signature.", { status: 401 });
    }
  } else if (verifyToken) {
    // 2. Fallback: check query token if provided, or verifyToken header
    const token = new URL(request.url).searchParams.get("token") || request.headers.get("x-verify-token");
    if (token && token !== verifyToken) {
      return new NextResponse("Unauthorised.", { status: 401 });
    }
  }

  bootstrap();

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let applied = 0;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        const mapped = status.status ? STATUS_MAP[status.status.toLowerCase()] : undefined;
        if (!status.id || !mapped) continue;
        const at = status.timestamp
          ? new Date(Number(status.timestamp) * 1000).toISOString()
          : undefined;
        if (recordReceipt(status.id, mapped, at)) applied += 1;
      }
    }
  }

  // Always 200 on a well-formed callback: a non-2xx makes Meta retry the batch.
  return NextResponse.json({ ok: true, applied });
}
