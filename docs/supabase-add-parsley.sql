begin;

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
values (
  'Parsley (flat-leaf / Italian parsley) bunch',
  'produce',
  'herb',
  null,
  'Ramo de perejil fresco de hoja plana, comun en cocina casera y de mercado.',
  false,
  null,
  'active'
)
on conflict do nothing;

insert into public.product_aliases (product_id, alias, locale)
select p.id, a.alias, 'es-MX'
from public.products p
join (
  values
    ('Parsley (flat-leaf / Italian parsley) bunch', 'parsley'),
    ('Parsley (flat-leaf / Italian parsley) bunch', 'italian parsley'),
    ('Parsley (flat-leaf / Italian parsley) bunch', 'flat-leaf parsley'),
    ('Parsley (flat-leaf / Italian parsley) bunch', 'perejil'),
    ('Parsley (flat-leaf / Italian parsley) bunch', 'perejil italiano'),
    ('Parsley (flat-leaf / Italian parsley) bunch', 'ramo de perejil')
) as a(product_name, alias)
  on p.name = a.product_name
on conflict do nothing;

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
  'no_confirmado',
  'media',
  null,
  null,
  null,
  'Producto agregado al piloto para reconocimiento multiobjeto. Su origen no debe darse por confirmado sin evidencia adicional del proveedor o etiqueta.',
  timezone('utc', now())
from public.products p
where p.name = 'Parsley (flat-leaf / Italian parsley) bunch'
  and not exists (
    select 1
    from public.origins o
    where o.product_id = p.id
  );

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
  'Initial curated pilot record for parsley recognition',
  'Registro inicial curado para reconocer perejil en el piloto sin afirmar origen.',
  0.60,
  true,
  'admin'
from public.products p
join public.origins o on o.product_id = p.id
where p.name = 'Parsley (flat-leaf / Italian parsley) bunch'
  and not exists (
    select 1
    from public.origin_evidence e
    where e.product_id = p.id
      and e.evidence_type = 'manual_admin_review'
  );

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
  '100 g',
  36,
  3.0,
  6.3,
  0.8,
  3.3,
  0.9,
  'Perejil fresco',
  'Parsley pilot patch'
from public.products p
where p.name = 'Parsley (flat-leaf / Italian parsley) bunch'
  and not exists (
    select 1
    from public.nutrition_profiles np
    where np.product_id = p.id
  );

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
  9.00,
  'bundle'::public.price_unit,
  'MXN',
  current_date,
  'admin'::public.price_source_type,
  'Precio piloto de referencia para perejil en Central de Abasto CDMX.',
  true
from public.products p
join public.markets m on m.name = 'Central de Abasto CDMX'
where p.name = 'Parsley (flat-leaf / Italian parsley) bunch'
  and not exists (
    select 1
    from public.market_prices existing
    where existing.product_id = p.id
      and existing.market_id = m.id
      and existing.observed_on = current_date
  );

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
  12.00,
  'bundle'::public.price_unit,
  'MXN',
  current_date,
  null,
  false
from public.products p
where p.name = 'Parsley (flat-leaf / Italian parsley) bunch'
  and not exists (
    select 1
    from public.retailer_prices existing
    where existing.product_id = p.id
      and existing.retailer_name = 'Walmart'
      and existing.observed_on = current_date
  );

commit;
