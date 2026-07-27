// A single 5.0 with one review reads as planted — and in the seed data *every*
// rated vendor is 5.0, which testers flagged as the top trust-killer. Only show a
// star rating once there are enough reviews to mean something; below that, a
// vendor is simply "New" (an absent score reads as more honest than an unearned one).
export const MIN_REVIEWS_FOR_RATING = 3;

export function showsRating(reviewCount: number | null | undefined): boolean {
  return (reviewCount ?? 0) >= MIN_REVIEWS_FOR_RATING;
}
