/**
 * Vendor tiers and what each one unlocks.
 *
 * Single source of truth: every gate in the app reads `canAccess`, so changing
 * what free includes is a one-line edit here rather than a hunt through the
 * codebase. The commercial policy is deliberately a dial — the thresholds
 * should move as paid supply grows, and that should not require a refactor.
 */

export const TIER = { FREE: 0, STANDARD: 1, PRO: 2 } as const;
export type Tier = (typeof TIER)[keyof typeof TIER];

export const TIER_NAMES: Record<Tier, string> = {
  [TIER.FREE]: "Free",
  [TIER.STANDARD]: "Standard",
  [TIER.PRO]: "Pro",
};

/** Monthly price in GBP. Annual prepay bills 10 months for 12. */
export const TIER_PRICE: Record<Tier, number> = {
  [TIER.FREE]: 0,
  [TIER.STANDARD]: 29,
  [TIER.PRO]: 59,
};

export const ANNUAL_MONTHS_CHARGED = 10;

export function annualPrice(tier: Tier): number {
  return TIER_PRICE[tier] * ANNUAL_MONTHS_CHARGED;
}

export type Feature =
  /** Read a lead's contact details and message. Free sees a locked preview. */
  | "unlock_leads"
  /** Ranked normally in search rather than penalised below paid listings. */
  | "search_visibility"
  /** Boosted to the top of results. */
  | "featured_placement"
  /** Performance card on the dashboard. */
  | "analytics"
  /** More than a single photo. */
  | "photo_gallery"
  /** Availability calendar and the "free on your date" match signal. */
  | "availability"
  /** Bio, FAQs, signature items rendered on the public profile. */
  | "rich_profile"
  /** Email the moment a lead lands, rather than a daily digest. */
  | "instant_alerts"
  /** Suppress the "similar vendors" panel on your own profile. */
  | "no_competitor_panel"
  /** List more than one service. */
  | "multiple_services";

/** Minimum tier required for each feature. */
const REQUIRED: Record<Feature, Tier> = {
  unlock_leads: TIER.STANDARD,
  search_visibility: TIER.STANDARD,
  analytics: TIER.STANDARD,
  photo_gallery: TIER.STANDARD,
  availability: TIER.STANDARD,
  rich_profile: TIER.STANDARD,
  instant_alerts: TIER.STANDARD,
  no_competitor_panel: TIER.STANDARD,
  featured_placement: TIER.PRO,
  multiple_services: TIER.PRO,
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
  { feature: "featured_placement", label: "Featured at the top of results" },
];
