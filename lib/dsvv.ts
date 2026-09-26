/**
 * Dev Sanskriti Vishwavidyalaya — university content.
 *
 * Every factual statement rendered on the public portal is defined here so it
 * can be checked and corrected in one file rather than hunted across pages.
 *
 * SOURCING RULE
 * -------------
 * Only information published by the university is recorded here. Where a value
 * could not be confirmed from an official page it is either omitted or marked
 * `unconfirmed: true` so the UI can present it as "to be confirmed" instead of
 * stating it as fact. Do not add rankings, placement figures, student counts,
 * gate timings or visitor rules to this file unless they come from an official
 * DSVV source.
 *
 * Source: https://www.dsvv.ac.in/ (home, about, contact).
 */

import {
  BadgeCheck,
  BookOpen,
  Building2,
  Bus,
  CalendarCheck,
  ClipboardCheck,
  Flower2,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Landmark,
  Leaf,
  Library,
  Mountain,
  Users,
  UserCheck,
  Utensils,
  Wifi,
  Sparkles,
  Dumbbell,
  BedDouble,
  Flame,
  Microscope,
  Globe2,
  Handshake,
  Compass,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ *
 * Identity
 * ------------------------------------------------------------------ */

export const UNIVERSITY = {
  name: "Dev Sanskriti Vishwavidyalaya",
  shortName: "DSVV",
  portalName: "Visitor & Campus Visit Portal",
  city: "Haridwar",
  state: "Uttarakhand",
  country: "India",
  /** Official vision line as published on the university home page. */
  vision: "A University for the Global, Cultural & Spiritual Renaissance",
  /** Official positioning line as published on the university home page. */
  tagline:
    "An educational institution which molds its students into noble and enlightened human beings",
  website: "https://www.dsvv.ac.in/",
} as const;

export const CONTACT = {
  addressLines: [
    "Dev Sanskriti Vishwavidyalaya",
    "Gayatrikunj – Shantikunj",
    "Haridwar, Uttarakhand, India – 249411",
  ],
  /** Single-line form used in metadata and structured data. */
  addressInline:
    "Gayatrikunj – Shantikunj, Haridwar, Uttarakhand, India – 249411",
  postalCode: "249411",
  generalPhone: "+91 97201 07192",
  generalEmail: "info@dsvv.ac.in",
  admissionsPhone: "+91 92583 69612",
  admissionsEmail: "admissions@dsvv.ac.in",
  /** Office hours as published on the official contact page. */
  officeHours: [
    { days: "Monday – Saturday", hours: "9:00 AM – 5:00 PM" },
    { days: "Sunday", hours: "9:00 AM – 12:00 PM" },
  ],
  /** Search query rather than a coordinate pair — no invented geolocation. */
  directionsUrl:
    "https://www.google.com/maps/search/?api=1&query=Dev+Sanskriti+Vishwavidyalaya%2C+Gayatrikunj+Shantikunj%2C+Haridwar%2C+Uttarakhand+249411",
} as const;

/* ------------------------------------------------------------------ *
 * Highlights
 * ------------------------------------------------------------------ */

export interface Highlight {
  value: string;
  label: string;
  detail: string;
  icon: LucideIcon;
}

export const HIGHLIGHTS: Highlight[] = [
  {
    value: "2002",
    label: "Established",
    detail: "Founded at Haridwar, Uttarakhand.",
    icon: Landmark,
  },
  {
    value: "76.80",
    label: "Acre campus",
    detail: "A green campus beside the Ganga in the Himalayan foothills.",
    icon: Mountain,
  },
  {
    value: "UGC",
    label: "Recognised",
    detail: "Recognised by the University Grants Commission.",
    icon: ShieldCheck,
  },
  {
    value: "NAAC",
    label: "Accredited",
    detail: "Accredited by the National Assessment and Accreditation Council.",
    icon: BadgeCheck,
  },
  {
    value: "70+",
    label: "Global collaborations",
    detail: "Collaborations with more than 70 universities worldwide.",
    icon: Globe2,
  },
];

/* ------------------------------------------------------------------ *
 * About
 * ------------------------------------------------------------------ */

export const ABOUT_PARAGRAPHS: string[] = [
  "Dev Sanskriti Vishwavidyalaya was established in 2002 at Haridwar, Uttarakhand, on the banks of the Ganga in the foothills of the Himalayas. The university describes itself as a university for the global, cultural and spiritual renaissance.",
  "Its academic approach brings contemporary education together with India's knowledge traditions: degree programmes across the sciences, technology, management, communication, education and Indology are taught alongside a curriculum of human values, yoga and self-development that every student shares.",
  "Teaching, research and campus life are organised around the idea that capability and character belong together — that graduates should be professionally competent and personally responsible to the society they serve.",
];

/** Themes the university states for its educational approach. */
export const ABOUT_PILLARS: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Value-based education",
    description:
      "Human values, ethics and self-development are taught as part of the curriculum rather than alongside it.",
    icon: Sparkles,
  },
  {
    title: "Indian knowledge traditions",
    description:
      "Sanskrit, Indology, yogic science and Ayurveda are studied as living academic disciplines.",
    icon: BookOpen,
  },
  {
    title: "Interdisciplinary learning",
    description:
      "Schools span the sciences, technology, management, communication, education and the humanities.",
    icon: Compass,
  },
  {
    title: "Research and enquiry",
    description:
      "The university states a commitment to conventional research in non-conventional disciplines.",
    icon: Microscope,
  },
  {
    title: "Social responsibility",
    description:
      "Students are prepared to apply their abilities to the wider good of society.",
    icon: Handshake,
  },
  {
    title: "Global collaboration",
    description:
      "Academic collaborations extend to more than 70 universities worldwide.",
    icon: Globe2,
  },
];

