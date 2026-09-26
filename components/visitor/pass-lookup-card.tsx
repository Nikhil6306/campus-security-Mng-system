"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { BOOKING_REF_HINT, BOOKING_REF_PATTERN } from "@/lib/types";
import { validateMobile, type FieldErrors } from "@/lib/validation";

type Fields = "bookingId" | "mobile";

/**
 * Opens a visitor pass from a booking reference plus the mobile number it was
 * booked with. Both are needed because the pass itself is personal — the server
 * will not disclose a booking on a reference alone. The shape of each field is
 * checked here purely so an obvious typo is caught before the round trip.
 */
export function PassLookupCard() {
  const router = useRouter();
  const [bookingId, setBookingId] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const [errors, setErrors] = React.useState<FieldErrors<Fields>>({});

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const id = bookingId.trim().toUpperCase();

    const next: FieldErrors<Fields> = {};
    if (!id) next.bookingId = "Enter the booking ID printed on your confirmation.";
    else if (!BOOKING_REF_PATTERN.test(id))
      next.bookingId = `Booking IDs look like ${BOOKING_REF_HINT}.`;
    next.mobile = validateMobile(mobile);

    setErrors(next);
    if (next.bookingId || next.mobile) return;

    router.push(
      `/visitor/pass/${encodeURIComponent(id)}?mobile=${encodeURIComponent(
        mobile.replace(/[\s-]/g, ""),
      )}`,
    );
  };

  return (
    <Card className="group flex flex-col transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-4 p-6">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-md bg-success/12 text-success transition-colors group-hover:bg-success group-hover:text-success-foreground"
          aria-hidden
        >
          <QrCode className="h-5 w-5" />
        </span>
        <div className="flex-1 space-y-1.5">
          <h3 className="text-lg font-semibold">My Visitor Pass</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Already booked? Open your pass to show or print it at the gate.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <FormField id="pass-booking-id" label="Booking ID" error={errors.bookingId}>
            <Input
              value={bookingId}
              onChange={(event) => {
                setBookingId(event.target.value);
                setErrors((p) => ({ ...p, bookingId: undefined }));
              }}
              placeholder={BOOKING_REF_HINT}
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
              invalid={Boolean(errors.bookingId)}
            />
          </FormField>

          <FormField id="pass-lookup-mobile" label="Mobile number" error={errors.mobile}>
            <Input
              value={mobile}
              onChange={(event) => {
                setMobile(event.target.value.replace(/[^\d\s-]/g, ""));
                setErrors((p) => ({ ...p, mobile: undefined }));
              }}
              placeholder="9876500011"
              inputMode="numeric"
              maxLength={13}
              autoComplete="tel"
              invalid={Boolean(errors.mobile)}
            />
          </FormField>

          <Button type="submit" variant="outline" className="w-full">
            Open pass
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
