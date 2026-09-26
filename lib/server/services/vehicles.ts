import "server-only";

import type { AuthSession, Vehicle } from "@/lib/types";
import { nextId, run, tx } from "../db";
import { audit, notify } from "../audit";
import { publish } from "../events";
import { conflict, notFound } from "../errors";
import { findGuard, findVehicle, findVehicleInside } from "../repo";
import type { vehiclePatchSchema, vehicleSchema } from "../validation";
import type { z } from "zod";

/**
 * Vehicle movement.
 *
 * A number plate can only be inside the campus once at a time — enforced by a
 * partial unique index, so the gate cannot create a second open entry even if
 * two guards record the same vehicle simultaneously.
 */

const now = () => new Date().toISOString();

type VehicleInput = z.infer<typeof vehicleSchema>;
type VehiclePatch = z.infer<typeof vehiclePatchSchema>;

function guardOf(actor: AuthSession) {
  const guard = actor.refId ? findGuard(actor.refId) : undefined;
  return { id: guard?.id ?? null, name: guard?.fullName ?? actor.name };
}

export function recordEntry(input: VehicleInput, actor: AuthSession): Vehicle {
  const plate = input.vehicleNumber.replace(/[\s-]/g, "").toUpperCase();
  if (findVehicleInside(plate)) {
    throw conflict("That vehicle is already recorded as inside the campus.");
  }
  const guard = guardOf(actor);

  const vehicle = tx(() => {
    const id = nextId("VEH");
    const timestamp = now();
    run(
      `INSERT INTO vehicles
         (id, vehicle_number, vehicle_type, visitor_name, driver_name, purpose, gate,
          entry_time, status, linked_visit_id, guard_id, guard_name)
       VALUES (?,?,?,?,?,?,?,?,'Inside',?,?,?)`,
      [
        id,
        plate,
        input.vehicleType,
        input.visitorName,
        input.driverName,
        input.purpose,
        input.gate,
        timestamp,
        input.linkedVisitId || null,
        guard.id,
        guard.name,
      ],
    );
    notify({
      type: "vehicle",
      title: "Vehicle entry recorded",
      message: `${plate} entered through the ${input.gate}.`,
      href: "/admin/vehicles",
    });
    audit(actor, {
      action: "vehicle.entry",
      entity: "vehicle",
      entityId: id,
      summary: `${guard.name} recorded vehicle ${plate} entering at ${input.gate}.`,
    });
    const created = findVehicle(id);
    if (!created) throw notFound("The vehicle entry could not be saved.");
    return created;
  });

  publish("vehicles", "entered", vehicle.id);
  return vehicle;
}

export function updateVehicle(id: string, patch: VehiclePatch, actor: AuthSession): Vehicle {
  const current = findVehicle(id);
  if (!current) throw notFound("That vehicle record no longer exists.");

  const updated = tx(() => {
    const plate = patch.vehicleNumber
      ? patch.vehicleNumber.replace(/[\s-]/g, "").toUpperCase()
      : current.vehicleNumber;
    run(
      `UPDATE vehicles
          SET vehicle_number = ?, vehicle_type = ?, visitor_name = ?, driver_name = ?,
              purpose = ?, gate = ?
        WHERE id = ?`,
      [
        plate,
        patch.vehicleType ?? current.vehicleType,
        patch.visitorName ?? current.visitorName,
        patch.driverName ?? current.driverName,
        patch.purpose ?? current.purpose,
        patch.gate ?? current.gate,
        id,
      ],
    );
    audit(actor, {
      action: "vehicle.updated",
      entity: "vehicle",
      entityId: id,
      summary: `${actor.name} updated vehicle ${plate}.`,
    });
    const after = findVehicle(id);
    if (!after) throw notFound("That vehicle record no longer exists.");
    return after;
  });

  publish("vehicles", "updated", id);
  return updated;
}

export function recordExit(id: string, actor: AuthSession): Vehicle {
  const current = findVehicle(id);
  if (!current) throw notFound("That vehicle record no longer exists.");
  if (current.status === "Exited") throw conflict("That vehicle has already left the campus.");

  const updated = tx(() => {
    run("UPDATE vehicles SET status = 'Exited', exit_time = ? WHERE id = ?", [now(), id]);
    audit(actor, {
      action: "vehicle.exit",
      entity: "vehicle",
      entityId: id,
      summary: `${actor.name} recorded vehicle ${current.vehicleNumber} leaving via ${current.gate}.`,
    });
    const after = findVehicle(id);
    if (!after) throw notFound("That vehicle record no longer exists.");
    return after;
  });

  publish("vehicles", "exited", id);
  return updated;
}

export function recordReEntry(id: string, actor: AuthSession, gate?: string): Vehicle {
  const current = findVehicle(id);
  if (!current) throw notFound("That vehicle record no longer exists.");
  if (current.status === "Inside") throw conflict("That vehicle is already inside the campus.");
  if (findVehicleInside(current.vehicleNumber)) {
    throw conflict("That number plate already has an open entry.");
  }

  const updated = tx(() => {
    run(
      "UPDATE vehicles SET status = 'Inside', entry_time = ?, exit_time = NULL, gate = ? WHERE id = ?",
      [now(), gate ?? current.gate, id],
    );
    audit(actor, {
      action: "vehicle.re_entry",
      entity: "vehicle",
      entityId: id,
      summary: `${actor.name} re-admitted vehicle ${current.vehicleNumber}.`,
    });
    const after = findVehicle(id);
    if (!after) throw notFound("That vehicle record no longer exists.");
    return after;
  });

  publish("vehicles", "entered", id);
  return updated;
}

export function deleteVehicle(id: string, actor: AuthSession): void {
  const current = findVehicle(id);
  if (!current) throw notFound("That vehicle record no longer exists.");
  if (current.status === "Inside") {
    throw conflict("Record the vehicle's exit before deleting the entry.");
  }

  tx(() => {
    run("DELETE FROM vehicles WHERE id = ?", [id]);
    audit(actor, {
      action: "vehicle.deleted",
      entity: "vehicle",
      entityId: id,
      summary: `${actor.name} deleted the record for vehicle ${current.vehicleNumber}.`,
    });
  });

  publish("vehicles", "deleted", id);
}