/* ------------------------------------------------------------------ *
 * Why visit
 * ------------------------------------------------------------------ */

export const VISIT_REASONS: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Explore the campus",
    description:
      "Walk the campus, see its academic and residential spaces, and get a feel for daily life at the university.",
    icon: Building2,
  },
  {
    title: "Academic environment",
    description:
      "Learn about the schools, departments and academic facilities, and how the programmes are structured.",
    icon: GraduationCap,
  },
  {
    title: "Culture and spirituality",
    description:
      "Experience the cultural and spiritual environment that shapes the university's approach to education.",
    icon: Flame,
  },
  {
    title: "Nature and serenity",
    description:
      "Spend time in the green campus and its surroundings in the Himalayan foothills near the Ganga.",
    icon: Leaf,
  },
  {
    title: "Research and learning",
    description:
      "Discover research groups, laboratories and interdisciplinary initiatives across the schools.",
    icon: FlaskConical,
  },
  {
    title: "Meet and connect",
    description:
      "Plan a visit for an academic, institutional, personal or other legitimate purpose with the right department.",
    icon: Users,
  },
];

/* ------------------------------------------------------------------ *
 * Academics
 * ------------------------------------------------------------------ */

export interface School {
  name: string;
  description: string;
  icon: LucideIcon;
}

/**
 * The four schools named on the university's own site. Department-to-school
 * mapping is deliberately not asserted here — see `DEPARTMENT_EXAMPLES`.
 */
export const SCHOOLS: School[] = [
  {
    name: "School of Humanities, Social Sciences and Human Values",
    description:
      "Languages, psychology, education and the study of human values — the disciplines concerned with people, society and character.",
    icon: Users,
  },
  {
    name: "School of Technology, Communication and Management",
    description:
      "Computing, media and management studies, taught with an emphasis on applied and professional practice.",
    icon: Building2,
  },
  {
    name: "School of Biological Sciences and Sustainability",
    description:
      "Life sciences, health and the study of sustainable living and the environment.",
    icon: Leaf,
  },
  {
    name: "School of Indology",
    description:
      "Indian knowledge traditions, classical languages, scriptures and the scholarly study of Indian culture.",
    icon: BookOpen,
  },
];

/**
 * Departments the university lists publicly. Presented as a flat list because
 * the school each department sits under is not stated on the public pages.
 */
export const DEPARTMENT_EXAMPLES: string[] = [
  "Computer Sciences",
  "Yogic Science",
  "Sanskrit",
  "Hindi",
  "Psychology",
  "Education",
  "Ayurveda",
  "Journalism & Mass Communication",
];

