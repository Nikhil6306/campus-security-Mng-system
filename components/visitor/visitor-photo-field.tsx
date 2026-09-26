"use client";

import * as React from "react";
import {
  AlertCircle,
  Camera,
  CameraOff,
  Check,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PHOTO_ACCEPT, PHOTO_HELPER, PHOTO_LABEL, PHOTO_MESSAGES } from "@/lib/photo";
import { PhotoError, formatBytes, preparePhoto } from "@/lib/photo-capture";

/**
 * The visitor photograph field.
 *
 * Mandatory, and collected two ways: a live capture from the device camera, or
 * a file from the gallery. Both paths end in the same place — the image is
 * validated and downscaled locally, then held as a blob until the form is
 * submitted, at which point it is uploaded and the booking names the id it
 * gets back.
 *
 * Nothing here is trusted by the server. The bytes are sniffed on arrival and
 * the same size and format limits are applied again; this component exists so a
 * visitor is told about a problem while they can still fix it.
 */

export interface VisitorPhoto {
  /** What will be uploaded — already validated and sized. */
  blob: Blob;
  source: "camera" | "upload";
  width: number;
  height: number;
  bytes: number;
}

/**
 * A displayable URL for a chosen photograph, released when it is replaced.
 *
 * Exported because the review step shows the same image again: without a single
 * owner for the object URL, one of the two previews leaks the image for the
 * lifetime of the page.
 */
export function useBlobPreview(blob: Blob | null | undefined): string | undefined {
  const [url, setUrl] = React.useState<string>();

  React.useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return url;
}

interface VisitorPhotoFieldProps {
  id?: string;
  value: VisitorPhoto | null;
  onChange: (photo: VisitorPhoto | null) => void;
  /** Validation message from this form or returned by the server. */
  error?: string;
  disabled?: boolean;
  className?: string;
}

type CameraState = "closed" | "starting" | "running" | "denied" | "unsupported" | "error";

export function VisitorPhotoField({
  id = "photoId",
  value,
  onChange,
  error,
  disabled,
  className,
}: VisitorPhotoFieldProps) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const preview = useBlobPreview(value?.blob);
  const [camera, setCamera] = React.useState<CameraState>("closed");
  const [cameraMessage, setCameraMessage] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  const [localError, setLocalError] = React.useState<string>();

  // The server's message wins: it is the one that actually blocked the booking.
  const message = error ?? localError;
  const describedBy = [`${id}-hint`, message ? `${id}-error` : null].filter(Boolean).join(" ");

  /* ------------------------------- Camera ------------------------------ */

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamera("closed");
  }, []);

  React.useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = React.useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCamera("unsupported");
      setCameraMessage(
        "This browser cannot open a camera here — cameras need a secure (https) connection. Please upload a photo instead.",
      );
      return;
    }

    setCamera("starting");
    setCameraMessage(undefined);
    setLocalError(undefined);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // The front camera is the one pointing at the person being photographed
        // when they hold their own phone.
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      setCamera("running");
    } catch (failure) {
      const name = (failure as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCamera("denied");
        setCameraMessage(
          "Camera permission was refused. Allow camera access in your browser, or use Upload Photo instead.",
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setCamera("unsupported");
        setCameraMessage(
          "No camera was found on this device. Please upload a photo instead.",
        );
      } else {
        setCamera("error");
        setCameraMessage("The camera could not be started. Please upload a photo instead.");
      }
    }
  }, []);

  /* ------------------------------ Accepting ---------------------------- */

  const accept = React.useCallback(
    async (blob: Blob, source: VisitorPhoto["source"], name?: string) => {
      setBusy(true);
      setLocalError(undefined);
      try {
        const prepared = await preparePhoto(blob, name);
        onChange({
          blob: prepared.blob,
          source,
          width: prepared.width,
          height: prepared.height,
          bytes: prepared.blob.size,
        });
        return true;
      } catch (failure) {
        setLocalError(
          failure instanceof PhotoError ? failure.message : PHOTO_MESSAGES.corrupt,
        );
        onChange(null);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  const capture = React.useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setLocalError(PHOTO_MESSAGES.corrupt);
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) {
      setLocalError(PHOTO_MESSAGES.corrupt);
      return;
    }

    // Release the camera as soon as there is a usable frame — leaving it live
    // behind a preview keeps the indicator light on for no reason.
    if (await accept(blob, "camera", "capture.jpg")) stopCamera();
  }, [accept, stopCamera]);

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so choosing the same file twice still fires a change event.
    event.target.value = "";
    if (!file) return;
    stopCamera();
    await accept(file, "upload", file.name);
  };

  const remove = () => {
    onChange(null);
    setLocalError(undefined);
    stopCamera();
  };

  /* ------------------------------- Render ------------------------------ */

  const showCamera = camera === "starting" || camera === "running";

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label id={`${id}-label`} required>
        {PHOTO_LABEL}
      </Label>

      <div
        role="group"
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
        className={cn(
          "rounded-lg border bg-muted/30 p-4 transition-colors",
          message ? "border-destructive/50" : "border-border",
        )}
      >
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* Preview — contained, never stretched, so a face is not distorted. */}
          <div
            className={cn(
              "relative h-36 w-28 shrink-0 overflow-hidden rounded-md border bg-background sm:h-40 sm:w-32",
              message ? "border-destructive/40" : "border-border",
            )}
          >
            {showCamera ? (
              <>
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  aria-label="Camera preview"
                />
                {camera === "starting" ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                    <span className="sr-only">Starting the camera</span>
                  </span>
                ) : null}
              </>
            ) : preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- a blob: URL is not routable through next/image
              <img
                src={preview}
                alt="Selected visitor photo"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                <UserRound className="h-9 w-9 opacity-40" aria-hidden />
                <span className="text-[11px]">No photo yet</span>
              </div>
            )}

            {value && !showCamera ? (
              <span
                className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-success text-success-foreground shadow-sm"
                aria-hidden
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
            <p className="text-sm text-muted-foreground">{PHOTO_HELPER}</p>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {showCamera ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void capture()}
                    loading={busy}
                    disabled={disabled || camera !== "running"}
                  >
                    <Camera className="h-4 w-4" />
                    Capture Photo
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={stopCamera}>
                    <CameraOff className="h-4 w-4" />
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant={value ? "outline" : "default"}
                    size="sm"
                    onClick={() => void startCamera()}
                    disabled={disabled || busy}
                  >
                    <Camera className="h-4 w-4" />
                    Take Photo
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    loading={busy}
                    disabled={disabled}
                  >
                    {value ? (
                      <RefreshCw className="h-4 w-4" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {value ? "Change Photo" : "Upload Photo"}
                  </Button>

                  {value ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={remove}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  ) : null}
                </>
              )}
            </div>

            {cameraMessage ? (
              <p
                role="status"
                className="flex items-start gap-1.5 text-xs text-muted-foreground"
              >
                <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                {cameraMessage}
              </p>
            ) : null}

            {value && !showCamera ? (
              <p className="text-xs text-muted-foreground">
                {value.source === "camera" ? "Captured with the camera" : "Uploaded from device"} ·{" "}
                {value.width}×{value.height} · {formatBytes(value.bytes)}
              </p>
            ) : null}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={PHOTO_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => void onFile(event)}
        />
      </div>

      <p id={`${id}-hint`} className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        Required for security verification. JPG, JPEG, PNG or WEBP, up to 5 MB.
      </p>

      {message ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium text-destructive"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {message}
        </p>
      ) : null}
    </div>
  );
}
