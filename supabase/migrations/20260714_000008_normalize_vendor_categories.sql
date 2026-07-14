-- The canonical `category` on vendor_services was wrong for ~half the catalogue
-- (Middle Eastern/Indian/Asian → "Tacos", British → "BBQ", cocktail bars →
-- "Coffee cart"). primary_category (free text) is reliable, so re-derive from it.
-- Applied to remote 2026-07-14.
UPDATE vendor_services s
SET category = CASE v.primary_category
    WHEN 'pizza vans / wood-fired pizza trailers'          THEN 'Pizza'
    WHEN 'burger trucks and trailers'                      THEN 'Burgers'
    WHEN 'taco trucks and Mexican'                         THEN 'Tacos & Mexican'
    WHEN 'BBQ and smoker catering'                         THEN 'BBQ'
    WHEN 'grazing tables and charcuterie'                  THEN 'Grazing & cheese'
    WHEN 'coffee carts and mobile baristas'                THEN 'Coffee'
    WHEN 'dessert vans (donuts, churros, crepes, waffles)' THEN 'Desserts'
    WHEN 'ice cream vans and gelato carts'                 THEN 'Ice cream'
    WHEN 'Middle Eastern (falafel, mezze, shawarma)'       THEN 'Middle Eastern'
    WHEN 'Indian street food (chaat, dosa, curries)'       THEN 'Indian'
    WHEN 'bao, dumplings, and Asian street food'           THEN 'Asian street food'
    WHEN 'pie and mash / British comfort'                  THEN 'British comfort'
    WHEN 'drop-off canapés and finger food'                THEN 'Canapés'
    WHEN 'vegan and plant-based specialists'               THEN 'Vegan'
    WHEN 'cocktail bars and mobile bartenders'             THEN 'Cocktail bar'
    ELSE COALESCE(s.category, 'Street food')
  END
FROM vendors v
WHERE s.vendor_id = v.id;

-- Align vendors.primary_category to the same canonical label for display.
UPDATE vendors v
SET primary_category = s.category
FROM vendor_services s
WHERE s.vendor_id = v.id;
