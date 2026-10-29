"use client";

import * as React from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Calendar,
  Car,
  Clock,
  Download,
  ExternalLink,
  Mail,
  MessageSquare,
  Phone,
  QrCode,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Tag,
  User,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { FormField } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { PassQR, buildPassPayload, downloadQrAsImage } from "@/components/shared/pass-qr";
import {
  VisitorPhotoField,
  type VisitorPhoto,
} from "@/components/visitor/visitor-photo-field";
import {
  api,
  errorMessage,
  type PublicBookingView,
} from "@/lib/api";
import type { VisitStatus } from "@/lib/types";
import { cn, formatDate, todayInCampusTz } from "@/lib/utils";
import {
  normaliseVehicleNumber,
  validateDepartureTime,
  validateEmail,
  validateMobile,
  validateName,
  validateVehicleNumber,
  validateVisitDate,
  validateVisitTime,
  type FieldErrors,
} from "@/lib/validation";

const VISITOR_CATEGORIES = [
  "Prospective Student",
  "Parent/Guardian",
  "Academic Visitor",
  "Researcher",
  "Institutional Delegate",
  "Alumni",
  "Guest",
  "Vendor",
  "Official",
  "Other",
] as const;

const VEHICLE_TYPES = [
  "Car",
  "Two Wheeler",
  "Auto/Taxi",
  "Bus",
  "Goods Vehicle",
  "Other",
] as const;

interface FormState {
  // Section A: Personal Information
  fullName: string;
  mobileNumber: string;
  email: string;
  visitorCategory: string;
  otherCategory: string;
  hostId: string;
  purpose: string;

  // Section B: Visit Schedule
  visitDate: string;
  arrivalTime: string;
  departureTime: string;

  // Section C: Security Information
  photo: VisitorPhoto | null;
  vehicleRequired: "yes" | "no";
  vehicleType: string;
  vehicleNumber: string;

  // Section D: Consent
  consent: boolean;
}

const initialState: FormState = {
  fullName: "",
  mobileNumber: "",
  email: "",
  visitorCategory: "Guest",
  otherCategory: "",
  hostId: "",
  purpose: "Faculty Meeting",
  visitDate: "",
  arrivalTime: "10:00",
  departureTime: "",
  photo: null,
  vehicleRequired: "no",
  vehicleType: "Car",
  vehicleNumber: "",
  consent: false,
};

