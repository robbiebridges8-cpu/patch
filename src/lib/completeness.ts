// Listing completeness. Ordered by what actually wins a booking, not by what's
// easy to fill in: buyers search semantically, so description and bio feed the
// embedding directly, and photos are what they judge first.

export interface CompletenessInput {
  name?: string | null;
  primary_category?: string | null;
  description?: string | null;
  bio?: string | null;
  price_from?: number | null;
  contact_email?: string | null;
  typical_event_size_min?: number | null;
  typical_event_size_max?: number | null;
  attributes?: Record<string, unknown> | null;
  signature_items?: string[] | null;
  vibe_tags?: string[] | null;
  faq?: unknown[] | null;
  coverage_radius_miles?: number | null;
  photoCount: number;
  hasAvailability: boolean;
}

export interface CompletenessItem {
  key: string;
  label: string;
  /** Why it matters — shown so the task doesn't read as busywork. */
  why: string;
  done: boolean;
  weight: number;
  essential: boolean;
}

export interface Completeness {
  percent: number;
  items: CompletenessItem[];
  missing: CompletenessItem[];
  /** Essentials outstanding — a listing is not really sellable without these. */
  blocking: CompletenessItem[];
}

const nonEmpty = (s?: string | null, min = 1) => !!s && s.trim().length >= min;
const hasSome = (a?: unknown[] | null) => Array.isArray(a) && a.length > 0;

export function assessListing(v: CompletenessInput): Completeness {
  const items: CompletenessItem[] = [
    {
      key: "name",
      label: "Business name",
      why: "How buyers recognise you.",
      done: nonEmpty(v.name),
      weight: 5,
      essential: true,
    },
    {
      key: "category",
      label: "Service type",
      why: "Drives which searches and category pages you appear on.",
      done: nonEmpty(v.primary_category),
      weight: 12,
      essential: true,
    },
    {
      key: "description",
      label: "Short description",
      why: "The first line buyers read, and a strong signal for AI matching.",
      done: nonEmpty(v.description, 40),
      weight: 15,
      essential: true,
    },
    {
      key: "photos",
      label: "Three or more photos",
      why: "Listings with real photos get noticeably more enquiries than stock imagery.",
      done: v.photoCount >= 3,
      weight: 15,
      essential: true,
    },
    {
      key: "price",
      label: "Starting price",
      why: "Buyers filter by budget — without a price you're excluded from those searches.",
      done: v.price_from != null && v.price_from > 0,
      weight: 10,
      essential: true,
    },
    {
      key: "contact",
      label: "Contact email",
      why: "Where your enquiries land.",
      done: nonEmpty(v.contact_email),
      weight: 8,
      essential: true,
    },
    {
      key: "capacity",
      label: "Typical job size",
      why: "Lets Patch rule you in for the right scale of work.",
      done: v.typical_event_size_max != null && v.typical_event_size_max > 0,
      weight: 8,
      essential: false,
    },
    {
      key: "bio",
      label: "Full description",
      why: "The richest input to semantic matching — the more you say, the better you match.",
      done: nonEmpty(v.bio, 120),
      weight: 9,
      essential: false,
    },
    {
      key: "attributes",
      label: "Service details",
      why: "Specifics clients search for — dietary, certifications, equipment. These are matched word-for-word against what buyers ask for.",
      done: !!v.attributes && Object.keys(v.attributes).length > 0,
      weight: 6,
      essential: false,
    },
    {
      key: "signature",
      label: "What you're known for",
      why: "Specifics match specific requests better than generalities do.",
      done: hasSome(v.signature_items),
      weight: 4,
      essential: false,
    },
    {
      key: "coverage",
      label: "Coverage radius",
      why: "Keeps you out of searches too far away to serve.",
      done: v.coverage_radius_miles != null && v.coverage_radius_miles > 0,
      weight: 4,
      essential: false,
    },
    {
      key: "availability",
      label: "Availability marked",
      why: "Buyers searching a date see who's free — blocked dates stop wasted enquiries.",
      done: v.hasAvailability,
      weight: 2,
      essential: false,
    },
    {
      key: "faq",
      label: "A few FAQs",
      why: "Answers the questions that otherwise become emails.",
      done: hasSome(v.faq),
      weight: 2,
      essential: false,
    },
  ];

  const total = items.reduce((s, i) => s + i.weight, 0);
  const earned = items.reduce((s, i) => s + (i.done ? i.weight : 0), 0);

  return {
    percent: Math.round((earned / total) * 100),
    items,
    missing: items.filter((i) => !i.done),
    blocking: items.filter((i) => !i.done && i.essential),
  };
}
