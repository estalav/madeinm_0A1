-- Hecho Aqui
-- Initial Supabase/Postgres schema draft
-- Date: 2026-03-30
--
-- Notes:
-- - This schema is designed for a web-first MVP with future SwiftUI reuse.
-- - Trust and auditability are first-class concerns, so origin evidence and
--   classification runs are modeled explicitly.
-- - Supabase Auth users live in auth.users; public.profile rows mirror them.

create extension if not exists "pgcrypto";

-- Enums

create type public.product_status as enum (
  'active',
  'draft',
  'archived'
);

create type public.code_type as enum (
  'ean13',
  'upc',
  'qr',
  'other'
);

create type public.origin_status as enum (
  'hecho_en_mexico',
  'producido_en_mexico',
  'empacado_en_mexico',
  'importado',
  'no_confirmado'
);

create type public.confidence_level as enum (
  'verificado',
  'alta',
  'media',
  'baja'
);

create type public.evidence_type as enum (
  'barcode_match',
  'label_text',
  'image_analysis',
  'ocr_text',
  'vendor_claim',
  'manual_admin_review',
  'external_registry',
  'user_submission'
);

create type public.actor_type as enum (
  'system',
  'admin',
  'user',
  'agent'
);

create type public.image_source_type as enum (
  'official',
  'user',
  'admin',
  'generated_reference'
);

create type public.market_type as enum (
  'central_abasto',
  'mercado_local',
  'tianguis',
  'other'
);

create type public.price_unit as enum (
  'kg',
  'piece',
  'bundle',
  'liter',
  'package'
);

create type public.price_source_type as enum (
  'admin',
  'user',
  'vendor',
  'partner_feed'
);

create type public.scan_result_status as enum (
  'matched',
  'multiple_candidates',
  'no_match',
  'needs_review'
);

create type public.review_status as enum (
  'auto_approved',
  'needs_review',
  'admin_confirmed'
);

create type public.review_decision as enum (
  'confirm',
  'correct',
  'reject',
  'needs_more_evidence'
);

create type public.reward_event_type as enum (
  'first_scan',
  'daily_scan',
  'purchase_confirmed',
  'new_product_discovered',
  'recipe_used',
  'market_visit'
);

-- Timestamp helper

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Profiles

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  city text,
  state text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Products

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  subcategory text,
  brand_name text,
  description text,
  is_packaged boolean not null default false,
  default_image_url text,
  status public.product_status not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index idx_products_name on public.products using gin (to_tsvector('simple', name));
create index idx_products_category on public.products (category);

create trigger set_products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

create table public.product_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  alias text not null,
  locale text default 'es-MX',
  created_at timestamptz not null default timezone('utc', now())
);

create unique index idx_product_aliases_unique on public.product_aliases (product_id, alias);
create index idx_product_aliases_alias on public.product_aliases using gin (to_tsvector('simple', alias));

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  source_type public.image_source_type not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_product_images_product on public.product_images (product_id);

create table public.barcodes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  code_value text not null,
  code_type public.code_type not null,
  source text,
  is_verified boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index idx_barcodes_code_value_unique on public.barcodes (code_value, code_type);
create index idx_barcodes_product on public.barcodes (product_id);

-- Trust and origin model

