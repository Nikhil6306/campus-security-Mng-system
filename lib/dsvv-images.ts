/**
 * Photograph provenance.
 *
 * Every campus photograph shipped in `public/assets/dsvv/` is recorded here
 * with where it came from and what it shows. This is a maintenance record, not
 * page content — nothing in this file is rendered, and no source URL appears
 * in the public interface.
 *
 * SOURCING RULE
 * -------------
 * Only photographs published by the university on dsvv.ac.in are used, and
 * each one was opened and visually checked before being captioned. A picture
 * is never captioned as something it does not show, and no stock image, AI
 * image or photograph of another institution appears anywhere on this site.
 *
 * Where the university publishes no photograph of a facility, the facility is
 * still described in `FACILITIES` as a text card — see `MISSING_SUBJECTS`.
 */

export interface ImageRecord {
  /** Where it is used in the interface. */
  section: string;
  file: string;
  /** Pixel dimensions of the stored file. */
  width: number;
  height: number;
  source: string;
  sourcePage: string;
  description: string;
  /**
   * How the subject was confirmed. "viewed" means the image was opened and
   * its contents checked against the caption rather than trusted from a
   * filename.
   */
  verification: "viewed" | "captioned-by-source";
}

export const IMAGE_MANIFEST: ImageRecord[] = [
  {
    section: "Hero · Campus gallery (featured) · About",
    file: "/assets/dsvv/dsvv-campus-entrance.webp",
    width: 1920,
    height: 1280,
    source: "Official DSVV website",
    sourcePage: "https://dsvv.ac.in/campus-life/",
    description:
      "Shriram Bhawan, the university's administrative block. The roof sign reads देव संस्कृति विश्वविद्यालय and the portico is marked प्रशासनिक भवन / SHRIRAM BHAWAN.",
    verification: "viewed",
  },
  {
    section: "Campus gallery · Facilities (Library)",
    file: "/assets/dsvv/dsvv-library.jpg",
    width: 2560,
    height: 1707,
    source: "Official DSVV website",
    sourcePage: "https://dsvv.ac.in/library/",
    description:
      "The university library reading room. Study carrels are stencilled DSVV/LIB/S/T1, which confirms the location.",
    verification: "viewed",
  },
  {
    section: "Campus gallery (Temple)",
    file: "/assets/dsvv/dsvv-temple.webp",
    width: 1920,
    height: 1280,
    source: "Official DSVV website",
    sourcePage: "https://dsvv.ac.in/campus-life/",
    description:
      "Pragyeshwar Mahadev Temple at the centre of the campus amphitheatre — the shivling under its marble canopy.",
    verification: "viewed",
  },
  {
    section: "Campus gallery (Gardens)",
    file: "/assets/dsvv/dsvv-upvan-gardens.webp",
    width: 768,
    height: 533,
    source: "Official DSVV website",
    sourcePage: "https://dsvv.ac.in/campus-life/",
    description:
      "Entrance to Shriram Smriti Upvan, the campus health park and garden. The gateway sign reads श्रीराम स्मृति उपवन.",
    verification: "viewed",
  },
  {
    section: "Campus gallery (Sports)",
    file: "/assets/dsvv/dsvv-sports-ground.webp",
    width: 1024,
    height: 1024,
    source: "Official DSVV website",
    sourcePage: "https://dsvv.ac.in/sports/",
    description:
      "The campus basketball and volleyball courts at dusk, with the Himalayan foothills behind.",
    verification: "viewed",
  },
  {
    section: "Campus gallery (Gaushala)",
    file: "/assets/dsvv/dsvv-gaushala.webp",
    width: 1920,
    height: 1280,
    source: "Official DSVV website",
    sourcePage: "https://dsvv.ac.in/campus-life/",
    description: "The university gaushala (cow shelter) on the campus grounds.",
    verification: "captioned-by-source",
  },
  {
    section: "Campus gallery (Centre for Baltic Culture and Studies)",
    file: "/assets/dsvv/dsvv-baltic-centre.webp",
    width: 1920,
    height: 1280,
    source: "Official DSVV website",
    sourcePage: "https://dsvv.ac.in/campus-life/",
    description:
      "The Centre for Baltic Culture and Studies, described by the university as Asia's first such centre.",
    verification: "captioned-by-source",
  },
  {
    section: "Facilities (Cafeteria)",
    file: "/assets/dsvv/dsvv-aahar-kendra.webp",
    width: 768,
    height: 533,
    source: "Official DSVV website",
    sourcePage: "https://dsvv.ac.in/campus-life/",
    description: "Prakritik Aahar Kendra, the campus healthy-food cafe beside the health park.",
    verification: "captioned-by-source",
  },
  {
    section: "About (campus life)",
    file: "/assets/dsvv/dsvv-handloom.webp",
    width: 1920,
    height: 1280,
    source: "Official DSVV website",
    sourcePage: "https://dsvv.ac.in/campus-life/",
    description:
      "The campus handloom unit, one of the university's self-sustenance models.",
    verification: "captioned-by-source",
  },
];

/**
 * Facilities the university documents in words but does not publish a
 * photograph of.
 *
 * These remain as icon-and-text cards. They are listed here so the gap is a
 * recorded decision rather than an oversight: the moment an official
 * photograph exists, drop it into `public/assets/dsvv/` and set `image` on the
 * matching entry in `FACILITIES` or `GALLERY`.
 *
 * Yagyashala is the notable one. The only yagya image on dsvv.ac.in is a
 * third-party Pngtree stock illustration, not a photograph of the university's
 * own yagyashala, so it is deliberately not used.
 */
export const MISSING_SUBJECTS = [
  "Yagyashala",
  "Hostels",
  "Laboratories",
  "Auditorium",
  "Health centre",
] as const;
