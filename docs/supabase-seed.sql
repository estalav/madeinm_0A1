-- Hecho Aqui
-- Initial seed data for the MadeinM Supabase project
-- Date: 2026-03-30

begin;

-- Pilot market
insert into public.markets (name, city, state, country_code, market_type)
values
  ('Central de Abasto CDMX', 'Ciudad de Mexico', 'Ciudad de Mexico', 'MX', 'central_abasto')
on conflict do nothing;

-- Products
with upserted_products as (
  insert into public.products (
    name,
    category,
    subcategory,
    brand_name,
    description,
    is_packaged,
    default_image_url,
    status
  )
  values
    ('Jitomate Saladet', 'produce', 'vegetable', null, 'Tomate de uso comun en cocina mexicana.', false, null, 'active'),
    ('Aguacate Hass', 'produce', 'fruit', null, 'Aguacate popular para guacamole y consumo diario.', false, null, 'active'),
    ('Cebolla Blanca', 'produce', 'vegetable', null, 'Cebolla blanca de uso comun en platillos mexicanos.', false, null, 'active'),
    ('Limon Mexicano', 'produce', 'citrus', null, 'Limon pequeno de sabor intenso, comun en mercados mexicanos.', false, null, 'active'),
    ('Nopal Fresco', 'produce', 'cactus', null, 'Penca de nopal para ensaladas, guisados y asados.', false, null, 'active'),
    ('Mango Ataulfo', 'produce', 'fruit', null, 'Mango dulce originario y ampliamente cultivado en Mexico.', false, null, 'active'),
    ('Papaya Maradol', 'produce', 'fruit', null, 'Papaya de consumo frecuente en hogares mexicanos.', false, null, 'active'),
    ('Cilantro Fresco', 'produce', 'herb', null, 'Hierba aromatica comun en salsas, caldos y tacos.', false, null, 'active'),
    ('Chile Serrano', 'produce', 'chile', null, 'Chile fresco para salsas y condimentos.', false, null, 'active'),
    ('Frijol Negro Seco', 'pantry', 'legume', null, 'Frijol negro seco vendido a granel o en empaque.', true, null, 'active')
  on conflict do nothing
  returning id, name
)
select count(*) from upserted_products;

-- Aliases
insert into public.product_aliases (product_id, alias, locale)
select p.id, a.alias, 'es-MX'
from public.products p
join (
  values
    ('Jitomate Saladet', 'tomate saladet'),
    ('Jitomate Saladet', 'jitomate'),
    ('Aguacate Hass', 'aguacate'),
    ('Cebolla Blanca', 'cebolla'),
    ('Limon Mexicano', 'limon'),
    ('Nopal Fresco', 'nopal'),
    ('Mango Ataulfo', 'mango'),
    ('Papaya Maradol', 'papaya'),
    ('Cilantro Fresco', 'cilantro'),
    ('Chile Serrano', 'serrano'),
    ('Frijol Negro Seco', 'frijol negro')
) as a(product_name, alias)
  on p.name = a.product_name
on conflict do nothing;

-- Origins
insert into public.origins (
  product_id,
  origin_status,
  confidence_level,
  country_code,
  state_name,
  city_name,
  summary_reason,
  last_verified_at
)
select
  p.id,
  'producido_en_mexico',
  case
    when p.name in ('Mango Ataulfo', 'Nopal Fresco', 'Limon Mexicano') then 'verificado'::public.confidence_level
    else 'alta'::public.confidence_level
  end,
  'MX',
  case
    when p.name = 'Mango Ataulfo' then 'Chiapas'
    when p.name = 'Aguacate Hass' then 'Michoacan'
    when p.name = 'Limon Mexicano' then 'Colima'
    when p.name = 'Papaya Maradol' then 'Veracruz'
    when p.name = 'Nopal Fresco' then 'Estado de Mexico'
    else null
  end,
  null,
  case
    when p.name = 'Mango Ataulfo' then 'Producto ampliamente asociado con cultivo nacional y registro curado inicial.'
    when p.name = 'Aguacate Hass' then 'Producto comun de origen mexicano en el piloto con validacion curada inicial.'
    when p.name = 'Limon Mexicano' then 'Clasificacion inicial sustentada por catalogo curado para el piloto.'
    else 'Clasificacion inicial para piloto de mercado local en Mexico.'
  end,
  timezone('utc', now())
from public.products p
where not exists (
  select 1
  from public.origins o
  where o.product_id = p.id
);

