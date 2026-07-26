// Curated, category-appropriate imagery. Every ID below was verified to return
// HTTP 200 from Unsplash's CDN. Used as the fallback when a vendor has no photos
// of its own (currently all of them). Pass a stable `seed` (the vendor slug/id)
// so each vendor gets a *distinct* image from its category's pool — otherwise a
// category search shows the same photo on every card, which reads as broken.

const CATEGORY_PHOTOS: Record<string, string[]> = {
  "Pizza": ["1513104890138-7c749659a591", "1571066811602-716837d681de", "1574071318508-1cdbab80d002", "1593504049359-74330189a345"],
  "Burgers": ["1565299624946-b28f40a0ae38", "1568901346375-23c9450c58cd", "1550547660-d9450f859349", "1571091718767-18b5b1457add"],
  "Tacos & Mexican": ["1552332386-f8dd00dc2f85", "1565299585323-38d6b0865b47", "1613514785940-daed07799d9b"],
  "BBQ": ["1544025162-d76694265947", "1529193591184-b1d58069ecdd", "1607013251379-e6eecfffe234"],
  "Grazing & cheese": ["1476224203421-9ac39bcb3327", "1452195100486-9cc805987862"],
  "Coffee": ["1495474472287-4d71bcdd2085", "1509042239860-f550ce710b93", "1461023058943-07fcbe16d735"],
  "Desserts": ["1551024601-bec78aea704b", "1488477181946-6428a0291777", "1563729784474-d77dbb933a9e"],
  "Ice cream": ["1497034825429-c343d7c6a68f"],
  "Middle Eastern": ["1540914124281-342587941389"],
  "Indian": ["1585937421612-70a008356fbe", "1631452180519-c014fe946bc7", "1567188040759-fb8a883dc6d8"],
  "Asian street food": ["1496116218417-1a781b1c416c", "1552611052-33e04de081de"],
  "British comfort": ["1517244683847-7456b63c5969"],
  "Canapés": ["1546069901-ba9599a7e63c", "1414235077428-338989a2e8c0"],
  "Vegan": ["1512621776951-a57141f2eefd", "1540420773420-3366772f4999"],
  "Cocktail bar": ["1514362545857-3bc16c4c7d1b", "1470337458703-46ad1756a187"],
};

// Category-neutral catering shots for the long-tail categories without their own
// pool — appetising and generic, so variety beats an identical placeholder.
const GENERAL_POOL = [
  "1414235077428-338989a2e8c0", "1476224203421-9ac39bcb3327",
  "1546069901-ba9599a7e63c", "1517244683847-7456b63c5969",
];

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function categoryPhoto(category: string | null | undefined, w = 800, seed?: string | null): string {
  const pool = (category && CATEGORY_PHOTOS[category]) || GENERAL_POOL;
  const idx = seed ? hashSeed(seed) % pool.length : 0;
  return `https://images.unsplash.com/photo-${pool[idx]}?w=${w}&q=80&auto=format&fit=crop`;
}
