/**
 * Image fixtures and the photograph upload helper, shared by the test suites.
 *
 * Every booking now needs a photograph, so the suites that create bookings all
 * have to store one first. Keeping that in one place means the payload builders
 * in each suite differ only in what they are actually testing.
 *
 * The images below are the smallest valid file of each format — one pixel. The
 * server identifies a format from its leading bytes, so a real header is what
 * matters here, not the picture.
 */

/** 1×1 JPEG. */
export const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy" +
    "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA" +
    "AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA" +
    "AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3" +
    "ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm" +
    "p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEA" +
    "AwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSEx" +
    "BhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElK" +
    "U1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3" +
    "uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iii" +
    "gD//2Q==",
  "base64",
);

/** 1×1 PNG. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmM" +
    "IQAAAABJRU5ErkJggg==",
  "base64",
);

/** 1×1 WebP. */
export const WEBP = Buffer.from(
  "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=",
  "base64",
);

/** Not an image at all — a renamed text file. */
export const NOT_AN_IMAGE = Buffer.from(
  "<?php echo 'this is not a photograph'; ?>\n".repeat(20),
  "utf8",
);

/** Just over the 5 MB cap. Valid JPEG bytes followed by padding. */
export const OVERSIZED = Buffer.concat([
  JPEG,
  Buffer.alloc(5 * 1024 * 1024 + 1024 - JPEG.length, 0x20),
]);

/** Each upload presents a distinct client, because uploads are rate limited. */
let client = 0;
export const nextForwarded = () => `198.18.${(client += 1) % 254}.${(client % 200) + 1}`;

/**
 * Posts one image to the public upload endpoint.
 *
 * `type` is what the browser would claim; the server decides from the bytes.
 */
export async function uploadPhoto(
  base,
  { bytes = JPEG, filename = "visitor.jpg", type = "image/jpeg", forwarded } = {},
) {
  const form = new FormData();
  form.append("photo", new Blob([bytes], { type }), filename);

  const response = await fetch(`${base}/api/public/visitor-photo`, {
    method: "POST",
    headers: { "X-Forwarded-For": forwarded ?? nextForwarded() },
    body: form,
  });
  const envelope = await response.json().catch(() => ({}));
  return { status: response.status, envelope };
}

/**
 * Stores a photograph and returns the id a booking should name.
 *
 * Throws rather than returning a bad id, so a suite that is not testing uploads
 * fails on the real problem instead of on a confusing booking rejection.
 */
export async function newPhotoId(base, options) {
  const { status, envelope } = await uploadPhoto(base, options);
  if (status !== 200 || !envelope?.data?.photoId) {
    throw new Error(
      `photo upload failed (${status}): ${JSON.stringify(envelope).slice(0, 200)}`,
    );
  }
  return envelope.data.photoId;
}