/* ------------------------------------------------------------------ *
 * Campus and facilities
 * ------------------------------------------------------------------ */

export interface Facility {
  title: string;
  description: string;
  icon: LucideIcon;
  /**
   * Local image under `/public/assets`. Leave undefined until an official
   * photograph is available — the UI renders a labelled placeholder instead of
   * presenting some other campus as DSVV.
   */
  image?: string;
}

export const FACILITIES: Facility[] = [
  {
    title: "Academic buildings",
    description: "Lecture halls, seminar rooms and departmental offices across the schools.",
    icon: Building2,
    image: "/assets/dsvv/dsvv-campus-entrance.webp",
  },
  {
    title: "Library",
    description: "The university library, supporting study and research across disciplines.",
    icon: Library,
    image: "/assets/dsvv/dsvv-library.jpg",
  },
  {
    title: "Laboratories",
    description: "Teaching and research laboratories serving the science and technology programmes.",
    icon: FlaskConical,
  },
  {
    title: "Hostels",
    description: "On-campus residential accommodation for students.",
    icon: BedDouble,
  },
  {
    title: "Sports and gymnasium",
    description: "Sports grounds and fitness facilities for students and staff.",
    icon: Dumbbell,
    image: "/assets/dsvv/dsvv-sports-ground.webp",
  },
  {
    title: "Health facilities",
    description: "Health and medical support available to the campus community.",
    icon: HeartPulse,
  },
  {
    title: "Wi-Fi and digital infrastructure",
    description: "Network connectivity and computing facilities across the campus.",
    icon: Wifi,
  },
  {
    title: "Herbal gardens",
    description: "Cultivated herbal gardens connected to the study of Ayurveda and plant sciences.",
    icon: Flower2,
    image: "/assets/dsvv/dsvv-upvan-gardens.webp",
  },
  {
    title: "Yagyashala",
    description: "A dedicated space for the university's yagya and cultural practices.",
    icon: Flame,
  },
  {
    title: "Cafeteria",
    description: "Dining facilities serving students, staff and visitors on campus.",
    icon: Utensils,
    image: "/assets/dsvv/dsvv-aahar-kendra.webp",
  },
  {
    title: "Visitor reception",
    description: "The reception point where pre-booked visitors report on arrival.",
    icon: UserCheck,
  },
  {
    title: "Campus transport access",
    description: "Road access to the campus, with parking directed by the gate on arrival.",
    icon: Bus,
  },
];

export interface GalleryItem {
  id: string;
  title: string;
  caption: string;
  /** Undefined until an official photograph is supplied. */
  image?: string;
  /** Larger tile in the desktop grid. */
  featured?: boolean;
}

export const GALLERY: GalleryItem[] = [
  {
    id: "campus-entrance",
    title: "Administrative block",
    caption:
      "Shriram Bhawan, the administrative block of Dev Sanskriti Vishwavidyalaya, Haridwar.",
    image: "/assets/dsvv/dsvv-campus-entrance.webp",
    featured: true,
  },
  {
    id: "library",
    title: "University library",
    caption:
      "The reading room of the Dev Sanskriti Vishwavidyalaya library, with open stacks and individual study carrels.",
    image: "/assets/dsvv/dsvv-library.jpg",
  },
  {
    id: "temple",
    title: "Pragyeshwar Mahadev Temple",
    caption:
      "The Pragyeshwar Mahadev Temple at the centre of the campus amphitheatre.",
    image: "/assets/dsvv/dsvv-temple.webp",
  },
  {
    id: "gardens",
    title: "Shriram Smriti Upvan",
    caption:
      "The entrance to Shriram Smriti Upvan, the health park and gardens on the DSVV campus.",
    image: "/assets/dsvv/dsvv-upvan-gardens.webp",
  },
  {
    id: "sports",
    title: "Sports ground",
    caption:
      "The campus basketball and volleyball courts at dusk, below the Himalayan foothills.",
    image: "/assets/dsvv/dsvv-sports-ground.webp",
  },
  {
    id: "gaushala",
    title: "Gaushala",
    caption: "The university gaushala on the Dev Sanskriti Vishwavidyalaya campus.",
    image: "/assets/dsvv/dsvv-gaushala.webp",
  },
  {
    id: "baltic-centre",
    title: "Centre for Baltic Culture and Studies",
    caption:
      "The Centre for Baltic Culture and Studies at Dev Sanskriti Vishwavidyalaya.",
    image: "/assets/dsvv/dsvv-baltic-centre.webp",
  },
];

