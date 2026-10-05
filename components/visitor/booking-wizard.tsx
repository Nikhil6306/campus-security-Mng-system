"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Car,
  IdCard,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { FormField } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { InlineLoader } from "@/components/shared/states";
import {
  VisitorPhotoField,
  useBlobPreview,
  type VisitorPhoto,
} from "@/components/visitor/visitor-photo-field";
import { api, errorMessage, fieldErrors, type PublicBookingView } from "@/lib/api";
import type { VisitStatus } from "@/lib/types";
import { STATUS_PATH } from "@/lib/dsvv";
import { cn, formatDate } from "@/lib/utils";
import {
  formatAadhaar,
  maskAadhaar,
  normaliseAadhaar,
  normaliseVehicleNumber,
  validateAadhaar,
  validateMobile,
  validateName,
  validateVehicleNumber,
  type FieldErrors,
} from "@/lib/validation";

interface FormState {
  fullName: string;
  aadhaarNumber: string;
  mobileNumber: string;
  photo: VisitorPhoto | null;
  hasCar: "yes" | "no";
  carNumber: string;
}

const initialState: FormState = {
  fullName: "",
  aadhaarNumber: "",
  mobileNumber: "",
  photo: null,
  hasCar: "no",
  carNumber: "",
};

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function BookingWizard() {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(initialState);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [created, setCreated] = React.useState<PublicBookingView | null>(null);

  const idempotencyKeyRef = React.useRef(newIdempotencyKey());
  const photoPreview = useBlobPreview(form.photo?.blob ?? null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const nextErrors: FieldErrors = {};

    const nameErr = validateName(form.fullName);
    if (nameErr) nextErrors.fullName = nameErr;

    const aadhaarErr = validateAadhaar(form.aadhaarNumber);
    if (aadhaarErr) nextErrors.aadhaarNumber = aadhaarErr;

    const mobileErr = validateMobile(form.mobileNumber);
    if (mobileErr) nextErrors.mobileNumber = mobileErr;

    if (!form.photo) {
      nextErrors.photo = "A photograph is required for visitor entry.";
    }

    if (form.hasCar === "yes") {
      const carErr = validateVehicleNumber(form.carNumber);
      if (carErr) nextErrors.carNumber = carErr;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      toast.error("Please fix the errors in the form before submitting.");
      return;
    }

    setIsSubmitting(true);
    let uploadedPhotoId: string | null = null;

    try {
      // Step 1: Upload Photo securely
      if (form.photo?.blob) {
        const photoRes = await api.uploadVisitorPhoto(form.photo.blob);
        uploadedPhotoId = photoRes.photoId;
      }

      if (!uploadedPhotoId) {
        throw new Error("Unable to process visitor photo. Please try again.");
      }

      // Step 2: Register Visitor
      const payload = {
        fullName: form.fullName.trim(),
        aadhaarNumber: normaliseAadhaar(form.aadhaarNumber),
        mobileNumber: form.mobileNumber.replace(/[\s-]/g, ""),
        photoId: uploadedPhotoId,
        hasCar: form.hasCar === "yes",
        carNumber: form.hasCar === "yes" ? normaliseVehicleNumber(form.carNumber) : "",
        idempotencyKey: idempotencyKeyRef.current,
      };

      const result = await api.createPublicBooking(payload as unknown as Record<string, unknown>);
      setCreated(result);
      idempotencyKeyRef.current = newIdempotencyKey();
      toast.success("Visitor registered successfully!");
    } catch (err: unknown) {
      const fieldErrs = fieldErrors(err);
      if (Object.keys(fieldErrs).length > 0) {
        setErrors(fieldErrs);
      }
      toast.error(errorMessage(err, "Unable to register visitor. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success view
  if (created) {
    const rawAadhaar = form.aadhaarNumber || created.aadhaarNumber || created.idNumber || "";
    const displayAadhaar = maskAadhaar(rawAadhaar);

    return (
      <Card className="mx-auto max-w-2xl border-emerald-500/30 bg-emerald-50/20 shadow-md dark:bg-emerald-950/10">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <BadgeCheck className="h-10 w-10" />
            </div>

            <h2 className="mt-4 text-2xl font-bold tracking-tight">Visitor Registration Successful</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reference Number:{" "}
              <span className="font-mono font-semibold text-foreground">{created.id}</span>
            </p>

            <div className="mt-6 w-full rounded-lg border border-border bg-card p-5 text-left shadow-xs">
              <div className="flex items-center gap-4 border-b border-border pb-4">
                {photoPreview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photoPreview}
                    alt={created.fullName}
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/20"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground">
                    {created.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold">{created.fullName}</h3>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <StatusBadge status={(created.status || "Pending") as VisitStatus} />
                  </div>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Aadhaar Card Number</dt>
                  <dd className="mt-0.5 font-mono font-medium">{displayAadhaar}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Mobile Number</dt>
                  <dd className="mt-0.5 font-mono font-medium">{created.mobileNumber || created.mobile || form.mobileNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Car Brought</dt>
                  <dd className="mt-0.5 font-medium">{created.hasCar || created.vehicleRequired ? "Yes" : "No"}</dd>
                </div>
                {(created.hasCar || created.vehicleRequired) && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Car Number</dt>
                    <dd className="mt-0.5 font-mono font-medium uppercase">
                      {created.carNumber || created.vehicleNumber || "N/A"}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Registration Date</dt>
                  <dd className="mt-0.5 font-medium">{formatDate(created.createdAt || new Date().toISOString())}</dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setCreated(null);
                  setForm(initialState);
                  setErrors({});
                }}
              >
                Register Another Visitor
              </Button>
              <Button onClick={() => router.push(STATUS_PATH)}>
                Check Visitor Status
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl shadow-sm">
      <CardContent className="p-6 sm:p-8">
        <div className="mb-6 border-b border-border pb-4">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Campus Visitor Entry Form</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Please fill out your details accurately for campus security check-in.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Full Name */}
          <FormField
            id="fullName"
            label="Full Name"
            required
            error={errors.fullName}
            hint="Enter your complete name as written on your official ID."
          >
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                id="fullName"
                type="text"
                placeholder="e.g. Rajesh Kumar"
                className="pl-9"
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                disabled={isSubmitting}
                autoComplete="name"
              />
            </div>
          </FormField>

          {/* 2. Aadhaar Card Number */}
          <FormField
            id="aadhaarNumber"
            label="Aadhaar Card Number"
            required
            error={errors.aadhaarNumber}
            hint="12-digit Indian Aadhaar number. Format: XXXX XXXX XXXX."
          >
            <div className="relative">
              <IdCard className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                id="aadhaarNumber"
                type="text"
                placeholder="1234 5678 9012"
                className="pl-9 font-mono"
                maxLength={14}
                value={form.aadhaarNumber}
                onChange={(e) => update("aadhaarNumber", formatAadhaar(e.target.value))}
                disabled={isSubmitting}
              />
            </div>
          </FormField>

          {/* 3. Mobile Number */}
          <FormField
            id="mobileNumber"
            label="Mobile Number"
            required
            error={errors.mobileNumber}
            hint="10-digit Indian mobile number."
          >
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                id="mobileNumber"
                type="tel"
                placeholder="9876543210"
                className="pl-9 font-mono"
                maxLength={10}
                value={form.mobileNumber}
                onChange={(e) => update("mobileNumber", e.target.value.replace(/\D/g, "").slice(0, 10))}
                disabled={isSubmitting}
                autoComplete="tel"
              />
            </div>
          </FormField>

          {/* 4. Photo Upload */}
          <FormField
            id="photo"
            label="Photo"
            required
            error={errors.photo}
            hint="Capture or upload a clear front-facing face photo (JPG, PNG, WebP up to 5MB)."
          >
            <VisitorPhotoField
              value={form.photo}
              onChange={(photo) => update("photo", photo)}
              error={errors.photo}
              disabled={isSubmitting}
            />
          </FormField>

          {/* 5. Car Option (Yes / No) */}
          <FormField
            id="hasCar"
            label="Do you have a car?"
            required
            error={errors.hasCar}
            hint="Select whether you are entering campus with a vehicle."
          >
            <div className="flex gap-4 pt-1">
              <label
                className={cn(
                  "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 font-medium transition-colors",
                  form.hasCar === "yes"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <input
                  type="radio"
                  name="hasCar"
                  value="yes"
                  checked={form.hasCar === "yes"}
                  onChange={() => update("hasCar", "yes")}
                  className="sr-only"
                  disabled={isSubmitting}
                />
                <Car className="h-4 w-4" />
                Yes
              </label>

              <label
                className={cn(
                  "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 font-medium transition-colors",
                  form.hasCar === "no"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <input
                  type="radio"
                  name="hasCar"
                  value="no"
                  checked={form.hasCar === "no"}
                  onChange={() => {
                    update("hasCar", "no");
                    update("carNumber", "");
                  }}
                  className="sr-only"
                  disabled={isSubmitting}
                />
                No
              </label>
            </div>
          </FormField>

          {/* 6. Car Number (Conditional: only visible when hasCar = yes) */}
          {form.hasCar === "yes" && (
            <FormField
              id="carNumber"
              label="Car Number / Registration Number"
              required
              error={errors.carNumber}
              hint="Enter your vehicle registration number (e.g. UK07AB1234)."
            >
              <div className="relative">
                <Car className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  id="carNumber"
                  type="text"
                  placeholder="UK07AB1234"
                  className="pl-9 font-mono uppercase"
                  value={form.carNumber}
                  onChange={(e) => update("carNumber", e.target.value.toUpperCase())}
                  disabled={isSubmitting}
                />
              </div>
            </FormField>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full py-6 text-base font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <InlineLoader label="Registering Visitor..." />
            ) : (
              <span className="flex items-center justify-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Register Visitor
              </span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
