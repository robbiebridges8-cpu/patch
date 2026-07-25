import type { ParsedQuery } from "./ai";

/**
 * The recovery ladder for a search that returned nothing: relax the universal
 * hard filters one at a time, cheapest-to-lose first, until something matches.
 *
 * Attributes are deliberately absent. They only ever come from an explicit UI
 * filter, so the buyer asked for them on purpose — and "nut-free" or "DBS
 * checked" is a requirement, not a preference. Relaxing them could return a
 * result that's actively unsafe, so they are never relaxed. (Invariant covered
 * by relaxations.test.ts.)
 */
export const RELAXATIONS: {
  label: string;
  constraining: (p: ParsedQuery, geo: unknown) => boolean;
  relax: (p: ParsedQuery) => void;
  dropsGeo?: boolean;
}[] = [
  { label: "budget", constraining: (p) => p.budget_max != null, relax: (p) => { p.budget_max = null; } },
  { label: "area", constraining: (_p, geo) => geo != null, relax: () => {}, dropsGeo: true },
  { label: "service type", constraining: (p) => p.categories.length > 0, relax: (p) => { p.categories = []; } },
];
