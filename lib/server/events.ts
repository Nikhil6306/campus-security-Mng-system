import "server-only";

import { EventEmitter } from "node:events";

/**
 * Change broadcast.
 *
 * Every mutation publishes here, and the SSE endpoint at `/api/events` relays
 * to connected dashboards so they refresh without a full page reload. The bus
 * lives in the application process; a multi-instance deployment would swap this
 * one file for Postgres `LISTEN/NOTIFY` or Supabase Realtime without touching
 * the services that publish to it.
 */

export interface ChangeEvent {
  /** Collection that changed, e.g. `bookings`, `incidents`. */
  scope: string;
  /** What happened, e.g. `created`, `approved`, `checked-in`. */
  action: string;
  /** Record the change relates to. */
  id?: string;
  at: string;
}

const globalRef = globalThis as typeof globalThis & { __csmsBus?: EventEmitter };

function bus(): EventEmitter {
  if (!globalRef.__csmsBus) {
    const emitter = new EventEmitter();
    // Dashboards, gate consoles and teacher portals can all be open at once.
    emitter.setMaxListeners(200);
    globalRef.__csmsBus = emitter;
  }
  return globalRef.__csmsBus;
}

export function publish(scope: string, action: string, id?: string): void {
  const event: ChangeEvent = { scope, action, id, at: new Date().toISOString() };
  bus().emit("change", event);
}

export function subscribe(listener: (event: ChangeEvent) => void): () => void {
  bus().on("change", listener);
  return () => {
    bus().off("change", listener);
  };
}
