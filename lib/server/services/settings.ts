import "server-only";

import type { AppSettings, AuthSession } from "@/lib/types";
import { tx } from "../db";
import { audit } from "../audit";
import { publish } from "../events";
import { badRequest } from "../errors";
import { readSettings, writeSettings } from "../repo";
import { toMinutes } from "@/lib/settings";

/** Campus configuration. Only administrators may change it. */
export function saveSettings(input: AppSettings, actor: AuthSession): AppSettings {
  if (toMinutes(input.visitingHoursFrom) >= toMinutes(input.visitingHoursTo)) {
    throw badRequest("Visiting hours must end after they start.", {
      visitingHoursTo: "Choose a time after the opening hour.",
    });
  }

  const previous = readSettings();

  const saved = tx(() => {
    const next = writeSettings(input);
    const changed = (Object.keys(input) as (keyof AppSettings)[]).filter(
      (key) => JSON.stringify(previous[key]) !== JSON.stringify(input[key]),
    );
    audit(actor, {
      action: "settings.updated",
      entity: "settings",
      entityId: "campus",
      summary: changed.length
        ? `${actor.name} changed campus settings: ${changed.join(", ")}.`
        : `${actor.name} saved campus settings with no changes.`,
    });
    return next;
  });

  publish("settings", "updated");
  return saved;
}

export { readSettings };