-- Origin evidence
insert into public.origin_evidence (
  product_id,
  origin_id,
  evidence_type,
  evidence_value,
  source_note,
  confidence_score,
  is_supporting_origin,
  captured_by_type
)
select
  p.id,
  o.id,
  'manual_admin_review',
  'Initial curated pilot record',
  'Registro inicial curado manualmente para el piloto en Central de Abasto CDMX.',
  case
    when o.confidence_level = 'verificado' then 0.95
    when o.confidence_level = 'alta' then 0.85
    else 0.60
  end,
  true,
  'admin'
from public.products p
join public.origins o on o.product_id = p.id
where not exists (
  select 1
  from public.origin_evidence e
  where e.product_id = p.id
    and e.evidence_type = 'manual_admin_review'
);

-- Nutrition profiles
insert into public.nutrition_profiles (
  product_id,
  serving_size,
  calories,
  protein_g,
  carbs_g,
  fat_g,
  fiber_g,
  sugar_g,
  ingredients_text,
  source
)
select
  p.id,
  n.serving_size,
  n.calories,
  n.protein_g,
  n.carbs_g,
  n.fat_g,
  n.fiber_g,
  n.sugar_g,
  n.ingredients_text,
  'Initial curated pilot dataset'
from public.products p
join (
  values
    ('Jitomate Saladet', '100 g', 18, 0.9, 3.9, 0.2, 1.2, 2.6, 'Jitomate fresco'),
    ('Aguacate Hass', '100 g', 160, 2.0, 8.5, 14.7, 6.7, 0.7, 'Aguacate fresco'),
    ('Cebolla Blanca', '100 g', 40, 1.1, 9.3, 0.1, 1.7, 4.2, 'Cebolla fresca'),
    ('Limon Mexicano', '100 g', 30, 0.7, 10.5, 0.2, 2.8, 1.7, 'Limon fresco'),
    ('Nopal Fresco', '100 g', 16, 1.3, 3.3, 0.1, 2.2, 1.5, 'Nopal fresco'),
    ('Mango Ataulfo', '100 g', 60, 0.8, 15.0, 0.4, 1.6, 13.7, 'Mango fresco'),
    ('Papaya Maradol', '100 g', 43, 0.5, 10.8, 0.3, 1.7, 7.8, 'Papaya fresca'),
    ('Cilantro Fresco', '100 g', 23, 2.1, 3.7, 0.5, 2.8, 0.9, 'Cilantro fresco'),
    ('Chile Serrano', '100 g', 32, 1.7, 7.5, 0.4, 3.7, 4.0, 'Chile serrano fresco'),
    ('Frijol Negro Seco', '100 g', 339, 21.6, 62.4, 1.4, 15.5, 2.1, 'Frijol negro seco')
) as n(product_name, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, ingredients_text)
  on p.name = n.product_name
where not exists (
  select 1
  from public.nutrition_profiles np
  where np.product_id = p.id
);

-- Recipes
insert into public.recipes (
  title,
  description,
  instructions,
  prep_minutes,
  cook_minutes,
  servings,
  calorie_estimate,
  health_notes,
  image_url
)
values
  (
    'Guacamole Casero',
    'Receta sencilla con aguacate, cebolla, cilantro y limon.',
    'Machaca el aguacate. Agrega cebolla picada, cilantro y jugo de limon. Mezcla y ajusta con sal al gusto.',
    10,
    0,
    4,
    180,
    'Fuente de grasas saludables y fibra.',
    null
  ),
  (
    'Ensalada de Nopal con Jitomate',
    'Ensalada fresca con nopal, jitomate, cebolla y cilantro.',
    'Cuece el nopal y dejalo enfriar. Mezcla con jitomate, cebolla y cilantro picados. Agrega limon y sal.',
    15,
    10,
    4,
    95,
    'Alta en fibra y baja en calorias.',
    null
  ),
  (
    'Salsa Verde con Chile Serrano',
    'Salsa fresca para tacos y antojitos.',
    'Licua chile serrano, cilantro, cebolla, limon y sal con un poco de agua hasta obtener la consistencia deseada.',
    10,
    0,
    6,
    20,
    'Aporta sabor con pocas calorias.',
    null
  )
on conflict do nothing;

