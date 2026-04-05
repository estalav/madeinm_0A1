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
values
  (
    'Organic Yellow Bell Pepper',
    'produce',
    'vegetable',
    null,
    'Pimiento morron amarillo organico vendido a granel o por pieza.',
    false,
    null,
    'active'
  ),
  (
    'Zucchini Organic',
    'produce',
    'vegetable',
    null,
    'Calabacita verde organica de uso comun en cocina casera.',
    false,
    null,
    'active'
  ),
  (
    'Broccoli Crown',
    'produce',
    'vegetable',
    null,
    'Corona de brocoli fresco para vapor, salteados y ensaladas.',
    false,
    null,
    'active'
  ),
  (
    'Carrot Bunch',
    'produce',
    'vegetable',
    null,
    'Zanahoria fresca vendida en manojo o a granel.',
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
    ('Organic Yellow Bell Pepper', 'yellow bell pepper'),
    ('Organic Yellow Bell Pepper', 'organic yellow bell pepper'),
    ('Organic Yellow Bell Pepper', 'bell pepper'),
    ('Organic Yellow Bell Pepper', 'pimiento amarillo'),
    ('Organic Yellow Bell Pepper', 'pimiento morron amarillo'),
    ('Organic Yellow Bell Pepper', 'pimiento'),
    ('Zucchini Organic', 'zucchini'),
    ('Zucchini Organic', 'organic zucchini'),
    ('Zucchini Organic', 'squash zucchini organic'),
    ('Zucchini Organic', 'calabacita'),
    ('Zucchini Organic', 'calabacita verde'),
    ('Broccoli Crown', 'broccoli'),
    ('Broccoli Crown', 'brocoli'),
    ('Broccoli Crown', 'broccoli crown'),
    ('Carrot Bunch', 'carrot'),
    ('Carrot Bunch', 'carrots'),
    ('Carrot Bunch', 'zanahoria'),
    ('Carrot Bunch', 'zanahorias')
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
  'Producto agregado al piloto a partir de reconocimiento multiobjeto. Su origen no debe darse por confirmado sin evidencia adicional del proveedor, letrero o etiqueta.',
  timezone('utc', now())
from public.products p
where p.name in ('Organic Yellow Bell Pepper', 'Zucchini Organic', 'Broccoli Crown', 'Carrot Bunch')
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
  'Initial curated pilot record for produce recognition',
  'Registro inicial curado para productos detectados en flujo multiobjeto sin afirmar origen.',
  0.60,
  true,
  'admin'
from public.products p
join public.origins o on o.product_id = p.id
where p.name in ('Organic Yellow Bell Pepper', 'Zucchini Organic', 'Broccoli Crown', 'Carrot Bunch')
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
  n.serving_size,
  n.calories,
  n.protein_g,
  n.carbs_g,
  n.fat_g,
  n.fiber_g,
  n.sugar_g,
  n.ingredients_text,
  'Produce wave 1 patch'
from public.products p
join (
  values
    ('Organic Yellow Bell Pepper', '100 g', 27, 1.0, 6.3, 0.2, 0.9, 4.2, 'Pimiento morron amarillo fresco'),
    ('Zucchini Organic', '100 g', 17, 1.2, 3.1, 0.3, 1.0, 2.5, 'Calabacita verde fresca'),
    ('Broccoli Crown', '100 g', 34, 2.8, 6.6, 0.4, 2.6, 1.7, 'Brocoli fresco'),
    ('Carrot Bunch', '100 g', 41, 0.9, 9.6, 0.2, 2.8, 4.7, 'Zanahoria fresca')
) as n(product_name, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, ingredients_text)
  on p.name = n.product_name
where not exists (
  select 1
  from public.nutrition_profiles np
  where np.product_id = p.id
);

commit;
