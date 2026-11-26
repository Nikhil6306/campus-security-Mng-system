import { currentSession } from "@/lib/server/auth";
import { bootstrap } from "@/lib/server/http";
import { subscribe, type ChangeEvent } from "@/lib/server/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live change feed (Server-Sent Events).
 *
 * Dashboards subscribe here and re-read their snapshot when something they care
 * about changes, which is what makes the activity feed and the "currently
 * inside" counters move without a page reload. Only the *fact* of a change is
 * pushed — never record content — so a connection held by one role can never
 * leak rows belonging to another. Re-reading goes through `/api/state`, which
 * applies the same role scoping as every other read.
 */
export async function GET(request: Request) {
  bootstrap();
  const session = await currentSession();
  if (!session) {
    return new Response("Sign in to receive live updates.", { status: 401 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          // The client went away between the check and the write.
        }
      };

      send("ready", { at: new Date().toISOString() });

      unsubscribe = subscribe((change: ChangeEvent) => send("change", change));

      // Proxies drop idle connections; a comment frame keeps this one open.
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          /* closed */
        }
      }, 25_000);

      request.signal.addEventListener("abort", () => {
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