type WizardStage = "form" | "submitting" | "success" | "failed";

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function BookingWizard() {
  const [form, setForm] = React.useState<FormState>(initialState);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [stage, setStage] = React.useState<WizardStage>("form");
  const [submitStep, setSubmitStep] = React.useState<string>("Uploading visitor photograph...");
  const [failedMessage, setFailedMessage] = React.useState<string>("");
  const [created, setCreated] = React.useState<PublicBookingView | null>(null);
  const [isDownloadingQr, setIsDownloadingQr] = React.useState<boolean>(false);
  const [hosts, setHosts] = React.useState<Array<{ id: string; name: string; department: string; designation: string }>>([]);

  React.useEffect(() => {
    api.directory()
      .then((data) => {
        if (data && Array.isArray(data.hosts)) {
          setHosts(data.hosts.map((h: any) => ({
            id: h.id,
            name: h.name,
            department: h.department || "",
            designation: h.designation || "Faculty",
          })));
        }
      })
      .catch((err) => {
        console.warn("Could not load hosts directory:", err);
      });
  }, []);

  const idempotencyKeyRef = React.useRef(newIdempotencyKey());

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

    // Section A: Personal Information
    const nameErr = validateName(form.fullName);
    if (nameErr) nextErrors.fullName = nameErr;

    const mobileErr = validateMobile(form.mobileNumber);
    if (mobileErr) nextErrors.mobileNumber = mobileErr;

    if (form.email.trim()) {
      const emailErr = validateEmail(form.email, true);
      if (emailErr) nextErrors.email = emailErr;
    }

    if (!form.visitorCategory) {
      nextErrors.visitorCategory = "Please select a visitor category.";
    } else if (form.visitorCategory === "Other" && !form.otherCategory.trim()) {
      nextErrors.otherCategory = "Please specify your visitor category.";
    }

    // Section B: Visit Schedule
    const dateErr = validateVisitDate(form.visitDate);
    if (dateErr) nextErrors.visitDate = dateErr;

    const timeErr = validateVisitTime(form.visitDate, form.arrivalTime);
    if (timeErr) nextErrors.arrivalTime = timeErr;

    if (form.departureTime) {
      const depErr = validateDepartureTime(form.arrivalTime, form.departureTime);
      if (depErr) nextErrors.departureTime = depErr;
    }

    // Section C: Security Information
    if (!form.photo) {
      nextErrors.photo = "A photograph is required for campus entry authorization.";
    }

    if (form.vehicleRequired === "yes") {
      if (!form.vehicleType) {
        nextErrors.vehicleType = "Please select a vehicle type.";
      }
      const vehErr = validateVehicleNumber(form.vehicleNumber);
      if (vehErr) nextErrors.vehicleNumber = vehErr;
    }

    // Section D: Consent
    if (!form.consent) {
      nextErrors.consent = "You must confirm the security declaration before submitting.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stage === "submitting") return;

    if (!validateForm()) {
      toast.error("Please correct the errors in the form before submitting.");
      return;
    }

    setStage("submitting");
    setSubmitStep("Processing visitor photograph...");
    setFailedMessage("");

    try {
      let uploadedPhotoId: string | null = null;
      if (form.photo?.blob) {
        const photoRes = await api.uploadVisitorPhoto(form.photo.blob);
        uploadedPhotoId = photoRes.photoId;
      }

      if (!uploadedPhotoId) {
        throw new Error("Unable to process visitor photograph. Please try again.");
      }

      setSubmitStep("Validating visit schedule and issuing entry QR pass...");

      const effectiveCategory =
        form.visitorCategory === "Other"
          ? form.otherCategory.trim()
            ? `Other: ${form.otherCategory.trim()}`
            : "Other"
          : form.visitorCategory;

      const payload = {
        fullName: form.fullName.trim(),
        mobileNumber: form.mobileNumber.replace(/[\s-]/g, ""),
        email: form.email.trim() || undefined,
        visitorType: effectiveCategory,
        visitDate: form.visitDate,
        visitTime: form.arrivalTime,
        expectedDepartureTime: form.departureTime.trim() || undefined,
        photoId: uploadedPhotoId,
        vehicleRequired: form.vehicleRequired === "yes",
        hasCar: form.vehicleRequired === "yes",
        vehicleType: form.vehicleRequired === "yes" ? form.vehicleType : undefined,
        vehicleNumber:
          form.vehicleRequired === "yes"
            ? normaliseVehicleNumber(form.vehicleNumber)
            : undefined,
        carNumber:
          form.vehicleRequired === "yes"
            ? normaliseVehicleNumber(form.vehicleNumber)
            : undefined,
        hostId: form.hostId ? form.hostId.trim() : undefined,
        purpose: form.purpose ? form.purpose.trim() : "Faculty Meeting",
        idempotencyKey: idempotencyKeyRef.current,
      };

      const res = await api.createPublicBooking(payload as unknown as Record<string, unknown>);
      setCreated(res);
      idempotencyKeyRef.current = newIdempotencyKey();
      setStage("success");
      if (res.status === "Pending" || !res.passToken) {
        toast.success("Visitor request submitted! Awaiting faculty approval via WhatsApp.");
      } else {
        toast.success("Visitor registered and secure QR pass generated!");
      }
    } catch (err) {
      setStage("failed");
      const msg = errorMessage(
        err,
        "Unable to register visitor. Please check your network and try again.",
      );
      setFailedMessage(msg);
      toast.error(msg);
    }
  };

  const handleDownloadQr = async () => {
    if (!created) return;
    setIsDownloadingQr(true);
    try {
      await downloadQrAsImage("visitor-entry-qr", `dsvv-entry-qr-${created.id}.png`);
      toast.success("QR Code downloaded successfully.");
    } catch {
      toast.error("Could not download QR code image. Please take a screenshot.");
    } finally {
      setIsDownloadingQr(false);
    }
  };

  const handleWhatsAppShare = () => {
    if (!created) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const passUrl = `${origin}/visitor/pass/${encodeURIComponent(
      created.passToken || created.id,
    )}?mobile=${encodeURIComponent(created.mobileNumber || created.mobile || form.mobileNumber)}`;
    const text = [
      `🏛️ *${created.campusName || "Dev Sanskriti Vishwavidyalaya"} — Visitor Entry Pass*`,
      "",
      `👤 Visitor: *${created.fullName}*`,
      `🔖 Reference: *${created.id}*`,
      `📅 Visit Date: ${created.visitDate || form.visitDate} (${created.visitTime || form.arrivalTime})`,
      `🚪 Pass Status: *${(created.status || "APPROVED").toUpperCase()}*`,
      "",
      `📲 *Digital Pass & QR Code Link:*`,
      passUrl,
      "",
      "⚠️ *Important:* Present this QR code to the security guard at the gate for entry verification.",
    ].join("\n");

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  // =========================================================================
  // VIEW: Submitting / Loading Screen
  // =========================================================================
  if (stage === "submitting") {
    return (
      <Card className="mx-auto max-w-xl border-primary/20 shadow-lg">
        <CardContent className="p-8 text-center sm:p-10">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>

          <div className="mt-6 space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Processing Registration
            </span>

            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Registering Visitor
            </h2>

            <p className="text-sm font-medium text-foreground transition-all duration-300">
              {submitStep}
            </p>

            <p className="pt-2 text-xs text-muted-foreground">
              Please keep this page open while we verify your details and generate your secure entry pass.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // =========================================================================
  // VIEW: Success Screen (Approved Entry QR Code)
  // =========================================================================
  if (stage === "success" && created) {
    const passToken = created.passToken;

    return (
      <Card className="mx-auto max-w-2xl border-emerald-500/30 bg-emerald-50/15 shadow-lg dark:bg-emerald-950/10">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <BadgeCheck className="h-10 w-10" />
            </div>

            <h2 className="mt-4 text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
              Registration Successful
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Booking Reference:{" "}
              <span className="font-mono font-semibold text-foreground">{created.id}</span>
            </p>

            {/* If Visit is Pending Faculty Approval: Show clear notification status, DO NOT show QR pass */}
            {!passToken || created.status === "Pending" ? (
              <div className="mt-6 w-full rounded-xl border border-amber-500/30 bg-amber-50/50 p-6 shadow-sm dark:bg-amber-950/20 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  <Clock className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-base font-semibold text-amber-900 dark:text-amber-200">
                  Request Submitted — Awaiting Faculty Approval
                </h3>
                <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-300 max-w-md mx-auto">
                  A WhatsApp approval notification has been dispatched to <strong>{created.hostName || "the requested faculty member"}</strong>.
                  Your digital entry QR pass will be issued once the visit is accepted.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  Status: Pending Decision
                </div>
              </div>
            ) : (
              /* Active Entry QR Code for Approved Visits */
              <div className="mt-6 w-full rounded-xl border border-emerald-500/30 bg-card p-6 shadow-sm">
                <div className="flex flex-col items-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <QrCode className="h-3.5 w-3.5" />
                    Authorized Campus Entry Pass
                  </span>

                  <div className="my-4 rounded-lg bg-white p-3 shadow-inner">
                    <PassQR
                      id="visitor-entry-qr"
                      value={buildPassPayload(created.id, passToken)}
                      size={200}
                      label={created.id}
                    />
                  </div>

                  <p className="max-w-md text-xs text-muted-foreground">
                    Present this QR code to the security guard at the gate for check-in verification.
                  </p>

                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleDownloadQr}
                      disabled={isDownloadingQr}
                      className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600"
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      {isDownloadingQr ? "Saving..." : "Download QR Pass"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleWhatsAppShare}
                      className="border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                    >
                      <MessageSquare className="mr-1.5 h-4 w-4 text-[#25D366]" />
                      Share via WhatsApp
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Registration Summary Card */}
            <div className="mt-6 w-full rounded-xl border border-border bg-card p-5 text-left shadow-xs">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Registration Summary
              </h3>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Visitor Name</span>
                  <p className="font-medium text-foreground">{created.fullName}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Mobile Number</span>
                  <p className="font-mono font-medium text-foreground">
                    {created.mobileNumber || created.mobile || form.mobileNumber}
                  </p>
                </div>
                {form.email && (
                  <div>
                    <span className="text-xs text-muted-foreground">Email Address</span>
                    <p className="font-medium text-foreground">{form.email}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-muted-foreground">Visitor Category</span>
                  <p className="font-medium text-foreground">{created.visitorType || form.visitorCategory}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Visit Date & Arrival Time</span>
                  <p className="font-medium text-foreground">
                    {formatDate(created.visitDate || form.visitDate)} at {created.visitTime || form.arrivalTime}
                  </p>
                </div>
                {form.departureTime && (
                  <div>
                    <span className="text-xs text-muted-foreground">Expected Departure Time</span>
                    <p className="font-medium text-foreground">{form.departureTime}</p>
                  </div>
                )}
                {form.vehicleRequired === "yes" && (
                  <div>
                    <span className="text-xs text-muted-foreground">Vehicle Details</span>
                    <p className="font-mono font-medium text-foreground">
                      {form.vehicleType} • {normaliseVehicleNumber(form.vehicleNumber)}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-muted-foreground">Pass Status</span>
                  <div className="mt-0.5">
                    <StatusBadge status={(created.status as VisitStatus) || "Approved"} />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Links */}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setStage("form");
                  setForm(initialState);
                  setCreated(null);
                }}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Register Another Visitor
              </Button>
              {passToken && (
                <Button asChild>
                  <Link
                    href={`/visitor/pass/${encodeURIComponent(passToken)}?mobile=${encodeURIComponent(
                      created.mobileNumber || created.mobile || form.mobileNumber,
                    )}`}
                  >
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    View Full Digital Pass
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // =========================================================================
  // VIEW: Failed Submission Screen
  // =========================================================================
  if (stage === "failed") {
    return (
      <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/5 shadow-md">
        <CardContent className="p-6 text-center sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="h-10 w-10" />
          </div>

          <h2 className="mt-4 text-2xl font-bold tracking-tight text-destructive">
            Registration Could Not Be Completed
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {failedMessage || "An error occurred while communicating with the campus verification server."}
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <Button
              onClick={() => {
                setStage("form");
              }}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // =========================================================================
  // VIEW: Visitor Registration Form (Sections A, B, C, D)
  // =========================================================================
  const campusToday = todayInCampusTz();

  return (
    <Card className="mx-auto max-w-2xl shadow-sm">
      <CardContent className="p-6 sm:p-8">
        {/* Form Title & Context */}
        <div className="mb-8 border-b border-border pb-5">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
            <ShieldCheck className="h-4 w-4" />
            Campus Gate Security Management System
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl text-foreground">
            Visitor Registration Form
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete the sections below to register your visit and obtain an instant gate entry QR pass.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* ================================================================= */}
          {/* SECTION A — Personal Information */}
          {/* ================================================================= */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                A
              </span>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
                <User className="h-4 w-4 text-muted-foreground" />
                Personal Information
              </h2>
            </div>

            <div className="space-y-4 pt-1">
              {/* Full Name */}
              <FormField
                id="fullName"
                label="Full Name"
                required
                error={errors.fullName}
                hint="Enter your complete legal name as shown on your official ID."
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
                    autoComplete="name"
                  />
                </div>
              </FormField>

              {/* Mobile Number */}
              <FormField
                id="mobileNumber"
                label="Mobile Number"
                required
                error={errors.mobileNumber}
                hint="10-digit Indian mobile number for communication and QR pass access."
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
                    onChange={(e) =>
                      update("mobileNumber", e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    autoComplete="tel"
                  />
                </div>
              </FormField>

              {/* Email Address (Optional) */}
              <FormField
                id="email"
                label="Email Address"
                error={errors.email}
                hint="Optional — provide an email to receive visit confirmation and digital pass copies."
              >
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                  <Input
                    id="email"
                    type="email"
                    placeholder="visitor@example.com"
                    className="pl-9"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </FormField>

              {/* Visitor Category */}
              <FormField
                id="visitorCategory"
                label="Visitor Category"
                required
                error={errors.visitorCategory}
                hint="Select the category that best describes your profile."
              >
                <div className="relative">
                  <Tag className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                  <select
                    id="visitorCategory"
                    value={form.visitorCategory}
                    onChange={(e) => update("visitorCategory", e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {VISITOR_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </FormField>

              {/* Conditional Other Category Input */}
              {form.visitorCategory === "Other" && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2">
                  <FormField
                    id="otherCategory"
                    label="Specify Category"
                    required
                    error={errors.otherCategory}
                    hint="Please describe your visitor category or affiliation."
                  >
                    <Input
                      id="otherCategory"
                      type="text"
                      placeholder="e.g. Media Representative, Conference Attendee, Service Provider"
                      value={form.otherCategory}
                      onChange={(e) => update("otherCategory", e.target.value)}
                    />
                  </FormField>
                </div>
              )}

              {/* Faculty Member / Host Selection Dropdown */}
              <FormField
                id="hostId"
                label="Meeting Faculty / Host"
                hint="Select the faculty member or staff you are visiting (required for faculty approvals)."
              >
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                  <select
                    id="hostId"
                    value={form.hostId}
                    onChange={(e) => update("hostId", e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">General Campus Visit (No specific faculty)</option>
                    {hosts.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} — {h.designation} ({h.department})
                      </option>
                    ))}
                  </select>
                </div>
              </FormField>

              {/* Purpose of Visit */}
              <FormField
                id="purpose"
                label="Purpose of Visit"
                required
                hint="State the official reason or department for your visit."
              >
                <div className="relative">
                  <Tag className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                  <Input
                    id="purpose"
                    type="text"
                    placeholder="e.g. Faculty Discussion, Academic Consultation, Campus Tour"
                    value={form.purpose}
                    onChange={(e) => update("purpose", e.target.value)}
                    className="pl-9"
                  />
                </div>
              </FormField>
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION B — Visit Schedule */}
          {/* ================================================================= */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                B
              </span>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Visit Schedule
              </h2>
            </div>

            <div className="space-y-4 pt-1">
              <div className="rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  Official campus visiting hours are <strong>09:00 AM to 05:00 PM</strong> (Asia/Kolkata timezone). Same-day visits must specify a future time.
                </span>
              </div>

              {/* Visit Date */}
              <FormField
                id="visitDate"
                label="Visit Date"
                required
                error={errors.visitDate}
                hint="Select today or an upcoming date within the next 90 days."
              >
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                  <Input
                    id="visitDate"
                    type="date"
                    min={campusToday}
                    value={form.visitDate}
                    onChange={(e) => update("visitDate", e.target.value)}
                    className="pl-9 font-sans"
                  />
                </div>
              </FormField>

              {/* Arrival and Departure Times */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Expected Arrival Time */}
                <FormField
                  id="arrivalTime"
                  label="Expected Arrival Time"
                  required
                  error={errors.arrivalTime}
                  hint="Between 09:00 and 17:00 IST."
                >
                  <div className="relative">
                    <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                    <Input
                      id="arrivalTime"
                      type="time"
                      value={form.arrivalTime}
                      onChange={(e) => update("arrivalTime", e.target.value)}
                      className="pl-9 font-mono"
                    />
                  </div>
                </FormField>

                {/* Expected Departure Time */}
                <FormField
                  id="departureTime"
                  label="Expected Departure Time"
                  error={errors.departureTime}
                  hint="Optional — estimated departure time."
                >
                  <div className="relative">
                    <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                    <Input
                      id="departureTime"
                      type="time"
                      value={form.departureTime}
                      onChange={(e) => update("departureTime", e.target.value)}
                      className="pl-9 font-mono"
                    />
                  </div>
                </FormField>
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION C — Security Information */}
          {/* ================================================================= */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                C
              </span>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Security Information
              </h2>
            </div>

            <div className="space-y-4 pt-1">
              {/* Visitor Photograph */}
              <FormField
                id="photo"
                label="Visitor Photograph"
                required
                error={errors.photo}
                hint="Campus security policy requires a recent, clear, front-facing facial photo (webcam snapshot or image upload, JPG/PNG up to 5MB)."
              >
                <VisitorPhotoField
                  value={form.photo}
                  onChange={(photo) => update("photo", photo)}
                  error={errors.photo}
                />
              </FormField>

              {/* Vehicle Required */}
              <FormField
                id="vehicleRequired"
                label="Vehicle Required?"
                required
                hint="Are you bringing a vehicle inside the campus premises?"
              >
                <div className="flex gap-4 pt-1">
                  <label
                    className={cn(
                      "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 font-medium transition-colors text-sm",
                      form.vehicleRequired === "yes"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-input hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name="vehicleRequired"
                      value="yes"
                      checked={form.vehicleRequired === "yes"}
                      onChange={() => update("vehicleRequired", "yes")}
                      className="sr-only"
                    />
                    <Car className="h-4 w-4" />
                    Yes (Entering with Vehicle)
                  </label>

                  <label
                    className={cn(
                      "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 font-medium transition-colors text-sm",
                      form.vehicleRequired === "no"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-input hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name="vehicleRequired"
                      value="no"
                      checked={form.vehicleRequired === "no"}
                      onChange={() => {
                        update("vehicleRequired", "no");
                        update("vehicleNumber", "");
                      }}
                      className="sr-only"
                    />
                    <User className="h-4 w-4" />
                    No (Pedestrian Entry)
                  </label>
                </div>
              </FormField>

              {/* Conditional Vehicle Details */}
              {form.vehicleRequired === "yes" && (
                <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Vehicle Type */}
                    <FormField
                      id="vehicleType"
                      label="Vehicle Type"
                      required
                      error={errors.vehicleType}
                      hint="Select your vehicle category."
                    >
                      <div className="relative">
                        <Car className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                        <select
                          id="vehicleType"
                          value={form.vehicleType}
                          onChange={(e) => update("vehicleType", e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {VEHICLE_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                    </FormField>

                    {/* Vehicle Registration Number */}
                    <FormField
                      id="vehicleNumber"
                      label="Vehicle Registration Number"
                      required
                      error={errors.vehicleNumber}
                      hint="Official Indian format, e.g. UK07AB1234."
                    >
                      <div className="relative">
                        <Car className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                        <Input
                          id="vehicleNumber"
                          type="text"
                          placeholder="UK07AB1234"
                          className="pl-9 font-mono uppercase"
                          value={form.vehicleNumber}
                          onChange={(e) => update("vehicleNumber", e.target.value.toUpperCase())}
                        />
                      </div>
                    </FormField>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION D — Consent and Submission */}
          {/* ================================================================= */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                D
              </span>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                Consent & Submission
              </h2>
            </div>

            <div className="space-y-4 pt-1">
              {/* Required Consent Checkbox */}
              <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    id="consentCheckbox"
                    checked={form.consent}
                    onChange={(e) => update("consent", e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="text-xs sm:text-sm text-foreground leading-relaxed">
                    I confirm that the details provided are accurate and authentic. I agree to abide by the visitor guidelines, security protocols, and code of conduct of Dev Sanskriti Vishwavidyalaya, Haridwar.
                  </span>
                </label>
                {errors.consent && (
                  <p className="mt-2 text-xs font-medium text-destructive">{errors.consent}</p>
                )}
              </div>

              {/* Submit Registration & Generate QR button */}
              <Button
                type="submit"
                className="w-full py-6 text-base font-semibold shadow-md"
              >
                <span className="flex items-center justify-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Submit Registration & Generate QR
                </span>
              </Button>
            </div>
          </section>
        </form>
      </CardContent>
    </Card>
  );
}