/* ------------------------------------------------------------------ *
 * Visitors
 * ------------------------------------------------------------------ */

export interface VisitorAudience {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const VISITOR_AUDIENCES: VisitorAudience[] = [
  {
    title: "Prospective students",
    description:
      "See the campus and academic facilities before applying, and ask your questions in person.",
    icon: GraduationCap,
  },
  {
    title: "Parents and guardians",
    description:
      "Visit with or on behalf of a student to meet the department and see the campus environment.",
    icon: Users,
  },
  {
    title: "Academic visitors",
    description:
      "Faculty and academic staff from other institutions visiting for teaching or scholarly purposes.",
    icon: BookOpen,
  },
  {
    title: "Researchers",
    description:
      "Scholars visiting for research discussions, collaborations or access to academic resources.",
    icon: Microscope,
  },
  {
    title: "Institutional delegates",
    description:
      "Representatives of universities, organisations and official bodies visiting the university.",
    icon: Handshake,
  },
  {
    title: "Alumni",
    description: "Former students returning to the campus.",
    icon: Sparkles,
  },
  {
    title: "Guests and other visitors",
    description:
      "Anyone visiting for another legitimate purpose, with the relevant department noted in the request.",
    icon: UserCheck,
  },
];

/* ------------------------------------------------------------------ *
 * How it works
 * ------------------------------------------------------------------ */

export const HOW_IT_WORKS: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Plan your visit",
    description:
      "Decide the date, who is coming with you and what you would like to see or whom you wish to meet.",
    icon: Compass,
  },
  {
    title: "Submit your request",
    description:
      "Complete the pre-booking form. You receive a booking reference as soon as it is submitted.",
    icon: CalendarCheck,
  },
  {
    title: "Receive your status",
    description:
      "The university reviews the request. Check the status at any time with your reference.",
    icon: ClipboardCheck,
  },
  {
    title: "Visit DSVV",
    description:
      "Once your visit is approved, report at the gate on the date and time in your booking.",
    icon: Landmark,
  },
];

/* ------------------------------------------------------------------ *
 * Visitor guide
 * ------------------------------------------------------------------ */

export interface GuideSection {
  title: string;
  icon: LucideIcon;
  points: string[];
  /** Rendered as "to be confirmed by the university" rather than as policy. */
  unconfirmed?: boolean;
}

export const VISITOR_GUIDE: GuideSection[] = [
  {
    title: "Before you visit",
    icon: CalendarCheck,
    points: [
      "Submit a pre-booking request for your visit and keep the booking reference you receive.",
      "Check your booking status before travelling — a submitted request is not yet an approved visit.",
      "Include everyone in your group in the visitor count so the gate expects the right number of people.",
      "If you wish to meet a specific person or department, say so in the request; the meeting depends on their availability.",
    ],
  },
  {
    title: "What to bring",
    icon: ClipboardCheck,
    points: [
      "Your booking reference, on your phone or printed.",
      "The original photo identity document whose details you entered in the booking.",
      "Identification for the other adults in your group, where they are required to register at the gate.",
      "Vehicle registration details, if you gave them when booking and are arriving by car.",
    ],
  },
  {
    title: "Arriving on campus",
    icon: Bus,
    points: [
      "Report at the campus gate and present your booking reference and identity document.",
      "Arrive in good time for the slot in your booking so your entry can be recorded without delay.",
      "Follow the directions of gate and security staff for parking and access.",
    ],
  },
  {
    title: "Visiting hours and access rules",
    icon: ShieldCheck,
    unconfirmed: true,
    points: [
      "Gate timings, permitted areas and the documents required at entry are set by the university and may change.",
      "Confirm the current arrangements with the university before you travel.",
    ],
  },
  {
    title: "On campus",
    icon: Leaf,
    points: [
      "The campus is a place of study, residence and practice — please keep noise low around academic and residential areas.",
      "Stay within the areas covered by your visit and do not enter restricted or residential spaces without permission.",
      "Photography may be restricted in some areas; ask before photographing people, classes or ceremonies.",
      "Please keep the campus and its gardens clean.",
    ],
  },
  {
    title: "Accessibility",
    icon: HeartPulse,
    points: [
      "If anyone in your group needs step-free access, assistance or other support, note it in the special requirements field when booking.",
      "Contact the university in advance so arrangements can be considered before your visit.",
    ],
  },
  {
    title: "Safety and emergencies",
    icon: ShieldCheck,
    points: [
      "In an emergency on campus, contact the nearest member of staff or the gate immediately.",
      "Report anything that looks unsafe to campus staff.",
      "Keep your booking reference with you for the duration of your visit.",
    ],
  },
];

