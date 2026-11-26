import { NextResponse } from "next/server";

import { AuthError, requireAdmin } from "@/lib/server/auth";
import { bootstrap, readBody } from "@/lib/server/http";
import { sendNotificationEmail } from "@/lib/email/email-service";
import { parse, sendEmailNotificationSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dispatches an email notification.
 * Requires admin privileges.
 */
export async function POST(request: Request) {
  try {
    bootstrap();
    const admin = await requireAdmin();
    const input = parse(sendEmailNotificationSchema, await readBody(request));

    const result = await sendNotificationEmail({
      toEmail: input.toEmail,
      toName: input.toName,
      eventType: input.eventType,
      eventDescription: input.eventDescription,
      role: input.role,
      subject: input.subject,
      userId: admin.userId,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: { message: error.message, code: "auth_error" } },
        { status: error.status },
      );
    }
    const status = (error as { status?: number }).status ?? 400;
    const message =
      (error as { message?: string }).message ?? "Could not dispatch email notification.";
    return NextResponse.json(
      { ok: false, error: { message, code: "bad_request" } },
      { status },
    );
  }
}
