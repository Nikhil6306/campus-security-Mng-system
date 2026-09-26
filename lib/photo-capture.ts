/**
 * Browser-side preparation of a visitor photograph.
 *
 * Runs before anything is uploaded: it rejects what the rules in `lib/photo.ts`
 * do not allow, proves the file really decodes as an image, and shrinks a
 * phone-sized photo to something a gate screen can display without sending
 * several megabytes over a campus connection.
 *
 * None of this is a security control. The server sniffs the bytes it receives
 * and enforces the same limits again — this only means a visitor hears about a
 * problem immediately instead of after an upload.
 */

import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  PHOTO_MAX_EDGE,
  PHOTO_MESSAGES,
  PHOTO_QUALITY,
  isAllowedPhotoType,
} from "./photo";

/** A rejection the form can put straight under the photo field. */
export class PhotoError extends Error {}

export interface PreparedPhoto {
  /** What will be uploaded. JPEG unless the original was already smaller. */
  blob: Blob;
  width: number;
  height: number;
  /** Size of the file the visitor chose, before any re-encoding. */
  originalBytes: number;
}

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * The type to judge a chosen file by.
 *
 * Some Android pickers hand back a file with an empty `type`, so the extension
 * is used as a fallback rather than refusing a photograph that is probably
 * fine. The server does not rely on either — it reads the actual bytes.
 */
function declaredType(file: Blob, name?: string): string {
  if (file.type) return file.type;
  const extension = (name ?? (file as File).name ?? "").split(".").pop()?.toLowerCase();
  return (extension && EXTENSION_TYPES[extension]) || "";
}

/** Decodes a blob, or rejects it as not being a usable image. */
function decode(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    // Modern browsers orient from EXIF when drawing, so a portrait photo taken
    // on a phone is not laid on its side in the preview or at the gate.
    image.decoding = "async";
    image.onload = () => {
      URL.revokeObjectURL(url);
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new PhotoError(PHOTO_MESSAGES.corrupt));
        return;
      }
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new PhotoError(PHOTO_MESSAGES.corrupt));
    };
    image.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoError(PHOTO_MESSAGES.corrupt))),
      "image/jpeg",
      PHOTO_QUALITY,
    );
  });
}

/**
 * Validates and, where it helps, re-encodes one photograph.
 *
 * The re-encode is skipped when it would make the file larger — a small,
 * already-compressed portrait is left exactly as the visitor chose it rather
 * than being pushed through a lossy pass for nothing.
 *
 * @throws PhotoError with the message the field should display.
 */
export async function preparePhoto(file: Blob, name?: string): Promise<PreparedPhoto> {
  if (!file.size) throw new PhotoError(PHOTO_MESSAGES.corrupt);
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoError(PHOTO_MESSAGES.size);

  const type = declaredType(file, name);
  if (!isAllowedPhotoType(type)) throw new PhotoError(PHOTO_MESSAGES.type);

  const image = await decode(file);

  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longest > PHOTO_MAX_EDGE ? PHOTO_MAX_EDGE / longest : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoError(PHOTO_MESSAGES.corrupt);
  // A white ground: a PNG with transparency would otherwise come out black
  // once it is flattened into a JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  const encoded = await toBlob(canvas);

  const keepOriginal =
    scale === 1 &&
    encoded.size >= file.size &&
    (ALLOWED_PHOTO_TYPES as readonly string[]).includes(type);

  const blob = keepOriginal ? file : encoded;
  if (blob.size > MAX_PHOTO_BYTES) throw new PhotoError(PHOTO_MESSAGES.size);

  return { blob, width, height, originalBytes: file.size };
}

/** `1.4 MB` — used in the hint line under a chosen photograph. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