-- Recipe links
insert into public.recipe_products (recipe_id, product_id, is_primary)
select r.id, p.id, rp.is_primary
from (
  values
    ('Guacamole Casero', 'Aguacate Hass', true),
    ('Guacamole Casero', 'Cebolla Blanca', false),
    ('Guacamole Casero', 'Cilantro Fresco', false),
    ('Guacamole Casero', 'Limon Mexicano', false),
    ('Ensalada de Nopal con Jitomate', 'Nopal Fresco', true),
    ('Ensalada de Nopal con Jitomate', 'Jitomate Saladet', false),
    ('Ensalada de Nopal con Jitomate', 'Cebolla Blanca', false),
    ('Ensalada de Nopal con Jitomate', 'Cilantro Fresco', false),
    ('Salsa Verde con Chile Serrano', 'Chile Serrano', true),
    ('Salsa Verde con Chile Serrano', 'Cilantro Fresco', false),
    ('Salsa Verde con Chile Serrano', 'Cebolla Blanca', false),
    ('Salsa Verde con Chile Serrano', 'Limon Mexicano', false)
) as rp(recipe_title, product_name, is_primary)
join public.recipes r on r.title = rp.recipe_title
join public.products p on p.name = rp.product_name
on conflict do nothing;

-- Local market prices
insert into public.market_prices (
  product_id,
  market_id,
  price_amount,
  price_unit,
  currency_code,
  observed_on,
  source_type,
  source_note,
  is_verified
)
select
  p.id,
  m.id,
  mp.price_amount,
  mp.price_unit::public.price_unit,
  'MXN',
  current_date,
  'admin',
  'Precio piloto de referencia para Central de Abasto CDMX.',
  true
from (
  values
    ('Jitomate Saladet', 24.00, 'kg'),
    ('Aguacate Hass', 68.00, 'kg'),
    ('Cebolla Blanca', 22.00, 'kg'),
    ('Limon Mexicano', 30.00, 'kg'),
    ('Nopal Fresco', 18.00, 'kg'),
    ('Mango Ataulfo', 42.00, 'kg'),
    ('Papaya Maradol', 26.00, 'kg'),
    ('Cilantro Fresco', 8.00, 'bundle'),
    ('Chile Serrano', 36.00, 'kg'),
    ('Frijol Negro Seco', 34.00, 'kg')
) as mp(product_name, price_amount, price_unit)
join public.products p on p.name = mp.product_name
join public.markets m on m.name = 'Central de Abasto CDMX'
where not exists (
  select 1
  from public.market_prices existing
  where existing.product_id = p.id
    and existing.market_id = m.id
    and existing.observed_on = current_date
);

-- Comparison retailer prices
insert into public.retailer_prices (
  product_id,
  retailer_name,
  city,
  state,
  price_amount,
  price_unit,
  currency_code,
  observed_on,
  source_url,
  is_verified
)
select
  p.id,
  'Walmart',
  'Ciudad de Mexico',
  'Ciudad de Mexico',
  rp.price_amount,
  rp.price_unit::public.price_unit,
  'MXN',
  current_date,
  null,
  false
from (
  values
    ('Jitomate Saladet', 29.90, 'kg'),
    ('Aguacate Hass', 84.00, 'kg'),
    ('Cebolla Blanca', 27.50, 'kg'),
    ('Limon Mexicano', 36.00, 'kg'),
    ('Nopal Fresco', 24.00, 'kg'),
    ('Mango Ataulfo', 49.00, 'kg'),
    ('Papaya Maradol', 31.00, 'kg'),
    ('Cilantro Fresco', 10.00, 'bundle'),
    ('Chile Serrano', 44.00, 'kg'),
    ('Frijol Negro Seco', 42.00, 'kg')
) as rp(product_name, price_amount, price_unit)
join public.products p on p.name = rp.product_name
where not exists (
  select 1
  from public.retailer_prices existing
  where existing.product_id = p.id
    and existing.retailer_name = 'Walmart'
    and existing.observed_on = current_date
);

-- Starter badges
insert into public.badges (slug, name, description, icon_name, rule_type)
values
  ('explorador-local', 'Explorador Local', 'Escanea tus primeros productos del mercado local.', 'compass', 'scan_count'),
  ('orgullo-mexicano', 'Orgullo Mexicano', 'Descubre y guarda productos producidos en Mexico.', 'flag', 'favorite_mexican_products'),
  ('cocina-de-aqui', 'Cocina de Aqui', 'Consulta recetas con productos del mercado.', 'chef-hat', 'recipe_usage')
on conflict (slug) do nothing;

commit;
