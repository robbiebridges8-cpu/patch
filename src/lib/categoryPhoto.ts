// Curated, category-appropriate imagery. Every ID below was verified to return
// HTTP 200 from Unsplash's CDN. Used as the fallback when a vendor has no photos
// of its own (currently all of them), so cards/profiles look intentional rather
// than showing one identical stock image everywhere.

const CATEGORY_PHOTO_ID: Record<string, string> = {
  "Pizza": "1513104890138-7c749659a591",
  "Burgers": "1565299624946-b28f40a0ae38",
  "Tacos & Mexican": "1552332386-f8dd00dc2f85",
  "BBQ": "1544025162-d76694265947",
  "Grazing & cheese": "1476224203421-9ac39bcb3327",
  "Coffee": "1495474472287-4d71bcdd2085",
  "Desserts": "1551024601-bec78aea704b",
  "Ice cream": "1497034825429-c343d7c6a68f",
  "Middle Eastern": "1540914124281-342587941389",
  "Indian": "1585937421612-70a008356fbe",
  "Asian street food": "1496116218417-1a781b1c416c",
  "British comfort": "1517244683847-7456b63c5969",
  "Canapés": "1546069901-ba9599a7e63c",
  "Vegan": "1512621776951-a57141f2eefd",
  "Cocktail bar": "1514362545857-3bc16c4c7d1b",
};

const FALLBACK_ID = "1414235077428-338989a2e8c0"; // generic laid table

export function categoryPhoto(category: string | null | undefined, w = 800): string {
  const id = (category && CATEGORY_PHOTO_ID[category]) || FALLBACK_ID;
  return `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;
}
