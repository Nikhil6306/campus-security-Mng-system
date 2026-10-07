import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  ExternalLink,
  ShieldCheck,
  Car,
  FileText,
  Users,
  Lock,
  PhoneCall,
  Building2,
  AlertTriangle,
  Compass,
  Shield,
  CheckCircle2,
  Sparkles,
  Phone,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingWizard } from "@/components/visitor/booking-wizard";
import { UNIVERSITY, CONTACT } from "@/lib/dsvv";

export const metadata: Metadata = {
  title: { absolute: `${UNIVERSITY.name} | Campus Security Management System` },
  description:
    "Official Campus Security Management System for Dev Sanskriti Vishwavidyalaya, Haridwar. Secure digital visitor registration, vehicle monitoring, 360° virtual tour and security guidelines.",
  alternates: { canonical: "/" },
  openGraph: {
    title: `${UNIVERSITY.name} | Campus Security Management System`,
    description:
      "A secure and efficient digital platform for managing campus visitors, vehicle entries and security records.",
    url: "/",
    images: [{ url: "/images/campus/college-entrance.jpg", width: 1200, height: 800 }],
  },
};

const campusPhotos = [
  {
    title: "Main Campus Building",
    description: "Administrative & Central Block",
    src: "/images/campus/college-main.jpg",
  },
  {
    title: "Campus Entrance Gate",
    description: "Main Security Control & Gate Desk",
    src: "/images/campus/college-entrance.jpg",
  },
  {
    title: "Academic & Library Block",
    description: "Learning Spaces & Academic Facilities",
    src: "/images/campus/college-building.jpg",
  },
  {
    title: "Green Campus Environment",
    description: "Himalayan Foothills & Serene Grounds",
    src: "/images/campus/college-area.jpg",
  },
];

const securityFeatures = [
  {
    icon: Users,
    title: "Visitor Management",
    description: "Digitally register and maintain visitor information for seamless campus verification.",
  },
  {
    icon: Car,
    title: "Vehicle Monitoring",
    description: "Maintain vehicle-related visitor information for enhanced gate control and campus safety.",
  },
  {
    icon: FileText,
    title: "Digital Records",
    description: "Keep visitor records organized, searchable, and securely stored for audit readiness.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Campus",
    description: "Support a safer and better-managed campus environment for students, faculty, and guests.",
  },
];

const securityGuidelines = [
  "All visitors must complete visitor registration prior to or upon campus entry.",
  "Valid official identification information (such as Aadhaar Card) should be provided.",
  "Visitor photographs may be recorded at entry points for identification and security purposes.",
  "Vehicles entering the campus must be properly recorded with valid registration details.",
  "All visitors should follow instructions issued by campus security personnel at all times.",
  "Unauthorized access to restricted academic, residential, or administrative zones is strictly prohibited.",
];