create table public.origins (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  origin_status public.origin_status not null default 'no_confirmado',
  confidence_level public.confidence_level not null default 'baja',
  country_code text,
  state_name text,
  city_name text,
  summary_reason text,
  last_verified_at timestamptz,
  last_reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index idx_origins_status on public.origins (origin_status);
create index idx_origins_confidence on public.origins (confidence_level);

create trigger set_origins_updated_at
before update on public.origins
for each row
execute function public.set_updated_at();

create table public.origin_evidence (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  origin_id uuid references public.origins(id) on delete cascade,
  evidence_type public.evidence_type not null,
  evidence_value text,
  source_url text,
  source_note text,
  confidence_score numeric(4,3) check (confidence_score between 0 and 1),
  is_supporting_origin boolean not null default true,
  captured_by_type public.actor_type not null,
  captured_by_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_origin_evidence_product on public.origin_evidence (product_id);
create index idx_origin_evidence_origin on public.origin_evidence (origin_id);
create index idx_origin_evidence_type on public.origin_evidence (evidence_type);

-- Nutrition and recipes

create table public.nutrition_profiles (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  serving_size text,
  calories integer,
  protein_g numeric(8,2),
  carbs_g numeric(8,2),
  fat_g numeric(8,2),
  fiber_g numeric(8,2),
  sugar_g numeric(8,2),
  ingredients_text text,
  source text,
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_nutrition_profiles_updated_at
before update on public.nutrition_profiles
for each row
execute function public.set_updated_at();

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  instructions text not null,
  prep_minutes integer,
  cook_minutes integer,
  servings integer,
  calorie_estimate integer,
  health_notes text,
  image_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_recipes_updated_at
before update on public.recipes
for each row
execute function public.set_updated_at();

create table public.recipe_products (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index idx_recipe_products_unique on public.recipe_products (recipe_id, product_id);
create index idx_recipe_products_product on public.recipe_products (product_id);

-- Markets and prices

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  state text not null,
  country_code text not null default 'MX',
  market_type public.market_type not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_markets_city_state on public.markets (city, state);

create table public.market_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  price_amount numeric(12,2) not null check (price_amount >= 0),
  price_unit public.price_unit not null,
  currency_code text not null default 'MXN',
  observed_on date not null,
  source_type public.price_source_type not null,
  source_note text,
  is_verified boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_market_prices_product on public.market_prices (product_id);
create index idx_market_prices_market on public.market_prices (market_id);
create index idx_market_prices_observed_on on public.market_prices (observed_on desc);

create table public.retailer_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  retailer_name text not null,
  city text,
  state text,
  price_amount numeric(12,2) not null check (price_amount >= 0),
  price_unit public.price_unit not null,
  currency_code text not null default 'MXN',
  observed_on date not null,
  source_url text,
  is_verified boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_retailer_prices_product on public.retailer_prices (product_id);
create index idx_retailer_prices_retailer on public.retailer_prices (retailer_name);
create index idx_retailer_prices_observed_on on public.retailer_prices (observed_on desc);

-- Classification pipeline

create table public.classification_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  image_url text,
  barcode_value text,
  ocr_text text,
  agent_version text,
  matched_product_id uuid references public.products(id) on delete set null,
  origin_status_result public.origin_status,
  confidence_level_result public.confidence_level,
  explanation text,
  review_status public.review_status not null default 'needs_review',
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_classification_runs_user on public.classification_runs (user_id);
create index idx_classification_runs_product on public.classification_runs (matched_product_id);
create index idx_classification_runs_review_status on public.classification_runs (review_status);

create table public.user_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  uploaded_image_url text,
  barcode_value text,
  matched_product_id uuid references public.products(id) on delete set null,
  classification_run_id uuid references public.classification_runs(id) on delete set null,
  result_status public.scan_result_status not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_user_scans_user on public.user_scans (user_id);
create index idx_user_scans_product on public.user_scans (matched_product_id);
create index idx_user_scans_created_at on public.user_scans (created_at desc);

create table public.admin_reviews (
  id uuid primary key default gen_random_uuid(),
  classification_run_id uuid not null references public.classification_runs(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  reviewer_user_id uuid references public.profiles(id) on delete set null,
  decision public.review_decision not null,
  review_notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_admin_reviews_run on public.admin_reviews (classification_run_id);

-- User engagement

create table public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index idx_user_favorites_unique on public.user_favorites (user_id, product_id);

create table public.reward_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type public.reward_event_type not null,
  points integer not null check (points >= 0),
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_reward_events_user on public.reward_events (user_id);
create index idx_reward_events_event_type on public.reward_events (event_type);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  icon_name text,
  rule_type text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default timezone('utc', now())
);

create unique index idx_user_badges_unique on public.user_badges (user_id, badge_id);

-- Convenience views

create or replace view public.product_summary as
select
  p.id,
  p.name,
  p.category,
  p.subcategory,
  p.brand_name,
  p.is_packaged,
  p.default_image_url,
  p.status,
  o.origin_status,
  o.confidence_level,
  o.summary_reason,
  np.calories
from public.products p
left join public.origins o on o.product_id = p.id
left join public.nutrition_profiles np on np.product_id = p.id;

create or replace view public.user_reward_totals as
select
  re.user_id,
  coalesce(sum(re.points), 0) as total_points
from public.reward_events re
group by re.user_id;

-- Optional helper for profile creation after signup

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Seed example market for the pilot

insert into public.markets (name, city, state, market_type)
values ('Central de Abasto CDMX', 'Ciudad de Mexico', 'Ciudad de Mexico', 'central_abasto')
on conflict do nothing;
