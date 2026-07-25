// Canonical categories + London areas that drive the /services/[category]/[location]
// landing pages. Both are curated (not derived) so slugs are stable and
// reversible, and each area carries a real centroid for the PostGIS radius query.

export interface ServiceCategory {
  slug: string;
  /** Exact value stored in vendor_services.category — must match for the query. */
  name: string;
  /** Lower-case noun for prose ("pizza vans", "coffee carts"). */
  plural: string;
}

export interface LondonArea {
  slug: string;
  name: string;
  lat: number;
  lng: number;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { slug: "pizza", name: "Pizza", plural: "pizza caterers" },
  { slug: "burgers", name: "Burgers", plural: "burger vans" },
  { slug: "bbq", name: "BBQ", plural: "BBQ caterers" },
  { slug: "tacos-mexican", name: "Tacos & Mexican", plural: "taco & Mexican caterers" },
  { slug: "indian", name: "Indian", plural: "Indian caterers" },
  { slug: "asian-street-food", name: "Asian street food", plural: "Asian street food caterers" },
  { slug: "middle-eastern", name: "Middle Eastern", plural: "Middle Eastern caterers" },
  { slug: "caribbean", name: "Caribbean", plural: "Caribbean caterers" },
  { slug: "thai", name: "Thai", plural: "Thai caterers" },
  { slug: "japanese", name: "Japanese", plural: "Japanese caterers" },
  { slug: "korean", name: "Korean", plural: "Korean caterers" },
  { slug: "chinese", name: "Chinese", plural: "Chinese caterers" },
  { slug: "greek", name: "Greek", plural: "Greek caterers" },
  { slug: "spanish", name: "Spanish", plural: "Spanish & tapas caterers" },
  { slug: "african", name: "African", plural: "African caterers" },
  { slug: "seafood", name: "Seafood", plural: "seafood caterers" },
  { slug: "fish-chips", name: "Fish & chips", plural: "fish & chips vans" },
  { slug: "fried-chicken", name: "Fried chicken", plural: "fried chicken caterers" },
  { slug: "british-comfort", name: "British comfort", plural: "British comfort-food caterers" },
  { slug: "grazing-cheese", name: "Grazing & cheese", plural: "grazing & cheese caterers" },
  { slug: "canapes", name: "Canapés", plural: "canapé caterers" },
  { slug: "vegan", name: "Vegan", plural: "vegan caterers" },
  { slug: "desserts", name: "Desserts", plural: "dessert caterers" },
  { slug: "ice-cream", name: "Ice cream", plural: "ice cream vans" },
  { slug: "doughnuts", name: "Doughnuts", plural: "doughnut stalls" },
  { slug: "crepes-waffles", name: "Crêpes & waffles", plural: "crêpe & waffle stalls" },
  { slug: "coffee", name: "Coffee", plural: "coffee carts" },
  { slug: "cocktail-bar", name: "Cocktail bar", plural: "mobile cocktail bars" },
];

// Spread across central, east, north, south and west London. Centroids are
// approximate area centres.
export const LONDON_AREAS: LondonArea[] = [
  { slug: "london", name: "London", lat: 51.5074, lng: -0.1278 },
  { slug: "shoreditch", name: "Shoreditch", lat: 51.5265, lng: -0.0792 },
  { slug: "hackney", name: "Hackney", lat: 51.545, lng: -0.0553 },
  { slug: "dalston", name: "Dalston", lat: 51.5462, lng: -0.0748 },
  { slug: "islington", name: "Islington", lat: 51.5384, lng: -0.0996 },
  { slug: "camden", name: "Camden", lat: 51.5390, lng: -0.1426 },
  { slug: "soho", name: "Soho", lat: 51.5137, lng: -0.1316 },
  { slug: "city-of-london", name: "the City of London", lat: 51.5155, lng: -0.0922 },
  { slug: "canary-wharf", name: "Canary Wharf", lat: 51.5054, lng: -0.0235 },
  { slug: "stratford", name: "Stratford", lat: 51.5432, lng: -0.0032 },
  { slug: "greenwich", name: "Greenwich", lat: 51.4826, lng: -0.0077 },
  { slug: "peckham", name: "Peckham", lat: 51.4739, lng: -0.0694 },
  { slug: "brixton", name: "Brixton", lat: 51.4613, lng: -0.1156 },
  { slug: "clapham", name: "Clapham", lat: 51.4620, lng: -0.1382 },
  { slug: "battersea", name: "Battersea", lat: 51.4791, lng: -0.1487 },
  { slug: "fulham", name: "Fulham", lat: 51.4804, lng: -0.1953 },
  { slug: "chelsea", name: "Chelsea", lat: 51.4875, lng: -0.1687 },
  { slug: "kensington", name: "Kensington", lat: 51.4991, lng: -0.1938 },
  { slug: "notting-hill", name: "Notting Hill", lat: 51.5090, lng: -0.1960 },
  { slug: "hammersmith", name: "Hammersmith", lat: 51.4927, lng: -0.2240 },
  { slug: "westminster", name: "Westminster", lat: 51.4975, lng: -0.1357 },
  { slug: "wandsworth", name: "Wandsworth", lat: 51.4571, lng: -0.1927 },
];

export const findCategory = (slug: string) => SERVICE_CATEGORIES.find((c) => c.slug === slug);
export const findArea = (slug: string) => LONDON_AREAS.find((a) => a.slug === slug);