const emergencyContacts = [
  {
    title: "Campus Security Desk",
    subtitle: "Gate Control & Main Patrol",
    phone: CONTACT.generalPhone,
    icon: ShieldCheck,
    color: "border-primary/30 bg-primary/5 text-primary",
  },
  {
    title: "University Administration",
    subtitle: "Main Administrative Office",
    phone: CONTACT.admissionsPhone,
    icon: Building2,
    color: "border-blue-500/30 bg-blue-50/50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400",
  },
  {
    title: "Police Station",
    subtitle: "Haridwar City Police",
    phone: "112 / 01334-227200",
    icon: AlertTriangle,
    color: "border-amber-500/30 bg-amber-50/50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400",
  },
  {
    title: "Ambulance / Medical",
    subtitle: "Campus Health Center",
    phone: "108 / Emergency Care",
    icon: PhoneCall,
    color: "border-emerald-500/30 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400",
  },
  {
    title: "Fire Emergency",
    subtitle: "Haridwar Fire Department",
    phone: "101",
    icon: Shield,
    color: "border-red-500/30 bg-red-50/50 text-red-700 dark:bg-red-950/20 dark:text-red-400",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* ------------------------------------------------------------------ */}
      {/* 1. HERO SECTION                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="hero"
        className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background py-12 lg:py-20 border-b border-border"
      >
        <div className="container relative z-10 grid gap-10 lg:grid-cols-12 lg:items-center">
          {/* LEFT CONTENT */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <Badge
              variant="outline"
              className="inline-flex items-center gap-2 border-primary/30 bg-primary/10 px-3.5 py-1 text-sm font-semibold text-primary"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              {UNIVERSITY.name}
            </Badge>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight">
                Campus Security <br className="hidden sm:inline" />
                <span className="text-primary">Management System</span>
              </h1>
              <p className="text-base sm:text-lg font-medium text-primary/90 tracking-wide">
                Smart • Secure • Digital Campus Management
              </p>
            </div>

            <p className="text-base text-muted-foreground leading-relaxed max-w-xl">
              A secure and efficient digital platform for managing campus visitors, vehicle entries, and security records for Dev Sanskriti Vishwavidyalaya.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button asChild size="lg" className="font-semibold shadow-md">
                <a href="#visitor-registration">
                  <ShieldCheck className="mr-2 h-5 w-5" />
                  Register Visitor
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="font-semibold">
                <a href="#campus-360">
                  <Compass className="mr-2 h-5 w-5" />
                  Explore Campus 360°
                </a>
              </Button>
            </div>

            {/* Quick stats highlights */}
            <div className="pt-6 border-t border-border grid grid-cols-3 gap-4 text-center sm:text-left">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">Campus</p>
                <p className="text-sm font-bold text-foreground">76.80 Acres</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">Location</p>
                <p className="text-sm font-bold text-foreground">Haridwar, UK</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">Security</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">24/7 Monitored</p>
              </div>
            </div>
          </div>

          {/* RIGHT PHOTOGRAPH */}
          <div className="lg:col-span-6">
            <div className="relative overflow-hidden rounded-2xl border border-border shadow-2xl group bg-muted">
              <div className="aspect-[4/3] relative w-full overflow-hidden">
                <Image
                  src="/images/campus/college-entrance.jpg"
                  alt={`${UNIVERSITY.name} Main Campus Gate`}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Subtle dark overlay for contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                <div className="absolute bottom-4 left-4 right-4 text-white p-2">
                  <Badge className="bg-primary text-white mb-1">Campus Portal</Badge>
                  <h3 className="text-lg font-bold">{UNIVERSITY.name}</h3>
                  <p className="text-xs text-white/80">Main Gate Security & Visitor Control Center</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. VISITOR REGISTRATION – MOST IMPORTANT SECTION                    */}
      {/* ------------------------------------------------------------------ */}
      <section id="visitor-registration" className="py-14 lg:py-20 bg-muted/30 border-b border-border">
        <div className="container max-w-4xl space-y-8">
          <div className="text-center space-y-3">
            <Badge variant="outline" className="border-primary/30 text-primary font-semibold">
              Entry Verification
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
              Visitor Registration
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-base">
              Please provide the required information for secure campus entry.
            </p>
          </div>

          {/* Embedded Visitor Booking Wizard */}
          <div className="shadow-lg rounded-xl overflow-hidden border border-border bg-card">
            <BookingWizard />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. COLLEGE CAMPUS IMAGE SECTION                                    */}
      {/* ------------------------------------------------------------------ */}
      <section id="explore-campus" className="py-14 lg:py-20 border-b border-border bg-background">
        <div className="container space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="outline" className="border-primary/30 text-primary font-semibold">
              Virtual Gallery
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
              Explore Our Campus
            </h2>
            <p className="text-muted-foreground text-base">
              Discover the campus environment and important locations through our virtual campus experience.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {campusPhotos.map((photo) => (
              <div
                key={photo.title}
                className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-300 flex flex-col"
              >
                <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                  <Image
                    src={photo.src}
                    alt={photo.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4 space-y-1">
                  <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                    {photo.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">{photo.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. CAMPUS 360° SECTION                                              */}
      {/* ------------------------------------------------------------------ */}
      <section id="campus-360" className="py-14 lg:py-20 bg-slate-900 text-white border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <Image
            src="/images/campus/college-campus.jpg"
            alt="Campus Background"
            fill
            className="object-cover"
          />
        </div>
        <div className="container relative z-10 max-w-4xl text-center space-y-8">
          <Badge className="bg-primary text-white px-3 py-1 font-semibold">
            360° Virtual Experience
          </Badge>

          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white">
              Explore Campus in 360°
            </h2>
            <p className="text-slate-300 max-w-xl mx-auto text-base leading-relaxed">
              Take a virtual tour of the campus and explore important locations from anywhere.
            </p>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl max-w-3xl mx-auto group">
            <div className="aspect-[16/9] relative w-full bg-slate-800">
              <Image
                src="/images/campus/college-campus.jpg"
                alt="Campus 360 View Preview"
                fill
                sizes="(max-width: 1024px) 100vw, 800px"
                className="object-cover opacity-80 group-hover:opacity-95 transition-opacity duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex flex-col items-center justify-center p-6 text-center">
                <div className="h-16 w-16 rounded-full bg-primary/90 text-white flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                  <Compass className="h-8 w-8 animate-spin-slow" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{UNIVERSITY.name} 360° Tour</h3>
                <p className="text-xs text-slate-300 max-w-md mb-6">
                  Interactive panoramic tour of grounds, academic blocks, auditorium & surrounding grounds.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-white font-semibold shadow-xl"
                >
                  <a href="https://360view.dsvv.ac.in/" target="_blank" rel="noopener noreferrer">
                    Explore 360° Campus
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. SMART CAMPUS SECURITY SECTION                                   */}
      {/* ------------------------------------------------------------------ */}
      <section id="smart-security" className="py-14 lg:py-20 border-b border-border bg-muted/20">
        <div className="container space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="outline" className="border-primary/30 text-primary font-semibold">
              Security Features
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
              Smart Campus Security
            </h2>
            <p className="text-muted-foreground text-base">
              Integrated digital solutions ensuring a safe and structured campus environment.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {securityFeatures.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow space-y-4"
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. SECURITY GUIDELINES SECTION                                     */}
      {/* ------------------------------------------------------------------ */}
      <section id="security-info" className="py-14 lg:py-20 border-b border-border bg-background">
        <div className="container max-w-4xl space-y-8">
          <div className="text-center space-y-3">
            <Badge variant="outline" className="border-primary/30 text-primary font-semibold">
              Compliance & Regulations
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
              Campus Security Guidelines
            </h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto">
              Please review and adhere to the security rules while visiting Dev Sanskriti Vishwavidyalaya.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4">
            <ul className="grid gap-4 sm:grid-cols-2">
              {securityGuidelines.map((rule, idx) => (
                <li key={idx} className="flex gap-3 items-start p-3 rounded-lg bg-muted/40">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground leading-relaxed font-medium">{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 7. EMERGENCY ASSISTANCE SECTION                                    */}
      {/* ------------------------------------------------------------------ */}
      <section id="emergency-assistance" className="py-14 lg:py-20 border-b border-border bg-muted/30">
        <div className="container space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="outline" className="border-red-500/30 text-red-600 dark:text-red-400 font-semibold">
              Emergency Response
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
              Emergency Assistance
            </h2>
            <p className="text-muted-foreground text-base">
              Immediate contact details for security, medical, and emergency services on campus.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {emergencyContacts.map((contact) => (
              <div
                key={contact.title}
                className={`rounded-xl border p-5 shadow-xs flex flex-col justify-between space-y-3 ${contact.color}`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <contact.icon className="h-6 w-6" />
                    <Phone className="h-4 w-4 opacity-60" />
                  </div>
                  <h3 className="font-bold text-base tracking-tight">{contact.title}</h3>
                  <p className="text-xs opacity-80">{contact.subtitle}</p>
                </div>
                <div className="pt-2 border-t border-current/10">
                  <a
                    href={`tel:${contact.phone.replace(/[^0-9+]/g, "")}`}
                    className="font-mono text-sm font-bold block hover:underline"
                  >
                    {contact.phone}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 8. ABOUT SYSTEM                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section id="about" className="py-14 lg:py-20 bg-background">
        <div className="container max-w-4xl space-y-6 text-center">
          <Badge variant="outline" className="border-primary/30 text-primary font-semibold">
            System Overview
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
            About Campus Security Management System
          </h2>
          <div className="space-y-4 text-muted-foreground text-base leading-relaxed text-left sm:text-center max-w-3xl mx-auto">
            <p>
              The <strong>Campus Security Management System</strong> at Dev Sanskriti Vishwavidyalaya is designed to digitally record and manage visitor registrations, vehicle check-ins, and security records.
            </p>
            <p>
              By replacing manual gate registers with verified digital passes, the system enables gate officers and administrative authorities to maintain strict access control, verify visitor credentials in real time, and safeguard campus peace and safety.
            </p>
          </div>

          <div className="pt-4 flex justify-center">
            <Button asChild variant="outline">
              <Link href="/login">
                <Lock className="mr-2 h-4 w-4" />
                Admin / Security Guard Login Portal
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
