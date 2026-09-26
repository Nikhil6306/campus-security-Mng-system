/**
 * Visitor photograph rules, shared by the browser and the server.
 *
 * Both sides validate against these same constants so a visitor is never told
 * a file is acceptable that the server then rejects — and, more importantly,
 * so the server's answer never depends on the browser having asked nicely.
 */

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedPhotoType = (typeof ALLOWED_PHOTO_TYPES)[number];

/** Extension used when a photograph is written to storage. */
export const PHOTO_EXTENSIONS: Record<AllowedPhotoType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const PHOTO_MESSAGES = {
  required: "Visitor photo is required.",
  type: "Please upload a valid JPG, JPEG, PNG, or WEBP image.",
  size: "Photo size must be less than 5 MB.",
  corrupt: "Please upload a valid image.",
} as const;

/** The `accept` attribute for the file picker. */
export const PHOTO_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

export function isAllowedPhotoType(type: string): type is AllowedPhotoType {
  return (ALLOWED_PHOTO_TYPES as readonly string[]).includes(type);
}

/**
 * Validates what the browser can see about a chosen file.
 *
 * Deliberately shallow: a browser only reports the type it guessed from the
 * extension. The server re-checks the actual bytes, which is the check that
 * counts.
 */
export function validatePhotoFile(file: {
  type: string;
  size: number;
}): string | undefined {
  if (!isAllowedPhotoType(file.type)) return PHOTO_MESSAGES.type;
  if (file.size > MAX_PHOTO_BYTES) return PHOTO_MESSAGES.size;
  if (file.size === 0) return PHOTO_MESSAGES.corrupt;
  return undefined;
}

/**
 * Longest edge kept when the browser re-encodes a photograph before upload.
 *
 * Large enough that a face stays clearly identifiable at the gate, small
 * enough that a phone photo does not arrive as several megabytes.
 */
export const PHOTO_MAX_EDGE = 1280;

/** JPEG quality for that re-encode. */
export const PHOTO_QUALITY = 0.85;

/**
 * Storage path for one photograph.
 *
 * Built only from a server-generated id, never from anything a visitor typed,
 * so a crafted filename cannot escape the photo directory. The shape mirrors
 * the object path used in the Supabase storage bucket.
 */
export function photoStoragePath(id: string, extension: string): string {
  return `visitor-photos/${id}.${extension}`;
}

/** Recovers the id from a stored path. Returns null if the path is unexpected. */
export function photoIdFromPath(path: string | undefined | null): string | null {
  if (!path) return null;
  const match = /^visitor-photos\/([A-Za-z0-9_-]{16,64})\.(jpg|png|webp)$/.exec(path.trim());
  return match ? match[1] : null;
}

/**
 * Where a stored photograph is read back from.
 *
 * Takes what the booking row carries (`visitor-photos/<id>.jpg`) and returns
 * the staff-only endpoint that serves it. Returns undefined for a booking made
 * before photographs were required, so callers render their usual initials
 * fallback rather than a broken image.
 *
 * This is deliberately not a storage URL: the bytes are private, and the only
 * route that hands them out checks for a staff session first.
 */
export function visitorPhotoHref(photoUrl: string | undefined | null): string | undefined {
  const id = photoIdFromPath(photoUrl);
  return id ? `/api/visitor-photo/${encodeURIComponent(id)}` : undefined;
}

/** Copy for the photograph field, shared by the form and its error states. */
export const PHOTO_LABEL = "Visitor Photo";
export const PHOTO_HELPER =
  "Upload a clear recent photo of the visitor. This photo is required for campus security verification.";
