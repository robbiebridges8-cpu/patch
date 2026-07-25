#!/usr/bin/env node
/**
 * Generates ~426 varied London mobile-food vendors (to bring the catalogue to
 * ~500), composes rich embedding text, embeds via Voyage voyage-3 (free-tier
 * safe: small batches, spaced to respect 3 RPM / 10K TPM), and emits batched
 * SQL files to seed/sql/ for insertion (PostGIS point + pgvector inline).
 *
 * Usage: node scripts/seed-500.mjs
 * Reads VOYAGE_API_KEY + Supabase anon key from .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(resolve(__dirname, "../.env.local"), "utf-8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const VOYAGE_API_KEY = env.VOYAGE_API_KEY;
const TARGET_NEW = 426;

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// ── London areas: postcode district + approximate centroid ──
const AREAS = [
  ["N1", 51.538, -0.099], ["N4", 51.571, -0.106], ["N16", 51.562, -0.075], ["N7", 51.552, -0.117],
  ["E1", 51.517, -0.059], ["E2", 51.528, -0.061], ["E5", 51.556, -0.052], ["E8", 51.545, -0.060],
  ["E9", 51.545, -0.045], ["E11", 51.567, 0.010], ["E17", 51.585, -0.019], ["E20", 51.545, -0.013],
  ["EC1", 51.524, -0.099], ["EC2", 51.518, -0.087], ["SE1", 51.501, -0.091], ["SE5", 51.474, -0.093],
  ["SE10", 51.482, -0.007], ["SE15", 51.470, -0.069], ["SE22", 51.454, -0.070], ["SE8", 51.481, -0.026],
  ["SW2", 51.452, -0.121], ["SW4", 51.463, -0.138], ["SW9", 51.463, -0.113], ["SW11", 51.464, -0.166],
  ["SW18", 51.448, -0.191], ["SW6", 51.474, -0.200], ["W1", 51.514, -0.147], ["W2", 51.515, -0.188],
  ["W6", 51.492, -0.223], ["W10", 51.521, -0.210], ["W11", 51.512, -0.205], ["W12", 51.507, -0.235],
  ["NW1", 51.535, -0.143], ["NW3", 51.554, -0.178], ["NW5", 51.552, -0.142], ["NW6", 51.544, -0.196],
  ["NW10", 51.535, -0.245], ["CR0", 51.372, -0.101], ["TW1", 51.448, -0.331], ["TW9", 51.463, -0.286],
  ["SM1", 51.363, -0.193], ["KT1", 51.410, -0.300], ["HA1", 51.579, -0.334], ["EN1", 51.652, -0.081],
  ["IG1", 51.559, 0.082], ["DA1", 51.446, 0.216], ["BR1", 51.406, 0.015], ["UB1", 51.512, -0.375],
];

// ── Shared pools ──
const SUF = ["& Co", "Kitchen", "Social", "Club", "Cart", "Bros", "& Sons", "Collective",
  "Company", "Street", "Yard", "House", "Local", "Traders", "& Grace", "Larder", "& Smoke", "Union"];
const OCC = ["private parties", "weddings", "corporate events", "milestone birthdays", "festivals",
  "markets", "office lunches", "christenings", "baby showers", "engagement parties", "launch events",
  "summer parties", "garden parties", "anniversaries"];
const DIET_ALL = ["vegetarian", "vegan", "gluten-free", "dairy-free", "halal", "nut-free"];

// ── Cuisines: [category, prefixes[], descTemplates[], signatures[], vibe[], dietary[], [priceMin,priceMax], [capMin,capMax]] ──
const C = (category, prefixes, descs, sig, vibe, diet, price, cap, extraNames = []) =>
  ({ category, prefixes, descs, sig, vibe, diet, price, cap, extraNames });

const CUISINES = [
  C("Pizza", ["Dough", "Slice", "Crust", "Ember", "Peel", "Napoli", "Fired", "Stone"],
    ["Wood-fired Neapolitan pizza, blistered and bubbling, straight from the trailer.",
     "60-second wood-fired pizzas with '00' flour and San Marzano tomatoes.",
     "Sourdough pizza fired in a mobile oven — leopard-spotted crusts, London's best."],
    ["Margherita", "Nduja & honey", "Diavola", "Truffle & mushroom", "Marinara"],
    ["casual", "crowd-pleaser", "kid-friendly", "interactive", "wood-fired", "wedding-ready"],
    ["vegetarian", "vegan", "gluten-free"], [500, 950], [30, 250],
    ["Peel & Fire", "The Dough Bikes"]),
  C("Burgers", ["Patty", "Smash", "Grind", "Bun", "Beef", "Char", "Flip", "Prime"],
    ["Dry-aged smash burgers seared on a flat-top, served in glossy brioche.",
     "Proper smash patties, melted cheese, house pickles — no fuss, all flavour.",
     "Grass-fed beef smash burgers and loaded fries from a converted horsebox."],
    ["Double cheeseburger", "Bacon smash", "Buttermilk chicken burger", "Loaded fries", "Vegan smash"],
    ["casual", "crowd-pleaser", "late-night", "hearty", "kid-friendly"],
    ["vegetarian", "vegan", "gluten-free"], [500, 900], [40, 300],
    ["Cheese & Char", "Two Buns"]),
  C("Tacos & Mexican", ["Masa", "Nixta", "Agave", "Padrino", "Loco", "Comal", "Barrio"],
    ["Nixtamalised corn tortillas pressed to order, filled with slow-cooked fillings.",
     "Real-deal tacos al pastor carved off the trompo, plus fresh salsas and lime.",
     "Mexican street food — birria, carnitas, and blue-corn tacos with proper heat."],
    ["Tacos al pastor", "Birria & consommé", "Carnitas", "Baja fish taco", "Elote"],
    ["casual", "vibrant", "crowd-pleaser", "spicy", "festival"],
    ["vegetarian", "vegan", "gluten-free", "dairy-free"], [500, 900], [30, 220],
    ["Blue Corn Bikes", "Trompo Traders"]),
  C("BBQ", ["Ember", "Smoke", "Coal", "Bones", "Pit", "Low", "Brisket", "Barrel"],
    ["Low-and-slow smoked brisket, pulled pork, and burnt ends from an offset smoker.",
     "Texas-style BBQ — 14-hour brisket, ribs, and house pickles by the trailer.",
     "Charcoal-smoked meats and vegetables, served with slaw and cornbread."],
    ["12-hour brisket", "Pulled pork", "Beef short rib", "Smoked wings", "Burnt-end mac"],
    ["hearty", "smoky", "crowd-pleaser", "rustic", "wedding-ready"],
    ["gluten-free", "dairy-free"], [900, 1800], [40, 350],
    ["Offset & Oak", "The Smoke Ring"]),
  C("Grazing & cheese", ["Graze", "Board", "Platter", "Wheel", "Fromage", "Feast", "Bloom"],
    ["Abundant grazing tables piled with charcuterie, cheese, fruit, and warm bread.",
     "Artisan cheese wheels and cured meats styled into a centrepiece grazing table.",
     "Seasonal grazing boards and boxes — the prettiest table at the party."],
    ["Grazing table", "Cheese tower", "Charcuterie boards", "Antipasti", "Baked camembert"],
    ["elegant", "instagrammable", "abundant", "wedding-ready", "grazing"],
    ["vegetarian", "gluten-free"], [250, 700], [10, 150],
    ["Wheels & Bloom", "The Graze Table"]),
  C("Coffee", ["Brew", "Espresso", "Java", "Roast", "Crema", "Flat White", "Grind"],
    ["Speciality coffee cart with a commercial espresso machine and trained baristas.",
     "Single-origin espresso, flat whites, and batch brew from a converted Piaggio.",
     "Mobile baristas serving proper coffee — the morning your guests remember."],
    ["Flat white", "Batch filter", "Iced latte", "Mocha", "Hot chocolate"],
    ["morning", "wedding-ready", "corporate", "reliable", "cosy"],
    ["vegetarian", "vegan", "dairy-free"], [280, 550], [20, 400],
    ["The Piaggio Bar", "Crema Cart"]),
  C("Desserts", ["Sugar", "Sweet", "Churro", "Waffle", "Sticky", "Praline", "Whisk"],
    ["Warm churros, waffles, and dipping sauces made to order — pure indulgence.",
     "Dessert cart of brownies, cookies, and torched treats for the sweet-toothed.",
     "Handmade puddings and sweets — the finale your guests will talk about."],
    ["Cinnamon churros", "Belgian waffles", "Warm brownie", "Salted caramel", "Chocolate fountain"],
    ["indulgent", "kid-friendly", "instagrammable", "interactive", "sweet"],
    ["vegetarian", "vegan", "gluten-free"], [250, 550], [20, 200],
    ["Torch & Sugar", "The Waffle Wagon"]),
  C("Ice cream", ["Scoop", "Gelato", "Whippy", "Sorbet", "Freeze", "Cone", "Churn"],
    ["Small-batch gelato churned daily, scooped from a vintage cart.",
     "Proper ice cream and sorbets — no artificial anything, just cream and fruit.",
     "Retro ice cream van serving 99s, gelato, and dairy-free sorbets."],
    ["Pistachio gelato", "Salted caramel", "Mango sorbet", "99 Flake", "Affogato"],
    ["nostalgic", "kid-friendly", "summer", "crowd-pleaser", "playful"],
    ["vegetarian", "vegan", "gluten-free", "dairy-free"], [300, 600], [30, 400],
    ["The Churn Cart", "Vintage Scoops"]),
  C("Middle Eastern", ["Falafel", "Mezze", "Shawarma", "Pitta", "Yalla", "Sumac", "Zaatar"],
    ["Charcoal-grilled shawarma, loaded falafel, and the creamiest hummus in town.",
     "Levantine mezze, flatbreads, and grilled skewers with pickles and tahini.",
     "Middle Eastern street food — mezze platters, falafel wraps, and baklava."],
    ["Chicken shawarma", "Falafel wrap", "Hummus & flatbread", "Halloumi skewers", "Baklava"],
    ["casual", "crowd-pleaser", "vegan-friendly", "halal", "generous"],
    ["vegetarian", "vegan", "gluten-free", "halal", "dairy-free"], [400, 800], [30, 250],
    ["Sumac & Smoke", "Flatbread Social"]),
  C("Indian", ["Chai", "Naan", "Dosa", "Spice", "Tandoor", "Masala", "Bombay"],
    ["Regional Indian street food — dosas, chaat, and curries with proper spice.",
     "Tandoor-fired naans, kathi rolls, and rich curries from a mobile kitchen.",
     "Bombay street snacks, biryani, and freshly-griddled dosas to order."],
    ["Masala dosa", "Chicken tikka roll", "Pani puri", "Butter chicken", "Lamb biryani"],
    ["vibrant", "spicy", "crowd-pleaser", "aromatic", "generous"],
    ["vegetarian", "vegan", "gluten-free", "halal"], [450, 850], [40, 300],
    ["Tiffin & Tandoor", "The Dosa Cart"]),
  C("Asian street food", ["Bao", "Dumpling", "Wok", "Pandan", "Seoul", "Momo", "Hanoi"],
    ["Fluffy bao buns and dumplings, steamed to order with punchy fillings.",
     "Pan-Asian street food — bao, gyoza, and noodles wok-tossed on the spot.",
     "Steamed buns, dumplings, and rice bowls from across East and Southeast Asia."],
    ["Pork belly bao", "Prawn gyoza", "Kimchi fried rice", "Char siu", "Bubble tea"],
    ["vibrant", "casual", "crowd-pleaser", "interactive", "umami"],
    ["vegetarian", "vegan", "gluten-free", "dairy-free"], [500, 900], [30, 220],
    ["Steam & Bun", "Wok & Roll"]),
  C("British comfort", ["Pie", "Mash", "Gravy", "Bangers", "Proper", "Bramley", "Salt Beef"],
    ["Proper pie and mash with liquor and jellied eels — a London institution.",
     "Great British comfort food — sausages, mash, and rich onion gravy.",
     "Hand-raised pies, salt beef bagels, and puddings done properly."],
    ["Steak & ale pie", "Bangers & mash", "Salt beef bagel", "Sticky toffee", "Scotch egg"],
    ["hearty", "nostalgic", "comfort", "crowd-pleaser", "British"],
    ["vegetarian", "vegan"], [350, 700], [40, 250],
    ["The Pie Cart", "Gravy Train"]),
  C("Canapés", ["Croquette", "Bite", "Platter", "Amuse", "Morsel", "Petit", "Drop"],
    ["Elegant canapés and finger food, passed or plated for drinks receptions.",
     "Restaurant-quality bites — croquettes, blinis, and skewers, beautifully styled.",
     "Drop-off canapé boxes and platters for effortless, elegant entertaining."],
    ["Truffle croquettes", "Smoked salmon blini", "Mini beef sliders", "Goat's cheese tart", "Prawn skewers"],
    ["elegant", "refined", "corporate", "wedding-ready", "sophisticated"],
    ["vegetarian", "gluten-free"], [300, 800], [20, 200],
    ["The Canapé Co", "Bites & Bloom"]),
  C("Vegan", ["Verde", "Green", "Plant", "Root", "Bloom", "Goodness", "Fern"],
    ["Plant-based feasts that even the sceptics rave about — bold, fresh, generous.",
     "Fully vegan street food — jackfruit, buddha bowls, and dirty vegan burgers.",
     "Seasonal plant-based catering, all colour and flavour, zero compromise."],
    ["Jackfruit taco", "Buddha bowl", "Vegan mac", "Beetroot burger", "Miso aubergine"],
    ["fresh", "healthy", "vibrant", "conscious", "colourful"],
    ["vegan", "vegetarian", "gluten-free", "dairy-free", "nut-free"], [450, 850], [30, 200],
    ["Root & Bloom", "The Plant Cart"]),
  C("Cocktail bar", ["Negroni", "Gin", "Press", "Shaker", "Tonic", "Bramble", "Bear"],
    ["A stylish mobile bar with skilled bartenders mixing classics to order.",
     "Bespoke cocktail bar — negronis, spritzes, and signature serves for your event.",
     "Mobile bartenders and a beautiful bar cart for weddings and parties."],
    ["Negroni", "Espresso martini", "Aperol spritz", "Signature serve", "Bramble"],
    ["stylish", "wedding-ready", "sophisticated", "celebratory", "fun"],
    ["vegan", "gluten-free"], [650, 1300], [30, 250],
    ["The Bar Cart", "Shake & Bloom"]),
  C("Caribbean", ["Jerk", "Island", "Rum", "Reggae", "Spice", "Sunshine", "Yard"],
    ["Charcoal jerk chicken, rice and peas, and festival dumplings with island spice.",
     "Caribbean street food — jerk, curry goat, and plantain, full of sunshine.",
     "Proper jerk cooked over coals, with rum-punch vibes and big flavour."],
    ["Jerk chicken", "Curry goat", "Rice & peas", "Fried plantain", "Festival dumpling"],
    ["vibrant", "spicy", "festival", "crowd-pleaser", "sunny"],
    ["gluten-free", "dairy-free", "halal"], [450, 850], [40, 300],
    ["Coal & Spice", "Island Yard"]),
  C("Thai", ["Bangkok", "Pad", "Lemongrass", "Chang", "Basil", "Siam", "Krua"],
    ["Fragrant Thai street food — pad thai, green curry, and som tam to order.",
     "Wok-fired Thai classics with lemongrass, chilli, and lime, cooked fresh.",
     "Authentic Thai — massaman, pad kra pao, and mango sticky rice."],
    ["Pad thai", "Green curry", "Massaman", "Som tam", "Mango sticky rice"],
    ["aromatic", "spicy", "vibrant", "fresh", "crowd-pleaser"],
    ["vegetarian", "vegan", "gluten-free", "dairy-free"], [450, 850], [30, 220],
    ["Wok & Basil", "Bangkok Bikes"]),
  C("Japanese", ["Sushi", "Nori", "Umami", "Sakura", "Bento", "Katsu", "Ramen"],
    ["Hand-rolled sushi and sashimi, prepared live by trained chefs.",
     "Japanese street food — katsu, gyoza, and donburi bowls made to order.",
     "Fresh sushi platters and hot ramen bowls for a refined event."],
    ["Salmon nigiri", "California roll", "Chicken katsu", "Pork ramen", "Edamame"],
    ["refined", "fresh", "elegant", "umami", "corporate"],
    ["vegetarian", "vegan", "gluten-free", "dairy-free"], [600, 1200], [20, 180],
    ["Nori & Rice", "The Sushi Bar"]),
  C("Chinese", ["Wok", "Lucky", "Golden", "Dumpling", "Canton", "Szechuan", "Bamboo"],
    ["Wok-tossed Chinese street food — chow mein, salt-and-pepper, and bao.",
     "Cantonese classics and dim sum, steaming from the mobile kitchen.",
     "Szechuan heat and Cantonese comfort, cooked fresh over roaring woks."],
    ["Salt & pepper chicken", "Chow mein", "Dim sum", "Char siu bao", "Kung pao"],
    ["vibrant", "crowd-pleaser", "umami", "casual", "generous"],
    ["vegetarian", "vegan", "halal"], [450, 850], [40, 280],
    ["Golden Wok", "Bamboo Cart"]),
  C("Korean", ["Seoul", "Kimchi", "Gochu", "BBQ", "Bibim", "Hanok", "Gangnam"],
    ["Korean street food — KFC (Korean fried chicken), bibimbap, and kimchi.",
     "Sizzling Korean BBQ, japchae, and gochujang-glazed everything.",
     "Bold Korean flavours — bulgogi, tteokbokki, and crunchy fried chicken."],
    ["Korean fried chicken", "Bibimbap", "Bulgogi", "Tteokbokki", "Kimchi fries"],
    ["bold", "spicy", "vibrant", "crowd-pleaser", "umami"],
    ["vegetarian", "vegan", "gluten-free", "dairy-free"], [500, 950], [30, 220],
    ["Seoul Fire", "Gochu & Co"]),
  C("Greek", ["Souvlaki", "Olive", "Meze", "Aegean", "Feta", "Athena", "Gyro"],
    ["Char-grilled souvlaki, warm pita, and tzatziki — Greek sunshine on a plate.",
     "Greek street food — gyros, halloumi, and horiatiki with proper olive oil.",
     "Mezze, skewers, and flatbreads from the Aegean, grilled over coals."],
    ["Chicken souvlaki", "Halloumi gyro", "Greek salad", "Lamb kofta", "Baklava"],
    ["fresh", "sunny", "casual", "crowd-pleaser", "mediterranean"],
    ["vegetarian", "gluten-free", "halal"], [450, 850], [40, 260],
    ["Olive & Coal", "The Gyro Cart"]),
  C("Spanish", ["Paella", "Tapas", "Ibérico", "Valencia", "Pintxo", "Sol", "Brasa"],
    ["Giant paella pans cooked live over fire — saffron rice, seafood, and chorizo.",
     "Spanish tapas and pintxos — croquetas, patatas bravas, and jamón.",
     "Authentic paella and tapas, a showpiece cooked in front of your guests."],
    ["Seafood paella", "Chorizo & prawns", "Patatas bravas", "Croquetas", "Churros"],
    ["vibrant", "interactive", "festival", "wedding-ready", "showpiece"],
    ["gluten-free", "dairy-free", "vegetarian"], [550, 1100], [40, 350],
    ["Fuego Paella", "Brasa & Sol"]),
  C("Seafood", ["Shuck", "Tide", "Catch", "Oyster", "Coast", "Brine", "Harbour"],
    ["A raw bar of freshly-shucked oysters, prawns, and dressed crab.",
     "Sustainable seafood — grilled prawns, oysters, and cured fish, coastal-fresh.",
     "Fruits de mer and a live oyster bar for an elegant seaside touch."],
    ["Rock oysters", "Dressed crab", "Grilled prawns", "Cured salmon", "Fish tacos"],
    ["elegant", "fresh", "coastal", "refined", "wedding-ready"],
    ["gluten-free", "dairy-free"], [600, 1300], [20, 180],
    ["The Oyster Cart", "Shuck & Tide"]),
  C("Fried chicken", ["Cluck", "Buttermilk", "Coop", "Crispy", "Wing", "Bird", "Golden"],
    ["Buttermilk-brined fried chicken, dredged and fried to shattering crunch.",
     "Proper fried chicken, wings, and waffles with house hot sauce.",
     "Free-range fried chicken burgers and tenders from a converted truck."],
    ["Fried chicken burger", "Buttermilk tenders", "Hot wings", "Chicken & waffles", "Loaded fries"],
    ["casual", "crowd-pleaser", "indulgent", "late-night", "hearty"],
    ["gluten-free", "halal"], [450, 850], [40, 280],
    ["The Coop", "Cluck & Crunch"]),
  C("Crêpes & waffles", ["Crêpe", "Batter", "Nutella", "Galette", "Whisk", "Fold", "Parisian"],
    ["French crêpes folded to order — sweet Nutella or savoury galettes.",
     "Liège waffles and crêpes with a dozen toppings, made fresh on the griddle.",
     "Parisian-style crêpes, both sweet and savoury, from a charming cart."],
    ["Nutella crêpe", "Ham & cheese galette", "Liège waffle", "Lemon & sugar", "Berry & cream"],
    ["interactive", "kid-friendly", "sweet", "french", "charming"],
    ["vegetarian", "vegan", "gluten-free"], [300, 600], [30, 220],
    ["The Crêpe Cart", "Fold & Whisk"]),
  C("Doughnuts", ["Glaze", "Ring", "Proof", "Dough", "Sprinkle", "Bloom", "Batch"],
    ["Hand-piped filled doughnuts, proved overnight and glazed to order.",
     "Fresh doughnuts — custard-filled, glazed, and rolled in cinnamon sugar.",
     "Artisan doughnut cart with rotating seasonal flavours and coffee."],
    ["Vanilla custard", "Salted caramel", "Raspberry jam", "Cinnamon sugar", "Pistachio cream"],
    ["indulgent", "instagrammable", "sweet", "kid-friendly", "playful"],
    ["vegetarian", "vegan"], [280, 550], [30, 250],
    ["Proof & Glaze", "The Dough Ring"]),
  C("Fish & chips", ["Chippy", "Batter", "Haddock", "Vinegar", "Catch", "Skerry", "Fryer"],
    ["Beer-battered fish and triple-cooked chips from a proper mobile chippy.",
     "Sustainable cod and haddock, fried golden, with mushy peas and tartare.",
     "The great British chippy on wheels — crisp batter, fluffy chips, sea salt."],
    ["Cod & chips", "Haddock & chips", "Scampi", "Mushy peas", "Battered sausage"],
    ["nostalgic", "British", "casual", "crowd-pleaser", "seaside"],
    ["gluten-free"], [450, 850], [40, 300],
    ["The Rolling Chippy", "Salt & Vinegar"]),
  C("African", ["Suya", "Jollof", "Accra", "Sahel", "Zanzibar", "Baobab", "Injera"],
    ["West African street food — smoky suya skewers and jollof rice with punch.",
     "Pan-African flavours — jollof, plantain, and grilled suya over coals.",
     "East and West African cooking, from injera platters to spiced suya."],
    ["Suya skewers", "Jollof rice", "Fried plantain", "Egusi stew", "Puff puff"],
    ["vibrant", "smoky", "festival", "generous", "bold"],
    ["gluten-free", "dairy-free", "halal", "vegan"], [450, 850], [40, 280],
    ["Suya & Smoke", "Jollof Yard"]),
];

// ── Helpers ──
let seed = 20260714;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
const pick = (a) => a[Math.floor(rnd() * a.length)];
const pickN = (a, n) => { const s = new Set(); while (s.size < Math.min(n, a.length)) s.add(pick(a)); return [...s]; };
const slugify = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sqlStr = (s) => (s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const sqlArr = (a) => (a && a.length ? `ARRAY[${a.map((x) => `'${String(x).replace(/'/g, "''")}'`).join(",")}]::text[]` : "ARRAY[]::text[]");
const money = (min, max) => Math.round((min + rnd() * (max - min)) / 25) * 25;

function makeVendor(cui, usedSlugs) {
  // name
  let name = "";
  for (let i = 0; i < 40; i++) {
    name = rnd() < 0.25 && cui.extraNames.length ? pick(cui.extraNames) : `${pick(cui.prefixes)} ${pick(SUF)}`;
    if (!usedSlugs.has(slugify(name))) break;
  }
  const slug = slugify(name);
  if (usedSlugs.has(slug)) return null;
  usedSlugs.add(slug);

  const [area, lat, lng] = pick(AREAS);
  const desc = pick(cui.descs);
  const sig = pickN(cui.sig, 3);
  const vibe = pickN(cui.vibe, 4).concat(pickN(cui.diet.includes("vegan") ? ["vegan-friendly"] : [], 1));
  const occ = pickN(OCC, 4 + Math.floor(rnd() * 3));
  const diet = pickN(cui.diet, 2 + Math.floor(rnd() * (cui.diet.length - 1)));
  const priceFrom = money(cui.price[0], cui.price[1]);
  const priceRange = priceFrom < 400 ? "£" : priceFrom < 800 ? "££" : "£££";
  const capMin = cui.cap[0], capMax = cui.cap[1];
  const hasReviews = rnd() < 0.72;
  const reviewCount = hasReviews ? 2 + Math.floor(rnd() * 40) : 0;
  const rating = hasReviews ? (4.3 + rnd() * 0.7).toFixed(2) : null;
  const bio = `${name} is a London-based ${cui.category.toLowerCase()} vendor. ${desc} We cater ${occ.slice(0, 3).join(", ")} across the capital, and pride ourselves on ${pick(["generous portions", "seasonal ingredients", "a smooth setup", "friendly service", "a memorable centrepiece"])}.`;

  return {
    id: randomUUID(), serviceId: randomUUID(), slug, name, area, lat, lng,
    category: cui.category, desc, sig, vibe, occ, diet, priceFrom, priceRange,
    priceNotes: `From £${priceFrom}. ${rnd() < 0.5 ? `Minimum spend applies.` : `Per-head options available.`}`,
    capMin, capMax, rating, reviewCount, bio,
    coverage: [5, 8, 10, 12, 15, 20][Math.floor(rnd() * 6)],
    years: 1 + Math.floor(rnd() * 12),
    email: `hello@${slug}.co.uk`,
    phone: `07${Math.floor(100 + rnd() * 899)} ${Math.floor(100000 + rnd() * 899999)}`,
    website: `https://${slug}.co.uk`,
    instagram: `@${slug.replace(/-/g, "")}`,
    title: name,
  };
}

function embeddingText(v) {
  const parts = [
    v.category, v.title, v.desc, v.bio,
    "Signature items: " + v.sig.join(", "),
    "Vibe: " + v.vibe.join(", "),
    "Good for: " + v.occ.join(", "),
    "Dietary: " + v.diet.join(", "),
  ];
  return parts.filter(Boolean).join("\n\n");
}

const DRY = !!process.env.DRY;

async function embedBatch(texts) {
  if (DRY) return texts.map(() => Array.from({ length: 1024 }, () => 0));
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${VOYAGE_API_KEY}` },
    body: JSON.stringify({ model: "voyage-3", input: texts, input_type: "document" }),
  });
  if (!res.ok) { const b = await res.text(); const e = new Error(`Voyage ${res.status}: ${b.slice(0, 120)}`); e.status = res.status; throw e; }
  return (await res.json()).data.map((d) => d.embedding);
}

// ── Reuse embeddings already computed into seed/sql/ (avoids re-calling Voyage) ──
function loadEmbeddingCache() {
  const sqlDir = resolve(__dirname, "../seed/sql");
  const cache = new Map(); // slug -> vector string "[...]"
  if (!existsSync(sqlDir)) return cache;
  const idToSlug = new Map();
  const files = readdirSync(sqlDir).filter((f) => f.endsWith(".sql"));
  for (const f of files) {
    for (const line of readFileSync(resolve(sqlDir, f), "utf-8").split("\n")) {
      const vm = line.match(/^INSERT INTO vendors .*?VALUES \('([^']+)', '([^']+)',/);
      if (vm) { idToSlug.set(vm[1], vm[2]); continue; }
      const sm = line.match(/^INSERT INTO vendor_services .*?VALUES \('[^']+', '([^']+)',.*?'(\[[-0-9.,e]+\])'::vector\);/);
      if (sm) { const slug = idToSlug.get(sm[1]); if (slug) cache.set(slug, sm[2]); }
    }
  }
  return cache;
}

async function main() {
  console.log("Loading existing slugs…");
  const { data: existing } = await supabase.from("vendors").select("slug");
  const usedSlugs = new Set((existing || []).map((r) => r.slug));
  console.log(`${usedSlugs.size} existing slugs.`);

  const vendors = [];
  let ci = 0;
  while (vendors.length < TARGET_NEW) {
    const v = makeVendor(CUISINES[ci % CUISINES.length], usedSlugs);
    ci++;
    if (v) vendors.push(v);
    if (ci > TARGET_NEW * 6) break;
  }
  console.log(`Generated ${vendors.length} vendors across ${CUISINES.length} cuisines.`);

  // Reuse embeddings from the prior run if present; else embed via Voyage.
  const cache = loadEmbeddingCache();
  console.log(`Embedding cache: ${cache.size} slugs available.`);
  const embBySlug = new Map();
  const need = vendors.filter((v) => !cache.has(v.slug));
  for (const v of vendors) if (cache.has(v.slug)) embBySlug.set(v.slug, cache.get(v.slug));

  if (need.length) {
    console.log(`Embedding ${need.length} uncached via Voyage…`);
    const EMBED_BATCH = 20, DELAY = 24000;
    for (let i = 0; i < need.length; i += EMBED_BATCH) {
      const chunk = need.slice(i, i + EMBED_BATCH);
      let embs;
      for (let a = 0; ; a++) {
        try { embs = await embedBatch(chunk.map(embeddingText)); break; }
        catch (e) { if (e.status === 429 && a < 6) { await new Promise((r) => setTimeout(r, 30000)); continue; } throw e; }
      }
      chunk.forEach((v, j) => embBySlug.set(v.slug, `[${embs[j].join(",")}]`));
      console.log(`  Embedded ${Math.min(i + EMBED_BATCH, need.length)}/${need.length}`);
      if (!DRY && i + EMBED_BATCH < need.length) await new Promise((r) => setTimeout(r, DELAY));
    }
  }

  // Insert via the Supabase client in batches (embedding as a string, which
  // PostgREST casts to vector). base_location is set afterwards via SQL.
  const CHUNK = 100;
  let inserted = 0;
  for (let i = 0; i < vendors.length; i += CHUNK) {
    const chunk = vendors.slice(i, i + CHUNK);
    const vRows = chunk.map((v) => ({
      id: v.id, slug: v.slug, name: v.name, description: v.desc, status: "live",
      base_postcode: v.area, coverage_radius_miles: v.coverage,
      price_range: v.priceRange, primary_category: v.category,
      bio: v.bio, contact_email: v.email, contact_phone: v.phone, website: v.website,
      instagram: v.instagram, rating_avg: v.rating, review_count: v.reviewCount,
      min_lead_days: 7, max_advance_days: 180, vibe_tags: v.vibe, occasion_fit: v.occ,
      dietary_options: v.diet, typical_event_size_min: v.capMin, typical_event_size_max: v.capMax,
      years_active: v.years,
    }));
    const { error: ve } = await supabase.from("vendors").insert(vRows);
    if (ve) { console.error("vendor insert error:", ve.message); process.exit(1); }

    const sRows = chunk.map((v) => ({
      id: v.serviceId, vendor_id: v.id, service_type: "other", category: v.category,
      dietary_options: v.diet, title: v.title, description: v.desc, setting: "either",
      capacity_min: v.capMin, capacity_max: v.capMax, price_from: v.priceFrom,
      price_notes: v.priceNotes, position: 0,
      embedding: embBySlug.get(v.slug),
    }));
    const { error: se } = await supabase.from("vendor_services").insert(sRows);
    if (se) { console.error("service insert error:", se.message); process.exit(1); }

    inserted += chunk.length;
    console.log(`  Inserted ${inserted}/${vendors.length}`);
  }

  // Locations for the base_location backfill (compact — set via one SQL update).
  writeFileSync(resolve(__dirname, "../seed/locations.json"),
    JSON.stringify(vendors.map((v) => [v.slug, v.lng, v.lat])));
  console.log(`\n✓ Inserted ${inserted} vendors. Wrote seed/locations.json for base_location backfill.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
