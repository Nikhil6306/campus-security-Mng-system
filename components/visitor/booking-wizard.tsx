"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock,
  Info,
  MessageCircle,
  Send,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toaster";
import { FormField } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { InlineLoader } from "@/components/shared/states";
import { BookingSummary } from "@/components/visitor/booking-summary";
import { PassDeliveryCard } from "@/components/visitor/pass-delivery-card";
import {
  VisitorPhotoField,
  useBlobPreview,
  type VisitorPhoto,
} from "@/components/visitor/visitor-photo-field";
import {
  api,
  errorMessage,
  fieldErrors,
  type PublicBookingView,
  type PublicDirectory,
  type SlotOption,
} from "@/lib/api";
import {
  DURATIONS,
  GENDERS,
  GUEST_RELATIONS,
  HOST_REQUIRED_PURPOSES,
  ID_PROOF_TYPES,
  PUBLIC_VISITOR_TYPES,
  PUBLIC_VISIT_PURPOSES,
  type Gender,
  type GuestRelation,
  type IdProofType,
  type VisitPurpose,
  type VisitStatus,
  type VisitorType,
} from "@/lib/types";
import { PHOTO_MESSAGES } from "@/lib/photo";
import { STATUS_PATH } from "@/lib/dsvv";
import { cn, formatDate, formatTime, todayISO } from "@/lib/utils";
import {
  maskAadhaar,
  normaliseAadhaar,
  formatAadhaar,
  validateAadhaar,
  type FieldErrors,
  normaliseVehicleNumber,
  validateCount,
  validateEmail,
  validateFutureDate,
  validateIdNumber,
  validateMobile,
  validateName,
  validateText,
  validateTime,
  validateVehicleNumber,
} from "@/lib/validation";

const OTHER_HOST = "__other__";

/**
 * One accompanying visitor.
 *
 * The Aadhaar number is held in component state only while the form is open;
 * it is sent once, over HTTPS, in the request body, and is never written to
 * the URL, to storage, or to the console.
 */
interface GuestForm {
  fullName: string;
  mobile: string;
  aadhaar: string;
  relation: GuestRelation | "";
  address: string;
}

type GuestField = keyof GuestForm;

const emptyGuest = (): GuestForm => ({
  fullName: "",
  mobile: "",
  aadhaar: "",
  relation: "",
  address: "",
});

/** Grows or trims the party to match the headcount, keeping what was typed. */
function resizeGuests(current: GuestForm[], size: number): GuestForm[] {
  if (size === current.length) return current;
  if (size < current.length) return current.slice(0, size);
  return [...current, ...Array.from({ length: size - current.length }, emptyGuest)];
}

/** Opaque, per-attempt replay guard. Regenerated after a booking succeeds. */
function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

interface FormState {
  /* 1 — visitor */
  fullName: string;
  mobile: string;
  whatsappCountryCode: string;
  whatsappNumber: string;
  whatsappSameAsMobile: boolean;
  email: string;
  gender: Gender | "";
  visitorType: VisitorType | "";
  idType: IdProofType | "";
  idNumber: string;
  organization: string;
  address: string;
  emergencyContact: string;
  /**
   * The visitor's photograph, held as a blob until the form is submitted.
   *
   * Uploaded once, at submission, rather than on selection: a visitor who
   * changes their mind halfway through a five-step form should not have left
   * an image of their face on the server.
   */
  photo: VisitorPhoto | null;

  /* 2 — purpose */
  purpose: VisitPurpose | "";
  purposeDetail: string;

  /* 3 — person to meet */
  departmentId: string;
  hostSelection: string;
  hostName: string;

  /* 4 — date & time */
  visitDate: string;
  visitTime: string;
  expectedDuration: string;

  /* 5 — extras */
  numberOfVisitors: string;
  guests: GuestForm[];
  vehicleRequired: "yes" | "no";
  vehicleNumber: string;
  notes: string;
  specialRequirements: string;
}

const initialState: FormState = {
  fullName: "",
  mobile: "",
  whatsappCountryCode: "+91",
  whatsappNumber: "",
  whatsappSameAsMobile: true,
  email: "",
  gender: "",
  visitorType: "",
  idType: "",
  idNumber: "",
  organization: "",
  address: "",
  emergencyContact: "",
  photo: null,
  purpose: "",
  purposeDetail: "",
  departmentId: "",
  hostSelection: "",
  hostName: "",
  visitDate: todayISO(1),
  visitTime: "",
  expectedDuration: "30 minutes",
  numberOfVisitors: "1",
  guests: [],
  vehicleRequired: "no",
  vehicleNumber: "",
  notes: "",
  specialRequirements: "",
};

const steps = [
  { id: 1, title: "Visitor Details", short: "Visitor", icon: User },
  { id: 2, title: "Visit Details", short: "Visit", icon: CalendarDays },
  { id: 3, title: "Additional Information", short: "Extras", icon: ClipboardCheck },
  { id: 4, title: "Review & Confirm", short: "Review", icon: BadgeCheck },
];

const LAST_STEP = 4;
const CONFIRMATION = 5;

/**
 * Server field names that the form holds under a different key.
 *
 * The booking API names the photograph `photoId`, because that is what travels
 * in the request; the form holds the image itself under `photo`. Without this
 * the server's "Visitor photo is required." would land on no field at all.
 */
const SERVER_FIELD_ALIASES: Record<string, keyof FormState> = {
  photoId: "photo",
};

/** Maps a server field name back to the step that collects it. */
const FIELD_STEP: Record<string, number> = {
  fullName: 1,
  mobile: 1,
  whatsappCountryCode: 1,
  whatsappNumber: 1,
  email: 1,
  gender: 1,
  visitorType: 1,
  idType: 1,
  idNumber: 1,
  organization: 1,
  address: 1,
  emergencyContact: 1,
  photoId: 1,
  purpose: 2,
  purposeDetail: 2,
  hostId: 2,
  departmentId: 2,
  visitDate: 2,
  visitTime: 2,
  expectedDuration: 2,
  numberOfVisitors: 2,
  vehicleNumber: 3,
  notes: 3,
  specialRequirements: 3,
};

