import "server-only";

import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  PHOTO_EXTENSIONS,
  PHOTO_MESSAGES,
  photoIdFromPath,
  photoStoragePath,
  type AllowedPhotoType,
} from "@/lib/photo";
import { badRequest } from "./errors";

/**
 * Private storage for visitor photographs.
 *
 * A visitor's photograph is identity data, so it is never written anywhere the
 * web server will serve directly. Files live under the gitignored `.data`
 * directory — the same place the database file sits — and the only way to read
 * one back is `/api/visitor-photo/[id]`, which checks for a staff session
 * first. This mirrors the private `campus-security` bucket in the Supabase
 * deployment, where the equivalent guard is a storage policy.
 *
 * Two rules hold everywhere in this module:
 *
 *  1. The filename comes from a 24-byte random id the server generates. Nothing
 *     a visitor typed ever reaches a path, so a crafted name cannot traverse
 *     out of the photo directory.
 *  2. The content type is decided by sniffing the actual bytes, not by
 *     trusting the multipart header. A `.jpg` containing a script is rejected
 *     as an invalid image.
 */

const ROOT = resolve(
  process.cwd(),
  process.env.VISITOR_PHOTO_DIR ?? ".data/visitor-photos",
);

export interface StoredPhoto {
  id: string;
  /** Storage path recorded on the booking, e.g. `visitor-photos/<id>.jpg`. */
  path: string;
  contentType: AllowedPhotoType;
  bytes: number;
}

/* ------------------------------------------------------------------ *
 * Content sniffing
 * ------------------------------------------------------------------ */

/**
 * Identifies an image from its leading bytes.
 *
 * Returns null for anything that is not one of the three accepted formats,
 * which is what makes the upload endpoint safe to expose without a session:
 * a renamed executable never gets past this.
 */
export function sniffImageType(buffer: Buffer): AllowedPhotoType | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (PNG.every((byte, index) => buffer[index] === byte)) return "image/png";

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

/**
 * Validates and stores one photograph.
 *
 * Throws a field-level `badRequest` the form can render against the photo
 * input, so a rejection reads the same whether the browser or the server
 * caught it.
 */
export function savePhoto(buffer: Buffer, declaredType?: string): StoredPhoto {
  if (!buffer.length) {
    throw badRequest(PHOTO_MESSAGES.corrupt, { photoId: PHOTO_MESSAGES.corrupt });
  }
  if (buffer.length > MAX_PHOTO_BYTES) {
    throw badRequest(PHOTO_MESSAGES.size, { photoId: PHOTO_MESSAGES.size });
  }

  const contentType = sniffImageType(buffer);
  if (!contentType) {
    // Either not an image at all, or not one of the accepted formats. The
    // message names the accepted formats rather than describing the bytes.
    throw badRequest(PHOTO_MESSAGES.type, { photoId: PHOTO_MESSAGES.type });
  }

  // A header that disagrees with the content is a signal worth refusing, but
  // only when the browser actually claimed one of the image types.
  if (
    declaredType &&
    (ALLOWED_PHOTO_TYPES as readonly string[]).includes(declaredType) &&
    declaredType !== contentType
  ) {
    throw badRequest(PHOTO_MESSAGES.corrupt, { photoId: PHOTO_MESSAGES.corrupt });
  }

  const id = randomBytes(24).toString("base64url");
  const extension = PHOTO_EXTENSIONS[contentType];
  const path = photoStoragePath(id, extension);

  const absolute = resolve(ROOT, `${id}.${extension}`);
  guardInsideRoot(absolute);

  mkdirSync(dirname(absolute), { recursive: true });
  // 0o600: readable by the service account only. Nothing else on the host has
  // any business opening a visitor's photograph.
  writeFileSync(absolute, buffer, { mode: 0o600 });

  return { id, path, contentType, bytes: buffer.length };
}

/* ------------------------------------------------------------------ *
 * Reading and removal
 * ------------------------------------------------------------------ */

export interface PhotoPayload {
  body: Buffer;
  contentType: AllowedPhotoType;
  bytes: number;
}

/**
 * Reads a stored photograph by id.
 *
 * Callers must have already established that the requester is allowed to see
 * it — this function performs no authorisation of its own.
 */
export function readPhoto(id: string): PhotoPayload | null {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) return null;

  for (const [contentType, extension] of Object.entries(PHOTO_EXTENSIONS) as [
    AllowedPhotoType,
    string,
  ][]) {
    const absolute = resolve(ROOT, `${id}.${extension}`);
    try {
      guardInsideRoot(absolute);
      const stats = statSync(absolute);
      if (!stats.isFile()) continue;
      return { body: readFileSync(absolute), contentType, bytes: stats.size };
    } catch {
      // Missing file for this extension — try the next.
    }
  }
  return null;
}

/**
 * Confirms an uploaded photograph is really on disk and reports where.
 *
 * Used when a booking claims a photo id: it turns the opaque id into the
 * storage path the row will carry, without reading the image itself. A
 * fabricated or already-superseded id resolves to null, and the booking is
 * refused rather than being written with a dangling reference.
 */
export function resolveStoredPhoto(id: string): Omit<StoredPhoto, "bytes"> | null {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) return null;

  for (const [contentType, extension] of Object.entries(PHOTO_EXTENSIONS) as [
    AllowedPhotoType,
    string,
  ][]) {
    const absolute = resolve(ROOT, `${id}.${extension}`);
    try {
      guardInsideRoot(absolute);
      if (!statSync(absolute).isFile()) continue;
      return { id, path: photoStoragePath(id, extension), contentType };
    } catch {
      // Not stored under this extension — try the next.
    }
  }
  return null;
}

/** Reads by the storage path recorded on a booking. */
export function readPhotoByPath(path: string | undefined | null): PhotoPayload | null {
  const id = photoIdFromPath(path);
  return id ? readPhoto(id) : null;
}

/**
 * Removes a stored photograph.
 *
 * Used when a photo is replaced, so a superseded file does not linger. Never
 * throws: failing to delete an old file must not fail the update that replaced
 * it.
 */
export function deletePhoto(pathOrId: string | undefined | null): boolean {
  const id = photoIdFromPath(pathOrId) ?? (pathOrId ?? "");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) return false;

  let removed = false;
  for (const extension of Object.values(PHOTO_EXTENSIONS)) {
    const absolute = resolve(ROOT, `${id}.${extension}`);
    try {
      guardInsideRoot(absolute);
      rmSync(absolute, { force: true });
      removed = true;
    } catch {
      // Nothing to remove under this extension.
    }
  }
  return removed;
}

/** Belt-and-braces: a resolved path must never leave the photo directory. */
function guardInsideRoot(absolute: string): void {
  if (absolute !== ROOT && !absolute.startsWith(ROOT + sep)) {
    throw new Error("Refusing to touch a path outside the visitor photo store.");
  }
}
