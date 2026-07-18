/**
 * Vendor tiers and what each one unlocks.
 *
 * Two tiers ship today: free and paid. `tier` is an integer rather than a
 * boolean purely so a second paid tier can be added later without touching
 * billing data — reserve 2 and it costs a price constant, a name, and a row in
 * REQUIRED. Nothing sells tier 2 today and nothing should show it.
 *
 * Single source of truth: every gate in the app reads `canAccess`, so changing
 * what free includes is a one-line edit here rather than a hunt through the
 * codebase.
 */

export const TIER = { FREE: 0, PAID: 1 } as const;
export type Tier = number;

/** Tiers the product actually sells and displays. */
export const SELLABLE_TIERS: Tier[] = [TIER.PAID];

export const TIER_NAMES: Record<number, string> = {
  [TIER.FREE]: "Free",
  [TIER.PAID]: "Paid",
};

/** Monthly price in GBP. */
export const TIER_PRICE: Record<number, number> = {
  [TIER.FREE]: 0,
  [TIER.PAID]: 29,
};

/** Annual prepay bills 10 months for 12. */
export const ANNUAL_MONTHS_CHARGED = 10;

export function annualPrice(tier: Tier): number {
  return (TIER_PRICE[tier] ?? 0) * ANNUAL_MONTHS_CHARGED;
}

export type Feature =
  /** Read a lead's contact details and message. Free sees a locked preview. */
  | "unlock_leads"
  /** Ranked normally in search rather than penalised below paid listings. */
  | "search_visibility"
  /** Boosted above other paid listings. */
  | "featured_placement"
  /** Performance card on the dashboard. */
  | "analytics"
  /** More than a single photo. */
  | "photo_gallery"
  /** Availability calendar and the "free on your date" match signal. */
  | "availability"
  /** Bio, FAQs and signature items on the public profile. */
  | "rich_profile"
  /** Email the moment a lead lands, rather than a daily digest. */
  | "instant_alerts"
  /** Suppress the "similar vendors" panel on your own profile. */
  | "no_competitor_panel"
  /** List more than one service. */
  | "multiple_services";

/** Minimum tier required for each feature. */
const REQUIRED: Record<Feature, Tier> = {
  unlock_leads: TIER.PAID,
  search_visibility: TIER.PAID,
  analytics: TIER.PAID,
  photo_gallery: TIER.PAID,
  availability: TIER.PAID,
  rich_profile: TIER.PAID,
  instant_alerts: TIER.PAID,
  no_competitor_panel: TIER.PAID,
  featured_placement: TIER.PAID,
  multiple_services: TIER.PAID,
};

export function canAccess(tier: number | null | undefined, feature: Feature): boolean {
  return (tier ?? TIER.FREE) >= REQUIRED[feature];
}

export function requiredTier(feature: Feature): Tier {
  return REQUIRED[feature];
}

/** Free listings still get one photo — an empty card helps nobody. */
export const FREE_PHOTO_LIMIT = 1;

/** What a vendor is shown as the reason to upgrade, in persuasion order. */
export const UPGRADE_REASONS: { feature: Feature; label: string }[] = [
  { feature: "unlock_leads", label: "Read and reply to every enquiry" },
  { feature: "instant_alerts", label: "Get alerted the moment a lead lands" },
  { feature: "search_visibility", label: "Rank alongside paid listings, not below them" },
  { feature: "no_competitor_panel", label: "Remove competitors from your profile page" },
  { feature: "photo_gallery", label: "Show a full photo gallery" },
  { feature: "availability", label: "Publish your availability" },
  { feature: "analytics", label: "See views, enquiries and conversion" },
];