export function BookingWizard() {
  const router = useRouter();

  const [step, setStep] = React.useState(1);
  const [form, setForm] = React.useState<FormState>(initialState);
  const [errors, setErrors] = React.useState<FieldErrors<keyof FormState>>({});
  const [guestErrors, setGuestErrors] = React.useState<FieldErrors<GuestField>[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  // Stable for the life of one attempt, so a double-click or a browser retry
  // resolves to the same booking instead of creating a second one.
  const idempotencyKey = React.useRef(newIdempotencyKey());
  /**
   * The id of the photograph already stored for this attempt.
   *
   * Kept so a submission that fails on a booking rule — a slot taken in the
   * meantime, say — does not store the visitor's face a second time when they
   * press submit again. Cleared whenever the photograph itself changes.
   */
  const photoIdRef = React.useRef<string | null>(null);
  const [created, setCreated] = React.useState<PublicBookingView | null>(null);
  const headingRef = React.useRef<HTMLDivElement>(null);

  /* --------------------------- Campus directory --------------------------- */

  const [directory, setDirectory] = React.useState<PublicDirectory | null>(null);
  const [directoryError, setDirectoryError] = React.useState<string>();

  React.useEffect(() => {
    let alive = true;
    api
      .directory()
      .then((data) => {
        if (alive) setDirectory(data);
      })
      .catch((error) => {
        if (alive)
          setDirectoryError(
            errorMessage(error, "We could not load the campus directory. Please refresh."),
          );
      });
    return () => {
      alive = false;
    };
  }, []);

  const departments = directory?.departments ?? [];
  const hosts = React.useMemo(
    () =>
      (directory?.hosts ?? []).filter(
        (host) => !form.departmentId || host.departmentId === form.departmentId,
      ),
    [directory, form.departmentId],
  );

  const maxVisitors = directory?.settings.maxVisitorsPerBooking ?? 20;
  const advanceDays = directory?.settings.advanceBookingDays ?? 90;

  /* ------------------------------ Slot loading ---------------------------- */

  const [slots, setSlots] = React.useState<SlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = React.useState(false);

  const hostId = form.hostSelection === OTHER_HOST || !form.hostSelection ? null : form.hostSelection;

  React.useEffect(() => {
    if (step !== 2 || !form.visitDate) return;
    let alive = true;
    setSlotsLoading(true);
    api
      .slots(hostId, form.visitDate)
      .then((data) => {
        if (alive) setSlots(data.slots);
      })
      .catch(() => {
        // A slot list is a convenience; the server re-checks the chosen time.
        if (alive) setSlots([]);
      })
      .finally(() => {
        if (alive) setSlotsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [step, hostId, form.visitDate]);

  /* ---------------------------- Accompanying party ------------------------ */

  const partySize = Math.max(1, Math.min(Number(form.numberOfVisitors) || 1, maxVisitors));
  const guestCount = partySize - 1;

  // The number of guest cards is derived from the headcount rather than being
  // a fixed list, and what has already been typed survives a change.
  React.useEffect(() => {
    setForm((prev) => {
      const next = resizeGuests(prev.guests, Math.max(0, guestCount));
      return next === prev.guests ? prev : { ...prev, guests: next };
    });
    setGuestErrors((prev) => prev.slice(0, Math.max(0, guestCount)));
  }, [guestCount]);

  const setGuest = (index: number, key: GuestField, value: string) => {
    setForm((prev) => {
      const guests = [...prev.guests];
      guests[index] = { ...guests[index], [key]: value };
      return { ...prev, guests };
    });
    setGuestErrors((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: undefined };
      return next;
    });
  };

  /* -------------------------------- Helpers ------------------------------- */

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  /** A new photograph invalidates whatever was uploaded for the previous one. */
  const onPhotoChange = (photo: VisitorPhoto | null) => {
    photoIdRef.current = null;
    set("photo", photo);
  };

  /** Changing department invalidates a host chosen from the previous one. */
  const onDepartmentChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      departmentId: value,
      hostSelection: "",
      hostName: "",
    }));
    setErrors((prev) => ({ ...prev, departmentId: undefined, hostSelection: undefined }));
  };

  const onHostChange = (value: string) => {
    if (value === OTHER_HOST) {
      setForm((prev) => ({ ...prev, hostSelection: value, hostName: "", visitTime: "" }));
    } else {
      const host = directory?.hosts.find((h) => h.id === value);
      setForm((prev) => ({
        ...prev,
        hostSelection: value,
        hostName: host?.name ?? "",
        departmentId: host?.departmentId ?? prev.departmentId,
        // A different host has a different diary — make them re-pick a slot.
        visitTime: "",
      }));
    }
    setErrors((prev) => ({ ...prev, hostSelection: undefined, hostName: undefined }));
  };

  const hostRequired = form.purpose
    ? HOST_REQUIRED_PURPOSES.includes(form.purpose as VisitPurpose)
    : false;

  /**
   * Validates one step.
   *
   * Reports the shape of the failure as well as the fact of it: when the only
   * thing wrong is an Aadhaar number, the inline message under that field says
   * everything a generic toast would, so the caller can stay quiet.
   */
  const validateStep = (target: number): { ok: boolean; aadhaarOnly: boolean } => {
    const next: FieldErrors<keyof FormState> = {};
    let guestAadhaarOnly = false;

    if (target === 1) {
      next.fullName = validateName(form.fullName);
      next.mobile = validateMobile(form.mobile);
      next.email = validateEmail(form.email, true);
      if (!form.gender) next.gender = "Select a gender.";
      if (!form.visitorType) next.visitorType = "Select the type of visitor.";
      if (!form.idType) next.idType = "Select the ID proof you will carry.";
      next.idNumber = validateIdNumber(form.idNumber);
      next.address = validateText(form.address, "House address", 8, 300);
      if (form.emergencyContact.trim()) next.emergencyContact = validateMobile(form.emergencyContact);

      // Mandatory: security verification at the gate is a comparison between a
      // face and this photograph, so a booking without one is of no use.
      if (!form.photo) next.photo = PHOTO_MESSAGES.required;

      // The pass and every status update are sent to this number, so it is
      // validated as strictly as the mobile itself.
      if (!form.whatsappSameAsMobile) {
        const digits = form.whatsappNumber.replace(/[\s-]/g, "");
        if (!digits) next.whatsappNumber = "Enter the WhatsApp number for your pass.";
        else if (!/^\d{6,12}$/.test(digits)) next.whatsappNumber = "Enter a valid WhatsApp number.";
        if (!/^\+?\d{1,4}$/.test(form.whatsappCountryCode.trim())) {
          next.whatsappCountryCode = "Enter a valid country code, e.g. +91.";
        }
      }
    }

    if (target === 2) {
      if (!form.purpose) next.purpose = "Select the purpose of your visit.";
      next.purposeDetail = validateText(form.purposeDetail, "Purpose of visit", 10, 300);

      // A general campus visit needs no host: the booking goes to the front
      // desk. Only the purposes that are inherently a meeting require one.
      if (hostRequired) {
        if (!form.departmentId) next.departmentId = "Select a department.";
        if (!form.hostSelection) next.hostSelection = "Select the person you wish to meet.";
        if (form.hostSelection === OTHER_HOST) {
          next.hostSelection = "This purpose requires a specific member of staff.";
        }
      }

      next.visitDate = validateFutureDate(form.visitDate, "Preferred date");
      next.visitTime = validateTime(form.visitTime, "Preferred time");
      if (!form.expectedDuration) next.expectedDuration = "Select the expected duration.";
      next.numberOfVisitors = validateCount(Number(form.numberOfVisitors), 1, maxVisitors);
    }

    if (target === 3) {
      // Every accompanying visitor is validated here; the server re-checks the
      // whole party and the headcount before anything is written.
      const partyProblems: FieldErrors<GuestField>[] = form.guests.map((guest) => ({
        fullName: validateName(guest.fullName),
        mobile: validateMobile(guest.mobile),
        aadhaar: validateAadhaar(guest.aadhaar),
        relation: guest.relation ? undefined : "Select the relation to you.",
        address: validateText(guest.address, "House address", 8, 300),
      }));
      setGuestErrors(partyProblems);

      const aadhaarFailures = partyProblems.filter((problems) => problems.aadhaar).length;
      const otherGuestFailures = partyProblems.some(({ aadhaar: _aadhaar, ...rest }) =>
        Object.values(rest).some(Boolean),
      );

      if (aadhaarFailures > 0 && !otherGuestFailures) {
        // The field already says what is wrong; naming it again at step level
        // would repeat the same sentence twice on one screen.
        guestAadhaarOnly = true;
      } else if (otherGuestFailures || aadhaarFailures > 0) {
        next.guests = "Complete the details for every visitor.";
      }

      if (form.vehicleRequired === "yes")
        next.vehicleNumber = validateVehicleNumber(form.vehicleNumber);
      if (form.notes.trim().length > 500) next.notes = "Notes must be under 500 characters.";
      if (form.specialRequirements.trim().length > 300)
        next.specialRequirements = "Please keep this under 300 characters.";
    }

    const failed = Object.entries(next).filter(([, v]) => Boolean(v));
    setErrors((prev) => ({ ...prev, ...next }));
    return {
      ok: failed.length === 0 && !guestAadhaarOnly,
      aadhaarOnly: guestAadhaarOnly && failed.length === 0,
    };
  };

  const goTo = (target: number) => {
    setStep(target);
    // Move focus to the step heading so screen readers announce the change.
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };

  const handleNext = () => {
    const result = validateStep(step);
    if (!result.ok) {
      // A single bad Aadhaar is explained under the field itself; a generic
      // toast on top of it would say less, louder.
      if (!result.aadhaarOnly) toast.error("Please correct the highlighted fields.");
      focusFirstInvalidAadhaar();
      return;
    }
    goTo(Math.min(step + 1, LAST_STEP));
  };

  /** Puts the cursor on the first Aadhaar field that needs attention. */
  const focusFirstInvalidAadhaar = () => {
    window.requestAnimationFrame(() => {
      const index = form.guests.findIndex((guest) => validateAadhaar(guest.aadhaar));
      if (index < 0) return;
      document.getElementById(`guest-${index + 2}-aadhaar`)?.focus();
    });
  };

  const handleBack = () => goTo(Math.max(step - 1, 1));

  const handleSubmit = async () => {
    // Re-validate every step before creating the record.
    const outcomes = [1, 2, 3].map((s) => ({ step: s, ...validateStep(s) }));
    const firstBad = outcomes.find((outcome) => !outcome.ok);
    if (firstBad) {
      if (!firstBad.aadhaarOnly) {
        toast.error("Some details need attention. Please review the earlier steps.");
      }
      goTo(firstBad.step);
      if (firstBad.aadhaarOnly) focusFirstInvalidAadhaar();
      return;
    }

    const photo = form.photo;
    if (!photo) {
      // validateStep already reported this; guard the call path as well so the
      // request is never built without a photograph.
      setErrors((prev) => ({ ...prev, photo: PHOTO_MESSAGES.required }));
      goTo(1);
      return;
    }

    setSubmitting(true);
    try {
      /*
       * The photograph is stored first and the booking names the id that comes
       * back. Two calls rather than one multipart request, because it keeps the
       * booking endpoint taking JSON — and because a photograph that is going
       * to be rejected is rejected before any of the booking rules run.
       *
       * Re-uploaded on each attempt: an id is cheap, and reusing one across a
       * retry would depend on the previous attempt having got that far.
       */
      const receipt = photoIdRef.current
        ? { photoId: photoIdRef.current }
        : await api.uploadVisitorPhoto(photo.blob, `visitor-photo.${photo.source}.jpg`);
      photoIdRef.current = receipt.photoId;

      const record = await api.createPublicBooking({
        fullName: form.fullName.trim(),
        mobile: form.mobile.replace(/[\s-]/g, ""),
        email: form.email.trim(),
        gender: form.gender,
        organization: form.organization.trim(),
        address: form.address.trim(),
        emergencyContact: form.emergencyContact.replace(/[\s-]/g, ""),
        whatsappCountryCode: form.whatsappSameAsMobile
          ? "+91"
          : form.whatsappCountryCode.trim(),
        whatsappNumber: (form.whatsappSameAsMobile ? form.mobile : form.whatsappNumber).replace(
          /[\s-]/g,
          "",
        ),
        visitorType: form.visitorType,
        idType: form.idType,
        idNumber: form.idNumber.trim().toUpperCase(),
        photoId: receipt.photoId,
        purpose: form.purpose,
        purposeDetail: form.purposeDetail.trim(),
        hostId: form.hostSelection === OTHER_HOST ? null : form.hostSelection,
        departmentId: form.departmentId || null,
        visitDate: form.visitDate,
        visitTime: form.visitTime,
        expectedDuration: form.expectedDuration,
        numberOfVisitors: partySize,
        guests: form.guests.map((guest) => ({
          fullName: guest.fullName.trim(),
          mobile: guest.mobile.replace(/[\s-]/g, ""),
          aadhaar: normaliseAadhaar(guest.aadhaar),
          relation: guest.relation,
          address: guest.address.trim(),
        })),
        idempotencyKey: idempotencyKey.current,
        vehicleRequired: form.vehicleRequired === "yes",
        vehicleNumber:
          form.vehicleRequired === "yes" ? normaliseVehicleNumber(form.vehicleNumber) : undefined,
        notes: form.notes.trim() || undefined,
        specialRequirements: form.specialRequirements.trim() || undefined,
      });

      setCreated(record);
      goTo(CONFIRMATION);
      toast.success("Visit request submitted successfully.", {
        description: `Your booking ID is ${record.id}.`,
      });
    } catch (error) {
      // A 422 carries per-field messages; put the visitor on the step that owns
      // the first one so they can see exactly what to fix.
      const details = fieldErrors(error);
      const keys = Object.keys(details);
      if (keys.length) {
        const mapped: FieldErrors<keyof FormState> = {};
        for (const [key, text] of Object.entries(details)) {
          mapped[(SERVER_FIELD_ALIASES[key] ?? key) as keyof FormState] = text;
        }
        setErrors((prev) => ({ ...prev, ...mapped }));
        const target = Math.min(...keys.map((key) => FIELD_STEP[key] ?? LAST_STEP));
        goTo(target);
      }
      toast.error(errorMessage(error, "We could not submit your request. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  // Shown again on the review step so the visitor confirms the exact image
  // that will reach the gate, not just that they picked one.
  const photoPreview = useBlobPreview(form.photo?.blob);

  const departmentName =
    departments.find((d) => d.id === form.departmentId)?.name ?? form.departmentId;

  const draft = {
    fullName: form.fullName,
    mobile: form.mobile,
    email: form.email,
    organization: form.organization,
    visitorType: form.visitorType || undefined,
    idType: form.idType || undefined,
    idNumber: form.idNumber.trim().toUpperCase(),
    purpose: form.purpose || undefined,
    purposeDetail: form.purposeDetail,
    // Mirrors how the server names an unhosted booking, so the review step
    // shows the visitor what the record will actually say.
    hostName: form.hostName || (departmentName ? `${departmentName} Desk` : "Front Desk"),
    department: departmentName,
    visitDate: form.visitDate,
    visitTime: form.visitTime,
    expectedDuration: form.expectedDuration,
    numberOfVisitors: Number(form.numberOfVisitors) || 1,
    vehicleRequired: form.vehicleRequired === "yes",
    vehicleNumber: form.vehicleNumber ? normaliseVehicleNumber(form.vehicleNumber) : undefined,
    notes: form.notes,
  } as const;

  /* ---------------------------- Confirmation ----------------------------- */

  if (step === CONFIRMATION && created) {
    const trackHref = `${STATUS_PATH}?id=${created.id}&mobile=${encodeURIComponent(
      form.mobile.replace(/[\s-]/g, ""),
    )}`;

    return (
      <div className="mx-auto max-w-2xl animate-fade-in">
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full bg-success/12 text-success"
                aria-hidden
              >
                <Check className="h-7 w-7" strokeWidth={2.5} />
              </span>
              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold tracking-tight">Visit Request Submitted</h2>
                <p className="text-sm text-muted-foreground">
                  Thank you, {created.fullName}. Your visit request has been submitted
                  successfully and is now with {created.hostName} for review.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Booking Reference
              </p>
              <p className="mt-1 break-all font-mono text-2xl font-semibold tracking-tight text-primary-strong">
                {created.id}
              </p>

              <Separator className="my-4" />

              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Visit date</dt>
                  <dd className="flex items-center gap-1.5 text-sm font-medium">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    {formatDate(created.visitDate)}
                  </dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Visit time</dt>
                  <dd className="flex items-center gap-1.5 text-sm font-medium">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    {formatTime(created.visitTime)}
                  </dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Host</dt>
                  <dd className="text-sm font-medium">{created.hostName}</dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Department</dt>
                  <dd className="flex items-center gap-1.5 text-sm font-medium">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    {created.department}
                  </dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Visitor type</dt>
                  <dd className="text-sm font-medium">{form.visitorType || "—"}</dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Number of visitors</dt>
                  <dd className="flex items-center gap-1.5 text-sm font-medium">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    {created.numberOfVisitors}
                  </dd>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd>
                    <StatusBadge status={created.status as VisitStatus} />
                  </dd>
                </div>
              </dl>
            </div>

            {/* QR, downloads and WhatsApp delivery — the pass itself. */}
            <PassDeliveryCard
              bookingId={created.id}
              mobile={form.mobile.replace(/[\s-]/g, "")}
              passToken={created.passToken}
              campusName={created.campusName}
              caption={`${created.id} · ${formatDate(created.visitDate)}`}
            />

            <div
              role="note"
              className="flex gap-3 rounded-md border border-warning/30 bg-warning/10 p-3.5 text-sm"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" aria-hidden />
              <p className="text-foreground/80">
                Please keep your booking reference for future status checks. Your visit is
                confirmed for entry only once the request is approved — check the status with your
                reference and mobile number before you travel.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild variant="outline">
                <Link href={trackHref}>Check Booking Status</Link>
              </Button>
              <Button variant="ghost" onClick={() => router.push("/")}>
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ------------------------------ Wizard view ---------------------------- */

  return (
    <div className="mx-auto max-w-3xl">
      {/* Stepper */}
      <ol
        className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4"
        aria-label="Booking progress"
      >
        {steps.map((item) => {
          const state = item.id === step ? "current" : item.id < step ? "done" : "upcoming";
          return (
            <li key={item.id} className="min-w-0">
              <div
                className={cn(
                  "flex items-center gap-2 border-t-2 pt-3 transition-colors",
                  state === "current" && "border-primary",
                  state === "done" && "border-success",
                  state === "upcoming" && "border-border",
                )}
                aria-current={state === "current" ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    state === "current" && "bg-primary text-primary-foreground",
                    state === "done" && "bg-success text-success-foreground",
                    state === "upcoming" && "bg-muted text-muted-foreground",
                  )}
                >
                  {state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : item.id}
                </span>
                <span
                  className={cn(
                    "truncate text-xs font-medium",
                    state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {item.short}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <Card>
        <CardContent className="p-5 sm:p-7">
          <div
            ref={headingRef}
            tabIndex={-1}
            className="mb-6 space-y-1 outline-none"
            aria-live="polite"
          >
            <p className="section-label">
              Step {step} of {LAST_STEP}
            </p>
            <h2 className="text-lg font-semibold tracking-tight">{steps[step - 1]?.title}</h2>
          </div>

          {directoryError ? (
            <div
              role="alert"
              className="mb-5 rounded-md border border-destructive/30 bg-destructive/[0.08] p-3.5 text-sm"
            >
              {directoryError}
            </div>
          ) : null}

          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (step === LAST_STEP) void handleSubmit();
              else handleNext();
            }}
            className="space-y-5"
          >
            {/* -------------------- Step 1 · Visitor -------------------- */}
            {step === 1 && (
              <div className="grid gap-5 animate-fade-in sm:grid-cols-2">
                <FormField id="fullName" label="Full Name" required error={errors.fullName}>
                  <Input
                    value={form.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                    placeholder="e.g. Rajesh Kumar Gupta"
                    autoComplete="name"
                    invalid={Boolean(errors.fullName)}
                  />
                </FormField>

                <FormField
                  id="mobile"
                  label="WhatsApp Number"
                  required
                  error={errors.mobile}
                  hint="10-digit Indian mobile number — your visit pass is sent here"
                >
                  <Input
                    value={form.mobile}
                    onChange={(e) => set("mobile", e.target.value.replace(/[^\d\s-]/g, ""))}
                    placeholder="WhatsApp Number"
                    inputMode="numeric"
                    maxLength={13}
                    autoComplete="tel"
                    invalid={Boolean(errors.mobile)}
                  />
                </FormField>

                <div className="sm:col-span-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-success/12 text-success"
                        aria-hidden
                      >
                        <MessageCircle className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div>
                          <p className="text-sm font-medium">WhatsApp updates</p>
                          <p className="text-xs text-muted-foreground">
                            Your booking confirmation, visitor pass and entry updates are sent
                            here.
                          </p>
                        </div>

                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={form.whatsappSameAsMobile}
                            onCheckedChange={(checked) =>
                              set("whatsappSameAsMobile", checked === true)
                            }
                          />
                          <span>Use the same number as my mobile</span>
                        </label>

                        {!form.whatsappSameAsMobile ? (
                          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                            <FormField
                              id="whatsappCountryCode"
                              label="Country code"
                              required
                              error={errors.whatsappCountryCode}
                            >
                              <Input
                                value={form.whatsappCountryCode}
                                onChange={(e) => set("whatsappCountryCode", e.target.value)}
                                placeholder="+91"
                                inputMode="tel"
                                maxLength={5}
                                invalid={Boolean(errors.whatsappCountryCode)}
                              />
                            </FormField>

                            <FormField
                              id="whatsappNumber"
                              label="WhatsApp number"
                              required
                              error={errors.whatsappNumber}
                            >
                              <Input
                                value={form.whatsappNumber}
                                onChange={(e) =>
                                  set("whatsappNumber", e.target.value.replace(/[^\d\s-]/g, ""))
                                }
                                placeholder="9876500011"
                                inputMode="numeric"
                                maxLength={15}
                                invalid={Boolean(errors.whatsappNumber)}
                              />
                            </FormField>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <FormField id="email" label="Email" error={errors.email} hint="Optional">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    invalid={Boolean(errors.email)}
                  />
                </FormField>

                <FormField id="gender" label="Gender" required error={errors.gender}>
                  <Select
                    value={form.gender}
                    onValueChange={(value) => set("gender", value as Gender)}
                  >
                    <SelectTrigger invalid={Boolean(errors.gender)}>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((gender) => (
                        <SelectItem key={gender} value={gender}>
                          {gender}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField id="visitorType" label="Visitor Type" required error={errors.visitorType}>
                  <Select
                    value={form.visitorType}
                    onValueChange={(value) => set("visitorType", value as VisitorType)}
                  >
                    <SelectTrigger invalid={Boolean(errors.visitorType)}>
                      <SelectValue placeholder="Select visitor type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PUBLIC_VISITOR_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField id="idType" label="ID Type" required error={errors.idType}>
                  <Select
                    value={form.idType}
                    onValueChange={(value) => set("idType", value as IdProofType)}
                  >
                    <SelectTrigger invalid={Boolean(errors.idType)}>
                      <SelectValue placeholder="Select ID proof" />
                    </SelectTrigger>
                    <SelectContent>
                      {ID_PROOF_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  id="idNumber"
                  label="ID Number"
                  required
                  error={errors.idNumber}
                  hint="Carry this document with you to the gate."
                >
                  <Input
                    value={form.idNumber}
                    onChange={(e) => set("idNumber", e.target.value.toUpperCase())}
                    placeholder="e.g. ABCDE1234F"
                    className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
                    maxLength={20}
                    invalid={Boolean(errors.idNumber)}
                  />
                </FormField>

                <FormField
                  id="organization"
                  label="Organization"
                  error={errors.organization}
                  hint="Company, institution or “Parent”"
                >
                  <Input
                    value={form.organization}
                    onChange={(e) => set("organization", e.target.value)}
                    placeholder="e.g. North Tech Supplies"
                    autoComplete="organization"
                    invalid={Boolean(errors.organization)}
                  />
                </FormField>

                <FormField
                  id="emergencyContact"
                  label="Emergency Contact"
                  error={errors.emergencyContact}
                  hint="Optional — someone we can reach if needed."
                >
                  <Input
                    value={form.emergencyContact}
                    onChange={(e) =>
                      set("emergencyContact", e.target.value.replace(/[^\d\s-]/g, ""))
                    }
                    placeholder="9876500022"
                    inputMode="numeric"
                    maxLength={13}
                    invalid={Boolean(errors.emergencyContact)}
                  />
                </FormField>

                <FormField
                  id="address"
                  label="House Address"
                  required
                  error={errors.address}
                  hint="Street, area and city"
                  className="sm:col-span-2"
                >
                  <Textarea
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="City and state are enough."
                    maxLength={300}
                    invalid={Boolean(errors.address)}
                  />
                </FormField>

                <VisitorPhotoField
                  value={form.photo}
                  onChange={onPhotoChange}
                  error={errors.photo}
                  disabled={submitting}
                  className="sm:col-span-2"
                />
              </div>
            )}

            {/* ------- Step 2 · Visit details: purpose, host, schedule ------- */}
            {step === 2 && (
              <div className="grid gap-5 animate-fade-in sm:grid-cols-2">
                <p className="section-label sm:col-span-2">Purpose of your visit</p>

                <FormField
                  id="purpose"
                  label="Purpose of Visit"
                  required
                  error={errors.purpose}
                  className="sm:col-span-2"
                >
                  <Select
                    value={form.purpose}
                    onValueChange={(value) => set("purpose", value as VisitPurpose)}
                  >
                    <SelectTrigger invalid={Boolean(errors.purpose)}>
                      <SelectValue placeholder="Select purpose" />
                    </SelectTrigger>
                    <SelectContent>
                      {PUBLIC_VISIT_PURPOSES.map((purpose) => (
                        <SelectItem key={purpose} value={purpose}>
                          {purpose}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  id="purposeDetail"
                  label="Describe the purpose"
                  required
                  error={errors.purposeDetail}
                  hint="Helps the host approve your request faster."
                  className="sm:col-span-2"
                >
                  <Textarea
                    value={form.purposeDetail}
                    onChange={(e) => set("purposeDetail", e.target.value)}
                    placeholder="e.g. Parent–teacher meeting to discuss mid-semester progress."
                    maxLength={300}
                    invalid={Boolean(errors.purposeDetail)}
                  />
                </FormField>

                {hostRequired ? (
                  <div className="rounded-md border border-border bg-muted/40 p-3.5 text-sm text-muted-foreground sm:col-span-2">
                    This purpose needs a specific member of staff — choose them below.
                  </div>
                ) : null}
              </div>
            )}

            {/* Step 2 · who you are meeting */}
            {step === 2 && (
              <div className="grid gap-5 animate-fade-in sm:grid-cols-2">
                <p className="section-label sm:col-span-2">Who you wish to meet</p>

                {!directory ? (
                  <div className="sm:col-span-2">
                    <InlineLoader label="Loading campus directory…" />
                  </div>
                ) : null}

                <FormField
                  id="departmentId"
                  label="Department"
                  required={hostRequired}
                  error={errors.departmentId}
                  hint={
                    hostRequired
                      ? undefined
                      : "Optional — leave blank and the front desk will handle your visit."
                  }
                >
                  <Select value={form.departmentId} onValueChange={onDepartmentChange}>
                    <SelectTrigger invalid={Boolean(errors.departmentId)}>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  id="hostSelection"
                  label="Person to Meet"
                  required={hostRequired}
                  error={errors.hostSelection}
                  hint={form.departmentId ? undefined : "Choose a department first."}
                >
                  <Select
                    value={form.hostSelection}
                    onValueChange={onHostChange}
                    disabled={!form.departmentId}
                  >
                    <SelectTrigger invalid={Boolean(errors.hostSelection)}>
                      <SelectValue placeholder="Select host" />
                    </SelectTrigger>
                    <SelectContent>
                      {hosts.map((host) => (
                        <SelectItem key={host.id} value={host.id}>
                          {host.name} — {host.designation}
                        </SelectItem>
                      ))}
                      {!hostRequired ? (
                        <SelectItem value={OTHER_HOST}>Someone else / an office</SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                </FormField>

                {form.hostSelection === OTHER_HOST && (
                  <FormField
                    id="hostName"
                    label="Name of person or office"
                    error={errors.hostName}
                    hint="Optional — the request reaches the department desk either way."
                    className="sm:col-span-2"
                  >
                    <Input
                      value={form.hostName}
                      onChange={(e) => set("hostName", e.target.value)}
                      placeholder="e.g. Hostel & Welfare Office"
                      invalid={Boolean(errors.hostName)}
                    />
                  </FormField>
                )}

                {/* Availability of the selected host, straight from the directory. */}
                {hostId ? (
                  <div className="rounded-md border border-border bg-muted/40 p-4 sm:col-span-2">
                    {(() => {
                      const host = directory?.hosts.find((h) => h.id === hostId);
                      if (!host) return null;
                      return (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                          <span className="font-medium">{host.name}</span>
                          <span className="text-muted-foreground">{host.designation}</span>
                          <span className="text-muted-foreground">{host.department}</span>
                          <Badge
                            variant={host.available ? "success" : "muted"}
                            className="ml-auto"
                          >
                            {host.availabilityStatus}
                          </Badge>
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            )}

            {/* Step 2 · when you are coming */}
            {step === 2 && (
              <div className="grid gap-5 animate-fade-in sm:grid-cols-2">
                <p className="section-label sm:col-span-2">Date, time and party size</p>

                <FormField id="visitDate" label="Preferred Date" required error={errors.visitDate}>
                  <Input
                    type="date"
                    value={form.visitDate}
                    min={todayISO()}
                    max={todayISO(advanceDays)}
                    onChange={(e) => {
                      set("visitDate", e.target.value);
                      set("visitTime", "");
                    }}
                    invalid={Boolean(errors.visitDate)}
                  />
                </FormField>

                <FormField
                  id="numberOfVisitors"
                  label="Number of Visitors"
                  required
                  error={errors.numberOfVisitors}
                  hint={`Including yourself (maximum ${maxVisitors})`}
                >
                  <Input
                    type="number"
                    min={1}
                    max={maxVisitors}
                    value={form.numberOfVisitors}
                    onChange={(e) => set("numberOfVisitors", e.target.value)}
                    invalid={Boolean(errors.numberOfVisitors)}
                  />
                </FormField>

                <FormField
                  id="expectedDuration"
                  label="Expected Duration"
                  required
                  error={errors.expectedDuration}
                >
                  <Select
                    value={form.expectedDuration}
                    onValueChange={(value) => set("expectedDuration", value)}
                  >
                    <SelectTrigger invalid={Boolean(errors.expectedDuration)}>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((duration) => (
                        <SelectItem key={duration} value={duration}>
                          {duration}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <div className="sm:col-span-2">
                  <FormField
                    id="visitTime"
                    label="Preferred Time"
                    required
                    error={errors.visitTime}
                    hint={
                      directory
                        ? `Visiting hours ${directory.settings.visitingHoursFrom} – ${directory.settings.visitingHoursTo}. Times already taken are shown unavailable.`
                        : undefined
                    }
                  >
                    {slotsLoading ? (
                      <InlineLoader label="Checking availability…" />
                    ) : slots.length ? (
                      <div
                        role="radiogroup"
                        aria-label="Available times"
                        className="grid grid-cols-3 gap-2 sm:grid-cols-5"
                      >
                        {slots.map((slot) => {
                          const selected = form.visitTime === slot.time;
                          return (
                            <button
                              key={slot.time}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              disabled={!slot.available}
                              title={slot.reason}
                              onClick={() => set("visitTime", slot.time)}
                              className={cn(
                                "rounded-md border px-2 py-2 text-sm font-medium transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                selected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-card hover:border-primary/40",
                                !slot.available &&
                                  "cursor-not-allowed border-dashed text-muted-foreground opacity-50 hover:border-border",
                              )}
                            >
                              {formatTime(slot.time)}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <Input
                        type="time"
                        value={form.visitTime}
                        onChange={(e) => set("visitTime", e.target.value)}
                        invalid={Boolean(errors.visitTime)}
                      />
                    )}
                  </FormField>
                </div>
              </div>
            )}

            {/* ---- Step 3 · the accompanying party, one card per person ------ */}
            {step === 3 && guestCount > 0 && (
              <section aria-labelledby="party-heading" className="animate-fade-in space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 id="party-heading" className="section-label">
                    Visitors coming with you
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {guestCount} of {partySize} — you are visitor 1
                  </p>
                </div>

                {errors.guests ? (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.guests}
                  </p>
                ) : null}

                {form.guests.map((guest, index) => {
                  const problems = guestErrors[index] ?? {};
                  const number = index + 2;
                  return (
                    <fieldset
                      key={index}
                      className="rounded-lg border border-border bg-muted/60 p-4 sm:p-5"
                    >
                      <legend className="px-1 text-sm font-semibold">Visitor {number}</legend>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <FormField
                          id={`guest-${number}-name`}
                          label="Full Name"
                          required
                          error={problems.fullName}
                        >
                          <Input
                            value={guest.fullName}
                            onChange={(e) => setGuest(index, "fullName", e.target.value)}
                            placeholder="e.g. Sunita Gupta"
                            autoComplete="off"
                            invalid={Boolean(problems.fullName)}
                          />
                        </FormField>

                        <FormField
                          id={`guest-${number}-mobile`}
                          label="Mobile Number"
                          required
                          error={problems.mobile}
                        >
                          <Input
                            value={guest.mobile}
                            onChange={(e) =>
                              setGuest(index, "mobile", e.target.value.replace(/[^\d\s-]/g, ""))
                            }
                            placeholder="9876500011"
                            inputMode="numeric"
                            maxLength={13}
                            autoComplete="off"
                            invalid={Boolean(problems.mobile)}
                          />
                        </FormField>

                        <FormField
                          id={`guest-${number}-aadhaar`}
                          label="Aadhaar Card Number"
                          required
                          error={problems.aadhaar}
                          hint="Checked for format only — this is not an identity verification."
                        >
                          <Input
                            value={guest.aadhaar}
                            // Regrouped on every keystroke and on paste, so a
                            // bare or a spaced number both land as XXXX XXXX XXXX.
                            // Only the digits are ever submitted.
                            onChange={(e) => setGuest(index, "aadhaar", formatAadhaar(e.target.value))}
                            placeholder="1234 5678 9012"
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={14}
                            className="font-mono"
                            invalid={Boolean(problems.aadhaar)}
                          />
                        </FormField>

                        <FormField
                          id={`guest-${number}-relation`}
                          label="Relation with Primary Visitor"
                          required
                          error={problems.relation}
                        >
                          <Select
                            value={guest.relation}
                            onValueChange={(value) => setGuest(index, "relation", value)}
                          >
                            <SelectTrigger invalid={Boolean(problems.relation)}>
                              <SelectValue placeholder="Select relation" />
                            </SelectTrigger>
                            <SelectContent>
                              {GUEST_RELATIONS.map((relation) => (
                                <SelectItem key={relation} value={relation}>
                                  {relation}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormField>

                        <FormField
                          id={`guest-${number}-address`}
                          label="House Address"
                          required
                          error={problems.address}
                          className="sm:col-span-2"
                        >
                          <Textarea
                            value={guest.address}
                            onChange={(e) => setGuest(index, "address", e.target.value)}
                            placeholder="Street, area and city"
                            maxLength={300}
                            rows={2}
                            invalid={Boolean(problems.address)}
                          />
                        </FormField>
                      </div>
                    </fieldset>
                  );
                })}

                <p className="flex items-start gap-2 rounded-md border border-border bg-card p-3.5 text-xs leading-relaxed text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                  Aadhaar numbers are used only to register your party at the gate. They are sent
                  once over an encrypted connection, stored protected, and shown to staff only as
                  the last four digits.
                </p>
              </section>
            )}

            {/* --------------- Step 3 · Additional information ---------------- */}
            {step === 3 && (
              <div className="grid gap-5 animate-fade-in sm:grid-cols-2">
                <FormField id="vehicleRequired" label="Bringing a vehicle?" required>
                  <Select
                    value={form.vehicleRequired}
                    onValueChange={(value) => set("vehicleRequired", value as "yes" | "no")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                {form.vehicleRequired === "yes" && (
                  <FormField
                    id="vehicleNumber"
                    label="Vehicle Number"
                    required
                    error={errors.vehicleNumber}
                    hint="Format: UK07AB1234"
                    className="sm:col-span-2"
                  >
                    <Input
                      value={form.vehicleNumber}
                      onChange={(e) => set("vehicleNumber", e.target.value.toUpperCase())}
                      placeholder="UK07AB1234"
                      className="font-mono uppercase"
                      maxLength={13}
                      invalid={Boolean(errors.vehicleNumber)}
                    />
                  </FormField>
                )}

                <FormField
                  id="notes"
                  label="Message"
                  error={errors.notes}
                  hint="Optional — anything the host or security desk should know."
                  className="sm:col-span-2"
                >
                  <Textarea
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder="e.g. Carrying a laptop and projector for the session."
                    maxLength={500}
                    invalid={Boolean(errors.notes)}
                  />
                </FormField>

                <FormField
                  id="specialRequirements"
                  label="Special Requirements"
                  error={errors.specialRequirements}
                  hint="Optional — accessibility needs, assistance at the gate, etc."
                  className="sm:col-span-2"
                >
                  <Textarea
                    value={form.specialRequirements}
                    onChange={(e) => set("specialRequirements", e.target.value)}
                    placeholder="e.g. Wheelchair access required."
                    maxLength={300}
                    invalid={Boolean(errors.specialRequirements)}
                  />
                </FormField>
              </div>
            )}

            {/* ------------------ Step 6 · Review ----------------------- */}
            {step === LAST_STEP && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Please check your details before submitting.
                  </p>
                  <Badge variant="warning">
                    <Clock aria-hidden />
                    Will be submitted as Pending
                  </Badge>
                </div>

                <section
                  aria-labelledby="review-photo"
                  className="flex items-center gap-4 rounded-lg border border-border bg-card p-5"
                >
                  <div className="h-24 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {photoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a blob: URL is not routable through next/image
                      <img
                        src={photoPreview}
                        alt="Your visitor photo"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <User className="h-7 w-7 opacity-40" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h3 id="review-photo" className="section-label">
                      Visitor photo
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {form.photo
                        ? "Security staff will compare this photo with you at the gate."
                        : "A photo is required before you can submit this request."}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => goTo(1)}
                    >
                      {form.photo ? "Change photo" : "Add photo"}
                    </Button>
                  </div>
                </section>

                <BookingSummary data={draft} />

                {form.guests.length > 0 ? (
                  <section
                    aria-labelledby="review-party"
                    className="rounded-lg border border-border bg-card p-5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 id="review-party" className="section-label">
                        Accompanying visitors
                      </h3>
                      <p className="text-xs text-muted-foreground">Total visitors: {partySize}</p>
                    </div>

                    <ul className="mt-4 space-y-3">
                      {form.guests.map((guest, index) => (
                        <li
                          key={index}
                          className="rounded-md border border-border bg-muted/50 p-3.5"
                        >
                          <p className="text-sm font-medium">
                            Visitor {index + 2} · {guest.fullName || "—"}
                          </p>
                          <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                            <div className="flex gap-1.5">
                              <dt>Mobile:</dt>
                              <dd className="font-medium text-foreground">{guest.mobile || "—"}</dd>
                            </div>
                            <div className="flex gap-1.5">
                              <dt>Relation:</dt>
                              <dd className="font-medium text-foreground">
                                {guest.relation || "—"}
                              </dd>
                            </div>
                            <div className="flex gap-1.5">
                              <dt>Aadhaar:</dt>
                              {/* Masked even here — the full number is never
                                  rendered back to the screen. */}
                              <dd className="font-mono font-medium text-foreground">
                                {maskAadhaar(normaliseAadhaar(guest.aadhaar).slice(-4))}
                              </dd>
                            </div>
                            <div className="flex gap-1.5 sm:col-span-2">
                              <dt>Address:</dt>
                              <dd className="font-medium text-foreground">
                                {guest.address || "—"}
                              </dd>
                            </div>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {steps.slice(0, LAST_STEP - 1).map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => goTo(s.id)}
                    >
                      Edit {s.short.toLowerCase()}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* ------------------------- Navigation --------------------- */}
            <Separator />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={step === 1 ? () => router.push("/") : handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
                {step === 1 ? "Back to home" : "Previous"}
              </Button>

              {step < LAST_STEP ? (
                <Button type="submit">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" loading={submitting} size="lg">
                  <Send className="h-4 w-4" />
                  Submit Visit Request
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
