"use client";

import * as React from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, Keyboard, Loader2, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Camera QR scanner.
 *
 * Decodes frames locally with jsQR — the video stream never leaves the device
 * and no image is uploaded anywhere. The decoded text is only a lookup key: it
 * is handed to `/api/gate/verify`, which re-reads the booking and decides. A
 * scan on its own admits nobody.
 *
 * Camera access can fail for ordinary reasons (permission denied, no device, an
 * insecure origin), so the manual entry path beside it is always available.
 */

type ScannerState = "idle" | "starting" | "running" | "denied" | "unsupported" | "error";

export function QrScanner({
  onDetected,
  onUseManual,
  className,
  paused = false,
}: {
  onDetected: (value: string) => void;
  onUseManual?: () => void;
  className?: string;
  /** Freezes decoding while a result is being confirmed. */
  paused?: boolean;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const lastValueRef = React.useRef<string>("");
  const pausedRef = React.useRef(paused);

  const [state, setState] = React.useState<ScannerState>("idle");
  const [message, setMessage] = React.useState<string>();

  React.useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const stop = React.useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState("idle");
  }, []);

  const start = React.useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      setMessage(
        "This browser cannot open a camera here. Cameras need a secure (https) connection.",
      );
      return;
    }

    setState("starting");
    setMessage(undefined);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      setState("running");

      if (!canvasRef.current) canvasRef.current = document.createElement("canvas");

      const tick = () => {
        frameRef.current = requestAnimationFrame(tick);
        if (pausedRef.current) return;

        const canvas = canvasRef.current;
        if (!canvas || !video.videoWidth || video.readyState !== video.HAVE_ENOUGH_DATA) return;

        // Decoding a downscaled frame keeps this comfortably real-time on the
        // low-powered tablets a gate desk actually uses.
        const width = 480;
        const height = Math.round((video.videoHeight / video.videoWidth) * width) || 360;
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(video, 0, 0, width, height);

        const image = context.getImageData(0, 0, width, height);
        const result = jsQR(image.data, image.width, image.height, {
          inversionAttempts: "dontInvert",
        });

        if (result?.data && result.data !== lastValueRef.current) {
          lastValueRef.current = result.data;
          onDetected(result.data.trim());
          // Allow the same pass to be scanned again after a moment.
          setTimeout(() => {
            lastValueRef.current = "";
          }, 2500);
        }
      };

      frameRef.current = requestAnimationFrame(tick);
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setState("denied");
        setMessage("Camera permission was refused. Allow it in the browser, or type the booking ID.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setState("unsupported");
        setMessage("No camera was found on this device. Use the booking ID lookup instead.");
      } else {
        setState("error");
        setMessage("The camera could not be started. Use the booking ID lookup instead.");
      }
    }
  }, [onDetected]);

  // Always release the camera when the panel unmounts.
  React.useEffect(() => () => stop(), [stop]);

  const running = state === "running";

  return (
    <div className={cn("flex h-full flex-col items-center justify-center gap-4 p-4", className)}>
      <div className="relative aspect-square w-full max-w-[280px] overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/40">
        <video
          ref={videoRef}
          className={cn("h-full w-full object-cover", !running && "invisible")}
          muted
          playsInline
        />

        {!running ? (
          <div className="absolute inset-0 flex items-center justify-center">
            {state === "starting" ? (
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground/50" aria-hidden />
            ) : state === "denied" || state === "unsupported" || state === "error" ? (
              <CameraOff className="h-14 w-14 text-muted-foreground/30" aria-hidden />
            ) : (
              <Camera className="h-14 w-14 text-muted-foreground/30" aria-hidden />
            )}
          </div>
        ) : null}

        {/* Corner brackets frame the target area for the person holding the pass. */}
        {[
          "left-3 top-3 border-l-2 border-t-2",
          "right-3 top-3 border-r-2 border-t-2",
          "bottom-3 left-3 border-b-2 border-l-2",
          "bottom-3 right-3 border-b-2 border-r-2",
        ].map((position) => (
          <span
            key={position}
            className={cn("absolute h-7 w-7 rounded-sm border-primary/70", position)}
            aria-hidden
          />
        ))}

        {running && !paused ? (
          <span
            className="absolute inset-x-4 top-0 h-0.5 animate-scan-line bg-accent/70"
            aria-hidden
          />
        ) : null}
      </div>

      <div className="space-y-1 text-center">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold">
          <ScanLine className="h-4 w-4 text-primary" aria-hidden />
          {running ? (paused ? "Scanner paused" : "Hold the pass in the frame") : "Scan visitor pass"}
        </p>
        <p
          className="mx-auto max-w-[280px] text-xs leading-relaxed text-muted-foreground"
          role={message ? "alert" : undefined}
        >
          {message ??
            (running
              ? "The QR code is read on this device. Entry is still verified by the server."
              : "Start the camera to scan a visitor pass, or enter the booking ID by hand.")}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {running ? (
          <Button variant="outline" size="sm" onClick={stop}>
            <CameraOff className="h-4 w-4" />
            Stop camera
          </Button>
        ) : (
          <Button size="sm" onClick={() => void start()} loading={state === "starting"}>
            <Camera className="h-4 w-4" />
            {state === "idle" ? "Start camera" : "Try again"}
          </Button>
        )}

        {onUseManual ? (
          <Button variant="ghost" size="sm" onClick={onUseManual}>
            <Keyboard className="h-4 w-4" />
            Enter booking ID
          </Button>
        ) : null}
      </div>
    </div>
  );
}