/**
 * What each booking status means to a visitor.
 *
 * The labels mirror the statuses the booking record actually carries, so the
 * guide cannot drift from what the status page shows.
 */
export const STATUS_GUIDE: { status: string; meaning: string }[] = [
  {
    status: "Pending",
    meaning:
      "Your request has been submitted and is under review by the university. It is not yet an approved visit.",
  },
  {
    status: "Approved",
    meaning:
      "Your visit has been approved. Report at the gate with your booking reference and photo ID on the date and time booked.",
  },
  {
    status: "Rescheduled",
    meaning:
      "Your visit has been moved to a new date or time and is under review again. Check the status before travelling.",
  },
  {
    status: "Rejected",
    meaning:
      "The request was not approved. Where a reason has been recorded, it is shown with the status.",
  },
  {
    status: "Cancelled",
    meaning: "The booking was cancelled and is no longer valid for entry.",
  },
  {
    status: "Checked In",
    meaning: "Your entry has been recorded at the gate and you are on campus.",
  },
  {
    status: "Checked Out",
    meaning: "Your exit has been recorded and the visit is complete.",
  },
  {
    status: "Expired",
    meaning:
      "The booked date passed without the visit taking place. Please submit a new request.",
  },
];

/* ------------------------------------------------------------------ *
 * FAQ
 * ------------------------------------------------------------------ */

export const FAQS: { question: string; answer: string }[] = [
  {
    question: "How do I pre-book a visit?",
    answer:
      "Open the Pre-Book a Visit page, complete the four short steps and submit. You receive a booking reference immediately, which you use to check the status of your request.",
  },
  {
    question: "Can I visit the campus as a prospective student?",
    answer:
      "Yes. Choose Prospective Student as your visitor type when booking and describe what you would like to see or discuss. Any meeting with a department depends on their availability and approval.",
  },
  {
    question: "Can parents visit with a student?",
    answer:
      "Yes. Make one booking for the group and enter the total number of visitors so everyone is expected at the gate.",
  },
  {
    question: "How many people can be included in one booking?",
    answer:
      "One booking can cover a group; the maximum group size is set by the university and the form tells you if your number exceeds it. For a larger group, contact the university before booking.",
  },
  {
    question: "How do I check my booking status?",
    answer:
      "Use the Check Booking Status page with your booking reference and the mobile number you booked with. Both are needed, so nobody else can look up your visit.",
  },
  {
    question: "What should I bring when visiting?",
    answer:
      "Bring your booking reference and the original photo identity document whose details you entered when booking. The Visitor Guide lists what else to carry.",
  },
  {
    question: "Can I request a meeting with a department?",
    answer:
      "You can name the person or department you wish to meet when booking. The meeting is confirmed only if that person or department accepts it — a submitted request is not a confirmed appointment.",
  },
  {
    question: "What happens after I submit a visit request?",
    answer:
      "Your request is recorded as Submitted and reviewed by the university. The status moves to Under Review and then to Approved or Rejected. Please check your status before you travel.",
  },
];

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

export const PUBLIC_NAV: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About DSVV" },
  { href: "/campus", label: "Campus" },
  { href: "/academics", label: "Academics" },
  { href: "/facilities", label: "Facilities" },
  { href: "/visitor-guide", label: "Visitor Guide" },
];

export const BOOK_PATH = "/pre-book-visit";
export const STATUS_PATH = "/booking-status";
